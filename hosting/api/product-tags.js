// hosting/api/product-tags.js — POSTDA MAHSULOT BELGILASH (2026-10).
//
// ═══ NIMA UCHUN BOR ═══
//
// Biznes postida rasmdagi mahsulot ko'rinadi, lekin mijoz uning narxini
// bilish uchun katalogni qo'lda qidirishi kerak edi. Endi biznes posti
// o'z katalogidagi 5 tagacha mahsulotni "belgilaydi" (Instagram Shopping
// kabi): post ostida nomi, narxi va rasmi chiqadi, bosilsa mahsulot.
//
// ═══ QOIDALAR ═══
//
//   * Faqat KOMPANIYA posti (`company_post`) va faqat O'SHA kompaniyaning
//     katalogidan — tekshiruv SERVERDA (begona biznesning mahsulotini
//     o'z postiga qo'yib, uning narxini "o'ziniki" qilib ko'rsatib
//     bo'lmasin).
//   * Mahsulot keyin o'chirilsa yoki boshqa kompaniyaga tegishli bo'lib
//     qolsa — o'qishda JOIN uni tashlab ketadi (yetim belgi chiqmaydi).
//   * Javob shakli katalogdagi bilan bir xil maydonlar (`catalog-feed.js`
//     `listingFields`) — ilova mahsulot kartasini qayta ishlatadi.
//
// Jadval `CREATE TABLE IF NOT EXISTS` bilan, worker.js `ensureCoreSchema`
// ichida yaratiladi (o'chirish batch'lari unga yozadi — jadval yo'q bo'lsa
// batch yiqilardi).

import { listingFields } from './catalog-feed.js';

export const PRODUCT_TAGS_MAX = 5;
const KIND = 'company_post';

let ready = null;
export function ensureSchema(env) {
  ready ||= env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS post_products (
      target_kind TEXT NOT NULL,
      target_id INTEGER NOT NULL,
      item_id TEXT NOT NULL,
      sort INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      PRIMARY KEY (target_kind, target_id, item_id)
    )`),
  ]).catch((e) => { ready = null; throw e; });
  return ready;
}

/// So'rovdagi `productIds` ni tekshiradi (post yozilishidan OLDIN).
///   yo'q          → { ok: true, ids: [] }
///   yaroqsiz      → { ok: false, error: 'bad_products' }
///   5 tadan ko'p  → { ok: false, error: 'too_many_products' }
///   begona/yo'q   → { ok: false, error: 'bad_products' }
export async function readProductIds(env, body, companyId) {
  const raw = body?.productIds;
  if (raw === undefined || raw === null) return { ok: true, ids: [] };
  if (!Array.isArray(raw)) return { ok: false, error: 'bad_products' };
  const ids = [];
  for (const v of raw) {
    const id = String(v ?? '').trim();
    if (!/^[A-Za-z0-9_-]{1,60}$/.test(id)) return { ok: false, error: 'bad_products' };
    if (!ids.includes(id)) ids.push(id);
  }
  if (ids.length > PRODUCT_TAGS_MAX) return { ok: false, error: 'too_many_products', limit: PRODUCT_TAGS_MAX };
  if (!ids.length) return { ok: true, ids: [] };
  const rows = await env.DB.prepare(
    `SELECT id FROM company_catalog_items WHERE company_id = ? AND id IN (${ids.map(() => '?').join(',')})`
  ).bind(companyId, ...ids).all();
  const have = new Set((rows.results || []).map((r) => String(r.id)));
  if (ids.some((id) => !have.has(id))) return { ok: false, error: 'bad_products' };
  return { ok: true, ids };
}

/// Post yozilgach belgilarni saqlaydi (eski qatorlar avval o'chadi).
export async function saveProductTags(env, postId, ids, nowIso) {
  await ensureSchema(env);
  const stmts = [env.DB.prepare(`DELETE FROM post_products WHERE target_kind = ? AND target_id = ?`).bind(KIND, postId)];
  ids.forEach((id, i) => {
    stmts.push(env.DB.prepare(
      `INSERT OR IGNORE INTO post_products (target_kind, target_id, item_id, sort, created_at) VALUES (?,?,?,?,?)`
    ).bind(KIND, postId, id, i, nowIso));
  });
  await env.DB.batch(stmts);
}

/// Post o'chirilganda belgilar ham ketadi (chaqiruvchi xatoni yutadi).
export function deleteTagsStmt(env, postId) {
  return env.DB.prepare(`DELETE FROM post_products WHERE target_kind = ? AND target_id = ?`).bind(KIND, Number(postId));
}

function productOut(r) {
  const f = listingFields(r, r.co_category);
  return {
    id: String(r.id),
    companyId: String(r.company_id),
    name: r.name,
    price: Number(r.price || 0),
    promotionPrice: r.promotion_price == null ? null : Number(r.promotion_price),
    currency: 'UZS',
    imageUrl: r.image_url || (f.images[0] || ''),
    available: Boolean(r.available),
    kind: f.kind,
    priceOnRequest: f.priceOnRequest,
    priceSoon: f.priceSoon,
  };
}

/// Ko'p post uchun belgilangan mahsulotlar — BITTA so'rov (lenta va
/// ro'yxat buni boshqa sanoqlar bilan PARALLEL chaqiradi, yangi to'lqin
/// qo'shilmaydi). Natija: Map(postId -> [product]). Jadval yo'q bo'lsa
/// yoki xato bo'lsa — bo'sh Map (lenta yiqilmaydi).
///
/// `i.*` — katalog listing ustunlari (`kind`, `images_json`, ...) eski
/// bazada bo'lmasligi mumkin; nomini yozsak so'rov yiqilardi.
export async function productsFor(env, postIds) {
  const out = new Map();
  const ids = [...new Set((postIds || []).map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, 90);
  if (!ids.length) return out;
  const rows = await env.DB.prepare(
    `SELECT pp.target_id AS pp_post_id, pp.sort AS pp_sort, co.category AS co_category, i.*
       FROM post_products pp
       JOIN company_posts cp ON cp.id = pp.target_id
       JOIN company_catalog_items i ON i.id = pp.item_id AND i.company_id = cp.company_id
       JOIN companies co ON co.company_id = cp.company_id
      WHERE pp.target_kind = '${KIND}' AND pp.target_id IN (${ids.map(() => '?').join(',')})
      ORDER BY pp.target_id, pp.sort`
  ).bind(...ids).all().catch(() => null);
  for (const r of rows?.results || []) {
    const k = Number(r.pp_post_id);
    if (!out.has(k)) out.set(k, []);
    out.get(k).push(productOut(r));
  }
  return out;
}
