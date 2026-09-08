// Ekskluziv narxlar — sayt va Worker BIR XIL narx berishini kafolatlaydi.
//
// NIMA UCHUN: narx ikki joyda hisoblanadi (brauzerda ko'rsatish uchun,
// serverda to'lov yaratish uchun). Ular ajralib ketsa, odam bir narxni
// ko'rib boshqasini to'laydi — bu eng yomon turdagi xato.
// Worker nusxasi src/lib/exclusivePricing.js dan generatsiya qilinadi
// (scripts/gen-exclusive-pricing.mjs); bu test generatsiya eskirmaganini
// ham, mantiq mos kelishini ham tekshiradi.
//
//   node scripts/test-exclusive-pricing.mjs
import * as SRC from '../src/lib/exclusivePricing.js';
import * as GEN from '../hosting/exclusive-pricing.generated.js';
import { getPersonalPurchaseQuote } from '../src/lib/pricing.js';
import { personalPurchaseQuote } from '../hosting/worker.js';

let pass = 0, fail = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(ok ? 'PASS' : 'FAIL', '-', label, ok ? '' : `\n    actual:   ${JSON.stringify(actual)}\n    expected: ${JSON.stringify(expected)}`);
  ok ? pass++ : fail++;
}
const checkTrue = (l, v) => check(l, !!v, true);

// ── 1) Egasi bergan misollar AYNAN to'g'ri ────────────────────────────
const CASES = [
  ['UZB000', 'special_4490', 4490000], ['UZB001', 'special_4490', 4490000],
  ['UZB007', 'special_4490', 4490000], ['UFC229', 'special_4490', 4490000],
  ['PLT034', 'special_4490', 4490000], ['RMA007', 'special_4490', 4490000],
  ['AAA001', 'special_3490', 3490000], ['AAA007', 'special_3490', 3490000],
  ['FCB010', 'special_3490', 3490000],
  ['III000', 'level_0', 2990000], ['III111', 'level_0', 2990000], ['III777', 'level_0', 2990000],
  ['FFF777', 'level_0', 2990000], ['NNN000', 'level_0', 2990000], ['QQQ111', 'level_0', 2990000],
  ['WWW777', 'level_0', 2990000],
  ['VIP555', 'level_1', 2490000], ['SSS555', 'level_1', 2490000],
  ['CEO555', 'level_2', 1990000], ['LUX808', 'level_2', 1990000],
  ['CEO909', 'level_3', 1490000], ['VIP606', 'level_3', 1490000],
  ['VIP789', 'level_4', 990000], ['BBB222', 'level_4', 990000],
  ['KKK333', 'level_5', 490000], ['FFF555', 'level_5', 490000], ['NNN888', 'level_5', 490000],
  // Ekskluziv SO'ZLI kod, ro'yxatlarning birortasiga tushmagani (2026-09,
  // egasining qarori: 1 190 000). Bu Level 5 dan FARQ QILADI — Level 5
  // faqat "uchala harf bir xil + uchala raqam bir xil" shakli uchun.
  ['VIP002', 'word_default', 1190000], ['CEO004', 'word_default', 1190000],
  ['KNG050', 'word_default', 1190000], ['LUX246', 'word_default', 1190000],
];
for (const [code, level, price] of CASES) {
  check(`1) ${code} -> ${level}`, SRC.exclusiveLevel(code), { level, price });
}

// ── 2) 000/111/777 HECH QACHON Level 5 ga tushmaydi ───────────────────
// Egasining aniq talabi. Maxsus ro'yxatdagilar bundan mustasno
// (UZB000 -> 4 490 000, ular yuqoriroq turadi).
const L = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
let wrong = [];
for (const a of L) for (const d of ['000', '111', '777']) {
  const c = a + a + a + d;
  const r = SRC.exclusiveLevel(c);
  if (!r || (r.level !== 'level_0' && !r.level.startsWith('special_'))) wrong.push(c + '=' + (r && r.level));
}
check('2) uchala harf bir xil + 000/111/777 -> Level 0', wrong, []);

// ── 3) SAYT va WORKER bir xil narx beradi ─────────────────────────────
const all = [];
for (const a of L) for (let d = 0; d < 1000; d++) all.push(a + a + a + String(d).padStart(3, '0'));
for (const w of SRC.EXCLUSIVE_WORDS) for (let d = 0; d < 1000; d++) all.push(w + String(d).padStart(3, '0'));
for (const c of ['UFC229', 'MMA300', 'KHB254', 'CON013', 'PLT034', 'RMA007', 'AMG063', 'CLS063',
  'SAV571', 'USD100', 'XXX772', 'BEK777', 'UAE001', 'ABC123', 'DEV001', 'GEM001', 'UNO000',
  'WOW013', 'ASL777', 'FCB010', 'BMW412', 'XYZ412', 'ABB770']) all.push(c);

let genDiff = 0, quoteDiff = 0, firstQuote = null;
for (const c of all) {
  if (JSON.stringify(SRC.exclusiveLevel(c)) !== JSON.stringify(GEN.exclusiveLevel(c))) genDiff++;
  const a = getPersonalPurchaseQuote(c);
  const b = personalPurchaseQuote(c);
  if (JSON.stringify(a) !== JSON.stringify(b)) { quoteDiff++; if (!firstQuote) firstQuote = [c, a, b]; }
}
check(`3) generatsiya eskirmagan (${all.length} ta kod)`, genDiff, 0);
check(`3) sayt va Worker narxi bir xil${firstQuote ? ' — ' + JSON.stringify(firstQuote) : ''}`, quoteDiff, 0);

// ── 3b) Ikki zaxira daraja ARALASHIB KETMASIN ────────────────────────
// AAA222 shakli 490 000, VIP002 shakli 1 190 000 — ikkalasi ham
// "ro'yxatda yo'q" bo'lsa ham narxi boshqa.
{
  let mixed = [];
  for (const a of L) for (let d = 0; d < 1000; d++) {
    const c = a + a + a + String(d).padStart(3, '0');
    const r = SRC.exclusiveLevel(c);
    if (r && r.level === 'word_default') mixed.push(c);
  }
  check('3b) harf-raqam bir xil kod hech qachon "so‘z" darajasiga tushmaydi', mixed, []);
  const wordFallback = [];
  for (const w of SRC.EXCLUSIVE_WORDS) for (let d = 0; d < 1000; d++) {
    const c = w + String(d).padStart(3, '0');
    const r = SRC.exclusiveLevel(c);
    if (r && r.level === 'level_5') wordFallback.push(c);
  }
  check('3b) so‘zli kod hech qachon Level 5 (490 000) ga tushmaydi', wordFallback, []);
}

// ── 4) Ekskluziv kod endi SOTILADI (auksion emas) ─────────────────────
for (const c of ['AAA777', 'VIP555', 'UZB000', 'KKK333']) {
  const q = getPersonalPurchaseQuote(c);
  checkTrue(`4) ${c} sotiladi`, q.purchasable === true && q.amount > 0);
  check(`4) ${c} "faqat auksion" emas`, q.reason, undefined);
}
// Oddiy kodlar avvalgidek
check('4) XYZ412 avvalgidek Bronza', getPersonalPurchaseQuote('XYZ412'), { purchasable: true, tier: 'free', amount: 49000 });

// ── 5) Kompaniya premium nomlari ──────────────────────────────────────
const COMPANY = [
  ['BANK', 'level_0', 4990000], ['MARKET', 'level_0', 4990000], ['VIP', 'level_0', 4990000],
  ['AERO', 'level_1', 3990000], ['META', 'level_1', 3990000],
  ['CAFE', 'level_2', 2990000], ['TAXI', 'level_2', 2990000],
  ['BAR', 'level_3', 1990000], ['TIGER', 'level_3', 1990000],
  ['PIZZA', 'level_4', 990000], ['WATCH', 'level_4', 990000],
];
for (const [name, level, price] of COMPANY) {
  check(`5) ${name} -> ${level}`, SRC.companyPremiumLevel(name), { level, price });
  check(`5) ${name} Worker nusxasida ham`, GEN.companyPremiumLevel(name), { level, price });
}
check('5) ro‘yxatda yo‘q nom -> null', SRC.companyPremiumLevel('GOYAX'), null);
// Yozilish varianti farq qilsa ham topiladi (bo'shliq, tire, kichik harf).
check('5) "co ca"/tire/kichik harf ham topiladi', SRC.companyPremiumLevel('re-al estate'), { level: 'level_0', price: 4990000 });

// ── 6) Bitta nom ikki darajada bo'lib qolmasin ────────────────────────
const seen = new Map();
for (const key of ['COMPANY_LEVEL_0', 'COMPANY_LEVEL_1', 'COMPANY_LEVEL_2', 'COMPANY_LEVEL_3', 'COMPANY_LEVEL_4']) {
  for (const n of SRC.ALL_LISTS[key]) {
    if (seen.has(n)) fail += (console.log('FAIL - 6) takror:', n, seen.get(n), key), 1);
    else seen.set(n, key);
  }
}
check('6) kompaniya nomlarida takror yo‘q', seen.size, 30 + 45 + 82 + 20 + 46);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
