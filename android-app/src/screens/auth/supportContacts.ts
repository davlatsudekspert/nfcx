/**
 * The business's real, published support channels.
 *
 * Source of truth: the production website's own contact page
 * (`src/pages/ContactPage.jsx` → `CHANNELS`). Nothing here is invented —
 * these are the same Telegram handle and phone number nfcstore.uz publishes
 * to the public.
 *
 * They matter to the auth flow specifically because the API has **no**
 * registration endpoint (see `src/config/remoteFlags.ts`), so "open an
 * account" has to hand a newcomer a channel that actually answers instead of
 * a form that is guaranteed to fail.
 */
import { Linking } from 'react-native';

export const SUPPORT_TELEGRAM_HANDLE = '@nfcstore_admin';
export const SUPPORT_TELEGRAM_URL = 'https://t.me/nfcstore_admin';
export const SUPPORT_PHONE_DISPLAY = '+998 50 090 82 77';
export const SUPPORT_PHONE_URL = 'tel:+998500908277';

/** `Linking.openURL` rejects when no installed app can handle the URI (no
 * Telegram, no dialer on a tablet). Swallowing it keeps a missing handler
 * from crashing the login screen with an unhandled rejection. */
function open(url: string) {
  Linking.openURL(url).catch(() => {});
}

export function openSupportTelegram() {
  open(SUPPORT_TELEGRAM_URL);
}

export function openSupportPhone() {
  open(SUPPORT_PHONE_URL);
}
