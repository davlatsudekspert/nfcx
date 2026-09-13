// ADMIN MENYUSI — indekslar va bo'lim sarlavhalari mos bo'lsin.
//
// NIMA UCHUN BU TEST BOR: `ADMIN_NAV` da har bir bo'limning indeksi
// QATTIQ yozilgan, sarlavha esa `TABS[tab]` dan olinadi. Ya'ni
// `TABS` dan bitta element olib tashlansa, undan keyingi HAMMA
// bo'limning sarlavhasi siljiydi va menyu boshqa sahifani ochadi.
// `npm run build` bunga hech qanday xato bermaydi.
//
// Bu aynan sodir bo'lishiga oz qolgan edi: auksion bo'limlarini
// yashirish uchun ular `TABS` dan olib tashlangan edi. To'g'ri yo'l —
// faqat `ADMIN_NAV` dan olish: bo'limning o'zi joyida qoladi va
// indekslar buzilmaydi.
//
//   node scripts/test-admin-nav.mjs
import { readFileSync } from 'node:fs';
import { makeChecker } from './lib/d1-harness.mjs';

const { check, checkTrue, done } = makeChecker();
const src = readFileSync(new URL('../src/pages/AdminPage.jsx', import.meta.url), 'utf8');

// TABS ro'yxatini o'qiymiz.
const tabsLine = src.match(/^const TABS = \[(.*)\];$/m);
checkTrue('TABS topildi', !!tabsLine);
const tabs = [...tabsLine[1].matchAll(/(['"])((?:\\.|(?!\1).)*)\1/g)].map((m) => m[2]);
// QOIDA: bu ro'yxatga OXIRIGA qo'shish mumkin, lekin ichidan olib
// tashlash yoki tartibni o'zgartirish MUMKIN EMAS — indekslar
// `ADMIN_NAV` da qattiq yozilgan. Shuning uchun boshlanishi aynan
// mos kelishi tekshiriladi: qo'shish o'tadi, siljitish yiqiladi.
const FROZEN = ['Umumiy', 'Statistika', 'Foydalanuvchilar', 'Buyurtmalar', "To'lanishi kerak pullar",
  'Auksionlar', "Auksion so'rovlari", 'Jismoniy kartalar', 'Bildirishnomalar', 'Tashqi analitika',
  'Security', 'Adminlar', 'Gift NFC ID', 'Promokodlar', 'Yangiliklar', 'Kategoriyalar',
  'Tasdiqlash', 'Talab', 'Moliya', 'Kompaniyalar'];
check('TABS boshlanishi o‘zgarmadi (indekslar qotirilgan)', tabs.slice(0, FROZEN.length), FROZEN);
checkTrue('TABS qisqarmadi', tabs.length >= FROZEN.length);

// ADMIN_NAV dagi har bir yozuvni o'qiymiz.
const navBlock = src.slice(src.indexOf('const ADMIN_NAV = ['));
const nav = [...navBlock.slice(0, navBlock.indexOf('\n];')).matchAll(
  /\{\s*index:\s*(\d+),\s*label:\s*(['"])((?:\\.|(?!\2).)*)\2/g)].map((m) => ({ index: Number(m[1]), label: m[3] }));
checkTrue('ADMIN_NAV o‘qildi', nav.length >= 15);

// ── ASOSIY QOIDA: menyudagi nom TABS dagi o'sha indeks bilan bir xil
const mismatched = nav.filter((n) => tabs[n.index] !== n.label);
check('har bir menyu yozuvi TABS dagi o‘z indeksiga mos', mismatched, []);

// Indeks chegaradan chiqmasin.
check('indekslar chegarada', nav.filter((n) => n.index < 0 || n.index >= tabs.length), []);

// Bitta bo'lim ikki marta chiqmasin.
const seen = new Set();
check('takroriy indeks yo‘q', nav.filter((n) => (seen.has(n.index) ? true : (seen.add(n.index), false))), []);

// ── AUKSION menyuda BO'LMASIN (egasining qarori) ─────────────────────
// Bo'limlarning o'zi va bazadagi ma'lumot joyida qoladi — faqat
// menyudan olingan.
const hidden = ['Auksionlar', "Auksion so'rovlari", 'Talab'];
for (const label of hidden) {
  checkTrue(`"${label}" TABS da qoldi (indeks buzilmasin)`, tabs.includes(label));
  checkTrue(`"${label}" menyuda YO‘Q`, !nav.some((n) => n.label === label));
}

// Umumiy sahifada ham auksion ko'rsatkichi qolmasin.
checkTrue('"Faol auksionlar" ko‘rsatkichi olib tashlandi', !src.includes('Faol auksionlar'));

done();
