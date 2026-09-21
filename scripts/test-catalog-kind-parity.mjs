// KATALOG TURI QOIDASI IKKI JOYDA — VA ULAR AJRALIB KETMASLIGI KERAK.
//
//   node scripts/test-catalog-kind-parity.mjs
//
// ── NIMA UCHUN BU TEST BOR ────────────────────────────────────────
//
// Biznes yo'nalishidan katalog turini aniqlash qoidasi:
//
//   food*   -> menyu
//   retail* -> mahsulotlar
//   qolgan  -> xizmatlar
//
// U IKKI joyda yozilgan va bu MAJBURIY:
//
//   * `hosting/api/catalog.js` -> `businessModule()` — QAROR
//     shu yerda qabul qilinadi, mos kelmasa 403;
//   * `mobile_nova/.../business_repository.dart` ->
//     `CatalogKind.forCategory()` — ilova TO'G'RI turni
//     so'rashi uchun.
//
// Worker modullari `mobile_nova/` dan import qila olmaydi va
// aksincha, shuning uchun nusxadan qochib bo'lmaydi. Qochib
// bo'lmaydigan nusxa esa VAQT O'TIB AJRALIB KETADI — va u jim
// ajraladi: server yangi yo'nalishni `products` ga o'tkazadi,
// ilova esa `services` so'rab, 403 oladi. Odam uchun bu
// "mahsulot qo'shib bo'lmadi" bo'lib ko'rinadi.
//
// Shuning uchun ikkala nusxa HAR BIR namuna uchun solishtiriladi.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { makeChecker } from './lib/d1-harness.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const { check, checkTrue, done } = makeChecker();

// ── 1. SERVER qoidasi — manbadan AYNAN olinadi ───────────────────
//
// Qayta yozilmaydi: qayta yozilsa, test tekshirayotgan narsadan
// BOSHQA narsani tekshirib qolardi.
const SERVER_SRC = readFileSync(join(ROOT, 'hosting/api/catalog.js'), 'utf8');
const fnStart = SERVER_SRC.indexOf('function businessModule(');
checkTrue('1) serverdagi `businessModule` topildi', fnStart >= 0);
const fnEnd = SERVER_SRC.indexOf('\n}', fnStart);
const serverFn = SERVER_SRC.slice(fnStart, fnEnd + 2);
const businessModule = new Function(`${serverFn}; return businessModule;`)();

// ── 2. ILOVA qoidasi — manbadan o'qib, qayta quriladi ────────────
const APP_SRC = readFileSync(
  join(ROOT, 'mobile_nova/lib/data/repositories/business_repository.dart'),
  'utf8',
);
const dartStart = APP_SRC.indexOf('static CatalogKind forCategory(');
checkTrue('2) ilovadagi `forCategory` topildi', dartStart >= 0);
const dartFn = APP_SRC.slice(dartStart, APP_SRC.indexOf('\n  }', dartStart));

// Dart shartlarini o'qiymiz. Qoida o'zgarsa (masalan yangi
// yo'nalish qo'shilsa) bu ajratish MOS KELMAY qoladi va test
// yiqiladi — aynan shu kerak.
const rules = [];
for (const m of dartFn.matchAll(
  /if \(s == '([a-z-]+)' \|\| s\.startsWith\('([a-z-]+)'\)\) return CatalogKind\.([a-z]+);/g,
)) {
  rules.push({ exact: m[1], prefix: m[2], kind: m[3] });
}
const fallbackMatch = dartFn.match(/return CatalogKind\.([a-z]+);\s*$/);
const fallback = fallbackMatch ? fallbackMatch[1] : '';
checkTrue('2) ikkita shart va zaxira topildi', rules.length === 2 && !!fallback);

const appKind = (slug) => {
  const s = String(slug || '').toLowerCase();
  for (const r of rules) {
    if (s === r.exact || s.startsWith(r.prefix)) return r.kind;
  }
  return fallback;
};

// ── 3. HAR BIR NAMUNA uchun ikkalasi bir xil javob beradimi ──────
//
// Server `listKey` qaytaradi (`menu` | `products` | `services`),
// ilova esa `CatalogKind` nomini — ikkalasi bir xil so'zlar.
const SAMPLES = [
  'food', 'food-cafe', 'food-restaurant', 'food-fastfood',
  'retail', 'retail-clothes', 'retail-electronics',
  'beauty', 'auto', 'medical', 'education', 'other', '',
  // Chegaraviy holatlar: prefiks "yopishib" ketmasligi kerak.
  'foodie', 'retailer', 'foodstuff',
];

let mismatched = 0;
for (const slug of SAMPLES) {
  const server = businessModule('business', slug);
  const app = appKind(slug);
  if (server !== app) {
    mismatched++;
    console.log(`  MOS EMAS  "${slug}": server=${server} ilova=${app}`);
  }
}
check('3) mos kelmagan yo‘nalish soni', mismatched, 0);

// ── 4. BIZNES BO'LMAGAN PROFIL — katalog YO'Q ────────────────────
//
// Server `profileType !== 'business'` uchun `null` qaytaradi.
// Ilovada bunday holat yo'q — u faqat biznes yozuvi uchun
// chaqiriladi. Shu farq ATAYLAB va u shu yerda qayd etiladi.
check('4) shaxsiy profil uchun server `null` beradi',
  businessModule('personal', 'retail'), null);

done('Katalog turi — server/ilova parity');
