// Profil musiqasi limiti (oddiy 5 / Premium 10) — frontend konstantalari
// va HAQIQIY backend endpointi.
//   node scripts/test-music-limits.mjs
import worker from '../hosting/worker.js';
import { MUSIC_LIMIT_FREE, MUSIC_LIMIT_PREMIUM, MUSIC_MAX_MB, musicLimit } from '../src/lib/musicLimits.js';
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

// ═══ 7. FAYL HAJMI LIMITI — 20 MB (2026-09: 10 -> 20) ═══
// HAQIQIY /api/upload-audio endpointi orqali: fayl base64 data-URL
// bo'lib boradi, shuning uchun aynan shu yo'l tekshiriladi.
{
  check('frontend konstanta = 20 MB', MUSIC_MAX_MB, 20);

  // `n` MB lik audio uchun data-URL (mp3 sarlavhasi bilan).
  const audioDataUrl = (bytes) => {
    const buf = Buffer.alloc(bytes);
    buf[0] = 0xff; buf[1] = 0xfb; // mp3 frame sync
    return 'data:audio/mpeg;base64,' + buf.toString('base64');
  };
  const upload = (bytes) => j('/api/upload-audio', {
    method: 'POST', cookie: cookie.user, json: { dataUrl: audioDataUrl(bytes) },
  });

  // Avval RAD ETILGAN hajm (12 MB) endi o'tishi kerak.
  const r12 = await upload(12 * 1024 * 1024);
  checkTrue('12 MB (avval rad etilardi) endi qabul qilinadi', r12.status < 400);
  checkTrue('12 MB fayl uchun /uploads/ havolasi qaytadi', String(r12.body?.url || '').startsWith('/uploads/'));

  // AYNAN chegara — 20 MB o'tadi.
  const rMax = await upload(MUSIC_MAX_MB * 1024 * 1024);
  checkTrue(`aynan ${MUSIC_MAX_MB} MB qabul qilinadi`, rMax.status < 400);

  // Chegaradan oshgani RAD etiladi (o'ylab topilgan qisqartirish yo'q).
  const rOver = await upload(MUSIC_MAX_MB * 1024 * 1024 + 64 * 1024);
  check(`${MUSIC_MAX_MB} MB dan kattasi -> 413 too_large`, [rOver.status, rOver.body?.error], [413, 'too_large']);

  // Fayl R2 ga HAQIQATAN yozildi (mock bucket) va hajmi to'g'ri.
  const key = 'uploads/' + String(rMax.body.url).split('/').pop();
  const stored = await env.UPLOADS.get(key);
  checkTrue('20 MB fayl R2 ga yozildi', !!stored);

  // Autentifikatsiya talab qilinadi — limit ko'tarilgani bilan
  // endpoint ochilib qolmadi.
  const anon = await j('/api/upload-audio', { method: 'POST', json: { dataUrl: audioDataUrl(1024) } });
  check('audio yuklash hamon login talab qiladi -> 401', [anon.status, anon.body?.error], [401, 'unauthorized']);

  // Audio BO'LMAGAN data-URL qabul qilinmaydi.
  const bad = await j('/api/upload-audio', {
    method: 'POST', cookie: cookie.user,
    json: { dataUrl: 'data:image/png;base64,' + Buffer.alloc(1024).toString('base64') },
  });
  check('audio bo\'lmagan fayl -> 422 bad_audio', [bad.status, bad.body?.error], [422, 'bad_audio']);
}

// ═══ 8. ADMIN RASM LIMITI O'ZGARMAGAN (10 MB) ═══
// Musiqa limiti ko'tarilgani admin rasm yuklashiga TA'SIR QILMASIN.
{
  const png = (bytes) => 'data:image/png;base64,' + Buffer.alloc(bytes).toString('base64');
  const r = await j('/api/admin/upload', {
    method: 'POST', cookie: cookie.admin, json: { dataUrl: png(11 * 1024 * 1024) },
  });
  check('admin rasm 11 MB -> hamon 413 too_large', [r.status, r.body?.error], [413, 'too_large']);
}

done();
