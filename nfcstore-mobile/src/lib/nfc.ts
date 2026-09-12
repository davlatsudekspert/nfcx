import { Platform } from 'react-native';
import NfcManager, { Ndef, NfcTech, type TagEvent } from 'react-native-nfc-manager';

import { parseTagUrl, type TagTarget } from './tagUrl';

/**
 * NFC o'qish — ilovaning asosiy vazifasi.
 *
 * DIQQAT: bu NATIV modul. Expo Go da ISHLAMAYDI — development build
 * (EAS yoki mahalliy) kerak. README va eas.json ga qarang.
 */

let started = false;

/** Modulni bir marta ishga tushiradi. Qurilmada NFC yo'q bo'lsa `false`. */
export async function initNfc(): Promise<boolean> {
  if (started) return true;
  try {
    const supported = await NfcManager.isSupported();
    if (!supported) return false;
    await NfcManager.start();
    started = true;
    return true;
  } catch {
    return false;
  }
}

export async function isNfcEnabled(): Promise<boolean> {
  // `isEnabled` faqat Android'da mavjud (iOS da NFC tizim darajasida
  // boshqariladi va o'chirib qo'yilmaydi).
  if (Platform.OS !== 'android') return true;
  try {
    return await NfcManager.isEnabled();
  } catch {
    return false;
  }
}

/** Android'da NFC sozlamalari ekranini ochadi. */
export async function openNfcSettings(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await NfcManager.goToNfcSetting();
  } catch {
    // Sozlamalar ochilmasa — foydalanuvchi qo'lda ochadi, xato
    // ko'rsatishning ma'nosi yo'q.
  }
}

export type ScanResult =
  | { ok: true; target: TagTarget; raw: string | null }
  | { ok: false; reason: 'cancelled' | 'unsupported' | 'disabled' | 'read_failed' };

/**
 * Bitta tegni o'qiydi.
 *
 * NDEF ichidan URI yozuvi qidiriladi (haqiqiy kartalarda shunday).
 * URI topilmasa, matnli yozuv ham sinab ko'riladi — ba'zi sinov
 * teglarida kod oddiy matn sifatida yozilgan bo'ladi.
 */
export async function scanTag(): Promise<ScanResult> {
  const ready = await initNfc();
  if (!ready) return { ok: false, reason: 'unsupported' };
  if (!(await isNfcEnabled())) return { ok: false, reason: 'disabled' };

  try {
    await NfcManager.requestTechnology(NfcTech.Ndef, {
      // iOS da tizim oynasida chiqadigan matn.
      alertMessage: 'NFCSTORE kartani telefon orqasiga tekkizing',
    });
    const tag = await NfcManager.getTag();
    const raw = tag ? readNdefPayload(tag) : null;
    if (!raw) return { ok: false, reason: 'read_failed' };
    return { ok: true, target: parseTagUrl(raw), raw };
  } catch (err) {
    // Foydalanuvchi tizim oynasini yopsa ham shu yerga tushadi —
    // uni xato deb ko'rsatmaymiz.
    return { ok: false, reason: isCancel(err) ? 'cancelled' : 'read_failed' };
  } finally {
    // Bu MAJBURIY: sessiya yopilmasa keyingi o'qish ishlamaydi.
    NfcManager.cancelTechnologyRequest().catch(() => {});
  }
}

/** NDEF yozuvlaridan foydali matnni ajratadi (avval URI, keyin Text). */
function readNdefPayload(tag: TagEvent): string | null {
  const records = tag.ndefMessage ?? [];
  for (const record of records) {
    if (!record?.payload) continue;
    const bytes = Array.from(record.payload as ArrayLike<number>);
    try {
      const uri = Ndef.uri.decodePayload(bytes as never);
      if (uri) return uri;
    } catch {
      // URI yozuvi emas — quyida matn sifatida sinab ko'riladi.
    }
    try {
      const text = Ndef.text.decodePayload(bytes as never);
      if (text) return text;
    } catch {
      // Bu yozuv ham emas — keyingisiga o'tamiz.
    }
  }
  return null;
}

function isCancel(err: unknown): boolean {
  const msg = String((err as { message?: string })?.message ?? err ?? '').toLowerCase();
  return (
    msg.includes('cancel') ||
    msg.includes('user cancel') ||
    msg.includes('session invalidated')
  );
}
