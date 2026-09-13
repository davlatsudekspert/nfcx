/**
 * NFC ID tariflari — `src/lib/pricing.js` (`TIER_PRICE`, veb kodbazasi)
 * bilan AYNAN bir xil sonlar: free/bronze 49 000 · silver 99 000 ·
 * gold 149 000 · premium 199 000 · exclusive 490 000 dan. Bu haqiqiy,
 * saytda ishlatilayotgan tarif narxlari — dizayn placeholder emas.
 *
 * Metall ranglari `design_handoff_nfcstore_app/README.md` "Tier metals"
 * jadvalidan.
 *
 * Muhim: aniq kod uchun tarif qo'lda belgilanishi mumkin (masalan
 * VIP001 kabi zaxira qilingan kodlar) — bu ro'yxat (`CODE_TIERS`,
 * `CODE_PRICES`) sayt tomonida (`src/lib/codeTiers.js`) turadi va
 * mobil ilovaga ATAYLAB ko'chirilmaydi: bu ichki biznes ma'lumoti,
 * mijoz qurilmasiga yuklanmasligi kerak. Shuning uchun bu yerda faqat
 * UMUMIY tarif jadvali bor — aniq kodning yakuniy narxini backend
 * hisoblaydi (checkout paytida).
 */
export const NFC_TIERS = [
  { key: 'bronze', name: 'Bronze', price: 49_000, m1: '#e0b083', m2: '#7d4a1e' },
  { key: 'silver', name: 'Silver', price: 99_000, m1: '#eef2f6', m2: '#8b949c' },
  { key: 'gold', name: 'Gold', price: 149_000, m1: '#f0cf7a', m2: '#a87c0d' },
  { key: 'premium', name: 'Premium', price: 199_000, m1: '#d8c6f0', m2: '#6b4fa0' },
  {
    key: 'exclusive',
    name: 'Exclusive',
    price: 490_000,
    m1: '#f6ead0',
    m2: '#5a4a22',
    from: true,
  },
] as const;
