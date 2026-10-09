// OBUNALAR LENTASI: GET /api/feed?scope=following (Reels "Obunalar" tabi).
//
// Tekshiriladi: faqat obuna bo'lingan odam (uning HAMMA kartalari) va
// kompaniya kontenti; o'zimniki va begonaniki yo'q; anonim — 401;
// bloklangan, rejadagi post chiqmaydi; `liked` to'g'ri; sahifalash;
// reklama qo'shilmaydi; oddiy lenta o'zgarmagan.
//
//   node scripts/test-feed-following.mjs
import { setupSocial, cookie, makeChecker } from './lib/social-fixture.mjs';

const { check, checkTrue, done } = makeChecker();
const { sqlite, call } = await setupSocial();

// 3-foydalanuvchi (obuna bo'linmaydi) va 2-foydalanuvchining 2-kartasi.
sqlite.prepare(`INSERT INTO users (id, email, password_hash, phone) VALUES (3, 'third@test.local', 'x', '+998903333333')`).run();
sqlite.prepare(`INSERT INTO sessions (token, user_id, expires_at) VALUES ('third-token', 3, '2999-01-01T00:00:00.000Z')`).run();
sqlite.prepare(`INSERT INTO cards (code, name, price, ts, user_id, profile_type) VALUES ('THR333', 'Uchinchi', 0, 1000, 3, 'personal')`).run();
sqlite.prepare(`INSERT INTO cards (code, name, price, ts, user_id, profile_type) VALUES ('OTH999', 'Boshqa 2', 0, 1000, 2, 'business')`).run();
const third = 'nfc_session=third-token';

const post = (code, ck, json) =>
  call(`/api/records/${code}/posts`, { method: 'POST', cookie: ck, json: { agreed: true, imageUrl: '/uploads/f.jpg', ...json } });
const cpost = (id, ck, json) =>
  call(`/api/companies/${id}/posts`, { method: 'POST', cookie: ck, json: { agreed: true, imageUrl: '/uploads/c.jpg', ...json } });
const feed = (ck, q = '') => call(`/api/feed?scope=following${q}`, { cookie: ck });
const keys = (r) => (r.body.feed || []).map((p) => `${p.code}:${p.caption}`).sort();

const mine = await post('VIP001', cookie.user, { caption: 'mine' });
const o1 = await post('OTH222', cookie.other, { caption: 'oth1' });
const o2 = await post('OTH999', cookie.other, { caption: 'oth2' });
const t1 = await post('THR333', third, { caption: 'thr' });
const co = await cpost('OTHERCO', cookie.other, { caption: 'co' });
check('0) postlar yaratildi', [mine.status, o1.status, o2.status, t1.status, co.status], [201, 201, 201, 201, 201]);

// ── 1) Anonim va bo'sh ─────────────────────────────────────────────
let r = await call('/api/feed?scope=following');
check('1) anonim: 401', [r.status, r.body?.error], [401, 'unauthorized']);
r = await feed(cookie.user);
check('1) hech kimga obuna emas: bo‘sh', [r.status, r.body.feed, r.body.hasMore], [200, [], false]);

// ── 2) Odamga obuna — uning HAMMA kartalari ────────────────────────
r = await call('/api/follow/OTH222', { method: 'POST', cookie: cookie.user, json: { asCompanyId: '' } });
check('2) obuna: 200', r.status, 200);
r = await feed(cookie.user);
check('2) faqat obuna bo‘lingan odamning ikkala kartasi', keys(r), ['OTH222:oth1', 'OTH999:oth2']);
checkTrue('2) o‘zimniki va begonaniki yo‘q', !keys(r).some((k) => k.startsWith('VIP001') || k.startsWith('THR333')));
checkTrue('2) shakl lenta bilan bir xil', r.body.feed.every((p) => p.kind === 'post' && Array.isArray(p.mediaItems) && typeof p.liked === 'boolean'));
checkTrue('2) reklama yo‘q', r.body.feed.every((p) => !p.featured));

// ── 3) Kompaniyaga obuna ───────────────────────────────────────────
r = await call('/api/companies/OTHERCO/follow', { method: 'POST', cookie: cookie.user });
check('3) kompaniyaga obuna', [r.status, r.body.following], [200, true]);
r = await feed(cookie.user);
check('3) kompaniya posti qo‘shildi', keys(r), ['OTH222:oth1', 'OTH999:oth2', 'OTHERCO:co']);
check('3) kompaniya posti commentKind', r.body.feed.find((p) => p.code === 'OTHERCO').commentKind, 'company_post');

// ── 4) liked ───────────────────────────────────────────────────────
r = await call(`/api/posts/${o1.body.id}/like`, { method: 'POST', cookie: cookie.user });
check('4) layk: 200', r.status, 200);
r = await feed(cookie.user);
check('4) liked faqat laykda', r.body.feed.filter((p) => p.liked).map((p) => p.caption), ['oth1']);

// ── 5) Rejadagi post chiqmaydi ─────────────────────────────────────
const later = new Date(Date.now() + 3600e3).toISOString();
r = await post('OTH222', cookie.other, { caption: 'later', publishAt: later });
check('5) rejadagi post: 201', r.status, 201);
r = await feed(cookie.user);
checkTrue('5) rejadagi post obunachiga ko‘rinmaydi', !keys(r).includes('OTH222:later'));

// ── 6) Sahifalash ──────────────────────────────────────────────────
r = await feed(cookie.user, '&limit=2');
check('6) 1-sahifa: 2 ta, hasMore', [r.body.feed.length, r.body.hasMore], [2, true]);
const p2 = await feed(cookie.user, '&limit=2&page=2');
check('6) 2-sahifa: 1 ta, oxiri', [p2.body.feed.length, p2.body.hasMore], [1, false]);
checkTrue('6) takror yo‘q', ![...r.body.feed].some((a) => p2.body.feed.some((b) => b.id === a.id && b.code === a.code)));

// ── 7) Bloklangan chiqmaydi ────────────────────────────────────────
r = await call('/api/blocks', { method: 'POST', cookie: cookie.user, json: { kind: 'record', id: 'OTH222' } });
check('7) blok: 200', r.status, 200);
r = await feed(cookie.user);
check('7) bloklangan karta yo‘q', keys(r), ['OTH999:oth2', 'OTHERCO:co']);
await call('/api/blocks/record/OTH222', { method: 'DELETE', cookie: cookie.user });

// ── 8) Obunani bekor qilish ────────────────────────────────────────
await call('/api/unfollow/OTH222', { method: 'POST', cookie: cookie.user });
r = await feed(cookie.user);
check('8) bekor qilingach faqat kompaniya', keys(r), ['OTHERCO:co']);

// ── 9) Boshqa tomoshabin — o'z obunalari ───────────────────────────
r = await feed(third);
check('9) 3-foydalanuvchi hech kimga obuna emas', r.body.feed, []);

// ── 10) Oddiy lenta o'zgarmagan ────────────────────────────────────
r = await call('/api/feed', { cookie: cookie.user });
check('10) oddiy lenta hamma ochiq postni beradi', keys(r).filter((k) => !k.endsWith(':later')),
  ['OTH222:oth1', 'OTH999:oth2', 'OTHERCO:co', 'THR333:thr', 'VIP001:mine']);
r = await call('/api/feed?scope=boshqa', { cookie: cookie.user });
check('10) noma’lum scope — oddiy lenta', r.body.feed.length, 5);

done();
