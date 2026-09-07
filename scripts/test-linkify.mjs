// Yangiliklar matnidagi havolalarni topish — src/lib/linkify.js.
//
// Eng muhim kafolat: matn HECH QACHON o'zgarmasligi kerak. Bo'laklarni
// qayta birlashtirganda asl matn AYNAN chiqishi shart — aks holda
// yangilikdan bir harf yoki tinish belgisi yo'qolib qolardi.
//
//   node scripts/test-linkify.mjs
import { linkifyParts } from '../src/lib/linkify.js';

let pass = 0;
let fail = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(ok ? 'PASS' : 'FAIL', '-', label, ok ? '' : `\n    actual:   ${JSON.stringify(actual)}\n    expected: ${JSON.stringify(expected)}`);
  ok ? pass++ : fail++;
}
function checkTrue(label, value) { check(label, !!value, true); }

const links = (t) => linkifyParts(t).filter((p) => p.type === 'link');
// Bo'laklarni qayta birlashtirish: link uchun `label`, matn uchun `value`.
const rebuild = (t) => linkifyParts(t).map((p) => (p.type === 'link' ? p.label : p.value)).join('');

// ── 1) ASL MATN SAQLANADI ──────────────────────────────────────────────
const SAMPLES = [
  '',
  'Oddiy matn, havolasiz.',
  'Sayt: https://nfcstore.uz',
  'Sayt: https://nfcstore.uz.',
  'Telegram: https://t.me/nfcstoreuz Instagram: https://www.instagram.com/nfcstore.uz',
  'Qavs ichida (https://nfcstore.uz) shunday.',
  'www.nfcstore.uz — havola',
  "Narx 1.500.000 so'm, 3.5 barobar arzon.",
  'Ikki qator\nhttps://nfcstore.uz\nuchinchi qator',
  'https://nfcstore.uz, https://t.me/nfcstoreuz!',
];
for (const t of SAMPLES) {
  check(`1) asl matn saqlanadi: ${JSON.stringify(t.slice(0, 40))}`, rebuild(t), t);
}

// ── 2) Havolalar topiladi ──────────────────────────────────────────────
check('2) https havola', links('Sayt: https://nfcstore.uz').map((l) => l.href), ['https://nfcstore.uz']);
check('2b) http havola', links('http://example.uz/a').map((l) => l.href), ['http://example.uz/a']);
check('2c) www. ga https:// qo\'shiladi', links('www.nfcstore.uz').map((l) => l.href), ['https://www.nfcstore.uz']);
check('2d) www. matnda o\'z holicha ko\'rinadi', links('www.nfcstore.uz').map((l) => l.label), ['www.nfcstore.uz']);
check('2e) bir nechta havola', links('a https://x.uz b https://y.uz c').length, 2);
check('2f) yo\'l va parametrlar', links('https://t.me/nfcstoreuz?start=1').map((l) => l.href), ['https://t.me/nfcstoreuz?start=1']);

// ── 3) Oxiridagi tinish belgisi havolaga KIRMAYDI ──────────────────────
// "https://nfcstore.uz." dagi nuqta havolaning bir qismi emas — kirsa,
// havola ochilmay xato sahifa chiqardi.
check('3) oxiridagi nuqta kesiladi', links('Sayt: https://nfcstore.uz.').map((l) => l.href), ['https://nfcstore.uz']);
check('3b) vergul kesiladi', links('https://x.uz, keyin').map((l) => l.href), ['https://x.uz']);
check('3c) undov kesiladi', links('https://x.uz!').map((l) => l.href), ['https://x.uz']);
check('3d) juftsiz yopuvchi qavs kesiladi', links('(https://x.uz)').map((l) => l.href), ['https://x.uz']);
check('3e) havola ichidagi juft qavs qoladi', links('https://x.uz/a_(b)').map((l) => l.href), ['https://x.uz/a_(b)']);

// ── 4) Havola BO'LMAGANLAR tegilmaydi ──────────────────────────────────
// Bu ikkisi yangiliklar matnida tez-tez uchraydi: narx va o'nlik son.
check('4) narx havolaga aylanmaydi', links("Narx 1.500.000 so'm").length, 0);
check('4b) o\'nlik son havolaga aylanmaydi', links('3.5 barobar').length, 0);
check('4c) oddiy domen (protokolsiz) tegilmaydi', links('nfcstore.uz saytimiz').length, 0);

// ── 5) XAVFSIZLIK: faqat http/https ────────────────────────────────────
// `javascript:` yoki `data:` sxemalari umuman topilmasligi kerak —
// aks holda bosilganda kod ishga tushishi mumkin edi.
check('5) javascript: sxemasi topilmaydi', links('javascript:alert(1)').length, 0);
check('5b) data: sxemasi topilmaydi', links('data:text/html,<script>').length, 0);
checkTrue('5c) har bir href http yoki https bilan boshlanadi', links(
  'https://a.uz www.b.uz http://c.uz javascript:x data:y',
).every((l) => /^https?:\/\//.test(l.href)));

// ── 6) Chegaraviy holatlar ─────────────────────────────────────────────
check('6) bo\'sh matn', linkifyParts(''), []);
check('6b) null/undefined yiqilmaydi', linkifyParts(null), []);
check('6c) faqat havoladan iborat matn', linkifyParts('https://x.uz').length, 1);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
