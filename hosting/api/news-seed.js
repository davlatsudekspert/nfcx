// hosting/api/news-seed.js — NFCSTORE O'Z YANGILIKLARI (egasi, 2026-09-26).
//
// Egasi: "Yangiliklarga o'zing joyla: ilova ishlaganini, mavzularni va
// stikerlar savdosi yo'lga qo'yilganini". Uchta yangilik uz/ru/en tilda,
// rasmlari sayt bilan birga keladi (`/business-assets/news/…`, R2 ga
// hech narsa yozilmaydi).
//
// BIR MARTA QO'SHILADI. `content_seeds` jadvalidagi kalit belgisi va
// yangiliklar BITTA batch'da (D1 batch — tranzaksiya) yoziladi:
//   INSERT … SELECT … WHERE NOT EXISTS (kalit)   ← har bir yangilik
//   INSERT OR IGNORE INTO content_seeds (kalit)   ← oxirida
// Shuning uchun:
//   • ikki so'rov bir vaqtda kelsa ham yangiliklar ikki marta tushmaydi
//     (D1 yozuvlari ketma-ket bajariladi, ikkinchisi kalitni ko'radi);
//   • admin keyin yangilikni o'chirsa yoki tahrirlasa — QAYTA
//     QO'SHILMAYDI, kalit joyida turadi;
//   • hech narsa o'chirilmaydi va o'zgartirilmaydi — faqat qo'shiladi.
//
// Chaqiriladi: GET /api/news (sayt va ilova) va GET /api/admin/news —
// har izolyatda bir marta (keyingi so'rovlarda jadvalga ham murojaat yo'q).

export const NEWS_SEED_KEY = 'news-2026-09-26-ilova-mavzu-stiker';

const IMG = (f) => `/business-assets/news/${f}`;

// Tartib: ro'yxat `created_at DESC` — birinchisi eng yuqorida turadi.
export const SEED_NEWS = [
  {
    image: IMG('ilova-chiqdi.jpg'),
    uz: {
      title: 'NFCSTORE ilovasi chiqdi — Android uchun yuklab oling',
      body: `Raqamli vizitkangiz, NFC kartalaringiz va biznesingiz endi bitta ilovada.

Ilovada nimalar bor:
• Istalgan NFC karta, stiker yoki brelokni profilingizga bog‘lash — telefonni tekkizish kifoya.
• Shaxsiy va biznes profil: bir tugma bilan almashtirasiz.
• Biznes uchun katalog: mahsulot va xizmatlar, narxlar, ish vaqti, manzil.
• Lenta, Reels va storislar — ishingizni ko‘rsating, obunachilar yig‘ing.
• NFC yo‘q telefonda ham ishlaydi — profilingiz QR kod orqali ochiladi.
• Ivory va Noir mavzulari, profilga musiqa, PIN va barmoq izi bilan qulf.
• O‘zbek, rus va ingliz tillarida.

Android uchun ilovani hozirning o‘zida nfcstore.uz/ilova-yuklash sahifasidan yuklab olishingiz mumkin. Google Play va App Store’da tez kunda.`,
    },
    ru: {
      title: 'Вышло приложение NFCSTORE — скачайте для Android',
      body: `Цифровая визитка, NFC-карты и ваш бизнес — теперь в одном приложении.

Что есть в приложении:
• Привязка любой NFC-карты, наклейки или брелока к профилю — достаточно приложить телефон.
• Личный и бизнес-профиль: переключение одной кнопкой.
• Каталог для бизнеса: товары и услуги, цены, часы работы, адрес.
• Лента, Reels и сторис — показывайте свою работу и набирайте подписчиков.
• Работает и на телефоне без NFC — профиль открывается по QR-коду.
• Темы Ivory и Noir, музыка в профиле, блокировка PIN-кодом и отпечатком.
• На узбекском, русском и английском.

Приложение для Android уже можно скачать на странице nfcstore.uz/ilova-yuklash. Google Play и App Store — скоро.`,
    },
    en: {
      title: 'The NFCSTORE app is out — download it for Android',
      body: `Your digital business card, NFC cards and your business — now in one app.

What’s inside:
• Link any NFC card, sticker or key fob to your profile — just tap your phone.
• Personal and business profiles: switch with one button.
• A catalog for your business: products and services, prices, hours, address.
• Feed, Reels and stories — show your work and grow your followers.
• Works on phones without NFC too — your profile opens via a QR code.
• Ivory and Noir themes, music on your profile, PIN and fingerprint lock.
• In Uzbek, Russian and English.

You can download the Android app right now at nfcstore.uz/ilova-yuklash. Google Play and the App Store are coming soon.`,
    },
  },
  {
    image: IMG('ivory-noir.jpg'),
    uz: {
      title: 'Yangi mavzular: Ivory va Noir — saytda ham, ilovada ham',
      body: `Ilovadagi oq va qora mavzular endi saytda ham bir xil.

• Ivory — sutdek och fon va aniq qora yozuvlar. Oppoq ekran kabi ko‘zni qamashtirmaydi, kunduzi o‘qish qulay.
• Noir — tungi ko‘k fon va oltin chiziqlar. Kechqurun ko‘zni charchatmaydi.

Mavzuni saytning yuqori qismidagi palitra belgisi orqali bir tegishda almashtirasiz — tanlovingiz eslab qolinadi.`,
    },
    ru: {
      title: 'Новые темы Ivory и Noir — и на сайте, и в приложении',
      body: `Светлая и тёмная темы приложения теперь такие же и на сайте.

• Ivory — молочный фон и чёткий чёрный текст. Не слепит, как белый экран, днём читать удобно.
• Noir — ночной синий фон и золотые линии. Вечером глаза не устают.

Тема меняется в одно касание через значок палитры вверху сайта — выбор запоминается.`,
    },
    en: {
      title: 'New themes: Ivory and Noir — on the site and in the app',
      body: `The app’s light and dark themes now look the same on the website.

• Ivory — a milky background with crisp black text. Easier on the eyes than pure white and comfortable to read by day.
• Noir — a night-blue background with gold accents. Gentle on the eyes in the evening.

Switch themes in one tap with the palette icon at the top of the site — your choice is remembered.`,
    },
  },
  {
    image: IMG('stikerlar-savdosi-2.jpg'),
    uz: {
      title: 'NFC stikerlar savdosi boshlandi: do‘kon, mashina va kafe uchun',
      body: `Endi eshik, vitrina yoki mashina oynasiga bitta NFC stiker yopishtirasiz — odam telefonini stikerga tekkizadi va sahifangiz ochiladi: narxlar, katalog, ish vaqti, manzil va Telegram. Kamerani ochish ham, ilova ham shart emas.

Nega foydali:
• Do‘kon yopiq bo‘lsa ham mijoz narxlarni ko‘radi va egasiga yozadi.
• Qog‘oz narx varag‘i kerak emas — narxni telefondan bir marta o‘zgartirasiz.
• Mashinadagi stiker — shahar bo‘ylab yuradigan reklama: xohlasangiz shaxsiy, xohlasangiz biznes profilingiz ochiladi.
• Stikerga batareya kerak emas; NFC deyarli barcha zamonaviy telefonlarda bor.
• NFC nimaligini bilmaganlar uchun stikerdagi QR «qanday ishlaydi» qo‘llanmasini ochadi (nfcstore.uz/nfc-stiker).

Turlari: mini stiker, oyna ichidan yopishtiriladigan avto stiker, tashqi stiker (yomg‘ir va quyoshga chidamli) va stol stendi. Batafsil va buyurtma — nfcstore.uz/stikerlar.`,
    },
    ru: {
      title: 'Стартовали продажи NFC-наклеек: для магазина, машины и кафе',
      body: `Одна NFC-наклейка на дверь, витрину или стекло машины — человек прикладывает телефон к наклейке, и открывается ваша страница: цены, каталог, часы работы, адрес и Telegram. Не нужны ни камера, ни приложение.

Почему это выгодно:
• Даже когда магазин закрыт, клиент видит цены и пишет владельцу.
• Бумажные ценники не нужны — цена меняется один раз с телефона.
• Наклейка на машине — реклама, которая ездит по городу: открывается личный или бизнес-профиль, как вы выберете.
• Наклейке не нужна батарейка; NFC есть почти в каждом современном телефоне.
• Для тех, кто не знает про NFC, QR на наклейке открывает инструкцию «как это работает» (nfcstore.uz/nfc-stiker).

Виды: мини-наклейка, автонаклейка на стекло изнутри, уличная наклейка (не боится дождя и солнца) и настольная подставка. Подробнее и заказ — nfcstore.uz/stikerlar.`,
    },
    en: {
      title: 'NFC sticker sales are open: for shops, cars and cafés',
      body: `Put one NFC sticker on your door, shop window or car glass — people tap their phone on it and your page opens: prices, catalog, hours, address and Telegram. No camera, no app.

Why it pays off:
• Even when you are closed, customers see your prices and message you.
• No paper price tags — change a price once on your phone.
• A sticker on your car is an ad that drives around the city: it opens your personal or business profile, your choice.
• The sticker needs no battery; almost every modern phone has NFC.
• For people who don’t know NFC, the QR on the sticker opens a “how it works” guide (nfcstore.uz/nfc-stiker).

Types: mini sticker, inside-the-glass car sticker, outdoor sticker (rain and sun resistant) and a table stand. Details and orders — nfcstore.uz/stikerlar.`,
    },
  },
];

// TUZATISH (egasi, 2026-09-26): stikerdagi QR do'kon sahifasini EMAS,
// "qanday ishlaydi" qo'llanmasini (/nfc-stiker) ochadi — do'kon sahifasi
// faqat NFC orqali ochiladi. Birinchi matnda "yoki QR'ni skanerlaydi" deb
// noto'g'ri va'da berilgan edi. Bazadagi yangilik FAQAT o'zgartirilmagan
// bo'lsa yangilanadi (admin tahriri ustidan yozilmaydi); yangi bazada
// SEED_NEWS allaqachon to'g'ri matn bilan tushadi va bu tuzatish hech
// narsa qilmaydi.
export const NEWS_FIX_KEY = 'news-2026-09-26-fix-nfc-qr';
const STICKER_TITLE_UZ = 'NFC stikerlar savdosi boshlandi: do‘kon, mashina va kafe uchun';
export const NEWS_FIX_FROM = {
  image: IMG('stikerlar-savdosi.jpg'),
  uz: `Endi eshik, vitrina yoki mashina oynasiga bitta stiker yopishtirasiz — odam telefonini tekkizadi yoki QR’ni skanerlaydi va sahifangiz ochiladi: narxlar, katalog, ish vaqti, manzil va Telegram.

Nega foydali:
• Do‘kon yopiq bo‘lsa ham mijoz narxlarni ko‘radi va egasiga yozadi.
• Qog‘oz narx varag‘i kerak emas — narxni telefondan bir marta o‘zgartirasiz.
• Mashinadagi stiker — shahar bo‘ylab yuradigan reklama: xohlasangiz shaxsiy, xohlasangiz biznes profilingiz ochiladi.
• Batareya va internet shart emas, hamma telefonda ishlaydi.

Turlari: mini stiker, oyna ichidan yopishtiriladigan stiker, tashqi stiker (yomg‘ir va quyoshga chidamli) va stol stendi. Batafsil va buyurtma — nfcstore.uz/stikerlar.`,
  ru: `Одна наклейка на дверь, витрину или стекло машины — человек прикладывает телефон или сканирует QR, и открывается ваша страница: цены, каталог, часы работы, адрес и Telegram.

Почему это выгодно:
• Даже когда магазин закрыт, клиент видит цены и пишет владельцу.
• Бумажные ценники не нужны — цена меняется один раз с телефона.
• Наклейка на машине — реклама, которая ездит по городу: открывается личный или бизнес-профиль, как вы выберете.
• Не нужны батарейка и интернет, работает на любом телефоне.

Виды: мини-наклейка, наклейка на стекло изнутри, уличная наклейка (не боится дождя и солнца) и настольная подставка. Подробнее и заказ — nfcstore.uz/stikerlar.`,
  en: `Put one sticker on your door, shop window or car glass — people tap their phone or scan the QR and your page opens: prices, catalog, hours, address and Telegram.

Why it pays off:
• Even when you are closed, customers see your prices and message you.
• No paper price tags — change a price once on your phone.
• A sticker on your car is an ad that drives around the city: it opens your personal or business profile, your choice.
• No battery or internet needed, works on any phone.

Types: mini sticker, inside-the-glass sticker, outdoor sticker (rain and sun resistant) and a table stand. Details and orders — nfcstore.uz/stikerlar.`,
};

async function applyNewsFix(env) {
  const fixed = await env.DB.prepare(`SELECT 1 AS ok FROM content_seeds WHERE key = ?`).bind(NEWS_FIX_KEY).first();
  if (fixed) return;
  const to = SEED_NEWS[2];
  const now = new Date().toISOString().replace('T', ' ').replace('Z', '+00');
  // Har bir ustun alohida: admin faqat rus matnini tahrirlagan bo'lsa,
  // o'zbek va ingliz matni baribir tuzatiladi, rus matniga tegilmaydi.
  const upd = (col, from, val) => env.DB.prepare(`UPDATE news SET ${col} = ?, updated_at = ? WHERE title = ? AND ${col} = ?`)
    .bind(val, now, STICKER_TITLE_UZ, from);
  await env.DB.batch([
    upd('body', NEWS_FIX_FROM.uz, to.uz.body),
    upd('body_ru', NEWS_FIX_FROM.ru, to.ru.body),
    upd('body_en', NEWS_FIX_FROM.en, to.en.body),
    upd('image_url', NEWS_FIX_FROM.image, to.image),
    env.DB.prepare(`INSERT OR IGNORE INTO content_seeds (key, applied_at) VALUES (?, ?)`).bind(NEWS_FIX_KEY, now),
  ]);
}

let seeded = null;

// Xato bo'lsa yangiliklar ro'yxatini buzmaydi — keyingi so'rovda qayta
// urinadi (memo faqat muvaffaqiyatda qoladi).
export function ensureNewsSeed(env, nowIso = new Date()) {
  if (seeded) return seeded;
  seeded = (async () => {
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS content_seeds (key TEXT PRIMARY KEY, applied_at TEXT NOT NULL)`).run();
    const done = await env.DB.prepare(`SELECT 1 AS ok FROM content_seeds WHERE key = ?`).bind(NEWS_SEED_KEY).first();
    if (done) { await applyNewsFix(env); return false; }
    const base = nowIso instanceof Date ? nowIso.getTime() : Date.parse(nowIso);
    const ts = (i) => new Date(base - i * 60000).toISOString().replace('T', ' ').replace('Z', '+00');
    const stmts = SEED_NEWS.map((n, i) => env.DB.prepare(`INSERT INTO news (title, body, title_ru, title_en, body_ru, body_en, image_url, published, created_at, updated_at)
      SELECT ?, ?, ?, ?, ?, ?, ?, 1, ?, ? WHERE NOT EXISTS (SELECT 1 FROM content_seeds WHERE key = ?)`)
      .bind(n.uz.title, n.uz.body, n.ru.title, n.en.title, n.ru.body, n.en.body, n.image, ts(i), ts(i), NEWS_SEED_KEY));
    stmts.push(env.DB.prepare(`INSERT OR IGNORE INTO content_seeds (key, applied_at) VALUES (?, ?)`).bind(NEWS_SEED_KEY, ts(0)));
    await env.DB.batch(stmts);
    await applyNewsFix(env);
    return true;
  })().catch((err) => { seeded = null; console.error('news seed failed', err?.message || err); return false; });
  return seeded;
}

// Faqat testlar uchun: izolyat memo'sini tozalash.
export function _resetNewsSeedMemo() { seeded = null; }
