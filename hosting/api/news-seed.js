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

// ─────────────────────────────────────────────────────────────────────
// IKKINCHI TO'PLAM (egasi, 2026-11-02): ilova Google Play'da chiqdi va
// biznes hisob bepul ekani.
//
// Raqamlar KODDAN olingan, taxmin emas:
//   • biznes hisob bepul va avtomatik Company ID — hosting/worker.js
//     `POST /api/companies` ("BIZNES HISOB OCHISH BEPUL");
//   • bepul tarifda 5 ta tovar — `COMPANY_FREE_ITEM_LIMIT`;
//   • Premium egasida 25 ta — `COMPANY_PREMIUM_ITEM_LIMIT`;
//   • sinov 90/30 kun va 2026-12-31 chegarasi — `trialDaysForD1`,
//     `LAUNCH_PROMO_UNTIL`; sinov davrida `itemLimit: null`;
//   • mavjud tovarlar o'chirilmaydi — limit faqat YANGI qo'shishda;
//   • iPhone "tez orada" — hosting/api/app-store.js `APP_STORE_URL` bo'sh.
//
// DIQQAT: shaxsiy KARTA profilidagi katalog (`/api/records/:code/products`)
// bu EMAS — u `FEATURE_MIN.productCatalog = 'silver'`. Bu yerda gap
// KOMPANIYA katalogi (`company_catalog_items`) haqida, u bepul.
export const NEWS_PLAY_KEY = 'news-2026-11-02-play-market-bepul-katalog';
const PLAY_URL = 'play.google.com/store/apps/details?id=uz.nfcstore.nova';

export const SEED_NEWS_PLAY = [
  {
    image: IMG('play-market.jpg'),
    uz: {
      title: 'NFCSTORE ilovasi Google Play’da — bepul yuklab oling',
      body: `Android uchun NFCSTORE ilovasi Google Play’da chiqdi. Yuklab olish bepul:
${PLAY_URL}

Ilovada:
• Istalgan NFC karta, stiker yoki brelokni profilingizga bog‘lash — telefonni tekkizish kifoya.
• Shaxsiy va biznes profil: bir tugma bilan almashtirasiz.
• Biznes uchun katalog: mahsulot va xizmatlar, narx, ish vaqti, manzil.
• Lenta, Reels va storiyalar — ishingizni ko‘rsating, obunachilar yig‘ing.
• NFC yo‘q telefonda ham ishlaydi — profilingiz QR kod orqali ochiladi.
• Ivory va Noir mavzulari, profilga musiqa, PIN va barmoq izi bilan qulf.
• O‘zbek, rus va ingliz tillarida.

iPhone uchun ilova App Store tekshiruvida — tez orada.
Saytdan yuklab olish: nfcstore.uz/ilova-yuklash`,
    },
    ru: {
      title: 'Приложение NFCSTORE в Google Play — скачайте бесплатно',
      body: `Приложение NFCSTORE для Android вышло в Google Play. Скачивание бесплатное:
${PLAY_URL}

В приложении:
• Привязка любой NFC-карты, наклейки или брелока к профилю — достаточно приложить телефон.
• Личный и бизнес-профиль: переключение одной кнопкой.
• Каталог для бизнеса: товары и услуги, цены, часы работы, адрес.
• Лента, Reels и сторис — показывайте свою работу и набирайте подписчиков.
• Работает и на телефоне без NFC — профиль открывается по QR-коду.
• Темы Ivory и Noir, музыка в профиле, блокировка PIN-кодом и отпечатком.
• На узбекском, русском и английском.

Приложение для iPhone на проверке в App Store — скоро.
Скачать с сайта: nfcstore.uz/ilova-yuklash`,
    },
    en: {
      title: 'The NFCSTORE app is on Google Play — download it free',
      body: `The NFCSTORE app for Android is out on Google Play. The download is free:
${PLAY_URL}

In the app:
• Link any NFC card, sticker or key fob to your profile — just tap your phone.
• Personal and business profiles: switch with one button.
• A catalog for your business: products and services, prices, hours, address.
• Feed, Reels and stories — show your work and grow your followers.
• Works on phones without NFC too — your profile opens via a QR code.
• Ivory and Noir themes, music on your profile, PIN and fingerprint lock.
• In Uzbek, Russian and English.

The iPhone app is in App Store review — coming soon.
Download from the site: nfcstore.uz/ilova-yuklash`,
    },
  },
  {
    image: IMG('bepul-katalog.jpg'),
    uz: {
      title: 'Biznes hisob bepul — tovarlaringizni ilovaga qo‘ying',
      body: `Do‘kon, kafe, ustaxona yoki xizmatingizni endi NFCSTORE’ga bepul joylashtirasiz.

Qanday ishlaydi:
• Ilovada yoki saytda biznes hisob ochasiz. Nom o‘ylab topish shart emas — tizim bepul Company ID beradi, oldindan to‘lov so‘ralmaydi.
• Mahsulot yoki xizmat qo‘shasiz: nomi, narxi, rasmi, tavsifi; chegirma narxini ham ko‘rsatish mumkin.
• Moderatsiyadan o‘tgach, tovaringiz ilovaning umumiy katalogida — “Tanlov” bo‘limida — hammaga ko‘rinadi. Mijoz tovarni bossa, to‘g‘ri sizning biznes profilingizga tushadi.

Nechta tovar qo‘yish mumkin:
• Sinov davrida — cheklovsiz. 2026-yil 31-dekabrgacha ochilgan hisoblarga sinov 90 kun, undan keyin ochilganlarga 30 kun.
• Sinov tugagach, bepul tarifda 5 ta tovar. Allaqachon qo‘shilgan tovarlar hech qachon o‘chirilmaydi va yashirilmaydi — chegara faqat yangi qo‘shishga tegishli.
• Premium egasida 25 ta. O‘z nomingizni (Company ID) sotib olsangiz — cheklov umuman yo‘q.

Boshlash: nfcstore.uz/business`,
    },
    ru: {
      title: 'Бизнес-аккаунт бесплатно — разместите свои товары в приложении',
      body: `Магазин, кафе, мастерскую или услугу теперь можно разместить в NFCSTORE бесплатно.

Как это работает:
• Открываете бизнес-аккаунт в приложении или на сайте. Придумывать имя не нужно — система выдаёт бесплатный Company ID, предоплата не требуется.
• Добавляете товар или услугу: название, цену, фото, описание; можно указать и цену со скидкой.
• После модерации товар виден всем в общем каталоге приложения — в разделе «Tanlov». Клиент нажимает на товар и попадает прямо в ваш бизнес-профиль.

Сколько товаров можно добавить:
• В пробный период — без ограничений. Для аккаунтов, созданных до 31 декабря 2026 года, пробный период 90 дней, для созданных позже — 30 дней.
• После пробного периода на бесплатном тарифе — 5 товаров. Уже добавленные товары никогда не удаляются и не скрываются — ограничение касается только новых.
• У владельца с Premium — 25. Если купить собственное имя (Company ID) — ограничения нет вовсе.

Начать: nfcstore.uz/business`,
    },
    en: {
      title: 'A business account is free — put your products in the app',
      body: `You can now list your shop, café, workshop or service on NFCSTORE for free.

How it works:
• Open a business account in the app or on the site. No need to think up a name — the system gives you a free Company ID and asks for no payment up front.
• Add a product or a service: name, price, photo, description; you can also show a discounted price.
• Once it passes moderation, your item appears to everyone in the app’s shared catalog — the “Tanlov” section. A customer taps the item and lands straight on your business profile.

How many items you can add:
• During the trial — no limit. Accounts created before 31 December 2026 get a 90-day trial; accounts created later get 30 days.
• After the trial, the free plan allows 5 items. Items you already added are never deleted or hidden — the limit only applies to new ones.
• A Premium owner gets 25. Buy your own name (Company ID) and there is no limit at all.

Get started: nfcstore.uz/business`,
    },
  },
];

// Bitta to'plamni qo'shish. Kalit allaqachon bo'lsa — hech narsa
// qilmaydi; kalit va yangiliklar BITTA batch'da yoziladi (fayl
// boshidagi izoh). `endMs` — to'plamdagi ENG YANGI yozuv vaqti;
// qolganlari undan bir daqiqadan orqada turadi, shuning uchun
// `created_at DESC` ro'yxatda tartib SEED ro'yxatidagidek chiqadi.
async function insertSeedBatch(env, key, list, endMs) {
  const done = await env.DB.prepare(`SELECT 1 AS ok FROM content_seeds WHERE key = ?`).bind(key).first();
  if (done) return false;
  const ts = (i) => new Date(endMs - i * 60000).toISOString().replace('T', ' ').replace('Z', '+00');
  const stmts = list.map((n, i) => env.DB.prepare(`INSERT INTO news (title, body, title_ru, title_en, body_ru, body_en, image_url, published, created_at, updated_at)
    SELECT ?, ?, ?, ?, ?, ?, ?, 1, ?, ? WHERE NOT EXISTS (SELECT 1 FROM content_seeds WHERE key = ?)`)
    .bind(n.uz.title, n.uz.body, n.ru.title, n.en.title, n.ru.body, n.en.body, n.image, ts(i), ts(i), key));
  stmts.push(env.DB.prepare(`INSERT OR IGNORE INTO content_seeds (key, applied_at) VALUES (?, ?)`).bind(key, ts(0)));
  await env.DB.batch(stmts);
  return true;
}

let seeded = null;

// Xato bo'lsa yangiliklar ro'yxatini buzmaydi — keyingi so'rovda qayta
// urinadi (memo faqat muvaffaqiyatda qoladi).
export function ensureNewsSeed(env, nowIso = new Date()) {
  if (seeded) return seeded;
  seeded = (async () => {
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS content_seeds (key TEXT PRIMARY KEY, applied_at TEXT NOT NULL)`).run();
    const base = nowIso instanceof Date ? nowIso.getTime() : Date.parse(nowIso);
    // Eski to'plam BIR SOAT orqaga qo'yiladi: bo'm-bo'sh bazada ikkala
    // to'plam ham shu yerda tushadi va vaqtlari teng bo'lib qolmasin
    // (ro'yxat `created_at DESC` — yangi e'lon tepada tursin).
    const first = await insertSeedBatch(env, NEWS_SEED_KEY, SEED_NEWS, base - 3600000);
    await applyNewsFix(env);
    await insertSeedBatch(env, NEWS_PLAY_KEY, SEED_NEWS_PLAY, base);
    return first;
  })().catch((err) => { seeded = null; console.error('news seed failed', err?.message || err); return false; });
  return seeded;
}

// Faqat testlar uchun: izolyat memo'sini tozalash.
export function _resetNewsSeedMemo() { seeded = null; }
