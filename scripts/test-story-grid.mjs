// LENTA KATAGI HECH QACHON "SHUNCHAKI QORA" BO'LMASIN
//
// SHIKOYAT (production, VIP001). "Stories 7" deb yozilgan, lekin
// ekranda bitta rasm ko'rinib, qolgan olti katak qop-qora turardi.
// Ya'ni SON to'g'ri, MEDIA esa chizilmagan.
//
// Sabab kodda edi va u IKKI XIL bo'lishi mumkin — ikkalasi ham
// ekranda BIR XIL qora to'rtburchak beradi:
//
//   1) VIDEO katagi `<video preload="metadata">` edi, `poster` esa
//      yo'q. `preload="metadata"` brauzerga "kadr OLMA" deydi, ya'ni
//      element bor-u, ichida ko'rsatadigan piksel yo'q.
//   2) `<img>` da `onError` UMUMAN yo'q edi: fayl 404 bo'lsa, buzuq
//      bo'lsa yoki qatorda havolaning o'zi bo'lmasa (`src=""`) rasm
//      JIM yiqilardi va katak fonining rangi ko'rinardi — u ham qora.
//
// Shuning uchun productionda sababni aniqlab bo'lmasdi: "fayl yo'q"
// bilan "video kadr bermadi" farq qilmasdi.
//
// Bu test o'sha yechimni qo'riqlaydi. TEKSHIRILADIGAN SHART BITTA:
// katakda yo HAQIQATAN chizilgan media, yo NOMLANGAN qatlam bo'lsin.
// Ya'ni:
//   • media faqat CHIZILGANDAN KEYIN ko'rinadi (opacity bilan) —
//     bo'sh `<video>` ning qora qutisi ostidagi qatlamni qoplamaydi;
//   • ikkala media turida ham `onError` bor va u konsolga SABABINI
//     yozadi;
//   • ro'yxat kesilmaydi — nechta story kelsa, shuncha katak.
//
// Brauzerdagi haqiqiy tekshiruv alohida o'tkazildi (7 ta story:
// 1 rasm + 6 video, hamda 404 / buzuq / havolasiz qatorlar bilan) —
// tuzatishdan oldin 2-4 ta qora katak chiqqan, keyin 0 ta.
//
//   node scripts/test-story-grid.mjs
import { readFileSync } from 'node:fs';
import { makeChecker } from './lib/d1-harness.mjs';
import { stripComments } from './lib/strip-comments.mjs';
import { storyMediaKind, storyMediaUrl, videoPosterSrc } from '../src/lib/story-media.js';

const { check, checkTrue, done } = makeChecker();
const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');
const grid = stripComments(read('../src/components/StoryGrid.jsx'));
const viewer = stripComments(read('../src/components/StoryViewer.jsx'));
const css = read('../src/theme.css');

// ── 1) MEDIA TURI — SOF FUNKSIYA ─────────────────────────────────────
// Lenta ham, to'liq ekran ham bitta qoidaga tayanishi uchun bu
// mantiq alohida faylga chiqarilgan va shu yerda to'g'ridan-to'g'ri
// chaqiriladi (manba matnini o'qib emas).
{
  check('1) video qator -> video', storyMediaKind({ videoUrl: '/uploads/a.mp4' }), 'video');
  check('1) rasm qator -> image', storyMediaKind({ imageUrl: '/uploads/a.jpg' }), 'image');
  check('1) ikkalasi bo‘sh -> none', storyMediaKind({ imageUrl: '', videoUrl: '' }), 'none');
  check('1) qator yo‘q -> none', storyMediaKind(null), 'none');
  // Eski qatorda ikkalasi to'lgan bo'lishi mumkin — video ustun.
  check('1) ikkalasi bor -> video', storyMediaKind({ imageUrl: '/a.jpg', videoUrl: '/a.mp4' }), 'video');
  check('1) havola turiga mos keladi', storyMediaUrl({ imageUrl: '/a.jpg', videoUrl: '/a.mp4' }), '/a.mp4');
  check('1) media yo‘q -> bo‘sh havola', storyMediaUrl({}), '');
}

// ── 2) VIDEODAN BIRINCHI KADR ────────────────────────────────────────
{
  check('2) fragment qo‘shiladi', videoPosterSrc('/uploads/s.mp4'), '/uploads/s.mp4#t=0.1');
  // Ikkita `#` bo'lgan manzil yaroqsiz — bori saqlanadi.
  check('2) mavjud fragmentga tegilmaydi', videoPosterSrc('/uploads/s.mp4#t=2'), '/uploads/s.mp4#t=2');
  check('2) bo‘sh havola bo‘sh qoladi', videoPosterSrc(''), '');
  check('2) null ham bo‘sh', videoPosterSrc(null), '');
  // Nisbiy havola NISBIY qolsin: `/uploads/...` o'z domenimizdan
  // ochilishi kerak, aks holda R2 fayli begona manzilga ketardi.
  checkTrue('2) nisbiy havola o‘zgarmaydi', videoPosterSrc('/uploads/s.mp4').startsWith('/uploads/'));
}

// ── 3) MEDIA CHIZILGUNCHA KO'RINMAYDI ────────────────────────────────
// Eng muhim shart. `<video>` hali kadr olmagan bo'lsa ham element
// chizilgan bo'ladi va QORA ko'rinadi. Shuning uchun u tayyor
// bo'lgunicha shaffof turishi, ostidagi nomlangan qatlam esa
// ko'rinib turishi kerak.
{
  checkTrue('3) media opacity bilan yopilgan', /opacity:\s*state === 'ready'/.test(grid));
  checkTrue('3) video birinchi KADRDA ochiladi', /onLoadedData=\{\(\) => setState\('ready'\)\}/.test(grid));
  checkTrue('3) rasm YUKLANGACH ochiladi', /onLoad=\{\(\) => setState\('ready'\)\}/.test(grid));
}

// ── 4) HAR IKKALA MEDIADA HAM onError ────────────────────────────────
// Aynan shuning yo'qligi "jim qora katak" ni keltirib chiqargan edi.
{
  const onErrors = grid.match(/onError=\{\(\) => fail\('[a-z_]+'\)\}/g) || [];
  check('4) ikkala turda ham onError bor', onErrors.length, 2);
  checkTrue('4) rasm xatosi alohida sabab', grid.includes("fail('image_load_failed')"));
  checkTrue('4) video xatosi alohida sabab', grid.includes("fail('video_load_failed')"));
}

// ── 5) SABAB KONSOLGA YOZILADI ───────────────────────────────────────
// Ekranda odam uchun qisqa jumla; konsolda esa dasturchi uchun
// AYNAN qaysi story va qaysi havola ekani.
{
  const warn = /console\.warn\('\[story\] media ochilmadi',\s*\{([^}]*)\}/.exec(grid);
  checkTrue('5) console.warn bor', !!warn);
  for (const field of ['id', 'kind', 'url', 'reason']) {
    checkTrue(`5) konsolda "${field}" bor`, !!warn && new RegExp(`\\b${field}\\b`).test(warn[1]));
  }
}

// ── 6) XATO HOLATI EKRANDA KO'RINADI ─────────────────────────────────
// Telefonda konsol ochib bo'lmaydi — sabab EKRANNING O'ZIDA
// ko'rinishi kerak.
{
  checkTrue('6) xato qatlami chiziladi', /pf-story-ph/.test(grid));
  checkTrue('6) xato holati alohida sinf oladi', /is-err/.test(grid));
  checkTrue('6) xato matni o‘zbekcha', grid.includes("t('Media ochilmadi')"));
  checkTrue('6) video kutayotganda "Video" deb turadi', grid.includes("t('Video')"));
  // Qatlam CSS da haqiqatan mavjud bo'lsin — sinf nomi kodda bor-u,
  // uslub yo'q bo'lsa, katak baribir bo'm-bo'sh ko'rinardi.
  checkTrue('6) .pf-story-ph uslubi bor', css.includes('.pf-story-ph{'));
  checkTrue('6) .pf-story-ph.is-err uslubi bor', css.includes('.pf-story-ph.is-err{'));
  checkTrue('6) qatlam katakni to‘liq qoplaydi', /\.pf-story-ph\{[^}]*inset:0/.test(css));
}

// ── 7) RO'YXAT KESILMAYDI ────────────────────────────────────────────
// Nechta story kelsa — shuncha katak. `slice` yoki qattiq son
// qo'shilsa, "son 7, katak 3" degan yangi chalkashlik paydo bo'lardi.
{
  checkTrue('7) hamma story chiziladi', /list\.map\(\(s, i\) =>/.test(grid));
  checkTrue('7) ro‘yxat kesilmaydi', !/list\.slice\(/.test(grid));
  // Tab dagi son ham shu ro'yxatdan olinadi.
  const profile = stripComments(read('../src/pages/ProfilePage.jsx'));
  checkTrue('7) tabdagi son shu ro‘yxatdan', /count:\s*stories\.length/.test(profile));
  checkTrue('7) lentaga aynan shu ro‘yxat beriladi', /<StoryGrid stories=\{stories\}/.test(profile));
}

// ── 8) BOSILGAN STORY OCHILADI ───────────────────────────────────────
// 3-katak bosilsa 3-story ochilishi kerak, 1-chisi emas.
{
  checkTrue('8) katak o‘z o‘rnini beradi', /onOpen=\{\(\) => setOpenAt\(i\)\}/.test(grid));
  checkTrue('8) ko‘ruvchiga o‘rin uzatiladi', /startIndex=\{openAt\}/.test(grid));
  checkTrue('8) ko‘ruvchi o‘rinni qabul qiladi', /startIndex = 0/.test(viewer));
  checkTrue('8) chiziqchalar soni ro‘yxatdan', /list\.map\(\(s, i\) =>/.test(viewer));
  // To'liq ekranda video AYNAN video bo'lib ochilsin.
  checkTrue('8) ko‘ruvchida video <video> bo‘ladi', /current\.videoUrl\s*\?[\s\S]{0,200}<video/.test(viewer));
}

done('Lenta katagi');
