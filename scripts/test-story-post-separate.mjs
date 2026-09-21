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
import { stripComments } from './lib/strip-comments.mjs';

const { check, checkTrue, done } = makeChecker();

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');
const account = read('../src/pages/AccountPage.jsx');
const company = read('../src/pages/CompanyWorkspacePage.jsx');
const uploader = read('../src/components/StoryUploader.jsx');
const companyCss = read('../src/company-system.css');

// Izohlar tekshiruvni chalg'itmasin: ular ichida ham "confirm",
// "saveLabel" kabi so'zlar uchraydi.
//
// Ilgari bu ish regex bilan qilinardi va u `accept="image/*"` dagi
// `/*` ni izoh boshi deb o'qib, 117 KB tirik kodni o'chirib yuborardi
// (qarang: scripts/lib/strip-comments.mjs). Endi manba holatini
// biladigan skaner ishlatiladi.
const strip = stripComments;

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

// ── 6) IKKALASI ALOHIDA BO'LIM ────────────────────────────────────────
// Ilgari story va post BITTA "lenta" bo'limida ustma-ust turardi.
// Ikkala forma ham bir xil ko'rinardi va odam nima yaratayotganini
// bilmasdi — "saqladim, lekin qayerga ketdi?" degan savol shundan
// edi. Endi ajralish MATNDA emas, TUZILISHDA: alohida bo'lim,
// alohida manzil, alohida sarlavha.
checkTrue('6) "stories" bo‘limi bor', /wsTab === 'stories' &&/.test(account));
checkTrue('6) "postlar" bo‘limi bor', /wsTab === 'postlar' &&/.test(account));
// Eski birlashtirilgan bo'lim qaytib kelmasin.
checkTrue('6) eski birlashgan "lenta" bo‘limi yo‘q', !/wsTab === 'lenta' &&/.test(account));

// Navigatsiyada ham ikkita alohida yozuv.
checkTrue('6) navigatsiyada Stories', /\['stories', t\('Stories'\)/.test(account));
checkTrue('6) navigatsiyada Postlar', /\['postlar', t\('Postlar'\)/.test(account));

// Har biri qaysi ekanini O'ZI aytadi va ikkinchisiga yo'l ko'rsatadi.
checkTrue('6) story bo‘limi 24 soatni aytadi', /Story 24 soatdan keyin o/.test(account));
checkTrue('6) post bo‘limi DOIMIY ekanini aytadi', /Post profilda DOIMIY qoladi/.test(account));
checkTrue('6) storydan postga yo‘l bor', /setWsTab\('postlar'\)/.test(account));
checkTrue('6) postdan storyga yo‘l bor', /setWsTab\('stories'\)/.test(account));

// ── 6b) NIYAT O'Z BO'LIMIGA OLIB BORADI ───────────────────────────────
// `?action=story` postlar bo'limini ochsa (yoki aksincha), odam yana
// adashardi.
checkTrue('6b) action=story -> stories', /initialAction === 'story'\) return 'stories'/.test(account));
checkTrue('6b) action=post -> postlar', /initialAction === 'post'\) return 'postlar'/.test(account));
// Eski `#lenta` havolasi buzilmasin (xatcho'plar).
checkTrue('6b) eski #lenta havolasi ishlaydi', /hash === '#lenta'\) return 'stories'/.test(account));

// ── 6c) IKKALASI BIR VAQTDA CHIZILMAYDI ───────────────────────────────
// Bitta ekranda ikkala forma turgani chalkashlikning asl sababi edi.
{
  const storiesBlock = account.slice(account.indexOf("wsTab === 'stories' &&"),
    account.indexOf("wsTab === 'postlar' &&"));
  checkTrue('6c) Stories bo‘limida post boshqaruvi yo‘q', !/PostsManager/.test(storiesBlock));
  const postBlock = account.slice(account.indexOf("wsTab === 'postlar' &&"));
  const postBlockEnd = postBlock.slice(0, 2500);
  checkTrue('6c) Postlar bo‘limida story bloki yo‘q', !/<StorySection/.test(postBlockEnd));
}
// ── 6d) BIZNES KABINETI HAM AJRATILGAN ────────────────────────────────
// Kompaniyada ham ikkala forma bitta panelda turardi.
checkTrue('6d) biznesda "Postlar" tabi bor', /\['posts','Postlar'\]/.test(company));
checkTrue('6d) panel rejim bilan chaqiriladi', /mode="stories"/.test(company) && /mode="posts"/.test(company));
checkTrue('6d) story bo‘limi rejimga bog‘langan', /\{isStories && \(/.test(company));
checkTrue('6d) post bo‘limi rejimga bog‘langan', /\{!isStories && \(/.test(company));
checkTrue('6d) sarlavha rejimga qarab o‘zgaradi', /isStories \? t\('Stories'\) : t\('Postlar'\)/.test(company));
checkTrue('6d) ikkinchi bo‘limga yo‘l bor', /onSwitch/.test(company));
checkTrue('6) .cw-note uslubi global emas, kompaniya CSS ida', /\.cw-note\{/.test(companyCss));

// ── 7) TARJIMALAR ─────────────────────────────────────────────────────
const dict = read('../src/lib/translations.account.js');
for (const key of ['Storyni saqlash', 'Postni saqlash', '{n}/10 story', 'Stories va postlar']) {
  checkTrue(`7) tarjima bor: ${key}`, dict.includes(`'${key}'`));
}

done('Story va post mustaqilligi');
