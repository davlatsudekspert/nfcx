export const TOTAL_COMBOS = 26 * 26 * 26 * 100;
export const BASE_PRICE = 200000;

export function parseCode(raw) {
  const c = (raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (c.length !== 5) return null;
  const letters = c.slice(0, 3);
  const digits = c.slice(3, 5);
  if (!/^[A-Z]{3}$/.test(letters) || !/^[0-9]{2}$/.test(digits)) return null;
  return { code: c, letters, digits };
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

export function priceFor(letters, digits) {
  const lp = letterPattern(letters);
  const dp = digitPattern(digits);
  const total = Math.max(BASE_PRICE, Math.round((BASE_PRICE * lp.mult * dp.mult) / 5000) * 5000);
  return { total, lp, dp, base: BASE_PRICE };
}
