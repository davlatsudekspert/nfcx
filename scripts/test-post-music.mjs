// POSTGA MUSIQA VA RASMLI REEL (2026-09-25).
//
// Egasi: "reelsga musiqa qo'yish joyi yo'q", "reelsga rasm ham qo'yilsin,
// default 10 sekund bo'lsin". Tekshiriladi: post musiqa va reel belgisi
// bilan yaratiladi, profil ro'yxati va lentada `music` / `reel` qaytadi,
// yomon yoki yashirin trek rad etiladi, `uses` oshadi, qayta ishlatilgan
// post raqamiga eski musiqa yopishmaydi, jadval yo'q bo'lsa ro'yxat yiqilmaydi.
//
//   node scripts/test-post-music.mjs

import worker from '../hosting/worker.js';
import { makeEnv, seedBasic, cookie, req, makeChecker } from './lib/d1-harness.mjs';

const { check, done } = makeChecker();
const { env, sqlite } = makeEnv();
await seedBasic(env);
sqlite.prepare(`UPDATE users SET is_premium = 1`).run();

const call = async (pathname, init = {}) => {
  const res = await worker.fetch(req(pathname, init), env);
  return { status: res.status, body: await res.json().catch(() => null) };
};
const post = (json) => call('/api/records/VIP001/posts', { method: 'POST', cookie: cookie.user, json: { agreed: true, ...json } });

// 0) Kutubxona hali yo'q — oddiy post avvalgidek ishlaydi, ro'yxat yiqilmaydi.
let r = await post({ imageUrl: '/uploads/a.jpg', caption: 'oddiy' });
check('0) musiqasiz post: 201', r.status, 201);
check('0) musiqa maydoni yo‘q', ['music' in r.body, 'reel' in r.body], [false, false]);
r = await call('/api/records/VIP001/posts');
check('0) ro‘yxat ishlaydi', [r.status, r.body.posts.length], [200, 1]);

// Kutubxonaga ikki trek (bittasi yashirin).
const add = async (title, enabled = true) => {
  const a = await call('/api/admin/music', { method: 'POST', cookie: cookie.admin, json: { title, artist: 'NeomSongs', genre: 'Romantik', durationSec: 200, audioUrl: `/uploads/music_${title}.mp3`, clipUrl: `/uploads/music_${title}-30s.mp3` } });
  if (!enabled) await call(`/api/admin/music/${a.body.track.id}`, { method: 'PATCH', cookie: cookie.admin, json: { enabled: false } });
  return a.body.track.id;
};
const t1 = await add('aybala');
const hidden = await add('yashirin', false);

// 1) Rasmli reel + musiqa.
r = await post({ imageUrl: '/uploads/r.jpg', caption: 'reel', reel: true, musicId: t1, musicStart: 42 });
check('1) rasmli reel: 201', r.status, 201);
check('1) javobda musiqa', [r.body.music?.id, r.body.music?.title, r.body.music?.start, r.body.music?.clipUrl], [t1, 'aybala', 42, '/uploads/music_aybala-30s.mp3']);
check('1) reel va 10 soniya', [r.body.reel, r.body.imageSeconds], [true, 10]);
const reelId = r.body.id;
check('1) uses oshdi', sqlite.prepare(`SELECT uses FROM music_tracks WHERE id = ?`).get(t1).uses, 1);

// 2) Video + musiqa (reel belgisi videoga kerak emas).
r = await post({ videoUrl: '/uploads/v.mp4', musicId: t1, reel: true });
check('2) video + musiqa: 201', [r.status, r.body.music?.id, 'reel' in r.body], [201, t1, false]);

// 3) Rad etiladiganlar.
for (const [label, musicId] of [['yashirin trek', hidden], ['yo‘q trek', 9999], ['matn', 'abc'], ['manfiy', -3]]) {
  r = await post({ imageUrl: '/uploads/x.jpg', musicId });
  check(`3) ${label}: 422 bad_music`, [r.status, r.body?.error], [422, 'bad_music']);
}
check('3) rad etilganda post yozilmadi', sqlite.prepare(`SELECT COUNT(*) AS n FROM posts WHERE image_url = '/uploads/x.jpg'`).get().n, 0);

// 4) Boshlanish nuqtasi trekdan oshmaydi.
r = await post({ imageUrl: '/uploads/s.jpg', musicId: t1, musicStart: 9999 });
check('4) start chegaralanadi', r.body.music.start, 195);

// 5) Profil ro'yxati va lenta.
r = await call('/api/records/VIP001/posts');
const reelInList = r.body.posts.find((p) => p.id === reelId);
check('5) profilda reel + musiqa', [reelInList.reel, reelInList.imageSeconds, reelInList.music?.title], [true, 10, 'aybala']);
check('5) oddiy postda musiqa yo‘q', 'music' in r.body.posts.find((p) => p.caption === 'oddiy'), false);
r = await call('/api/feed', { cookie: cookie.other });
const inFeed = (r.body.items || r.body.feed || r.body.posts || []).find((p) => p.kind === 'post' && p.id === reelId);
check('5) lentada reel + musiqa', [inFeed?.reel, inFeed?.music?.id], [true, t1]);

// 6) Trek keyin yashirilsa — eski postlarda musiqa chiqmaydi (reel qoladi).
await call(`/api/admin/music/${t1}`, { method: 'PATCH', cookie: cookie.admin, json: { enabled: false } });
r = await call('/api/records/VIP001/posts');
const after = r.body.posts.find((p) => p.id === reelId);
check('6) yashirilgan trek jim', ['music' in after, after.reel], [false, true]);
await call(`/api/admin/music/${t1}`, { method: 'PATCH', cookie: cookie.admin, json: { enabled: true } });

// 7) Post raqami qayta ishlatilsa eski musiqa yopishmaydi (posts.id —
//    AUTOINCREMENT emas: oxirgi post o'chsa, keyingisi o'sha raqamni oladi).
{
  const last = await post({ imageUrl: '/uploads/last.jpg', reel: true, musicId: t1 });
  const lastId = last.body.id;
  sqlite.prepare(`DELETE FROM posts WHERE id = ?`).run(lastId);
  r = await post({ imageUrl: '/uploads/new.jpg', caption: 'yangi' });
  check('7) raqam haqiqatan qayta ishlatildi (xato sharti)', r.body.id, lastId);
  check('7) yangi postda eski musiqa YO‘Q', ['music' in r.body, 'reel' in r.body], [false, false]);
  r = await call('/api/records/VIP001/posts');
  const np = r.body.posts.find((p) => p.id === lastId);
  check('7) ro‘yxatda ham yo‘q', ['music' in np, 'reel' in np], [false, false]);
}

// 9) Biznes posti — xuddi shunday.
sqlite.prepare(`INSERT INTO companies (company_id, owner_user_id, display_name, tier, price, status, created_at, updated_at)
  VALUES ('ELITE', '1', 'Elite Qurilish', 'exclusive', 0, 'active', datetime('now'), datetime('now'))`).run();
await call('/api/companies/ELITE/posts');
{
  const c = await call('/api/companies/ELITE/posts', { method: 'POST', cookie: cookie.user, json: { agreed: true, imageUrl: '/uploads/co.jpg', reel: true, musicId: t1, musicStart: 5 } });
  check('9) biznes reeli: 201', c.status, 201);
  check('9) javobda musiqa + reel', [c.body?.post?.music?.id, c.body?.post?.reel, c.body?.post?.imageSeconds], [t1, true, 10]);
  const bad = await call('/api/companies/ELITE/posts', { method: 'POST', cookie: cookie.user, json: { agreed: true, imageUrl: '/uploads/co2.jpg', musicId: hidden } });
  check('9) yashirin trek: 422', bad.status, 422);
  const list = await call('/api/companies/ELITE/posts');
  const cp = list.body.posts.find((p) => p.id === c.body.post.id);
  check('9) biznes ro‘yxatida musiqa', [cp?.music?.start, cp?.reel], [5, true]);
  const feed = await call('/api/feed', { cookie: cookie.other });
  const f = (feed.body.items || feed.body.feed || feed.body.posts || []).find((p) => p.kind === 'post' && p.id === c.body.post.id && p.authorKind === 'company');
  check('9) lentada biznes reeli + musiqa', [f?.reel, f?.music?.id], [true, t1]);
}

// 8) Ishlatilgan trekni admin o'chira olmaydi.
r = await call(`/api/admin/music/${t1}`, { method: 'DELETE', cookie: cookie.admin });
check('8) ishlatilgan trek o‘chmaydi', r.status, 409);

done();
