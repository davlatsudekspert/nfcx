// hosting/api/comments.js testi — haqiqiy worker.fetch + in-memory D1 (scripts/lib/d1-harness.mjs).
//   node scripts/test-comments.mjs
import worker from '../hosting/worker.js';
import { makeEnv, seedBasic, cookie, req, makeChecker } from './lib/d1-harness.mjs';

const { check, checkTrue, done } = makeChecker();
const { env } = makeEnv();
await seedBasic(env);

const call = async (pathname, init) => {
  const res = await worker.fetch(req(pathname, init), env);
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
};
const post = (kind, id, body, who = cookie.user) =>
  call(`/api/comments/${kind}/${id}`, { method: 'POST', json: { body }, cookie: who });
const list = (kind, id, who) => call(`/api/comments/${kind}/${id}`, who ? { cookie: who } : {});
const del = (id, who = cookie.user) => call(`/api/comments/${id}`, { method: 'DELETE', cookie: who });

const now = new Date().toISOString();
// user#1 ning VIP001 kartasidagi post, user#2 ning OTH222 dagi posti,
// va user#1 ning istoryasi — huquq tekshiruvlari uchun uchtasi ham kerak.
await env.DB.prepare(`INSERT INTO posts (id, code, user_id, caption, created_at) VALUES (1, 'VIP001', 1, 'birinchi', ?)`).bind(now).run();
await env.DB.prepare(`INSERT INTO posts (id, code, user_id, caption, created_at) VALUES (2, 'OTH222', 2, 'begona', ?)`).bind(now).run();
await env.DB.prepare(
  `INSERT INTO stories (id, owner_kind, owner_id, user_id, caption, created_at, expires_at)
   VALUES (1, 'card', 'VIP001', 1, 'istorya', ?, '2999-01-01T00:00:00.000Z')`
).bind(now).run();

// =========================== yozish ===========================
{
  const r = await post('post', 1, '  Salom, narxi qancha?  ');
  check('POST izoh -> 201', r.status, 201);
  check('izoh matni tozalangan', r.body.comment.body, 'Salom, narxi qancha?');
  check('muallif kodi asosiy kartadan', r.body.comment.code, 'VIP001');
  check('o‘zimniki bayrog‘i', r.body.comment.mine, true);
  check('jami hisob', r.body.total, 1);

  check('kirmagan odam -> 401', (await call('/api/comments/post/1', { method: 'POST', json: { body: 'anon' } })).status, 401);
  check('bo‘sh matn -> 422', (await post('post', 1, '   ')).status, 422);
  check('yo‘q post -> 404', (await post('post', 999, 'x')).status, 404);
  check('noma‘lum tur -> 422', (await post('bad_kind', 1, 'x')).status, 422);

  const long = await post('post', 1, 'a'.repeat(2000));
  check('uzun matn 1000 belgigacha qisqaradi', long.body.comment.body.length, 1000);

  check('istoryaga izoh -> 201', (await post('story', 1, 'chiroyli')).status, 201);
  check('yo‘q istorya -> 404', (await post('story', 77, 'x')).status, 404);
}

// =========================== ro'yxat ===========================
{
  const r = await list('post', 1, cookie.user);
  check('GET ro‘yxat -> 200', r.status, 200);
  check('izohlar soni', r.body.comments.length, 2);
  checkTrue('yangisi yuqorida', r.body.comments[0].body.startsWith('aaa'));
  check('total', r.body.total, 2);
  check('hasMore', r.body.hasMore, false);

  const anon = await list('post', 1);
  check('mehmon ham o‘qiy oladi', anon.status, 200);
  check('mehmon uchun mine=false', anon.body.comments.every((c) => c.mine === false), true);

  const other = await list('post', 1, cookie.other);
  check('begona odam uchun mine=false', other.body.comments.every((c) => c.mine === false), true);

  check('yo‘q kontent ro‘yxati -> 404', (await list('post', 999)).status, 404);
}

// =========================== sahifalash ===========================
{
  // Izohlar TO'G'RIDAN-TO'G'RI bazaga yoziladi: bu blok O'QISHNI
  // (sahifalash) tekshiradi, yozishni emas. API orqali yozilsa,
  // daqiqalik chegara (10 ta) ishga tushib, test o'z limitiga
  // urilardi — ya'ni sahifalash emas, chegara sinalardi.
  for (let i = 0; i < 25; i += 1) {
    await env.DB.prepare(
      `INSERT INTO content_comments (target_kind, target_id, user_id, author_code, body, created_at)
       VALUES ('story', 1, 1, 'VIP001', ?, ?)`
    ).bind(`izoh-${i}`, new Date(Date.now() - (25 - i) * 1000).toISOString()).run();
  }
  const p1 = await call('/api/comments/story/1?page=1&limit=20', { cookie: cookie.user });
  check('1-sahifa 20 ta', p1.body.comments.length, 20);
  check('1-sahifada davomi bor', p1.body.hasMore, true);
  const p2 = await call('/api/comments/story/1?page=2&limit=20', { cookie: cookie.user });
  check('2-sahifa qolgani', p2.body.comments.length, 6);
  check('2-sahifada davomi yo‘q', p2.body.hasMore, false);
}

// =========================== o'chirish ===========================
{
  // Begona odam (user#2) user#1 ning postiga izoh yozadi.
  const foreign = await post('post', 1, 'begona izoh', cookie.other);
  check('begona izoh yozildi', foreign.status, 201);
  const foreignId = foreign.body.comment.id;

  // Admin cookie'si FOYDALANUVCHI sessiyasi emas — izoh o'chirish
  // foydalanuvchi huquqi bilan tekshiriladi, shuning uchun 401.
  check('admin cookie‘si bilan -> 401', (await del(foreignId, cookie.admin)).status, 401);

  // KONTENT EGASI o'chira oladi: post user#1 niki.
  const byOwner = await del(foreignId, cookie.user);
  check('kontent egasi o‘chiradi -> 200', byOwner.status, 200);
  checkTrue('o‘chgach jami kamaydi', typeof byOwner.body.total === 'number');

  // MUALLIF o'z izohini o'chiradi: user#2 ning o'z postidagi izohi.
  const own = await post('post', 2, 'o‘z izohim', cookie.other);
  check('muallif o‘z izohini o‘chiradi', (await del(own.body.comment.id, cookie.other)).status, 200);

  // Begona odam boshqaning izohini boshqaning postida o'chira olmaydi.
  const mine = await post('post', 2, 'tegmang', cookie.other);
  check('begona odam o‘chira olmaydi -> 403', (await del(mine.body.comment.id, cookie.user)).status, 403);
  check('yo‘q izoh -> 404', (await del(99999, cookie.user)).status, 404);
  check('kirmagan odam o‘chira olmaydi -> 401', (await call('/api/comments/1', { method: 'DELETE' })).status, 401);
}

// =========================== lentadagi hisob ===========================
{
  const feed = await call('/api/feed', { cookie: cookie.user });
  check('lenta -> 200', feed.status, 200);
  const p1 = feed.body.feed.find((f) => f.kind === 'post' && f.id === 1);
  checkTrue('lentada izoh turi bor', p1.commentKind === 'post');
  checkTrue('lentada izoh soni bor', typeof p1.commentCount === 'number' && p1.commentCount >= 2);
  const s1 = feed.body.feed.find((f) => f.kind === 'story' && f.id === 1);
  checkTrue('istorya izohlari alohida sanaladi', s1.commentCount >= 26);
}

// =========================== chegara (rate limit) ===========================
{
  // YANGI FOYDALANUVCHI bilan: chegara har bir odam uchun alohida
  // sanaladi, yuqoridagi bloklar esa user#1 va user#2 ning
  // byudjetini allaqachon ishlatgan.
  await env.DB.prepare(`INSERT INTO users (id, email, password_hash) VALUES (9, 'spam@test.local', 'x')`).run();
  await env.DB.prepare(`INSERT INTO sessions (token, user_id, expires_at) VALUES ('spam-token', 9, '2999-01-01T00:00:00.000Z')`).run();
  const spam = 'nfc_session=spam-token';
  let last = 0;
  for (let i = 0; i < 11; i += 1) last = (await post('post', 1, `spam-${i}`, spam)).status;
  check('11-izoh daqiqada -> 429', last, 429);
  const after = await list('post', 1);
  check('chegaradan keyingisi saqlanmadi', after.body.comments.filter((c) => c.body.startsWith('spam-')).length, 10);
}

done();
