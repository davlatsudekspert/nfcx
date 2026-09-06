// ─────────────────────────────────────────────────────────────────────────────
// HAR KODGA QO'LDA BELGILANGAN NARX (per-code price override)
// ─────────────────────────────────────────────────────────────────────────────
// Sayt egasi ayrim NFC ID'lar uchun aniq narx belgilaydi. Bu narx TARIF
// narxidan (TIER_PRICE) USTUN turadi va katalog, qidiruv, profil belgisi,
// Admin Panel hamda auksionning "Sotilgan" bo'limi — hammasi SHU YAGONA
// manbadan foydalanadi.
//
// BIRLIK: SO'M (tiyin EMAS). Bazadagi `cards.price` va `web_orders.price`
// ustunlari ham so'mda saqlanadi; Payme checkout havolasi yaratilganda
// summa faqat o'sha joyda 100 ga ko'paytirilib tiyinga o'giriladi
// (hosting/worker.js paymeCheckoutLinkD1). Shuning uchun bu yerda
// 8 700 000 = sakkiz million yetti yuz ming so'm.
//
// DIQQAT: bu ro'yxat FAQAT joriy katalog/sotuv ko'rinishidagi narxga va
// kelajakda yaratiladigan buyurtmaning narxiga ta'sir qiladi. Eski
// buyurtmalar, Payme tranzaksiyalari va to'langan summalar (web_orders,
// payme_transactions) O'ZGARTIRILMAYDI — moliyaviy tarix tegilmaydi.
//
// MUHIM: bu faylning mazmuni hosting/worker.js ichidagi CODE_PRICES_D1
// bilan AYNAN bir xil bo'lishi shart (Worker modullari `src/` dan import
// qila olmaydi — build guard buni taqiqlaydi).
// scripts/test-code-prices-and-sold.mjs ikkalasini solishtirib turadi.
//
// Manba: egasining ro'yxati (2026-09).

export const CODE_PRICES = {
  // Birinchi uchta belgi — lotincha "O" harfi (raqam nol EMAS).
  OOO000: 8_700_000,
  VVV444: 2_900_000,
  BMW007: 199_000,
  VIP001: 7_600_000,
  VIP000: 9_700_000,
};

// Kod uchun qo'lda belgilangan narx (yo'q bo'lsa null).
// Katta-kichik harf farqi yo'q, lekin kanonik (katta harfli) ko'rinish saqlanadi.
export function codePriceOverride(code) {
  const c = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return Object.prototype.hasOwnProperty.call(CODE_PRICES, c) ? CODE_PRICES[c] : null;
}
