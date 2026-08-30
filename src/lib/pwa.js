// PWA — service worker ro'yxatdan o'tkazish (PHASE 5 / Band 5.1).
// Faqat productionда (dev serverда SW keshi HMR'ni buzadi).

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (import.meta.env.DEV) return;

  // Sahifa yuklanganда SW nazoratда bo'lganmi — shu holатда keyingi
  // "controllerchange" YANGILANISH demak (dastlabki claim emas).
  const hadController = !!navigator.serviceWorker.controller;
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing || !hadController) return;
    refreshing = true;
    window.location.reload();
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      reg.addEventListener('updatefound', () => {
        const sw = reg.installing;
        if (!sw) return;
        sw.addEventListener('statechange', () => {
          // Faqat MAVJUD SW ustidan yangi versiya kelganда darhol almashtiramiz.
          if (sw.state === 'installed' && navigator.serviceWorker.controller) {
            sw.postMessage('skip-waiting');
          }
        });
      });
    }).catch(() => {
      // SW ro'yxatdan o'tmasa — sayt oddiy holatда ishlayveradi.
    });
  });
}

// "Bosh ekranga qo'shish" — Chrome/Android'да beforeinstallprompt hodisasi;
// iOS Safari'да esa bunday API YO'Q, foydalanuvchi qo'lda "Ulashish → Bosh
// ekranga qo'shish" qiladi (bu holатда tugma qo'llanma ko'rsatadi).
let deferredPrompt = null;
const listeners = new Set();

const isStandalone = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true);

export const isIOS = () =>
  typeof navigator !== 'undefined' &&
  /iphone|ipad|ipod/i.test(navigator.userAgent) &&
  !/crios|fxios/i.test(navigator.userAgent); // faqat Safari

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    listeners.forEach((fn) => fn(true));
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    listeners.forEach((fn) => fn(false));
  });
}

// Tugmani ko'rsatish kerakmi: Chrome taklifi bor, YOKI iOS Safari (qo'lda),
// va ilova hali o'rnatilmagan bo'lsa.
export function canInstall() {
  if (isStandalone()) return false;
  return !!deferredPrompt || isIOS();
}

export function onInstallableChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Chrome — tizim taklifini ochadi. iOS — qo'llanma matnini qaytaradi
// ('ios-instructions'), chunki dasturiy o'rnatish imkoni yo'q.
export async function promptInstall() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;
    listeners.forEach((f) => f(false));
    return outcome === 'accepted' ? 'installed' : 'dismissed';
  }
  if (isIOS()) return 'ios-instructions';
  return 'unavailable';
}
