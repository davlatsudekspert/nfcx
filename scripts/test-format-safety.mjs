// EKRANDA "NaN" YOKI "Invalid Date" CHIQMASIN
//
// Profil sahifasida odam "Faol bo'lgan: NaN kun oldin" degan yozuvni
// ko'rdi. Sababi `timeAgo()` kiruvchi qiymatni ALBATTA son (epoch ms)
// deb hisoblardi: `Date.now() - ts`. Amalda esa bu qiymat turli
// joydan turli ko'rinishda keladi — bazadan ISO satr, eski
// yozuvlardan sekundlar, ba'zan umuman kelmaydi. Son bo'lmagan
// qiymat ayirishda NaN beradi va u to'g'ridan-to'g'ri ekranga
// chiqadi.
//
// Bu shunchaki chiroyli emaslik emas: "NaN" foydalanuvchiga sayt
// buzuq degan taassurot beradi va qo'llab-quvvatlashga savol
// tug'diradi.
//
//   node scripts/test-format-safety.mjs
import { makeChecker } from './lib/d1-harness.mjs';
import { timeAgo, timeAgoMs, fmt, dateTime, setTimeAgoLang } from '../src/lib/format.js';

const { check, checkTrue, done } = makeChecker();
const now = Date.now();

// Har qanday kirish uchun natijada NaN/Invalid/undefined bo'lmasin.
const clean = (v) => typeof v === 'string' && !/NaN|Invalid|undefined|null/.test(v);

// ── 1) YO'Q YOKI BUZUQ QIYMAT ────────────────────────────────────────
{
  const JUNK = [undefined, null, '', '   ', NaN, 0, -1, 'salom', {}, [], true, Infinity, '2026-13-45'];
  for (const v of JUNK) {
    const out = timeAgo(v);
    checkTrue(`1) timeAgo(${JSON.stringify(v)}) toza`, clean(out), `natija: ${out}`);
  }
  check('1) buzuq qiymat chiziqcha beradi', timeAgo(undefined), '—');
}

// ── 2) HAQIQIY QIYMATLAR — TURI HAR XIL ──────────────────────────────
// Bazadan ISO satr keladi, eski yozuvlardan sekundlar, kodning
// ba'zi joyidan millisekund. Uchalasi ham to'g'ri o'qilishi kerak.
{
  check('2) ISO satr', timeAgo(new Date(now - 5 * 60000).toISOString()), '5 daqiqa oldin');
  check('2) millisekund', timeAgo(now - 3 * 3600000), '3 soat oldin');
  check('2) sekund', timeAgo(Math.floor((now - 2 * 86400000) / 1000)), '2 kun oldin');
  check('2) Date obyekti', timeAgo(new Date(now - 90 * 1000)), '1 daqiqa oldin');
  check('2) raqamli satr', timeAgo(String(now - 7 * 60000)), '7 daqiqa oldin');
  check('2) hozirgina', timeAgo(now - 5000), 'hozirgina');
}

// ── 3) KELAJAKDAGI SANA ──────────────────────────────────────────────
// Qurilma soati oldinga qo'yilgan bo'lsa "-3 daqiqa oldin" chiqardi.
{
  check('3) kelajak manfiy son bermaydi', timeAgo(now + 10 * 60000), 'hozirgina');
  checkTrue('3) kelajakda minus yo‘q', !timeAgo(now + 86400000).includes('-'));
}

// ── 4) SEKUND / MILLISEKUND AJRATISH ─────────────────────────────────
{
  check('4) sekund ms ga o‘giriladi', timeAgoMs(1700000000), 1700000000000);
  check('4) millisekund o‘zgarmaydi', timeAgoMs(1700000000000), 1700000000000);
  check('4) nol qabul qilinmaydi', timeAgoMs(0), null);
}

// ── 5) TILGA BOG'LIQ EMAS ────────────────────────────────────────────
// Xato holat uchalasida ham bir xil ko'rinishi kerak.
{
  for (const lang of ['uz', 'ru', 'en']) {
    setTimeAgoLang(lang);
    checkTrue(`5) ${lang}: buzuq qiymat toza`, clean(timeAgo('salom')));
    checkTrue(`5) ${lang}: haqiqiy qiymat toza`, clean(timeAgo(now - 60000)));
  }
  setTimeAgoLang('uz');
}

// ── 6) QO'SHNI FORMATLAGICHLAR ───────────────────────────────────────
// Bir xil turdagi xato ularda ham bo'lmasin.
{
  for (const v of [undefined, null, NaN, 'salom', {}, Infinity]) {
    checkTrue(`6) fmt(${JSON.stringify(v)}) toza`, clean(fmt(v)), `natija: ${fmt(v)}`);
    checkTrue(`6) dateTime(${JSON.stringify(v)}) toza`, clean(dateTime(v)), `natija: ${dateTime(v)}`);
  }
  check('6) dateTime buzuqda chiziqcha', dateTime('salom'), '—');
  check('6) fmt buzuqda nol', fmt('salom'), '0');
}

done('Format xavfsizligi');
