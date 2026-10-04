// hosting/api/reserved-codes.js — SAYT SAHIFALARI BILAN TO'QNASHADIGAN NFC ID'LAR.
//
// nfcstore.uz/<so'z> — sayt avval o'z sahifasini qidiradi (src/App.jsx
// STATIC_ROUTES / RESERVED), topilmasa so'zni NFC ID deb profil ochadi.
// Shuning uchun sahifa nomi bilan bir xil kod HECH KIMGA berilmasligi
// kerak: aks holda yo sahifa profilni yashiradi, yo (sahifa qo'shilmagan
// bo'lsa) /support kabi manzil begona odamning profilini ochadi.
//
// App Store tekshiruvi (2026-10): /support, /contact va /terms "Bu ID
// bo'sh — band qiling" sahifasini ochardi. Endi ular haqiqiy sahifa va
// shu ro'yxatda.
//
// Ro'yxat src/App.jsx dagi harfli (3–16 belgi) yo'llar bilan bir xil
// bo'lishi SHART — scripts/test-support-routes.mjs ikkalasini
// solishtiradi. server/index.js (eski Express) da ham nusxasi bor.
export const RESERVED_CODES = new Set([
  // Kirish, kabinet va xizmat yo'llari.
  'LOGIN', 'REGISTER', 'ACCOUNT', 'PRIVACY', 'API', 'ADMIN', 'STATIC', 'UPLOADS', 'AUKSION', 'XABARLAR', 'TOLOVLAR',
  // Yordam, aloqa va huquqiy sahifalar (App Store "Support URL").
  'SUPPORT', 'CONTACT', 'HELP', 'YORDAM', 'TERMS', 'EULA', 'ALOQA', 'SHARTLAR', 'MAXFIYLIK',
  // Saytning boshqa ochiq sahifalari.
  'NARXLAR', 'YANGILIKLAR', 'KATALOG', 'SAVOLLAR', 'GIFTS', 'QOLLANMA', 'STIKERLAR', 'ACTIVATE',
  'REYTING', 'KOMPANIYALAR', 'BILDIRISHNOMALAR', 'SOZLAMALAR', 'BUSINESS', 'COMPANY', 'WORKSPACE',
]);

/// Kod sayt sahifasi nomi bilan to'qnashadimi (katta-kichik harf farqsiz).
export function isReservedCode(code) {
  return RESERVED_CODES.has(String(code || '').trim().toUpperCase());
}
