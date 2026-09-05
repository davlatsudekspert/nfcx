/**
 * Shared "pick a photo from the gallery, downscale/compress it, upload it"
 * flow — used by Profile Edit (avatar/background, Phase 9 follow-up) and
 * Company logo/cover (Phase 10). android/docs/02-API_MAP.md §2.8: the
 * Worker caps plain images at 700KB (3MB for gif) — a modern phone-camera
 * photo would otherwise silently 413, so this always downscales+JPEG-
 * encodes client-side first, exactly as the architecture doc specifies.
 */
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { uploadImage } from '../api/uploads';

export type PickAndUploadResult =
  | { status: 'ok'; url: string }
  | { status: 'cancelled' }
  | { status: 'permission_denied' }
  | { status: 'error'; message: string };

const MAX_DIMENSION = 1080;
const JPEG_QUALITY = 0.7;
// Single-pass resize+compress, not a guaranteed-under-700KB retry loop — a
// 1080px-wide JPEG at 0.7 quality comfortably fits the limit for ordinary
// photos in practice. If a real device test in Phase 12 finds an edge case
// that still exceeds it, add a compress-and-recheck loop here rather than
// just raising the quality/size blindly.

export async function pickAndUploadImage(): Promise<PickAndUploadResult> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (perm.status !== 'granted') return { status: 'permission_denied' };

  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 1,
  });
  if (picked.canceled || !picked.assets?.[0]) return { status: 'cancelled' };

  try {
    const manipulated = await ImageManipulator.manipulateAsync(
      picked.assets[0].uri,
      [{ resize: { width: MAX_DIMENSION } }],
      { compress: JPEG_QUALITY, format: ImageManipulator.SaveFormat.JPEG, base64: true },
    );
    if (!manipulated.base64) return { status: 'error', message: 'encode_failed' };
    const { url } = await uploadImage(`data:image/jpeg;base64,${manipulated.base64}`);
    return { status: 'ok', url };
  } catch (error) {
    return { status: 'error', message: error instanceof Error ? error.message : 'unknown_error' };
  }
}
