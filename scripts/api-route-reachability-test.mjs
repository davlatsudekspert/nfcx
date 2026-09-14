// API marshruti HAQIQATAN yetib boradimi.
//
// NIMA UCHUN BU TEST BOR — HAQIQIY XATODAN.
//
// `hosting/worker.js` da marshrutlash IKKI QAVAT:
//
//   1. `fetch()` ichidagi katta `if (...)` — qaysi yo'llar uchun
//      `coreApi()` UMUMAN chaqirilishini hal qiladi;
//   2. `coreApi()` ichidagi `if (url.pathname === '/api/...')` lar —
//      qaysi ishlovchiga berishni hal qiladi.
//
// 2026-09 da `GET /api/feed` ikkinchi qavatga yozildi, BIRINCHISIGA
// esa qo'shilmadi. Natijada so'rov `coreApi()` ga yetib bormasdi va
// pastdagi umumiy tutqich `{"error":"not_found"}` qaytarardi.
// Ilovadagi Reels tabi shu sababli birinchi kundan beri bo'sh
// "Topilmadi" ekranini ko'rsatib keldi — brauzerda sinab bo'lmasdi,
// chunki Reels faqat ilovada bor.
//
// Xatoning butun tabiati shunda: ikkinchi qavatdagi kod TO'G'RI
// ko'rinadi va uni o'qib turib muammoni sezish qiyin. Shuning uchun
// tekshiruv mashinaga topshirildi.
//
//   node scripts/api-route-reachability-test.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = readFileSync(join(ROOT, 'hosting/worker.js'), 'utf8');

// ── 1. Tashqi darvoza sharti ─────────────────────────────────────
// `coreApi()` ni chaqiradigan `if (...)` ning ichi.
// ANIQ LANGAR: `coreApi()` ning O'ZIDA ham
// `startsWith('/api/auth/')` bor, shuning uchun qisqa qidiruv
// noto'g'ri joyni topardi. Ikkinchi shart bilan birga qidiramiz.
const GATE_ANCHOR = "if (url.pathname.startsWith('/api/auth/') || url.pathname.startsWith('/api/records')";
const gateStart = SRC.indexOf(GATE_ANCHOR);
if (gateStart < 0) throw new Error('coreApi darvozasi topilmadi — test eskirgan.');
const gateEnd = SRC.indexOf(') {', gateStart);
const condition = SRC.slice(gateStart + 'if ('.length, gateEnd);

// Shartni AYNAN o'zini ishlatamiz: qayta yozsak, test tekshirayotgan
// narsadan boshqa narsani tekshirib qolardi.
const gate = new Function('url', `return (${condition});`);

// ── 2. `coreApi()` ichida qanday yo'llar kutilyapti ──────────────
const coreStart = SRC.indexOf('async function coreApi(request, env, url) {');
if (coreStart < 0) throw new Error('coreApi() topilmadi — test eskirgan.');
// Funksiya oxiri — keyingi yuqori darajadagi e'lon.
const coreEnd = SRC.indexOf('\nexport default', coreStart) > 0
  ? SRC.indexOf('\nexport default', coreStart)
  : SRC.length;
const core = SRC.slice(coreStart, coreEnd);

const expected = new Set();
for (const m of core.matchAll(/url\.pathname === '(\/api\/[^']*)'/g)) expected.add(m[1]);
for (const m of core.matchAll(/url\.pathname\.startsWith\('(\/api\/[^']*)'\)/g)) {
  // Prefiks uchun namuna yo'l: ostida biror narsa bor deb faraz.
  expected.add(`${m[1]}${m[1].endsWith('/') ? 'x' : '/x'}`);
}

if (expected.size < 5) {
  throw new Error(`coreApi() dan atigi ${expected.size} yo'l topildi — ajratish buzilgan.`);
}

// ── 3. Har biri darvozadan o'tadimi ─────────────────────────────
const unreachable = [];
for (const pathname of [...expected].sort()) {
  let ok = false;
  try {
    ok = !!gate({ pathname });
  } catch (err) {
    throw new Error(`Darvoza sharti bajarilmadi (${pathname}): ${err.message}`);
  }
  if (!ok) unreachable.push(pathname);
}

if (unreachable.length) {
  console.error('\nQUYIDAGI MARSHRUTLAR coreApi() GA YETIB BORMAYDI:\n');
  for (const p of unreachable) console.error(`  ${p}`);
  console.error(
    '\nhosting/worker.js dagi `coreApi()` ni chaqiradigan `if (...)`\n'
    + 'shartiga shu yo\'llarni qo\'shing. Aks holda so\'rov umumiy\n'
    + 'tutqichga tushib, {"error":"not_found"} qaytaradi.\n',
  );
  process.exit(1);
}

console.log(`OK — coreApi() dagi ${expected.size} ta marshrutning hammasi yetib boradi.`);
