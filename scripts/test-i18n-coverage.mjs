// TARJIMA QOPLAMI — YANGI TARJIMASIZ MATN QO'SHILMASIN
//
// HOLAT. Saytda `t('...')` bilan yozilgan matnlarning bir qismi
// lug'atda yo'q. Bu EKRANNI BUZMAYDI: `i18n.jsx` kalit topilmasa
// o'zbekcha manba matnni qaytaradi, ya'ni rus yoki ingliz tilidagi
// tashrifchi bo'sh joy emas, o'zbekcha jumla ko'radi.
//
// Shuning uchun bu test hammasini BIR YO'LA tuzatishni talab
// qilmaydi — u FAQAT SONNING O'SISHINI to'xtatadi. Yangi matn
// qo'shgan odam o'sha zahoti tarjimasini ham yozadi, eski qarz esa
// bosqichma-bosqich kamayadi.
//
// Chegarani KAMAYTIRISH mumkin va kerak: tarjima qo'shilgach shu
// yerdagi son ham tushiriladi. Oshirish esa — orqaga qadam.
//
//   node scripts/test-i18n-coverage.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeChecker } from './lib/d1-harness.mjs';

const { check, checkTrue, done } = makeChecker();
const SRC = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'src');

// Hozirgi qarz. FAQAT KAMAYISHI mumkin.
const ALLOWED = 195;

const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full);
    else if (/\.jsx?$/.test(name)) files.push(full);
  }
})(SRC);

const dictFiles = files.filter((f) => /translations.*\.js$/.test(f));
checkTrue('0) lug‘at fayllari topildi', dictFiles.length >= 2);

// LUG'AT HAQIQATAN YUKLANADIMI.
//
// 2026-09-20: tarjima noto'g'ri faylga qo'shildi va `translations.js`
// sintaktik buzildi. Bu to'plam MATN sifatida o'qigani uchun hammasi
// yashil qoldi — xatoni faqat `npm run build` tutdi. Endi fayl
// haqiqatan import qilinadi: buzuq lug'at shu yerda yiqiladi.
{
  let loaded = null;
  let err = '';
  try {
    loaded = await import('../src/lib/translations.js');
  } catch (e) { err = String(e?.message || e); }
  checkTrue(`0) lug‘at moduli yuklandi${err ? ` — ${err}` : ''}`, !!loaded);
  checkTrue('0) DICT eksport qilingan', !!loaded?.DICT && typeof loaded.DICT === 'object');
  // Har kalit {ru, en} shaklida bo'lsin — buzuq yozuv jim o'tmasin.
  const bad = Object.entries(loaded?.DICT || {}).filter(([, v]) => !v || typeof v !== 'object' || !('ru' in v) || !('en' in v));
  check('0) buzuq yozuv yo‘q', bad.length, 0);
}

const dicts = dictFiles.map((f) => readFileSync(f, 'utf8')).join('\n');
const keys = new Set();
for (const m of dicts.matchAll(/^\s*'((?:[^'\\]|\\.)*)':\s*\{/gm)) keys.add(m[1]);
for (const m of dicts.matchAll(/^\s*"((?:[^"\\]|\\.)*)":\s*\{/gm)) keys.add(m[1]);
checkTrue(`0) lug‘atda kalitlar bor (${keys.size})`, keys.size > 2000);

// Har kalitda UCHALA til ham bo'lsin — bittasi tushib qolsa, o'sha
// tildagi odam yana o'zbekcha ko'radi.
{
  const noRu = (dicts.match(/:\s*\{\s*en:/g) || []).length;
  const noEn = (dicts.match(/:\s*\{\s*ru:\s*'[^']*'\s*\}/g) || []).length;
  check('1) "ru" tushib qolgan kalit yo‘q', noRu, 0);
  check('1) "en" tushib qolgan kalit yo‘q', noEn, 0);
}

const missing = new Map();
for (const f of files) {
  if (/translations.*\.js$/.test(f)) continue;
  const src = readFileSync(f, 'utf8');
  for (const m of src.matchAll(/\bt\(\s*'((?:[^'\\]|\\.)*)'/g)) {
    if (!keys.has(m[1])) {
      if (!missing.has(m[1])) missing.set(m[1], f.replace(SRC + '/', ''));
    }
  }
}

console.log(`\nTarjimasiz matn: ${missing.size} (ruxsat etilgan chegara ${ALLOWED})`);
checkTrue(`2) tarjimasiz matn oshmadi (${missing.size} <= ${ALLOWED})`, missing.size <= ALLOWED,
  missing.size > ALLOWED ? `yangi tarjimasiz matnlar: ${[...missing.keys()].slice(0, 5).join(' | ')}` : '');

// Chegara "osilib" qolmasin: qarz kamaygan bo'lsa, shu faylda ham
// tushirilishi kerak.
if (missing.size < ALLOWED) {
  console.log(`IZOH  - qarz kamaydi (${missing.size}). scripts/test-i18n-coverage.mjs dagi ALLOWED ni ${missing.size} ga tushiring.`);
}

// ── 3) ODAM KO'RADIGAN ASOSIY OQIM TARJIMA QILINGAN ──────────────────
// Bu matnlar HAR BIR tashrifchiga ko'rinadi, shuning uchun ular
// chegaradan qat'i nazar lug'atda bo'lishi SHART.
{
  const MUST = [
    'Media ochilmadi', 'Media javob bermadi', 'Video', 'Rasm',
    'Tahrirlash', 'Shikoyat qilish', 'Rang mavzusi', 'Til',
  ];
  for (const k of MUST) checkTrue(`3) "${k}" tarjimasi bor`, keys.has(k));
}

done('Tarjima qoplami');
