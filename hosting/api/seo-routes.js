// SAYT SAHIFALARINING SEO MA'LUMOTI — YAGONA MANBA (2026-10).
//
// Ilgari bu ro'yxat faqat src/lib/seo.js da edi va faqat brauzerda
// (JavaScript ishga tushgandan keyin) qo'llanardi. Google, Telegram,
// WhatsApp kabi robotlar esa JavaScript'siz o'qiydi — /stikerlar,
// /narxlar, /privacy va boshqa sahifalar ularga bosh sahifaning
// sarlavhasi, tavsifi va canonical'i bilan ko'rinardi.
//
// Endi ro'yxat shu yerda: Worker (hosting/worker.js) SPA qobig'iga
// to'g'ri meta teglarni yozadi, src/lib/seo.js esa shu faylni qayta
// eksport qiladi — matnlar bitta joyda. Fayl `hosting/api/` ichida, chunki
// Worker `src/` dan import qila olmaydi (scripts/prepare-sites-build.mjs).

import { appPageTitle } from './app-store.js';

export const SITE_NAME = 'NFCSTORE.UZ';
export const SITE_ORIGIN = 'https://nfcstore.uz';

// Statik sahifalar uchun uz/ru/en sarlavha + tavsif. Kalit = App.jsx marshruti.
export const SEO_ROUTES = {
  home: {
    path: '/',
    uz: { title: 'Raqamli profil va NFC karta', description: "Telefon, ijtimoiy tarmoqlar, sayt va boshqa muhim ma'lumotlaringizni bitta raqamli profilda jamlang va NFC karta orqali ulashing." },
    ru: { title: 'Цифровой профиль и NFC-карта', description: 'Соберите телефон, соцсети, сайт и другие контакты в одном цифровом профиле и делитесь им через NFC-карту.' },
    en: { title: 'Digital profile and NFC card', description: 'Gather your phone, social links, website and key contacts in one digital profile and share it with an NFC card.' },
  },
  kompaniyalar: {
    path: '/kompaniyalar',
    uz: { title: 'Kompaniyalar', description: "NFCSTORE'dagi biznes profillar — menyu, mahsulotlar, xizmatlar va kontaktlar bitta NFC kartada." },
    ru: { title: 'Компании', description: 'Бизнес-профили на NFCSTORE — меню, товары, услуги и контакты на одной NFC-карте.' },
    en: { title: 'Companies', description: 'Business profiles on NFCSTORE — menu, products, services and contacts on a single NFC card.' },
  },
  narxlar: {
    path: '/narxlar',
    uz: { title: 'Narxlar', description: "NFC karta va raqamli profil narxlari. ID tanlang, band qiling va Payme orqali to'lang." },
    ru: { title: 'Цены', description: 'Цены на NFC-карту и цифровой профиль. Выберите ID, забронируйте и оплатите через Payme.' },
    en: { title: 'Pricing', description: 'NFC card and digital profile pricing. Pick an ID, reserve it and pay via Payme.' },
  },
  business: {
    path: '/business',
    uz: { title: 'Biznes kabinet', description: 'Kompaniyangiz uchun alohida kabinet: Company ID, kompaniya NFC profili, katalog va jamoa.' },
    ru: { title: 'Бизнес-кабинет', description: 'Отдельный кабинет для компании: Company ID, NFC-профиль компании, каталог и команда.' },
    en: { title: 'Business account', description: 'A separate workspace for your company: Company ID, company NFC profile, catalogue and team.' },
  },
  yangiliklar: {
    path: '/yangiliklar',
    uz: { title: 'Yangiliklar', description: "Ishga tushirish sanasi, yangi ID'lar, aksiyalar va platforma yangiliklari." },
    ru: { title: 'Новости', description: 'Дата запуска, новые ID, акции и новости платформы.' },
    en: { title: 'News', description: 'Launch date, new IDs, promos and platform news.' },
  },
  "sovg'alar": {
    path: '/gifts',
    uz: { title: "Sovg'alar", description: "NFC kartani sovg'a qiling — do'stlar, hamkorlar va jamoa uchun raqamli tashrif qog'ozi." },
    ru: { title: 'Подарки', description: 'Подарите NFC-карту — цифровая визитка для друзей, партнёров и команды.' },
    en: { title: 'Gifts', description: 'Gift an NFC card — a digital business card for friends, partners and your team.' },
  },
  katalog: {
    path: '/katalog',
    uz: { title: 'Katalog', description: "Band qilingan NFC ID'lar va ochiq profillar katalogi." },
    ru: { title: 'Каталог', description: 'Каталог занятых NFC ID и открытых профилей.' },
    en: { title: 'Catalog', description: 'Catalog of reserved NFC IDs and public profiles.' },
  },
  kirish: {
    path: '/login',
    uz: { title: 'Kirish', description: "NFCSTORE hisobingizga kiring va profilingizni boshqaring." },
    ru: { title: 'Вход', description: 'Войдите в аккаунт NFCSTORE и управляйте профилем.' },
    en: { title: 'Sign in', description: 'Sign in to your NFCSTORE account and manage your profile.' },
    noindex: true,
  },
  register: {
    path: '/register',
    uz: { title: "Ro'yxatdan o'tish", description: "NFCSTORE'da bepul hisob oching: raqamli profil, NFC ID va biznes sahifasi." },
    ru: { title: 'Регистрация', description: 'Создайте бесплатный аккаунт NFCSTORE: цифровой профиль, NFC ID и бизнес-страница.' },
    en: { title: 'Sign up', description: 'Create a free NFCSTORE account: digital profile, NFC ID and business page.' },
    noindex: true,
  },
  hisob: {
    path: '/account',
    uz: { title: 'Hisob', description: 'Shaxsiy kabinet — profil, kartalar va sozlamalar.' },
    ru: { title: 'Аккаунт', description: 'Личный кабинет — профиль, карты и настройки.' },
    en: { title: 'Account', description: 'Personal account — profile, cards and settings.' },
    noindex: true,
  },
  admin: {
    path: '/admin',
    uz: { title: 'Admin', description: 'Boshqaruv paneli.' },
    ru: { title: 'Админ', description: 'Панель управления.' },
    en: { title: 'Admin', description: 'Control panel.' },
    noindex: true,
  },
  savollar: {
    path: '/savollar',
    uz: { title: 'Savollar', description: "Profil, NFC karta, narx, kontakt saqlash va xavfsizlik bo'yicha ko'p so'raladigan savollar." },
    ru: { title: 'Вопросы', description: 'Частые вопросы о профиле, NFC-карте, ценах, сохранении контактов и безопасности.' },
    en: { title: 'FAQ', description: 'Frequently asked questions about profiles, NFC cards, pricing, saving contacts and security.' },
  },
  'qanday-ishlaydi': {
    path: '/qanday-ishlaydi',
    uz: { title: 'Qanday ishlaydi', description: 'NFC karta va raqamli profil qanday ishlaydi — 3 oddiy qadam.' },
    ru: { title: 'Как это работает', description: 'Как работают NFC-карта и цифровой профиль — 3 простых шага.' },
    en: { title: 'How it works', description: 'How the NFC card and digital profile work — 3 simple steps.' },
  },
  reyting: {
    path: '/reyting',
    uz: { title: 'Reyting', description: "Eng ko'p ko'rilgan va yoqtirilgan profillar reytingi." },
    ru: { title: 'Рейтинг', description: 'Рейтинг самых просматриваемых и популярных профилей.' },
    en: { title: 'Ranking', description: 'Ranking of the most viewed and liked profiles.' },
  },
  aloqa: {
    path: '/aloqa',
    uz: { title: 'Aloqa', description: "NFCSTORE bilan bog'lanish — qo'llab-quvvatlash va hamkorlik." },
    ru: { title: 'Контакты', description: 'Связаться с NFCSTORE — поддержка и сотрудничество.' },
    en: { title: 'Contact', description: 'Contact NFCSTORE — support and partnership.' },
  },
  support: {
    path: '/support',
    uz: { title: "Qo'llab-quvvatlash", description: "NFCSTORE ilovasi va sayti bo'yicha yordam: Telegram, telefon va ilova ichidagi murojaat." },
    ru: { title: 'Поддержка', description: 'Помощь по приложению и сайту NFCSTORE: Telegram, телефон и обращение в приложении.' },
    en: { title: 'Support', description: 'Help with the NFCSTORE app and website: Telegram, phone and the in-app support form.' },
  },
  'ilova-yuklash': {
    path: '/ilova-yuklash',
    uz: { title: appPageTitle('uz'), description: "NFCSTORE ilovasi: raqamli vizitka, istalgan NFC karta va stikerni bog'lash, shaxsiy va biznes profil, katalog, Reels, Ivory/Noir mavzulari. Android uchun yuklab oling." },
    ru: { title: appPageTitle('ru'), description: 'Приложение NFCSTORE: цифровая визитка, привязка любой NFC-карты и наклейки, личный и бизнес-профиль, каталог, Reels, темы Ivory/Noir. Скачайте для Android.' },
    en: { title: appPageTitle('en'), description: 'The NFCSTORE app: digital business card, link any NFC card or sticker, personal and business profiles, catalog, Reels, Ivory/Noir themes. Download for Android.' },
  },
  'nfc-stiker': {
    path: '/nfc-stiker',
    uz: { title: 'NFC stiker qanday ishlaydi', description: "Telefonni stikerga tekkizing — sahifa o'zi ochiladi. iPhone va Android ko'rsatmasi, stikerni profilga ulash, avto stiker va NFCSTORE ilovasi." },
    ru: { title: 'Как работает NFC-наклейка', description: 'Приложите телефон к наклейке — страница откроется сама. Инструкция для iPhone и Android, подключение наклейки, автонаклейка и приложение NFCSTORE.' },
    en: { title: 'How the NFC sticker works', description: 'Tap your phone on the sticker and the page opens. iPhone and Android guide, linking a sticker, the car sticker and the NFCSTORE app.' },
  },
  stikerlar: {
    path: '/stikerlar',
    uz: { title: 'NFC stikerlar — do‘kon, mashina va kafe uchun', description: "Eshik, vitrina yoki mashina oynasiga NFC stiker: telefon tekkizilsa narxlar, katalog, ish vaqti va Telegram ochiladi. Yopiq paytda ham savdo." },
    ru: { title: 'NFC-наклейки — для магазина, машины и кафе', description: 'NFC-наклейка на дверь, витрину или стекло машины: приложил телефон — открылись цены, каталог, часы работы и Telegram. Продажи даже когда закрыто.' },
    en: { title: 'NFC stickers — for shops, cars and cafés', description: 'An NFC sticker on the door, window or car glass: tap a phone and prices, catalog, hours and Telegram open. Sell even when you are closed.' },
  },
  // KO'RGAZMA (2026-10) — ilovadagi Ko'rgazma lentasining sayt ko'rinishi.
  // Worker ulashish rasmini lentaning birinchi rasmidan oladi
  // (hosting/worker.js, korgazmaShellResponse).
  korgazma: {
    path: '/korgazma',
    uz: { title: 'Ko‘rgazma', description: 'Do‘konlar va odamlarning eng chiroyli ishlari — rasm, narx va havola bilan. NFCSTORE ilovasidagi Ko‘rgazma lentasi.' },
    ru: { title: 'Витрина', description: 'Лучшие работы магазинов и людей — с фото, ценой и ссылкой. Лента «Витрина» из приложения NFCSTORE.' },
    en: { title: 'Showcase', description: 'The best work from shops and people — with photos, prices and links. The Showcase feed from the NFCSTORE app.' },
  },
  shartlar: {
    path: '/shartlar',
    uz: { title: 'Foydalanish shartlari', description: 'NFCSTORE.UZ ommaviy oferta va foydalanish shartlari.' },
    ru: { title: 'Условия использования', description: 'Публичная оферта и условия использования NFCSTORE.UZ.' },
    en: { title: 'Terms of use', description: 'NFCSTORE.UZ public offer and terms of use.' },
  },
  maxfiylik: {
    path: '/maxfiylik',
    uz: { title: 'Maxfiylik siyosati', description: "Shaxsiy ma'lumotlar qanday saqlanadi va himoyalanadi." },
    ru: { title: 'Политика конфиденциальности', description: 'Как хранятся и защищаются персональные данные.' },
    en: { title: 'Privacy policy', description: 'How personal data is stored and protected.' },
  },
  'delete-account': {
    path: '/delete-account',
    uz: { title: "Hisobni o'chirish", description: "NFCSTORE hisobini va unga bog'langan ma'lumotlarni o'chirish tartibi: nima o'chadi, nima va qancha muddat saqlanadi." },
    ru: { title: 'Удаление аккаунта', description: 'Как удалить аккаунт NFCSTORE и связанные данные: что удаляется, что и как долго хранится.' },
    en: { title: 'Delete account', description: 'How to delete your NFCSTORE account and its data: what is removed, what is kept and for how long.' },
  },
  kotarish: {
    path: '/kotarish',
    uz: { title: "Postni ko'tarish", description: "Postingizni NFCSTORE'da tavsiya etilganlar qatoriga chiqaring — ko'proq ko'rish va obunachilar." },
    ru: { title: 'Продвижение поста', description: 'Поднимите пост в рекомендованные на NFCSTORE — больше просмотров и подписчиков.' },
    en: { title: 'Promote a post', description: 'Boost your post into NFCSTORE recommendations for more views and followers.' },
    noindex: true,
  },
  activate: {
    path: '/activate',
    uz: { title: 'Mahsulotni faollashtirish', description: "NFCSTORE karta yoki stikeringizni faollashtiring va profilingizga bog'lang." },
    ru: { title: 'Активация продукта', description: 'Активируйте карту или наклейку NFCSTORE и привяжите её к своему профилю.' },
    en: { title: 'Activate your product', description: 'Activate your NFCSTORE card or sticker and link it to your profile.' },
    noindex: true,
  },
  'biznes-namuna': {
    path: '/biznes-namuna',
    uz: { title: 'Biznes sahifa namunasi', description: "NFCSTORE biznes sahifasi qanday ko'rinishini ko'ring: katalog, xizmatlar, aksiyalar, manzil va aloqa." },
    ru: { title: 'Пример бизнес-страницы', description: 'Посмотрите, как выглядит бизнес-страница NFCSTORE: каталог, услуги, акции, адрес и контакты.' },
    en: { title: 'Business page example', description: 'See what an NFCSTORE business page looks like: catalog, services, promos, address and contacts.' },
  },
  notfound: {
    path: '/',
    uz: { title: 'Sahifa topilmadi', description: "Bu manzilda sahifa yo'q. NFCSTORE bosh sahifasiga qayting." },
    ru: { title: 'Страница не найдена', description: 'По этому адресу страницы нет. Вернитесь на главную NFCSTORE.' },
    en: { title: 'Page not found', description: 'There is no page at this address. Go back to the NFCSTORE home page.' },
    noindex: true,
  },
};

// App.jsx marshruti (cleanRoute) → SEO_ROUTES kaliti.
const ROUTE_ALIASES = {
  '': 'home',
  gifts: "sovg'alar",
  login: 'kirish',
  account: 'hisob',
  sozlamalar: 'hisob',
  tolovlar: 'hisob',
  bildirishnomalar: 'hisob',
  xabarlar: 'hisob',
  contact: 'support',
  help: 'support',
  yordam: 'support',
  terms: 'shartlar',
  eula: 'shartlar',
  privacy: 'maxfiylik',
};

// Shaxsiy kabinet va ish sahifalari indekslanmaydi.
const PRIVATE_ROUTE_RE = /^(admin|account|sozlamalar|tolovlar|bildirishnomalar|xabarlar|workspace|business|company\/create|login|register|karta-dizayni)(\/|$)/;

// Marshrut uchun SEO ma'lumotini qaytaradi; noma'lum marshrut → home tavsifi,
// lekin canonical joriy yo'l bo'ladi.
export function seoForRoute(cleanRoute, lang = 'uz') {
  const route = String(cleanRoute || '');
  const base = route.split('/')[0];
  const key = ROUTE_ALIASES[base] ?? (Object.prototype.hasOwnProperty.call(SEO_ROUTES, base) ? base : null);
  const entry = key ? SEO_ROUTES[key] : null;
  const L = (entry && (entry[lang] || entry.uz)) || SEO_ROUTES.home[lang] || SEO_ROUTES.home.uz;
  return {
    title: L.title,
    description: L.description,
    path: '/' + route,
    lang,
    noindex: Boolean((entry && entry.noindex) || PRIVATE_ROUTE_RE.test(route)),
  };
}

// Sarlavha namunasi: "<Sahifa> — NFCSTORE.UZ". Nomning o'zida NFCSTORE
// bo'lsa (masalan "NFCSTORE" kompaniyasi) qo'shimcha takrorlanmaydi —
// aks holda "NFCSTORE — NFCSTORE" chiqardi.
export function fullPageTitle(title, suffix = SITE_NAME) {
  const t = String(title || '').trim();
  if (!t) return suffix;
  return /nfcstore/i.test(t) ? t : `${t} — ${suffix}`;
}

// ── SAYTNING QAYSI YO'LLARI MAVJUD (Worker 404 uchun) ────────────────
//
// SPA har qanday manzilga bir xil index.html qaytarardi va noma'lum
// manzil ham 200 bilan bosh sahifani ko'rsatardi ("soft 404"). Worker
// endi shu ro'yxat bo'yicha mavjud bo'lmagan yo'lga 404 qaytaradi (sahifa
// baribir ochiladi — React "Sahifa topilmadi" ko'rsatadi).
//
// src/App.jsx dagi STATIC_ROUTES va RESERVED bilan BIR XIL bo'lishi shart
// (scripts/test-spa-routes-seo.mjs tekshiradi).
export const SPA_PAGES = new Set([
  'login', 'register', 'account', 'narxlar', 'qanday-ishlaydi', 'yangiliklar', 'katalog',
  'savollar', 'aloqa', 'shartlar', 'maxfiylik', 'privacy', 'delete-account',
  'support', 'contact', 'help', 'yordam', 'terms', 'eula', 'auksion', 'auksion-qoidalari',
  'gifts', 'qollanma', 'admin', 'xabarlar', 'tolovlar', 'karta-dizayni', 'ilova-yuklash',
  'stikerlar', 'nfc-stiker', 'activate', 'biznes-namuna', 'kotarish', 'korgazma',
  'reyting', 'kompaniyalar', 'bildirishnomalar', 'sozlamalar', 'business', 'company', 'workspace', 'c',
]);

// Ko'p bo'lakli yo'llar: kompaniya, yangilik, NFC tegish, ilova havolalari
// (/post, /i, /u, /story, /nfc — ilova o'rnatilmagan bo'lsa saytda ochiladi).
const DYNAMIC_ROUTE_RES = [
  /^yangiliklar\/[^/]+$/,
  /^auksion\/.+$/,
  /^xabarlar\/[^/]+$/,
  /^(?:c|company|workspace)\/[^/]{1,80}$/,
  /^business\/[^/]+$/,
  /^t\/[A-Za-z0-9_-]{1,64}$/,
  /^(?:i|post|u|story|nfc)\/.+$/,
  /^[^/]+\/(?:menu|products|services|menyu|mahsulotlar|xizmatlar|aksiyalar)$/,
];

// Profil kodi shakli — src/App.jsx dagi parseAnyCode + ROUTE_PROFILE_RE
// bilan bir xil: AAA000, 8 xonali raqam yoki 3–12 harfli so'z.
export function looksLikeProfileCode(segment) {
  const seg = String(segment || '');
  const clean = seg.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return /^[0-9]{8}$/.test(clean)
    || /^[A-Z]{3}[0-9]{3}$/.test(clean)
    || /^(?:[A-Za-z]{3}[0-9]{3}|[0-9]{8}|[A-Za-z]{3,12})$/.test(seg);
}

// { kind: 'page', route } — statik sahifa (SEO ro'yxatidan meta);
// { kind: 'profile', code } — shaxsiy NFC ID shakli;
// { kind: 'dynamic' } — kompaniya, yangilik va h.k. (o'z ishlovchisi bor);
// { kind: 'unknown' } — saytda bunday sahifa yo'q (404).
export function classifySpaPath(pathname) {
  let p = String(pathname || '/');
  try { p = decodeURIComponent(p); } catch { /* buzuq %-ketma-ketlik: xom holicha */ }
  const route = p.replace(/^\/+|\/+$/g, '');
  if (!route) return { kind: 'page', route: '' };
  const lower = route.toLowerCase();
  if (!route.includes('/')) {
    if (SPA_PAGES.has(lower)) return { kind: 'page', route: lower };
    if (/^qr-\d{1,4}$/.test(lower)) return { kind: 'dynamic' };
    if (looksLikeProfileCode(route)) return { kind: 'profile', code: route.toUpperCase() };
    return { kind: 'unknown' };
  }
  if (lower === 'company/create') return { kind: 'page', route: lower };
  if (DYNAMIC_ROUTE_RES.some((re) => re.test(route))) return { kind: 'dynamic' };
  return { kind: 'unknown' };
}
