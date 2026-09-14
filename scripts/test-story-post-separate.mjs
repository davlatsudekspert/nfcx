// STORY VA POST — IKKI ALOHIDA ISH (2026-09).
//
// Egasining xabari: "story qo'ysam saqlash bo'lmayapti, shuning uchun
// post ham qo'yishga to'g'ri kelyapti".
//
// SABABI — IKKI NUSXA. Story bloki ikki joyda ikki xil yozilgan edi:
//   • "Stories va post" bo'limida — tasdiqlash rejimi bilan, ya'ni
//     fayl tanlangach ko'rinadi va "Storyni saqlash" tugmasi chiqadi;
//   • "Stories" tugmasi ochadigan OYNADA — usiz: fayl tanlangan
//     zahoti e'lon qilinardi va SAQLASH TUGMASI UMUMAN YO'Q edi.
// Yonidagi "Post" oynasida esa "Postni saqlash" turardi — shuning
// uchun odam "story postsiz saqlanmaydi" degan xulosaga kelgan.
//
// Bu test o'sha qarorni qo'riqlaydi: BARCHA yuklash maydonlari
// tasdiqlash rejimida va HAR BIRINING O'Z saqlash tugmasi bor.
//
//   node scripts/test-story-post-separate.mjs
import { readFileSync } from 'node:fs';
import { makeChecker } from './lib/d1-harness.mjs';

const { check, checkTrue, done } = makeChecker();

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');
const account = read('../src/pages/AccountPage.jsx');
const company = read('../src/pages/CompanyWorkspacePage.jsx');
const uploader = read('../src/components/StoryUploader.jsx');
const companyCss = read('../src/company-system.css');

// JSX izohlari ({/* ... */}) tekshiruvni chalg'itmasin: ular ichida
// ham "confirm", "saveLabel" kabi so'zlar uchraydi.
const strip = (src) => src.replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

// ── 1) HAR BIR <StoryUploader> TASDIQLASH REJIMIDA ────────────────────
// `confirm` bo'lmasa fayl tanlangan zahoti e'lon qilinadi va odam
// saqlash tugmasini umuman ko'rmaydi.
for (const [name, src] of [['AccountPage', account], ['CompanyWorkspacePage', company]]) {
  const body = strip(src);
  const uses = [...body.matchAll(/<StoryUploader\b([\s\S]*?)\/>/g)].map((m) => m[1]);
  checkTrue(`1) ${name}: <StoryUploader> topildi`, uses.length > 0);
  uses.forEach((props, i) => {
    checkTrue(`1) ${name} #${i + 1}: confirm rejimi yoqilgan`, /\bconfirm\b/.test(props));
    checkTrue(`1) ${name} #${i + 1}: o‘z saveLabel'i bor`, /saveLabel=/.test(props));
    checkTrue(`1) ${name} #${i + 1}: hint yozilgan`, /hint=/.test(props));
  });
}

// ── 2) STORY BLOKI BITTA NUSXADA ──────────────────────────────────────
// Ikkinchi nusxa paydo bo'lsa, tuzatish yana faqat bittasiga tushadi.
const uploadersInAccount = (strip(account).match(/<StoryUploader\b/g) || []).length;
check('2) AccountPage da story yuklagich bitta', uploadersInAccount, 1);
checkTrue('2) StorySection StoriesManager ni chaqiradi',
  /function StorySection[\s\S]*?<StoriesManager\b/.test(strip(account)));
checkTrue('2) "Stories" oynasi ham StoriesManager ni chaqiradi',
  /storyOpen && \([\s\S]{0,400}<StoriesManager\b/.test(strip(account)));

// ── 3) SAQLASH TUGMASI VA NATIJA XABARI ───────────────────────────────
checkTrue('3) StoriesManager da "Storyni saqlash" yozuvi bor',
  /function StoriesManager[\s\S]*?saveLabel=\{t\('Storyni saqlash'\)\}/.test(account));
checkTrue('3) StoriesManager saqlangach xabar ko‘rsatadi',
  /function StoriesManager[\s\S]*?setMsg\(t\('Story joylandi\.'\)\)/.test(account));

// ── 4) YUKLAGICHNING O'ZI ─────────────────────────────────────────────
// `confirm` yoqilganda `onSubmit` FAYL TANLANGANDA emas, SAQLASH
// tugmasi bosilganda chaqirilishi kerak.
checkTrue('4) confirm da fayl tanlangach faqat ko‘rib chiqish',
  /if \(confirm\) setPending\(payload\);\s*\n?\s*else await onSubmit\(payload\);/.test(uploader));
checkTrue('4) saqlash tugmasi onSubmit ni chaqiradi', /const save = async \(\) => \{[\s\S]*?await onSubmit\(pending\)/.test(uploader));
checkTrue('4) saqlash tugmasi saveLabel bilan yoziladi', /\{busy \? t\('Saqlanmoqda…'\) : \(saveLabel \|\| t\('Saqlash'\)\)\}/.test(uploader));

// ── 5) VIDEO STORY KO'RINADI ──────────────────────────────────────────
// Ilgari ro'yxatda faqat `<img>` bor edi va video story singan rasm
// bo'lib chiqardi.
checkTrue('5) StoriesManager videoni ham chizadi',
  /function StoriesManager[\s\S]*?st\.videoUrl\s*\n?\s*\?\s*<video/.test(account));
checkTrue('5) Kompaniya lentasi videoni ham chizadi', /st\.videoUrl\s*\n?\s*\?\s*<video/.test(company));
checkTrue('5) CSS video eskizini ham o‘lchaydi', /\.cw-feed-item img,\.cw-feed-item video\{/.test(companyCss));

// ── 6) IZOH MATNI — IKKISI MUSTAQIL EKANI YOZILGAN ────────────────────
const NOTE = 'Story va post — ikki alohida ish.';
checkTrue('6) Kabinetda izoh bor', account.includes(NOTE));
checkTrue('6) Kompaniya kabinetida ham izoh bor', company.includes(NOTE));
checkTrue('6) .cw-note uslubi global emas, kompaniya CSS ida', /\.cw-note\{/.test(companyCss));

// ── 7) TARJIMALAR ─────────────────────────────────────────────────────
const dict = read('../src/lib/translations.account.js');
for (const key of ['Storyni saqlash', 'Postni saqlash', '{n}/10 story', 'Stories va postlar']) {
  checkTrue(`7) tarjima bor: ${key}`, dict.includes(`'${key}'`));
}

done('Story va post mustaqilligi');
