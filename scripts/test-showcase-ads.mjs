// KO'RGAZMA REKLAMASI (api/showcase-ads.js + api/reels.js showcase rejimi).
//   * admin: GET (har kim admin) / PUT, DELETE (manager+), audit, 4 ta joy;
//   * tekshiruv: joy 1..4, tur, raqam, post mavjud va tirik, takror joy yo'q;
//   * lenta: video reklama FAQAT joy orqali, oddiy videoli kadr chiqmaydi,
//     reklama oddiy kadr bo'lib takrorlanmaydi, kursor barqaror; blok,
//     "qiziq emas", pending, o'chirilgan, raqami qayta ishlatilgan,
//     o'chiq joy va `videosHidden` — chiqmaydi; /api/reels ga ta'sir yo'q;
//   * boshlang'ich promo reklama (BOY777, LOL707) — bir marta, dublikatsiz,
//     o'chirilsa qaytmaydi; post sahifasida og:video /promo/...;
//   * Ko'rgazma namunalari 2-to'plami (`showcase_samples_v2`);
//   * promo mp4 assets'dan /uploads ga (iPhone uchun Range/206) — bir marta.
//   node scripts/test-showcase-ads.mjs
import { setupSocial, cookie, makeChecker } from './lib/social-fixture.mjs';
import { sha256Hex } from './lib/d1-harness.mjs';
import {
  seedShowcaseAds, __resetShowcaseAdsCaches, SHOWCASE_ADS_MIGRATION, ADS_COMPANY, PROMO_ADS,
  moveShowcasePromoVideos, PROMO_VIDEO_MIGRATION, promoUploadName,
} from '../hosting/api/showcase-ads.js';
import { seedShowcaseSamples, SAMPLES, SAMPLES_V2, SHOWCASE_SAMPLES_V2_MIGRATION } from '../hosting/api/showcase-samples.js';
import { cleanShowcaseLink } from '../hosting/api/showcase.js';
import { __resetFlagsCache } from '../hosting/api/flags.js';

const { check, checkTrue, done } = makeChecker();
const { env, sqlite, call, addCompany, resetLimits } = await setupSocial();

// content_manager sessiyasi (manager'dan past).
await env.DB.prepare(`INSERT INTO admin_sessions (token, admin_id, role, abs_exp, last_activity) VALUES (?, 3, 'content_manager', '2999-01-01T00:00:00.000Z', ?)`)
  .bind(sha256Hex('cm-token'), new Date().toISOString()).run();
const CM = 'nfc_admin_session=cm-token';

const ts = (minAgo) => new Date(Date.now() - minAgo * 60_000).toISOString().slice(0, 19).replace('T', ' ');
const addPost = (code, userId, { image = null, video = null, minAgo = 10, showcase = true, caption = '' } = {}) => {
  const id = Number(sqlite.prepare(`INSERT INTO posts (code, user_id, image_url, video_url, caption, created_at) VALUES (?,?,?,?,?,?) RETURNING id`)
    .get(code, userId, image, video, caption || `${code} post`, ts(minAgo)).id);
  if (showcase) {
    sqlite.prepare(`INSERT INTO post_extras (post_kind, post_id, music_id, music_start, reel, image_seconds, created_at, showcase, title)
      VALUES ('post', ?, NULL, 0, 0, 10, ?, 1, ?)`).run(id, new Date().toISOString(), `${code} #${id}`);
  }
  return id;
};
const addCPost = (company, { image = null, video = null, minAgo = 10, showcase = true } = {}) => {
  const id = Number(sqlite.prepare(`INSERT INTO company_posts (company_id, image_url, video_url, caption, created_at) VALUES (?,?,?,?,?) RETURNING id`)
    .get(company, image, video, `${company} post`, new Date(Date.now() - minAgo * 60_000).toISOString()).id);
  if (showcase) {
    sqlite.prepare(`INSERT INTO post_extras (post_kind, post_id, music_id, music_start, reel, image_seconds, created_at, showcase, title)
      VALUES ('company_post', ?, NULL, 0, 0, 10, ?, 1, ?)`).run(id, new Date().toISOString(), `${company} #${id}`);
  }
  return id;
};
const put = (slot, json, ck = cookie.admin) => call(`/api/admin/showcase-ads/${slot}`, { method: 'PUT', cookie: ck, json });
const del = (slot, ck = cookie.admin) => call(`/api/admin/showcase-ads/${slot}`, { method: 'DELETE', cookie: ck });
const key = (it) => `${it.authorKind === 'company' ? 'company_post' : 'post'}:${it.id}`;
async function feedAll(limit = 5, ck = undefined, path = '/api/showcase?video=1') {
  const pages = [];
  let cursor = '';
  for (let i = 0; i < 20; i += 1) {
    const r = await call(`${path}${path.includes('?') ? '&' : '?'}limit=${limit}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`, ck ? { cookie: ck } : {});
    if (r.status !== 200) throw new Error(`feed ${r.status} ${JSON.stringify(r.body)}`);
    pages.push(r.body.items);
    cursor = r.body.nextCursor || '';
    if (!r.body.hasMore || !cursor) break;
  }
  return pages;
}
const flat = (pages) => pages.flat();
const ads = (pages) => flat(pages).filter((it) => it.ad);

// ═══ Organik ko'rgazma + videolar ═══
const organic = [
  addPost('VIP001', 1, { image: '/uploads/o1.jpg', minAgo: 30 }),
  addPost('OTH222', 2, { image: '/uploads/o2.jpg', minAgo: 31 }),
  addPost('BIZ777', 1, { image: '/uploads/o3.jpg', minAgo: 32 }),
  addPost('OTH222', 2, { image: '/uploads/o4.jpg', minAgo: 33 }),
  addPost('VIP001', 1, { image: '/uploads/o5.jpg', minAgo: 34 }),
  addPost('BIZ777', 1, { image: '/uploads/o6.jpg', minAgo: 35 }),
].map((id) => `post:${id}`);
const cImg = addCPost('ACMEUZ', { image: '/uploads/c1.jpg', minAgo: 36 });
organic.push(`company_post:${cImg}`);
organic.push(
  `company_post:${addCPost('OTHERCO', { image: '/uploads/c2.jpg', minAgo: 37 })}`,
  `company_post:${addCPost('ACMEUZ', { image: '/uploads/c3.jpg', minAgo: 38 })}`,
  `company_post:${addCPost('OTHERCO', { image: '/uploads/c4.jpg', minAgo: 39 })}`,
  `post:${addPost('OTH222', 2, { image: '/uploads/o7.jpg', minAgo: 39 })}`,
);
// Video: V1 — reklama bo'ladi (OTH222, showcase belgisi YO'Q); V2 — showcase=1
// belgili video (chetlab o'tilgan yozuv) — organik Ko'rgazmaga baribir tushmaydi.
const V1 = addPost('OTH222', 2, { image: '/uploads/v1.jpg', video: '/uploads/v1.mp4', minAgo: 40, showcase: false });
const V2 = addPost('VIP001', 1, { image: '/uploads/v2.jpg', video: '/uploads/v2.mp4', minAgo: 41 });

// ═══ 1. Auth va rollar ═══
check('1) anon GET 401', (await call('/api/admin/showcase-ads')).status, 401);
check('1) user cookie 401', (await call('/api/admin/showcase-ads', { cookie: cookie.user })).status, 401);
let r = await call('/api/admin/showcase-ads', { cookie: cookie.admin });
check('1) admin GET 200 + 4 empty slots', [r.status, r.body?.max, r.body?.slots?.map((s) => [s.slot, s.postId, s.post])],
  [200, 4, [[1, null, null], [2, null, null], [3, null, null], [4, null, null]]]);
check('1) no-store', r.headers.get('cache-control'), 'no-store');
check('1) content_manager GET 200', (await call('/api/admin/showcase-ads', { cookie: CM })).status, 200);
check('1) content_manager PUT 403', (await put(1, { postKind: 'post', postId: V1 }, CM)).status, 403);
check('1) content_manager DELETE 403', (await del(1, CM)).status, 403);
check('1) anon PUT 401', (await call('/api/admin/showcase-ads/1', { method: 'PUT', json: { postKind: 'post', postId: V1 } })).status, 401);
check('1) POST 405', (await call('/api/admin/showcase-ads/1', { method: 'POST', cookie: cookie.admin, json: {} })).status, 405);

// ═══ 2. Tekshiruv ═══
const bad = async (label, slot, json, status, err) => {
  const x = await put(slot, json);
  check(`2) ${label}`, [x.status, x.body?.error], [status, err]);
};
await bad('slot 0', 0, { postKind: 'post', postId: V1 }, 422, 'bad_slot');
await bad('slot 5 (max 4)', 5, { postKind: 'post', postId: V1 }, 422, 'bad_slot');
await bad('slot abc', 'abc', { postKind: 'post', postId: V1 }, 422, 'bad_slot');
await bad('bad kind', 1, { postKind: 'story', postId: V1 }, 422, 'bad_post_kind');
await bad('bad id', 1, { postKind: 'post', postId: -3 }, 422, 'bad_post_id');
await bad('bad id string', 1, { postKind: 'post', postId: '1x' }, 422, 'bad_post_id');
await bad('bad enabled', 1, { postKind: 'post', postId: V1, enabled: 'yes' }, 422, 'bad_enabled');
await bad('missing post', 1, { postKind: 'post', postId: 999999 }, 404, 'post_not_found');
await bad('missing company post', 1, { postKind: 'company_post', postId: 999999 }, 404, 'post_not_found');
// Tekshiruv kutayotgan post — tirik emas.
const P = addPost('VIP001', 1, { image: '/uploads/pend.jpg', minAgo: 50, showcase: false });
sqlite.prepare(`INSERT INTO content_pending (kind, id, url, created_at) VALUES ('post', ?, '/uploads/pend.jpg', ?)`).run(P, new Date().toISOString());
await bad('pending post', 1, { postKind: 'post', postId: P }, 422, 'post_not_live');
// Faol bo'lmagan kompaniya posti.
addCompany('SLEEPCO', 2, { status: 'pending' });
const sleepy = addCPost('SLEEPCO', { image: '/uploads/s.jpg', showcase: false });
await bad('inactive company', 1, { postKind: 'company_post', postId: sleepy }, 422, 'post_not_live');
check('2) nothing stored', sqlite.prepare(`SELECT COUNT(*) AS n FROM showcase_ads`).get().n, 0);

// ═══ 3. O'rnatish ═══
r = await put(1, { postKind: 'post', postId: V1 }, cookie.manager);
check('3) manager PUT slot1 = video post', [r.status, r.body?.ok], [200, true]);
const s1 = r.body.slots[0];
check('3) preview', [s1.slot, s1.postKind, s1.postId, s1.enabled, s1.post.exists, s1.post.live, s1.post.code, s1.post.videoUrl, s1.post.imageUrl, s1.post.name],
  [1, 'post', V1, true, true, true, 'OTH222', '/uploads/v1.mp4', '/uploads/v1.jpg', 'Boshqa']);
checkTrue('3) updated_by recorded', /^admin#\d+:manager$/.test(s1.updatedBy || ''));
r = await put(2, { postKind: 'company_post', postId: cImg });
check('3) slot2 = organic company image', r.status, 200);
check('3) title preview', r.body.slots[1].post.title, `ACMEUZ #${cImg}`);
r = await put(3, { postKind: 'post', postId: V1 });
check('3) same post in another slot -> 409', [r.status, r.body?.error, r.body?.slot], [409, 'already_in_slot', 1]);
const audit = sqlite.prepare(`SELECT action, details FROM admin_activity_log WHERE action = 'showcase_ad_set' ORDER BY id`).all();
check('3) audit', audit.map((a) => a.details), [`slot=1 post:${V1} enabled=1`, `slot=2 company_post:${cImg} enabled=1`]);
let sqlErr = '';
try { sqlite.prepare(`INSERT INTO showcase_ads (slot, post_kind, post_id) VALUES (5, 'post', 1)`).run(); } catch (e) { sqlErr = String(e.message); }
checkTrue('3) CHECK slot<=4 in schema', /CHECK/i.test(sqlErr));

// ═══ 4. Lenta ═══
let pages = await feedAll(5);
let items = flat(pages);
const keys = items.map(key);
check('4) no duplicates', keys.length, new Set(keys).size);
check('4) every organic image once (slot2 only as ad)', organic.filter((k) => k !== `company_post:${cImg}`).every((k) => keys.filter((x) => x === k).length === 1), true);
check('4) organic video V2 excluded', keys.includes(`post:${V2}`), false);
const a = ads(pages);
check('4) two ads, slot order', a.map((it) => [key(it), it.adSlot, it.featured, it.ad]), [[`post:${V1}`, 1, true, true], [`company_post:${cImg}`, 2, true, true]]);
check('4) ad at position 4 of page 1 and 2', [pages[0][4] && key(pages[0][4]), pages[1][4] && key(pages[1][4])], [`post:${V1}`, `company_post:${cImg}`]);
check('4) video ad has videoUrl + mediaItems', [a[0].videoUrl, a[0].mediaItems?.[0]?.type, a[0].kind, a[0].code], ['/uploads/v1.mp4', 'video', 'post', 'OTH222']);
checkTrue('4) organic items not ad', items.filter((it) => !it.ad).every((it) => it.featured === undefined && it.adSlot === undefined));
checkTrue('4) never at position 0', pages.every((p) => !p[0]?.ad));
// Eski ilova (`video=1` yo'q): video reklama yo'q, rasmli reklama bor.
const oldApp = await feedAll(5, undefined, '/api/showcase');
check('4) old app: only image ad', ads(oldApp).map((it) => it.adSlot), [2]);
checkTrue('4) old app: no video at all', flat(oldApp).every((it) => !it.videoUrl));
check('4) video=0 same as old app', ads(await feedAll(5, undefined, '/api/showcase?video=0')).map((it) => it.adSlot), [2]);
// Asosiy ekran kartochkasi: /api/showcase/ads — faqat joylar, slot tartibida.
r = await call('/api/showcase/ads?video=1');
check('4) home ads: slots only, in order', [r.status, r.body.items.map((it) => [it.adSlot, it.ad, it.featured]), r.body.hasMore, r.body.nextCursor],
  [200, [[1, true, true], [2, true, true]], false, null]);
check('4) home ads: video ad has videoUrl', r.body.items[0].videoUrl, '/uploads/v1.mp4');
r = await call('/api/showcase/ads');
check('4) home ads old app: image only', r.body.items.map((it) => it.adSlot), [2]);
r = await call('/api/showcase/ads?video=1&limit=1');
check('4) home ads limit', r.body.items.map((it) => it.adSlot), [1]);
check('4) home ads POST -> 405', (await call('/api/showcase/ads', { method: 'POST', json: {} })).status, 405);
// /api/reels — reklama joylari ta'sir qilmaydi.
const reels = flat(await feedAll(10, undefined, '/api/reels'));
checkTrue('4) /api/reels has no showcase ad items', reels.every((it) => !it.ad));
// Bir sahifada hammasi (limit 20) — reklama 4-o'rinda, ikkinchisi 9-o'rinda.
r = await call('/api/showcase?video=1&limit=20');
check('4) single page: ads at 4 and 9', [r.body.items[4]?.adSlot, r.body.items[9]?.adSlot], [1, 2]);

// ═══ 5. Kalit, o'chiq joy, blok, qiziq emas, pending, o'chirilgan ═══
r = await call('/api/admin/flags', { method: 'PUT', cookie: cookie.admin, json: { videosHidden: true } });
check('5) videosHidden on', r.status, 200);
check('5) videosHidden: video ad skipped, image ad stays', ads(await feedAll(5)).map((it) => it.adSlot), [2]);
await call('/api/admin/flags', { method: 'PUT', cookie: cookie.admin, json: { videosHidden: false } });
__resetFlagsCache();
check('5) videosHidden off: back', ads(await feedAll(5)).map((it) => it.adSlot), [1, 2]);

r = await put(1, { enabled: false });
check('5) disable slot1 (no body post)', [r.status, r.body.slots[0].enabled, r.body.slots[0].postId], [200, false, V1]);
check('5) disabled slot skipped', ads(await feedAll(5)).map((it) => it.adSlot), [2]);
check('5) enable again', (await put(1, { enabled: true })).status, 200);

check('5) user blocks OTH222', (await call('/api/blocks', { method: 'POST', cookie: cookie.user, json: { kind: 'record', id: 'OTH222' } })).status, 200);
check('5) blocked author ad skipped for blocker', ads(await feedAll(5, cookie.user)).map((it) => it.adSlot), [2]);
check('5) other viewers still see it', ads(await feedAll(5, cookie.other)).map((it) => it.adSlot), [1, 2]);
await call('/api/blocks', { method: 'DELETE', cookie: cookie.user, json: { kind: 'record', id: 'OTH222' } });
sqlite.prepare(`DELETE FROM user_blocks`).run();

check('5) hide (qiziq emas) slot2 post', (await call('/api/reels/hide', { method: 'POST', cookie: cookie.user, json: { kind: 'company_post', id: cImg } })).status, 200);
check('5) hidden ad skipped for that viewer', ads(await feedAll(5, cookie.user)).map((it) => it.adSlot), [1]);
sqlite.prepare(`DELETE FROM reel_hidden`).run();

sqlite.prepare(`INSERT INTO content_pending (kind, id, url, created_at) VALUES ('post', ?, '/uploads/v1.mp4', ?)`).run(V1, new Date().toISOString());
check('5) pending ad skipped', ads(await feedAll(5)).map((it) => it.adSlot), [2]);
r = await call('/api/admin/showcase-ads', { cookie: cookie.admin });
check('5) preview: exists but not live', [r.body.slots[0].post.exists, r.body.slots[0].post.live], [true, false]);
sqlite.prepare(`DELETE FROM content_pending WHERE id = ? AND kind = 'post'`).run(V1);

// O'chirilgan post, keyin raqami boshqa odamning postiga berilgan.
const v1Row = sqlite.prepare(`SELECT * FROM posts WHERE id = ?`).get(V1);
sqlite.prepare(`DELETE FROM posts WHERE id = ?`).run(V1);
check('5) deleted ad skipped', ads(await feedAll(5)).map((it) => it.adSlot), [2]);
r = await call('/api/admin/showcase-ads', { cookie: cookie.admin });
check('5) preview: deleted -> exists false', [r.body.slots[0].post.exists, r.body.slots[0].post.live], [false, false]);
sqlite.prepare(`INSERT INTO posts (id, code, user_id, image_url, video_url, caption, created_at) VALUES (?,?,?,?,?,?,?)`)
  .run(V1, 'VIP001', 1, '/uploads/reuse.jpg', '/uploads/reuse.mp4', 'boshqa post', ts(1));
check('5) reused id (other post) not advertised', ads(await feedAll(5)).map((it) => it.adSlot), [2]);
r = await call('/api/admin/showcase-ads', { cookie: cookie.admin });
check('5) preview: reused id -> exists false', r.body.slots[0].post.exists, false);
r = await put(1, { enabled: true });
check('5) re-enable same slot on reused id -> 409', [r.status, r.body?.error], [409, 'post_changed']);
sqlite.prepare(`DELETE FROM posts WHERE id = ?`).run(V1);
sqlite.prepare(`INSERT INTO posts (id, code, user_id, image_url, video_url, caption, created_at) VALUES (?,?,?,?,?,?,?)`)
  .run(v1Row.id, v1Row.code, v1Row.user_id, v1Row.image_url, v1Row.video_url, v1Row.caption, v1Row.created_at);
check('5) original back -> shown', ads(await feedAll(5)).map((it) => it.adSlot), [1, 2]);

// Kursor barqaror: 1-sahifadan keyin joy o'zgarsa ham zanjir buzilmaydi.
const p1 = await call('/api/showcase?video=1&limit=5');
await put(1, { enabled: false });
const p2 = await call(`/api/showcase?video=1&limit=5&cursor=${encodeURIComponent(p1.body.nextCursor)}`);
const both = [...p1.body.items, ...p2.body.items].map(key);
check('5) cursor: no duplicate after slot change', both.length, new Set(both).size);
checkTrue('5) cursor: disabled slot not served later', !p2.body.items.some((it) => it.adSlot === 1));
await put(1, { enabled: true });

// ═══ 6. O'chirish ═══
r = await del(2);
check('6) DELETE slot2', [r.status, r.body.slots[1].postId], [200, null]);
const rm = sqlite.prepare(`SELECT details FROM admin_activity_log WHERE action = 'showcase_ad_remove'`).get();
check('6) audit remove', rm?.details, `slot=2 company_post:${cImg}`);
items = flat(await feedAll(5));
check('6) removed slot post back as organic', items.filter((it) => key(it) === `company_post:${cImg}`).map((it) => !!it.ad), [false]);
check('6) DELETE empty slot ok', (await del(3)).status, 200);
check('6) table rows', sqlite.prepare(`SELECT COUNT(*) AS n FROM showcase_ads`).get().n, 1);
// 4 tadan ortig'i yo'q.
const extra = [addPost('VIP001', 1, { image: '/uploads/x1.jpg', minAgo: 60, showcase: false }),
  addPost('VIP001', 1, { image: '/uploads/x2.jpg', minAgo: 61, showcase: false }),
  addPost('VIP001', 1, { image: '/uploads/x3.jpg', minAgo: 62, showcase: false })];
for (const [i, id] of extra.entries()) check(`6) fill slot ${i + 2}`, (await put(i + 2, { postKind: 'post', postId: id })).status, 200);
check('6) 4 slots max', sqlite.prepare(`SELECT COUNT(*) AS n FROM showcase_ads`).get().n, 4);
r = await call('/api/showcase?video=1&limit=20');
check('6) per-page ad limit (2)', r.body.items.filter((it) => it.ad).length, 2);
resetLimits();

// ═══ 7. Boshlang'ich promo reklama ═══
sqlite.prepare(`DELETE FROM showcase_ads`).run();
// Kompaniya yo'q — hech narsa.
__resetShowcaseAdsCaches();
r = await seedShowcaseAds(env);
check('7) no company', [r.applied, r.reason], [false, 'no_company']);
check('7) no marker', sqlite.prepare(`SELECT COUNT(*) AS n FROM app_migrations WHERE name = ?`).get(SHOWCASE_ADS_MIGRATION).n, 0);
addCompany(ADS_COMPANY, 1, { name: 'NFCSTORE' });
const nowIso = new Date().toISOString();
sqlite.prepare(`INSERT INTO music_tracks (id, title, artist, audio_url, enabled, created_at, updated_at) VALUES (28, 'Silk Road Fire', 'x', '/uploads/music_a.mp3', 1, ?, ?)`).run(nowIso, nowIso);
sqlite.prepare(`INSERT INTO music_tracks (id, title, artist, audio_url, enabled, created_at, updated_at) VALUES (2, 'Yurak', 'x', '/uploads/music_b.mp3', 0, ?, ?)`).run(nowIso, nowIso);
// GET /api/showcase seed'ni ishga tushiradi.
pages = await feedAll(5);
const seededPosts = sqlite.prepare(`SELECT cp.id, cp.video_url, cp.image_url, cp.caption, cp.created_at, pe.showcase, pe.title, pe.link_url, pe.music_id
  FROM company_posts cp JOIN post_extras pe ON pe.post_kind = 'company_post' AND pe.post_id = cp.id
  WHERE cp.company_id = ? ORDER BY cp.id`).all(ADS_COMPANY);
check('7) 2 promo posts', seededPosts.length, 2);
const boy = seededPosts.find((p) => p.title === 'BOY777 — premium NFC ID');
const lol = seededPosts.find((p) => p.title === 'LOL707 — chiroyli NFC ID');
check('7) BOY777', [boy?.video_url, boy?.image_url, boy?.showcase, boy?.link_url, boy?.music_id],
  ['/promo/nfcstore-boy777.mp4', '/promo/nfcstore-boy777.jpg', 1, 'https://www.instagram.com/reel/Ddy4e1cjVY9/', 28]);
check('7) LOL707 (music disabled -> null)', [lol?.video_url, lol?.image_url, lol?.showcase, lol?.link_url, lol?.music_id],
  ['/promo/nfcstore-lol707.mp4', '/promo/nfcstore-lol707.jpg', 1, 'https://www.instagram.com/reel/Ddtu3-Njf5i/', null]);
check('7) captions', [boy?.caption, lol?.caption], [PROMO_ADS[0].caption, PROMO_ADS[1].caption]);
checkTrue('7) caption text', boy?.caption.startsWith('Telefonga tekkizing — profilingiz ochiladi. BOY777') && lol?.caption.includes('LOL707 kabi chiroyli'));
checkTrue('7) timestamps slightly in the past', [boy, lol].every((p) => { const age = Date.now() - Date.parse(p.created_at); return age > 0 && age < 10 * 60_000; }));
checkTrue('7) BOY777 newer than LOL707', Date.parse(boy.created_at) > Date.parse(lol.created_at));
check('7) slots 1,2', sqlite.prepare(`SELECT slot, post_kind, post_id, enabled FROM showcase_ads ORDER BY slot`).all().map((x) => [x.slot, x.post_kind, x.post_id, x.enabled]),
  [[1, 'company_post', boy.id, 1], [2, 'company_post', lol.id, 1]]);
check('7) reel links accepted by cleanShowcaseLink', PROMO_ADS.map((x) => cleanShowcaseLink(x.linkUrl)), PROMO_ADS.map((x) => x.linkUrl));
let adItems = ads(pages);
check('7) feed: promo ads in slot order', adItems.map((it) => [it.adSlot, it.id, it.videoUrl, it.imageUrl, it.title, it.showcase, it.code, it.authorKind]), [
  [1, boy.id, '/promo/nfcstore-boy777.mp4', '/promo/nfcstore-boy777.jpg', 'BOY777 — premium NFC ID', true, ADS_COMPANY, 'company'],
  [2, lol.id, '/promo/nfcstore-lol707.mp4', '/promo/nfcstore-lol707.jpg', 'LOL707 — chiroyli NFC ID', true, ADS_COMPANY, 'company'],
]);
check('7) music on BOY777 ad', adItems[0].music?.id, 28);
check('7) linkUrl on ad', adItems[0].linkUrl, 'https://www.instagram.com/reel/Ddy4e1cjVY9/');
check('7) promo video not organic', flat(pages).filter((it) => it.videoUrl.startsWith('/promo/')).every((it) => it.ad), true);
// Joy o'chirilsa — video post Ko'rgazmaga oddiy kadr bo'lib tushmaydi.
await put(1, { enabled: false });
checkTrue('7) disabled promo slot: video not in showcase at all', !flat(await feedAll(5)).some((it) => it.id === boy.id && it.authorKind === 'company'));
await put(1, { enabled: true });
// Post sahifasi: og:video mutlaq /promo manzili.
let res = await call(`/post/${boy.id}?code=${ADS_COMPANY}&company=1`);
check('7) post page 200', res.status, 200);
checkTrue('7) og:video absolute /promo', String(res.body).includes('<meta property="og:video" content="https://nfcstore.uz/promo/nfcstore-boy777.mp4">'));
checkTrue('7) poster absolute /promo', String(res.body).includes('poster="https://nfcstore.uz/promo/nfcstore-boy777.jpg"'));
// Qisqa lenta: oddiy kadrlar 4-o'ringacha yetmasa ham reklama ko'rinadi.
sqlite.prepare(`DELETE FROM post_extras WHERE NOT (post_kind = 'company_post'
  AND post_id IN (SELECT id FROM company_posts WHERE company_id = ?))`).run(ADS_COMPANY);
const lone = addPost('VIP001', 1, { image: '/uploads/lone.jpg', minAgo: 5 });
r = await call('/api/showcase?video=1&limit=10');
check('7) short feed: organic then ads at tail', r.body.items.map((it) => (it.ad ? `ad${it.adSlot}` : key(it))), [`post:${lone}`, 'ad1', 'ad2']);
check('7) short feed: hasMore false', [r.body.hasMore, r.body.nextCursor], [false, null]);
sqlite.prepare(`DELETE FROM posts WHERE id = ?`).run(lone);
r = await call('/api/showcase?video=1&limit=10');
check('7) empty organic feed: no ads alone', r.body.items.length, 0);

// Qayta — dublikat yo'q (shu isolate va "yangi isolate").
r = await seedShowcaseAds(env);
check('7) cached', r.applied, false);
__resetShowcaseAdsCaches();
r = await seedShowcaseAds(env);
check('7) marker -> once', [r.applied, sqlite.prepare(`SELECT COUNT(*) AS n FROM company_posts WHERE company_id = ?`).get(ADS_COMPANY).n], [false, 2]);
// Egasi o'chirsa — qaytmaydi.
sqlite.prepare(`DELETE FROM company_posts WHERE company_id = ?`).run(ADS_COMPANY);
__resetShowcaseAdsCaches();
await call('/api/showcase?video=1&limit=10');
check('7) not recreated', sqlite.prepare(`SELECT COUNT(*) AS n FROM company_posts WHERE company_id = ?`).get(ADS_COMPANY).n, 0);
check('7) slots of deleted posts not served', ads(await feedAll(5)).length, 0);

// Band joyga tegmaydi: yangi bazada emas — marker o'chirilib qayta sinaladi.
sqlite.prepare(`DELETE FROM app_migrations WHERE name = ?`).run(SHOWCASE_ADS_MIGRATION);
sqlite.prepare(`DELETE FROM showcase_ads`).run();
const keep = addPost('VIP001', 1, { image: '/uploads/keep.jpg', minAgo: 3, showcase: false });
check('7) admin occupies slot1', (await put(1, { postKind: 'post', postId: keep })).status, 200);
__resetShowcaseAdsCaches();
r = await seedShowcaseAds(env);
check('7) seed with slot1 taken -> other free slots', [r.applied, r.slots?.slice().sort()], [true, [2, 3]]);
check('7) admin slot1 untouched', sqlite.prepare(`SELECT post_kind, post_id FROM showcase_ads WHERE slot = 1`).get(), { post_kind: 'post', post_id: keep });

// ═══ 8. Ko'rgazma namunalari — 2-to'plam ═══
const v2Rows = () => sqlite.prepare(`SELECT COUNT(*) AS n FROM app_migrations WHERE name = ?`).get(SHOWCASE_SAMPLES_V2_MIGRATION).n;
r = await seedShowcaseSamples(env);
check('8) no catalog -> nothing', [r.applied, r.batches?.[SHOWCASE_SAMPLES_V2_MIGRATION]?.reason, v2Rows()], [false, 'no_catalog_item', 0]);
for (const s of [...SAMPLES, ...SAMPLES_V2]) {
  sqlite.prepare(`INSERT INTO company_catalog_items (id, company_id, name, price, image_url, available, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?)`).run(s.catalogItemId, ADS_COMPANY, s.title, 0, s.mediaUrls[0], 1, nowIso, nowIso);
}
sqlite.prepare(`INSERT INTO music_tracks (id, title, artist, audio_url, enabled, created_at, updated_at) VALUES (62, 'T62', 'x', '/uploads/music_c.mp3', 1, ?, ?)`).run(nowIso, nowIso);
r = await seedShowcaseSamples(env);
check('8) v1 + v2 applied', [r.applied, r.created?.length, r.batches?.[SHOWCASE_SAMPLES_V2_MIGRATION]?.created?.length], [true, 5, 2]);
const v2Posts = sqlite.prepare(`SELECT cp.video_url, cp.media_json, cp.image_url, pe.showcase, pe.title, pe.link_url, pe.catalog_item_id, pe.music_id, pe.image_seconds, pe.price_uzs, cp.caption
  FROM company_posts cp JOIN post_extras pe ON pe.post_kind = 'company_post' AND pe.post_id = cp.id
  WHERE cp.company_id = ? AND pe.title IN (?, ?) ORDER BY cp.id`).all(ADS_COMPANY, SAMPLES_V2[0].title, SAMPLES_V2[1].title);
check('8) 2 v2 posts', v2Posts.length, 2);
const acc = v2Posts.find((p) => p.title === SAMPLES_V2[0].title);
const car = v2Posts.find((p) => p.title === SAMPLES_V2[1].title);
check('8) accessories', [acc.video_url, JSON.parse(acc.media_json).map((m) => m.url), acc.link_url, acc.catalog_item_id, acc.music_id, acc.image_seconds, acc.price_uzs],
  [null, SAMPLES_V2[0].mediaUrls, 'https://www.instagram.com/nfcstore.uz', '5a080c62-4874-463c-a8e2-e07129e24b75', 62, 4, null]);
check('8) car sticker (music 58 missing -> null)', [car.video_url, JSON.parse(car.media_json).map((m) => m.url), car.link_url, car.catalog_item_id, car.music_id, car.image_seconds],
  [null, SAMPLES_V2[1].mediaUrls, 'https://www.youtube.com/shorts/KEKnJWig840', '9b5d9b47-6b6d-4116-9803-1af864b869b5', null, 4]);
checkTrue('8) captions', acc.caption.startsWith('Uzuk, braslet yoki brelok') && car.caption.includes("Ehtiyot qilib qo'yilgan mashina") && car.caption.endsWith('🌐 nfcstore.uz'));
check('8) v2 marker', v2Rows(), 1);
r = await seedShowcaseSamples({ ...env, DB: env.DB });
check('8) again -> no duplicates', [r.applied, sqlite.prepare(`SELECT COUNT(*) AS n FROM post_extras WHERE title IN (?, ?)`).get(SAMPLES_V2[0].title, SAMPLES_V2[1].title).n], [false, 2]);
items = flat(await feedAll(10));
check('8) v2 in showcase feed as ordinary items', items.filter((it) => SAMPLES_V2.some((s) => s.title === it.title)).map((it) => !!it.ad), [false, false]);
sqlite.prepare(`DELETE FROM company_posts WHERE id IN (SELECT post_id FROM post_extras WHERE post_kind = 'company_post' AND title IN (?, ?))`).run(SAMPLES_V2[0].title, SAMPLES_V2[1].title);
await call('/api/showcase?video=1&limit=10');
check('8) deleted v2 not recreated', sqlite.prepare(`SELECT COUNT(*) AS n FROM company_posts cp JOIN post_extras pe ON pe.post_kind = 'company_post' AND pe.post_id = cp.id WHERE pe.title IN (?, ?)`).get(SAMPLES_V2[0].title, SAMPLES_V2[1].title).n, 0);

// ═══ 9. Promo mp4 → /uploads (iPhone AVPlayer Range talab qiladi) ═══
check('9) names', PROMO_ADS.map((a) => promoUploadName(a.videoUrl)), ['promo_boy777.mp4', 'promo_lol707.mp4']);
const promoPosts = () => sqlite.prepare(`SELECT video_url FROM company_posts WHERE company_id = ? AND video_url IS NOT NULL ORDER BY id`).all(ADS_COMPANY).map((x) => x.video_url);
const beforeMove = promoPosts();
checkTrue('9) before: /promo urls', beforeMove.length === 2 && beforeMove.every((u) => u.startsWith('/promo/')));
const realAssets = env.ASSETS;
// Assets 404 — belgi yo'q, keyinroq qayta. (Lenta so'rovlari allaqachon
// urinib ko'rgan — keshni tozalab, birinchi urinishni aniq tekshiramiz.)
__resetShowcaseAdsCaches();
r = await moveShowcasePromoVideos(env);
check('9) asset 404 -> retry later', [r.applied, r.reason], [false, 'asset_404']);
r = await moveShowcasePromoVideos(env);
check('9) within retry window', r.reason, 'retry_later');
check('9) no marker, urls unchanged', [sqlite.prepare(`SELECT COUNT(*) AS n FROM app_migrations WHERE name = ?`).get(PROMO_VIDEO_MIGRATION).n, promoPosts()], [0, beforeMove]);
// HTML (SPA fallback) mp4 emas — qabul qilinmaydi.
env.ASSETS = { fetch: async () => new Response('<html></html>', { status: 200, headers: { 'content-type': 'text/html' } }) };
r = await moveShowcasePromoVideos(env, { now: new Date(Date.now() + 11 * 60_000) });
check('9) html fallback rejected', [r.applied, r.reason], [false, 'asset_200']);
const fakeMp4 = (tag) => { const b = new Uint8Array(4096); b.set([0, 0, 0, 24, 102, 116, 121, 112]); b[100] = tag; return b; };
const assetHits = [];
env.ASSETS = { fetch: async (req) => {
  const u = new URL(req.url).pathname; assetHits.push(u);
  return new Response(fakeMp4(u.includes('boy') ? 1 : 2), { status: 200, headers: { 'content-type': 'video/mp4' } });
} };
r = await moveShowcasePromoVideos(env, { now: new Date(Date.now() + 22 * 60_000) });
check('9) moved', [r.applied, r.moved?.map((m) => [m.from, m.to, m.posts])], [true, [
  ['/promo/nfcstore-boy777.mp4', '/uploads/promo_boy777.mp4', 1], ['/promo/nfcstore-lol707.mp4', '/uploads/promo_lol707.mp4', 1]]]);
check('9) assets read once each', assetHits, ['/promo/nfcstore-boy777.mp4', '/promo/nfcstore-lol707.mp4']);
check('9) posts now /uploads', promoPosts().slice().sort(), ['/uploads/promo_boy777.mp4', '/uploads/promo_lol707.mp4']);
const h = await env.UPLOADS.head('uploads/promo_boy777.mp4');
check('9) stored size', h?.size, 4096);
res = await call('/uploads/promo_boy777.mp4', { headers: { Range: 'bytes=0-7' } });
check('9) /uploads Range -> 206', [res.status, res.headers.get('content-range')], [206, 'bytes 0-7/4096']);
items = flat(await feedAll(10));
checkTrue('9) feed ad videos from /uploads', items.filter((it) => it.ad && it.videoUrl).length > 0
  && items.filter((it) => it.ad && it.videoUrl).every((it) => it.videoUrl.startsWith('/uploads/promo_')));
checkTrue('9) poster stays /promo jpg', items.filter((it) => it.ad && it.videoUrl).every((it) => it.imageUrl.startsWith('/promo/') && it.imageUrl.endsWith('.jpg')));
// Bir marta: shu isolate va yangi isolate.
r = await moveShowcasePromoVideos(env);
check('9) cached', [r.applied, r.reason], [false, 'cached']);
__resetShowcaseAdsCaches();
r = await moveShowcasePromoVideos(env);
check('9) marker -> once', [r.applied, assetHits.length], [false, 2]);
// Fayl allaqachon omborda bo'lsa — assets'dan qayta o'qilmaydi.
sqlite.prepare(`DELETE FROM app_migrations WHERE name = ?`).run(PROMO_VIDEO_MIGRATION);
__resetShowcaseAdsCaches();
r = await moveShowcasePromoVideos(env);
check('9) re-run: no asset reads, no posts left on /promo', [r.applied, assetHits.length, r.moved?.map((m) => m.posts)], [true, 2, [0, 0]]);
env.ASSETS = realAssets;

done();
