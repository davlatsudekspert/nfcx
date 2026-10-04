// R2: rasm yuklash/berish va Android APK ni yuklab olish.
import { Hono } from 'hono';
import { NotFoundError, ValidationError } from './validate.js';

const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5 MB
const PHOTO_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const EXT_TYPES = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
const MEDIA_FOLDERS = new Set(['before', 'after']);
const MEDIA_FILE_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;

const APK_KEY = 'app/hasharchilar.apk';
const APK_VERSION_KEY = 'app/version.json';

// ---------- Rasm yuklash ----------

/** Fayl boshidagi "sehrli baytlar" bo'yicha haqiqiy rasm turini aniqlaydi. */
function sniffImageType(b) {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => b[i] === v)) return 'image/png';
  const ascii = (from, to) => String.fromCharCode(...b.subarray(from, to));
  if (b.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
  return null;
}

/**
 * Formadagi rasmni tekshiradi (MIME, hajm, mazmun). Fayl yo'q bo'lsa null.
 * Natija: { bytes, type, ext } — keyin storePhoto() ga beriladi.
 */
export async function readPhoto(file) {
  if (!file || typeof file === 'string' || file.size === 0) return null;
  if (!PHOTO_TYPES[file.type]) throw new ValidationError('Faqat JPG, PNG yoki WebP rasm yuklash mumkin');
  if (file.size > MAX_PHOTO_BYTES) throw new ValidationError('Rasm hajmi 5 MB dan oshmasligi kerak');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffImageType(bytes);
  if (!type) throw new ValidationError("Rasm fayli buzilgan yoki formati noto'g'ri");
  // Kengaytma foydalanuvchi bergan nomdan emas, tekshirilgan turdan olinadi
  return { bytes, type, ext: PHOTO_TYPES[type] };
}

/** Tekshirilgan rasmni R2 ga `<folder>/<uuid>.<ext>` kaliti bilan saqlaydi. */
export async function storePhoto(bucket, photo, folder) {
  const key = `${folder}/${crypto.randomUUID()}.${photo.ext}`;
  await bucket.put(key, photo.bytes, { httpMetadata: { contentType: photo.type } });
  return key;
}

/** readPhoto + storePhoto: fayl bo'lmasa null, aks holda R2 kaliti. */
export async function savePhoto(bucket, file, folder) {
  const photo = await readPhoto(file);
  return photo ? storePhoto(bucket, photo, folder) : null;
}

/** R2 dan rasmlarni o'chiradi (demo/ — statik fayllar, R2 da yo'q). Xato so'rovni buzmaydi. */
export async function deletePhotos(bucket, keys) {
  const real = keys.filter((k) => k && !k.startsWith('demo/'));
  if (!real.length) return;
  try {
    await bucket.delete(real);
  } catch (err) {
    console.error('R2 delete failed', err);
  }
}

/** R2 kalitidan mijoz uchun nisbiy URL. */
export const mediaUrl = (key) => `/api/media/${key}`;

// ---------- Marshrutlar ----------

export const mediaRoutes = new Hono();

// GET /api/media/:folder/:file — R2 dagi rasm (o'zgarmas, uzoq keshlanadi)
mediaRoutes.get('/media/:folder/:file', async (c) => {
  const { folder, file } = c.req.param();
  const match = MEDIA_FILE_RE.exec(file);
  if (!MEDIA_FOLDERS.has(folder) || !match) throw new NotFoundError('Rasm topilmadi');
  const obj = await c.env.PHOTOS.get(`${folder}/${file}`);
  if (!obj) throw new NotFoundError('Rasm topilmadi');
  return new Response(obj.body, {
    headers: {
      'content-type': EXT_TYPES[match[1]],
      'content-length': String(obj.size),
      etag: obj.httpEtag,
      'cache-control': 'public, max-age=31536000, immutable',
      'x-content-type-options': 'nosniff',
      'content-security-policy': "default-src 'none'; sandbox",
    },
  });
});

// GET /api/app — Android ilova mavjudligi va versiyasi
mediaRoutes.get('/app', async (c) => {
  const head = await c.env.PHOTOS.head(APK_KEY);
  let version = null;
  if (head) {
    version = head.customMetadata?.version || null;
    if (!version) {
      // Zaxira: app/version.json → { "version": "1.0.5" }
      const v = await c.env.PHOTOS.get(APK_VERSION_KEY);
      if (v) {
        try {
          version = String((await v.json())?.version || '') || null;
        } catch {
          version = null;
        }
      }
    }
  }
  c.header('cache-control', 'public, max-age=60');
  return c.json({ available: Boolean(head), version, size: head ? head.size : null, url: '/api/app/download' });
});

// GET /api/app/download — APK faylni oqim sifatida beradi
mediaRoutes.get('/app/download', async (c) => {
  const obj = await c.env.PHOTOS.get(APK_KEY);
  if (!obj) throw new NotFoundError('Ilova hali mavjud emas');
  return new Response(obj.body, {
    headers: {
      'content-type': 'application/vnd.android.package-archive',
      'content-disposition': 'attachment; filename="hasharchilar.apk"',
      'content-length': String(obj.size),
      etag: obj.httpEtag,
      'cache-control': 'public, max-age=300',
      'x-content-type-options': 'nosniff',
    },
  });
});
