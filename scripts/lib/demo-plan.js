// ═══════════════════════════════════════════════════════════════════════
// DEMO TO'LDIRISH — REJA TUZUVCHI (I/O YO'Q)
//
// Bu modul HECH NARSA YOZMAYDI va tarmoqqa chiqmaydi. U faqat hisoblaydi:
// "shu profil hozir qanday, unga nima qo'shsa bo'ladi?"
//
// Shunday qilingani uchun butun mantiqni haqiqiy serversiz, oddiy
// testlar bilan tekshirib bo'ladi (scripts/test-demo-fill.mjs) — ya'ni
// production'ga birinchi marta tegishdan OLDIN qoidalar isbotlanadi.
//
// ┌─ UCHTA BUZILMAS QOIDA ─────────────────────────────────────────────┐
// │ 1. FAQAT BO'SH MAYDON TO'LDIRILADI. Mazmunli qiymat turgan joyga   │
// │    hech qachon yozilmaydi — demo real ma'lumotni bosib ketmaydi.   │
// │ 2. ALOQA MA'LUMOTI HECH QACHON TO'QILMAYDI. Telefon, email,        │
// │    Instagram, Telegram, Facebook, sayt, manzil, karta raqami —     │
// │    bular haqiqiy odamga tegishli. Bo'sh bo'lsa BO'SH QOLADI.       │
// │ 3. DEMO EKANI KO'RINIB TURADI. Matnlar "DEMO" so'zini o'z ichiga   │
// │    oladi, narxlar "demo narx" deb belgilanadi — hech kim buni      │
// │    haqiqiy savdo taklifi deb o'ylamaydi.                           │
// └────────────────────────────────────────────────────────────────────┘
//
// NIMA UCHUN "MASTER REFERENCE" NUSXA KO'CHIRILMAYDI. VIP001 (shaxsiy)
// va NFCSTORE (biznes) — namuna sifatida olinadi, lekin ularning ismi,
// matni, rasmi yoki havolasi KO'CHIRILMAYDI. Namuna bo'ladigan narsa —
// QAYSI maydonlar to'ldirilgan va qanchalik sifatli to'ldirilgan. Har
// bir profil o'z yo'nalishida, o'z matni bilan to'ldiriladi.
// ═══════════════════════════════════════════════════════════════════════

// ── BO'SHLIQNI ANIQLASH ──────────────────────────────────────────────
// "Bo'sh" degani faqat `''` emas: bo'sh massiv, faqat probeldan iborat
// matn va `null` ham bo'sh. Aks holda skript "to'la" deb o'ylab,
// haqiqatan bo'sh profilni chetlab o'tardi.
export function isBlank(v) {
  if (v == null) return true;
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === 'string') return v.trim() === '';
  return false;
}

// Qiymat MAZMUNLIMI? Juda kalta yoki belgidan iborat matnni "real
// kontent" deb hisoblash xato bo'lardi (masalan bio = "." yoki "-").
// Lekin 3+ belgilik haqiqiy matn — tegilmaydi.
export function isMeaningful(v) {
  if (isBlank(v)) return false;
  if (typeof v === 'string') return v.trim().replace(/[.\-_·•]/g, '').length >= 3;
  return true;
}

// ── HECH QACHON TO'QILMAYDIGAN MAYDONLAR ─────────────────────────────
// Bu ro'yxat ATAYLAB qattiq: bu yerdagi har bir maydon HAQIQIY odamning
// aloqa kanali. Noto'g'ri raqam yoki mavjud bo'lmagan Instagram profil
// egasiga ham, unga yozmoqchi bo'lgan odamga ham zarar keltiradi.
export const NEVER_INVENT = Object.freeze([
  'phone', 'email', 'tg', 'instagram', 'facebook', 'twitter', 'linkedin',
  'website', 'address', 'latitude', 'longitude', 'cardNumber', 'cardNumbers',
  'extraLinks', 'whatsapp', 'telegram',
]);

// ── YO'NALISHNI ANIQLASH ─────────────────────────────────────────────
// Profilda allaqachon turgan ma'lumotdan (kasb, bio, kategoriya, ism)
// yo'nalish topishga harakat qilamiz. Topilmasa — TO'QIMAYMIZ, balki
// neytral demo beramiz. "Shifokor" deb yozib qo'yish, keyin bu noto'g'ri
// chiqishi — eng yomon natija.
const DIRECTIONS = [
  { id: 'it', words: ['dastur', 'developer', 'dasturchi', 'it ', 'software', 'backend', 'frontend', 'devops', 'engineer', 'muhandis', 'programmer', 'kod'] },
  { id: 'design', words: ['dizayn', 'design', 'ux', 'ui', 'grafik', 'brand', 'illustr'] },
  { id: 'marketing', words: ['marketing', 'smm', 'reklama', 'targetolog', 'kontent', 'brending'] },
  { id: 'medicine', words: ['shifokor', 'doktor', 'tibbiyot', 'stomatolog', 'klinika', 'hamshira', 'terapevt'] },
  { id: 'pharmacy', words: ['dorixona', 'apteka', 'farmatsev', 'pharmacy'] },
  { id: 'education', words: ['o‘qituvchi', 'oqituvchi', 'ustoz', 'repetitor', 'tutor', 'murabbiy', 'trener', 'kurs', 'maktab', 'teacher'] },
  { id: 'beauty', words: ['go‘zallik', 'gozallik', 'salon', 'stilist', 'vizaj', 'kosmetolog', 'barber', 'sartarosh', 'beauty'] },
  { id: 'construction', words: ['qurilish', 'ta’mir', 'tamir', 'remont', 'build', 'arxitekt', 'loyiha'] },
  { id: 'logistics', words: ['logistika', 'yetkaz', 'dostavka', 'transport', 'yuk', 'cargo'] },
  { id: 'finance', words: ['moliya', 'buxgalter', 'audit', 'bank', 'invest', 'finance', 'hisobchi'] },
  // `sud ekspert`/`ekspertiza` ATAYLAB to'liq ibora: yolg'iz "ekspert"
  // har qanday sohada uchraydi va noto'g'ri yo'nalish berardi.
  { id: 'legal', words: ['yurist', 'advokat', 'huquq', 'notarius', 'notarial', 'legal', 'sud ekspert', 'sudya', 'ekspertiza'] },
  { id: 'photo', words: ['fotograf', 'photo', 'video', 'operator', 'montaj', 'suratchi'] },
  { id: 'food', words: ['restoran', 'kafe', 'oshxona', 'taom', 'pitsa', 'coffee', 'qahva', 'food', 'oshpaz'] },
  { id: 'mobile', words: ['mobile', 'mobil', 'telefon', 'smartfon', 'gadjet', 'aksessuar', 'texnika', 'elektronika'] },
  { id: 'auto', words: ['avto', 'auto', 'moshina', 'mashina', 'servis', 'shinomontaj'] },
  { id: 'realestate', words: ['ko‘chmas', 'kochmas', 'rieltor', 'realtor', 'estate', 'kvartira'] },
  // DIQQAT — TARTIB: `retail` va `tech` ro'yxat OXIRIDA turadi.
  //   • "market" so'zi "marketing" ichida ham bor, shuning uchun
  //     `marketing` yuqorida tekshiriladi va "Marketing agentligi"
  //     savdo deb belgilanib qolmaydi;
  //   • "nfc" esa "NFCStore Mobile" da ham bor — `mobile` yuqorida
  //     turgani uchun u to'g'ri yo'nalishni oladi.
  { id: 'retail', words: ['market', 'do‘kon', 'dokon', 'savdo', 'shop', 'store', 'magazin', 'supermarket'] },
  { id: 'tech', words: ['nfc', 'texnologiya', 'smart', 'raqamli'] },
];

// Manba matnlari: kasb, bio, kategoriya, hashtaglar, ism va (biznes
// uchun) subkategoriya. Hammasi kichik harfga tushiriladi.
export function inferDirection(fields = {}) {
  const hay = [
    fields.role, fields.about, fields.categorySlug, fields.subcategory,
    fields.description, fields.displayName, fields.name,
    Array.isArray(fields.hashtags) ? fields.hashtags.join(' ') : '',
  ].filter(Boolean).join(' ').toLowerCase();
  if (!hay.trim()) return null;
  for (const d of DIRECTIONS) {
    if (d.words.some((w) => hay.includes(w))) return d.id;
  }
  return null;
}

// ── SHAXSIY PROFIL UCHUN DEMO MATN ───────────────────────────────────
// Har bir yo'nalish uchun O'Z matni. Nusxa-ko'chirilgandek ko'rinmasligi
// uchun jumlalar ham, hashtaglar ham har xil.
//
// Matnlar ATAYLAB QISQA va TEKSHIRIB BO'LADIGAN: ular odam haqida
// hech qanday FAKT aytmaydi (necha yil tajriba, qayerda ishlagan,
// qanday natija bergan) — chunki bu ma'lumot bizda yo'q.
const PERSONAL_DEMO = {
  it: {
    role: 'Dasturchi',
    about: 'DEMO profil. Bu yerda xizmatlar, loyihalar va bog‘lanish uchun havolalar joylashadi. Matnni o‘zingizga moslab tahrirlashingiz mumkin.',
    hashtags: ['demo', 'it', 'dasturlash'],
  },
  design: {
    role: 'Dizayner',
    about: 'DEMO profil. Portfolio, ish uslubi va buyurtma shartlari shu bo‘limda ko‘rsatiladi. Matn namuna sifatida qo‘yilgan.',
    hashtags: ['demo', 'dizayn', 'portfolio'],
  },
  marketing: {
    role: 'Marketolog',
    about: 'DEMO profil. Yo‘nalishlar, ish formati va murojaat tartibi shu yerda yoziladi. Hozirgi matn — namuna.',
    hashtags: ['demo', 'marketing', 'smm'],
  },
  medicine: {
    role: 'Mutaxassis',
    about: 'DEMO profil. Qabul tartibi va yo‘nalish haqidagi ma’lumot shu bo‘limga yoziladi. Hozirgi matn namuna bo‘lib, tibbiy maslahat emas.',
    hashtags: ['demo', 'mutaxassis'],
  },
  pharmacy: {
    role: 'Dorixona xodimi',
    about: 'DEMO profil. Ish vaqti, yo‘nalish va bog‘lanish ma’lumotlari shu bo‘limda ko‘rsatiladi. Matn namuna bo‘lib, tibbiy maslahat emas.',
    hashtags: ['demo', 'dorixona'],
  },
  education: {
    role: 'O‘qituvchi',
    about: 'DEMO profil. Darslar yo‘nalishi, format va jadval haqidagi ma’lumot shu yerda ko‘rsatiladi. Matn namuna sifatida qo‘yilgan.',
    hashtags: ['demo', 'talim', 'kurs'],
  },
  beauty: {
    role: 'Go‘zallik sohasi mutaxassisi',
    about: 'DEMO profil. Xizmatlar ro‘yxati va yozilish tartibi shu bo‘limda ko‘rsatiladi. Hozirgi matn — namuna.',
    hashtags: ['demo', 'gozallik', 'salon'],
  },
  construction: {
    role: 'Qurilish sohasi mutaxassisi',
    about: 'DEMO profil. Ish yo‘nalishlari va loyihalar haqidagi ma’lumot shu yerga yoziladi. Matn namuna sifatida qo‘yilgan.',
    hashtags: ['demo', 'qurilish', 'loyiha'],
  },
  logistics: {
    role: 'Logistika mutaxassisi',
    about: 'DEMO profil. Yo‘nalishlar va hamkorlik shartlari shu bo‘limda ko‘rsatiladi. Hozirgi matn — namuna.',
    hashtags: ['demo', 'logistika'],
  },
  finance: {
    role: 'Moliya mutaxassisi',
    about: 'DEMO profil. Xizmat yo‘nalishlari va ish formati shu yerda yoziladi. Matn namuna bo‘lib, moliyaviy maslahat emas.',
    hashtags: ['demo', 'moliya'],
  },
  legal: {
    role: 'Huquq sohasi mutaxassisi',
    about: 'DEMO profil. Yo‘nalishlar va murojaat tartibi shu bo‘limda ko‘rsatiladi. Matn namuna bo‘lib, yuridik maslahat emas.',
    hashtags: ['demo', 'huquq'],
  },
  photo: {
    role: 'Foto va video mutaxassisi',
    about: 'DEMO profil. Ishlar namunasi va suratga olish shartlari shu yerda ko‘rsatiladi. Hozirgi matn — namuna.',
    hashtags: ['demo', 'foto', 'video'],
  },
  food: {
    role: 'Oshxona sohasi mutaxassisi',
    about: 'DEMO profil. Menyu, yo‘nalish va bog‘lanish ma’lumotlari shu bo‘limga yoziladi. Matn namuna sifatida qo‘yilgan.',
    hashtags: ['demo', 'taom'],
  },
  mobile: {
    role: 'Mobil texnika mutaxassisi',
    about: 'DEMO profil. Qurilmalar, aksessuarlar va xizmatlar shu bo‘limda ko‘rsatiladi. Hozirgi matn — namuna.',
    hashtags: ['demo', 'mobil', 'texnika'],
  },
  auto: {
    role: 'Avto xizmat mutaxassisi',
    about: 'DEMO profil. Xizmatlar ro‘yxati va ish tartibi shu yerda yoziladi. Matn namuna sifatida qo‘yilgan.',
    hashtags: ['demo', 'avto'],
  },
  realestate: {
    role: 'Ko‘chmas mulk mutaxassisi',
    about: 'DEMO profil. Yo‘nalish va hamkorlik shartlari shu bo‘limda ko‘rsatiladi. Hozirgi matn — namuna.',
    hashtags: ['demo', 'kochmas-mulk'],
  },
  retail: {
    role: 'Savdo sohasi mutaxassisi',
    about: 'DEMO profil. Mahsulotlar, yetkazib berish va bog‘lanish ma’lumotlari shu bo‘limda ko‘rsatiladi. Hozirgi matn — namuna.',
    hashtags: ['demo', 'savdo', 'dokon'],
  },
  tech: {
    role: 'NFC va raqamli yechimlar',
    about: 'DEMO profil. Xizmatlar va raqamli yechimlar yo‘nalishi shu yerda yoziladi. Matn namuna sifatida qo‘yilgan.',
    hashtags: ['demo', 'nfc', 'raqamli'],
  },
  // Yo'nalish topilmadi — NEYTRAL. Hech qanday kasb tayinlanmaydi.
  neutral: {
    role: '',
    about: 'DEMO profil. Bu NFC ID hozircha namuna sifatida to‘ldirilgan: ism, kasb, bio va havolalarni istalgan vaqtda o‘zingiz tahrirlaysiz.',
    hashtags: ['demo', 'nfcstore'],
  },
};

// ── BIZNES UCHUN DEMO ────────────────────────────────────────────────
// Katalog elementlari: nomi "DEMO ·" bilan boshlanadi, tavsifida "Demo
// narx" yoziladi. Shunda hech kim buni haqiqiy narx deb o'ylamaydi.
//
// Narxlar ATAYLAB DUMALOQ va bozor narxiga o'xshamaydi — ular ko'rgazma
// uchun.
const BUSINESS_DEMO = {
  mobile: {
    subcategory: 'Mobil qurilmalar va aksessuarlar',
    description: 'DEMO biznes profil. Mobil qurilmalar va aksessuarlar yo‘nalishi bo‘yicha namuna katalog. Narxlar va mahsulotlar — demo, haqiqiy savdo taklifi emas.',
    catalog: [
      { name: 'DEMO · Smartfon', category: 'Smartfonlar', price: 4900000, description: 'Namuna mahsulot. Demo narx — haqiqiy taklif emas.' },
      { name: 'DEMO · Powerbank', category: 'Aksessuarlar', price: 320000, description: 'Namuna mahsulot. Demo narx — haqiqiy taklif emas.' },
      { name: 'DEMO · Simsiz quloqchin', category: 'Aksessuarlar', price: 690000, description: 'Namuna mahsulot. Demo narx — haqiqiy taklif emas.' },
      { name: 'DEMO · NFC aksessuar', category: 'NFC', price: 150000, description: 'Namuna mahsulot. Demo narx — haqiqiy taklif emas.' },
      { name: 'DEMO · Himoya g‘ilofi', category: 'Aksessuarlar', price: 95000, description: 'Namuna mahsulot. Demo narx — haqiqiy taklif emas.' },
    ],
  },
  food: {
    subcategory: 'Oziq-ovqat va menyu',
    description: 'DEMO biznes profil. Menyu yo‘nalishi bo‘yicha namuna katalog. Taomlar va narxlar — demo, haqiqiy taklif emas.',
    catalog: [
      { name: 'DEMO · Issiq taom', category: 'Asosiy taomlar', price: 45000, description: 'Namuna pozitsiya. Demo narx — haqiqiy taklif emas.' },
      { name: 'DEMO · Salat', category: 'Salatlar', price: 28000, description: 'Namuna pozitsiya. Demo narx — haqiqiy taklif emas.' },
      { name: 'DEMO · Ichimlik', category: 'Ichimliklar', price: 15000, description: 'Namuna pozitsiya. Demo narx — haqiqiy taklif emas.' },
      { name: 'DEMO · Shirinlik', category: 'Deserts', price: 32000, description: 'Namuna pozitsiya. Demo narx — haqiqiy taklif emas.' },
    ],
  },
  beauty: {
    subcategory: 'Go‘zallik xizmatlari',
    description: 'DEMO biznes profil. Go‘zallik xizmatlari yo‘nalishi bo‘yicha namuna katalog. Xizmatlar va narxlar — demo.',
    catalog: [
      { name: 'DEMO · Soch turmagi', category: 'Xizmatlar', price: 120000, description: 'Namuna xizmat. Demo narx — haqiqiy taklif emas.' },
      { name: 'DEMO · Parvarish muolajasi', category: 'Xizmatlar', price: 250000, description: 'Namuna xizmat. Demo narx — haqiqiy taklif emas.' },
      { name: 'DEMO · Manikyur', category: 'Xizmatlar', price: 90000, description: 'Namuna xizmat. Demo narx — haqiqiy taklif emas.' },
      { name: 'DEMO · Vizaj', category: 'Xizmatlar', price: 180000, description: 'Namuna xizmat. Demo narx — haqiqiy taklif emas.' },
    ],
  },
  construction: {
    subcategory: 'Qurilish va ta’mirlash',
    description: 'DEMO biznes profil. Qurilish va ta’mirlash yo‘nalishi bo‘yicha namuna katalog. Xizmatlar va narxlar — demo.',
    catalog: [
      { name: 'DEMO · Loyiha tayyorlash', category: 'Xizmatlar', price: 1500000, description: 'Namuna xizmat. Demo narx — haqiqiy taklif emas.' },
      { name: 'DEMO · Ichki ta’mir', category: 'Xizmatlar', price: 3500000, description: 'Namuna xizmat. Demo narx — haqiqiy taklif emas.' },
      { name: 'DEMO · Muhandislik ishlari', category: 'Xizmatlar', price: 2200000, description: 'Namuna xizmat. Demo narx — haqiqiy taklif emas.' },
      { name: 'DEMO · Maslahat', category: 'Xizmatlar', price: 400000, description: 'Namuna xizmat. Demo narx — haqiqiy taklif emas.' },
    ],
  },
  it: {
    subcategory: 'IT xizmatlari',
    description: 'DEMO biznes profil. IT xizmatlari yo‘nalishi bo‘yicha namuna katalog. Xizmatlar va narxlar — demo.',
    catalog: [
      { name: 'DEMO · Veb-sayt ishlab chiqish', category: 'Xizmatlar', price: 8000000, description: 'Namuna xizmat. Demo narx — haqiqiy taklif emas.' },
      { name: 'DEMO · Mobil ilova', category: 'Xizmatlar', price: 12000000, description: 'Namuna xizmat. Demo narx — haqiqiy taklif emas.' },
      { name: 'DEMO · Texnik qo‘llab-quvvatlash', category: 'Xizmatlar', price: 1500000, description: 'Namuna xizmat. Demo narx — haqiqiy taklif emas.' },
      { name: 'DEMO · Konsalting', category: 'Xizmatlar', price: 900000, description: 'Namuna xizmat. Demo narx — haqiqiy taklif emas.' },
    ],
  },
  auto: {
    subcategory: 'Avto xizmatlar',
    description: 'DEMO biznes profil. Avto xizmatlar yo‘nalishi bo‘yicha namuna katalog. Xizmatlar va narxlar — demo.',
    catalog: [
      { name: 'DEMO · Texnik ko‘rik', category: 'Xizmatlar', price: 250000, description: 'Namuna xizmat. Demo narx — haqiqiy taklif emas.' },
      { name: 'DEMO · Moy almashtirish', category: 'Xizmatlar', price: 350000, description: 'Namuna xizmat. Demo narx — haqiqiy taklif emas.' },
      { name: 'DEMO · Shinomontaj', category: 'Xizmatlar', price: 120000, description: 'Namuna xizmat. Demo narx — haqiqiy taklif emas.' },
      { name: 'DEMO · Diagnostika', category: 'Xizmatlar', price: 200000, description: 'Namuna xizmat. Demo narx — haqiqiy taklif emas.' },
    ],
  },
  retail: {
    subcategory: 'Savdo do‘koni',
    description: 'DEMO biznes profil. Savdo yo‘nalishi bo‘yicha namuna katalog. Mahsulotlar va narxlar — demo, haqiqiy savdo taklifi emas.',
    catalog: [
      { name: 'DEMO · Mahsulot A', category: 'Savdo', price: 180000, description: 'Namuna pozitsiya. Demo narx — haqiqiy taklif emas.' },
      { name: 'DEMO · Mahsulot B', category: 'Savdo', price: 340000, description: 'Namuna pozitsiya. Demo narx — haqiqiy taklif emas.' },
      { name: 'DEMO · Mahsulot C', category: 'Savdo', price: 95000, description: 'Namuna pozitsiya. Demo narx — haqiqiy taklif emas.' },
      { name: 'DEMO · Mahsulot D', category: 'Savdo', price: 520000, description: 'Namuna pozitsiya. Demo narx — haqiqiy taklif emas.' },
    ],
  },
  tech: {
    subcategory: 'NFC va raqamli yechimlar',
    description: 'DEMO biznes profil. NFC va raqamli yechimlar yo‘nalishi bo‘yicha namuna katalog. Mahsulot va narxlar — demo.',
    catalog: [
      { name: 'DEMO · NFC vizitka', category: 'NFC', price: 200000, description: 'Namuna mahsulot. Demo narx — haqiqiy taklif emas.' },
      { name: 'DEMO · NFC stiker', category: 'NFC', price: 60000, description: 'Namuna mahsulot. Demo narx — haqiqiy taklif emas.' },
      { name: 'DEMO · NFC brelok', category: 'NFC', price: 90000, description: 'Namuna mahsulot. Demo narx — haqiqiy taklif emas.' },
      { name: 'DEMO · Raqamli profil sozlash', category: 'Xizmatlar', price: 150000, description: 'Namuna xizmat. Demo narx — haqiqiy taklif emas.' },
    ],
  },
  pharmacy: {
    subcategory: 'Dorixona',
    description: 'DEMO biznes profil. Dorixona yo‘nalishi bo‘yicha namuna katalog. Mahsulot va narxlar — demo; bu tibbiy tavsiya yoki dori sotuvi taklifi EMAS.',
    catalog: [
      { name: 'DEMO · Birinchi yordam to‘plami', category: 'Namuna', price: 85000, description: 'Namuna pozitsiya. Demo narx — haqiqiy taklif emas.' },
      { name: 'DEMO · Vitamin (namuna)', category: 'Namuna', price: 45000, description: 'Namuna pozitsiya. Demo narx — haqiqiy taklif emas.' },
      { name: 'DEMO · Tibbiy niqob', category: 'Namuna', price: 12000, description: 'Namuna pozitsiya. Demo narx — haqiqiy taklif emas.' },
      { name: 'DEMO · Qon bosimi o‘lchagich', category: 'Namuna', price: 320000, description: 'Namuna pozitsiya. Demo narx — haqiqiy taklif emas.' },
    ],
  },
  neutral: {
    subcategory: '',
    description: 'DEMO biznes profil. Katalog, tavsif va aloqa ma’lumotlari namuna sifatida to‘ldirilgan. Mahsulot va narxlar — demo, haqiqiy savdo taklifi emas.',
    catalog: [
      { name: 'DEMO · Mahsulot 1', category: 'Namuna', price: 250000, description: 'Namuna pozitsiya. Demo narx — haqiqiy taklif emas.' },
      { name: 'DEMO · Mahsulot 2', category: 'Namuna', price: 480000, description: 'Namuna pozitsiya. Demo narx — haqiqiy taklif emas.' },
      { name: 'DEMO · Xizmat 1', category: 'Namuna', price: 700000, description: 'Namuna xizmat. Demo narx — haqiqiy taklif emas.' },
      { name: 'DEMO · Xizmat 2', category: 'Namuna', price: 1200000, description: 'Namuna xizmat. Demo narx — haqiqiy taklif emas.' },
    ],
  },
};

// Rasm tavsiyalari — RASMNI O'ZI QO'YMAYMIZ. Skript hech qachon tashqi
// tasodifiy URL yozmaydi; o'rniga shu manifest chiqadi va rasmlar
// alohida tayyorlanib yuklanadi.
const IMAGE_HINTS = {
  mobile: 'Zamonaviy smartfon va aksessuarlar, toza fon, brendsiz (studiya uslubi)',
  food: 'Premium taom surati, toza fon, brendsiz',
  beauty: 'Salon interyeri yoki parvarish vositalari, toza fon, brendsiz',
  construction: 'Qurilish loyihasi yoki asboblar, toza fon, brendsiz',
  it: 'Ish stoli, noutbuk va kod, toza fon, brendsiz',
  auto: 'Avto servis yoki toza avtomobil, brendsiz',
  retail: 'Toza mahsulot suratlari, oq yoki neytral fon, brendsiz',
  tech: 'NFC karta va raqamli qurilma, toza fon, brendsiz',
  pharmacy: 'Toza dorixona javoni yoki tibbiy buyum, oq fon, brendsiz',
  neutral: 'Neytral premium abstrakt fon, brendsiz',
};

// ═══ SHAXSIY PROFIL REJASI ═══════════════════════════════════════════
//
// `current` — `GET /api/records/:code` dan kelgan to'liq yozuv.
// Natijada `body` — `PUT /api/records/:code` ga yuboriladigan TO'LIQ
// obyekt.
//
// NIMA UCHUN TO'LIQ. Server `PUT` da yozuvni QISMAN emas, BUTUNLAY
// almashtiradi (`updateRecord(code, record)`). Ya'ni faqat o'zgargan
// maydonni yuborish — qolgan hamma narsani o'chirish demakdir. Shuning
// uchun reja mavjud qiymatlardan boshlanadi va ustiga faqat bo'sh
// joylar qo'shiladi.
export function planPersonal(current, opts = {}) {
  const code = String(current.code || '').toUpperCase();
  const direction = inferDirection(current);
  const demo = PERSONAL_DEMO[direction] || PERSONAL_DEMO.neutral;

  const changes = [];
  const body = { ...current };

  // Faqat BO'SH maydonlar. `isMeaningful` — "." kabi belgini kontent
  // deb hisoblamaslik uchun.
  const fill = (field, value) => {
    if (!value) return;
    if (isMeaningful(current[field])) return;
    body[field] = value;
    changes.push({ field, from: current[field] ?? '', to: value });
  };

  fill('role', demo.role);
  fill('about', demo.about);
  if (!isMeaningful(current.hashtags) && demo.hashtags?.length) {
    body.hashtags = demo.hashtags;
    changes.push({ field: 'hashtags', from: current.hashtags || [], to: demo.hashtags });
  }

  // ALOQA MA'LUMOTI — hech qachon. Bu yerda ataylab HECH NARSA yo'q;
  // ro'yxat esa testda qo'riqlanadi (NEVER_INVENT).

  // Rasm — URL yozilmaydi, manifestga tushadi.
  const media = [];
  if (!isMeaningful(current.avatarUrl)) {
    media.push({ target: code, kind: 'avatar', size: '512x512',
      hint: IMAGE_HINTS[direction] || IMAGE_HINTS.neutral });
  }
  if (!isMeaningful(current.bgUrl)) {
    media.push({ target: code, kind: 'cover', size: '1200x800',
      hint: IMAGE_HINTS[direction] || IMAGE_HINTS.neutral });
  }

  return {
    kind: 'personal',
    code,
    name: current.name || '',
    direction: direction || 'neutral',
    directionInferred: !!direction,
    changes,
    media,
    body: changes.length ? body : null,
    skipped: changes.length === 0,
    reason: changes.length === 0 ? 'barcha maydon allaqachon to‘ldirilgan' : '',
    ...opts,
  };
}

// ═══ BIZNES / KOMPANIYA REJASI ═══════════════════════════════════════
//
// `PATCH /api/companies/:id` — bu yerda server QISMAN yangilashni
// qo'llaydi (yuborilmagan maydon `current` dan olinadi), lekin biz baribir
// faqat bo'sh maydonlarni yuboramiz: kam yuborilsa, kam xato bo'ladi.
//
// Katalog FAQAT BO'SH bo'lsa to'ldiriladi. Egasi allaqachon mahsulot
// kiritgan bo'lsa, ustiga demo qo'shish uning katalogini ifloslantiradi.
export function planCompany(current, opts = {}) {
  const id = String(current.companyId || current.id || '');
  const direction = inferDirection(current);
  const demo = BUSINESS_DEMO[direction] || BUSINESS_DEMO.neutral;

  const changes = [];
  const patch = {};
  const fill = (field, value) => {
    if (!value) return;
    if (isMeaningful(current[field])) return;
    patch[field] = value;
    changes.push({ field, from: current[field] ?? '', to: value });
  };

  fill('description', demo.description);
  fill('subcategory', demo.subcategory);

  // Katalog — faqat bo'sh bo'lsa.
  const hasCatalog = Array.isArray(current.catalog) && current.catalog.length > 0;
  const catalog = hasCatalog ? [] : demo.catalog.map((it) => ({ ...it, available: true }));

  const media = [];
  if (!isMeaningful(current.logoUrl)) {
    media.push({ target: id, kind: 'logo', size: '512x512',
      hint: IMAGE_HINTS[direction] || IMAGE_HINTS.neutral });
  }
  if (!isMeaningful(current.coverUrl)) {
    media.push({ target: id, kind: 'cover', size: '1600x900',
      hint: IMAGE_HINTS[direction] || IMAGE_HINTS.neutral });
  }
  catalog.forEach((it) => {
    media.push({ target: id, kind: `catalog:${it.name}`, size: '800x800',
      hint: IMAGE_HINTS[direction] || IMAGE_HINTS.neutral });
  });

  return {
    kind: 'company',
    id,
    name: current.displayName || current.name || '',
    direction: direction || 'neutral',
    directionInferred: !!direction,
    changes,
    catalog,
    catalogSkipped: hasCatalog,
    media,
    patch: changes.length ? patch : null,
    skipped: changes.length === 0 && catalog.length === 0,
    reason: (changes.length === 0 && catalog.length === 0)
      ? (hasCatalog ? 'tavsif to‘ldirilgan va katalogda mahsulot bor' : 'barcha maydon allaqachon to‘ldirilgan')
      : '',
    ...opts,
  };
}

// ═══ EGALIK FILTRI ═══════════════════════════════════════════════════
//
// Ikki qavatli himoya. Server ALLAQACHON tekshiradi (`PUT /api/records`
// va `PATCH /api/companies` begona egaga 403 qaytaradi) — bu yerdagi
// tekshiruv uni ALMASHTIRMAYDI, balki so'rov umuman yuborilmasligi
// uchun oldindan to'sadi.
//
// `ownedCodes` — `/api/auth/me` dagi `cards` (server bergan), ya'ni
// ro'yxatning o'zi ham serverdan keladi. Skript hech qachon "menimcha
// bu meniki" deb qaror qilmaydi.
export function filterOwned(items, ownedKeys, keyOf) {
  const own = new Set([...ownedKeys].map((k) => String(k).toUpperCase()));
  const owned = [];
  const foreign = [];
  for (const it of items) {
    if (own.has(String(keyOf(it)).toUpperCase())) owned.push(it);
    else foreign.push(it);
  }
  return { owned, foreign };
}

export const __demo = { PERSONAL_DEMO, BUSINESS_DEMO, DIRECTIONS, IMAGE_HINTS };
