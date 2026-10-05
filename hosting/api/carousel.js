// hosting/api/carousel.js — KARUSEL: bitta postda 10 tagacha rasm (2026-10).
//
// ═══ NIMA UCHUN BOR ═══
//
// Biznes bitta postda bir nechta mahsulot rasmini (yoki bitta
// mahsulotning bir necha tomonini) ko'rsatmoqchi — Instagram'dagi
// "karusel". Ilgari postda faqat bitta `image_url` / `video_url` bor edi.
//
// ═══ ESKI ILOVALAR BUZILMAYDI ═══
//
//   * Yangi ustun `media_json` (TEXT, JSON massiv) — ADD COLUMN, eski
//     qatorlarda NULL.
//   * `image_url` ga HAR DOIM karuselning BIRINCHI rasmi yoziladi: eski
//     ilova postni bitta rasmli post sifatida ko'rsataveradi.
//   * Javoblarga faqat yangi `mediaItems` maydoni QO'SHILADI. U har doim
//     bor: karusel bo'lmasa ham `image_url`/`video_url` dan yasaladi —
//     yangi ilova faqat `mediaItems` ni o'qisa yetadi.
//   * JAVOBDA `media` KALITI ATAYLAB YO'Q. O'rnatilgan eski ilova
//     (`Post.fromJson`, mobile/lib/data/models.dart) `media` dagi HAR
//     elementning `url` ini RASM deb oladi: video postda u butun MP4 ni
//     rasm sifatida yuklab, panjara va lentani buzardi. So'rovdagi `media`
//     (yaratishda) qoladi — eski ilova uni yubormaydi.
//
// ═══ QOIDALAR ═══
//
//   * 1 element — oddiy post (rasm YOKI video), `media_json` yozilmaydi.
//   * 2..10 element — karusel, FAQAT RASM. Video karuselda yo'q: lenta
//     Reels kabi aylanadi va bitta postda bir nechta video o'ynatish
//     trafik va xotirani bir necha barobar oshirardi.
//   * Har manzil — FAQAT o'zimizning R2 yuklamasi, `imageUrl`/`videoUrl`
//     bilan AYNAN bir xil qat'iy tekshiruv (worker.js `storyMediaD1`):
//     tashqi manzil kuzatuv pikseli yoki o'chib qoladigan havola bo'lardi.

export const CAROUSEL_MAX = 10;

// worker.js dagi `UPLOAD_IMAGE_PATH_RE` / `UPLOAD_VIDEO_PATH_RE` bilan
// AYNAN bir xil (modul worker.js dan import qilmaydi — CONTRACT.md).
export const IMAGE_PATH_RE = /^\/uploads\/[A-Za-z0-9][A-Za-z0-9_-]{0,120}\.(png|jpe?g|webp|gif)$/i;
export const VIDEO_PATH_RE = /^\/uploads\/[A-Za-z0-9][A-Za-z0-9_-]{0,120}\.(mp4|webm)$/i;

/// So'rovdagi `media` ni tekshiradi.
///   media yo'q             → { ok: true, provided: false }
///   yaroqsiz               → { ok: false, error }
///   1 element              → { ok: true, provided: true, imageUrl|videoUrl, mediaJson: null }
///   2..10 rasm             → { ok: true, provided: true, imageUrl: birinchisi, videoUrl: null, mediaJson }
export function parseMediaInput(body) {
  const raw = body?.media;
  if (raw === undefined || raw === null) return { ok: true, provided: false };
  if (!Array.isArray(raw) || !raw.length) return { ok: false, error: 'bad_media' };
  if (raw.length > CAROUSEL_MAX) return { ok: false, error: 'too_many_media', limit: CAROUSEL_MAX };
  const items = [];
  const seen = new Set();
  for (const m of raw) {
    const url = String(m?.url ?? '').trim();
    const type = String(m?.type ?? '').trim().toLowerCase() || (VIDEO_PATH_RE.test(url) ? 'video' : 'image');
    if (type === 'image' ? !IMAGE_PATH_RE.test(url) : type === 'video' ? !VIDEO_PATH_RE.test(url) : true) {
      return { ok: false, error: 'bad_media' };
    }
    // Bir xil rasm ikki marta — jim tashlanadi (ilova ikki marta bosgan).
    if (seen.has(url)) continue;
    seen.add(url);
    items.push({ url, type });
  }
  if (items.length === 1) {
    const one = items[0];
    return {
      ok: true, provided: true, mediaJson: null,
      imageUrl: one.type === 'image' ? one.url : null,
      videoUrl: one.type === 'video' ? one.url : null,
    };
  }
  if (items.some((x) => x.type !== 'image')) return { ok: false, error: 'carousel_images_only' };
  return { ok: true, provided: true, imageUrl: items[0].url, videoUrl: null, mediaJson: JSON.stringify(items) };
}

/// Javobdagi `mediaItems` — har doim massiv. Karusel bo'lsa `media_json`
/// dan, aks holda `image_url`/`video_url` dan (video bo'lsa rasm uning
/// muqovasi — `thumbUrl`).
export function mediaOut(mediaJson, imageUrl, videoUrl) {
  if (mediaJson) {
    try {
      const list = JSON.parse(mediaJson);
      if (Array.isArray(list)) {
        const clean = list
          .filter((m) => m && typeof m.url === 'string' && (m.type === 'image' ? IMAGE_PATH_RE : VIDEO_PATH_RE).test(m.url))
          .slice(0, CAROUSEL_MAX)
          .map((m) => ({ url: m.url, type: m.type }));
        if (clean.length) return clean;
      }
    } catch { /* buzuq JSON — oddiy maydonlardan yasaladi */ }
  }
  if (videoUrl) return [{ url: String(videoUrl), type: 'video', ...(imageUrl ? { thumbUrl: String(imageUrl) } : {}) }];
  if (imageUrl) return [{ url: String(imageUrl), type: 'image' }];
  return [];
}

/// `media_json` dagi barcha manzillar (hisob o'chirish va fayl
/// tozalash qo'riqchisi uchun SQL ichida ishlatiladi): `x` — jadval
/// taxallusi. Natija ustuni `url`.
export const mediaJsonUrlsSql = (tb, where) => `SELECT json_extract(j.value, '$.url') AS url
    FROM ${tb} x, json_each(CASE WHEN json_valid(x.media_json) THEN x.media_json ELSE '[]' END) j
   WHERE ${where}`;
