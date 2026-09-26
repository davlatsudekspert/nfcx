// hosting/api/demo-businesses.js — NAMUNA (DEMO) BIZNESLAR (2026-09-25).
//
// Egasi: "demo profillar qilib qo'ysang bo'lar ekan — biznes profillar
// har sohadan, narxlarni reallikka yaqin qilib, profilni to'liq qilib.
// Profil fonlari ham sohasiga mos rasmli bo'lsin — odamlarga namuna
// bo'lsin". Tanlangan: «Namuna» belgisi ko'rinadi, 4 soha, har birida
// 8–12 mahsulot/xizmat va 3 post.
//
// QOIDALAR:
//  • Hammasi TO'QIMA: nomlar haqiqiy do'kon/brendga tegishli emas,
//    telefon raqami YO'Q (to'qima raqam haqiqiy odamga tushib qolardi),
//    manzil — faqat tuman darajasida.
//  • Egasi — `DEMO_OWNER` ('demo'). Foydalanuvchi raqamlari sonli,
//    shuning uchun bu qiymat hech bir haqiqiy akkauntga to'g'ri
//    kelmaydi: "Mening bizneslarim"da chiqmaydi, statistikaga kirmaydi.
//  • `demo: true` javobda qaytadi → sayt va ilova «Namuna» belgisini
//    ko'rsatadi, "Tasdiqlangan" belgisini ko'rsatmaydi.
//  • Buyurtma O'CHIQ (`orders_enabled = 0` + server ham rad etadi).
//  • Postlari umumiy lentaga va "Tanlov" katalogiga TUSHMAYDI — haqiqiy
//    foydalanuvchilar kontentini siqib chiqarmasin. Ular faqat biznes
//    ro'yxatida va o'z profilida ko'rinadi.
//  • Rasmlar — sayt bilan birga keladigan statik fayllar
//    (`/business-assets/demo/<id>/…`), R2 ga hech narsa yozilmaydi.
//
// Marshrutlar (admin, manager+):
//   GET    /api/admin/demo-businesses  → { businesses: [{companyId, displayName, category, exists, items, posts}] , active }
//   POST   /api/admin/demo-businesses  → yaratadi (bor bo'lsa tegmaydi) → { created, skipped }
//   DELETE /api/admin/demo-businesses  → hammasini o'chiradi (faqat egasi 'demo' bo'lganlarni)

import * as apiComments from './comments.js';

export const DEMO_OWNER = 'demo';

const A = (id, file) => `/business-assets/demo/${id.toLowerCase()}/${file}`;

// Ish vaqti: 0 = yakshanba.
const every = (open, close) => Array.from({ length: 7 }, () => ({ closed: false, open, close }));
const weekdays = (open, close, sunday = null) => Array.from({ length: 7 }, (_, d) => (
  d === 0 ? (sunday ? { closed: false, open: sunday[0], close: sunday[1] } : { closed: true, open: '', close: '' }) : { closed: false, open, close }
));

const NOTE = 'Bu — NFCSTORE namunaviy profili: biznesingiz sahifasi shunday ko‘rinishi mumkin.';

// Har mahsulot: [nom, bo'lim, narx, aksiya narxi|null, tavsif, rasm belgisi]
// `icon` — rasm qaysi belgidan chizilgani (faqat rasm tayyorlash uchun).
export const DEMO_BUSINESSES = [
  {
    id: 'NAMUNARESTORAN', name: 'Bahor Choyxonasi', category: 'restaurant', subcategory: 'Milliy taomlar',
    city: 'Toshkent', address: 'Toshkent sh., Chilonzor tumani',
    description: 'Oilaviy choyxona: tandir va qozonda pishgan milliy taomlar, doim issiq non va ko‘k choy. To‘y va ziyofatlarga buyurtma olamiz.',
    hours: every('09:00', '23:00'), kind: 'product', market: 'food',
    items: [
      ['To‘y oshi', 'Milliy taomlar', 45000, null, 'Lazer guruch, qo‘y go‘shti, sariq sabzi, no‘xat va mayiz bilan. 1 porsiya.', 'Pot of food'],
      ['Qozon kabob', 'Milliy taomlar', 65000, 58000, 'Yosh qo‘y go‘shti kartoshka bilan qozonda qovurilgan.', 'Meat on bone'],
      ['Lag‘mon', 'Milliy taomlar', 38000, null, 'Qo‘lda cho‘zilgan xamir, go‘sht va sabzavotli suyuq lag‘mon.', 'Spaghetti'],
      ['Manti (6 dona)', 'Milliy taomlar', 40000, null, 'Bug‘da pishgan, qo‘y go‘shti va piyozli.', 'Dumpling'],
      ['Chuchvara', 'Milliy taomlar', 32000, null, 'Qatiq va ko‘katlar bilan tortiladi.', 'Bowl with spoon'],
      ['Qo‘y shashlik (1 six)', 'Shashlik', 22000, null, 'Ko‘mirda pishgan, piyoz va sirka bilan.', 'Poultry leg'],
      ['Tandir somsa', 'Pishiriqlar', 12000, null, 'Qo‘y go‘shti va dumba yog‘i bilan, tandirdan issiq.', 'Stuffed flatbread'],
      ['Tandir non', 'Pishiriqlar', 5000, null, 'Har kuni ertalab yangi yopiladi.', 'Flatbread'],
      ['Achchiq-chuchuk', 'Salatlar', 15000, null, 'Pomidor, piyoz va achchiq qalampir.', 'Green salad'],
      ['Ko‘k choy (choynak)', 'Ichimliklar', 8000, null, 'Choynakda damlangan ko‘k choy.', 'Teapot'],
      ['Uy kompoti (1 l)', 'Ichimliklar', 18000, null, 'Olma va o‘rikdan, shakari kam.', 'Cup with straw'],
    ],
    posts: [
      ['Juma kuni — to‘y oshi! Soat 11:00 dan issiq tortiladi. 🍚', 1],
      ['Qozon kabob bu hafta chegirmada: 65 000 emas, 58 000 so‘m.', 2],
      ['Ertalabki tandir non tayyor — ko‘k choy bilan kelinglar.', 8],
    ],
  },
  {
    id: 'NAMUNAKAFE', name: 'Kofe Burchak', category: 'cafe', subcategory: 'Qahvaxona',
    city: 'Toshkent', address: 'Toshkent sh., Mirobod tumani',
    description: 'Shinam qahvaxona: yangi qovurilgan donlardan qahva, uyda pishirilgan desertlar va nonushtalar. Ishlash va uchrashuv uchun tinch joy.',
    hours: every('08:00', '22:00'), kind: 'product', market: 'food',
    items: [
      ['Espresso', 'Qahva', 18000, null, 'Bir porsiya, 30 ml.', 'Hot beverage'],
      ['Kapuchino', 'Qahva', 28000, null, 'Espresso va ko‘pirtirilgan sut, 300 ml.', 'Hot beverage'],
      ['Latte', 'Qahva', 30000, null, 'Yumshoq ta’m, 350 ml.', 'Hot beverage'],
      ['Raf', 'Qahva', 34000, 30000, 'Qaymoqli, vanilli.', 'Hot beverage'],
      ['Muzli qahva', 'Sovuq ichimliklar', 32000, null, 'Sovuq damlangan qahva, muz bilan.', 'Bubble tea'],
      ['Limonad (1 l)', 'Sovuq ichimliklar', 45000, null, 'Limon, yalpiz va gazli suv.', 'Tropical drink'],
      ['Kruassan', 'Nonushta', 22000, null, 'Sariyog‘li, har kuni ertalab pishiriladi.', 'Croissant'],
      ['Sirniki', 'Nonushta', 36000, null, 'Smetana va murabbo bilan.', 'Pancakes'],
      ['Tovuqli sendvich', 'Nonushta', 42000, null, 'Grilda pishgan tovuq, sabzavot va sous.', 'Sandwich'],
      ['Chizkeyk', 'Desertlar', 35000, null, 'Klassik Nyu-York chizkeyki.', 'Shortcake'],
      ['Medovik', 'Desertlar', 30000, null, 'Asal qatlamli tort, bir bo‘lak.', 'Birthday cake'],
    ],
    posts: [
      ['Yangi mavsum: muzli qahva endi menyuda! ☕🧊', 5],
      ['Ertalab 10:00 gacha kapuchino + kruassan birga.', 7],
      ['Bugungi desert — uyda pishirilgan chizkeyk.', 10],
    ],
  },
  {
    id: 'NAMUNAKIYIM', name: 'Libos Butik', category: 'shop', subcategory: 'Kiyim-kechak',
    city: 'Toshkent', address: 'Toshkent sh., Yunusobod tumani',
    description: 'Erkaklar va ayollar uchun kundalik va bayramona kiyimlar. Har hafta yangi kolleksiya, o‘lcham bo‘yicha maslahat beramiz.',
    hours: every('10:00', '21:00'), kind: 'product', market: 'fashion',
    items: [
      ['Erkaklar ko‘ylagi', 'Erkaklar', 289000, null, 'Paxta, klassik yoqa. O‘lchamlar: S–XXL.', 'T-shirt'],
      ['Jinsi shim', 'Erkaklar', 349000, 299000, 'To‘g‘ri bichim, zich mato.', 'Jeans'],
      ['Xudi', 'Erkaklar', 390000, null, 'Issiq, ichi yumshoq, kapyushonli.', 'Running shirt'],
      ['Futbolka', 'Erkaklar', 129000, null, '100% paxta, turli ranglar.', 'T-shirt'],
      ['Ayollar ko‘ylagi', 'Ayollar', 420000, null, 'Yengil mato, bayram va kundalik uchun.', 'Dress'],
      ['Trikotaj sviter', 'Ayollar', 310000, null, 'Yumshoq trikotaj, kuzgi mavsum.', 'Coat'],
      ['Kuzgi palto', 'Ayollar', 1250000, 1090000, 'Jun aralash mato, astarli.', 'Coat'],
      ['Krossovka', 'Poyabzal', 690000, null, 'Yengil taglik, kundalik yurish uchun.', 'Running shoe'],
      ['Charm kamar', 'Aksessuarlar', 159000, null, 'Tabiiy charm, metall to‘qa.', 'Briefcase'],
      ['Sharf', 'Aksessuarlar', 119000, null, 'Yumshoq, issiq, 180 sm.', 'Scarf'],
    ],
    posts: [
      ['Kuzgi kolleksiya keldi! Paltolarga -13% chegirma. 🍂', 7],
      ['Yangi xudilar — 6 xil rangda.', 3],
      ['Krossovkalar: 36 dan 45 gacha o‘lchamlar bor.', 8],
    ],
  },
  {
    id: 'NAMUNATEXNIKA', name: 'Texno Uy', category: 'shop', subcategory: 'Elektronika va maishiy texnika',
    city: 'Toshkent', address: 'Toshkent sh., Sergeli tumani',
    description: 'Uy va ish uchun elektronika hamda maishiy texnika. Barcha tovarlarga kafolat, Toshkent bo‘ylab yetkazib berish.',
    hours: every('09:00', '20:00'), kind: 'product', market: 'electronics',
    items: [
      ['Simsiz quloqchin', 'Audio', 349000, 299000, 'Bluetooth 5.3, 30 soatgacha ishlaydi.', 'Headphone'],
      ['Bluetooth kolonka', 'Audio', 459000, null, 'Suvga chidamli, baland va aniq ovoz.', 'Speaker high volume'],
      ['Aqlli soat', 'Gadjetlar', 890000, null, 'Yurak urishi, qadam va uyqu nazorati.', 'Watch'],
      ['Powerbank 20 000 mAh', 'Gadjetlar', 289000, null, 'Tez quvvatlash, 2 ta chiqish.', 'Battery'],
      ['USB-C quvvatlagich 65 W', 'Gadjetlar', 199000, null, 'Telefon va noutbuk uchun.', 'Electric plug'],
      ['Smartfon g‘ilofi', 'Aksessuarlar', 79000, null, 'Silikon, zarbaga chidamli.', 'Mobile phone'],
      ['Noutbuk sumkasi', 'Aksessuarlar', 239000, null, '15,6 dyuymgacha, suv o‘tkazmaydi.', 'Briefcase'],
      ['Chang yutgich', 'Maishiy texnika', 2490000, 2290000, 'Simsiz, 45 daqiqagacha ishlaydi.', 'Broom'],
      ['Elektr choynak', 'Maishiy texnika', 259000, null, '1,7 l, zanglamas po‘lat.', 'Teapot'],
      ['Stol lampasi', 'Maishiy texnika', 189000, null, 'LED, 3 xil yorug‘lik rejimi.', 'Light bulb'],
    ],
    posts: [
      ['Simsiz quloqchinlar chegirmada: 299 000 so‘m. 🎧', 1],
      ['Yangi aqlli soatlar keldi — kafolat 1 yil.', 3],
      ['Chang yutgichga 200 000 so‘m chegirma, hafta oxirigacha.', 8],
    ],
  },
  {
    id: 'NAMUNAMARKET', name: 'Dasturxon Market', category: 'market', subcategory: 'Oziq-ovqat',
    city: 'Toshkent', address: 'Toshkent sh., Yakkasaroy tumani',
    description: 'Mahalla marketi: har kuni yangi sut mahsulotlari, go‘sht, meva-sabzavot va uy uchun kerakli hamma narsa. 200 000 so‘mdan ortiq xaridga yetkazish bepul.',
    hours: every('07:00', '23:00'), kind: 'product', market: 'food',
    items: [
      ['Lazer guruch (1 kg)', 'Bakaleya', 22000, null, 'Osh uchun saralangan guruch.', 'Cooked rice'],
      ['Kungaboqar yog‘i (1 l)', 'Bakaleya', 24000, null, 'Tozalangan, hidsiz.', 'Jar'],
      ['Un, oliy nav (2 kg)', 'Bakaleya', 17000, null, 'Non va pishiriqlar uchun.', 'Bread'],
      ['Tuxum (10 dona)', 'Sut va tuxum', 17000, null, 'Yangi, C1 toifa.', 'Egg'],
      ['Sut (1 l)', 'Sut va tuxum', 12500, null, '3,2% yog‘lilik.', 'Glass of milk'],
      ['Pishloq (1 kg)', 'Sut va tuxum', 95000, 89000, 'Qattiq pishloq, tilimlab beriladi.', 'Cheese wedge'],
      ['Mol go‘shti (1 kg)', 'Go‘sht', 115000, null, 'Yangi, suyaksiz.', 'Cut of meat'],
      ['Kartoshka (1 kg)', 'Meva-sabzavot', 6000, null, 'Mahalliy hosil.', 'Potato'],
      ['Sabzi (1 kg)', 'Meva-sabzavot', 5000, null, 'Osh uchun sariq sabzi.', 'Carrot'],
      ['Olma (1 kg)', 'Meva-sabzavot', 14000, null, 'Shirin, qizil olma.', 'Red apple'],
      ['Uzum (1 kg)', 'Meva-sabzavot', 18000, null, 'Kishmish navi.', 'Grapes'],
      ['Ko‘k choy (100 g)', 'Bakaleya', 18000, null, 'Barg choy.', 'Teacup without handle'],
    ],
    posts: [
      ['Bugun yangi uzum va olma keldi. 🍇🍎', 11],
      ['Pishloq chegirmada — kilosi 89 000 so‘m.', 6],
      ['200 000 so‘mdan ortiq xaridga yetkazish bepul!', 1],
    ],
  },
  {
    id: 'NAMUNABARBER', name: 'Ustoz Barber', category: 'services', subcategory: 'Sartaroshxona',
    city: 'Toshkent', address: 'Toshkent sh., Shayxontohur tumani',
    description: 'Erkaklar sartaroshxonasi: zamonaviy soch turmaklari, soqol dizayni va ustara bilan soqol olish. Oldindan yozilsangiz navbat kutmaysiz.',
    hours: every('10:00', '21:00'), kind: 'service', market: 'beauty',
    items: [
      ['Soch olish', 'Soch', 80000, null, 'Yuvish va ukladka bilan, 45 daqiqa.', 'Man getting haircut'],
      ['Bolalar soch olishi', 'Soch', 60000, null, '12 yoshgacha.', 'Person getting haircut'],
      ['Soch bo‘yash', 'Soch', 150000, null, 'Oqni yashirish yoki yangi rang.', 'Paintbrush'],
      ['Soch yuvish va ukladka', 'Soch', 40000, null, 'Parvarish vositalari bilan.', 'Lotion bottle'],
      ['Soqolni tekislash', 'Soqol', 50000, null, 'Shakl berish va konturlash.', 'Scissors'],
      ['Ustara bilan soqol olish', 'Soqol', 60000, null, 'Issiq sochiq bilan, klassik usul.', 'Razor'],
      ['Soch + soqol', 'Kompleks', 120000, 110000, 'Eng ko‘p tanlanadigan xizmat.', 'Barber pole'],
      ['Yuz parvarishi', 'Kompleks', 90000, null, 'Tozalash, niqob va massaj.', 'Person getting massage'],
    ],
    posts: [
      ['Soch + soqol kompleks — 110 000 so‘m, faqat shu oy. 💈', 7],
      ['Yangi usta jamoamizga qo‘shildi, navbat qisqardi.', 1],
      ['Ustara bilan klassik soqol — issiq sochiq bilan.', 6],
    ],
  },
  {
    id: 'NAMUNASALON', name: 'Nafis Go‘zallik', category: 'services', subcategory: 'Go‘zallik saloni',
    city: 'Toshkent', address: 'Toshkent sh., Yashnobod tumani',
    description: 'Ayollar go‘zallik saloni: manikyur, pedikyur, qosh va kiprik, soch turmagi hamda kelin makiyaji. Faqat sifatli, sertifikatlangan vositalar.',
    hours: weekdays('09:00', '20:00', ['10:00', '18:00']), kind: 'service', market: 'beauty',
    items: [
      ['Manikyur + gel-lak', 'Tirnoq', 150000, null, 'Apparat manikyur, rang tanlovi keng.', 'Nail polish'],
      ['Pedikyur', 'Tirnoq', 200000, null, 'Parvarish va qoplama bilan.', 'Lotion bottle'],
      ['Qosh korreksiyasi', 'Qosh va kiprik', 60000, null, 'Shakl berish va bo‘yash.', 'Eye'],
      ['Kiprik laminatsiyasi', 'Qosh va kiprik', 180000, null, '6–8 hafta saqlanadi.', 'Sparkles'],
      ['Soch turmagi', 'Soch', 250000, null, 'Bayram va to‘y uchun.', 'Woman getting haircut'],
      ['Keratin', 'Soch', 800000, 690000, 'O‘rta uzunlikdagi soch uchun.', 'Person getting haircut'],
      ['Kundalik makiyaj', 'Makiyaj', 350000, null, 'Tabiiy ko‘rinish.', 'Lipstick'],
      ['Kelin makiyaji', 'Makiyaj', 1200000, null, 'Soch turmagi bilan, sinov makiyaji kiradi.', 'Ring'],
      ['Yuzni tozalash', 'Parvarish', 300000, null, 'Kombinatsiyalangan tozalash.', 'Soap'],
    ],
    posts: [
      ['Keratin chegirmada — 690 000 so‘m. ✨', 6],
      ['Kelin makiyaji uchun oldindan yoziling — kuzgi to‘ylar mavsumi.', 8],
      ['Yangi gel-lak ranglari keldi.', 1],
    ],
  },
  {
    id: 'NAMUNAAVTO', name: 'Avto Doktor', category: 'services', subcategory: 'Avtoservis',
    city: 'Toshkent', address: 'Toshkent sh., Uchtepa tumani',
    description: 'Avtoservis: kompyuter diagnostikasi, moy almashtirish, xodovoy va tormoz, shinomontaj hamda avtoyuvish. Ish sifatiga kafolat beriladi.',
    hours: weekdays('08:00', '20:00', ['09:00', '16:00']), kind: 'service', market: 'auto',
    items: [
      ['Kompyuter diagnostikasi', 'Diagnostika', 150000, null, 'Xatolar ro‘yxati va tavsiyalar bilan.', 'Laptop'],
      ['Xodovoy tekshiruvi', 'Diagnostika', 80000, null, 'Osma va rul qismlarini ko‘rik.', 'Automobile'],
      ['Moy almashtirish (ish)', 'Texnik xizmat', 60000, null, 'Moy va filtr alohida.', 'Oil drum'],
      ['Tormoz kolodkasini almashtirish', 'Texnik xizmat', 120000, null, 'Bitta o‘q uchun.', 'Gear'],
      ['Razval-shaxdon', 'Texnik xizmat', 150000, 130000, 'Kompyuter stendida.', 'Wrench'],
      ['Konditsionerga freon', 'Texnik xizmat', 250000, null, 'Germetiklik tekshiruvi bilan.', 'Snowflake'],
      ['Shinomontaj (4 g‘ildirak)', 'Shinalar', 120000, null, 'Balansirovka bilan.', 'Nut and bolt'],
      ['Akkumulyator tekshiruvi', 'Elektr', 30000, null, 'Zaryad va generator tekshiruvi.', 'Battery'],
      ['Kompleks avtoyuvish', 'Avtoyuvish', 70000, null, 'Kuzov va salon.', 'Sponge'],
    ],
    posts: [
      ['Qishga tayyorgarlik: akkumulyator tekshiruvi — 30 000 so‘m. 🔋', 8],
      ['Razval-shaxdon bu hafta 130 000 so‘m.', 5],
      ['Kompleks avtoyuvish — 40 daqiqada tayyor.', 9],
    ],
  },
  {
    id: 'NAMUNATAMIR', name: 'Mustahkam Ta’mir', category: 'construction', subcategory: 'Ta’mir va qurilish',
    city: 'Toshkent', address: 'Toshkent sh., Mirzo Ulug‘bek tumani',
    description: 'Kvartira va uylar ta’miri kalit topshirish sharti bilan: dizayn loyiha, elektr, santexnika, kafel, gipsokarton. Smeta va shartnoma bilan ishlaymiz.',
    hours: weekdays('09:00', '19:00'), kind: 'service', market: 'home',
    items: [
      ['Dizayn loyiha (1 m²)', 'Loyiha', 80000, null, '3D vizualizatsiya bilan.', 'Paintbrush'],
      ['Yevrota’mir (1 m²)', 'Ta’mir', 1900000, null, 'Materiallar bilan, kalit topshirish.', 'Building construction'],
      ['Shpaklyovka (1 m²)', 'Ta’mir', 45000, null, 'Bo‘yoq yoki gulqog‘oz ostiga.', 'Bucket'],
      ['Kafel yotqizish (1 m²)', 'Ta’mir', 120000, null, 'Devor va pol.', 'Brick'],
      ['Laminat yotqizish (1 m²)', 'Ta’mir', 40000, null, 'Podloshka bilan.', 'Carpentry saw'],
      ['Gipsokarton shift (1 m²)', 'Ta’mir', 150000, 135000, 'Yoritgich joylari bilan.', 'Hammer and wrench'],
      ['Elektr montaj (1 nuqta)', 'Muhandislik', 60000, null, 'Rozetka, kalit, yoritgich.', 'Light bulb'],
      ['Santexnika o‘rnatish', 'Muhandislik', 250000, null, 'Unitaz, rakovina yoki dush.', 'Plunger'],
      ['Eshik o‘rnatish', 'Muhandislik', 350000, null, 'Ichki eshik, qulf bilan.', 'Door'],
      ['Uy qurilishi', 'Qurilish', 0, null, 'Loyiha bo‘yicha — narx kelishiladi.', 'House with garden'],
    ],
    posts: [
      ['Yangi topshirilgan kvartira: 78 m², 3 oyda. 🏠', 2],
      ['Gipsokarton shiftga kuzgi chegirma — 135 000 so‘m/m².', 6],
      ['Smeta bepul: o‘lchov uchun usta chiqadi.', 1],
    ],
  },
  {
    id: 'NAMUNADENTAL', name: 'Tabassum Dental', category: 'clinic', subcategory: 'Stomatologiya',
    city: 'Toshkent', address: 'Toshkent sh., Olmazor tumani',
    description: 'Oilaviy stomatologiya klinikasi: davolash, tozalash, implant va ortodontiya. Zamonaviy uskunalar, og‘riqsiz davolash.',
    hours: weekdays('09:00', '19:00', ['10:00', '15:00']), kind: 'service', market: 'health',
    items: [
      ['Ko‘rik va maslahat', 'Diagnostika', 50000, null, 'Shifokor ko‘rigi va davolash rejasi.', 'Tooth'],
      ['Professional tozalash', 'Gigiyena', 350000, 299000, 'Ultratovush va Air Flow.', 'Sparkles'],
      ['Tish oqartirish', 'Gigiyena', 1500000, null, 'Klinikada, bir seans.', 'Tooth'],
      ['Plomba (fotopolimer)', 'Davolash', 400000, null, 'Bitta tish uchun.', 'Tooth'],
      ['Bolalar plombasi', 'Davolash', 250000, null, 'Sut tishlari uchun.', 'Tooth'],
      ['Kanal davolash', 'Davolash', 700000, null, 'Bir kanalli tish uchun.', 'Syringe'],
      ['Tish oldirish', 'Jarrohlik', 250000, null, 'Oddiy holatda, anesteziya bilan.', 'Syringe'],
      ['Implant', 'Jarrohlik', 5500000, null, 'O‘rnatish ishi bilan, toj alohida.', 'Nut and bolt'],
      ['Metallokeramika toj', 'Protezlash', 1200000, null, 'Bitta tish uchun.', 'Crown'],
      ['Breket tizimi', 'Ortodontiya', 8000000, null, 'Metall breketlar, bir jag‘.', 'Gear'],
    ],
    posts: [
      ['Professional tozalash chegirmada — 299 000 so‘m. 🦷', 2],
      ['Bolalar uchun alohida xona va shifokor.', 5],
      ['Implant bo‘yicha bepul maslahat — yoziling.', 8],
    ],
  },
  {
    id: 'NAMUNADORIXONA', name: 'Shifo Dorixona', category: 'pharmacy', subcategory: 'Dorixona',
    city: 'Toshkent', address: 'Toshkent sh., Bektemir tumani',
    description: 'Mahalla dorixonasi: retseptsiz dorilar, vitaminlar, tibbiy buyumlar va gigiyena vositalari. Farmatsevt maslahati bepul.',
    hours: every('08:00', '22:00'), kind: 'product', market: 'health',
    items: [
      ['Paratsetamol 500 mg (10 dona)', 'Dorilar', 5000, null, 'Retseptsiz. Qo‘llashdan oldin yo‘riqnomani o‘qing.', 'Pill'],
      ['Ibuprofen 200 mg (20 dona)', 'Dorilar', 14000, null, 'Retseptsiz. Qo‘llashdan oldin yo‘riqnomani o‘qing.', 'Pill'],
      ['Vitamin C 1000 mg', 'Vitaminlar', 45000, null, '20 ta eriydigan tabletka.', 'Lemon'],
      ['Vitamin D3 2000 ME', 'Vitaminlar', 69000, 59000, '60 kapsula.', 'Sun'],
      ['Omega-3 (60 kapsula)', 'Vitaminlar', 120000, null, 'Baliq yog‘i.', 'Fish'],
      ['Raqamli termometr', 'Tibbiy buyumlar', 45000, null, '60 soniyada natija.', 'Thermometer'],
      ['Qon bosimi o‘lchagich', 'Tibbiy buyumlar', 390000, null, 'Avtomatik, bilakka taqiladi.', 'Stethoscope'],
      ['Tibbiy niqob (50 dona)', 'Gigiyena', 25000, null, 'Uch qatlamli.', 'Face with medical mask'],
      ['Antiseptik (100 ml)', 'Gigiyena', 15000, null, 'Qo‘l uchun, spirtli.', 'Lotion bottle'],
      ['Steril bint', 'Tibbiy buyumlar', 5000, null, '7 m × 14 sm.', 'Adhesive bandage'],
    ],
    posts: [
      ['Kuz — vitamin mavsumi: D3 chegirmada, 59 000 so‘m. ☀️', 4],
      ['Qon bosimi o‘lchagichlar keldi — farmatsevt ishlatishni o‘rgatadi.', 7],
      ['Dorixona har kuni 08:00 dan 22:00 gacha ochiq.', 6],
    ],
  },
  {
    id: 'NAMUNATALIM', name: 'Bilim O‘quv Markazi', category: 'education', subcategory: 'O‘quv markazi',
    city: 'Toshkent', address: 'Toshkent sh., Yunusobod tumani',
    description: 'Til va aniq fanlar o‘quv markazi: ingliz, rus va koreys tillari, IELTS va SAT tayyorlov, matematika, dasturlash. Guruhlar 8–10 kishidan.',
    hours: weekdays('09:00', '20:00', ['10:00', '16:00']), kind: 'service', market: 'education',
    items: [
      ['Ingliz tili (General)', 'Tillar', 450000, null, 'Oyiga, haftada 3 dars.', 'Books'],
      ['IELTS tayyorlov', 'Tillar', 700000, 630000, 'Oyiga, haftada 3 dars + sinov imtihon.', 'Graduation cap'],
      ['Bolalar uchun ingliz tili', 'Tillar', 380000, null, '7–12 yosh, o‘yin usulida.', 'Open book'],
      ['Rus tili', 'Tillar', 400000, null, 'Oyiga, haftada 3 dars.', 'Speech balloon'],
      ['Koreys tili', 'Tillar', 450000, null, 'TOPIK tayyorlov bilan.', 'Globe showing asia-australia'],
      ['Matematika (abituriyent)', 'Aniq fanlar', 500000, null, 'Oyiga, test va nazariya.', 'Abacus'],
      ['SAT tayyorlov', 'Aniq fanlar', 1000000, null, 'Oyiga, Math + English.', 'Pencil'],
      ['Python dasturlash', 'IT', 900000, null, 'Oyiga, 0 dan loyihagacha.', 'Laptop'],
      ['Kompyuter savodxonligi', 'IT', 350000, null, 'Word, Excel, internet.', 'Desktop computer'],
      ['Individual dars (1 soat)', 'Individual', 150000, null, 'Istalgan fan bo‘yicha.', 'Man teacher'],
    ],
    posts: [
      ['Yangi IELTS guruhi 1-oktabrdan! Birinchi oy -10%. 🎓', 2],
      ['O‘quvchimiz IELTS 7.5 oldi — tabriklaymiz!', 1],
      ['Python kursi: 4 oyda birinchi loyihangizni yozasiz.', 8],
    ],
  },
];

export const DEMO_IDS = DEMO_BUSINESSES.map((b) => b.id);

/// Rasm manzillari — bitta joyda (test va rasm tayyorlash shu bilan tekshiriladi).
export function demoImages(b) {
  return {
    logo: A(b.id, 'logo.jpg'),
    cover: A(b.id, 'cover.jpg'),
    item: (i) => A(b.id, `i${i + 1}.jpg`),
    post: (i) => A(b.id, `p${i + 1}.jpg`),
  };
}

const idList = () => DEMO_IDS.map(() => '?').join(',');

async function status(env) {
  const [cos, items, posts] = await Promise.all([
    env.DB.prepare(`SELECT company_id, owner_user_id FROM companies WHERE company_id IN (${idList()})`).bind(...DEMO_IDS).all(),
    env.DB.prepare(`SELECT company_id, COUNT(*) AS n FROM company_catalog_items WHERE company_id IN (${idList()}) GROUP BY company_id`).bind(...DEMO_IDS).all(),
    env.DB.prepare(`SELECT company_id, COUNT(*) AS n FROM company_posts WHERE company_id IN (${idList()}) GROUP BY company_id`).bind(...DEMO_IDS).all(),
  ]);
  const owner = new Map((cos.results || []).map((r) => [r.company_id, String(r.owner_user_id)]));
  const nItems = new Map((items.results || []).map((r) => [r.company_id, Number(r.n)]));
  const nPosts = new Map((posts.results || []).map((r) => [r.company_id, Number(r.n)]));
  const businesses = DEMO_BUSINESSES.map((b) => ({
    companyId: b.id, displayName: b.name, category: b.category, subcategory: b.subcategory,
    logoUrl: demoImages(b).logo,
    // `taken` — bu ID ni haqiqiy odam egallagan: unga TEGILMAYDI.
    exists: owner.get(b.id) === DEMO_OWNER,
    taken: owner.has(b.id) && owner.get(b.id) !== DEMO_OWNER,
    items: owner.get(b.id) === DEMO_OWNER ? nItems.get(b.id) || 0 : 0,
    posts: owner.get(b.id) === DEMO_OWNER ? nPosts.get(b.id) || 0 : 0,
  }));
  return { businesses, active: businesses.filter((b) => b.exists).length, total: businesses.length };
}

// Postlar vaqti: bugundan 1, 4, 9 kun oldin (profilda tabiiy ko'rinsin).
const POST_AGE_DAYS = [1, 4, 9];

async function seed(env, H) {
  const now = H.nowTs();
  const created = [];
  const skipped = [];
  for (const b of DEMO_BUSINESSES) {
    const row = await env.DB.prepare(`SELECT owner_user_id FROM companies WHERE company_id = ?`).bind(b.id).first();
    if (row) { skipped.push(b.id); continue; }
    const img = demoImages(b);
    const gallery = b.items.slice(0, 4).map((_, i) => img.item(i));
    const stmts = [
      env.DB.prepare(
        `INSERT INTO companies (company_id, owner_user_id, owner_email, display_name, category, subcategory, city, address, description,
            phone, telegram, whatsapp, website, logo_url, cover_url, gallery_json, tier, price, status, hours_json, orders_enabled,
            created_at, updated_at, approved_at, activated_at)
         VALUES (?, ?, '', ?, ?, ?, ?, ?, ?, '', '', '', '', ?, ?, ?, 'free', 0, 'active', ?, 0, ?, ?, ?, ?)`
      ).bind(b.id, DEMO_OWNER, b.name, b.category, b.subcategory, b.city, b.address, `${b.description}\n\n${NOTE}`,
        img.logo, img.cover, JSON.stringify(gallery), JSON.stringify(b.hours), now, now, now, now),
      ...b.items.map(([name, section, price, promo, desc], i) => env.DB.prepare(
        `INSERT INTO company_catalog_items (id, company_id, name, category, description, price, promotion_price, image_url, available, sort_order,
            created_at, updated_at, kind, market_category, images_json, price_on_request)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, '[]', ?)`
      ).bind(crypto.randomUUID(), b.id, name, section, desc, price, promo, img.item(i), i, now, now,
        b.kind, b.market, b.kind === 'service' && price <= 0 ? 1 : 0)),
      // Postning 2-qiymati (mahsulot raqami) faqat rasm tayyorlashda
      // ishlatiladi — post rasmi o'sha mahsulot asosida chizilgan.
      ...b.posts.map(([caption], i) => {
        const at = new Date(Date.now() - POST_AGE_DAYS[i % POST_AGE_DAYS.length] * 86400_000).toISOString().replace('T', ' ').replace('Z', '+00');
        return env.DB.prepare(`INSERT INTO company_posts (company_id, image_url, video_url, caption, created_at) VALUES (?, ?, NULL, ?, ?)`)
          .bind(b.id, img.post(i), caption, at);
      }),
    ];
    await env.DB.batch(stmts);
    created.push(b.id);
  }
  return { created, skipped };
}

async function remove(env) {
  // FAQAT egasi 'demo' bo'lgan va ro'yxatdagi ID lar. Haqiqiy
  // foydalanuvchi shu ID ni olgan bo'lsa — unga tegilmaydi.
  const ids = ((await env.DB.prepare(
    `SELECT company_id FROM companies WHERE owner_user_id = ? AND company_id IN (${idList()})`
  ).bind(DEMO_OWNER, ...DEMO_IDS).all()).results || []).map((r) => r.company_id);
  if (!ids.length) return { removed: [] };
  const q = ids.map(() => '?').join(',');
  const postIds = `SELECT id FROM company_posts WHERE company_id IN (${q})`;
  await apiComments.ensureSchema(env);
  const optional = [
    `DELETE FROM post_extras WHERE post_kind = 'company_post' AND post_id IN (${postIds})`,
    `DELETE FROM company_catalog_item_views WHERE item_id IN (SELECT id FROM company_catalog_items WHERE company_id IN (${q}))`,
    `DELETE FROM company_follows WHERE company_id IN (${q})`,
    `DELETE FROM company_stats WHERE company_id IN (${q})`,
    `DELETE FROM company_orders WHERE company_id IN (${q})`,
    `DELETE FROM stories WHERE owner_kind = 'company' AND owner_id IN (${q})`,
    `DELETE FROM company_status_log WHERE company_id IN (${q})`,
  ];
  // Ixtiyoriy jadvallar hali yaratilmagan bo'lishi mumkin — har biri alohida.
  for (const sql of optional) await env.DB.prepare(sql).bind(...ids).run().catch(() => {});
  await env.DB.batch([
    ...apiComments.retireTargetStmts(env, 'company_post', postIds, ids, { reason: 'demo_removed', byAdmin: 'demo' }),
    env.DB.prepare(`DELETE FROM company_posts WHERE company_id IN (${q})`).bind(...ids),
    env.DB.prepare(`DELETE FROM company_catalog_items WHERE company_id IN (${q})`).bind(...ids),
    env.DB.prepare(`DELETE FROM companies WHERE owner_user_id = ? AND company_id IN (${q})`).bind(DEMO_OWNER, ...ids),
  ]);
  return { removed: ids };
}

export async function handle(request, env, url, H) {
  if (url.pathname !== '/api/admin/demo-businesses') return null;
  const admin = await H.requireAdmin(request, env);
  if (!admin) return H.json({ error: 'unauthorized' }, 401);
  await H.ensureCompanyTablesD1(env);
  if (request.method === 'GET') return H.json(await status(env));
  if (!H.roleAtLeast(admin, 'manager')) return H.json({ error: 'forbidden' }, 403);
  if (request.method === 'POST') {
    const r = await seed(env, H);
    await H.logAdminActivity(env, { action: 'demo_businesses_seed', details: `${r.created.length} ta: ${r.created.join(', ')}`, ip: H.reqIp(request) });
    return H.json({ ok: true, ...r, ...(await status(env)) }, 201);
  }
  if (request.method === 'DELETE') {
    const r = await remove(env);
    await H.logAdminActivity(env, { action: 'demo_businesses_remove', details: `${r.removed.length} ta: ${r.removed.join(', ')}`, ip: H.reqIp(request) });
    return H.json({ ok: true, ...r, ...(await status(env)) });
  }
  return H.json({ error: 'method_not_allowed' }, 405);
}
