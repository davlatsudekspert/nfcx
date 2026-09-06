// Profil musiqasi limiti (oddiy 5 / Premium 10) — frontend konstantalari
// va HAQIQIY backend endpointi.
//   node scripts/test-music-limits.mjs
import worker from '../hosting/worker.js';
import { MUSIC_LIMIT_FREE, MUSIC_LIMIT_PREMIUM, musicLimit } from '../src/lib/musicLimits.js';
import { makeEnv, seedBasic, cookie, req, makeChecker } from './lib/d1-harness.mjs';

const { env } = makeEnv();
await seedBasic(env);
const { check, checkTrue, done } = makeChecker();
const j = async (pathname, init) => {
  const r = await worker.fetch(req(pathname, init), env);
  let body = null; try { body = await r.json(); } catch { body = null; }
  return { status: r.status, body };
};
const tracks = (n) => Array.from({ length: n }, (_, i) => `https://cdn.example.com/song${i + 1}.mp3`);

// ═══ 1. Frontend konstantalari ═══
{
  check('free limit = 5', MUSIC_LIMIT_FREE, 5);
  check('premium limit = 10', MUSIC_LIMIT_PREMIUM, 10);
  check('musicLimit(false) = 5 / musicLimit(true) = 10', [musicLimit(false), musicLimit(true)], [5, 10]);
}

// ═══ 2. Backend: ODDIY foydalanuvchi -> 5 ta ═══
{
  const r = await j('/api/records/VIP001', { method: 'PUT', cookie: cookie.user, json: { name: 'Muhammad', musicUrls: tracks(8) } });
  checkTrue('normal user save succeeds', r.status < 400);
  check('normal user is capped at 5 tracks by the BACKEND', r.body?.musicUrls?.length, 5);
  const row = await env.DB.prepare(`SELECT music_url FROM cards WHERE code = 'VIP001'`).first();
  check('only 5 tracks reached the database', JSON.parse(row.music_url).length, 5);
}

// ═══ 3. Backend: PREMIUM foydalanuvchi -> 10 ta ═══
{
  await env.DB.prepare(`UPDATE users SET is_premium = 1 WHERE id = 1`).run();
  const r = await j('/api/records/VIP001', { method: 'PUT', cookie: cookie.user, json: { name: 'Muhammad', musicUrls: tracks(14) } });
  checkTrue('premium user save succeeds', r.status < 400);
  check('premium user is capped at 10 tracks', r.body?.musicUrls?.length, 10);

  const exact = await j('/api/records/VIP001', { method: 'PUT', cookie: cookie.user, json: { name: 'Muhammad', musicUrls: tracks(10) } });
  check('exactly 10 tracks are kept for premium', exact.body?.musicUrls?.length, 10);
  await env.DB.prepare(`UPDATE users SET is_premium = 0 WHERE id = 1`).run();
}

// ═══ 4. Frontend va backend limiti BIR XIL ═══
{
  await env.DB.prepare(`UPDATE cards SET music_url = '[]' WHERE code = 'VIP001'`).run();
  for (const [premium, want] of [[false, MUSIC_LIMIT_FREE], [true, MUSIC_LIMIT_PREMIUM]]) {
    await env.DB.prepare(`UPDATE users SET is_premium = ? WHERE id = 1`).bind(premium ? 1 : 0).run();
    const r = await j('/api/records/VIP001', { method: 'PUT', cookie: cookie.user, json: { name: 'M', musicUrls: tracks(20) } });
    check(`backend cap matches frontend musicLimit(${premium}) = ${want}`, r.body?.musicUrls?.length, musicLimit(premium));
    check(`...and that value is ${want}`, r.body?.musicUrls?.length, want);
  }
  await env.DB.prepare(`UPDATE users SET is_premium = 0 WHERE id = 1`).run();
}

// ═══ 5. Aralash pleylist (audio + YouTube) saqlanadi ═══
{
  const mixed = ['https://cdn.example.com/a.mp3', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'https://cdn.example.com/b.ogg'];
  const r = await j('/api/records/VIP001', { method: 'PUT', cookie: cookie.user, json: { name: 'M', musicUrls: mixed } });
  check('a mixed audio + YouTube playlist is stored in order', r.body?.musicUrls, mixed);
}

// ═══ 6. Boshqa foydalanuvchi tegishli emas ═══
{
  const r = await j('/api/records/VIP001', { method: 'PUT', cookie: cookie.other, json: { name: 'X', musicUrls: tracks(3) } });
  check("another user cannot change someone else's tracks -> 403", [r.status, r.body?.error], [403, 'forbidden']);
}

done();
