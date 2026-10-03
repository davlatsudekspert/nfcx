// R2 ga rasm yuklash yordamchisi.
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

export class PhotoError extends Error {}

/**
 * Formadan kelgan faylni tekshirib R2 ga saqlaydi.
 * Fayl yo'q bo'lsa null qaytaradi. Kalit: `<folder>/<uuid>.<ext>`.
 * Kengaytma foydalanuvchi nomidan emas, tasdiqlangan MIME turidan olinadi.
 */
export async function savePhoto(bucket, file, folder) {
  if (!file || typeof file === 'string' || file.size === 0) return null;
  const ext = TYPES[file.type];
  if (!ext) throw new PhotoError('Faqat JPG, PNG yoki WebP rasm yuklash mumkin');
  if (file.size > MAX_BYTES) throw new PhotoError("Rasm hajmi 5 MB dan oshmasligi kerak");

  const key = `${folder}/${crypto.randomUUID()}.${ext}`;
  await bucket.put(key, file.stream(), { httpMetadata: { contentType: file.type } });
  return key;
}
