// KOD ISHLATADIGAN HAR BIR BINDING KONFIGURATSIYADA BO'LSIN.
//
// NIMA UCHUN BU TEST BOR — HAQIQIY XATODAN (2026-09-21).
//
// `wrangler.jsonc` dagi `assets` blokida `directory` va
// `not_found_handling` bor edi, `binding` esa YO'Q edi.
//
// Statik fayllar baribir xizmat qilinardi, shuning uchun sayt
// "ishlayotgandek" ko'rinardi. Lekin `binding` — Cloudflare
// sxemasidagi ta'rif bo'yicha "Name of `env` binding property in
// the User Worker" — ya'ni `env.ASSETS` ni AYNAN o'sha maydon
// yaratadi. U bo'lmagach `env.ASSETS` undefined bo'ldi va
// `hosting/worker.js` dagi to'rtta `env.ASSETS.fetch()` chaqiruvi
// "Cannot read properties of undefined (reading 'fetch')" bilan
// yiqildi.
//
// OQIBATI: bosh sahifadan boshqa HAR BIR yo'l 500 qaytardi —
// `/katalog`, `/login`, `/register` va ilovadagi ulashish havolasi
// `/KOD`. Bosh sahifa ishlardi, chunki u aniq statik faylga mos
// keladi va Worker'gacha yetib bormaydi. Odam saytda yurib ketsa
// sezmasdi (marshrutlash brauzerda), lekin ULASHILGAN HAVOLA va
// sahifani yangilash doim yiqilardi.
//
// Xato KONFIGURATSIYADA edi, kodda emas — shuning uchun birorta
// kod testi uni tutolmasdi. Bu test aynan o'sha bo'shliqni yopadi.
//
//   node scripts/test-worker-bindings.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = readFileSync(join(ROOT, 'hosting/worker.js'), 'utf8');
const RAW = readFileSync(join(ROOT, 'wrangler.jsonc'), 'utf8');

// JSONC — izohlar olib tashlanadi. Satr ichidagi `//` ga tegmaslik
// uchun faqat QATOR BOSHIDAGI izohlar kesiladi (bu faylda izohlar
// aynan shunday yozilgan).
const config = JSON.parse(RAW.replace(/^\s*\/\/.*$/gm, ''));

let pass = 0;
const fails = [];
const check = (label, ok) => { if (ok) pass++; else fails.push(label); };

// ── 1. Kod qaysi binding'larni ishlatadi ──────────────────────────
// `env.NOM.` shaklidagi har bir murojaat. Katta harf + pastki chiziq
// — binding nomlari shu shaklda yoziladi (`DB`, `UPLOADS`, `ASSETS`).
const used = new Set(
  [...SRC.matchAll(/\benv\.([A-Z][A-Z0-9_]*)\s*[.[]/g)].map((m) => m[1]),
);

// ── 2. Konfiguratsiya qaysilarini beradi ──────────────────────────
const declared = new Set();
if (config.assets?.binding) declared.add(config.assets.binding);
for (const d of config.d1_databases || []) if (d.binding) declared.add(d.binding);
for (const r of config.r2_buckets || []) if (r.binding) declared.add(r.binding);
for (const k of config.kv_namespaces || []) if (k.binding) declared.add(k.binding);
for (const q of config.queues?.producers || []) if (q.binding) declared.add(q.binding);
for (const s of config.services || []) if (s.binding) declared.add(s.binding);
for (const name of Object.keys(config.vars || {})) declared.add(name);

// ── 3. Solishtirish ───────────────────────────────────────────────
// `vars` va secretlar bu ro'yxatga kirmasligi mumkin (secretlar
// Dashboard'da turadi va ataylab bu faylda yozilmaydi), shuning
// uchun faqat `.fetch(` yoki `.prepare(` kabi OBYEKT sifatida
// ishlatilganlar tekshiriladi — ular albatta binding bo'lishi shart.
const objectUsed = new Set(
  [...SRC.matchAll(/\benv\.([A-Z][A-Z0-9_]*)\.(fetch|prepare|get|put|batch|exec|list|delete|send)\s*\(/g)]
    .map((m) => m[1]),
);

for (const name of objectUsed) {
  check(`env.${name} — wrangler.jsonc da e'lon qilingan`, declared.has(name));
}

check('kod kamida bitta binding ishlatadi (test tirik)', objectUsed.size > 0);
check('ASSETS binding bor', declared.has('ASSETS'));
check('DB binding bor', declared.has('DB'));
check('UPLOADS binding bor', declared.has('UPLOADS'));

console.log(`${pass} tekshiruv o'tdi.`);
console.log('Kod ishlatadi:', [...objectUsed].sort().join(', ') || '(yo’q)');
if (fails.length) {
  console.error('YIQILDI:\n  - ' + fails.join('\n  - '));
  console.error("\nBinding e'lon qilinmasa `env.NOM` undefined bo'ladi va");
  console.error('chaqiruv runtime’da yiqiladi — sayt 500 qaytaradi.');
  process.exit(1);
}
console.log("OK — kod ishlatadigan har bir binding e'lon qilingan.");
