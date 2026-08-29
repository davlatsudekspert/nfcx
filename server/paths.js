import path from 'path';
import { fileURLToPath } from 'url';

// Foydalanuvchi/admin yuklagan fayllar papkasi.
//
// Railway'da Volume ulanган bo'lsa — Railway avtomatik ravishda
// RAILWAY_VOLUME_MOUNT_PATH env'ini beradi (masalan "/data"). O'sha
// doimiy diskда saqlaymiz, shunda deploy yoki qayta ishga tushishда
// rasmlar yo'qolmaydi.
//
// Volume yo'q bo'lsa — kod yonidagi server/uploads (bu VAQTINCHALIK:
// har deploy'да tozalanadi).
const localDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'uploads');

export const UPLOAD_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH
  ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'uploads')
  : localDir;

export const UPLOADS_PERSISTENT = !!process.env.RAILWAY_VOLUME_MOUNT_PATH;
