// KO'RISHLAR HISOBLAGICHI (Reels/post) VA "ANALITIKA" ENDPOINTI.
//   node scripts/test-content-views.mjs
//
// Instagram'dagi kabi: bir odam bir postni bir marta sanaydi, egasining
// o'zi sanalmaydi, mehmon IP+UA bilan sanaladi. Post o'chirilganda
// ko'rishlar ham ketadi (raqam qayta ishlatiladi — comments.js).
//
// Haqiqiy worker.fetch + in-memory D1 (scripts/lib/d1-harness.mjs).
import worker from '../hosting/worker.js';
import { makeEnv, seedBasic, cookie, req, makeChecker } from './lib/d1-harness.mjs';

const { check, checkTrue, done } = makeChecker();
const { env, sqlite } = makeEnv();
await seedBasic(env);

const call = async (pathname, init = {}) => {
  const res = await worker.fetch(req(pathname, init), env);
  return { status: res.status, body: await res.json().catch(() => null) };
};
const view = (id, init = {}) => call(`/api/content-views/post/${id}`, { method: 'POST', ...init });
sqlite.prepare(
  `INSERT INTO posts (id, code, user_id, image_url, video_url, caption, created_at) VALUES (100, 'VIP001', 1, '', '/uploads/r.mp4', 'reel', datetime('now'))`,
).run();
sqlite.prepare(
  `INSERT INTO posts (id, code, user_id, image_url, caption, created_at) VALUES (101, 'VIP001', 1, '/uploads/p.jpg', 'post', datetime('now'))`,
).run();

// ═══ 1. Sanash qoidalari ═══
{
  const own = await view(100, { cookie: cookie.user });
  check('1) egasining o‘z ko‘rishi sanalmaydi', [own.status, own.body?.counted, own.body?.count], [200, false, 0]);
  const a = await view(100, { cookie: cookie.other });
  check('1) boshqa odam — sanaldi', [a.status, a.body?.counted, a.body?.count], [200, true, 1]);
  const b = await view(100, { cookie: cookie.other });
  check('1) o‘sha odam qayta — sanalmaydi', [b.body?.counted, b.body?.count], [false, 1]);
  const g = await view(100, { headers: { 'user-agent': 'Mehmon/1' } });
  check('1) mehmon — sanaldi', [g.status, g.body?.count], [200, 2]);
  const g2 = await view(100, { headers: { 'user-agent': 'Mehmon/1' } });
  check('1) o‘sha mehmon qayta — sanalmaydi', g2.body?.count, 2);
  check('1) noto‘g‘ri tur → 422', (await call('/api/content-views/story/100', { method: 'POST' })).status, 422);
  check('1) yo‘q post → 404', (await call('/api/content-views/post/999', { method: 'POST' })).status, 404);
  check('1) GET qabul qilinmaydi', (await call('/api/content-views/post/100')).status === 200, false);
}

// ═══ 2. Mehmon cheklovi (IP bo'yicha) ═══
{
  let last = 0;
  for (let i = 0; i < 125; i++) {
    last = (await view(101, { ip: '198.51.100.9', headers: { 'user-agent': `ua-${i}` } })).status;
  }
  check('2) bitta IP dan UA almashtirib ko‘paytirib bo‘lmaydi (429)', last, 429);
  const n = sqlite.prepare(`SELECT COUNT(*) AS n FROM content_views WHERE target_kind = 'post' AND target_id = 101`).get().n;
  check('2) ko‘pi bilan 120 ta yozildi', n <= 120, true);
  sqlite.prepare(`DELETE FROM content_views WHERE target_id = 101`).run();
}

// ═══ 3. Post JSON'ida viewCount (profil va lenta) ═══
{
  const list = await call('/api/records/VIP001/posts', { cookie: cookie.other });
  const posts = list.body?.posts || list.body?.items || list.body || [];
  const reel = Array.isArray(posts) ? posts.find((p) => p.id === 100) : null;
  check('3) profil postlari — viewCount', reel?.viewCount, 2);
  const feed = await call('/api/feed', { cookie: cookie.other });
  const f = (feed.body?.feed || []).find((p) => p.id === 100 && p.kind === 'post');
  check('3) lenta (Reels) — viewCount', f?.viewCount, 2);
}

// ═══ 4. Analitika ═══
{
  check('4) kirmagan → 401', (await call('/api/my/analytics')).status, 401);
  const a = await call('/api/my/analytics', { cookie: cookie.user });
  check('4) 200', a.status, 200);
  check('4) kontent jami', a.body?.content, { posts: 2, views: 2, likes: 0, comments: 0 });
  check('4) eng ko‘p ko‘rilgan birinchi', [a.body?.top?.[0]?.id, a.body?.top?.[0]?.views], [100, 2]);
  checkTrue('4) kunlik ko‘rishlar bor', (a.body?.byDay || []).some((d) => d.views === 2));
  const o = await call('/api/my/analytics', { cookie: cookie.other });
  check('4) begona postlar ko‘rinmaydi', o.body?.content?.posts, 0);
}

// ═══ 5. Post o'chirilsa ko'rishlar ham ketadi (raqam qayta ishlatiladi) ═══
{
  check('5) egasi o‘chirdi', (await call('/api/posts/100', { method: 'DELETE', cookie: cookie.user })).status, 200);
  const n = sqlite.prepare(`SELECT COUNT(*) AS n FROM content_views WHERE target_kind = 'post' AND target_id = 100`).get().n;
  check('5) ko‘rishlar ketdi', n, 0);
}

done();
