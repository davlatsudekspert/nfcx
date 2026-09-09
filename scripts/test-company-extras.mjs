// Kompaniya QO'SHIMCHALARI: statistika, buyurtmalar, ish vaqti, o'z
// domeni (2026-09).
//
//   node scripts/test-company-extras.mjs
import worker, { tashkentNowD1, companyOpenStateD1, normalizeHoursD1, normalizeDomainD1 } from '../hosting/worker.js';
import { makeEnv, seedBasic, cookie, req, makeChecker } from './lib/d1-harness.mjs';

const { check, checkTrue, done } = makeChecker();
const { env } = makeEnv();
await seedBasic(env);

const call = (path, init) => worker.fetch(req(path, init), env);
const j = async (path, init) => { const r = await call(path, init); return { status: r.status, body: await r.json().catch(() => null) }; };

await j('/api/companies', {
  method: 'POST', cookie: cookie.user,
  json: { companyId: 'NFCTEST', displayName: 'Test Kompaniya', city: 'Toshkent', phone: '+998901234567', category: 'other', description: 'Test uchun yaratilgan kompaniya tavsifi, yigirma belgidan uzun.' },
});
await env.DB.prepare(`UPDATE companies SET status='active' WHERE company_id='NFCTEST'`).run();

// ── 1) ISH VAQTI ──────────────────────────────────────────────────────
const week = (over = {}) => Array.from({ length: 7 }, (_, i) => over[i] || { closed: true, open: '', close: '' });

check('1) yaroqsiz vaqt → yopiq', normalizeHoursD1([{ closed: false, open: '25:00', close: 'x' }])[0], { closed: true, open: '', close: '' });
check('1) 7 ta kun har doim qaytadi', normalizeHoursD1([]).length, 7);

// Payshanba (dow=4), soat 12:00 — 09:00-18:00 oralig'ida.
const noon = { day: '2026-09-10', dow: 4, minutes: 12 * 60 };
check('1) ish vaqtida ochiq', companyOpenStateD1(week({ 4: { closed: false, open: '09:00', close: '18:00' } }), noon).open, true);
check('1) ish vaqtidan tashqarida yopiq', companyOpenStateD1(week({ 4: { closed: false, open: '09:00', close: '11:00' } }), noon).open, false);
check('1) yopiq kun', companyOpenStateD1(week({ 3: { closed: false, open: '09:00', close: '18:00' } }), noon).open, false);
// TUNGACHA cho'zilgan smena: chorshanba 18:00-02:00, hozir payshanba 01:00.
const night = { day: '2026-09-10', dow: 4, minutes: 60 };
check('1) kechagi tungi smena hali ochiq', companyOpenStateD1(week({ 3: { closed: false, open: '18:00', close: '02:00' } }), night).open, true);
check('1) o‘sha smena 03:00 da yopiq', companyOpenStateD1(week({ 3: { closed: false, open: '18:00', close: '02:00' } }), { ...night, minutes: 180 }).open, false);
check('1) bo‘sh jadval umuman ko‘rsatilmaydi', companyOpenStateD1(week()), null);

// Toshkent kuni — UTC dan farq qiladi (UTC+5).
check('1) Toshkent sanasi', tashkentNowD1(new Date('2026-09-10T20:30:00Z')).day, '2026-09-11');
check('1) Toshkent soati', tashkentNowD1(new Date('2026-09-10T20:30:00Z')).minutes, 90);

const saved = await j('/api/companies/NFCTEST', {
  method: 'PATCH', cookie: cookie.user,
  json: { hours: week({ 1: { closed: false, open: '09:00', close: '18:00' } }) },
});
check('1) jadval saqlandi', saved.body.company.hours[1], { closed: false, open: '09:00', close: '18:00' });
checkTrue('1) openNow hisoblanadi', saved.body.company.openNow !== null);

// ── 2) STATISTIKA ─────────────────────────────────────────────────────
const ev = (json, ip) => j('/api/companies/NFCTEST/event', { method: 'POST', json, ip });
check('2) ko‘rish yozildi', (await ev({ kind: 'view' }, '198.51.100.1')).status, 200);
await ev({ kind: 'action', ref: 'phone' }, '198.51.100.2');
await ev({ kind: 'action', ref: 'phone' }, '198.51.100.3');
await ev({ kind: 'item', ref: 'abc' }, '198.51.100.4');
check('2) noma’lum tur rad etildi', (await ev({ kind: 'hack' }, '198.51.100.5')).status, 422);
check('2) havolasiz action rad etildi', (await ev({ kind: 'action' }, '198.51.100.6')).status, 422);

const stats = await j('/api/companies/NFCTEST/stats', { cookie: cookie.user });
check('2) ochilishlar', stats.body.views, 1);
check('2) tugma bosishlari', stats.body.taps, 2);
check('2) tugma bo‘yicha', stats.body.actions, [{ key: 'phone', hits: 2 }]);
check('2) element bo‘yicha', stats.body.items.map((x) => x.id), ['abc']);
check('2) 30 kunlik qator to‘liq', stats.body.series.length, 30);

// Begona odam statistikani KO'RA OLMAYDI.
const spy = await j('/api/companies/NFCTEST/stats', { cookie: cookie.other });
checkTrue('2) begona statistikani ko‘rmaydi', spy.status === 403 || spy.status === 404);

// Bitta IP dan cheksiz bosish raqamni shishirmaydi.
for (let i = 0; i < 70; i += 1) await ev({ kind: 'view' }, '203.0.113.9');
const flood = await j('/api/companies/NFCTEST/stats', { cookie: cookie.user });
checkTrue('2) bitta IP chegaralandi', flood.body.views <= 62);

// Faol bo'lmagan kompaniyaga hodisa yozilmaydi.
await env.DB.prepare(`UPDATE companies SET status='pending_review' WHERE company_id='NFCTEST'`).run();
await ev({ kind: 'view' }, '198.51.100.44');
const paused = await j('/api/companies/NFCTEST/stats', { cookie: cookie.user });
check('2) faol emas — yozilmadi', paused.body.views, flood.body.views);
await env.DB.prepare(`UPDATE companies SET status='active' WHERE company_id='NFCTEST'`).run();

// ── 3) BUYURTMALAR ────────────────────────────────────────────────────
const off = await j('/api/companies/NFCTEST/orders', { method: 'POST', json: { name: 'Ali', phone: '+998901112233' }, ip: '198.51.100.7' });
check('3) o‘chiq bo‘lsa qabul qilinmaydi', [off.status, off.body?.error], [409, 'orders_disabled']);

await j('/api/companies/NFCTEST', { method: 'PATCH', cookie: cookie.user, json: { ordersEnabled: true } });
const item = await j('/api/companies/NFCTEST/catalog', {
  method: 'POST', cookie: cookie.user, json: { name: 'Pitsa', price: 45000, promotionPrice: 39000 },
});
const itemId = item.body.company.catalog[0].id;

const bad = await j('/api/companies/NFCTEST/orders', { method: 'POST', json: { name: '', phone: '123' }, ip: '198.51.100.8' });
check('3) ism/telefonsiz rad etildi', bad.status, 422);

const made = await j('/api/companies/NFCTEST/orders', {
  method: 'POST', ip: '198.51.100.9',
  json: { itemId, name: 'Ali', phone: '+998 90 111 22 33', qty: 3, note: 'tez yetkazing' },
});
check('3) buyurtma qabul qilindi', made.status, 201);

const list = await j('/api/companies/NFCTEST/orders', { cookie: cookie.user });
const order = list.body.orders[0];
check('3) nom va soni', [order.itemName, order.qty], ['Pitsa', 3]);
// NARX KATALOGDAN olinadi, mijoz yuborganidan emas: aks holda
// buyurtmaga "1 so'm" deb yozib yuborish mumkin bo'lardi.
check('3) narx aksiya narxidan hisoblandi', order.price, 39000 * 3);
check('3) holat yangi', order.status, 'new');

const mark = await j(`/api/companies/NFCTEST/orders/${order.id}`, { method: 'PATCH', cookie: cookie.user, json: { status: 'done' } });
check('3) holat o‘zgardi', mark.status, 200);
check('3) yaroqsiz holat rad etildi', (await j(`/api/companies/NFCTEST/orders/${order.id}`, { method: 'PATCH', cookie: cookie.user, json: { status: 'hack' } })).status, 422);
const stranger = await j('/api/companies/NFCTEST/orders', { cookie: cookie.other });
checkTrue('3) begona buyurtmalarni ko‘rmaydi', stranger.status === 403 || stranger.status === 404);

// ── 4) O'Z DOMENI ─────────────────────────────────────────────────────
check('4) manzil tozalanadi', normalizeDomainD1('https://WWW.Menu.Kompaniya.UZ/menu'), 'menu.kompaniya.uz');
check('4) o‘z domenimiz rad etiladi', normalizeDomainD1('admin.nfcstore.uz'), '');
check('4) nfcstore.uz rad etiladi', normalizeDomainD1('nfcstore.uz'), '');
check('4) axlat rad etiladi', normalizeDomainD1('bu domen emas'), '');

const dom = await j('/api/companies/NFCTEST', { method: 'PATCH', cookie: cookie.user, json: { customDomain: 'menu.kompaniya.uz' } });
check('4) domen saqlandi', dom.body.company.customDomain, 'menu.kompaniya.uz');
// EGASI o'zi faollashtira OLMAYDI — admin tasdiqlaydi.
check('4) holat tekshiruvda', dom.body.company.customDomainStatus, 'pending');
const forced = await j('/api/companies/NFCTEST', { method: 'PATCH', cookie: cookie.user, json: { customDomainStatus: 'active' } });
check('4) egasi holatni o‘zgartira olmaydi', forced.body.company.customDomainStatus, 'pending');

// Tasdiqlanmagan domen sahifani ochmaydi.
const beforeApproval = await worker.fetch(new Request('https://menu.kompaniya.uz/', { headers: { accept: 'text/html' } }), env);
checkTrue('4) tasdiqsiz domen kompaniya sahifasini bermaydi', beforeApproval.status !== 200 || !(await beforeApproval.text()).includes('NFCTEST'));

const approve = await j('/api/admin/company-domains/NFCTEST', { method: 'PATCH', cookie: cookie.admin, json: { status: 'active' } });
check('4) admin tasdiqladi', approve.status, 200);
const domList = await j('/api/admin/company-domains', { cookie: cookie.admin });
check('4) admin ro‘yxatida ko‘rinadi', domList.body.domains[0].domain, 'menu.kompaniya.uz');

// Boshqa kompaniya o'sha domenni o'zlashtira olmaydi.
await j('/api/companies', {
  method: 'POST', cookie: cookie.other,
  json: { companyId: 'NFCTWO', displayName: 'Ikkinchi', city: 'Toshkent', phone: '+998901234568', category: 'other', description: 'Ikkinchi test kompaniyasining tavsifi, yigirma belgidan uzun.' },
});
const clash = await j('/api/companies/NFCTWO', { method: 'PATCH', cookie: cookie.other, json: { customDomain: 'menu.kompaniya.uz' } });
check('4) band domen rad etildi', [clash.status, clash.body?.error], [409, 'domain_taken']);

done();
