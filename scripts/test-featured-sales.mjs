// KO'TARISH SOTUVI 1000 FOYDALANUVCHIDA OCHILADI — hosting/api/featured.js.
//   node scripts/test-featured-sales.mjs
//   UZ_ADAPTER_TEST=1 node scripts/test-featured-sales.mjs   (sqld adapteri)
//
// Tekshiriladi: yopiq paytda sayt (Payme/Click) va iOS (Apple boost-intent)
// 409 `sales_not_open`, tekshiruv xatolari avvalgidek; admin qo'lda ko'tarishi
// ishlaydi; bepul navbat (idempotent, chiqish); chegara 999/1000; ochilish
// payti saqlanadi va soni kamaysa ham yopilmaydi; navbatdagilarga bitta
// `featured_open` bildirishnomasi (cron ham); 48 soatlik ustuvor oyna; admin
// rejimi (open/closed/auto, faqat super_admin, jurnalda); admin navbat ro'yxati.
// Production'ga HECH QACHON tegmaydi.
import { setupSocial, cookie, makeChecker } from './lib/social-fixture.mjs';
import { __resetFeaturedSalesCache, featuredSalesTick, FEATURED_OPEN_AT_USERS } from '../hosting/api/featured.js';

const { check, checkTrue, done } = makeChecker();
const { env, sqlite, call, worker } = await setupSocial({
  PAYMENTS_ENABLED: 'true',
  PAYME_MERCHANT_ID: 'test_merchant_local_only',
  PAYME_KEY: 'test_payme_key_local_only',
  IAP_APPLE_ENABLED: '1',
});
const DAY = 86_400_000;
for (const id of [101, 102, 103]) sqlite.prepare(`INSERT INTO posts (id, code, user_id, caption, created_at) VALUES (?, 'VIP001', 1, 'p', '2026-01-01 00:00:00')`).run(id);
for (const id of [201, 202]) sqlite.prepare(`INSERT INTO posts (id, code, user_id, caption, created_at) VALUES (?, 'OTH222', 2, 'b', '2026-01-01 00:00:00')`).run(id);
const buy = (targetId, who = cookie.user) => call('/api/featured', { method: 'POST', cookie: who, json: { targetKind: 'post', targetId, days: 1 } });
const pk = async (who = cookie.user) => (await call('/api/featured/packages', { cookie: who })).body;
const users = () => sqlite.prepare(`SELECT COUNT(*) AS n FROM users WHERE deleted_at IS NULL`).get().n;
const setting = (k) => sqlite.prepare(`SELECT value FROM admin_settings WHERE key = ?`).get(k)?.value ?? null;
const notifs = (uid) => {
  if (!sqlite.prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'notifications'`).get()) return 0;
  return sqlite.prepare(`SELECT COUNT(*) AS n FROM notifications WHERE recipient_user_id = ? AND kind = 'featured_open'`).get(uid).n;
};
const addUsers = (n, from) => sqlite.prepare(`WITH RECURSIVE c(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM c WHERE x < ?)
  INSERT INTO users (id, email, password_hash, phone) SELECT ? + x, 'bulk' || (? + x) || '@t.local', 'x', '+99877' || printf('%07d', ? + x) FROM c`).run(n, from, from, from);
const fresh = () => __resetFeaturedSalesCache();

check('0) chegara 1000', FEATURED_OPEN_AT_USERS, 1000);

// ═══ 1. Yopiq (standart 'auto', foydalanuvchilar kam) ═══
{
  const p = await pk();
  check('1) packages: yopiq, son, chegara, navbatda emas', [p.salesOpen, p.usersCount, p.openAt, p.waitlisted, p.priorityUntil], [false, users(), 1000, false, null]);
  checkTrue('1) eski maydonlar joyida', Array.isArray(p.packages) && !!p.capacity && p.enabled === true);
  const r = await buy(101);
  check('1) sayt xaridi — 409 sales_not_open', [r.status, r.body], [409, { error: 'sales_not_open', usersCount: users(), openAt: 1000 }]);
  check('1) tekshiruv xatolari avvalgidek: begona post', (await buy(201)).body?.error, 'forbidden');
  check('1) tekshiruv xatolari avvalgidek: yo‘q post', (await buy(999)).status, 404);
  checkTrue('1) slot yaratilmadi', !sqlite.prepare(`SELECT 1 FROM featured_slots`).get());
  const i = await call('/api/iap/apple/boost-intent', { method: 'POST', cookie: cookie.user, json: { targetKind: 'post', targetId: 101, days: 1 } });
  check('1) iOS boost-intent — 409 sales_not_open', [i.status, i.body?.error, i.body?.openAt], [409, 'sales_not_open', 1000]);
  const adm = await call('/api/admin/featured', { method: 'POST', cookie: cookie.admin, json: { targetKind: 'post', targetId: 103, days: 1, note: 'hamkorlik' } });
  check('1) admin qo‘lda ko‘tarishi — ishlaydi', [adm.status, adm.body?.slot?.status], [201, 'active']);
  check('1) mehmon packages — waitlisted:false', (await call('/api/featured/packages')).body.waitlisted, false);
}

// ═══ 2. Bepul navbat ═══
{
  check('2) mehmon — 401', (await call('/api/featured/waitlist', { method: 'POST', json: {} })).status, 401);
  const j = await call('/api/featured/waitlist', { method: 'POST', cookie: cookie.user, json: { targetKind: 'post', targetId: 101 } });
  check('2) yozildi', [j.status, j.body], [200, { waitlisted: true, salesOpen: false }]);
  check('2) idempotent', (await call('/api/featured/waitlist', { method: 'POST', cookie: cookie.user, json: {} })).body.waitlisted, true);
  check('2) bitta qator, nishon saqlandi', sqlite.prepare(`SELECT COUNT(*) AS n, MAX(target_id) AS t FROM featured_waitlist WHERE user_id = 1`).get(), { n: 1, t: 101 });
  check('2) packages — waitlisted:true', (await pk()).waitlisted, true);
  check('2) chiqish', (await call('/api/featured/waitlist', { method: 'DELETE', cookie: cookie.user })).body, { waitlisted: false });
  check('2) chiqqandan keyin — waitlisted:false', (await pk()).waitlisted, false);
  await call('/api/featured/waitlist', { method: 'POST', cookie: cookie.user, json: {} });
  // Navbatdagi lekin ochilishdan oldin o'chirilgan hisob — xabar olmaydi.
  sqlite.prepare(`INSERT INTO users (id, email, password_hash, phone) VALUES (7, 'u7@t.local', 'x', '+998907777777')`).run();
  sqlite.prepare(`INSERT INTO featured_waitlist (user_id, created_at) VALUES (7, ?)`).run(new Date().toISOString());
  sqlite.prepare(`UPDATE users SET deleted_at = ? WHERE id = 7`).run(new Date().toISOString());
}

// ═══ 3. Chegara: 999 — yopiq, 1000 — ochiladi ═══
let openedAt;
{
  addUsers(999 - users(), 10000);
  fresh();
  check('3) 999 foydalanuvchi — yopiq', [(await pk()).usersCount, (await pk()).salesOpen], [999, false]);
  check('3) hali bildirishnoma yo‘q', notifs(1), 0);
  addUsers(1, 20000);
  // Kesh: 5 daqiqa ichida eski son — hali yopiq.
  check('3) kesh (5 daqiqa) — hali 999', (await pk()).usersCount, 999);
  fresh();
  const p = await pk();
  openedAt = setting('featured_sales_opened_at');
  check('3) 1000 — ochildi', [p.usersCount, p.salesOpen], [1000, true]);
  checkTrue('3) ochilish payti saqlandi', !!openedAt && Math.abs(Date.parse(openedAt) - Date.now()) < 10000);
  checkTrue('3) ustuvor oyna ≈ +48 soat', Math.abs(p.priorityUntil - (Date.parse(openedAt) + 2 * DAY)) < 1000);
  check('3) navbatdagiga bitta xabar', notifs(1), 1);
  check('3) navbatda bo‘lmaganga xabar yo‘q', notifs(2), 0);
  check('3) o‘chirilgan hisobga xabar yo‘q', notifs(7), 0);
  checkTrue('3) notified_at yozildi', !!sqlite.prepare(`SELECT notified_at FROM featured_waitlist WHERE user_id = 1`).get().notified_at);
  const list = (await call('/api/notifications', { cookie: cookie.user })).body;
  const item = (list?.items || list?.notifications || []).find((n) => n.type === 'featured_open');
  check('3) ro‘yxatda: featured_open, aktyorsiz', item && [item.type, item.title, item.targetType], ['featured_open', '', 'featured']);
  // Mobil ilovada reklama yo'q: ilova so'rovida bu xabar ko'rinmaydi va sanalmaydi.
  for (const headers of [{ 'x-app': 'nova' }, { 'x-client': 'ios' }]) {
    const app = (await call('/api/notifications', { cookie: cookie.user, headers })).body;
    check(`3) ilovada (${Object.values(headers)[0]}) — featured_open yo‘q`, [(app.items || []).some((n) => n.type === 'featured_open'), app.unreadCount], [false, list.unreadCount - 1]);
  }
  await pk(); await featuredSalesTick(env, { nowTs: () => new Date().toISOString().replace('T', ' ').replace('Z', '+00') });
  check('3) qayta so‘rov / tick — takror xabar yo‘q', notifs(1), 1);
}

// ═══ 4. 48 soatlik ustuvor oyna ═══
{
  const r2 = await buy(201, cookie.other);
  check('4) navbatda emas — 409 priority_window', [r2.status, r2.body?.error, r2.body?.endsAt], [409, 'priority_window', Date.parse(openedAt) + 2 * DAY]);
  const r1 = await buy(101);
  check('4) navbatdagi — sotib oladi (201 + payLinks)', [r1.status, !!r1.body?.payLinks], [201, true]);
  const i2 = await call('/api/iap/apple/boost-intent', { method: 'POST', cookie: cookie.other, json: { targetKind: 'post', targetId: 202, days: 1 } });
  check('4) iOS ham — priority_window', i2.body?.error, 'priority_window');
  // Ochilgandan keyin navbatga yozilgan — darhol "xabardor", bildirishnoma yo'q.
  await call('/api/featured/waitlist', { method: 'POST', cookie: cookie.other, json: {} });
  checkTrue('4) keyin yozilgan — notified_at darhol', !!sqlite.prepare(`SELECT notified_at FROM featured_waitlist WHERE user_id = 2`).get().notified_at);
  check('4) keyin yozilgan — bildirishnoma yo‘q', notifs(2), 0);
  check('4) endi navbatda — sotib oladi', (await buy(201, cookie.other)).status, 201);
  sqlite.prepare(`DELETE FROM featured_waitlist WHERE user_id = 2`).run();
  // Oyna tugadi.
  sqlite.prepare(`UPDATE admin_settings SET value = ? WHERE key = 'featured_sales_opened_at'`).run(new Date(Date.now() - 49 * 3600_000).toISOString());
  const p = await pk(cookie.other);
  check('4) 48 soatdan keyin — hammaga', [p.salesOpen, p.priorityUntil, (await buy(202, cookie.other)).status], [true, null, 201]);
}

// ═══ 5. Ochilgandan keyin soni kamaysa ham yopilmaydi ═══
{
  sqlite.prepare(`UPDATE users SET deleted_at = ? WHERE id > 10000 AND id <= 10500`).run(new Date().toISOString());
  fresh();
  const p = await pk();
  check('5) 500 dan kam — baribir ochiq', [p.usersCount < 1000, p.salesOpen], [true, true]);
}

// ═══ 6. Admin rejimi ═══
{
  const mode = (m, who = cookie.admin) => call('/api/admin/featured/sales', { method: 'POST', cookie: who, json: { mode: m } });
  check('6) manager — 403', (await mode('closed', cookie.manager)).status, 403);
  check('6) noto‘g‘ri rejim — 422', (await mode('maybe')).body, { error: 'bad_mode' });
  const c = await mode('closed');
  check('6) closed — yopiq (ochilgan bo‘lsa ham)', [c.status, c.body.sales.open, c.body.sales.mode], [200, false, 'closed']);
  check('6) closed — sotuv 409', (await buy(102)).body?.error, 'sales_not_open');
  check('6) closed — admin qo‘lda baribir', (await call('/api/admin/featured', { method: 'POST', cookie: cookie.admin, json: { targetKind: 'post', targetId: 102, days: 1, note: 'kelishuv' } })).status, 201);
  check('6) auto — yana ochiq (ochilish payti saqlangan)', (await mode('auto')).body.sales.open, true);
  checkTrue('6) jurnalda', sqlite.prepare(`SELECT COUNT(*) AS n FROM admin_activity_log WHERE action = 'featured_sales_mode'`).get().n >= 2);
  // Yangi baza: 'open' kam foydalanuvchi bilan ham ochadi va ochilishni qayd qiladi.
  sqlite.prepare(`DELETE FROM admin_settings WHERE key = 'featured_sales_opened_at'`).run();
  sqlite.prepare(`UPDATE users SET deleted_at = ? WHERE id > 10000`).run(new Date().toISOString());
  fresh();
  check('6) auto, kam foydalanuvchi, ochilish yo‘q — yopiq', (await pk()).salesOpen, false);
  // Navbatdagi (ochilishgacha yozilgan, xabar olmagan) — admin 'open' qilganda xabar oladi.
  sqlite.prepare(`INSERT INTO users (id, email, password_hash, phone) VALUES (8, 'u8@t.local', 'x', '+998908888888')`).run();
  sqlite.prepare(`INSERT INTO featured_waitlist (user_id, created_at) VALUES (8, ?)`).run(new Date(Date.now() - DAY).toISOString());
  const o = await mode('open');
  check('6) open — kam foydalanuvchi bilan ham ochiq', [o.body.sales.open, o.body.sales.usersCount < 1000], [true, true]);
  checkTrue('6) ochilish qayd qilindi', !!setting('featured_sales_opened_at'));
  check('6) ochilishda navbatdagiga xabar', notifs(8), 1);
}

// ═══ 7. Cron ═══
{
  // Xabar olmagan, ochilishdan OLDIN yozilgan navbatdagi (masalan yozuv xatosi) — cron yuboradi.
  sqlite.prepare(`INSERT INTO users (id, email, password_hash, phone) VALUES (9, 'u9@t.local', 'x', '+998909999999')`).run();
  sqlite.prepare(`INSERT INTO featured_waitlist (user_id, created_at) VALUES (9, ?)`).run(new Date(Date.parse(setting('featured_sales_opened_at')) - 1000).toISOString());
  const jobs = [];
  await worker.scheduled({ cron: '30 21 * * *', scheduledTime: Date.now() }, env, { waitUntil: (p) => jobs.push(p) });
  await Promise.all(jobs);
  check('7) cron — xabar yuborildi', notifs(9), 1);
  jobs.length = 0;
  await worker.scheduled({ cron: '30 21 * * *', scheduledTime: Date.now() }, env, { waitUntil: (p) => jobs.push(p) });
  await Promise.all(jobs);
  check('7) cron qayta — takror yo‘q', [notifs(9), notifs(8), notifs(1)], [1, 1, 1]);
}

// ═══ 8. Admin navbat ro'yxati ═══
{
  check('8) oddiy foydalanuvchi — 401', (await call('/api/admin/featured/waitlist', { cookie: cookie.user })).status, 401);
  const w = (await call('/api/admin/featured/waitlist', { cookie: cookie.manager })).body;
  // Navbatda: #1, #7 (o'chirilgan — xabar olmagan), #8, #9 (#2 chiqib ketgan).
  check('8) sonlar', w.counts, { total: 4, notified: 3 });
  check('8) sotuv holati', [w.sales.mode, w.sales.open, w.sales.openAt], ['open', true, 1000]);
  const u1 = w.items.find((x) => x.userId === 1);
  check('8) qator: kod, nishon', u1 && [u1.code, u1.targetKind, !!u1.notifiedAt], ['VIP001', null, true]);
  checkTrue('8) email/telefon yo‘q', !JSON.stringify(w).includes('@test.local') && !JSON.stringify(w).includes('998901111111'));
}

done('Ko‘tarish sotuvi — 1000 foydalanuvchi');
