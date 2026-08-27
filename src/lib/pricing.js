export const TOTAL_COMBOS = 26 * 26 * 26 * 1000;

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

// Harfli raqamli tashrif qog'ozlar oddiy kodlardan 3 barobar qimmat.
export const LETTER_MULT = 3;

// ================= Daraja (tier) tizimi — 2026 yangilanishi =================
// Narxlar endi bandlangan soniga BOG'LIQ EMAS (dinamik o'sish olib
// tashlandi) — daraja faqat kodning o'zidagi naqshga qarab, avtomatik va
// har doim bir xil tarzda aniqlanadi. Har darajaning narxi qat'iy (fiks).

// Maxsus so'zlar — harf qismi aynan shu bo'lsa, "maxsus so'z" hisoblanadi.
const SPECIAL_WORDS = ['VIP', 'UZB', 'BEK', 'CEO'];

function allSame3(s) {
  return s[0] === s[1] && s[1] === s[2];
}
// Ikki BELGI YONMA-YON (ketma-ket pozitsiyada) bir xil bo'lishi — masalan
// "AAB" (0-1 pozitsiya bir xil) yoki "ABB" (1-2 pozitsiya bir xil).
// "ABA" kabi qatorning boshi-oxiri bir xil bo'lgani YONMA-YONLIK hisoblanmaydi.
function hasAdjacentPair(s) {
  return s[0] === s[1] || s[1] === s[2];
}
// "Super" raqam: 001 / 007 / 077 yoki uchtasi bir xil (111, 777, 888 ...).
// "000" bu yerga kirmaydi — u alohida, mustaqil PREMIUM qoidasiga ega.
function isSuperDigit(d) {
  if (d === '001' || d === '007' || d === '077') return true;
  if (allSame3(d) && d !== '000') return true;
  return false;
}

// Kod darajasini aniqlaydi: 'exclusive' | 'premium' | 'gold' | 'silver' | 'free'
export function tierFromCode(letters, digits) {
  const lettersAllSame = allSame3(letters);
  const digitsAllSame = allSame3(digits);
  const special = SPECIAL_WORDS.includes(letters);
  const superDigit = isSuperDigit(digits);

  // 1) EKSKLYUZIV — faqat auksion orqali (admin ochadi, boshlang'ich
  //    narxni admin belgilaydi). "Qaymoqning qaymog'i":
  //    - Uchala harf VA uchala raqam bir xil (AAA777, QQQ000)
  //    - Maxsus so'z + o'ta nodir raqam (VIP001, UZB077, CEO888)
  if (lettersAllSame && digitsAllSame) return 'exclusive';
  if (special && superDigit) return 'exclusive';

  // 2) PREMIUM — 199 000 so'm
  //    - Oxirgi 3 raqami "000" (KLM000, XYZ000)
  //    - Maxsus so'z, lekin raqami "super" emas (VIP088, BEK415)
  if (digits === '000') return 'premium';
  if (special) return 'premium';

  // 3) GOLD — 149 000 so'm
  //    - Faqat uchala harf YOKI faqat uchala raqam bir xil (ikkalasi
  //      birga bo'lsa yuqorida EKSKLYUZIV bo'lib ketgan bo'lardi)
  if (lettersAllSame || digitsAllSame) return 'gold';

  // 4) SILVER — 99 000 so'm
  //    - HAM harflarda, HAM raqamlarda yonma-yon juftlik bo'lishi shart
  //      (ABB770, AAB114, XXY995)
  if (hasAdjacentPair(letters) && hasAdjacentPair(digits)) return 'silver';

  // 5) TEKIN — 0 so'm
  //    - Yuqoridagilarning birortasiga ham to'g'ri kelmasa. Bunga endi
  //      FAQAT bir tomonda (yoki harfda, yoki raqamda) yonma-yon juftligi
  //      borlar ham kiradi (AAB197, MXK114) — bu ataylab qilingan
  //      marketing yechimi: ko'proq "chiroyli" kod tekin bo'lib, sayt
  //      trafigini oshiradi.
  return 'free';
}

export function tierForCode(code) {
  const c = String(code || '').toUpperCase();
  if (c.length !== 6) return 'free';
  return tierFromCode(c.slice(0, 3), c.slice(3, 6));
}

// Har bir daraja uchun qat'iy narx. EKSKLYUZIV uchun narx yo'q (null) —
// bu kod to'g'ridan-to'g'ri sotib olinmaydi, faqat admin ochgan auksion
// orqali egasini topadi.
export const TIER_PRICE = { exclusive: null, premium: 199000, gold: 149000, silver: 99000, free: 0 };
export const TIER_LABEL = { exclusive: 'Ekslyuziv', premium: 'Premium', gold: 'Gold', silver: 'Silver', free: 'Tekin' };
// Har bir daraja o'z rangida — profilda ID matni va belgi shu rangda chiqadi.
export const TIER_COLOR = {
  exclusive: '#ff5c8a', // eng nodir — alohida ajralib turadigan pushti-qizil
  premium: '#c084fc',
  gold: '#f5c518',
  silver: '#c7ccd6',
  free: '#9aa0a6',
};
// Premium, Gold va Ekslyuziv — qirol/olmos emoji; Silver — yulduzcha.
export const TIER_EMOJI = { exclusive: '\u{1F48E}', premium: '\u{1F451}', gold: '\u{1F451}', silver: '\u2728', free: '' };

// Faqat TUSHUNTIRISH matni uchun — "nega bu narxda" degan savolga javob.
// Narxning o'zini ular emas, tierFromCode() hisoblaydi.
export function letterPattern(l) {
  if (allSame3(l)) return { hot: true, label: 'Uchala harf bir xil' };
  if (hasAdjacentPair(l)) return { hot: true, label: 'Ikkita harf yonma-yon bir xil' };
  return { hot: false, label: '' };
}
export function digitPattern(d) {
  if (d === '000') return { hot: true, label: "\"000\" — maxsus" };
  if (allSame3(d)) return { hot: true, label: 'Uchala raqam bir xil' };
  if (hasAdjacentPair(d)) return { hot: true, label: 'Ikkita raqam yonma-yon bir xil' };
  return { hot: false, label: '' };
}

// `sold` parametri endi ishlatilmaydi (dinamik o'sish olib tashlandi),
// lekin chaqiruvchi kod (server, sahifalar) hali ham shu argumentni
// yuborishi mumkin — orqaga moslik uchun qoldirilgan, e'tiborsiz qoldiriladi.
export function priceFor(letters, digits, _sold) {
  const tier = tierFromCode(letters, digits);
  const total = TIER_PRICE[tier] ?? 0;
  return { total, tier, base: total };
}

export function priceForCode(code, _sold) {
  const c = String(code || '').toUpperCase();
  return priceFor(c.slice(0, 3), c.slice(3, 6));
}
