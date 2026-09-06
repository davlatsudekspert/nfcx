// Tez-tez ishlaydigan tozalash so'rovlari INDEKSDAN foydalanishini tekshiradi.
//   node scripts/test-hot-path-indexes.mjs
//
// NIMA UCHUN: `rate_limits` va `sessions` jadvallari vaqti-vaqti bilan
// (so'rovlarning ~1% va ~2% ida) eski yozuvlardan tozalanadi. Ikkala
// jadvalning ham kaliti boshqa ustunda, shuning uchun indekssiz bu
// DELETE butun jadvalni skanerlaydi. `rate_limits` HAR BIR profil
// ko'rilishida to'ldiriladi (view:KOD:tashrifchi), ya'ni trafik oshgani
// sari skanerlash qimmatlashadi — aynan reklama paytida.
import worker from '../hosting/worker.js';
import { makeEnv, seedBasic, req, makeChecker } from './lib/d1-harness.mjs';

const { env } = makeEnv();
await seedBasic(env);
const { check, checkTrue, done } = makeChecker();

// ensureCoreSchema bitta so'rovda ishga tushadi
await worker.fetch(req('/api/records'), env);

const plan = async (sql, bind) => {
  const r = await env.DB.prepare(`EXPLAIN QUERY PLAN ${sql}`).bind(bind).all();
  return (r.results || []).map((x) => x.detail).join(' | ');
};

// ═══ 1. Indekslar yaratilgan ═══
{
  const rows = await env.DB.prepare(
    `SELECT name FROM sqlite_master WHERE type='index' AND name IN ('rate_limits_window_idx','sessions_expires_idx')`
  ).all();
  const names = (rows.results || []).map((r) => r.name).sort();
  check('ikkala indeks ham yaratilgan', names, ['rate_limits_window_idx', 'sessions_expires_idx']);
}

// ═══ 2. Tozalash so'rovlari indeksdan foydalanadi (SCAN emas) ═══
{
  const rl = await plan('DELETE FROM rate_limits WHERE window_start < ?', 0);
  checkTrue('rate_limits tozalashi indeksdan foydalanadi', /USING (COVERING )?INDEX rate_limits_window_idx/.test(rl));
  check('rate_limits to\'liq skanerlanmaydi', /SCAN rate_limits(?! USING)/.test(rl), false);

  const se = await plan('DELETE FROM sessions WHERE expires_at < ?', '2020-01-01');
  checkTrue('sessions tozalashi indeksdan foydalanadi', /USING (COVERING )?INDEX sessions_expires_idx/.test(se));
  check('sessions to\'liq skanerlanmaydi', /SCAN sessions(?! USING)/.test(se), false);
}

// ═══ 3. Indeks kalit bo'yicha qidiruvni BUZMAGAN ═══
// rateLimitD1 har safar `WHERE key = ?` bilan o'qiydi — u PRIMARY KEY
// bo'yicha ishlashda davom etishi kerak.
{
  const byKey = await plan('SELECT hits FROM rate_limits WHERE key = ?', 'x');
  checkTrue('rate_limits kalit bo\'yicha qidiruv hamon PK/indeks orqali', /USING (PRIMARY KEY|INDEX)/.test(byKey));
  const byToken = await plan('SELECT user_id FROM sessions WHERE token = ?', 'x');
  checkTrue('sessions token bo\'yicha qidiruv hamon PK orqali', /USING (PRIMARY KEY|INDEX)/.test(byToken));
}

// ═══ 4. Profil ko'rish oqimi hamon ishlaydi ═══
{
  const r = await worker.fetch(req('/api/records/VIP001/view', { method: 'POST' }), env);
  const body = await r.json();
  check('profil ko\'rish 200 qaytaradi', r.status, 200);
  checkTrue('ko\'rishlar soni oshdi', Number(body.views) >= 1);
  // Ikkinchi marta — bir tashrifchi 6 soatda bir marta hisoblanadi.
  const r2 = await worker.fetch(req('/api/records/VIP001/view', { method: 'POST' }), env);
  const body2 = await r2.json();
  check('bir tashrifchi ikkinchi marta hisoblanmaydi', body2.views, body.views);
}

done();
