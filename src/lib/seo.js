// SEO — sahifa sarlavhasi, meta description, canonical, OpenGraph/Twitter
// teglarini SPA ichida yangilaydi. Teg bo'lmasa yaratadi. Sarlavha namunasi:
// "<Sahifa> — NFCSTORE.UZ". App.jsx dagi useEffect([route, lang]) chaqiradi.

// Sahifalar ro'yxati (SEO_ROUTES) va seoForRoute Worker bilan UMUMIY —
// hosting/api/seo-routes.js (robotlar uchun Worker ham shu matnni yozadi).
import { SITE_NAME, SITE_ORIGIN, fullPageTitle } from '../../hosting/api/seo-routes.js';

export { SITE_NAME, SITE_ORIGIN, SEO_ROUTES, seoForRoute, fullPageTitle } from '../../hosting/api/seo-routes.js';
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

// SERVER AYTGAN `robots`. Worker shaxsiy profil (/VIP001), namuna biznes
// va mavjud bo'lmagan sahifaga `noindex` yozadi. Ilgari brauzer birinchi
// renderdayoq uni `index,follow` ga almashtirib yuborardi — JavaScript
// ishlatadigan Google esa aynan shu holatni ko'rardi. Endi sahifa birinchi
// ochilgan manzil uchun server bergan `noindex` saqlanadi (sayt ichida
// boshqa sahifaga o'tilganda o'sha sahifaning o'z qiymati qo'yiladi).
const SERVER_ROBOTS = (() => {
  if (typeof document === 'undefined' || typeof location === 'undefined') return null;
  try {
    const content = document.head.querySelector('meta[name="robots"]')?.getAttribute('content') || '';
    return { path: normalizePath(location.pathname).toLowerCase(), content };
  } catch { return null; }
})();

function serverRobotsFor(path) {
  if (!SERVER_ROBOTS || !/noindex/i.test(SERVER_ROBOTS.content)) return null;
  return normalizePath(path).toLowerCase() === SERVER_ROBOTS.path ? SERVER_ROBOTS.content : null;
}

export function applySeo({ title, description, path = '/', lang = 'uz', image, noindex = false, robots, type = 'website', canonical = true } = {}) {
  if (typeof document === 'undefined') return;
  const fullTitle = fullPageTitle(title);
  const url = SITE_ORIGIN + normalizePath(path);
  const img = image || DEFAULT_IMAGE;

  document.title = fullTitle;
  try { document.documentElement.lang = lang || 'uz'; } catch { /* jim */ }

  setMeta('name', 'description', description);
  // Kompaniyaning o'z domenida canonical nfcstore.uz ga qaratilmaydi.
  if (canonical) ensureLink('canonical').setAttribute('href', url);
  else document.head.querySelector('link[rel="canonical"]')?.remove();

  setMeta('property', 'og:title', fullTitle);
  setMeta('property', 'og:description', description);
  setMeta('property', 'og:image', img);
  if (canonical) setMeta('property', 'og:url', url);
  setMeta('property', 'og:type', type);
  setMeta('property', 'og:site_name', SITE_NAME);
  setMeta('property', 'og:locale', ({ uz: 'uz_UZ', ru: 'ru_RU', en: 'en_US' })[lang] || 'uz_UZ');

  setMeta('name', 'twitter:card', 'summary_large_image');
  setMeta('name', 'twitter:title', fullTitle);
  setMeta('name', 'twitter:description', description);
  setMeta('name', 'twitter:image', img);

  setMeta('name', 'robots', serverRobotsFor(path) || robots || (noindex ? 'noindex,nofollow' : 'index,follow'));
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
    // Katta harf — Worker'ning canonical/og:url (`/VIP001`) bilan bir xil.
    path: '/' + (code ? String(code).toUpperCase() : ''),
    lang,
    image: r.avatarUrl || r.avatar || r.photo || r.logo || undefined,
    // Shaxsiy profil HECH QACHON indekslanmaydi (maxfiylik; Worker ham
    // `noindex, follow` yozadi — hosting/worker.js personalShellResponse).
    noindex: true,
    robots: 'noindex, follow',
  };
}

// Ochiq biznes sahifasi (/c/:id) — kompaniya yuklangandan keyin. Ilgari
// SeoSync bu sahifada bosh sahifa sarlavhasini yozib qo'yardi.
export function seoForCompany(company, lang = 'uz') {
  const c = company || {};
  const id = String(c.companyId || c.company_id || c.id || '').trim();
  const name = String(c.displayName || c.display_name || c.name || id).trim();
  const city = String(c.city || '').trim();
  const about = String(c.description || c.tagline || '').replace(/\s+/g, ' ').trim();
  const fallback = {
    uz: `${name}${city ? ` — ${city}` : ''}. Aloqa, manzil, katalog va ish vaqti NFCSTORE sahifasida.`,
    ru: `${name}${city ? ` — ${city}` : ''}. Контакты, адрес, каталог и часы работы на странице NFCSTORE.`,
    en: `${name}${city ? ` — ${city}` : ''}. Contacts, address, catalog and opening hours on NFCSTORE.`,
  };
  return {
    title: name || id || SITE_NAME,
    description: (about.length > 200 ? about.slice(0, 199).trimEnd() + '…' : about) || fallback[lang] || fallback.uz,
    path: '/c/' + encodeURIComponent(id),
    lang,
    image: c.coverUrl || c.cover_url || c.logoUrl || c.logo_url || undefined,
    // Namuna (demo) biznes — Worker kabi `noindex`.
    noindex: Boolean(c.demo),
  };
}
