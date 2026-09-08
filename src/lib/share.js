// Havolani ulashish — telefonda tizimning o'z ulashish oynasi
// (Telegram, WhatsApp, Instagram...), kompyuterda esa nusxalash.
//
// NIMA UCHUN ALOHIDA FAYL: bu mantiq ProfilePage ichida yopiq turgan
// edi va yangiliklar bo'limida qaytadan yozilishi kerak bo'lardi. Ikki
// nusxa vaqt o'tib bir-biridan ajralib ketadi.
//
// Qaytaradigan qiymatlar chaqiruvchiga NIMA KO'RSATISHNI aytadi:
//   'shared'    — tizim oynasi orqali ulashildi, hech narsa ko'rsatmaslik
//                 kerak (foydalanuvchi natijani o'zi ko'rdi);
//   'copied'    — havola vaqtinchalik xotiraga olindi, "Nusxalandi"
//                 deyish kerak;
//   'cancelled' — foydalanuvchi ulashish oynasini yopdi; bu XATO EMAS,
//                 hech qanday xabar chiqarilmasligi kerak;
//   'failed'    — nusxalash ham ishlamadi (masalan HTTPS bo'lmagan yoki
//                 ruxsat berilmagan muhit).
// `forceCopy` — tizim ulashish oynasi ochilmaydigan yoki bo'sh ochiladigan
// brauzerlar bor (Yandex ish stoli varianti shulardan biri). Shunday holat
// uchun "Havolani nusxalash" tugmasi kerak: u har doim ishlaydi va
// foydalanuvchi havolani xohlagan joyiga o'zi qo'yadi.
export async function shareLink({ url, title, text, forceCopy = false } = {}) {
  const href = String(url || '');
  if (!href) return 'failed';

  if (!forceCopy && typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ url: href, ...(title ? { title } : {}), ...(text ? { text } : {}) });
      return 'shared';
    } catch (err) {
      // AbortError — foydalanuvchi o'zi bekor qildi. Bunda nusxalashga
      // O'TMASLIK kerak: u ulashmoqchi emas edi, "Nusxalandi" degan
      // xabar esa aksincha, nimadir bo'lgandek taassurot qoldiradi.
      if (err && err.name === 'AbortError') return 'cancelled';
      // Boshqa xatolik (brauzer qo'llab-quvvatlamadi, ruxsat yo'q) —
      // nusxalashga tushamiz.
    }
  }

  try {
    await navigator.clipboard.writeText(href);
    return 'copied';
  } catch {
    return 'failed';
  }
}
