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
import { mediaKind, mediaUrl, videoPosterSrc } from '../src/lib/media.js';

const { check, checkTrue, done } = makeChecker();
const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');
const grid = stripComments(read('../src/components/StoryGrid.jsx'));
const viewer = stripComments(read('../src/components/StoryViewer.jsx'));
const css = read('../src/theme.css');

// ── 1) MEDIA QATLAMI — UMUMIY KOMPONENTDAN ──────────────────────────
// "Media kelmasa nima ko'rsatamiz?" degan savolga javob endi bitta
// joyda: `MediaThumb`. Uning qoidalarini scripts/test-media-guard.mjs
// qo'riqlaydi. Bu yerda faqat LENTA o'sha komponentdan foydalanishi
// tekshiriladi — xom `<img>`/`<video>` qaytib kelmasin.
{
  checkTrue('1) lenta MediaThumb ishlatadi', /<MediaThumb/.test(grid));
  checkTrue('1) xom <img> yo‘q', !/<img\s/.test(grid));
  checkTrue('1) xom <video> yo‘q', !/<video\s/.test(grid));
  checkTrue('1) media qatlamga izoh bilan havola bor',
    /MediaThumb\.jsx/.test(readFileSync(new URL('../src/components/StoryGrid.jsx', import.meta.url), 'utf8')));
}

// ── 2) KATTA ▶ FAQAT KADR CHIZILGANDA ───────────────────────────────
// Kadr yo'q bo'lsa qatlamda allaqachon "▶ Video" yozilgan turadi;
// ikkita belgi bir-birining ustiga tushsa chalkash bo'lardi.
{
  checkTrue('2) katta ▶ standart holatda yopiq', /\.pf-story-play\{display:none/.test(css));
  checkTrue('2) katta ▶ faqat "ok" holatda ochiladi',
    /\.mt-wrap\[data-media-state="ok"\] ~ \.pf-story-play\{display:grid\}/.test(css));
  checkTrue('2) ▶ faqat video katakda chiziladi', /kind === 'video' && <span className="pf-story-play"/.test(grid));
}

// ── 3) RO'YXAT KESILMAYDI ────────────────────────────────────────────
// Nechta story kelsa — shuncha katak. `slice` yoki qattiq son
// qo'shilsa, "son 7, katak 3" degan yangi chalkashlik paydo bo'lardi.
{
  checkTrue('3) hamma story chiziladi', /list\.map\(\(s, i\) =>/.test(grid));
  checkTrue('3) ro‘yxat kesilmaydi', !/list\.slice\(/.test(grid));
  // Tab dagi son ham shu ro'yxatdan olinadi.
  const profile = stripComments(read('../src/pages/ProfilePage.jsx'));
  checkTrue('3) tabdagi son shu ro‘yxatdan', /count:\s*stories\.length/.test(profile));
  checkTrue('3) lentaga aynan shu ro‘yxat beriladi', /<StoryGrid stories=\{stories\}/.test(profile));
}

// ── 4) BOSILGAN STORY OCHILADI ───────────────────────────────────────
// 3-katak bosilsa 3-story ochilishi kerak, 1-chisi emas.
{
  checkTrue('4) katak o‘z o‘rnini beradi', /onOpen=\{\(\) => setOpenAt\(i\)\}/.test(grid));
  checkTrue('4) ko‘ruvchiga o‘rin uzatiladi', /startIndex=\{openAt\}/.test(grid));
  checkTrue('4) ko‘ruvchi o‘rinni qabul qiladi', /startIndex = 0/.test(viewer));
  checkTrue('4) chiziqchalar soni ro‘yxatdan', /list\.map\(\(s, i\) =>/.test(viewer));
  // To'liq ekranda video AYNAN video bo'lib ochilsin.
  checkTrue('4) ko‘ruvchida video <video> bo‘ladi', /current\.videoUrl\s*\?[\s\S]{0,200}<video/.test(viewer));
}

done('Lenta katagi');
