import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { DICT } from './translations.js';
import { setTimeAgoLang } from './format.js';

// Sayt tillari: O'zbek (standart) / Rus / Ingliz. Tanlangan til
// brauzerda saqlanadi (localStorage) — sahifa yangilansa ham eslab qoladi.
// Tarjima lug'ati `src/lib/translations.js` da. Kalit (o'zbekcha manba matn)
// topilmasa, t() original o'zbekcha matnni qaytaradi — hech narsa buzilmaydi.

export const LANGUAGES = [
  { code: 'uz', label: "O'zbek", flag: '\u{1F1FA}\u{1F1FF}' },
  { code: 'ru', label: 'Русский', flag: '\u{1F1F7}\u{1F1FA}' },
  { code: 'en', label: 'English', flag: '\u{1F1EC}\u{1F1E7}' },
];

const LanguageContext = createContext(null);

// Dev rejimida lug'atda yo'q kalit haqida bir marta ogohlantiradi
// (faqat harf bo'lgan matnlar — raqam/belgi kalitlar e'tiborga olinmaydi).
const _warned = new Set();
function warnMissing(text) {
  if (!import.meta.env.DEV) return;
  if (typeof text !== 'string' || !/\p{L}/u.test(text)) return;
  if (_warned.has(text)) return;
  _warned.add(text);
  console.warn(`[i18n] tarjima yo'q: "${text}"`);
}

// {n}, {name} kabi placeholder'larni almashtiradi.
function interpolate(str, vars) {
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    try { return localStorage.getItem('nfc_lang') || 'uz'; } catch { return 'uz'; }
  });

  // format.js dagi timeAgo/fmt/dateTime ham joriy tilda ishlashi uchun.
  // <html lang> ham tilga mos bo'lsin (SEO, ekran o'quvchilar, tanlov).
  useEffect(() => {
    setTimeAgoLang(lang);
    try { document.documentElement.lang = lang; } catch { /* SSR / test */ }
  }, [lang]);
  // birinchi renderdan oldin ham to'g'ri bo'lsin
  setTimeAgoLang(lang);

  const setLang = useCallback((code) => {
    setLangState(code);
    try { localStorage.setItem('nfc_lang', code); } catch { /* jim tur */ }
  }, []);

  const t = useCallback((text, vars) => {
    if (text == null) return text;
    if (lang === 'uz') return interpolate(text, vars);
    const entry = DICT[text];
    if (!entry) warnMissing(text);
    const translated = (entry && entry[lang]) || text;
    return interpolate(translated, vars);
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) return { lang: 'uz', setLang: () => {}, t: (x, v) => interpolate(x, v) };
  return ctx;
}
