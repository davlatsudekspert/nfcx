import * as apiAuth from './api/auth.js';
import * as apiAccount from './api/account.js';
import * as apiCatalog from './api/catalog.js';
import * as apiMedia from './api/media.js';
import * as apiEngagement from './api/engagement.js';
import * as apiAdminExtra from './api/admin-extra.js';
import { PENDING_ORDER_TTL_MS, PENDING_EXPIRES_MS_SQL } from './api/order-window.js';
import * as apiAdminFinance from './api/admin-finance.js';
import * as apiTelegram from './api/telegram.js';

// API javoblari standart holda KESHLANMAYDI.
//
// NIMA UCHUN (2026-09): bu yerda `cache-control` umuman yo'q edi. HTTP
// qoidasiga ko'ra, `cache-control` ham, `expires` ham bo'lmagan javobni
// brauzer O'ZI xohlaganicha keshlashi mumkin ("heuristic caching"), va
// iOS Safari buni juda qattiq qo'llaydi. Natijada foydalanuvchi telefonda
// eski auksion/narx/buyurtma ma'lumotini ko'rib turishi mumkin edi —
// server allaqachon yangisini bersa ham.
//
// Bu ayniqsa xavfli joylar: /api/auctions (sotilgan lotlar), /api/orders
// (to'lov holati va taymer), /api/auth/me. Ular DOIM jonli bo'lishi kerak.
//
// `edgeCached()` ataylab keshlanadigan yo'llarda (/api/records,
// /api/categories) bu sarlavhani O'ZI qayta yozadi
// (`headers.set('cache-control', 'public, max-age=60')`), shuning uchun
// katalog keshi avvalgidek ishlayveradi.
const json = (body, status = 200, extraHeaders) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...extraHeaders,
  },
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

// ═══════════════════════════════════════════════════════════════════════
// KOMPANIYA ID — O'ZBEK ALIFBOSI (2026-09)
//
// DIQQAT: bu uchlik src/lib/company.js dagi normalizeCompanyId() /
// companyIdLetters() / companyIdLocalInfo() bilan AYNAN bir xil bo'lishi
// shart (Worker modullari `src/` dan import qila olmaydi — build guard
// taqiqlaydi). scripts/test-company-id.mjs ikkalasini bir xil kirishlarda
// solishtirib, ular ajralib ketmasligini kafolatlaydi.
//
// A-Z dan tashqari o'zbekchaning ikkita qo'shma harfi qabul qilinadi:
// O' va G' (nfcstore.uz/c/g'oya). Ular BITTA harf hisoblanadi.
//
// KANONIK SHAKL — oddiy ASCII apostrof ('): URL yo'lida kodlanmasdan
// turaveradi va istalgan klaviaturada oson teriladi. Foydalanuvchi
// qaysi belgini yozishidan qat'i nazar (ʻ ʼ ‘ ’ ` ´ ′) hammasi shunga
// keltiriladi — aks holda "gʻoya" va "g'oya" IKKITA boshqa kompaniya
// bo'lib qolardi.
//
// Apostrof faqat O yoki G dan keyin ma'noga ega; boshqa joyda kelgani
// tashlab yuboriladi.
// ═══════════════════════════════════════════════════════════════════════
const COMPANY_APOSTROPHES = /[\u2018\u2019\u02BB\u02BC\u0060\u00B4\u2032]/g;

// URL yo'lidagi bo'lakni xavfsiz ochadi. Apostrof odatda kodlanmaydi,
// lekin ba'zi mijozlar %27 yuboradi; buzuq foizli ketma-ketlik
// decodeURIComponent'ni ISTISNO bilan yiqitadi, shuning uchun try.
function decodeCompanySeg(value) {
  try { return decodeURIComponent(String(value || '')); } catch { return String(value || ''); }
}

function normalizeCompanyIdD1(value) {
  // Apostrof variantlari NFKC'dan OLDIN ham, KEYIN ham almashtiriladi.
  // Sababi: NFKC ba'zi belgilarni apostrof BO'LMAGAN narsaga yoyadi —
  // masalan ´ (U+00B4) "bo'sh joy + qo'shiluvchi urg'u" ga aylanadi va
  // keyin butunlay yo'qolib ketardi ("g´oya" -> "GOYA", ya'ni boshqa
  // kompaniya). Oldindan almashtirilsa, u to'g'ri G'OYA bo'ladi.
  const raw = String(value || '')
    .replace(COMPANY_APOSTROPHES, "'")
    .normalize('NFKC')
    .replace(COMPANY_APOSTROPHES, "'")
    .toUpperCase()
    .replace(/[^A-Z']/g, '');
  let out = '';
  let letters = 0;
  for (const ch of raw) {
    if (ch === "'") {
      const prev = out[out.length - 1];
      if (prev === 'O' || prev === 'G') out += "'";
      continue;
    }
    if (letters >= 15) break;
    out += ch;
    letters += 1;
  }
  return out;
}

// O' va G' — bitta harf.
function companyIdLettersD1(id) {
  return String(id || '').replace(/'/g, '').length;
}

function companyId(value) {
  const id = normalizeCompanyIdD1(value);
  const letters = companyIdLettersD1(id);
  if (letters < 3 || letters > 15) return '';
  return /^(?:[OG]'|[A-Z])+$/.test(id) ? id : '';
}

// ═══════════════════════════════════════════════════════════════════════
// KOMPANIYA NOMI TAQIQLANGAN SO'ZLAR FILTRI (2026-09)
//
// DIQQAT: bu blok src/lib/nameGuard.js bilan AYNAN bir xil bo'lishi shart
// (Worker modullari `src/` dan import qila olmaydi — build guard taqiqlaydi).
// scripts/test-company-name-guard.mjs ikkalasini bir xil kirishlarda
// solishtirib, ular ajralib ketmasligini kafolatlaydi.
//
// Chetlab o'tishga qarshi qatlamlar:
//  1. Unicode NFKC normalizatsiya (ﬁ, ％, to'liq kenglikdagi Ｇｏｄ v.h.)
//  2. Nol-kenglikdagi belgilar va birlashtiruvchi diakritiklar olib
//     tashlanadi (G​o​d, ĝöd)
//  3. Homoglif (o'xshash ko'rinishdagi) harflar lotinchaga qaytariladi —
//     kirill о/О, grek ο/Ο, raqam 0, kirill ԁ, ԍ va h.k.
//  4. Katta-kichik harf farqi yo'q
//
// TOPISH QOIDASI — ataylab ikki xil:
//  A) SO'Z ICHIDA: har bir so'zdan harf/raqam bo'lmagan belgilar olib
//     tashlanadi va "god" qism satr sifatida qidiriladi.
//     Bu "God", "GOD", "g.o.d", "G-O-D", "G0D", "Godiva", shuningdek
//     foydalanuvchi "go" yozib ustiga "d" bosgan holatni ham tutadi.
//  B) BOSH HARFLAR: ketma-ket kelgan BITTA harfli so'zlar birlashtiriladi
//     ("G O D" -> "god").
//
// NIMA UCHUN butun nomdan bo'shliqlar olib tashlanmaydi: unda "Chicago
// Doner" yoki "Mango Delivery" kabi mutlaqo begunoh nomlar ham
// ("chicago"+"doner" -> ...g-o-d...) noto'g'ri bloklanardi. Yuqoridagi
// ikki qoida real chetlab o'tish usullarini tutadi, lekin bunday yolg'on
// ijobiy natijalarni bermaydi.
// ═══════════════════════════════════════════════════════════════════════

const BLOCKED_NAME_WORDS = ['god'];

const HOMOGLYPHS = {
  // "o" ko'rinishidagilar
  '\u043e': 'o', '\u041e': 'o', // kirill o, O
  '\u03bf': 'o', '\u039f': 'o', // grek omikron
  '\u0585': 'o', '\u00f8': 'o', '\u00d8': 'o',
  '0': 'o',
  '\u1d0f': 'o', // kichik bosh harf O
  // "d" ko'rinishidagilar
  '\u0501': 'd', '\u0257': 'd', '\u1d05': 'd',
  // "g" ko'rinishidagilar
  '\u050d': 'g', '\u0261': 'g', '\u0581': 'g', '\u0262': 'g',
};
function foldName(value) {
  let s = String(value == null ? '' : value);
  // 1) NFKC — to'liq kenglikdagi va moslik (compatibility) shakllarini yig'adi
  try { s = s.normalize('NFKC'); } catch { /* normalize yo'q bo'lsa davom etamiz */ }
  // 2) NFD orqali diakritiklarni ajratib tashlaymiz (g-circumflex -> g)
  try { s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch { /* ignore */ }
  // 3) Nol-kenglikdagi va ko'rinmas belgilar (ZWSP/ZWNJ/ZWJ, LRM/RLM,
  //    yo'nalish belgilari, word-joiner, BOM, soft hyphen)
  s = s.replace(/[\u200b-\u200f\u202a-\u202e\u2060\ufeff\u00ad]/g, '');
  // 4) Homogliflar
  s = s.replace(/./gu, (ch) => HOMOGLYPHS[ch] || ch);
  return s.toLowerCase();
}

// Nom taqiqlangan so'zni o'z ichiga oladimi?
function companyNameBlockedD1(value) {
  const folded = foldName(value);
  if (!folded) return false;
  // Bo'shliq va shunga o'xshash ajratgichlar bo'yicha so'zlarga ajratamiz
  const words = folded.split(/[\s\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+/).filter(Boolean);

  // A) So'z ICHIDA (so'z ichidagi tinish belgilari olib tashlanadi)
  for (const w of words) {
    const letters = w.replace(/[^a-z0-9]/g, '');
    for (const bad of BLOCKED_NAME_WORDS) if (letters.includes(bad)) return true;
  }

  // B) Ketma-ket kelgan BITTA harfli so'zlar ("G O D")
  let acc = '';
  for (const w of words) {
    const letters = w.replace(/[^a-z0-9]/g, '');
    if (letters.length === 1) {
      acc += letters;
      for (const bad of BLOCKED_NAME_WORDS) if (acc.includes(bad)) return true;
    } else {
      acc = '';
    }
  }
  return false;
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
  // HARFLAR soni, belgilar soni EMAS: "G'OYA" — 4 harf. Belgilar
  // sanalganda apostrofli nomlar sun'iy ravishda uzunroq ko'rinib
  // ARZONROQ tarifga tushib qolardi.
  const length = companyIdLettersD1(id);
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
  if (!id) return { companyId: normalizeCompanyIdD1(rawId), valid: false, available: false, reason: "Faqat 3–15 ta lotin harfi, shuningdek O' va G' mumkin" };
  const [taken, rule] = await Promise.all([
    env.DB.prepare(`SELECT status FROM companies WHERE company_id = ? AND status <> 'rejected'`).bind(id).first(),
    env.DB.prepare('SELECT * FROM company_id_rules WHERE company_id = ?').bind(id).first(),
  ]);
  const pricing = companyPricing(id, rule);
  const blocked = BUILTIN_COMPANY_IDS.has(id) || ['reserved', 'off_sale', 'blocked'].includes(rule?.rule);
  // Taklif qilinadigan muqobillar HAM companyId() dan o'tkaziladi:
  // apostrofli ID kesilganda oxirida yolg'iz ' qolib, yaroqsiz taklif
  // chiqib ketishi mumkin edi (masalan "...G'" + "UZ" emas, balki
  // kesish nuqtasi apostrofga tushganda). Yaroqsizi tashlanadi.
  const alternatives = [];
  for (const suffix of ['UZ', 'PRO', 'GROUP', 'TEAM']) {
    const candidate = companyId(id.slice(0, 15 - suffix.length) + suffix);
    if (candidate && candidate !== id && !alternatives.includes(candidate)) alternatives.push(candidate);
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
    // Kategoriyalar deyarli o'zgarmaydi, lekin HAR BIR sahifada so'raladi —
    // chekkada keshlanadi (edgeCached izohiga qarang).
    return edgeCached(request, url, async () => {
    const rows = await env.DB.prepare(`SELECT * FROM categories WHERE enabled = 1 ORDER BY sort, name_uz`).all();
    return json({
      categories: (rows.results || []).map((r) => ({
        id: Number(r.id), slug: r.slug, parentSlug: r.parent_slug || null,
        nameUz: r.name_uz || '', nameRu: r.name_ru || '', nameEn: r.name_en || '',
        sort: Number(r.sort || 0), enabled: !!r.enabled,
      })),
    });
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
    // `sandbox` — faqat interfeysdagi "TEST REJIMI" belgisini boshqaradi
    // (paymeSandboxD1 izohiga qarang). Maxfiy qiymatlar qaytarilmaydi.
    // `enabled`/`sandbox` — ESKI shakl, o'zgarishsiz qoladi (mavjud
    // sahifalar shu ikkitasiga tayanadi). `providers` — yangi, har bir
    // to'lov tizimi alohida. Maxfiy qiymatlar qaytarilmaydi.
    return json({
      enabled: paymentsEnabledD1(env),
      sandbox: paymeSandboxD1(env),
      providers: {
        payme: { enabled: paymeEnabledD1(env), sandbox: paymeSandboxD1(env) },
        click: { enabled: clickEnabledD1(env), sandbox: false },
      },
    });
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
    // Taqiqlangan so'z (companyNameBlockedD1) — frontend tekshiruvi
    // chetlab o'tilgan (paste/autofill/to'g'ridan-to'g'ri API) holatda ham
    // nom bazaga TUSHMAYDI.
    if (companyNameBlockedD1(displayName)) return json({ error: 'name_not_allowed' }, 422);
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

  // Bo'lak `[^/]` bilan keng olinadi va companyId() qat'iy tekshiradi:
  // o'zbekcha O'/G' apostrofi (yoki uning %27 ko'rinishi) regexga
  // qo'shimcha belgi qo'shishni talab qilmasin uchun.
  const match = path.match(/^\/api\/companies\/([^/]{3,40})(?:\/(submit|payment|catalog)(?:\/([A-Za-z0-9_-]+))?)?$/);
  if (!match) return json({ error: 'not_found' }, 404);
  const id = companyId(decodeCompanySeg(match[1]));
  if (!id) return json({ error: 'not_found' }, 404);
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
    // Tahrirlashda ham bir xil tekshiruv (yaratishdagi bilan aynan bir xil).
    if (companyNameBlockedD1(value('displayName', 120))) return json({ error: 'name_not_allowed' }, 422);
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
    if (owned.row.status === 'approved') await setCompanyStatus(env, id, 'payment_pending', `user:${owned.auth.user.id}`, 'To\'lov kutilmoqda');
    // 2026-09: bu javob avval "backend deployini kutmoqda" der edi — endi
    // backend deploy qilingan, shuning uchun sabab ANIQLASHTIRILDI.
    // Kompaniya tarifi (summa) hali BELGILANMAGAN — narxni bu yerda
    // taxmin qilib qo'yish tijorat qoidasini o'zboshimchalik bilan
    // o'zgartirish bo'lardi. Shu sababli kompaniya to'lovi hozircha admin
    // tomonidan qo'lda faollashtiriladi (status: payment_pending -> active).
    // Bu Payme'ning yoqilgan/o'chirilganiga BOG'LIQ EMAS, shuning uchun
    // "Payme tez kunlarda" degan noto'g'ri xabar ko'rsatilmaydi.
    return json({
      error: 'company_tariff_not_set',
      message: 'Kompaniya tarifi hali belgilanmagan — arizangiz qabul qilindi, admin tasdiqlagach faollashadi.',
    }, 409);
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
  if (!(await checkIpWhitelist(request, env, reqIp(request)))) return json({ error: 'ip_not_whitelisted' }, 403);
  const path = url.pathname;
  if (path === '/api/admin/company-requests' && request.method === 'GET') {
    const status = shortText(url.searchParams.get('status'), 30);
    const rows = status && COMPANY_STATUSES.has(status)
      ? await env.DB.prepare('SELECT * FROM companies WHERE status = ? ORDER BY created_at DESC').bind(status).all()
      : await env.DB.prepare('SELECT * FROM companies ORDER BY created_at DESC').all();
    const counts = await env.DB.prepare('SELECT status, COUNT(*) AS count FROM companies GROUP BY status').all();
    return json({ companies: (rows.results || []).map((row) => rowCompany(row)), counts: counts.results || [] });
  }
  const requestMatch = path.match(/^\/api\/admin\/company-requests\/([^/]{3,40})\/status$/);
  if (requestMatch && request.method === 'PATCH') {
    const id = companyId(decodeCompanySeg(requestMatch[1]));
    if (!id) return json({ error: 'not_found' }, 404);
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
      // Muddati o'tgan sessiyalar vaqti-vaqti bilan tozalanadi (~2% so'rovda,
      // getCurrentUser ichida). `expires_at` da indeks bo'lmagani uchun bu
      // DELETE butun jadvalni skanerlardi — foydalanuvchilar ko'paygan sari
      // sekinlashadigan operatsiya. Indeks buni arzon qiladi.
      env.DB.prepare(`CREATE INDEX IF NOT EXISTS sessions_expires_idx ON sessions(expires_at)`),
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
        "address" TEXT, "latitude" REAL, "longitude" REAL,
        -- Karta QAYERDAN paydo bo'lgani (ishonchli manba belgisi, 2026-09).
        -- Qiymatlar: 'registration_auto' | 'gift_activation' | 'web_order'
        -- | 'admin_order'. Eski qatorlarda NULL bo'ladi (qo'shimcha ustun,
        -- hech narsa o'chirilmaydi) — ensureCardSourceColumn() ga qarang.
        "source" TEXT, PRIMARY KEY("code")
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
        -- MUHIM: SQLite da USTUN ta'riflari jadval CHEKLOVLARIDAN
        -- (UNIQUE / FOREIGN KEY) OLDIN turishi shart. click_transaction_id
        -- ni UNIQUE("payme_transaction_id") dan keyin qo'yganda
        -- "syntax error" bo'lgan edi — shuning uchun ikkala ustun ham
        -- shu yerda, cheklovlar esa pastda.
        "payme_transaction_id" TEXT, "click_transaction_id" TEXT,
        UNIQUE ("payme_transaction_id"), UNIQUE ("click_transaction_id"),
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
      // db/d1-migration/0001-schema.sql bilan AYNAN bir xil DDL (profil
      // like'lari va postlar). Avval bu jadvallar uchun Worker'da hech
      // qanday handler yo'q edi — /api/records/:code/{view,like,posts}
      // so'rovlari legacy proxy'ga tushib, 405 qaytarar edi.
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS "card_likes" (
        "id" INTEGER PRIMARY KEY NOT NULL, "code" TEXT (16) NOT NULL, "user_id" INTEGER NOT NULL,
        "created_at" TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        UNIQUE ("code", "user_id"),
        FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
      )`),
      env.DB.prepare(`CREATE INDEX IF NOT EXISTS "card_likes_code_idx" ON "card_likes" ("code")`),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS "posts" (
        "id" INTEGER PRIMARY KEY NOT NULL, "code" TEXT (16) NOT NULL, "user_id" INTEGER,
        "image_url" TEXT, "caption" TEXT, "created_at" TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL, "video_url" TEXT,
        FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
      )`),
      env.DB.prepare(`CREATE INDEX IF NOT EXISTS "posts_code_idx" ON "posts" ("code", "created_at" DESC)`),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS "rate_limits" ("key" TEXT PRIMARY KEY NOT NULL, "hits" INTEGER DEFAULT 0 NOT NULL, "window_start" INTEGER NOT NULL)`),
      // Eski limit yozuvlari ~1% so'rovda tozalanadi (rateLimitD1). Jadval
      // kaliti faqat `key` bo'lgani uchun `window_start` bo'yicha DELETE
      // butun jadvalni skanerlardi. Bu jadval HAR BIR profil ko'rilishida
      // to'ldiriladi (view:KOD:tashrifchi, 6 soatlik oyna), ya'ni reklama
      // paytida tez o'sadi — indekssiz bu skanerlash sezilarli sekinlik
      // manbaiga aylanardi.
      env.DB.prepare(`CREATE INDEX IF NOT EXISTS rate_limits_window_idx ON rate_limits(window_start)`),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS "post_likes" (
        "id" INTEGER PRIMARY KEY NOT NULL, "post_id" INTEGER NOT NULL, "user_id" INTEGER NOT NULL,
        "created_at" TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        UNIQUE ("post_id", "user_id"),
        FOREIGN KEY ("post_id") REFERENCES "posts" ("id") ON DELETE CASCADE,
        FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
      )`),
    ]).catch((error) => { coreSchemaReady = null; throw error; });
  }
  await coreSchemaReady;
  // web_orders itself is created just above (inside the shared batch) —
  // this must run AFTER it, not before, or the ALTER TABLE below would
  // target a table that doesn't exist yet on a fresh DB and silently
  // no-op (swallowed by its own .catch), leaving the columns missing.
  await ensureWebOrderTimestampColumns(env);
  await ensureCardSourceColumn(env);
}

// ── cards.source — kartaning ISHONCHLI manba belgisi (2026-09) ───────────
// Ilgari `cards` jadvalida karta qaysi oqimdan paydo bo'lganini ko'rsatuvchi
// hech qanday ustun yo'q edi. Ro'yxatdan o'tishda avtomatik beriladigan
// bepul ID'ni katalogdan chiqarish uchun aynan shu ma'lumot kerak —
// narx (`price = 0`) YARAMAYDI, chunki admin sovg'asi ham 0 narxda bo'ladi,
// lekin u katalogda "Sovg'a" bo'lib KO'RINISHI kerak.
//
// Qo'shimcha (additive) va nullable: mavjud qatorlar tegilmaydi, hech narsa
// o'chirilmaydi, taxminiy backfill QILINMAYDI. Eski qatorlar uchun
// catalogVisibleSql() dagi tor, ehtiyotkor qoida ishlaydi.
let cardSourceColumnReady;
async function ensureCardSourceColumn(env) {
  if (!cardSourceColumnReady) {
    cardSourceColumnReady = env.DB.prepare(`ALTER TABLE cards ADD COLUMN source TEXT`).run().catch(() => {});
  }
  await cardSourceColumnReady;
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
      // Click tranzaksiya identifikatori — Payme'dagi
      // `payme_transaction_id` ning aynan hamkasbi. Click ulanganda
      // shu ustun to'ldiriladi. `catch` — ustun allaqachon bo'lsa jim
      // o'tadi (boshqa ALTER'lar bilan bir xil naqsh).
      await env.DB.prepare(`ALTER TABLE web_orders ADD COLUMN click_transaction_id TEXT`).run().catch(() => {});
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

async function createUserSession(env, userId, request) {
  const token = newToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_S * 1000).toISOString().replace('T', ' ').replace('Z', '+00');
  await env.DB.prepare(`INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)`)
    .bind(await sha256Hex(token), userId, expiresAt).run();
  return { token, cookie: sessionCookieHeader(token, isSecure(new URL(request.url))) };
}

async function getCurrentUser(request, env) {
  const token = parseCookies(request)[SESSION_COOKIE];
  if (!token) return null;
  // Tozalash har so'rovda emas — ~1/50 so'rovda (sessions(expires_at) indeksi yo'q edi).
  if (Math.random() < 0.02) await env.DB.prepare(`DELETE FROM sessions WHERE expires_at < ?`).bind(nowTs()).run().catch(() => {});
  // Token SHA-256 bilan saqlanadi (admin_sessions kabi). O'tish davri: eski xom
  // tokenli sessiyalar ham qabul qilinadi va darhol hash'ga ko'chiriladi.
  const tokenHash = await sha256Hex(token);
  const row = await env.DB.prepare(
    `SELECT u.id, u.email, u.phone, u.is_premium AS isPremium, u.banned_until AS bannedUntil,
            u.strike_count AS strikeCount, u.promo_code AS promoCode, u.pending_discount_pct AS pendingDiscountPct,
            u.suspended_until AS suspendedUntil, u.deleted_at AS deletedAt, s.token AS storedToken
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token IN (?, ?) AND s.expires_at > ?`
  ).bind(tokenHash, token, nowTs()).first();
  if (!row) return null;
  if (row.storedToken === token) {
    await env.DB.prepare(`UPDATE sessions SET token = ? WHERE token = ?`).bind(tokenHash, token).run().catch(() => {});
  }
  if (row.deletedAt) return null;
  if (row.suspendedUntil && parseDbDate(row.suspendedUntil) > new Date()) return null;
  const isBanned = row.bannedUntil && parseDbDate(row.bannedUntil) > new Date();
  return {
    id: row.id, email: row.email, phone: row.phone || null, isPremium: !!row.isPremium,
    bannedUntil: isBanned ? row.bannedUntil : null, strikeCount: row.strikeCount || 0,
    promoCode: row.promoCode || null, pendingDiscountPct: row.pendingDiscountPct || 0,
  };
}

// ---------- admin sessiya do'koni (production 503 root-cause, 2026-09) ----------
// MUAMMO: production D1'dagi `admin_sessions` jadvali bu koddan OLDIN (eski
// versiya yoki Dashboard orqali qo'lda) yaratilgan bo'lishi mumkin va unda
// bizning INSERT to'ldirmaydigan QO'SHIMCHA "NOT NULL" ustun bo'lishi mumkin.
// `CREATE TABLE IF NOT EXISTS` mavjud jadvalga umuman ta'sir qilmaydi, va
// `ALTER TABLE ADD COLUMN` bunday ustunni OLIB TASHLAY OLMAYDI — natijada
// `INSERT INTO admin_sessions` "NOT NULL constraint failed" bilan yiqilib,
// /api/admin/verify-2fa 503 qaytarardi. Bu Google TOTP va Telegram OTP
// yo'llarining IKKALASIGA ham tegishli, chunki sessiya yozish — ularning
// UMUMIY oxirgi qadami (shuning uchun "ikkala kod ham noto'g'ri" emas).
//
// YECHIM (migration talab qilmaydi, hech narsa o'chirilmaydi/DROP qilinmaydi):
//   1) kanonik INSERT;
//   2) yiqilsa — PRAGMA table_info bilan jadval shaklini o'qib, eski
//      sxemadagi majburiy ustunlarni ham to'ldirib qayta urinish;
//   3) u ham yiqilsa — o'zimiz nazorat qiladigan `admin_sessions_v2`
//      jadvaliga yozish (CREATE TABLE IF NOT EXISTS — additiv).
// O'qish/o'chirish ikkala jadvaldan ham ishlaydi, shuning uchun mavjud
// (eski jadvaldagi) sessiyalar ham amal qilaveradi.
const ADMIN_SESSION_TABLE = 'admin_sessions';
const ADMIN_SESSION_FALLBACK_TABLE = 'admin_sessions_v2';
const ADMIN_SESSION_SELECT = 'admin_id AS adminId, role, abs_exp AS absExp, last_activity AS lastActivity';

let adminSessionFallbackReady;
async function ensureAdminSessionFallbackTable(env) {
  if (!adminSessionFallbackReady) {
    adminSessionFallbackReady = env.DB.prepare(`CREATE TABLE IF NOT EXISTS "${ADMIN_SESSION_FALLBACK_TABLE}" (
      "token" TEXT PRIMARY KEY NOT NULL, "admin_id" INTEGER NOT NULL, "role" TEXT NOT NULL,
      "abs_exp" TEXT NOT NULL, "last_activity" TEXT NOT NULL
    )`).run();
  }
  await adminSessionFallbackReady;
}

async function createAdminSessionD1(env, { tokenHash, adminId, role, absExp, lastActivity }) {
  const base = { token: tokenHash, admin_id: adminId, role, abs_exp: absExp, last_activity: lastActivity };
  const insertInto = async (table, extra) => {
    const cols = { ...base, ...(extra || {}) };
    const names = Object.keys(cols);
    const sql = `INSERT INTO "${table}" (${names.map((n) => `"${n}"`).join(', ')}) VALUES (${names.map(() => '?').join(', ')})`;
    await env.DB.prepare(sql).bind(...names.map((n) => cols[n])).run();
  };

  try {
    await insertInto(ADMIN_SESSION_TABLE);
    return ADMIN_SESSION_TABLE;
  } catch (error) {
    // Faqat D1 xato MATNI yoziladi — token/parol/secret hech qachon emas.
    console.error('admin session insert (canonical)', String(error?.message || error));
  }

  try {
    const info = await env.DB.prepare(`PRAGMA table_info("${ADMIN_SESSION_TABLE}")`).all();
    const extra = {};
    for (const col of info?.results || []) {
      const name = col?.name;
      if (!name || name in base) continue;
      const isRequired = Number(col.notnull) === 1 && col.dflt_value == null && Number(col.pk) !== 1;
      if (!isRequired) continue;
      const type = String(col.type || '').toUpperCase();
      // Eski sxemalarda bunday ustun odatda muddat/vaqt (TEXT) yoki hisoblagich (INTEGER)
      extra[name] = type.includes('INT') || type.includes('REAL') || type.includes('NUM')
        ? 0
        : (/(^|_)(at|exp|expires?|time|date)($|_)/i.test(name) ? absExp : '');
    }
    if (Object.keys(extra).length) {
      await insertInto(ADMIN_SESSION_TABLE, extra);
      console.error('admin session insert: legacy shape adapted, extra columns:', Object.keys(extra).join(','));
      return ADMIN_SESSION_TABLE;
    }
  } catch (error) {
    console.error('admin session insert (shape-adapted)', String(error?.message || error));
  }

  await ensureAdminSessionFallbackTable(env);
  await insertInto(ADMIN_SESSION_FALLBACK_TABLE);
  console.error('admin session insert: fell back to', ADMIN_SESSION_FALLBACK_TABLE);
  return ADMIN_SESSION_FALLBACK_TABLE;
}

async function findAdminSessionRow(env, tokenHash) {
  try {
    const row = await env.DB.prepare(`SELECT ${ADMIN_SESSION_SELECT} FROM "${ADMIN_SESSION_TABLE}" WHERE token = ?`).bind(tokenHash).first();
    if (row) return { row, table: ADMIN_SESSION_TABLE };
  } catch (error) {
    console.error('admin session lookup', String(error?.message || error));
  }
  try {
    const row = await env.DB.prepare(`SELECT ${ADMIN_SESSION_SELECT} FROM "${ADMIN_SESSION_FALLBACK_TABLE}" WHERE token = ?`).bind(tokenHash).first();
    if (row) return { row, table: ADMIN_SESSION_FALLBACK_TABLE };
  } catch { /* fallback jadval hali yo'q — normal holat */ }
  return null;
}

async function deleteAdminSessionD1(env, tokenHash) {
  for (const table of [ADMIN_SESSION_TABLE, ADMIN_SESSION_FALLBACK_TABLE]) {
    try { await env.DB.prepare(`DELETE FROM "${table}" WHERE token = ?`).bind(tokenHash).run(); } catch { /* jadval yo'q */ }
  }
}

async function getCurrentAdmin(request, env) {
  const token = parseCookies(request)[ADMIN_COOKIE];
  if (!token) return null;
  // admin_sessions.token stores SHA-256(raw token), never the raw value —
  // the cookie is the only place the raw token ever exists after issuance.
  const tokenHash = await sha256Hex(token);
  const found = await findAdminSessionRow(env, tokenHash);
  if (!found) return null;
  const { row, table } = found;
  const now = Date.now();
  if (now > new Date(row.absExp).getTime()) {
    await deleteAdminSessionD1(env, tokenHash);
    return null;
  }
  if (now - new Date(row.lastActivity).getTime() > ADMIN_IDLE_MS) {
    await deleteAdminSessionD1(env, tokenHash);
    return { idleTimeout: true };
  }
  await env.DB.prepare(`UPDATE "${table}" SET last_activity = ? WHERE token = ?`).bind(nowTs(), tokenHash).run().catch(() => {});
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
// `music_url` ustuni ilgari bitta URL matnini saqlagan; endi ko'pi bilan
// 5 ta qo'shiq ro'yxatini shu ustunga JSON massiv sifatida yozamiz (yangi
// ustun/migratsiya kerak emas). Eski yozuvlar bilan orqaga moslik: matn
// JSON massiv bo'lmasa, lekin bo'sh bo'lmasa — bitta elementli ro'yxat
// deb o'qiladi.
function parseMusicUrls(text) {
  if (!text) return [];
  try {
    const v = JSON.parse(text);
    // O'QISH chegarasi eng yuqori limit bo'yicha (Premium 10) — aks holda
    // premium foydalanuvchining 6-10 treklari profilda ko'rinmasdi.
    // Yozishdagi haqiqiy limit validateRecordBody() da aniqlanadi.
    if (Array.isArray(v)) return v.filter((x) => typeof x === 'string' && x).slice(0, MUSIC_LIMIT_PREMIUM_D1);
  } catch { /* eski (bitta URL) format — pastda */ }
  return typeof text === 'string' && text.trim() ? [text.trim()] : [];
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
    hiddenFromDirectory: !!row.hidden_from_directory, leadCapture: !!row.lead_capture,
    musicUrls: parseMusicUrls(row.music_url), musicUrl: parseMusicUrls(row.music_url)[0] || '',
    tg: row.tg || '', phone: row.phone || '', email: row.email || '', linkedin: row.linkedin || '',
    instagram: row.instagram || '', about: row.about || '', facebook: row.facebook || '', twitter: row.twitter || '',
    website: row.website || '', cardNumber: row.card_number || '', extraLinks: parseJsonArray(row.extra_links),
    cardNumbers: parseJsonArray(row.card_numbers), tierOverride: row.tier_override || '', verified: !!row.verified,
    cardDesign: parseJsonObjectOrNull(row.card_design), theme: row.theme || 'classic', forSale: !!row.for_sale,
    salePrice: row.sale_price != null ? Number(row.sale_price) : null, hashtags: parseJsonArray(row.hashtags),
    // Narx yagona manbadan — katalogdagi bilan AYNAN bir xil qoida
    // (catalogPriceD1: tarif narxi -> per-code rasmiy narx -> saqlangan
    // narx), shunda katalog, qidiruv, PROFIL BELGISI, Admin va auksion bir
    // xil qiymatni ko'rsatadi. Bu faqat KO'RSATISH narxi; haqiqiy xarid
    // summasi alohida quote orqali hisoblanadi va web_orders/Payme tarixi
    // bunga bog'liq emas.
    price: catalogPriceD1({ code: row.code, tierOverride: row.tier_override || '', price: Number(row.price) }, null),
    ts: Number(row.ts), views: Number(row.views),
  };
}

const RECORD_COLUMNS = `code, name, role, avatar_url, bg_url, bg_pattern, accent_color, bg_color, bg_animated,
  music_url, links_transparent, link_style, profile_type, city, category_slug, hidden_from_directory,
  address, latitude, longitude, lead_capture, is_primary, giftable, hide_phone, tg, phone, email,
  linkedin, instagram, about, facebook, twitter, website, card_number, extra_links, card_numbers,
  tier_override, card_design, verified, theme, for_sale, sale_price, hashtags, price, ts, views`;

// ── HAR KODGA QO'LDA BELGILANGAN NARX (per-code price override) ──────────
// DIQQAT: bu blok src/lib/codePrices.js bilan AYNAN bir xil bo'lishi shart
// (Worker modullari `src/` dan import qila olmaydi — build guard taqiqlaydi).
// scripts/test-code-prices-and-sold.mjs ikkalasini solishtirib turadi.
//
// BIRLIK: SO'M (tiyin EMAS) — `cards.price` va `web_orders.price` bilan bir xil.
// Tiyinga o'girish faqat paymeCheckoutLinkD1() ichida (× 100) sodir bo'ladi.
//
// Bu narx katalog/qidiruv/profil belgisi/Admin/auksion ko'rinishida TARIF
// narxidan USTUN turadi. Eski buyurtmalar va Payme tranzaksiyalari
// (web_orders, payme_transactions) O'ZGARTIRILMAYDI.
const CODE_PRICES_D1 = {
  OOO000: 8700000,
  VVV444: 2900000,
  BMW007: 199000,
  VIP001: 7600000,
  VIP000: 9700000,
};
function codePriceOverrideD1(code) {
  const c = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return Object.prototype.hasOwnProperty.call(CODE_PRICES_D1, c) ? CODE_PRICES_D1[c] : null;
}

// ── KATALOGDA KO'RINMAYDIGAN KARTALAR: ro'yxatdan o'tishdagi avtomatik ID ──
//
// Ro'yxatdan o'tganda har foydalanuvchiga avtomatik, bepul ID beriladi
// (hosting/api/auth.js `createFreeAutoId`). Bu ID SOTUVDA emas — u
// katalogda umuman ko'rinmasligi kerak: ro'yxatda ham, qidiruvda ham,
// filtrda ham, umumiy sanoqda ham.
//
// MANBA — TAXMIN EMAS:
//   1) BIRLAMCHI: `cards.source = 'registration_auto'`. Bu belgi endi
//      registratsiya oqimining O'ZIDA yoziladi, shuning uchun bundan
//      keyingi barcha avtomatik ID'lar 100% aniq belgilangan bo'ladi.
//   2) ESKI QATORLAR (source IS NULL, migratsiyagacha yaratilgan): kod
//      "8 xonali raqam" NAMESPACE'ida bo'lishi. Bu narx yoki ism bo'yicha
//      taxmin EMAS — 8 xonali shakl kod bazasida REZERV qilingan:
//      `isPersonalCodePurchasable()`/`personalPurchaseQuote()` uni sotib
//      olish oqimida rad etadi, sovg'a va auksion kodlari esa 6 belgili
//      (AAA000) formatda. Ya'ni bu shakldagi kartani `createFreeAutoId`
//      dan boshqa hech qaysi oqim yarata olmaydi.
//   3) Va shunga qaramay QO'SHIMCHA xavfsizlik: eski qator faqat unda
//      HECH QANDAY sotuv izi bo'lmasa yashiriladi — sovg'a yozuvi
//      (nfc_gifts), buyurtma (web_orders) yoki auksion (auctions) bo'lsa,
//      karta katalogda QOLADI.
//
// Ma'lumot O'CHIRILMAYDI va o'zgartirilmaydi: bu faqat KO'RINISH filtri.
// Egasining kabineti (/api/auth/me), public profili (/:code) va Admin
// Panel bu filtrdan mutlaqo ta'sirlanmaydi.
const CARD_SOURCE_REGISTRATION_AUTO = 'registration_auto';
const FREE_AUTO_ID_GLOB = '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]';

// `alias` — SQL'dagi cards jadvali taxallusi ('cards' yoki 'c').
// Natija: katalogda KO'RINISHI kerak bo'lgan qatorlar uchun TRUE.
function catalogVisibleSql(alias) {
  const a = alias;
  return `(
    COALESCE(${a}.source, '') <> '${CARD_SOURCE_REGISTRATION_AUTO}'
    AND NOT (
      ${a}.source IS NULL
      AND ${a}.code GLOB '${FREE_AUTO_ID_GLOB}'
      AND NOT EXISTS (SELECT 1 FROM nfc_gifts g2 WHERE g2.code = ${a}.code)
      AND NOT EXISTS (SELECT 1 FROM web_orders w2 WHERE w2.code = ${a}.code)
      AND NOT EXISTS (SELECT 1 FROM auctions a2 WHERE a2.code = ${a}.code)
    )
  )`;
}

// ── AUKSIONDA SOTILGAN ID'NING YAKUNIY (G'OLIB) NARXI ────────────────────
//
// Katalogda auksion narxi FAQAT haqiqatda auksion orqali sotilgan ID uchun
// ko'rsatiladi. Talab qilinadigan BARCHA shartlar (bittasi ham yetishmasa —
// narx QO'LLANMAYDI):
//   • shu kod uchun `auctions` jadvalida haqiqiy yozuv bor;
//   • auksion holati 'sold' yoki 'completed';
//   • VA shu kod uchun HAQIQIY TO'LOV o'tgan — Payme YOKI Click orqali
//     (web_orders: kind='auction_payment', status='paid' VA
//      payme_transaction_id yoki click_transaction_id to'ldirilgan);
//   • haqiqiy g'olib bor (`highest_bidder_id IS NOT NULL`);
//   • yakuniy yutuq taklifi BAZADA saqlangan (`bids` jadvalida g'olibning
//     shu auksiondagi eng katta taklifi) — narx aynan SHU yozuvdan olinadi,
//     `current_price` dan emas;
//   • ID g'olibga biriktirilgan (`cards.user_id = highest_bidder_id`).
//
// Tarif, kod nomi, boshlang'ich narx, `price = 0` yoki shunchaki "egasi bor"
// belgisi auksion narxini ANIQLAMAYDI. Soxta auksion/g'olib/taklif
// yaratilmaydi, tarixiy summalar o'zgartirilmaydi.
//
// Kelajakda yangi auksion tugab, ID g'olibga faollashtirilsa — narx shu
// yerdan AVTOMATIK chiqadi, qo'lda hech narsa yozish kerak emas.
async function auctionFinalPricesD1(env) {
  const out = new Map();
  try {
    const rows = await env.DB.prepare(
      `SELECT a.code AS code, MAX(b.amount) AS final_amount
         FROM auctions a
         JOIN cards c ON c.code = a.code AND c.user_id = a.highest_bidder_id
         JOIN bids b ON b.auction_id = a.id AND b.user_id = a.highest_bidder_id
        WHERE a.status IN ('sold', 'completed') AND a.highest_bidder_id IS NOT NULL
          AND EXISTS (SELECT 1 FROM web_orders w
                       WHERE w.code = a.code AND w.kind = 'auction_payment'
                         AND w.status = 'paid'
                         AND COALESCE(w.payme_transaction_id, w.click_transaction_id) IS NOT NULL)
        GROUP BY a.code`
    ).all();
    for (const r of rows.results || []) {
      const amount = Number(r.final_amount);
      if (Number.isFinite(amount) && amount > 0) out.set(String(r.code || '').toUpperCase(), amount);
    }
  } catch (e) {
    // Auksion narxi topilmasa katalog yiqilmaydi — oddiy tarif narxiga
    // qaytamiz (o'ylab topilgan narx YO'Q).
    console.error('auctionFinalPricesD1', e && e.message);
  }
  return out;
}

// ── KATALOG NARXINING YAGONA MANBAI ──────────────────────────────────────
// Ustuvorlik (foydalanuvchi topshirig'idagi tartib):
//   1. Faollashtirilgan admin sovg'asi -> narx emas, "Sovg'a" (isGift).
//   2. Egasi QO'LDA belgilagan rasmiy narx (CODE_PRICES_D1). Bu ro'yxat —
//      sayt egasining joriy, amaldagi narxi; u hisoblanadigan tarif
//      narxidan HAM, TARIXIY auksion natijasidan HAM ustun turadi.
//      2026-09 hotfix: avval bu qoida 4-o'rinda edi va OOO000/VVV444 kabi
//      ID'lar katalogda ESKI auksion g'olib taklifini (200 000 / 300 000)
//      ko'rsatib turardi, auksionning "Sotilgan" bo'limi esa o'sha paytda
//      rasmiy narxni (8 700 000 / 2 900 000) ko'rsatardi — bir sahifada
//      ikki xil narx. Endi ikkalasi ham SHU yagona ro'yxatdan oladi.
//      src/lib/pricing.js `priceForCode()` ham aynan shu tartibda ishlaydi
//      (avval per-code narx, keyin tarif) — parity shu bilan tiklandi.
//   3. Haqiqiy sotilgan auksion ID -> yakuniy yutuq narxi (ro'yxatda
//      BO'LMAGAN kodlar uchun o'zgarishsiz qoladi).
//   4. Oddiy tarif narxi — Gold/Premium/Silver/Bronza uchun YAGONA markaziy
//      jadvaldan (PERSONAL_TIER_PRICE = src/lib/pricing.js TIER_PRICE):
//      Gold 149 000, Premium 199 000, Silver 99 000, Bronza 49 000.
//   5. Kartaning bazadagi saqlangan narxi (> 0 bo'lsa).
//   6. Aks holda 0 — narx O'YLAB TOPILMAYDI.
//
// MUHIM: bu FAQAT ko'rsatiladigan narx. Auksion yozuvlari, taklif (bids)
// summalari, web_orders va Payme tranzaksiyalari TEGILMAYDI — moliyaviy
// va auksion tarixi o'z holicha qoladi.
function catalogPriceD1(record, auctionFinal) {
  const code = String(record.code || '').toUpperCase();
  // Egasining rasmiy narx ro'yxati — eng yuqori ustuvorlik (yuqoridagi
  // izohga qarang). Ro'yxatda yo'q kodlar uchun hech narsa o'zgarmaydi.
  // 1) HAQIQIY, TO'LANGAN auksion savdosi — eng ustun va eng ishonchli:
  //    pul o'tgan, karta g'olibga biriktirilgan. To'lanmagan lotlar bu
  //    yerga umuman yetib kelmaydi (auctionFinalPricesD1 izohiga qarang),
  //    shuning uchun eski/eskirgan taklif katalogga sizib chiqmaydi —
  //    2026-09 hotfix (OOO000 200 000 bo'lib ko'rinardi) shu bilan ham
  //    yopiladi.
  if (auctionFinal != null && Number(auctionFinal) > 0) return Number(auctionFinal);
  // 2) SOVG'A — summa UMUMAN ko'rsatilmaydi. `codePriceOverrideD1` dan
  //    OLDIN turishi shart, aks holda egasining narx ro'yxatidagi qiymat
  //    sovg'a kartaning yonida ham chiqib ketardi.
  if (isGiftCardD1(record, auctionFinal)) return 0;
  // 3) Egasining rasmiy narx ro'yxati.
  const ov = codePriceOverrideD1(code);
  if (ov != null) return ov;
  // Sotib olinmaydigan kod (ro'yxatdan o'tishdagi 8 xonali bepul ID yoki
  // bloklangan prefiks) — unga TARIF narxi QO'LLANMAYDI, aks holda bepul
  // ID kabinetda "49 000 so'm" bo'lib ko'rinardi. Saqlangan qiymat
  // (odatda 0) o'z holicha qoladi.
  if (!isPersonalCodePurchasable(code)) {
    const raw = Number(record.price);
    return Number.isFinite(raw) && raw > 0 ? raw : 0;
  }
  const tier = personalIdTierD1({ code, tierOverride: record.tierOverride || '', isGift: false });
  const tierPrice = PERSONAL_TIER_PRICE[tier];
  if (tierPrice != null && tierPrice > 0) return tierPrice;
  const stored = Number(record.price);
  return Number.isFinite(stored) && stored > 0 ? stored : 0;
}

function catalogCard(record, auctionFinal = null) {
  return {
    code: record.code, name: record.name, role: record.role, avatarUrl: record.avatarUrl, tg: record.tg,
    hashtags: record.hashtags, theme: record.theme,
    // Narx: catalogPriceD1() — yagona manba (sovg'a -> auksion yakuniy
    // narxi -> tarif narxi -> per-code rasmiy narx -> saqlangan narx).
    price: catalogPriceD1(record, auctionFinal),
    ts: record.ts, views: record.views,
    profileType: record.profileType, city: record.city, categorySlug: record.categorySlug,
    verified: record.verified, tierOverride: record.tierOverride || '',
    // 2026-09: katalogda admin sovg'a qilgan kartani "0 so'm" emas,
    // "Sovg'a" deb ko'rsatish uchun. MUHIM: bu bayroq narxdan EMAS,
    // `nfc_gifts` jadvalidagi HAQIQIY sovg'a yozuvidan olinadi
    // (status='activated' — ya'ni admin rezerv qilgan va oluvchi
    // faollashtirgan karta). Narxi 0 bo'lgan har qanday karta sovg'a
    // deb hisoblanmaydi.
    // Haqiqiy `nfc_gifts` yozuvi YOKI egasining qo'lda belgilagan ro'yxati
    // (GIFT_CODES_D1). Ikkinchisi kerak, chunki admin panel egasi bor
    // kartaga sovg'a yozuvi yarata olmaydi (CODE_TAKEN).
    // Narx bilan AYNAN bir xil qoidadan (isGiftCardD1) — belgi va summa
    // hech qachon bir-biriga zid bo'lmaydi.
    isGift: isGiftCardD1(record, auctionFinal),
  };
}

async function getRecord(env, code) {
  const row = await env.DB.prepare(
    `SELECT c.*, u.is_premium AS owner_is_premium,
            EXISTS(SELECT 1 FROM nfc_gifts g WHERE g.code = c.code AND g.status = 'activated') AS is_gift
     FROM cards c LEFT JOIN users u ON u.id = c.user_id WHERE c.code = ?`
  ).bind(code).first();
  if (!row) return null;
  const rec = { ...rowToRecord(row), isPremium: !!row.owner_is_premium, isGift: !!row.is_gift };
  // `rowToRecord()` narxni auksion natijasini BILMASDAN hisoblaydi
  // (u sinxron). Shuning uchun bu yerda haqiqiy auksion yakuniy narxi
  // bilan qayta hisoblaymiz — aks holda profil belgisi katalogdan farq
  // qilardi: auksionda sotilgan ekslyuziv ID katalogda yutuq narxida,
  // profilda esa 0 ("Sovg'a") bo'lib ko'rinardi.
  const finals = await auctionFinalPricesD1(env);
  const finalPrice = finals.get(String(code || '').toUpperCase()) ?? null;
  rec.price = catalogPriceD1(rec, finalPrice);
  rec.isGift = isGiftCardD1(rec, finalPrice);
  return rec;
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
// Egasi SOVG'A deb belgilagan ID'lar — src/lib/giftCodes.js GIFT_CODES bilan
// AYNAN bir xil (paritet testda tekshiriladi). Katalogda narx o'rniga
// "Sovg'a" chiqadi. `nfc_gifts` jadvaliga hech narsa yozmaydi va haqiqiy
// sovg'a yozuvlari ustidan ishlaydi — batafsil izoh src/lib/giftCodes.js da.
const GIFT_CODES_D1 = ['SAV571'];
function isGiftCodeD1(code) {
  const c = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return GIFT_CODES_D1.includes(c);
}

// ─────────────────────────────────────────────────────────────────────────
// EGASI BOR EKSLYUZIV ID = SOVG'A, "SOTILGAN" EMAS (2026-09).
// ─────────────────────────────────────────────────────────────────────────
// Ekslyuziv daraja to'g'ridan-to'g'ri sotilmaydi — `PERSONAL_TIER_PRICE`
// da uning narxi `null`, `personalPurchaseQuote()` esa uni umuman sotmaydi.
// Ya'ni katalogdagi egasi bor ekslyuziv ID hech qachon sotuvdan o'tmagan:
// u sovg'a qilingan yoki egasi tomonidan biriktirilgan.
//
// Shunga qaramay katalogda ularning yonida summa turardi (saqlangan narx
// yoki CODE_PRICES_D1 dagi qiymat), auksionning "Sotilgan" bo'limida esa
// ular "Sotildi ... so'm" bo'lib chiqardi — garchi bunday auksion umuman
// bo'lmagan bo'lsa ham. Bu foydalanuvchiga to'g'ri kelmaydigan ma'lumot.
//
// Endi qoida: egasi bor ekslyuziv ID -> katalogda summa YO'Q, "Sovg'a".
// Bu qo'lda yozilgan ro'yxat emas, DARAJADAN kelib chiqadigan qoida —
// yangi ekslyuziv ID qo'shilganda o'zi to'g'ri ishlaydi.
//
// NIMAGA TEGMAYDI: haqiqiy auksion orqali sotilgan ID (taklif berilgan va
// g'olib aniqlangan) `auctions`/`bids` jadvallaridan keladi va o'z narxini
// saqlaydi. Xarid summasi ham bunga bog'liq emas — u `personalPurchaseQuote()`
// orqali alohida hisoblanadi.
// `auctionFinal` — HAQIQIY, TO'LANGAN auksion savdosi
// (auctionFinalPricesD1: g'olib aniqlangan, karta unga o'tgan VA
// to'lov amalga oshirilgan). Bunday ID sovg'a emas — u rostdan sotilgan.
//
// NIMA UCHUN provayder tranzaksiyasi sharti muhim: bazada sinov davridan
// qolgan, hatto 'paid' deb belgilangan buyurtmalar bor ekan. Ular
// "Sotildi 5 000 000 so'm" bo'lib chiqardi — bo'lmagan savdo.
// Tranzaksiya identifikatori faqat haqiqiy to'lov oqimida yoziladi
// (Payme yoki Click), shuning uchun eski yozuvlar bu shartdan o'tolmaydi.
function isOwnedExclusiveGiftD1(record, auctionFinal) {
  if (auctionFinal != null && Number(auctionFinal) > 0) return false;
  const code = String(record?.code || '').toUpperCase();
  if (!code) return false;
  const tier = personalIdTierD1({ code, tierOverride: record?.tierOverride || '', isGift: false });
  return tier === 'exclusive';
}

// Katalogdagi "Sovg'a" belgisining YAGONA manbasi — narx ham, belgi ham
// shundan hisoblanadi, shuning uchun ular hech qachon bir-biriga zid
// bo'lmaydi (avval SAV571 katalogda "Sovg'a", auksionda "Sotildi" edi).
function isGiftCardD1(record, auctionFinal) {
  return !!record?.isGift || isGiftCodeD1(record?.code) || isOwnedExclusiveGiftD1(record, auctionFinal);
}

const PERSONAL_AUCTION_CODES = [
  // 2026-09: noyob ID'lar — egasining qarori bilan ekslyuziv.
  'SAV571', 'XXX772',
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
  // 2026-09 TUZATISH: bu funksiya src/lib/pricing.js `priceForCode()` bilan
  // BIR XIL bo'lishi kerak edi (izohda ham shunday yozilgan), lekin u
  // faqat TARIF override'ini (personalCodeTierOverride) qo'llardi va
  // egasining PER-CODE NARX ro'yxatini (CODE_PRICES_D1) umuman
  // tekshirmasdi. Natijada OOO000 kabi ekslyuziv ID uchun frontend
  // 8 700 000 ni, worker esa 0 ni qaytarardi va
  // scripts/payme-pricing-parity-test.mjs qizil turardi.
  //
  // PUL YO'LIGA TA'SIRI YO'Q: `personalPurchaseQuote()` bu funksiyadan
  // FAQAT `tier` ni oladi va summani PERSONAL_TIER_PRICE dan mustaqil
  // hisoblaydi (ekslyuzivni esa umuman sotmaydi). O'lchab tekshirildi:
  // ro'yxatdagi 5 ta kodning hammasida sotib olish summasi ikkala
  // tomonda aynan bir xil.
  const priceOv = codePriceOverrideD1(c);
  const tierOv = personalCodeTierOverride(c);
  const base = tierOv
    ? { total: PERSONAL_TIER_PRICE[tierOv] ?? 0, tier: tierOv, base: PERSONAL_TIER_PRICE[tierOv] ?? 0, override: true }
    : (() => {
        const tier = personalTierFromCode(c.slice(0, 3), c.slice(3, 6));
        const total = PERSONAL_TIER_PRICE[tier] ?? 0;
        return { total, tier, base: total };
      })();
  if (priceOv != null) return { ...base, total: priceOv, base: priceOv, priceOverride: true };
  return base;
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
       about, facebook, twitter, website, card_number, extra_links, card_numbers, theme, hashtags, price, ts,
       source)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT("code") DO NOTHING
    RETURNING ${RECORD_COLUMNS}
  `).bind(
    record.code, record.name, record.role || '', record.avatarUrl || '', record.bgUrl || '',
    record.bgPattern === false ? 0 : 1, record.accentColor || null, record.bgColor || null,
    record.bgAnimated === false ? 0 : 1, JSON.stringify(Array.isArray(record.musicUrls) ? record.musicUrls.slice(0, MUSIC_LIMIT_PREMIUM_D1) : []),
    record.tg || '', record.phone || '', record.email || '', record.linkedin || '', record.instagram || '',
    record.about || '', record.facebook || '', record.twitter || '', record.website || '',
    record.cardNumber || '', JSON.stringify(record.extraLinks || []), JSON.stringify(record.cardNumbers || []),
    record.theme || 'classic', JSON.stringify(record.hashtags || []), record.price, Date.now(),
    // Manba belgisi: bu yo'l HECH QACHON registratsiyaning avtomatik ID'si
    // emas (to'langan buyurtma yoki admin buyurtmasi) — shuning uchun
    // karta katalogda ko'rinishda qoladi.
    record.source || 'web_order',
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
// Legacy createPhysicalCard porti: chip_token ~8 belgi URL-xavfsiz, UNIQUE
// to'qnashuvda 5 marta qayta uriniladi.
async function createPhysicalCardD1(env, { linkedCode, ownerUserId, shippingName, shippingPhone, shippingAddress }) {
  for (let i = 0; i < 5; i++) {
    const token = newToken(6);
    try {
      const row = await env.DB.prepare(
        `INSERT INTO physical_cards (chip_token, linked_code, owner_user_id, shipping_name, shipping_phone, shipping_address)
         VALUES (?, ?, ?, ?, ?, ?) RETURNING id, chip_token AS chipToken`
      ).bind(token, linkedCode, ownerUserId, shippingName, shippingPhone, shippingAddress).first();
      if (row) return row;
    } catch (err) {
      if (/UNIQUE/i.test(String(err?.message || err))) continue;
      throw err;
    }
  }
  throw new Error('chip_token_collision');
}

async function finalizePaidWebOrderD1(env, orderId) {
  const order = await getWebOrderD1(env, orderId);
  if (!order) return { alreadyProcessed: true };

  // ── PAYME SERTIFIKATSIYA SINOVI (kind='payme_test') ──────────────────
  // To'lov tizimini ulashda Payme kichik summali (masalan 1 so'm) haqiqiy
  // to'lov o'tkazib tekshirishni so'raydi. Saytdagi eng arzon mahsulot
  // 49 000 so'm, shuning uchun shunday buyurtma yaratishning yo'li yo'q edi.
  //
  // Bu tur HECH NARSA BERMAYDI: karta yaratmaydi, biriktirmaydi, premium
  // yoqmaydi, jismoniy karta buyurtmasi ochmaydi. U faqat to'lov YO'LINI
  // (CheckPerform -> Create -> Perform) uchdan-uchgacha tekshiradi va
  // o'zini 'paid' deb belgilaydi. Shu sababli u quyidagi umumiy
  // mantiqdan OLDIN, alohida hal qilinadi — aks holda "allaqachon
  // to'langan" tarmog'i mavjud bo'lmagan kartaning egasini qidirib
  // `code_taken` qaytarardi va takroriy PerformTransaction yiqilardi.
  if (order.kind === 'payme_test') {
    if (order.status === 'paid') return { ok: true, alreadyPaid: true };
    if (order.status !== 'pending') return { alreadyProcessed: true };
    await setWebOrderStatusD1(env, order.id, 'paid');
    return { ok: true };
  }

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

  // Legacy (server/db.js finalizePaidWebOrder) bilan bir xil: premium
  // yangilash faqat users.is_premium ni yoqadi; jismoniy karta buyurtmasi
  // physical_cards qatorini SHU YERDA (to'lovdan keyin) yaratadi.
  if (order.kind === 'premium_upgrade') {
    await env.DB.prepare(`UPDATE users SET is_premium = 1 WHERE id = ?`).bind(order.userId).run();
    await setWebOrderStatusD1(env, order.id, 'paid');
    return { ok: true };
  }
  if (order.kind === 'physical_card_order') {
    const p = order.payload || {};
    await createPhysicalCardD1(env, {
      linkedCode: order.code,
      ownerUserId: order.userId,
      shippingName: p.shippingName || '',
      shippingPhone: p.shippingPhone || '',
      shippingAddress: p.shippingAddress || '',
    });
    await setWebOrderStatusD1(env, order.id, 'paid');
    return { ok: true };
  }
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

// Nima uchun avtorizatsiya rad etilganini AYTIB beradi — Payme bilan
// ulanishda -32504 ("Ruxsat yo'q") xatosini ko'r-ko'rona qidirmaslik
// uchun. Qaytarilgan sabab logga yoziladi; kalitning O'ZI hech qachon
// logga tushmaydi, faqat uzunliklar solishtiriladi.
function paymeAuthReasonD1(request, env) {
  const key = (env.PAYME_KEY || '').trim();
  if (!key) return 'kalit_sozlanmagan';
  const header = request.headers.get('authorization') || request.headers.get('Authorization') || '';
  if (!header) return 'authorization_sarlavhasi_yoq';
  const [scheme, b64] = header.split(' ');
  if (scheme !== 'Basic') return `sxema_notogri:${scheme}`;
  if (!b64) return 'base64_qismi_yoq';
  let decoded;
  try { decoded = atob(b64); } catch { return 'base64_ochilmadi'; }
  const sep = decoded.indexOf(':');
  if (sep < 0) return 'ikki_nuqta_yoq';
  const login = decoded.slice(0, sep);
  const pass = decoded.slice(sep + 1);
  if (login !== 'Paycom') return `login_notogri:${login}`;
  if (!timingSafeEqualStr(pass, key)) {
    // Uzunliklar — kalitning o'zi emas. Mos kelmasa: butunlay boshqa
    // kalit qo'yilgan. Mos kelsa-yu tenglik bo'lmasa: bitta-ikkita belgi
    // farq qilyapti (nusxa olishda kesilgan yoki almashib ketgan).
    return `kalit_mos_emas:kutilgan_uzunlik=${key.length},kelgan_uzunlik=${pass.length}`;
  }
  return '';
}

function verifyPaymeAuthD1(request, env) {
  return paymeAuthReasonD1(request, env) === '';
}

// Ikkala gate ham rost bo'lishi kerak — xuddi legacy paymentsEnabled()
// kabi (PAYMENTS_ENABLED muhit o'zgaruvchisi VA Payme kredentsiallari).
// Hozircha ikkalasi ham sozlanmagan — bu funksiya har doim `false`
// qaytaradi, hech qanday real to'lov qabul qilinmaydi.
function paymentsEnabledD1(env) {
  return paymeEnabledD1(env) || clickEnabledD1(env);
}

// Payme yoqilganmi — avvalgi `paymentsEnabledD1()` mantig'i o'zgarishsiz.
function paymeEnabledD1(env) {
  return env.PAYMENTS_ENABLED === 'true' && !!(env.PAYME_MERCHANT_ID && env.PAYME_KEY);
}

// Click yoqilganmi. Payme bilan BIR XIL naqsh: umumiy `PAYMENTS_ENABLED`
// bayrog'i + shu provayderning kalitlari mavjudligi. Kalitlarning O'ZI
// hech qachon o'qilmaydi/qaytarilmaydi — faqat mavjudligi tekshiriladi.
//
// Click hali shartnoma bosqichida: kalitlar qo'yilmaguncha bu false
// qaytaradi va interfeysda Click "tez kunlarda" bo'lib turadi. Kalitlar
// Cloudflare secrets'ga qo'yilishi bilan o'zi yoqiladi — kodni qayta
// deploy qilish shart emas.
function clickEnabledD1(env) {
  return env.PAYMENTS_ENABLED === 'true' && !!(env.CLICK_SERVICE_ID && env.CLICK_SECRET_KEY);
}

// Payme test/sandbox rejimi — FAQAT oshkora (maxfiy bo'lmagan) sozlamadan
// aniqlanadi: `PAYME_SANDBOX="true"` yoki test checkout domeni. Merchant
// kalitining o'zi HECH QACHON o'qilmaydi/tekshirilmaydi.
//
// Bu bayroq faqat KO'RINISHGA ta'sir qiladi — interfeysda "TEST REJIMI /
// Real pul yechilmaydi" yozuvi chiqadi. To'lov mantig'i, Merchant API
// metodlari va idempotentlik unga UMUMAN bog'liq emas.
//
// Standart qiymati — false (yoqilmagan). Sababi: agar Dashboard'dagi
// merchant kalitlari aslida REAL bo'lsa-yu, biz taxmin bilan "real pul
// yechilmaydi" deb yozib qo'ysak — bu foydalanuvchini aldash bo'lardi.
// Shuning uchun bu yozuvni faqat operator ATAYLAB `PAYME_SANDBOX=true`
// qo'ygandagina ko'rsatamiz.
function paymeSandboxD1(env) {
  // ANIQ qo'yilgan qiymat HAR DOIM ustun. Bu muhim: ertaga real Merchant
  // ma'lumotlari qo'yilib PAYME_SANDBOX="false" bo'lsa, checkout domeni
  // hali test.paycom.uz bo'lib qolgan bo'lsa ham "TEST REJIMI" va
  // "Real pul yechilmaydi" izohlari DARHOL yo'qolishi kerak.
  if (env.PAYME_SANDBOX === 'false') return false;
  if (env.PAYME_SANDBOX === 'true') return true;
  // Aniq qo'yilmagan bo'lsa — checkout domeni bo'yicha taxmin.
  return /(^|\.)test\./i.test(String(env.PAYME_CHECKOUT_DOMAIN || ''));
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
  // `.trim()` — verifyPaymeAuthD1() dagi bilan bir xil sabab: panelga
  // qo‘yilgan qiymat oxiridagi bo‘sh joy base64 ichiga tushib, checkout
  // havolasini yaroqsiz qilardi.
  const merchantId = (env.PAYME_MERCHANT_ID || '').trim();
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
        //
        // TWO real bugs fixed here (found via Payme's own sandbox — a
        // real order's transaction went missing from a same-day range):
        //
        // 1. Filtered by created_at (order/reservation time — when
        //    "Band qilish" happened, possibly long before Payme was ever
        //    involved) instead of the actual transaction-creation time.
        //    A buyer who reserves on day 1 but pays on day 5 would be
        //    invisible to a GetStatement call for day 5's range.
        //    COALESCE(payme_create_time, created_at) matches every other
        //    surface (paymeCreateTimeMs()) and falls back correctly for
        //    rows written before this column existed.
        //
        // 2. Compared raw strings: SQLite's own CURRENT_TIMESTAMP writes
        //    "YYYY-MM-DD HH:MM:SS" (a space at position 10), while
        //    toISOString() produces "YYYY-MM-DDTHH:MM:SS.sssZ" ('T' at
        //    position 10). Lexicographically ' ' (0x20) < 'T' (0x54), so
        //    ANY same-day stored timestamp compared against a 'T'-style
        //    bound was WRONGLY treated as "before the range" — a same-day
        //    query (exactly what Payme's own tooling and real
        //    reconciliation runs use) silently returned nothing.
        //    Wrapping both sides in SQLite's own datetime() normalizes
        //    the format before comparing, sidestepping the mismatch
        //    entirely — the same pattern already used elsewhere in this
        //    file for a bank-settlement date range.
        const fromIso = new Date(Number(params?.from) || 0).toISOString();
        const toIso = new Date(Number(params?.to) || Date.now()).toISOString();
        const rows = await env.DB.prepare(`
          SELECT ${WEB_ORDER_SELECT} FROM web_orders
          WHERE payme_transaction_id IS NOT NULL
            AND datetime(COALESCE(payme_create_time, created_at)) BETWEEN datetime(?) AND datetime(?)
          ORDER BY COALESCE(payme_create_time, created_at)
        `).bind(fromIso, toIso).all();
        const transactions = (rows.results || []).map((r) => {
          const o = parseWebOrderRow(r);
          const createMs = paymeCreateTimeMs(o);
          return {
            id: o.paymeTransactionId,
            time: createMs,
            amount: Math.round(Number(o.price) * 100),
            account: { order_id: String(o.id) },
            create_time: createMs,
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
  finalizePaidWebOrderD1, handlePaymeRequestD1, verifyPaymeAuthD1, paymeAuthReasonD1, paymentsEnabledD1,
  paymeCheckoutLinkD1, getRecord, getRecordOwner, PAYME_ERR, ensureCoreSchema,
  validateRecordBody, updateRecord, parseMusicUrls,
  // scripts/test-company-id.mjs — src/lib/company.js bilan parite.
  companyId, normalizeCompanyIdD1, companyIdLettersD1, companyPricing,
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

// ── PROFIL MUSIQASI LIMITI ─────────────────────────────────────────────
// Oddiy foydalanuvchi 5 ta, Premium 10 ta qo'shiq. AYNAN shu qiymatlar
// frontendda ham ishlatiladi (src/lib/musicLimits.js) — ikkalasi
// scripts/test-music-limits.mjs bilan solishtiriladi.
const MUSIC_LIMIT_FREE_D1 = 5;
const MUSIC_LIMIT_PREMIUM_D1 = 10;
// Bitta musiqa faylining maksimal hajmi (MB) — src/lib/musicLimits.js
// MUSIC_MAX_MB bilan AYNAN bir xil (parity testda tekshiriladi).
// DIQQAT: bu FAQAT audio uchun. Admin rasm yuklashi 10 MB bo'lib qoladi.
const MUSIC_MAX_MB_D1 = 20;
function musicLimitD1(isPremium) { return isPremium ? MUSIC_LIMIT_PREMIUM_D1 : MUSIC_LIMIT_FREE_D1; }

function validateRecordBody(body, opts = {}) {
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
  // Ko'pi bilan 5 ta qo'shiq — `musicUrls` (yangi, ro'yxat) yoki eski
  // `musicUrl` (bitta URL, orqaga moslik uchun) qabul qilinadi.
  // Limit foydalanuvchining premium holatiga qarab (oddiy 5 / premium 10).
  // Chaqiruvchi bermasa — eng qat'iy (oddiy) limit qo'llanadi.
  const musicMax = Number.isFinite(opts.musicMax) ? opts.musicMax : MUSIC_LIMIT_FREE_D1;
  const musicUrls = (Array.isArray(body.musicUrls) ? body.musicUrls : (body.musicUrl ? [body.musicUrl] : []))
    .map((u) => uploadOrSafeUrl(u)).filter(Boolean).slice(0, musicMax);
  const record = {
    name, role: cleanStr(body.role, 100), avatarUrl: uploadOrSafeUrl(body.avatarUrl), bgUrl: uploadOrSafeUrl(body.bgUrl),
    bgPattern: body.bgPattern !== false, accentColor: /^#[0-9a-fA-F]{6}$/.test(String(body.accentColor || '').trim()) ? body.accentColor.trim() : '',
    bgColor: /^#[0-9a-fA-F]{6}$/.test(String(body.bgColor || '').trim()) ? body.bgColor.trim() : '', bgAnimated: body.bgAnimated !== false,
    linksTransparent: linkStyle === 'glass' || body.linksTransparent === true, linkStyle,
    musicUrls, tg: cleanStr(body.tg, 40).replace(/^@/, ''), phone: cleanStr(body.phone, 24),
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
    tg: 'tg', phone: 'phone', email: 'email', linkedin: 'linkedin', instagram: 'instagram',
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
  // Limit allaqachon validateRecordBody() da premium holatiga qarab
  // qo'llangan; bu yerda faqat eng yuqori chegara (xavfsizlik uchun).
  if ('musicUrls' in fields) { sets.push('music_url = ?'); vals.push(JSON.stringify(fields.musicUrls.slice(0, MUSIC_LIMIT_PREMIUM_D1))); }
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
    // Brute-force / scrypt CPU-DoS himoyasi: IP bo'yicha 10, email bo'yicha 5 urinish / 15 daqiqa (D1).
    if (await rateLimitD1(env, 'login:ip:' + reqIp(request), 10, 15 * 60_000) || await rateLimitD1(env, 'login:email:' + email, 5, 15 * 60_000)) {
      return json({ error: 'too_many_requests' }, 429);
    }
    const row = await env.DB.prepare(
      `SELECT id, email, password_hash, deleted_at, suspended_until, suspend_reason FROM users WHERE email = ?`
    ).bind(email).first();
    if (!row || !(await verifyPassword(password, row.password_hash))) return json({ error: 'bad_credentials' }, 401);
    if (row.deleted_at) return json({ error: 'account_deleted' }, 403);
    if (row.suspended_until && parseDbDate(row.suspended_until) > new Date()) {
      return json({ error: 'account_suspended', suspendedUntil: row.suspended_until, reason: row.suspend_reason }, 403);
    }
    const session = await createUserSession(env, row.id, request);
    return jsonWithCookie({ user: { id: row.id, email: row.email } }, 200, session.cookie);
  }

  if (path === '/api/auth/logout' && request.method === 'POST') {
    const token = parseCookies(request)[SESSION_COOKIE];
    if (token) await env.DB.prepare(`DELETE FROM sessions WHERE token IN (?, ?)`).bind(await sha256Hex(token), token).run();
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


// ── PUBLIC JAVOBLARNI CHEKKADA KESHLASH (2026-09) ────────────────────────
// Katalog HAR BIR mehmon uchun qaytadan hisoblanardi: 500 qatorlik
// so'rov + har qatorga qo'shimcha `EXISTS` tekshiruvlari + auksion
// narxlari. Reklama'dan keyin bir vaqtda yuzlab odam kirsa, bu D1 ga
// eng katta yuk manbai edi. Endi javob Cloudflare chekkasida 60 soniya
// saqlanadi: bir daqiqada bir marta hisoblanadi, qolganlar keshdan
// oladi. 60 soniya — admin o'zgartirish kiritgach katalog yangilanishi
// uchun yetarlicha qisqa.
//
// FAQAT foydalanuvchiga BOG'LIQ BO'LMAGAN javoblar uchun. Bu yerda
// ishlatilgan endpointlar cookie ham, sessiya ham o'qimaydi — javob
// hamma uchun bir xil. Sessiya cookie'si bor so'rov keshlanmaydi ham,
// keshdan o'qilmaydi ham (admin/egasi doim yangi ma'lumot ko'radi).
//
// `caches` faqat Workers runtime'ida bor — Node'dagi testlarda yo'q,
// shuning uchun har joyda mavjudligi tekshiriladi va bo'lmasa oddiy
// (keshsiz) yo'l ishlaydi.
const EDGE_CACHE_SECONDS = 60;
function edgeCacheAvailable(request) {
  if (typeof caches === 'undefined' || !caches.default) return false;
  // Kirgan foydalanuvchi — keshga umuman tegmaymiz.
  return !String(request.headers.get('cookie') || '').includes('nfc_session=');
}
async function edgeCached(request, url, build) {
  if (!edgeCacheAvailable(request)) return build();
  const key = new Request(url.origin + url.pathname, { method: 'GET' });
  try {
    const hit = await caches.default.match(key);
    if (hit) return hit;
  } catch { /* kesh o'qilmasa — oddiy yo'l */ }
  const res = await build();
  if (res.status === 200) {
    const cacheable = new Response(res.body, res);
    cacheable.headers.set('cache-control', `public, max-age=${EDGE_CACHE_SECONDS}`);
    try { await caches.default.put(key, cacheable.clone()); } catch { /* jim */ }
    return cacheable;
  }
  return res;
}

async function recordsApi(request, env, url) {
  const path = url.pathname;

  if (path === '/api/records' && request.method === 'GET') {
    return edgeCached(request, url, async () => {
    // is_gift — admin sovg'asi belgisi (catalogCard izohiga qarang).
    // catalogVisibleSql — ro'yxatdan o'tishdagi avtomatik ID'lar butunlay
    // chiqarib tashlanadi (ro'yxat, filtr, sanoq va pagination ham shu
    // javobdan hisoblanadi, shuning uchun ular hech qayerda ko'rinmaydi).
    const rows = await env.DB.prepare(
      `SELECT ${RECORD_COLUMNS},
              EXISTS(SELECT 1 FROM nfc_gifts g WHERE g.code = cards.code AND g.status = 'activated') AS is_gift
         FROM cards WHERE hidden_from_directory = 0 AND ${catalogVisibleSql('cards')}
         ORDER BY ts DESC LIMIT 500`
    ).all();
    const finals = await auctionFinalPricesD1(env);
    return json((rows.results || []).map((r) => catalogCard(
      { ...rowToRecord(r), isGift: !!r.is_gift },
      finals.get(String(r.code || '').toUpperCase()) ?? null,
    )));
    });
  }

  if (path === '/api/records/search' && request.method === 'GET') {
    const q = String(url.searchParams.get('q') || '').trim().slice(0, 120);
    if (q.length < 2) return json({ records: [] });
    const like = `%${q.toLowerCase()}%`;
    const rows = await env.DB.prepare(
      `SELECT c.code, c.name, c.role, c.avatar_url, c.tg, c.hashtags, c.theme, c.price, c.ts, c.views,
              c.profile_type, c.city, c.category_slug, c.verified, c.tier_override,
              EXISTS(SELECT 1 FROM nfc_gifts g WHERE g.code = c.code AND g.status = 'activated') AS is_gift
       FROM cards c LEFT JOIN users u ON u.id = c.user_id
       WHERE c.hidden_from_directory = 0 AND ${catalogVisibleSql('c')} AND (
         LOWER(c.code) LIKE ? OR LOWER(c.name) LIKE ? OR LOWER(COALESCE(c.role,'')) LIKE ? OR
         LOWER(COALESCE(c.city,'')) LIKE ? OR LOWER(COALESCE(c.email,'')) LIKE ? OR
         LOWER(COALESCE(c.phone,'')) LIKE ? OR LOWER(COALESCE(c.tg,'')) LIKE ? OR
         LOWER(c.hashtags) LIKE ? OR LOWER(COALESCE(u.email,'')) LIKE ? OR LOWER(COALESCE(u.phone,'')) LIKE ?
       ) ORDER BY c.ts DESC LIMIT 60`
    ).bind(like, like, like, like, like, like, like, like, like, like).all();
    const finals = await auctionFinalPricesD1(env);
    const records = (rows.results || []).map((r) => catalogCard({
      code: r.code, name: r.name, role: r.role || '', avatarUrl: r.avatar_url || '', tg: r.tg || '',
      hashtags: parseJsonArray(r.hashtags), theme: r.theme, price: Number(r.price), ts: Number(r.ts), views: Number(r.views),
      profileType: r.profile_type, city: r.city || '', categorySlug: r.category_slug || '', verified: !!r.verified,
      tierOverride: r.tier_override || '', isGift: !!r.is_gift,
    }, finals.get(String(r.code || '').toUpperCase()) ?? null));
    return json({ records });
  }

  // ---- /api/records/:code/{view,like,posts} — server/index.js bilan bir xil
  // kontrakt (frontend src/lib/db.js o'zgarishsiz ishlaydi). Avval bu
  // yo'llar Worker'da yo'q edi → legacy proxy → 405.
  const subMatch = path.match(/^\/api\/records\/([A-Za-z0-9]+)\/(view|like|posts)$/);
  if (subMatch) {
    const code = subMatch[1].toUpperCase();
    const action = subMatch[2];
    if (!validCode(code)) return json({ error: 'bad_code' }, 400);

    // Ko'rishlar hisoblagichi — fire-and-forget (public profildan keladi).
    if (action === 'view' && request.method === 'POST') {
      // Bitta tashrifchi (IP+UA hash) bitta profilni 6 soatda 1 marta hisoblaydi —
      // reyting soxtalashtirishga qarshi (audit S10).
      const visitor = await newsVisitorHash(request);
      const limited = await rateLimitD1(env, `view:${code}:${visitor}`, 1, 6 * 60 * 60_000);
      if (limited) {
        const cur = await env.DB.prepare(`SELECT views FROM cards WHERE code = ?`).bind(code).first();
        if (!cur) return json({ error: 'not_found' }, 404);
        return json({ views: Number(cur.views) });
      }
      const row = await env.DB.prepare(`UPDATE cards SET views = views + 1 WHERE code = ? RETURNING views`)
        .bind(code).first();
      if (!row) return json({ error: 'not_found' }, 404);
      // Legacy incrementViews kabi analytics uchun profile_view hodisasi ham yoziladi
      // (hosting/api/engagement.js analytics totalViews/byDay shu qatorlarga tayanadi).
      try {
        let ref = null;
        try { ref = (await request.clone().json())?.ref ?? null; } catch { /* body yo'q */ }
        await env.DB.prepare(`INSERT INTO card_events (code, event_type, ref, visitor_hash, created_at) VALUES (?, 'profile_view', ?, ?, ?)`)
          .bind(code, ref ? String(ref).slice(0, 120) : null, visitor, nowTs()).run();
      } catch { /* analytics yozuvi asosiy javobni buzmasin */ }
      return json({ views: Number(row.views) });
    }

    if (action === 'like' && request.method === 'GET') {
      const user = await getCurrentUser(request, env);
      const cnt = await env.DB.prepare(`SELECT COUNT(*) AS n FROM card_likes WHERE code = ?`).bind(code).first();
      let liked = false;
      if (user) {
        const mine = await env.DB.prepare(`SELECT 1 AS x FROM card_likes WHERE code = ? AND user_id = ?`).bind(code, user.id).first();
        liked = !!mine;
      }
      return json({ count: Number(cnt?.n || 0), liked });
    }

    if (action === 'like' && request.method === 'POST') {
      const user = await getCurrentUser(request, env);
      if (!user) return json({ error: 'unauthorized' }, 401);
      const existing = await env.DB.prepare(`SELECT id FROM card_likes WHERE code = ? AND user_id = ?`).bind(code, user.id).first();
      if (existing) {
        await env.DB.prepare(`DELETE FROM card_likes WHERE id = ?`).bind(existing.id).run();
        return json({ liked: false });
      }
      await env.DB.prepare(`INSERT OR IGNORE INTO card_likes (code, user_id) VALUES (?, ?)`).bind(code, user.id).run();
      return json({ liked: true });
    }

    if (action === 'posts' && request.method === 'GET') {
      const user = await getCurrentUser(request, env);
      return json({ posts: await listPostsD1(env, code, user ? user.id : null) });
    }

    if (action === 'posts' && request.method === 'POST') {
      const user = await getCurrentUser(request, env);
      if (!user) return json({ error: 'unauthorized' }, 401);
      const body = await request.json().catch(() => ({}));
      const imageUrl = String(body?.imageUrl || '');
      const videoUrl = String(body?.videoUrl || '');
      const caption = String(body?.caption || '').slice(0, 600);
      const okImg = imageUrl.startsWith('/uploads/') && !/[^\w\-./]/.test(imageUrl);
      const okVid = videoUrl.startsWith('/uploads/') && /\.(mp4|webm)$/i.test(videoUrl) && !/[^\w\-./]/.test(videoUrl);
      if (!okImg && !okVid) return json({ error: 'bad_image' }, 422);
      const rec = await getRecord(env, code);
      if (!rec) return json({ error: 'not_found' }, 404);
      const owner = await getRecordOwner(env, code);
      if (String(owner) !== String(user.id)) return json({ error: 'not_owner' }, 403);
      const access = effectiveAccessD1(rec);
      if (!featureAllowedD1('post', access)) return json({ error: 'feature_locked', feature: 'post' }, 403);
      if (okVid && !featureAllowedD1('video', access)) return json({ error: 'feature_locked', feature: 'video' }, 403);
      // Grandfathering: limit faqat YANGI post qo'shishga ta'sir qiladi.
      const limit = POST_LIMIT_D1[access] ?? 0;
      const cnt = await env.DB.prepare(`SELECT COUNT(*) AS n FROM posts WHERE code = ?`).bind(code).first();
      if (Number(cnt?.n || 0) >= limit) return json({ error: 'limit_reached', limit }, 409);
      const row = await env.DB.prepare(
        `INSERT INTO posts (code, user_id, image_url, video_url, caption) VALUES (?, ?, ?, ?, ?)
         RETURNING id, image_url, video_url, caption, created_at`
      ).bind(code, user.id, okImg ? imageUrl : null, okVid ? videoUrl : null, caption || null).first();
      return json(postRowToJson(row, 0, false), 201);
    }
    return null;
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
      // Musiqa limiti FOYDALANUVCHINING premium holatiga bog'liq:
      // oddiy 5 ta, Premium 10 ta (NFC ID darajasiga bog'liq emas).
      const { record, error } = validateRecordBody(body, { musicMax: musicLimitD1(!!user.isPremium) });
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
      const { record, error } = validateRecordBody(body, { musicMax: musicLimitD1(!!user.isPremium) });
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
      `SELECT id, code, kind, price, status, created_at AS createdAt,
              ${PENDING_EXPIRES_MS_SQL} AS expiresAtMs
         FROM web_orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 20`
    ).bind(user.id).all();
    // `expiresAtMs` FAQAT kutilayotgan buyurtma uchun ma'noga ega —
    // kabinetda shu bo'yicha teskari hisob ko'rsatiladi.
    //
    // `payLink` (2026-09) — kutilayotgan buyurtmani DAVOM ETTIRISH uchun.
    // Avval "To'lovlar" sahifasida kutilayotgan buyurtma yonida faqat
    // "Kutilmoqda" yozuvi turardi va uni to'lashning HECH QANDAY yo'li
    // yo'q edi: mijoz band qilib, to'lovni tugatmasa, kod 24 soat band
    // qolib ketardi va u qaytadan urinolmasdi ham (o'zining kutilayotgan
    // buyurtmasi to'sqinlik qilardi).
    //
    // Havolada maxfiy narsa yo'q: merchant ID har bir checkout manzilida
    // ochiq turadi, buyurtma esa allaqachon shu foydalanuvchiniki
    // (so'rov user_id bo'yicha filtrlangan).
    return json({
      orders: (rows.results || []).map((r) => ({
        ...r,
        price: Number(r.price),
        expiresAtMs: r.status === 'pending' && r.expiresAtMs != null ? Number(r.expiresAtMs) : null,
        payLink: r.status === 'pending' ? paymeCheckoutLinkD1(env, r.id, Number(r.price)) : null,
      })),
    });
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

// Profil foni uchun GIF/video maksimal hajmi — AYNAN 50 MB.
// 50 * 1024 * 1024 = 52 428 800 bayt. Bu chegara faqat profil foni
// media'siga tegishli (avatar/post/logo/musiqa limitlari o'zgarmagan).
const PROFILE_BG_MAX_BYTES = 50 * 1024 * 1024;
// Mijoz yuborishi mumkin bo'lgan, lekin bir xil turni bildiruvchi MIME
// nomlari (masalan iOS ba'zan video/quicktime deb yuboradi, ichida esa
// ftyp/mp4 bo'ladi).
const PROFILE_BG_ALIASES = {
  'application/octet-stream': ['image/gif', 'video/mp4', 'video/webm'],
  'video/quicktime': ['video/mp4'],
  'video/x-m4v': ['video/mp4'],
  'video/x-matroska': ['video/webm'],
};

// POST /api/upload, /api/upload-audio, /api/upload-card-video,
//      /api/upload-profile-bg, /api/admin/upload
async function uploadApi(request, env, pathname) {
  const isAdmin = pathname === '/api/admin/upload';
  const auth = isAdmin ? await requireAdmin(request, env) : await getCurrentUser(request, env);
  if (!auth) return json({ error: 'unauthorized' }, 401);
  const actor = isAdmin ? `admin:${auth.role || 'admin'}` : `user:${auth.id || auth.email || 'authenticated'}`;
  if (!isAdmin && await rateLimitD1(env, 'upload:user:' + auth.id, 40, 60 * 60_000)) return json({ error: 'too_many_requests' }, 429);

  // ─── PROFIL FONI UCHUN MEDIA (GIF / video) — 50 MB ───────────────────
  // 2026-09. Nima uchun ALOHIDA endpoint (mavjud /api/upload emas):
  // /api/upload base64 dataURL qabul qiladi, base64 esa hajmni ~33% ga
  // oshiradi — 50 MB fayl ~67 MB satrga aylanadi va uni dekodlash uchun
  // yana 50 MB kerak. Workers izolyati 128 MB xotira bilan cheklangan,
  // ya'ni base64 yo'li bilan 50 MB ni ko'tarib bo'lmaydi. Bu yerda tana
  // XOM BINAR sifatida o'qiladi, shuning uchun 50 MB xavfsiz sig'adi.
  // (Cloudflare tomonidan 50 MB dan KICHIK qat'iy limit yo'q: Workers
  // so'rov tanasi >= 100 MB, R2 bitta PUT esa GB darajasida.)
  //
  // Boshqa yuklash limitlari (avatar, post, logo, musiqa, admin) BU
  // O'ZGARISHDAN TASHQARIDA — ular avvalgidek qoladi.
  if (pathname === '/api/upload-profile-bg') {
    // 1) Avval content-length bo'yicha ERTA rad etamiz — 50 MB dan katta
    //    tana umuman o'qilmaydi va saqlanmaydi.
    const declared = Number(request.headers.get('content-length') || 0);
    if (declared > PROFILE_BG_MAX_BYTES) return json({ error: 'too_large', limitMb: 50 }, 413);

    const bytes = new Uint8Array(await request.arrayBuffer());
    if (!bytes.length) return json({ error: 'bad_file' }, 422);
    // 2) Haqiqiy hajm bo'yicha qayta tekshiruv (content-length yolg'on
    //    bo'lishi yoki umuman kelmasligi mumkin).
    if (bytes.length > PROFILE_BG_MAX_BYTES) return json({ error: 'too_large', limitMb: 50 }, 413);

    // 3) Tur — MIME sarlavhasi VA sehrli baytlar bo'yicha. Ikkalasi mos
    //    kelmasa rad etiladi (kengaytma serverda sniff natijasidan
    //    olinadi, mijoz yuborgan nomdan emas).
    const declaredType = String(request.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    const head = String.fromCharCode(...bytes.slice(0, 40));
    const isGif = bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38;
    const isWebm = bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
    const isMp4 = head.includes('ftyp');
    const sniffed = isGif ? { ext: 'gif', type: 'image/gif' }
      : isWebm ? { ext: 'webm', type: 'video/webm' }
      : isMp4 ? { ext: 'mp4', type: 'video/mp4' }
      : null;
    if (!sniffed) return json({ error: 'bad_file' }, 422);
    if (declaredType && declaredType !== sniffed.type && !PROFILE_BG_ALIASES[declaredType]?.includes(sniffed.type)) {
      return json({ error: 'bad_file' }, 422);
    }

    const filename = `profilebg_${uploadRandomHex(12)}.${sniffed.ext}`;
    return json({ url: await putUploadR2(env, filename, bytes, sniffed.type, actor) });
  }

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
  // Audio o'z chegarasiga ega (MUSIC_MAX_MB_D1). Admin rasm yuklashi
  // avvalgidek 10 MB — musiqa limiti ko'tarilgani unga ta'sir qilmaydi.
  const limit = isAudio ? MUSIC_MAX_MB_D1 * 1024 * 1024 : (isAdmin ? 10 * 1024 * 1024 : imageLimit);
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

// 2026-09 hotfix — "Faol / tugadi" ZIDDIYATI.
// Postgres versiyasida auksionni yopish `closeAuctionBidding()` orqali
// bo'lardi; Worker migratsiyasida esa auksionni yopadigan YAGONA joy admin
// paneldagi qo'lda "force-settle" bo'lib qolgan edi. Natijada `ends_at`
// o'tib ketgan auksion D1'da abadiy `status='active'` bo'lib qolardi —
// frontend rozetkasi `Faol` deb ko'rsatardi, qolgan vaqt esa `tugadi` deb.
// Shu yerda o'sha YO'QOLGAN qadam tiklanadi (yangi qoida EMAS — aynan
// server/db.js closeAuctionBidding() mantig'i): muddati o'tgan `active`
// auksion, taklif bo'lgan bo'lsa `awaiting_payment` (+24 soat to'lov
// muddati), taklif bo'lmagan bo'lsa `expired` holatiga o'tadi. Hech qanday
// pul harakati yoki egalik o'tkazish BU YERDA sodir bo'lmaydi — u faqat
// to'lov webhook'i tasdiqlagandan keyin.
//
// Cloudflare Workers'da doimiy ishlab turuvchi jarayon yo'q, shuning uchun
// bu "dangasa" (lazy) tarzda — auksion o'qilgan/taklif yuborilgan har bir
// so'rovda — bajariladi. `WHERE ... AND status='active'` sharti tufayli
// parallel so'rovlar bir xil auksionni ikki marta yopa olmaydi.
async function closeExpiredAuctionsD1(env) {
  try {
    // ends_at TEXT ustuni ikki xil formatda bo'lishi mumkin (eski Postgres
    // "YYYY-MM-DD HH:MM:SS+00" va yangi ISO 8601) — SQL satr taqqoslash
    // ishonchsiz, shuning uchun parseDbDate() bilan JS tomonda solishtiramiz.
    const rows = await env.DB.prepare(
      `SELECT id, ends_at, highest_bidder_id FROM auctions WHERE status = 'active' ORDER BY ends_at ASC LIMIT 200`
    ).all();
    const now = Date.now();
    const due = (rows.results || []).filter((r) => {
      const d = parseDbDate(r.ends_at);
      return d && d.getTime() <= now;
    });
    if (!due.length) return 0;
    for (const a of due) {
      if (a.highest_bidder_id) {
        const deadline = new Date(now + 24 * 3600_000).toISOString();
        await env.DB.prepare(
          `UPDATE auctions SET status = 'awaiting_payment', payment_deadline = ? WHERE id = ? AND status = 'active'`
        ).bind(deadline, a.id).run();
      } else {
        await env.DB.prepare(`UPDATE auctions SET status = 'expired' WHERE id = ? AND status = 'active'`).bind(a.id).run();
      }
    }
    return due.length;
  } catch (e) {
    // Yopish ishlamasa ham o'qish so'rovi yiqilmasin — eng yomoni status
    // bir zumga eskicha ko'rinadi, lekin taklif yo'li (placeBidD1) baribir
    // `ends_at`ni alohida tekshiradi, ya'ni tugagan auksionga taklif
    // O'TMAYDI.
    console.error('closeExpiredAuctionsD1', e && e.message);
    return 0;
  }
}

// server/db.js'dagi `place_bid()` PL/pgSQL funksiyasining D1 (SQLite)
// portlanishi — biznes qoidalari AYNAN o'sha: idempotentlik, o'z
// auksioniga taklif qilmaslik, birinchi taklif >= boshlang'ich narx,
// keyingilari >= joriy narx + min qadam, "darhol sotib olish" va
// 5 daqiqalik ANTI-SNIPE uzaytmasi.
//
// D1'da `SELECT ... FOR UPDATE` yo'q, lekin bitta bazaga yozuvlar ketma-ket
// (serializatsiya qilingan) bajariladi. Shu sababli poyga holati (ikki
// foydalanuvchi bir vaqtda bir xil narxni taklif qilishi) OPTIMISTIK
// qulf bilan yopiladi: auksion UPDATE'i `WHERE ... AND status='active'
// AND current_price = <biz o'qigan narx>` sharti bilan bajariladi va
// RETURNING bo'sh kelsa — kimdir bizdan oldin ulgurgan, taklif qabul
// qilinmaydi (409), pul yoki tarix buzilmaydi.
async function placeBidD1(env, { auctionId, userId, amount, idempotencyKey }) {
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: 'BID_TOO_LOW' };

  if (idempotencyKey) {
    const prev = await env.DB.prepare(`SELECT id FROM bids WHERE idempotency_key = ?`).bind(idempotencyKey).first();
    if (prev) return { ok: true, idempotent: true, bidId: prev.id };
  }

  const a = await env.DB.prepare(
    `SELECT id, seller_id, current_price, buy_now_price, highest_bidder_id, status, ends_at,
            COALESCE(min_increment, 0) AS min_increment
     FROM auctions WHERE id = ?`
  ).bind(auctionId).first();
  if (!a) return { ok: false, error: 'AUCTION_NOT_FOUND' };

  const endsAt = parseDbDate(a.ends_at);
  if (a.status !== 'active' || !endsAt || endsAt.getTime() <= Date.now()) {
    return { ok: false, error: 'AUCTION_ALREADY_CLOSED' };
  }
  if (a.seller_id != null && Number(a.seller_id) === Number(userId)) return { ok: false, error: 'OWN_AUCTION' };

  const currentPrice = Number(a.current_price);
  const minIncrement = Number(a.min_increment) || 0;
  if (a.highest_bidder_id == null) {
    if (amount < currentPrice) return { ok: false, error: 'BID_TOO_LOW', minNext: currentPrice };
  } else if (amount < currentPrice + minIncrement) {
    return { ok: false, error: 'BID_TOO_LOW', minNext: currentPrice + minIncrement };
  }

  const buyNow = a.buy_now_price != null && amount >= Number(a.buy_now_price);
  const FIVE_MIN_MS = 5 * 60_000;
  let antiSnipe = false;
  let newEndsAt = a.ends_at;
  if (!buyNow && endsAt.getTime() - Date.now() <= FIVE_MIN_MS) {
    newEndsAt = new Date(endsAt.getTime() + FIVE_MIN_MS).toISOString();
    antiSnipe = true;
  }

  let updated;
  if (buyNow) {
    const closedAt = new Date().toISOString();
    const deadline = new Date(Date.now() + 24 * 3600_000).toISOString();
    updated = await env.DB.prepare(
      `UPDATE auctions
          SET current_price = ?, highest_bidder_id = ?, status = 'awaiting_payment',
              ends_at = ?, payment_deadline = ?
        WHERE id = ? AND status = 'active' AND current_price = ?
        RETURNING id`
    ).bind(amount, userId, closedAt, deadline, auctionId, currentPrice).first();
  } else {
    updated = await env.DB.prepare(
      `UPDATE auctions
          SET current_price = ?, highest_bidder_id = ?, ends_at = ?
        WHERE id = ? AND status = 'active' AND current_price = ?
        RETURNING id`
    ).bind(amount, userId, newEndsAt, auctionId, currentPrice).first();
  }
  // Bizdan oldin boshqa taklif o'tib ketdi (yoki auksion yopildi) —
  // narx o'zgargani uchun bu taklif endi yaroqsiz.
  if (!updated) return { ok: false, error: 'BID_TOO_LOW', minNext: currentPrice + minIncrement };

  let bidId = null;
  try {
    const ins = await env.DB.prepare(
      `INSERT INTO bids (auction_id, user_id, amount, idempotency_key, created_at) VALUES (?, ?, ?, ?, ?) RETURNING id`
    ).bind(auctionId, userId, amount, idempotencyKey || null, nowTs()).first();
    bidId = ins ? ins.id : null;
  } catch (e) {
    // UNIQUE(idempotency_key) — aynan bir xil kalitli ikkita so'rov bir
    // vaqtda kirib kelgan holat. Narx allaqachon yangilangan, shuning
    // uchun bu MUVAFFAQIYAT (idempotent takror), xato emas.
    if (!/UNIQUE|constraint/i.test(String(e && e.message))) throw e;
    return { ok: true, idempotent: true, buyNow, antiSnipe, newEndsAt };
  }

  return { ok: true, buyNow, bidId, antiSnipe, newEndsAt };
}

// Bir xil auksion uchun allaqachon to'lov kutayotgan buyurtma (ikki marta
// to'lov xavfini oldini olish uchun) — server/index.js'dagi
// getPendingAuctionPaymentOrder() bilan bir xil.
async function getPendingAuctionPaymentOrderD1(env, auctionId, userId) {
  const rows = await env.DB.prepare(
    `SELECT ${WEB_ORDER_SELECT} FROM web_orders
      WHERE user_id = ? AND kind = 'auction_payment' AND status = 'pending'
      ORDER BY id DESC LIMIT 20`
  ).bind(userId).all();
  for (const r of rows.results || []) {
    const o = parseWebOrderRow(r);
    if (o && Number(o.payload?.auctionId) === Number(auctionId)) return o;
  }
  return null;
}

async function auctionsPublicApi(request, env, url) {
  const path = url.pathname;

  if (path === '/api/auctions' && request.method === 'GET') {
    await closeExpiredAuctionsD1(env);
    const active = await env.DB.prepare(`SELECT * FROM auctions WHERE status = 'active' ORDER BY ends_at ASC LIMIT 200`).all();
    const auctions = (active.results || []).map(auctionRow);
    if (url.searchParams.get('withSold') === '1') {
      // "Sotilgan" bo'limi FAQAT hali mavjud ID'larni ko'rsatadi. Karta
      // katalogdan o'chirilgan bo'lsa (admin o'chirgan), uning eski auksion
      // yozuvi `auctions` jadvalida qolib ketadi va avval shu yerda "Auksion
      // yakunlandi" bo'lib osilib turardi — foydalanuvchi bosolmaydigan,
      // katalogda topib bo'lmaydigan ID. Yozuvning O'ZI o'chirilmaydi
      // (auksion tarixi saqlanadi), faqat ko'rsatilmaydi.
      // "Sotilgan" bo'limi FAQAT HAQIQATAN sotilgan lotni ko'rsatadi.
      // Ikkita shart qo'shildi (2026-09):
      //   1. Kod hali katalogda mavjud bo'lsin (o'chirilgan ID osilib
      //      qolmasin) — avvaldan bor edi.
      //   2. Lot uchun HAQIQIY PAYME TO'LOVI o'tgan bo'lsin.
      //
      //      Bu mezon ikki marta aniqlashtirildi:
      //        a) avval "kamida bitta taklif bor" edi — yetarli emas,
      //           chunki sinov lotlarida taklif yozuvi ham bor edi;
      //        b) keyin "status='paid' buyurtma bor" edi — bu ham
      //           yetarli emasligi ishlab chiqarishda ko'rindi:
      //           NEOMSONGS, VVV444 va XXX772 da eski (legacy) sinov
      //           davridan qolgan 'paid' yozuvlar bor ekan.
      //
      //      Provayder tranzaksiya identifikatori esa FAQAT haqiqiy to'lov
      //      oqimida yoziladi (Payme: setWebOrderPaymeIdD1,
      //      CreateTransaction paytida; Click: xuddi shunday).
      //      To'lov tizimlari hech qachon ishga tushirilmagani uchun eski
      //      sinov yozuvlarida ikkalasi ham NULL. Ya'ni bu "pul rostdan
      //      o'tdimi?" degan savolga yagona ishonchli javob.
      //
      //      MUHIM: shart PROVAYDERDAN MUSTAQIL (COALESCE). Agar faqat
      //      `payme_transaction_id` tekshirilsa, Click orqali sotilgan
      //      ID bu ro'yxatda KO'RINMAY qolardi va katalogda "Sovg'a"
      //      bo'lib turaverardi — Click ulangan kuni jimgina buziladigan
      //      xato. Shu sababli ikkala ustun ham hisobga olinadi.
      //
      //      Qoida qo'lda yuritilmaydi: Payme ulangach, birinchi haqiqiy
      //      to'lov o'tishi bilan lot bu yerda o'zi paydo bo'ladi.
      // Yozuvlarning O'ZI o'chirilmaydi — auksion tarixi saqlanadi,
      // faqat ko'rsatilmaydi.
      const sold = await env.DB.prepare(
        `SELECT a.* FROM auctions a
          WHERE a.status = 'sold'
            AND EXISTS (SELECT 1 FROM cards c WHERE c.code = a.code)
            AND EXISTS (SELECT 1 FROM web_orders w
                         WHERE w.code = a.code AND w.kind = 'auction_payment'
                           AND w.status = 'paid'
                           AND COALESCE(w.payme_transaction_id, w.click_transaction_id) IS NOT NULL)
          ORDER BY a.ends_at DESC LIMIT 40`
      ).all();
      // `ownedExclusiveSoldD1()` BU YERDAN OLIB TASHLANDI. U katalogdagi
      // egasi bor ekslyuziv kartalarni "Sotildi" deb ko'rsatardi, holbuki
      // ular auksiondan umuman o'tmagan — ular sovg'a. Endi ular faqat
      // katalogda, "Sovg'a" yozuvi bilan chiqadi.
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
    // Muddati o'tgan auksion "Faol" ko'rinmasin (yuqoridagi izohga qarang).
    await closeExpiredAuctionsD1(env);
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

  // 2026-09 hotfix — /api/auctions/:id/bid va /:id/pay HAR DOIM 503
  // qaytarardi.
  //
  // ILDIZ SABAB: Express -> Worker migratsiyasida bu ikki route KO'CHIRILMAY
  // qolgan, o'rniga qattiq yozilgan (hardcoded) `503 payments_disabled`
  // zaglushka qo'yilgan edi. Ya'ni 503 D1 jadval shakli, sessiya, auksion
  // holati yoki frontend payload'iga UMUMAN bog'liq emas edi — server
  // so'rovni hatto o'qib ham ko'rmasdan rad etardi. Shu sababli
  // foydalanuvchi har doim faqat umumiy "Xatolik yuz berdi" xabarini
  // ko'rardi. Endi server/index.js + server/db.js place_bid() mantig'i
  // to'liq portlandi (biznes qoidalari o'zgarmagan).
  const bidMatch = path.match(/^\/api\/auctions\/(\d+)\/bid$/);
  if (bidMatch && request.method === 'POST') {
    if (!paymentsEnabledD1(env)) return json({ error: 'payments_disabled' }, 503);
    const user = await getCurrentUser(request, env);
    if (!user) return json({ error: 'unauthorized' }, 401);
    if (user.bannedUntil) return json({ error: 'BANNED', bannedUntil: user.bannedUntil }, 403);

    const body = await request.json().catch(() => null);
    const auctionId = Number(bidMatch[1]);
    const amount = Math.round(Number(body?.amount));
    const idempotencyKey = typeof body?.idempotencyKey === 'string' ? body.idempotencyKey.slice(0, 100) : null;
    if (!auctionId || !Number.isFinite(amount) || !amount) return json({ error: 'BAD_INPUT' }, 422);

    // Muddati o'tgan auksionlar avval to'g'ri holatga o'tkaziladi, shunda
    // pastdagi javob "AUCTION_ALREADY_CLOSED" (409) bo'ladi — 503 emas.
    await closeExpiredAuctionsD1(env);
    try {
      const result = await placeBidD1(env, { auctionId, userId: user.id, amount, idempotencyKey });
      // Biznes qoidasi buzilishi = mijoz xatosi (4xx), server nosozligi emas.
      if (result.error) return json(result, result.error === 'AUCTION_NOT_FOUND' ? 404 : 409);
      return json(result);
    } catch (e) {
      // Faqat HAQIQIY server/D1 nosozligi 503 bo'ladi. Logga faqat xato
      // matni yoziladi — token, sessiya yoki maxfiy qiymatlar emas.
      console.error('placeBidD1', e && e.message);
      return json({ error: 'SYSTEM' }, 503);
    }
  }

  const payMatch = path.match(/^\/api\/auctions\/(\d+)\/pay$/);
  if (payMatch && request.method === 'POST') {
    const user = await getCurrentUser(request, env);
    if (!user) return json({ error: 'unauthorized' }, 401);
    if (user.bannedUntil) return json({ error: 'BANNED', bannedUntil: user.bannedUntil }, 403);
    if (!paymentsEnabledD1(env)) return json({ error: 'payments_disabled' }, 503);

    const id = Number(payMatch[1]);
    await closeExpiredAuctionsD1(env);
    const a = await env.DB.prepare(`SELECT * FROM auctions WHERE id = ?`).bind(id).first();
    if (!a) return json({ error: 'AUCTION_NOT_FOUND' }, 404);
    if (a.status !== 'awaiting_payment') return json({ error: 'AUCTION_NOT_AWAITING_PAYMENT' }, 409);
    if (Number(a.highest_bidder_id) !== Number(user.id)) return json({ error: 'NOT_WINNER' }, 403);
    const deadline = parseDbDate(a.payment_deadline);
    if (!deadline || deadline.getTime() <= Date.now()) return json({ error: 'PAYMENT_DEADLINE_PASSED' }, 409);

    const body = await request.json().catch(() => null);
    const name = cleanStr(body?.name, 60);
    const phone = cleanStr(body?.phone, 30).replace(/[\s\-()]/g, '');
    if (!name) return json({ error: 'name_required' }, 422);
    if (!phone) return json({ error: 'phone_required' }, 422);
    const profile = {
      name,
      role: cleanStr(body?.role, 100),
      tg: cleanStr(body?.tg, 40).replace(/^@/, ''),
      phone,
      email: cleanStr(body?.email, 100),
    };

    try {
      const existing = await getPendingAuctionPaymentOrderD1(env, a.id, user.id);
      if (existing) {
        return json({ orderId: existing.id, amount: Number(existing.price), payLink: paymeCheckoutLinkD1(env, existing.id, Number(existing.price)) }, 202);
      }
      const order = await createWebOrderD1(env, {
        userId: user.id, code: a.code, kind: 'auction_payment', price: Number(a.current_price),
        payload: { auctionId: a.id, ...profile },
      });
      return json({ orderId: order.id, amount: Number(a.current_price), payLink: paymeCheckoutLinkD1(env, order.id, Number(a.current_price)) }, 202);
    } catch (e) {
      console.error('auctionPay', e && e.message);
      return json({ error: 'SYSTEM' }, 503);
    }
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
// D1-ga asoslangan rate limit — izolyatga bog'liq emas (in-memory Map'dan farqli).
// key: 'login:ip:1.2.3.4' kabi; limit ta urinish windowMs ichida.
async function rateLimitD1(env, key, limit, windowMs) {
  const now = Date.now();
  try {
    if (Math.random() < 0.01) await env.DB.prepare(`DELETE FROM rate_limits WHERE window_start < ?`).bind(now - 86400000).run();
    const row = await env.DB.prepare(`SELECT hits, window_start FROM rate_limits WHERE key = ?`).bind(key).first();
    if (!row || now - Number(row.window_start) > windowMs) {
      await env.DB.prepare(`INSERT INTO rate_limits (key, hits, window_start) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET hits = 1, window_start = excluded.window_start`).bind(key, now).run();
      return false;
    }
    if (Number(row.hits) >= limit) return true;
    await env.DB.prepare(`UPDATE rate_limits SET hits = hits + 1 WHERE key = ?`).bind(key).run();
    return false;
  } catch (e) {
    console.error('rateLimitD1', e); return false; // DB xatosida bloklamaymiz (login ishlashi ustun)
  }
}
// Faqat o'qiydi (hisoblagichni oshirmaydi) — 429 javobida Retry-After
// hisoblash uchun. Qator topilmasa yoki oyna allaqachon tugagan bo'lsa 0.
async function rateLimitRemainingSecD1(env, key, windowMs) {
  try {
    const row = await env.DB.prepare(`SELECT window_start FROM rate_limits WHERE key = ?`).bind(key).first();
    if (!row) return 0;
    const left = windowMs - (Date.now() - Number(row.window_start));
    return left > 0 ? Math.ceil(left / 1000) : 0;
  } catch { return 0; }
}
// Muvaffaqiyatli login/2FA'dan keyin shu kalit uchun D1 hisoblagichini
// tozalaydi (qonuniy adminning o'z urinishlari keyingi kirishga
// ta'sir qilmasin). Xatolik sokin yutiladi — reset ishlamasa ham
// himoya (limit) o'zi buzilmaydi, faqat keyingi urinish erta tugaydi.
async function resetRateLimitD1(env, key) {
  try { await env.DB.prepare(`DELETE FROM rate_limits WHERE key = ?`).bind(key).run(); } catch { /* jim tur */ }
}
const ADMIN_ROLE_RANK = { content_manager: 1, manager: 2, super_admin: 3 };
function roleAtLeast(admin, role) { return (ADMIN_ROLE_RANK[admin?.role] || 0) >= (ADMIN_ROLE_RANK[role] || 99); }

// 2026-09 hotfix: bu limitlar avval BITTA umumiy `ip` kaliti ostida
// /login, /2fa/telegram/send va /verify-2fa uchastida BIR XIL 3ta so'rov
// byudjetini baham ko'rardi — bitta oddiy 2FA login (parol → kod → tasdiq)
// shu 3ta so'rovni to'liq sarflab qo'yardi va bitta 2FA kodini xato
// kiritish (qayta urinish) qonuniy adminni 30 daqiqaga bloklab qo'yardi.
// Endi HAR BIR endpoint o'zining alohida `purpose:ip` kaliti bilan bir xil
// qat'iylikda (3/30min) himoyalanadi — bu HIMOYANI KAMAYTIRISH emas
// (brute-force uchun har bir endpoint hali ham 3/30min bilan cheklangan),
// faqat noto'g'ri ulashilgan byudjetni tuzatish.
const loginHits = new Map(); // key: `${purpose}:${ip}` -> timestamp[]
const LOGIN_RATE_WINDOW_MS = 30 * 60_000;
const LOGIN_RATE_MAX = 3;
function loginRateLimited(key) {
  const now = Date.now();
  const arr = (loginHits.get(key) || []).filter((t) => now - t < LOGIN_RATE_WINDOW_MS);
  if (arr.length >= LOGIN_RATE_MAX) return true;
  arr.push(now);
  loginHits.set(key, arr);
  return false;
}
// Qolgan kutish vaqti (sekundda) — 429 javobida Retry-After va foydalanuvchiga
// aniq countdown ko'rsatish uchun. Hali hech qanday urinish bo'lmagan
// (yoki limitga yetmagan) bo'lsa 0 qaytaradi.
function loginRateRemainingSec(key) {
  const arr = (loginHits.get(key) || []).filter((t) => Date.now() - t < LOGIN_RATE_WINDOW_MS);
  if (arr.length < LOGIN_RATE_MAX) return 0;
  const oldest = Math.min(...arr);
  return Math.max(1, Math.ceil((LOGIN_RATE_WINDOW_MS - (Date.now() - oldest)) / 1000));
}
// Muvaffaqiyatli autentifikatsiyadan keyin shu IP uchun BARCHA admin-auth
// (login/telegram-2fa/verify-2fa) hisoblagichlarini tozalaydi — qonuniy
// admin o'zining oldingi (zarur bo'lgan, hujum emas) urinishlari tufayli
// keyingi kirishda jazolanmasin. Hujumchi uchun bu hech narsani
// kamaytirmaydi: muvaffaqiyatli parol+2FA topib bo'lmasa, bu kod hech
// qachon chaqirilmaydi.
function clearLoginRateLimit(ip) {
  for (const k of loginHits.keys()) if (k.endsWith(':' + ip)) loginHits.delete(k);
}

// Telegram OTP as an OPT-IN alternative to TOTP during the 2FA step (NOT
// automatic, NOT IP/location-based — only ever sent when the admin
// explicitly clicks "Telegram orqali kod olish" on the 2FA screen; see
// POST /api/admin/2fa/telegram/send below). TOTP stays the primary/
// default method — this never disables or replaces it.
async function sendTelegramTo(env, chatId, text) {
  if (!env.TELEGRAM_BOT_TOKEN || !chatId) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
    const data = await res.json().catch(() => null);
    return !!data?.ok;
  } catch { return false; }
}
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
    const D1_KEY = 'admin-login:ip:' + ip;
    if (loginRateLimited('login:' + ip) || await rateLimitD1(env, D1_KEY, 5, 30 * 60_000)) {
      await logAdminLoginEvent(env, 'rate_limited', ip, request.headers.get('user-agent'));
      const retryAfterSec = Math.max(loginRateRemainingSec('login:' + ip), await rateLimitRemainingSecD1(env, D1_KEY, 30 * 60_000)) || 60;
      return json({ error: 'too_many_requests', retryAfterSec }, 429, { 'Retry-After': String(retryAfterSec) });
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
    await createAdminSessionD1(env, {
      tokenHash: await sha256Hex(token), adminId: admin.id, role: admin.role,
      absExp: new Date(now.getTime() + ADMIN_TTL_MS).toISOString(), lastActivity: now.toISOString(),
    });
    await logAdminLoginEvent(env, 'login_ok', ip, request.headers.get('user-agent'));
    // Muvaffaqiyatli kirish — shu IP uchun oldingi (zarur) urinishlar
    // keyingi kirishga xalaqit bermasin (pastdagi izohga qarang).
    clearLoginRateLimit(ip);
    await resetRateLimitD1(env, D1_KEY);
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
    const RK = 'tg2fa:' + ip;
    if (loginRateLimited(RK)) {
      const retryAfterSec = loginRateRemainingSec(RK) || 60;
      return json({ error: 'too_many_requests', retryAfterSec }, 429, { 'Retry-After': String(retryAfterSec) });
    }
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
    const RK = 'verify2fa:' + ip;
    if (loginRateLimited(RK)) {
      const retryAfterSec = loginRateRemainingSec(RK) || 60;
      return json({ error: 'too_many_requests', retryAfterSec }, 429, { 'Retry-After': String(retryAfterSec) });
    }
    const body = await request.json().catch(() => ({}));
    const tempToken = String(body.tempToken || '');
    const code = String(body.code || '').trim();
    // 2026-09 hotfix: this whole block is wrapped so an UNEXPECTED D1/
    // config exception never surfaces as the generic, unhelpful
    // `core_api_unavailable` 503 from the outer dispatcher — it is
    // logged server-side (D1 error shape only, never a secret or
    // password value) and returned as a distinguishable, still fail-
    // closed (2FA is NEVER skipped/bypassed here) `verify_2fa_unavailable`.
    try {
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
        // Ustun eski production `admins` jadvalida bo'lmasligi mumkin —
        // bu holda ALTER'ni qayta urinib ko'ramiz. Ikkalasi ham yiqilsa,
        // replay himoyasi shu login uchun yozilmay qoladi (kod baribir
        // bir martalik: pending yozuv yuqorida DELETE qilingan), lekin
        // BUTUN admin panelga kirish 503 bilan buzilmaydi.
        try {
          await env.DB.prepare(`UPDATE admins SET totp_last_counter = ? WHERE id = ?`).bind(totpCounter, admin.id).run();
        } catch (error) {
          console.error('totp_last_counter update', String(error?.message || error));
          await env.DB.prepare(`ALTER TABLE admins ADD COLUMN totp_last_counter INTEGER`).run().catch(() => {});
          await env.DB.prepare(`UPDATE admins SET totp_last_counter = ? WHERE id = ?`).bind(totpCounter, admin.id).run()
            .catch((err) => console.error('totp_last_counter update (retry)', String(err?.message || err)));
        }
      }
      const token = newToken();
      const now = new Date();
      await createAdminSessionD1(env, {
        tokenHash: await sha256Hex(token), adminId: admin.id, role: admin.role,
        absExp: new Date(now.getTime() + ADMIN_TTL_MS).toISOString(), lastActivity: now.toISOString(),
      });
      await logAdminLoginEvent(env, 'login_ok', ip, request.headers.get('user-agent'));
      // Muvaffaqiyatli 2FA — shu IP uchun barcha admin-auth hisoblagichlarini
      // tozalaymiz (login bosqichida sarflangan byudjet ham).
      clearLoginRateLimit(ip);
      await resetRateLimitD1(env, 'admin-login:ip:' + ip);
      return jsonWithCookie({ ok: true }, 200, adminCookieHeader(token, secure));
    } catch (error) {
      console.error('verify-2fa', error);
      return json({ error: 'verify_2fa_unavailable' }, 503);
    }
  }

  if (path === '/api/admin/logout' && request.method === 'POST') {
    const token = parseCookies(request)[ADMIN_COOKIE];
    if (token) await deleteAdminSessionD1(env, await sha256Hex(token));
    await logAdminLoginEvent(env, 'logout', ip, request.headers.get('user-agent'));
    return jsonWithCookie({ ok: true }, 200, clearedAdminCookieHeader(secure));
  }

  if (path === '/api/admin/me' && request.method === 'GET') {
    const admin = await getCurrentAdmin(request, env);
    const authenticated = !!(admin && !admin.idleTimeout);
    let totpEnabled = null;
    if (authenticated) {
      const r = await env.DB.prepare(`SELECT totp_enabled FROM admins WHERE id = ?`).bind(admin.adminId).first().catch(() => null);
      totpEnabled = !!(r && r.totp_enabled);
    }
    return json({ authenticated, role: authenticated ? admin.role : null, totpEnabled });
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
    if (!roleAtLeast(admin, 'super_admin')) return json({ error: 'forbidden' }, 403);
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
    if (!roleAtLeast(admin, 'super_admin')) return json({ error: 'forbidden' }, 403);
    const body = await request.json().catch(() => ({}));
    await env.DB.prepare(`UPDATE users SET is_test = ? WHERE id = ?`).bind(body.isTest !== false ? 1 : 0, Number(setTestMatch[1])).run();
    return json({ ok: true });
  }

  const suspendMatch = path.match(/^\/api\/admin\/users\/(\d+)\/suspend$/);
  if (suspendMatch && request.method === 'POST') {
    if (!roleAtLeast(admin, 'manager')) return json({ error: 'forbidden' }, 403);
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
    if (!roleAtLeast(admin, 'manager')) return json({ error: 'forbidden' }, 403);
    const id = Number(unsuspendMatch[1]);
    await env.DB.prepare(`UPDATE users SET suspended_until = NULL, suspend_reason = NULL WHERE id = ?`).bind(id).run();
    await logAdminActivity(env, { action: 'user_unsuspended', details: `Foydalanuvchi #${id}`, ip });
    return json({ ok: true });
  }

  const adjustMatch = path.match(/^\/api\/admin\/users\/(\d+)\/adjust-balance$/);
  if (adjustMatch && request.method === 'POST') {
    if (!roleAtLeast(admin, 'super_admin')) return json({ error: 'forbidden' }, 403);
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
    // Qayta tasdiqlash: joriy parol shart (sessiya o'g'irlanganda 2FA o'chirib bo'lmasin).
    const body = await request.json().catch(() => ({}));
    const me = await env.DB.prepare(`SELECT password_hash FROM admins WHERE id = ?`).bind(admin.adminId).first();
    if (!me || !(await verifyPassword(String(body.password || ''), me.password_hash))) return json({ error: 'confirmation_required' }, 403);
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
    // 2026-09: avval FAQAT 'active' auksionni bekor qilish mumkin edi va
    // "To'lov kutilmoqda" (awaiting_payment) holatidagisi uchun tugma
    // ko'rinsa ham, backend uni DOIM 409 bilan rad etardi — ya'ni eng
    // ko'p bekor qilish kerak bo'ladigan holat ishlamasdi.
    //
    // Bunday auksion butunlay tirik qolib ketishi mumkin: g'olib
    // foydalanuvchi o'chirilsa `highest_bidder_id` NULL qilinadi
    // (hosting/api/auth.js hardDeleteUser), lekin holat 'awaiting_payment'
    // bo'lib qoladi — to'lov oqimi ham (g'olib yo'q), bekor qilish ham
    // ishlamaydi. Endi admin uni bekor qila oladi va kod qayta sotuvga
    // chiqadi.
    const CANCELLABLE = ['active', 'awaiting_payment'];
    if (!auction || !CANCELLABLE.includes(auction.status)) return json({ error: 'cannot_cancel' }, 409);

    // Avval SHARTLI o'zgartirish — parallel so'rov yoki qayta bosish
    // mablag'ni IKKI MARTA bo'shatib yubormasligi uchun. Faqat holat
    // haqiqatan o'zgargan bo'lsagina takliflar bo'shatiladi.
    const changed = await env.DB.prepare(
      `UPDATE auctions SET status = 'cancelled' WHERE id = ? AND status IN ('active','awaiting_payment') RETURNING id`
    ).bind(id).first();
    if (!changed) return json({ error: 'cannot_cancel' }, 409);

    const bids = await env.DB.prepare(`SELECT user_id, MAX(amount) AS amount FROM bids WHERE auction_id = ? GROUP BY user_id`).bind(id).all();
    const writes = [];
    for (const b of bids.results || []) {
      // O'chirilgan foydalanuvchi uchun bu UPDATE hech qatorga tegmaydi.
      writes.push(env.DB.prepare(`UPDATE users SET held_balance = held_balance - ? WHERE id = ?`).bind(Number(b.amount), b.user_id));
      writes.push(env.DB.prepare(`INSERT INTO transactions (user_id, amount, kind, ref_table, ref_id, note, created_at) VALUES (?, 0, 'bid_release', 'auctions', ?, ?, ?)`)
        .bind(b.user_id, id, body.note || "Admin auksionni bekor qildi — mablag' bo'shatildi", nowTs()));
    }
    if (writes.length) await env.DB.batch(writes);
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

// ---------- profil postlari (D1) ----------
// src/lib/access.js'dagi ACCESS_RANK / FEATURE_MIN / POST_LIMIT bilan
// AYNAN bir xil qiymatlar (Worker bitta fayl — import qilinmaydi).
const ACCESS_LEVELS_D1 = ['free', 'silver', 'gold', 'premium', 'exclusive'];
const ACCESS_RANK_D1 = { free: 0, silver: 1, gold: 2, premium: 3, exclusive: 4 };
const POST_LIMIT_D1 = { free: 0, silver: 5, gold: 30, premium: 60, exclusive: 999 };
const FEATURE_MIN_D1 = { post: 'silver', video: 'premium' };

// NFC ID ning "xom" darajasi — src/lib/access.js idTier() + pricing.js
// tierForCode() tartibi: admin tier_override → sovg'a → per-code override
// → faqat harflar (ekslyuziv) → 6-belgili naqsh → aks holda free.
function personalIdTierD1(rec) {
  if (rec.tierOverride && ACCESS_RANK_D1[rec.tierOverride] != null) return rec.tierOverride;
  if (rec.isGift) return 'exclusive';
  const c = String(rec.code || '').toUpperCase();
  const ov = personalCodeTierOverride(c);
  if (ov && ACCESS_RANK_D1[ov] != null) return ov;
  if (LETTER_CODE_RE.test(c)) return 'exclusive';
  if (c.length !== 6) return 'free';
  const t = personalTierFromCode(c.slice(0, 3), c.slice(3, 6));
  return ACCESS_RANK_D1[t] != null ? t : 'free';
}
// EFFECTIVE ACCESS = max(idTier, egasi Premium bo'lsa 'premium').
function effectiveAccessD1(rec) {
  const a = ACCESS_RANK_D1[personalIdTierD1(rec)] ?? 0;
  const floor = rec.isPremium ? ACCESS_RANK_D1.premium : 0;
  return ACCESS_LEVELS_D1[Math.max(a, floor)];
}
function featureAllowedD1(feature, access) {
  const min = FEATURE_MIN_D1[feature];
  return min ? (ACCESS_RANK_D1[access] ?? 0) >= (ACCESS_RANK_D1[min] ?? 99) : true;
}

function postRowToJson(r, likeCount, liked) {
  const d = parseDbDate(r.created_at);
  return {
    id: Number(r.id), imageUrl: r.image_url || '', videoUrl: r.video_url || '', caption: r.caption || '',
    createdAt: d && !Number.isNaN(d.getTime()) ? d.getTime() : Date.now(),
    likeCount: Number(likeCount || 0), liked: !!liked,
  };
}

async function listPostsD1(env, code, viewerUserId) {
  const rows = await env.DB.prepare(
    `SELECT p.id, p.image_url, p.video_url, p.caption, p.created_at,
            (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id) AS like_count,
            EXISTS(SELECT 1 FROM post_likes pl WHERE pl.post_id = p.id AND pl.user_id = ?) AS liked
     FROM posts p WHERE p.code = ? ORDER BY p.created_at DESC, p.id DESC`
  ).bind(viewerUserId == null ? 0 : viewerUserId, code).all();
  return (rows.results || []).map((r) => postRowToJson(r, r.like_count, r.liked));
}

// DELETE /api/posts/:id, POST /api/posts/:id/like — server/index.js bilan
// bir xil javob shakllari ({ok:true} / {liked,count}).
async function postsApi(request, env, url) {
  const path = url.pathname;
  const m = path.match(/^\/api\/posts\/(\d+)(?:\/(like))?$/);
  if (!m) return null;
  const postId = Number(m[1]);
  const user = await getCurrentUser(request, env);
  if (!user) return json({ error: 'unauthorized' }, 401);

  if (!m[2] && request.method === 'DELETE') {
    const res = await env.DB.prepare(`DELETE FROM posts WHERE id = ? AND user_id = ?`).bind(postId, user.id).run();
    const changed = Number(res?.meta?.changes || 0);
    if (!changed) return json({ error: 'not_found' }, 404);
    return json({ ok: true });
  }

  if (m[2] === 'like' && request.method === 'POST') {
    const post = await env.DB.prepare(`SELECT id FROM posts WHERE id = ?`).bind(postId).first();
    if (!post) return json({ error: 'not_found' }, 404);
    const existing = await env.DB.prepare(`SELECT id FROM post_likes WHERE post_id = ? AND user_id = ?`).bind(postId, user.id).first();
    if (existing) {
      await env.DB.prepare(`DELETE FROM post_likes WHERE id = ?`).bind(existing.id).run();
    } else {
      await env.DB.prepare(`INSERT OR IGNORE INTO post_likes (post_id, user_id) VALUES (?, ?)`).bind(postId, user.id).run();
    }
    const cnt = await env.DB.prepare(`SELECT COUNT(*) AS n FROM post_likes WHERE post_id = ?`).bind(postId).first();
    return json({ liked: !existing, count: Number(cnt?.n || 0) });
  }
  return null;
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
  if (url.pathname.startsWith('/api/posts/')) {
    const res = await postsApi(request, env, url);
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
    const authReason = paymeAuthReasonD1(request, env);
    if (authReason) {
      // Cloudflare loglarida ko'rinadi. Kalitning o'zi emas, faqat sabab.
      console.warn(`payme auth rad etildi: ${authReason}`);
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
    return null; // modullar (hosting/api/*) tekshiradi; hech biri bo'lmasa fetch() 404 qaytaradi
  }
  return null;
}

// ---------- hosting/api/* modullari uchun yordamchilar (CONTRACT.md) ----------
const H = {
  json, getCurrentUser, getCurrentAdmin, requireAdmin, checkIpWhitelist,
  getRecord, getRecordOwner, rowToRecord, RECORD_COLUMNS, updateRecord, validateRecordBody,
  cleanStr, recSafeUrl, uploadOrSafeUrl, shortText, safeUrl, validCode, parseJsonArray, parseMusicUrls,
  nowTs, parseDbDate, newToken, sha256Hex, hashPassword, verifyPassword,
  reqIp, logAdminActivity, logAdminLoginEvent, sendTelegramMessage, sendTelegramTo,
  personalIdTierD1, effectiveAccessD1, featureAllowedD1, paymentsEnabledD1, paymeCheckoutLinkD1,
  createPendingWebOrderD1, getWebOrderD1, createWebOrderD1, setWebOrderStatusD1, ensureCoreSchema,
  finalizePaidWebOrderD1, attachCardToUserD1, createRecordD1, activeWebOrderByCodeD1, getWebOrderByPaymeIdD1,
  sessionCookieHeader, jsonWithCookie, isSecure, SESSION_TTL_S, newsVisitorHash, createUserSession, parseCookies,
  rateLimitD1, roleAtLeast,
  personalPriceForCode, personalTierFromCode, personalCodeTierOverride, isPersonalCodePurchasable,
};
const API_MODULES = [apiAuth, apiAccount, apiEngagement, apiCatalog, apiMedia, apiAdminExtra, apiAdminFinance, apiTelegram];

// Xavfsizlik header'lari — barcha javoblarga (statik va API). CSP ataylab faqat
// framing/base/form/object ni cheklaydi (script/style ga tegmaydi — YouTube/Yandex
// embed va Tailwind inline style buzilmasin).
function withSecurityHeaders(res, url) {
  const out = new Response(res.body, res);
  const h = out.headers;
  if (!h.has('x-content-type-options')) h.set('x-content-type-options', 'nosniff');
  if (!h.has('referrer-policy')) h.set('referrer-policy', 'strict-origin-when-cross-origin');
  if (!h.has('x-frame-options')) h.set('x-frame-options', 'DENY');
  if (!h.has('permissions-policy')) h.set('permissions-policy', 'camera=(), microphone=(), geolocation=(self), payment=()');
  if (!h.has('content-security-policy')) h.set('content-security-policy', "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self' https://checkout.paycom.uz https://*.payme.uz https://*.paycom.uz");
  if (url.protocol === 'https:' && !h.has('strict-transport-security')) h.set('strict-transport-security', 'max-age=31536000; includeSubDomains');
  return out;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const res = await handleRequest(request, env, url);
    return withSecurityHeaders(res, url);
  },
};

async function handleRequest(request, env, url) {

    const catalogMatch = url.pathname.match(/^\/api\/catalog-meta\/([^/]+)(?:\/items\/([^/]+)\/(view|reaction|promotion))?$/);
    if (catalogMatch) {
      try {
        return await catalogMeta(request, env, url, catalogMatch);
      } catch (error) {
        return json({ error: error?.message === 'd1_unavailable' ? 'd1_unavailable' : 'catalog_meta_unavailable' }, 503);
      }
    }

    if (request.method === 'POST'
      && ['/api/upload', '/api/upload-audio', '/api/upload-card-video', '/api/upload-profile-bg', '/api/admin/upload'].includes(url.pathname)) {
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
      || url.pathname.startsWith('/api/follow') || url.pathname.startsWith('/api/unfollow')
      || url.pathname.startsWith('/api/posts/')) {
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
    // hosting/api/* modullari — core dispatch'dan keyin. Eski "o'ziga proxy"
    // (https://nfcstore.uz ga fetch — Worker'ning O'Z domeni, 405/HTML/503 berardi)
    // OLIB TASHLANDI: hech kim tanimasa aniq JSON 404.
    // AI yordamchi (legacy server/assistant.js) Worker'ga portlanmagan —
    // frontend vidjeti har sahifada holatni so'raydi; 404 o'rniga aniq
    // "o'chirilgan" javobi (konsolda xato chiqmasin).
    if (url.pathname === '/api/assistant/status' && request.method === 'GET') {
      return json({ enabled: false });
    }
    if (url.pathname.startsWith('/api/') || url.pathname === '/api') {
      try {
        await ensureCoreSchema(env);
        for (const mod of API_MODULES) {
          const res = await mod.handle(request, env, url, H);
          if (res) return res;
        }
      } catch (error) {
        console.error('api module', url.pathname, error);
        return json({ error: error?.message === 'd1_unavailable' ? 'd1_unavailable' : 'api_unavailable' }, 503);
      }
      return json({ error: 'not_found', path: url.pathname }, 404);
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
}
