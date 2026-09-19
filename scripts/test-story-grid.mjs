// LENTA KATAGI HECH QACHON "SHUNCHAKI QORA" BO'LMASIN
//
// SHIKOYAT (production, VIP001). "Stories 7" deb yozilgan, lekin
// ekranda ikkita rasm ko'rinib, qolgan beshta katak bo'm-bo'sh qora
// turardi — na "▶ Video", na "⚠ Media ochilmadi".
//
// BIRINCHI URINISH XATO EDI. Unda katakka holat berilgan
// (`loading → ready | error`), media esa `ready` bo'lgunicha
// `opacity:0` bilan YASHIRILGAN edi. Ya'ni ko'rinish BRAUZER
// HODISASIGA tayanardi. Telefonda so'rov osilib qolsa (sekin
// tarmoq, katta fayl, "Trafikni tejash") na `load`, na `error`
// chiqadi: rasm ko'rinmas bo'lib qolardi, ostidagi qatlam esa
// RASM uchun BO'SH chizilardi (matn faqat video va xatoga yozilgan
// edi). Natija — yana o'sha qora katak, endi izohsiz.
//
// Brauzerda media so'rovini ataylab osib qo'yib takrorlangan:
// eski kod 7 katakdan 7 tasini bo'm-bo'sh qoldirgan.
//
// HOZIRGI QOIDA — HODISAGA TAYANMAYDI:
//   • ostida HAR DOIM matnli qatlam bor ("Rasm" / "▶ Video" /
//     "⚠ Media ochilmadi") — hech qachon bo'sh emas;
//   • RASM yashirilmaydi: ma'lumot bo'lmasa shaffof, ostidagi
//     yozuv ko'rinadi; ma'lumot kelsa o'zi ustini yopadi;
//   • VIDEO kadr kelgunicha yopiq (bo'sh `<video>` qora chizishi
//     mumkin), lekin ostida "▶ Video" doim turadi;
//   • kadr borligi hodisadan HAM, elementning o'zidan (`readyState`)
//     HAM o'qiladi.
//
// Shuning uchun quyidagi tekshiruvlar "opacity bilan yashirish"
// qaytib kelishini ham, qatlam bo'sh qolishini ham taqiqlaydi.
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

// ── 3) RASM HECH QACHON YASHIRILMAYDI ────────────────────────────────
// Aynan shu yerda oldingi yechim yiqilgan edi. `<img>` ning
// ko'rinishi JS holatiga bog'lansa, hodisa chiqmagan taqdirda u
// abadiy ko'rinmas bo'lib qoladi.
{
  const img = /<img[\s\S]*?\/>/.exec(grid);
  checkTrue('3) <img> topildi', !!img);
  checkTrue('3) <img> da opacity/visibility/display bilan yashirish YO‘Q',
    !!img && !/opacity|visibility|display\s*:/.test(img[0]));
  checkTrue('3) <img> da loading="lazy" yo‘q (hodisa kechikishining sababi edi)',
    !/loading=\{?['"]?lazy/.test(grid));
}

// ── 3b) VIDEO KADR KELGUNICHA YOPIQ ──────────────────────────────────
// Bo'sh `<video>` ba'zi brauzerlarda QORA to'rtburchak chizadi va
// ostidagi yozuvni bosib qo'yardi. Bu xavfsiz, chunki uning ostida
// "▶ Video" doim turadi (4-bo'limda tekshiriladi).
{
  checkTrue('3b) video kadrga qarab ochiladi', /opacity:\s*hasFrame/.test(grid));
  checkTrue('3b) kadr hodisadan o‘qiladi', /onLoadedData=\{\(\) => setHasFrame\(true\)\}/.test(grid));
  // Kesh dan kelgan media hodisani o'tkazib yuborishi mumkin —
  // shuning uchun element holati ham so'raladi.
  checkTrue('3b) kadr elementning O‘ZIDAN ham o‘qiladi', /readyState >= 2/.test(grid));
  checkTrue('3b) video xatosi ham elementdan o‘qiladi', /el\.error/.test(grid));
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

// ── 6) QATLAM HAR DOIM VA MATN BILAN ────────────────────────────────
// Telefonda konsol ochib bo'lmaydi — sabab EKRANNING O'ZIDA
// ko'rinishi kerak. Eski yechimda bu qatlam SHARTGA bog'langan edi
// (`shown !== 'ready' && ...`) va rasm uchun BO'SH chizilardi.
{
  // Qatlam shartsiz chiziladi: `{shart && <span ...>}` bo'lmasin.
  checkTrue('6) qatlam SHARTSIZ chiziladi',
    /<span\s+className=\{`pf-story-ph/.test(grid) && !/&&\s*\(?\s*<span className=\{`pf-story-ph/.test(grid));
  // Ichida har doim belgi va matn bor.
  checkTrue('6) qatlamda belgi bor', /<b>\{mark\}<\/b>/.test(grid));
  checkTrue('6) qatlamda matn bor', /<i>\{label\}<\/i>/.test(grid));
  // Uch holatning HAR BIRI uchun matn.
  checkTrue('6) xato matni', grid.includes("t('Media ochilmadi')"));
  checkTrue('6) video matni', grid.includes("t('Video')"));
  checkTrue('6) rasm matni (eski yechimda YO‘Q edi)', grid.includes("t('Rasm')"));
  checkTrue('6) xato holati alohida sinf oladi', /is-err/.test(grid));
  // Uslublar haqiqatan mavjud bo'lsin.
  checkTrue('6) .pf-story-ph uslubi bor', css.includes('.pf-story-ph{'));
  checkTrue('6) .pf-story-ph.is-err uslubi bor', css.includes('.pf-story-ph.is-err{'));
  checkTrue('6) qatlam katakni to‘liq qoplaydi', /\.pf-story-ph\{[^}]*inset:0/.test(css));
  // QATLAM ENG OSTDA, MEDIA USTIDA — aks holda yozuv rasmni bosardi.
  checkTrue('6) qatlam eng ostda (z-index:0)', /\.pf-story-ph\{[^}]*z-index:0/.test(css));
  checkTrue('6) media qatlam ustida (z-index:1)', /\.pf-story-media\{[^}]*z-index:1/.test(css));
  checkTrue('6) media foni shaffof', /\.pf-story-media\{[^}]*background:transparent/.test(css));
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
