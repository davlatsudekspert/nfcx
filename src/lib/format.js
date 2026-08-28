// timeAgo lokalizatsiyasi — LanguageProvider `setTimeAgoLang(lang)` orqali
// joriy tilni shu modulga uzatadi. `timeAgo(ts)` imzosi o'zgarmaydi (orqaga mos).
let _lang = 'uz';
export function setTimeAgoLang(lang) { _lang = lang || 'uz'; }

const TA = {
  uz: { now: 'hozirgina', min: (n) => `${n} daqiqa oldin`, hour: (n) => `${n} soat oldin`, day: (n) => `${n} kun oldin` },
  ru: { now: 'только что', min: (n) => `${n} мин. назад`, hour: (n) => `${n} ч. назад`, day: (n) => `${n} дн. назад` },
  en: { now: 'just now', min: (n) => `${n} min ago`, hour: (n) => `${n} h ago`, day: (n) => `${n} d ago` },
};

export function fmt(n) {
  return Number(n || 0).toLocaleString('ru-RU').replace(/,/g, ' ');
}

export function timeAgo(ts) {
  const L = TA[_lang] || TA.uz;
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return L.now;
  if (s < 3600) return L.min(Math.floor(s / 60));
  if (s < 86400) return L.hour(Math.floor(s / 3600));
  return L.day(Math.floor(s / 86400));
}

export function dateTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function initials(name) {
  return (name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}
