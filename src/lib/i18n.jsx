import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { setTimeAgoLang } from './format.js';

// Sayt tillari: O'zbek (standart) / Rus / Ingliz. Tanlangan til
// brauzerda saqlanadi (localStorage) — sahifa yangilansa ham eslab qoladi.
// Tarjima lug'ati `src/lib/translations.js` da. Kalit (o'zbekcha manba matn)
// topilmasa, t() original o'zbekcha matnni qaytaradi — hech narsa buzilmaydi.
//
// LUG'AT ENDI KERAK BO'LGANDAGINA YUKLANADI (2026-09, tezlik).
// Sabab: lug'at fayllari birgalikda ~400 KB — bu asosiy to'plamning
// yarmidan ko'pi edi va HAR BIR tashrifchi uni yuklardi. Holbuki
// o'zbek tilida (standart til) t() lug'atga umuman murojaat qilmaydi:
// kalitning o'zi javob. Endi lug'at faqat rus/ingliz tiliga
// o'tilgandagina alohida bo'lak sifatida tortiladi.
//
// Yuklanguncha rus/ingliz foydalanuvchisi bir zumga o'zbekcha matnni
// ko'radi — bu ATAYLAB shunday: hech narsa "yuklanmoqda" holatida
// osilib qolmaydi va sahifa darhol o'qiladigan bo'ladi.

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

// Bir marta yuklangan lug'at — modul darajasida saqlanadi, shunda til
// ikki marta almashtirilsa qayta tortilmaydi.
let dictCache = null;
let dictPromise = null;
function loadDict() {
  if (dictCache) return Promise.resolve(dictCache);
  if (!dictPromise) {
    dictPromise = import('./translations.js')
      .then((m) => { dictCache = m.DICT; return dictCache; })
      .catch(() => {
        // Tarmoq uzilsa — keyingi urinish qaytadan bo'lsin.
        dictPromise = null;
        return null;
      });
  }
  return dictPromise;
}

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    try { return localStorage.getItem('nfc_lang') || 'uz'; } catch { return 'uz'; }
  });
  const [dict, setDict] = useState(dictCache);

  // format.js dagi timeAgo/fmt/dateTime ham joriy tilda ishlashi uchun.
  // <html lang> ham tilga mos bo'lsin (SEO, ekran o'quvchilar, tanlov).
  useEffect(() => {
    setTimeAgoLang(lang);
    try { document.documentElement.lang = lang; } catch { /* SSR / test */ }
  }, [lang]);
  // birinchi renderdan oldin ham to'g'ri bo'lsin
  setTimeAgoLang(lang);

  // Lug'at faqat o'zbekchadan boshqa til tanlanganda yuklanadi.
  useEffect(() => {
    if (lang === 'uz' || dict) return undefined;
    let cancelled = false;
    loadDict().then((d) => { if (!cancelled && d) setDict(d); });
    return () => { cancelled = true; };
  }, [lang, dict]);

  const setLang = useCallback((code) => {
    setLangState(code);
    try { localStorage.setItem('nfc_lang', code); } catch { /* jim tur */ }
    // Tanlash bilan darhol boshlanadi — yuqoridagi effektni kutmaydi.
    if (code !== 'uz') loadDict().then((d) => { if (d) setDict(d); });
  }, []);

  const t = useCallback((text, vars) => {
    if (text == null) return text;
    if (lang === 'uz') return interpolate(text, vars);
    // Lug'at hali kelmagan bo'lsa — o'zbekcha kalit qaytadi (bo'sh
    // ekran yoki "..." emas). Kelgach React qayta render qiladi.
    const entry = dict ? dict[text] : null;
    if (dict && !entry) warnMissing(text);
    const translated = (entry && entry[lang]) || text;
    return interpolate(translated, vars);
  }, [lang, dict]);

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
