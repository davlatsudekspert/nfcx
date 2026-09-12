import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { DEFAULT_THEME, isThemeKey, THEMES, type Theme, type ThemeKey } from './themes';

const STORAGE_KEY = 'nfcstore.theme';

type ThemeContextValue = {
  theme: Theme;
  themeKey: ThemeKey;
  setTheme: (key: ThemeKey) => void;
  /** Saqlangan tanlov o'qilgunicha `false` — ekran "sakrab" ochilmasin. */
  ready: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeKey, setThemeKey] = useState<ThemeKey>(DEFAULT_THEME);
  const [ready, setReady] = useState(false);

  // Tanlov QURILMADA saqlanadi (maketdagi localStorage o'rniga
  // AsyncStorage) va sessiyalar orasida qoladi — spetsifikatsiya 8-bo'lim.
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (alive && isThemeKey(stored)) setThemeKey(stored);
      })
      .catch(() => {
        // O'qish imkoni bo'lmasa standart tema bilan davom etamiz —
        // bu ilovani to'xtatadigan xato emas.
      })
      .finally(() => {
        if (alive) setReady(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const setTheme = (key: ThemeKey) => {
    // Ekran DARHOL o'zgaradi, diskka yozish esa orqada ketadi: odam
    // tugmani bosgach kutib turmasligi kerak.
    setThemeKey(key);
    AsyncStorage.setItem(STORAGE_KEY, key).catch(() => {});
  };

  return (
    <ThemeContext.Provider value={{ theme: THEMES[themeKey], themeKey, setTheme, ready }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme() ThemeProvider ichida chaqirilishi kerak');
  return ctx;
}
