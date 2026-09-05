/**
 * NFC read wrapper (brief §19/§2 — real NFC, not a decorative icon).
 * Foreground-dispatch NDEF read of a physical NFCSTORE card's chip token,
 * validated against `GET /api/tap/:chipToken` (android/docs/02-API_MAP.md
 * §2.7). Built and unit-testable now; on-device verification against a real
 * NFC tag needs a physical Android device with NFC hardware — this sandbox
 * has neither an Android SDK nor NFC hardware, so that verification is
 * tracked as a Phase 11/12 device-test item, not claimed as done here.
 */
import NfcManager, { NfcTech, Ndef } from 'react-native-nfc-manager';

export type NfcReadResult =
  | { status: 'ok'; chipToken: string }
  | { status: 'unsupported' }
  | { status: 'cancelled' }
  | { status: 'error'; message: string };

let initialized = false;

async function ensureInit(): Promise<boolean> {
  if (initialized) return true;
  const supported = await NfcManager.isSupported();
  if (!supported) return false;
  await NfcManager.start();
  initialized = true;
  return true;
}

/** Reads one NDEF tag's first text/URI record as the chip token. */
export async function readNfcChipToken(): Promise<NfcReadResult> {
  const supported = await ensureInit();
  if (!supported) return { status: 'unsupported' };

  try {
    await NfcManager.requestTechnology(NfcTech.Ndef);
    const tag = await NfcManager.getTag();
    const records = tag?.ndefMessage ?? [];
    const first = records[0];
    if (!first) return { status: 'error', message: 'empty_tag' };
    const payload = Ndef.text.decodePayload(new Uint8Array(first.payload)) || Ndef.uri.decodePayload(new Uint8Array(first.payload));
    if (!payload) return { status: 'error', message: 'unreadable_payload' };
    return { status: 'ok', chipToken: payload };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/cancel/i.test(message)) return { status: 'cancelled' };
    return { status: 'error', message };
  } finally {
    NfcManager.cancelTechnologyRequest().catch(() => {});
  }
}

export async function stopNfc(): Promise<void> {
  if (!initialized) return;
  await NfcManager.cancelTechnologyRequest().catch(() => {});
}
