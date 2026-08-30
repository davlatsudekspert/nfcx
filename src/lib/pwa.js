// PWA — service worker ro'yxatdan o'tkazish (PHASE 5 / Band 5.1).
// Faqat productionда (dev serverда SW keshi HMR'ni buzadi).

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (import.meta.env.DEV) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      // Yangi versiya tayyor bo'lsa — darhol ishga tushiramiz.
      reg.addEventListener('updatefound', () => {
        const sw = reg.installing;
        if (!sw) return;
        sw.addEventListener('statechange', () => {
          if (sw.state === 'installed' && navigator.serviceWorker.controller) {
            sw.postMessage('skip-waiting');
          }
        });
      });
    }).catch(() => {
      // SW ro'yxatdan o'tmasa — sayt oddiy holatда ishlayveradi.
    });
  });

  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
}

// "Bosh ekranga qo'shish" taklifini kuzatish — beforeinstallprompt hodisasi
// (Chrome/Android). Komponent shu orqali "O'rnatish" tugmasini ko'rsatadi.
let deferredPrompt = null;
const listeners = new Set();

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

export function canInstall() {
  return !!deferredPrompt;
}

export function onInstallableChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function promptInstall() {
  if (!deferredPrompt) return false;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  listeners.forEach((f) => f(false));
  return outcome === 'accepted';
}
