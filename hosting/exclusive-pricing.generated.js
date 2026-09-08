// AVTOMATIK GENERATSIYA QILINGAN — QO'LDA TAHRIRLAMANG.
// Manba: src/lib/exclusivePricing.js
// Yangilash: node scripts/gen-exclusive-pricing.mjs
// Tekshiruv: node scripts/test-exclusive-pricing.mjs (ikki nusxani solishtiradi)

// ═══════════════════════════════════════════════════════════════════════
// EXCLUSIVE NARXLAR — YAGONA MARKAZIY MANBA
// ═══════════════════════════════════════════════════════════════════════
//
// Sayt egasining qarori (2026-09): AUKSION BEKOR QILINDI. Ilgari
// "ekskluziv" kodlar va band qilingan kompaniya nomlari faqat auksion
// orqali sotilardi — endi ularning har birida QAT'IY NARX bor.
//
// BU FAYL — narxlarning yagona manbai. Hech qanday sahifaga narx qo'lda
// yozilmaydi: frontend ham, Worker ham shu yerdagi ro'yxatlardan
// foydalanadi (Worker o'z nusxasini ishlatadi — build qoidasi bo'yicha
// Worker modullari `src/` dan import qila olmaydi — va
// scripts/test-exclusive-pricing.mjs ikkisini har safar solishtiradi).
//
// O'ZGARTIRISH TARTIBI: shu faylni tahrirlang, so'ng
//   node scripts/gen-exclusive-pricing.mjs
// ni ishga tushiring — u Worker nusxasini QAYTA YOZADI. Qo'lda ikki
// joyga yozmang, aks holda sayt bir narx, server boshqa narx ko'rsatadi.

// ─── SHAXSIY NFC ID (AAA000 shakli) ───────────────────────────────────

export const EXCLUSIVE_PRICE = {
  special_4490: 4490000,
  special_3490: 3490000,
  level_0: 2990000,
  level_1: 2490000,
  level_2: 1990000,
  level_3: 1490000,
  level_4: 990000,
  level_5: 490000,
  // Ekskluziv SO'ZLI kod (VIP/CEO/KNG/LEG/ROY/ACE/WIN/UZB/LUX + istalgan
  // raqam), ro'yxatlarning birortasiga tushmagani. Masalan VIP002,
  // CEO004. Egasining qarori (2026-09): 1 190 000.
  //
  // Level 5 (490 000) BUNDAN FARQ QILADI: u faqat "uchala harf bir xil +
  // uchala raqam bir xil" shakli uchun (AAA222, BBB444) — egasi Level 5
  // ni aynan shunday ta'riflagan.
  word_default: 1190000,
};

export const EXCLUSIVE_LEVEL_LABEL = {
  special_4490: 'Maxsus',
  special_3490: 'Maxsus',
  level_0: 'Level 0',
  level_1: 'Level 1',
  level_2: 'Level 2',
  level_3: 'Level 3',
  level_4: 'Level 4',
  level_5: 'Level 5',
  word_default: 'Ekskluziv so\u2019z',
};

// 1) MAXSUS — 4 490 000
const SPECIAL_4490 = [
  'UFC229', 'UFC300', 'UFC205', 'UFC194', 'UFC100', 'UFC200', 'UFC254',
  'MMA029', 'MMA300', 'KHB029', 'KHB254', 'CON013', 'CON205', 'CON194',
  'PLT034', 'RMA007', 'AMG063', 'CLS063', 'SAV571', 'USD100',
  'UZB000', 'UZB001', 'UZB007',
];

// 2) MAXSUS — 3 490 000
const SPECIAL_3490 = [
  'XXX772', 'AAA001', 'AAA007', 'OOO001', 'OOO007', 'JJJ007',
  'DDD001', 'DDD007', 'FFF007', 'BEK001', 'BEK007', 'BEK777',
  'UAE001', 'ABC123', 'DEV001', 'GEM001', 'UNO000', 'WOW013',
  'ASL777', 'AGA777', 'KHU777', 'ISA777', 'FAY777', 'USS777',
  'OZZ777', 'PZP777', 'FCB010',
];

// 3) LEVEL 0 — 2 990 000.
// Asosiy qoida NAQSH bilan: uchala harf bir xil + 000/111/777.
// Ro'yxatga yozilmaydi — quyidagi regex 78 ta kodni o'zi qamrab oladi.
const LEVEL_0_RE = /^([A-Z])\1\1(000|111|777)$/;

// LEVEL 0 ga qo'shimcha ravishda kiritilgan chiroyli kombinatsiyalar.
const LEVEL_0_EXTRA = [
  'AAA888', 'ZZZ222', 'ZZZ999', 'GGG999', 'BBB888', 'CCC888', 'XXX888',
  'VIP000', 'VIP001', 'VIP007', 'VIP077', 'VIP111', 'VIP777', 'VIP888', 'VIP999',
  'CEO000', 'CEO001', 'CEO007', 'CEO111', 'CEO777', 'CEO888',
  'KNG000', 'KNG001', 'KNG007', 'KNG111', 'KNG777',
  'LEG000', 'LEG001', 'LEG007', 'LEG111', 'LEG777',
  'ROY000', 'ROY001', 'ROY007', 'ROY111', 'ROY777', 'ROY888',
  'ACE000', 'ACE001', 'ACE007', 'ACE111', 'ACE777', 'ACE888',
  'WIN000', 'WIN001', 'WIN007', 'WIN111', 'WIN777',
  'UZB111', 'UZB777',
  'LUX000', 'LUX001', 'LUX007', 'LUX111', 'LUX777', 'LUX888', 'LUX999',
];

// 4) LEVEL 1 — 2 490 000
const LEVEL_1 = [
  'AAA999', 'ZZZ888', 'PPP888', 'GGG888', 'SSS555', 'VVV444', 'MMM888', 'DDD333',
  'VIP222', 'VIP555', 'VIP707', 'CEO999', 'KNG888', 'KNG999', 'LEG888', 'LEG999',
  'ROY999', 'ACE999', 'WIN888', 'WIN999', 'UZB888', 'UZB999', 'LUX555',
];

// 5) LEVEL 2 — 1 990 000
const LEVEL_2 = [
  'CCC888', 'DDD888', 'EEE888', 'KKK888', 'LLL888', 'SSS888', 'YYY888',
  'VIP010', 'VIP100', 'VIP101', 'VIP202', 'VIP333', 'VIP505', 'VIP700', 'VIP808', 'VIP909',
  'CEO010', 'CEO101', 'CEO222', 'CEO333', 'CEO505', 'CEO555', 'CEO707', 'CEO808',
  'KNG010', 'KNG101', 'KNG222', 'KNG333', 'KNG505', 'KNG707', 'KNG808',
  'LEG010', 'LEG101', 'LEG222', 'LEG333', 'LEG505', 'LEG707', 'LEG808',
  'ROY010', 'ROY101', 'ROY222', 'ROY333', 'ROY505', 'ROY707', 'ROY808',
  'ACE010', 'ACE101', 'ACE222', 'ACE333', 'ACE505', 'ACE707', 'ACE808',
  'WIN010', 'WIN101', 'WIN222', 'WIN333', 'WIN505', 'WIN707', 'WIN808',
  'UZB010', 'UZB101', 'UZB222', 'UZB333', 'UZB505', 'UZB707', 'UZB808',
  'LUX010', 'LUX101', 'LUX222', 'LUX333', 'LUX505', 'LUX707', 'LUX808',
];

// 6) LEVEL 3 — 1 490 000
const LEVEL_3 = [
  'VIP121', 'VIP131', 'VIP151', 'VIP212', 'VIP232', 'VIP303', 'VIP313', 'VIP404', 'VIP414', 'VIP606',
  'CEO121', 'CEO212', 'CEO303', 'CEO404', 'CEO606', 'CEO909',
  'KNG121', 'KNG212', 'KNG303', 'KNG404', 'KNG606', 'KNG909',
  'LEG121', 'LEG212', 'LEG303', 'LEG404', 'LEG606', 'LEG909',
  'ROY121', 'ROY212', 'ROY303', 'ROY404', 'ROY606', 'ROY909',
  'ACE121', 'ACE212', 'ACE303', 'ACE404', 'ACE606', 'ACE909',
  'WIN121', 'WIN212', 'WIN303', 'WIN404', 'WIN606', 'WIN909',
  'UZB121', 'UZB212', 'UZB303', 'UZB404', 'UZB606', 'UZB909',
  'LUX121', 'LUX212', 'LUX303', 'LUX404', 'LUX606', 'LUX909',
];

// 7) LEVEL 4 — 990 000
const LEVEL_4 = [
  'BBB222', 'BBB333', 'CCC222', 'CCC333', 'DDD222', 'EEE222', 'EEE333',
  'GGG222', 'GGG333', 'KKK222', 'LLL222', 'MMM222', 'PPP222', 'RRR222',
  'SSS222', 'TTT222', 'VVV222', 'YYY222',
  'VIP123', 'VIP234', 'VIP321', 'VIP345', 'VIP432', 'VIP456', 'VIP543',
  'VIP567', 'VIP654', 'VIP678', 'VIP765', 'VIP789', 'VIP876', 'VIP987',
  'CEO123', 'CEO321', 'CEO456', 'CEO654', 'CEO789', 'CEO987',
  'KNG123', 'KNG321', 'KNG456', 'KNG654', 'KNG789', 'KNG987',
  'LEG123', 'LEG321', 'LEG456', 'LEG654', 'LEG789', 'LEG987',
  'ROY123', 'ROY321', 'ROY456', 'ROY654', 'ROY789', 'ROY987',
  'ACE123', 'ACE321', 'ACE456', 'ACE654', 'ACE789', 'ACE987',
  'WIN123', 'WIN321', 'WIN456', 'WIN654', 'WIN789', 'WIN987',
  'UZB123', 'UZB321', 'UZB456', 'UZB654', 'UZB789', 'UZB987',
  'LUX123', 'LUX321', 'LUX456', 'LUX654', 'LUX789', 'LUX987',
];

// EKSKLYUZIV SO'ZLAR — bu so'z bilan boshlangan har qanday kod ekskluziv.
// Ro'yxat shu yerda turadi (pricing.js buni shu fayldan oladi), chunki
// narx qoidalari ham, daraja qoidasi ham bitta joyda bo'lishi kerak.
export const EXCLUSIVE_WORDS = ['VIP', 'CEO', 'KNG', 'LEG', 'ROY', 'ACE', 'WIN', 'UZB', 'LUX'];

const SETS = [
  ['special_4490', new Set(SPECIAL_4490)],
  ['special_3490', new Set(SPECIAL_3490)],
  ['level_0', new Set(LEVEL_0_EXTRA)],
  ['level_1', new Set(LEVEL_1)],
  ['level_2', new Set(LEVEL_2)],
  ['level_3', new Set(LEVEL_3)],
  ['level_4', new Set(LEVEL_4)],
];

const same3 = (s) => s[0] === s[1] && s[1] === s[2];

// Kod umuman ekskluzivmi? Uch yo'l bilan: naqsh (harf+raqam bir xil),
// ekskluziv so'z, yoki yuqoridagi ro'yxatlardan birida bo'lishi.
export function isExclusiveCode(rawCode) {
  const c = String(rawCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!/^[A-Z]{3}[0-9]{3}$/.test(c)) return false;
  if (same3(c.slice(0, 3)) && same3(c.slice(3))) return true;
  if (EXCLUSIVE_WORDS.includes(c.slice(0, 3))) return true;
  if (LEVEL_0_RE.test(c)) return true;
  for (const [, set] of SETS) if (set.has(c)) return true;
  return false;
}

// Daraja va narx. Tartib QAT'IY: yuqori kategoriya har doim pastdan ustun.
// Ekskluziv bo'lmagan kod uchun `null` qaytadi (u oddiy tarifda sotiladi).
export function exclusiveLevel(rawCode) {
  const c = String(rawCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!/^[A-Z]{3}[0-9]{3}$/.test(c)) return null;

  // 1-2) maxsus ro'yxatlar
  for (const key of ['special_4490', 'special_3490']) {
    const entry = SETS.find(([k]) => k === key);
    if (entry[1].has(c)) return { level: key, price: EXCLUSIVE_PRICE[key] };
  }
  // 3) LEVEL 0 naqshi — 000/111/777 HECH QACHON pastroq darajaga tushmaydi
  if (LEVEL_0_RE.test(c)) return { level: 'level_0', price: EXCLUSIVE_PRICE.level_0 };
  // 4-8) qolgan ro'yxatlar, tartib bo'yicha
  for (const [key, set] of SETS) {
    if (key.startsWith('special_')) continue;
    if (set.has(c)) return { level: key, price: EXCLUSIVE_PRICE[key] };
  }
  // 9) Zaxira darajalar — ekskluziv, lekin yuqoridagilarga kirmagan.
  //    Ikkiga bo'linadi (egasining qarori):
  //      "uchala harf bir xil + uchala raqam bir xil"  -> Level 5, 490 000
  //      ekskluziv SO'Z + istalgan raqam (VIP002...)   -> 1 190 000
  if (same3(c.slice(0, 3)) && same3(c.slice(3))) {
    return { level: 'level_5', price: EXCLUSIVE_PRICE.level_5 };
  }
  if (EXCLUSIVE_WORDS.includes(c.slice(0, 3))) {
    return { level: 'word_default', price: EXCLUSIVE_PRICE.word_default };
  }
  return null;
}

// ─── KOMPANIYA PREMIUM NOMLARI ────────────────────────────────────────

export const COMPANY_PREMIUM_PRICE = {
  // ENG YUQORI DARAJA (2026-09, egasining qarori). Bu nomlar qisqa,
  // xalqaro va O'zbekistonda hammaga tanish — shuning uchun Level 0 dan
  // ham yuqorida turadi.
  level_top: 9990000,
  level_0: 4990000,
  level_1: 3990000,
  level_2: 2990000,
  level_3: 1990000,
  level_4: 990000,
};

const COMPANY_LEVEL_TOP = [
  'ADA', 'AMG', 'BIR', 'EURO', 'GTR', 'KING', 'ONA', 'ONE', 'OTA', 'OYI',
  'UFC', 'USD', 'UZB',
];

const COMPANY_LEVEL_0 = [
  'AUTO', 'BANK', 'BRAND', 'BUSINESS', 'CAPITAL', 'COMPANY', 'CREDIT', 'DIGITAL',
  'FINANCE', 'GLOBAL', 'GOLD', 'HOTEL', 'INVEST', 'INVESTOR', 'MARKET', 'MONEY',
  'PAYMENT', 'PREMIUM', 'PROPERTY', 'REALESTATE', 'STOCK', 'STORE', 'TECH',
  'TECHNOLOGY', 'TRADE', 'TRADING', 'TRAVEL', 'VIP', 'WEALTH', 'WORLD',
];

const COMPANY_LEVEL_1 = [
  'AERO', 'AIR', 'AIRPORT', 'ASIA', 'ASSET', 'ATLAS', 'AURA', 'AVIA', 'BALANCE',
  'BLACK', 'BOND', 'BOSS', 'CLOUD', 'COIN', 'CURRENCY', 'DATA', 'DOMAIN', 'DOMAINS',
  'EBANK', 'ECOM', 'ELITE', 'EMPIRE', 'ESTATE', 'EXCHANGE', 'FOREX', 'FUND', 'GULF',
  'INSURANCE', 'INTERNET', 'MARKETPLACE', 'META', 'NEOBANK', 'ONLINE', 'PRESTIGE',
  'PROFIT', 'RESTAURANT', 'RICH', 'SALES', 'SHOP', 'SMART', 'SPORT', 'SPORTS',
  'TRUST', 'VENTURE', 'WALLSTREET',
];

const COMPANY_LEVEL_2 = [
  'APP', 'ARENA', 'BEST', 'BRIDGE', 'BUILD', 'BUILDING', 'CAFE', 'CAR', 'CARS',
  'CASH', 'CHECKOUT', 'CITY', 'CLUB', 'CODE', 'COFFEE', 'CONNECT', 'CREATE',
  'DELIVERY', 'DEPOSIT', 'DESIGN', 'DIGIT', 'DISCOUNT', 'EVENTS', 'EXPO', 'FAST',
  'FITNESS', 'FOOD', 'FOOTBALL', 'FORECAST', 'GAME', 'GAMES', 'GEMS', 'GENIUS',
  'GIFT', 'GIFTS', 'GRAND', 'HOME', 'HOST', 'HOTELS', 'INTERIOR', 'LAND',
  'LEGEND', 'LINK', 'LIVE', 'LOCAL', 'LOGO', 'MALL', 'MASTER', 'MEDIA', 'NEWS',
  'OFFICE', 'ORDER', 'PLANE', 'PLAYER', 'PLUS', 'PORT', 'PRICE', 'PROMO', 'QRCODE',
  'SALE', 'SCHOOL', 'SERVER', 'SERVICE', 'STAR', 'STARS', 'STUDIO', 'SUPER',
  'SYSTEM', 'TAXI', 'TICKET', 'TICKETS', 'TOUR', 'TOURIST', 'TRAVELS', 'TRIP',
  'UNION', 'VEHICLE', 'VERIFY', 'VIDEO', 'VIDEOS', 'WIFI',
];

const COMPANY_LEVEL_3 = [
  'ALEXA', 'BAR', 'BURGER', 'CHIEF', 'CONCIERGE', 'DRAGON', 'EARN', 'ESPORT',
  'GOAL', 'HERO', 'HONOR', 'HOUSE', 'LION', 'LORD', 'MARS', 'MUSIC', 'PRIDE',
  'QUEEN', 'SUPERIOR', 'TIGER',
];

const COMPANY_LEVEL_4 = [
  'BOOK', 'BOT', 'CALENDAR', 'CAST', 'CHART', 'CHAT', 'CHEF', 'CHESS', 'DEAL',
  'DECOR', 'DREAM', 'EASY', 'ENGLISH', 'FAMILY', 'FANS', 'GOOD', 'GRAM', 'HONEST',
  'HUGO', 'IDEA', 'KIDS', 'LESSONS', 'LIFE', 'LOVE', 'MAIL', 'MANGO', 'MEET',
  'MESSAGE', 'MOON', 'MOVE', 'OFFER', 'OPERA', 'PETS', 'PIZZA', 'PLAY', 'POINT',
  'POLO', 'SCORE', 'SCORES', 'SECRET', 'STORY', 'SWEET', 'TEA', 'TOTAL', 'VLOG',
  'WATCH',
];

const COMPANY_SETS = [
  ['level_top', new Set(COMPANY_LEVEL_TOP)],
  ['level_0', new Set(COMPANY_LEVEL_0)],
  ['level_1', new Set(COMPANY_LEVEL_1)],
  ['level_2', new Set(COMPANY_LEVEL_2)],
  ['level_3', new Set(COMPANY_LEVEL_3)],
  ['level_4', new Set(COMPANY_LEVEL_4)],
];

// Kompaniya premium nomi uchun qat'iy narx. Nom ro'yxatda bo'lmasa `null`
// — u holda odatdagi uzunlik bo'yicha tarif ishlaydi.
export function companyPremiumLevel(rawName) {
  const n = String(rawName || '').toUpperCase().normalize('NFKC').replace(/[^A-Z]/g, '');
  if (!n) return null;
  for (const [level, set] of COMPANY_SETS) {
    if (set.has(n)) return { level, price: COMPANY_PREMIUM_PRICE[level] };
  }
  return null;
}

// Admin paneli uchun — daraja bo'yicha kompaniya nomlari.
export const COMPANY_PREMIUM_NAMES = {
  level_top: COMPANY_LEVEL_TOP,
  level_0: COMPANY_LEVEL_0, level_1: COMPANY_LEVEL_1, level_2: COMPANY_LEVEL_2,
  level_3: COMPANY_LEVEL_3, level_4: COMPANY_LEVEL_4,
};

// Testlar va admin paneli uchun — barcha ro'yxatlar bir joyda.
export const ALL_LISTS = {
  SPECIAL_4490, SPECIAL_3490, LEVEL_0_EXTRA, LEVEL_1, LEVEL_2, LEVEL_3, LEVEL_4,
  COMPANY_LEVEL_TOP, COMPANY_LEVEL_0, COMPANY_LEVEL_1, COMPANY_LEVEL_2, COMPANY_LEVEL_3, COMPANY_LEVEL_4,
};
