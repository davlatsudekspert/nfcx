import { codeTierOverride } from './codeTiers.js';

export const TOTAL_COMBOS = 26 * 26 * 26 * 1000;

// ── Bloklangan prefiks — bu bilan boshlangan NFC ID umuman yaratilmaydi ──
// (search / generator / bandlash / auksion so'rovi / sovg'a / admin create).
// Backend'da ham majburiy (server/index.js validCode).
export const BLOCKED_PREFIXES = ['GOD'];
export function isBlockedCode(raw) {
  const c = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return BLOCKED_PREFIXES.some((p) => c.startsWith(p));
}

// ── Avtomatik-bepul 8 xonali profil ID (createFreeAutoId, server/db.js) ──
// Ro'yxatdan o'tishda avtomatik beriladi, HECH QACHON pullik NFC ID sotib
// olish oqimi (POST /api/records, Payme order yaratish) orqali
// yaratilmaydi/sotilmaydi — bu qat'iy biznes qoidasi (Payme integratsiyasi
// audit qismida topilgan bo'shliqni yopish uchun qo'shilgan).
export const FREE_AUTO_ID_RE = /^[0-9]{8}$/;

// Kod pullik NFC ID sifatida sotib olinishi mumkinmi? (bloklangan prefiks
// yoki 8 xonali avtomatik-bepul shakl bo'lsa — YO'Q). Bu FAQAT "sotib
// olinadimi" savoliga javob beradi — kodning formati/uzunligi umuman
// to'g'ri ekanini (parseCode/parseAnyCode) alohida tekshirish kerak.
export function isPurchasableCode(raw) {
  const c = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!c) return false;
  if (isBlockedCode(c)) return false;
  if (FREE_AUTO_ID_RE.test(c)) return false;
  return true;
}

export function parseCode(raw) {
  const c = (raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (c.length !== 6) return null;
  if (isBlockedCode(c)) return null;
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

// Har bir standart formatga (AAA000) qo'shimcha, ro'yxatdan o'tishda
// avtomatik beriladigan 8 xonali raqamli ID ham qabul qilinadi.
export function parseAnyCode(raw) {
  const clean = (raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!clean) return null;
  if (isBlockedCode(clean)) return null;
  if (/^[0-9]{8}$/.test(clean)) return { code: clean };
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

// ── Chiroyli 3-harfli so'zlar ────────────────────────────────────────────
// EKSKLYUZIV so'zlar — eng yuqori status. Bu so'z bilan boshlangan HAR
// QANDAY kod (raqamidan qat'i nazar) Ekslyuziv darajaga tushadi (auksion).
const EXCLUSIVE_WORDS = [
  'VIP', 'CEO', 'KNG', 'LEG', 'ROY', 'ACE', 'WIN', 'UZB', 'LUX',
];

// PREMIUM so'zlar — taniqli brendlar, ismlar, shaharlar. Bu so'z + "super"
// raqam → Premium; bu so'z + oddiy raqam → Gold.
const PREMIUM_WORDS = [
  // Avtomobil / brend
  'BMW', 'AMG', 'GTR', 'AUD', 'GTI', 'GTS', 'EVO', 'RSQ', 'SUV', 'CAR',
  'KIA', 'BYD', 'RRS', 'LMB', 'TSL', 'PRS', 'MRX',
  // Status / biznes
  'BOS', 'TOP', 'PRO', 'MAX', 'BIG', 'ONE', 'MBA', 'DEV', 'DOC', 'LAW',
  'ART', 'FIT', 'GYM', 'BIZ', 'DJX', 'BND',
  // O'zbekiston shaharlari / viloyatlari
  'TAS', 'SAM', 'BUX', 'AND', 'NAV', 'FER', 'XIV', 'NUK', 'JIZ', 'QAR',
  'TER', 'URG', 'NMG',
  // O'g'il bolalar ismlari
  'ALI', 'AZI', 'JAS', 'BOB', 'SAR', 'SHO', 'TIM', 'UMR', 'MIR',
  'SHX', 'BEK', 'ABR', 'ODI', 'RUS', 'ISL', 'KAM', 'NOD', 'OYB', 'SUX',
  'FUR', 'ELY', 'DIY', 'HAS', 'HUS', 'ZAF', 'AKM', 'BAX', 'JAV', 'SHR',
  'AZM', 'FAR', 'TOX', 'ULU', 'XON', 'OTA', 'IBR', 'SUL', 'NUR',
  // Qizlar ismlari
  'DIL', 'NIL', 'ZAR', 'NOZ', 'MAL', 'LAY', 'MAD', 'GUL', 'SEV', 'MOX',
  'LOB', 'IRO', 'MUX', 'SHA', 'ZUL', 'FOT', 'OYS', 'NAF', 'RAY', 'MEH',
  'KOM', 'NIG', 'MAR', 'MAH', 'XUR',
  // Universal
  'SKY', 'SUN', 'FLY', 'JET', 'ICE', 'RED', 'FOX', 'GEM', 'ZEN', 'NEO',
  'PAY', 'STA',
  // Valyuta (2026)
  'USD', 'UZS',
];

// DAVLAT XIZMATLARI qisqartmalari — bu so'z + oddiy raqam → Gold; bu so'z +
// maxsus "davlat raqami" (001/007/077/707/010) → Premium.
const GOV_WORDS = [
  'IIB', 'DXX', 'MXX', 'DAV', 'YHX', 'YPX', 'GAI', 'FVV', 'DBX', 'DSX',
  'DSI', 'ADL', 'SUD', 'PRK', 'TIV', 'MUD', 'HKM', 'VZR', 'BOJ', 'GUV',
];

// Orqaga moslik — eski kod hali ham SPECIAL_WORDS'ga murojaat qilishi mumkin.
const SPECIAL_WORDS = [...EXCLUSIVE_WORDS, ...PREMIUM_WORDS, ...GOV_WORDS];

function allSame3(s) {
  return s[0] === s[1] && s[1] === s[2];
}
// Ikki BELGI YONMA-YON (ketma-ket pozitsiyada) bir xil bo'lishi — masalan
// "AAB" (0-1 pozitsiya bir xil) yoki "ABB" (1-2 pozitsiya bir xil).
// "ABA" kabi qatorning boshi-oxiri bir xil bo'lgani YONMA-YONLIK hisoblanmaydi.
function hasAdjacentPair(s) {
  return s[0] === s[1] || s[1] === s[2];
}
// "Kuchli nol" raqamlar — alohida turib ham qiymatli (001, 007, 077).
function isZeroSuperDigit(d) {
  return d === '001' || d === '007' || d === '077';
}
// Qo'shimcha "super" raqamlar (2026) — 71/72 juftligi bilan yakunlanuvchi
// nodir kombinatsiyalar, PREMIUM so'z bilan birga kelganda PREMIUM'ga
// ko'taradi (001/007/077 bilan bir xil mantiq).
const EXTRA_SUPER_DIGITS = ['711', '712', '771', '772'];
function isExtraSuperDigit(d) {
  return EXTRA_SUPER_DIGITS.includes(d);
}
// "Zerkalniy" (ko'zgu) raqam — birinchi va oxirgi raqam bir xil:
// 010, 101, 121, 202, 292, 909 ... (000 bundan mustasno — u alohida PREMIUM).
function isMirrorDigit(d) {
  return d[0] === d[2] && d !== '000';
}
// "X0X" — o'rtasi 0, chetlari bir xil, lekin 000 emas (101, 202, 707, 909).
function isX0X(d) {
  return d[1] === '0' && d[0] === d[2] && d[0] !== '0';
}
// DAVLAT so'zi bilan birga kelganda PREMIUM qiladigan maxsus raqamlar.
function isGovPremiumDigit(d) {
  return d === '001' || d === '007' || d === '077' || d === '707' || d === '010' || isExtraSuperDigit(d);
}
// PREMIUM so'z bilan birga kelganda darajani PREMIUM'ga ko'taradigan raqam:
//   - 001 / 007 / 077
//   - uchtasi bir xil (111, 777 ...)
//   - "X0X" (101, 202, 707 ...)
function isSuperDigit(d) {
  if (isZeroSuperDigit(d)) return true;
  if (allSame3(d) && d !== '000') return true;
  if (isX0X(d)) return true;
  if (isExtraSuperDigit(d)) return true;
  return false;
}

// Kod darajasini aniqlaydi: 'exclusive' | 'premium' | 'gold' | 'silver' | 'free'
export function tierFromCode(letters, digits) {
  const lettersAllSame = allSame3(letters);
  const digitsAllSame = allSame3(digits);
  const exclusiveWord = EXCLUSIVE_WORDS.includes(letters);
  const premiumWord = PREMIUM_WORDS.includes(letters);
  const govWord = GOV_WORDS.includes(letters);

  // 1) EKSKLYUZIV — faqat auksion orqali (admin ochadi, boshlang'ich
  //    narxni admin belgilaydi). "Qaymoqning qaymog'i":
  //    - Uchala harf VA uchala raqam bir xil (AAA777, QQQ000)
  //    - EKSKLYUZIV so'z (VIP, CEO, LUX, GOD ...) — raqamidan qat'i nazar
  if (lettersAllSame && digitsAllSame) return 'exclusive';
  if (exclusiveWord) return 'exclusive';

  // 2) PREMIUM — 199 000 so'm
  //    - Oxirgi 3 raqami "000" (KLM000, XYZ000)
  //    - DAVLAT so'zi + maxsus davlat raqami (IIB001, DXX707, DAV010)
  //    - PREMIUM so'z (BMW, ALI ...) + "super" raqam (BMW007, ALI777, TAS101)
  if (digits === '000') return 'premium';
  if (govWord && isGovPremiumDigit(digits)) return 'premium';
  if (premiumWord && isSuperDigit(digits)) return 'premium';

  // 3) GOLD — 149 000 so'm
  //    - PREMIUM so'z, lekin raqami oddiy (BMW412, ALI063)
  //    - DAVLAT so'zi, oddiy raqam (IIB412, DAV555)
  //    - Faqat uchala harf YOKI faqat uchala raqam bir xil (MXK888)
  //    - "Kuchli nol" raqam — 001 / 007 / 077 — istalgan harf bilan (XYZ001)
  if (premiumWord) return 'gold';
  if (govWord) return 'gold';
  if (lettersAllSame || digitsAllSame) return 'gold';
  if (isZeroSuperDigit(digits)) return 'gold';

  // 4) SILVER — 99 000 so'm
  //    - "Zerkalniy" (ko'zgu) raqam — 010, 101, 121, 202 ... (LOL101, ABC292)
  //    - HAM harflarda, HAM raqamlarda yonma-yon juftlik (ABB770, AAB114)
  if (isMirrorDigit(digits)) return 'silver';
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
  // AVVAL — qo'lda belgilangan tarif (per-code override). Bo'lmasa naqsh mantig'i.
  const ov = codeTierOverride(c);
  if (ov) return ov;
  // Faqat harflardan iborat NFC ID (kompaniya nomi yoki shaxs ismi —
  // nfcstore.uz/kompaniya, nfcstore.uz/mashrabboy) har doim EKSLYUZIV
  // darajada ko'rsatiladi (bu kodlar faqat admin tomonidan beriladi).
  if (/^[A-Z]{3,12}$/.test(c)) return 'exclusive';
  if (c.length !== 6) return 'free';
  return tierFromCode(c.slice(0, 3), c.slice(3, 6));
}

// Har bir daraja uchun qat'iy narx. EKSKLYUZIV uchun narx yo'q (null) —
// bu kod to'g'ridan-to'g'ri sotib olinmaydi, faqat admin ochgan auksion
// orqali egasini topadi.
// "free" (ichki kalit, o'zgartirilmagan — access.js'dagi feature-limit
// tizimi ham shu kalitni ishlatadi, u butunlay boshqa tushuncha) — endi
// tijoriy nomi "Bronza", narxi 49 000 so'm (avval 0 edi).
export const TIER_PRICE = { exclusive: null, premium: 199000, gold: 149000, silver: 99000, free: 49000 };

// PROFILE PREMIUM narxi — NFC ID darajasidan ALOHIDA. Bir martalik to'lov;
// profil funksiyalarini (post, musiqa, maxsus fon, analitika va h.k.) ochadi,
// NFC ID kodini/tarifini o'zgartirmaydi. Frontend ham, backend ham SHU
// yagona konstantani ishlatadi.
export const PROFILE_PREMIUM_FEE = 20000;
export const TIER_LABEL = { exclusive: 'Ekslyuziv', premium: 'Premium', gold: 'Gold', silver: 'Silver', free: 'Bronza' };
// Har bir daraja o'z rangida — profilda ID matni va belgi shu rangda chiqadi.
// Yangi vizual tizim: Titanium Gold / Platinum / Pure Gold / Chrome Silver / Bronza+yashil.
export const TIER_COLOR = {
  exclusive: '#d4af37', // Titanium Gold — eng yuqori status
  premium: '#d8a34a',   // Bronza-oltin — issiq metall
  gold: '#f0c419',      // Pure Gold — klassik toza tilla
  silver: '#9aa3ad',    // Chrome Silver — bosiq metall
  free: '#C58A55',      // Bronza + to'q yashil aralash — bronza highlight
};
// Titanium Gold / Platinum uchun ikki rangli metall gradient (matn/badge fonida).
export const TIER_GRADIENT = {
  exclusive: 'linear-gradient(135deg, #d4af37 0%, #ffffff 25%, #8a8275 50%, #d4af37 100%)',
  premium: 'linear-gradient(135deg, #e0b46a 0%, #fbe8c8 30%, #a06c1e 60%, #e0b46a 100%)',
  // Bronza (asos/to'q) -> to'q yashil — "Bronza + to'q yashil aralash".
  free: 'linear-gradient(135deg, #A66A3F 0%, #C58A55 30%, #347A54 65%, #1F513A 100%)',
};
// Premium, Gold va Ekslyuziv — qirol/olmos emoji; Silver — yulduzcha.
export const TIER_EMOJI = { exclusive: '\u{1F48E}', premium: '\u{1F451}', gold: '\u{1F451}', silver: '\u2728', free: '' };

// TASHQI (outer) sahifa foni \u2014 NFC ID darajasining VIZUAL IDENTITY'si.
// Foydalanuvchi buni O'ZGARTIRA OLMAYDI (Profile Premium ham ta'sir
// qilmaydi \u2014 outer har doim ID tarifiga bog'liq). Tema fonining ustiga
// nozik rangli "halo" sifatida qo'yiladi.
export const TIER_PAGE_GLOW = {
  free:      'radial-gradient(1200px 620px at 50% -12%, rgba(166,106,63,0.12), transparent 62%)',
  silver:    'radial-gradient(1200px 620px at 50% -12%, rgba(154,163,173,0.13), transparent 62%)',
  gold:      'radial-gradient(1200px 620px at 50% -12%, rgba(240,196,25,0.13), transparent 60%)',
  premium:   'radial-gradient(1200px 620px at 50% -12%, rgba(216,163,74,0.15), transparent 60%)',
  exclusive: 'radial-gradient(1200px 640px at 50% -12%, rgba(212,175,55,0.17), transparent 56%)',
};

// Faqat TUSHUNTIRISH matni uchun — "nega bu narxda" degan savolga javob.
// Narxning o'zini ular emas, tierFromCode() hisoblaydi.
export function letterPattern(l) {
  if (allSame3(l)) return { hot: true, label: 'Uchala harf bir xil' };
  if (EXCLUSIVE_WORDS.includes(l)) return { hot: true, label: 'Ekslyuziv so‘z' };
  if (l === 'USD' || l === 'UZS') return { hot: true, label: 'Valyuta belgisi' };
  if (PREMIUM_WORDS.includes(l)) return { hot: true, label: 'Taniqli so‘z (brend/ism/shahar)' };
  if (GOV_WORDS.includes(l)) return { hot: true, label: 'Davlat xizmati qisqartmasi' };
  if (hasAdjacentPair(l)) return { hot: true, label: 'Ikkita harf yonma-yon bir xil' };
  return { hot: false, label: '' };
}
export function digitPattern(d) {
  if (d === '000') return { hot: true, label: "\"000\" — maxsus" };
  if (allSame3(d)) return { hot: true, label: 'Uchala raqam bir xil' };
  if (isZeroSuperDigit(d)) return { hot: true, label: 'Kuchli nol raqam (001/007/077)' };
  if (isExtraSuperDigit(d)) return { hot: true, label: 'Nodir raqam (711/712/771/772)' };
  if (isX0X(d)) return { hot: true, label: 'O‘ta nodir raqam (X0X)' };
  if (isMirrorDigit(d)) return { hot: true, label: 'Zerkalniy (ko‘zgu) raqam' };
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
  // AVVAL — qo'lda belgilangan tarif (per-code override). Bo'lmasa naqsh mantig'i.
  const ov = codeTierOverride(c);
  if (ov) {
    const total = TIER_PRICE[ov] ?? 0;
    return { total, tier: ov, base: total, override: true };
  }
  return priceFor(c.slice(0, 3), c.slice(3, 6));
}

// ── Xavfsiz xarid entry-point (Payme fundamenti — Phase 2A safety fix) ──
// `priceForCode()` UI/kalkulyator ko'rsatuvi uchun — u ekslyuziv daraja
// uchun ham `total` maydonida texnik jihatdan `0` qaytaradi (chunki
// TIER_PRICE.exclusive = null, `?? 0` bilan sonlashtiriladi: ko'rsatish
// uchun xavfsiz, lekin haqiqiy pul olish kodi buni ADASHIB "narxi 0 so'm"
// deb ishlatib, tekin ekslyuziv order yaratib qo'yishi MUMKIN edi).
// `priceForCode()`ning bu UI xulqi ATAYLAB o'zgartirilmagan (kalkulyator/
// checker sahifalarida hozirgidek ishlashda davom etadi).
//
// KELAJAKDAGI Payme order-yaratish kodi (hali yozilmagan — Phase 2A/2B)
// HECH QACHON `priceForCode()`ni to'g'ridan-to'g'ri ishlatmasin — FAQAT
// shu funksiyani chaqirsin. Bu — real pul undirish uchun YAGONA xavfsiz
// kirish nuqtasi (single entrypoint), uchta holatni sonli `0` bilan hech
// qachon aralashtirmaydigan aniq shaklda qaytaradi:
//
//   1) sotib olib bo'lmaydi (8 xonali avtomatik-bepul ID, bloklangan
//      prefiks, yoki umuman noto'g'ri format — standart 6-belgili
//      AAA000 emas) ->
//        { purchasable: false, reason: 'not_purchasable' }
//
//   2) ekslyuziv (faqat auksion orqali) ->
//        { purchasable: false, reason: 'exclusive_auction_only', tier: 'exclusive' }
//      `amount` MAYDONI UMUMAN YO'Q (undefined) — `0` EMAS. Chaqiruvchi
//      kod `result.amount`ni to'g'ridan-to'g'ri ishlatsa ham, `purchasable`
//      tekshirilmagan holatda ham, `undefined` bilan haqiqiy Payme
//      so'roviga (`amount` musbat butun son bo'lishi shart) hech qachon
//      yaroqli qiymat sifatida yetib bormaydi.
//
//   3) sotib olinadigan (Bronza/Silver/Gold/Premium) ->
//        { purchasable: true, tier, amount }
//      `amount` doim TIER_PRICE'dan olingan musbat son (49000/99000/
//      149000/199000) — hech qachon `0` yoki `null` emas.
export function getPersonalPurchaseQuote(rawCode) {
  const parsed = parseCode(rawCode); // faqat standart 6-belgili AAA000 format — 8 xonali/boshqa uzunlik avtomatik rad etiladi
  if (!parsed) return { purchasable: false, reason: 'not_purchasable' };
  if (!isPurchasableCode(parsed.code)) return { purchasable: false, reason: 'not_purchasable' };
  const { tier } = priceForCode(parsed.code);
  if (tier === 'exclusive') return { purchasable: false, reason: 'exclusive_auction_only', tier };
  const amount = TIER_PRICE[tier];
  return { purchasable: true, tier, amount };
}
