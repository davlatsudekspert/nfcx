import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

// ═══════════════════════════════════════════════════════════════════════
// MAVZU (THEME) TIZIMI — FAQAT RANG
//
// Bu yerda hech qanday sahifa mantig'i yo'q: modul faqat tanlangan
// mavzu nomini saqlaydi va uni `<html data-theme="...">` ga qo'yadi.
// Ranglarning o'zi `src/themes.css` da.
//
// Tanlov `localStorage.nfc_theme` da turadi va TILDAN MUSTAQIL
// (`nfc_lang` alohida kalit).
//
// Sahifa ochilishida mavzu React'dan OLDIN `index.html` dagi kichik
// skript orqali qo'llanadi — shuning uchun rang chaqnashi (FOUC) yo'q.
// Bu yerdagi `useState` boshlang'ich qiymatni aynan o'sha skript
// qo'ygan `data-theme` dan oladi.
// ═══════════════════════════════════════════════════════════════════════

export const THEME_STORAGE_KEY = 'nfc_theme';

// STANDART MAVZU — NFCSTORE'ning ASL qora-oltin ko'rinishi.
//
// Saytga BIRINCHI marta kirgan odam aynan shu dizaynni ko'radi:
// brend shu ko'rinish bilan tanilgan, qolgan besh mavzu esa
// IXTIYORIY qo'shimcha tanlov. Saqlangan tanlov bo'lsa — u ustun
// (qarang: `readStored()` va `initialTheme()`).
//
// Bu qiymat `index.html` dagi FOUC skriptidagi zaxira qiymat bilan
// BIR XIL bo'lishi shart, aks holda sahifa ochilishida bir lahza
// boshqa rang chaqnab ketadi.
export const DEFAULT_THEME = 'legacy';

// Tanlanadigan mavzular — SELEKTORDAGI TARTIBI BILAN.
// `dots` — kichik rang namunasi (fon / yuza / accent),
// `bg` — brauzer manzil paneli rangi (`meta[name=theme-color]`).
export const THEMES = [
  {
    // Saytning asl ko'rinishi. Ichki nomi `legacy` bo'lib qoladi —
    // u `localStorage` da va CSS'da (`[data-theme="legacy"]`)
    // allaqachon shu nom bilan yozilgan.
    id: 'legacy',
    label: 'NFCSTORE Original',
    hint: 'Black & Gold',
    bg: '#050403',
    dots: ['#050403', '#141210', '#d4af5a'],
  },
  {
    id: 'pearl',
    label: 'Pearl',
    hint: 'Champagne',
    bg: '#f3eee3',
    dots: ['#f3eee3', '#fffdf8', '#c7a863'],
  },
  {
    id: 'graphite',
    label: 'Graphite',
    hint: 'Platinum',
    bg: '#17181a',
    dots: ['#17181a', '#2b2e32', '#cbcfd4'],
  },
  {
    id: 'ocean',
    label: 'Ocean',
    hint: 'Ice',
    bg: '#081923',
    dots: ['#081923', '#1a3f57', '#7ec4dc'],
  },
  {
    id: 'aurora',
    label: 'Aurora',
    hint: 'Violet',
    bg: '#181125',
    dots: ['#181125', '#33264b', '#b79ce2'],
  },
  {
    id: 'midnight',
    label: 'Midnight',
    hint: 'Soft Gold',
    bg: '#0d1524',
    dots: ['#0d1524', '#21314c', '#d6b478'],
  },
];

const BY_ID = new Map(THEMES.map((t) => [t.id, t]));

export function isTheme(id) {
  return BY_ID.has(id);
}

export function themeMeta(id) {
  return BY_ID.get(id) || BY_ID.get(DEFAULT_THEME);
}

function readStored() {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    if (v && BY_ID.has(v)) return v;
  } catch { /* xotira yopiq (private rejim) — jim o'tamiz */ }
  return null;
}

// `index.html` skripti allaqachon qo'ygan qiymat — shu birinchi
// manba, shunda React birinchi renderda ham AYNAN o'sha mavzuda
// chiqadi.
function initialTheme() {
  try {
    const attr = document.documentElement.getAttribute('data-theme');
    if (attr && BY_ID.has(attr)) return attr;
  } catch { /* SSR / test */ }
  return readStored() || DEFAULT_THEME;
}

export function applyTheme(id) {
  const meta = themeMeta(id);
  try {
    const root = document.documentElement;
    root.setAttribute('data-theme', meta.id);
    // daisyUI hujjat (canvas) fonini `--root-bg` orqali boshqaradi;
    // `index.html` esa boshlang'ich fonni inline beradi. Ikkalasi ham
    // mavzu bilan birga yangilanishi kerak.
    root.style.backgroundColor = meta.bg;
    const tc = document.querySelector('meta[name="theme-color"]');
    if (tc) tc.setAttribute('content', meta.bg);
  } catch { /* SSR / test */ }
}

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(initialTheme);

  useEffect(() => { applyTheme(theme); }, [theme]);

  // Boshqa tab/oynada mavzu almashtirilsa bu yerda ham yangilansin.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== THEME_STORAGE_KEY) return;
      const next = e.newValue;
      if (next && BY_ID.has(next)) setThemeState(next);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setTheme = useCallback((id) => {
    if (!BY_ID.has(id)) return;
    setThemeState(id);
    applyTheme(id);
    try { localStorage.setItem(THEME_STORAGE_KEY, id); } catch { /* jim */ }
  }, []);

  const value = useMemo(() => ({ theme, setTheme, themes: THEMES, meta: themeMeta(theme) }), [theme, setTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  // Provider'siz ishlatilsa ham hech narsa buzilmasin.
  if (!ctx) return { theme: DEFAULT_THEME, setTheme: () => {}, themes: THEMES, meta: themeMeta(DEFAULT_THEME) };
  return ctx;
}
