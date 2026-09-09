// KARTA FONLARI — ro'yxat va fayllar mos keladimi?
//
// NIMA UCHUN BU TEST BOR: fonlar oddiy statik fayllar. Ro'yxatga nom
// qo'shilib, fayl qo'shilmasa (yoki fayl nomi noto'g'ri yozilsa)
// `npm run build` hech narsa demaydi — foydalanuvchi tanlaydi va
// kartaga BO'SH fon tushadi. Shuning uchun ikkalasi shu yerda
// solishtiriladi.
//
//   node scripts/test-card-backgrounds.mjs
import { existsSync, statSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { CARD_BACKGROUNDS, cardBackgroundById, cardBackgroundFromUrl } from '../src/lib/cardBackgrounds.js';

let pass = 0, fail = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(ok ? 'PASS' : 'FAIL', '-', label, ok ? '' : `\n    actual:   ${JSON.stringify(actual)}\n    expected: ${JSON.stringify(expected)}`);
  ok ? pass++ : fail++;
}
const checkTrue = (label, v) => check(label, !!v, true);

const root = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(root, '../public/card-backgrounds');
const abs = (webPath) => path.join(root, '..', 'public', webPath.replace(/^\//, ''));

check('1) sakkizta fon', CARD_BACKGROUNDS.length, 8);

for (const bg of CARD_BACKGROUNDS) {
  checkTrue(`2) ${bg.id}: to‘liq fayl bor`, existsSync(abs(bg.url)));
  checkTrue(`2) ${bg.id}: kichik nusxa bor`, existsSync(abs(bg.thumb)));
  // Kichik nusxa to'liqdan ANCHA yengil bo'lishi shart — aks holda
  // ro'yxat ochilganda 8 ta og'ir rasm tortiladi.
  if (existsSync(abs(bg.url)) && existsSync(abs(bg.thumb))) {
    const full = statSync(abs(bg.url)).size;
    const thumb = statSync(abs(bg.thumb)).size;
    checkTrue(`2) ${bg.id}: kichik nusxa yengil (${Math.round(thumb / 1024)} KB < ${Math.round(full / 1024)} KB)`, thumb * 4 < full);
    // Mobil internet uchun chegara: bitta fon 600 KB dan oshmasin.
    checkTrue(`2) ${bg.id}: to‘liq fayl 600 KB dan kichik`, full < 600 * 1024);
  }
  checkTrue(`2) ${bg.id}: nomi bor`, !!bg.label && !!bg.country);
}

// Papkada ro'yxatga KIRMAGAN ortiqcha fayl qolmasin (eski nom o'zgarsa
// eskisi qolib ketardi va repo shishardi).
const expected = new Set(CARD_BACKGROUNDS.flatMap((b) => [`${b.id}.webp`, `${b.id}-thumb.webp`]));
const actual = existsSync(dir) ? readdirSync(dir).filter((f) => !f.startsWith('.')) : [];
check('3) ortiqcha fayl yo‘q', actual.filter((f) => !expected.has(f)), []);

// Qidiruv yordamchilari
check('4) id bo‘yicha topiladi', cardBackgroundById('paris')?.label, 'Parij');
check('4) noma’lum id — null', cardBackgroundById('yoq'), null);
check('4) manzil bo‘yicha topiladi', cardBackgroundFromUrl('/card-backgrounds/khiva.webp')?.id, 'khiva');
check('4) begona manzil — null', cardBackgroundFromUrl('https://example.com/x.webp'), null);
check('4) bo‘sh manzil — null', cardBackgroundFromUrl(''), null);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
