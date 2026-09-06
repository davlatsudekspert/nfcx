/**
 * Biometric authentication (brief §19). Uses `expo-local-authentication` — a
 * first-party Expo module and a better fit for this project's prebuild
 * workflow than the community `react-native-biometrics` originally named in
 * android/docs/03-ARCHITECTURE.md §3.6, which needs its own native install
 * step this module avoids.
 *
 * Capability is always probed against the real device: the Settings screen
 * must be able to tell "this phone has no sensor" apart from "the sensor is
 * there but nothing is enrolled", and must never present a lock the hardware
 * cannot actually enforce.
 */
import * as LocalAuthentication from 'expo-local-authentication';

export type BiometricCapability =
  /** Sensor present and at least one biometric enrolled — usable now. */
  | 'available'
  /** Sensor present, but the user has not enrolled a fingerprint/face. */
  | 'not_enrolled'
  /** No biometric sensor on this device (or the native module is missing). */
  | 'unavailable';

export interface BiometricSupport {
  capability: BiometricCapability;
  /** Which sensors the device reports — drives the row's icon and copy. */
  hasFingerprint: boolean;
  hasFace: boolean;
  hasIris: boolean;
}

export async function getBiometricSupport(): Promise<BiometricSupport> {
  const none: BiometricSupport = {
    capability: 'unavailable',
    hasFingerprint: false,
    hasFace: false,
    hasIris: false,
  };
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) return none;

    const [isEnrolled, types] = await Promise.all([
      LocalAuthentication.isEnrolledAsync(),
      LocalAuthentication.supportedAuthenticationTypesAsync().catch(() => [] as LocalAuthentication.AuthenticationType[]),
    ]);

    return {
      capability: isEnrolled ? 'available' : 'not_enrolled',
      hasFingerprint: types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT),
      hasFace: types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION),
      hasIris: types.includes(LocalAuthentication.AuthenticationType.IRIS),
    };
  } catch {
    // Native module missing (bare emulator) — treat as "no biometrics",
    // never as an error the user has to deal with.
    return none;
  }
}

export async function isBiometricAvailable(): Promise<boolean> {
  return (await getBiometricSupport()).capability === 'available';
}

/**
 * Prompts for a biometric (or device-credential fallback) confirmation.
 * Resolves false on cancel/failure — it never throws, so no caller can leak a
 * raw platform error string into the UI.
 */
export async function authenticateWithBiometrics(promptMessage = 'Tasdiqlash'): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel: 'Bekor qilish',
      disableDeviceFallback: false,
    });
    return result.success;
  } catch {
    return false;
  }
}
