export const TOTAL_COMBOS = 26 * 26 * 26 * 100;

// Dinamik narxlash: boshlang'ich narx har bir band qilingan vizitka bilan
// oshib boradi (talab ortishi bilan qimmatlashadi).
export const BASE_PRICE = 200000;      // start narxi
export const PRICE_GROWTH = 0.01;      // har band qilingan vizitka: +1%
export const MAX_PRICE_MULT = 4;       // shift: maksimal 4 barobar (800 000)

const ROUND_TO = 5000;

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
  if (c.length !== 5) return null;
  const letters = c.slice(0, 3);
  const digits = c.slice(3, 5);
  if (!/^[A-Z]{3}$/.test(letters) || !/^[0-9]{2}$/.test(digits)) return null;
  return { code: c, letters, digits };
}

// Faqat harflardan iborat premium vizitka: ALI, UZBEKISTAN ...
export const LETTER_CODE_RE = /^[A-Z]{3,12}$/;

export function parseLetterCode(raw) {
  const c = (raw || '').toUpperCase().replace(/[^A-Z]/g, '');
  return LETTER_CODE_RE.test(c) ? { code: c } : null;
}

// Ikkaladan biri: AAA00 standart yoki faqat-harflar premium.
// Raqam uchramasa — premium harfli kod deb qabul qilinadi.
export function parseAnyCode(raw) {
  const clean = (raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!clean) return null;
  if (/[0-9]/.test(clean)) return parseCode(clean);
  return parseLetterCode(clean);
}

// Harfli vizitkalar oddiy vizitkalardan 3 barobar qimmat.
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
  if (d === '00') return { mult: 4, label: "00 — maxsus ×4", hot: true };
  if (d[0] === d[1]) return { mult: 3, label: 'Bir xil raqam ×3', hot: true };
  const a = +d[0], b = +d[1];
  if (Math.abs(a - b) === 1) return { mult: 1.5, label: 'Ketma-ket ×1.5', hot: false };
  return { mult: 1, label: 'Oddiy ×1', hot: false };
}

export function priceFor(letters, digits, sold = 0) {
  const lp = letterPattern(letters);
  const dp = digitPattern(digits);
  const base = currentBase(sold);
  const total = Math.max(base, roundPrice(base * lp.mult * dp.mult));
  return { total, lp, dp, base };
}
