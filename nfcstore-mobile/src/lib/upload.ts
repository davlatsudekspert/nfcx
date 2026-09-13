import {
  FileSystemUploadType,
  uploadAsync,
} from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';

import { API_BASE, ApiError, getToken } from '@/api/client';

/**
 * Rasm tanlash va serverga yuklash.
 *
 * TRANSPORT: backend `multipart/form-data` EMAS, XOM OQIM kutadi —
 * fayl baytlari to'g'ridan-to'g'ri tananing o'zi, turi esa
 * `Content-Type` sarlavhasida (worker.js `streamUploadToR2`). Shuning
 * uchun `FormData` ishlatilmaydi: `expo-file-system` ning
 * `BINARY_CONTENT` rejimi aynan shu shaklda yuboradi va katta faylni
 * xotiraga to'liq yuklamaydi.
 *
 * Javob: `{ url: '/uploads/…' }` — NISBIY yo'l. U shundayligicha
 * saqlanadi (sayt ham shunday saqlaydi); ko'rsatishda `mediaUrl()`
 * to'liq manzilga aylantiradi.
 */

export type UploadKind = 'avatar' | 'media';

/** Endpoint tanlovi — server har biri uchun boshqa chegara qo'yadi. */
const ENDPOINT: Record<UploadKind, string> = {
  // Avatar, muqova, katalog rasmi — umumiy fayl yuklash.
  avatar: '/upload-file',
  // Post va istorya uchun: faqat rasm/video qabul qiladi.
  media: '/upload-media',
};

export type PickedImage = { uri: string; mimeType: string };

/**
 * Galereyadan bitta rasm tanlaydi. Ruxsat berilmasa `null` qaytaradi —
 * chaqiruvchi jim o'tib ketadi, chunki odam ataylab rad etgan bo'lishi
 * mumkin va unga xato oynasi ko'rsatish o'rinsiz.
 */
export async function pickImage(square = false): Promise<PickedImage | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;

  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: square ? [1, 1] : undefined,
    // 0.85 — ko'z bilan farqi sezilmaydi, lekin fayl ~3 barobar
    // kichik: sekin internetda yuklash vaqti shuncha qisqaradi.
    quality: 0.85,
  });
  if (res.canceled || !res.assets?.length) return null;

  const a = res.assets[0];
  return { uri: a.uri, mimeType: a.mimeType || 'image/jpeg' };
}

/**
 * Tanlangan faylni yuklaydi va server bergan NISBIY manzilni qaytaradi.
 */
export async function uploadImage(
  file: PickedImage,
  kind: UploadKind = 'avatar',
): Promise<string> {
  const token = await getToken();

  const res = await uploadAsync(API_BASE + ENDPOINT[kind], file.uri, {
    httpMethod: 'POST',
    uploadType: FileSystemUploadType.BINARY_CONTENT,
    headers: {
      'Content-Type': file.mimeType,
      Accept: 'application/json',
      'X-Client': 'mobile',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  }).catch(() => {
    throw new ApiError(0, 'network_error');
  });

  const data = safeJson(res.body) as { url?: string; error?: string; limitMb?: number } | null;

  if (res.status < 200 || res.status >= 300) {
    throw new ApiError(res.status, data?.error ?? `api_error_${res.status}`);
  }
  if (!data?.url) throw new ApiError(500, 'upload_failed');
  return data.url;
}

/** Tanlash + yuklash — bitta chaqiruvda. Bekor qilinsa `null`. */
export async function pickAndUpload(
  kind: UploadKind = 'avatar',
  square = false,
): Promise<string | null> {
  const file = await pickImage(square);
  if (!file) return null;
  return uploadImage(file, kind);
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Yuklash xatolarining o'zbekcha matni. */
export function uploadErrText(e: unknown): string {
  if (!(e instanceof ApiError)) return 'Rasmni yuklab bo’lmadi.';
  const map: Record<string, string> = {
    network_error: 'Aloqa yo’q. Internetni tekshiring.',
    unauthorized: 'Sessiya tugagan. Qaytadan kiring.',
    too_large: 'Fayl juda katta.',
    bad_file: 'Bu fayl turi qabul qilinmaydi.',
    r2_unavailable: 'Fayl saqlash vaqtincha ishlamayapti.',
    upload_failed: 'Yuklash amalga oshmadi.',
  };
  return map[e.code] ?? 'Rasmni yuklab bo’lmadi.';
}
