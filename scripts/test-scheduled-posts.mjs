// REJALASHTIRILGAN POSTLAR (hosting/api/scheduled-posts.js).
//
// Tekshiriladi: `publishAt` tekshiruvi (o'tgan, 30 kundan uzoq, buzuq);
// rejadagi post egasidan boshqa HECH KIMGA ko'rinmaydi — lenta, profil va
// kompaniya ro'yxati, post soni, layk, izoh, ko'rish, /post/:id sahifasi,
// featured (pullik ko'tarish), saqlanganlar; egasi uni `scheduledFor`
// bilan ko'radi; vaqti kelgach post lentada YANGI bo'lib chiqadi (tartib
// `publish_at` bo'yicha); eski mijoz (publishAt yo'q) o'zgarmaydi; issiq
// yo'llarga yangi ketma-ket to'lqin qo'shilmagan.
//
//   node scripts/test-scheduled-posts.mjs
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { setupSocial, cookie, makeChecker } from './lib/social-fixture.mjs';
import { parsePublishAt, scheduledForMs } from '../hosting/api/scheduled-posts.js';

const { check, checkTrue, done } = makeChecker();
const { sqlite, call, resetLimits } = await setupSocial({ PAYMENTS_ENABLED: 'true', PAYME_MERCHANT_ID: 'test_merchant_local_only', PAYME_KEY: 'test_payme_key_local_only' });

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const iso = (ms) => new Date(ms).toISOString();
const sqlTs = (ms) => iso(ms).slice(0, 19).replace('T', ' ');
const post = (json, ck = cookie.user) => call('/api/records/VIP001/posts', { method: 'POST', cookie: ck, json: { agreed: true, imageUrl: '/uploads/sch1abc.jpg', ...json } });
const cpost = (json, ck = cookie.user) => call('/api/companies/ACMEUZ/posts', { method: 'POST', cookie: ck, json: { agreed: true, imageUrl: '/uploads/sch2abc.jpg', ...json } });

// ── 0) Yordamchi funksiya ──────────────────────────────────────────
{
  const now = Date.parse('2026-10-05T10:00:00Z');
  check('0) yo‘q — darhol', parsePublishAt(undefined, now), { ok: true, ms: null });
  check('0) null — darhol', parsePublishAt(null, now), { ok: true, ms: null });
  check('0) o‘tgan vaqt', parsePublishAt('2026-10-05T09:59:59Z', now).error, 'publish_at_past');
  check('0) hozirgi vaqt', parsePublishAt(now, now).error, 'publish_at_past');
  check('0) 31 kun', parsePublishAt(iso(now + 31 * DAY), now).error, 'publish_at_too_far');
  check('0) 30 kun — mumkin', parsePublishAt(iso(now + 30 * DAY), now).ok, true);
  check('0) buzuq', parsePublishAt('ertaga', now).error, 'bad_publish_at');
  check('0) obyekt', parsePublishAt({}, now).error, 'bad_publish_at');
  check('0) mintaqali ISO', parsePublishAt('2026-10-05T15:30:00+05:00', now).ms, Date.parse('2026-10-05T10:30:00Z'));
  check('0) ms son', parsePublishAt(now + HOUR, now).ms, now + HOUR);
  check('0) scheduledFor: posts formati', scheduledForMs('2999-01-01 00:00:00', now), Date.parse('2999-01-01T00:00:00Z'));
  check('0) scheduledFor: o‘tgan — null', scheduledForMs('2020-01-01 00:00:00', now), null);
}

// ── 1) Tekshiruv (API) ─────────────────────────────────────────────
const before = sqlite.prepare(`SELECT COUNT(*) AS n FROM posts`).get().n;
for (const [label, v, err] of [
  ['o‘tgan', iso(Date.now() - HOUR), 'publish_at_past'],
  ['31 kun', iso(Date.now() + 31 * DAY), 'publish_at_too_far'],
  ['buzuq', 'kecha', 'bad_publish_at'],
]) {
  let r = await post({ publishAt: v });
  check(`1) shaxsiy ${label}: 422 ${err}`, [r.status, r.body?.error], [422, err]);
  r = await cpost({ publishAt: v });
  check(`1) biznes ${label}: 422 ${err}`, [r.status, r.body?.error], [422, err]);
}
check('1) rad etilganda post yozilmadi', sqlite.prepare(`SELECT COUNT(*) AS n FROM posts`).get().n, before);
let r = await post({ publishAt: iso(Date.now() + 31 * DAY) });
check('1) chegara javobda', r.body?.maxDays, 30);

// ── 2) Rejadagi post yaratish ──────────────────────────────────────
const when = Math.floor((Date.now() + 2 * HOUR) / 1000) * 1000;
r = await post({ publishAt: iso(when), caption: 'reja shaxsiy' });
check('2) shaxsiy reja: 201, scheduledFor', [r.status, r.body.scheduledFor, r.body.createdAt], [201, when, when]);
const sId = r.body.id;
check('2) bazada posts formati', sqlite.prepare(`SELECT publish_at FROM posts WHERE id = ?`).get(sId).publish_at, sqlTs(when));
r = await cpost({ publishAt: iso(when), caption: 'reja biznes' });
check('2) biznes reja: 201, scheduledFor', [r.status, r.body.post.scheduledFor], [201, when]);
const cId = r.body.post.id;
check('2) bazada ISO formati', sqlite.prepare(`SELECT publish_at FROM company_posts WHERE id = ?`).get(cId).publish_at, iso(when));
r = await post({ caption: 'oddiy' });
check('2) eski mijoz: scheduledFor yo‘q', [r.status, 'scheduledFor' in r.body], [201, false]);
const liveId = r.body.id;
r = await cpost({ caption: 'oddiy biznes' });
const cLiveId = r.body.post.id;

// ── 3) Begonaga ko'rinmaydi ────────────────────────────────────────
const feedHas = (body, kind, id) => (body.feed || []).some((f) => f.authorKind === kind && f.id === id);
for (const [who, ck] of [['mehmon', undefined], ['boshqa odam', cookie.other]]) {
  r = await call('/api/feed?limit=30', { cookie: ck });
  checkTrue(`3) ${who}: lentada rejadagi shaxsiy post yo‘q`, !feedHas(r.body, 'card', sId));
  checkTrue(`3) ${who}: lentada rejadagi biznes posti yo‘q`, !feedHas(r.body, 'company', cId));
  checkTrue(`3) ${who}: oddiy postlar bor`, feedHas(r.body, 'card', liveId) && feedHas(r.body, 'company', cLiveId));
  r = await call('/api/records/VIP001/posts', { cookie: ck });
  checkTrue(`3) ${who}: profil ro‘yxatida yo‘q`, !r.body.posts.some((p) => p.id === sId));
  r = await call('/api/companies/ACMEUZ/posts', { cookie: ck });
  checkTrue(`3) ${who}: kompaniya ro‘yxatida yo‘q`, !r.body.posts.some((p) => p.id === cId));
  r = await call(`/api/comments/post/${sId}`, { cookie: ck });
  check(`3) ${who}: izohlar 404`, r.status, 404);
  r = await call(`/api/comments/company_post/${cId}`, { cookie: ck });
  check(`3) ${who}: biznes izohlari 404`, r.status, 404);
  r = await call(`/api/content-likes/company_post/${cId}`, { cookie: ck });
  check(`3) ${who}: biznes layk soni 404`, r.status, 404);
  r = await call(`/api/content-views/post/${sId}`, { method: 'POST', cookie: ck });
  check(`3) ${who}: ko‘rish 404`, r.status, 404);
}
r = await call(`/api/posts/${sId}/like`, { method: 'POST', cookie: cookie.other });
check('3) layk 404', r.status, 404);
r = await call(`/api/comments/post/${sId}`, { method: 'POST', cookie: cookie.other, json: { body: 'salom' } });
check('3) izoh yozish 404', r.status, 404);
r = await call(`/api/content-likes/company_post/${cId}`, { method: 'POST', cookie: cookie.other });
check('3) biznes layk 404', r.status, 404);
r = await call(`/post/${sId}`);
check('3) /post/:id sahifasi 404', r.status, 404);
r = await call(`/post/${cId}?company=1`);
check('3) /post/:id?company=1 sahifasi 404', r.status, 404);
r = await call('/api/records');
const vip = (Array.isArray(r.body) ? r.body : []).find((x) => x.code === 'VIP001');
check('3) katalogdagi post soni rejadagini sanamaydi', vip?.posts, 1);
r = await call('/api/admin/featured', { method: 'POST', cookie: cookie.admin, json: { targetKind: 'post', targetId: sId, days: 1, note: 'sinov' } });
check('3) admin ko‘tarishi: 409 post_scheduled', [r.status, r.body?.error], [409, 'post_scheduled']);
r = await call('/api/featured', { method: 'POST', cookie: cookie.user, json: { targetKind: 'company_post', targetId: cId, days: 1 } });
check('3) egasi pullik ko‘tara olmaydi: 409 post_scheduled', [r.status, r.body?.error], [409, 'post_scheduled']);
// Saqlanganlar: ref saqlanadi, lekin post kartasi chiqmaydi.
await call('/api/saves', { method: 'POST', cookie: cookie.other, json: { kind: 'post', ref: String(sId) } });
r = await call('/api/saves?kind=post', { cookie: cookie.other });
check('3) saqlanganlarda rejadagi post: post null', r.body.items.find((i) => i.ref === String(sId))?.post, null);

// ── 4) Egasi ko'radi ───────────────────────────────────────────────
r = await call('/api/records/VIP001/posts', { cookie: cookie.user });
const mine = r.body.posts.find((p) => p.id === sId);
check('4) egasi profilida ko‘radi, scheduledFor bilan', mine?.scheduledFor, when);
checkTrue('4) jonli postda scheduledFor yo‘q', !('scheduledFor' in r.body.posts.find((p) => p.id === liveId)));
r = await call('/api/companies/ACMEUZ/posts', { cookie: cookie.user });
check('4) egasi kompaniya ro‘yxatida ko‘radi', r.body.posts.find((p) => p.id === cId)?.scheduledFor, when);
r = await call('/api/feed?limit=30', { cookie: cookie.user });
checkTrue('4) egasining LENTASIDA ham yo‘q (lenta ommaviy)', !feedHas(r.body, 'card', sId));
r = await call(`/api/comments/post/${sId}`, { cookie: cookie.user });
check('4) egasi izohlarni ochadi', r.status, 200);
r = await call(`/api/posts/${sId}/like`, { method: 'POST', cookie: cookie.user });
check('4) egasi layk bosa oladi', r.status, 200);
r = await call(`/api/posts/${sId}`, { method: 'DELETE', cookie: cookie.other });
check('4) begona o‘chira olmaydi', r.status, 404);
r = await call('/api/my/analytics?days=30', { cookie: cookie.user });
check('4) analitika: 200', r.status, 200);
checkTrue('4) analitika top ro‘yxatida rejadagi post yo‘q', !(r.body.top || []).some((t) => (t.kind === 'post' && t.id === sId) || (t.kind === 'company_post' && t.id === cId)));
checkTrue('4) analitikada jonli postlar bor', (r.body.top || []).some((t) => t.kind === 'post' && t.id === liveId));

// ── 5) Vaqti keldi — post YANGI bo'lib chiqadi ─────────────────────
// Oddiy post 1 soat oldin, rejadagi esa 2 kun oldin yozilgan; reja 1
// daqiqa oldin kelgan. Lentada rejadagi YUQORIDA turishi kerak.
const now = Date.now();
sqlite.prepare(`UPDATE posts SET created_at = ? WHERE id = ?`).run(sqlTs(now - HOUR), liveId);
sqlite.prepare(`UPDATE posts SET created_at = ?, publish_at = ? WHERE id = ?`).run(sqlTs(now - 2 * DAY), sqlTs(now - 60_000), sId);
sqlite.prepare(`UPDATE company_posts SET created_at = ?, publish_at = ? WHERE id = ?`).run(iso(now - 2 * DAY), iso(now - 30_000), cId);
sqlite.prepare(`UPDATE company_posts SET created_at = ? WHERE id = ?`).run(iso(now - HOUR), cLiveId);
r = await call('/api/feed?limit=30', { cookie: cookie.other });
const ids = r.body.feed.map((f) => `${f.authorKind}:${f.id}`);
checkTrue('5) vaqti kelgan shaxsiy post lentada', ids.includes(`card:${sId}`));
checkTrue('5) vaqti kelgan biznes posti lentada', ids.includes(`company:${cId}`));
checkTrue('5) tartib samarali vaqt bo‘yicha (reja oddiydan yuqorida)', ids.indexOf(`card:${sId}`) < ids.indexOf(`card:${liveId}`)
  && ids.indexOf(`company:${cId}`) < ids.indexOf(`company:${cLiveId}`));
check('5) createdAt = publish_at', r.body.feed.find((f) => f.authorKind === 'card' && f.id === sId).createdAt, Date.parse(iso(now - 60_000).slice(0, 19) + 'Z'));
r = await call('/api/records/VIP001/posts', { cookie: cookie.other });
const pub = r.body.posts.find((p) => p.id === sId);
checkTrue('5) profilda ko‘rinadi, scheduledFor yo‘q', pub && !('scheduledFor' in pub));
check('5) profil tartibi ham samarali vaqt bo‘yicha', r.body.posts[0].id, sId);
r = await call(`/api/comments/post/${sId}`, { cookie: cookie.other });
check('5) izohlar ochiladi', r.status, 200);
r = await call(`/post/${sId}`);
check('5) /post/:id sahifasi 200', r.status, 200);
r = await call('/api/saves?kind=post', { cookie: cookie.other });
check('5) saqlanganlarda endi post kartasi bor', r.body.items.find((i) => i.ref === String(sId))?.post?.id, sId);

// ── 6) Issiq yo'llar — to'lqinlar soni o'zgarmagan ─────────────────
// Asos (2026-10-05, o'zgarishdan oldin o'lchangan): lenta mehmon 2 /
// kirgan 3; profil postlari mehmon 2 / egasi 4; kompaniya postlari 2 / 3.
{
  const probe = fileURLToPath(new URL('./lib/wave-probe.mjs', import.meta.url));
  const out = execFileSync(process.execPath, [probe], { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
  const w = JSON.parse(out.slice(out.lastIndexOf('@@') + 2));
  const expect = {
    '/api/feed anon': 2, '/api/feed t2': 3,
    '/api/records/VIP001/posts anon': 2, '/api/records/VIP001/posts t1': 4,
    '/api/companies/ACME/posts anon': 2, '/api/companies/ACME/posts t1': 3,
    '/api/records/VIP001/stories t1': 3,
  };
  for (const [k, v] of Object.entries(expect)) {
    check(`6) ${k}: ${v} to‘lqin, 200`, [w[k]?.status, w[k]?.waves], [200, v]);
  }
}

resetLimits();
done();
