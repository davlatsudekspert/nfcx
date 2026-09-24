// NFCSTORE ANDROID ILOVASI — SAYTDAN YUKLAB OLISH (egasi, 2026-09-24).
//
// "Play Market'ga chiqquncha ilovani saytga qo'yib turamiz; NFC orqali
// ochilgan profilda ham 'ilovani yuklang' bo'lsin."
//
// Fayl — Google Play'ning O'ZI imzolagan universal APK
// (.github/workflows/nova-apk.yml → `play-latest` reliz). Imzosi Play
// Market'dagi bilan bir xil, shuning uchun saytdan o'rnatgan odam
// ilova Play'ga chiqqach uni Play'dan bemalol yangilaydi.
export const APP_APK_URL =
  'https://github.com/davlatsudekspert/nfcx/releases/download/play-latest/NFCSTORE-Play.apk';

// Sahifa manzili. Tire bilan — profil kodi (harf/raqam) bo'lib
// qolmasin: nfcstore.uz/ilova kabi so'z kimningdir harfli ID'si
// bo'lishi mumkin edi.
export const APP_PAGE_PATH = '/ilova-yuklash';

// iPhone/iPad — Android ilovasi o'rnatilmaydi, tugma ko'rsatilmaydi.
export function isIos() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}
