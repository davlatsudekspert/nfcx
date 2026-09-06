/**
 * NFC hardware wrapper (brief §19/§2 — real NFC, not a decorative icon).
 *
 * Two real flows live here:
 *   1. READ  — foreground-dispatch NDEF read of a physical NFCSTORE card.
 *              The tag encodes the production URL the web app itself writes,
 *              `https://nfcstore.uz/<CODE>?t=<chip_token>` (server/db.js:726,
 *              server/index.js:456 and src/pages/ProfilePage.jsx:1004 — the
 *              `?t=` param is the invisible chip token). The token is
 *              validated against `GET /api/tap/:chipToken`
 *              (android/docs/02-API_MAP.md §2.7).
 *   2. WRITE — writes a *public profile URL* (`https://nfcstore.uz/<CODE>`,
 *              the exact structure src/native/share.ts already shares) onto a
 *              blank/rewritable NDEF tag. It deliberately does NOT write a
 *              `?t=` chip token: chip tokens are server-issued rows in
 *              `physical_cards` and there is no endpoint to mint one from the
 *              app, so inventing a token client-side would be fake data.
 *
 * Every entry point is defensive: on a device (or emulator) without NFC
 * hardware the native module can be missing entirely, so each call is wrapped
 * — callers get an honest `unsupported`/`disabled` state, never a crash.
 * On-device verification against real NFC tags needs physical hardware, which
 * this sandbox does not have (android/docs/14-PHASE11-NATIVE-REPORT.md).
 */
import NfcManager, { NfcTech, Ndef, NdefStatus, type NdefRecord } from 'react-native-nfc-manager';

/** Production origin — same constant shape as src/native/cookies.ts / share.ts. */
export const NFC_PROFILE_ORIGIN = 'https://nfcstore.uz';

/** Path segments of `nfcstore.uz/*` that are app routes, not profile codes. */
const RESERVED_PATH_SEGMENTS = new Set([
  'company', 'c', 'auksion', 'auction', 'login', 'register', 'account', 'api',
  'uploads', 'news', 'yangiliklar', 'aloqa', 'narxlar', 'qollanma', 'faq',
]);

const CODE_RE = /^[A-Z0-9]{3,16}$/;

export type NfcHardwareState =
  /** NFC hardware present and switched on — scanning can start. */
  | 'ready'
  /** Hardware present but NFC is off in Android settings. */
  | 'disabled'
  /** No NFC hardware (most emulators, budget devices). */
  | 'unsupported'
  /** Availability not probed yet. */
  | 'unknown';

export interface NfcTagPayload {
  /** The decoded record text exactly as it was stored on the tag. */
  raw: string;
  /** Profile code parsed out of an `nfcstore.uz/<CODE>` URL, when present. */
  code: string | null;
  /** Physical-card chip token (`?t=` param, or a bare-token legacy tag). */
  chipToken: string | null;
}

export type NfcReadResult =
  | { status: 'ok'; payload: NfcTagPayload; chipToken: string | null }
  | { status: 'unsupported' }
  | { status: 'disabled' }
  /** A tag was read, but it carries nothing this app can act on. */
  | { status: 'tag_unsupported' }
  | { status: 'cancelled' }
  | { status: 'error'; message: string };

export type NfcWriteResult =
  | { status: 'ok'; url: string }
  | { status: 'unsupported' }
  | { status: 'disabled' }
  /** Tag is read-only, not NDEF-formatted, or too small for the URL. */
  | { status: 'tag_unsupported' }
  | { status: 'cancelled' }
  | { status: 'error'; message: string };

let initialized = false;

/** Starts the native NFC manager once. Returns false when the device has no
 * NFC hardware or the native module is unavailable (emulator). */
async function ensureInit(): Promise<boolean> {
  if (initialized) return true;
  try {
    const supported = await NfcManager.isSupported();
    if (!supported) return false;
    await NfcManager.start();
    initialized = true;
    return true;
  } catch {
    return false;
  }
}

/**
 * Real hardware probe — never guessed. `isSupported()` answers "does this
 * device have an NFC chip", `isEnabled()` answers "is it switched on right
 * now"; the UI needs both to tell "buy a different phone" apart from "flip
 * the toggle in settings".
 */
export async function getNfcHardwareState(): Promise<NfcHardwareState> {
  const supported = await ensureInit();
  if (!supported) return 'unsupported';
  try {
    return (await NfcManager.isEnabled()) ? 'ready' : 'disabled';
  } catch {
    return 'disabled';
  }
}

/** Opens Android's system NFC settings page. Returns false when the platform
 * refuses (or has no such screen), so the caller can say so honestly. */
export async function openNfcSettings(): Promise<boolean> {
  try {
    await NfcManager.goToNfcSetting();
    return true;
  } catch {
    return false;
  }
}

/**
 * Parses whatever a tag stored into the two things this app can act on: a
 * profile code and/or a physical-card chip token.
 *
 * Accepted shapes (all real formats used in production today):
 *   `https://nfcstore.uz/AAA100?t=<token>` — physical card written by admin
 *   `https://nfcstore.uz/AAA100`           — profile URL (share.ts / this app's write flow)
 *   `nfcstore://profile/AAA100`            — app deep link (src/navigation/linking.ts)
 *   `<token>`                              — legacy bare-token tag
 */
export function parseNfcPayload(raw: unknown): NfcTagPayload {
  const text = typeof raw === 'string' ? raw.trim() : '';
  if (!text) return { raw: '', code: null, chipToken: null };

  const httpMatch = text.match(/^(?:https?:\/\/)?(?:www\.)?nfcstore\.uz\/([^/?#]+)(?:\/[^?#]*)?(?:\?([^#]*))?/i);
  const schemeMatch = text.match(/^nfcstore:\/\/(?:profile\/)?([^/?#]+)(?:\?([^#]*))?/i);
  const match = httpMatch ?? schemeMatch;

  if (match) {
    const segment = safeDecode(match[1]).toUpperCase();
    const code = CODE_RE.test(segment) && !RESERVED_PATH_SEGMENTS.has(segment.toLowerCase()) ? segment : null;
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

/** Decodes one NDEF record by its actual record type rather than guessing —
 * decoding a URI record as text (and vice-versa) yields mojibake, not null. */
function decodeRecord(record: NdefRecord | undefined): string | null {
  if (!record?.payload) return null;
  const bytes = new Uint8Array(record.payload as number[]);
  try {
    if (Ndef.isType(record, Ndef.TNF_WELL_KNOWN, Ndef.RTD_URI)) return Ndef.uri.decodePayload(bytes) || null;
    if (Ndef.isType(record, Ndef.TNF_WELL_KNOWN, Ndef.RTD_TEXT)) return Ndef.text.decodePayload(bytes) || null;
    if (record.tnf === Ndef.TNF_ABSOLUTE_URI || record.tnf === Ndef.TNF_MIME_MEDIA) {
      return Ndef.util.bytesToString(record.payload) || null;
    }
  } catch {
    /* fall through to the permissive decode below */
  }
  try {
    return Ndef.text.decodePayload(bytes) || Ndef.uri.decodePayload(bytes) || null;
  } catch {
    return null;
  }
}

/**
 * Reads one NDEF tag and returns everything it encodes. Resolves — it never
 * throws — so the screen can map each state to its own UI.
 */
export async function readNfcTag(): Promise<NfcReadResult> {
  const state = await getNfcHardwareState();
  if (state === 'unsupported') return { status: 'unsupported' };
  if (state === 'disabled') return { status: 'disabled' };

  try {
    await NfcManager.requestTechnology(NfcTech.Ndef);
    const tag = await NfcManager.getTag();
    const records = tag?.ndefMessage ?? [];
    if (!records.length) return { status: 'tag_unsupported' };

    for (const record of records) {
      const decoded = decodeRecord(record);
      if (!decoded) continue;
      const payload = parseNfcPayload(decoded);
      if (payload.code || payload.chipToken) return { status: 'ok', payload, chipToken: payload.chipToken };
    }
    // A real tag was read, but nothing on it maps to an NFCSTORE profile or
    // card — an honest "unsupported tag", not an error.
    return { status: 'tag_unsupported' };
  } catch (error) {
    return classifyNfcError(error);
  } finally {
    NfcManager.cancelTechnologyRequest().catch(() => {});
  }
}

/**
 * Back-compatible read used by the original tap-check path: returns the chip
 * token alone. Kept so the `GET /api/tap/:chipToken` flow that already works
 * keeps working; new UI should prefer `readNfcTag()`.
 */
export async function readNfcChipToken(): Promise<
  { status: 'ok'; chipToken: string } | Exclude<NfcReadResult, { status: 'ok' }>
> {
  const result = await readNfcTag();
  if (result.status !== 'ok') return result;
  if (!result.chipToken) return { status: 'tag_unsupported' };
  return { status: 'ok', chipToken: result.chipToken };
}

/**
 * Writes `https://nfcstore.uz/<code>` to a blank or rewritable NDEF tag as a
 * single URI record — the same URL structure the share sheet and the web app
 * use, so a tag written here behaves exactly like a shared link when tapped.
 */
export async function writeProfileUrlToTag(code: string): Promise<NfcWriteResult> {
  const normalized = String(code || '').trim().toUpperCase();
  if (!CODE_RE.test(normalized)) return { status: 'tag_unsupported' };
  const url = `${NFC_PROFILE_ORIGIN}/${normalized}`;

  const state = await getNfcHardwareState();
  if (state === 'unsupported') return { status: 'unsupported' };
  if (state === 'disabled') return { status: 'disabled' };

  try {
    await NfcManager.requestTechnology(NfcTech.Ndef);

    const bytes = Ndef.encodeMessage([Ndef.uriRecord(url)]);
    if (!bytes) return { status: 'tag_unsupported' };

    // Read-only or unformatted tags must fail *before* the write attempt so
    // the user gets "this card can't be written", not a generic error.
    try {
      const ndefStatus = await NfcManager.ndefHandler.getNdefStatus();
      if (ndefStatus.status === NdefStatus.NotSupported || ndefStatus.status === NdefStatus.ReadOnly) {
        return { status: 'tag_unsupported' };
      }
      if (typeof ndefStatus.capacity === 'number' && ndefStatus.capacity > 0 && ndefStatus.capacity < bytes.length) {
        return { status: 'tag_unsupported' };
      }
    } catch {
      /* Some tags don't report status — attempt the write and let it speak. */
    }

    await NfcManager.ndefHandler.writeNdefMessage(bytes);
    return { status: 'ok', url };
  } catch (error) {
    const classified = classifyNfcError(error);
    if (classified.status === 'error' && /read.?only|not.*writ|format/i.test(classified.message)) {
      return { status: 'tag_unsupported' };
    }
    return classified;
  } finally {
    NfcManager.cancelTechnologyRequest().catch(() => {});
  }
}

function classifyNfcError(error: unknown): Extract<NfcReadResult, { status: 'cancelled' | 'error' }> {
  const message = error instanceof Error ? error.message : String(error);
  if (/cancel/i.test(message)) return { status: 'cancelled' };
  return { status: 'error', message };
}

/** Cancels any in-flight technology request (screen blur / unmount). */
export async function stopNfc(): Promise<void> {
  if (!initialized) return;
  await NfcManager.cancelTechnologyRequest().catch(() => {});
}
