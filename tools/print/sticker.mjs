// NFCSTORE STIKER — BOSMAXONAGA TAYYOR FAYLLAR (2026-09-25).
//
// 80 mm: avtomobil oynasiga ICHIDAN yopishadi, tashqaridan o'qiladi —
//   shuning uchun ko'zgu aksida (mirror) chiqadi. QR va NFC chip AYNAN
//   bir xil manzilni (`/t/<token>`) ochadi: mashina oynasidagi QR egasining
//   profiliga olib borishi kerak, aktivatsiya sahifasiga emas.
// 30 mm: oddiy, oldidan yopishadi (NFC teg ustidan), QR'siz.
// Belgi — O'ZIMIZNING "N" (NFC Forum N-Mark EMAS: u ularning tovar belgisi).
//
//   node tools/print/sticker.mjs [chiqish_papkasi]
//       -> ASOSIY: umumiy QR (nfcstore.uz/qr-1 -> ilovani yuklash), hamma
//          stiker bir xil; QR_BATCH=2 — keyingi partiya (analitikada alohida)
//   node tools/print/sticker.mjs <papka> stiker-manzillari.csv
//       -> (ixtiyoriy) har stikerga O'Z QR'i, chip bilan bir xil manzil —
//          admin > Marketplace > "Stiker manzillari (CSV)" dan partiya:
//          har stiker alohida sahifa, tartib saqlanadi (chiplar ham shu
//          tartibda yoziladi; QR ostidagi 4 belgi — mos chipni topish uchun).
// Talab: playwright (global) — Chromium bilan vektor PDF.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url);
const gm = require('child_process').execSync('npm root -g').toString().trim();
const { chromium } = require(gm + '/playwright');
const MAINWT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const QR = require(MAINWT + '/node_modules/qrcode');
const FONT = MAINWT + '/node_modules/@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2';
const OUT = path.resolve(process.argv[2] || '.');
require('fs').mkdirSync(OUT, { recursive: true });

const GOLD = '#C9A55A';   // yumshoq oltin
const BLACK = '#0B0B0B';  // to'q qora (bosmaxona: rich black)
// QR — oltin fon, qora nuqtalar ("N" belgisi bilan bir uslubda). Nuqtalar
// fondan TO'Q bo'lishi shart: teskari (oltin nuqta, qora fon) QR'ni ba'zi
// telefonlar o'qimaydi.
const QR_BG = GOLD;
const BLEED = 1.5;        // mm, kesish xatosi oq chiziq qoldirmasin

const f = (n) => Number(n.toFixed(3));
function arc(cx, cy, r, a0, a1) {
  const p = (a) => [cx + r * Math.cos((a * Math.PI) / 180), cy + r * Math.sin((a * Math.PI) / 180)];
  const [x0, y0] = p(a0); const [x1, y1] = p(a1);
  return `M${f(x0)} ${f(y0)} A${r} ${r} 0 0 1 ${f(x1)} ${f(y1)}`;
}
// O'zimizning "N" belgisi (NFC Forum N-Mark EMAS): yumaloq kvadrat + oddiy N.
function badge(cx, cy, s) {
  const k = s / 15;
  const pts = [[-4.5, 4.7], [-4.5, -4.7], [-1.9, -4.7], [1.8, 1.6], [1.8, -4.7], [4.5, -4.7], [4.5, 4.7], [1.9, 4.7], [-1.8, -1.6], [-1.8, 4.7]]
    .map(([x, y]) => `${f(cx + x * k)},${f(cy + y * k)}`).join(' ');
  return `<rect x="${f(cx - s / 2)}" y="${f(cy - s / 2)}" width="${s}" height="${s}" rx="${f(3.4 * k)}" fill="${GOLD}"/>
  <polygon points="${pts}" fill="${BLACK}"/>`;
}
function waves(cx, cy, radii, span, sw) {
  let d = '';
  for (const r of radii) d += arc(cx, cy, r, 180 - span, 180 + span) + ' ' + arc(cx, cy, r, -span, span) + ' ';
  return `<path d="${d}" fill="none" stroke="${GOLD}" stroke-width="${sw}" stroke-linecap="round"/>`;
}
async function qrSvg(url, x, y, size) {
  const q = QR.create(url, { errorCorrectionLevel: 'M' });
  const n = q.modules.size; const pad = size * 0.07; const m = (size - 2 * pad) / n;
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.modules.get(r, c)) d += `M${f(x + pad + c * m)} ${f(y + pad + r * m)}h${f(m)}v${f(m)}h-${f(m)}z`;
  return `<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="1.4" fill="${QR_BG}"/><path d="${d}" fill="${BLACK}"/>`;
}
const text = (x, y, size, weight, spacing, str, anchor = 'middle', fill = GOLD) =>
  `<text x="${f(x + (anchor === 'middle' ? spacing / 2 : 0))}" y="${y}" font-family="Manrope" font-size="${size}" font-weight="${weight}" letter-spacing="${spacing}" text-anchor="${anchor}" fill="${fill}">${str}</text>`;

async function sticker80(url, label) {
  // Koordinatalar mm, markaz (0,0). Kesish doirasi r=40.
  return `<circle r="${40 + BLEED}" fill="${BLACK}"/>
  <circle r="37.6" fill="none" stroke="${GOLD}" stroke-width="0.8"/>
  ${waves(0, -21.5, [10.8, 14.2, 17.4], 33, 1.5)}
  ${badge(0, -21.5, 15)}
  ${text(0, -3.2, 7.4, 800, 1.35, 'NFCSTORE')}
  ${text(0, 2.6, 3.2, 600, 0.12, 'nfcstore.uz')}
  <path d="M-17 6.8H-3.2 M3.2 6.8H17" stroke="${GOLD}" stroke-width="0.3"/>
  <path d="M0 5.5 L1.3 6.8 L0 8.1 L-1.3 6.8Z" fill="none" stroke="${GOLD}" stroke-width="0.3"/>
  ${await qrSvg(url, -19.5, 10.3, 17)}
  <g fill="none" stroke="${GOLD}" stroke-width="0.55" stroke-linecap="round">
    <rect x="1.4" y="10.8" width="5.4" height="9" rx="1.1"/>
    <path d="${arc(4.1, 15.3, 4.6, -40, 40)} ${arc(4.1, 15.3, 6.4, -40, 40)}"/>
  </g>
  ${text(1.2, 23.6, 3.35, 800, 0, 'Telefonni', 'start')}
  ${text(1.2, 27.4, 3.35, 800, 0, 'tekkizing', 'start')}
  ${text(1.2, 30.6, 2.1, 500, 0, 'profil ochiladi', 'start')}
  ${text(-11, 30.4, label ? 1.7 : 1.95, 600, label ? 0.25 : 0.05, label || 'Ilovani yuklang', 'middle')}`;
}
function sticker30() {
  return `<circle r="${15 + BLEED}" fill="${BLACK}"/>
  <circle r="14" fill="none" stroke="${GOLD}" stroke-width="0.4"/>
  ${waves(0, -4.3, [6.2, 8.4], 32, 0.9)}
  ${badge(0, -4.3, 8.4)}
  ${text(0, 7.6, 3.05, 800, 0.5, 'NFCSTORE')}
  ${text(0, 10.7, 1.55, 600, 0.05, 'nfcstore.uz')}`;
}
const page = (sizeMm, body, mirror) => `<!doctype html><html><head><style>
@font-face{font-family:Manrope;src:url('file://${FONT}') format('woff2');font-weight:200 800}
@page{size:${sizeMm}mm ${sizeMm}mm;margin:0} html,body{margin:0;padding:0}
svg{display:block;width:${sizeMm}mm;height:${sizeMm}mm;page-break-after:always}
</style></head><body>${body.map((b) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-sizeMm / 2} ${-sizeMm / 2} ${sizeMm} ${sizeMm}"><g${mirror ? ' transform="scale(-1,1)"' : ''}>${b}</g></svg>`).join('')}</body></html>`;

const tokensFile = process.argv[3];
// Admin paneldagi "Stiker manzillari (CSV)": qatorda `https://nfcstore.uz/t/<token>`
// yoki oddiy token bo'lishi mumkin. Tartib SAQLANADI — chiplar ham shu tartibda yoziladi.
const tokens = tokensFile && existsSync(tokensFile)
  ? [...new Set(readFileSync(tokensFile, 'utf8').split(/[\r\n,;]+/).map((l) => {
      const m = l.match(/\/t\/([A-Za-z0-9_-]{1,64})/); if (m) return m[1];
      const t = l.trim().replace(/^"|"$/g, ''); return /^[A-Za-z0-9_-]{4,64}$/.test(t) && !/^(token|url|chip|address)/i.test(t) ? t : null;
    }).filter(Boolean))]
  : null;
const S80 = 80 + 2 * BLEED; const S30 = 30 + 2 * BLEED;

const browser = await chromium.launch();
const ctx = await browser.newContext();
const pg = await ctx.newPage();
async function pdf(file, sizeMm, bodies, mirror) {
  const html = path.join(OUT, '.tmp.html'); writeFileSync(html, page(sizeMm, bodies, mirror));
  await pg.goto('file://' + html); await pg.evaluate(() => document.fonts.ready);
  await pg.pdf({ path: path.join(OUT, file), width: `${sizeMm}mm`, height: `${sizeMm}mm`, printBackground: true, pageRanges: '' });
}
async function png(file, sizeMm, body, mirror, px = 1200) {
  const html = path.join(OUT, '.tmp.html'); writeFileSync(html, page(sizeMm, [body], mirror));
  await pg.setViewportSize({ width: px, height: px });
  await pg.goto('file://' + html); await pg.evaluate(() => document.fonts.ready);
  await pg.addStyleTag({ content: `svg{width:${px}px!important;height:${px}px!important}` });
  await pg.screenshot({ path: path.join(OUT, file), clip: { x: 0, y: 0, width: px, height: px } });
}

if (tokens) {
  const bodies = [];
  for (const t of tokens) bodies.push(await sticker80(`https://nfcstore.uz/t/${t}`, t.slice(-4).toUpperCase()));
  await pdf(`partiya-80mm-MIRROR-${tokens.length}ta.pdf`, S80, bodies, true);
  console.log('partiya:', tokens.length);
} else {
  // UMUMIY QR: hamma stikerda bir xil — ilovani yuklash (server /qr-1 ni
  // yo'naltiradi, keyin qayta bosmasdan o'zgartirsa bo'ladi). Chip esa
  // har stikerda o'z /t/<token> manzilini ochadi.
  const s80 = await sticker80(`https://nfcstore.uz/qr-${process.env.QR_BATCH || '1'}`, '');
  await pdf('NFCSTORE-80mm-BOSISH-mirror.pdf', S80, [s80], true);
  await pdf('NFCSTORE-80mm-korinishi.pdf', S80, [s80], false);
  await png('NFCSTORE-80mm-korinishi.png', S80, s80, false);
  await pdf('NFCSTORE-30mm-BOSISH.pdf', S30, [sticker30()], false);
  await png('NFCSTORE-30mm-korinishi.png', S30, sticker30(), false, 600);
  // Kesish chizig'i (plotter uchun, CutContour): 80 mm va 30 mm doira.
  for (const [n, s] of [[80, S80], [30, S30]]) writeFileSync(path.join(OUT, `kesish-${n}mm.svg`),
    `<svg xmlns="http://www.w3.org/2000/svg" width="${s}mm" height="${s}mm" viewBox="${-s / 2} ${-s / 2} ${s} ${s}"><circle id="CutContour" r="${n / 2}" fill="none" stroke="#EC008C" stroke-width="0.1"/></svg>`);
}
await browser.close();
try { require('fs').unlinkSync(path.join(OUT, '.tmp.html')); } catch { /* yo'q */ }
