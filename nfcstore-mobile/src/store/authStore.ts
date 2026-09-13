import { create } from 'zustand';

import { getToken, logout as apiLogout, setToken } from '@/api/client';
import type { AuthMe } from '@/api/types';
import { useActiveIdStore } from './activeIdStore';

type AuthState = {
  /** `undefined` = hali tekshirilmadi, `null` = kirmagan. */
  user: AuthMe['user'] | undefined | null;
  cards: AuthMe['cards'];
  hasToken: boolean;
  /** `restore()` tugadimi — shundan oldin Entry/Auth'ga yo'naltirish shoshilinch xato. */
  restored: boolean;
  setSession: (me: AuthMe) => void;
  clear: () => void;
  restore: () => Promise<void>;
  signOut: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: undefined,
  cards: [],
  hasToken: false,
  restored: false,

  setSession: (me) => set({ user: me.user, cards: me.cards ?? [], hasToken: true }),

  clear: () => set({ user: null, cards: [], hasToken: false }),

  /** Ilova ochilganda: Keystore'da token bormi? */
  restore: async () => {
    const token = await getToken();
    set({ hasToken: !!token, restored: true });
    if (!token) set({ user: null });
  },

  signOut: async () => {
    await apiLogout();
    await setToken(null);
    // Faol identity ham tozalanadi — aks holda shu qurilmada boshqa
    // hisob bilan kirilganda eski tanlov (boshqa odamning ID'si)
    // bir lahza qolib ketishi mumkin edi.
    useActiveIdStore.getState().clear();
    set({ user: null, cards: [], hasToken: false });
  },
}));
