// Doimiy yuklab olish manzili. Haqiqiy APK/Play manzili Worker APP_DOWNLOAD_URL sozlamasida.
export const APP_APK_URL = '/app';

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

// ── GOOGLE PLAY / APP STORE (egasi, 2026-09-26) ─────────────────────────
//
// Play Market sahifasi. Ilova hozircha faqat yopiq testda — Play'dagi
// ommaviy sahifa oddiy odamga "topilmadi" deydi. Shuning uchun
// `PLAY_STORE_LIVE = false` ekan, "Google Play" tugmasi Play imzolagan
// APK sahifasiga (/ilova-yuklash) olib boradi; ilova Play'da hammaga
// chiqqan kuni shu bayroqni `true` qilish kifoya.
export const PLAY_STORE_LIVE = false;
export const PLAY_STORE_URL = APP_APK_URL;
// iPhone ilovasi hali yo'q — tugma "Tez kunda" bo'lib turadi.
export const APP_STORE_URL = '';

// Ro'yxatdan o'tgandan keyin BIR MARTA ko'rsatiladigan "ilovani yuklab
// oling" oynasi. Bayroq sessiyada turadi va oyna ko'ringach o'chadi.
const WELCOME_KEY = 'nfc_app_welcome';
export function markAppWelcome() {
  try { sessionStorage.setItem(WELCOME_KEY, '1'); } catch { /* private rejim */ }
}
export function hasAppWelcome() {
  try { return sessionStorage.getItem(WELCOME_KEY) === '1'; } catch { return false; }
}
export function clearAppWelcome() {
  try { sessionStorage.removeItem(WELCOME_KEY); } catch { /* private rejim */ }
}
