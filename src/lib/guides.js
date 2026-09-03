// "Qo'llanma" (Guide/o'quv markazi) bo'limining kontent modeli.
//
// MUHIM — bu fayl FAQAT frontend structured data. Hech qanday backend/D1/R2
// yozuvi yo'q, hech qanday API chaqiruvi yo'q. TIER_PRICE/TIER_LABEL/
// TIER_COLOR — pricing.js'dan FAQAT O'QIB olinadi (import), pricing logikasi
// bu yerda umuman qayta yozilmagan/o'zgartirilmagan.
//
// Ekran namoyishlari ("frames") — ikki xil bo'lishi mumkin (`kind`):
//   - 'real': /public/guides/<folder>/frame-N.jpg — HAQIQIY NFCSTORE
//     interfeysi skrinshoti. Bu skrinshotlar production nfcstore.uz'dan
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
//     hali yoqilmagan) yoki login talab qiladigan oraliq bosqich uchun, har
//     doim "Demo" belgisi bilan ko'rsatiladi.
//
// v3 — YAKUNIY 6 GUIDE: oldingi versiyada 12 ta o'rta darajadagi dars bor
// edi. Endi ular mantiqan 6 ta TO'LIQ, boshidan oxirigacha tushuntiruvchi
// darsga birlashtirildi (masalan "Ro'yxatdan o'tish" + "Profil yaratish" →
// bitta dars). Barcha real skrinshotlar — hech biri o'chirilmagan — shu 6
// dars ichida qayta guruhlangan, ba'zilari bir nechta bosqichda turli
// cursor/zoom/highlight bilan qayta ishlatilgan (masalan "Katalog" formasi
// bitta skrinshot — Mahsulot/Xizmat/Restoran menyusi uchastkalarida uchtasi
// ham xuddi shu universal katalog dvigателi orqali ishlaydi).

import { TIER_PRICE, TIER_LABEL, TIER_COLOR } from './pricing.js';

export const GUIDE_TABS = [
  { id: 'shaxsiy', label: 'Shaxsiy profil' },
  { id: 'kompaniya', label: 'Kompaniya profili' },
];

// Yakuniy 6 darsga mos soddalashtirilgan kategoriya filtri.
export const GUIDE_CATEGORIES = [
  { id: 'all', label: 'Barchasi' },
  { id: 'profil', label: 'Profil' },
  { id: 'kompaniya', label: 'Kompaniya' },
  { id: 'nfc', label: 'NFC' },
  { id: 'auksion', label: 'Auksion' },
];

function realFrame(sortOrder, folder, n, caption, opts = {}) {
  return {
    sortOrder,
    kind: 'real',
    image: `/guides/${folder}/frame-${n}.jpg`,
    thumb: `/guides/${folder}/frame-${n}-thumb.jpg`,
    caption,
    section: opts.section ?? null,
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
    section: opts.section ?? null,
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
  // ═══════════════════════ 1. Ro'yxatdan o'tish va shaxsiy profil yaratish ═══════════════════════
  guide(1, 'register-profile', "Ro'yxatdan o'tish va shaxsiy profil yaratish",
    "Noldan hisob ochish, tasdiqlash va birinchi profilingizni ko'rish — boshidan oxirigacha.", 'profil', 'shaxsiy', 3, [
      realFrame(1, 'shaxsiy-boshlash-1', 1, "Bosh sahifada yuqori o‘ng burchakdagi «Bepul profil yaratish» tugmasini bosing.", { cursorX: 97, cursorY: 7, highlightBox: { xPct: 90, yPct: 4, wPct: 10, hPct: 6 } }),
      realFrame(2, 'shaxsiy-boshlash-1', 2, 'Email, parol va telefon raqamingizni kiriting.', { cursorX: 67, cursorY: 73, highlightBox: { xPct: 54, yPct: 70, wPct: 26, hPct: 6 } }),
      realFrame(3, 'shaxsiy-boshlash-1', 3, '«Kod yuborish»ni bosgach, tasdiqlash kodi Telegram botga yuboriladi.', { cursorX: 74, cursorY: 97 }),
      realFrame(4, 'shaxsiy-boshlash-1', 4, 'Kelgan kodni kiriting, shartlarga rozilik bildiring va «Akkaunt yaratish»ni bosing.', { cursorX: 62, cursorY: 65, clickEffect: true }),
      realFrame(5, 'shaxsiy-boshlash-1', 5, 'Tabriklaymiz — hisobingiz tayyor! Sizga avtomatik 8 xonali profil ID’ berildi.', { zoomTarget: 'center', durationMs: 2700 }),
      realFrame(6, 'shaxsiy-boshlash-1', 5, 'MUHIM: bu 8 xonali ID — 0 so‘m, mutlaqo BEPUL. Bu alohida, 6 belgili PULLIK NFC ID (masalan ABZ007) bilan bir narsa emas — buni keyingi darsda ko‘rib chiqamiz.', { zoomTarget: 'left center', durationMs: 3000 }),
      realFrame(7, 'shaxsiy-boshlash-2', 1, 'Ro‘yxatdan o‘tgach, profilingiz avtomatik yaratiladi — hali bo‘sh, faqat ID bilan.', { cursorX: 69, cursorY: 44, highlightBox: { xPct: 64, yPct: 41, wPct: 9, hPct: 4 } }),
      realFrame(8, 'shaxsiy-boshlash-2', 2, '«Tahrirlash» tugmasi orqali «Mening profilim» sozlamalariga kirasiz.', { cursorX: 19, cursorY: 63 }),
      realFrame(9, 'shaxsiy-boshlash-2', 3, 'Barcha o‘zgarishlar o‘ng tarafdagi jonli oldindan ko‘rishda darhol ko‘rinadi.', { cursorX: 12, cursorY: 60, zoomTarget: 'left center' }),
      realFrame(10, 'shaxsiy-boshlash-2', 4, 'Tayyor — profilingiz shunday ko‘rinadi. Keyingi qadam: uni to‘liq sozlash.', { zoomTarget: 'center', durationMs: 2800 }),
    ]),

  // ═══════════════════════ 2. Shaxsiy profilni to'liq sozlash ═══════════════════════
  guide(2, 'profile-setup', 'Shaxsiy profilni to‘liq sozlash',
    'Rasm, ism, bio, kontaktlar va ijtimoiy tarmoqlar — profilingizni professional ko‘rinishga keltiring.', 'profil', 'shaxsiy', 3, [
      realFrame(1, 'shaxsiy-profil-4', 1, 'Profilni to‘ldirish «Asosiy ma’lumot» bo‘limidan boshlanadi: rasm, ism, kasb, bio.', { cursorX: 20, cursorY: 84 }),
      realFrame(2, 'shaxsiy-profil-4', 2, 'Rasm va ismni to‘ldirgach, o‘ng tarafdagi kartochka darhol yangilanadi.', { cursorX: 10, cursorY: 60, zoomTarget: 'right center' }),
      realFrame(3, 'shaxsiy-profil-7', 1, 'Standart holatda ismning bosh harfi ko‘rsatiladi — profil rasmi hali yo‘q.', { cursorX: 50, cursorY: 63 }),
      realFrame(4, 'shaxsiy-profil-7', 2, '«Rasm tanlash»ni bosing. Pastroqda «Dizayn va fon» bo‘limi ham bor.', { cursorX: 19, cursorY: 84, highlightBox: { xPct: 14, yPct: 82, wPct: 10, hPct: 5 } }),
      realFrame(5, 'shaxsiy-profil-7', 3, 'Tanlangan rasm darhol yuklanadi va jonli oldindan ko‘rishda chiqadi.', { cursorX: 10, cursorY: 60, zoomTarget: 'right center', clickEffect: true }),
      realFrame(6, 'shaxsiy-profil-7', 4, 'Yangi profil rasmi endi ommaviy sahifangizda ko‘rinadi.', { zoomTarget: 'center', durationMs: 2600 }),
      realFrame(7, 'shaxsiy-profil-4', 3, 'Keyin «Aloqa va ijtimoiy tarmoqlar» bo‘limini to‘ldiring.', { cursorX: 12, cursorY: 40 }),
      mockFrame(8, 'form', '«Aloqa va ijtimoiy tarmoqlar» bo‘limini oching — u boshida yopiq turadi.', { cursorX: 30, cursorY: 40 }),
      realFrame(9, 'shaxsiy-profil-11', 2, 'Telegram foydalanuvchi nomingizni kiriting.', { cursorX: 25, cursorY: 15, highlightBox: { xPct: 3, yPct: 66, wPct: 30, hPct: 6 } }),
      realFrame(10, 'shaxsiy-profil-11', 3, 'Xuddi shunday Instagram, Facebook, WhatsApp va boshqa tarmoqlarni ham qo‘shishingiz mumkin.', { cursorX: 25, cursorY: 25 }),
      realFrame(11, 'shaxsiy-profil-11', 4, 'Saqlagach, tugmalar to‘g‘ridan-to‘g‘ri profilingizda ko‘rinadi.', { zoomTarget: 'right center', durationMs: 2600 }),
      realFrame(12, 'shaxsiy-profil-4', 4, 'Barcha maydonlar to‘ldirilgach, profilingiz to‘liq va professional ko‘rinadi.', { zoomTarget: 'center', durationMs: 2800 }),
    ]),

  // ═══════════════════════ 3. NFC ID tanlash va sotib olish ═══════════════════════
  guide(3, 'nfc-id-purchase', 'NFC ID tanlash va sotib olish',
    "Bepul avtomatik ID bilan pullik 6 belgili NFC ID orasidagi farq, narxlar va buyurtma jarayoni.", 'nfc', 'shaxsiy', 3, [
      realFrame(1, 'shaxsiy-nfc-3', 1, 'Narxlar sahifasida Bronza, Silver, Gold, Premium va Ekslyuziv tariflarini solishtiring.', { cursorX: 30, cursorY: 68, highlightBox: { xPct: 5, yPct: 63, wPct: 40, hPct: 7 } }),
      realFrame(2, 'shaxsiy-nfc-3', 2, 'Katalogda band qilingan ID’lar va ularning darajasi (rangli belgi) ko‘rinadi.', { cursorX: 40, cursorY: 40 }),
      realFrame(3, 'shaxsiy-nfc-3', 2, 'Xohlagan ID’ni qidiruv orqali toping — masalan «ABZ007» yoki o‘zingizga yoqqan kombinatsiyani kiriting.', { cursorX: 25, cursorY: 40, clickEffect: true }),
      realFrame(4, 'shaxsiy-nfc-3', 1, 'Har bir daraja narxi kod naqshiga bog‘liq va qat’iy (o‘zgarmas) — pastdagi kalkulyatorda o‘zingizga mos ID narxini hisoblashingiz mumkin.', { zoomTarget: 'bottom center' }),
      realFrame(5, 'shaxsiy-nfc-3', 3, 'Ro‘yxatdan o‘tganda avtomatik BEPUL 8 xonali ID beriladi — yoki bu yerdan yuqoriroq darajadagi ID tanlashingiz mumkin.', { zoomTarget: 'center', durationMs: 2700 }),
      mockFrame(6, 'form', 'Tanlangan ID’ni band qilish uchun avval tizimga kiring — hisobingiz bo‘lishi shart.', { cursorX: 50, cursorY: 40 }),
      realFrame(7, 'order-payment', 1, 'Profilingiz ustida «NFC ID buyurtma berish» tugmasini toping — buyurtma jarayoni shu yerdan boshlanadi.', { cursorX: 58, cursorY: 27, highlightBox: { xPct: 43, yPct: 22, wPct: 28, hPct: 10 } }),
      mockFrame(8, 'card', 'To‘lov usulini tanlaysiz — hozircha Payme integratsiyasi ishga tushirilmoqda, shuning uchun bu FAQAT namoyish.', { cursorX: 50, cursorY: 50 }),
      mockFrame(9, 'card', '«To‘lash»ni bosasiz — bu DEMO, hozircha real to‘lov amalga oshmaydi.', { cursorX: 50, cursorY: 70, clickEffect: true }),
      realFrame(10, 'shaxsiy-nfc-3', 2, 'Muvaffaqiyatli to‘lovdan keyin yangi NFC ID’ingiz profilingizga avtomatik biriktiriladi.', { zoomTarget: 'center', durationMs: 2800 }),
    ]),

  // ═══════════════════════ 4. Kompaniya profilini yaratish va to'ldirish ═══════════════════════
  guide(4, 'company-create-fill', 'Kompaniya profilini yaratish va to‘ldirish',
    'Alohida Company ID ochish, biznes ma’lumotlarini to‘ldirish va public sahifani ko‘rish.', 'kompaniya', 'kompaniya', 3, [
      realFrame(1, 'kompaniya-kompaniya-1', 1, '«Kompaniya yaratish» sahifasida o‘ziga xos Company ID tanlang — bu shaxsiy NFC ID’dan butunlay alohida.', { cursorX: 77, cursorY: 44, highlightBox: { xPct: 62, yPct: 42, wPct: 30, hPct: 3 } }),
      realFrame(2, 'kompaniya-kompaniya-1', 2, 'Kompaniya nomi va faoliyat yo‘nalishini kiriting.', { cursorX: 50, cursorY: 30 }),
      realFrame(3, 'kompaniya-kompaniya-1', 2, 'Yo‘nalishni to‘g‘ri tanlash muhim — bu keyinchalik katalog atamalarini belgilaydi (masalan, restoran uchun «Taomlar»).', { cursorX: 76, cursorY: 30, zoomTarget: 'right center' }),
      realFrame(4, 'kompaniya-kompaniya-1', 2, 'Shahar va telefon raqamingizni ham kiriting.', { cursorX: 50, cursorY: 60 }),
      realFrame(5, 'kompaniya-kompaniya-1', 3, 'Barcha maydonlarni to‘ldirib bo‘lgach, arizani yuboring.', { cursorX: 76, cursorY: 68, clickEffect: true }),
      realFrame(6, 'kompaniya-kompaniya-1', 4, 'Ariza yuborildi — admin tekshiruvi paytida ham boshqaruv panelidan foydalanishingiz mumkin.', { zoomTarget: 'center', durationMs: 2600 }),
      realFrame(7, 'kompaniya-kompaniya-7', 1, 'Business Workspace — chap menyudan «Profil» bo‘limini oching.', { cursorX: 9, cursorY: 30, highlightBox: { xPct: 1, yPct: 27, wPct: 17, hPct: 6 } }),
      realFrame(8, 'kompaniya-kompaniya-7', 2, 'Nomi, kichik soha, «Biz haqimizda» va logo/muqova havolalarini kiriting.', { cursorX: 50, cursorY: 50 }),
      realFrame(9, 'kompaniya-kompaniya-7', 4, '«Aloqa» bo‘limida telefon, Telegram va manzilni to‘ldiring.', { cursorX: 9, cursorY: 46, zoomTarget: 'center' }),
      realFrame(10, 'kompaniya-kompaniya-7', 1, 'Tayyor bo‘lgach, yuqoridagi «Kompaniya sahifasi» tugmasi orqali public profilingizni ko‘ring.', { cursorX: 82, cursorY: 8, clickEffect: true, durationMs: 2700 }),
    ]),

  // ═══════════════════════ 5. Mahsulot / xizmat / restoran menyusi qo'shish ═══════════════════════
  guide(5, 'catalog-menu', 'Mahsulot / xizmat / restoran menyusi qo‘shish',
    'Universal katalog bo‘limi orqali mahsulot, xizmat yoki restoran menyusini qo‘shish — barchasi bitta joyda.', 'kompaniya', 'kompaniya', 4, [
      // ── A. Mahsulot ──
      realFrame(1, 'kompaniya-kompaniya-7', 1, 'Chap menyudan «Katalog» bo‘limini oching.', { section: 'Mahsulot', cursorX: 9, cursorY: 51, highlightBox: { xPct: 1, yPct: 48, wPct: 17, hPct: 6 } }),
      realFrame(2, 'kompaniya-kompaniya-7', 3, 'Mahsulot nomi va narxini kiriting.', { section: 'Mahsulot', cursorX: 30, cursorY: 51, zoomTarget: 'top left' }),
      realFrame(3, 'kompaniya-kompaniya-7', 3, 'Rasm URL va qisqa tavsif qo‘shing — bu mijozga mahsulotni tushunarli qiladi.', { section: 'Mahsulot', cursorX: 45, cursorY: 68, zoomTarget: 'bottom' }),
      realFrame(4, 'kompaniya-kompaniya-7', 3, '«+ Qo‘shish»ni bosing — element darhol katalogga qo‘shiladi.', { section: 'Mahsulot', cursorX: 45, cursorY: 84, clickEffect: true }),
      realFrame(5, 'kompaniya-kompaniya-7', 1, 'Qo‘shilgan mahsulotlar public profilingizda «Mahsulotlarni ko‘rish» tugmasi orqali ko‘rinadi.', { section: 'Mahsulot', zoomTarget: 'right center', durationMs: 2600 }),
      // ── B. Xizmat ──
      realFrame(6, 'kompaniya-kompaniya-7', 3, 'Xizmat turi uchun ham xuddi shu bo‘lim ishlatiladi — nomini kiriting, narxni belgilang yoki «Kelishiladi» qoldiring.', { section: 'Xizmat', cursorX: 30, cursorY: 51, zoomTarget: 'top left' }),
      realFrame(7, 'kompaniya-kompaniya-7', 3, 'Xizmat tavsifini aniq yozing — mijoz nima olishini bir qarashda tushunsin.', { section: 'Xizmat', cursorX: 45, cursorY: 84, zoomTarget: 'bottom' }),
      realFrame(8, 'kompaniya-kompaniya-7', 4, '«Aloqa» bo‘limidagi telefon/Telegram orqali mijoz sizga to‘g‘ridan-to‘g‘ri murojaat qiladi.', { section: 'Xizmat', zoomTarget: 'center' }),
      realFrame(9, 'kompaniya-kompaniya-7', 3, 'Saqlangach, xizmat ro‘yxatingiz avtomatik yangilanadi.', { section: 'Xizmat', cursorX: 45, cursorY: 92, durationMs: 2600 }),
      // ── C. Restoran menyusi ──
      realFrame(10, 'kompaniya-kompaniya-7', 1, 'Agar biznes turingiz restoran/kafe bo‘lsa, xuddi shu Katalog bo‘limi «Taomlar» deb nomlanadi.', { section: 'Restoran menyusi', cursorX: 9, cursorY: 51, highlightBox: { xPct: 1, yPct: 48, wPct: 17, hPct: 6 } }),
      realFrame(11, 'kompaniya-kompaniya-7', 3, 'Kategoriya maydoniga «Nonushta», «Issiq taomlar» kabi bo‘lim nomini kiriting.', { section: 'Restoran menyusi', cursorX: 63, cursorY: 51, zoomTarget: 'top right' }),
      realFrame(12, 'kompaniya-kompaniya-7', 3, 'Taom rasmi, nomi, tavsifi va narxini kiriting.', { section: 'Restoran menyusi', cursorX: 45, cursorY: 68, zoomTarget: 'top' }),
      realFrame(13, 'kompaniya-kompaniya-7', 3, '«+ Qo‘shish»ni bosing — taom menyuga qo‘shiladi.', { section: 'Restoran menyusi', cursorX: 45, cursorY: 84, clickEffect: true }),
      realFrame(14, 'kompaniya-kompaniya-7', 1, 'Telefondagi jonli ko‘rishda mijoz to‘liq menyuni ko‘radi.', { section: 'Restoran menyusi', zoomTarget: 'right center', durationMs: 2800 }),
    ]),

  // ═══════════════════════ 6. Auksionda qatnashish ═══════════════════════
  guide(6, 'auction-join', 'Auksionda qatnashish',
    'Ekslyuziv NFC ID’lar uchun faol lotlarni topish, narxini kuzatish va taklif berish jarayoni.', 'auksion', 'both', 3, [
      realFrame(1, 'both-auksion-5', 1, 'Auksion sahifasida faol lotlar ro‘yxatini ko‘ring.', { cursorX: 72, cursorY: 37 }),
      realFrame(2, 'both-auksion-5', 2, 'Lot sahifasida boshlang‘ich narx, joriy narx va qolgan vaqt ko‘rinadi.', { cursorX: 20, cursorY: 57 }),
      realFrame(3, 'both-auksion-5', 2, '«Darhol sotib olish» narxi orqali auksionni kutmasdan ham sotib olish mumkin.', { cursorX: 60, cursorY: 40, zoomTarget: 'right center' }),
      mockFrame(4, 'form', 'Taklif berish uchun avval tizimga kirishingiz kerak.', { cursorX: 50, cursorY: 30 }),
      mockFrame(5, 'form', 'Taklif summasini kiritasiz — bu FAQAT namoyish, hozircha real stavka berilmaydi.', { cursorX: 50, cursorY: 55 }),
      mockFrame(6, 'card', '«Taklif berish»ni bosasiz.', { cursorX: 50, cursorY: 70, clickEffect: true }),
      mockFrame(7, 'card', 'Taklifingiz qabul qilindi — hozircha siz eng yuqori tariflovchisiz (DEMO holat).', { cursorX: 50, cursorY: 50, highlight: 'price' }),
      mockFrame(8, 'card', 'Agar boshqa foydalanuvchi yuqoriroq taklif bersa, sizga darhol bildirishnoma keladi (DEMO holat).', { cursorX: 50, cursorY: 50, highlight: 'price' }),
      mockFrame(9, 'card', 'Auksion vaqti tugagach, eng yuqori taklif g‘olib deb e’lon qilinadi (DEMO holat).', { cursorX: 50, cursorY: 50 }),
      realFrame(10, 'both-auksion-5', 1, 'G‘olib bo‘lgan ID endi profilingizga NFC ID sifatida biriktiriladi.', { zoomTarget: 'center', durationMs: 2800 }),
    ]),
];

// ─────────────────────────── Tariflar — REAL narxlardan dinamik ───────────────────────────
// Guide #3 (nfc-id-purchase) ichida real /narxlar skrinshoti orqali ko'rsatiladi.
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
