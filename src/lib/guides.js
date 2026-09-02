// "Qo'llanma" (Guide/o'quv markazi) bo'limining kontent modeli.
//
// MUHIM — bu fayl FAQAT frontend structured data. Hech qanday backend/D1/R2
// yozuvi yo'q, hech qanday API chaqiruvi yo'q. TIER_PRICE/TIER_LABEL/
// TIER_COLOR — pricing.js'dan FAQAT O'QIB olinadi (import), pricing logikasi
// bu yerda umuman qayta yozilmagan/o'zgartirilmagan.
//
// Ekran namoyishlari ("frames") — ikki xil bo'lishi mumkin (`kind`):
//   - 'real': /public/guides/<folder>/frame-N.jpg — HAQIQIY NFCSTORE
//     interfeysi skrinshoti. MUHIM: bu skrinshotlar production nfcstore.uz'dan
//     OLINMAGAN (bu muhitdan tashqi tarmoqqa umuman chiqib bo'lmaydi) —
//     buning o'rniga xuddi shu frontend kodi (aynan shu React komponentlar,
//     aynan shu CSS) mahalliy (local), butunlay alohida, bir martalik test
//     D1/R2 bilan ishga tushirilib, ochiq-oydin DEMO ma'lumotlar (masalan
//     "Aziz Karimov", "Demo Do'kon") bilan to'ldirilgan holda skrinshot
//     qilingan. Production'ga hech qanday yozuv/o'qish bo'lmagan, hech
//     qanday haqiqiy foydalanuvchi ma'lumoti ko'rsatilmagan.
//   - 'mock': <GuideMockFrame> orqali chiziladigan sxematik namoyish —
//     faqat jismoniy amal (NFC kartani telefonga yaqinlashtirish), hozircha
//     production'da o'chirilgan funksiya (auksion stavkasi, to'lov — Payme
//     hali yoqilmagan) yoki hali skrinshoti olinmagan bosqich (QR) uchun,
//     har doim "Demo" belgisi bilan ko'rsatiladi.
//
// v2 — SODDALASHTIRISH: oldingi versiyada ~80 mayda dars bor edi (ko'pchiligi
// "Tez orada" placeholder holatida). Endi faqat 12 ta ASOSIY, TO'LIQ TAYYOR
// dars qoldirildi — har biri foydalanuvchini boshidan oxirigacha
// tushuntiradi, hech qanday bo'sh/tayyor bo'lmagan karta yo'q. Oldingi
// bosqichda olingan real skrinshotlar shu 12 ta dars ichiga qayta
// birlashtirildi (papka nomlari o'zgarmadi, faqat qaysi darsga tegishli
// ekanligi qayta tashkil qilindi).

import { TIER_PRICE, TIER_LABEL, TIER_COLOR } from './pricing.js';

export const GUIDE_TABS = [
  { id: 'shaxsiy', label: 'Shaxsiy profil' },
  { id: 'kompaniya', label: 'Kompaniya profili' },
];

// Soddalashtirilgan kategoriya filtri — faqat eng muhim 6 tasi.
export const GUIDE_CATEGORIES = [
  { id: 'all', label: 'Barchasi' },
  { id: 'profil', label: 'Profil' },
  { id: 'kompaniya', label: 'Kompaniya' },
  { id: 'nfc', label: 'NFC' },
  { id: 'auksion', label: 'Auksion' },
  { id: 'buyurtma', label: 'Buyurtma' },
];

function realFrame(sortOrder, folder, n, caption, opts = {}) {
  return {
    sortOrder,
    kind: 'real',
    image: `/guides/${folder}/frame-${n}.jpg`,
    thumb: `/guides/${folder}/frame-${n}-thumb.jpg`,
    caption,
    durationMs: opts.durationMs ?? 2400,
    cursorX: opts.cursorX ?? null,
    cursorY: opts.cursorY ?? null,
    clickEffect: !!opts.clickEffect,
    highlightBox: opts.highlightBox ?? null,
    zoomTarget: opts.zoomTarget ?? null,
  };
}
function mockFrame(sortOrder, variant, caption, opts = {}) {
  return {
    sortOrder,
    kind: 'mock',
    image: variant,
    caption,
    durationMs: opts.durationMs ?? 2200,
    cursorX: opts.cursorX ?? null,
    cursorY: opts.cursorY ?? null,
    clickEffect: !!opts.clickEffect,
    highlight: opts.highlight ?? null,
    zoomTarget: opts.zoomTarget ?? null,
  };
}

// tab: 'shaxsiy' | 'kompaniya' | 'both'
function guide(sortOrder, id, title, description, category, tab, durationMin, frames) {
  return { id, sortOrder, title, description, category, tab, durationMin, frames };
}

export const GUIDES = [
  guide(1, 'register', "NFCSTORE'da ro'yxatdan o'tish",
    "Telefon raqami bilan hisob yaratish va birinchi kirish.", 'profil', 'shaxsiy', 2, [
      realFrame(1, 'shaxsiy-boshlash-1', 1, "Bosh sahifada yuqori o‘ng burchakdagi «Bepul profil yaratish» tugmasini bosing.", { cursorX: 97, cursorY: 7, highlightBox: { xPct: 90, yPct: 4, wPct: 10, hPct: 6 } }),
      realFrame(2, 'shaxsiy-boshlash-1', 2, 'Email, parol, telefon raqamingizni kiriting va botga yozganingizni tasdiqlang.', { cursorX: 67, cursorY: 73, highlightBox: { xPct: 54, yPct: 70, wPct: 26, hPct: 6 } }),
      realFrame(3, 'shaxsiy-boshlash-1', 3, '«Kod yuborish»ni bosgach, tasdiqlash kodi Telegram botga yuboriladi.', { cursorX: 74, cursorY: 97 }),
      realFrame(4, 'shaxsiy-boshlash-1', 4, 'Kelgan kodni kiriting, shartlarga rozilik bildiring va «Akkaunt yaratish»ni bosing.', { cursorX: 62, cursorY: 65, clickEffect: true }),
      realFrame(5, 'shaxsiy-boshlash-1', 5, 'Tabriklaymiz — hisobingiz va shaxsiy NFC ID’ingiz tayyor!', { zoomTarget: 'center', durationMs: 2800 }),
    ]),

  guide(2, 'create-profile', 'Shaxsiy profil yaratish',
    "Ro'yxatdan o'tgach shaxsiy raqamli tashrif qog'ozini ochish va tahrirlashni boshlash.", 'profil', 'shaxsiy', 2, [
      realFrame(1, 'shaxsiy-boshlash-2', 1, 'Ro‘yxatdan o‘tgach, profilingiz avtomatik yaratiladi — hali bo‘sh, faqat ID bilan.', { cursorX: 69, cursorY: 44, highlightBox: { xPct: 64, yPct: 41, wPct: 9, hPct: 4 } }),
      realFrame(2, 'shaxsiy-boshlash-2', 2, '«Tahrirlash» tugmasi orqali profil sozlamalariga kirasiz.', { cursorX: 19, cursorY: 63 }),
      realFrame(3, 'shaxsiy-boshlash-2', 3, 'Barcha o‘zgarishlar o‘ng tarafdagi jonli oldindan ko‘rishda darhol ko‘rinadi.', { cursorX: 12, cursorY: 60, zoomTarget: 'left center' }),
      realFrame(4, 'shaxsiy-boshlash-2', 4, 'Tayyor — profilingiz shunday ko‘rinadi, istalgan vaqt qayta tahrirlashingiz mumkin.', { zoomTarget: 'center', durationMs: 2600 }),
    ]),

  guide(3, 'fill-profile', "Profilni to'ldirish",
    'Ism, kasb, bio va boshqa asosiy maydonlarni birma-bir to‘ldirish tartibi.', 'profil', 'shaxsiy', 2, [
      realFrame(1, 'shaxsiy-profil-4', 1, 'Profilni to‘ldirish «Asosiy ma’lumot» bo‘limidan boshlanadi: rasm, ism, kasb, bio.', { cursorX: 20, cursorY: 84 }),
      realFrame(2, 'shaxsiy-profil-4', 2, 'Rasm va ismni to‘ldirgach, o‘ng tarafdagi kartochka darhol yangilanadi.', { cursorX: 10, cursorY: 60, zoomTarget: 'right center' }),
      realFrame(3, 'shaxsiy-profil-4', 3, 'Keyin «Aloqa va ijtimoiy tarmoqlar» bo‘limini to‘ldiring.', { cursorX: 12, cursorY: 40 }),
      realFrame(4, 'shaxsiy-profil-4', 4, 'Barcha maydonlar to‘ldirilgach, profilingiz to‘liq va professional ko‘rinadi.', { zoomTarget: 'center', durationMs: 2600 }),
    ]),

  guide(4, 'avatar-design', 'Avatar, fon va dizaynni sozlash',
    "Profil rasmini, fonini va umumiy dizaynini o'zgartirish.", 'profil', 'shaxsiy', 2, [
      realFrame(1, 'shaxsiy-profil-7', 1, 'Yangi profilingizda standart holatda ismning bosh harfi ko‘rsatiladi.', { cursorX: 50, cursorY: 63 }),
      realFrame(2, 'shaxsiy-profil-7', 2, '«Asosiy ma’lumot» bo‘limida «Rasm tanlash»ni bosing. Pastroqda «Dizayn va fon» bo‘limi ham bor.', { cursorX: 19, cursorY: 84, highlightBox: { xPct: 14, yPct: 82, wPct: 10, hPct: 5 } }),
      realFrame(3, 'shaxsiy-profil-7', 3, 'Tanlangan rasm darhol yuklanadi va o‘ng tarafdagi jonli oldindan ko‘rishda chiqadi.', { cursorX: 10, cursorY: 60, zoomTarget: 'right center', clickEffect: true }),
      realFrame(4, 'shaxsiy-profil-7', 4, 'Yangi profil rasmi endi ommaviy sahifangizda ko‘rinadi.', { zoomTarget: 'center', durationMs: 2600 }),
    ]),

  guide(5, 'contacts-social', 'Kontaktlar va ijtimoiy tarmoqlar qo‘shish',
    'Telegram, Instagram, telefon va boshqa aloqa vositalarini profilga ulash.', 'profil', 'shaxsiy', 1, [
      mockFrame(1, 'form', '«Aloqa va ijtimoiy tarmoqlar» bo‘limini oching — u boshida yopiq turadi.', { cursorX: 30, cursorY: 40 }),
      realFrame(2, 'shaxsiy-profil-11', 2, 'Telegram foydalanuvchi nomingizni kiriting.', { cursorX: 25, cursorY: 15, highlightBox: { xPct: 3, yPct: 66, wPct: 30, hPct: 6 } }),
      realFrame(3, 'shaxsiy-profil-11', 3, 'Xuddi shunday Instagram, Facebook va boshqa tarmoqlarni ham qo‘shishingiz mumkin.', { cursorX: 25, cursorY: 25 }),
      realFrame(4, 'shaxsiy-profil-11', 4, 'Saqlagach, tugmalar to‘g‘ridan-to‘g‘ri profilingizda ko‘rinadi.', { zoomTarget: 'right center', durationMs: 2600 }),
    ]),

  guide(6, 'nfc-id-pricing', 'NFC ID tanlash va tarifni tushunish',
    "Bronza, Silver, Gold, Premium, Ekslyuziv — daraja va narxlarni solishtirib tanlash.", 'nfc', 'both', 2, [
      realFrame(1, 'shaxsiy-nfc-3', 1, 'Narxlar sahifasida Bronza, Silver, Gold, Premium va Ekslyuziv tariflarini solishtiring.', { cursorX: 30, cursorY: 68, highlightBox: { xPct: 5, yPct: 63, wPct: 40, hPct: 7 } }),
      realFrame(2, 'shaxsiy-nfc-3', 2, 'Katalogda band qilingan ID’lar va ularning darajasi (rangli belgi) ko‘rinadi.', { cursorX: 40, cursorY: 40 }),
      realFrame(3, 'shaxsiy-nfc-3', 3, 'Ro‘yxatdan o‘tganda avtomatik bepul 8 xonali ID beriladi — yoki narxlar sahifasidan yuqoriroq darajani tanlashingiz mumkin.', { zoomTarget: 'center', durationMs: 2700 }),
    ]),

  guide(7, 'nfc-usage', 'NFC kartadan foydalanish',
    'Telefonni NFC kartaga yaqinlashtirib profilni ochish.', 'nfc', 'both', 1, [
      mockFrame(1, 'tap', 'NFC kartangizni tayyorlang.', { cursorX: 50, cursorY: 70 }),
      mockFrame(2, 'tap', 'Telefoningizni kartaning orqa tomoniga yaqinlashtiring.', { cursorX: 50, cursorY: 40, highlight: 'nfc-zone' }),
      mockFrame(3, 'tap', '“Tegizish” shart emas — yaqinlashtirish kifoya. Telefon kartani avtomatik aniqlaydi.', { cursorX: 50, cursorY: 40, clickEffect: true }),
      realFrame(4, 'shaxsiy-boshlash-1', 5, 'Profil avtomatik ravishda telefon brauzerida ochiladi.', { zoomTarget: 'center', durationMs: 2600 }),
    ]),

  guide(8, 'qr-share', 'QR va profil havolasini ulashish',
    'Profilingizni QR kod yoki to‘g‘ridan-to‘g‘ri havola orqali ulashish.', 'nfc', 'both', 1, [
      realFrame(1, 'shaxsiy-boshlash-2', 1, 'Profil sahifangizda, ID belgisi yonida nusxalash va ulashish belgilari bor.', { cursorX: 69, cursorY: 21, highlightBox: { xPct: 65, yPct: 18, wPct: 8, hPct: 4 } }),
      realFrame(2, 'shaxsiy-boshlash-2', 1, 'Havolani nusxalab, istalgan joyga (Telegram, Instagram bio va h.k.) joylashtirishingiz mumkin.', { cursorX: 69, cursorY: 21, clickEffect: true, zoomTarget: 'right top' }),
      mockFrame(3, 'qr', 'Fizik kartangizda esa QR kod avtomatik ishlaydi — kamera bilan skanerlash orqali ham profil ochiladi.', { durationMs: 2600 }),
    ]),

  guide(9, 'company-create', 'Kompaniya profilini yaratish',
    'Biznesingiz uchun alohida Company ID va profil ochish.', 'kompaniya', 'kompaniya', 2, [
      realFrame(1, 'kompaniya-kompaniya-1', 1, '«Kompaniya yaratish» sahifasida o‘ziga xos Company ID tanlang.', { cursorX: 77, cursorY: 44, highlightBox: { xPct: 62, yPct: 42, wPct: 30, hPct: 3 } }),
      realFrame(2, 'kompaniya-kompaniya-1', 2, 'Kompaniya nomi, yo‘nalishi, shahar va kontaktlarni kiriting.', { cursorX: 50, cursorY: 30 }),
      realFrame(3, 'kompaniya-kompaniya-1', 3, 'Barcha maydonlarni to‘ldirib bo‘lgach, arizani yuboring.', { cursorX: 76, cursorY: 68, clickEffect: true }),
      realFrame(4, 'kompaniya-kompaniya-1', 4, 'Ariza yuborildi — admin tekshiruvi paytida ham boshqaruv panelidan foydalanishingiz mumkin.', { zoomTarget: 'center', durationMs: 2700 }),
    ]),

  guide(10, 'company-fill', "Kompaniya profilini to'ldirish",
    'Nomi, tavsifi, kontaktlari va katalogini to‘ldirish.', 'kompaniya', 'kompaniya', 2, [
      realFrame(1, 'kompaniya-kompaniya-7', 1, 'Business Workspace — chap menyudan «Profil» bo‘limini oching.', { cursorX: 9, cursorY: 30, highlightBox: { xPct: 1, yPct: 27, wPct: 17, hPct: 6 } }),
      realFrame(2, 'kompaniya-kompaniya-7', 2, 'Nomi, kichik soha, «Biz haqimizda» va logo/muqova havolalarini kiriting.', { cursorX: 50, cursorY: 50 }),
      realFrame(3, 'kompaniya-kompaniya-7', 3, 'Katalog bo‘limida mahsulot/xizmatlaringizni qo‘shasiz.', { cursorX: 9, cursorY: 40 }),
      realFrame(4, 'kompaniya-kompaniya-7', 4, '«Aloqa» bo‘limida telefon, ish vaqti va manzilni to‘ldiring.', { cursorX: 9, cursorY: 46, zoomTarget: 'center', durationMs: 2600 }),
    ]),

  guide(11, 'auction-join', 'Auksionda qatnashish',
    'Faol lotlarni topish, narxini kuzatish va taklif berish.', 'auksion', 'both', 2, [
      realFrame(1, 'both-auksion-5', 1, 'Auksion sahifasida faol lotlar ro‘yxatini ko‘ring.', { cursorX: 72, cursorY: 37 }),
      realFrame(2, 'both-auksion-5', 2, 'Lot sahifasida joriy narx, qolgan vaqt va «Darhol sotib olish» narxi ko‘rinadi.', { cursorX: 20, cursorY: 57 }),
      mockFrame(3, 'form', 'Taklif summasini kiritasiz (demo qiymat — to‘lov tizimi yoqilgach ishlaydi).', { cursorX: 50, cursorY: 55 }),
      mockFrame(4, 'card', '«Taklif berish»ni bosasiz — bu FAQAT namoyish, hozircha real stavka berilmaydi.', { cursorX: 50, cursorY: 70, clickEffect: true }),
    ]),

  guide(12, 'order-payment', "NFC karta buyurtmasi va to'lov jarayoni",
    'Jismoniy NFC kartaga buyurtma berish va to‘lov bosqichi.', 'buyurtma', 'both', 2, [
      realFrame(1, 'order-payment', 1, 'Profilingiz ustida «Karta dizayni» va «NFC ID buyurtma berish» tugmalarini toping.', { cursorX: 58, cursorY: 27, highlightBox: { xPct: 43, yPct: 22, wPct: 28, hPct: 10 } }),
      mockFrame(2, 'card', 'Karta dizaynini tanlaysiz — rang, material va joylashuvni sozlash mumkin.', { cursorX: 50, cursorY: 50 }),
      realFrame(3, 'shaxsiy-boshlash-1', 5, 'Hozircha to‘lov tizimi (Payme) ishga tushirilmoqda — tez orada buyurtma shu yerdan to‘lanadi.', { cursorX: 20, cursorY: 60, highlightBox: { xPct: 6, yPct: 56, wPct: 92, hPct: 15 }, durationMs: 2800 }),
    ]),
];

// ─────────────────────────── Tariflar — REAL narxlardan dinamik ───────────────────────────
// Guide #6 (nfc-id-pricing) ichida real /narxlar skrinshoti orqali ko'rsatiladi.
// Bu eksport — kelajakda kerak bo'lsa (masalan boshqa joyda) qayta
// ishlatish uchun — hech qanday narx qo'lda yozilmagan, to'g'ridan-to'g'ri
// src/lib/pricing.js'dan olinadi.
const TIER_ORDER = ['free', 'silver', 'gold', 'premium', 'exclusive'];
export const PRICING_OVERVIEW = TIER_ORDER.map((key) => ({
  key,
  label: TIER_LABEL[key],
  price: TIER_PRICE[key], // null = Ekslyuziv (faqat auksion)
  color: TIER_COLOR[key],
}));

export function guideDurationLabel(min) {
  return min <= 1 ? '1 daqiqa' : `${min} daqiqa`;
}
