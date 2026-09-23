// ESKI POSTNING IZOHI YANGI POSTDA KO'RINMASIN (egasi, 2026-09-23).
//
// `posts.id` qayta ishlatiladi. Akkaunt o'chirilganda postlar FK
// CASCADE bilan ketadi, izohlar esa qoladi. Keyingi yangi post AYNAN
// o'sha raqamni olsa, eski izoh (masalan E2E sinov izohi) yangi
// postda ko'rinardi — "yangi postga o'zi izoh yozilyapti".
//
//   node scripts/test-comment-recycled-id.mjs
import worker from '../hosting/worker.js';
import { makeEnv, seedBasic, req, cookie, makeChecker } from './lib/d1-harness.mjs';

const { env, sqlite } = makeEnv();
await seedBasic(env);
const { check, done } = makeChecker();

const call = async (path, init = {}) => {
  const res = await worker.fetch(req(path, init), env);
  return { status: res.status, body: await res.json().catch(() => null) };
};
const asA = { cookie: cookie.user };

// Sxemani yaratish uchun bitta o'qish.
await call('/api/comments/post/1');

// 1) Eski post #7 va unga 19-sentabrda yozilgan izoh.
sqlite.prepare(`INSERT INTO posts (id, code, user_id, caption, created_at)
  VALUES (7, 'OTH222', 2, 'eski', '2026-09-19T10:00:00.000Z')`).run();
sqlite.prepare(`INSERT INTO content_comments (target_kind, target_id, user_id, author_code, body, created_at)
  VALUES ('post', 7, 1, 'VIP001', 'NOVA E2E TEST — DELETE · izoh', '2026-09-19 16:42:58.099+00')`).run();
let r = await call('/api/comments/post/7');
check('1) eski postda izoh ko‘rinadi', [r.body?.comments?.length, r.body?.total], [1, 1]);

// 2) Post izohlarini tozalamasdan o'chiriladi (CASCADE yo'li) va
//    YANGI post xuddi shu raqamni oladi.
sqlite.prepare(`DELETE FROM posts WHERE id = 7`).run();
sqlite.prepare(`INSERT INTO posts (id, code, user_id, caption, created_at)
  VALUES (7, 'VIP001', 1, 'yangi reels', '2026-09-23T12:00:00.000Z')`).run();
r = await call('/api/comments/post/7');
check('2) yangi postda eski izoh YO‘Q', [r.body?.comments?.length, r.body?.total], [0, 0]);

// 3) Profil/lenta sanog'i ham 0.
r = await call('/api/records/VIP001/posts');
const p7 = (r.body?.posts || r.body?.items || []).find((p) => Number(p.id) === 7);
check('3) profil ro‘yxatida izohlar soni 0', p7 ? Number(p7.commentCount ?? p7.comments ?? 0) : 'post topilmadi', 0);

// 4) Yangi postga yangi izoh — odatdagidek ko'rinadi.
sqlite.prepare(`UPDATE users SET is_premium = 1 WHERE id = 1`).run();
r = await call('/api/comments/post/7', { method: 'POST', ...asA, json: { body: 'zo‘r video' } });
check('4) yangi izoh -> 201', r.status, 201);
r = await call('/api/comments/post/7');
check('4) faqat yangi izoh ko‘rinadi', [r.body?.comments?.map((c) => c.body), r.body?.total], [['zo‘r video'], 1]);

// 5) Eski izoh bazadan O'CHIRILMAGAN — faqat ko'rsatilmaydi.
const n = sqlite.prepare(`SELECT COUNT(*) AS n FROM content_comments WHERE target_id = 7 AND deleted_at IS NULL`).get().n;
check('5) hech narsa o‘chirilmadi', n, 2);

done();
