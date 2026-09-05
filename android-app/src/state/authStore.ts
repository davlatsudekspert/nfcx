/**
 * Auth/session state — thin Zustand store fed by `GET /api/auth/me`
 * (see android/docs/03-ARCHITECTURE.md §3.4). `status: 'unknown'` is the
 * Splash-screen state; it resolves to 'authenticated' or 'guest' once the
 * bootstrap call returns.
 */
import { create } from 'zustand';
import type { NfcRecord, User } from '../api/types';
import { authApi } from '../api/auth';
import { setRememberedLoginState } from '../native/secureStore';

interface AuthState {
  status: 'unknown' | 'authenticated' | 'guest';
  user: User | null;
  cards: NfcRecord[];
  bootstrap: () => Promise<void>;
  refresh: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  status: 'unknown',
  user: null,
  cards: [],

  bootstrap: async () => {
    try {
      const { user, cards } = await authApi.me();
      set({ status: user ? 'authenticated' : 'guest', user, cards });
      await setRememberedLoginState(!!user);
    } catch {
      // Network failure on cold start: fall back to guest rather than
      // spinning forever — the user can retry from Login.
      set({ status: 'guest', user: null, cards: [] });
    }
  },

  refresh: async () => {
    const { user, cards } = await authApi.me();
    set({ status: user ? 'authenticated' : 'guest', user, cards });
    await setRememberedLoginState(!!user);
  },

  login: async (email, password) => {
    await authApi.login(email, password);
    const { user, cards } = await authApi.me();
    set({ status: 'authenticated', user, cards });
    await setRememberedLoginState(true);
  },

  logout: async () => {
    await authApi.logout().catch(() => {});
    set({ status: 'guest', user: null, cards: [] });
    await setRememberedLoginState(false);
  },
}));
