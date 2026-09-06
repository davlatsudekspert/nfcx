/**
 * Biometric app-lock preference.
 *
 * Scope, stated honestly: the toggle is enforced by the screens that read this
 * store — today the Settings screen, which hides account data behind a real
 * `expo-local-authentication` prompt while `enabled` is true. Locking the
 * whole app at cold start belongs in the bootstrap in App.tsx and is a
 * follow-up; nothing here pretends the lock is wider than it is.
 *
 * The preference is a boolean flag only — no credential, token or cookie is
 * ever stored (those live in the native cookie jar, see ./cookies.ts).
 */
import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

const APP_LOCK_KEY = 'nfcstore.appLock';

interface AppLockState {
  /** User preference: require a biometric prompt for protected screens. */
  enabled: boolean;
  /** True once the persisted value has been read (avoids a flash of "off"). */
  hydrated: boolean;
  /** Session-scoped: the user has already passed the prompt this session. */
  unlocked: boolean;
  hydrate: () => Promise<void>;
  setEnabled: (enabled: boolean) => Promise<void>;
  markUnlocked: () => void;
  relock: () => void;
}

export const useAppLockStore = create<AppLockState>((set) => ({
  enabled: false,
  hydrated: false,
  unlocked: false,

  hydrate: async () => {
    try {
      const stored = await SecureStore.getItemAsync(APP_LOCK_KEY);
      set({ enabled: stored === '1', hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },

  setEnabled: async (enabled) => {
    // Flipping the switch always happens *after* a successful prompt (or with
    // the lock off), so the current session counts as unlocked either way.
    set({ enabled, unlocked: true });
    try {
      if (enabled) await SecureStore.setItemAsync(APP_LOCK_KEY, '1');
      else await SecureStore.deleteItemAsync(APP_LOCK_KEY);
    } catch {
      /* persistence is best-effort; the in-memory switch already applied */
    }
  },

  markUnlocked: () => set({ unlocked: true }),
  relock: () => set({ unlocked: false }),
}));
