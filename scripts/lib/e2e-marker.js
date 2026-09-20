// E2E TEST OBYEKTINI ANIQLASH — SOF FUNKSIYA
//
// NIMA UCHUN ALOHIDA VA SOF. Bu qoida PRODUKSIYA MA'LUMOTINI
// o'chirish uchun ishlatiladi. Shuning uchun u hech qanday tarmoqqa
// tegmaydi va testdan to'liq o'tkaziladi: bitta yolg'on ijobiy
// javob odamning HAQIQIY postini o'chirib yuborardi.
//
// NIMA UCHUN QAT'IY. Naqsh "NOVA" yoki "TEST" so'zini qidirmaydi —
// odam o'z postiga "test" deb yozishi mumkin. Faqat E2E to'plami
// qo'yadigan TO'LIQ shakl qabul qilinadi:
//
//   NOVA E2E TEST — DELETE · post · 2026-09-19T17:05:13.816754Z
//   └──── qat'iy sarlavha ────┘   └tur┘  └──── ISO vaqt ────┘
//
// Uchala qism ham bo'lishi SHART. Bittasi yetishmasa — bu bizning
// obyektimiz emas va unga TEGILMAYDI.
//
// Tire belgisi: E2E to'plami UZUN tire (—, U+2014) ishlatadi.
// Ba'zi muhitlar uni oddiy tire bilan almashtirishi mumkin, shuning
// uchun ikkalasi ham qabul qilinadi — lekin qolgan shakl o'zgarmaydi.
const E2E_CAPTION_RE =
  /^NOVA E2E TEST\s+[—-]\s+DELETE\s*·\s*[a-z]+\s*·\s*\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?\s*$/;

export function isE2eTestCaption(caption) {
  return E2E_CAPTION_RE.test(String(caption == null ? '' : caption).trim());
}

// Obyekt o'chirishga NOMZODMI?
//
// IKKI SHART BIRGA:
//   1) izohi aynan yuqoridagi shaklda;
//   2) u EGASI bo'lgan NFC ID ga tegishli.
// Egalik shartisiz naqshning o'zi yetarli emas: kimdir shunday izoh
// yozib, boshqa odamning postini "nomzod" qilib qo'yishi mumkin.
export function isDeletableE2ePost(post, ownedCodes) {
  if (!post || !isE2eTestCaption(post.caption)) return false;
  const owned = new Set((Array.isArray(ownedCodes) ? ownedCodes : [])
    .map((c) => String(c || '').toUpperCase()));
  const code = String(post.code || '').toUpperCase();
  return !!code && owned.has(code);
}

// Story uchun ham AYNAN shu qoida. Story qatori ham `caption` va
// (skript qo'shadigan) `code` maydoniga ega, shuning uchun mantiq
// ikkiga bo'linmaydi: bo'lingan bo'lsa, biri qattiqroq, ikkinchisi
// bo'shroq bo'lib qolish xavfi bor edi.
export const isDeletableE2eStory = isDeletableE2ePost;
export const isDeletableE2eItem = isDeletableE2ePost;

// Muddati o'tganmi? Story 24 soatdan keyin ko'rinmasligi kerak.
//
// Bu ALOHIDA shart: muddati o'tgan story E2E bo'lishi ham, haqiqiy
// bo'lishi ham mumkin — ikkalasi ham ko'rinmaydi va chegaraga
// kirmaydi. Sana o'qib bo'lmasa "o'tmagan" deb hisoblaymiz: noaniq
// qiymat tufayli haqiqiy story o'chib ketmasin.
export function isExpired(item, now = Date.now()) {
  const raw = item && item.expiresAt;
  if (!raw) return false;
  const ms = Date.parse(String(raw));
  return Number.isNaN(ms) ? false : ms <= now;
}

export default isDeletableE2ePost;
