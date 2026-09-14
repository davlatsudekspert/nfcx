// SHAXSIY PROFIL SAHIFASI (/:code) — BIZNES PROFIL BILAN BIR DARAJADA.
//
// Egasining topshirig'i: biznes profilda (`/c/:id`) qilingan tuzatishlar
// shaxsiy profilga ham qo'llansin. Bu test o'sha qarorlarni qo'riqlaydi.
//
// NIMA UCHUN KERAK — ikkita xato SHU YERDA juda oson qaytadi:
//
//   1. YOPISHGAN TUGMA. `position:sticky` ota-blokda `overflow:hidden`
//      bo'lsa ISHLAMAYDI, profil paneli esa aynan shunday (u rasm va
//      videoni yumaloq burchaklar ichida ushlab turadi). Kimdir
//      "Saqlash"ni panel ichiga qaytarsa, tugma jimgina pastga
//      tushib qoladi — hech qanday xato chiqmaydi.
//
//   2. USLUB QAYERDA TURIBDI. `src/company-system.css` GLOBAL EMAS —
//      u faqat uni import qilgan sahifa bilan yuklanadi, shaxsiy
//      profil esa uni import qilmaydi. Yangi sinf o'sha faylga
//      yozilsa, sahifa uslubsiz chiqadi (bu xato loyihada uch marta
//      takrorlangan).
//
//   node scripts/test-profile-page.mjs
import { readFileSync } from 'node:fs';
import { makeChecker } from './lib/d1-harness.mjs';

const { check, checkTrue, done } = makeChecker();
const page = readFileSync(new URL('../src/pages/ProfilePage.jsx', import.meta.url), 'utf8');
const theme = readFileSync(new URL('../src/theme.css', import.meta.url), 'utf8');
const companyCss = readFileSync(new URL('../src/company-system.css', import.meta.url), 'utf8');

// Izohsiz qoida tanasi — izohdagi matn tekshiruvni chalg'itmasin.
function rule(css, selector) {
  let out = '';
  let i = css.indexOf(selector + ' {');
  if (i < 0) i = css.indexOf(selector + '{');
  while (i >= 0) {
    out += css.slice(css.indexOf('{', i) + 1, css.indexOf('}', i)) + ';';
    const next = css.indexOf(selector + '{', i + 1);
    const next2 = css.indexOf(selector + ' {', i + 1);
    i = next < 0 ? next2 : (next2 < 0 ? next : Math.min(next, next2));
  }
  return out.replace(/\/\*[\s\S]*?\*\//g, '');
}

// ── 1) "SAQLASH" PASTDA YOPISHIB TURADI ──────────────────────────────
const saveBar = rule(theme, '.vz-savebar');
checkTrue('1) yopishgan qator bor', saveBar.length > 0);
checkTrue('1) sticky', saveBar.includes('position: sticky') || saveBar.includes('position:sticky'));
checkTrue('1) pastga yopishadi', /bottom:\s*0/.test(saveBar));
checkTrue('1) telefon "iyagi" hisobga olingan', saveBar.includes('env(safe-area-inset-bottom'));

// ── 2) U PANELDAN TASHQARIDA CHIZILADI ───────────────────────────────
// Panelda `overflow-hidden` bor; qator uning ICHIDA bo'lsa sticky
// umuman ishlamaydi. Shuning uchun JSX da qator panel yopilgandan
// KEYIN turishi shart.
{
  const panelEnd = page.indexOf('{/* "SAQLASH" — PASTDA YOPISHIB TURADI');
  const barAt = page.indexOf('className="vz-savebar');
  checkTrue('2) qator JSX da bor', barAt > 0);
  checkTrue('2) qator paneldan keyin', panelEnd > 0 && barAt > panelEnd);
  // Panel ichida qolgan eski nusxa bo'lmasin.
  check('2) qator bitta joyda', (page.match(/vz-savebar/g) || []).length, 1);
}

// ── 3) NFC KARTA — PROFIL KARTASINING ICHIDA ─────────────────────────
// Ilgari u panel TASHQARISIDA, tepada alohida osilib turardi.
{
  const stats = page.indexOf("{t('Band qilingan')}");
  const card = page.indexOf('vz-nfc-zoom');
  const tabs = page.indexOf('<ProfileTabs');
  checkTrue('3) karta statistikadan keyin', stats > 0 && card > stats);
  checkTrue('3) karta bo‘limlar qatoridan oldin', tabs > 0 && card < tabs);
  check('3) karta bitta joyda', (page.match(/FlipNfcCard finish=/g) || []).length, 1);
  // PREMIUM belgisi ham karta bilan birga — ilgari u sahifa tepasida,
  // kartadan ajralib turardi.
  const premium = page.indexOf('PREMIUM');
  checkTrue('3) PREMIUM belgisi karta yonida', premium > stats && premium < tabs);
}

// ── 4) KARTA EKRANDAN CHIQIB KETMAYDI ────────────────────────────────
// Panelda `overflow:hidden` bor — karta undan kengroq bo'lsa CHETI
// KESILADI. Shuning uchun kattalashtirish koeffitsienti ekran
// kengligiga qarab tanlanadi.
{
  const zoom = rule(theme, '.vz-nfc-zoom');
  checkTrue('4) kattalashtirish koeffitsienti bor', zoom.includes('--k'));
  checkTrue('4) balandlik qoplangan', zoom.includes('calc(176px'));
  checkTrue('4) tor ekran uchun alohida qiymat', theme.includes('max-width: 359px'));
  checkTrue('4) keng ekranda kattaroq', theme.includes('min-width: 640px'));
  // 390px li telefonda: panel ichki kengligi 390-56=334px.
  // 280 * 1.05 = 294 -> sig'adi.
  const k = /\.vz-nfc-zoom\s*\{[^}]*--k:\s*([\d.]+)/.exec(theme);
  checkTrue('4) telefon uchun koeffitsient xavfsiz', !!k && 280 * Number(k[1]) < 334);
}

// ── 5) USLUBLAR GLOBAL FAYLDA ────────────────────────────────────────
// `company-system.css` bu sahifaga YUKLANMAYDI.
for (const cls of ['.vz-savebar', '.vz-nfc-zoom', '.vz-rim', '.vz-sweep']) {
  checkTrue(`5) ${cls} global faylda`, theme.includes(cls));
  checkTrue(`5) ${cls} yuklanmaydigan faylga yozilmagan`, !companyCss.includes(cls));
}
checkTrue('5) sahifa company-system.css ni import qilmaydi', !page.includes('company-system.css'));

// ── 6) PREMIUM CHUQURLIK ─────────────────────────────────────────────
// Biznes profildagi qiymatning aynan o'zi: ikki sahifa yonma-yon
// qo'yilganda farq sezilmasligi kerak.
checkTrue('6) oltin rim-glow', rule(theme, '.vz-rim').includes('0 0 18px -6px'));
checkTrue('6) biznes profil bilan bir xil qiymat', companyCss.includes('0 0 18px -6px'));
checkTrue('6) havola tugmalarida rim-glow', /const linkBtn = `vz-link vz-rim/.test(page));
checkTrue('6) saqlash tugmasida yaltiroq', page.includes('vz-sweep flex flex-1'));
checkTrue('6) yaltiroq 4.2s', rule(theme, '.vz-sweep::after').includes('vzSweep 4.2s'));
// Harakatni kamaytirish so'ralsa — yaltiroq o'chadi.
checkTrue('6) prefers-reduced-motion hisobga olingan',
  /prefers-reduced-motion[\s\S]{0,120}\.vz-sweep::after/.test(theme));

// ── 7) O'LCHAMLAR KATTALASHDI ────────────────────────────────────────
{
  const ava = /h-\[(\d+)px\] w-\[\d+px\][^"]*rounded-full border-\[3px\]/.exec(page);
  checkTrue('7) avatar kattaroq (>=148px)', !!ava && Number(ava[1]) >= 148);
  const name = /<h1 className="font-display[^"]*text-\[(\d+)px\]/.exec(page);
  checkTrue('7) ism kattaroq (>=28px)', !!name && Number(name[1]) >= 28);
  const links = /flex flex-col gap-([\d.]+)">/.exec(page.slice(page.indexOf('mt-[26px] flex flex-col gap-')));
  checkTrue('7) havolalar orasi kengroq', !!links && Number(links[1]) >= 3.5);
  checkTrue('7) havola tugmasi balandroq', /min-h-\[(5[89]|[6-9]\d)px\]/.test(page));
}

// ── 8) AI TUGMASI QATOR OSTIDA QOLMAYDI ──────────────────────────────
// U `position:fixed` va sahifadan TASHQARIDA chiziladi, ya'ni
// yopishgan qatorni bosib qolardi. Biznes profilda ham xuddi shu
// yechim (`body:has(.qp-page) .ai-fab`).
checkTrue('8) langar sinf qo‘yilgan', page.includes('vz-profile-page'));
checkTrue('8) AI tugmasi ko‘tarilgan', theme.includes('body:has(.vz-profile-page) .ai-fab'));

done();
