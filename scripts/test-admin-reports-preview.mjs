// ADMIN SHIKOYATLAR: SHIKOYAT QILINGAN KONTENTNING O'ZI (2026-09-25).
//
// Egasi: "kontentni o'chirish turibdi — uni qanaqa kontentligini
// bilishimiz kerak emasmi". Ro'yxatda har shikoyat bilan birga
// `preview` keladi: matn, rasm/video va muallif. Kontent allaqachon
// o'chirilgan bo'lsa — `missing: true`. Jadval yo'q bo'lsa ro'yxat
// yiqilmaydi.
//
//   node scripts/test-admin-reports-preview.mjs

import worker, { ensureCoreSchema } from '../hosting/worker.js';
import { makeEnv, seedBasic, req, cookie, makeChecker } from './lib/d1-harness.mjs';

const { env } = makeEnv();
await ensureCoreSchema(env);
await seedBasic(env);
const { check, done } = makeChecker();

const call = async (path, init = {}) => {
  const res = await worker.fetch(req(path, init), env);
  return { status: res.status, body: await res.json().catch(() => null) };
};
const report = (json) => call('/api/reports', { method: 'POST', cookie: cookie.other, json });
const list = async () => (await call('/api/admin/reports', { cookie: cookie.admin })).body;

await env.DB.prepare(
  `INSERT INTO posts (id, code, user_id, caption, image_url, created_at) VALUES (28, 'VIP001', 1, 'Yomon so‘zli post matni', '/uploads/p28.jpg', '2026-09-20 10:00:00')`
).run();

await report({ targetKind: 'post', targetId: '28', ownerCode: 'VIP001', reason: 'other', note: '' });
await report({ targetKind: 'post', targetId: '999', ownerCode: 'VIP001', reason: 'spam', note: 'o‘chib ketgan' });
await report({ targetKind: 'record', targetId: 'vip001', ownerCode: 'VIP001', reason: 'spam', note: '' });

let d = await list();
check('ro‘yxat 200 va 3 ta shikoyat', d?.reports?.length, 3);
const byId = (kind, id) => d.reports.find((r) => r.targetKind === kind && r.targetId.toUpperCase() === id.toUpperCase());

const p = byId('post', '28');
check('post: matni ko‘rinadi', p.preview.text, 'Yomon so‘zli post matni');
check('post: rasmi', p.preview.imageUrl, '/uploads/p28.jpg');
check('post: muallif', p.preview.author, 'VIP001');
check('post: mavjud', p.preview.missing, false);

const gone = byId('post', '999');
check('o‘chirilgan post: missing', gone.preview.missing, true);
check('o‘chirilgan post: bo‘sh matn', gone.preview.text, '');

const rec = byId('record', 'VIP001');
check('profil shikoyati: ism', rec.preview.text, 'Muhammad');
check('profil shikoyati: kod', rec.preview.author, 'VIP001');

// Uzun matn qisqartiriladi (400 belgi).
await env.DB.prepare(`UPDATE posts SET caption = ? WHERE id = 28`).bind('x'.repeat(900)).run();
d = await list();
check('uzun matn 400 belgiga qisqaradi', byId('post', '28').preview.text.length, 400);

// Eski maydonlar o'zgarmagan.
const keys = Object.keys(byId('post', '28')).sort();
check('eski kalitlar joyida', ['id', 'targetKind', 'targetId', 'ownerCode', 'reason', 'note', 'status', 'createdAt', 'reporterEmail']
  .every((k) => keys.includes(k)), true);

done();
