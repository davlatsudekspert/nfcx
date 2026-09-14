/**
 * NFC teg ichidagi URL'ni ajratish.
 *
 * HAQIQIY KARTA SHAKLI (saytdan tekshirilgan):
 *
 *   https://nfcstore.uz/<KOD>?t=<chipToken>
 *
 * Ya'ni profil kodi URL YO'LIDA, chip tokeni esa `?t=` parametrida.
 * `src/pages/ProfilePage.jsx` aynan shu `t` parametrini o'qib
 * `/api/tap/:token` ga yuboradi va faqat FAOLLIKNI tekshiradi —
 * navigatsiya URL'ning o'zidan bo'ladi.
 *
 * Shuning uchun bu yerda ham birinchi navbatda YO'LDAN kod olinadi.
 * `/api/tap/:token` dagi `linkedCode` faqat zaxira: teg ichida kod
 * bo'lmasa (masalan faqat token yozilgan eski teg) o'sha ishlatiladi.
 */

/**
 * Profil kodi shakllari — saytdagi `ROUTE_PROFILE_RE` bilan AYNAN bir xil:
 *   AAA000    standart kod (3 harf + 3 raqam)
 *   12345678  ro'yxatdan o'tishdagi avtomatik 8 xonali ID
 *   abc…      faqat harfli nom (3–12 belgi) — admin bergan maxsus profil
 */
const PROFILE_CODE_RE = /^(?:[A-Za-z]{3}[0-9]{3}|[0-9]{8}|[A-Za-z]{3,12})$/;

/**
 * Saytdagi band yo'llar. Kartaga bunday qiymat yozilmaydi, lekin
 * noto'g'ri/sinov tegi tasodifan sahifa manzilini olib kelsa, uni
 * "profil kodi" deb talqin qilmaymiz.
 */
const RESERVED = new Set(
  [
    'login', 'register', 'account', 'narxlar', 'qanday-ishlaydi', 'yangiliklar',
    'katalog', 'savollar', 'aloqa', 'shartlar', 'maxfiylik', 'auksion',
    'auksion-qoidalari', 'gifts', 'qollanma', 'admin', 'xabarlar', 'tolovlar',
    'karta-dizayni', 'biznes-namuna', 'reyting', 'kompaniyalar',
    'bildirishnomalar', 'sozlamalar', 'business', 'company', 'workspace', 'c',
    'api', 'static', 'uploads',
  ].map((s) => s.toLowerCase()),
);

export type TagTarget =
  | { kind: 'card'; code: string; token: string | null }
  | { kind: 'company'; companyId: string; token: string | null }
  /** Yo'lda kod yo'q, lekin token bor — `/api/tap/:token` bilan hal qilinadi. */
  | { kind: 'token'; token: string }
  | { kind: 'unknown' };

/**
 * Tegdagi matndan maqsadni aniqlaydi. Hech qanday tarmoq so'rovi
 * qilmaydi — sof funksiya, shuning uchun test qilish oson.
 */
export function parseTagUrl(raw: string): TagTarget {
  const text = (raw ?? '').trim();
  if (!text) return { kind: 'unknown' };

  // Ba'zi teglar sxemasiz yoziladi ("nfcstore.uz/ABC123"), shuning
  // uchun sxema qo'shiladi.
  //
  // LEKIN faqat matnda nuqta yoki slash bo'lsa. Aks holda xom token
  // ("a1b2c3d4") ga `https://` qo'shilsa u YAROQLI hostname bo'lib
  // qoladi va `URL` xato bermaydi — natijada token yo'li hech qachon
  // ishlamasdi. Buni test topdi.
  const looksLikeUrl =
    /^[a-z][a-z0-9+.-]*:\/\//i.test(text) || text.includes('/') || text.includes('.');

  if (!looksLikeUrl) {
    return looksLikeToken(text) ? { kind: 'token', token: text } : { kind: 'unknown' };
  }

  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`;

  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    // URL emas — ehtimol xom token yozilgan.
    return looksLikeToken(text) ? { kind: 'token', token: text } : { kind: 'unknown' };
  }

  const token = url.searchParams.get('t');
  const segments = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);

  // Kompaniya sahifasi: /c/<ID> yoki /kompaniyalar/<ID>
  if (segments.length >= 2 && (segments[0] === 'c' || segments[0] === 'kompaniyalar')) {
    return { kind: 'company', companyId: segments[1], token };
  }

  if (segments.length >= 1) {
    const first = segments[0];
    if (!RESERVED.has(first.toLowerCase()) && PROFILE_CODE_RE.test(first)) {
      return { kind: 'card', code: first.toUpperCase(), token };
    }
  }

  // Yo'lda kod topilmadi — token bo'lsa server hal qiladi.
  if (token && looksLikeToken(token)) return { kind: 'token', token };
  return { kind: 'unknown' };
}

/** chip_token — ~8 belgi, URL-xavfsiz (worker.js, createPhysicalCard). */
function looksLikeToken(v: string): boolean {
  return /^[A-Za-z0-9_-]{6,64}$/.test(v);
}
