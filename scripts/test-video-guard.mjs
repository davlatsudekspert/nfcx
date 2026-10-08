// VIDEO KALITLARI VA AUDIO TESHIGI (2026-10).
//   * videoUploadsBlocked — har yuklash/ulash yo'li 403 `video_uploads_disabled`
//     (kalit o'chiq bo'lsa avvalgidek ishlaydi; admin yo'llari mustasno);
//   * /api/upload-audio — sehrli bayt tekshiruvi va `aud_` prefiksi; audio
//     yo'llarining fayllari video sifatida ulanmaydi (doimiy);
//   * videosHidden — lenta, Reels, profil, kompaniya, istoriya, saqlanganlar,
//     post sahifasi va /uploads dagi videolar yashirin;
//   * reelsHidden — /api/reels bo'sh, `hidden: true`.
//   node scripts/test-video-guard.mjs
import { setupSocial, cookie, makeChecker } from './lib/social-fixture.mjs';

const { check, checkTrue, done } = makeChecker();
const { env, sqlite, call, resetLimits } = await setupSocial();

const setFlags = (json) => call('/api/admin/flags', { method: 'PUT', cookie: cookie.admin, json });
const bytes = (head, len = 2048) => {
  const b = new Uint8Array(len);
  head.forEach((v, i) => { b[i] = typeof v === 'string' ? v.charCodeAt(0) : v; });
  return b;
};
const str = (s) => [...s];
const MP4 = bytes([0, 0, 0, 0x20, ...str('ftypisom')]);
const WEBM = bytes([0x1a, 0x45, 0xdf, 0xa3]);
const PNG = bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const GIF = bytes([...str('GIF89a'), 1, 0, 1, 0, 0, 0]);
const MP3 = bytes([...str('ID3'), 3, 0, 0, 0, 0, 0, 0]);
const keys = () => [...env.UPLOADS._store.keys()].sort();
const upload = (path, body, type, ck = cookie.user) => call(path, { method: 'POST', cookie: ck, headers: { 'content-type': type }, body });

// ═══ 1. KALIT O'CHIQ — avvalgidek ═══
let r = await upload('/api/upload-media', MP4, 'video/mp4');
check('1) off: upload-media video ok', [r.status, r.body?.kind], [200, 'video']);
const storyVideo = r.body.url;
r = await upload('/api/upload-card-video', MP4, 'video/mp4');
check('1) off: card video ok', r.status, 200);
r = await upload('/api/upload-profile-bg', MP4, 'video/mp4');
check('1) off: profile-bg video ok', r.status, 200);
r = await upload('/api/upload-file', MP4, 'video/mp4');
check('1) off: upload-file video ok (file_ prefix)', [r.status, String(r.body?.url).startsWith('/uploads/file_')], [200, true]);
resetLimits();

// ═══ 2. videoUploadsBlocked ═══
r = await setFlags({ videoUploadsBlocked: true });
check('2) flag on', r.body?.flags?.videoUploadsBlocked, true);
let before = keys();
r = await upload('/api/upload-media', MP4, 'video/mp4');
check('2) upload-media declared video -> 403', [r.status, r.body?.error], [403, 'video_uploads_disabled']);
checkTrue('2) uz message', /Video yuklash vaqtincha/.test(r.body?.message || ''));
r = await upload('/api/upload-media', MP4, 'application/octet-stream');
check('2) upload-media sniffed video -> 403', [r.status, r.body?.error], [403, 'video_uploads_disabled']);
r = await upload('/api/upload-file', MP4, 'application/octet-stream');
check('2) upload-file sniffed video -> 403', r.status, 403);
r = await upload('/api/upload-card-video', MP4, 'video/mp4');
check('2) card video -> 403', r.status, 403);
r = await upload('/api/upload-profile-bg', WEBM, 'video/webm');
check('2) profile-bg video -> 403', r.status, 403);
check('2) nothing stored by rejected uploads', keys(), before);
r = await upload('/api/upload-profile-bg', GIF, 'image/gif');
check('2) profile-bg GIF still ok', r.status, 200);
r = await upload('/api/upload-media', PNG, 'image/png');
check('2) image upload still ok', [r.status, r.body?.kind], [200, 'image']);
const img = r.body.url;
r = await upload('/api/upload-file', WEBM, 'audio/webm');
check('2) audio declared webm via upload-file -> stored as aud_', [r.status, String(r.body?.url).startsWith('/uploads/aud_')], [200, true]);
const audFile = r.body.url;
r = await upload('/api/admin/upload-file', MP4, 'video/mp4', cookie.admin);
check('2) admin upload exempt', r.status, 200);
resetLimits();

// Ulash nuqtalari
const post = (json) => call('/api/records/VIP001/posts', { method: 'POST', cookie: cookie.user, json: { agreed: true, ...json } });
r = await post({ videoUrl: storyVideo });
check('2) post videoUrl -> 403', [r.status, r.body?.error], [403, 'video_uploads_disabled']);
r = await post({ media: [{ url: img, type: 'image' }, { url: storyVideo, type: 'video' }] });
check('2) carousel with video -> 403', r.status, 403);
r = await post({ showcase: true, mediaUrls: [img, storyVideo] });
check('2) mediaUrls with video -> 403', r.status, 403);
r = await call('/api/records/VIP001/stories', { method: 'POST', cookie: cookie.user, json: { agreed: true, videoUrl: storyVideo } });
check('2) story video -> 403', r.status, 403);
r = await call('/api/companies/ACMEUZ/posts', { method: 'POST', cookie: cookie.user, json: { agreed: true, videoUrl: storyVideo } });
check('2) company post video -> 403', r.status, 403);
r = await call('/api/companies/ACMEUZ/stories', { method: 'POST', cookie: cookie.user, json: { agreed: true, videoUrl: storyVideo } });
check('2) company story video -> 403', r.status, 403);
r = await call(`/api/records/VIP001/video?url=${encodeURIComponent(storyVideo)}`, { method: 'POST', cookie: cookie.user });
check('2) legacy card video ?url -> 403', [r.status, r.body?.error], [403, 'video_uploads_disabled']);
r = await post({ imageUrl: img });
check('2) image post still ok', r.status, 201);
resetLimits();
await setFlags({ videoUploadsBlocked: false });

// ═══ 3. AUDIO TESHIGI (doimiy) ═══
const b64 = (u8, type) => `data:${type};base64,${Buffer.from(u8).toString('base64')}`;
r = await call('/api/upload-audio', { method: 'POST', cookie: cookie.user, json: { dataUrl: b64(MP3, 'audio/mpeg') } });
check('3) audio mp3 ok, aud_ prefix', [r.status, /^\/uploads\/aud_[0-9a-f]{20}\.mp3$/.test(r.body?.url)], [200, true]);
r = await call('/api/upload-audio', { method: 'POST', cookie: cookie.user, json: { dataUrl: b64(WEBM, 'audio/webm') } });
check('3) audio webm ok, aud_ prefix', [r.status, /^\/uploads\/aud_[0-9a-f]{20}\.webm$/.test(r.body?.url)], [200, true]);
const audWebm = r.body.url;
r = await call('/api/upload-audio', { method: 'POST', cookie: cookie.user, json: { dataUrl: b64(PNG, 'audio/mpeg') } });
check('3) non-audio bytes -> 422 bad_audio', [r.status, r.body?.error], [422, 'bad_audio']);
r = await post({ videoUrl: audWebm });
check('3) aud_ as post video -> 422', r.status, 422);
r = await post({ videoUrl: '/uploads/0123456789abcdef0123.webm' });
check('3) legacy unprefixed audio webm as video -> 422', r.status, 422);
r = await post({ videoUrl: '/uploads/music_abc123.mp4' });
check('3) music_ as video -> 422', r.status, 422);
r = await post({ videoUrl: audFile });
check('3) aud_ (upload-file) as video -> 422', r.status, 422);
r = await post({ media: [{ url: audWebm, type: 'video' }] });
check('3) carousel aud_ video -> 422', r.status, 422);
r = await call('/api/records/VIP001/stories', { method: 'POST', cookie: cookie.user, json: { agreed: true, videoUrl: audWebm } });
check('3) story aud_ video -> 422', r.status, 422);
r = await call('/api/companies/ACMEUZ/posts', { method: 'POST', cookie: cookie.user, json: { agreed: true, videoUrl: audWebm } });
check('3) company post aud_ video -> 422', r.status, 422);
sqlite.prepare(`UPDATE users SET is_premium = 1 WHERE id = 1`).run();
r = await call(`/api/records/VIP001/video?url=${encodeURIComponent(audWebm)}`, { method: 'POST', cookie: cookie.user });
check('3) legacy card video ?url aud_ -> 422', [r.status, r.body?.error], [422, 'bad_file']);
resetLimits();

// ═══ 4. videosHidden ═══
// Tekshirilmagan fayllar admin tasdig'igacha yashirin (pending) — bu bo'limda
// kalitni sinash uchun navbat tozalanadi.
sqlite.prepare(`DELETE FROM content_reports`).run();
r = await post({ videoUrl: storyVideo, caption: 'video post' });
check('4) video post created', r.status, 201);
const videoPostId = r.body.id;
r = await post({ imageUrl: img, caption: 'image post' });
const imagePostId = r.body.id;
r = await call('/api/records/VIP001/stories', { method: 'POST', cookie: cookie.user, json: { agreed: true, videoUrl: storyVideo } });
check('4) video story', r.status, 201);
const videoStoryId = r.body.id;
r = await call('/api/records/VIP001/stories', { method: 'POST', cookie: cookie.user, json: { agreed: true, imageUrl: img } });
const imageStoryId = r.body.id;
// Aktual (api/highlights.js): video va rasm istoriya nusxalari.
r = await call('/api/highlights', { method: 'POST', cookie: cookie.user, json: { code: 'VIP001', title: 'Video', storyIds: [videoStoryId, imageStoryId] } });
check('4) highlight with video + image', [r.status, r.body?.highlight?.itemCount], [201, 2]);
const hlId = r.body.highlight.id;
const hlItems = async (ck) => ((await call('/api/highlights?code=VIP001', { cookie: ck })).body?.highlights || [])
  .find((h) => h.id === hlId)?.items || [];
check('4) off: highlight shows video item', (await hlItems(cookie.other)).some((i) => i.videoUrl === storyVideo), true);
r = await call('/api/companies/ACMEUZ/posts', { method: 'POST', cookie: cookie.user, json: { agreed: true, videoUrl: storyVideo } });
const coVideoId = r.body?.post?.id;
check('4) company video post', r.status, 201);
await call('/api/saves', { method: 'POST', cookie: cookie.other, json: { kind: 'post', ref: String(videoPostId) } });
// Reels "surat" vaqti joriy soniyadan oldingi — postlar biroz eskiroq bo'lsin.
sqlite.prepare(`UPDATE posts SET created_at = datetime('now', '-1 hour')`).run();
sqlite.prepare(`UPDATE company_posts SET created_at = datetime('now', '-1 hour')`).run();

const feedKinds = async (ck) => ((await call('/api/feed', { cookie: ck })).body?.feed || []).map((x) => `${x.kind}:${x.videoUrl ? 'v' : 'i'}`);
checkTrue('4) off: feed has video', (await feedKinds(cookie.other)).includes('post:v'));
r = await call('/api/reels', { cookie: cookie.other });
checkTrue('4) off: reels has video', (r.body?.items || []).some((x) => x.id === videoPostId));

await setFlags({ videosHidden: true });
const fk = await feedKinds(cookie.other);
checkTrue('4) feed: no video posts/stories', !fk.some((k) => k.endsWith(':v')));
checkTrue('4) feed: image post stays', fk.includes('post:i'));
r = await call('/api/reels', { cookie: cookie.other });
checkTrue('4) reels: no video', !(r.body?.items || []).some((x) => x.videoUrl));
for (const [label, ck] of [['other', cookie.other], ['owner', cookie.user]]) {
  r = await call('/api/records/VIP001/posts', { cookie: ck });
  const ids = (r.body?.posts || []).map((p) => p.id);
  check(`4) profile posts (${label}) hide video, keep image`, [ids.includes(videoPostId), ids.includes(imagePostId)], [false, true]);
}
r = await call('/api/records/VIP001/stories', { cookie: cookie.other });
checkTrue('4) stories: no video', !(r.body?.stories || []).some((x) => x.videoUrl));
for (const [label, ck] of [['other', cookie.other], ['owner', cookie.user], ['anon', undefined]]) {
  const items = await hlItems(ck);
  check(`4) highlight (${label}): video item hidden, image kept`, [items.some((i) => i.videoUrl), items.map((i) => i.storyId)], [false, [imageStoryId]]);
}
r = await call(`/api/highlights/${hlId}`, { method: 'PATCH', cookie: cookie.user, json: { title: 'Video2' } });
check('4) highlight PATCH response hides video', [r.status, r.body?.highlight?.itemCount, (r.body?.highlight?.items || []).some((i) => i.videoUrl)], [200, 1, false]);
r = await call('/api/companies/ACMEUZ/posts', { cookie: cookie.other });
checkTrue('4) company posts: no video', !(r.body?.posts || []).some((x) => x.id === coVideoId));
r = await call('/api/saves?kind=post', { cookie: cookie.other });
checkTrue('4) saved: video post hidden', !JSON.stringify(r.body || {}).includes(storyVideo));
r = await call(`/post/${videoPostId}`);
check('4) post page video -> 404', r.status, 404);
r = await call(`/post/${imagePostId}`);
check('4) post page image -> 200', r.status, 200);
r = await call(storyVideo);
check('4) /uploads video -> 404', r.status, 404);
r = await call(audWebm);
check('4) /uploads aud_ webm still served', r.status, 200);
r = await call(img);
check('4) /uploads image still served', r.status, 200);
r = await call('/api/records/VIP001/videos');
check('4) card videos list empty', r.body?.videos, []);
await setFlags({ videosHidden: false });
r = await call(storyVideo);
check('4) off again: video served', r.status, 200);
check('4) off again: highlight video item back', (await hlItems(cookie.other)).length, 2);

// ═══ 5. reelsHidden ═══
await setFlags({ reelsHidden: true });
r = await call('/api/reels');
check('5) reels hidden', r.body, { items: [], nextCursor: null, hasMore: false, hidden: true });
r = await call('/api/app/config');
check('5) config shows reelsHidden', r.body?.flags?.reelsHidden, true);
await setFlags({ reelsHidden: false });
r = await call('/api/reels');
checkTrue('5) reels back', (r.body?.items || []).length > 0);

done();
