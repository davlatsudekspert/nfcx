export const TOTAL_COMBOS = 26 * 26 * 26 * 1000;

// Dinamik narxlash: boshlang'ich narx har bir band qilingan raqamli tashrif qog'ozi bilan
// oshib boradi (talab ortishi bilan qimmatlashadi).
export const BASE_PRICE = 40000;       // start narxi (avvalgi 200 000 / 5)
export const PRICE_GROWTH = 0.01;      // har band qilingan vizitka: +1%
export const MAX_PRICE_MULT = 4;       // shift: maksimal 4 barobar (800 000)

const ROUND_TO = 1000; // avvalgi 5000 / 5 — narx granulasi ham mos ravishda kichraydi

function roundPrice(n) {
  return Math.round(n / ROUND_TO) * ROUND_TO;
}

export function currentBase(sold) {
  const mult = Math.min(1 + (sold || 0) * PRICE_GROWTH, MAX_PRICE_MULT);
  return roundPrice(BASE_PRICE * mult);
}

export function nextBase(sold) {
  return currentBase((sold || 0) + 1);
}

export function parseCode(raw) {
  const c = (raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (c.length !== 6) return null;
  const letters = c.slice(0, 3);
  const digits = c.slice(3, 6);
  if (!/^[A-Z]{3}$/.test(letters) || !/^[0-9]{3}$/.test(digits)) return null;
  return { code: c, letters, digits };
}

// Faqat harflardan iborat premium raqamli tashrif qog'ozi: ALI, UZBEKISTAN ...
// HOZIRCHA O'CHIRILGAN — checker/kalkulyator/bandlash bu formatni taklif
// qilmaydi. Backend hali ham qabul qiladi, shuning uchun bu yerda funksiya
// qoldirilgan (kerak bo'lsa LETTER_CODES_ENABLED ni true qilib qaytarish
// mumkin), lekin parseAnyCode uni endi ishlatmaydi.
export const LETTER_CODES_ENABLED = false;
export const LETTER_CODE_RE = /^[A-Z]{3,12}$/;

export function parseLetterCode(raw) {
  const c = (raw || '').toUpperCase().replace(/[^A-Z]/g, '');
  return LETTER_CODE_RE.test(c) ? { code: c } : null;
}

// Faqat standart AAA000 formatini qabul qiladi (harfli premium hozircha o'chiq).
export function parseAnyCode(raw) {
  const clean = (raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!clean) return null;
  if (!LETTER_CODES_ENABLED) return parseCode(clean);
  if (/[0-9]/.test(clean)) return parseCode(clean);
  return parseLetterCode(clean);
}

// Harfli raqamli tashrif qog'ozlar oddiy raqamli tashrif qog'ozilardan 3 barobar qimmat.
export const LETTER_MULT = 3;

export function letterPrice(sold = 0) {
  return currentBase(sold) * LETTER_MULT;
}

export function letterPattern(l) {
  if (l[0] === l[1] && l[1] === l[2]) return { mult: 6, label: 'Uchala bir xil ×6', hot: true };
  if (l[0] === l[1] || l[1] === l[2] || l[0] === l[2]) return { mult: 2.5, label: 'Ikkitasi bir xil ×2.5', hot: true };
  const codes = l.split('').map((c) => c.charCodeAt(0));
  if (codes[1] - codes[0] === 1 && codes[2] - codes[1] === 1) return { mult: 2, label: 'Ketma-ket (ABC) ×2', hot: true };
  return { mult: 1, label: 'Oddiy ×1', hot: false };
}

export function digitPattern(d) {
  if (d === '000') return { mult: 4, label: "000 — maxsus ×4", hot: true };
  const a = +d[0], b = +d[1], c = +d[2];
  if (a === b && b === c) return { mult: 3, label: 'Uchalasi bir xil ×3', hot: true };
  const asc = b - a === 1 && c - b === 1;
  const desc = a - b === 1 && b - c === 1;
  if (asc || desc) return { mult: 1.5, label: 'Ketma-ket (123) ×1.5', hot: false };
  return { mult: 1, label: 'Oddiy ×1', hot: false };
}

// ---------- Daraja (tier) tizimi ----------
// Premium/Gold/Silver/Bronze — naqshga qarab pullik, oddiy (naqshsiz)
// kodlar esa TEKIN. Naqsh kuchi allaqachon letterPattern/digitPattern
// orqali hisoblangan (mult qiymati) — shu asosda darajaga ajratamiz,
// hisoblash mantig'ini ikki marta yozmaymiz.
export function tierFromPatterns(lp, dp) {
  // Premium: uchala harf bir xil VA (raqam 000 yoki uchalasi bir xil).
  if (lp.mult === 6 && (dp.mult === 4 || dp.mult === 3)) return 'premium';
  // Gold: uchala harf bir xil, YOKI raqam 000.
  if (lp.mult === 6 || dp.mult === 4) return 'gold';
  // Silver: ikkita harf bir xil, YOKI uchala raqam bir xil.
  if (lp.mult === 2.5 || dp.mult === 3) return 'silver';
  // Bronze: ketma-ket harflar (ABC) yoki ketma-ket raqamlar (123).
  if (lp.mult === 2 || dp.mult === 1.5) return 'bronze';
  return 'free';
}

export const TIER_LABEL = { premium: 'Premium', gold: 'Gold', silver: 'Silver', bronze: 'Bronze', free: 'Oddiy' };
// Har bir daraja o'z rangida — profilda ID matni va belgi shu rangda chiqadi.
export const TIER_COLOR = {
  premium: '#c084fc', // binafsha — eng nodir
  gold: '#f5c518',
  silver: '#c7ccd6',
  bronze: '#cd7f32',
  free: '#9aa0a6',
};
// Premium va Gold — king emoji; Silver/Bronze — o'z darajasiga mos emoji.
export const TIER_EMOJI = { premium: '\u{1F451}', gold: '\u{1F451}', silver: '\u2728', bronze: '\u{1F949}', free: '' };

export function tierForCode(code) {
  const c = String(code || '').toUpperCase();
  if (c.length !== 6) return 'free';
  const lp = letterPattern(c.slice(0, 3));
  const dp = digitPattern(c.slice(3, 6));
  return tierFromPatterns(lp, dp);
}

export function priceFor(letters, digits, sold = 0) {
  const lp = letterPattern(letters);
  const dp = digitPattern(digits);
  const tier = tierFromPatterns(lp, dp);
  const base = currentBase(sold);
  // Oddiy (naqshsiz) kodlar — TEKIN. Qolganlari naqsh kuchiga qarab.
  const total = tier === 'free' ? 0 : Math.max(base, roundPrice(base * lp.mult * dp.mult));
  return { total, lp, dp, base, tier };
}

// Qo'lda belgilangan qat'iy narxlar (so'mda) — eksklyuziv kodlar uchun.
// Naqsh ko'paytmalaridan qat'i nazar, narx hech qachon bundan past bo'lmaydi.
export const FIXED_PRICES = {
  VIP777: 1200000, // avvalgi 6 000 000 / 5
};

// Kod bo'yicha yakuniy narx: qat'iy narx mavjud bo'lsa u qo'llanadi,
// aks holda standart naqsh hisobi.
export function priceForCode(code, sold = 0) {
  const info = priceFor(String(code || '').slice(0, 3), String(code || '').slice(3, 6), sold);
  const fixed = FIXED_PRICES[code];
  return fixed ? { ...info, total: Math.max(fixed, roundPrice(info.total)), fixed } : info;
}