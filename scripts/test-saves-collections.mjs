// SAQLANGANLAR: POSTLAR VA NOMLI TO'PLAMLAR (hosting/api/saves.js).
//
// Tekshiriladi: eski turlar (reel/listing) avvalgidek; `post` va
// `company_post` saqlanadi va lenta shaklidagi post kartasi bilan
// qaytadi; to'plam yaratish/nomlash/o'chirish (saqlanganlar O'CHMAYDI),
// to'plamga ko'chirish, to'plam bo'yicha filtr; begona to'plamga
// tegib bo'lmaydi; ko'rinmaydigan post `post: null`; chegara va
// tekshiruvlar; hisob o'chirilganda to'plamlar ham ketadi.
//
//   node scripts/test-saves-collections.mjs
import { setupSocial, cookie, makeChecker } from './lib/social-fixture.mjs';
import { purgeStmts } from '../hosting/api/account-purge.js';

const { check, checkTrue, done } = makeChecker();
const { sqlite, call } = await setupSocial();

const save = (json, ck = cookie.user) => call('/api/saves', { method: 'POST', cookie: ck, json });
const p1 = (await call('/api/records/OTH222/posts', { method: 'POST', cookie: cookie.other, json: { agreed: true, media: [{ url: '/uploads/sv1abc.jpg', type: 'image' }, { url: '/uploads/sv2abc.jpg', type: 'image' }] } })).body.id;
const c1 = (await call('/api/companies/OTHERCO/posts', { method: 'POST', cookie: cookie.other, json: { agreed: true, imageUrl: '/uploads/sv3abc.jpg' } })).body.post.id;
checkTrue('0) postlar', p1 && c1);

// ── 1) Eski turlar o'zgarmagan ─────────────────────────────────────
let r = await save({ kind: 'reel', ref: `p:${p1}` });
check('1) reel saqlandi — eski kalitlar bor', [r.status, r.body.kind, r.body.ref, r.body.saved], [200, 'reel', `p:${p1}`, true]);
check('1) yangi maydon collectionId null', r.body.collectionId, null);
r = await call('/api/saves?kind=reel', { cookie: cookie.user });
check('1) GET reel: eski shakl + collectionId', r.body.items.map((i) => [i.kind, i.ref, typeof i.createdAt, i.collectionId]), [['reel', `p:${p1}`, 'string', null]]);
checkTrue('1) reel yozuvida post maydoni yo‘q', !('post' in r.body.items[0]) && !('hasMore' in r.body));
r = await save({ kind: 'listing', ref: 'OTHERCO/item1' });
check('1) listing', r.status, 200);

// ── 2) Post va biznes postini saqlash ──────────────────────────────
r = await save({ kind: 'post', ref: String(p1) });
check('2) post saqlandi', [r.status, r.body.saved], [200, true]);
r = await save({ kind: 'company_post', ref: String(c1) });
check('2) biznes posti saqlandi', r.status, 200);
for (const [label, json, err] of [
  ['post ref harf', { kind: 'post', ref: 'p:1' }, 'bad_ref'],
  ['post ref 0', { kind: 'post', ref: '0' }, 'bad_ref'],
  ['noma’lum tur', { kind: 'story', ref: '1' }, 'bad_kind'],
]) {
  r = await save(json);
  check(`2) ${label}: 422 ${err}`, [r.status, r.body.error], [422, err]);
}
r = await call('/api/saves?kind=post', { cookie: cookie.user });
const sp = r.body.items[0];
check('2) GET post: ref va post kartasi', [sp.ref, sp.post?.id, sp.post?.authorKind, sp.post?.media?.length], [String(p1), p1, 'card', 2]);
checkTrue('2) post kartasi lenta shaklida', ['kind', 'commentKind', 'likeCount', 'liked', 'commentCount', 'viewCount', 'imageUrl', 'name'].every((k) => k in sp.post));
check('2) hasMore', r.body.hasMore, false);
r = await call('/api/saves?kind=company_post', { cookie: cookie.user });
check('2) biznes posti kartasi', [r.body.items[0].post?.id, r.body.items[0].post?.authorKind, r.body.items[0].post?.commentKind], [c1, 'company', 'company_post']);
check('2) kirmagan: 401', (await call('/api/saves?kind=post')).status, 401);

// ── 3) To'plamlar ──────────────────────────────────────────────────
r = await call('/api/saves/collections', { method: 'POST', cookie: cookie.user, json: { name: '  Sovg‘a   g‘oyalari ' } });
check('3) yaratildi', [r.status, r.body.collection.name, r.body.collection.count], [201, 'Sovg‘a g‘oyalari', 0]);
const colA = r.body.collection.id;
r = await call('/api/saves/collections', { method: 'POST', cookie: cookie.user, json: { name: 'Restoranlar' } });
const colB = r.body.collection.id;
check('3) bo‘sh nom: 422', (await call('/api/saves/collections', { method: 'POST', cookie: cookie.user, json: { name: ' ' } })).body.error, 'name_required');
check('3) 41 belgi: 422', (await call('/api/saves/collections', { method: 'POST', cookie: cookie.user, json: { name: 'x'.repeat(41) } })).body.error, 'name_too_long');
r = await call('/api/saves/collections', { method: 'POST', cookie: cookie.other, json: { name: 'B to‘plami' } });
const colOther = r.body.collection.id;

// Ko'chirish.
r = await call('/api/saves/move', { method: 'POST', cookie: cookie.user, json: { kind: 'post', ref: String(p1), collectionId: colA } });
check('3) ko‘chirildi', [r.status, r.body.collectionId], [200, colA]);
r = await call('/api/saves/move', { method: 'POST', cookie: cookie.user, json: { kind: 'post', ref: String(p1), collectionId: colOther } });
check('3) begona to‘plamga: 404', [r.status, r.body.error], [404, 'collection_not_found']);
r = await call('/api/saves/move', { method: 'POST', cookie: cookie.user, json: { kind: 'post', ref: '999', collectionId: colA } });
check('3) saqlanmagan narsa: 404', r.status, 404);
r = await call('/api/saves/move', { method: 'POST', cookie: cookie.user, json: { kind: 'post', ref: String(p1) } });
check('3) collectionId yo‘q: 422', r.status, 422);
// Saqlash paytida to'plam.
r = await save({ kind: 'reel', ref: `c:${c1}`, collectionId: colB });
check('3) saqlash paytida to‘plamga', r.body.collectionId, colB);
r = await save({ kind: 'reel', ref: `c:${c1}`, collectionId: colOther });
check('3) saqlashda begona to‘plam: 404', r.status, 404);
r = await save({ kind: 'reel', ref: `c:${c1}` });
check('3) qayta saqlash to‘plamni o‘zgartirmaydi', r.body.collectionId, colB);
r = await save({ kind: 'company_post', ref: String(c1), collectionId: colA });
check('3) mavjud saqlanganni to‘plamga o‘tkazish', r.body.collectionId, colA);

r = await call('/api/saves/collections', { cookie: cookie.user });
check('3) ro‘yxat va sonlar', r.body.collections.map((c) => [c.name, c.count]), [['Sovg‘a g‘oyalari', 2], ['Restoranlar', 1]]);
check('3) to‘plamsizlar soni', r.body.unassigned, 2);
r = await call('/api/saves/collections', { cookie: cookie.other });
check('3) boshqa odam faqat o‘zinikini ko‘radi', r.body.collections.map((c) => c.name), ['B to‘plami']);
r = await call(`/api/saves?kind=post&collectionId=${colA}`, { cookie: cookie.user });
check('3) to‘plam bo‘yicha filtr', r.body.items.map((i) => i.ref), [String(p1)]);
r = await call('/api/saves?kind=reel&collectionId=none', { cookie: cookie.user });
check('3) to‘plamsizlar filtri', r.body.items.map((i) => i.ref), [`p:${p1}`]);
check('3) yaroqsiz filtr: 422', (await call('/api/saves?kind=reel&collectionId=abc', { cookie: cookie.user })).status, 422);
r = await call(`/api/saves?kind=post&collectionId=${colOther}`, { cookie: cookie.user });
check('3) begona to‘plam filtri bo‘sh (oshkor qilmaydi)', r.body.items, []);

// Nomlash.
r = await call(`/api/saves/collections/${colB}`, { method: 'PATCH', cookie: cookie.user, json: { name: 'Kafelar' } });
check('3) nomlandi', [r.status, r.body.collection.name, r.body.collection.count], [200, 'Kafelar', 1]);
check('3) begona nomlay olmaydi: 404', (await call(`/api/saves/collections/${colOther}`, { method: 'PATCH', cookie: cookie.user, json: { name: 'X' } })).status, 404);

// O'chirish — saqlanganlar QOLADI.
const savesBefore = sqlite.prepare(`SELECT COUNT(*) AS n FROM user_saves WHERE user_id = 1`).get().n;
check('3) begona o‘chira olmaydi: 404', (await call(`/api/saves/collections/${colOther}`, { method: 'DELETE', cookie: cookie.user })).status, 404);
r = await call(`/api/saves/collections/${colA}`, { method: 'DELETE', cookie: cookie.user });
check('3) o‘chirildi, 2 ta saqlangan to‘plamdan chiqdi', [r.status, r.body.unassigned], [200, 2]);
check('3) saqlanganlar O‘CHMADI', sqlite.prepare(`SELECT COUNT(*) AS n FROM user_saves WHERE user_id = 1`).get().n, savesBefore);
check('3) ular endi to‘plamsiz', sqlite.prepare(`SELECT COUNT(*) AS n FROM user_saves WHERE user_id = 1 AND collection_id IS NULL`).get().n, 4);
check('3) qayta o‘chirish: 404', (await call(`/api/saves/collections/${colA}`, { method: 'DELETE', cookie: cookie.user })).status, 404);

// ── 4) Ko'rinmaydigan post — post: null ────────────────────────────
await call('/api/blocks', { method: 'POST', cookie: cookie.user, json: { kind: 'record', id: 'OTH222' } });
r = await call('/api/saves?kind=post', { cookie: cookie.user });
check('4) bloklangan muallif posti: post null, ref qoladi', [r.body.items[0].ref, r.body.items[0].post], [String(p1), null]);
await call('/api/blocks/record/OTH222', { method: 'DELETE', cookie: cookie.user });
sqlite.prepare(`UPDATE cards SET hidden_from_directory = 1 WHERE code = 'OTH222'`).run();
r = await call('/api/saves?kind=post', { cookie: cookie.user });
check('4) yashirilgan profil posti: null', r.body.items[0].post, null);
sqlite.prepare(`UPDATE cards SET hidden_from_directory = 0 WHERE code = 'OTH222'`).run();
await call(`/api/posts/${p1}`, { method: 'DELETE', cookie: cookie.other });
r = await call('/api/saves?kind=post', { cookie: cookie.user });
check('4) o‘chirilgan post: null', r.body.items[0].post, null);
// Saqlanganni olib tashlash.
r = await save({ kind: 'post', ref: String(p1), saved: false });
check('4) olib tashlandi', [r.status, r.body.saved], [200, false]);

// ── 5) Sahifalash (30 tagacha) ─────────────────────────────────────
for (let i = 0; i < 35; i++) sqlite.prepare(`INSERT INTO user_saves (user_id, kind, ref, created_at) VALUES (1, 'post', ?, ?)`).run(String(1000 + i), `2026-01-01T00:00:${String(i).padStart(2, '0')}Z`);
r = await call('/api/saves?kind=post', { cookie: cookie.user });
check('5) 1-sahifa 30, yana bor', [r.body.items.length, r.body.hasMore], [30, true]);
r = await call('/api/saves?kind=post&page=2', { cookie: cookie.user });
check('5) 2-sahifa 5', [r.body.items.length, r.body.hasMore], [5, false]);

// ── 6) Hisob o'chirish: to'plamlar ham ketadi ──────────────────────
{
  const cfg = { tables: new Set(['save_collections', 'user_saves', 'story_replies']), cols: new Set(), flags: {} };
  const env2 = { DB: { prepare: (sql) => ({ sql, bind() { return this; } }) } };
  const sqls = purgeStmts(env2, { id: 1 }, 'x', 'ref', cfg).map((s) => s.sql);
  checkTrue('6) purge: save_collections o‘chiriladi', sqls.some((s) => /DELETE FROM save_collections WHERE user_id = 1/.test(s)));
  checkTrue('6) purge: user_saves o‘chiriladi', sqls.some((s) => /DELETE FROM user_saves WHERE user_id = 1/.test(s)));
}

done();
