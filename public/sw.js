/* NFCSTORE — minimal service worker (PHASE 5 / Band 5.1).
 *
 * Maqsad: "Bosh ekranga qo'shish" (installable PWA) + qayta ochilganda tez
 * yuklanish. Murakkab offline rejim YO'Q — API doim tarmoqdan.
 *
 * Strategiya:
 *   - /api/*            → faqat tarmoq (hech qachon keshlanmaydi)
 *   - /assets/* (hashli) → cache-first (fayl nomi o'zgarmas)
 *   - navigatsiya (HTML) → network-first, tarmoq yo'q bo'lsa keshdagi '/'
 *   - qolgan same-origin GET → stale-while-revalidate
 */
const VERSION = 'v1';
const SHELL_CACHE = `nfcstore-shell-${VERSION}`;
const RUNTIME_CACHE = `nfcstore-rt-${VERSION}`;
const SHELL = ['/', '/logo-192.png', '/logo-512.png', '/favicon.png', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== SHELL_CACHE && k !== RUNTIME_CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // API — hech qachon keshlanmaydi, faqat tarmoq.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/uploads/')) return;

  // Hashli statik assetlar — o'zgarmas, cache-first.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then((hit) => hit || fetch(request).then((res) => {
        const copy = res.clone();
        caches.open(RUNTIME_CACHE).then((c) => c.put(request, copy));
        return res;
      }))
    );
    return;
  }

  // Navigatsiya (sahifa yuklash) — network-first, tarmoqsiz bo'lsa '/'.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/', { ignoreSearch: true }))
    );
    return;
  }

  // Qolgani (rasm, font va h.k.) — stale-while-revalidate.
  event.respondWith(
    caches.match(request).then((hit) => {
      const net = fetch(request).then((res) => {
        const copy = res.clone();
        caches.open(RUNTIME_CACHE).then((c) => c.put(request, copy));
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
