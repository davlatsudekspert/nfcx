// Lokalizatsiya — LanguageProvider `setTimeAgoLang(lang)` orqali joriy tilni
// shu modulga uzatadi. fmt/dateTime/timeAgo imzolari o'zgarmaydi (orqaga mos),
// lekin natija joriy tilga (uz-UZ / ru-RU / en-US) moslashadi.
let _lang = 'uz';
export function setTimeAgoLang(lang) { _lang = lang || 'uz'; }

const LOCALES = { uz: 'uz-UZ', ru: 'ru-RU', en: 'en-US' };
export function currentLocale() { return LOCALES[_lang] || LOCALES.uz; }

const TA = {
  uz: { now: 'hozirgina', min: (n) => `${n} daqiqa oldin`, hour: (n) => `${n} soat oldin`, day: (n) => `${n} kun oldin` },
  ru: { now: 'только что', min: (n) => `${n} мин. назад`, hour: (n) => `${n} ч. назад`, day: (n) => `${n} дн. назад` },
  en: { now: 'just now', min: (n) => `${n} min ago`, hour: (n) => `${n} h ago`, day: (n) => `${n} d ago` },
};

// Raqam: minglik ajratgich bo'sh joy (uz/ru), en'da vergul. NaN → 0.
export function fmt(n) {
  const v = Number(n || 0);
  const safe = Number.isFinite(v) ? v : 0;
  if (_lang === 'en') return safe.toLocaleString('en-US');
  // uz-UZ / ru-RU: ba'zi brauzerlarda o'zbek locale yo'q — ru-RU natijasi
  // (bo'sh joy ajratgich) uz uchun ham mos. Non-breaking space'larni oddiy
  // bo'sh joyga almashtiramiz (avvalgi xatti-harakat saqlanadi).
  return safe.toLocaleString('ru-RU').replace(/[  ,]/g, ' ');
}

// Vaqt MA'NOSINI o'qiydi, turini emas.
//
// Ilgari bu yerda to'g'ridan-to'g'ri `Date.now() - ts` bor edi, ya'ni
// `ts` ALBATTA son (epoch ms) bo'lishi kutilardi. Amalda esa bu
// qiymat turli joydan turli ko'rinishda keladi: bazadan ISO satr
// ("2026-09-19T17:05:13Z"), eski yozuvlardan sekundlar, ba'zan esa
// umuman kelmaydi.
//
// Son bo'lmagan qiymat ayirishda NaN beradi va odam ekranda
// "NaN kun oldin" degan yozuvni ko'radi. Bu profil sahifasida
// haqiqatan ko'rindi ("Faol bo'lgan: NaN kun oldin").
//
// Shuning uchun endi kiruvchi qiymat TUSHUNIB olinadi, tushunib
// bo'lmasa — chiziqcha qaytadi. Yo'q ma'lumotni yolg'on son bilan
// to'ldirgandan ko'ra, bo'shligini ochiq ko'rsatgan to'g'ri.
export function timeAgoMs(ts) {
  if (ts == null || ts === '') return null;
  if (ts instanceof Date) return Number.isNaN(ts.getTime()) ? null : ts.getTime();
  if (typeof ts === 'number') {
    if (!Number.isFinite(ts) || ts <= 0) return null;
    // SEKUND yoki MILLISEKUND? 10^11 dan kichik qiymat (1973-yilgacha)
    // millisekund bo'lishi amalda mumkin emas — demak u sekund.
    return ts < 1e11 ? ts * 1000 : ts;
  }
  const str = String(ts).trim();
  if (!str) return null;
  // Faqat raqamdan iborat satr — yuqoridagi qoidaga tushadi.
  if (/^\d+$/.test(str)) return timeAgoMs(Number(str));
  const parsed = Date.parse(str);
  return Number.isNaN(parsed) ? null : parsed;
}

export function timeAgo(ts) {
  const L = TA[_lang] || TA.uz;
  const ms = timeAgoMs(ts);
  if (ms == null) return '\u2014';
  // Kelajakdagi sana (soati noto'g'ri qo'yilgan qurilma yoki server
  // bilan farq) "-3 daqiqa oldin" bo'lib chiqmasin.
  const s = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (s < 60) return L.now;
  if (s < 3600) return L.min(Math.floor(s / 60));
  if (s < 86400) return L.hour(Math.floor(s / 3600));
  return L.day(Math.floor(s / 86400));
}

// Sana + vaqt. uz/ru: 05.09.2026 14:30, en: 09/05/2026 02:30 PM (Intl orqali).
export function dateTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '—';
  if (_lang === 'en') {
    try {
      return new Intl.DateTimeFormat('en-US', {
        year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
      }).format(d).replace(',', '');
    } catch { /* Intl yo'q bo'lsa pastdagi formatga tushadi */ }
  }
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function initials(name) {
  return (name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}
