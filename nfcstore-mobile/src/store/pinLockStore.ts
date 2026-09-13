import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

const KEY = 'app_pin_code';
const BIOMETRIC_KEY = 'app_pin_biometric_enabled';

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
 *
 * Face ID / barmoq izi — QO'SHIMCHA, tezkor yo'l: `biometricEnabled`
 * yoqilgan bo'lsa, `PinLockScreen` avval qurilma biometriyasini
 * so'raydi; muvaffaqiyatsiz yoki bekor qilinsa PIN klaviaturasi
 * qoladi (PIN har doim zaxira sifatida ishlaydi — biometriya PINni
 * ALMASHTIRMAYDI, faqat uni kiritishning tezroq yo'li).
 */
type PinLockState = {
  /** `undefined` = hali `restore()` tugamagan. */
  pin: string | null | undefined;
  locked: boolean;
  /** Foydalanuvchi sozlamada yoqqan-yoqmagani (SecureStore'da saqlanadi). */
  biometricEnabled: boolean;
  /** Shu qurilmada haqiqatan ham Face ID/barmoq izi bormi va ro'yxatdan o'tganmi. */
  biometricAvailable: boolean;
  restore: () => Promise<void>;
  setPin: (pin: string) => Promise<void>;
  removePin: () => Promise<void>;
  verify: (pin: string) => boolean;
  setBiometricEnabled: (enabled: boolean) => Promise<void>;
  /** Qurilma biometriyasi bilan qulfni ochishga urinish. Muvaffaqiyat -> true. */
  tryBiometricUnlock: () => Promise<boolean>;
  /** Fonga o'tganda chaqiriladi (AppState) — PIN o'rnatilgan bo'lsagina qulflaydi. */
  lock: () => void;
  unlock: () => void;
};

export const usePinLockStore = create<PinLockState>((set, get) => ({
  pin: undefined,
  locked: false,
  biometricEnabled: false,
  biometricAvailable: false,

  restore: async () => {
    const [pin, biometricFlag, hasHardware, isEnrolled] = await Promise.all([
      SecureStore.getItemAsync(KEY),
      SecureStore.getItemAsync(BIOMETRIC_KEY),
      LocalAuthentication.hasHardwareAsync().catch(() => false),
      LocalAuthentication.isEnrolledAsync().catch(() => false),
    ]);
    set({
      pin,
      locked: !!pin,
      biometricEnabled: biometricFlag === '1',
      biometricAvailable: !!hasHardware && !!isEnrolled,
    });
  },

  setPin: async (pin) => {
    await SecureStore.setItemAsync(KEY, pin);
    set({ pin, locked: false });
  },

  removePin: async () => {
    await SecureStore.deleteItemAsync(KEY);
    await SecureStore.deleteItemAsync(BIOMETRIC_KEY);
    set({ pin: null, locked: false, biometricEnabled: false });
  },

  verify: (pin) => !!get().pin && get().pin === pin,

  setBiometricEnabled: async (enabled) => {
    if (enabled) await SecureStore.setItemAsync(BIOMETRIC_KEY, '1');
    else await SecureStore.deleteItemAsync(BIOMETRIC_KEY);
    set({ biometricEnabled: enabled });
  },

  tryBiometricUnlock: async () => {
    const { pin, biometricEnabled, biometricAvailable } = get();
    if (!pin || !biometricEnabled || !biometricAvailable) return false;
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Ilova qulfini oching',
        cancelLabel: 'PIN kod',
        disableDeviceFallback: false,
      });
      if (result.success) {
        set({ locked: false });
        return true;
      }
    } catch {
      // Qurilma xatosi — jim ravishda PIN klaviaturasiga qaytamiz.
    }
    return false;
  },

  lock: () => {
    if (get().pin) set({ locked: true });
  },
  unlock: () => set({ locked: false }),
}));
