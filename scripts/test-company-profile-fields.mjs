// Kompaniya ALOQA maydonlari HAMMA sahifada ko'rinadimi?
//
// NIMA UCHUN BU TEST BOR: 2026-09-08 da Instagram, Facebook, karta
// raqami, lokatsiya, qo'shimcha havolalar va musiqa qo'shildi — lekin
// faqat IKKI joyga: tahrirlash oynasiga va to'liq kompaniya sahifasiga.
// NFC kartaning O'ZI ochadigan tezkor profil (/c/<id>) va tahrirlashdagi
// telefon preview'i eski holicha qoldi, shuning uchun egasi ma'lumotni
// kiritdi-yu, kartani telefon ga tegizganda hech narsani ko'rmadi —
// "ishlamayapti" degani shu edi.
//
// `npm run build` bunday yo'qolishni HECH QACHON ko'rmaydi: JSX to'g'ri,
// shunchaki maydon yozilmagan. Shuning uchun tekshiruv shu yerda.
//
//   node scripts/test-company-profile-fields.mjs
import { readFileSync } from 'node:fs';

let pass = 0, fail = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(ok ? 'PASS' : 'FAIL', '-', label, ok ? '' : `\n    actual:   ${JSON.stringify(actual)}\n    expected: ${JSON.stringify(expected)}`);
  ok ? pass++ : fail++;
}
const checkTrue = (label, v) => check(label, !!v, true);

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');

// Izohlar OLIB TASHLANADI. Aks holda taqiqlangan yozuvni TUSHUNTIRUVCHI
// izohning o'zi tekshiruvni yiqitardi (repoda bu xato allaqachon bir
// marta bo'lgan — o'zbekcha izoh ichidagi import yo'li).
const readCode = (rel) => read(rel)
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|[^:])\/\/[^\n]*/g, '$1');

// Har bir maydon: nomi va uni sahifada topish uchun namuna.
const FIELDS = [
  ['ish vaqti', /CompanyHours|CompanyHoursEditor/],
  ['instagram', /company\.instagram|form\.instagram/],
  ['facebook', /company\.facebook|form\.facebook/],
  ['karta raqami', /company\.cardNumber|form\.cardNumber/],
  ['lokatsiya (yo‘nalish)', /directionsUrl\(/],
  ['qo‘shimcha havolalar', /company\.extraLinks|form\.extraLinks/],
  ['musiqa', /CompanyMusicPlayer|form\.music/],
];

// Foydalanuvchi ko'radigan UCHALA yuza. Biri unutilsa — shu yerda yiqiladi.
const SURFACES = [
  ['NFC tezkor profil (/c/:id)', 'src/pages/CompanyQuickProfilePage.jsx'],
  ['To‘liq kompaniya sahifasi (/company/:id)', 'src/pages/CompanyPublicPage.jsx'],
  ['Tahrirlashdagi telefon preview', 'src/pages/CompanyWorkspacePage.jsx'],
];

for (const [surface, file] of SURFACES) {
  const src = read(file);
  for (const [field, re] of FIELDS) {
    checkTrue(`${surface}: ${field}`, re.test(src));
  }
}

// ── Koordinatani `&&` bilan tekshirish TAQIQLANADI ────────────────────
// `company.latitude && company.longitude` — 0 JS uchun "yolg'on",
// shuning uchun ekvatordagi yoki Grinvich meridianidagi nuqta yo'qolib
// qolardi. To'g'ri yo'l — hasCoords().
for (const [surface, file] of SURFACES) {
  const src = readCode(file);
  const bad = /(company|form)\.latitude\s*&&/.test(src);
  check(`${surface}: koordinata \`&&\` bilan tekshirilmaydi`, bad, false);
}

// Tahrirlash oynasidagi preview tugmalari HAQIQIY havola bo'lsin.
// Avval `<button>📞 Qo'ng'iroq</button>` turardi — bosilganda hech narsa
// qilmasdi va Aloqa bo'limiga nima yozilsa ham o'zgarmasdi.
const workspace = readCode('src/pages/CompanyWorkspacePage.jsx');
checkTrue('preview tugmalari komponentdan chiqadi', /<PhoneButtons\b/.test(workspace));
check('eski o‘lik tugma qolmadi', /<button>📞/.test(workspace), false);

// Tahrirlash oynasi yangi maydonlarni SAQLAY oladimi (input bormi).
for (const key of ['instagram', 'facebook', 'cardNumber']) {
  checkTrue(`Aloqa bo‘limida ${key} maydoni bor`, new RegExp(`set\\('${key}'\\)`).test(workspace));
}
checkTrue('lokatsiya komponenti ulangan', /<CompanyLocationField\b/.test(workspace));
checkTrue('havolalar komponenti ulangan', /<CompanyExtraLinks\b/.test(workspace));
checkTrue('musiqa komponenti ulangan', /<CompanyMusic\b/.test(workspace));
checkTrue('ish vaqti tahrirlagichi ulangan', /<CompanyHoursEditor\b/.test(workspace));
checkTrue('statistika bo‘limi ulangan', /<CompanyStatsPanel\b/.test(workspace));
checkTrue('buyurtmalar bo‘limi ulangan', /<CompanyOrdersPanel\b/.test(workspace));
checkTrue('QR kod ulangan', /<CompanyQrCard\b/.test(workspace));
checkTrue('o‘z domeni bo‘limi ulangan', /<CompanyDomainSection\b/.test(workspace));

// Buyurtma tugmasi ikkala OCHIQ sahifada ham bo'lsin — biri unutilsa,
// mijoz kartani tegizib buyurtma bera olmaydi.
for (const [surface, file] of SURFACES.slice(0, 2)) {
  checkTrue(`${surface}: buyurtma tugmasi`, /CompanyOrderModal/.test(readCode(file)));
  checkTrue(`${surface}: statistika hodisasi yuboriladi`, /companyEvent\(/.test(readCode(file)));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
