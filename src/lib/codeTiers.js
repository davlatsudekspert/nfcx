// ─────────────────────────────────────────────────────────────────────────────
// HAR KODGA QO'LDA BELGILANGAN TARIF (per-code tier override)
// ─────────────────────────────────────────────────────────────────────────────
// Sayt egasi tanlagan aniq kodlar. tierForCode() va priceForCode() AVVAL shu
// ro'yxatni tekshiradi, kod bu yerda bo'lmasa — odatdagi naqsh mantig'iga
// (tierFromCode) qaytadi.
//
//   'exclusive' — to'g'ridan-to'g'ri sotilmaydi, faqat admin ochgan auksion
//                 orqali. Checker/kalkulyatorda "faqat auksion" deb ko'rsatiladi.
//   'premium'   — 199 000 so'm qat'iy narx, oddiy bandlash orqali sotiladi.
//
// O'zgartirish: shu faylni tahrirlang + deploy. Kod formati: 3 harf + 3 raqam.
// Manba: egasining ro'yxati (2026-08).

// Faqat auksion orqali (ekslyuziv) — 34 ta kod.
const AUCTION_CODES = [
  'AAA001', 'AAA007', 'OOO001', 'OOO007', 'JJJ007', 'DDD001', 'DDD007', 'FFF007',
  'BEK001', 'BEK007', 'BEK777', 'UZB000', 'UZB001', 'UZB007', 'UAE001', 'USD100',
  'ABC123', 'DEV001', 'GEM001', 'UNO000', 'WOW013', 'ASL777', 'AGA777', 'KHU777',
  'ISA777', 'FAY777', 'USS777', 'OZZ777', 'PZP777', 'PLT034', 'RMA007', 'FCB010',
  'AMG063', 'CLS063',
];

// Premium (199 000 so'm) — 38 ta kod.
const PREMIUM_CODES = [
  'AAA100', 'AAA701', 'AAA717', 'AAA097', 'AAA066', 'ZZZ717', 'ZZZ727', 'ZZZ005',
  'OOO005', 'OOO013', 'EMR777', 'GRL999', 'GRL444', 'GRL555', 'GRL777', 'GRL888',
  'GRL333', 'GRL222', 'AZU555', 'TEN444', 'KAP444', 'DYR444', 'AKL444', 'ACA666',
  'PBP888', 'SKB888', 'GIO111', 'WEF111', 'ETS111', 'SZZ222', 'BOY222', 'MLN222',
  'GGG200', 'VVV700', 'NMX700', 'ZOO700', 'GRL700', 'BMW010',
];

// EXACT PREMIUM — har doim PREMIUM (barcha prefiks/guruh qoidalaridan ustun).
// Manba: "SPECIAL TIER CLASSIFICATION" spec, 2-bo'lim.
const EXACT_PREMIUM_CODES = [
  'KHB029', 'UFC229', 'UFC300', 'UFC205', 'UFC194', 'UFC100', 'UFC200', 'UFC254',
  'MMA029', 'MMA300', 'KHB254', 'CON013', 'CON205', 'CON194',
];

export const CODE_TIERS = {};
for (const c of AUCTION_CODES) CODE_TIERS[c] = 'exclusive';
for (const c of PREMIUM_CODES) CODE_TIERS[c] = 'premium';
for (const c of EXACT_PREMIUM_CODES) CODE_TIERS[c] = 'premium';

// Kod uchun qo'lda belgilangan tarif (yo'q bo'lsa null).
export function codeTierOverride(code) {
  const c = String(code || '').toUpperCase();
  return Object.prototype.hasOwnProperty.call(CODE_TIERS, c) ? CODE_TIERS[c] : null;
}
