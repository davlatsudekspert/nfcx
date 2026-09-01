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

function upstreamHeaders(request) {
  const headers = new Headers();
  for (const name of ['cookie', 'user-agent', 'accept-language', 'content-type']) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  return headers;
}

async function upstreamUser(request) {
  try {
    const response = await fetch(new Request('https://nfcstore.uz/api/auth/me', { headers: upstreamHeaders(request) }));
    const payload = response.ok ? await response.json() : null;
    return payload?.user ? { user: payload.user, cards: Array.isArray(payload.cards) ? payload.cards : [] } : null;
  } catch { return null; }
}

async function upstreamAdmin(request) {
  try {
    const response = await fetch(new Request('https://nfcstore.uz/api/admin/me', { headers: upstreamHeaders(request) }));
    const payload = response.ok ? await response.json() : null;
    return payload?.authenticated ? payload : null;
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
  const auth = await upstreamUser(request);
  if (!auth) return { error: json({ error: 'unauthorized' }, 401) };
  const row = await env.DB.prepare('SELECT * FROM companies WHERE company_id = ?').bind(id).first();
  if (!row) return { error: json({ error: 'not_found' }, 404) };
  if (String(row.owner_user_id) !== String(auth.user.id)) return { error: json({ error: 'forbidden' }, 403) };
  return { auth, row };
}

async function companyApi(request, env, url) {
  await ensureCompanySchema(env);
  const path = url.pathname;

  if (path === '/api/companies/check' && request.method === 'GET') {
    return json(await companyAvailability(env, url.searchParams.get('id')));
  }

  if (path === '/api/companies/mine' && request.method === 'GET') {
    const auth = await upstreamUser(request);
    if (!auth) return json({ error: 'unauthorized' }, 401);
    const rows = await env.DB.prepare('SELECT * FROM companies WHERE owner_user_id = ? ORDER BY created_at DESC').bind(String(auth.user.id)).all();
    return json({ companies: (rows.results || []).map((row) => rowCompany(row)) });
  }

  if (path === '/api/companies' && request.method === 'POST') {
    const auth = await upstreamUser(request);
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
      const auth = await upstreamUser(request);
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
  const admin = await upstreamAdmin(request);
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

    // Sites serves the frontend while the established PostgreSQL-backed
    // NFCSTORE service remains the single source of truth for profiles,
    // gifts, auctions and authentication. Proxying keeps the browser on one
    // origin and preserves the existing API contract instead of creating a
    // second, empty demo database.
    if (url.pathname.startsWith('/api/') || url.pathname === '/api' || url.pathname.startsWith('/uploads/')) {
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
