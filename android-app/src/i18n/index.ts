/**
 * App language (UZ / RU / EN).
 *
 * The chosen locale is persisted with expo-secure-store (the one small
 * key/value store this app already depends on — see src/native/secureStore.ts)
 * so it survives an app restart, and is restored during bootstrap before the
 * first screen paints.
 */
import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { DICTIONARIES, uz, type LocaleCode, type StringKey } from './strings';

const LOCALE_KEY = 'nfcstore.locale';
const DEFAULT_LOCALE: LocaleCode = 'uz';

export const LOCALE_LABEL: Record<LocaleCode, string> = {
  uz: "O'zbekcha",
  ru: 'Русский',
  en: 'English',
};

interface LocaleState {
  locale: LocaleCode;
  ready: boolean;
  hydrate: () => Promise<void>;
  setLocale: (locale: LocaleCode) => Promise<void>;
}

export const useLocaleStore = create<LocaleState>((set) => ({
  locale: DEFAULT_LOCALE,
  ready: false,

  hydrate: async () => {
    try {
      const stored = await SecureStore.getItemAsync(LOCALE_KEY);
      if (stored && stored in DICTIONARIES) set({ locale: stored as LocaleCode, ready: true });
      else set({ ready: true });
    } catch {
      set({ ready: true });
    }
  },

  setLocale: async (locale) => {
    set({ locale });
    try {
      await SecureStore.setItemAsync(LOCALE_KEY, locale);
    } catch {
      /* persistence is best-effort; the in-memory switch already applied */
    }
  },
}));

/** Translate outside React (toasts, native handlers). Prefer `useT()` inside
 * components so a language switch re-renders them. */
export function translate(key: StringKey, locale?: LocaleCode): string {
  const active = locale ?? useLocaleStore.getState().locale;
  return DICTIONARIES[active]?.[key] ?? uz[key] ?? key;
}

/** Subscribes the component to the active locale, so switching language
 * re-renders every screen without an app restart. */
export function useT(): (key: StringKey) => string {
  const locale = useLocaleStore((s) => s.locale);
  return (key: StringKey) => DICTIONARIES[locale]?.[key] ?? uz[key] ?? key;
}

export function useLocale(): LocaleCode {
  return useLocaleStore((s) => s.locale);
}

export type { LocaleCode, StringKey };
