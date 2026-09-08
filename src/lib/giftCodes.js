// ─────────────────────────────────────────────────────────────────────────────
// EGASI SOVG'A DEB BELGILAGAN NFC ID'LAR (per-code gift override)
// ─────────────────────────────────────────────────────────────────────────────
// Katalogda bu ID'lar narx o'rniga "Sovg'a" yozuvi bilan chiqadi.
//
// NIMA UCHUN ALOHIDA RO'YXAT KERAK BO'LDI (2026-09):
// Katalogdagi "Sovg'a" belgisi odatda `nfc_gifts` jadvalidagi HAQIQIY sovg'a
// yozuvidan hisoblanadi (status='activated'). Lekin Admin Panel'dagi sovg'a
// ochish EGASI BOR kartaga ruxsat bermaydi — `hosting/api/admin-extra.js`
// dagi tekshiruv `CODE_TAKEN` (409) qaytaradi. Ya'ni allaqachon kimgadir
// tegishli bo'lgan noyob ID'ni admin panel orqali "sovg'a" deb belgilashning
// yo'li YO'Q. Shu bo'shliqni to'ldirish uchun sayt egasi qo'lda belgilaydigan
// shu ro'yxat qo'shildi.
//
// BU RO'YXAT NIMA QILMAYDI — MUHIM:
//   - `nfc_gifts` jadvaliga HECH NARSA yozmaydi;
//   - soxta faollashtirish kodi, oluvchi yoki tranzaksiya YARATMAYDI;
//   - to'lov, buyurtma va auksion tarixiga UMUMAN tegmaydi.
// U faqat KATALOGDAGI KO'RSATISHGA ta'sir qiladi: narx o'rniga "Sovg'a".
// Haqiqiy sovg'a yozuvi bo'lgan kartalar avvalgidek ishlayveradi — bu ro'yxat
// ularga qo'shimcha, ularning o'rnini bosmaydi.
//
// MUHIM: bu faylning mazmuni hosting/worker.js ichidagi GIFT_CODES_D1 bilan
// AYNAN bir xil bo'lishi shart (Worker modullari `src/` dan import qila
// olmaydi — build guard taqiqlaydi). scripts/test-gift-codes.mjs ikkalasini
// solishtirib turadi.
//
// Manba: egasining ro'yxati (2026-09).

export const GIFT_CODES = [
  // Noyob ID — sotuvga qo'yilmagan, egasi sovg'a sifatida belgilagan.
  'SAV571',
];

// Kod egasi tomonidan sovg'a deb belgilanganmi?
// Katta-kichik harf va ajratgichlar farq qilmaydi.
export function isGiftCode(code) {
  const c = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return GIFT_CODES.includes(c);
}
