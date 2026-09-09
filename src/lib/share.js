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

  // Tizim oynasi faqat u CHINDAN ishlaydigan joyda (pastdagi
  // `canSystemShare` izohiga qarang) — aks holda darhol nusxalashga
  // o'tamiz, chunki ish stolida bo'sh oq oyna ochilib yopilardi.
  if (!forceCopy && canSystemShare()) {
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

// ── TIZIM ULASHISH OYNASI QACHON ISHLATILADI ─────────────────────────
// `navigator.share` MAVJUDLIGI uning ISHLASHINI bildirmaydi. Ish stoli
// brauzerlarining bir qismida (Yandex shulardan biri) u bo'm-bo'sh oq
// oyna ochib, darhol yopadi va va'dani XATOSIZ bajaradi — ya'ni koddan
// "ishlamadi" deb aniqlab bo'lmaydi.
//
// Shuning uchun mezon boshqacha: tizim oynasi FAQAT sensorli
// qurilmalarda (telefon/planshet) ochiladi — u yerda u chindan
// ishlaydi va eng qulay yo'l. Ish stolida esa interfeys o'z menyusini
// ko'rsatadi (Telegram/WhatsApp/Facebook/X/nusxalash), u hech qanday
// brauzer imkoniyatiga tayanmaydi.
export function canSystemShare() {
  if (typeof navigator === 'undefined' || !navigator.share) return false;
  try {
    const coarse = typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(pointer: coarse)').matches
      : false;
    return coarse && (navigator.maxTouchPoints || 0) > 0;
  } catch {
    return false;
  }
}

// Ulashish menyusidagi tarmoqlar. Hammasi oddiy HTTPS havola —
// hech qanday SDK, hech qanday kuzatuv skripti qo'shilmaydi.
export function shareTargets({ url, title, text } = {}) {
  const u = encodeURIComponent(String(url || ''));
  const caption = String(title || '') + (text ? ` — ${text}` : '');
  const c = encodeURIComponent(caption.slice(0, 280));
  return [
    { id: 'telegram', name: 'Telegram', href: `https://t.me/share/url?url=${u}&text=${c}` },
    { id: 'whatsapp', name: 'WhatsApp', href: `https://wa.me/?text=${c}%20${u}` },
    { id: 'facebook', name: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${u}` },
    { id: 'x', name: 'X', href: `https://twitter.com/intent/tweet?url=${u}&text=${c}` },
  ];
}
