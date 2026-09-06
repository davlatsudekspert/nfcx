// hosting/api/catalog.js — CONTRACT.md ga qarang. Route topilmasa null qaytaradi.
//
// Restoran menyusi / Mahsulotlar katalogi / Xizmatlar katalogi — server/index.js
// (Express) dagi /api/records/:code/{menu|products|services}[/manage|/categories[/:id]|/items[/:id]]
// marshrutlarining D1 (SQLite) porti. Javob shakllari legacy bilan BIR XIL
// (frontend src/lib/db.js + AccountPage/ProfilePage shunga bog'langan).
//
// Egalik/eligibility/limit tekshiruvi SERVER tomonda (frontendda yashirish
// yetarli emas). Eligibility va limitlar src/lib/access.js bilan aynan bir xil:
// businessModule / menuEligible / productEligible / serviceEligible,
// MENU_LIMITS / PRODUCT_LIMITS / SERVICE_LIMITS, FEATURE_MIN (restaurantMenu /
// productCatalog / serviceCatalog → 'silver').
//
// NEGA IMPORT EMAS, NUSXA: `npm run build` (scripts/prepare-sites-build.mjs)
// hosting/api/ ni dist/server/api/ ga ko'chiradi va wrangler o'sha yerdan
// bundle qiladi — `../../src/lib/access.js` nisbiy yo'li dist/ ichida mavjud
// emas. Shuning uchun kichik funksiyalar shu yerga nusxalangan (worker.js
// ham xuddi shunday qiladi: ACCESS_RANK_D1, MENU_LIMITS_DEFAULT ...).
// src/lib/access.js o'zgarsa — bu yerni ham yangilang.

// ---- src/lib/access.js nusxasi (o'zgartirmang, sinxron saqlang) ----
const ACCESS_RANK = { free: 0, silver: 1, gold: 2, premium: 3, exclusive: 4 };
const CATALOG_FEATURE_MIN = 'silver'; // FEATURE_MIN.restaurantMenu/productCatalog/serviceCatalog
// MENU_LIMITS / PRODUCT_LIMITS / SERVICE_LIMITS — hozircha uchalasi bir xil.
const LIMITS_DEFAULT = {
  free:      { cat: 0,   item: 0,    images: false },
  silver:    { cat: 1,   item: 15,   images: false },
  gold:      { cat: 8,   item: 100,  images: true },
  premium:   { cat: 20,  item: 300,  images: true },
  exclusive: { cat: 999, item: 9999, images: true },
};
// Har bir biznes profil FAQAT BITTA katalog moduliga ega — soha aniqlaydi:
//   food / food-*  → 'menu';  retail / retail-* → 'products';  boshqa → 'services'.
// Shaxsiy/expert profillar uchun har doim null.
function businessModule(profileType, categorySlug) {
  if (profileType !== 'business') return null;
  const s = String(categorySlug || '');
  if (s === 'food' || s.startsWith('food-')) return 'menu';
  if (s === 'retail' || s.startsWith('retail-')) return 'products';
  return 'services';
}
// ---- /nusxa ----

const PRICE_TYPES = ['fixed', 'from', 'negotiable'];
const priceTypeIn = (v) => (PRICE_TYPES.includes(v) ? v : 'fixed');

// Modul konfiguratsiyasi — legacy'dagi menu/product/service uchliklari.
const MODULES = {
  menu: {
    kind: 'menu', listKey: 'menu', feature: 'restaurantMenu', notEligible: 'not_restaurant',
    catTable: 'menu_categories', itemTable: 'menu_items', priceType: false,
  },
  products: {
    kind: 'product', listKey: 'products', feature: 'productCatalog', notEligible: 'not_business',
    catTable: 'product_categories', itemTable: 'products', priceType: false,
  },
  services: {
    kind: 'service', listKey: 'services', feature: 'serviceCatalog', notEligible: 'not_service_business',
    catTable: 'service_categories', itemTable: 'services', priceType: true,
  },
};

const money = (v) => {
  if (v == null || v === '') return null;
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 0 && n <= 1_000_000_000 ? n : null;
};
const imageIn = (v) => {
  const u = String(v || '').trim();
  return u.startsWith('/uploads/') ? u.slice(0, 300) : '';
};
const bool = (v) => (v ? 1 : 0);

async function readBody(request) {
  try {
    const b = await request.json();
    return b && typeof b === 'object' && !Array.isArray(b) ? b : {};
  } catch { return {}; }
}

// ---------- SQL (server/db.js getMenu/menuCounts/... ning SQLite porti) ----------

const catRow = (r) => ({ id: Number(r.id), name: r.name, sort: Number(r.sort), enabled: !!r.enabled });
function itemRow(mod, r) {
  const out = {
    id: Number(r.id), categoryId: Number(r.category_id), name: r.name,
    description: r.description == null ? null : r.description,
    price: r.price == null ? null : Number(r.price),
  };
  if (mod.priceType) out.priceType = priceTypeIn(r.price_type);
  else out.discountPrice = r.discount_price == null ? null : Number(r.discount_price);
  out.imageUrl = r.image_url == null ? null : r.image_url;
  out.available = !!r.available;
  out.featured = !!r.featured;
  out.sort = Number(r.sort);
  return out;
}
const ITEM_COLS = (mod) => `id, category_id, name, description, price, ${mod.priceType ? 'price_type' : 'discount_price'}, image_url, available, featured, sort`;

async function getList(env, mod, code, { includeDisabled = false } = {}) {
  const [cats, items] = await Promise.all([
    env.DB.prepare(
      `SELECT id, name, sort, enabled FROM ${mod.catTable}
        WHERE code = ? ${includeDisabled ? '' : 'AND enabled = 1'}
        ORDER BY sort, id`
    ).bind(code).all(),
    env.DB.prepare(`SELECT ${ITEM_COLS(mod)} FROM ${mod.itemTable} WHERE code = ? ORDER BY sort, id`).bind(code).all(),
  ]);
  const byCat = new Map();
  for (const r of items.results || []) {
    const it = itemRow(mod, r);
    if (!byCat.has(it.categoryId)) byCat.set(it.categoryId, []);
    byCat.get(it.categoryId).push(it);
  }
  return (cats.results || []).map((c) => ({ ...catRow(c), items: byCat.get(Number(c.id)) || [] }));
}

async function getCounts(env, mod, code) {
  const row = await env.DB.prepare(
    `SELECT (SELECT COUNT(*) FROM ${mod.catTable} WHERE code = ?) AS cats,
            (SELECT COUNT(*) FROM ${mod.itemTable} WHERE code = ?) AS items`
  ).bind(code, code).first();
  return { cats: Number(row?.cats || 0), items: Number(row?.items || 0) };
}

async function categoryBelongs(env, mod, code, categoryId) {
  const row = await env.DB.prepare(`SELECT 1 AS ok FROM ${mod.catTable} WHERE id = ? AND code = ?`).bind(categoryId, code).first();
  return !!row;
}

async function createCategory(env, mod, code, { name, sort }) {
  const row = await env.DB.prepare(
    `INSERT INTO ${mod.catTable} (code, name, sort) VALUES (?, ?, ?) RETURNING id, name, sort, enabled`
  ).bind(code, name, sort || 0).first();
  return catRow(row);
}

async function updateCategory(env, mod, code, id, f) {
  const row = await env.DB.prepare(
    `UPDATE ${mod.catTable} SET
        name = COALESCE(?, name), sort = COALESCE(?, sort), enabled = COALESCE(?, enabled)
      WHERE code = ? AND id = ?
      RETURNING id, name, sort, enabled`
  ).bind(f.name ?? null, f.sort ?? null, f.enabled == null ? null : bool(f.enabled), code, id).first();
  return row ? catRow(row) : null;
}

async function deleteCategory(env, mod, code, id) {
  // Legacy'da FK ON DELETE CASCADE — D1 da PRAGMA foreign_keys ga bog'liq
  // bo'lmasligi uchun avval elementlar aniq o'chiriladi.
  await env.DB.prepare(`DELETE FROM ${mod.itemTable} WHERE code = ? AND category_id = ?`).bind(code, id).run();
  await env.DB.prepare(`DELETE FROM ${mod.catTable} WHERE code = ? AND id = ?`).bind(code, id).run();
}

async function createItem(env, mod, code, f) {
  const extraCol = mod.priceType ? 'price_type' : 'discount_price';
  const extraVal = mod.priceType ? priceTypeIn(f.priceType) : (f.discountPrice ?? null);
  const row = await env.DB.prepare(
    `INSERT INTO ${mod.itemTable} (code, category_id, name, description, price, ${extraCol}, image_url, available, featured, sort)
     VALUES (?,?,?,?,?,?,?,?,?,?)
     RETURNING ${ITEM_COLS(mod)}`
  ).bind(
    code, f.categoryId, f.name, f.description || null, f.price ?? null, extraVal,
    f.imageUrl || null, bool(f.available !== false), bool(f.featured === true), f.sort || 0,
  ).first();
  return itemRow(mod, row);
}

async function updateItem(env, mod, code, id, f) {
  const col = {
    categoryId: 'category_id', name: 'name', description: 'description', price: 'price',
    ...(mod.priceType ? { priceType: 'price_type' } : { discountPrice: 'discount_price' }),
    imageUrl: 'image_url', available: 'available', featured: 'featured', sort: 'sort',
  };
  const sets = [];
  const vals = [];
  for (const [k, c] of Object.entries(col)) {
    if (!(k in f)) continue;
    let v = f[k];
    if (k === 'priceType') v = priceTypeIn(v);
    else if (k === 'available' || k === 'featured') v = bool(v);
    else if (k === 'description' || k === 'imageUrl') v = v || null;
    else if (v === undefined) v = null;
    vals.push(v); sets.push(`${c} = ?`);
  }
  if (!sets.length) return null;
  const row = await env.DB.prepare(
    `UPDATE ${mod.itemTable} SET ${sets.join(', ')} WHERE code = ? AND id = ? RETURNING ${ITEM_COLS(mod)}`
  ).bind(...vals, code, id).first();
  return row ? itemRow(mod, row) : null;
}

async function deleteItem(env, mod, code, id) {
  await env.DB.prepare(`DELETE FROM ${mod.itemTable} WHERE code = ? AND id = ?`).bind(code, id).run();
}

// ---------- limitlar (legacy getEffectiveLimits: admin_settings '<kind>_limits' override) ----------

async function getEffectiveLimits(env, mod, access) {
  const fallback = LIMITS_DEFAULT[access] || LIMITS_DEFAULT.free;
  let map = null;
  try {
    const row = await env.DB.prepare(`SELECT value FROM admin_settings WHERE key = ?`).bind(`${mod.kind}_limits`).first();
    map = row?.value ? JSON.parse(row.value) : null;
  } catch { map = null; }
  const tier = map && typeof map === 'object' ? map[access] : null;
  if (!tier || typeof tier !== 'object') return fallback;
  const cat = Number(tier.cat);
  const item = Number(tier.item);
  return {
    cat: Number.isFinite(cat) && cat >= 0 ? cat : fallback.cat,
    item: Number.isFinite(item) && item >= 0 ? item : fallback.item,
    images: typeof tier.images === 'boolean' ? tier.images : fallback.images,
  };
}

// Egaga kontekst — legacy menuOwner/productOwner/serviceOwner.
// Qaytaradi: { ctx } yoki { res: Response } (xato).
async function ownerCtx(request, env, H, mod, code, { mutate = false } = {}) {
  const user = await H.getCurrentUser(request, env);
  if (!user) return { res: H.json({ error: 'unauthorized' }, 401) };
  if ((await H.getRecordOwner(env, code)) !== user.id) return { res: H.json({ error: 'forbidden' }, 403) };
  const rec = await H.getRecord(env, code);
  if (!rec) return { res: H.json({ error: 'forbidden' }, 403) };
  // legacy cardAccess: isPremium = rec.isPremium || user.isPremium
  const access = H.effectiveAccessD1({ ...rec, isPremium: !!(rec.isPremium || user.isPremium) });
  if ((ACCESS_RANK[access] ?? 0) < ACCESS_RANK[CATALOG_FEATURE_MIN]) {
    return { res: H.json({ error: 'feature_locked', feature: mod.feature }, 403) };
  }
  // MUHIM: profile_type HAM tekshiriladi — shaxsiy/expert profil to'g'ridan-to'g'ri
  // so'rov yuborsa ham server ruxsat bermasin. Yozish faqat eligible bo'lsa;
  // o'qish/o'chirish har doim (eski yozuvlarni tozalash mumkin bo'lsin).
  const eligible = businessModule(rec.profileType, rec.categorySlug) === mod.listKey;
  if (mutate && !eligible) return { res: H.json({ error: mod.notEligible }, 403) };
  return { ctx: { user, rec, access, eligible, limits: await getEffectiveLimits(env, mod, access) } };
}

export async function handle(request, env, url, H) {
  const m = url.pathname.match(/^\/api\/records\/([^/]+)\/(menu|products|services)(?:\/(manage|categories|items)(?:\/(\d+))?)?$/);
  if (!m) return null;
  const mod = MODULES[m[2]];
  const sub = m[3] || '';
  const id = m[4] ? Number(m[4]) : null;
  const method = request.method;

  // Marshrut mavjudligini avval aniqlaymiz — mos kelmasa null (worker → 404).
  let op = null;
  if (!sub && method === 'GET') op = 'public';
  else if (sub === 'manage' && !id && method === 'GET') op = 'manage';
  else if (sub === 'categories' && !id && method === 'POST') op = 'cat_create';
  else if (sub === 'categories' && id && method === 'PUT') op = 'cat_update';
  else if (sub === 'categories' && id && method === 'DELETE') op = 'cat_delete';
  else if (sub === 'items' && !id && method === 'POST') op = 'item_create';
  else if (sub === 'items' && id && method === 'PUT') op = 'item_update';
  else if (sub === 'items' && id && method === 'DELETE') op = 'item_delete';
  if (!op) return null;

  let code;
  try { code = decodeURIComponent(m[1]).toUpperCase(); } catch { code = ''; }
  if (!H.validCode(code)) return H.json({ error: 'bad_code' }, 400);

  // Public — profil sahifasidagi tab uchun. Faqat shu modulga tegishli
  // biznes profil bo'lsa ro'yxat qaytadi (aks holda bo'sh — soha o'zgarganda
  // eski yozuvlar ko'rinmasin).
  if (op === 'public') {
    const rec = await H.getRecord(env, code);
    const eligible = !!rec && businessModule(rec.profileType, rec.categorySlug) === mod.listKey;
    return H.json({ [mod.listKey]: eligible ? await getList(env, mod, code) : [] });
  }

  const mutate = ['cat_create', 'cat_update', 'item_create', 'item_update'].includes(op);
  const { ctx, res } = await ownerCtx(request, env, H, mod, code, { mutate });
  if (res) return res;

  if (op === 'manage') {
    return H.json({
      [mod.listKey]: await getList(env, mod, code, { includeDisabled: true }),
      limits: ctx.limits, counts: await getCounts(env, mod, code), eligible: ctx.eligible,
    });
  }

  if (op === 'cat_create') {
    const b = await readBody(request);
    const name = H.cleanStr(b.name, 60).trim();
    if (!name) return H.json({ error: 'name_required' }, 422);
    if ((await getCounts(env, mod, code)).cats >= ctx.limits.cat) {
      return H.json({ error: 'limit_reached', limit: ctx.limits.cat }, 429);
    }
    return H.json(await createCategory(env, mod, code, { name, sort: Number(b.sort) || 0 }), 201);
  }

  if (op === 'cat_update') {
    const b = await readBody(request);
    const f = {};
    if ('name' in b) f.name = H.cleanStr(b.name, 60).trim();
    if ('sort' in b) f.sort = Number(b.sort) || 0;
    if ('enabled' in b) f.enabled = b.enabled !== false;
    const row = await updateCategory(env, mod, code, id, f);
    if (!row) return H.json({ error: 'not_found' }, 404);
    return H.json(row);
  }

  if (op === 'cat_delete') {
    await deleteCategory(env, mod, code, id);
    return H.json({ ok: true });
  }

  if (op === 'item_create') {
    const b = await readBody(request);
    const categoryId = Number(b.categoryId);
    if (!categoryId || !(await categoryBelongs(env, mod, code, categoryId))) {
      return H.json({ error: 'bad_category' }, 422);
    }
    const name = H.cleanStr(b.name, 100).trim();
    if (!name) return H.json({ error: 'name_required' }, 422);
    if ((await getCounts(env, mod, code)).items >= ctx.limits.item) {
      return H.json({ error: 'limit_reached', limit: ctx.limits.item }, 429);
    }
    const f = {
      categoryId, name,
      description: H.cleanStr(b.description, 500).trim(),
      price: money(b.price),
      imageUrl: ctx.limits.images ? imageIn(b.imageUrl) : '',
      available: b.available !== false,
      featured: b.featured === true,
      sort: Number(b.sort) || 0,
    };
    if (mod.priceType) f.priceType = priceTypeIn(b.priceType);
    else f.discountPrice = money(b.discountPrice);
    return H.json(await createItem(env, mod, code, f), 201);
  }

  if (op === 'item_update') {
    const b = await readBody(request);
    const f = {};
    if ('categoryId' in b) {
      const cid = Number(b.categoryId);
      if (!cid || !(await categoryBelongs(env, mod, code, cid))) return H.json({ error: 'bad_category' }, 422);
      f.categoryId = cid;
    }
    if ('name' in b) f.name = H.cleanStr(b.name, 100).trim();
    if ('description' in b) f.description = H.cleanStr(b.description, 500).trim();
    if ('price' in b) f.price = money(b.price);
    if (mod.priceType) { if ('priceType' in b) f.priceType = priceTypeIn(b.priceType); }
    else if ('discountPrice' in b) f.discountPrice = money(b.discountPrice);
    if ('imageUrl' in b) f.imageUrl = ctx.limits.images ? imageIn(b.imageUrl) : '';
    if ('available' in b) f.available = b.available !== false;
    if ('featured' in b) f.featured = b.featured === true;
    if ('sort' in b) f.sort = Number(b.sort) || 0;
    const row = await updateItem(env, mod, code, id, f);
    if (!row) return H.json({ error: 'not_found' }, 404);
    return H.json(row);
  }

  if (op === 'item_delete') {
    await deleteItem(env, mod, code, id);
    return H.json({ ok: true });
  }

  return null;
}
