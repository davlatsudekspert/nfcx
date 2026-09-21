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
const cluster = read('../src/components/ProfileActionCluster.jsx');

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
  // 2026-09: nusxalash/ulashish/⋮ endi SAHIFADA emas, umumiy
  // `ProfileActionCluster` da. Sahifa faqat uni chaqiradi — shuning
  // uchun tekshiruv ikki bosqichli: chaqiruv bormi va to'plamning
  // O'ZIDA uchalasi bormi. Ilgari bu yerda satr ichidagi markup
  // tekshirilardi va biznes profil o'z nusxasini yozib ketgandi.
  checkTrue('6) sahifa umumiy amallar to‘plamini chaqiradi', /<ProfileActionCluster/.test(profile));
  checkTrue('6) nusxalash bor', cluster.includes("aria-label={t('Nusxalash')}"));
  checkTrue('6) ulashish bor', /<ShareButton/.test(cluster));
  checkTrue('6) ⋮ menyusi bor', /<ProfileMoreMenu/.test(cluster));
}

// ── 7) STORY VA POST AJRALGANICHA QOLADI ─────────────────────────────
// Tepani tozalash paytida ular qayta birlashtirilmasin.
{
  checkTrue('7) story va post amallari alohida',
    /'story'\)\) \}/.test(profile) && /'post'\)\) \}/.test(profile));
  checkTrue('7) lenta va postlar tablari alohida', /id: 'lenta'/.test(profile) && /id: 'postlar'/.test(profile));
}

// ── 8) ⋮ MENYUSI AVATAR OSTIDA QOLMAYDI ──────────────────────────────
// SHIKOYAT (2026-09, egasi): menyu ochilsa o'rtasi berkilib qolardi —
// mavzu qatorlari o'qilmasdi.
//
// SABAB. Menyu o'z o'ramida `absolute z-50` bilan chizilardi, avatar
// esa `z-10`. Raqamlarga qaraganda menyu yutishi kerak edi, lekin
// `z-index` faqat O'Z QATLAM KONTEKSTI ichida taqqoslanadi: menyu
// ustidagi `.pf-card-actions` (`z-index:3`) va `.pf-actions`
// (`backdrop-filter`) ikkalasi ham yangi kontekst ochadi, ya'ni butun
// menyu sahifada "3" bo'lib turardi va avatarning "10" i ustun kelardi.
// Shuning uchun `z-50` ni `z-9999` ga o'zgartirish YORDAM BERMASDI.
//
// YECHIM. Menyu `document.body` ga (`AnchoredMenu` → `createPortal` +
// `position:fixed`) chiqariladi — u yerda hech qanday o'ram yo'q.
// Brauzerda 390×844 da o'lchandi (`elementFromPoint`, menyu bo'yi
// bo'ylab 9 nuqta): /vip001, /aaa001 va /c/demo — berkilgan nuqta 0.
//
// Bu tekshiruv AYNAN SABABNI qo'riqlaydi: menyu qaytib o'z o'ramida
// `absolute` bo'lib qolsa, xato ham qaytadi.
{
  checkTrue('8) ⋮ menyusi portal orqali chiziladi (o‘ramdan tashqarida)',
    /from '\.\/AnchoredMenu\.jsx'/.test(menu) && /<AnchoredMenu/.test(menu));
  const anchored = read('../src/components/AnchoredMenu.jsx');
  checkTrue('8) `AnchoredMenu` haqiqatan `document.body` ga chiqaradi',
    /createPortal\(/.test(anchored) && /document\.body/.test(anchored));
  checkTrue('8) menyu ekranga nisbatan turadi', /position: 'fixed'/.test(anchored));
  // Eski usul QAYTIB KELMASIN.
  checkTrue('8) ⋮ menyusi o‘ramida `absolute` bilan chizilmaydi',
    !/className="absolute/.test(menu) && !/absolute right-0 z-/.test(menu));
  // ⋮ ekran chetida turadi — menyu chapga tenglashsa ekrandan chiqardi.
  checkTrue('8) menyu o‘ng qirra bo‘yicha tenglashadi', /align: 'right'/.test(menu));
  // Menyu uzun (mavzular + tillar) va o'z ichida siljiydi; umumiy
  // "siljidi — yop" qoidasi uni birinchi harakatdayoq yopib qo'yardi.
  checkTrue('8) ichki siljish menyuni yopmaydi',
    /onScroll = \(e\) => \{ if \(!e\.target\?\.closest\?\.\('\[data-anchored-menu\]'\)\) close/.test(anchored) && /'scroll', onScroll/.test(anchored));
  // Menyuni ochgan tugma "tashqari" emas — aks holda `mousedown`
  // yopar, ketidan kelgan `click` qayta ochardi va tugma yopolmasdi.
  checkTrue('8) ⋮ tugmasi menyuni yopa oladi',
    /data-anchored-anchor/.test(menu) && /data-anchored-anchor/.test(anchored));
}

done('Ochiq profil tepasi');
