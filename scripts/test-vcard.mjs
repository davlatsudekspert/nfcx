// KONTAKTNI SAQLASH (vCard) — UCHALA PROFILDA HAM, BITTA YOZUVCHI
//
// NFC kartaning butun ma'nosi shu: odam tegizadi, sahifani yopadi —
// va raqamingiz uning telefonida QOLADI. Qo'ng'iroq yoki Telegram
// havolasi sahifa yopilgach hech qanday iz qoldirmaydi.
//
// Topilgan ikki xato:
//   1) BIZNES NFC profilida bu tugma UMUMAN yo'q edi (shaxsiy va
//      kompaniya sahifasida bor edi);
//   2) shaxsiy profil `src/lib/vcard.js` ni ishlatmasdi — o'z, ancha
//      yomon nusxasi bor edi: vergul/nuqta-vergul QALQONLANMASDI,
//      qatorlar CRLF emas `\n` bilan ulanardi (iOS bunday faylni
//      ba'zan ochmaydi) va `NOTE2:` degan mavjud bo'lmagan maydon
//      yozilardi. Ustiga-ustak `vcard.js` izohida "shaxsiy profil
//      ham shuni ishlatadi" deb yozib qo'yilgandi.
//
//   node scripts/test-vcard.mjs
import { readFileSync } from 'node:fs';
import { makeChecker } from './lib/d1-harness.mjs';
import { stripComments } from './lib/strip-comments.mjs';
import { buildVcard } from '../src/lib/vcard.js';

const { check, checkTrue, done } = makeChecker();
const read = (rel) => stripComments(readFileSync(new URL(rel, import.meta.url), 'utf8'));

// ── 1) UCHALA PROFILDA HAM TUGMA BOR ─────────────────────────────────
{
  const files = [
    ['shaxsiy', '../src/pages/ProfilePage.jsx'],
    ['biznes', '../src/components/BusinessPublicProfile.jsx'],
    ['kompaniya', '../src/pages/CompanyQuickProfilePage.jsx'],
  ];
  for (const [name, rel] of files) {
    const src = read(rel);
    checkTrue(`1) ${name}: "Kontaktni saqlash" bor`, /t\('Kontaktni saqlash'\)/.test(src));
    // HAMMASI umumiy yozuvchini ishlatsin — to'rtinchi nusxa
    // paydo bo'lmasin.
    checkTrue(`1) ${name}: umumiy vcard.js ishlatiladi`, /downloadVcard\(/.test(src));
    checkTrue(`1) ${name}: o‘z BEGIN:VCARD nusxasi yo‘q`, !/BEGIN:VCARD/.test(src));
  }
}

// ── 2) QALQONLASH — VERGULLI ISM KARTANI BUZMASIN ────────────────────
// O'zbekistonda "Ism, Familiya" va manzilda vergul odatiy.
{
  const out = buildVcard({
    name: 'Ali, Valiyev',
    org: 'NFCSTORE; MChJ',
    title: 'Direktor, asoschi',
    phone: '+998901234567',
    note: 'Toshkent, Amir Temur 1\nIkkinchi qator',
    urls: ['https://nfcstore.uz/vip001'],
  });
  checkTrue('2) vergul qalqonlangan', out.includes('FN:Ali\\, Valiyev'));
  checkTrue('2) nuqta-vergul qalqonlangan', out.includes('ORG:NFCSTORE\; MChJ'));
  checkTrue('2) lavozimdagi vergul ham', out.includes('TITLE:Direktor\\, asoschi'));
  checkTrue('2) yangi qator qalqonlangan', out.includes('\\n'));
  // Qalqonlanmagan vergul QOLMASIN (faqat qalqonlanganlari bo'lsin).
  const bare = out.split('\r\n').filter((l) => /(^|[^\\]),/.test(l));
  check('2) qalqonlanmagan vergul yo‘q', bare.join(' | '), '');
}

// ── 3) CRLF — iOS TALABI ─────────────────────────────────────────────
{
  const out = buildVcard({ name: 'Test', phone: '+998901234567' });
  checkTrue('3) qatorlar CRLF bilan', out.includes('\r\n'));
  checkTrue('3) yolg‘iz \\n yo‘q', !/[^\r]\n/.test(out));
  checkTrue('3) BEGIN va END joyida', out.startsWith('BEGIN:VCARD') && out.endsWith('END:VCARD'));
  checkTrue('3) versiya ko‘rsatilgan', out.includes('VERSION:3.0'));
}

// ── 4) MAVJUD BO'LMAGAN MAYDON YOZILMAYDI ────────────────────────────
// `NOTE2:` vCard standartida YO'Q — telefon uni tashlab yuboradi yoki
// faylni buzuq deb hisoblaydi.
{
  const out = buildVcard({ name: 'Test', note: 'izoh', urls: ['https://nfcstore.uz/x'] });
  checkTrue('4) NOTE2 yo‘q', !out.includes('NOTE2'));
  checkTrue('4) havola URL: sifatida', out.includes('URL:https://nfcstore.uz/x'));
  checkTrue('4) izoh NOTE: sifatida', out.includes('NOTE:izoh'));
  const profile = read('../src/pages/ProfilePage.jsx');
  checkTrue('4) shaxsiy profilda ham NOTE2 qolmagan', !/NOTE2/.test(profile));
}

// ── 5) BO'SH MAYDONLAR QATOR YARATMAYDI ──────────────────────────────
// Bo'sh `TEL:` yozilsa ba'zi telefonlar bo'sh kontakt yaratadi.
{
  const out = buildVcard({ name: 'Faqat ism' });
  checkTrue('5) bo‘sh TEL yo‘q', !/^TEL/m.test(out));
  checkTrue('5) bo‘sh EMAIL yo‘q', !/^EMAIL/m.test(out));
  checkTrue('5) bo‘sh ORG yo‘q', !/^ORG/m.test(out));
  check('5) faqat kerakli qatorlar', out.split('\r\n').length, 4); // BEGIN, VERSION, FN, END
}

// ── 6) YASHIRILGAN RAQAM CHIQMAYDI ───────────────────────────────────
// `hidePhone` — egasining tanlovi. U kontaktga ham tushmasligi kerak,
// aks holda yashirish ma'nosiz bo'lardi.
{
  for (const [name, rel] of [['shaxsiy', '../src/pages/ProfilePage.jsx'], ['biznes', '../src/components/BusinessPublicProfile.jsx']]) {
    const src = read(rel);
    checkTrue(`6) ${name}: yashirilgan raqam vCard ga tushmaydi`,
      /phone: \(record\.phone && !record\.hidePhone\) \? record\.phone : ''/.test(src));
  }
}

done('Kontaktni saqlash (vCard)');
