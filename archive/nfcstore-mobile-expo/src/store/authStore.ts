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

  setSession: (me) => set({ user: me.user, cards: me.cards ?? [], hasToken: true }),

  clear: () => set({ user: null, cards: [], hasToken: false }),

  /** Ilova ochilganda: Keystore'da token bormi? */
  restore: async () => {
    const token = await getToken();
    set({ hasToken: !!token });
    if (!token) set({ user: null });
  },

  signOut: async () => {
    await apiLogout();
    await setToken(null);
    set({ user: null, cards: [], hasToken: false });
  },
}));
