// POST, VIDEO/REELS, ISTORYA VA IZOH — HAMMAGA BEPUL (2026-10-04).
//
// Egasining qarori (App Store 3.1.1 / 3.1.3(b)): ilovadagi asosiy
// imkoniyatlar ilova tashqarisidagi to'lovga (Premium, pullik ID
// darajasi, sinov muddati) bog'lanmasin. Tizimga kirgan, bloklanmagan
// har kim yozadi; yagona qulf — ban (va saxiy spam chegarasi).
//
// Qo'riqlanadigan chegaralar (shaxsiy profil, bepul 8 xonali ID,
// sinov TUGAGAN, Premium YO'Q):
//   1) rasm post -> 201;
//   2) video post (Reels) -> 201;
//   3) istorya (rasm va video) -> 201;
//   4) izoh -> 201;
//   5) ilgarigi tarif chegaralari (free 0 / silver 5) yo'q;
//   6) /api/auth/me `entitlements` — hammasi true;
//   7) bloklangan: post, video, istorya, izoh -> 403 banned,
//      `entitlements` hammasi false;
//   8) spam chegarasi: soatiga 60 ta post+istorya, keyin 429.
//
//   node scripts/test-free-publishing.mjs
import worker from '../hosting/worker.js';
import { makeEnv, seedBasic, cookie, req, makeChecker } from './lib/d1-harness.mjs';

const { check, checkTrue, done } = makeChecker();
const { env } = makeEnv();
await seedBasic(env);

const j = async (path, init) => {
  const r = await worker.fetch(req(path, init), env);
  return { status: r.status, body: await r.json().catch(() => null) };
};
const DAY = 86400000;
const iso = (ms) => new Date(Date.now() + ms).toISOString();
const asUser = { cookie: cookie.user };

// Bepul avtomatik ID (8 xonali raqam -> 'free' daraja) — user#1 niki.
await env.DB.prepare(
  `INSERT INTO cards (code, name, price, ts, user_id, profile_type) VALUES ('12345678', 'Bepul', 0, 1000, 1, 'personal')`,
).run();
// Sxema (trial_expires_at, is_premium, banned_until) birinchi so'rovda
// yaratiladi — avval bitta "isitish" so'rovi.
await j('/api/auth/me', asUser);
await env.DB.prepare(`UPDATE users SET is_premium = 0, premium_expires_at = NULL, trial_expires_at = ? WHERE id = 1`)
  .bind(iso(-DAY)).run();

const me = await j('/api/auth/me', asUser);
check('0) holat: Premium yo‘q', me.body?.user?.isPremium, false);
check('6) entitlements — hammasi ochiq',
  me.body?.user?.entitlements, { post: true, video: true, story: true, comment: true });

const createPost = (json) => j('/api/records/12345678/posts', { method: 'POST', ...asUser, json: { agreed: true, ...json } });
const createStory = (json) => j('/api/records/12345678/stories', { method: 'POST', ...asUser, json: { agreed: true, ...json } });

// ── 1-2) POST: RASM VA VIDEO (REELS) ────────────────────────────────
const photo = await createPost({ imageUrl: '/uploads/free-photo.jpg', caption: 'rasm' });
check('1) bepul hisob: rasm post -> 201', photo.status, 201);
const video = await createPost({ videoUrl: '/uploads/free-reel.mp4', caption: 'reels' });
check('2) bepul hisob: video post (Reels) -> 201', video.status, 201);
checkTrue('2) video saqlandi', String(video.body?.videoUrl || '').endsWith('free-reel.mp4'));

// ── 3) ISTORYA: RASM VA VIDEO ───────────────────────────────────────
check('3) bepul hisob: rasm istorya -> 201', (await createStory({ imageUrl: '/uploads/story_free.jpg' })).status, 201);
check('3) bepul hisob: video istorya -> 201', (await createStory({ videoUrl: '/uploads/story_free.mp4' })).status, 201);

// ── 4) IZOH ─────────────────────────────────────────────────────────
const cmt = await j(`/api/comments/post/${photo.body?.id}`, { method: 'POST', ...asUser, json: { body: 'zo‘r' } });
check('4) bepul hisob: izoh -> 201', cmt.status, 201);
// Begona (user#2, ham bepul) ham izoh yoza oladi.
const cmt2 = await j(`/api/comments/post/${photo.body?.id}`, { method: 'POST', cookie: cookie.other, json: { body: 'salom' } });
check('4) boshqa bepul hisob ham izoh yozadi -> 201', cmt2.status, 201);

// ── 5) ESKI TARIF CHEGARALARI YO'Q ──────────────────────────────────
// Ilgari: free 0, silver 5. 6-post ham o'tishi kerak.
for (let i = 3; i <= 6; i += 1) {
  const r = await createPost({ imageUrl: `/uploads/free-${i}.jpg` });
  if (r.status !== 201) check(`5) ${i}-post`, r.status, 201);
}
const posts = await j('/api/records/12345678/posts');
check('5) 6 ta post saqlandi (eski "silver 5" chegarasi yo‘q)', posts.body?.posts?.length, 6);

// ── 7) BLOKLANGAN — YAGONA QULF ─────────────────────────────────────
await env.DB.prepare(`UPDATE users SET banned_until = ? WHERE id = 1`).bind(iso(3 * DAY)).run();
const bannedMe = await j('/api/auth/me', asUser);
check('7) bloklangan: entitlements yopiq',
  bannedMe.body?.user?.entitlements, { post: false, video: false, story: false, comment: false });
const bPhoto = await createPost({ imageUrl: '/uploads/banned.jpg' });
check('7) bloklangan: rasm post -> 403 banned', [bPhoto.status, bPhoto.body?.error], [403, 'banned']);
const bVideo = await createPost({ videoUrl: '/uploads/banned.mp4' });
check('7) bloklangan: video post -> 403 banned', [bVideo.status, bVideo.body?.error], [403, 'banned']);
const bStory = await createStory({ imageUrl: '/uploads/story_banned.jpg' });
check('7) bloklangan: istorya -> 403 banned', [bStory.status, bStory.body?.error], [403, 'banned']);
const bCmt = await j(`/api/comments/post/${photo.body?.id}`, { method: 'POST', ...asUser, json: { body: 'bloklangan' } });
check('7) bloklangan: izoh -> 403 banned', [bCmt.status, bCmt.body?.error], [403, 'banned']);
check('7) bloklanganda hech narsa yozilmadi', (await j('/api/records/12345678/posts')).body?.posts?.length, 6);
// Ban muddati o'tgach yana ochiq.
await env.DB.prepare(`UPDATE users SET banned_until = ? WHERE id = 1`).bind(iso(-DAY)).run();
check('7) ban muddati o‘tgach post yana ochiq', (await createPost({ imageUrl: '/uploads/after-ban.jpg' })).status, 201);

// ── 8) SPAM CHEGARASI — SOATIGA 60 TA (POST + ISTORYA BIRGA) ────────
// Shu paytgacha 7 post va 2 istorya o'tdi (9 ta). Bloklangan urinishlar
// hisoblagichga TUSHMAYDI (ban tekshiruvi undan oldin) — ya'ni yana
// 51 tasi o'tadi, 52-si 429.
let firstBlockedAt = 0;
for (let i = 0; i < 70 && !firstBlockedAt; i += 1) {
  const r = await createPost({ imageUrl: `/uploads/spam-${i}.jpg` });
  if (r.status === 429) firstBlockedAt = i + 1;
  else if (r.status !== 201) { check(`8) ${i}-spam post kutilmagan javob`, r.status, 201); break; }
}
check('8) 60 tadan keyin 429 (52-urinish)', firstBlockedAt, 52);

done();
