// NFC KARTA UCHUN TAYYOR FONLAR (2026-09, egasi bergan to'plam).
//
// Oltin chiziqli shahar manzaralari, qora fonda. Karta nisbati bilan
// mos (1583x994 ≈ 1.593; bosma maydon 2022x1276 ≈ 1.585) — shuning
// uchun kesilishi deyarli sezilmaydi.
//
// FORMAT: WebP. Manba PNG lar 20 MB edi — bu repo uchun ham, mobil
// internet uchun ham ko'p. WebP oltin ingichka chiziqlarni JPEG dan
// ancha toza saqlaydi (JPEG qora fonda chiziq atrofida "shovqin"
// beradi) va hajmni ~2.5 MB ga tushirdi.
//
// Har fon uchun IKKI fayl:
//   `thumb` — tanlash ro'yxati uchun (~9 KB). Ro'yxatda 8 ta to'liq
//             rasm yuklansa 2.5 MB bo'lardi.
//   `url`   — tanlangandan keyingi to'liq o'lcham (~300 KB).
const BASE = '/card-backgrounds';

export const CARD_BACKGROUNDS = [
  { id: 'tashkent', label: 'Toshkent', country: "O'zbekiston" },
  { id: 'samarkand', label: 'Samarqand', country: "O'zbekiston" },
  { id: 'bukhara', label: 'Buxoro', country: "O'zbekiston" },
  { id: 'khiva', label: 'Xiva', country: "O'zbekiston" },
  { id: 'dubai', label: 'Dubay', country: 'BAA' },
  { id: 'istanbul', label: 'Istanbul', country: 'Turkiya' },
  { id: 'paris', label: 'Parij', country: 'Fransiya' },
  { id: 'new-york', label: 'Nyu-York', country: 'AQSH' },
].map((b) => ({ ...b, url: `${BASE}/${b.id}.webp`, thumb: `${BASE}/${b.id}-thumb.webp` }));

export const cardBackgroundById = (id) => CARD_BACKGROUNDS.find((b) => b.id === id) || null;

// Saqlangan `bgUrl` shu to'plamdanmi? Tahrirlashga qaytganda qaysi fon
// tanlanganini belgilash uchun.
export function cardBackgroundFromUrl(url) {
  const u = String(url || '');
  return CARD_BACKGROUNDS.find((b) => u === b.url || u.endsWith(`${b.id}.webp`)) || null;
}
