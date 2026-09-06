/**
 * Pure NDEF payload parsing — deliberately free of any native import so it
 * stays unit-testable without NFC hardware (src/__tests__/nfcPayload.test.ts).
 *
 * The formats below are the ones production actually uses, not invented ones:
 * a physical card's chip is written as `https://nfcstore.uz/<CODE>?t=<chip_token>`
 * (server/db.js:726, server/index.js:456, src/pages/ProfilePage.jsx:1004), the
 * share sheet and this app's own write flow use `https://nfcstore.uz/<CODE>`,
 * and `nfcstore://` is the app's deep-link scheme (src/navigation/linking.ts).
 */

/** Production origin — same value as src/native/cookies.ts / share.ts. */
export const NFC_PROFILE_ORIGIN = 'https://nfcstore.uz';

/** Path segments of `nfcstore.uz/*` that are app routes, not profile codes. */
const RESERVED_PATH_SEGMENTS = new Set([
  'company', 'c', 'auksion', 'auction', 'login', 'register', 'account', 'api',
  'uploads', 'news', 'yangiliklar', 'aloqa', 'narxlar', 'qollanma', 'faq',
]);

/** Personal NFC ID / Company ID shape (3–16 alphanumerics, upper-cased). */
export const NFC_CODE_RE = /^[A-Z0-9]{3,16}$/;

export interface NfcTagPayload {
  /** The decoded record text exactly as it was stored on the tag. */
  raw: string;
  /** Profile code parsed out of an `nfcstore.uz/<CODE>` URL, when present. */
  code: string | null;
  /** Physical-card chip token (`?t=` param, or a bare-token legacy tag). */
  chipToken: string | null;
}

export function parseNfcPayload(raw: unknown): NfcTagPayload {
  const text = typeof raw === 'string' ? raw.trim() : '';
  if (!text) return { raw: '', code: null, chipToken: null };

  const httpMatch = text.match(/^(?:https?:\/\/)?(?:www\.)?nfcstore\.uz\/([^/?#]+)(?:\/[^?#]*)?(?:\?([^#]*))?/i);
  const schemeMatch = text.match(/^nfcstore:\/\/(?:profile\/)?([^/?#]+)(?:\?([^#]*))?/i);
  const match = httpMatch ?? schemeMatch;

  if (match) {
    const segment = safeDecode(match[1]).toUpperCase();
    const code = NFC_CODE_RE.test(segment) && !RESERVED_PATH_SEGMENTS.has(segment.toLowerCase()) ? segment : null;
    return { raw: text, code, chipToken: readQueryParam(match[2], 't') };
  }

  // Legacy tags store the bare chip token with no URL around it.
  if (/^[A-Za-z0-9_-]{6,128}$/.test(text)) return { raw: text, code: null, chipToken: text };
  return { raw: text, code: null, chipToken: null };
}

function readQueryParam(query: string | undefined, key: string): string | null {
  if (!query) return null;
  for (const pair of query.split('&')) {
    const eq = pair.indexOf('=');
    const name = eq === -1 ? pair : pair.slice(0, eq);
    if (name === key) {
      const value = eq === -1 ? '' : safeDecode(pair.slice(eq + 1));
      return value || null;
    }
  }
  return null;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
