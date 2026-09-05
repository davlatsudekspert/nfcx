/**
 * Biometric-ready architecture — brief §19: wired but unused in v1 (no
 * screen calls this yet). Uses `expo-local-authentication` — a first-party
 * Expo module and a better fit for this project's prebuild workflow than
 * the community `react-native-biometrics` originally named in
 * android/docs/03-ARCHITECTURE.md §3.6, which needs its own native
 * install step this module avoids.
 */
import * as LocalAuthentication from 'expo-local-authentication';

export async function isBiometricAvailable(): Promise<boolean> {
  const [hasHardware, isEnrolled] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
  ]);
  return hasHardware && isEnrolled;
}

export async function authenticateWithBiometrics(promptMessage = 'Tasdiqlash'): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({ promptMessage, cancelLabel: 'Bekor qilish' });
  return result.success;
}
