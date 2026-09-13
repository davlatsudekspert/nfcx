import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

const KEY = 'app_pin_code';

/**
 * PIN-kod bilan ilova qulfi — TO'LIQ mahalliy funksiya, backend bilan
 * hech qanday aloqasi yo'q (foydalanuvchi so'ragan "ilovaga kirish uchun
 * PIN kod" — bu qurilma darajasidagi qulf, hisob paroli emas).
 *
 * PIN qiymati `expo-secure-store`da saqlanadi (Keystore/Keychain bilan
 * shifrlangan) — xuddi sessiya tokeni saqlangani kabi (`api/client.ts`).
 *
 * `locked` — FAQAT joriy runtime holati (persist qilinmaydi): ilova
 * sovuq ishga tushganda yoki fonga o'tib qaytganda PIN o'rnatilgan
 * bo'lsa `true` bo'ladi; to'g'ri kod kiritilgach `false`ga tushadi.
 */
type PinLockState = {
  /** `undefined` = hali `restore()` tugamagan. */
  pin: string | null | undefined;
  locked: boolean;
  restore: () => Promise<void>;
  setPin: (pin: string) => Promise<void>;
  removePin: () => Promise<void>;
  verify: (pin: string) => boolean;
  /** Fonga o'tganda chaqiriladi (AppState) — PIN o'rnatilgan bo'lsagina qulflaydi. */
  lock: () => void;
  unlock: () => void;
};

export const usePinLockStore = create<PinLockState>((set, get) => ({
  pin: undefined,
  locked: false,

  restore: async () => {
    const pin = await SecureStore.getItemAsync(KEY);
    set({ pin, locked: !!pin });
  },

  setPin: async (pin) => {
    await SecureStore.setItemAsync(KEY, pin);
    set({ pin, locked: false });
  },

  removePin: async () => {
    await SecureStore.deleteItemAsync(KEY);
    set({ pin: null, locked: false });
  },

  verify: (pin) => !!get().pin && get().pin === pin,

  lock: () => {
    if (get().pin) set({ locked: true });
  },
  unlock: () => set({ locked: false }),
}));
