// OCHIQ PROFIL — KO'RISH UCHUN, BOSHQARUV UCHUN EMAS
//
// SHIKOYAT. VIP001 ning ochiq profili tepasida juda ko'p element
// yig'ilib qolgandi: TOP nishoni katta blok bo'lib, yonida egaga
// tegishli "Tahrirlash" va "Story qo'shish" tugmalari, ularning
// yonida esa "Boshqa raqamli tashrif qog'ozlaringiz (7)" ro'yxati.
// Natijada premium profil boshqaruv paneliga o'xshab qolgandi —
// holbuki bu sahifa MEHMONGA ko'rsatiladi.
//
// QOIDA. Profil tepasida faqat to'rt narsa:
//   orqaga · nusxalash · ulashish · ⋮
// Ega amallari ⋮ menyusi ichida; mehmon ularni umuman ko'rmaydi.
//
// Brauzerda o'lchandi (5 kenglik, ega va mehmon):
//   tepadagi boshqaruv: 4 ta
//   sahifada `<select>`: 0 ta (ilgari ID ro'yxati 392px bo'lib
//     390px telefonda ufqiy surilishga sabab bo'lardi)
//   ufqiy toshish: 0
//
//   node scripts/test-public-profile-top.mjs
import { readFileSync } from 'node:fs';
import { makeChecker } from './lib/d1-harness.mjs';
import { stripComments } from './lib/strip-comments.mjs';

const { check, checkTrue, done } = makeChecker();
const read = (rel) => stripComments(readFileSync(new URL(rel, import.meta.url), 'utf8'));
const profile = read('../src/pages/ProfilePage.jsx');
const menu = read('../src/components/ProfileMoreMenu.jsx');

// ── 1) TEPADA EGA TUGMALARI YO'Q ─────────────────────────────────────
{
  // Katta "Tahrirlash" tugmasi profil tepasidan olib tashlangan.
  checkTrue('1) tepada katta "Tahrirlash" tugmasi yo‘q',
    !/isOwner && <button className=\{pillBtn\}[^>]*'edit'/.test(profile));
  checkTrue('1) tepada "Story qo‘shish" tugmasi yo‘q',
    !/isOwner && \(\s*<button\s*className=\{pillBtn\}[\s\S]{0,200}'story'/.test(profile));
  // "Boshqa raqamli tashrif qog'ozlaringiz" ro'yxati (select) yo'q.
  checkTrue('1) ID ro‘yxati (select) olib tashlangan',
    !/Boshqa raqamli tashrif qog/.test(profile));
  checkTrue('1) profilda ega uchun <select> qolmagan',
    !/otherCodes\.map\(\(c\) => \(\s*<option/.test(profile));
}

// ── 2) EGA AMALLARI ⋮ MENYUSIDA ──────────────────────────────────────
{
  checkTrue('2) menyuga ega amallari uzatiladi', /ownerActions=\{isOwner \?/.test(profile));
  for (const [label, action] of [
    ['Profilni tahrirlash', 'edit'],
    ['Story qo‘shish', 'story'],
    ['Post qo‘shish', 'post'],
  ]) {
    checkTrue(`2) "${label}" bor`, profile.includes(`t('${label}')`));
    checkTrue(`2) "${label}" o‘z NFC ID si bilan ketadi`,
      new RegExp(`ownerActionUrl\\(record\\.code, '${action}'\\)`).test(profile));
  }
  // ID ro'yxati endi kabinetda.
  checkTrue('2) ID ro‘yxati kabinetga yo‘naltiradi', /navigate\('\/account#myids'\)/.test(profile));
}

// ── 3) MEHMON EGA AMALLARINI KO'RMAYDI ───────────────────────────────
// Eng muhim shart: menyu mehmonga ochilganda bo'lim UMUMAN
// chizilmasligi kerak, "o'chirilgan tugma" ko'rinishida ham emas.
{
  checkTrue('3) menyu ownerActions ni qabul qiladi', /ownerActions = \[\]/.test(menu));
  checkTrue('3) bo‘lim faqat amal bo‘lsa chiziladi', /ownerActions\.length > 0 && \(/.test(menu));
  checkTrue('3) mehmonda ro‘yxat bo‘sh', /isOwner \? \[[\s\S]*?\] : \[\]/.test(profile));
  checkTrue('3) "Egasi uchun" sarlavhasi bor', menu.includes("t('Egasi uchun')"));
}

// ── 4) MEHMON AMALLARI FAQAT MEHMONGA ────────────────────────────────
// Ega uchun bu qator umuman chizilmaydi — aks holda ega o'ziga
// "Obuna bo'lish" tugmasini ko'rardi.
{
  checkTrue('4) mehmon qatori shart bilan chiziladi',
    /\{!isOwner && \(\s*<div className="flex flex-wrap items-center justify-end/.test(profile));
  checkTrue('4) obuna tugmasi shu yerda', /Obuna bo'lish|Obunani bekor qilish/.test(profile));
}

// ── 5) TOP NISHONI — KICHIK VA ISM OSTIDA ────────────────────────────
// Ilgari u sahifaning eng tepasida, alohida katta blok edi va
// profilning birinchi taassurotini o'ziga tortardi.
{
  checkTrue('5) TOP nishoni tarif yonida', /\(tier !== 'free' \|\| topRank\) && \(/.test(profile));
  checkTrue('5) qisqa yozuv ishlatiladi', profile.includes("t('TOP #{n}', { n: topRank })"));
  // Eski katta blok qaytib kelmasin.
  checkTrue('5) tepadagi katta TOP bloki yo‘q',
    !/\{topRank && <span className=\{`\$\{badge\}/.test(profile));
}

// ── 6) TEPA QATORI — TO'RT NARSA ─────────────────────────────────────
{
  checkTrue('6) orqaga tugmasi bor', profile.includes("aria-label={t('Bosh sahifaga')}"));
  checkTrue('6) nusxalash bor', profile.includes("aria-label={t('Nusxalash')}"));
  checkTrue('6) ulashish bor', /<ShareButton/.test(profile));
  checkTrue('6) ⋮ menyusi bor', /<ProfileMoreMenu/.test(profile));
}

// ── 7) STORY VA POST AJRALGANICHA QOLADI ─────────────────────────────
// Tepani tozalash paytida ular qayta birlashtirilmasin.
{
  checkTrue('7) story va post amallari alohida',
    /'story'\)\) \}/.test(profile) && /'post'\)\) \}/.test(profile));
  checkTrue('7) lenta va postlar tablari alohida', /id: 'lenta'/.test(profile) && /id: 'postlar'/.test(profile));
}

done('Ochiq profil tepasi');
