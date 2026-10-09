// hosting/api/showcase.js — KO'RGAZMA (Showcase) POSTI, 2026-10.
//
// ═══ NIMA ═══
//
// Ko'rgazma — rasmli (1..5 ta) "mahsulot kartasi" post: sarlavha, narx
// (so'mda), ixtiyoriy katalog mahsuloti (faqat kompaniya posti) va tashqi
// havola (faqat YouTube / Instagram). Alohida jadval yo'q: post odatdagi
// `posts` / `company_posts` qatori, qo'shimcha maydonlar `post_extras` da
// (api/music.js). Lenta — GET /api/showcase (api/reels.js, Reels bilan bir
// xil tartib, faqat videosiz kadrlar). API shartnomasi §3–§4.
//
// Faqat tekshiruv shu yerda — saqlash va o'qish music.js da (`post_extras`).

import { IMAGE_PATH_RE } from './carousel.js';

export const SHOWCASE_MAX_MEDIA = 5;
export const SHOWCASE_TITLE_MAX = 80;
export const SHOWCASE_PRICE_MAX = 10_000_000_000;
export const IMAGE_SECONDS_MIN = 3;
export const IMAGE_SECONDS_MAX = 60;
export const IMAGE_SECONDS_DEFAULT = 10;
export const LINK_HOSTS = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be', 'instagram.com', 'www.instagram.com'];
const CATALOG_ID_RE = /^[A-Za-z0-9-]{1,64}$/;
const VIDEO_EXT_RE = /\.(mp4|webm|mov|m4v)$/i;

export const wantsShowcase = (body) => body?.showcase === true || body?.showcase === 'true';

/// Faqat https va ruxsat etilgan YouTube/Instagram xosti. Aks holda `null`.
export function cleanShowcaseLink(raw) {
  const s = String(raw ?? '').trim();
  if (!s || s.length > 500) return null;
  let u;
  try { u = new URL(s); } catch { return null; }
  if (u.protocol !== 'https:' || u.username || u.password || u.port) return null;
  if (!LINK_HOSTS.includes(u.hostname.toLowerCase())) return null;
  return u.href;
}

/// So'rovni tekshiradi (post yozilishidan OLDIN).
///   → { ok: true, showcase: { title, priceUzs, linkUrl, catalogItemId, imageSeconds },
///       media: { imageUrl, mediaJson } }
///   → { ok: false, error, limit? }
/// `companyId` — kompaniya posti bo'lsa; shaxsiy postda `catalogItemId`
/// e'tiborsiz qoldiriladi (katalog faqat kompaniyada).
export async function readShowcase(env, body, { companyId = null } = {}) {
  let raw = [];
  if (Array.isArray(body?.mediaUrls)) raw = body.mediaUrls.map((u) => ({ url: u }));
  else if (Array.isArray(body?.media)) raw = body.media;
  else if (body?.imageUrl) raw = [{ url: body.imageUrl }];
  if (String(body?.videoUrl || '').trim()) return { ok: false, error: 'showcase_images_only' };
  const urls = [];
  for (const m of raw) {
    const url = String(m?.url ?? '').trim();
    if (String(m?.type || '').toLowerCase() === 'video' || VIDEO_EXT_RE.test(url)) return { ok: false, error: 'showcase_images_only' };
    if (!IMAGE_PATH_RE.test(url)) return { ok: false, error: 'bad_media' };
    if (!urls.includes(url)) urls.push(url);
  }
  if (!urls.length) return { ok: false, error: 'bad_media' };
  if (urls.length > SHOWCASE_MAX_MEDIA) return { ok: false, error: 'too_many_media', limit: SHOWCASE_MAX_MEDIA };

  const title = String(body?.title ?? '').trim();
  if (title.length > SHOWCASE_TITLE_MAX) return { ok: false, error: 'bad_title', limit: SHOWCASE_TITLE_MAX };

  let priceUzs = null;
  if (body?.priceUzs !== undefined && body?.priceUzs !== null && body?.priceUzs !== '') {
    const n = typeof body.priceUzs === 'number' ? body.priceUzs : (/^\d+$/.test(String(body.priceUzs).trim()) ? Number(body.priceUzs) : NaN);
    if (!Number.isSafeInteger(n) || n < 0 || n > SHOWCASE_PRICE_MAX) return { ok: false, error: 'bad_price' };
    priceUzs = n;
  }

  let linkUrl = null;
  if (body?.linkUrl !== undefined && body?.linkUrl !== null && String(body.linkUrl).trim() !== '') {
    linkUrl = cleanShowcaseLink(body.linkUrl);
    if (!linkUrl) return { ok: false, error: 'bad_link' };
  }

  let imageSeconds = IMAGE_SECONDS_DEFAULT;
  if (body?.imageSeconds !== undefined && body?.imageSeconds !== null && body?.imageSeconds !== '') {
    const n = Math.round(Number(body.imageSeconds));
    if (Number.isFinite(n)) imageSeconds = Math.min(IMAGE_SECONDS_MAX, Math.max(IMAGE_SECONDS_MIN, n));
  }

  let catalogItemId = null;
  const rawItem = body?.catalogItemId;
  if (companyId && rawItem !== undefined && rawItem !== null && String(rawItem).trim() !== '') {
    const id = String(rawItem).trim();
    if (!CATALOG_ID_RE.test(id)) return { ok: false, error: 'bad_catalog_item' };
    let row = null;
    try {
      row = await env.DB.prepare(`SELECT id FROM company_catalog_items WHERE id = ? AND company_id = ?`).bind(id, companyId).first();
    } catch { row = null; }
    if (!row) return { ok: false, error: 'bad_catalog_item' };
    catalogItemId = String(row.id);
  }

  return {
    ok: true,
    showcase: { title: title || null, priceUzs, linkUrl, catalogItemId, imageSeconds },
    media: {
      imageUrl: urls[0],
      mediaJson: urls.length > 1 ? JSON.stringify(urls.map((url) => ({ url, type: 'image' }))) : null,
    },
  };
}

/// Katalog mahsulotining javobdagi shakli (shartnoma §3).
export function catalogItemJson(r) {
  if (!r) return null;
  const promo = r.promotion_price == null ? null : Number(r.promotion_price);
  const price = Number(r.price || 0);
  const eff = promo != null && promo > 0 ? promo : price;
  return {
    id: String(r.id),
    companyId: String(r.company_id || ''),
    name: String(r.name || ''),
    priceUzs: eff > 0 ? eff : null,
    image: r.image_url || '',
  };
}
