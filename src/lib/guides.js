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
//     Postgres bazasi bilan ishga tushirilib, ochiq-oydin DEMO ma'lumotlar
//     (Aziz Karimov / demo@nfcstore.uz / +998907001122) bilan to'ldirilgan
//     holda skrinshot qilingan. Production'ga hech qanday yozuv/o'qish
//     bo'lmagan, hech qanday haqiqiy foydalanuvchi ma'lumoti ko'rsatilmagan.
//   - 'mock': <GuideMockFrame> orqali chiziladigan sxematik namoyish —
//     quyidagi hollarda ishlatiladi (har doim "Demo" belgisi bilan):
//       1) jismoniy amal (NFC kartani telefonga yaqinlashtirish);
//       2) hozircha production'da o'chirilgan funksiya (Payme to'lovi,
//          auksion stavka berish — PAYMENTS_ENABLED=false);
//       3) Kompaniya tizimi (CompanyCreatePage/CompanyWorkspacePage) —
//          bu funksiya FAQAT production Cloudflare Worker + D1'da mavjud
//          (server/index.js mahalliy sinov backendida yo'q) va uni
//          xavfsiz mahalliy ravishda qayta yaratish uchun wrangler.jsonc/
//          hosting/worker.js/D1 sozlamalariga tegish kerak bo'lardi — bu
//          vazifada QAT'IY TAQIQLANGAN. Shu sabab Guide 4 va 5 to'liq
//          mock — lekin ichidagi HAR BIR maydon nomi/yorlig'i real
//          CompanyCreatePage.jsx/CompanyWorkspacePage.jsx kodidan
//          tekshirilgan haqiqiy matn (o'ylab topilmagan).
//
// v4 — REAL FLOW QAYTA TEKSHIRUVI: oldingi versiyada ko'p skrinshot "shakli
// mos" degan sabab bilan qayta ishlatilgan edi (masalan Mahsulot/Xizmat/
// Restoran menyusi uchun bitta skrinshot). Bu safar har bir dars uchun
// REAL joriy sayt oqimi qaytadan tekshirildi (AuthPage.jsx, AccountPage.jsx,
// PricingPage.jsx, ReserveModal.jsx, AuctionsPage.jsx/AuctionPage.jsx,
// CompanyCreatePage.jsx/CompanyWorkspacePage.jsx manba kodi o'qildi) va
// YANGI real skrinshotlar mahalliy demo muhitda olindi (Guide 1/2/3/6 —
// asosan real; Guide 4/5 — yuqorida tushuntirilgan sababga ko'ra mock,
// lekin real maydon nomlari bilan).

import { TIER_PRICE, TIER_LABEL, TIER_COLOR } from './pricing.js';

export const GUIDE_TABS = [
  { id: 'shaxsiy', label: 'Shaxsiy profil' },
  { id: 'kompaniya', label: 'Kompaniya profili' },
];

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
    data: opts.data ?? null,
    durationMs: opts.durationMs ?? 2600,
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
      realFrame(1, 'guide1-register', 1, "Bosh sahifada «Bepul profil yaratish» tugmasini bosing.", { cursorX: 13, cursorY: 63, highlightBox: { xPct: 4, yPct: 59, wPct: 17, hPct: 6 } }),
      realFrame(2, 'guide1-register', 2, 'Ro‘yxatdan o‘tish formasi ochiladi: email, parol va telefon raqamingizni kiriting.', { cursorX: 60, cursorY: 30, highlightBox: { xPct: 52, yPct: 27, wPct: 30, hPct: 22 } }),
      realFrame(3, 'guide1-register', 3, 'Botga yozganingizni tasdiqlab, «Kod yuborish»ni bosing — tasdiqlash kodi Telegram botga yuboriladi.', { cursorX: 65, cursorY: 30, clickEffect: true }),
      realFrame(4, 'guide1-register', 4, 'Kod yuborilgach, pastda 6 xonali kod maydoni chiqadi.', { cursorX: 60, cursorY: 71 }),
      realFrame(5, 'guide1-register', 5, 'Kelgan kodni kiriting, shartlarga rozilik bildiring va «Akkaunt yaratish»ni bosing.', { cursorX: 60, cursorY: 85, clickEffect: true }),
      realFrame(6, 'guide1-register', 6, "Tabriklaymiz — hisobingiz tayyor! Sizga avtomatik 8 xonali profil ID berildi. MUHIM: bu ID — 0 so'm, mutlaqo BEPUL. Bu 6 belgili PULLIK NFC ID (masalan AZK007) bilan bir narsa emas — buni 3-darsda ko'ramiz.", { zoomTarget: 'top', durationMs: 3200 }),
    ]),

  // ═══════════════════════ 2. Shaxsiy profilni to'liq sozlash ═══════════════════════
  guide(2, 'profile-setup', 'Shaxsiy profilni to‘liq sozlash',
    'Rasm, ism, bio, kontaktlar va ijtimoiy tarmoqlar — profilingizni professional ko‘rinishga keltiring.', 'profil', 'shaxsiy', 3, [
      realFrame(1, 'guide2-profile', 1, 'Hisobingizda profilingiz avtomatik ochilgan holda turadi — «Profil turi» bo‘limidan boshlanadi (standart: Shaxsiy).', { cursorX: 20, cursorY: 32, highlightBox: { xPct: 10, yPct: 27, wPct: 22, hPct: 9 } }),
      realFrame(2, 'guide2-profile', 2, '«Asosiy ma’lumot» bo‘limida rasm tanlang (yoki havola qoldiring), ism, kasb va bio yozing — o‘ngdagi jonli ko‘rinish darhol yangilanadi.', { cursorX: 16, cursorY: 65, zoomTarget: 'right center' }),
      realFrame(3, 'guide2-profile', 3, '«Dizayn va fon» bo‘limini oching — tema tanlang. Ayrim maxsus imkoniyatlar (fon rasmi, maxsus ranglar) yuqori darajadagi NFC ID uchun ochiladi.', { cursorX: 30, cursorY: 15 }),
      realFrame(4, 'guide2-profile', 4, '«Aloqa va ijtimoiy tarmoqlar» bo‘limida Telegram va Instagram foydalanuvchi nomingizni kiriting.', { cursorX: 20, cursorY: 20, highlightBox: { xPct: 10, yPct: 17, wPct: 32, hPct: 8 } }),
      realFrame(5, 'guide2-profile', 5, '«Profilni saqlash»ni bosing — muvaffaqiyatli saqlangani haqida xabar chiqadi.', { cursorX: 13, cursorY: 74, clickEffect: true, highlightBox: { xPct: 9, yPct: 71, wPct: 8, hPct: 4 } }),
      realFrame(6, 'guide2-profile', 6, 'Tayyor — profilingiz shunday ko‘rinadi: rasm, ism, bio va ijtimoiy tarmoq tugmalari.', { zoomTarget: 'top', durationMs: 2800 }),
    ]),

  // ═══════════════════════ 3. NFC ID tanlash va sotib olish ═══════════════════════
  guide(3, 'nfc-id-purchase', 'NFC ID tanlash va sotib olish',
    "Bepul avtomatik ID bilan pullik 6 belgili NFC ID orasidagi farq, narxlar va buyurtma jarayoni.", 'nfc', 'shaxsiy', 3, [
      realFrame(1, 'guide3-nfcid', 1, "Narxlar sahifasida Bronza (49 000), Silver (99 000), Gold (149 000), Premium (199 000) va Ekslyuziv (faqat auksion) tariflarini solishtiring.", { cursorX: 22, cursorY: 45, highlightBox: { xPct: 8, yPct: 20, wPct: 30, hPct: 55 } }),
      realFrame(2, 'guide3-nfcid', 2, "Kalkulyatorga xohlagan NFC ID’ni kiriting — daraja, sabab va aniq narx darhol ko‘rinadi (masalan AZK007 → Gold → 149 000 so‘m).", { cursorX: 40, cursorY: 82, highlightBox: { xPct: 28, yPct: 79, wPct: 22, hPct: 6 } }),
      realFrame(3, 'guide3-nfcid', 3, "Ro‘yxatdan o‘tganda avtomatik BEPUL 8 xonali ID berilgan edi — bu yerda esa yuqoriroq darajadagi PULLIK ID tanlaysiz. «Bandlash»ni bosing.", { cursorX: 60, cursorY: 90, clickEffect: true }),
      realFrame(4, 'guide3-nfcid', 4, "Ochilgan oynada ismingiz, kasbingiz va ijtimoiy tarmoqlaringizni kiriting — bular yangi NFC ID profilida ko‘rinadi.", { cursorX: 50, cursorY: 35 }),
      realFrame(5, 'guide3-nfcid', 5, "Hozircha Payme integratsiyasi ishga tushirilmoqda, shu sabab «Band qilish» tugmasi vaqtincha yopiq — bu haqiqiy joriy holat.", { cursorX: 50, cursorY: 85, zoomTarget: 'bottom' }),
      mockFrame(6, 'card', "DEMO: Payme ishga tushgach, to‘lovni yakunlaysiz va yangi NFC ID’ingiz («Gold» darajali AZK007 kabi) profilingizga avtomatik biriktiriladi.", { highlight: 'price', durationMs: 2900 }),
    ]),

  // ═══════════════════════ 4. Kompaniya profilini yaratish va to'ldirish ═══════════════════════
  // MUHIM: Kompaniya tizimi (Company ID) FAQAT production Cloudflare
  // Worker + D1'da ishlaydi (hosting/worker.js) — mahalliy server/index.js
  // sinov backendida bu endpoint'lar yo'q. Buni xavfsiz mahalliy qayta
  // yaratish uchun wrangler.jsonc/hosting/worker.js/D1 sozlamalariga tegish
  // kerak bo'lardi — bu vazifada aniq taqiqlangan. Shu sabab hammasi DEMO,
  // lekin har bir maydon nomi CompanyCreatePage.jsx/CompanyWorkspacePage.jsx
  // manba kodidan tekshirilgan haqiqiy matn.
  guide(4, 'company-create-fill', 'Kompaniya profilini yaratish va to‘ldirish',
    'Alohida Company ID ochish, biznes ma’lumotlarini to‘ldirish va public sahifani ko‘rish.', 'kompaniya', 'kompaniya', 3, [
      mockFrame(1, 'companyForm', '«Kompaniyalar» bo‘limidan yangi kompaniya yaratishni boshlang — o‘ziga xos Company ID tanlaysiz, bu shaxsiy NFC ID’dan butunlay alohida.', {
        data: { companyId: 'DEMOSHOP', fields: [{ label: 'Kompaniya nomi', value: 'Demo Do‘kon', focus: true }] },
      }),
      mockFrame(2, 'companyForm', 'Yo‘nalishni to‘g‘ri tanlang (masalan «Do‘kon / market» yoki «Restoran / kafe») — bu keyinchalik katalog atamalarini belgilaydi. Shahar va telefon raqamingizni ham kiriting.', {
        data: { companyId: 'DEMOSHOP', fields: [{ label: 'Yo‘nalish', value: 'Do‘kon / market' }, { label: 'Shahar', value: 'Toshkent' }, { label: 'Telefon', value: '+998907001122', focus: true }] },
      }),
      mockFrame(3, 'companyTabs', 'Ariza yuborilgach, «Business Workspace» boshqaruv paneli ochiladi — admin tekshiruvi paytida ham ma’lumotlarni to‘ldirishda davom etishingiz mumkin.', {
        data: { tabs: ['Boshqaruv', 'Profil', 'Katalog', 'Aloqa', 'Sozlamalar'], activeTab: 'Boshqaruv', panelTitle: 'Boshqaruv', rows: [{ label: 'COMPANY ID', value: 'DEMOSHOP' }] },
      }),
      mockFrame(4, 'companyTabs', '«Profil» bo‘limida nomi, qisqa tavsif, Logo URL va Muqova rasmi URL manzillarini kiriting.', {
        data: { tabs: ['Boshqaruv', 'Profil', 'Katalog', 'Aloqa', 'Sozlamalar'], activeTab: 'Profil', panelTitle: 'Profil', rows: [{ label: 'Kompaniya nomi', value: 'Demo Do‘kon' }, { label: 'Logo URL', value: 'https://…' }, { label: 'Muqova rasmi URL', value: 'https://…' }] },
      }),
      mockFrame(5, 'companyTabs', '«Aloqa» bo‘limida telefon, Telegram, veb-sayt va manzilni to‘ldiring — mijoz shu orqali sizga murojaat qiladi.', {
        data: { tabs: ['Boshqaruv', 'Profil', 'Katalog', 'Aloqa', 'Sozlamalar'], activeTab: 'Aloqa', panelTitle: 'Aloqa', rows: [{ label: 'Telefon', value: '+998907001122' }, { label: 'Telegram', value: '@demo_nfcstore' }, { label: 'Shahar', value: 'Toshkent' }] },
      }),
      mockFrame(6, 'companyPublic', 'Tayyor bo‘lgach, yuqoridagi «Kompaniya sahifasi» tugmasi orqali public profilingizni ko‘rasiz.', {
        data: { categoryLabel: 'Mahsulotlar', items: [{ name: 'Erkak krossovka', price: { som: 250000 } }] },
      }),
    ]),

  // ═══════════════════════ 5. Mahsulot / xizmat / restoran menyusi qo'shish ═══════════════════════
  // MUHIM: xuddi shu sababga ko'ra (Kompaniya tizimi faqat production'da)
  // hammasi DEMO — lekin OLDINGI implementatsiyadagi xatoni tuzatib, har
  // bir bo'lim (Mahsulot/Xizmat/Taomlar) uchun ALOHIDA, o'ziga mos nom va
  // demo tarkib bilan ko'rsatilgan (bir xil screenshot uchtasiga qayta
  // ishlatilmagan). Real kodda (CompanyWorkspacePage.jsx) bu uchalasi ham
  // bitta universal Katalog formasi orqali ishlaydi — faqat bo'lim
  // sarlavhasi (companyCta.noun: Mahsulotlar/Xizmatlar/Taomlar) va
  // tarkib boshqacha; shuning uchun mock'larda ham xuddi shu haqiqiy farq
  // aks ettirilgan.
  guide(5, 'catalog-menu', 'Mahsulot / xizmat / restoran menyusi qo‘shish',
    'Universal katalog bo‘limi orqali mahsulot, xizmat yoki restoran menyusini qo‘shish — barchasi bitta joyda.', 'kompaniya', 'kompaniya', 4, [
      // ── A. Mahsulot ──
      mockFrame(1, 'companyTabs', '«Katalog» bo‘limini oching — bu yerda mahsulot nomi va narxini kiritasiz.', {
        section: 'Mahsulot', data: { tabs: ['Boshqaruv', 'Profil', 'Katalog', 'Aloqa', 'Sozlamalar'], activeTab: 'Katalog', panelTitle: 'Mahsulotlar', rows: [{ label: 'Mahsulot nomi', value: 'Erkak krossovka' }, { label: 'Narxi', value: { som: 250000 } }] },
      }),
      mockFrame(2, 'companyForm', 'Rasm URL va qisqa tavsif qo‘shing — bu mijozga mahsulotni tushunarli qiladi.', {
        section: 'Mahsulot', data: { companyId: 'DEMOSHOP', fields: [{ label: 'Rasm URL', value: 'https://…', focus: true }, { label: 'Qisqa tavsif', value: 'Sport krossovka, 40-45' }] },
      }),
      mockFrame(3, 'companyForm', '«+ Qo‘shish»ni bosing — mahsulot darhol katalogga qo‘shiladi.', {
        section: 'Mahsulot', clickEffect: true, cursorX: 50, cursorY: 88, data: { companyId: 'DEMOSHOP', fields: [{ label: 'Mahsulot nomi', value: 'Erkak krossovka' }, { label: 'Narxi', value: { som: 250000 } }] },
      }),
      mockFrame(4, 'companyPublic', 'Qo‘shilgan mahsulotlar public profilingizda «Mahsulotlarni ko‘rish» tugmasi orqali ko‘rinadi.', {
        section: 'Mahsulot', data: { categoryLabel: 'Mahsulotlar', items: [{ name: 'Erkak krossovka', price: { som: 250000 } }, { name: 'Ayollar sumkasi', price: { som: 180000 } }] },
      }),
      // ── B. Xizmat ──
      mockFrame(5, 'companyTabs', 'Xizmat turi uchun ham xuddi shu Katalog bo‘limi ishlatiladi — endi u «Xizmatlar» deb nomlanadi.', {
        section: 'Xizmat', data: { tabs: ['Boshqaruv', 'Profil', 'Katalog', 'Aloqa', 'Sozlamalar'], activeTab: 'Katalog', panelTitle: 'Xizmatlar', rows: [{ label: 'Xizmat nomi', value: 'Santexnika xizmati' }] },
      }),
      mockFrame(6, 'companyForm', 'Xizmat nomini kiriting, narxni belgilang yoki «Kelishiladi» qoldiring — tavsifni aniq yozing.', {
        section: 'Xizmat', data: { companyId: 'DEMOSHOP', fields: [{ label: 'Xizmat nomi', value: 'Santexnika xizmati', focus: true }, { label: 'Narxi', value: 'Kelishiladi' }] },
      }),
      mockFrame(7, 'companyForm', '«+ Qo‘shish»ni bosing — xizmat ro‘yxatingiz avtomatik yangilanadi.', {
        section: 'Xizmat', clickEffect: true, cursorX: 50, cursorY: 88, data: { companyId: 'DEMOSHOP', fields: [{ label: 'Xizmat nomi', value: 'Santexnika xizmati' }, { label: 'Narxi', value: 'Kelishiladi' }] },
      }),
      mockFrame(8, 'companyPublic', '«Aloqa» bo‘limidagi telefon/Telegram orqali mijoz sizga to‘g‘ridan-to‘g‘ri murojaat qiladi.', {
        section: 'Xizmat', data: { categoryLabel: 'Xizmatlar', items: [{ name: 'Santexnika xizmati', price: 'Kelishiladi' }] },
      }),
      // ── C. Restoran menyusi ──
      mockFrame(9, 'companyTabs', 'Agar biznes turingiz restoran/kafe bo‘lsa, xuddi shu Katalog bo‘limi «Taomlar» deb nomlanadi.', {
        section: 'Restoran menyusi', data: { tabs: ['Boshqaruv', 'Profil', 'Katalog', 'Aloqa', 'Sozlamalar'], activeTab: 'Katalog', panelTitle: 'Taomlar', rows: [{ label: 'Kategoriya', value: 'Issiq taomlar' }] },
      }),
      mockFrame(10, 'companyForm', 'Kategoriya maydoniga «Issiq taomlar» kabi bo‘lim nomini, taom rasmi, nomi, tavsifi va narxini kiriting.', {
        section: 'Restoran menyusi', data: { companyId: 'DEMOSHOP', fields: [{ label: 'Kategoriya', value: 'Issiq taomlar' }, { label: 'Taom nomi', value: 'Osh', focus: true }, { label: 'Narxi', value: { som: 35000 } }] },
      }),
      mockFrame(11, 'companyForm', '«+ Qo‘shish»ni bosing — taom menyuga qo‘shiladi.', {
        section: 'Restoran menyusi', clickEffect: true, cursorX: 50, cursorY: 88, data: { companyId: 'DEMOSHOP', fields: [{ label: 'Taom nomi', value: 'Osh' }, { label: 'Narxi', value: { som: 35000 } }] },
      }),
      mockFrame(12, 'companyPublic', 'Telefondagi jonli ko‘rishda mijoz to‘liq menyuni ko‘radi.', {
        section: 'Restoran menyusi', data: { categoryLabel: 'Taomlar', items: [{ name: 'Osh', price: { som: 35000 } }, { name: 'Norin', price: { som: 28000 } }] },
      }),
    ]),

  // ═══════════════════════ 6. Auksionda qatnashish ═══════════════════════
  guide(6, 'auction-join', 'Auksionda qatnashish',
    'Ekslyuziv NFC ID’lar uchun talab yig‘ish, faol auksionni topish va taklif berish jarayoni.', 'auksion', 'both', 4, [
      realFrame(1, 'guide6-auction', 1, '«Auksion» sahifasida «Talab yig‘ilmoqda» ro‘yxatini ko‘rasiz — yoqqan kodga qiziqish bildirilgan foydalanuvchilar soni ko‘rinadi.', { cursorX: 25, cursorY: 60, highlightBox: { xPct: 8, yPct: 46, wPct: 16, hPct: 22 } }),
      realFrame(2, 'guide6-auction', 2, '«Auksionda qatnashaman»ni bosib, yoqqan kodingizga qiziqish bildirasiz — bu haqiqiy, bepul amal.', { cursorX: 25, cursorY: 92, clickEffect: true }),
      realFrame(3, 'guide6-auction', 3, 'Yetarli kishi qiziqish bildirsa (masalan 20 kishi), kod «Auksionga tayyor» bo‘limiga o‘tadi — admin auksionni boshlaydi.', { cursorX: 25, cursorY: 45 }),
      realFrame(4, 'guide6-auction', 4, '«Faol auksion» bo‘limida hozir savdoga qo‘yilgan NFC ID’larni ko‘rasiz — joriy narx va qolgan vaqt bilan.', { cursorX: 25, cursorY: 45, clickEffect: true }),
      realFrame(5, 'guide6-auction', 5, 'Lot sahifasida joriy narx, qolgan vaqt va «Darhol sotib olish» narxi ko‘rinadi.', { cursorX: 25, cursorY: 29 }),
      realFrame(6, 'guide6-auction', 6, "Hozircha Payme to‘lov tizimi o‘chirilgani sababli taklif berish vaqtincha yopiq — bu haqiqiy joriy holat.", { cursorX: 50, cursorY: 40, zoomTarget: 'center' }),
      mockFrame(7, 'form', 'DEMO: to‘lov tizimi ishga tushgach, shu yerga taklif summangizni kiritib, «Taklif qilish»ni bosasiz.', { cursorX: 50, cursorY: 55 }),
      mockFrame(8, 'card', 'DEMO: taklifingiz qabul qilindi — hozircha eng yuqori tariflovchisiz. Boshqa foydalanuvchi yuqoriroq taklif bersa, sizga darhol bildirishnoma keladi.', { highlight: 'price' }),
      mockFrame(9, 'card', "DEMO: auksion vaqti tugagach, eng yuqori taklif g‘olib deb e’lon qilinadi — g‘olib bo‘lgan ID endi uning profiliga NFC ID sifatida biriktiriladi.", { durationMs: 2900 }),
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
