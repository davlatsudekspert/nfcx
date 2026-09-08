// Telefon raqamini keltirish mantig'i IKKI joyda yozilgan (Worker
// modullari `src/` dan import qila olmaydi — build qo'riqchisi):
//
//   hosting/worker.js -> normalizePhoneD1()   yakuniy, ishonchli manba
//   src/lib/phone.js  -> normalizePhone()     faqat ko'rsatish uchun
//
// Ular AJRALIB KETSA, forma odamga bir narsani ko'rsatadi, server esa
// boshqasini saqlaydi — bu eng yomon turdagi xato, chunki hech kim
// sezmaydi. Shuning uchun ikkalasi bir xil ishlashi shu yerda
// qo'riqlanadi.
//
//   node scripts/test-phone-parity.mjs
import { readFileSync } from 'node:fs';
import { normalizePhone } from '../src/lib/phone.js';
import { makeChecker } from './lib/d1-harness.mjs';

const { check, done } = makeChecker();

// Worker'dagi funksiyani manbadan ajratib olamiz (u eksport qilinmaydi).
const src = readFileSync(new URL('../hosting/worker.js', import.meta.url), 'utf8');
const from = src.indexOf('function normalizePhoneD1');
const body = src.slice(from, src.indexOf('\n}', from) + 2);
const cleanStr = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
// eslint-disable-next-line no-eval
const normalizePhoneD1 = eval(`(${body.replace('function normalizePhoneD1', 'function')})`);
void cleanStr;

const CASES = [
  // O'zbekiston — odamlar aslida shunday yozadi
  ['901112233', '+998901112233'],
  ['90 111 22 33', '+998901112233'],
  ['90-111-22-33', '+998901112233'],
  ['(90) 111 22 33', '+998901112233'],
  ['998901112233', '+998901112233'],
  ['+998901112233', '+998901112233'],
  ['+998 90 111 22 33', '+998901112233'],
  ['00998901112233', '+998901112233'],
  // O'zbekiston — UZUNLIGI XATO, jimgina qabul qilinmaydi
  ['99890111223', ''],
  ['9989011122334', ''],
  ['+99890111223', ''],
  // Qo'shni davlatlar
  ['+79161112233', '+79161112233'],
  ['8 916 111 22 33', '+79161112233'],
  ['8 705 111 22 33', '+77051112233'],
  ['+996700111222', '+996700111222'],
  ['+90 555 111 22 33', '+905551112233'],
  ['0049 30 1112233', '+49301112233'],
  // Yaroqsiz
  ['0700111222', ''],
  ['+0700111222', ''],
  ['12345', ''],
  ['+998abc1112233', ''],
  ['', ''],
  ['   ', ''],
  ['ism@gmail.com', ''],
];

for (const [input, expected] of CASES) {
  const a = normalizePhoneD1(input);
  const b = normalizePhone(input);
  check(`server: ${JSON.stringify(input)}`, a, expected);
  check(`paritet: ${JSON.stringify(input)}`, b, a);
}

done();
