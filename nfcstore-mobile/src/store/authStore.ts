import { create } from 'zustand';

import { getToken, logout as apiLogout, setToken } from '@/api/client';
import type { AuthMe } from '@/api/types';

type AuthState = {
  /** `undefined` = hali tekshirilmadi, `null` = kirmagan. */
  user: AuthMe['user'] | undefined | null;
  cards: AuthMe['cards'];
  hasToken: boolean;
  setSession: (me: AuthMe) => void;
  clear: () => void;
  restore: () => Promise<void>;
  signOut: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: undefined,
  cards: [],
  hasToken: false,

  /**
   * `/api/auth/me` javobini qabul qiladi.
   *
   * MUHIM: server tokeni eskirgan bo'lsa 401 EMAS, `{user: null}` bilan
   * 200 qaytaradi. Shu holda tokenni saqlab qolsak, ilova "kirgan"
   * hisoblanib bo'sh ekranlarni ko'rsatib turardi. Shuning uchun
   * `user === null` bo'lsa tokenni tashlaymiz va kirish darvozasi
   * ishga tushadi.
   */
  setSession: (me) => {
    if (!me.user) {
      setToken(null).catch(() => {});
      set({ user: null, cards: [], hasToken: false });
      return;
    }
    set({ user: me.user, cards: me.cards ?? [], hasToken: true });
  },

  clear: () => set({ user: null, cards: [], hasToken: false }),

  /**
   * Ilova ochilganda: Keystore'da token bormi?
   *
   * Token yo'q bo'lsa `user` DARHOL `null` ga o'tadi — shunda kirish
   * darvozasi kutib turmasdan ishga tushadi. Token bor bo'lsa `user`
   * `undefined` bo'lib qoladi va `/auth/me` javobi kutiladi.
   */
  restore: async () => {
    const token = await getToken();
    if (!token) {
      set({ hasToken: false, user: null, cards: [] });
      return;
    }
    set({ hasToken: true });
  },

  signOut: async () => {
    await apiLogout();
    await setToken(null);
    set({ user: null, cards: [], hasToken: false });
  },
}));
