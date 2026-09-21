// NOVA ILOVASI CHAQIRADIGAN HAR BIR ENDPOINT SERVERDA BORMI.
//
//   node scripts/test-nova-api-parity.mjs
//
// ── NIMA UCHUN BU TEST BOR ────────────────────────────────────────
//
// `scripts/mobile-api-parity-test.mjs` allaqachon bor edi, lekin u
// faqat ESKI ilovani (`mobile/lib/data/repo.dart`) skanerlaydi.
// Nova (`mobile_nova/`) ning yetmishdan ortiq endpointi HECH QANDAY
// qo'riqchi ostida emas edi.
//
// Bu aynan `/api/feed` bilan bo'lgan xatoning takrorlanishiga ochiq
// eshik: marshrut serverda ro'yxatga qo'shilmay qolsa, ilovadagi
// butun bir bo'lim birinchi kundan beri bo'sh turaverardi va
// brauzerda sezilmasdi.
//
// ── MATN TAQQOSLASH EMAS, HAQIQIY SO'ROV ─────────────────────────
//
// Eski qo'riqchi matn bo'yicha ishlaydi va o'zi ham "yakuniy emas"
// deb yozib qo'ygan. Bu yerda boshqacha: HAQIQIY `hosting/worker.js`
// xotiradagi SQLite ustida ishga tushiriladi va har bir yo'lga
// ROSTDAN so'rov yuboriladi.
//
// "Marshrut yo'q" ning ANIQ belgisi bor. Worker tanimagan
// `/api/...` yo'l uchun oxirida shunday qaytaradi:
//
//     json({ error: 'not_found', path: url.pathname }, 404)
//
// Ya'ni javobda `path` maydoni BOR. Ishlovchi topilgan, lekin
// resurs yo'q bo'lganda esa (masalan yo'q kod uchun
// `/api/records/ZZZ`) oddiy `{error:'not_found'}` qaytadi —
// `path` siz. Shu farq bilan ikkisi aniq ajratiladi.
//
// Production D1/R2 ga TEGMAYDI.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import worker from '../hosting/worker.js';
import { makeEnv, seedBasic, req, cookie, makeChecker } from './lib/d1-harness.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const APP = join(ROOT, 'mobile_nova/lib');

// ── 1. Ilova kodidagi barcha `/api/...` satrlari ─────────────────
function dartFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...dartFiles(p));
    else if (name.endsWith('.dart')) out.push(p);
  }
  return out;
}

const files = dartFiles(APP);
if (files.length < 50) {
  throw new Error(`mobile_nova/lib da atigi ${files.length} dart fayl topildi — yo'l noto'g'ri`);
}

// YO'L BILAN BIRGA USUL ham olinadi.
//
// Marshrutlash bu kodbazada yo'lga QARAB EMAS: ishlovchilar
// `request.method` ni O'ZLARI tekshiradi va mos kelmasa `null`
// qaytaradi. Ya'ni `/api/posts/1/like` ga GET yuborilsa, u
// tanilmagan yo'l bilan BIR XIL 404 beradi.
//
// Shuning uchun har bir chaqiruv ilova ishlatadigan AYNAN o'sha
// usul bilan sinaladi. Yon foyda: usul mos kelmasligi ham shu
// yerda tutiladi.
const raw = new Map(); // "METHOD /path" -> {method, path}
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  // `[^(]*` tur argumentlarini (`<Map<String, dynamic>>`) qamrab
  // oladi: ularning ichida qavs yo'q.
  for (const m of src.matchAll(
    /_api\.(get|post|put|patch|delete|upload)[^(]*\(\s*'(\/api\/[^']*)'/g,
  )) {
    const method = m[1] === 'upload' ? 'POST' : m[1].toUpperCase();
    raw.set(`${method} ${m[2]}`, { method, path: m[2] });
  }
}
if (raw.size < 50) {
  throw new Error(`ilovadan atigi ${raw.size} chaqiruv topildi — ajratish buzilgan`);
}

// ── 2. Dart interpolyatsiyasini NAMUNA qiymatga almashtirish ─────
//
// `'/api/records/$code/posts'` -> `/api/records/VIP001/posts`.
// Qiymatlar seed ma'lumotiga mos: aks holda ishlovchi topilsa ham
// 404 qaytarib, test uni "marshrut yo'q" deb o'qib qolardi.
const SAMPLES = {
  code: 'VIP001', commentId: '1', companyId: 'nova', itemId: '1',
  id: '1', orderId: '1', kind: 'post', chipToken: 'abc123',
  page: '1', slotId: '1',
  // `$q` — TAYYOR so'rov qatori (`?cursor=5`), yo'lning qismi emas.
  // `activity_repository.dart` uni bo'sh satr qilib ham yuboradi,
  // shuning uchun bu yerda ham bo'sh.
  q: '',
};

// `${...}` ichidagi murakkab ifodalar uchun AYNAN qiymatlar.
//
// Namuna qiymat "x" bo'lsa, `/api/records/VIP001/x` kabi yo'l
// chiqadi va server uni tanimaydi — test esa buni "endpoint yo'q"
// deb o'qib, YOLG'ON xato berardi. Shuning uchun har bir ifoda
// uchun uning HAQIQIY qiymati yoziladi.
const EXPRESSIONS = new Map([
  // `CatalogKind` enumi: products | services | menu
  // (`business_repository.dart`). Bittasi yetadi — uchalasi ham
  // bitta ishlovchiga boradi.
  ['kind.path', 'products'],
]);

function concrete(path) {
  return path
    .replace(/\$\{([^}]*)\}/g, (_, expr) => {
      const key = expr.trim();
      if (EXPRESSIONS.has(key)) return EXPRESSIONS.get(key);
      throw new Error(
        `Yo'lda tanilmagan ifoda: \${${key}} (${path}).\n` +
        `Uning haqiqiy qiymatini \`EXPRESSIONS\` ga qo'shing — ` +
        `aks holda qo'riqchi mavjud endpointni "yo'q" deb ko'rsatadi.`,
      );
    })
    .replace(/\$([A-Za-z_][A-Za-z0-9_]*)/g, (_, name) => {
      if (name in SAMPLES) return SAMPLES[name];
      throw new Error(
        `Yo'lda tanilmagan o'zgaruvchi: $${name} (${path}).\n` +
        `Namuna qiymatini \`SAMPLES\` ga qo'shing.`,
      );
    });
}

// ── 3. Sinovdan TASHQARIDA qoladiganlar ──────────────────────────
//
// Har biri uchun SABAB yozilgan. Sababsiz istisno — qo'riqchini
// asta-sekin bo'shatib yuborishning boshlanishi.
const SKIP = new Map([
  // To'lov provayderlari SO'ROVNI O'ZLARI yuboradi; ilova bu
  // yo'llarni faqat havola qurish uchun biladi. Ular Basic auth
  // va imzo talab qiladi — bu yerda tekshirish mumkin emas.
  ['/api/pay/payme', 'Payme merchant callback — Basic auth talab qiladi'],
  ['/api/pay/click/prepare', 'Click callback — imzo talab qiladi'],
  ['/api/pay/paynet/webhook', 'Paynet callback — imzo talab qiladi'],
]);

const calls = [...raw.values()]
  .map(({ method, path }) => ({ method, path: concrete(path) }))
  .filter((c) => /^\/api\/[a-zA-Z0-9]/.test(c.path))
  .filter((c) => !SKIP.has(c.path));

// ── 4. Haqiqiy worker ustida sinash ──────────────────────────────
const { env } = makeEnv({
  PAYMENTS_ENABLED: 'true',
  PAYME_MERCHANT_ID: 'test_merchant_local_only',
  PAYME_KEY: 'test_payme_key_local_only',
});
await seedBasic(env);
const { check, checkTrue, done } = makeChecker();

// Seed ustiga sinov uchun kerak bo'ladigan bir nechta yozuv.
await env.DB.prepare(
  `INSERT INTO posts (id, code, user_id, caption, created_at)
   VALUES (1, 'VIP001', 1, 'post', '2026-01-01 00:00:00')`
).run().catch(() => {});
await env.DB.prepare(
  `INSERT INTO stories (id, owner_id, owner_kind, caption, created_at, expires_at)
   VALUES (1, 'VIP001', 'card', 's', '2026-01-01 00:00:00', '2099-01-01 00:00:00')`
).run().catch(() => {});

const missing = [];
const crashed = [];

for (const { method, path } of calls) {
  // Ishlovchi topilgach 401/403/409/422 berishi mumkin — bularning
  // HAMMASI "marshrut BOR" degani. Tekshirilayotgani bitta narsa:
  // so'rov ishlovchiga YETIB BORDIMI.
  let res;
  try {
    res = await worker.fetch(
      req(path, { method, cookie: cookie.user, json: method === 'GET' ? undefined : {} }),
      env,
    );
  } catch (e) {
    crashed.push(`${method} ${path} — ${e?.message || e}`);
    continue;
  }

  const body = await res.json().catch(() => null);

  // Worker tanimagan yo'l: 404 VA javobda `path` bor.
  if (res.status === 404 && body && typeof body === 'object' && 'path' in body) {
    missing.push(`${method} ${path}`);
    continue;
  }
  // 5xx — ishlovchi bor, lekin yiqildi. Bu ham xato.
  if (res.status >= 500) {
    crashed.push(`${method} ${path} — HTTP ${res.status} ${JSON.stringify(body)?.slice(0, 120)}`);
  }
}

// ── 5. Natija ────────────────────────────────────────────────────
console.log(`Tekshirilgan chaqiruvlar: ${calls.length} ta`);
checkTrue('ilovadan yetarlicha chaqiruv topildi', calls.length >= 50);

if (missing.length) {
  console.log('\nSERVER TANIMAYDIGAN YO‘LLAR:');
  for (const p of missing) console.log(`  ${p}`);
}
check('serverda yo‘q endpoint soni', missing.length, 0);

if (crashed.length) {
  console.log('\nYIQILGAN YO‘LLAR:');
  for (const p of crashed) console.log(`  ${p}`);
}
check('yiqilgan endpoint soni', crashed.length, 0);

// ── 6. ESKIRGAN SAYT NUSXASI QO'RIQCHISI ─────────────────────────
//
// Bu branch `hosting/` ning O'Z nusxasini olib yuradi. Agar u
// eskirsa, yuqoridagi tekshiruv YOLG'ON yashil bo'lardi: ilova
// mavjud endpointga murojaat qiladi, qo'riqchi esa eski worker
// ustida sinab "bor" deb aytadi.
//
// Undan ham yomoni: shu branchdan deploy qilinsa, sayt eski
// holatga qaytarilardi. 2026-09 da `wrangler.jsonc` dagi
// `ASSETS` binding shu tarzda yo'qolib, bosh sahifadan boshqa
// HAMMA yo'l 500 bergan edi.
const wrangler = readFileSync(join(ROOT, 'wrangler.jsonc'), 'utf8');
checkTrue('wrangler.jsonc da `ASSETS` binding bor',
  /"binding"\s*:\s*"ASSETS"/.test(wrangler));

// Sayt modullari to'liq turibdimi.
const apiDir = join(ROOT, 'hosting/api');
const mods = readdirSync(apiDir).filter((f) => f.endsWith('.js'));
for (const need of ['marketplace.js', 'notifications.js', 'featured.js', 'comments.js', 'auth.js']) {
  checkTrue(`hosting/api/${need} mavjud`, mods.includes(need));
}

done('Nova API parity');
