// ADMIN BOSHQARUV MARKAZI — hosting/api/admin-control.js.
//
// Bosh sahifa (overview), Premium obunachilar va foydalanuvchi
// kartochkasi FAQAT O'QIYDI. Bu test qo'riqlaydi:
//   * tushum faqat Payme/Click (qo'lda, eski, sinov, qaytarilgan emas);
//   * "e'tibor talab qiladi" navbati to'g'ri sanaladi (sinov akkaunt,
//     marketplace stikerlari, E2E shikoyatlar kirmaydi);
//   * o'chirish navbati faqat super_admin'ga;
//   * Premium: faol / 7 kunda tugaydi / tugagan / sinov muddati;
//   * kartochka: ID'lar, buyurtmalar (kanal bilan), jami faqat Payme/Click;
//   * hech narsa yozilmaydi.
//
//   node scripts/test-admin-control.mjs
import worker from '../hosting/worker.js';
import { makeEnv, seedBasic, req, cookie, makeChecker } from './lib/d1-harness.mjs';

const { check, checkTrue, done } = makeChecker();
const { env, sqlite } = makeEnv({});
await seedBasic(env);
const get = async (p, c = cookie.admin) => {
  const r = await worker.fetch(req(p, { cookie: c }), env);
  return { status: r.status, body: await r.json().catch(() => null) };
};
// Jadvallar yaratilishi uchun bir marta chaqiramiz.
await get('/api/admin/overview');

const now = Date.now();
const iso = (ms) => new Date(ms).toISOString();
const ts = (ms) => iso(ms).replace('T', ' ').replace('Z', '+00');
const DAY = 86_400_000;
const run = (sql, ...a) => sqlite.prepare(sql).run(...a);

// Foydalanuvchilar: #1 oddiy (seed), #2 SINOV (seed OTH222), #3 premium, #4 tugaydi, #5 tugagan, #6 sinov muddati.
run(`UPDATE users SET is_test = 1 WHERE id = 2`);
const addUser = (id, email, extra = {}) => {
  run(`INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, 'x', ?)`, id, email, ts(now - 2 * DAY));
  for (const [k, v] of Object.entries(extra)) run(`UPDATE users SET ${k} = ? WHERE id = ?`, v, id);
};
addUser(3, 'prem@x.uz', { premium_expires_at: iso(now + 20 * DAY) });
addUser(4, 'soon@x.uz', { premium_expires_at: iso(now + 3 * DAY) });
addUser(5, 'old@x.uz', { premium_expires_at: iso(now - 5 * DAY) });
addUser(6, 'trial@x.uz', { trial_expires_at: iso(now + 10 * DAY) });
run(`INSERT INTO cards (code, name, price, ts, user_id) VALUES ('PREM03', 'Prem', 0, ?, 3)`, now);

// Buyurtmalar.
const order = (id, user, code, price, status, created, kind = 'card_purchase', payme = null, click = null, cancel = null) =>
  run(`INSERT INTO web_orders (id, user_id, code, price, payload, status, created_at, kind, payme_transaction_id, click_transaction_id, cancel_time)
       VALUES (?, ?, ?, ?, '{}', ?, ?, ?, ?, ?, ?)`, id, user, code, price, status, created, kind, payme, click, cancel);
order(1, 1, 'VIP001', 199000, 'paid', ts(now - 60_000), 'card_purchase', 'pm-1');           // bugun, Payme
order(2, 3, 'PREM03', 49000, 'paid', ts(now - 3 * DAY), 'premium_upgrade', null, 'ck-2');    // 7 kun, Click
order(3, 1, 'OLD001', 99000, 'paid', ts(now - 20 * DAY));                                    // eski — hisobga kirmaydi
order(4, 1, 'REF001', 80000, 'paid', ts(now - 60_000), 'card_purchase', 'pm-4', null, ts(now)); // qaytarilgan
order(5, 2, 'OTH222', 500000, 'paid', ts(now - 60_000), 'card_purchase', 'pm-5');           // SINOV akkaunt
order(6, 1, 'PND001', 50000, 'pending', ts(now - 2 * DAY));                                  // kutilmoqda, eskirgan
order(7, 3, 'PND002', 50000, 'pending', ts(now - 60_000));                                   // kutilmoqda, yangi
order(8, 2, 'PND003', 50000, 'pending', ts(now - 60_000));                                   // sinov — sanalmaydi

// Jismoniy kartalar: 2 ta chop etiladi, 1 marketplace stikeri (sanalmaydi), 1 jo'natilgan.
const phys = (id, owner, status, batch = null) => run(`INSERT INTO physical_cards (id, chip_token, owner_user_id, status) VALUES (?, ?, ?, ?)`, id, 'tok' + id, owner, status);
phys(1, 1, 'pending'); phys(2, 3, 'printing'); phys(3, null, 'pending'); phys(4, 1, 'shipped');

// Murojaatlar va shikoyatlar.
run(`INSERT INTO support_messages (id, user_id, message, status) VALUES (1, 1, 'Yordam', 'pending'), (2, 1, 'Rahmat', 'replied')`);
await get('/api/admin/reports');
run(`INSERT INTO content_reports (target_kind, target_id, owner_code, reporter_id, reason, note, status, created_at) VALUES
  ('post', 1, 'VIP001', 3, 'spam', '', 'new', ?), ('post', 2, 'VIP001', 3, 'spam', 'NOVA E2E TEST x', 'new', ?), ('post', 3, 'VIP001', 3, 'spam', '', 'resolved', ?)`, ts(now), ts(now), ts(now));

const before = sqlite.prepare(`SELECT (SELECT COUNT(*) FROM web_orders) AS o, (SELECT COUNT(*) FROM users) AS u`).get();

// ── overview ──
{
  const r = await get('/api/admin/overview');
  check('overview 200', r.status, 200);
  const o = r.body;
  check('tushum bugun = faqat Payme (qaytarilgan, sinov, eski emas)', [o.revenue.today.total, o.revenue.today.count], [199000, 1]);
  check('tushum 7 kun = Payme + Click', [o.revenue.d7.total, o.revenue.d7.count], [248000, 2]);
  check('qaytarilgan (30 kun) alohida', [o.revenue.refunded30.total, o.revenue.refunded30.count], [80000, 1]);
  check('navbat: kutilayotgan (sinovsiz) va eskirgan', [o.queue.pendingOrders, o.queue.stalePendingOrders], [2, 1]);
  check('navbat: chop etiladigan karta (stikersiz)', o.queue.physicalToPrint, 2);
  check('navbat: shikoyat (E2E va hal qilinganlarsiz)', o.queue.reports, 1);
  check('navbat: javobsiz murojaat', o.queue.supportUnanswered, 1);
  check('premium: faol / 7 kunda tugaydi / sinov muddati', [o.premium.active, o.premium.expiring7d, o.premium.trial], [2, 1, 1]);
  check('menyu sonlari', [o.badges.pendingOrders, o.badges.physicalToPrint, o.badges.reports, o.badges.supportUnanswered], [2, 2, 1, 1]);
  checkTrue('super_admin o‘chirish navbatini ko‘radi', o.deletions && typeof o.deletions.unreviewed === 'number');
  check('oxirgi to‘lovlar — faqat hisobga kirganlar', o.recent.payments.map((p) => p.id).sort(), [1, 2]);
  checkTrue('oxirgi ro‘yxatdan o‘tganlarda sinov akkaunt yo‘q', !o.recent.signups.some((s) => s.id === 2));
}
{
  const m = await get('/api/admin/overview', cookie.manager);
  check('manager: overview bor, o‘chirish navbati yo‘q', [m.status, m.body.deletions, m.body.badges.accountDeletions], [200, null, 0]);
  const a = await get('/api/admin/overview', '');
  check('adminsiz 401', a.status, 401);
}

// ── premium ──
{
  const ids = async (f) => (await get(`/api/admin/premium-users?filter=${f}`)).body.users.map((u) => u.id).sort();
  check('premium: faol', await ids('active'), [3, 4]);
  check('premium: 7 kunda tugaydi', await ids('expiring'), [4]);
  check('premium: tugagan', await ids('expired'), [5]);
  check('premium: sinov muddati', await ids('trial'), [6]);
  const r = await get('/api/admin/premium-users?filter=active&q=prem03');
  check('premium: qidiruv NFC ID bo‘yicha', r.body.users.map((u) => [u.id, u.lastPaidAt != null, u.paidCount]), [[3, true, 1]]);
  const bad = await get('/api/admin/premium-users?filter=zzz');
  check('noma’lum filtr -> active', bad.body.filter, 'active');
}

// ── foydalanuvchi kartochkasi ──
{
  const r = await get('/api/admin/users/1/detail');
  check('detail 200', r.status, 200);
  const d = r.body;
  check('kartochka: email va ID', [d.user.email, d.cards.map((c) => c.code).includes('VIP001')], ['user@test.local', true]);
  const ch = Object.fromEntries(d.orders.map((o) => [o.id, [o.channel, o.refunded]]));
  check('buyurtmalar kanali', [ch[1], ch[3], ch[4]], [['payme', false], ['legacy', false], ['payme', true]]);
  check('jami — faqat Payme/Click, qaytarilgansiz', d.totals.countedPaid, 199000);
  check('jismoniy kartalar va murojaatlar', [d.physicalCards.length, d.support.length], [2, 2]);
  check('ochiq shikoyat (VIP001 ga)', d.openReports, 2);
  const p = await get('/api/admin/users/3/detail');
  check('premium holati kartochkada', [p.body.user.premium.state, p.body.totals.countedPaid], ['active', 49000]);
  const nf = await get('/api/admin/users/999/detail');
  check('yo‘q foydalanuvchi 404', nf.status, 404);
}

// ── hech narsa yozilmadi ──
check('bazaga yozilmadi', sqlite.prepare(`SELECT (SELECT COUNT(*) FROM web_orders) AS o, (SELECT COUNT(*) FROM users) AS u`).get(), before);

done();
