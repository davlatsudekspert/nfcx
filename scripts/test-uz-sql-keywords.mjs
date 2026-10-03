// O'zbekiston serveri (sqld) so'rovni o'z parseri bilan qayta yozadi:
// qo'shtirnoqsiz SQLite kalit so'zi bo'lgan nom KATTA harfga aylanadi —
// `... AS following` natijada `FOLLOWING` bo'lib, `row.following`
// undefined bo'lib qolgan (follow-stats har doim 0). Bu qo'riqchi hosting/
// dagi SQL'da shunday alias yoki ADD COLUMN nomi qolmaganini tekshiradi.
// To'g'ri yozuv: AS "following", ADD COLUMN "plan".
import { readFileSync, readdirSync } from 'node:fs';
import { stripComments } from './lib/strip-comments.mjs';
import { SQLITE_KEYWORDS } from './lib/hrana-fake.mjs';

const root = new URL('../hosting/', import.meta.url);
const files = ['worker.js', 'uz-store.js', ...readdirSync(new URL('api/', root)).filter((f) => f.endsWith('.js')).map((f) => `api/${f}`)];
const bad = [];
for (const f of files) {
  const src = stripComments(readFileSync(new URL(f, root), 'utf8'));
  for (const re of [/\bAS\s+([A-Za-z_][A-Za-z0-9_]*)\b/gi, /\bADD\s+COLUMN\s+([A-Za-z_][A-Za-z0-9_]*)\b/gi]) {
    for (const m of src.matchAll(re)) {
      if (SQLITE_KEYWORDS.has(m[1].toUpperCase())) bad.push(`hosting/${f}: «${m[0]}»`);
    }
  }
}
for (const b of bad) console.log('FAIL -', b, '— nomni qo‘shtirnoqqa oling');
console.log(bad.length ? `\n0 passed, ${bad.length} failed` : `PASS - ${files.length} fayl: qo'shtirnoqsiz kalit so'z nomi yo'q\n\n1 passed, 0 failed`);
if (bad.length) process.exit(1);
