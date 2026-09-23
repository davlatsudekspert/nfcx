// IZOH: PREMIUM YOKI 30 KUNLIK SINOV.
//
// Egasining qarori (2026-09-23): yangi ro'yxatdan o'tgan odam birinchi
// oy izoh yoza oladi, keyin — faqat Premium. Server yangi hisoblarga
// `users.trial_expires_at` ni allaqachon beradi; izoh uni hisobga
// olmasdi.
//
// Qo'riqlanadigan chegaralar:
//   * sinovsiz va Premium'siz — 403 premium_required (qoida o'z joyida);
//   * sinov muddati ketyapti — yoza oladi;
//   * sinov tugagan — yana 403;
//   * Premium — har doim yoza oladi;
//   * O'QISH hammaga ochiq.
//
//   node scripts/test-comment-trial.mjs

import worker from '../hosting/worker.js';
import { makeEnv, seedBasic, req, cookie, makeChecker } from './lib/d1-harness.mjs';

const { env } = makeEnv();
await seedBasic(env);
const { check, done } = makeChecker();

await env.DB.prepare(
  `INSERT INTO posts (id, code, user_id, caption, created_at)
   VALUES (10, 'OTH222', 2, 'post', '2026-01-01 00:00:00')`
).run();

const call = async (path, init = {}) => {
  const res = await worker.fetch(req(path, init), env);
  return { status: res.status, body: await res.json().catch(() => null) };
};
const asA = { cookie: cookie.user }; // user#1
const write = (body) =>
  call('/api/comments/post/10', { method: 'POST', ...asA, json: { body } });

// Birinchi so'rov sxemani (shu jumladan `trial_expires_at`) yaratadi.
let r = await write('sinovsiz');
check('1) sinovsiz, Premium\'siz -> 403 premium_required',
  [r.status, r.body?.error], [403, 'premium_required']);

const iso = (ms) => new Date(Date.now() + ms).toISOString();
await env.DB.prepare(`UPDATE users SET trial_expires_at = ? WHERE id = 1`)
  .bind(iso(10 * 86400000)).run();
r = await write('sinov ichida');
check('2) sinov muddati ketyapti -> 201', r.status, 201);

await env.DB.prepare(`UPDATE users SET trial_expires_at = ? WHERE id = 1`)
  .bind(iso(-86400000)).run();
r = await write('sinov tugagan');
check('3) sinov tugagan -> 403 premium_required',
  [r.status, r.body?.error], [403, 'premium_required']);

// D1 formatidagi sana ham to'g'ri o'qiladi ('YYYY-MM-DD HH:MM:SS').
const d1 = new Date(Date.now() + 5 * 86400000).toISOString()
  .replace('T', ' ').slice(0, 19);
await env.DB.prepare(`UPDATE users SET trial_expires_at = ? WHERE id = 1`)
  .bind(d1).run();
r = await write('D1 sana');
check('4) D1 formatidagi sinov sanasi -> 201', r.status, 201);

await env.DB.prepare(`UPDATE users SET trial_expires_at = NULL, is_premium = 1 WHERE id = 1`).run();
r = await write('premium');
check('5) Premium -> 201', r.status, 201);

r = await call('/api/comments/post/10');
check('6) o\'qish hammaga ochiq -> 200', r.status, 200);

done();
