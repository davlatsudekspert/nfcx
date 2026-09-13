// ADMIN KO'RIB CHIQISHI — "?preview=1".
//
// Egasining talabi: admin panelidan foydalanuvchi ustiga bosilganda
// uning profili yangi oynada ochilsin, FAQAT KO'RISH uchun.
//
// Muammo: profilni ochish "Ko'rildi" hisobini oshiradi (u frontenddan
// sanaladi). Admin kuniga o'nlab profilni ochsa, mijozning statistikasi
// shishib ketadi — statistika esa NFCSTORE'da pullik imkoniyat, ya'ni
// uning to'g'riligi mijozga pul turadi.
//
// Shuning uchun admin havolasi "?preview=1" bilan ochiladi va sahifa bu
// belgini ko'rsa ko'rishni SANAMAYDI.
//
// Nima uchun oddiy URL belgisi yetarli: uni qo'shish hisobni faqat
// KAMAYTIRADI. Ya'ni undan "foydalanib" birov boshqaning raqamini
// ko'tara olmaydi — eng yomoni o'zining ko'rishini yozdirmaydi, bu esa
// hech kimga zarar qilmaydi. Admin ekanini tekshirish uchun har bir
// profil ochilishida qo'shimcha so'rov kerak bo'lardi.
export function isPreviewVisit() {
  try {
    return new URLSearchParams(window.location.search).get('preview') === '1';
  } catch {
    return false;
  }
}

// Admin panelidan profilga havola. Kod bo'sh bo'lsa — bo'sh satr
// (chaqiruvchi havolani umuman chizmaydi).
export function adminPreviewUrl(code) {
  const c = String(code || '').trim();
  return c ? `/${encodeURIComponent(c)}?preview=1` : '';
}
