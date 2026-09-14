// ILOVA CHAQIRADIGAN ENDPOINT SERVERDA BORMI.
//
// NIMA UCHUN BU TEST BOR — HAQIQIY XATODAN.
//
// Ilova `GET /api/feed` ni chaqirardi, server esa uni tanimasdi
// (marshrut tashqi ro'yxatga qo'shilmagan edi). Natijada Reels tabi
// birinchi kundan beri "Topilmadi" ko'rsatib keldi. Brauzerda
// sezilmasligi tabiiy: Reels faqat ilovada bor.
//
// Shu turdagi xatoni QUYI OQIMDAN ham ushlaymiz: ilova
// (`mobile/lib/data/repo.dart`) chaqirayotgan har bir yo'lni olib,
// server kodida unga mos ishlovchi bor-yo'qligini tekshiramiz.
//
//   node scripts/mobile-api-parity-test.mjs
//
// TEKSHIRUV YAKUNIY EMAS: matn bo'yicha ishlaydi, ya'ni "server bu
// yo'lni umuman bilmaydi" holatini ushlaydi, "bilsa ham noto'g'ri
// javob beradi" holatini emas. Aynan birinchisi Reels'ni sindirgan.

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// ── Server kodining hammasi ─────────────────────────────────────
const serverFiles = [
  join(ROOT, 'hosting/worker.js'),
  ...readdirSync(join(ROOT, 'hosting/api'))
    .filter((f) => f.endsWith('.js'))
    .map((f) => join(ROOT, 'hosting/api', f)),
];
const SERVER = serverFiles.map((f) => readFileSync(f, 'utf8')).join('\n');

// ── Ilova chaqiradigan yo'llar ──────────────────────────────────
const REPO = readFileSync(join(ROOT, 'mobile/lib/data/repo.dart'), 'utf8');

const calls = new Set();
for (const m of REPO.matchAll(/api\.(?:get|post|put|delete|upload)\(\s*'(\/api\/[^']*)'/g)) {
  calls.add(m[1]);
}
if (calls.size < 40) {
  throw new Error(`repo.dart dan atigi ${calls.size} chaqiruv topildi — ajratish buzilgan.`);
}

// Dart interpolatsiyasi (`$code`, `${id}`) — serverda u regex yoki
// boshqa shaklda turadi, ya'ni butun yo'lni matn bilan solishtirib
// bo'lmaydi. Shuning uchun BIRINCHI o'zgaruvchigacha bo'lgan
// o'zgarmas qismni olamiz: `/api/follow-list/$code` -> `/api/follow-list`.
const literalPrefix = (path) => {
  const i = path.indexOf('$');
  const head = i < 0 ? path : path.slice(0, i);
  return head.replace(/\/+$/, '');
};

// Server kodida yo'l ikki ko'rinishda uchraydi:
//   'api/records/...'         — oddiy satr
//   /^\/api\/records\/...$/  — regex, slashlari ekranlangan
// Ikkalasini ham tekshiramiz.
function serverKnows(path) {
  const prefix = literalPrefix(path);
  if (!prefix || prefix === '/api') return true;
  return SERVER.includes(prefix) || SERVER.includes(prefix.replace(/\//g, '\\/'));
}

const unknown = [...calls].filter((p) => !serverKnows(p)).sort();

if (unknown.length) {
  console.error('\nILOVA CHAQIRADI, LEKIN SERVER KODIDA TOPILMADI:\n');
  for (const p of unknown) console.error(`  ${p}`);
  console.error(
    '\nYo\'l serverda bormi tekshiring. Yo\'q bo\'lsa — ilova bu\n'
    + 'chaqiruvda {"error":"not_found"} oladi va ekran bo\'sh qoladi.\n',
  );
  process.exit(1);
}

console.log(`OK — ilova chaqiradigan ${calls.size} ta yo'lning hammasi server kodida bor.`);
