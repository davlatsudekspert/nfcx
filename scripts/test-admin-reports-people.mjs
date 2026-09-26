// ADMIN SHIKOYATLAR: KIM KIMDAN + O'CHIRILGAN KONTENT (egasi, 2026-09-26).
//
// "O'chirib yuborsam yana paydo bo'lyapti" — kontent allaqachon yo'q
// bo'lsa ham "Kontentni o'chirish" shikoyatni YOPADI (ilgari 404 berib,
// shikoyat "Yangi" bo'lib qolardi). "Kimdan kelgan, kimni yozgani" —
// har shikoyatda `reporter` (NFC ID, ism, email, telefon yoki mehmon)
// va `author` (muallif ismi) keladi; to'liq matn `preview.fullText`.
//
//   node scripts/test-admin-reports-people.mjs
import worker, { ensureCoreSchema } from '../hosting/worker.js';
import { makeEnv, seedBasic, req, cookie, makeChecker } from './lib/d1-harness.mjs';

const { env } = makeEnv();
await ensureCoreSchema(env);
await seedBasic(env);
const { check, checkTrue, done } = makeChecker();

const call = async (path, init = {}) => {
  const res = await worker.fetch(req(path, init), env);
  return { status: res.status, body: await res.json().catch(() => null) };
};
const long = 'Uzun matn. '.repeat(80);
await env.DB.prepare(`INSERT INTO posts (id, code, user_id, caption, created_at) VALUES (41, 'VIP001', 1, ?, '2026-09-20 10:00:00')`).bind(long).run();

// user#2 (OTH222, seedBasic) VIP001 postiga shikoyat qiladi; mehmon — o'chib ketgan postga.
await call('/api/reports', { method: 'POST', cookie: cookie.other, json: { targetKind: 'post', targetId: '41', ownerCode: 'VIP001', reason: 'insult', note: 'haqorat' } });
await call('/api/reports', { method: 'POST', json: { targetKind: 'post', targetId: '777', ownerCode: 'VIP001', reason: 'other', note: '' } });

let d = (await call('/api/admin/reports?status=new', { cookie: cookie.admin })).body;
check('2 ta yangi shikoyat', d.reports.length, 2);
const r41 = d.reports.find((r) => r.targetId === '41');
check('shikoyatchi: NFC ID', r41.reporter.code, 'OTH222');
check('shikoyatchi: ism', r41.reporter.name, 'Boshqa');
check('shikoyatchi: email', r41.reporter.email, 'other@test.local');
check('shikoyatchi: telefon', r41.reporter.phone, '+998902222222');
check('muallif: kod', r41.author.code, 'VIP001');
check('muallif: ism', r41.author.name, 'Muhammad');
check('qisqa ko‘rinish 400', r41.preview.text.length, 400);
checkTrue('to‘liq matn tafsilot uchun', r41.preview.fullText.length > 400);
const r777 = d.reports.find((r) => r.targetId === '777');
check('mehmon shikoyatchi', r777.reporter.guest, true);
check('o‘chib ketgan post: missing', r777.preview.missing, true);

// Kontent YO'Q — baribir shikoyat yopiladi (qayta paydo bo'lmaydi).
const del = await call('/api/admin/content/post/777', { method: 'DELETE', cookie: cookie.admin, json: {} });
check('yo‘q kontent: 200', del.status, 200);
check('yo‘q kontent: alreadyGone', del.body.alreadyGone, true);
d = (await call('/api/admin/reports?status=new', { cookie: cookie.admin })).body;
check('yopildi: yangi ro‘yxatda qolmadi', d.reports.map((r) => r.targetId), ['41']);
const resolved = (await call('/api/admin/reports?status=resolved', { cookie: cookie.admin })).body;
check('hal qilinganlarda', resolved.reports.map((r) => r.targetId), ['777']);

// Mavjud kontent — o'chadi va shikoyat yopiladi.
const del41 = await call('/api/admin/content/post/41', { method: 'DELETE', cookie: cookie.admin, json: {} });
check('mavjud kontent: 200', del41.status, 200);
check('mavjud kontent: alreadyGone yo‘q', del41.body.alreadyGone, undefined);
d = (await call('/api/admin/reports?status=new', { cookie: cookie.admin })).body;
check('hammasi yopildi', d.reports.length, 0);

// Admin emas — rad.
const anon = await call('/api/admin/content/post/41', { method: 'DELETE', json: {} });
checkTrue('admin emas: rad', anon.status === 401 || anon.status === 403);

done();
