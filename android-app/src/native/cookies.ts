/**
 * Native cookie-jar wrapper — THE top technical risk of this app (see
 * android/docs/03-ARCHITECTURE.md §3.3). The backend (`hosting/worker.js`)
 * authenticates purely via an HttpOnly, SameSite=Lax, Secure cookie named
 * `nfc_session` (android/docs/02-API_MAP.md §2.1) — there is no bearer token
 * anywhere in the API. Android's networking layer must behave like a real
 * browser: persist Set-Cookie across app restarts and resend it on every
 * request to the same origin.
 *
 * `@react-native-cookies/cookies` is deprecated upstream (last checked: the
 * package emits an npm deprecation notice recommending
 * `@preeternal/react-native-cookie-manager` or `react-native-nitro-cookies`).
 * It was kept for this scaffold because it is still the most widely used and
 * documented option for exactly this use case, and its native implementation
 * is a thin wrapper over `android.webkit.CookieManager` (persistent by
 * default) — but this choice should be re-validated against its replacement
 * options before Phase 13 release, not silently carried forward forever.
 */
import CookieManager from '@react-native-cookies/cookies';

export const API_ORIGIN = 'https://nfcstore.uz';
const SESSION_COOKIE_NAME = 'nfc_session';

export async function getSessionCookieValue(): Promise<string | null> {
  try {
    const cookies = await CookieManager.get(API_ORIGIN);
    return cookies?.[SESSION_COOKIE_NAME]?.value ?? null;
  } catch {
    // CookieManager can throw on some OEM WebView builds — treat as
    // "no session" rather than crash the app; the next login attempt will
    // re-establish it.
    return null;
  }
}

export async function hasSessionCookie(): Promise<boolean> {
  return (await getSessionCookieValue()) != null;
}

export async function clearSessionCookie(): Promise<void> {
  try {
    await CookieManager.clearByName(API_ORIGIN, SESSION_COOKIE_NAME, true);
  } catch {
    // best-effort — logout still succeeds server-side via POST /api/auth/logout
  }
}

export async function clearAllCookies(): Promise<void> {
  try {
    await CookieManager.clearAll(true);
  } catch {
    /* best-effort */
  }
}
