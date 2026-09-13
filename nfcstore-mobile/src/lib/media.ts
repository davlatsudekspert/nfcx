import { API_BASE } from '@/api/client';

/** `https://nfcstore.uz` — `API_BASE` dan `/api` olib tashlangani. */
const ORIGIN = API_BASE.replace(/\/api$/, '');

/**
 * Backenddan kelgan media manzilini ILOVA OCHA OLADIGAN to'liq
 * manzilga aylantiradi.
 *
 * NEGA KERAK: server rasmlarni NISBIY yo'l bilan saqlaydi va shundayligicha
 * qaytaradi — `/uploads/abc.png` (worker.js:5515 `return
 * '/uploads/${filename}'`, worker.js:604 esa uni o'zgartirmasdan
 * o'tkazadi). Brauzerda `<img src="/uploads/…">` sahifaning o'z domeniga
 * nisbatan hal qilinadi va rasm chiqadi. Ilovada esa domen tushunchasi
 * yo'q: `expo-image` ga `/uploads/…` berilsa, u haqiqiy manzil emas va
 * rasm JIM ravishda chizilmaydi — aynan shuning uchun avatarlar,
 * logotiplar, mahsulot rasmlari va postlar o'rniga chiziqli
 * o'rinbosarlar ko'rinardi.
 *
 * Bo'sh qiymat `undefined` qaytaradi — chaqiruvchi shunda o'rinbosarni
 * chizadi.
 */
export function mediaUrl(url?: string | null): string | undefined {
  const v = (url ?? '').trim();
  if (!v) return undefined;
  // Allaqachon to'liq manzil (yoki data:/file: sxemasi) — tegmaymiz.
  if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return v;
  // Protokolsiz manzil: `//cdn.example.com/x.png`
  if (v.startsWith('//')) return `https:${v}`;
  return `${ORIGIN}${v.startsWith('/') ? '' : '/'}${v}`;
}
