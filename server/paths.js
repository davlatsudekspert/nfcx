import path from 'path';
import { fileURLToPath } from 'url';

// Foydalanuvchi/admin yuklagan fayllar papkasi.
//
// Railway'da Volume ulangan bo'lsa — Railway avtomatik ravishda
// RAILWAY_VOLUME_MOUNT_PATH env'ini beradi (Volume'ning mount path'i,
// masalan "/app/server/uploads" yoki "/data"). O'sha papkaning O'ZINI
// yuklamalar papkasi sifatida ishlatamiz — shunda deploy yoki qayta
// ishga tushishda rasmlar yo'qolmaydi.
//
// Volume yo'q bo'lsa — kod yonidagi server/uploads (VAQTINCHALIK: har
// deploy'da tozalanadi). Bu ikkalasi bir xil ("/app/server/uploads")
// bo'lishi mumkin — muammo emas.
const localDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'uploads');

export const UPLOAD_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH || localDir;

export const UPLOADS_PERSISTENT = !!process.env.RAILWAY_VOLUME_MOUNT_PATH;
