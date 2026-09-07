// Kompaniya ID qoidalari — src/lib/company.js va hosting/worker.js
// PARITETI + o'zbekcha O'/G' harflari.
//
// Worker `src/` dan import qila olmaydi (build guard), shuning uchun
// normalizatsiya mantig'i ikki joyda takrorlangan. Bu test ularni bir xil
// kirishlarda solishtiradi: biri o'zgarib, ikkinchisi qolib ketsa —
// masalan frontend "g'oya" ni qabul qilib, backend rad etsa — shu yerda
// yiqiladi.
//
//   node scripts/test-company-id.mjs
import { normalizeCompanyId, companyIdLetters, companyIdLocalInfo, COMPANY_TIERS } from '../src/lib/company.js';
import { companyId as workerCompanyId, normalizeCompanyIdD1, companyIdLettersD1, companyPricing } from '../hosting/worker.js';

let pass = 0;
let fail = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(ok ? 'PASS' : 'FAIL', '-', label, ok ? '' : `\n    actual:   ${JSON.stringify(actual)}\n    expected: ${JSON.stringify(expected)}`);
  ok ? pass++ : fail++;
}
function checkTrue(label, value) { check(label, !!value, true); }

// ── 1) Normalizatsiya ──────────────────────────────────────────────────
const NORM = [
  // [kirish, kutilgan kanonik shakl]
  ["g'oya", "G'OYA"],
  ['gʻoya', "G'OYA"],          // rasmiy o'zbek belgisi U+02BB
  ['g‘oya', "G'OYA"],          // chap qo'shtirnoq U+2018
  ['g’oya', "G'OYA"],          // o'ng qo'shtirnoq U+2019
  ['g`oya', "G'OYA"],          // teskari apostrof
  ['g´oya', "G'OYA"],          // akut
  ["o'zbek", "O'ZBEK"],
  ["O'ZBEK", "O'ZBEK"],
  ['GOYA', 'GOYA'],
  ["  g'oya  ", "G'OYA"],
  // Apostrof faqat O/G dan keyin
  ["'abc", 'ABC'],
  ["ab'c", 'ABC'],
  ["abc'", 'ABC'],
  ["go''ya", "GO'YA"],
  // Harf bo'lmaganlar tashlanadi
  ['g o y a', 'GOYA'],
  ['g-o-y-a', 'GOYA'],
  ['goya123', 'GOYA'],
  // 15 HARF chegarasi (apostroflar sanalmaydi)
  ['abcdefghijklmnopqrst', 'ABCDEFGHIJKLMNO'],
  ["o'o'o'o'o'o'o'o'o'o'o'o'o'o'o'o'o'o'", "O'O'O'O'O'O'O'O'O'O'O'O'O'O'O'"],
];
for (const [input, expected] of NORM) {
  check(`1) normalize ${JSON.stringify(input)}`, normalizeCompanyId(input), expected);
  check(`1p) parite ${JSON.stringify(input)}`, normalizeCompanyIdD1(input), normalizeCompanyId(input));
}

// ── 2) Harflar soni: O' va G' — BITTA harf ─────────────────────────────
check("2) G'OYA — 4 harf", companyIdLetters("G'OYA"), 4);
check("2b) O'ZBEK — 5 harf", companyIdLetters("O'ZBEK"), 5);
check('2c) GOYA — 4 harf', companyIdLetters('GOYA'), 4);
check("2d) parite: G'OYA", companyIdLettersD1("G'OYA"), companyIdLetters("G'OYA"));

// ── 3) Yaroqlilik ──────────────────────────────────────────────────────
const VALID = ["G'OYA", "O'ZBEK", 'GOYA', "G'O'G'", "OSH", "O'O'O'"];
for (const id of VALID) {
  checkTrue(`3) yaroqli: ${id}`, companyIdLocalInfo(id).valid);
  check(`3p) worker ham qabul qiladi: ${id}`, workerCompanyId(id), id);
}
const INVALID = ['AB', 'A', '', "O'", "'", "''", '123', 'ABCDEFGHIJKLMNOP!'];
for (const id of INVALID) {
  const info = companyIdLocalInfo(id);
  // 'ABCDEFGHIJKLMNOP!' 15 harfga kesiladi va YAROQLI bo'lib qoladi —
  // bu ataylab: ortiqcha belgi xato emas, shunchaki tashlanadi.
  if (id === 'ABCDEFGHIJKLMNOP!') {
    check('3x) 16-harf kesiladi', info.companyId, 'ABCDEFGHIJKLMNO');
    checkTrue('3x) kesilgandan keyin yaroqli', info.valid);
    continue;
  }
  check(`3) yaroqsiz: ${JSON.stringify(id)}`, info.valid, false);
  check(`3p) worker ham rad etadi: ${JSON.stringify(id)}`, workerCompanyId(id), '');
}

// ── 4) NARX HARFLAR bo'yicha, belgilar bo'yicha EMAS ───────────────────
// Bu eng muhim tekshiruv: "G'OYA" 5 ta BELGI, lekin 4 ta HARF. Belgilar
// sanalsa premium (749 000) o'rniga ham premium chiqib qolardi, lekin
// 6 harfli "O'ZBEKI" (7 belgi) gold o'rniga silver'ga tushib ketardi —
// ya'ni apostrofli nomlar arzonlashib ketardi.
const PRICE = [
  ["G'OYA", 'premium'],      // 4 harf
  ['GOYA', 'premium'],       // 4 harf — apostrofsiz teng
  ["O'ZBEKI", 'gold'],       // 6 harf (7 belgi)
  ['OZBEKI', 'gold'],        // 6 harf
  ["O'SH", 'exclusive'],     // 3 harf (4 belgi)
  ['OSH', 'exclusive'],      // 3 harf
  ["O'ZBEKIST", 'silver'],   // 8 harf
];
for (const [id, tier] of PRICE) {
  check(`4) ${id} -> ${tier}`, companyIdLocalInfo(id).tier, tier);
  check(`4p) worker narxi ${id}`, companyPricing(id, null), { tier, price: COMPANY_TIERS[tier].price });
}
check("4x) G'OYA va GOYA narxi teng", companyPricing("G'OYA", null).price, companyPricing('GOYA', null).price);

// ── 5) Turli yozilishlar BITTA kompaniyaga olib boradi ─────────────────
// Aks holda "gʻoya" va "g'oya" ikkita boshqa kompaniya bo'lib qolardi.
const SAME = ["g'oya", 'gʻoya', 'g‘oya', 'g’oya', "G'OYA", 'G`OYA'];
const canonical = SAME.map((v) => workerCompanyId(v));
checkTrue('5) barcha apostrof variantlari bitta ID beradi', canonical.every((v) => v === "G'OYA"));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
