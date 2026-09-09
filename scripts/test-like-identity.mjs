// LAYK — KIM NOMIDAN VA KIM YOQTIRDI.
//
// Egasining so'rovi: obuna biznes nomidan ko'rinadigan bo'ldi, layk ham
// shunday bo'lsin. Lekin layk ilgari faqat SON edi — kim bosgani hech
// qayerda ro'yxat bo'lib chiqmasdi, ya'ni "biznes nomidan layk" degan
// tushunchaning ko'rinadigan joyi ham yo'q edi. Shuning uchun ikkalasi
// birga: yuz saqlanadi VA ro'yxat bor.
//
// Qoida obuna bilan AYNAN bir xil:
//   - `asCompanyId` umuman yuborilmasa — profilga biriktirilgan kompaniya;
//   - bo'sh satr yuborilsa — ataylab shaxsiy profil;
//   - begona yoki faol bo'lmagan kompaniya — rad etiladi.
//
//   node scripts/test-like-identity.mjs
import worker from '../hosting/worker.js';
import { makeEnv, seedBasic, cookie, req, makeChecker } from './lib/d1-harness.mjs';

const { check, checkTrue, done } = makeChecker();
const { env } = makeEnv();
await seedBasic(env);

const j = async (path, init) => { const r = await worker.fetch(req(path, init), env); return { status: r.status, body: await r.json().catch(() => null) }; };

// user#1 (VIP001, BIZ777) kompaniya ochadi va uni profiliga biriktiradi.
await j('/api/companies', {
  method: 'POST', cookie: cookie.user,
  json: { companyId: 'MYBRAND', displayName: 'My Brand', city: 'Toshkent', phone: '+998901112233', category: 'other', description: 'Test kompaniya tavsifi, yigirma belgidan uzunroq matn.' },
});
await env.DB.prepare(`UPDATE companies SET status='active', logo_url='/uploads/logo.png' WHERE company_id='MYBRAND'`).run();
await j('/api/records/VIP001', { method: 'PUT', cookie: cookie.user, json: { name: 'Muhammad', companyId: 'MYBRAND' } });

// ── 1) Kirmagan odam laykni ko‘radi, lekin bosa olmaydi ──────────────
check('1) boshida 0 ta layk', (await j('/api/records/OTH222/like')).body, { count: 0, liked: false, asCompanyId: '' });
check('1) kirmasdan bosib bo‘lmaydi', (await j('/api/records/OTH222/like', { method: 'POST' })).status, 401);
check('1) ro‘yxat bo‘sh', (await j('/api/records/OTH222/like-list')).body.list, []);

// ── 2) Tanlov yuborilmasa — profildagi kompaniya nomidan ─────────────
const liked = await j('/api/records/OTH222/like', { method: 'POST', cookie: cookie.user, json: {} });
check('2) layk bosildi', [liked.status, liked.body?.liked, liked.body?.asCompanyId], [200, true, 'MYBRAND']);
const mine = await j('/api/records/OTH222/like', { cookie: cookie.user });
check('2) o‘zida ko‘rinadi', [mine.body.count, mine.body.liked, mine.body.asCompanyId], [1, true, 'MYBRAND']);

// KIM YOQTIRDI — kompaniya yuzi bilan, lekin kim ekani ham ko'rinadi.
const list = (await j('/api/records/OTH222/like-list')).body.list;
check('2) ro‘yxatda bitta', list.length, 1);
check('2) kompaniya yuzi', [list[0].kind, list[0].code, list[0].name], ['company', 'MYBRAND', 'My Brand']);
check('2) logotip olindi', list[0].avatarUrl, '/uploads/logo.png');
check('2) kim ekani ham ko‘rinadi', list[0].personCode, 'VIP001');

// ── 3) Ataylab SHAXSIY tanlansa — kompaniya yuzi qo‘yilmaydi ─────────
await j('/api/records/OTH222/like', { method: 'POST', cookie: cookie.user, json: {} });  // bekor qilish
const personal = await j('/api/records/OTH222/like', { method: 'POST', cookie: cookie.user, json: { asCompanyId: '' } });
check('3) shaxsiy nomidan', [personal.body?.liked, personal.body?.asCompanyId], [true, '']);
const list3 = (await j('/api/records/OTH222/like-list')).body.list;
check('3) ro‘yxatda shaxsiy yuz', [list3[0].kind, list3[0].code], ['person', 'VIP001']);

// ── 4) Begona kompaniya nomidan bo‘lmaydi ────────────────────────────
await j('/api/records/OTH222/like', { method: 'POST', cookie: cookie.user, json: { asCompanyId: '' } }); // bekor
const stranger = await j('/api/records/VIP001/like', { method: 'POST', cookie: cookie.other, json: { asCompanyId: 'MYBRAND' } });
check('4) begona kompaniya rad etildi', [stranger.status, stranger.body?.error], [403, 'not_company_owner']);
check('4) layk qo‘yilmadi', (await j('/api/records/VIP001/like')).body.count, 0);
const noSuch = await j('/api/records/VIP001/like', { method: 'POST', cookie: cookie.other, json: { asCompanyId: 'YOQXXX' } });
checkTrue('4) mavjud bo‘lmagan kompaniya rad etildi', noSuch.status === 403 || noSuch.status === 422);

// ── 5) To‘xtatilgan kompaniya standart yuz bo‘lmaydi ─────────────────
await env.DB.prepare(`UPDATE companies SET status='suspended' WHERE company_id='MYBRAND'`).run();
const suspended = await j('/api/records/OTH222/like', { method: 'POST', cookie: cookie.user, json: {} });
check('5) shaxsiy yuzga qaytdi', suspended.body?.asCompanyId, '');
// To'g'ridan-to'g'ri so'ralsa ham rad etiladi.
await j('/api/records/OTH222/like', { method: 'POST', cookie: cookie.user, json: { asCompanyId: '' } }); // bekor
const askSuspended = await j('/api/records/OTH222/like', { method: 'POST', cookie: cookie.user, json: { asCompanyId: 'MYBRAND' } });
check('5) to‘xtatilgan kompaniya rad etildi', askSuspended.status, 403);
await env.DB.prepare(`UPDATE companies SET status='active' WHERE company_id='MYBRAND'`).run();

// ── 6) SON to‘g‘ri sanaladi, bir odam bir marta ──────────────────────
await j('/api/records/OTH222/like', { method: 'POST', cookie: cookie.user, json: { asCompanyId: '' } });
await j('/api/records/OTH222/like', { method: 'POST', cookie: cookie.user, json: { asCompanyId: '' } }); // bekor
await j('/api/records/OTH222/like', { method: 'POST', cookie: cookie.user, json: { asCompanyId: '' } }); // qayta
check('6) bitta odam — bitta layk', (await j('/api/records/OTH222/like')).body.count, 1);
check('6) ro‘yxatda ham bitta', (await j('/api/records/OTH222/like-list')).body.list.length, 1);

// ── 7) Yashirin profil ro‘yxatga chiqmaydi ───────────────────────────
// Katalogdan yashiringan odam "kim yoqtirdi" ro'yxatida ham chiqmasin —
// obunachilar ro'yxatidagi qoida bilan bir xil.
//
// user#1 da IKKITA karta bor (VIP001, BIZ777). Bittasi yashirilsa odam
// ikkinchisi bilan chiqadi — bu to'g'ri: u hamon ochiq profilga ega.
await env.DB.prepare(`UPDATE cards SET hidden_from_directory = 1 WHERE code = 'VIP001'`).run();
const half = (await j('/api/records/OTH222/like-list')).body.list;
check('7) ikkinchi (ochiq) kartasi bilan chiqadi', [half.length, half[0].code], [1, 'BIZ777']);
// HAMMA kartasi yashirin bo'lsa — ro'yxatda umuman ko'rinmaydi.
await env.DB.prepare(`UPDATE cards SET hidden_from_directory = 1 WHERE code = 'BIZ777'`).run();
check('7) butunlay yashirin — ko‘rinmaydi', (await j('/api/records/OTH222/like-list')).body.list.length, 0);
// SON esa o'zgarmaydi: layk baribir bosilgan.
check('7) lekin SON o‘zgarmaydi', (await j('/api/records/OTH222/like')).body.count, 1);

done();
