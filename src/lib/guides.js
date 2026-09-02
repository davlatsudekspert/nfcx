// "Qo'llanma" (Guide/o'quv markazi) bo'limining kontent modeli.
//
// MUHIM — bu fayl FAQAT frontend structured data. Hech qanday backend/D1/R2
// yozuvi yo'q, hech qanday API chaqiruvi yo'q. TIER_PRICE/TIER_LABEL/
// TIER_COLOR — pricing.js'dan FAQAT O'QIB olinadi (import), pricing logikasi
// bu yerda umuman qayta yozilmagan/o'zgartirilmagan.
//
// Ekran namoyishlari ("frames") — ikki xil bo'lishi mumkin (`kind`):
//   - 'real': /public/guides/<id>/frame-N.jpg — HAQIQIY NFCSTORE interfeysi
//     skrinshoti. MUHIM: bu skrinshotlar production nfcstore.uz'dan
//     OLINMAGAN (bu muhitdan tashqi tarmoqqa umuman chiqib bo'lmaydi) —
//     buning o'rniga xuddi shu frontend kodi (aynan shu React komponentlar,
//     aynan shu CSS) mahalliy (local), butunlay alohida, bir martalik test
//     D1/R2 bilan ishga tushirilib, ochiq-oydin DEMO ma'lumotlar (masalan
//     "Aziz Karimov", "Demo Do'kon") bilan to'ldirilgan holda skrinshot
//     qilingan. Production'ga hech qanday yozuv/o'qish bo'lmagan, hech
//     qanday haqiqiy foydalanuvchi ma'lumoti ko'rsatilmagan.
//   - 'mock': <GuideMockFrame> orqali chiziladigan sxematik namoyish —
//     faqat jismoniy amal (NFC kartani telefonga yaqinlashtirish) yoki
//     hozircha production'da o'chirilgan funksiya (auksion stavkasi —
//     Payme hali yoqilmagan) uchun, har doim "Demo" belgisi bilan
//     ko'rsatiladi.

import { TIER_PRICE, TIER_LABEL, TIER_COLOR } from './pricing.js';

export const GUIDE_TABS = [
  { id: 'shaxsiy', label: 'Shaxsiy profil' },
  { id: 'kompaniya', label: 'Kompaniya profili' },
];

export const GUIDE_CATEGORIES = [
  { id: 'all', label: 'Barchasi' },
  { id: 'boshlash', label: 'Boshlash' },
  { id: 'profil', label: 'Profil' },
  { id: 'kompaniya', label: 'Kompaniya' },
  { id: 'nfc', label: 'NFC' },
  { id: 'karta', label: 'Karta' },
  { id: 'auksion', label: 'Auksion' },
  { id: 'tariflar', label: 'Tariflar' },
  { id: 'sozlamalar', label: 'Sozlamalar' },
];

// tab: 'shaxsiy' | 'kompaniya' | 'both' — 'both' har ikkala tabda ham ko'rinadi
// (NFC karta, auksion va tariflar — ikkala profil turi uchun ham tegishli).
// id — tab+category+sortOrder'dan hosil qilinadi (har bir bo'lim ichida
// sortOrder o'ziga xos, tab bo'limlarni bir-biridan ajratadi) — sarlavha
// matniga bog'liq emas, shuning uchun sarlavha tahrirlansa ham barqaror.
function lesson(sortOrder, title, description, category, tab, durationMin) {
  return {
    id: `${tab}-${category}-${sortOrder}`,
    sortOrder, title, description, category, tab, durationMin,
    frames: null, // pastda alohida to'ldiriladigan "flagship" darslardan tashqari
  };
}

// ─────────────────────────── 1) Shaxsiy profil (30 ta) ───────────────────────────
const PERSONAL = [
  lesson(1, "NFCSTORE'da ro'yxatdan o'tish", "Telefon raqami bilan hisob yaratish va birinchi kirish.", 'boshlash', 'shaxsiy', 2),
  lesson(2, 'Shaxsiy profil yaratish', "Ro'yxatdan o'tgach shaxsiy raqamli tashrif qog'ozini ochish.", 'boshlash', 'shaxsiy', 2),
  lesson(3, 'NFC ID tanlash', "Bronza/Silver/Gold/Premium/Ekslyuziv — o'zingizga mos ID darajasini tanlash.", 'nfc', 'shaxsiy', 2),
  lesson(4, "Profilni to'liq to'ldirish", 'Barcha asosiy bo‘limlarni birma-bir to‘ldirish tartibi.', 'profil', 'shaxsiy', 2),
  lesson(5, 'Ism va familiya', 'Profilingizda ko‘rinadigan ismni kiritish/o‘zgartirish.', 'profil', 'shaxsiy', 1),
  lesson(6, 'Lavozim va faoliyat', 'Kasb yoki faoliyat yo‘nalishini profilga qo‘shish.', 'profil', 'shaxsiy', 1),
  lesson(7, 'Profil rasmi', 'Avatar rasmini yuklash va almashtirish.', 'profil', 'shaxsiy', 1),
  lesson(8, 'Profil fonini o‘zgartirish', 'Profil sahifasi fon rasmini tanlash.', 'profil', 'shaxsiy', 1),
  lesson(9, 'Telefon raqami', 'Kontakt telefon raqamini qo‘shish va ko‘rsatish/yashirish.', 'profil', 'shaxsiy', 1),
  lesson(10, 'Email', 'Elektron pochta manzilini profilga qo‘shish.', 'profil', 'shaxsiy', 1),
  lesson(11, 'Telegram', 'Telegram havolasini/username’ini ulash.', 'profil', 'shaxsiy', 1),
  lesson(12, 'Instagram', 'Instagram sahifangizga havola qo‘shish.', 'profil', 'shaxsiy', 1),
  lesson(13, 'WhatsApp', 'WhatsApp orqali to‘g‘ridan bog‘lanish tugmasini yoqish.', 'profil', 'shaxsiy', 1),
  lesson(14, 'Facebook va boshqa tarmoqlar', 'Facebook, X va boshqa ijtimoiy tarmoqlarni qo‘shish.', 'profil', 'shaxsiy', 1),
  lesson(15, 'Sayt manzili', 'Shaxsiy yoki ish veb-saytingiz havolasini qo‘shish.', 'profil', 'shaxsiy', 1),
  lesson(16, 'Men haqimda', 'Qisqa bio/tavsif matnini yozish.', 'profil', 'shaxsiy', 1),
  lesson(17, 'Manzil va geolokatsiya', 'Xaritada ko‘rinadigan manzilni belgilash.', 'profil', 'shaxsiy', 2),
  lesson(18, 'Profil dizayni', 'Mavzu (tema) va ranglarni tanlash.', 'profil', 'shaxsiy', 2),
  lesson(19, 'NFC karta dizayni', 'Jismoniy NFC karta ko‘rinishini tanlash.', 'karta', 'shaxsiy', 2),
  lesson(20, 'NFC kartaga buyurtma', 'Tayyor dizaynni jismoniy kartaga buyurtma qilish.', 'karta', 'shaxsiy', 2),
  lesson(21, 'QR kod', 'Profilingiz uchun QR kodni ko‘rish va ulashish.', 'karta', 'shaxsiy', 1),
  lesson(22, 'Profil linkini ulashish', 'nfcstore.uz/kod havolasini do‘stlar bilan ulashish.', 'profil', 'shaxsiy', 1),
  lesson(23, 'Telefonni kartaga yaqinlashtiring', 'NFC kartani telefonga yaqinlashtirib profilni ochish.', 'nfc', 'shaxsiy', 1),
  lesson(24, 'Post joylashtirish', 'Profilingizga yangi post qo‘shish.', 'profil', 'shaxsiy', 2),
  lesson(25, 'Video joylashtirish', 'Profilga qisqa video yuklash.', 'profil', 'shaxsiy', 2),
  lesson(26, 'Tarif tanlash', 'Bronza/Silver/Gold/Premium orasidan tarif tanlash.', 'tariflar', 'shaxsiy', 2),
  lesson(27, 'Tarifni oshirish', 'Mavjud profilni yuqoriroq tarifga o‘tkazish.', 'tariflar', 'shaxsiy', 2),
  lesson(28, 'Profil statistikasi', 'Ko‘rishlar va bosishlar statistikasini kuzatish.', 'sozlamalar', 'shaxsiy', 2),
  lesson(29, 'Obunachilar', 'Profilingizga obuna bo‘lganlar ro‘yxatini ko‘rish.', 'sozlamalar', 'shaxsiy', 1),
  lesson(30, 'Profil xavfsizligi', 'Parol va hisob xavfsizligi sozlamalari.', 'sozlamalar', 'shaxsiy', 2),
];

// ─────────────────────────── 2) Kompaniya profili (23 ta) ───────────────────────────
const COMPANY = [
  lesson(1, 'Kompaniya profilini yaratish', 'Yangi kompaniya profilini ochish bosqichlari.', 'kompaniya', 'kompaniya', 2),
  lesson(2, 'Faoliyat turini tanlash', 'Kompaniyangiz sohasini (kategoriyasini) belgilash.', 'kompaniya', 'kompaniya', 1),
  lesson(3, 'Kompaniya NFC ID', 'Kompaniya uchun alohida NFC ID tanlash.', 'nfc', 'kompaniya', 2),
  lesson(4, 'Kompaniya nomi', 'Rasmiy nom va qisqa nomni kiritish.', 'kompaniya', 'kompaniya', 1),
  lesson(5, 'Logo yuklash', 'Kompaniya logotipini yuklash.', 'kompaniya', 'kompaniya', 1),
  lesson(6, 'Cover/banner', 'Profil tepasidagi banner rasmini o‘rnatish.', 'kompaniya', 'kompaniya', 1),
  lesson(7, 'Kompaniya haqida', 'Qisqa tavsif matnini yozish.', 'kompaniya', 'kompaniya', 1),
  lesson(8, 'Kontaktlar', 'Telefon, email va ish vaqtini qo‘shish.', 'kompaniya', 'kompaniya', 1),
  lesson(9, 'Telegram/Instagram/WhatsApp', 'Ijtimoiy tarmoq va messenjer havolalarini ulash.', 'kompaniya', 'kompaniya', 1),
  lesson(10, 'Manzil va geolokatsiya', 'Filial yoki ofis manzilini xaritada belgilash.', 'kompaniya', 'kompaniya', 2),
  lesson(11, 'Galereya', 'Kompaniya rasm galereyasini to‘ldirish.', 'kompaniya', 'kompaniya', 2),
  lesson(12, 'Mahsulot qo‘shish', 'Katalogga yangi mahsulot qo‘shish.', 'kompaniya', 'kompaniya', 2),
  lesson(13, 'Xizmat qo‘shish', 'Ko‘rsatiladigan xizmatlar ro‘yxatini to‘ldirish.', 'kompaniya', 'kompaniya', 2),
  lesson(14, 'Narx qo‘shish', 'Mahsulot/xizmatga narx belgilash.', 'kompaniya', 'kompaniya', 1),
  lesson(15, 'Aksiya yaratish', 'Vaqtinchalik aksiya/chegirma e’lon qilish.', 'kompaniya', 'kompaniya', 2),
  lesson(16, 'Maxsus taklif', 'Mijozlarga alohida taklif joylashtirish.', 'kompaniya', 'kompaniya', 1),
  lesson(17, 'Profilni ulashish', 'Kompaniya profil havolasini ulashish.', 'kompaniya', 'kompaniya', 1),
  lesson(18, 'QR', 'Kompaniya QR kodini olish.', 'karta', 'kompaniya', 1),
  lesson(19, 'NFC karta', 'Kompaniya uchun jismoniy NFC karta buyurtma qilish.', 'karta', 'kompaniya', 2),
  lesson(20, 'Xodimlar/profillar', 'Xodimlar uchun alohida profillar biriktirish.', 'kompaniya', 'kompaniya', 2),
  lesson(21, 'Buyurtmalar', 'Kelib tushgan buyurtmalarni ko‘rish.', 'kompaniya', 'kompaniya', 2),
  lesson(22, 'Statistika', 'Kompaniya profili statistikasini kuzatish.', 'sozlamalar', 'kompaniya', 2),
  lesson(23, 'Tariflar', 'Kompaniya uchun mavjud tariflarni ko‘rish.', 'tariflar', 'kompaniya', 2),
];

// ─────────────────────────── 3) Restoran uchun alohida (6 ta) ───────────────────────────
const RESTAURANT = [
  lesson(24, 'Restoran menyusini yaratish', 'Raqamli menyu bo‘limini ishga tushirish.', 'kompaniya', 'kompaniya', 2),
  lesson(25, 'Menyu kategoriyasi', 'Taomlarni kategoriyalarga ajratish.', 'kompaniya', 'kompaniya', 1),
  lesson(26, 'Taom qo‘shish', 'Menyuga yangi taom qo‘shish.', 'kompaniya', 'kompaniya', 2),
  lesson(27, 'Taom rasmi', 'Taomga rasm biriktirish.', 'kompaniya', 'kompaniya', 1),
  lesson(28, 'Narx va tavsif', 'Taom narxi va qisqa tavsifini kiritish.', 'kompaniya', 'kompaniya', 1),
  lesson(29, 'Menyu tartibi', 'Taomlar va kategoriyalar tartibini belgilash.', 'kompaniya', 'kompaniya', 1),
];

// ─────────────────────────── 4) Auksion (10 ta, ikkala tab uchun ham) ───────────────────────────
const AUCTION = [
  lesson(1, 'Auksion nima?', 'NFC ID auksionining umumiy tamoyili.', 'auksion', 'both', 1),
  lesson(2, "Auksiondagi NFC ID'larni topish", 'Faol auksionlar ro‘yxatini ko‘rish.', 'auksion', 'both', 1),
  lesson(3, 'ID sahifasini ochish', 'Auksiondagi bitta ID’ning tafsilot sahifasi.', 'auksion', 'both', 1),
  lesson(4, 'Boshlang‘ich narx', 'Auksion qanday boshlang‘ich narxdan boshlanadi.', 'auksion', 'both', 1),
  lesson(5, 'Taklif/stavka berish', "O'z taklifingizni (stavka) qo'yish jarayoni — DEMO (real stavka production'da berilmaydi).", 'auksion', 'both', 2),
  lesson(6, 'Eng yuqori taklif', 'Joriy eng yuqori taklifni kuzatish.', 'auksion', 'both', 1),
  lesson(7, 'Auksion vaqtini kuzatish', 'Tugash vaqti va qolgan muddatni ko‘rish.', 'auksion', 'both', 1),
  lesson(8, 'Mening takliflarim', 'O‘zingiz qo‘ygan takliflar tarixini ko‘rish.', 'auksion', 'both', 1),
  lesson(9, 'Auksionda yutish', 'G‘olib bo‘lgach nima sodir bo‘lishi.', 'auksion', 'both', 1),
  lesson(10, 'Yutgandan keyingi jarayon', 'To‘lov va ID’ni profilga biriktirish tartibi.', 'auksion', 'both', 2),
];

// ─────────────────────────── 5) NFC karta (10 ta, ikkala tab uchun ham) ───────────────────────────
const NFC_CARD = [
  lesson(1, 'NFC nima?', 'NFC texnologiyasi qisqacha tushuntirish.', 'nfc', 'both', 1),
  lesson(2, 'Telefonni kartaga qanday yaqinlashtirish', 'Telefon va karta orasidagi to‘g‘ri masofa/holat.', 'nfc', 'both', 1),
  lesson(3, 'Android NFC', 'Android telefonda NFC funksiyasini yoqish.', 'nfc', 'both', 1),
  lesson(4, 'iPhone NFC', 'iPhone’da NFC bilan ishlash xususiyatlari.', 'nfc', 'both', 1),
  lesson(5, 'Profil qanday ochiladi', 'Karta o‘qilgach brauzerda profil ochilishi.', 'nfc', 'both', 1),
  lesson(6, 'QR orqali ochish', 'NFC ishlamasa QR kod orqali ochish.', 'nfc', 'both', 1),
  lesson(7, 'Kartani ulashish', 'Kartani boshqa odamga ulashish yo‘llari.', 'karta', 'both', 1),
  lesson(8, 'Karta dizayni', 'Jismoniy karta ko‘rinishini tanlash.', 'karta', 'both', 2),
  lesson(9, 'Kartaga buyurtma', 'Tayyor dizaynni buyurtma qilish bosqichlari.', 'karta', 'both', 2),
  lesson(10, 'NFC o‘qish statistikasi', 'Karta necha marta o‘qilganini kuzatish.', 'sozlamalar', 'both', 1),
];

// ─────────────────────────── 6) Tariflar — REAL narxlardan dinamik ───────────────────────────
// Bu yerda narx HECH QAERDA qo'lda yozilmagan — TIER_PRICE/TIER_LABEL
// to'g'ridan-to'g'ri src/lib/pricing.js'dan import qilinadi. Pricing
// o'zgarsa (masalan kelajakda), bu qo'llanma sahifasi ham avtomatik
// yangilanadi — alohida yangilash kerak bo'lmaydi.
const TIER_ORDER = ['free', 'silver', 'gold', 'premium', 'exclusive'];
export const PRICING_OVERVIEW = TIER_ORDER.map((key) => ({
  key,
  label: TIER_LABEL[key],
  price: TIER_PRICE[key], // null = Ekslyuziv (faqat auksion)
  color: TIER_COLOR[key],
}));

const PRICING_GUIDE = [
  {
    ...lesson(1, 'Tariflar va narxlar', "Bronza, Silver, Gold, Premium va Ekslyuziv — barcha NFC ID tariflarining joriy narxlari.", 'tariflar', 'both', 2),
    isPricingOverview: true,
  },
];

// ─────────────────────────── "Flagship" — to'liq animatsiyali darslar ───────────────────────────
// Quyidagi 10 ta dars uchun HAQIQIY NFCSTORE skrinshotlari ishlatiladi
// (`kind: 'real'`) — mahalliy (production EMAS) sinov muhitida, demo
// hisob/kompaniya/auksion ma'lumotlari bilan olingan (fayl boshidagi katta
// izohga qarang). Faqat jismoniy amal (NFC kartani telefonga yaqinlashtirish)
// yoki hozircha o'chirilgan funksiya (auksion stavkasi — to'lov tizimi hali
// yoqilmagan) uchun `kind: 'mock'` (sxematik namoyish, aniq "Demo" belgisi
// bilan) ishlatiladi. Qolgan barcha darslar (frames: null) katalogda "tez
// orada" holatida qoladi.
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

const FLAGSHIP_FRAMES = {
  // 1. "NFCSTORE'da ro'yxatdan o'tish" — to'liq real oqim, haqiqiy Telegram
  // OTP kodi bilan (mahalliy sinov muhitida generatsiya qilingan).
  'shaxsiy-boshlash-1': [
    realFrame(1, 'shaxsiy-boshlash-1', 1, "Bosh sahifada yuqori o‘ng burchakdagi «Bepul profil yaratish» tugmasini bosing.", { cursorX: 97, cursorY: 7, highlightBox: { xPct: 90, yPct: 4, wPct: 10, hPct: 6 } }),
    realFrame(2, 'shaxsiy-boshlash-1', 2, 'Email, parol, telefon raqamingizni kiriting va botga yozganingizni tasdiqlang.', { cursorX: 67, cursorY: 73, highlightBox: { xPct: 54, yPct: 70, wPct: 26, hPct: 6 } }),
    realFrame(3, 'shaxsiy-boshlash-1', 3, '«Kod yuborish»ni bosgach, tasdiqlash kodi Telegram botga yuboriladi.', { cursorX: 74, cursorY: 97 }),
    realFrame(4, 'shaxsiy-boshlash-1', 4, 'Kelgan kodni kiriting, shartlarga rozilik bildiring va «Akkaunt yaratish»ni bosing.', { cursorX: 62, cursorY: 65, clickEffect: true }),
    realFrame(5, 'shaxsiy-boshlash-1', 5, 'Tabriklaymiz — hisobingiz va shaxsiy NFC ID’ingiz tayyor!', { zoomTarget: 'center', durationMs: 2800 }),
  ],
  // 2. "Shaxsiy profil yaratish"
  'shaxsiy-boshlash-2': [
    realFrame(1, 'shaxsiy-boshlash-2', 1, 'Ro‘yxatdan o‘tgach, profilingiz avtomatik yaratiladi — hali bo‘sh, faqat ID bilan.', { cursorX: 69, cursorY: 44, highlightBox: { xPct: 64, yPct: 41, wPct: 9, hPct: 4 } }),
    realFrame(2, 'shaxsiy-boshlash-2', 2, '«Tahrirlash» tugmasi orqali profil sozlamalariga kirasiz.', { cursorX: 19, cursorY: 63 }),
    realFrame(3, 'shaxsiy-boshlash-2', 3, 'Barcha o‘zgarishlar o‘ng tarafdagi jonli oldindan ko‘rishda darhol ko‘rinadi.', { cursorX: 12, cursorY: 60, zoomTarget: 'left center' }),
    realFrame(4, 'shaxsiy-boshlash-2', 4, 'Tayyor — profilingiz shunday ko‘rinadi, istalgan vaqt qayta tahrirlashingiz mumkin.', { zoomTarget: 'center', durationMs: 2600 }),
  ],
  // 3. "Profilni to'liq to'ldirish"
  'shaxsiy-profil-4': [
    realFrame(1, 'shaxsiy-profil-4', 1, 'Profilni to‘ldirish «Asosiy ma’lumot» bo‘limidan boshlanadi: rasm, ism, kasb, bio.', { cursorX: 20, cursorY: 84 }),
    realFrame(2, 'shaxsiy-profil-4', 2, 'Rasm va ismni to‘ldirgach, o‘ng tarafdagi kartochka darhol yangilanadi.', { cursorX: 10, cursorY: 60, zoomTarget: 'right center' }),
    realFrame(3, 'shaxsiy-profil-4', 3, 'Keyin «Aloqa va ijtimoiy tarmoqlar» bo‘limini to‘ldiring.', { cursorX: 12, cursorY: 40 }),
    realFrame(4, 'shaxsiy-profil-4', 4, 'Barcha maydonlar to‘ldirilgach, profilingiz to‘liq va professional ko‘rinadi.', { zoomTarget: 'center', durationMs: 2600 }),
  ],
  // 4. "Profil rasmi" (Avatar yuklash)
  'shaxsiy-profil-7': [
    realFrame(1, 'shaxsiy-profil-7', 1, 'Yangi profilingizda standart holatda ismning bosh harfi ko‘rsatiladi.', { cursorX: 50, cursorY: 63 }),
    realFrame(2, 'shaxsiy-profil-7', 2, '«Asosiy ma’lumot» bo‘limida «Rasm tanlash»ni bosing.', { cursorX: 19, cursorY: 84, highlightBox: { xPct: 14, yPct: 82, wPct: 10, hPct: 5 } }),
    realFrame(3, 'shaxsiy-profil-7', 3, 'Tanlangan rasm darhol yuklanadi va o‘ng tarafdagi jonli oldindan ko‘rishda chiqadi.', { cursorX: 10, cursorY: 60, zoomTarget: 'right center', clickEffect: true }),
    realFrame(4, 'shaxsiy-profil-7', 4, 'Yangi profil rasmi endi ommaviy sahifangizda ko‘rinadi.', { zoomTarget: 'center', durationMs: 2600 }),
  ],
  // 5. "Telegram" (Telegram/Instagram/telefon qo'shish)
  'shaxsiy-profil-11': [
    mockFrame(1, 'form', '«Aloqa va ijtimoiy tarmoqlar» bo‘limini oching — u boshida yopiq turadi.', { cursorX: 30, cursorY: 40 }),
    realFrame(2, 'shaxsiy-profil-11', 2, 'Telegram foydalanuvchi nomingizni kiriting.', { cursorX: 25, cursorY: 15, highlightBox: { xPct: 3, yPct: 66, wPct: 30, hPct: 6 } }),
    realFrame(3, 'shaxsiy-profil-11', 3, 'Xuddi shunday Instagram, Facebook va boshqa tarmoqlarni ham qo‘shishingiz mumkin.', { cursorX: 25, cursorY: 25 }),
    realFrame(4, 'shaxsiy-profil-11', 4, 'Saqlagach, tugmalar to‘g‘ridan-to‘g‘ri profilingizda ko‘rinadi.', { zoomTarget: 'right center', durationMs: 2600 }),
  ],
  // 6. "NFC ID tanlash"
  'shaxsiy-nfc-3': [
    realFrame(1, 'shaxsiy-nfc-3', 1, 'Narxlar sahifasida Bronza, Silver, Gold, Premium va Ekslyuziv tariflarini solishtiring.', { cursorX: 30, cursorY: 68, highlightBox: { xPct: 5, yPct: 63, wPct: 40, hPct: 7 } }),
    realFrame(2, 'shaxsiy-nfc-3', 2, 'Katalogda band qilingan ID’lar va ularning darajasi (rangli belgi) ko‘rinadi.', { cursorX: 40, cursorY: 40 }),
    realFrame(3, 'shaxsiy-nfc-3', 3, 'Ro‘yxatdan o‘tganda avtomatik bepul 8 xonali ID beriladi — yoki narxlar sahifasidan yuqoriroq darajani tanlashingiz mumkin.', { zoomTarget: 'center', durationMs: 2700 }),
  ],
  // 7. "Telefonni kartaga yaqinlashtiring" (NFC kartadan foydalanish)
  'shaxsiy-nfc-23': [
    mockFrame(1, 'tap', 'NFC kartangizni tayyorlang.', { cursorX: 50, cursorY: 70 }),
    mockFrame(2, 'tap', 'Telefoningizni kartaning orqa tomoniga yaqinlashtiring.', { cursorX: 50, cursorY: 40, highlight: 'nfc-zone' }),
    mockFrame(3, 'tap', '“Tegizish” shart emas — yaqinlashtirish kifoya. Telefon kartani avtomatik aniqlaydi.', { cursorX: 50, cursorY: 40, clickEffect: true }),
    realFrame(4, 'shaxsiy-boshlash-1', 5, 'Profil avtomatik ravishda telefon brauzerida ochiladi.', { zoomTarget: 'center', durationMs: 2600 }),
  ],
  // 8. "Kompaniya profilini yaratish"
  'kompaniya-kompaniya-1': [
    realFrame(1, 'kompaniya-kompaniya-1', 1, '«Kompaniya yaratish» sahifasida o‘ziga xos Company ID tanlang.', { cursorX: 77, cursorY: 44, highlightBox: { xPct: 62, yPct: 42, wPct: 30, hPct: 3 } }),
    realFrame(2, 'kompaniya-kompaniya-1', 2, 'Kompaniya nomi, yo‘nalishi, shahar va kontaktlarni kiriting.', { cursorX: 50, cursorY: 30 }),
    realFrame(3, 'kompaniya-kompaniya-1', 3, 'Barcha maydonlarni to‘ldirib bo‘lgach, arizani yuboring.', { cursorX: 76, cursorY: 68, clickEffect: true }),
    realFrame(4, 'kompaniya-kompaniya-1', 4, 'Ariza yuborildi — admin tekshiruvi paytida ham boshqaruv panelidan foydalanishingiz mumkin.', { zoomTarget: 'center', durationMs: 2700 }),
  ],
  // 9. "Kompaniya haqida" (Kompaniya profilini to'ldirish)
  'kompaniya-kompaniya-7': [
    realFrame(1, 'kompaniya-kompaniya-7', 1, 'Business Workspace — chap menyudan «Profil» bo‘limini oching.', { cursorX: 9, cursorY: 30, highlightBox: { xPct: 1, yPct: 27, wPct: 17, hPct: 6 } }),
    realFrame(2, 'kompaniya-kompaniya-7', 2, 'Nomi, kichik soha, «Biz haqimizda» va logo/muqova havolalarini kiriting.', { cursorX: 50, cursorY: 50 }),
    realFrame(3, 'kompaniya-kompaniya-7', 3, 'Katalog bo‘limida mahsulot/xizmatlaringizni qo‘shasiz.', { cursorX: 9, cursorY: 40 }),
    realFrame(4, 'kompaniya-kompaniya-7', 4, '«Aloqa» bo‘limida telefon, ish vaqti va manzilni to‘ldiring.', { cursorX: 9, cursorY: 46, zoomTarget: 'center', durationMs: 2600 }),
  ],
  // 10. "Taklif/stavka berish" (Auksionda qatnashish) — oxirgi ikki frame DEMO
  // (Payme hali yoqilmagani uchun real stavka berish formasi hozircha
  // o'chirilgan — buni real skrinshot ham tasdiqlaydi, 2-frame'ga qarang).
  'both-auksion-5': [
    realFrame(1, 'both-auksion-5', 1, 'Auksion sahifasida faol lotlar ro‘yxatini ko‘ring.', { cursorX: 72, cursorY: 37 }),
    realFrame(2, 'both-auksion-5', 2, 'Lot sahifasida joriy narx, qolgan vaqt va «Darhol sotib olish» narxi ko‘rinadi.', { cursorX: 20, cursorY: 57 }),
    mockFrame(3, 'form', 'Taklif summasini kiritasiz (demo qiymat — to‘lov tizimi yoqilgach ishlaydi).', { cursorX: 50, cursorY: 55 }),
    mockFrame(4, 'card', '«Taklif berish»ni bosasiz — bu FAQAT namoyish, hozircha real stavka berilmaydi.', { cursorX: 50, cursorY: 70, clickEffect: true }),
  ],
};

// ─────────────────────────── Yig'ish ───────────────────────────
export const GUIDES = [
  ...PERSONAL, ...COMPANY, ...RESTAURANT, ...AUCTION, ...NFC_CARD, ...PRICING_GUIDE,
].map((g) => ({ ...g, frames: FLAGSHIP_FRAMES[g.id] || null }));

export function guideDurationLabel(min) {
  return min <= 1 ? '1 daqiqa' : `${min} daqiqa`;
}
