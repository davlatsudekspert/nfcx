// WORKER YIQILSA — SABAB KO'RINISHI SHART.
//
// NIMA UCHUN BU TEST BOR — HAQIQIY XATODAN.
//
// `export default { fetch }` ichida `handleRequest` HIMOYASIZ
// chaqirilardi. Undagi istalgan istisno Workers runtime'ga chiqib
// ketar va u BO'SH TANALI 500 qaytarardi: na sabab, na yo'l, na iz.
//
// Aynan shu tufayli ilovadagi ulashish havolasi
// (`nfcstore.uz/KOD`) 500 berayotgani bir necha kun sababsiz
// qoldi: javob tanasi bo'sh, mahalliy harness'da esa o'sha yo'l
// umuman yiqilmaydi. Ya'ni sabab faqat production'da ko'rinardi,
// uni ko'rsatadigan joy esa yo'q edi.
//
// Bu test tutqich JOYIDA turganini qotiradi. U xatoni yashirish
// uchun emas — aksincha, uni KO'RINADIGAN qilish uchun.
//
//   node scripts/test-worker-error-visibility.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = readFileSync(join(ROOT, 'hosting/worker.js'), 'utf8');

let pass = 0;
const fails = [];
const check = (label, ok) => { if (ok) pass++; else fails.push(label); };

// `fetch` ning butun tanasi.
//
// LANGAR QATOR BOSHIDAN OLINADI. Oddiy `indexOf('export default {')`
// bu faylda IZOHNI topadi — 5061-qatorda aynan shu matn izoh ichida
// yozilgan. Test birinchi urinishda o'sha izohni "kod" deb o'qib,
// hammasini yiqitdi. Shuning uchun langar qator boshida turishi
// shart.
const start = SRC.search(/^export default \{/m);
if (start < 0) throw new Error('`export default` bloki topilmadi — test eskirgan.');
const body = SRC.slice(start, SRC.indexOf('\n};', start));

check('fetch ichida try bor', /\btry\s*\{/.test(body));
check('fetch ichida catch bor', /\bcatch\s*\(/.test(body));
check('handleRequest try ICHIDA chaqiriladi',
  body.indexOf('try') < body.indexOf('handleRequest('));
check('xato log’ga yoziladi', /console\.error\(/.test(body));
check('javobda sabab beriladi', /detail/.test(body));
check('status 500 bo’lib qoladi', /500/.test(body));

// XATO YUTILMASLIGI KERAK: `catch` ichida muvaffaqiyat qaytarilsa,
// yiqilish "hammasi joyida" bo'lib ko'rinardi — bu tutqichsiz
// holatdan ham yomon.
//
// Tekshiruv AYNAN STATUS argumentiga qaraydi. Birinchi yozganimda
// shunchaki "200 raqami bormi" deb qaragandim va test yiqildi:
// `catch` ichida `slice(0, 200)` bor — u xabarni qisqartirish
// uzunligi, status emas. Ya'ni test o'zining noaniqligidan
// yiqilgan edi.
const catchBody = body.slice(body.indexOf('catch ('));
// AYNAN `json(...)` chaqiruvining oxirgi argumenti. Umumiy "uch
// xonali raqam" qidiruvi ikki marta yanglishdi: `slice(0, 200)`
// ham unga mos kelardi.
const statuses = [...catchBody.matchAll(/\bjson\([^;]*?,\s*(\d{3})\s*\)/g)].map((m) => m[1]);
check('catch faqat 5xx qaytaradi', statuses.length > 0 && statuses.every((c) => c.startsWith('5')));

// Tutqich `withSecurityHeaders` dan o'tishi kerak — aks holda xato
// javobi boshqa javoblardan farqli header'lar bilan chiqardi.
check('xato javobi ham xavfsizlik header’laridan o’tadi',
  /withSecurityHeaders\(/.test(catchBody));

console.log(`${pass} tekshiruv o'tdi.`);
if (fails.length) {
  console.error('YIQILDI:\n  - ' + fails.join('\n  - '));
  process.exit(1);
}
console.log("OK — worker yiqilsa sabab ko'rinadi.");
