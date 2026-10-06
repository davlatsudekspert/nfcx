// APP STORE (iPhone ilovasi) HOLATI — YAGONA MANBA (2026-10).
//
// Ilgari "tez kunda" yozuvi har sahifada alohida turardi (/ilova-yuklash,
// bosh sahifa, /nfc-stiker, xush kelibsiz oynasi, SEO sarlavhasi) va
// ular bir-biridan farq qilib qolardi. Endi hammasi shu fayldan o'qiydi.
//
// Fayl `hosting/api/` ichida, chunki Worker (SEO sarlavhalari) `src/` dan
// import qila olmaydi; sayt uni `src/lib/appDownload.js` orqali oladi.
//
// ILOVA APP STORE'DA CHIQQAN KUNI — FAQAT SHU BITTA QATORNI O'ZGARTIRING:
//   export const APP_STORE_URL = 'https://apps.apple.com/app/id0000000000';
export const APP_STORE_URL = '';

// 'review' — Apple tekshiruvida (tugma bosilmaydi, "tez orada");
// 'live'   — App Store'da (tugma APP_STORE_URL ga olib boradi).
export const APP_STORE_STATUS = APP_STORE_URL ? 'live' : 'review';
export const APP_STORE_LIVE = APP_STORE_STATUS === 'live';

// Tugma yonidagi kichik nishon ("tez orada") va to'liq yozuv.
const SOON_BADGE = { uz: 'Tez orada', ru: 'Скоро', en: 'Coming soon' };
const SOON_TEXT = { uz: 'App Store — tez orada', ru: 'Скоро в App Store', en: 'Coming soon to the App Store' };
const LIVE_TEXT = { uz: 'App Store’da mavjud', ru: 'Доступно в App Store', en: 'Available on the App Store' };

export function appStoreBadge(lang = 'uz') {
  return APP_STORE_LIVE ? '' : (SOON_BADGE[lang] || SOON_BADGE.uz);
}

export function appStoreText(lang = 'uz') {
  const map = APP_STORE_LIVE ? LIVE_TEXT : SOON_TEXT;
  return map[lang] || map.uz;
}

// /ilova-yuklash sarlavhasi (SEO) — holatga qarab.
const PAGE_TITLE = {
  review: {
    uz: 'NFCSTORE ilovasi — Android, App Store tez orada',
    ru: 'Приложение NFCSTORE — Android, скоро в App Store',
    en: 'NFCSTORE app — Android, coming soon to the App Store',
  },
  live: {
    uz: 'NFCSTORE ilovasi — Android va iPhone',
    ru: 'Приложение NFCSTORE — Android и iPhone',
    en: 'NFCSTORE app — Android and iPhone',
  },
};
export function appPageTitle(lang = 'uz') {
  const map = PAGE_TITLE[APP_STORE_STATUS];
  return map[lang] || map.uz;
}
