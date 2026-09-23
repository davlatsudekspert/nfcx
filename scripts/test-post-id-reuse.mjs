// POST RAQAMI QAYTA ISHLATILGANDA ESKI IZOH VA LAYK "YOPISHMAYDI".
//   node scripts/test-post-id-reuse.mjs
//
// `posts.id` — `INTEGER PRIMARY KEY` (AUTOINCREMENT emas): eng oxirgi
// post o'chirilsa, keyingi yangi post o'sha raqamni oladi. Ilgari
// o'chirilgan postning izoh va layklari yangi (boshqa odamning) postiga
// o'tib qolardi — egasi E2E test izohini o'z postida ko'rdi (2026-09).
//
// Haqiqiy worker.fetch + in-memory D1 (scripts/lib/d1-harness.mjs).
import worker from '../hosting/worker.js';
import { cardContentCleanupStmts } from '../hosting/api/card-cleanup.js';
import { makeEnv, seedBasic, cookie, req, makeChecker } from './lib/d1-harness.mjs';

const { check, checkTrue, done } = makeChecker();
const { env, sqlite } = makeEnv();
await seedBasic(env);
sqlite.prepare(`UPDATE users SET is_premium = 1`).run(); // izoh — Premium uchun

const call = async (pathname, init = {}) => {
  const res = await worker.fetch(req(pathname, init), env);
  return { status: res.status, body: await res.json().catch(() => null) };
};
const newPost = (id, code, userId) => sqlite.prepare(
  `INSERT INTO posts (id, code, user_id, image_url, caption, created_at) VALUES (?, ?, ?, '/uploads/p.jpg', 'post', datetime('now'))`,
).run(id, code, userId);
const liveComments = (id) => sqlite.prepare(
  `SELECT COUNT(*) AS n FROM content_comments WHERE target_kind = 'post' AND target_id = ? AND deleted_at IS NULL`).get(id).n;
const postLikes = (id) => sqlite.prepare(`SELECT COUNT(*) AS n FROM post_likes WHERE post_id = ?`).get(id).n;
const contentLikes = (id) => sqlite.prepare(
  `SELECT COUNT(*) AS n FROM content_likes WHERE target_kind = 'post' AND target_id = ?`).get(id).n;

// Postga izoh (user#2 yozadi), layk (user#2) va izohga layk qo'yamiz.
async function decorate(id) {
  const c = await call(`/api/comments/post/${id}`, { method: 'POST', cookie: cookie.other, json: { body: `izoh ${id}` } });
  check(`izoh yozildi (#${id})`, c.status, 201);
  check(`layk qo'yildi (#${id})`, (await call(`/api/posts/${id}/like`, { method: 'POST', cookie: cookie.other })).status, 200);
  check(`izoh-layk tizimidagi layk (#${id})`, (await call(`/api/content-likes/post/${id}`, { method: 'POST', cookie: cookie.other })).status, 200);
  return c.body?.comment?.id;
}

// ═══ 1. Egasi o'chiradi → keyingi post o'sha raqamni oladi ═══
{
  // 99 — boshqa, tirik post; 100 — eng oxirgisi (o'chiriladi).
  newPost(99, 'VIP001', 1);
  newPost(100, 'VIP001', 1);
  const cid = await decorate(100);
  check('1) egasi postni o‘chirdi', (await call('/api/posts/100', { method: 'DELETE', cookie: cookie.user })).status, 200);
  check('1) izoh ommadan olindi', liveComments(100), 0);
  check('1) layklar ketdi', [postLikes(100), contentLikes(100)], [0, 0]);
  const arch = sqlite.prepare(`SELECT reason FROM content_comment_archive WHERE comment_id = ?`).get(cid);
  check('1) izoh nusxasi arxivda', arch?.reason, 'target_deleted');

  // Boshqa odam yangi post joylaydi — SQLite o'sha raqamni beradi.
  sqlite.prepare(`INSERT INTO posts (code, user_id, image_url, caption, created_at) VALUES ('OTH222', 2, '/uploads/n.jpg', 'yangi', datetime('now'))`).run();
  const reused = sqlite.prepare(`SELECT id FROM posts WHERE code = 'OTH222' ORDER BY id DESC LIMIT 1`).get().id;
  check('1) raqam haqiqatan qayta ishlatildi (xato sharti)', reused, 100);
  const list = await call('/api/comments/post/100');
  check('1) yangi postda begona izoh YO‘Q', [list.status, list.body?.total, list.body?.comments?.length], [200, 0, 0]);
  check('1) yangi postda begona layk YO‘Q', postLikes(100), 0);
  sqlite.prepare(`DELETE FROM posts WHERE id = 100`).run();
}

// ═══ 2. Begona odam o'chira olmaydi — izohlar joyida qoladi ═══
{
  newPost(200, 'VIP001', 1);
  await decorate(200);
  check('2) begona o‘chira olmaydi', (await call('/api/posts/200', { method: 'DELETE', cookie: cookie.other })).status, 404);
  check('2) izoh va layk JOYIDA', [liveComments(200), postLikes(200)], [1, 1]);
}

// ═══ 3. Admin o'chiradi ═══
{
  check('3) admin o‘chirdi', (await call('/api/admin/content/post/200', { method: 'DELETE', cookie: cookie.admin, json: { reason: 'spam' } })).status, 200);
  check('3) izoh va layklar ketdi', [liveComments(200), postLikes(200), contentLikes(200)], [0, 0, 0]);
  const arch = sqlite.prepare(`SELECT deleted_by_admin FROM content_comment_archive WHERE target_id = 200`).get();
  check('3) arxivda admin', arch?.deleted_by_admin, 'admin#1:super_admin');
}

// ═══ 4. Profil tozalanganda ═══
{
  newPost(300, 'BIZ777', 1);
  await decorate(300);
  await env.DB.batch(cardContentCleanupStmts(env, `SELECT code FROM cards WHERE code = ?`, ['BIZ777'], new Date().toISOString()));
  check('4) izoh va layklar ketdi', [liveComments(300), postLikes(300), contentLikes(300)], [0, 0, 0]);
  const arch = sqlite.prepare(`SELECT reason FROM content_comment_archive WHERE target_id = 300`).get();
  check('4) arxivda sabab', arch?.reason, 'card_cleanup');
}

// ═══ 5. Boshqa postlarga tegilmaydi ═══
{
  newPost(400, 'VIP001', 1);
  newPost(401, 'VIP001', 1);
  await decorate(400);
  await decorate(401);
  await call('/api/posts/400', { method: 'DELETE', cookie: cookie.user });
  check('5) qo‘shni postning izoh va layki JOYIDA', [liveComments(401), postLikes(401)], [1, 1]);
  checkTrue('5) o‘chirilgan post arxivda', !!sqlite.prepare(`SELECT 1 FROM content_archive WHERE kind = 'post' AND content_id = 400`).get());
}

done();
