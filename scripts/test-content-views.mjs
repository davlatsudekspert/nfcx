// KO'RISHLAR HISOBLAGICHI (Reels/post) VA "ANALITIKA" ENDPOINTI.
//   node scripts/test-content-views.mjs
//
// QOIDA (egasi, 2026-10-04): odam postga/Reels'ga har KIRIB 2 soniya
// ko'rganida +1 — qaysi seansda bo'lishidan qat'i nazar. O'sha
// tomoshabinning 2 soniya ichidagi qayta so'rovi (tarmoq qayta
// yuborgan nusxa) sanalmaydi, egasining o'zi hech qachon sanalmaydi,
// mehmon IP+UA bilan sanaladi. Post o'chirilganda ko'rishlar ham ketadi
// (raqam qayta ishlatiladi — comments.js). Eski `content_views` (bir
// odam — bir qator) yangi sanoqqa bir marta ko'chiriladi.
//
// "2 soniyadan keyin" — kutib o'tirilmaydi: tomoshabinning `last_at`
// i bazada 3 soniya orqaga suriladi (`rewind`).
//
// Haqiqiy worker.fetch + in-memory D1 (scripts/lib/d1-harness.mjs).
import worker from '../hosting/worker.js';
import { deleteLikesFor, viewsFor } from '../hosting/api/comments.js';
import { makeEnv, seedBasic, cookie, req, makeChecker } from './lib/d1-harness.mjs';

const { check, checkTrue, done } = makeChecker();
const { env, sqlite } = makeEnv();

const DAY = 24 * 60 * 60_000;
// `worker.js` dagi `nowTs()` formati.
const ts = (ms) => new Date(ms).toISOString().replace('T', ' ').replace('Z', '+00');
const today = ts(Date.now()).slice(0, 10);

// ═══ 0. ESKI BAZA: yangi jadvaldan OLDIN yozilgan ko'rishlar ═══
// Production'dagi kabi: `content_views` bor, `content_view_hits` yo'q.
// Jadval comments.js dagi bilan bir xil; birinchi `ensureSchema`
// (seedBasic ichida) ularni yangi sanoqqa ko'chirishi kerak.
sqlite.exec(`CREATE TABLE IF NOT EXISTS "content_views" (
  target_kind TEXT NOT NULL, target_id INTEGER NOT NULL, viewer TEXT NOT NULL,
  created_at TEXT NOT NULL, PRIMARY KEY (target_kind, target_id, viewer))`);
sqlite.prepare(`INSERT INTO content_views VALUES ('post', 102, 'u:2', ?)`).run(ts(Date.now() - 2 * DAY));
sqlite.prepare(`INSERT INTO content_views VALUES ('post', 102, 'a:legacy', ?)`).run(ts(Date.now() - DAY));

await seedBasic(env);

const call = async (pathname, init = {}) => {
  const res = await worker.fetch(req(pathname, init), env);
  return { status: res.status, body: await res.json().catch(() => null) };
};
const view = (id, init = {}) => call(`/api/content-views/post/${id}`, { method: 'POST', ...init });
// Tomoshabinning oxirgi sanalgan ko'rishini 3 soniya oldinga suradi —
// ya'ni u chiqib, qaytib kirib yana 2 soniya ko'rgan holat.
const rewind = (id, viewerLike) => sqlite.prepare(
  `UPDATE content_view_hits SET last_at = ? WHERE target_kind = 'post' AND target_id = ? AND viewer LIKE ?`,
).run(ts(Date.now() - 3000), id, viewerLike);
const n = (sql, ...a) => sqlite.prepare(sql).get(...a).n;

sqlite.prepare(
  `INSERT INTO posts (id, code, user_id, image_url, video_url, caption, created_at) VALUES (100, 'VIP001', 1, '', '/uploads/r.mp4', 'reel', datetime('now'))`,
).run();
sqlite.prepare(
  `INSERT INTO posts (id, code, user_id, image_url, caption, created_at) VALUES (101, 'VIP001', 1, '/uploads/p.jpg', 'post', datetime('now'))`,
).run();
sqlite.prepare(
  `INSERT INTO posts (id, code, user_id, image_url, caption, created_at) VALUES (102, 'VIP001', 1, '/uploads/q.jpg', 'eski', datetime('now', '-3 days'))`,
).run();

// ═══ 1. Sanash qoidalari ═══
{
  const own = await view(100, { cookie: cookie.user });
  check('1) egasining o‘z ko‘rishi sanalmaydi', [own.status, own.body?.counted, own.body?.count], [200, false, 0]);
  rewind(100, 'u:1');
  const own2 = await view(100, { cookie: cookie.user });
  check('1) egasi qaytib kirsa ham sanalmaydi', [own2.body?.counted, own2.body?.count], [false, 0]);
  check('1) egasi uchun qator yozilmaydi', n(`SELECT COUNT(*) AS n FROM content_view_hits WHERE viewer = 'u:1'`), 0);

  const a = await view(100, { cookie: cookie.other });
  check('1) boshqa odam — sanaldi', [a.status, a.body?.counted, a.body?.count], [200, true, 1]);
  const b = await view(100, { cookie: cookie.other });
  check('1) 2 soniya ichida qayta yuborilgani — sanalmaydi', [b.status, b.body?.counted, b.body?.count], [200, false, 1]);
  rewind(100, 'u:2');
  const c = await view(100, { cookie: cookie.other });
  check('1) chiqib, qaytib kirib yana ko‘rdi — +1', [c.body?.counted, c.body?.count], [true, 2]);
  check('1) bitta kun — bitta qator, hits = 2',
    sqlite.prepare(`SELECT day, hits FROM content_view_hits WHERE target_id = 100 AND viewer = 'u:2'`).all().map((r) => [r.day, r.hits]),
    [[today, 2]]);
  check('1) qamrov (content_views) — o‘sha odam bitta qator',
    n(`SELECT COUNT(*) AS n FROM content_views WHERE target_id = 100 AND viewer = 'u:2'`), 1);

  const g = await view(100, { headers: { 'user-agent': 'Mehmon/1' } });
  check('1) mehmon — sanaldi', [g.status, g.body?.counted, g.body?.count], [200, true, 3]);
  const g2 = await view(100, { headers: { 'user-agent': 'Mehmon/1' } });
  check('1) mehmon 2 soniya ichida qayta — sanalmaydi', [g2.body?.counted, g2.body?.count], [false, 3]);
  rewind(100, 'a:%');
  const g3 = await view(100, { headers: { 'user-agent': 'Mehmon/1' } });
  check('1) mehmon qaytib kirdi — +1', [g3.body?.counted, g3.body?.count], [true, 4]);

  check('1) noto‘g‘ri tur → 422', (await call('/api/content-views/story/100', { method: 'POST' })).status, 422);
  check('1) yo‘q post → 404', (await call('/api/content-views/post/999', { method: 'POST' })).status, 404);
  check('1) GET qabul qilinmaydi', (await call('/api/content-views/post/100')).status === 200, false);
}

// ═══ 2. Mehmon cheklovi (IP bo'yicha) — 429 ═══
{
  let last = 0;
  for (let i = 0; i < 125; i++) {
    last = (await view(101, { ip: '198.51.100.9', headers: { 'user-agent': `ua-${i}` } })).status;
  }
  check('2) bitta IP dan UA almashtirib ko‘paytirib bo‘lmaydi (429)', last, 429);
  check('2) ko‘pi bilan 120 ta yozildi',
    n(`SELECT COALESCE(SUM(hits), 0) AS n FROM content_view_hits WHERE target_kind = 'post' AND target_id = 101`) <= 120, true);
  sqlite.prepare(`DELETE FROM content_views WHERE target_id = 101`).run();
  sqlite.prepare(`DELETE FROM content_view_hits WHERE target_id = 101`).run();
}

// ═══ 3. Kirgan foydalanuvchi cheklovi — xato emas, sanalmaydi ═══
{
  // 10 daqiqalik oynada 299 ta allaqachon bor: 300-chisi o'tadi,
  // 301-chisi — yo'q.
  sqlite.prepare(`DELETE FROM rate_limits WHERE key = 'cview:u:2'`).run();
  sqlite.prepare(`INSERT INTO rate_limits (key, hits, window_start) VALUES ('cview:u:2', 299, ?)`).run(Date.now());
  const a = await view(101, { cookie: cookie.other });
  check('3) chegaragacha — sanaldi', [a.status, a.body?.counted, a.body?.count], [200, true, 1]);
  rewind(101, 'u:2');
  const b = await view(101, { cookie: cookie.other });
  check('3) chegaradan oshdi — 200, sanalmadi, son qaytdi', [b.status, b.body?.counted, b.body?.count], [200, false, 1]);
  check('3) bazada ham o‘zgarmadi', n(`SELECT SUM(hits) AS n FROM content_view_hits WHERE target_id = 101`), 1);
  sqlite.prepare(`DELETE FROM rate_limits WHERE key = 'cview:u:2'`).run();
}

// ═══ 4. Eski ko'rishlar ko'chirildi (bir marta) ═══
{
  const rows = sqlite.prepare(
    `SELECT viewer, day, hits FROM content_view_hits WHERE target_id = 102 ORDER BY viewer`,
  ).all().map((r) => [r.viewer, r.day, r.hits]);
  check('4) eski content_views → content_view_hits (birinchi kun, 1 ta)', rows, [
    ['a:legacy', ts(Date.now() - DAY).slice(0, 10), 1],
    ['u:2', ts(Date.now() - 2 * DAY).slice(0, 10), 1],
  ]);
  const mark = sqlite.prepare(`SELECT details FROM maintenance_runs WHERE name = 'content_view_hits_backfill_2026_10'`).get();
  check('4) belgi qo‘yildi (qayta to‘liq o‘qilmaydi)', JSON.parse(mark?.details || '{}'), { rows: 2 });
  check('4) eski qatorlar o‘zgarmadi', n(`SELECT COUNT(*) AS n FROM content_views WHERE target_id = 102`), 2);
  // Eski tomoshabin bugun qaytib kirdi — yangi kun, +1; qamrov o'zgarmaydi.
  const r = await view(102, { cookie: cookie.other });
  check('4) eski tomoshabin bugun qaytdi — +1, jami 3', [r.body?.counted, r.body?.count], [true, 3]);
  check('4) qamrov — hamon 2 kishi', n(`SELECT COUNT(*) AS n FROM content_views WHERE target_id = 102`), 2);
}

// Davrdan tashqaridagi (60 kun oldingi) qaytishlar: jami songa kiradi,
// 30 kunlik analitikaga — yo'q.
sqlite.prepare(
  `INSERT INTO content_view_hits (target_kind, target_id, viewer, day, hits, last_at) VALUES ('post', 100, 'u:2', ?, 5, ?)`,
).run(ts(Date.now() - 60 * DAY).slice(0, 10), ts(Date.now() - 60 * DAY));

// ═══ 5. Hamma joyda JAMI ko'rishlar (viewCount) ═══
{
  const list = await call('/api/records/VIP001/posts', { cookie: cookie.other });
  const posts = list.body?.posts || list.body?.items || list.body || [];
  const byId = (id) => (Array.isArray(posts) ? posts.find((p) => p.id === id) : null);
  check('5) profil postlari — viewCount (jami, hamma kunlar)', [byId(100)?.viewCount, byId(101)?.viewCount, byId(102)?.viewCount], [9, 1, 3]);
  const feed = await call('/api/feed', { cookie: cookie.other });
  const f = (feed.body?.feed || []).find((p) => p.id === 100 && p.kind === 'post');
  check('5) lenta (Reels) — viewCount', f?.viewCount, 9);
  const page = await worker.fetch(req('/post/100?code=VIP001'), env);
  checkTrue('5) /post/:id sahifasi — jami son', (await page.text()).includes('👁 9'));
  const m = await viewsFor(env, [{ kind: 'post', id: 100 }, { kind: 'post', id: 102 }, { kind: 'story', id: 100 }]);
  check('5) viewsFor — SUM(hits), istorya yo‘q', [m.get('post:100'), m.get('post:102'), m.has('story:100')], [9, 3, false]);
}

// ═══ 6. Analitika — tanlangan davrdagi jami ko'rishlar ═══
{
  check('6) kirmagan → 401', (await call('/api/my/analytics')).status, 401);
  const a = await call('/api/my/analytics', { cookie: cookie.user });
  check('6) 200', a.status, 200);
  // 30 kun: 100 → 4 (60 kun oldingi 5 tasi kirmaydi), 101 → 1, 102 → 3.
  // Qamrov: u:2, Mehmon/1, a:legacy — 3 kishi.
  check('6) kontent jami', a.body?.content, { posts: 3, views: 8, reach: 3, likes: 0, comments: 0 });
  const byDay = a.body?.byDay || [];
  check('6) byDay — kunlar va yig‘indisi', [byDay.map((d) => d.day), byDay.reduce((s, d) => s + d.views, 0)], [
    [ts(Date.now() - 2 * DAY).slice(0, 10), ts(Date.now() - DAY).slice(0, 10), today], 8,
  ]);
  check('6) bugun — 4 + 1 + 1', byDay.find((d) => d.day === today)?.views, 6);
  check('6) eng ko‘p ko‘rilgan birinchi (SUM(hits))',
    (a.body?.top || []).map((t) => [t.id, t.views, t.reach]), [[100, 4, 2], [102, 3, 2], [101, 1, 1]]);
  const a90 = await call('/api/my/analytics?days=90', { cookie: cookie.user });
  check('6) 90 kun — 60 kun oldingi qaytishlar ham', a90.body?.content?.views, 13);
  const o = await call('/api/my/analytics', { cookie: cookie.other });
  check('6) begona postlar ko‘rinmaydi', [o.body?.content?.posts, o.body?.content?.views], [0, 0]);
}

// ═══ 6b. Kunlik chegara: bitta tomoshabin × kontent × kun — ko'pi bilan 50 ═══
{
  sqlite.prepare(
    `INSERT INTO posts (id, code, user_id, image_url, caption, created_at) VALUES (103, 'VIP001', 1, '/uploads/c.jpg', 'cap', datetime('now'))`,
  ).run();
  const ip = { ip: '198.51.100.77', headers: { 'user-agent': 'cap-ua' } };
  const a = await view(103, ip);
  check('6b) birinchi ko‘rish — sanaldi', [a.body?.counted, a.body?.count], [true, 1]);
  sqlite.prepare(`UPDATE content_view_hits SET hits = 49 WHERE target_id = 103`).run();
  sqlite.prepare(`UPDATE content_view_hits SET last_at = ? WHERE target_id = 103`).run(ts(Date.now() - 3000));
  const b = await view(103, ip);
  check('6b) 50-chisi — sanaldi', [b.body?.counted, b.body?.count], [true, 50]);
  sqlite.prepare(`UPDATE content_view_hits SET last_at = ? WHERE target_id = 103`).run(ts(Date.now() - 3000));
  const c = await view(103, ip);
  check('6b) 51-chisi — sanalmadi, son o‘zgarmadi', [c.status, c.body?.counted, c.body?.count], [200, false, 50]);
  sqlite.prepare(`DELETE FROM content_views WHERE target_id = 103`).run();
  sqlite.prepare(`DELETE FROM content_view_hits WHERE target_id = 103`).run();
  sqlite.prepare(`DELETE FROM posts WHERE id = 103`).run();
}

// ═══ 7. Post o'chirilsa ko'rishlar ham ketadi (raqam qayta ishlatiladi) ═══
{
  check('7) egasi o‘chirdi', (await call('/api/posts/100', { method: 'DELETE', cookie: cookie.user })).status, 200);
  check('7) qamrov ketdi', n(`SELECT COUNT(*) AS n FROM content_views WHERE target_kind = 'post' AND target_id = 100`), 0);
  check('7) jami sanoq ketdi', n(`SELECT COUNT(*) AS n FROM content_view_hits WHERE target_kind = 'post' AND target_id = 100`), 0);
  check('7) boshqa postlar joyida', n(`SELECT SUM(hits) AS n FROM content_view_hits WHERE target_id IN (101, 102)`), 4);

  // Kompaniya posti — `deleteLikesFor` (worker.js dagi o'chirish yo'li).
  sqlite.prepare(`INSERT INTO content_views VALUES ('company_post', 9, 'u:2', ?)`).run(ts(Date.now()));
  sqlite.prepare(`INSERT INTO content_view_hits VALUES ('company_post', 9, 'u:2', ?, 2, ?)`).run(today, ts(Date.now()));
  await deleteLikesFor(env, 'company_post', 9);
  check('7) kompaniya posti: ikkala jadval tozalandi',
    [n(`SELECT COUNT(*) AS n FROM content_views WHERE target_kind = 'company_post'`),
      n(`SELECT COUNT(*) AS n FROM content_view_hits WHERE target_kind = 'company_post'`)], [0, 0]);
}

done();
