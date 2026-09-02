// "Qo'llanma" (Guide/o'quv markazi) bo'limining kontent modeli.
//
// MUHIM — bu fayl FAQAT frontend structured data. Hech qanday backend/D1/R2
// yozuvi yo'q, hech qanday API chaqiruvi yo'q. TIER_PRICE/TIER_LABEL/
// TIER_COLOR — pricing.js'dan FAQAT O'QIB olinadi (import), pricing logikasi
// bu yerda umuman qayta yozilmagan/o'zgartirilmagan.
//
// Ekran namoyishlari ("frames"): bu bosqichda HECH QANDAY real production
// screenshot ishlatilmagan — buning o'rniga <GuideMockFrame> orqali
// chiziladigan, sxematik ("mock") interfeys ko'rinishlari ishlatiladi
// (haqiqiy foydalanuvchi ma'lumoti, real profil yoki real auksion holati
// ko'rsatilmaydi). `image` maydoni shuning uchun rasm URL emas, balki
// <GuideMockFrame>ga uzatiladigan sxema nomi (`variant`) — keyinchalik bu
// qiymatlarni real screenshot URL'lariga almashtirish oson (data shakli
// o'zgarmaydi), lekin bu birinchi versiya uchun shart emas.

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
// Har biriga ekran-namoyish (frame) ketma-ketligi qo'shilgan. Qolgan barcha
// darslar hozircha faqat matn/metama'lumot bilan katalogda ko'rinadi ("tez
// orada to'ldiriladi" holati) — bu tanlov TASODIFIY EMAS: user talab qilgan
// "misol flow" (Profil rasmini o'zgartirish) shu ro'yxatda, va har bir asosiy
// kategoriyadan (boshlash/NFC/karta/auksion/kompaniya) kamida bitta to'liq
// misol bor.
function frame(sortOrder, image, caption, opts = {}) {
  return {
    sortOrder,
    image, // GuideMockFrame variant nomi — pastdagi izohga qarang
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
  // "NFCSTORE'da ro'yxatdan o'tish"
  'shaxsiy-boshlash-1': [
    frame(1, 'form', "Bosh sahifada “Bepul profil yaratish” tugmasini bosing.", { cursorX: 78, cursorY: 18, highlight: 'topbar' }),
    frame(2, 'form', 'Telefon raqamingizni kiriting.', { cursorX: 50, cursorY: 42 }),
    frame(3, 'form', 'Telegram botga kelgan tasdiqlash kodini kiriting.', { cursorX: 50, cursorY: 58, clickEffect: true }),
    frame(4, 'dashboard', 'Tabriklaymiz — hisobingiz tayyor!', { cursorX: 50, cursorY: 50, zoomTarget: 'center' }),
  ],
  // "NFC ID tanlash"
  'shaxsiy-nfc-3': [
    frame(1, 'grid', 'Narxlar sahifasida mavjud tariflarni ko‘ring.', { cursorX: 30, cursorY: 30 }),
    frame(2, 'grid', 'Bronza, Silver, Gold, Premium yoki Ekslyuziv — birini tanlang.', { cursorX: 55, cursorY: 45, highlight: 'card-2' }),
    frame(3, 'grid', 'Mavjud ID’lardan birini bosing.', { cursorX: 55, cursorY: 45, clickEffect: true }),
    frame(4, 'form', 'ID sizga biriktiriladi va profil sahifangiz ochiladi.', { cursorX: 50, cursorY: 50, zoomTarget: 'center' }),
  ],
  // "Profil rasmi" — spec'dagi asosiy misol ("Profil rasmini o'zgartirish")
  'shaxsiy-profil-7': [
    frame(1, 'dashboard', '“Mening profilim” bo‘limini oching.', { cursorX: 85, cursorY: 12, highlight: 'topbar' }),
    frame(2, 'dashboard', 'Bosing.', { cursorX: 85, cursorY: 12, clickEffect: true }),
    frame(3, 'card', 'Profil tahrirlash oynasi ochiladi.', { cursorX: 50, cursorY: 50 }),
    frame(4, 'card', 'Avatar qismini bosing va yangi rasm tanlang.', { cursorX: 22, cursorY: 28, highlight: 'avatar', zoomTarget: 'top left' }),
    frame(5, 'card', 'Yangi profil rasmi saqlandi.', { cursorX: 22, cursorY: 28, clickEffect: true }),
  ],
  // "Telefonni kartaga yaqinlashtiring"
  'shaxsiy-nfc-23': [
    frame(1, 'tap', 'NFC kartangizni tayyorlang.', { cursorX: 50, cursorY: 70 }),
    frame(2, 'tap', 'Telefoningizni kartaning orqa tomoniga yaqinlashtiring.', { cursorX: 50, cursorY: 40, highlight: 'nfc-zone' }),
    frame(3, 'tap', "Telefon kartani aniqlaydi — “tegizish” shart emas, yaqinlashtirish kifoya.", { cursorX: 50, cursorY: 40, clickEffect: true }),
    frame(4, 'dashboard', 'Profil avtomatik ravishda brauzerda ochiladi.', { cursorX: 50, cursorY: 50, zoomTarget: 'center' }),
  ],
  // "Taklif/stavka berish" — AUKSION, o'qish-uchun demo
  'both-auksion-5': [
    frame(1, 'grid', 'Auksion sahifasida ID’ni oching (demo).', { cursorX: 40, cursorY: 35 }),
    frame(2, 'card', 'Joriy eng yuqori taklifni ko‘ring.', { cursorX: 50, cursorY: 40, highlight: 'price' }),
    frame(3, 'form', 'O‘z taklifingiz summasini kiriting (demo qiymat).', { cursorX: 50, cursorY: 55 }),
    frame(4, 'card', '“Taklif berish”ni bosing — bu FAQAT namoyish, real stavka emas.', { cursorX: 50, cursorY: 70, clickEffect: true }),
  ],
  // "Kompaniya profilini yaratish"
  'kompaniya-kompaniya-1': [
    frame(1, 'form', '“Kompaniya yaratish” bo‘limini oching.', { cursorX: 60, cursorY: 20 }),
    frame(2, 'form', 'Kompaniya nomi va faoliyat turini kiriting.', { cursorX: 50, cursorY: 45 }),
    frame(3, 'form', 'Logo yuklang.', { cursorX: 30, cursorY: 55, highlight: 'avatar' }),
    frame(4, 'dashboard', 'Kompaniya profili tayyor — endi to‘ldirishni davom ettiring.', { cursorX: 50, cursorY: 50, zoomTarget: 'center' }),
  ],
};

// ─────────────────────────── Yig'ish ───────────────────────────
export const GUIDES = [
  ...PERSONAL, ...COMPANY, ...RESTAURANT, ...AUCTION, ...NFC_CARD, ...PRICING_GUIDE,
].map((g) => ({ ...g, frames: FLAGSHIP_FRAMES[g.id] || null }));

export function guideDurationLabel(min) {
  return min <= 1 ? '1 daqiqa' : `${min} daqiqa`;
}
