/**
 * Secure, Android-Keystore-backed storage for the *login-state flag only*
 * (never the raw session cookie/token — that lives exclusively in the
 * native cookie jar, see ./cookies.ts). This flag exists purely so Splash
 * can pick Login vs. Home before the first `/api/auth/me` round-trip
 * resolves — see android/docs/03-ARCHITECTURE.md §3.3.
 */
import * as SecureStore from 'expo-secure-store';

const LOGIN_STATE_KEY = 'nfcstore.loginState';

export async function setRememberedLoginState(loggedIn: boolean): Promise<void> {
  try {
    if (loggedIn) await SecureStore.setItemAsync(LOGIN_STATE_KEY, '1');
    else await SecureStore.deleteItemAsync(LOGIN_STATE_KEY);
  } catch {
    /* best-effort UX hint only — never load-bearing for real auth */
  }
}

export async function getRememberedLoginState(): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(LOGIN_STATE_KEY)) === '1';
  } catch {
    return false;
  }
}
