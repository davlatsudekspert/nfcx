// SEO — sahifa sarlavhasi, meta description, canonical, OpenGraph/Twitter
// teglarini SPA ichida yangilaydi. Teg bo'lmasa yaratadi. Sarlavha namunasi:
// "<Sahifa> — NFCSTORE.UZ". App.jsx dagi useEffect([route, lang]) chaqiradi.

export const SITE_NAME = 'NFCSTORE.UZ';
export const SITE_ORIGIN = 'https://nfcstore.uz';
// Ulashish rasmi — 1200x630 keng banner (index.html izohiga qarang).
// Profil sahifalarida u foydalanuvchining avatariga almashadi.
export const DEFAULT_IMAGE = `${SITE_ORIGIN}/og-cover.png`;

function ensureMeta(attr, key) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  return el;
}
function setMeta(attr, key, value) {
  if (value == null || value === '') return;
  ensureMeta(attr, key).setAttribute('content', String(value));
}
function ensureLink(rel) {
  let el = document.head.querySelector(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  return el;
}

function normalizePath(path) {
  const p = String(path || '/').trim();
  const withSlash = p.startsWith('/') ? p : '/' + p;
  // trailing slash faqat bosh sahifada
  return withSlash.length > 1 ? withSlash.replace(/\/+$/, '') : '/';
}

export function applySeo({ title, description, path = '/', lang = 'uz', image, noindex = false } = {}) {
  if (typeof document === 'undefined') return;
  const fullTitle = title ? `${title} — ${SITE_NAME}` : SITE_NAME;
  const url = SITE_ORIGIN + normalizePath(path);
  const img = image || DEFAULT_IMAGE;

  document.title = fullTitle;
  try { document.documentElement.lang = lang || 'uz'; } catch { /* jim */ }

  setMeta('name', 'description', description);
  ensureLink('canonical').setAttribute('href', url);

  setMeta('property', 'og:title', fullTitle);
  setMeta('property', 'og:description', description);
  setMeta('property', 'og:image', img);
  setMeta('property', 'og:url', url);
  setMeta('property', 'og:type', 'website');
  setMeta('property', 'og:site_name', SITE_NAME);
  setMeta('property', 'og:locale', ({ uz: 'uz_UZ', ru: 'ru_RU', en: 'en_US' })[lang] || 'uz_UZ');

  setMeta('name', 'twitter:card', 'summary_large_image');
  setMeta('name', 'twitter:title', fullTitle);
  setMeta('name', 'twitter:description', description);
  setMeta('name', 'twitter:image', img);

  setMeta('name', 'robots', noindex ? 'noindex,nofollow' : 'index,follow');
}

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
  auksion: {
    path: '/auksion',
    uz: { title: 'Auksion', description: "Noyob va premium NFC ID'lar uchun auksion. Taklif bering va o'zingizga yoqqan raqamni qo'lga kiriting." },
    ru: { title: 'Аукцион', description: 'Аукцион редких и премиальных NFC ID. Делайте ставки и получите желанный номер.' },
    en: { title: 'Auction', description: 'Auction for rare and premium NFC IDs. Place a bid and claim the number you want.' },
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
};

// App.jsx marshruti (cleanRoute) → SEO_ROUTES kaliti.
const ROUTE_ALIASES = {
  '': 'home',
  gifts: "sovg'alar",
  login: 'kirish',
  register: 'kirish',
  account: 'hisob',
  sozlamalar: 'hisob',
  tolovlar: 'hisob',
  bildirishnomalar: 'hisob',
  xabarlar: 'hisob',
};

// Marshrut uchun SEO ma'lumotini qaytaradi; noma'lum marshrut → home tavsifi,
// lekin canonical joriy yo'l bo'ladi.
export function seoForRoute(cleanRoute, lang = 'uz') {
  const route = String(cleanRoute || '');
  const base = route.split('/')[0];
  const key = ROUTE_ALIASES[base] ?? (SEO_ROUTES[base] ? base : null);
  const entry = key ? SEO_ROUTES[key] : null;
  const L = (entry && (entry[lang] || entry.uz)) || SEO_ROUTES.home[lang] || SEO_ROUTES.home.uz;
  // shaxsiy/ish sahifalari indekslanmaydi
  const privatePrefix = /^(admin|account|sozlamalar|tolovlar|bildirishnomalar|xabarlar|workspace|business|company\/create|login|register)(\/|$)/.test(route);
  return {
    title: L.title,
    description: L.description,
    path: '/' + route,
    lang,
    noindex: Boolean((entry && entry.noindex) || privatePrefix),
  };
}

// Ommaviy profil (karta) sahifasi uchun: sarlavha = karta nomi.
export function seoForProfile(record, lang = 'uz') {
  const r = record || {};
  const name = (r.name || r.title || r.companyName || r.code || '').toString().trim();
  const code = (r.code || r.id || '').toString();
  const tagline = (r.bio || r.tagline || r.description || '').toString().trim();
  const fallback = {
    uz: `${name || code} — raqamli profil va NFC karta`,
    ru: `${name || code} — цифровой профиль и NFC-карта`,
    en: `${name || code} — digital profile and NFC card`,
  };
  return {
    title: name || code || SITE_NAME,
    description: tagline || fallback[lang] || fallback.uz,
    path: '/' + (code ? String(code).toLowerCase() : ''),
    lang,
    image: r.avatarUrl || r.avatar || r.photo || r.logo || undefined,
    noindex: false,
  };
}
