// SAYT BELGISI (favicon) VA UNING KESHI.
//
// Egasining shikoyati: "Yandex brauzerda saqlashda hali ham eski logo
// turibdi". Sabab bitta emas, ikkita edi:
//
//   1) Brauzerlar favicon'ni juda uzoq eslab qoladi va fayl o'zgarsa ham
//      MANZIL o'zgarmagani uchun eskisini ko'rsatishda davom etadi.
//   2) Service worker eski nusxani o'zi keshlab, `stale-while-revalidate`
//      bilan avval o'shani qaytarardi — kesh nomi (VERSION) esa
//      o'zgarmagani uchun u hech qachon tozalanmasdi.
//
// Yechim: manzillarda `?v=N` va sw.js dagi VERSION birga oshiriladi.
// Ular BIR-BIRIGA MOS bo'lishi shart — kesh to'liq manzil bo'yicha
// qidiriladi, ya'ni bittasi unutilsa xususiyat jimgina buziladi. Shu
// test aynan o'sha mosliklarni qo'riqlaydi.
//
//   node scripts/test-icons-cache.mjs
import { readFileSync, existsSync } from 'node:fs';
import { makeChecker } from './lib/d1-harness.mjs';

const { check, checkTrue, done } = makeChecker();
const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

const html = read('index.html');
const sw = read('public/sw.js');
const manifest = JSON.parse(read('public/manifest.webmanifest'));

// ── 1) Fayllarning o'zi bor ──────────────────────────────────────────
// `/favicon.ico` ni brauzer sahifadagi teglardan QAT'I NAZAR o'zi
// so'raydi (xatcho'p, tarix, yorliq). U bo'lmasa SPA qoidasi bo'yicha
// index.html qaytardi va brauzer rasmni ololmasdi.
for (const f of ['public/favicon.ico', 'public/favicon.png', 'public/apple-touch-icon.png',
  'public/logo-192.png', 'public/logo-512.png', 'public/icon-maskable-192.png', 'public/icon-maskable-512.png']) {
  checkTrue(`1) ${f} mavjud`, existsSync(new URL('../' + f, import.meta.url)));
}

// ── 2) index.html dagi versiya bitta va aniq ─────────────────────────
const htmlIcons = [...html.matchAll(/<link[^>]*rel="(?:shortcut )?(?:icon|apple-touch-icon|manifest)"[^>]*href="([^"]+)"/g)].map((m) => m[1]);
checkTrue('2) icon/manifest havolalari topildi', htmlIcons.length >= 4);
const versions = new Set(htmlIcons.map((h) => (h.match(/\?v=(\d+)/) || [])[1]));
check('2) hammasida bitta xil ?v=', versions.size, 1);
const V = [...versions][0];
checkTrue('2) ?v= raqam', /^\d+$/.test(V || ''));
checkTrue('2) favicon.ico ham bor', htmlIcons.some((h) => h.startsWith('/favicon.ico?v=')));
checkTrue('2) apple-touch-icon ham bor', htmlIcons.some((h) => h.startsWith('/apple-touch-icon.png?v=')));

// ── 3) manifest ikonkalari ham o'sha versiyada ───────────────────────
checkTrue('3) manifestda 4 ta ikonka', manifest.icons.length === 4);
checkTrue('3) hammasi ?v= bilan va bir xil', manifest.icons.every((i) => i.src.endsWith(`?v=${V}`)));
checkTrue('3) maskable variant bor', manifest.icons.some((i) => i.purpose === 'maskable'));

// ── 4) Service worker versiyasi mos ──────────────────────────────────
// Bu eng oson unutiladigan joy: manzil yangilanib, VERSION eski qolsa
// eski kesh o'chirilmaydi va odam baribir eski logotipni ko'raveradi.
const swVersion = (sw.match(/const VERSION = 'v(\d+)'/) || [])[1];
check('4) sw.js VERSION = index.html ?v=', swVersion, V);
// SHELL ro'yxatidagi manzillar ham aynan o'sha versiyada bo'lsin —
// kesh TO'LIQ manzil bo'yicha qidiriladi.
const shell = (sw.match(/const SHELL = \[([\s\S]*?)\];/) || [])[1] || '';
const shellUrls = [...shell.matchAll(/'([^']+)'/g)].map((m) => m[1]);
checkTrue('4) SHELL da hamma ikonka bor', ['/favicon.ico', '/favicon.png', '/apple-touch-icon.png', '/logo-192.png', '/logo-512.png', '/manifest.webmanifest']
  .every((f) => shellUrls.includes(`${f}?v=${V}`)));
checkTrue('4) SHELL da versiyasiz ikonka qolmagan', shellUrls.every((u) => u === '/' || /\?v=\d+$/.test(u)));

done();
