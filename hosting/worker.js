const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8' },
});

let catalogSchemaReady;

async function ensureCatalogSchema(env) {
  if (!env.DB) throw new Error('d1_unavailable');
  if (!catalogSchemaReady) {
    catalogSchemaReady = env.DB.batch([
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS catalog_item_reactions (
        code TEXT NOT NULL, module TEXT NOT NULL, item_id TEXT NOT NULL,
        visitor_key TEXT NOT NULL, reaction TEXT NOT NULL CHECK (reaction IN ('like', 'dislike')),
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
        PRIMARY KEY (code, module, item_id, visitor_key)
      )`),
      env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_catalog_reactions_item
        ON catalog_item_reactions(code, module, item_id)`),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS catalog_item_views (
        code TEXT NOT NULL, module TEXT NOT NULL, item_id TEXT NOT NULL,
        visitor_key TEXT NOT NULL, view_day TEXT NOT NULL, created_at TEXT NOT NULL,
        PRIMARY KEY (code, module, item_id, visitor_key, view_day)
      )`),
      env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_catalog_views_item
        ON catalog_item_views(code, module, item_id)`),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS catalog_promotions (
        code TEXT NOT NULL, module TEXT NOT NULL, item_id TEXT NOT NULL,
        old_price INTEGER NOT NULL, new_price INTEGER NOT NULL,
        starts_at TEXT NOT NULL, ends_at TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1, updated_by TEXT, updated_at TEXT NOT NULL,
        PRIMARY KEY (code, module, item_id)
      )`),
      env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_catalog_promotions_active
        ON catalog_promotions(code, module, active, ends_at)`),
    ]).catch((error) => {
      catalogSchemaReady = null;
      throw error;
    });
  }
  await catalogSchemaReady;
}

function cleanModule(value) {
  return ['menu', 'products', 'services'].includes(value) ? value : 'products';
}

function cleanCode(value) {
  const code = String(value || '').toUpperCase();
  return /^[A-Z0-9-]{2,32}$/.test(code) ? code : '';
}

function cleanItemId(value) {
  const id = String(value || '');
  return /^[A-Za-z0-9_-]{1,80}$/.test(id) ? id : '';
}

async function hashValue(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((part) => part.toString(16).padStart(2, '0')).join('');
}

async function visitorKey(request) {
  const signedIn = request.headers.get('oai-authenticated-user-id');
  const fallback = [
    request.headers.get('cf-connecting-ip') || '',
    request.headers.get('user-agent') || '',
    request.headers.get('accept-language') || '',
  ].join('|');
  return hashValue(signedIn ? `oai:${signedIn}` : `visitor:${fallback}`);
}

async function ownsBusinessProfile(request, code) {
  const headers = new Headers();
  for (const name of ['cookie', 'user-agent', 'accept-language']) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  try {
    const response = await fetch(new Request('https://nfcstore.uz/api/auth/me', { headers }));
    if (!response.ok) return false;
    const payload = await response.json();
    return Array.isArray(payload.cards) && payload.cards.some((card) =>
      String(card.code || '').toUpperCase() === code && card.profileType === 'business');
  } catch {
    return false;
  }
}

async function itemCounts(db, code, module, itemId, currentVisitor) {
  const [reactionRows, viewRow, mine] = await Promise.all([
    db.prepare(`SELECT reaction, COUNT(*) AS count FROM catalog_item_reactions
      WHERE code = ? AND module = ? AND item_id = ? GROUP BY reaction`)
      .bind(code, module, itemId).all(),
    db.prepare(`SELECT COUNT(*) AS count FROM catalog_item_views
      WHERE code = ? AND module = ? AND item_id = ?`)
      .bind(code, module, itemId).first(),
    db.prepare(`SELECT reaction FROM catalog_item_reactions
      WHERE code = ? AND module = ? AND item_id = ? AND visitor_key = ?`)
      .bind(code, module, itemId, currentVisitor).first(),
  ]);
  const result = { likes: 0, dislikes: 0, views: Number(viewRow?.count || 0), reaction: mine?.reaction || null };
  for (const row of reactionRows.results || []) {
    if (row.reaction === 'like') result.likes = Number(row.count || 0);
    if (row.reaction === 'dislike') result.dislikes = Number(row.count || 0);
  }
  return result;
}

async function catalogMeta(request, env, url, match) {
  await ensureCatalogSchema(env);
  const code = cleanCode(match[1]);
  const itemId = cleanItemId(match[2]);
  const action = match[3] || '';
  const module = cleanModule(url.searchParams.get('module'));
  if (!code || (match[2] && !itemId)) return json({ error: 'bad_request' }, 400);
  const visitor = await visitorKey(request);

  if (!itemId && request.method === 'GET') {
    const [reactionRows, viewRows, mineRows, promotionRows] = await Promise.all([
      env.DB.prepare(`SELECT item_id, reaction, COUNT(*) AS count FROM catalog_item_reactions
        WHERE code = ? AND module = ? GROUP BY item_id, reaction`).bind(code, module).all(),
      env.DB.prepare(`SELECT item_id, COUNT(*) AS count FROM catalog_item_views
        WHERE code = ? AND module = ? GROUP BY item_id`).bind(code, module).all(),
      env.DB.prepare(`SELECT item_id, reaction FROM catalog_item_reactions
        WHERE code = ? AND module = ? AND visitor_key = ?`).bind(code, module, visitor).all(),
      env.DB.prepare(`SELECT item_id, old_price, new_price, starts_at, ends_at, active
        FROM catalog_promotions WHERE code = ? AND module = ?`).bind(code, module).all(),
    ]);
    const items = {};
    const ensure = (id) => (items[id] ||= { likes: 0, dislikes: 0, views: 0, reaction: null, promotion: null });
    for (const row of reactionRows.results || []) {
      const entry = ensure(String(row.item_id));
      if (row.reaction === 'like') entry.likes = Number(row.count || 0);
      if (row.reaction === 'dislike') entry.dislikes = Number(row.count || 0);
    }
    for (const row of viewRows.results || []) ensure(String(row.item_id)).views = Number(row.count || 0);
    for (const row of mineRows.results || []) ensure(String(row.item_id)).reaction = row.reaction;
    for (const row of promotionRows.results || []) ensure(String(row.item_id)).promotion = {
      oldPrice: Number(row.old_price), newPrice: Number(row.new_price),
      startsAt: row.starts_at, endsAt: row.ends_at, active: Boolean(row.active),
    };
    return json({ items });
  }

  if (action === 'view' && request.method === 'POST') {
    const now = new Date();
    const day = now.toISOString().slice(0, 10);
    await env.DB.prepare(`INSERT OR IGNORE INTO catalog_item_views
      (code, module, item_id, visitor_key, view_day, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .bind(code, module, itemId, visitor, day, now.toISOString()).run();
    return json(await itemCounts(env.DB, code, module, itemId, visitor));
  }

  if (action === 'reaction' && request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const reaction = ['like', 'dislike'].includes(body.reaction) ? body.reaction : null;
    const now = new Date().toISOString();
    if (reaction) {
      await env.DB.prepare(`INSERT INTO catalog_item_reactions
        (code, module, item_id, visitor_key, reaction, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(code, module, item_id, visitor_key)
        DO UPDATE SET reaction = excluded.reaction, updated_at = excluded.updated_at`)
        .bind(code, module, itemId, visitor, reaction, now, now).run();
    } else {
      await env.DB.prepare(`DELETE FROM catalog_item_reactions
        WHERE code = ? AND module = ? AND item_id = ? AND visitor_key = ?`)
        .bind(code, module, itemId, visitor).run();
    }
    return json(await itemCounts(env.DB, code, module, itemId, visitor));
  }

  if (action === 'promotion' && ['PUT', 'DELETE'].includes(request.method)) {
    if (!(await ownsBusinessProfile(request, code))) return json({ error: 'forbidden' }, 403);
    if (request.method === 'DELETE') {
      await env.DB.prepare(`DELETE FROM catalog_promotions WHERE code = ? AND module = ? AND item_id = ?`)
        .bind(code, module, itemId).run();
      return json({ ok: true });
    }
    const body = await request.json().catch(() => ({}));
    const oldPrice = Math.round(Number(body.oldPrice));
    const newPrice = Math.round(Number(body.newPrice));
    const days = Math.max(1, Math.min(365, Math.round(Number(body.days) || 1)));
    if (!(oldPrice > 0) || !(newPrice > 0) || newPrice >= oldPrice) {
      return json({ error: 'bad_promotion_price' }, 422);
    }
    const startsAt = new Date();
    const endsAt = new Date(startsAt.getTime() + days * 86400000);
    const editor = request.headers.get('oai-authenticated-user-email') || 'profile-owner';
    await env.DB.prepare(`INSERT INTO catalog_promotions
      (code, module, item_id, old_price, new_price, starts_at, ends_at, active, updated_by, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
      ON CONFLICT(code, module, item_id) DO UPDATE SET
        old_price = excluded.old_price, new_price = excluded.new_price,
        starts_at = excluded.starts_at, ends_at = excluded.ends_at,
        active = 1, updated_by = excluded.updated_by, updated_at = excluded.updated_at`)
      .bind(code, module, itemId, oldPrice, newPrice, startsAt.toISOString(), endsAt.toISOString(), editor, startsAt.toISOString()).run();
    return json({ promotion: { oldPrice, newPrice, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), active: true } });
  }

  return json({ error: 'not_found' }, 404);
}

// ── Company Account v2 ────────────────────────────────────────────────
// Personal NFC cards continue to live in the established PostgreSQL API.
// Company IDs are intentionally isolated in D1, have their own lifecycle,
// and never update a record/card row as a side effect.
let companySchemaReady;
const COMPANY_STATUSES = new Set(['draft', 'pending_review', 'approved', 'payment_pending', 'paid', 'active', 'rejected', 'suspended']);
const COMPANY_CATEGORIES = new Set(['restaurant', 'cafe', 'market', 'shop', 'services', 'construction', 'clinic', 'pharmacy', 'education', 'other']);
const BUILTIN_COMPANY_IDS = new Set(['NFCSTORE', 'ADMIN', 'SUPPORT', 'PAYME', 'COMPANY', 'KOMPANIYA', 'WORKSPACE']);

async function ensureCompanySchema(env) {
  if (!env.DB) throw new Error('d1_unavailable');
  if (!companySchemaReady) {
    companySchemaReady = env.DB.batch([
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS companies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id TEXT NOT NULL UNIQUE,
        owner_user_id TEXT NOT NULL,
        owner_email TEXT,
        display_name TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'other', subcategory TEXT,
        city TEXT, address TEXT, description TEXT,
        phone TEXT, telegram TEXT, whatsapp TEXT, website TEXT,
        logo_url TEXT, cover_url TEXT, gallery_json TEXT NOT NULL DEFAULT '[]',
        source_card_code TEXT,
        tier TEXT NOT NULL, price INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'draft',
        admin_note TEXT, rejected_reason TEXT,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
        approved_at TEXT, paid_at TEXT, activated_at TEXT
      )`),
      env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_companies_owner ON companies(owner_user_id, created_at DESC)`),
      env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_companies_status ON companies(status, created_at DESC)`),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS company_catalog_items (
        id TEXT PRIMARY KEY, company_id TEXT NOT NULL,
        name TEXT NOT NULL, category TEXT, description TEXT,
        price INTEGER NOT NULL DEFAULT 0, promotion_price INTEGER,
        image_url TEXT, available INTEGER NOT NULL DEFAULT 1,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
        FOREIGN KEY(company_id) REFERENCES companies(company_id) ON DELETE CASCADE
      )`),
      env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_company_items_company ON company_catalog_items(company_id, sort_order, created_at)`),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS company_id_rules (
        company_id TEXT PRIMARY KEY,
        rule TEXT NOT NULL DEFAULT 'reserved',
        tier_override TEXT, price_override INTEGER,
        note TEXT, updated_by TEXT, updated_at TEXT NOT NULL
      )`),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS company_status_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT, company_id TEXT NOT NULL,
        from_status TEXT, to_status TEXT NOT NULL,
        actor TEXT, note TEXT, created_at TEXT NOT NULL
      )`),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS company_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT, company_id TEXT NOT NULL,
        owner_user_id TEXT NOT NULL, amount INTEGER NOT NULL,
        provider TEXT NOT NULL DEFAULT 'payme', upstream_order_id TEXT,
        status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      )`),
    ]).catch((error) => { companySchemaReady = null; throw error; });
  }
  await companySchemaReady;
}

function companyId(value) {
  const id = String(value || '').trim().toUpperCase();
  return /^[A-Z]{3,15}$/.test(id) ? id : '';
}

function shortText(value, max = 200) {
  return String(value || '').trim().replace(/[\u0000-\u001f]/g, ' ').slice(0, max);
}

function safeUrl(value) {
  const url = shortText(value, 700);
  if (!url) return '';
  if (url.startsWith('/uploads/') || url.startsWith('/business-assets/')) return url;
  try { const parsed = new URL(url); return ['http:', 'https:'].includes(parsed.protocol) ? parsed.toString() : ''; } catch { return ''; }
}

function companyPricing(id, rule) {
  const length = id.length;
  let tier = length === 3 ? 'exclusive' : length <= 5 ? 'premium' : length <= 7 ? 'gold' : 'silver';
  let price = { silver: 349000, gold: 549000, premium: 749000, exclusive: 990000 }[tier];
  if (['silver', 'gold', 'premium', 'exclusive'].includes(rule?.tier_override)) tier = rule.tier_override;
  if (Number(rule?.price_override) >= 0) price = Number(rule.price_override);
  return { tier, price };
}

// Mirrors src/lib/access.js MENU_LIMITS/PRODUCT_LIMITS exactly — duplicated
// here (not imported) for the same reason as the Payme personal-pricing
// mirror above: this file is deployed standalone, with zero `import`
// statements, straight from the Cloudflare dashboard "Edit Code" editor.
const MENU_LIMITS_DEFAULT = {
  free: { cat: 0, item: 0, images: false }, silver: { cat: 1, item: 15, images: false },
  gold: { cat: 8, item: 100, images: true }, premium: { cat: 20, item: 300, images: true },
  exclusive: { cat: 999, item: 9999, images: true },
};
const PRODUCT_LIMITS_DEFAULT = {
  free: { cat: 0, item: 0, images: false }, silver: { cat: 1, item: 15, images: false },
  gold: { cat: 8, item: 100, images: true }, premium: { cat: 20, item: 300, images: true },
  exclusive: { cat: 999, item: 9999, images: true },
};

// NOTE: these used to `fetch()` https://nfcstore.uz/api/auth|admin/me — that
// was the Railway backend, now shut down (and even before that, calling out
// to the Worker's own public domain risked Cloudflare's same-zone loop
// rejection). Auth is now served directly from D1 in this same Worker (see
// the CORE section below), so this just calls those functions in-process.
async function upstreamUser(request, env) {
  try {
    const user = await getCurrentUser(request, env);
    if (!user) return null;
    const rows = await env.DB.prepare(`SELECT code, city, role, phone, avatar_url, bg_url, tg, about, website FROM cards WHERE user_id = ?`).bind(user.id).all();
    const cards = (rows.results || []).map((r) => ({
      code: r.code, city: r.city, role: r.role, phone: r.phone, avatarUrl: r.avatar_url,
      bgUrl: r.bg_url, tg: r.tg, about: r.about, website: r.website, profileType: r.profile_type,
    }));
    return { user, cards };
  } catch { return null; }
}

async function upstreamAdmin(request, env) {
  try {
    const admin = await getCurrentAdmin(request, env);
    if (!admin || admin.idleTimeout) return null;
    return { authenticated: true, role: admin.role };
  } catch { return null; }
}

function rowCompany(row, items = []) {
  let gallery = [];
  try { gallery = JSON.parse(row.gallery_json || '[]'); } catch { gallery = []; }
  return {
    id: row.id, companyId: row.company_id, ownerUserId: row.owner_user_id,
    ownerEmail: row.owner_email || '', displayName: row.display_name,
    category: row.category || 'other', subcategory: row.subcategory || '',
    city: row.city || '', address: row.address || '', description: row.description || '',
    phone: row.phone || '', telegram: row.telegram || '', whatsapp: row.whatsapp || '', website: row.website || '',
    logoUrl: row.logo_url || '', coverUrl: row.cover_url || '', gallery,
    sourceCardCode: row.source_card_code || '', tier: row.tier, price: Number(row.price || 0),
    status: row.status, adminNote: row.admin_note || '', rejectedReason: row.rejected_reason || '',
    createdAt: row.created_at, updatedAt: row.updated_at, approvedAt: row.approved_at,
    paidAt: row.paid_at, activatedAt: row.activated_at,
    catalog: (items || []).map((item) => ({
      id: item.id, name: item.name, category: item.category || '', description: item.description || '',
      price: Number(item.price || 0), promotionPrice: item.promotion_price == null ? null : Number(item.promotion_price),
      imageUrl: item.image_url || '', available: Boolean(item.available), sortOrder: Number(item.sort_order || 0),
    })),
  };
}

async function companyWithItems(env, id) {
  const [row, items] = await Promise.all([
    env.DB.prepare('SELECT * FROM companies WHERE company_id = ?').bind(id).first(),
    env.DB.prepare('SELECT * FROM company_catalog_items WHERE company_id = ? ORDER BY sort_order, created_at').bind(id).all(),
  ]);
  return row ? rowCompany(row, items.results || []) : null;
}

async function companyAvailability(env, rawId) {
  const id = companyId(rawId);
  if (!id) return { companyId: String(rawId || '').toUpperCase(), valid: false, available: false, reason: 'Faqat 3–15 ta lotin harfi mumkin' };
  const [taken, rule] = await Promise.all([
    env.DB.prepare(`SELECT status FROM companies WHERE company_id = ? AND status <> 'rejected'`).bind(id).first(),
    env.DB.prepare('SELECT * FROM company_id_rules WHERE company_id = ?').bind(id).first(),
  ]);
  const pricing = companyPricing(id, rule);
  const blocked = BUILTIN_COMPANY_IDS.has(id) || ['reserved', 'off_sale', 'blocked'].includes(rule?.rule);
  const alternatives = [];
  for (const suffix of ['UZ', 'PRO', 'GROUP', 'TEAM']) {
    const candidate = (id.slice(0, 15 - suffix.length) + suffix).slice(0, 15);
    if (candidate !== id && !alternatives.includes(candidate)) alternatives.push(candidate);
    if (alternatives.length === 3) break;
  }
  return {
    companyId: id, valid: true, available: !taken && !blocked,
    reason: taken ? 'Bu ID band' : blocked ? (rule?.note || 'Bu ID rezervlangan yoki sotuvda emas') : '',
    alternatives, ...pricing, rule: rule?.rule || null,
  };
}

async function setCompanyStatus(env, id, status, actor, note = '') {
  if (!COMPANY_STATUSES.has(status)) throw new Error('bad_status');
  const row = await env.DB.prepare('SELECT status FROM companies WHERE company_id = ?').bind(id).first();
  if (!row) return null;
  const now = new Date().toISOString();
  const approved = status === 'approved' ? now : null;
  const paid = status === 'paid' || status === 'active' ? now : null;
  const activated = status === 'active' ? now : null;
  await env.DB.batch([
    env.DB.prepare(`UPDATE companies SET status = ?, updated_at = ?,
      approved_at = COALESCE(?, approved_at), paid_at = COALESCE(?, paid_at), activated_at = COALESCE(?, activated_at),
      rejected_reason = CASE WHEN ? = 'rejected' THEN ? ELSE rejected_reason END WHERE company_id = ?`)
      .bind(status, now, approved, paid, activated, status, shortText(note, 500), id),
    env.DB.prepare(`INSERT INTO company_status_log(company_id, from_status, to_status, actor, note, created_at) VALUES(?,?,?,?,?,?)`)
      .bind(id, row.status, status, actor, shortText(note, 500), now),
  ]);
  return companyWithItems(env, id);
}

async function requireCompanyOwner(request, env, id) {
  const auth = await upstreamUser(request, env);
  if (!auth) return { error: json({ error: 'unauthorized' }, 401) };
  const row = await env.DB.prepare('SELECT * FROM companies WHERE company_id = ?').bind(id).first();
  if (!row) return { error: json({ error: 'not_found' }, 404) };
  if (String(row.owner_user_id) !== String(auth.user.id)) return { error: json({ error: 'forbidden' }, 403) };
  return { auth, row };
}

// ---------- production manual-only public content (no git history — see
// production-drift integration): business directory search, categories,
// public news feed, NFC-tap presence check, physical-NFC pricing/delivery
// config. Response shapes kept byte-for-byte identical to the production
// source these were reverse-engineered from. ----------

// Matches production's news-like visitor fingerprint exactly (IP + UA +
// Accept-Language, SHA-256) — NOT the same as this file's visitorKey()
// (used for catalog reactions), which hashes a differently-prefixed
// input; reusing that one here would silently break "liked" continuity
// for every visitor who already liked a news item in production.
async function newsVisitorHash(request) {
  const raw = [
    request.headers.get('cf-connecting-ip') || '',
    request.headers.get('user-agent') || '',
    request.headers.get('accept-language') || '',
  ].join('|');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function publicContentApi(request, env, url) {
  const path = url.pathname;

  if (path === '/api/companies/search' && request.method === 'GET') {
    const q = shortText(url.searchParams.get('q'), 80).toLowerCase();
    if (!q) return json({ results: [] });
    const like = `%${q}%`;
    const rows = await env.DB.prepare(`SELECT * FROM cards WHERE profile_type = 'business' AND hidden_from_directory = 0 AND
      (LOWER(code) LIKE ? OR LOWER(name) LIKE ? OR LOWER(COALESCE(role,'')) LIKE ? OR LOWER(COALESCE(city,'')) LIKE ?)
      ORDER BY verified DESC, ts DESC LIMIT 30`).bind(like, like, like, like).all();
    return json({
      results: (rows.results || []).map((r) => ({
        code: r.code, name: r.name, role: r.role || '', city: r.city || '',
        categorySlug: r.category_slug || '', avatarUrl: r.avatar_url || '', verified: !!r.verified,
        matchType: null, matchLabel: null, matchPrice: null,
      })),
    });
  }

  if (path === '/api/categories' && request.method === 'GET') {
    const rows = await env.DB.prepare(`SELECT * FROM categories WHERE enabled = 1 ORDER BY sort, name_uz`).all();
    return json({
      categories: (rows.results || []).map((r) => ({
        id: Number(r.id), slug: r.slug, parentSlug: r.parent_slug || null,
        nameUz: r.name_uz || '', nameRu: r.name_ru || '', nameEn: r.name_en || '',
        sort: Number(r.sort || 0), enabled: !!r.enabled,
      })),
    });
  }

  if (path === '/api/news' && request.method === 'GET') {
    const [rows, visitor] = await Promise.all([
      env.DB.prepare(`SELECT n.*, (SELECT COUNT(*) FROM news_likes l WHERE l.news_id = n.id) AS like_count
        FROM news n WHERE published = 1 ORDER BY created_at DESC LIMIT 100`).all(),
      newsVisitorHash(request),
    ]);
    const liked = await env.DB.prepare(`SELECT news_id FROM news_likes WHERE visitor_hash = ?`).bind(visitor).all();
    return json({
      news: (rows.results || []).map(newsRow),
      liked: (liked.results || []).map((r) => Number(r.news_id)),
    });
  }

  const tapMatch = path.match(/^\/api\/tap\/([^/]+)$/);
  if (tapMatch && request.method === 'GET') {
    const row = await env.DB.prepare(`SELECT active, blocked_by_owner, linked_code FROM physical_cards WHERE chip_token = ?`)
      .bind(decodeURIComponent(tapMatch[1])).first();
    return json(row ? { active: !!row.active && !row.blocked_by_owner, linkedCode: row.linked_code || null } : { active: true });
  }

  if (path === '/api/settings/physical-nfc-pricing' && request.method === 'GET') {
    const defaultTiers = [
      { minQty: 1, maxQty: 9, pricePerUnit: 120000 },
      { minQty: 10, maxQty: 49, pricePerUnit: 95000 },
      { minQty: 50, maxQty: null, pricePerUnit: 75000 },
    ];
    const [tiersRow, deliveryRow] = await Promise.all([
      env.DB.prepare(`SELECT value FROM admin_settings WHERE key = 'physical_nfc_pricing'`).first(),
      env.DB.prepare(`SELECT value FROM admin_settings WHERE key = 'delivery_days'`).first(),
    ]);
    const parseOr = (text, fallback) => {
      if (text == null || text === '') return fallback;
      try { return JSON.parse(text); } catch { return fallback; }
    };
    return json({
      tiers: parseOr(tiersRow?.value, defaultTiers),
      delivery: parseOr(deliveryRow?.value, { minDays: 3, maxDays: 5 }),
    });
  }

  // Yagona haqiqat manbai — frontend endi PAYMENTS_ENABLED'ni o'zida
  // qattiq yozib qo'ymaydi (src/lib/paymentsEnabled.jsx), shu yerdan
  // real vaqtda so'raydi. paymentsEnabledD1() Payme Merchant API
  // bo'limida quyida e'lon qilingan (function hoisting orqali bu yerdan
  // ham chaqirish mumkin).
  if (path === '/api/settings/payments-enabled' && request.method === 'GET') {
    return json({ enabled: paymentsEnabledD1(env) });
  }

  return null;
}

async function companyApi(request, env, url) {
  await ensureCompanySchema(env);
  const path = url.pathname;

  if (path === '/api/companies/check' && request.method === 'GET') {
    return json(await companyAvailability(env, url.searchParams.get('id')));
  }

  if (path === '/api/companies/mine' && request.method === 'GET') {
    const auth = await upstreamUser(request, env);
    if (!auth) return json({ error: 'unauthorized' }, 401);
    const rows = await env.DB.prepare('SELECT * FROM companies WHERE owner_user_id = ? ORDER BY created_at DESC').bind(String(auth.user.id)).all();
    return json({ companies: (rows.results || []).map((row) => rowCompany(row)) });
  }

  if (path === '/api/companies' && request.method === 'POST') {
    const auth = await upstreamUser(request, env);
    if (!auth) return json({ error: 'unauthorized' }, 401);
    const body = await request.json().catch(() => ({}));
    const id = companyId(body.companyId);
    if (!id) return json({ error: 'bad_company_id' }, 422);
    const availability = await companyAvailability(env, id);
    if (!availability.available) return json({ error: availability.rule ? 'company_id_reserved' : 'company_id_taken', ...availability }, 409);
    const displayName = shortText(body.displayName, 120);
    const city = shortText(body.city, 100);
    const phone = shortText(body.phone, 40);
    const description = shortText(body.description, 1200);
    if (!displayName || !city || !phone || description.length < 20) return json({ error: 'required_fields' }, 422);
    const category = COMPANY_CATEGORIES.has(body.category) ? body.category : 'other';
    const sourceCode = shortText(body.sourceCardCode, 32).toUpperCase();
    const source = sourceCode && auth.cards.find((card) => String(card.code || '').toUpperCase() === sourceCode);
    const now = new Date().toISOString();
    try {
      await env.DB.prepare(`INSERT INTO companies (
        company_id, owner_user_id, owner_email, display_name, category, subcategory, city, address, description,
        phone, telegram, whatsapp, website, logo_url, cover_url, gallery_json, source_card_code,
        tier, price, status, created_at, updated_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(
        id, String(auth.user.id), shortText(auth.user.email, 160), displayName, category,
        shortText(body.subcategory, 100) || shortText(source?.role, 100), city || shortText(source?.city, 100),
        shortText(body.address, 300) || shortText(source?.address, 300), description || shortText(source?.about, 1200),
        phone || shortText(source?.phone, 40), shortText(body.telegram, 100) || shortText(source?.tg, 100),
        shortText(body.whatsapp, 100), safeUrl(body.website) || safeUrl(source?.website),
        safeUrl(body.logoUrl) || safeUrl(source?.avatarUrl), safeUrl(body.coverUrl) || safeUrl(source?.bgUrl),
        '[]', source ? sourceCode : '', availability.tier, availability.price, 'pending_review', now, now
      ).run();
      await env.DB.prepare(`INSERT INTO company_status_log(company_id, from_status, to_status, actor, note, created_at) VALUES(?,?,?,?,?,?)`)
        .bind(id, 'draft', 'pending_review', `user:${auth.user.id}`, source ? `Legacy ${sourceCode} dan xavfsiz nusxa` : '', now).run();
    } catch (error) {
      if (String(error?.message).toLowerCase().includes('unique')) return json({ error: 'company_id_taken' }, 409);
      throw error;
    }
    return json({ company: await companyWithItems(env, id) }, 201);
  }

  const match = path.match(/^\/api\/companies\/([A-Za-z]{3,15})(?:\/(submit|payment|catalog)(?:\/([A-Za-z0-9_-]+))?)?$/);
  if (!match) return json({ error: 'not_found' }, 404);
  const id = companyId(match[1]);
  const action = match[2] || '';
  const itemId = match[3] || '';

  if (!action && request.method === 'GET') {
    const company = await companyWithItems(env, id);
    if (!company) return json({ error: 'not_found' }, 404);
    if (company.status !== 'active') {
      const auth = await upstreamUser(request, env);
      if (!auth || String(auth.user.id) !== String(company.ownerUserId)) return json({ error: 'not_active' }, 404);
    }
    return json({ company });
  }

  const owned = await requireCompanyOwner(request, env, id);
  if (owned.error) return owned.error;

  if (!action && request.method === 'PATCH') {
    const body = await request.json().catch(() => ({}));
    const current = rowCompany(owned.row);
    const now = new Date().toISOString();
    const value = (key, max) => body[key] == null ? current[key] : shortText(body[key], max);
    await env.DB.prepare(`UPDATE companies SET display_name=?, subcategory=?, city=?, address=?, description=?, phone=?, telegram=?, whatsapp=?, website=?, logo_url=?, cover_url=?, gallery_json=?, updated_at=? WHERE company_id=?`).bind(
      value('displayName', 120), value('subcategory', 100), value('city', 100), value('address', 300), value('description', 1200),
      value('phone', 40), value('telegram', 100), value('whatsapp', 100), safeUrl(body.website == null ? current.website : body.website),
      safeUrl(body.logoUrl == null ? current.logoUrl : body.logoUrl), safeUrl(body.coverUrl == null ? current.coverUrl : body.coverUrl),
      JSON.stringify(Array.isArray(body.gallery) ? body.gallery.map(safeUrl).filter(Boolean).slice(0, 12) : current.gallery), now, id
    ).run();
    return json({ company: await companyWithItems(env, id) });
  }

  if (action === 'submit' && request.method === 'POST') {
    if (!['draft', 'rejected'].includes(owned.row.status)) return json({ error: 'bad_status' }, 409);
    return json({ company: await setCompanyStatus(env, id, 'pending_review', `user:${owned.auth.user.id}`, 'Qayta tekshiruvga yuborildi') });
  }

  if (action === 'payment' && request.method === 'POST') {
    if (!['approved', 'payment_pending'].includes(owned.row.status)) return json({ error: 'not_approved' }, 409);
    if (owned.row.status === 'approved') await setCompanyStatus(env, id, 'payment_pending', `user:${owned.auth.user.id}`, 'Payme boshlandi');
    return json({ error: 'payments_backend_pending', message: 'Company Payme moduli backend deployini kutmoqda' }, 503);
  }

  if (action === 'catalog' && !itemId && request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const name = shortText(body.name, 120);
    const price = Math.max(0, Math.round(Number(body.price) || 0));
    const promo = body.promotionPrice === '' || body.promotionPrice == null ? null : Math.max(0, Math.round(Number(body.promotionPrice) || 0));
    if (!name) return json({ error: 'name_required' }, 422);
    if (promo != null && promo >= price) return json({ error: 'bad_promotion_price' }, 422);
    const uuid = crypto.randomUUID();
    const now = new Date().toISOString();
    const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM company_catalog_items WHERE company_id = ?').bind(id).first();
    await env.DB.prepare(`INSERT INTO company_catalog_items(id,company_id,name,category,description,price,promotion_price,image_url,available,sort_order,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).bind(
      uuid, id, name, shortText(body.category, 100), shortText(body.description, 600), price, promo, safeUrl(body.imageUrl), body.available === false ? 0 : 1, Number(count?.n || 0), now, now
    ).run();
    return json({ company: await companyWithItems(env, id) }, 201);
  }

  if (action === 'catalog' && itemId && request.method === 'DELETE') {
    await env.DB.prepare('DELETE FROM company_catalog_items WHERE id = ? AND company_id = ?').bind(itemId, id).run();
    return json({ company: await companyWithItems(env, id) });
  }

  if (action === 'catalog' && itemId && request.method === 'PATCH') {
    const body = await request.json().catch(() => ({}));
    const old = await env.DB.prepare('SELECT * FROM company_catalog_items WHERE id = ? AND company_id = ?').bind(itemId, id).first();
    if (!old) return json({ error: 'not_found' }, 404);
    const price = body.price == null ? old.price : Math.max(0, Math.round(Number(body.price) || 0));
    const promo = body.promotionPrice === undefined ? old.promotion_price : body.promotionPrice == null || body.promotionPrice === '' ? null : Math.max(0, Math.round(Number(body.promotionPrice) || 0));
    if (promo != null && promo >= price) return json({ error: 'bad_promotion_price' }, 422);
    await env.DB.prepare(`UPDATE company_catalog_items SET name=?,category=?,description=?,price=?,promotion_price=?,image_url=?,available=?,updated_at=? WHERE id=? AND company_id=?`).bind(
      body.name == null ? old.name : shortText(body.name, 120), body.category == null ? old.category : shortText(body.category, 100),
      body.description == null ? old.description : shortText(body.description, 600), price, promo,
      body.imageUrl == null ? old.image_url : safeUrl(body.imageUrl), body.available == null ? old.available : body.available ? 1 : 0,
      new Date().toISOString(), itemId, id
    ).run();
    return json({ company: await companyWithItems(env, id) });
  }

  return json({ error: 'not_found' }, 404);
}

async function companyAdminApi(request, env, url) {
  await ensureCompanySchema(env);
  const admin = await upstreamAdmin(request, env);
  if (!admin) return json({ error: 'unauthorized' }, 401);
  const path = url.pathname;
  if (path === '/api/admin/company-requests' && request.method === 'GET') {
    const status = shortText(url.searchParams.get('status'), 30);
    const rows = status && COMPANY_STATUSES.has(status)
      ? await env.DB.prepare('SELECT * FROM companies WHERE status = ? ORDER BY created_at DESC').bind(status).all()
      : await env.DB.prepare('SELECT * FROM companies ORDER BY created_at DESC').all();
    const counts = await env.DB.prepare('SELECT status, COUNT(*) AS count FROM companies GROUP BY status').all();
    return json({ companies: (rows.results || []).map((row) => rowCompany(row)), counts: counts.results || [] });
  }
  const requestMatch = path.match(/^\/api\/admin\/company-requests\/([A-Za-z]{3,15})\/status$/);
  if (requestMatch && request.method === 'PATCH') {
    const id = companyId(requestMatch[1]);
    const body = await request.json().catch(() => ({}));
    const status = shortText(body.status, 30);
    if (!COMPANY_STATUSES.has(status)) return json({ error: 'bad_status' }, 422);
    const company = await setCompanyStatus(env, id, status, `admin:${admin.role || 'admin'}`, body.note);
    if (!company) return json({ error: 'not_found' }, 404);
    return json({ company });
  }
  if (path === '/api/admin/company-id-rules' && request.method === 'GET') {
    const rows = await env.DB.prepare('SELECT * FROM company_id_rules ORDER BY updated_at DESC').all();
    return json({ rules: rows.results || [] });
  }
  if (path === '/api/admin/company-id-rules' && request.method === 'PUT') {
    const body = await request.json().catch(() => ({}));
    const id = companyId(body.companyId);
    const rule = ['reserved', 'off_sale', 'blocked', 'exclusive', 'allow'].includes(body.rule) ? body.rule : 'reserved';
    if (!id) return json({ error: 'bad_company_id' }, 422);
    const now = new Date().toISOString();
    await env.DB.prepare(`INSERT INTO company_id_rules(company_id,rule,tier_override,price_override,note,updated_by,updated_at) VALUES(?,?,?,?,?,?,?)
      ON CONFLICT(company_id) DO UPDATE SET rule=excluded.rule,tier_override=excluded.tier_override,price_override=excluded.price_override,note=excluded.note,updated_by=excluded.updated_by,updated_at=excluded.updated_at`).bind(
      id, rule, ['silver','gold','premium','exclusive'].includes(body.tierOverride) ? body.tierOverride : null,
      body.priceOverride === '' || body.priceOverride == null ? null : Math.max(0, Math.round(Number(body.priceOverride) || 0)),
      shortText(body.note, 500), `admin:${admin.role || 'admin'}`, now
    ).run();
    return json({ ok: true });
  }
  return json({ error: 'not_found' }, 404);
}

// ═══════════════════════════════════════════════════════════════════════
// CORE (users / sessions / cards / admins / auctions) — direct D1 access.
//
// Replaces the proxy-to-Railway fallback below for the routes it handles.
// The Railway PostgreSQL backend this used to proxy to has been shut down;
// its full dataset (54 tables) was migrated into this same D1 database
// (see db/d1-migration/ in the repo) before this code was written.
//
// No npm packages, no local relative imports: this file is deployed as a
// single self-contained script (see scripts/prepare-sites-build.mjs —
// it copies hosting/worker.js verbatim, nothing is bundled), so every
// helper this section needs (password hashing, TOTP, cookies, schema)
// is implemented right here.
// ═══════════════════════════════════════════════════════════════════════

// ---------- time / random helpers ----------

// Matches the "YYYY-MM-DD HH:MM:SS.mmm+00" style already used by every
// migrated row, so lexicographic ORDER BY stays correct for old + new rows.
function nowTs() {
  return new Date().toISOString().replace('T', ' ').replace('Z', '+00');
}

// Every migrated timestamp column (users.banned_until, .suspended_until,
// etc.) can hold the old Postgres-style "YYYY-MM-DD HH:MM:SS.ffffff+00"
// text (space separator, no colon/minutes in the UTC offset) alongside
// newly-written standard ISO 8601 ("...T...Z") values. `new Date(...)` on
// the Postgres style is NOT reliably parsed the same way across JS engines
// — normalize to ISO 8601 first so comparisons are correct everywhere.
function parseDbDate(value) {
  if (!value) return null;
  let s = String(value);
  if (!s.includes('T')) s = s.replace(' ', 'T');
  if (/\+00$/.test(s)) s = s.replace(/\+00$/, 'Z');
  else if (/[+-]\d{2}$/.test(s)) s = s.replace(/([+-]\d{2})$/, '$1:00');
  return new Date(s);
}

function toHex(bytes) {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function newToken(bytes = 32) {
  return toHex(crypto.getRandomValues(new Uint8Array(bytes)));
}

// Used to store admin session tokens and Telegram-2FA OTP codes AT REST as
// a hash, never the raw value — a D1 read/backup leak alone then never
// yields a directly-usable session token or OTP. SHA-256 (not a slow
// password hash) is the right tool here: both inputs are either
// high-entropy random tokens (brute-forcing a preimage is infeasible
// regardless of hash speed) or short-lived, attempt-rate-limited 6-digit
// codes (the rate limit is the real defense, not hash cost).
async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return toHex(new Uint8Array(digest));
}

// ---------- scrypt (RFC 7914) — bit-exact with Node's crypto.scryptSync ----------
// Only reason this exists: server/auth.js hashed every migrated password
// with `crypto.scryptSync(password, salt, 64)` (N=16384, r=8, p=1,
// dkLen=64, "salt:hash" hex) — old hashes must keep verifying.

async function pbkdf2Sha256(password, salt, iterations, dkLen) {
  const key = await crypto.subtle.importKey('raw', password, 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, dkLen * 8);
  return new Uint8Array(bits);
}

function scryptRotl(x, n) { return (x << n) | (x >>> (32 - n)); }

function scryptSalsa208(B) {
  const x = new Uint32Array(16);
  for (let i = 0; i < 16; i++) x[i] = B[i];
  for (let i = 0; i < 8; i += 2) {
    x[4]  ^= scryptRotl((x[0] + x[12]) | 0, 7);
    x[8]  ^= scryptRotl((x[4] + x[0]) | 0, 9);
    x[12] ^= scryptRotl((x[8] + x[4]) | 0, 13);
    x[0]  ^= scryptRotl((x[12] + x[8]) | 0, 18);
    x[9]  ^= scryptRotl((x[5] + x[1]) | 0, 7);
    x[13] ^= scryptRotl((x[9] + x[5]) | 0, 9);
    x[1]  ^= scryptRotl((x[13] + x[9]) | 0, 13);
    x[5]  ^= scryptRotl((x[1] + x[13]) | 0, 18);
    x[14] ^= scryptRotl((x[10] + x[6]) | 0, 7);
    x[2]  ^= scryptRotl((x[14] + x[10]) | 0, 9);
    x[6]  ^= scryptRotl((x[2] + x[14]) | 0, 13);
    x[10] ^= scryptRotl((x[6] + x[2]) | 0, 18);
    x[3]  ^= scryptRotl((x[15] + x[11]) | 0, 7);
    x[7]  ^= scryptRotl((x[3] + x[15]) | 0, 9);
    x[11] ^= scryptRotl((x[7] + x[3]) | 0, 13);
    x[15] ^= scryptRotl((x[11] + x[7]) | 0, 18);
    x[1]  ^= scryptRotl((x[0] + x[3]) | 0, 7);
    x[2]  ^= scryptRotl((x[1] + x[0]) | 0, 9);
    x[3]  ^= scryptRotl((x[2] + x[1]) | 0, 13);
    x[0]  ^= scryptRotl((x[3] + x[2]) | 0, 18);
    x[6]  ^= scryptRotl((x[5] + x[4]) | 0, 7);
    x[7]  ^= scryptRotl((x[6] + x[5]) | 0, 9);
    x[4]  ^= scryptRotl((x[7] + x[6]) | 0, 13);
    x[5]  ^= scryptRotl((x[4] + x[7]) | 0, 18);
    x[11] ^= scryptRotl((x[10] + x[9]) | 0, 7);
    x[8]  ^= scryptRotl((x[11] + x[10]) | 0, 9);
    x[9]  ^= scryptRotl((x[8] + x[11]) | 0, 13);
    x[10] ^= scryptRotl((x[9] + x[8]) | 0, 18);
    x[12] ^= scryptRotl((x[15] + x[14]) | 0, 7);
    x[13] ^= scryptRotl((x[12] + x[15]) | 0, 9);
    x[14] ^= scryptRotl((x[13] + x[12]) | 0, 13);
    x[15] ^= scryptRotl((x[14] + x[13]) | 0, 18);
  }
  for (let i = 0; i < 16; i++) B[i] = (B[i] + x[i]) | 0;
}

function scryptBlockMix(B, r) {
  const X = B.slice((2 * r - 1) * 16, (2 * r) * 16);
  const out = new Uint32Array(B.length);
  for (let i = 0; i < 2 * r; i++) {
    for (let j = 0; j < 16; j++) X[j] ^= B[i * 16 + j];
    scryptSalsa208(X);
    const dest = (i % 2 === 0) ? (i / 2) : (r + (i - 1) / 2);
    out.set(X, dest * 16);
  }
  B.set(out);
}

function scryptToWords(bytes) {
  const words = new Uint32Array(bytes.length / 4);
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let i = 0; i < words.length; i++) words[i] = dv.getUint32(i * 4, true);
  return words;
}

function scryptToBytes(words) {
  const bytes = new Uint8Array(words.length * 4);
  const dv = new DataView(bytes.buffer);
  for (let i = 0; i < words.length; i++) dv.setUint32(i * 4, words[i], true);
  return bytes;
}

async function scryptRomix(block, N, r) {
  const wordsPerBlock = 32 * r;
  const B = scryptToWords(block);
  const V = new Array(N);
  for (let i = 0; i < N; i++) { V[i] = B.slice(); scryptBlockMix(B, r); }
  for (let i = 0; i < N; i++) {
    const j = B[(2 * r - 1) * 16] % N;
    for (let k = 0; k < wordsPerBlock; k++) B[k] ^= V[j][k];
    scryptBlockMix(B, r);
  }
  return scryptToBytes(B);
}

async function scrypt(password, salt, N, r, p, dkLen) {
  const blockBytes = 128 * r;
  const B = await pbkdf2Sha256(password, salt, 1, blockBytes * p);
  const outBlocks = new Uint8Array(blockBytes * p);
  for (let i = 0; i < p; i++) {
    const mixed = await scryptRomix(B.subarray(i * blockBytes, (i + 1) * blockBytes), N, r);
    outBlocks.set(mixed, i * blockBytes);
  }
  return pbkdf2Sha256(password, outBlocks, 1, dkLen);
}

function hexToBytes(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

// Matches server/auth.js exactly.
async function hashPassword(password) {
  // IMPORTANT: server/auth.js calls `crypto.scryptSync(password, salt, 64)`
  // where `salt` is the 32-character HEX STRING itself (from
  // `crypto.randomBytes(16).toString('hex')`) — Node's scrypt treats a
  // string salt as its UTF-8 bytes, i.e. the real scrypt salt is 32 ASCII
  // bytes, NOT the 16 bytes you'd get from hex-decoding it back. Must use
  // the same 32-byte encoding here or every migrated password hash (and
  // every hash this writes) fails to cross-verify.
  const saltHex = toHex(crypto.getRandomValues(new Uint8Array(16)));
  const hash = await scrypt(new TextEncoder().encode(password), new TextEncoder().encode(saltHex), 16384, 8, 1, 64);
  return `${saltHex}:${toHex(hash)}`;
}

async function verifyPassword(password, stored) {
  try {
    const [saltHex, hashHex] = String(stored).split(':');
    if (!saltHex || !hashHex) return false;
    const test = await scrypt(new TextEncoder().encode(password), new TextEncoder().encode(saltHex), 16384, 8, 1, 64);
    const expected = hexToBytes(hashHex);
    if (test.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < test.length; i++) diff |= test[i] ^ expected[i];
    return diff === 0;
  } catch { return false; }
}

// ---------- TOTP (RFC 6238) — compatible with the `otplib` output used before ----------

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Decode(input) {
  const clean = String(input).toUpperCase().replace(/[^A-Z2-7]/g, '');
  const bytes = [];
  let bits = 0, value = 0;
  for (const char of clean) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) { bits -= 8; bytes.push((value >>> bits) & 0xff); }
  }
  return new Uint8Array(bytes);
}

function base32Encode(bytes) {
  let bits = 0, value = 0, out = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) { bits -= 5; out += BASE32_ALPHABET[(value >>> bits) & 31]; }
  }
  if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

function generateTotpSecret() {
  return base32Encode(crypto.getRandomValues(new Uint8Array(20)));
}

function totpAuthUri(secret, label, issuer) {
  const enc = encodeURIComponent;
  return `otpauth://totp/${enc(issuer)}:${enc(label)}?secret=${secret}&issuer=${enc(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

async function hotp(secretBytes, counter) {
  const counterBytes = new Uint8Array(8);
  const view = new DataView(counterBytes.buffer);
  view.setUint32(4, counter >>> 0, false);
  view.setUint32(0, Math.floor(counter / 2 ** 32), false);
  const key = await crypto.subtle.importKey('raw', secretBytes, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, counterBytes));
  const offset = sig[sig.length - 1] & 0x0f;
  const code = ((sig[offset] & 0x7f) << 24) | ((sig[offset + 1] & 0xff) << 16) | ((sig[offset + 2] & 0xff) << 8) | (sig[offset + 3] & 0xff);
  return String(code % 1_000_000).padStart(6, '0');
}

// `afterCounter` — replay guard: when given (the admin's last-ACCEPTED
// TOTP time-step, persisted in admins.totp_last_counter), a step at or
// before it is never accepted, even if the 6-digit code matches — so the
// exact same code (or an older one still inside the ±1 step window)
// cannot be replayed a second time. Callers MUST persist the returned
// `counter` back to admins.totp_last_counter on a valid result, or this
// guard has no effect on the next call.
async function totpVerify({ secret, token, afterCounter }) {
  const clean = String(token || '').trim();
  if (!/^\d{6}$/.test(clean)) return { valid: false };
  const secretBytes = base32Decode(secret);
  const nowCounter = Math.floor(Date.now() / 1000 / 30);
  for (const delta of [0, -1, 1]) {
    const counter = nowCounter + delta;
    if (afterCounter != null && counter <= afterCounter) continue;
    if ((await hotp(secretBytes, counter)) === clean) return { valid: true, counter };
  }
  return { valid: false };
}
// ---------- core schema (idempotent — the real tables already exist from
// the migration; this only protects a from-scratch D1 database, and adds
// the two session-store tables the old Express server kept in memory) ----------

let coreSchemaReady;
async function ensureCoreSchema(env) {
  if (!env.DB) throw new Error('d1_unavailable');
  // Admin auth's own tables/columns are ensured FIRST and independently of
  // the shared batch below — see ensureAdminAuthTables()'s comment. This
  // order matters: if these ran after `await coreSchemaReady`, a rejected
  // batch would throw right there and they'd never be reached at all,
  // defeating the whole point of decoupling them.
  await ensureAdminAuthTables(env);
  await ensureTotpReplayColumn(env);
  if (!coreSchemaReady) {
    coreSchemaReady = env.DB.batch([
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS "users" (
        "id" INTEGER PRIMARY KEY NOT NULL, "email" TEXT NOT NULL, "password_hash" TEXT NOT NULL,
        "created_at" TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL, "balance" INTEGER DEFAULT 0 NOT NULL,
        "held_balance" INTEGER DEFAULT 0 NOT NULL, "phone" TEXT, "bot_ack" INTEGER DEFAULT 0 NOT NULL,
        "is_premium" INTEGER DEFAULT 0 NOT NULL, "pending_payout" INTEGER DEFAULT 0 NOT NULL,
        "banned_until" TEXT, "strike_count" INTEGER DEFAULT 0 NOT NULL, "tos_accepted" INTEGER DEFAULT 0 NOT NULL,
        "is_test" INTEGER DEFAULT 0 NOT NULL, "promo_code" TEXT, "pending_discount_pct" INTEGER DEFAULT 0 NOT NULL,
        "suspended_until" TEXT, "suspend_reason" TEXT, "deleted_at" TEXT,
        UNIQUE("email"), UNIQUE("promo_code")
      )`),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS "sessions" (
        "token" TEXT NOT NULL, "user_id" INTEGER NOT NULL, "expires_at" TEXT NOT NULL, PRIMARY KEY("token")
      )`),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS "cards" (
        "code" TEXT NOT NULL, "name" TEXT NOT NULL, "role" TEXT, "avatar_url" TEXT, "tg" TEXT, "phone" TEXT,
        "email" TEXT, "linkedin" TEXT, "instagram" TEXT, "hashtags" TEXT DEFAULT '[]' NOT NULL, "price" INTEGER NOT NULL,
        "ts" INTEGER NOT NULL, "views" INTEGER DEFAULT 0 NOT NULL, "created_at" TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        "user_id" INTEGER, "about" TEXT, "facebook" TEXT, "twitter" TEXT, "website" TEXT, "card_number" TEXT,
        "theme" TEXT DEFAULT 'classic' NOT NULL, "for_sale" INTEGER DEFAULT 0 NOT NULL, "sale_price" INTEGER,
        "extra_links" TEXT DEFAULT '[]' NOT NULL, "card_numbers" TEXT DEFAULT '[]' NOT NULL, "status" TEXT DEFAULT 'pending' NOT NULL,
        "bg_url" TEXT, "bg_pattern" INTEGER DEFAULT 1 NOT NULL, "accent_color" TEXT, "bg_color" TEXT,
        "bg_animated" INTEGER DEFAULT 1 NOT NULL, "music_url" TEXT, "is_primary" INTEGER DEFAULT 0 NOT NULL,
        "giftable" INTEGER DEFAULT 1 NOT NULL, "hide_phone" INTEGER DEFAULT 0 NOT NULL, "tier_override" TEXT,
        "links_transparent" INTEGER DEFAULT 0 NOT NULL, "card_design" TEXT, "link_style" TEXT DEFAULT 'standard' NOT NULL,
        "profile_type" TEXT DEFAULT 'personal' NOT NULL, "city" TEXT, "hidden_from_directory" INTEGER DEFAULT 0 NOT NULL,
        "category_slug" TEXT, "lead_capture" INTEGER DEFAULT 0 NOT NULL, "verified" INTEGER DEFAULT 0 NOT NULL,
        "address" TEXT, "latitude" REAL, "longitude" REAL, PRIMARY KEY("code")
      )`),
      env.DB.prepare(`CREATE INDEX IF NOT EXISTS "cards_ts_idx" ON "cards" ("ts" DESC)`),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS "admins" (
        "id" INTEGER PRIMARY KEY NOT NULL, "phone" TEXT NOT NULL, "password_hash" TEXT NOT NULL, "name" TEXT,
        "role" TEXT DEFAULT 'manager' NOT NULL, "totp_secret" TEXT, "totp_enabled" INTEGER DEFAULT 0 NOT NULL,
        "created_at" TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL, UNIQUE("phone")
      )`),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS "admin_activity_log" (
        "id" INTEGER PRIMARY KEY NOT NULL, "action" TEXT NOT NULL, "details" TEXT, "old_value" TEXT, "new_value" TEXT,
        "ip" TEXT, "created_at" TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
      )`),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS "admin_login_history" (
        "id" INTEGER PRIMARY KEY NOT NULL, "event" TEXT NOT NULL, "ip" TEXT, "user_agent" TEXT,
        "created_at" TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
      )`),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS "auctions" (
        "id" INTEGER PRIMARY KEY NOT NULL, "code" TEXT NOT NULL, "seller_id" INTEGER, "start_price" INTEGER NOT NULL,
        "buy_now_price" INTEGER, "current_price" INTEGER NOT NULL, "highest_bidder_id" INTEGER, "ends_at" TEXT NOT NULL,
        "status" TEXT DEFAULT 'active' NOT NULL, "created_at" TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        "payment_deadline" TEXT, "seller_payout_amount" INTEGER, "seller_payout_status" TEXT DEFAULT 'none' NOT NULL,
        "seller_payme_number" TEXT, "created_by_admin" INTEGER DEFAULT 1 NOT NULL, "min_increment" INTEGER DEFAULT 25000 NOT NULL
      )`),
      env.DB.prepare(`CREATE INDEX IF NOT EXISTS "auctions_status_idx" ON "auctions" ("status", "ends_at")`),
      env.DB.prepare(`CREATE INDEX IF NOT EXISTS "auctions_code_idx" ON "auctions" ("code")`),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS "bids" (
        "id" INTEGER PRIMARY KEY NOT NULL, "auction_id" INTEGER NOT NULL, "user_id" INTEGER NOT NULL,
        "amount" INTEGER NOT NULL, "released" INTEGER DEFAULT 0 NOT NULL, "idempotency_key" TEXT,
        "created_at" TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL, UNIQUE("idempotency_key")
      )`),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS "auction_demand" (
        "id" INTEGER PRIMARY KEY NOT NULL, "code" TEXT NOT NULL, "status" TEXT DEFAULT 'collecting' NOT NULL,
        "suggested_start_price" INTEGER DEFAULT 250000 NOT NULL, "suggested_min_step" INTEGER DEFAULT 25000 NOT NULL,
        "interest_count" INTEGER DEFAULT 0 NOT NULL, "auction_id" INTEGER, "notified_ready_at" TEXT,
        "created_at" TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL, UNIQUE("code")
      )`),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS "auction_demand_votes" (
        "demand_id" INTEGER NOT NULL, "user_id" INTEGER NOT NULL, "created_at" TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        PRIMARY KEY("demand_id", "user_id")
      )`),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS "auction_requests" (
        "id" INTEGER PRIMARY KEY NOT NULL, "user_id" INTEGER NOT NULL, "code" TEXT NOT NULL, "note" TEXT,
        "status" TEXT DEFAULT 'pending' NOT NULL, "created_at" TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
      )`),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS "platform_wallet" (
        "id" INTEGER PRIMARY KEY DEFAULT 1 NOT NULL, "balance" INTEGER DEFAULT 0 NOT NULL, CHECK(("id" = 1))
      )`),
      env.DB.prepare(`INSERT OR IGNORE INTO "platform_wallet" ("id", "balance") VALUES (1, 0)`),
      // admin_sessions / admin_2fa_pending / admin_totp_setup_pending are
      // deliberately NOT in this batch — see ensureAdminAuthTables() below
      // for why (2026-09: production 503 root-cause fix).
      // Sayt buyurtmalari (Payme Phase 2B) — db/d1-migration/0001-schema.sql
      // orqali ALLAQACHON import qilingan production D1'da bu jadval mavjud;
      // shu IF NOT EXISTS boshqa jadvallar bilan bir xil naqsh bo'yicha
      // faqat xavfsizlik-tarmog'i (masalan yangi/toza test muhitida).
      // Ustunlar server/db.js'dagi web_orders bilan AYNAN bir xil.
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS "web_orders" (
        "id" INTEGER PRIMARY KEY NOT NULL, "user_id" INTEGER NOT NULL, "code" TEXT (40) NOT NULL,
        "price" INTEGER NOT NULL, "payload" TEXT NOT NULL, "status" TEXT (20) DEFAULT 'pending' NOT NULL,
        "created_at" TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL, "kind" TEXT (24) DEFAULT 'card_purchase' NOT NULL,
        "payme_transaction_id" TEXT, UNIQUE ("payme_transaction_id"),
        FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
      )`),
      env.DB.prepare(`CREATE INDEX IF NOT EXISTS "web_orders_user_idx" ON "web_orders" ("user_id")`),
      env.DB.prepare(`CREATE INDEX IF NOT EXISTS "web_orders_code_idx" ON "web_orders" ("code")`),
      // MUHIM — bu yerda ATAYLAB `CREATE UNIQUE INDEX ... WHERE status =
      // 'pending'` YO'Q (pre-commit review'da topilgan xavf — Fix 1):
      // agar production D1'da allaqachon bir xil kod uchun 2+ eski
      // "pending" qator bo'lsa (tozalanmagan tarixiy ma'lumot), bunday
      // indeksni SHU YERDA (har bir so'rovda ishlaydigan runtime schema
      // batch'ida) yaratishga urinish "UNIQUE constraint failed" bilan
      // XATO BERADI — va bu BATTA `env.DB.batch([...])` tranzaksion
      // bo'lgani uchun (bitta a'zo yiqilsa hammasi yiqiladi) BUTUN
      // ported API (auth/records/auctions/admin/orders/payme) doimiy
      // 503'ga tushib qoladi, chunki `coreApi()` HAR bir so'rovda
      // `ensureCoreSchema()`ni chaqiradi. Bir martalik "pending"
      // rezervatsiya kafolati o'rniga PASTDAGI `createPendingWebOrderD1`
      // ATOMIK `INSERT ... SELECT ... WHERE NOT EXISTS` orqali amalga
      // oshiriladi — bu YANGI duplikat qator qo'shilishining oldini
      // oladi, lekin mavjud (eski, tozalanmagan) ma'lumotga TEGMAYDI va
      // schema-init'ni yiqitmaydi.
      //
      // Partial UNIQUE indeksni HAQIQIY DB-darajasidagi kafolat sifatida
      // qo'shish kerak bo'lsa — bu FAQAT alohida, nazorat qilinadigan
      // migratsiya sifatida bo'lishi kerak: (1) production'da
      // `SELECT code, COUNT(*) FROM web_orders WHERE status='pending'
      // GROUP BY code HAVING COUNT(*) > 1` bilan duplikatlarni topish,
      // (2) ularni qo'lda/nazorat ostida tozalash (masalan har bir kod
      // uchun eng yangisidan boshqasini 'cancelled'ga o'tkazish), (3)
      // shundan KEYINGINA `wrangler d1 execute` orqali indeksni qo'lda
      // qo'shish — runtime `ensureCoreSchema`ning umumiy batch'iga emas.
      //
      // Followers subsystem — mirrors the "follows" table already present in
      // db/d1-migration/0001-schema.sql (paid/amount kept only for schema
      // parity with the legacy Postgres table; every follow created below is
      // always free). IF NOT EXISTS makes this a safety net, not a real
      // migration, matching the pattern used for every other table above.
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS "follows" (
        "id" INTEGER PRIMARY KEY NOT NULL, "follower_id" INTEGER NOT NULL, "followee_id" INTEGER NOT NULL,
        "paid" INTEGER DEFAULT 0 NOT NULL, "amount" INTEGER DEFAULT 0 NOT NULL,
        "created_at" TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        UNIQUE("follower_id", "followee_id"),
        FOREIGN KEY("followee_id") REFERENCES "users"("id") ON DELETE CASCADE,
        FOREIGN KEY("follower_id") REFERENCES "users"("id") ON DELETE CASCADE
      )`),
      env.DB.prepare(`CREATE INDEX IF NOT EXISTS "follows_followee_idx" ON "follows" ("followee_id")`),
      env.DB.prepare(`CREATE INDEX IF NOT EXISTS "follows_follower_idx" ON "follows" ("follower_id")`),
    ]).catch((error) => { coreSchemaReady = null; throw error; });
  }
  await coreSchemaReady;
  // web_orders itself is created just above (inside the shared batch) —
  // this must run AFTER it, not before, or the ALTER TABLE below would
  // target a table that doesn't exist yet on a fresh DB and silently
  // no-op (swallowed by its own .catch), leaving the columns missing.
  await ensureWebOrderTimestampColumns(env);
}

// admin_sessions / admin_2fa_pending / admin_totp_setup_pending — pulled
// OUT of the shared ensureCoreSchema batch above and given their own
// independent, individually-caught statements (2026-09 production 503
// root-cause fix: POST /api/admin/verify-2fa was throwing from D1 at the
// `INSERT INTO admin_sessions` line — confirmed NOT a "the whole batch
// never runs" problem, since adminAuthApi's own earlier statements ran
// fine first; see the actual root cause in point 2). Two reasons for the
// split:
//   1) These statements now run, and get a chance to self-heal (see the
//      ALTER loop below) every time `ensureCoreSchema` is called, BEFORE
//      the shared batch — so admin auth keeps working, and stays fixed,
//      even on a request where the shared batch fails for a reason that
//      has nothing to do with it (that request still 503s from
//      `ensureCoreSchema` itself for its OWN routes, same as before — but
//      it no longer stops D1 from permanently repairing admin_sessions'
//      shape once, which is what actually matters for the next login).
//   2) These three tables have ZERO presence in db/d1-migration/0001-schema.sql
//      — unlike users/cards/admins/etc., the old Express server kept
//      admin sessions and pending-2FA state in an in-memory Map, never in
//      Postgres. So their real production shape was decided entirely by
//      whichever code first created them there (possibly an earlier,
//      manually-pasted dashboard version, predating this exact column
//      set) — `CREATE TABLE IF NOT EXISTS` is a permanent no-op against
//      whatever already exists, so it can never repair a shape mismatch.
//      The ALTER TABLE loop below is the actual repair: it adds any of
//      this code's expected columns that a pre-existing, differently-
//      shaped table is missing, WITHOUT touching any existing column or
//      row — self-healing, and safe to run against real production data
//      every time (steady state after the first successful run is
//      "duplicate column name" on every statement, caught and ignored,
//      same as ensureTotpReplayColumn above).
let adminAuthTablesReady;
async function ensureAdminAuthTables(env) {
  if (!adminAuthTablesReady) {
    adminAuthTablesReady = (async () => {
      await env.DB.prepare(`CREATE TABLE IF NOT EXISTS "admin_sessions" (
        "token" TEXT PRIMARY KEY NOT NULL, "admin_id" INTEGER NOT NULL, "role" TEXT NOT NULL,
        "abs_exp" TEXT NOT NULL, "last_activity" TEXT NOT NULL
      )`).run().catch(() => {});
      await env.DB.prepare(`CREATE TABLE IF NOT EXISTS "admin_2fa_pending" (
        "temp_token" TEXT PRIMARY KEY NOT NULL, "admin_id" INTEGER NOT NULL, "method" TEXT NOT NULL,
        "code" TEXT, "attempts" INTEGER DEFAULT 0 NOT NULL, "expires_at" TEXT NOT NULL
      )`).run().catch(() => {});
      await env.DB.prepare(`CREATE TABLE IF NOT EXISTS "admin_totp_setup_pending" (
        "admin_id" INTEGER PRIMARY KEY NOT NULL, "secret" TEXT NOT NULL, "created_at" TEXT NOT NULL
      )`).run().catch(() => {});
      for (const stmt of [
        `ALTER TABLE admin_sessions ADD COLUMN admin_id INTEGER`,
        `ALTER TABLE admin_sessions ADD COLUMN role TEXT`,
        `ALTER TABLE admin_sessions ADD COLUMN abs_exp TEXT`,
        `ALTER TABLE admin_sessions ADD COLUMN last_activity TEXT`,
        `ALTER TABLE admin_2fa_pending ADD COLUMN admin_id INTEGER`,
        `ALTER TABLE admin_2fa_pending ADD COLUMN method TEXT`,
        `ALTER TABLE admin_2fa_pending ADD COLUMN code TEXT`,
        `ALTER TABLE admin_2fa_pending ADD COLUMN attempts INTEGER`,
        `ALTER TABLE admin_2fa_pending ADD COLUMN expires_at TEXT`,
        `ALTER TABLE admin_totp_setup_pending ADD COLUMN secret TEXT`,
        `ALTER TABLE admin_totp_setup_pending ADD COLUMN created_at TEXT`,
      ]) {
        await env.DB.prepare(stmt).run().catch(() => {});
      }
    })();
  }
  await adminAuthTablesReady;
}

// TOTP replay-protection column — added via a genuine ALTER TABLE (not the
// batch above) because `CREATE TABLE IF NOT EXISTS "admins" (...)` is a
// no-op on the REAL, already-populated production `admins` table: it would
// never actually add this column there. Run once per Worker isolate,
// caught defensively — "duplicate column name" (the column already
// exists, e.g. in production after this ships) is the expected steady
// state, not an error; any OTHER failure still surfaces (not swallowed
// forever) because `totpColumnReady` only caches the settled promise, not
// a blanket "never try again" flag across isolates.
let totpColumnReady;
async function ensureTotpReplayColumn(env) {
  if (!totpColumnReady) {
    totpColumnReady = env.DB.prepare(`ALTER TABLE admins ADD COLUMN totp_last_counter INTEGER`).run().catch(() => {});
  }
  await totpColumnReady;
}

// web_orders had no perform_time/cancel_time/cancel_reason columns —
// Payme's CheckTransaction/GetStatement need REAL, STABLE historical
// timestamps for these (not "now" recomputed on every call, which is
// what this used to do for cancel_time). Additive/nullable, same
// self-healing ALTER pattern as the two functions above.
let webOrderTimestampColumnsReady;
async function ensureWebOrderTimestampColumns(env) {
  if (!webOrderTimestampColumnsReady) {
    webOrderTimestampColumnsReady = (async () => {
      await env.DB.prepare(`ALTER TABLE web_orders ADD COLUMN perform_time TEXT`).run().catch(() => {});
      await env.DB.prepare(`ALTER TABLE web_orders ADD COLUMN cancel_time TEXT`).run().catch(() => {});
      await env.DB.prepare(`ALTER TABLE web_orders ADD COLUMN cancel_reason INTEGER`).run().catch(() => {});
      // Real, stable moment the Payme TRANSACTION (not the underlying
      // order/reservation) was first created — see setWebOrderPaymeIdD1.
      // Payme's own sandbox certification requires create_time to be
      // byte-identical across the original CreateTransaction call, any
      // duplicate CreateTransaction call, CheckTransaction, and
      // GetStatement — order.created_at (when "Band qilish" happened,
      // possibly long before Payme was ever involved) is the wrong value.
      await env.DB.prepare(`ALTER TABLE web_orders ADD COLUMN payme_create_time TEXT`).run().catch(() => {});
    })();
  }
  await webOrderTimestampColumnsReady;
}

// ---------- cookies ----------

function parseCookies(request) {
  const header = request.headers.get('cookie') || '';
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > -1) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function isSecure(url) {
  return url.protocol === 'https:';
}

const SESSION_COOKIE = 'nfc_session';
const ADMIN_COOKIE = 'nfc_admin_session';
const SESSION_TTL_S = 30 * 24 * 60 * 60;
const ADMIN_TTL_MS = 24 * 60 * 60 * 1000;
const ADMIN_IDLE_MS = 12 * 60 * 1000;

function sessionCookieHeader(token, secure) {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}; Max-Age=${SESSION_TTL_S}`;
}
function clearedSessionCookieHeader(secure) {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}; Max-Age=0`;
}
function adminCookieHeader(token, secure) {
  return `${ADMIN_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict${secure ? '; Secure' : ''}; Max-Age=${Math.floor(ADMIN_TTL_MS / 1000)}`;
}
function clearedAdminCookieHeader(secure) {
  return `${ADMIN_COOKIE}=; Path=/; HttpOnly; SameSite=Strict${secure ? '; Secure' : ''}; Max-Age=0`;
}

function jsonWithCookie(body, status, cookie) {
  const res = json(body, status);
  if (cookie) res.headers.append('Set-Cookie', cookie);
  return res;
}

// ---------- current user / current admin ----------

async function getCurrentUser(request, env) {
  const token = parseCookies(request)[SESSION_COOKIE];
  if (!token) return null;
  await env.DB.prepare(`DELETE FROM sessions WHERE expires_at < ?`).bind(nowTs()).run();
  const row = await env.DB.prepare(
    `SELECT u.id, u.email, u.phone, u.is_premium AS isPremium, u.banned_until AS bannedUntil,
            u.strike_count AS strikeCount, u.promo_code AS promoCode, u.pending_discount_pct AS pendingDiscountPct,
            u.suspended_until AS suspendedUntil, u.deleted_at AS deletedAt
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token = ? AND s.expires_at > ?`
  ).bind(token, nowTs()).first();
  if (!row) return null;
  if (row.deletedAt) return null;
  if (row.suspendedUntil && parseDbDate(row.suspendedUntil) > new Date()) return null;
  const isBanned = row.bannedUntil && parseDbDate(row.bannedUntil) > new Date();
  return {
    id: row.id, email: row.email, phone: row.phone || null, isPremium: !!row.isPremium,
    bannedUntil: isBanned ? row.bannedUntil : null, strikeCount: row.strikeCount || 0,
    promoCode: row.promoCode || null, pendingDiscountPct: row.pendingDiscountPct || 0,
  };
}

async function getCurrentAdmin(request, env) {
  const token = parseCookies(request)[ADMIN_COOKIE];
  if (!token) return null;
  // admin_sessions.token stores SHA-256(raw token), never the raw value —
  // the cookie is the only place the raw token ever exists after issuance.
  const tokenHash = await sha256Hex(token);
  const row = await env.DB.prepare(`SELECT admin_id AS adminId, role, abs_exp AS absExp, last_activity AS lastActivity FROM admin_sessions WHERE token = ?`).bind(tokenHash).first();
  if (!row) return null;
  const now = Date.now();
  if (now > new Date(row.absExp).getTime()) {
    await env.DB.prepare(`DELETE FROM admin_sessions WHERE token = ?`).bind(tokenHash).run();
    return null;
  }
  if (now - new Date(row.lastActivity).getTime() > ADMIN_IDLE_MS) {
    await env.DB.prepare(`DELETE FROM admin_sessions WHERE token = ?`).bind(tokenHash).run();
    return { idleTimeout: true };
  }
  await env.DB.prepare(`UPDATE admin_sessions SET last_activity = ? WHERE token = ?`).bind(nowTs(), tokenHash).run();
  return { adminId: row.adminId, role: row.role, token };
}

// IP Whitelist — yoqilgan bo'lsa, faqat ro'yxatdagi IP'lardan (aniq
// CF-Connecting-IP, spoof qilib bo'lmaydigan Cloudflare edge sarlavhasi)
// admin panelga kirishga ruxsat. server/admin.js'dagi checkIpWhitelist
// bilan AYNAN bir xil qoida (shu jumladan xatolik bo'lsa fail-OPEN —
// adminni butunlay qulflab qo'ymaslik uchun ataylab shunday). Har bir
// himoyalangan so'rovda (requireAdmin orqali) VA to'g'ridan-to'g'ri
// /login, /verify-2fa'da ham chaqiriladi — bir marta sessiya ochilgach
// keyingi har bir amalda ham qayta tekshiriladi, xuddi legacy kabi.
//
// XAVFSIZ TIKLASH: agar o'zingiz (dinamik IP tufayli) bloklanib qolsangiz,
// nfcstore-api Worker'ga (Cloudflare Dashboard → Settings → Variables)
// ADMIN_IP_WHITELIST_BYPASS=true muhit o'zgaruvchisini vaqtincha qo'shing.
async function checkIpWhitelist(request, env, ip) {
  if (env.ADMIN_IP_WHITELIST_BYPASS === 'true') return true;
  try {
    const setting = await env.DB.prepare(`SELECT value FROM admin_settings WHERE key = 'ip_whitelist_enabled'`).first();
    if (setting?.value !== 'true') return true;
    const rows = await env.DB.prepare(`SELECT 1 FROM admin_ip_whitelist WHERE ip = ?`).bind(ip).first();
    // Ro'yxat butunlay bo'sh bo'lsa hali cheklamaymiz — legacy bilan bir xil
    // ("hech kim qo'shmagan holda o'zini-o'zi qulflab qo'yish" xavfidan saqlaydi).
    const count = await env.DB.prepare(`SELECT COUNT(*) AS n FROM admin_ip_whitelist`).first();
    if (Number(count?.n || 0) === 0) return true;
    return !!rows;
  } catch {
    return true; // xatolik bo'lsa adminni butunlay qulflab qo'ymaymiz
  }
}

async function requireAdmin(request, env) {
  const admin = await getCurrentAdmin(request, env);
  if (!admin || admin.idleTimeout) return null;
  if (!(await checkIpWhitelist(request, env, reqIp(request)))) return null;
  return admin;
}

// ---------- record shaping (mirrors server/db.js rowToRecord / SELECT_FIELDS) ----------

function parseJsonArray(text) {
  try { const v = JSON.parse(text); return Array.isArray(v) ? v : []; } catch { return []; }
}
function parseJsonObjectOrNull(text) {
  if (!text) return null;
  try { const v = JSON.parse(text); return v && typeof v === 'object' ? v : null; } catch { return null; }
}

function rowToRecord(row) {
  return {
    code: row.code, name: row.name, role: row.role || '', avatarUrl: row.avatar_url || '',
    bgUrl: row.bg_url || '', bgPattern: !!row.bg_pattern, accentColor: row.accent_color || '',
    bgColor: row.bg_color || '', bgAnimated: !!row.bg_animated, isPrimary: !!row.is_primary,
    hidePhone: !!row.hide_phone, giftable: !!row.giftable, linksTransparent: !!row.links_transparent,
    linkStyle: ['standard', 'transparent', 'glass'].includes(row.link_style) ? row.link_style : 'standard',
    profileType: ['personal', 'expert', 'business'].includes(row.profile_type) ? row.profile_type : 'personal',
    city: row.city || '', categorySlug: row.category_slug || '', address: row.address || '',
    latitude: row.latitude != null ? Number(row.latitude) : null, longitude: row.longitude != null ? Number(row.longitude) : null,
    hiddenFromDirectory: !!row.hidden_from_directory, leadCapture: !!row.lead_capture, musicUrl: row.music_url || '',
    tg: row.tg || '', phone: row.phone || '', email: row.email || '', linkedin: row.linkedin || '',
    instagram: row.instagram || '', about: row.about || '', facebook: row.facebook || '', twitter: row.twitter || '',
    website: row.website || '', cardNumber: row.card_number || '', extraLinks: parseJsonArray(row.extra_links),
    cardNumbers: parseJsonArray(row.card_numbers), tierOverride: row.tier_override || '', verified: !!row.verified,
    cardDesign: parseJsonObjectOrNull(row.card_design), theme: row.theme || 'classic', forSale: !!row.for_sale,
    salePrice: row.sale_price != null ? Number(row.sale_price) : null, hashtags: parseJsonArray(row.hashtags),
    price: Number(row.price), ts: Number(row.ts), views: Number(row.views),
  };
}

const RECORD_COLUMNS = `code, name, role, avatar_url, bg_url, bg_pattern, accent_color, bg_color, bg_animated,
  music_url, links_transparent, link_style, profile_type, city, category_slug, hidden_from_directory,
  address, latitude, longitude, lead_capture, is_primary, giftable, hide_phone, tg, phone, email,
  linkedin, instagram, about, facebook, twitter, website, card_number, extra_links, card_numbers,
  tier_override, card_design, verified, theme, for_sale, sale_price, hashtags, price, ts, views`;

function catalogCard(record) {
  return {
    code: record.code, name: record.name, role: record.role, avatarUrl: record.avatarUrl, tg: record.tg,
    hashtags: record.hashtags, theme: record.theme, price: record.price, ts: record.ts, views: record.views,
    profileType: record.profileType, city: record.city, categorySlug: record.categorySlug,
    verified: record.verified, tierOverride: record.tierOverride || '',
  };
}

async function getRecord(env, code) {
  const row = await env.DB.prepare(
    `SELECT c.*, u.is_premium AS owner_is_premium,
            EXISTS(SELECT 1 FROM nfc_gifts g WHERE g.code = c.code AND g.status = 'activated') AS is_gift
     FROM cards c LEFT JOIN users u ON u.id = c.user_id WHERE c.code = ?`
  ).bind(code).first();
  if (!row) return null;
  return { ...rowToRecord(row), isPremium: !!row.owner_is_premium, isGift: !!row.is_gift };
}

async function getRecordOwner(env, code) {
  const row = await env.DB.prepare(`SELECT user_id FROM cards WHERE code = ?`).bind(code).first();
  return row ? row.user_id : null;
}

// ---------- input cleaning (mirrors server/index.js validateBody, trimmed) ----------

function cleanStr(v, max) { return typeof v === 'string' ? v.trim().slice(0, max) : ''; }
function recSafeUrl(v) {
  const s = cleanStr(v, 500);
  if (!s) return '';
  try { const u = new URL(s); return u.protocol === 'http:' || u.protocol === 'https:' ? s : ''; } catch { return ''; }
}
function uploadOrSafeUrl(v) {
  const external = recSafeUrl(v);
  if (external) return external;
  if (typeof v === 'string' && v.startsWith('/uploads/')) return cleanStr(v, 300).replace(/[^\w\-./]/g, '');
  return '';
}
const THEME_WHITELIST = ['classic', 'midnight', 'emerald', 'royal', 'sunset', 'gold', 'glass'];
const STD_CODE_RE = /^[A-Z]{3}[0-9]{3}$/;
const LETTER_CODE_RE = /^[A-Z]{3,12}$/;
const FREE_ID_RE = /^[0-9]{8}$/;
function isBlockedCode(code) { return String(code || '').toUpperCase().startsWith('GOD'); }
function validCode(code) {
  if (isBlockedCode(code)) return false;
  return STD_CODE_RE.test(code) || LETTER_CODE_RE.test(code) || FREE_ID_RE.test(code);
}

// ---------- personal NFC ID pricing (Payme foundation — PHASE 2A) ----------
// MUHIM: bu `companyPricing()` (yuqorida, Company ID uchun — 3/4-5/6-7/8+
// uzunlik asosida, 349k/549k/749k/990k narxlar) bilan ARALASHTIRILMASIN.
// Bu yerdagi mantiq shaxsiy 6-belgili NFC ID (AAA000 shaklidagi) uchun va
// src/lib/pricing.js'dagi tierFromCode()/TIER_PRICE/codeTierOverride()
// (src/lib/codeTiers.js) bilan BAYT-BA-BAYT bir xil bo'lishi SHART.
//
// Nega bu yerda alohida nusxa (import emas)? hosting/worker.js Cloudflare
// Worker sifatida oddiy fayl-nusxalash orqali deploy qilinadi
// (scripts/prepare-sites-build.mjs — bundler emas, faqat `copyFile`), shu
// sababli `import ... from '../src/lib/pricing.js'` deploy qilingan
// artifaktda ishlamas edi (nisbiy yo'l boshqa muhitda mavjud emas — bu
// oldingi Payme arxitektura auditida topilgan cheklov). src/lib/pricing.js
// yoki src/lib/codeTiers.js o'zgarsa, BU BLOK QO'LDA ham yangilanishi va
// scripts/payme-pricing-parity-test.mjs qayta ishga tushirilishi SHART —
// aks holda ikki tomon orasida narx farqi (pricing drift) paydo bo'lishi
// mumkin. Hozircha bu funksiyalar hech qanday route tomonidan
// chaqirilmaydi (haqiqiy Payme xarid endpointi hali yozilmagan) — faqat
// keyingi bosqich uchun tayyor, sinovdan o'tgan fundament.

// Qo'lda belgilangan tarif (src/lib/codeTiers.js bilan bir xil, 2026-08
// holati). O'zgartirish: shu ikkala faylni BIRGA yangilang.
const PERSONAL_AUCTION_CODES = [
  'AAA001', 'AAA007', 'OOO001', 'OOO007', 'JJJ007', 'DDD001', 'DDD007', 'FFF007',
  'BEK001', 'BEK007', 'BEK777', 'UZB000', 'UZB001', 'UZB007', 'UAE001', 'USD100',
  'ABC123', 'DEV001', 'GEM001', 'UNO000', 'WOW013', 'ASL777', 'AGA777', 'KHU777',
  'ISA777', 'FAY777', 'USS777', 'OZZ777', 'PZP777', 'PLT034', 'RMA007', 'FCB010',
  'AMG063', 'CLS063',
];
const PERSONAL_PREMIUM_CODES = [
  'AAA100', 'AAA701', 'AAA717', 'AAA097', 'AAA066', 'ZZZ717', 'ZZZ727', 'ZZZ005',
  'OOO005', 'OOO013', 'EMR777', 'GRL999', 'GRL444', 'GRL555', 'GRL777', 'GRL888',
  'GRL333', 'GRL222', 'AZU555', 'TEN444', 'KAP444', 'DYR444', 'AKL444', 'ACA666',
  'PBP888', 'SKB888', 'GIO111', 'WEF111', 'ETS111', 'SZZ222', 'BOY222', 'MLN222',
  'GGG200', 'VVV700', 'NMX700', 'ZOO700', 'GRL700', 'BMW010',
];
const PERSONAL_EXACT_PREMIUM_CODES = [
  'KHB029', 'UFC229', 'UFC300', 'UFC205', 'UFC194', 'UFC100', 'UFC200', 'UFC254',
  'MMA029', 'MMA300', 'KHB254', 'CON013', 'CON205', 'CON194',
];
const PERSONAL_CODE_TIERS = {};
for (const c of PERSONAL_AUCTION_CODES) PERSONAL_CODE_TIERS[c] = 'exclusive';
for (const c of PERSONAL_PREMIUM_CODES) PERSONAL_CODE_TIERS[c] = 'premium';
for (const c of PERSONAL_EXACT_PREMIUM_CODES) PERSONAL_CODE_TIERS[c] = 'premium';
function personalCodeTierOverride(code) {
  const c = String(code || '').toUpperCase();
  return Object.prototype.hasOwnProperty.call(PERSONAL_CODE_TIERS, c) ? PERSONAL_CODE_TIERS[c] : null;
}

const PERSONAL_EXCLUSIVE_WORDS = ['VIP', 'CEO', 'KNG', 'LEG', 'ROY', 'ACE', 'WIN', 'UZB', 'LUX'];
const PERSONAL_PREMIUM_WORDS = [
  'BMW', 'AMG', 'GTR', 'AUD', 'GTI', 'GTS', 'EVO', 'RSQ', 'SUV', 'CAR',
  'KIA', 'BYD', 'RRS', 'LMB', 'TSL', 'PRS', 'MRX',
  'BOS', 'TOP', 'PRO', 'MAX', 'BIG', 'ONE', 'MBA', 'DEV', 'DOC', 'LAW',
  'ART', 'FIT', 'GYM', 'BIZ', 'DJX', 'BND',
  'TAS', 'SAM', 'BUX', 'AND', 'NAV', 'FER', 'XIV', 'NUK', 'JIZ', 'QAR',
  'TER', 'URG', 'NMG',
  'ALI', 'AZI', 'JAS', 'BOB', 'SAR', 'SHO', 'TIM', 'UMR', 'MIR',
  'SHX', 'BEK', 'ABR', 'ODI', 'RUS', 'ISL', 'KAM', 'NOD', 'OYB', 'SUX',
  'FUR', 'ELY', 'DIY', 'HAS', 'HUS', 'ZAF', 'AKM', 'BAX', 'JAV', 'SHR',
  'AZM', 'FAR', 'TOX', 'ULU', 'XON', 'OTA', 'IBR', 'SUL', 'NUR',
  'DIL', 'NIL', 'ZAR', 'NOZ', 'MAL', 'LAY', 'MAD', 'GUL', 'SEV', 'MOX',
  'LOB', 'IRO', 'MUX', 'SHA', 'ZUL', 'FOT', 'OYS', 'NAF', 'RAY', 'MEH',
  'KOM', 'NIG', 'MAR', 'MAH', 'XUR',
  'SKY', 'SUN', 'FLY', 'JET', 'ICE', 'RED', 'FOX', 'GEM', 'ZEN', 'NEO',
  'PAY', 'STA',
  'USD', 'UZS',
];
const PERSONAL_GOV_WORDS = [
  'IIB', 'DXX', 'MXX', 'DAV', 'YHX', 'YPX', 'GAI', 'FVV', 'DBX', 'DSX',
  'DSI', 'ADL', 'SUD', 'PRK', 'TIV', 'MUD', 'HKM', 'VZR', 'BOJ', 'GUV',
];

function personalAllSame3(s) { return s[0] === s[1] && s[1] === s[2]; }
function personalHasAdjacentPair(s) { return s[0] === s[1] || s[1] === s[2]; }
function personalIsZeroSuperDigit(d) { return d === '001' || d === '007' || d === '077'; }
const PERSONAL_EXTRA_SUPER_DIGITS = ['711', '712', '771', '772'];
function personalIsExtraSuperDigit(d) { return PERSONAL_EXTRA_SUPER_DIGITS.includes(d); }
function personalIsMirrorDigit(d) { return d[0] === d[2] && d !== '000'; }
function personalIsX0X(d) { return d[1] === '0' && d[0] === d[2] && d[0] !== '0'; }
function personalIsGovPremiumDigit(d) {
  return d === '001' || d === '007' || d === '077' || d === '707' || d === '010' || personalIsExtraSuperDigit(d);
}
function personalIsSuperDigit(d) {
  if (personalIsZeroSuperDigit(d)) return true;
  if (personalAllSame3(d) && d !== '000') return true;
  if (personalIsX0X(d)) return true;
  if (personalIsExtraSuperDigit(d)) return true;
  return false;
}

// Kod darajasini aniqlaydi — src/lib/pricing.js'dagi tierFromCode() bilan
// AYNAN bir xil qoida tartibi (izohlar uchun o'sha faylga qarang).
function personalTierFromCode(letters, digits) {
  const lettersAllSame = personalAllSame3(letters);
  const digitsAllSame = personalAllSame3(digits);
  const exclusiveWord = PERSONAL_EXCLUSIVE_WORDS.includes(letters);
  const premiumWord = PERSONAL_PREMIUM_WORDS.includes(letters);
  const govWord = PERSONAL_GOV_WORDS.includes(letters);

  if (lettersAllSame && digitsAllSame) return 'exclusive';
  if (exclusiveWord) return 'exclusive';

  if (digits === '000') return 'premium';
  if (govWord && personalIsGovPremiumDigit(digits)) return 'premium';
  if (premiumWord && personalIsSuperDigit(digits)) return 'premium';

  if (premiumWord) return 'gold';
  if (govWord) return 'gold';
  if (lettersAllSame || digitsAllSame) return 'gold';
  if (personalIsZeroSuperDigit(digits)) return 'gold';

  if (personalIsMirrorDigit(digits)) return 'silver';
  if (personalHasAdjacentPair(letters) && personalHasAdjacentPair(digits)) return 'silver';

  return 'free';
}

// MUHIM: bu narxlar src/lib/pricing.js'dagi TIER_PRICE bilan AYNAN bir xil
// bo'lishi shart — Bronza(free)=49000, Silver=99000, Gold=149000,
// Premium=199000, Exclusive=null (to'g'ridan-to'g'ri sotilmaydi, faqat
// auksion orqali).
const PERSONAL_TIER_PRICE = { exclusive: null, premium: 199000, gold: 149000, silver: 99000, free: 49000 };

// Kod pullik shaxsiy NFC ID sifatida sotib olinishi mumkinmi? Bloklangan
// prefiks (GOD...) yoki avtomatik-bepul 8 xonali profil ID shakli
// (FREE_ID_RE — faqat ro'yxatdan o'tishda beriladi, server/db.js
// createFreeAutoId ekvivalenti) bo'lsa — YO'Q. Bu tekshiruv har qanday
// kelajakdagi xarid/Payme order-yaratish endpointidan OLDIN chaqirilishi
// SHART (server/index.js'dagi bir xil nomdagi tekshiruvga qarang).
function isPersonalCodePurchasable(rawCode) {
  const c = String(rawCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!c) return false;
  if (isBlockedCode(c)) return false;
  if (FREE_ID_RE.test(c)) return false;
  return true;
}

// Shaxsiy NFC ID narxi — src/lib/pricing.js'dagi priceForCode() bilan bir
// xil ustuvorlik: AVVAL qo'lda belgilangan override, bo'lmasa naqsh
// mantig'i. Chaqiruvchi buni har doim isPersonalCodePurchasable()dan
// KEYIN chaqirishi kerak (8 xonali/bloklangan kodlar uchun natija
// noto'g'ri bo'lishi mumkin, chunki ular standart 6-belgili AAA000
// shaklida emas).
function personalPriceForCode(rawCode) {
  const c = String(rawCode || '').toUpperCase();
  const ov = personalCodeTierOverride(c);
  if (ov) {
    const total = PERSONAL_TIER_PRICE[ov] ?? 0;
    return { total, tier: ov, base: total, override: true };
  }
  const letters = c.slice(0, 3);
  const digits = c.slice(3, 6);
  const tier = personalTierFromCode(letters, digits);
  const total = PERSONAL_TIER_PRICE[tier] ?? 0;
  return { total, tier, base: total };
}

// ── Xavfsiz xarid entry-point (Payme fundamenti — Phase 2A safety fix) ──
// `personalPriceForCode()` (yuqorida) ekslyuziv daraja uchun ham `total`
// maydonida texnik jihatdan `0` qaytaradi (`PERSONAL_TIER_PRICE.exclusive
// = null`, `?? 0` bilan sonlashtiriladi) — bu KELAJAKDAGI Payme order-
// yaratish kodi tomonidan ADASHIB "narxi 0 so'm" deb ishlatib, tekin
// ekslyuziv order yaratib qo'yilishiga olib kelishi MUMKIN edi.
//
// KELAJAKDA yoziladigan Payme order-yaratish route'i HECH QACHON
// `personalPriceForCode()`ni to'g'ridan-to'g'ri ishlatmasin — FAQAT shu
// funksiyani chaqirsin (src/lib/pricing.js'dagi `getPersonalPurchaseQuote`
// bilan BAYT-BA-BAYT bir xil xulq — parity testda tekshiriladi):
//
//   1) sotib olib bo'lmaydi (8 xonali avtomatik-bepul ID, bloklangan
//      prefiks, yoki standart 6-belgili AAA000 format emas) ->
//        { purchasable: false, reason: 'not_purchasable' }
//   2) ekslyuziv (faqat auksion) ->
//        { purchasable: false, reason: 'exclusive_auction_only', tier: 'exclusive' }
//      `amount` MAYDONI YO'Q (undefined) — `0` EMAS.
//   3) sotib olinadigan (Bronza/Silver/Gold/Premium) ->
//        { purchasable: true, tier, amount } — `amount` doim musbat son.
function personalPurchaseQuote(rawCode) {
  const c = String(rawCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  // Faqat standart 6-belgili AAA000 format qabul qilinadi (STD_CODE_RE) —
  // 8 xonali avtomatik-bepul ID yoki boshqa har qanday uzunlik/shakl
  // avtomatik rad etiladi (server/index.js'dagi parseCode bilan bir xil
  // qat'iylik).
  if (c.length !== 6 || !STD_CODE_RE.test(c)) return { purchasable: false, reason: 'not_purchasable' };
  if (!isPersonalCodePurchasable(c)) return { purchasable: false, reason: 'not_purchasable' };
  const { tier } = personalPriceForCode(c);
  if (tier === 'exclusive') return { purchasable: false, reason: 'exclusive_auction_only', tier };
  const amount = PERSONAL_TIER_PRICE[tier];
  return { purchasable: true, tier, amount };
}

// Node'dagi parity test (scripts/payme-pricing-parity-test.mjs) uchun
// nomlangan export — Cloudflare Workers runtime faqat pastdagi `export
// default { fetch }`ni ishlatadi, qo'shimcha nomlangan exportlar unga
// hech qanday ta'sir qilmaydi/xalaqit bermaydi.
export {
  personalPriceForCode, isPersonalCodePurchasable, personalTierFromCode,
  personalCodeTierOverride, PERSONAL_TIER_PRICE, PERSONAL_CODE_TIERS,
  personalPurchaseQuote,
};

// ---------- web_orders write layer (Payme Phase 2B) ----------
// Mirrors server/db.js's web_orders functions field-for-field (see that
// file's "Sayt buyurtmalari" section) — same names, same state machine
// (pending -> paid | cancelled | failed_code_taken). D1/SQLite has no
// JSONB: `payload` is a plain TEXT column, so every read/write here does
// its own JSON.stringify/JSON.parse (unlike node-postgres's ::jsonb cast,
// nothing does this automatically).
const WEB_ORDER_SELECT = `id, user_id AS userId, code, kind, price, payload, status,
  created_at AS createdAt, payme_transaction_id AS paymeTransactionId,
  perform_time AS performTime, cancel_time AS cancelTime, cancel_reason AS cancelReason,
  payme_create_time AS paymeCreateTime`;

function parseWebOrderRow(row) {
  if (!row) return null;
  let payload = {};
  try { payload = row.payload ? JSON.parse(row.payload) : {}; } catch { payload = {}; }
  return {
    id: row.id, userId: row.userId, code: row.code, kind: row.kind,
    price: Number(row.price), payload, status: row.status,
    createdAt: row.createdAt, paymeTransactionId: row.paymeTransactionId ?? null,
    // perform_time/cancel_time: REAL stored timestamps of when the order
    // actually transitioned to paid/cancelled (set once, via COALESCE —
    // see setWebOrderStatusD1/stampWebOrderCancelD1) — never recomputed
    // live, so Payme's CheckTransaction/GetStatement get a stable answer
    // every time they ask, not a fresh "now" on each call.
    performTime: row.performTime ?? null, cancelTime: row.cancelTime ?? null,
    cancelReason: row.cancelReason == null ? null : Number(row.cancelReason),
    // Real, stable moment the Payme TRANSACTION was first created (set
    // once, via COALESCE — see setWebOrderPaymeIdD1) — deliberately NOT
    // the same as createdAt (order/reservation time), which can be much
    // earlier. Used for the create_time Payme expects back from
    // CreateTransaction/CheckTransaction/GetStatement, identically.
    paymeCreateTime: row.paymeCreateTime ?? null,
  };
}

async function createWebOrderD1(env, { userId, code, price, payload, kind = 'card_purchase' }) {
  const row = await env.DB.prepare(
    `INSERT INTO web_orders (user_id, code, kind, price, payload) VALUES (?, ?, ?, ?, ?) RETURNING ${WEB_ORDER_SELECT}`
  ).bind(userId, code, kind, price, JSON.stringify(payload || {})).first();
  return parseWebOrderRow(row);
}

// Xavfsiz rezervatsiya (pre-commit review Fix 1) — bitta kod uchun
// bir vaqtda faqat bitta "pending" order bo'lishini DB DARAJASIDA
// kafolatlaydi, LEKIN buni schema-darajasidagi UNIQUE constraint (va
// uning mavjud tozalanmagan ma'lumotga tegib butun API'ni yiqitish
// xavfi) ORQALI EMAS, balki BITTA ATOMIK statement orqali qiladi:
// `INSERT ... SELECT ... WHERE NOT EXISTS (...)`. D1/SQLite'da yozuvlar
// bitta bazada ketma-ket (serializatsiya qilingan, bir vaqtning o'zida
// faqat bitta yozuvchi) bajariladi — shuning uchun ikkita parallel
// so'rov ham bitta-birdan-keyin ishlaydi va WHERE NOT EXISTS ikkinchisi
// uchun to'g'ri "allaqachon bor" holatini ko'radi. Muvaffaqiyatli
// bo'lmasa (boshqa pending order allaqachon mavjud) — hech narsa
// INSERT qilinmaydi, RETURNING bo'sh natija beradi, `null` qaytadi.
async function createPendingWebOrderD1(env, { userId, code, price, payload, kind = 'card_purchase' }) {
  const row = await env.DB.prepare(`
    INSERT INTO web_orders (user_id, code, kind, price, payload, status)
    SELECT ?, ?, ?, ?, ?, 'pending'
    WHERE NOT EXISTS (SELECT 1 FROM web_orders WHERE code = ? AND status = 'pending')
    RETURNING ${WEB_ORDER_SELECT}
  `).bind(userId, code, kind, price, JSON.stringify(payload || {}), code).first();
  return parseWebOrderRow(row);
}

async function getWebOrderD1(env, id) {
  const row = await env.DB.prepare(`SELECT ${WEB_ORDER_SELECT} FROM web_orders WHERE id = ?`).bind(id).first();
  return parseWebOrderRow(row);
}

async function getWebOrderByPaymeIdD1(env, paymeTransactionId) {
  const row = await env.DB.prepare(`SELECT ${WEB_ORDER_SELECT} FROM web_orders WHERE payme_transaction_id = ?`)
    .bind(paymeTransactionId).first();
  return parseWebOrderRow(row);
}

// payme_create_time is stamped here, exactly once (COALESCE), the moment
// a Payme transaction id is first bound to this order — NOT order.created_at
// (which is when "Band qilish" happened, possibly long before). Returns the
// updated row so the CALLER's immediate response can echo this SAME stamped
// value instead of taking its own fresh Date.now() — Payme's own sandbox
// certification requires create_time to stay byte-identical across the
// original CreateTransaction call and every later CreateTransaction
// (duplicate)/CheckTransaction/GetStatement call for this transaction.
async function setWebOrderPaymeIdD1(env, id, paymeTransactionId) {
  const now = new Date().toISOString();
  const row = await env.DB.prepare(
    `UPDATE web_orders SET payme_transaction_id = ?, payme_create_time = COALESCE(payme_create_time, ?) WHERE id = ? RETURNING ${WEB_ORDER_SELECT}`
  ).bind(paymeTransactionId, now, id).first();
  return parseWebOrderRow(row);
}

async function setWebOrderStatusD1(env, id, status) {
  // 'paid' additionally stamps perform_time exactly once (COALESCE — a
  // later idempotent re-call, e.g. a duplicate PerformTransaction, never
  // overwrites the real first timestamp with a later, less accurate one).
  const now = new Date().toISOString();
  const row = status === 'paid'
    ? await env.DB.prepare(`UPDATE web_orders SET status = ?, perform_time = COALESCE(perform_time, ?) WHERE id = ? RETURNING ${WEB_ORDER_SELECT}`)
        .bind(status, now, id).first()
    : await env.DB.prepare(`UPDATE web_orders SET status = ? WHERE id = ? RETURNING ${WEB_ORDER_SELECT}`)
        .bind(status, id).first();
  return parseWebOrderRow(row);
}

// Stamps the cancel_time/cancel_reason Payme actually asked for, ALWAYS
// (even when the order's own `status` stays 'paid' — CancelTransaction on
// an already-paid order is a refund request the merchant has to review
// manually, per the existing intentional design below, but Payme still
// gets a real, stable cancel_time back). COALESCE makes this idempotent
// too — a duplicate CancelTransaction call never moves the timestamp.
async function stampWebOrderCancelD1(env, id, reason) {
  const now = new Date().toISOString();
  const row = await env.DB.prepare(`UPDATE web_orders SET cancel_time = COALESCE(cancel_time, ?), cancel_reason = COALESCE(cancel_reason, ?) WHERE id = ? RETURNING ${WEB_ORDER_SELECT}`)
    .bind(now, reason, id).first();
  return parseWebOrderRow(row);
}

// "Band qilish" (reserve) muddati — shu vaqt ichida Payme orqali
// to'lanmasa, joy avtomatik bo'shaydi. Foydalanuvchi to'lovni umuman
// boshlamasa ham (Payme checkout'ni hech ochmasa ham) himoya qiladi —
// aks holda bunday "band qilish" abadiy qolib, o'sha kod hech kimga
// tegmasdan yotib qolar edi (Payme o'zi CancelTransaction bilan faqat
// HAQIQIY boshlangan tranzaksiyalarni timeout qiladi, umuman
// boshlanmagan buyurtmani emas).
const PENDING_ORDER_TTL_MS = 24 * 60 * 60 * 1000;

async function activeWebOrderByCodeD1(env, code) {
  const row = await env.DB.prepare(`SELECT ${WEB_ORDER_SELECT} FROM web_orders WHERE code = ? AND status = 'pending' LIMIT 1`)
    .bind(code).first();
  const order = parseWebOrderRow(row);
  if (!order) return null;
  const ageMs = Date.now() - new Date(order.createdAt).getTime();
  if (ageMs < PENDING_ORDER_TTL_MS) return order;
  // Muddati o'tgan — avtomatik bekor qilamiz, shu kod endi bo'sh deb
  // hisoblanadi (keyingi createPendingWebOrderD1 chaqiruvi uni band
  // qila oladi). Agar Payme keyinroq shu tranzaksiyani (agar u umuman
  // yaratilgan bo'lsa) CancelTransaction bilan yopsa — bu allaqachon
  // 'cancelled' bo'lgani uchun idempotent, hech narsa buzilmaydi.
  await setWebOrderStatusD1(env, order.id, 'cancelled');
  return null;
}

// Shaxsiy vizitka (NFC ID) yozuvini yaratish — server/db.js'dagi
// createRecord() bilan bir xil ustunlar to'plami (qolgan RECORD_COLUMNS
// ustunlari jadval DEFAULT qiymatlarida qoladi — legacy ham xuddi shunday
// ishlaydi). `code` PRIMARY KEY bo'lgani uchun `ON CONFLICT DO NOTHING`
// parallel so'rovlar uchun ham xavfsiz (ikkinchisi hech narsa qaytarmaydi).
async function createRecordD1(env, record) {
  const row = await env.DB.prepare(`
    INSERT INTO cards
      (code, name, role, avatar_url, bg_url, bg_pattern, accent_color, bg_color, bg_animated, music_url,
       tg, phone, email, linkedin, instagram,
       about, facebook, twitter, website, card_number, extra_links, card_numbers, theme, hashtags, price, ts)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT("code") DO NOTHING
    RETURNING ${RECORD_COLUMNS}
  `).bind(
    record.code, record.name, record.role || '', record.avatarUrl || '', record.bgUrl || '',
    record.bgPattern === false ? 0 : 1, record.accentColor || null, record.bgColor || null,
    record.bgAnimated === false ? 0 : 1, record.musicUrl || null,
    record.tg || '', record.phone || '', record.email || '', record.linkedin || '', record.instagram || '',
    record.about || '', record.facebook || '', record.twitter || '', record.website || '',
    record.cardNumber || '', JSON.stringify(record.extraLinks || []), JSON.stringify(record.cardNumbers || []),
    record.theme || 'classic', JSON.stringify(record.hashtags || []), record.price, Date.now(),
  ).first();
  return row ? rowToRecord(row) : null;
}

async function attachCardToUserD1(env, code, userId) {
  await env.DB.prepare(`UPDATE cards SET user_id = ? WHERE code = ? AND user_id IS NULL`).bind(userId, code).run();
}

// Buyurtma turi (kind)ga qarab to'g'ri "finalize" mantig'ini bajaradi —
// server/db.js'dagi finalizePaidWebOrder() bilan bir xil, LEKIN Phase 2B
// FAQAT 'card_purchase'ni qo'llab-quvvatlaydi (task shart-sharoiti).
// Boshqa kind'lar (auction_payment/premium_upgrade/premium_follow/
// physical_card_order/company_purchase) hali D1'da portlanmagan — ularni
// xato holatda "paid" qilib qo'yish egalik/pul oqibatlariga olib kelishi
// mumkin (masalan auksionni noto'g'ri yakunlash), shuning uchun buyurtma
// 'pending' holatida QOLDIRILADI va xavfsiz "unsupported" natija
// qaytariladi — admin buni qo'lda ko'rib chiqishi mumkin.
//
// ATOMIK/RESUMABLE dizayn (pre-commit review Fix 2): "record yaratish →
// userga biriktirish → order paid" uchtasi alohida, mustaqil D1
// chaqiruvi — Worker ular orasida to'xtab qolsa (crash/xato/timeout),
// keyingi chaqiruv (masalan Payme'ning duplicate PerformTransaction'i)
// buni "code_taken" xato deb NOTO'G'RI belgilash o'rniga, DB'ning
// HAQIQIY joriy holatiga qarab to'g'ri qadamdan DAVOM ETADI:
//   CASE A — record umuman yo'q            -> yaratish + biriktirish + paid
//   CASE B — record bor, egasi YO'Q        -> (oldingi yarim urinishdan
//                                              qolgan) shu userga
//                                              biriktirish + paid
//   CASE C — record bor, egasi ALLAQACHON shu order useri -> faqat paid
//            (idempotent, hech narsa qayta yaratilmaydi/o'zgartirilmaydi)
//   CASE D — record bor, egasi BOSHQA (chinakam begona) user -> ownership
//            HECH QACHON o'zgartirilmaydi, haqiqiy code_taken xatosi
async function finalizePaidWebOrderD1(env, orderId) {
  const order = await getWebOrderD1(env, orderId);
  if (!order) return { alreadyProcessed: true };

  if (order.status === 'paid') {
    // Idempotent qayta-chaqiruv (masalan duplicate PerformTransaction):
    // DB holatini haqiqatan tasdiqlab, mos javob beramiz — hech qanday
    // yangi yozuv yaratilmaydi/o'zgartirilmaydi.
    const owner = await getRecordOwner(env, order.code);
    return String(owner) === String(order.userId)
      ? { ok: true, alreadyPaid: true }
      : { ok: false, reason: 'code_taken' };
  }
  if (order.status !== 'pending') return { alreadyProcessed: true };
  if (order.kind !== 'card_purchase') return { ok: false, reason: 'unsupported_order_kind' };

  // CASE B/C/D uchun umumiy hal qiluvchi — mavjud record uchun egalik
  // holatiga qarab to'g'ri (va faqat to'g'ri) amalni bajaradi.
  const resolveExisting = async (record) => {
    const owner = await getRecordOwner(env, order.code);
    if (owner == null) {
      // CASE B — oldingi qisman (yarim to'xtagan) urinishdan qolgan
      // egasiz karta: shu userga biriktirib yakunlaymiz.
      await attachCardToUserD1(env, order.code, order.userId);
      await setWebOrderStatusD1(env, order.id, 'paid');
      return { ok: true, created: record, resumed: true };
    }
    if (String(owner) === String(order.userId)) {
      // CASE C — allaqachon shu userga tegishli: ownership qayta
      // o'zgartirilmaydi, faqat order holati yakunlanadi (idempotent).
      await setWebOrderStatusD1(env, order.id, 'paid');
      return { ok: true, created: record, resumed: true };
    }
    // CASE D — chinakam begona egasi bor: ownership HECH QACHON
    // o'zgartirilmaydi — haqiqiy xato.
    await setWebOrderStatusD1(env, order.id, 'failed_code_taken');
    return { ok: false, reason: 'code_taken' };
  };

  const existing = await getRecord(env, order.code);
  if (existing) return resolveExisting(existing);

  // CASE A — record umuman yo'q: yaratamiz.
  const created = await createRecordD1(env, { ...order.payload, code: order.code, price: order.price });
  if (created) {
    await attachCardToUserD1(env, order.code, order.userId);
    await setWebOrderStatusD1(env, order.id, 'paid');
    return { ok: true, created };
  }
  // ON CONFLICT DO NOTHING hech narsa qaytarmadi — parallel ravishda band
  // bo'lib qolgan (juda tor race, ehtimol bizning o'z parallel
  // urinishimiz). Qayta o'qib, xuddi B/C/D mantig'ini qo'llaymiz.
  const raced = await getRecord(env, order.code);
  if (raced) return resolveExisting(raced);
  await setWebOrderStatusD1(env, order.id, 'failed_code_taken');
  return { ok: false, reason: 'code_taken' };
}

// ---------- Payme Merchant API (Phase 2B) ----------
// server/payme.js kontraktini audit qilib yozilgan — javob/xato shakllari
// (rpc result/error, xatolik kodlari, account.order_id, tiyin miqdori)
// AYNAN saqlangan. Farqi faqat D1 write-layer chaqiruvlarida (yuqorida).
const PAYME_ERR = {
  INVALID_AMOUNT: -31001,
  ACCOUNT_NOT_FOUND: -31050,
  CANT_DO_OPERATION: -31008,
  TRANSACTION_NOT_FOUND: -31003,
  CANT_CANCEL: -31007,
  SYSTEM: -32400,
};
function paymeRpcError(id, code, message) {
  return { jsonrpc: '2.0', id, error: { code, message: { ru: message, uz: message, en: message } } };
}
function paymeRpcResult(id, result) {
  return { jsonrpc: '2.0', id, result };
}

// Payme's own documented state codes: 1 pending, 2 paid, -1 cancelled
// while pending, -2 cancelled AFTER being paid (a refund). A
// CancelTransaction call always stamps cancel_time (see
// stampWebOrderCancelD1), regardless of whether the order was paid or
// still pending at that moment — whether it happened WHILE paid is
// recoverable from order.status: CancelTransaction's wasPaid branch
// deliberately leaves status alone at 'paid' (ownership already granted,
// admin reviews refunds manually — see its own comment), while the
// not-yet-paid branch flips it to 'cancelled'/'failed_code_taken'. So:
//   cancel_time set + status still 'paid'       -> cancelled AFTER paid (-2)
//   cancel_time set + status cancelled/failed   -> cancelled BEFORE paid (-1)
//   no cancel_time  + status 'paid'             -> paid, active (2)
//   no cancel_time  + otherwise                 -> pending (1)
// Verified against Payme's own official sandbox certification demo
// (CancelTransaction on a paid order -> CheckTransaction must echo -2,
// not silently keep reporting 2 as if nothing happened).
function paymeOrderState(order) {
  if (order.cancelTime) return order.status === 'paid' ? -2 : -1;
  return order.status === 'paid' ? 2 : 1;
}

// The real, stable moment the Payme TRANSACTION was created (order.paymeCreateTime
// — see setWebOrderPaymeIdD1), never order.createdAt (order/reservation time,
// which can be much earlier). Falls back to createdAt only for rows written
// before this column existed / before a transaction was ever bound — Payme's
// own sandbox certification requires this value to be byte-identical across
// CreateTransaction (original + duplicate), CheckTransaction, and GetStatement.
function paymeCreateTimeMs(order) {
  return new Date(order.paymeCreateTime || order.createdAt).getTime();
}

// Node'ning crypto.timingSafeEqual'i Workers runtime'da har doim ham
// oson mavjud emas (nodejs_compat bayrog'iga bog'liq) — shu qisqa
// umumiy-sir satrni solishtirish uchun mustaqil, kutubxonasiz doimiy-
// vaqtli taqqoslash yetarli.
function timingSafeEqualStr(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function verifyPaymeAuthD1(request, env) {
  const key = env.PAYME_KEY || '';
  if (!key) return false;
  const header = request.headers.get('authorization') || request.headers.get('Authorization') || '';
  const [scheme, b64] = header.split(' ');
  if (scheme !== 'Basic' || !b64) return false;
  let decoded;
  try { decoded = atob(b64); } catch { return false; }
  const sep = decoded.indexOf(':');
  if (sep < 0) return false;
  const login = decoded.slice(0, sep);
  const pass = decoded.slice(sep + 1);
  return login === 'Paycom' && timingSafeEqualStr(pass, key);
}

// Ikkala gate ham rost bo'lishi kerak — xuddi legacy paymentsEnabled()
// kabi (PAYMENTS_ENABLED muhit o'zgaruvchisi VA Payme kredentsiallari).
// Hozircha ikkalasi ham sozlanmagan — bu funksiya har doim `false`
// qaytaradi, hech qanday real to'lov qabul qilinmaydi.
function paymentsEnabledD1(env) {
  return env.PAYMENTS_ENABLED === 'true' && !!(env.PAYME_MERCHANT_ID && env.PAYME_KEY);
}

// Checkout havolasi — server/payme.js'dagi paymeCheckoutLink() bilan bir
// xil format (base64({m, ac.order_id, a})). `Buffer` Node-only — Workers
// runtime'ning global `btoa`sidan foydalanamiz (parametrlar faqat ASCII).
//
// Checkout domeni env.PAYME_CHECKOUT_DOMAIN orqali sozlanadi (Cloudflare
// Variable, kod emas) — Payme test/sandbox rejimi production'dan boshqa
// domen talab qilsa (masalan checkout.test.paycom.uz), kodni
// o'zgartirmasdan/qayta deploy qilmasdan shu o'zgaruvchini almashtirish
// kifoya. Sozlanmagan bo'lsa production domeniga tushadi.
function paymeCheckoutLinkD1(env, orderId, amountSom) {
  const merchantId = env.PAYME_MERCHANT_ID || '';
  if (!merchantId || !orderId) return '';
  const tiyin = Math.round(Number(amountSom) * 100);
  const params = `m=${merchantId};ac.order_id=${orderId};a=${tiyin}`;
  const domain = env.PAYME_CHECKOUT_DOMAIN || 'checkout.paycom.uz';
  return `https://${domain}/${btoa(params)}`;
}

async function handlePaymeRequestD1(env, body) {
  const { method, params, id } = body || {};
  const orderId = Number(params?.account?.order_id);

  try {
    switch (method) {
      case 'CheckPerformTransaction': {
        if (!orderId) return paymeRpcError(id, PAYME_ERR.ACCOUNT_NOT_FOUND, 'Buyurtma topilmadi');
        const order = await getWebOrderD1(env, orderId);
        if (!order || order.status !== 'pending') {
          return paymeRpcError(id, PAYME_ERR.ACCOUNT_NOT_FOUND, 'Buyurtma topilmadi yoki allaqachon yopilgan');
        }
        const expected = Math.round(Number(order.price) * 100);
        if (Number(params.amount) !== expected) return paymeRpcError(id, PAYME_ERR.INVALID_AMOUNT, 'Summa mos emas');
        return paymeRpcResult(id, { allow: true });
      }

      case 'CreateTransaction': {
        if (!orderId) return paymeRpcError(id, PAYME_ERR.ACCOUNT_NOT_FOUND, 'Buyurtma topilmadi');
        const order = await getWebOrderD1(env, orderId);
        if (!order) return paymeRpcError(id, PAYME_ERR.ACCOUNT_NOT_FOUND, 'Buyurtma topilmadi');

        const existing = await getWebOrderByPaymeIdD1(env, params.id);
        if (existing) {
          // MUHIM (Phase 2B xavfsizlik talabi — task D): bitta Payme
          // tranzaksiya ID'si boshqa order_id bilan qayta ishlatilishi
          // mumkin emas. Legacy bu holatni tekshirmaydi (har doim mavjud
          // orderni qaytaradi) — bu yerda qat'iyroq: order_id mos
          // kelmasa aniq xato qaytariladi.
          if (String(existing.id) !== String(order.id)) {
            return paymeRpcError(id, PAYME_ERR.CANT_DO_OPERATION, 'Tranzaksiya boshqa buyurtmaga tegishli');
          }
          // create_time — HAQIQIY, saqlangan qiymat (existing.paymeCreateTime),
          // existing.createdAt (order/rezervatsiya vaqti) EMAS — aks holda bu
          // qiymat original CreateTransaction chaqiruvi qaytargan create_time
          // bilan mos kelmay qolar edi (Payme'ning o'z sandbox
          // sertifikatlashida aynan shu narsa "спецификацияга mos emas"
          // deb belgilangan edi).
          return paymeRpcResult(id, {
            create_time: paymeCreateTimeMs(existing),
            transaction: String(existing.id),
            state: existing.status === 'paid' ? 2 : existing.status === 'cancelled' ? -1 : 1,
          });
        }
        // Bu buyurtma ALLAQACHON boshqa (hali ochiq) Payme tranzaksiyasi
        // tomonidan band qilingan — ikkinchi, boshqa transaction id bilan
        // kelgan CreateTransaction uni "bosib olishi" (payme_transaction_id'ni
        // almashtirib, birinchi tranzaksiyani "orphan" qilib qo'yishi) mumkin
        // emas. Payme sandbox sertifikatlashi buni aniq talab qiladi:
        // "Обрабатывается — другая транзакция заняла этот счет" ->
        // -31099...-31050 oralig'idagi xato.
        if (order.paymeTransactionId && String(order.paymeTransactionId) !== String(params.id)) {
          return paymeRpcError(id, PAYME_ERR.ACCOUNT_NOT_FOUND, 'Boshqa tranzaksiya ushbu hisobni band qilgan');
        }
        if (order.status !== 'pending') return paymeRpcError(id, PAYME_ERR.CANT_DO_OPERATION, 'Buyurtma band emas');
        const expected = Math.round(Number(order.price) * 100);
        if (Number(params.amount) !== expected) return paymeRpcError(id, PAYME_ERR.INVALID_AMOUNT, 'Summa mos emas');

        try {
          const stamped = await setWebOrderPaymeIdD1(env, order.id, params.id);
          return paymeRpcResult(id, { create_time: paymeCreateTimeMs(stamped), transaction: String(stamped.id), state: 1 });
        } catch (err) {
          // payme_transaction_id UNIQUE — parallel/duplicate chaqiruv
          // boshqa so'rov bilan poyga (race)da mag'lub bo'lgan bo'lishi
          // mumkin; g'olib bo'lgan tomonning natijasini qaytaramiz.
          if (String(err?.message || '').toLowerCase().includes('unique')) {
            const winner = await getWebOrderByPaymeIdD1(env, params.id);
            if (winner && String(winner.id) === String(order.id)) {
              return paymeRpcResult(id, {
                create_time: paymeCreateTimeMs(winner),
                transaction: String(winner.id),
                state: winner.status === 'paid' ? 2 : winner.status === 'cancelled' ? -1 : 1,
              });
            }
            return paymeRpcError(id, PAYME_ERR.CANT_DO_OPERATION, 'Tranzaksiya boshqa buyurtmaga tegishli');
          }
          throw err;
        }
      }

      case 'PerformTransaction': {
        const order = await getWebOrderByPaymeIdD1(env, params.id);
        if (!order) return paymeRpcError(id, PAYME_ERR.TRANSACTION_NOT_FOUND, 'Tranzaksiya topilmadi');
        if (order.status === 'paid') {
          // Idempotent — allaqachon to'langan, xuddi shu natijani qaytadi,
          // ownership qayta yaratilmaydi/o'zgartirilmaydi. perform_time —
          // HAQIQIY, saqlangan to'lov vaqti (order.performTime), createdAt
          // EMAS — aks holda bu qiymat CheckTransaction/GetStatement
          // qaytaradigan perform_time bilan mos kelmay qolar edi (ular
          // ikkalasi ham order.performTime'dan foydalanadi).
          return paymeRpcResult(id, {
            transaction: String(order.id),
            perform_time: order.performTime ? new Date(order.performTime).getTime() : Date.now(),
            state: 2,
          });
        }
        if (order.status !== 'pending') return paymeRpcError(id, PAYME_ERR.CANT_DO_OPERATION, "Amalni bajarib bo'lmaydi");
        // MUHIM (task E — ownership faqat shu yerdan keyin): finalize
        // muvaffaqiyatli bo'lmaguncha hech qanday NFC record yaratilmaydi/
        // biriktirilmaydi.
        const result = await finalizePaidWebOrderD1(env, order.id);
        if (!result.ok) return paymeRpcError(id, PAYME_ERR.CANT_DO_OPERATION, "Amalni bajarib bo'lmaydi");
        // perform_time — finalize ichida stamplangan HAQIQIY qiymatni qayta
        // o'qib qaytaramiz (Date.now() bilan yangi vaqt olish EMAS) — aks
        // holda ikkalasi orasida millisekundlik farq bo'lib qolishi mumkin
        // edi, va bu qiymat keyingi CheckTransaction/duplicate
        // PerformTransaction qaytaradigan perform_time bilan mos kelmay
        // qolardi.
        const finalized = await getWebOrderD1(env, order.id);
        return paymeRpcResult(id, { transaction: String(order.id), perform_time: new Date(finalized.performTime).getTime(), state: 2 });
      }

      case 'CancelTransaction': {
        const order = await getWebOrderByPaymeIdD1(env, params.id);
        if (!order) return paymeRpcError(id, PAYME_ERR.TRANSACTION_NOT_FOUND, 'Tranzaksiya topilmadi');
        const wasPaid = order.status === 'paid';
        // Legacy bilan bir xil: agar allaqachon 'paid' bo'lsa, avtomatik
        // "orqaga qaytarish" qilinmaydi (egalik allaqachon berilgan
        // bo'lishi mumkin) — admin qo'lda ko'rib chiqadi. Aks holda
        // (pending yoki allaqachon cancelled/failed_*) 'cancelled'ga
        // o'rnatiladi — bu idempotent (qayta chaqirilsa ham xavfsiz).
        if (!wasPaid) await setWebOrderStatusD1(env, order.id, 'cancelled');
        // Payme requests carry `params.reason` (1-5 — developer.help.
        // paycom.uz's documented codes: 1 recipient not found, 2 debit
        // error, 3 execution error, 4 timeout, 5 refund) stating WHY it's
        // cancelling — persisted so CheckTransaction/GetStatement can
        // echo the REAL reason back later instead of always returning
        // null. cancel_time is stamped for real here too (once, via
        // COALESCE) — even on the wasPaid/refund-review branch, so a
        // repeat CheckTransaction never sees a different value.
        const reasonFromPayme = Number.isInteger(params?.reason) ? params.reason : null;
        const stamped = await stampWebOrderCancelD1(env, order.id, reasonFromPayme);
        return paymeRpcResult(id, { transaction: String(stamped.id), cancel_time: new Date(stamped.cancelTime).getTime(), state: wasPaid ? -2 : -1 });
      }

      case 'CheckTransaction': {
        const order = await getWebOrderByPaymeIdD1(env, params.id);
        if (!order) return paymeRpcError(id, PAYME_ERR.TRANSACTION_NOT_FOUND, 'Tranzaksiya topilmadi');
        return paymeRpcResult(id, {
          create_time: paymeCreateTimeMs(order),
          // Real, stable, persisted timestamps (set once — see
          // setWebOrderStatusD1/stampWebOrderCancelD1) — never
          // recomputed live, so this answers identically every time
          // Payme asks, as its reconciliation expects.
          perform_time: order.performTime ? new Date(order.performTime).getTime() : 0,
          cancel_time: order.cancelTime ? new Date(order.cancelTime).getTime() : 0,
          transaction: String(order.id),
          state: paymeOrderState(order),
          reason: order.cancelReason ?? null,
        });
      }

      case 'GetStatement': {
        // params.from/params.to — millisecond unix timestamps bounding
        // the requested date range (Payme's documented GetStatement
        // contract). Only transactions Payme actually created
        // (payme_transaction_id set) are ever reported.
        const fromIso = new Date(Number(params?.from) || 0).toISOString();
        const toIso = new Date(Number(params?.to) || Date.now()).toISOString();
        const rows = await env.DB.prepare(
          `SELECT ${WEB_ORDER_SELECT} FROM web_orders WHERE payme_transaction_id IS NOT NULL AND created_at BETWEEN ? AND ? ORDER BY created_at`
        ).bind(fromIso, toIso).all();
        const transactions = (rows.results || []).map((r) => {
          const o = parseWebOrderRow(r);
          return {
            id: o.paymeTransactionId,
            time: new Date(o.createdAt).getTime(),
            amount: Math.round(Number(o.price) * 100),
            account: { order_id: String(o.id) },
            create_time: paymeCreateTimeMs(o),
            perform_time: o.performTime ? new Date(o.performTime).getTime() : 0,
            cancel_time: o.cancelTime ? new Date(o.cancelTime).getTime() : 0,
            transaction: String(o.id),
            state: paymeOrderState(o),
            reason: o.cancelReason ?? null,
          };
        });
        return paymeRpcResult(id, { transactions });
      }

      default:
        return paymeRpcError(id, -32601, 'Metod topilmadi');
    }
  } catch (err) {
    return paymeRpcError(id, PAYME_ERR.SYSTEM, 'Tizim xatoligi');
  }
}

// Node'dagi test (scripts/payme-order-flow-test.mjs) uchun nomlangan
// export — Workers runtime faqat `export default { fetch }`ni ishlatadi.
export {
  createWebOrderD1, createPendingWebOrderD1, getWebOrderD1, getWebOrderByPaymeIdD1, setWebOrderPaymeIdD1,
  setWebOrderStatusD1, activeWebOrderByCodeD1, createRecordD1, attachCardToUserD1,
  finalizePaidWebOrderD1, handlePaymeRequestD1, verifyPaymeAuthD1, paymentsEnabledD1,
  paymeCheckoutLinkD1, getRecord, getRecordOwner, PAYME_ERR, ensureCoreSchema,
};

// production-drift integration: exposed for scripts/production-worker-parity-test.mjs.
export {
  uploadApi, serveUpload, putUploadR2, parseUploadRange, followApi, publicContentApi, hashPassword,
};

// nfcstore.uz'dagi mavjud sahifa yo'llari bilan to'qnashmasligi uchun —
// server/index.js'dagi RESERVED_CODES bilan bir xil.
const RESERVED_CODES = new Set([
  'LOGIN', 'REGISTER', 'ACCOUNT', 'API', 'ADMIN', 'STATIC', 'UPLOADS', 'AUKSION', 'XABARLAR', 'TOLOVLAR',
]);

function validateRecordBody(body) {
  const name = cleanStr(body.name, 80);
  if (!name) return { error: "Ism bo'sh bo'lishi mumkin emas." };
  const hashtags = Array.isArray(body.hashtags)
    ? body.hashtags.map((h) => cleanStr(h, 30).replace(/^#/, '')).filter(Boolean).slice(0, 20) : [];
  const extraLinks = Array.isArray(body.extraLinks)
    ? body.extraLinks.map((l) => ({ label: cleanStr(l && l.label, 40), url: recSafeUrl(l && l.url) })).filter((l) => l.url).slice(0, 20) : [];
  const cardNumbers = Array.isArray(body.cardNumbers)
    ? body.cardNumbers.map((c) => ({ label: cleanStr(c && c.label, 30), number: cleanStr(c && c.number, 34).replace(/\s+/g, ' ') })).filter((c) => c.number).slice(0, 10) : [];
  const theme = THEME_WHITELIST.includes(body.theme) ? body.theme : 'classic';
  const linkStyle = ['standard', 'transparent', 'glass'].includes(body.linkStyle) ? body.linkStyle : 'standard';
  const record = {
    name, role: cleanStr(body.role, 100), avatarUrl: uploadOrSafeUrl(body.avatarUrl), bgUrl: uploadOrSafeUrl(body.bgUrl),
    bgPattern: body.bgPattern !== false, accentColor: /^#[0-9a-fA-F]{6}$/.test(String(body.accentColor || '').trim()) ? body.accentColor.trim() : '',
    bgColor: /^#[0-9a-fA-F]{6}$/.test(String(body.bgColor || '').trim()) ? body.bgColor.trim() : '', bgAnimated: body.bgAnimated !== false,
    linksTransparent: linkStyle === 'glass' || body.linksTransparent === true, linkStyle,
    musicUrl: uploadOrSafeUrl(body.musicUrl), tg: cleanStr(body.tg, 40).replace(/^@/, ''), phone: cleanStr(body.phone, 24),
    email: cleanStr(body.email, 120), linkedin: cleanStr(body.linkedin, 200), instagram: cleanStr(body.instagram, 40).replace(/^@/, ''),
    about: cleanStr(body.about, 600), facebook: cleanStr(body.facebook, 60).replace(/^@/, ''), twitter: cleanStr(body.twitter, 60).replace(/^@/, ''),
    website: recSafeUrl(body.website), cardNumber: cleanStr(body.cardNumber, 34).replace(/\s+/g, ' '), extraLinks, cardNumbers, theme, hashtags,
    hidePhone: body.hidePhone === true,
  };
  if ('cardDesign' in body) record.cardDesign = body.cardDesign && typeof body.cardDesign === 'object' ? body.cardDesign : null;
  if ('profileType' in body) record.profileType = ['personal', 'expert', 'business'].includes(body.profileType) ? body.profileType : 'personal';
  if ('city' in body) record.city = cleanStr(body.city, 60);
  if ('categorySlug' in body) record.categorySlug = String(body.categorySlug || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 60);
  if ('address' in body) record.address = cleanStr(body.address, 200);
  const geoNum = (v, lo, hi) => { const n = Number(v); return Number.isFinite(n) && n >= lo && n <= hi ? n : null; };
  if ('latitude' in body) record.latitude = geoNum(body.latitude, -90, 90);
  if ('longitude' in body) record.longitude = geoNum(body.longitude, -180, 180);
  if ('hiddenFromDirectory' in body) record.hiddenFromDirectory = body.hiddenFromDirectory === true;
  if ('leadCapture' in body) record.leadCapture = body.leadCapture === true;
  return { record };
}

async function updateRecord(env, code, fields) {
  const map = {
    name: 'name', role: 'role', avatarUrl: 'avatar_url', bgUrl: 'bg_url', bgPattern: 'bg_pattern',
    accentColor: 'accent_color', bgColor: 'bg_color', bgAnimated: 'bg_animated', linksTransparent: 'links_transparent',
    linkStyle: 'link_style', profileType: 'profile_type', city: 'city', categorySlug: 'category_slug', address: 'address',
    latitude: 'latitude', longitude: 'longitude', hiddenFromDirectory: 'hidden_from_directory', leadCapture: 'lead_capture',
    musicUrl: 'music_url', tg: 'tg', phone: 'phone', email: 'email', linkedin: 'linkedin', instagram: 'instagram',
    about: 'about', facebook: 'facebook', twitter: 'twitter', website: 'website', cardNumber: 'card_number',
    theme: 'theme', hidePhone: 'hide_phone',
  };
  const sets = [];
  const vals = [];
  for (const [key, col] of Object.entries(map)) {
    if (key in fields) {
      let v = fields[key];
      if (typeof v === 'boolean') v = v ? 1 : 0;
      sets.push(`${col} = ?`);
      vals.push(v);
    }
  }
  if ('hashtags' in fields) { sets.push('hashtags = ?'); vals.push(JSON.stringify(fields.hashtags)); }
  if ('extraLinks' in fields) { sets.push('extra_links = ?'); vals.push(JSON.stringify(fields.extraLinks)); }
  if ('cardNumbers' in fields) { sets.push('card_numbers = ?'); vals.push(JSON.stringify(fields.cardNumbers)); }
  if ('cardDesign' in fields) { sets.push('card_design = ?'); vals.push(fields.cardDesign ? JSON.stringify(fields.cardDesign) : null); }
  if (!sets.length) return getRecord(env, code);
  vals.push(code);
  await env.DB.prepare(`UPDATE cards SET ${sets.join(', ')} WHERE code = ?`).bind(...vals).run();
  return getRecord(env, code);
}
// ---------- auth ----------

async function authApi(request, env, url) {
  const path = url.pathname;
  const secure = isSecure(url);

  if (path === '/api/auth/login' && request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const email = cleanStr(body.email, 120).toLowerCase();
    const password = typeof body.password === 'string' ? body.password : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return json({ error: "Email formati noto'g'ri." }, 422);
    if (password.length < 6) return json({ error: "Parol kamida 6 belgidan iborat bo'lishi kerak." }, 422);
    const row = await env.DB.prepare(
      `SELECT id, email, password_hash, deleted_at, suspended_until, suspend_reason FROM users WHERE email = ?`
    ).bind(email).first();
    if (!row || !(await verifyPassword(password, row.password_hash))) return json({ error: 'bad_credentials' }, 401);
    if (row.deleted_at) return json({ error: 'account_deleted' }, 403);
    if (row.suspended_until && parseDbDate(row.suspended_until) > new Date()) {
      return json({ error: 'account_suspended', suspendedUntil: row.suspended_until, reason: row.suspend_reason }, 403);
    }
    const token = newToken();
    await env.DB.prepare(`INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)`)
      .bind(token, row.id, new Date(Date.now() + SESSION_TTL_S * 1000).toISOString().replace('T', ' ').replace('Z', '+00')).run();
    return jsonWithCookie({ user: { id: row.id, email: row.email } }, 200, sessionCookieHeader(token, secure));
  }

  if (path === '/api/auth/logout' && request.method === 'POST') {
    const token = parseCookies(request)[SESSION_COOKIE];
    if (token) await env.DB.prepare(`DELETE FROM sessions WHERE token = ?`).bind(token).run();
    return jsonWithCookie({ ok: true }, 200, clearedSessionCookieHeader(secure));
  }

  if (path === '/api/auth/me' && request.method === 'GET') {
    const user = await getCurrentUser(request, env);
    if (!user) return json({ user: null, cards: [] });
    const rows = await env.DB.prepare(`SELECT ${RECORD_COLUMNS} FROM cards WHERE user_id = ? ORDER BY is_primary DESC, ts DESC`)
      .bind(user.id).all();
    return json({ user, cards: (rows.results || []).map(rowToRecord) });
  }

  // Registration needs the Telegram bot (phone verification via bot webhook,
  // not yet ported — see task list) — fall through to the generic proxy
  // below for now, which will correctly report the service as unavailable
  // rather than silently accepting an unverified phone number.
  return null;
}

// ---------- records (NFC profile cards) ----------

async function recordsApi(request, env, url) {
  const path = url.pathname;

  if (path === '/api/records' && request.method === 'GET') {
    const rows = await env.DB.prepare(`SELECT ${RECORD_COLUMNS} FROM cards WHERE hidden_from_directory = 0 ORDER BY ts DESC LIMIT 500`).all();
    return json((rows.results || []).map(rowToRecord).map(catalogCard));
  }

  if (path === '/api/records/search' && request.method === 'GET') {
    const q = String(url.searchParams.get('q') || '').trim().slice(0, 120);
    if (q.length < 2) return json({ records: [] });
    const like = `%${q.toLowerCase()}%`;
    const rows = await env.DB.prepare(
      `SELECT c.code, c.name, c.role, c.avatar_url, c.tg, c.hashtags, c.theme, c.price, c.ts, c.views,
              c.profile_type, c.city, c.category_slug, c.verified, c.tier_override
       FROM cards c LEFT JOIN users u ON u.id = c.user_id
       WHERE c.hidden_from_directory = 0 AND (
         LOWER(c.code) LIKE ? OR LOWER(c.name) LIKE ? OR LOWER(COALESCE(c.role,'')) LIKE ? OR
         LOWER(COALESCE(c.city,'')) LIKE ? OR LOWER(COALESCE(c.email,'')) LIKE ? OR
         LOWER(COALESCE(c.phone,'')) LIKE ? OR LOWER(COALESCE(c.tg,'')) LIKE ? OR
         LOWER(c.hashtags) LIKE ? OR LOWER(COALESCE(u.email,'')) LIKE ? OR LOWER(COALESCE(u.phone,'')) LIKE ?
       ) ORDER BY c.ts DESC LIMIT 60`
    ).bind(like, like, like, like, like, like, like, like, like, like).all();
    const records = (rows.results || []).map((r) => catalogCard({
      code: r.code, name: r.name, role: r.role || '', avatarUrl: r.avatar_url || '', tg: r.tg || '',
      hashtags: parseJsonArray(r.hashtags), theme: r.theme, price: Number(r.price), ts: Number(r.ts), views: Number(r.views),
      profileType: r.profile_type, city: r.city || '', categorySlug: r.category_slug || '', verified: !!r.verified,
      tierOverride: r.tier_override || '',
    }));
    return json({ records });
  }

  const codeMatch = path.match(/^\/api\/records\/([A-Za-z0-9]+)$/);
  if (codeMatch) {
    const code = codeMatch[1].toUpperCase();
    if (!validCode(code)) return json({ error: 'bad_code' }, 400);

    if (request.method === 'GET') {
      const rec = await getRecord(env, code);
      if (!rec) return json({ error: 'not_found' }, 404);
      const user = await getCurrentUser(request, env);
      const owner = await getRecordOwner(env, code);
      const isOwner = !!user && String(owner) === String(user.id);
      if (rec.hidePhone && !isOwner) rec.phone = '';
      rec.cardNumber = '';
      rec.cardNumbers = [];
      return json(rec);
    }

    if (request.method === 'PUT') {
      const user = await getCurrentUser(request, env);
      if (!user) return json({ error: 'unauthorized' }, 401);
      const owner = await getRecordOwner(env, code);
      if (!owner) return json({ error: 'not_found' }, 404);
      if (String(owner) !== String(user.id)) return json({ error: 'forbidden' }, 403);
      const body = await request.json().catch(() => ({}));
      const { record, error } = validateRecordBody(body);
      if (error) return json({ error }, 422);
      // NOTE: tier/feature-gating (e.g. music/animated background require a
      // paid tier) from src/lib/access.js is NOT enforced here yet — the
      // owner can update any field on their own card. Re-add that guard
      // before re-enabling paid tiers (tracked as follow-up work).
      const updated = await updateRecord(env, code, record);
      if (!updated) return json({ error: 'not_found' }, 404);
      return json(updated);
    }

    if (request.method === 'POST') {
      // Shaxsiy NFC ID sotib olish (Payme Phase 2B) — server/index.js'dagi
      // POST /api/records/:code bilan bir xil kontrakt (endpoint, javob
      // shakllari), shu bilan frontend (ReserveModal.jsx) o'zgarishsiz
      // ishlaydi.
      const user = await getCurrentUser(request, env);
      if (!user) return json({ error: 'unauthorized' }, 401);
      if (RESERVED_CODES.has(code)) return json({ error: 'reserved' }, 400);

      const body = await request.json().catch(() => ({}));
      const { record, error } = validateRecordBody(body);
      if (error) return json({ error }, 422);

      // Jismoniy karta qo'shimchasi hali D1'da portlanmagan
      // (createPhysicalCard yo'q) — pul olib, keyin jismoniy kartani
      // yetkazib bera olmaydigan holatga yo'l qo'ymaslik uchun bu
      // so'rov ATAYLAB rad etiladi (task: "hozir port qilinmasin").
      if (body?.physicalCard === true) return json({ error: 'physical_card_not_supported_yet' }, 501);

      // Narxni SERVER o'zi hisoblaydi (Phase 2A'dagi YAGONA xavfsiz
      // helper orqali) — clientdan kelgan narxga ISHONILMAYDI. 8 xonali
      // avtomatik-bepul ID va ekslyuziv daraja bu yerda ALLAQACHON
      // "purchasable:false" bo'lib qaytadi — hech qachon 0 so'mlik order
      // yaratilmaydi.
      const quote = personalPurchaseQuote(code);
      if (!quote.purchasable) return json({ error: quote.reason || 'not_purchasable' }, 409);

      if (await getRecord(env, code)) return json({ error: 'already_taken' }, 409);

      // Band qilish oqimi to'lov tizimi tayyor bo'lmaguncha butunlay
      // yopiq — legacy server/index.js bilan bir xil xulq.
      if (!paymentsEnabledD1(env)) return json({ error: 'payments_disabled' }, 503);

      // Bir xil kod uchun faqat bitta pending order — avval aniq xato
      // xabari uchun oddiy tekshiruv (tezroq, ko'pincha yetarli), lekin
      // haqiqiy kafolat pastdagi ATOMIK `createPendingWebOrderD1` orqali
      // (INSERT ... SELECT ... WHERE NOT EXISTS — pre-commit review
      // Fix 1: schema-darajasidagi UNIQUE index emas, chunki u mavjud
      // tozalanmagan ma'lumotga tegib butun API'ni yiqitishi mumkin edi).
      const existingOrder = await activeWebOrderByCodeD1(env, code);
      if (existingOrder) return json({ error: 'reserved_pending_payment' }, 409);

      const order = await createPendingWebOrderD1(env, { userId: user.id, code, price: quote.amount, payload: record });
      if (!order) {
        // Atomik INSERT hech narsa qaytarmadi — parallel so'rov g'olib
        // chiqqan (yuqoridagi oddiy tekshiruv bilan bir vaqtga to'g'ri
        // kelgan tor race). Foydalanuvchiga toza, kutilgan xato.
        return json({ error: 'reserved_pending_payment' }, 409);
      }
      const payLink = paymeCheckoutLinkD1(env, order.id, quote.amount);
      return json({ pending: true, orderId: order.id, code, price: quote.amount, payLink }, 202);
    }

    return null;
  }

  return null;
}

// ---------- web orders (Payme Phase 2B — order status polling) ----------
// server/index.js'dagi GET /api/orders/:id va GET /api/orders bilan bir
// xil kontrakt — frontend (ReserveModal.jsx dbGetOrder, AccountPage.jsx)
// o'zgarishsiz shu javob shaklini kutadi.
async function ordersApi(request, env, url) {
  const path = url.pathname;

  const idMatch = path.match(/^\/api\/orders\/(\d+)$/);
  if (idMatch && request.method === 'GET') {
    const user = await getCurrentUser(request, env);
    if (!user) return json({ error: 'unauthorized' }, 401);
    const order = await getWebOrderD1(env, Number(idMatch[1]));
    // Boshqa foydalanuvchining buyurtmasi bo'lsa ham 404 (mavjudligini
    // oshkor qilmaslik uchun) — legacy bilan bir xil.
    if (!order || String(order.userId) !== String(user.id)) return json({ error: 'not_found' }, 404);
    return json({ id: order.id, code: order.code, status: order.status, price: order.price });
  }

  if (path === '/api/orders' && request.method === 'GET') {
    const user = await getCurrentUser(request, env);
    if (!user) return json({ orders: [] });
    const rows = await env.DB.prepare(
      `SELECT id, code, kind, price, status, created_at AS createdAt FROM web_orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 20`
    ).bind(user.id).all();
    return json({ orders: (rows.results || []).map((r) => ({ ...r, price: Number(r.price) })) });
  }

  return null;
}

// ---------- R2 file uploads (production manual-only drift — ported from the
// live Cloudflare dashboard "Edit Code" source of nfcstore-api, version
// d185949b; there is no git history for this — the legacy Postgres/Express
// backend (server/index.js + server/paths.js) stored uploads on local disk
// / a Railway Volume, never on R2). Contract, size limits, key scheme,
// caching and range/ETag behavior below are kept byte-for-byte identical to
// that production source so existing /uploads/* URLs (avatars, card audio,
// card video, PDFs, news images) keep working unchanged. ----------

const UPLOAD_CACHE_CONTROL = 'public, max-age=31536000, immutable';
const UPLOAD_IMAGE_RE = /^data:(image\/(png|jpeg|jpg|webp|gif));base64,([A-Za-z0-9+/=]+)$/;
const UPLOAD_AUDIO_RE = /^data:(audio\/(mpeg|mp3|mp4|ogg|wav|webm|x-m4a|m4a));base64,([A-Za-z0-9+/=]+)$/;

function uploadRandomHex(byteLen = 10) {
  const bytes = new Uint8Array(byteLen);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function uploadBase64ToBytes(b64) {
  try {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

// Content-Type fallback when an R2 object's stored httpMetadata doesn't
// have one (defensive only — every object written by putUploadR2 below
// always sets contentType at write time).
function uploadContentTypeFromExt(key) {
  const ext = key.split('.').pop()?.toLowerCase();
  return {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp',
    mp3: 'audio/mpeg', m4a: 'audio/mp4', ogg: 'audio/ogg', wav: 'audio/wav',
    mp4: 'video/mp4', webm: 'video/webm', pdf: 'application/pdf',
  }[ext] || 'application/octet-stream';
}

async function putUploadR2(env, filename, bytes, contentType, actor = '') {
  if (!env.UPLOADS) throw new Error('r2_unavailable');
  await env.UPLOADS.put(`uploads/${filename}`, bytes, {
    httpMetadata: { contentType, cacheControl: UPLOAD_CACHE_CONTROL },
    customMetadata: { uploadedAt: new Date().toISOString(), actor: String(actor || '').slice(0, 120) },
  });
  return `/uploads/${filename}`;
}

// POST /api/upload, /api/upload-audio, /api/upload-card-video, /api/admin/upload
async function uploadApi(request, env, pathname) {
  const isAdmin = pathname === '/api/admin/upload';
  const auth = isAdmin ? await requireAdmin(request, env) : await getCurrentUser(request, env);
  if (!auth) return json({ error: 'unauthorized' }, 401);
  const actor = isAdmin ? `admin:${auth.role || 'admin'}` : `user:${auth.id || auth.email || 'authenticated'}`;

  if (pathname === '/api/upload-card-video') {
    const bytes = new Uint8Array(await request.arrayBuffer());
    if (!bytes.length) return json({ error: 'bad_file' }, 422);
    if (bytes.length > 10 * 1024 * 1024) return json({ error: 'too_large' }, 413);
    const looksMp4 = String.fromCharCode(...bytes.slice(0, 40)).includes('ftyp');
    const looksWebm = bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
    if (!looksMp4 && !looksWebm) return json({ error: 'bad_file' }, 422);
    const filename = `cardvid_${uploadRandomHex(12)}.${looksWebm ? 'webm' : 'mp4'}`;
    return json({ url: await putUploadR2(env, filename, bytes, looksWebm ? 'video/webm' : 'video/mp4', actor) });
  }

  const body = await request.json().catch(() => ({}));
  const isAudio = pathname === '/api/upload-audio';
  const match = (isAudio ? UPLOAD_AUDIO_RE : UPLOAD_IMAGE_RE).exec(String(body.dataUrl || ''));
  if (!match) return json({ error: isAudio ? 'bad_audio' : 'bad_image' }, 422);
  const bytes = uploadBase64ToBytes(match[3]);
  if (!bytes?.length) return json({ error: isAudio ? 'bad_audio' : 'bad_image' }, 422);
  const imageLimit = match[2] === 'gif' ? 3 * 1024 * 1024 : 700 * 1024;
  const limit = (isAdmin || isAudio) ? 10 * 1024 * 1024 : imageLimit;
  if (bytes.length > limit) return json({ error: 'too_large' }, 413);
  const ext = isAudio
    ? ({ mpeg: 'mp3', mp3: 'mp3', mp4: 'm4a', 'x-m4a': 'm4a', m4a: 'm4a', ogg: 'ogg', wav: 'wav', webm: 'webm' })[match[2]]
    : (['jpeg', 'jpg'].includes(match[2]) ? 'jpg' : match[2]);
  const filename = `${isAdmin ? 'news_' : ''}${uploadRandomHex(10)}.${ext}`;
  return json({ url: await putUploadR2(env, filename, bytes, match[1], actor) });
}

function buildUploadResponseHeaders(r2object, key) {
  const headers = new Headers();
  r2object.writeHttpMetadata?.(headers);
  if (!headers.get('content-type')) headers.set('content-type', uploadContentTypeFromExt(key));
  if (!headers.get('cache-control')) headers.set('cache-control', UPLOAD_CACHE_CONTROL);
  headers.set('accept-ranges', 'bytes');
  if (r2object.httpEtag) headers.set('etag', r2object.httpEtag);
  return headers;
}

// Parses a `Range: bytes=a-b` or suffix `bytes=-N` header against a known
// object size. Returns null when the header is absent/unparseable/out of
// bounds (caller falls back to a normal 200, matching production).
function parseUploadRange(rangeHeader, size) {
  const m = /^bytes=(\d*)-(\d*)$/.exec(String(rangeHeader || '').trim());
  if (!m) return null;
  let offset; let end;
  if (m[1]) {
    offset = Number(m[1]);
    end = m[2] ? Number(m[2]) : size - 1;
  } else {
    const suffixLen = Number(m[2]);
    if (!(suffixLen > 0)) return null;
    offset = Math.max(0, size - suffixLen);
    end = size - 1;
  }
  if (!Number.isInteger(offset) || !Number.isInteger(end) || offset < 0 || offset >= size || end < offset) return null;
  return { offset, length: Math.min(end, size - 1) - offset + 1 };
}

// GET/HEAD /uploads/* — R2 read, with HEAD, If-None-Match/304, Range/206,
// invalid-range/416 and path-traversal protection, matching production.
async function serveUpload(request, env, url) {
  if (!env.UPLOADS) return null;
  const key = decodeURIComponent(url.pathname).replace(/^\//, '');
  if (!key.startsWith('uploads/') || key.includes('..')) return json({ error: 'bad_path' }, 400);
  const head = await env.UPLOADS.head(key);
  if (!head) return null;
  const headers = buildUploadResponseHeaders(head, key);
  if (request.headers.get('if-none-match') === head.httpEtag) {
    return new Response(null, { status: 304, headers });
  }
  if (request.method === 'HEAD') {
    headers.set('content-length', String(head.size));
    return new Response(null, { status: 200, headers });
  }
  const rangeHeader = request.headers.get('range');
  if (rangeHeader) {
    const range = parseUploadRange(rangeHeader, head.size);
    if (!range) {
      headers.set('content-range', `bytes */${head.size}`);
      return new Response(null, { status: 416, headers });
    }
    const obj = await env.UPLOADS.get(key, { range });
    if (!obj) return null;
    const rangeEnd = range.offset + range.length - 1;
    headers.set('content-range', `bytes ${range.offset}-${rangeEnd}/${head.size}`);
    headers.set('content-length', String(range.length));
    return new Response(obj.body, { status: 206, headers });
  }
  const obj = await env.UPLOADS.get(key);
  if (!obj) return null;
  headers.set('content-length', String(head.size));
  return new Response(obj.body, { status: 200, headers });
}

// ---------- auctions (public) ----------

const AUCTION_DEMAND_THRESHOLD = 20;

function auctionRow(r) {
  return {
    id: r.id, code: r.code, sellerId: r.seller_id, startPrice: Number(r.start_price),
    buyNowPrice: r.buy_now_price == null ? null : Number(r.buy_now_price), currentPrice: Number(r.current_price),
    highestBidderId: r.highest_bidder_id, endsAt: r.ends_at, status: r.status,
    paymentDeadline: r.payment_deadline, sellerPayoutAmount: r.seller_payout_amount == null ? null : Number(r.seller_payout_amount),
    sellerPayoutStatus: r.seller_payout_status, sellerPaymeNumber: r.seller_payme_number,
    minIncrement: Number(r.min_increment), createdAt: r.created_at,
  };
}

function demandRow(r) {
  return {
    id: r.id, code: r.code, status: r.status, suggestedStartPrice: Number(r.suggested_start_price),
    suggestedMinStep: Number(r.suggested_min_step), interestCount: Number(r.interest_count),
    auctionId: r.auction_id, createdAt: r.created_at, threshold: AUCTION_DEMAND_THRESHOLD,
  };
}

async function auctionsPublicApi(request, env, url) {
  const path = url.pathname;

  if (path === '/api/auctions' && request.method === 'GET') {
    const active = await env.DB.prepare(`SELECT * FROM auctions WHERE status = 'active' ORDER BY ends_at ASC LIMIT 200`).all();
    const auctions = (active.results || []).map(auctionRow);
    if (url.searchParams.get('withSold') === '1') {
      const sold = await env.DB.prepare(`SELECT * FROM auctions WHERE status = 'sold' ORDER BY ends_at DESC LIMIT 40`).all();
      return json({ auctions, sold: (sold.results || []).map(auctionRow) });
    }
    return json({ auctions });
  }

  if (path === '/api/auction-demand' && request.method === 'GET') {
    const user = await getCurrentUser(request, env);
    const rows = await env.DB.prepare(
      `SELECT d.*, a.current_price AS a_current_price, a.ends_at AS a_ends_at, a.status AS a_status
         ${user ? ', EXISTS(SELECT 1 FROM auction_demand_votes v WHERE v.demand_id = d.id AND v.user_id = ?) AS voted' : ", 0 AS voted"}
       FROM auction_demand d LEFT JOIN auctions a ON a.id = d.auction_id
       WHERE d.status <> 'hidden'
       ORDER BY CASE d.status WHEN 'ready' THEN 0 WHEN 'collecting' THEN 1 WHEN 'auction_live' THEN 2 ELSE 3 END,
                d.interest_count DESC, d.created_at DESC LIMIT 300`
    ).bind(...(user ? [user.id] : [])).all();
    const demand = (rows.results || []).map((r) => ({
      ...demandRow(r), voted: !!r.voted,
      auctionCurrentPrice: r.a_current_price != null ? Number(r.a_current_price) : null,
      auctionEndsAt: r.a_ends_at || null, auctionStatus: r.a_status || null,
    }));
    return json({ demand, threshold: AUCTION_DEMAND_THRESHOLD });
  }

  const voteMatch = path.match(/^\/api\/auction-demand\/(\d+)\/vote$/);
  if (voteMatch && request.method === 'POST') {
    const user = await getCurrentUser(request, env);
    if (!user) return json({ error: 'unauthorized' }, 401);
    const demandId = Number(voteMatch[1]);
    const d = await env.DB.prepare(`SELECT id, code, status, interest_count FROM auction_demand WHERE id = ?`).bind(demandId).first();
    if (!d) return json({ error: 'not_found' }, 404);
    if (d.status !== 'collecting' && d.status !== 'ready') return json({ error: 'closed' }, 409);
    const ins = await env.DB.prepare(`INSERT OR IGNORE INTO auction_demand_votes (demand_id, user_id, created_at) VALUES (?, ?, ?)`)
      .bind(demandId, user.id, nowTs()).run();
    if (!ins.meta.changes) {
      return json({ ok: true, alreadyVoted: true, interestCount: Number(d.interest_count), status: d.status, code: d.code });
    }
    const updated = await env.DB.prepare(`UPDATE auction_demand SET interest_count = interest_count + 1 WHERE id = ? RETURNING code, status, interest_count`).bind(demandId).first();
    let status = updated.status;
    let becameReady = false;
    if (updated.status === 'collecting' && Number(updated.interest_count) >= AUCTION_DEMAND_THRESHOLD) {
      const claim = await env.DB.prepare(
        `UPDATE auction_demand SET status = 'ready', notified_ready_at = COALESCE(notified_ready_at, ?) WHERE id = ? AND status = 'collecting' RETURNING id`
      ).bind(nowTs(), demandId).first();
      if (claim) { status = 'ready'; becameReady = true; }
    }
    return json({ ok: true, voted: true, code: updated.code, status, interestCount: Number(updated.interest_count), becameReady });
  }

  if (path === '/api/auction-requests' && request.method === 'POST') {
    const user = await getCurrentUser(request, env);
    if (!user) return json({ error: 'unauthorized' }, 401);
    const body = await request.json().catch(() => ({}));
    const code = String(body.code || '').toUpperCase().trim();
    const note = cleanStr(body.note, 300);
    if (!/^[A-Z0-9]{3,16}$/.test(code) || isBlockedCode(code)) return json({ error: 'bad_code' }, 422);
    if (await env.DB.prepare(`SELECT 1 FROM cards WHERE code = ?`).bind(code).first()) return json({ error: 'code_taken' }, 409);
    const existing = await env.DB.prepare(`SELECT id FROM auction_requests WHERE user_id = ? AND code = ? AND status = 'pending'`).bind(user.id, code).first();
    if (existing) return json({ error: 'ALREADY_PENDING' }, 409);
    const row = await env.DB.prepare(`INSERT INTO auction_requests (user_id, code, note, created_at) VALUES (?, ?, ?, ?) RETURNING id`)
      .bind(user.id, code, note || null, nowTs()).first();
    return json({ ok: true, id: row.id }, 201);
  }

  const auctionIdMatch = path.match(/^\/api\/auctions\/(\d+)$/);
  if (auctionIdMatch && request.method === 'GET') {
    const id = Number(auctionIdMatch[1]);
    const a = await env.DB.prepare(`SELECT * FROM auctions WHERE id = ?`).bind(id).first();
    if (!a) return json({ error: 'not_found' }, 404);
    const bids = await env.DB.prepare(
      `SELECT b.id, b.auction_id, b.user_id, b.amount, b.released, b.created_at,
              (SELECT c.code FROM cards c WHERE c.user_id = b.user_id ORDER BY c.is_primary DESC, c.ts ASC LIMIT 1) AS bidder_code
       FROM bids b WHERE b.auction_id = ? ORDER BY b.amount DESC, b.created_at ASC`
    ).bind(id).all();
    return json({
      auction: auctionRow(a),
      bids: (bids.results || []).map((b) => ({
        id: b.id, auctionId: b.auction_id, userId: b.user_id, amount: Number(b.amount),
        released: !!b.released, createdAt: b.created_at, bidderCode: b.bidder_code || null,
      })),
    });
  }

  // Bidding and winner payment require the payment system, which is
  // disabled in production (PAYMENTS_ENABLED=false) independently of this
  // migration — matches server/index.js's existing behavior exactly.
  if ((path.match(/^\/api\/auctions\/\d+\/bid$/) && request.method === 'POST')
    || (path.match(/^\/api\/auctions\/\d+\/pay$/) && request.method === 'POST')) {
    return json({ error: 'payments_disabled' }, 503);
  }

  return null;
}
// ---------- admin: shared helpers ----------

async function logAdminLoginEvent(env, event, ip, userAgent) {
  await env.DB.prepare(`INSERT INTO admin_login_history (event, ip, user_agent, created_at) VALUES (?, ?, ?, ?)`)
    .bind(event, ip || null, userAgent || null, nowTs()).run().catch(() => {});
}
async function logAdminActivity(env, { action, details, oldValue, newValue, ip }) {
  await env.DB.prepare(`INSERT INTO admin_activity_log (action, details, old_value, new_value, ip, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .bind(action, details || null, oldValue != null ? String(oldValue) : null, newValue != null ? String(newValue) : null, ip || null, nowTs())
    .run().catch(() => {});
}
function reqIp(request) {
  return request.headers.get('cf-connecting-ip') || '';
}

// Basic IP-window rate limiting for the admin login endpoint. Workers
// instances are not long-lived like the old Express process, so this
// in-memory Map only limits bursts within a single warm isolate — the D1
// admin_login_history table (bad_password/rate_limited rows) is the
// durable record an operator can audit.
const loginHits = new Map();
function loginRateLimited(ip) {
  const now = Date.now();
  const windowMs = 30 * 60_000;
  const arr = (loginHits.get(ip) || []).filter((t) => now - t < windowMs);
  if (arr.length >= 3) return true;
  arr.push(now);
  loginHits.set(ip, arr);
  return false;
}

// Telegram OTP as an OPT-IN alternative to TOTP during the 2FA step (NOT
// automatic, NOT IP/location-based — only ever sent when the admin
// explicitly clicks "Telegram orqali kod olish" on the 2FA screen; see
// POST /api/admin/2fa/telegram/send below). TOTP stays the primary/
// default method — this never disables or replaces it.
async function sendTelegramMessage(env, text) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.ADMIN_CHAT_ID) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: env.ADMIN_CHAT_ID, text, parse_mode: 'HTML' }),
    });
    const data = await res.json().catch(() => null);
    return !!data?.ok;
  } catch {
    return false;
  }
}
const TELEGRAM_OTP_MAX_ATTEMPTS = 5;

// ---------- admin: auth ----------

async function adminAuthApi(request, env, url) {
  const path = url.pathname;
  const secure = isSecure(url);
  const ip = reqIp(request);

  if (path === '/api/admin/login' && request.method === 'POST') {
    if (loginRateLimited(ip)) {
      await logAdminLoginEvent(env, 'rate_limited', ip, request.headers.get('user-agent'));
      return json({ error: 'too_many_requests' }, 429);
    }
    const body = await request.json().catch(() => ({}));
    const phone = String(body.phone || '').trim();
    const password = String(body.password || '');
    const admin = await env.DB.prepare(`SELECT * FROM admins WHERE phone = ?`).bind(phone).first();
    const passOk = admin && password.length > 0 && (await verifyPassword(password, admin.password_hash));
    if (!admin || !passOk) {
      await logAdminLoginEvent(env, 'bad_password', ip, request.headers.get('user-agent'));
      return json({ error: 'bad_credentials' }, 401);
    }
    if (!(await checkIpWhitelist(request, env, ip))) {
      await logAdminLoginEvent(env, 'ip_blocked', ip, request.headers.get('user-agent'));
      return json({ error: 'ip_not_whitelisted' }, 403);
    }
    if (admin.totp_enabled && admin.totp_secret) {
      const tempToken = newToken(24);
      await env.DB.prepare(`INSERT INTO admin_2fa_pending (temp_token, admin_id, method, expires_at) VALUES (?, ?, 'totp', ?)`)
        .bind(tempToken, admin.id, new Date(Date.now() + 5 * 60_000).toISOString()).run();
      return json({ ok: true, twoFactor: true, method: 'totp', tempToken });
    }
    // TOTP not set up yet, and Telegram-OTP is only ever offered as an
    // opt-in choice ON the 2FA screen (see /2fa/telegram/send) — there's
    // no 2FA screen to offer it from here, so log the admin straight in
    // and surface a strong nudge to enable TOTP immediately via
    // /api/admin/2fa/totp/setup. This is intentionally temporary —
    // tracked as follow-up work.
    const token = newToken();
    const now = new Date();
    await env.DB.prepare(`INSERT INTO admin_sessions (token, admin_id, role, abs_exp, last_activity) VALUES (?, ?, ?, ?, ?)`)
      .bind(await sha256Hex(token), admin.id, admin.role, new Date(now.getTime() + ADMIN_TTL_MS).toISOString(), now.toISOString()).run();
    await logAdminLoginEvent(env, 'login_ok', ip, request.headers.get('user-agent'));
    return jsonWithCookie({ ok: true, totpSetupRecommended: true }, 200, adminCookieHeader(token, secure));
  }

  // Opt-in Telegram OTP — ONLY reachable by an admin who already passed
  // password + has a live pending 2FA session (tempToken from /login), and
  // ONLY ever sent when they explicitly click "Telegram orqali kod olish"
  // on the 2FA screen. TOTP remains the default/primary method; this never
  // fires automatically (no IP/location heuristics). Overwrites whatever
  // was pending for this tempToken (any earlier Telegram OTP for it is
  // immediately invalidated — there is only ever one live code per
  // pending login), and stores the code as a SHA-256 hash, never raw.
  if (path === '/api/admin/2fa/telegram/send' && request.method === 'POST') {
    if (loginRateLimited(ip)) return json({ error: 'too_many_requests' }, 429);
    const body = await request.json().catch(() => ({}));
    const tempToken = String(body.tempToken || '');
    const pending = await env.DB.prepare(`SELECT * FROM admin_2fa_pending WHERE temp_token = ?`).bind(tempToken).first();
    if (!pending || new Date(pending.expires_at) < new Date()) {
      if (pending) await env.DB.prepare(`DELETE FROM admin_2fa_pending WHERE temp_token = ?`).bind(tempToken).run();
      return json({ error: 'expired' }, 401);
    }
    if (!(await checkIpWhitelist(request, env, ip))) {
      await logAdminLoginEvent(env, 'ip_blocked', ip, request.headers.get('user-agent'));
      return json({ error: 'ip_not_whitelisted' }, 403);
    }
    if (!env.TELEGRAM_BOT_TOKEN || !env.ADMIN_CHAT_ID) return json({ error: 'telegram_not_configured' }, 503);
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const codeHash = await sha256Hex(code);
    await env.DB.prepare(`UPDATE admin_2fa_pending SET method = 'telegram', code = ?, attempts = 0, expires_at = ? WHERE temp_token = ?`)
      .bind(codeHash, new Date(Date.now() + 5 * 60_000).toISOString(), tempToken).run();
    const sent = await sendTelegramMessage(env, `🔐 Admin panelga kirish kodi: <b>${code}</b>\n\nBu kodni hech kimga bermang. 5 daqiqa ichida amal qiladi.`);
    if (!sent) return json({ error: 'tg_send_failed' }, 503);
    return json({ ok: true, method: 'telegram' });
  }

  if (path === '/api/admin/verify-2fa' && request.method === 'POST') {
    if (loginRateLimited(ip)) return json({ error: 'too_many_requests' }, 429);
    const body = await request.json().catch(() => ({}));
    const tempToken = String(body.tempToken || '');
    const code = String(body.code || '').trim();
    const pending = await env.DB.prepare(`SELECT * FROM admin_2fa_pending WHERE temp_token = ?`).bind(tempToken).first();
    if (!pending || new Date(pending.expires_at) < new Date()) {
      if (pending) await env.DB.prepare(`DELETE FROM admin_2fa_pending WHERE temp_token = ?`).bind(tempToken).run();
      return json({ error: 'expired' }, 401);
    }
    if (!(await checkIpWhitelist(request, env, ip))) {
      await logAdminLoginEvent(env, 'ip_blocked', ip, request.headers.get('user-agent'));
      return json({ error: 'ip_not_whitelisted' }, 403);
    }
    const admin = await env.DB.prepare(`SELECT * FROM admins WHERE id = ?`).bind(pending.admin_id).first();
    let valid = false;
    let totpCounter = null;
    if (pending.method === 'telegram') {
      // Attempt limit is per pending record — a fresh /2fa/telegram/send
      // resets it to 0, so this only ever throttles repeated guesses
      // against ONE still-live code, not the admin's login attempts as a
      // whole (loginRateLimited above already covers that).
      if (Number(pending.attempts || 0) >= TELEGRAM_OTP_MAX_ATTEMPTS) {
        await env.DB.prepare(`DELETE FROM admin_2fa_pending WHERE temp_token = ?`).bind(tempToken).run();
        return json({ error: 'expired' }, 401);
      }
      valid = pending.code && (await sha256Hex(code)) === pending.code;
      if (!valid) await env.DB.prepare(`UPDATE admin_2fa_pending SET attempts = ? WHERE temp_token = ?`).bind(Number(pending.attempts || 0) + 1, tempToken).run();
    } else if (admin?.totp_secret) {
      const result = await totpVerify({ secret: admin.totp_secret, token: code, afterCounter: admin.totp_last_counter });
      valid = result.valid;
      totpCounter = result.counter ?? null;
    }
    if (!valid) {
      await logAdminLoginEvent(env, 'bad_2fa', ip, request.headers.get('user-agent'));
      return json({ error: 'bad_code' }, 401);
    }
    await env.DB.prepare(`DELETE FROM admin_2fa_pending WHERE temp_token = ?`).bind(tempToken).run();
    if (totpCounter != null) {
      // Persist the accepted time-step BEFORE anything else can race it —
      // the exact same 6-digit code (or an older one inside the ±1 step
      // window) can never be replayed for a second login after this.
      // Telegram codes need no equivalent: DELETE above already makes the
      // just-used code single-use (and a fresh /send is required for another).
      await env.DB.prepare(`UPDATE admins SET totp_last_counter = ? WHERE id = ?`).bind(totpCounter, admin.id).run();
    }
    const token = newToken();
    const now = new Date();
    await env.DB.prepare(`INSERT INTO admin_sessions (token, admin_id, role, abs_exp, last_activity) VALUES (?, ?, ?, ?, ?)`)
      .bind(await sha256Hex(token), admin.id, admin.role, new Date(now.getTime() + ADMIN_TTL_MS).toISOString(), now.toISOString()).run();
    await logAdminLoginEvent(env, 'login_ok', ip, request.headers.get('user-agent'));
    return jsonWithCookie({ ok: true }, 200, adminCookieHeader(token, secure));
  }

  if (path === '/api/admin/logout' && request.method === 'POST') {
    const token = parseCookies(request)[ADMIN_COOKIE];
    if (token) await env.DB.prepare(`DELETE FROM admin_sessions WHERE token = ?`).bind(await sha256Hex(token)).run();
    await logAdminLoginEvent(env, 'logout', ip, request.headers.get('user-agent'));
    return jsonWithCookie({ ok: true }, 200, clearedAdminCookieHeader(secure));
  }

  if (path === '/api/admin/me' && request.method === 'GET') {
    const admin = await getCurrentAdmin(request, env);
    const authenticated = !!(admin && !admin.idleTimeout);
    return json({ authenticated, role: authenticated ? admin.role : null });
  }

  return null;
}

// ---------- admin: everything past this point requires a session ----------

function newsRow(r) {
  return {
    id: Number(r.id), title: r.title, body: r.body || '',
    titleRu: r.title_ru || '', titleEn: r.title_en || '', bodyRu: r.body_ru || '', bodyEn: r.body_en || '',
    imageUrl: r.image_url || '', published: !!r.published, views: Number(r.views || 0),
    likeCount: Number(r.like_count || 0), createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

async function adminCoreApi(request, env, url, admin) {
  const path = url.pathname;
  const ip = reqIp(request);

  if (path === '/api/admin/stats' && request.method === 'GET') {
    const [u, c, a, p] = await Promise.all([
      env.DB.prepare(`SELECT COUNT(*) AS n, COALESCE(SUM(balance),0) AS total_balance FROM users WHERE is_test = 0`).first(),
      env.DB.prepare(`SELECT COUNT(*) AS n, COALESCE(SUM(price),0) AS total_price FROM cards c
                       WHERE c.user_id IS NULL OR c.user_id NOT IN (SELECT id FROM users WHERE is_test = 1)`).first(),
      env.DB.prepare(`SELECT COUNT(*) AS n FROM auctions WHERE status = 'active'`).first(),
      env.DB.prepare(`SELECT COUNT(*) AS n FROM web_orders WHERE status = 'pending'`).first(),
    ]);
    return json({
      userCount: Number(u.n), totalWalletBalance: Number(u.total_balance), cardCount: Number(c.n),
      totalCardSalesValue: Number(c.total_price), activeAuctions: Number(a.n), pendingWebOrders: Number(p.n),
      topupsNeedReview: 0,
    });
  }

  if (path === '/api/admin/platform-wallet' && request.method === 'GET') {
    const row = await env.DB.prepare(`SELECT balance FROM platform_wallet WHERE id = 1`).first();
    return json({ balance: Number(row?.balance || 0) });
  }

  if (path === '/api/admin/analytics' && request.method === 'GET') {
    const [breakdownRows, commissions, signups, cards] = await Promise.all([
      env.DB.prepare(`SELECT kind, COUNT(*) AS count, COALESCE(SUM(amount), 0) AS total FROM transactions WHERE amount > 0 AND kind <> 'admin_adjust' GROUP BY kind ORDER BY total DESC`).all(),
      env.DB.prepare(`SELECT substr(created_at, 1, 10) AS day, COALESCE(SUM(amount), 0) AS total FROM transactions WHERE kind = 'platform_commission' AND datetime(created_at) >= datetime('now', '-29 days') GROUP BY substr(created_at, 1, 10) ORDER BY day`).all(),
      env.DB.prepare(`SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS count FROM users WHERE is_test = 0 AND datetime(created_at) >= datetime('now', '-29 days') GROUP BY substr(created_at, 1, 10) ORDER BY day`).all(),
      env.DB.prepare(`SELECT strftime('%Y-%m-%d', ts / 1000, 'unixepoch') AS day, COUNT(*) AS count FROM cards WHERE ts >= (unixepoch('now', '-29 days') * 1000) GROUP BY strftime('%Y-%m-%d', ts / 1000, 'unixepoch') ORDER BY day`).all(),
    ]);
    return json({
      breakdown: (breakdownRows.results || []).map((r) => ({ kind: r.kind, count: Number(r.count), total: Number(r.total) })),
      commissionSeries: (commissions.results || []).map((r) => ({ day: r.day, total: Number(r.total) })),
      signupsSeries: (signups.results || []).map((r) => ({ day: r.day, count: Number(r.count) })),
      cardsSeries: (cards.results || []).map((r) => ({ day: r.day, count: Number(r.count) })),
    });
  }

  if (path === '/api/admin/orders' && request.method === 'GET') {
    const [web, bot] = await Promise.all([
      env.DB.prepare(`SELECT id, 'web' AS source, user_id, code, price AS amount, status, created_at FROM web_orders ORDER BY created_at DESC LIMIT 100`).all(),
      env.DB.prepare(`SELECT id, 'bot' AS source, tg_user_id AS user_id, code, price AS amount, status, created_at, tg_username, tg_name FROM bot_orders ORDER BY created_at DESC LIMIT 100`).all(),
    ]);
    const orders = [...(web.results || []), ...(bot.results || [])]
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, 100)
      .map((r) => ({ id: r.id, source: r.source, userId: r.user_id, code: r.code, amount: Number(r.amount), status: r.status, createdAt: r.created_at, tgUsername: r.tg_username, tgName: r.tg_name }));
    return json({ orders });
  }

  if (path === '/api/admin/referrals' && request.method === 'GET') {
    const rows = await env.DB.prepare(`SELECT r.id, r.created_at, ru.email AS referrer_email, ru.promo_code AS referrer_promo,
      (SELECT name FROM cards WHERE user_id = ru.id ORDER BY is_primary DESC, ts ASC LIMIT 1) AS referrer_name,
      rd.email AS referred_email, (SELECT name FROM cards WHERE user_id = rd.id ORDER BY is_primary DESC, ts ASC LIMIT 1) AS referred_name
      FROM referral_uses r JOIN users ru ON ru.id = r.referrer_id JOIN users rd ON rd.id = r.referred_id ORDER BY r.created_at DESC LIMIT 2000`).all();
    return json({ referrals: (rows.results || []).map((r) => ({ id: r.id, createdAt: r.created_at, referrerEmail: r.referrer_email, referrerPromo: r.referrer_promo, referrerName: r.referrer_name, referredEmail: r.referred_email, referredName: r.referred_name })) });
  }

  if (path === '/api/admin/support-messages' && request.method === 'GET') {
    const rows = await env.DB.prepare(`SELECT sm.*, u.email AS user_email,
      (SELECT code FROM cards WHERE user_id = sm.user_id ORDER BY is_primary DESC, ts ASC LIMIT 1) AS user_code
      FROM support_messages sm JOIN users u ON u.id = sm.user_id ORDER BY sm.created_at DESC LIMIT 200`).all();
    return json({ messages: (rows.results || []).map((r) => ({ id: r.id, userId: r.user_id, userEmail: r.user_email, userCode: r.user_code, message: r.message, reply: r.reply, status: r.status, createdAt: r.created_at, repliedAt: r.replied_at })) });
  }

  const supportReplyMatch = path.match(/^\/api\/admin\/support-messages\/(\d+)\/reply$/);
  if (supportReplyMatch && request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const reply = shortText(body.reply, 1000);
    if (!reply) return json({ error: 'reply_required' }, 422);
    const row = await env.DB.prepare(`UPDATE support_messages SET reply = ?, status = 'replied', replied_at = ? WHERE id = ? RETURNING id`)
      .bind(reply, nowTs(), Number(supportReplyMatch[1])).first();
    if (!row) return json({ error: 'not_found' }, 404);
    return json({ ok: true });
  }

  if (path === '/api/admin/physical-cards' && request.method === 'GET') {
    const rows = await env.DB.prepare(`SELECT pc.*, u.email AS owner_email FROM physical_cards pc LEFT JOIN users u ON u.id = pc.owner_user_id ORDER BY pc.created_at DESC LIMIT 100`).all();
    return json({ cards: (rows.results || []).map((r) => ({ id: r.id, chipToken: r.chip_token, linkedCode: r.linked_code, ownerUserId: r.owner_user_id, ownerEmail: r.owner_email, active: !!r.active, status: r.status, shippingName: r.shipping_name, shippingPhone: r.shipping_phone, shippingAddress: r.shipping_address, createdAt: r.created_at })) });
  }

  const physicalStatusMatch = path.match(/^\/api\/admin\/physical-cards\/(\d+)\/status$/);
  if (physicalStatusMatch && request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const status = String(body.status || '');
    if (!['pending', 'printing', 'shipped', 'delivered'].includes(status)) return json({ error: 'bad_status' }, 422);
    const row = await env.DB.prepare(`UPDATE physical_cards SET status = ? WHERE id = ? RETURNING id, status`)
      .bind(status, Number(physicalStatusMatch[1])).first();
    if (!row) return json({ error: 'not_found' }, 404);
    return json(row);
  }

  const physicalActiveMatch = path.match(/^\/api\/admin\/physical-cards\/(\d+)\/active$/);
  if (physicalActiveMatch && request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const active = body.active !== false;
    const row = await env.DB.prepare(`UPDATE physical_cards SET active = ? WHERE id = ? RETURNING id, linked_code`)
      .bind(active ? 1 : 0, Number(physicalActiveMatch[1])).first();
    if (!row) return json({ error: 'not_found' }, 404);
    await logAdminActivity(env, { action: active ? 'nfc_card_unblocked' : 'nfc_card_blocked', details: `Kod: ${row.linked_code || row.id}`, ip });
    return json({ ok: true });
  }

  if (path === '/api/admin/nfc-gifts' && request.method === 'GET') {
    const rows = await env.DB.prepare(`SELECT ng.*, u.email AS activated_by_email FROM nfc_gifts ng LEFT JOIN users u ON u.id = ng.activated_by_user_id ORDER BY ng.created_at DESC`).all();
    return json({ gifts: (rows.results || []).map((r) => ({ id: r.id, code: r.code, recipientName: r.recipient_name, note: r.note, activationCode: r.activation_code, status: r.status, value: r.value == null ? null : Number(r.value), createdAt: r.created_at, activatedAt: r.activated_at, activatedByEmail: r.activated_by_email })) });
  }

  if (path === '/api/admin/pending-payouts' && request.method === 'GET') {
    const rows = await env.DB.prepare(`SELECT id, email, phone, pending_payout FROM users WHERE pending_payout > 0 ORDER BY pending_payout DESC`).all();
    return json({ payouts: (rows.results || []).map((r) => ({ id: r.id, email: r.email, phone: r.phone, pendingPayout: Number(r.pending_payout) })) });
  }

  const payoutClearMatch = path.match(/^\/api\/admin\/pending-payouts\/(\d+)\/clear$/);
  if (payoutClearMatch && request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const amount = Math.round(Number(body.amount));
    if (!amount || amount <= 0) return json({ error: 'bad_amount' }, 422);
    const id = Number(payoutClearMatch[1]);
    const row = await env.DB.prepare(`UPDATE users SET pending_payout = pending_payout - ? WHERE id = ? AND pending_payout >= ? RETURNING pending_payout`)
      .bind(amount, id, amount).first();
    if (!row) return json({ error: 'amount_exceeds_pending' }, 409);
    await env.DB.prepare(`INSERT INTO transactions (user_id, amount, kind, note, created_at) VALUES (?, 0, 'admin_adjust', ?, ?)`)
      .bind(id, `Admin qo'lda ${amount} so'm to'lab berdi (pending_payout kamaytirildi)`, nowTs()).run();
    return json({ pendingPayout: Number(row.pending_payout) });
  }

  if (path === '/api/admin/finance/overview' && request.method === 'GET') {
    // Moliyaviy ma'lumot — faqat Super Admin (server/admin.js'dagi
    // requireSuperAdmin bilan bir xil qoida; login/2FA/IP whitelist oqimiga
    // tegilmagan, faqat shu bitta endpointga rol tekshiruvi qo'shildi).
    if (admin.role !== 'super_admin') return json({ error: 'forbidden' }, 403);
    const range = String(url.searchParams.get('range') || 'month');
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const start = range === 'today' ? "datetime('now','start of day')" : range === '7d' ? "datetime('now','-6 days','start of day')" : range === '30d' ? "datetime('now','-29 days','start of day')" : range === 'prev_month' ? "datetime('now','start of month','-1 month')" : range === 'custom' && /^\d{4}-\d{2}-\d{2}$/.test(from || '') ? `datetime('${from}T00:00:00')` : "datetime('now','start of month')";
    const end = range === 'prev_month' ? "datetime('now','start of month','-1 second')" : range === 'custom' && /^\d{4}-\d{2}-\d{2}$/.test(to || '') ? `datetime('${to}T23:59:59')` : "datetime('now')";
    const [sales, daily, expenses, bank] = await Promise.all([
      env.DB.prepare(`SELECT COUNT(*) AS order_count, COALESCE(SUM(price),0) AS gross FROM web_orders WHERE status = 'paid' AND datetime(created_at) BETWEEN ${start} AND ${end}`).first(),
      env.DB.prepare(`SELECT substr(created_at,1,10) AS day, COALESCE(SUM(price),0) AS gross FROM web_orders WHERE status = 'paid' AND datetime(created_at) BETWEEN ${start} AND ${end} GROUP BY substr(created_at,1,10) ORDER BY day`).all(),
      env.DB.prepare(`SELECT COALESCE(SUM(amount),0) AS total FROM finance_expenses WHERE datetime(spent_on) BETWEEN ${start} AND ${end}`).first(),
      env.DB.prepare(`SELECT COUNT(*) AS n, COALESCE(SUM(actual_amount),0) AS total FROM finance_bank_actuals WHERE period BETWEEN substr(${start},1,7) AND substr(${end},1,7)`).first(),
    ]);
    const gross = Number(sales.gross || 0); const manualExpenses = Number(expenses.total || 0);
    // finance_bank_actuals'da davr uchun umuman yozuv bo'lmasa (n === 0) —
    // "hali kiritilmagan" holatini frontend'ga null sifatida bildiramiz
    // (0 so'm bilan aralashtirmaslik uchun — original server/db.js xatti-harakati).
    const actualBankSettlement = Number(bank.n || 0) > 0 ? Number(bank.total || 0) : null;
    const reconciliationDifference = actualBankSettlement == null ? null : actualBankSettlement - gross;
    // Sof pul oqimi — haqiqiy bank tushumi hali kiritilmagan bo'lsa, kutilgan
    // (gross) qiymatga tayanadi, original'dagi settlementForNet fallback'i kabi.
    const netCashFlow = (actualBankSettlement != null ? actualBankSettlement : gross) - manualExpenses;
    return json({ overview: { grossSales: gross, orderCount: Number(sales.order_count || 0), fromIso: from || null, toIso: to || null, ratesConfigured: false, paymeFee: 0, paymeMode: 'separate', expectedBankSettlement: gross, actualBankSettlement, reconciliationDifference, taxBase: gross, turnoverPct: 0, turnoverTax: 0, socialTax: 0, bankFees: 0, manualExpenses, netCashFlow }, daily: (daily.results || []).map((r) => ({ day: r.day, gross: Number(r.gross), expected: Number(r.gross) })) });
  }

  // ---------- news (Yangiliklar) — faqat admin joylaydi/tahrirlaydi/o'chiradi ----------
  if (path === '/api/admin/news' && request.method === 'GET') {
    const rows = await env.DB.prepare(`SELECT n.*, (SELECT COUNT(*) FROM news_likes l WHERE l.news_id = n.id) AS like_count
      FROM news n ORDER BY n.created_at DESC LIMIT 100`).all();
    return json({ news: (rows.results || []).map(newsRow) });
  }

  if (path === '/api/admin/news' && request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const title = shortText(body.title, 200);
    if (!title) return json({ error: 'title_required' }, 422);
    const now = nowTs();
    const row = await env.DB.prepare(`INSERT INTO news (title, body, title_ru, title_en, body_ru, body_en, image_url, published, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`)
      .bind(title, shortText(body.body, 8000), shortText(body.titleRu, 200), shortText(body.titleEn, 200),
        shortText(body.bodyRu, 8000), shortText(body.bodyEn, 8000), safeUrl(body.imageUrl),
        body.published === false ? 0 : 1, now, now).first();
    await logAdminActivity(env, { action: 'news_created', details: title, ip });
    return json(newsRow(row), 201);
  }

  const newsIdMatch = path.match(/^\/api\/admin\/news\/(\d+)$/);
  if (newsIdMatch && request.method === 'PUT') {
    const id = Number(newsIdMatch[1]);
    const body = await request.json().catch(() => ({}));
    const existing = await env.DB.prepare(`SELECT * FROM news WHERE id = ?`).bind(id).first();
    if (!existing) return json({ error: 'not_found' }, 404);
    const row = await env.DB.prepare(`UPDATE news SET title = ?, body = ?, title_ru = ?, title_en = ?, body_ru = ?, body_en = ?,
      image_url = ?, published = ?, updated_at = ? WHERE id = ? RETURNING *`)
      .bind(
        body.title == null ? existing.title : shortText(body.title, 200),
        body.body == null ? existing.body : shortText(body.body, 8000),
        body.titleRu == null ? existing.title_ru : shortText(body.titleRu, 200),
        body.titleEn == null ? existing.title_en : shortText(body.titleEn, 200),
        body.bodyRu == null ? existing.body_ru : shortText(body.bodyRu, 8000),
        body.bodyEn == null ? existing.body_en : shortText(body.bodyEn, 8000),
        body.imageUrl == null ? existing.image_url : safeUrl(body.imageUrl),
        body.published == null ? existing.published : (body.published !== false ? 1 : 0),
        nowTs(), id,
      ).first();
    await logAdminActivity(env, { action: 'news_updated', details: `#${id}`, ip });
    return json(newsRow(row));
  }
  if (newsIdMatch && request.method === 'DELETE') {
    await env.DB.prepare(`DELETE FROM news WHERE id = ?`).bind(Number(newsIdMatch[1])).run();
    await logAdminActivity(env, { action: 'news_deleted', details: `#${newsIdMatch[1]}`, ip });
    return json({ ok: true });
  }

  // ---------- IP whitelist (super_admin only) ----------
  if (path === '/api/admin/ip-whitelist' && request.method === 'GET') {
    if (admin.role !== 'super_admin') return json({ error: 'forbidden' }, 403);
    const [setting, rows] = await Promise.all([
      env.DB.prepare(`SELECT value FROM admin_settings WHERE key = 'ip_whitelist_enabled'`).first(),
      env.DB.prepare(`SELECT id, ip, label, created_at FROM admin_ip_whitelist ORDER BY created_at DESC`).all(),
    ]);
    return json({ enabled: setting?.value === 'true', ips: rows.results || [], yourIp: ip });
  }

  if (path === '/api/admin/ip-whitelist/toggle' && request.method === 'POST') {
    if (admin.role !== 'super_admin') return json({ error: 'forbidden' }, 403);
    const body = await request.json().catch(() => ({}));
    const enabled = body.enabled === true;
    if (enabled) {
      const count = await env.DB.prepare(`SELECT COUNT(*) AS n FROM admin_ip_whitelist`).first();
      if (Number(count?.n || 0) === 0) return json({ error: 'no_ips' }, 422);
    }
    await env.DB.prepare(`INSERT INTO admin_settings (key, value) VALUES ('ip_whitelist_enabled', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`)
      .bind(enabled ? 'true' : 'false').run();
    await logAdminActivity(env, { action: enabled ? 'ip_whitelist_enabled' : 'ip_whitelist_disabled', ip });
    return json({ ok: true });
  }

  if (path === '/api/admin/ip-whitelist/add' && request.method === 'POST') {
    if (admin.role !== 'super_admin') return json({ error: 'forbidden' }, 403);
    const body = await request.json().catch(() => ({}));
    const addIp = shortText(body.ip, 45);
    const label = shortText(body.label, 60);
    if (!addIp) return json({ error: 'ip_required' }, 422);
    try {
      await env.DB.prepare(`INSERT INTO admin_ip_whitelist (ip, label, created_at) VALUES (?, ?, ?)`)
        .bind(addIp, label || null, nowTs()).run();
    } catch {
      return json({ error: 'already_exists' }, 409);
    }
    await logAdminActivity(env, { action: 'ip_whitelist_added', newValue: `${addIp} (${label})`, ip });
    return json({ ok: true }, 201);
  }

  const ipRemoveMatch = path.match(/^\/api\/admin\/ip-whitelist\/(\d+)\/remove$/);
  if (ipRemoveMatch && request.method === 'POST') {
    if (admin.role !== 'super_admin') return json({ error: 'forbidden' }, 403);
    await env.DB.prepare(`DELETE FROM admin_ip_whitelist WHERE id = ?`).bind(Number(ipRemoveMatch[1])).run();
    await logAdminActivity(env, { action: 'ip_whitelist_removed', details: `ID: ${ipRemoveMatch[1]}`, ip });
    return json({ ok: true });
  }

  // ---------- production-drift/admin-501 audit — GROUP A (read-only) ----------
  if (path === '/api/admin/manual-adjustments' && request.method === 'GET') {
    const rows = await env.DB.prepare(`SELECT t.id, t.user_id, u.email, t.amount, t.note, t.created_at FROM transactions t
      LEFT JOIN users u ON u.id = t.user_id WHERE t.kind = 'admin_adjust' ORDER BY t.created_at DESC LIMIT 50`).all();
    return json({ adjustments: (rows.results || []).map((r) => ({ id: r.id, userId: r.user_id, email: r.email, amount: Number(r.amount), note: r.note, createdAt: r.created_at })) });
  }

  if (path === '/api/admin/verified-cards' && request.method === 'GET') {
    const rows = await env.DB.prepare(`SELECT code, name, role, profile_type FROM cards WHERE verified = 1 ORDER BY name`).all();
    return json({ cards: (rows.results || []).map((r) => ({ code: r.code, name: r.name, role: r.role, profileType: r.profile_type })) });
  }

  const adminRecordMatch = path.match(/^\/api\/admin\/records\/([A-Za-z0-9]+)$/);
  if (adminRecordMatch && request.method === 'GET') {
    const rec = await getRecord(env, adminRecordMatch[1].toUpperCase());
    if (!rec) return json({ error: 'not_found' }, 404);
    return json({ code: rec.code, name: rec.name, role: rec.role, verified: !!rec.verified, profileType: rec.profileType, views: rec.views });
  }

  // "Kompaniyalar" tabining "Eski tizim" (deprecated) qismi — server/admin.js
  // bilan AYNAN bir xil manba: alohida jadval EMAS, `cards.profile_type =
  // 'business'` yozuvlari (Company System — Faz 0 audit qarori). Bu YANGI
  // `companies` jadvali (company_id, approval workflow, /api/companies*)
  // bilan ARALASHTIRILMAYDI — frontend o'zi ham buni "Eski tizim"/"Eski
  // biznes profillar" deb belgilaydi (COMPANY_SUBTABS).
  if (path === '/api/admin/companies/stats' && request.method === 'GET') {
    const row = await env.DB.prepare(`SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN hidden_from_directory = 0 THEN 1 ELSE 0 END) AS active,
        SUM(CASE WHEN hidden_from_directory = 1 THEN 1 ELSE 0 END) AS suspended,
        SUM(CASE WHEN EXISTS (SELECT 1 FROM menu_categories mc WHERE mc.code = cards.code) THEN 1 ELSE 0 END) AS with_menu,
        SUM(CASE WHEN EXISTS (SELECT 1 FROM product_categories pc WHERE pc.code = cards.code) THEN 1 ELSE 0 END) AS with_products,
        SUM(CASE WHEN EXISTS (SELECT 1 FROM menu_categories mc WHERE mc.code = cards.code)
                  AND EXISTS (SELECT 1 FROM product_categories pc WHERE pc.code = cards.code) THEN 1 ELSE 0 END) AS with_both
      FROM cards WHERE profile_type = 'business'`).first();
    return json({
      total: Number(row?.total || 0), active: Number(row?.active || 0), suspended: Number(row?.suspended || 0),
      withMenu: Number(row?.with_menu || 0), withProducts: Number(row?.with_products || 0), withBoth: Number(row?.with_both || 0),
    });
  }

  if (path === '/api/admin/companies/activity-log' && request.method === 'GET') {
    const rows = await env.DB.prepare(`SELECT id, action, details, old_value, new_value, ip, created_at FROM admin_activity_log
      WHERE action IN ('company_suspended','company_activated','company_tier_set','company_limits_changed','company_limits_reset','physical_nfc_pricing_changed','delivery_days_changed')
      ORDER BY created_at DESC LIMIT 200`).all();
    return json({ log: (rows.results || []).map((r) => ({ id: r.id, action: r.action, details: r.details, oldValue: r.old_value, newValue: r.new_value, ip: r.ip, createdAt: r.created_at })) });
  }

  const OLD_COMPANY_SELECT = `c.code, c.name, c.role, c.city, c.category_slug AS categorySlug,
    c.tier_override AS tierOverride, c.verified, c.ts, c.hidden_from_directory AS hiddenFromDirectory,
    c.phone, c.email, c.about,
    u.id AS ownerId, u.email AS ownerEmail, u.phone AS ownerPhone, u.is_premium AS ownerIsPremium,
    (SELECT COUNT(*) FROM nfc_gifts g WHERE g.code = c.code AND g.status = 'activated') AS isGift,
    (SELECT COUNT(*) FROM menu_categories mc WHERE mc.code = c.code) AS menuCatCount,
    (SELECT COUNT(*) FROM menu_items mi WHERE mi.code = c.code) AS menuItemCount,
    (SELECT COUNT(*) FROM product_categories pc WHERE pc.code = c.code) AS productCatCount,
    (SELECT COUNT(*) FROM products p WHERE p.code = c.code) AS productItemCount,
    (SELECT COUNT(*) FROM card_team tm WHERE tm.code = c.code) AS teamCount
    FROM cards c LEFT JOIN users u ON u.id = c.user_id WHERE c.profile_type = 'business'`;
  function oldCompanyRow(r) {
    return {
      code: r.code, name: r.name, role: r.role, city: r.city, categorySlug: r.categorySlug,
      tierOverride: r.tierOverride, verified: !!r.verified, ts: Number(r.ts), hiddenFromDirectory: !!r.hiddenFromDirectory,
      phone: r.phone, email: r.email, about: r.about, ownerId: r.ownerId, ownerEmail: r.ownerEmail,
      ownerPhone: r.ownerPhone, ownerIsPremium: !!r.ownerIsPremium, isGift: !!r.isGift,
      menuCatCount: Number(r.menuCatCount || 0), menuItemCount: Number(r.menuItemCount || 0),
      productCatCount: Number(r.productCatCount || 0), productItemCount: Number(r.productItemCount || 0),
      teamCount: Number(r.teamCount || 0),
    };
  }
  if (path === '/api/admin/companies' && request.method === 'GET') {
    const rows = await env.DB.prepare(`SELECT ${OLD_COMPANY_SELECT} ORDER BY c.ts DESC LIMIT 300`).all();
    return json({ companies: (rows.results || []).map(oldCompanyRow) });
  }
  const oldCompanyMatch = path.match(/^\/api\/admin\/companies\/([A-Za-z0-9]+)$/);
  if (oldCompanyMatch && request.method === 'GET') {
    const row = await env.DB.prepare(`SELECT ${OLD_COMPANY_SELECT} AND c.code = ?`).bind(oldCompanyMatch[1].toUpperCase()).first();
    if (!row) return json({ error: 'not_found' }, 404);
    return json(oldCompanyRow(row));
  }

  if (path === '/api/admin/company-settings' && request.method === 'GET') {
    const mergeLimits = (defaults, override) => {
      const out = {};
      for (const tier of ['free', 'silver', 'gold', 'premium', 'exclusive']) {
        const d = defaults[tier]; const o = (override && override[tier]) || {};
        out[tier] = {
          cat: Number.isFinite(Number(o.cat)) && Number(o.cat) >= 0 ? Number(o.cat) : d.cat,
          item: Number.isFinite(Number(o.item)) && Number(o.item) >= 0 ? Number(o.item) : d.item,
          images: typeof o.images === 'boolean' ? o.images : d.images,
          isCustom: Object.prototype.hasOwnProperty.call(override || {}, tier),
        };
      }
      return out;
    };
    const parseSetting = (text, fallback) => { if (text == null || text === '') return fallback; try { return JSON.parse(text); } catch { return fallback; } };
    const [menuRow, productRow, tiersRow, deliveryRow] = await Promise.all([
      env.DB.prepare(`SELECT value FROM admin_settings WHERE key = 'menu_limits'`).first(),
      env.DB.prepare(`SELECT value FROM admin_settings WHERE key = 'product_limits'`).first(),
      env.DB.prepare(`SELECT value FROM admin_settings WHERE key = 'physical_nfc_pricing'`).first(),
      env.DB.prepare(`SELECT value FROM admin_settings WHERE key = 'delivery_days'`).first(),
    ]);
    return json({
      menuLimits: mergeLimits(MENU_LIMITS_DEFAULT, parseSetting(menuRow?.value, null)),
      productLimits: mergeLimits(PRODUCT_LIMITS_DEFAULT, parseSetting(productRow?.value, null)),
      physicalNfcTiers: parseSetting(tiersRow?.value, [
        { minQty: 1, maxQty: 9, pricePerUnit: 120000 }, { minQty: 10, maxQty: 49, pricePerUnit: 95000 }, { minQty: 50, maxQty: null, pricePerUnit: 75000 },
      ]),
      delivery: parseSetting(deliveryRow?.value, { minDays: 3, maxDays: 5 }),
    });
  }

  if (path === '/api/admin/users' && request.method === 'GET') {
    const rows = await env.DB.prepare(
      `SELECT id, email, phone, bot_ack, balance, held_balance, created_at, is_test,
              suspended_until, suspend_reason, deleted_at,
              (SELECT COUNT(*) FROM cards WHERE user_id = users.id) AS card_count,
              (SELECT GROUP_CONCAT(code) FROM cards WHERE user_id = users.id) AS codes
       FROM users ORDER BY created_at DESC LIMIT 200`
    ).all();
    const users = (rows.results || []).map((r) => ({
      id: r.id, email: r.email, phone: r.phone, botAck: !!r.bot_ack, balance: Number(r.balance),
      heldBalance: Number(r.held_balance), createdAt: r.created_at, isTest: !!r.is_test,
      suspendedUntil: r.suspended_until, suspendReason: r.suspend_reason, deletedAt: r.deleted_at,
      cardCount: Number(r.card_count), codes: r.codes ? r.codes.split(',') : [],
    }));
    return json({ users });
  }

  const setTestMatch = path.match(/^\/api\/admin\/users\/(\d+)\/set-test$/);
  if (setTestMatch && request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    await env.DB.prepare(`UPDATE users SET is_test = ? WHERE id = ?`).bind(body.isTest !== false ? 1 : 0, Number(setTestMatch[1])).run();
    return json({ ok: true });
  }

  const suspendMatch = path.match(/^\/api\/admin\/users\/(\d+)\/suspend$/);
  if (suspendMatch && request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const days = Math.max(1, Math.min(3650, Math.round(Number(body.days) || 7)));
    const reason = cleanStr(body.reason, 200);
    if (!reason) return json({ error: 'reason_required' }, 422);
    const id = Number(suspendMatch[1]);
    const until = new Date(Date.now() + days * 86400000).toISOString();
    await env.DB.prepare(`UPDATE users SET suspended_until = ?, suspend_reason = ? WHERE id = ?`).bind(until, reason, id).run();
    await logAdminActivity(env, { action: 'user_suspended', details: `Foydalanuvchi #${id} — ${days} kunga`, newValue: reason, ip });
    return json({ ok: true });
  }

  const unsuspendMatch = path.match(/^\/api\/admin\/users\/(\d+)\/unsuspend$/);
  if (unsuspendMatch && request.method === 'POST') {
    const id = Number(unsuspendMatch[1]);
    await env.DB.prepare(`UPDATE users SET suspended_until = NULL, suspend_reason = NULL WHERE id = ?`).bind(id).run();
    await logAdminActivity(env, { action: 'user_unsuspended', details: `Foydalanuvchi #${id}`, ip });
    return json({ ok: true });
  }

  const adjustMatch = path.match(/^\/api\/admin\/users\/(\d+)\/adjust-balance$/);
  if (adjustMatch && request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const id = Number(adjustMatch[1]);
    const amount = Math.round(Number(body.amount));
    const note = cleanStr(body.note, 300);
    if (!id || !amount) return json({ error: 'bad_input' }, 422);
    const row = await env.DB.prepare(`UPDATE users SET balance = balance + ? WHERE id = ? RETURNING balance`).bind(amount, id).first();
    if (!row) return json({ error: 'not_found' }, 404);
    await env.DB.prepare(`INSERT INTO transactions (user_id, amount, kind, ref_table, note, created_at) VALUES (?, ?, 'admin_adjust', 'users', ?, ?)`)
      .bind(id, amount, note, nowTs()).run();
    await logAdminActivity(env, { action: 'balance_adjusted', details: `Foydalanuvchi #${id}`, newValue: `${amount > 0 ? '+' : ''}${amount} so'm (${note})`, ip });
    return json({ balance: Number(row.balance) });
  }

  if (path === '/api/admin/activity-log' && request.method === 'GET') {
    if (admin.role !== 'super_admin') return json({ error: 'forbidden' }, 403);
    const rows = await env.DB.prepare(`SELECT id, action, details, old_value, new_value, ip, created_at FROM admin_activity_log ORDER BY created_at DESC LIMIT 200`).all();
    return json({ log: (rows.results || []).map((r) => ({ id: r.id, action: r.action, details: r.details, oldValue: r.old_value, newValue: r.new_value, ip: r.ip, createdAt: r.created_at })) });
  }

  if (path === '/api/admin/login-history' && request.method === 'GET') {
    if (admin.role !== 'super_admin') return json({ error: 'forbidden' }, 403);
    const rows = await env.DB.prepare(`SELECT id, event, ip, user_agent, created_at FROM admin_login_history ORDER BY created_at DESC LIMIT 100`).all();
    return json({ history: (rows.results || []).map((r) => ({ id: r.id, event: r.event, ip: r.ip, userAgent: r.user_agent, createdAt: r.created_at })) });
  }

  // ---------- 2FA (TOTP / Google Authenticator) setup — pure crypto, no
  // bot dependency. The new secret is staged in admin_totp_setup_pending,
  // NOT written to admins.totp_secret, until /confirm proves the admin
  // can produce a code for it. Calling /setup again (a re-scan, or a
  // mistaken click) never disturbs the secret an already-enrolled admin's
  // authenticator app is still using for real logins. ----------
  if (path === '/api/admin/2fa/totp/status' && request.method === 'GET') {
    const row = await env.DB.prepare(`SELECT totp_enabled FROM admins WHERE id = ?`).bind(admin.adminId).first();
    return json({ enabled: !!row?.totp_enabled });
  }
  if (path === '/api/admin/2fa/totp/setup' && request.method === 'POST') {
    const secret = generateTotpSecret();
    const row = await env.DB.prepare(`SELECT phone FROM admins WHERE id = ?`).bind(admin.adminId).first();
    await env.DB.prepare(`INSERT INTO admin_totp_setup_pending (admin_id, secret, created_at) VALUES (?, ?, ?)
      ON CONFLICT(admin_id) DO UPDATE SET secret = excluded.secret, created_at = excluded.created_at`)
      .bind(admin.adminId, secret, nowTs()).run();
    // `secret` is returned ONCE, here, for the QR/manual-key display —
    // never persisted anywhere the UI can re-fetch it later, and never
    // logged (logAdminActivity below only records the *event*, not this
    // value).
    return json({ secret, otpauth: totpAuthUri(secret, row.phone, 'NFCSTORE Admin') });
  }
  if (path === '/api/admin/2fa/totp/confirm' && request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const pending = await env.DB.prepare(`SELECT secret FROM admin_totp_setup_pending WHERE admin_id = ?`).bind(admin.adminId).first();
    if (!pending?.secret) return json({ error: 'not_set_up' }, 422);
    const result = await totpVerify({ secret: pending.secret, token: String(body.code || '').trim() });
    if (!result.valid) return json({ error: 'bad_code' }, 401);
    await env.DB.batch([
      env.DB.prepare(`UPDATE admins SET totp_secret = ?, totp_enabled = 1, totp_last_counter = ? WHERE id = ?`)
        .bind(pending.secret, result.counter, admin.adminId),
      env.DB.prepare(`DELETE FROM admin_totp_setup_pending WHERE admin_id = ?`).bind(admin.adminId),
    ]);
    await logAdminActivity(env, { action: 'totp_enabled', ip });
    return json({ ok: true });
  }
  if (path === '/api/admin/2fa/totp/disable' && request.method === 'POST') {
    await env.DB.batch([
      env.DB.prepare(`UPDATE admins SET totp_enabled = 0, totp_secret = NULL, totp_last_counter = NULL WHERE id = ?`).bind(admin.adminId),
      env.DB.prepare(`DELETE FROM admin_totp_setup_pending WHERE admin_id = ?`).bind(admin.adminId),
    ]);
    await logAdminActivity(env, { action: 'totp_disabled', ip });
    return json({ ok: true });
  }

  if (path === '/api/admin/admins' && request.method === 'GET') {
    if (admin.role !== 'super_admin') return json({ error: 'forbidden' }, 403);
    const rows = await env.DB.prepare(`SELECT id, phone, name, role, totp_enabled, created_at FROM admins ORDER BY created_at DESC`).all();
    return json({ admins: (rows.results || []).map((r) => ({ id: r.id, phone: r.phone, name: r.name, role: r.role, totpEnabled: !!r.totp_enabled, createdAt: r.created_at })) });
  }
  if (path === '/api/admin/admins' && request.method === 'POST') {
    if (admin.role !== 'super_admin') return json({ error: 'forbidden' }, 403);
    const body = await request.json().catch(() => ({}));
    const phone = cleanStr(body.phone, 20);
    const password = String(body.password || '');
    const name = cleanStr(body.name, 60);
    const role = ['super_admin', 'manager', 'content_manager'].includes(body.role) ? body.role : 'manager';
    if (!phone || password.length < 6) return json({ error: 'bad_input' }, 422);
    try {
      await env.DB.prepare(`INSERT INTO admins (phone, password_hash, name, role, created_at) VALUES (?, ?, ?, ?, ?)`)
        .bind(phone, await hashPassword(password), name, role, nowTs()).run();
    } catch { return json({ error: 'phone_taken' }, 409); }
    await logAdminActivity(env, { action: 'admin_created', details: `${phone} (${role})`, ip });
    return json({ ok: true }, 201);
  }
  const removeAdminMatch = path.match(/^\/api\/admin\/admins\/(\d+)\/remove$/);
  if (removeAdminMatch && request.method === 'POST') {
    if (admin.role !== 'super_admin') return json({ error: 'forbidden' }, 403);
    const id = Number(removeAdminMatch[1]);
    if (id === admin.adminId) return json({ error: 'cannot_remove_self' }, 400);
    await env.DB.prepare(`DELETE FROM admins WHERE id = ?`).bind(id).run();
    await logAdminActivity(env, { action: 'admin_removed', details: `ID: ${id}`, ip });
    return json({ ok: true });
  }

  return null;
}
// ---------- admin: auctions (the feature this whole migration pass exists to fix) ----------

const ADMIN_AUCTION_MAX_HOURS = 72;

async function adminAuctionRow(env, r) {
  const su = r.seller_id ? await env.DB.prepare(`SELECT email FROM users WHERE id = ?`).bind(r.seller_id).first() : null;
  const hu = r.highest_bidder_id ? await env.DB.prepare(`SELECT email FROM users WHERE id = ?`).bind(r.highest_bidder_id).first() : null;
  return {
    id: r.id, code: r.code, sellerId: r.seller_id, sellerEmail: su?.email || null,
    startPrice: Number(r.start_price), buyNowPrice: r.buy_now_price == null ? null : Number(r.buy_now_price),
    currentPrice: Number(r.current_price), highestBidderId: r.highest_bidder_id, highestBidderEmail: hu?.email || null,
    endsAt: r.ends_at, status: r.status, createdAt: r.created_at, paymentDeadline: r.payment_deadline,
    sellerPayoutAmount: r.seller_payout_amount == null ? null : Number(r.seller_payout_amount),
    sellerPayoutStatus: r.seller_payout_status, sellerPaymeNumber: r.seller_payme_number,
  };
}

async function adminAuctionsApi(request, env, url, admin) {
  const path = url.pathname;
  const ip = reqIp(request);

  if (path === '/api/admin/auctions' && request.method === 'GET') {
    const rows = await env.DB.prepare(`SELECT * FROM auctions ORDER BY created_at DESC LIMIT 100`).all();
    const auctions = await Promise.all((rows.results || []).map((r) => adminAuctionRow(env, r)));
    return json({ auctions });
  }

  if (path === '/api/admin/auctions' && request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const code = String(body.code || '').toUpperCase().trim();
    const startPrice = Math.round(Number(body.startPrice));
    const buyNowPrice = body.buyNowPrice ? Math.round(Number(body.buyNowPrice)) : null;
    const hours = Math.min(ADMIN_AUCTION_MAX_HOURS, Math.max(1, Math.round(Number(body.hours) || 24)));
    const minStep = body.minStep ? Math.round(Number(body.minStep)) : 25000;
    if (!/^[A-Z0-9]{3,16}$/.test(code) || isBlockedCode(code)) return json({ error: 'bad_code' }, 422);
    if (!startPrice || startPrice < 10_000) return json({ error: 'bad_input' }, 422);
    if (buyNowPrice && buyNowPrice <= startPrice) return json({ error: 'buy_now_too_low' }, 422);
    if (minStep < 1_000) return json({ error: 'bad_input' }, 422);
    if (await env.DB.prepare(`SELECT 1 FROM cards WHERE code = ?`).bind(code).first()) return json({ error: 'code_taken' }, 409);
    if (await env.DB.prepare(`SELECT 1 FROM auctions WHERE code = ? AND status = 'active'`).bind(code).first()) return json({ error: 'already_in_auction' }, 409);
    const endsAt = new Date(Date.now() + hours * 3600_000).toISOString();
    const auction = await env.DB.prepare(
      `INSERT INTO auctions (code, seller_id, start_price, buy_now_price, current_price, ends_at, created_by_admin, min_increment, created_at)
       VALUES (?, NULL, ?, ?, ?, ?, 1, ?, ?) RETURNING *`
    ).bind(code, startPrice, buyNowPrice, startPrice, endsAt, minStep, nowTs()).first();
    await env.DB.prepare(`UPDATE auction_demand SET status = 'auction_live', auction_id = ? WHERE code = ? AND status IN ('collecting','ready')`)
      .bind(auction.id, code).run().catch(() => {});
    await logAdminActivity(env, { action: 'auction_created', details: `Kod: ${code}`, newValue: `Boshlang'ich: ${startPrice} so'm, ${hours} soat`, ip });
    return json(await adminAuctionRow(env, auction), 201);
  }

  const cancelMatch = path.match(/^\/api\/admin\/auctions\/(\d+)\/cancel$/);
  if (cancelMatch && request.method === 'POST') {
    const id = Number(cancelMatch[1]);
    const body = await request.json().catch(() => ({}));
    const auction = await env.DB.prepare(`SELECT id, status FROM auctions WHERE id = ?`).bind(id).first();
    if (!auction || auction.status !== 'active') return json({ error: 'cannot_cancel' }, 409);
    const bids = await env.DB.prepare(`SELECT user_id, MAX(amount) AS amount FROM bids WHERE auction_id = ? GROUP BY user_id`).bind(id).all();
    const writes = [
      env.DB.prepare(`UPDATE auctions SET status = 'cancelled' WHERE id = ? AND status = 'active'`).bind(id),
    ];
    for (const b of bids.results || []) {
      writes.push(env.DB.prepare(`UPDATE users SET held_balance = held_balance - ? WHERE id = ?`).bind(Number(b.amount), b.user_id));
      writes.push(env.DB.prepare(`INSERT INTO transactions (user_id, amount, kind, ref_table, ref_id, note, created_at) VALUES (?, 0, 'bid_release', 'auctions', ?, ?, ?)`)
        .bind(b.user_id, id, body.note || "Admin auksionni bekor qildi — mablag' bo'shatildi", nowTs()));
    }
    await env.DB.batch(writes);
    await logAdminActivity(env, { action: 'auction_cancelled', details: `Auksion #${id}`, ip });
    return json({ ok: true });
  }

  const settleMatch = path.match(/^\/api\/admin\/auctions\/(\d+)\/force-settle$/);
  if (settleMatch && request.method === 'POST') {
    const id = Number(settleMatch[1]);
    const auction = await env.DB.prepare(`SELECT id, highest_bidder_id, status FROM auctions WHERE id = ?`).bind(id).first();
    if (!auction || auction.status !== 'active') return json({ error: 'cannot_settle' }, 409);
    if (auction.highest_bidder_id) {
      const deadline = new Date(Date.now() + 24 * 3600_000).toISOString();
      await env.DB.prepare(`UPDATE auctions SET status = 'awaiting_payment', payment_deadline = ? WHERE id = ? AND status = 'active'`).bind(deadline, id).run();
      await logAdminActivity(env, { action: 'auction_force_settled', details: `Auksion #${id} — to'lov kutilmoqda`, ip });
      return json({ awaitingPayment: true });
    }
    await env.DB.prepare(`UPDATE auctions SET status = 'expired' WHERE id = ? AND status = 'active'`).bind(id).run();
    await logAdminActivity(env, { action: 'auction_force_settled', details: `Auksion #${id} — g'olibsiz tugadi`, ip });
    return json({ expired: true });
  }

  // Winner payment confirmation depends on the Payme webhook order flow
  // (task list: Payme port) — until then there is never a pending payment
  // order to confirm, so this correctly reports "none" rather than
  // guessing at a fabricated success.
  const confirmMatch = path.match(/^\/api\/admin\/auctions\/(\d+)\/confirm-payment$/);
  if (confirmMatch && request.method === 'POST') return json({ error: 'no_pending_payment' }, 409);

  const payoutMatch = path.match(/^\/api\/admin\/auctions\/(\d+)\/mark-payout-paid$/);
  if (payoutMatch && request.method === 'POST') {
    const id = Number(payoutMatch[1]);
    const row = await env.DB.prepare(`UPDATE auctions SET seller_payout_status = 'paid' WHERE id = ? AND seller_payout_status = 'pending' RETURNING id`).bind(id).first();
    if (!row) return json({ error: 'cannot_mark_paid' }, 409);
    await logAdminActivity(env, { action: 'auction_payout_marked_paid', details: `Auksion #${id}`, ip });
    return json({ ok: true });
  }

  // ---------- auction requests ("please auction this code") ----------
  if (path === '/api/admin/auction-requests' && request.method === 'GET') {
    const rows = await env.DB.prepare(
      `SELECT ar.id, ar.code, ar.note, ar.status, ar.created_at, u.id AS user_id, u.email AS user_email,
              (SELECT c.code FROM cards c WHERE c.user_id = u.id ORDER BY c.is_primary DESC, c.ts ASC LIMIT 1) AS user_code
       FROM auction_requests ar JOIN users u ON u.id = ar.user_id WHERE ar.status = 'pending' ORDER BY ar.created_at DESC`
    ).all();
    return json({
      requests: (rows.results || []).map((r) => ({
        id: r.id, code: r.code, note: r.note, status: r.status, createdAt: r.created_at,
        userId: r.user_id, userEmail: r.user_email, userCode: r.user_code || null,
      })),
    });
  }
  const rejectReqMatch = path.match(/^\/api\/admin\/auction-requests\/(\d+)\/reject$/);
  if (rejectReqMatch && request.method === 'POST') {
    const row = await env.DB.prepare(`UPDATE auction_requests SET status = 'rejected' WHERE id = ? AND status = 'pending' RETURNING id`).bind(Number(rejectReqMatch[1])).first();
    if (!row) return json({ error: 'not_found' }, 404);
    return json({ ok: true });
  }
  const approveReqMatch = path.match(/^\/api\/admin\/auction-requests\/(\d+)\/approve$/);
  if (approveReqMatch && request.method === 'POST') {
    const approved = await env.DB.prepare(`UPDATE auction_requests SET status = 'approved' WHERE id = ? AND status = 'pending' RETURNING id, code`).bind(Number(approveReqMatch[1])).first();
    if (!approved) return json({ error: 'not_found' }, 404);
    if (await env.DB.prepare(`SELECT 1 FROM cards WHERE code = ?`).bind(approved.code).first()) return json({ error: 'code_taken' }, 409);
    let row = await env.DB.prepare(
      `INSERT INTO auction_demand (code, created_at) VALUES (?, ?) ON CONFLICT(code) DO NOTHING RETURNING *`
    ).bind(approved.code, nowTs()).first();
    if (!row) row = await env.DB.prepare(`SELECT * FROM auction_demand WHERE code = ?`).bind(approved.code).first();
    await logAdminActivity(env, { action: 'auction_demand_added', details: approved.code, ip });
    return json(demandRow(row), 201);
  }

  // ---------- "Talab" (demand) board ----------
  if (path === '/api/admin/auction-demand' && request.method === 'GET') {
    const rows = await env.DB.prepare(
      `SELECT * FROM auction_demand ORDER BY
         CASE status WHEN 'ready' THEN 0 WHEN 'collecting' THEN 1 WHEN 'auction_live' THEN 2 WHEN 'done' THEN 3 ELSE 4 END,
         interest_count DESC, created_at DESC`
    ).all();
    return json({ demand: (rows.results || []).map(demandRow) });
  }
  if (path === '/api/admin/auction-demand' && request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const code = String(body.code || '').toUpperCase().trim();
    if (!/^[A-Z0-9]{3,16}$/.test(code) || isBlockedCode(code)) return json({ error: 'bad_code' }, 422);
    if (await env.DB.prepare(`SELECT 1 FROM cards WHERE code = ?`).bind(code).first()) return json({ error: 'code_taken' }, 409);
    const startPrice = Math.max(10000, Math.round(Number(body.startPrice) || 250000));
    const minStep = Math.max(1000, Math.round(Number(body.minStep) || 25000));
    const row = await env.DB.prepare(
      `INSERT INTO auction_demand (code, suggested_start_price, suggested_min_step, created_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(code) DO NOTHING RETURNING *`
    ).bind(code, startPrice, minStep, nowTs()).first();
    if (!row) return json({ error: 'already_exists' }, 409);
    await logAdminActivity(env, { action: 'auction_demand_added', details: code, ip });
    return json(demandRow(row), 201);
  }
  const patchDemandMatch = path.match(/^\/api\/admin\/auction-demand\/(\d+)$/);
  if (patchDemandMatch && request.method === 'PATCH') {
    const id = Number(patchDemandMatch[1]);
    const body = await request.json().catch(() => ({}));
    const sets = [];
    const vals = [];
    if (['collecting', 'ready', 'hidden', 'done'].includes(body.status)) { sets.push('status = ?'); vals.push(body.status); }
    if (body.startPrice != null) { sets.push('suggested_start_price = ?'); vals.push(Math.max(10000, Math.round(Number(body.startPrice)))); }
    if (body.minStep != null) { sets.push('suggested_min_step = ?'); vals.push(Math.max(1000, Math.round(Number(body.minStep)))); }
    if (!sets.length) return json({ error: 'not_found' }, 404);
    vals.push(id);
    const row = await env.DB.prepare(`UPDATE auction_demand SET ${sets.join(', ')} WHERE id = ? RETURNING *`).bind(...vals).first();
    if (!row) return json({ error: 'not_found' }, 404);
    return json(demandRow(row));
  }
  if (patchDemandMatch && request.method === 'DELETE') {
    const row = await env.DB.prepare(`DELETE FROM auction_demand WHERE id = ? RETURNING id`).bind(Number(patchDemandMatch[1])).first();
    if (!row) return json({ error: 'not_found' }, 404);
    return json({ ok: true });
  }

  return null;
}

// ---------- signed-in user endpoints ported from server/index.js ----------
async function userAccountApi(request, env, url) {
  const path = url.pathname;
  const user = await getCurrentUser(request, env);

  if (path === '/api/conversations/unread-count' && request.method === 'GET') {
    if (!user) return json({ count: 0 });
    const row = await env.DB.prepare(`SELECT COUNT(*) AS n FROM messages m JOIN conversations c ON c.id = m.conversation_id
      WHERE (c.user_a_id = ? OR c.user_b_id = ?) AND m.sender_id != ? AND m.is_read = 0`).bind(user.id, user.id, user.id).first();
    return json({ count: Number(row?.n || 0) });
  }

  if (path === '/api/gift-offers' && request.method === 'GET') {
    if (!user) return json({ incoming: [], outgoing: [] });
    const [incoming, outgoing] = await Promise.all([
      env.DB.prepare(`SELECT g.id, g.code, g.created_at, u.email AS from_email FROM gift_offers g JOIN users u ON u.id = g.from_user_id WHERE g.to_user_id = ? AND g.status = 'pending' ORDER BY g.created_at DESC`).bind(user.id).all(),
      env.DB.prepare(`SELECT g.id, g.code, g.created_at, u.email AS to_email FROM gift_offers g JOIN users u ON u.id = g.to_user_id WHERE g.from_user_id = ? AND g.status = 'pending' ORDER BY g.created_at DESC`).bind(user.id).all(),
    ]);
    return json({
      incoming: (incoming.results || []).map((r) => ({ id: r.id, code: r.code, createdAt: r.created_at, fromEmail: r.from_email })),
      outgoing: (outgoing.results || []).map((r) => ({ id: r.id, code: r.code, createdAt: r.created_at, toEmail: r.to_email })),
    });
  }

  const giftAction = path.match(/^\/api\/gift-offers\/(\d+)\/(accept|reject|cancel)$/);
  if (giftAction && request.method === 'POST') {
    if (!user) return json({ error: 'unauthorized' }, 401);
    const id = Number(giftAction[1]); const action = giftAction[2];
    const offer = await env.DB.prepare(`SELECT id, code, from_user_id, to_user_id FROM gift_offers WHERE id = ? AND status = 'pending'`).bind(id).first();
    if (!offer) return json({ error: 'not_found' }, 404);
    if (action === 'cancel') {
      if (Number(offer.from_user_id) !== Number(user.id)) return json({ error: 'forbidden' }, 403);
      await env.DB.prepare(`UPDATE gift_offers SET status = 'cancelled', decided_at = ? WHERE id = ? AND status = 'pending'`).bind(nowTs(), id).run();
      return json({ ok: true });
    }
    if (Number(offer.to_user_id) !== Number(user.id)) return json({ error: 'forbidden' }, 403);
    if (action === 'reject') {
      await env.DB.prepare(`UPDATE gift_offers SET status = 'rejected', decided_at = ? WHERE id = ? AND status = 'pending'`).bind(nowTs(), id).run();
      return json({ ok: true });
    }
    const results = await env.DB.batch([
      env.DB.prepare(`UPDATE cards SET user_id = ?, is_primary = 0 WHERE code = ? AND user_id = ?`).bind(user.id, offer.code, offer.from_user_id),
      env.DB.prepare(`UPDATE gift_offers SET status = 'accepted', decided_at = ? WHERE id = ? AND status = 'pending'`).bind(nowTs(), id),
    ]);
    if (!results[0]?.meta?.changes) return json({ error: 'OWNERSHIP_CHANGED' }, 409);
    return json({ ok: true, code: offer.code });
  }

  if (path === '/api/auctions/won/pending' && request.method === 'GET') {
    if (!user) return json({ error: 'unauthorized' }, 401);
    const rows = await env.DB.prepare(`SELECT id, code, current_price, payment_deadline FROM auctions WHERE highest_bidder_id = ? AND status = 'awaiting_payment' ORDER BY payment_deadline`).bind(user.id).all();
    return json({ auctions: (rows.results || []).map((r) => ({ id: r.id, code: r.code, currentPrice: Number(r.current_price), paymentDeadline: r.payment_deadline })) });
  }

  if (path === '/api/referrals' && request.method === 'GET') {
    if (!user) return json({ referrals: [] });
    const rows = await env.DB.prepare(`SELECT r.id, r.created_at, u.email AS referred_email FROM referral_uses r JOIN users u ON u.id = r.referred_id WHERE r.referrer_id = ? ORDER BY r.created_at DESC`).bind(user.id).all();
    return json({ referrals: (rows.results || []).map((r) => ({ id: r.id, createdAt: r.created_at, referredEmail: r.referred_email })) });
  }

  // NOTE: GET /api/orders and GET /api/orders/:id are intentionally NOT
  // duplicated here — ordersApi() (Payme Phase 2B, below) is the single
  // source of truth for both, already tested against the exact same
  // contract this function used to reimplement (production-drift
  // integration: see coreApi's dispatch order — orders/:id routes there).
  return null;
}

// ---------- followers (mirrors server/db.js followUserFree / unfollowUser /
// getFollowStats / listFollowers / listFollowing — see server/index.js for
// the original Express routes this replaces). Follow is always free (no
// premium/paid tier here); "paid"/"amount" columns are kept only for schema
// parity with the legacy Postgres table and are always written as 0/false.
// Only public fields are ever returned in the list: code, name, avatarUrl,
// verified — never email/phone.

// D1/SQLite has no DISTINCT ON, so de-duplicating a followed/follower user
// down to their one preferred (primary, then oldest) non-hidden card uses a
// ROW_NUMBER() window function instead — same end result as the Postgres
// "DISTINCT ON (u.id) ... ORDER BY u.id, c.is_primary DESC, c.ts ASC".
async function followListRows(env, ownerId, dir) {
  const wantFollowing = dir === 'following';
  // followers: kim ownerId'ga obuna bo'lgan -> u = follower_id tomon, WHERE followee_id = ownerId
  // following: ownerId kimga obuna bo'lgan  -> u = followee_id tomon, WHERE follower_id = ownerId
  // (joinCol/whereCol faqat shu ikkita qattiq-kodlangan qiymatdan biri bo'ladi — foydalanuvchi
  // kiritgan `dir` to'g'ridan-to'g'ri SQL'ga qo'yilmaydi, shuning uchun injection xavfi yo'q.)
  const joinCol = wantFollowing ? 'fw.followee_id' : 'fw.follower_id';
  const whereCol = wantFollowing ? 'fw.follower_id' : 'fw.followee_id';
  const rows = await env.DB.prepare(`
    WITH ranked AS (
      SELECT u.id AS uid, c.code AS code, c.name AS name, c.avatar_url AS avatar_url, c.verified AS verified,
             ROW_NUMBER() OVER (PARTITION BY u.id ORDER BY c.is_primary DESC, c.ts ASC) AS rn
      FROM follows fw
      JOIN users u ON u.id = ${joinCol}
      JOIN cards c ON c.user_id = u.id AND c.hidden_from_directory = 0
      WHERE ${whereCol} = ?
    )
    SELECT code, name, avatar_url, verified FROM ranked WHERE rn = 1 ORDER BY uid LIMIT 200
  `).bind(ownerId).all();
  return (rows.results || []).map((r) => ({
    code: r.code, name: r.name, avatarUrl: r.avatar_url || '', verified: !!r.verified,
  }));
}

async function getFollowStatsRow(env, userId, viewerId) {
  const row = await env.DB.prepare(`
    SELECT
      (SELECT COUNT(*) FROM follows WHERE followee_id = ?) AS followers,
      (SELECT COUNT(*) FROM follows WHERE follower_id = ?) AS following,
      (SELECT EXISTS(SELECT 1 FROM follows WHERE follower_id = ? AND followee_id = ?)) AS is_following
  `).bind(userId, userId, viewerId || -1, userId).first();
  return {
    followers: Number(row?.followers || 0),
    following: Number(row?.following || 0),
    isFollowing: !!(row && row.is_following),
  };
}

async function followApi(request, env, url) {
  const path = url.pathname;

  const followMatch = path.match(/^\/api\/follow\/([A-Za-z0-9]{1,32})$/);
  if (followMatch && request.method === 'POST') {
    const user = await getCurrentUser(request, env);
    if (!user) return json({ error: 'unauthorized' }, 401);
    const code = decodeURIComponent(followMatch[1]).toUpperCase();
    const ownerId = await getRecordOwner(env, code);
    if (!ownerId) return json({ error: 'NOT_FOUND' }, 404);
    // O'zini follow qilishni taqiqlash — ALWAYS FIRST, xuddi eski
    // followUserFree(followerId, followeeId) tartibi kabi.
    if (Number(ownerId) === Number(user.id)) return json({ error: 'CANNOT_FOLLOW_SELF' }, 409);
    const already = await env.DB.prepare(`SELECT id FROM follows WHERE follower_id = ? AND followee_id = ?`)
      .bind(user.id, ownerId).first();
    if (already) return json({ error: 'ALREADY_FOLLOWING' }, 409);
    try {
      await env.DB.prepare(`INSERT INTO follows (follower_id, followee_id, paid, amount) VALUES (?, ?, 0, 0)`)
        .bind(user.id, ownerId).run();
    } catch (err) {
      // UNIQUE(follower_id, followee_id) — bir vaqtda yuborilgan ikkita
      // so'rov (parallel double-click) uchun ham xavfsiz: duplicate qator
      // yaratilmaydi, foydalanuvchiga oddiy ALREADY_FOLLOWING qaytadi.
      if (String((err && err.message) || '').toLowerCase().includes('unique')) {
        return json({ error: 'ALREADY_FOLLOWING' }, 409);
      }
      throw err;
    }
    return json({ ok: true, paid: false });
  }

  const unfollowMatch = path.match(/^\/api\/unfollow\/([A-Za-z0-9]{1,32})$/);
  if (unfollowMatch && request.method === 'POST') {
    const user = await getCurrentUser(request, env);
    if (!user) return json({ error: 'unauthorized' }, 401);
    const code = decodeURIComponent(unfollowMatch[1]).toUpperCase();
    const ownerId = await getRecordOwner(env, code);
    if (!ownerId) return json({ error: 'NOT_FOUND' }, 404);
    // Obuna mavjud bo'lmasa ham DELETE shunchaki 0 qator o'chiradi va xato
    // bermaydi — eski server/index.js bilan bir xil xulq (duplicate
    // unfollow xavfsiz).
    await env.DB.prepare(`DELETE FROM follows WHERE follower_id = ? AND followee_id = ?`)
      .bind(user.id, ownerId).run();
    return json({ ok: true });
  }

  const statsMatch = path.match(/^\/api\/follow-stats\/([A-Za-z0-9]{1,32})$/);
  if (statsMatch && request.method === 'GET') {
    const code = decodeURIComponent(statsMatch[1]).toUpperCase();
    const ownerId = await getRecordOwner(env, code);
    if (!ownerId) return json({ followers: 0, following: 0, isFollowing: false });
    const user = await getCurrentUser(request, env);
    return json(await getFollowStatsRow(env, ownerId, user?.id));
  }

  const listMatch = path.match(/^\/api\/follow-list\/([A-Za-z0-9]{1,32})$/);
  if (listMatch && request.method === 'GET') {
    const code = decodeURIComponent(listMatch[1]).toUpperCase();
    const ownerId = await getRecordOwner(env, code);
    if (!ownerId) return json({ list: [] });
    const dir = url.searchParams.get('dir') === 'following' ? 'following' : 'followers';
    try {
      const list = await followListRows(env, ownerId, dir);
      return json({ list });
    } catch (err) {
      console.error('[worker] follow-list:', err.message);
      return json({ list: [] });
    }
  }

  return null;
}

// ---------- top-level dispatcher for everything in this section ----------
// Returns a Response for anything it recognizes, or null to fall through
// to the legacy proxy (for routes not yet ported — see the task list at
// the top of this section).
async function coreApi(request, env, url) {
  await ensureCoreSchema(env);

  if (url.pathname === '/api/conversations/unread-count' || url.pathname.startsWith('/api/gift-offers')
    || url.pathname === '/api/auctions/won/pending' || url.pathname === '/api/referrals') {
    const res = await userAccountApi(request, env, url);
    if (res) return res;
  }

  if (url.pathname.startsWith('/api/auth/')) {
    const res = await authApi(request, env, url);
    if (res) return res;
  }
  if (url.pathname.startsWith('/api/records')) {
    const res = await recordsApi(request, env, url);
    if (res) return res;
  }
  if (url.pathname.startsWith('/api/orders')) {
    const res = await ordersApi(request, env, url);
    if (res) return res;
  }
  if (url.pathname === '/api/pay/payme' && request.method === 'POST') {
    // Payme Merchant API — server/index.js'dagi POST /api/pay/payme bilan
    // AYNAN bir xil kontrakt/tartib (payments o'chiq -> keyin Basic Auth ->
    // keyin metod). Basic Auth: login "Paycom", parol env.PAYME_KEY.
    // Kredentsial hech qachon kodga yozilmaydi, faqat Worker Secret
    // sifatida (`wrangler secret put PAYME_KEY`) beriladi — bu commit'da
    // qo'shilmagan.
    let body;
    let parseFailed = false;
    try { body = await request.json(); } catch { body = null; parseFailed = true; }
    if (!paymentsEnabledD1(env)) {
      return json({ jsonrpc: '2.0', id: body?.id ?? null, error: { code: -32601, message: 'payme disabled' } });
    }
    if (!verifyPaymeAuthD1(request, env)) {
      return json({ jsonrpc: '2.0', id: body?.id ?? null, error: { code: -32504, message: "Ruxsat yo'q" } });
    }
    // -32700 (JSON parse error) — Payme's own documented code for a
    // malformed request body, distinct from -32601 (method not found),
    // which handlePaymeRequestD1() below would otherwise return for it
    // (an unparseable body has no `.method` either).
    if (parseFailed) {
      return json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
    }
    const result = await handlePaymeRequestD1(env, body);
    return json(result);
  }
  if (url.pathname.startsWith('/api/auction') || url.pathname === '/api/auctions') {
    const res = await auctionsPublicApi(request, env, url);
    if (res) return res;
  }
  if (url.pathname.startsWith('/api/follow') || url.pathname.startsWith('/api/unfollow')) {
    const res = await followApi(request, env, url);
    if (res) return res;
  }
  if (url.pathname.startsWith('/api/admin/')) {
    const authRes = await adminAuthApi(request, env, url);
    if (authRes) return authRes;
    // Every other /api/admin/* route requires a valid session AND (if
    // enabled) an IP still on the whitelist — checked separately from
    // requireAdmin() here so a blocked-but-otherwise-valid session gets
    // the specific, actionable reason (matches legacy server/admin.js's
    // checkIpWhitelist behavior exactly).
    const sessionAdmin = await getCurrentAdmin(request, env);
    if (!sessionAdmin || sessionAdmin.idleTimeout) return json({ error: 'unauthorized' }, 401);
    if (!(await checkIpWhitelist(request, env, reqIp(request)))) {
      await logAdminLoginEvent(env, 'ip_blocked', reqIp(request), request.headers.get('user-agent'));
      return json({ error: 'ip_not_whitelisted' }, 403);
    }
    const admin = sessionAdmin;
    const auctionRes = await adminAuctionsApi(request, env, url, admin);
    if (auctionRes) return auctionRes;
    const coreRes = await adminCoreApi(request, env, url, admin);
    if (coreRes) return coreRes;
    // Recognized /api/admin/* prefix but no matching route below — do NOT
    // fall through to the dead Railway proxy for admin paths (that would
    // silently 503 with a confusing "upstream unavailable"); the ported
    // surface is intentionally partial (see task list), so say so plainly.
    return json({ error: 'not_yet_migrated' }, 501);
  }
  return null;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    const catalogMatch = url.pathname.match(/^\/api\/catalog-meta\/([^/]+)(?:\/items\/([^/]+)\/(view|reaction|promotion))?$/);
    if (catalogMatch) {
      try {
        return await catalogMeta(request, env, url, catalogMatch);
      } catch (error) {
        return json({ error: error?.message === 'd1_unavailable' ? 'd1_unavailable' : 'catalog_meta_unavailable' }, 503);
      }
    }

    if (request.method === 'POST'
      && ['/api/upload', '/api/upload-audio', '/api/upload-card-video', '/api/admin/upload'].includes(url.pathname)) {
      try {
        return await uploadApi(request, env, url.pathname);
      } catch (error) {
        console.error('r2 upload api', error);
        return json({ error: error?.message === 'r2_unavailable' ? 'r2_unavailable' : 'upload_failed' }, 500);
      }
    }

    if (url.pathname.startsWith('/uploads/') && ['GET', 'HEAD'].includes(request.method)) {
      try {
        const res = await serveUpload(request, env, url);
        if (res) return res;
      } catch (error) {
        console.error('r2 read', error);
      }
      return json({ error: 'not_found' }, 404);
    }

    // Checked BEFORE the generic /api/companies/:id dispatch below —
    // "search" would otherwise match that route's company-id shape
    // (3-15 letters) and be misread as a literal company ID.
    if (url.pathname === '/api/companies/search' || url.pathname === '/api/categories'
      || url.pathname === '/api/news' || url.pathname.startsWith('/api/tap/')
      || url.pathname === '/api/settings/physical-nfc-pricing'
      || url.pathname === '/api/settings/payments-enabled') {
      try {
        const res = await publicContentApi(request, env, url);
        if (res) return res;
      } catch (error) {
        console.error('public content api', error);
        return json({ error: error?.message === 'd1_unavailable' ? 'd1_unavailable' : 'public_content_unavailable' }, 503);
      }
    }

    if (url.pathname === '/api/companies' || url.pathname.startsWith('/api/companies/')) {
      try { return await companyApi(request, env, url); }
      catch (error) {
        console.error('company api', error);
        return json({ error: error?.message === 'd1_unavailable' ? 'd1_unavailable' : 'company_api_unavailable' }, 503);
      }
    }

    if (url.pathname === '/api/admin/company-requests' || url.pathname.startsWith('/api/admin/company-requests/') || url.pathname === '/api/admin/company-id-rules') {
      try { return await companyAdminApi(request, env, url); }
      catch (error) {
        console.error('company admin api', error);
        return json({ error: error?.message === 'd1_unavailable' ? 'd1_unavailable' : 'company_admin_unavailable' }, 503);
      }
    }

    // NEW — auth/records/auctions/admin/orders/pay(Payme)/follow/account-gift
    // now served directly from D1 (see the CORE section above). Falls
    // through (returns null) for anything not yet ported, so the legacy
    // proxy below still handles it.
    if (url.pathname.startsWith('/api/auth/') || url.pathname.startsWith('/api/records')
      || url.pathname.startsWith('/api/auction') || url.pathname.startsWith('/api/admin/')
      || url.pathname.startsWith('/api/orders') || url.pathname === '/api/pay/payme'
      || url.pathname === '/api/conversations/unread-count' || url.pathname.startsWith('/api/gift-offers')
      || url.pathname === '/api/referrals' || url.pathname === '/api/auctions/won/pending'
      || url.pathname.startsWith('/api/follow') || url.pathname.startsWith('/api/unfollow')) {
      try {
        const coreRes = await coreApi(request, env, url);
        if (coreRes) return coreRes;
      } catch (error) {
        console.error('core api', error);
        return json({ error: error?.message === 'd1_unavailable' ? 'd1_unavailable' : 'core_api_unavailable' }, 503);
      }
    }

    // LEGACY FALLBACK — the Railway PostgreSQL backend this used to proxy
    // everything to has been shut down. Auth/records/auctions/admin/
    // orders/Payme (NFC ID purchase — card_purchase kind only, Phase 2B)/
    // follow/account-gift cluster/uploads (R2) are now served directly
    // above; this only still catches what hasn't been ported yet (the
    // Telegram bot, premium upgrade, messaging, physical cards, news,
    // company extras, and every web_orders kind besides card_purchase —
    // see the task list at the top of the CORE section) and will
    // correctly report them as unavailable rather than silently doing
    // nothing. NOTE: /uploads/* is intentionally NOT included here any
    // more — it used to self-proxy to this same Worker's own domain
    // (nfcstore.uz/uploads/*, which this Worker itself serves in
    // production), which would have been a dead/broken loop once the
    // Railway upstream it was written for went away; R2 above is now the
    // real source of truth for it.
    if (url.pathname.startsWith('/api/') || url.pathname === '/api') {
      const upstreamUrl = new URL(url.pathname + url.search, 'https://nfcstore.uz');
      const upstreamRequest = new Request(upstreamUrl, request);
      try {
        return await fetch(upstreamRequest);
      } catch {
        return json({ error: 'api_upstream_unavailable' }, 503);
      }
    }

    let response = await env.ASSETS.fetch(request);
    const acceptsHtml = request.headers.get('accept')?.includes('text/html');
    if (response.status === 404 && request.method === 'GET' && acceptsHtml) {
      // Fetching /index.html directly is canonicalized to `/` by the asset
      // service and would erase the SPA route. Fetch `/` internally instead;
      // the returned HTML is served for the original browser URL.
      const shellUrl = new URL('/', url);
      response = await env.ASSETS.fetch(new Request(shellUrl, request));
    }
    return response;
  },
};
