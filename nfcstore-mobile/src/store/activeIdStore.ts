import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

/**
 * Faol ID — profil ekrani KIM nomidan ko'rsatilayotgani.
 *
 * Switcher shu store'ni o'zgartiradi va butun ekran bir bosishda
 * to'g'ri ko'rinishga o'tadi: Business -> biznes UI, Personal -> shaxsiy
 * UI (spetsifikatsiya 2-bo'lim).
 *
 * `kind` javobdan KELMAYDI, balki manbaning o'zidan aniqlanadi:
 *   - `/api/companies/mine` dagi har bir yozuv -> business
 *   - `/api/auth/me` dagi `cards[]` -> personal (profileType 'business'
 *     bo'lgan eski kartalar ham shaxsiy karta maketida ko'rsatiladi,
 *     chunki ularda katalog/ish vaqti tushunchasi yo'q)
 */
export type ActiveId =
  | { kind: 'business'; companyId: string }
  | { kind: 'personal'; code: string };

const STORAGE_KEY = 'nfcstore.activeId';

type ActiveIdState = {
  active: ActiveId | null;
  ready: boolean;
  setActive: (next: ActiveId) => void;
  restore: () => Promise<void>;
  clear: () => void;
};

export const useActiveIdStore = create<ActiveIdState>((set) => ({
  active: null,
  ready: false,

  setActive: (next) => {
    set({ active: next });
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  },

  restore: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as ActiveId) : null;
      // Shaklni tekshiramiz: eski/buzilgan yozuv ekranni yiqitmasin.
      const valid =
        parsed &&
        ((parsed.kind === 'business' && typeof parsed.companyId === 'string') ||
          (parsed.kind === 'personal' && typeof parsed.code === 'string'));
      set({ active: valid ? parsed : null, ready: true });
    } catch {
      set({ active: null, ready: true });
    }
  },

  clear: () => {
    set({ active: null });
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  },
}));

export const activeIdEquals = (a: ActiveId | null, b: ActiveId | null): boolean => {
  if (!a || !b || a.kind !== b.kind) return false;
  if (a.kind === 'business' && b.kind === 'business') return a.companyId === b.companyId;
  if (a.kind === 'personal' && b.kind === 'personal') return a.code === b.code;
  return false;
};
