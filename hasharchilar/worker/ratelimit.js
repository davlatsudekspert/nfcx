// D1 asosidagi oddiy limitlagich (fixed window).
import { RateLimitError } from './validate.js';

/** Mijoz IP manzili (Cloudflare beradi; lokal dev'da 'local'). */
export function clientIp(c) {
  return c.req.header('cf-connecting-ip') || 'local';
}

/**
 * `key` bo'yicha hisoblagichni bitta atomar UPSERT bilan oshiradi.
 * Oyna ichida `limit` dan oshsa — 429 (Retry-After bilan).
 */
export async function rateLimit(db, key, limit, windowSec, message) {
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - (now % windowSec);
  const row = await db
    .prepare(
      `INSERT INTO rate_limits (key, window_start, count) VALUES (?1, ?2, 1)
       ON CONFLICT(key) DO UPDATE SET
         count = CASE WHEN rate_limits.window_start = excluded.window_start
                      THEN rate_limits.count + 1 ELSE 1 END,
         window_start = excluded.window_start
       RETURNING count`,
    )
    .bind(key, windowStart)
    .first();

  // Vaqti-vaqti bilan eski yozuvlarni tozalash (~2% so'rovlarda)
  if (Math.random() < 0.02) {
    await db.prepare('DELETE FROM rate_limits WHERE window_start < ?1').bind(now - 86400).run();
  }

  if (row.count > limit) throw new RateLimitError(message, windowStart + windowSec - now);
}

/** Kirish/ro'yxat: IP bo'yicha 10 urinish / 15 daqiqa (umumiy hisob). */
export function limitAuth(c) {
  return rateLimit(
    c.env.DB,
    `auth:${clientIp(c)}`,
    10,
    15 * 60,
    "Juda ko'p urinish. 15 daqiqadan so'ng qayta urinib ko'ring",
  );
}

/** Hashar e'lon qilish: foydalanuvchi bo'yicha 10 ta / soat. */
export function limitCreate(c, userId) {
  return rateLimit(
    c.env.DB,
    `create:${userId}`,
    10,
    60 * 60,
    "Bir soatda ko'pi bilan 10 ta hashar e'lon qilish mumkin. Birozdan so'ng urinib ko'ring",
  );
}
