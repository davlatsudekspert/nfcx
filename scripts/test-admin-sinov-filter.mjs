// "SINOV" BELGISI BUTUN ADMIN STATISTIKASIGA TA'SIR QILADI.
//
// Egasining qoidasi: "o'zimiz qilgan ishlar statistikaga kirmasin".
// Buning uchun hech narsa o'chirilmaydi — foydalanuvchi "Sinov"
// (is_test) yoki "Ichki" (is_internal) deb belgilanadi va uning
// yozuvlari hisobdan chiqadi. Belgi olinsa — qaytadi.
//
// BU TEST NIMANI QO'RIQLAYDI: filtr YARIM qo'llanishini. Aynan shu
// xato bo'lgan edi —
//   - buyurtmalar ro'yxati faqat `is_test` ni tekshirardi,
//     `is_internal` ni umuman ko'rmasdi;
//   - `/api/admin/analytics` (daromad turlari, komissiya va karta
//     grafiklari) hech qanday filtrsiz edi, ro'yxatdan o'tish grafigi
//     esa filtrlangan — ya'ni bitta ekranda ikki xil haqiqat;
//   - kutilayotgan buyurtmalar sanoqchisi sinovni sanardi;
//   - "Eski biznes profillar" sanoqchisi ham.
// Filtr bir joydan (TEST_USER_IDS_D1) olinadi; kimdir uni bir
// so'rovda unutsa — shu test yiqiladi.
//
//   node scripts/test-admin-sinov-filter.mjs
import worker, { ensureCoreSchema } from '../hosting/worker.js';
import { makeEnv, seedBasic, req, cookie, makeChecker } from './lib/d1-harness.mjs';

const { check, checkTrue, done } = makeChecker();
const { env, sqlite } = makeEnv({});
await ensureCoreSchema(env);
await seedBasic(env);

const now = new Date().toISOString().replace('T', ' ').replace('Z', '+00');
const ts = Date.now();

// user#1 — HAQIQIY mijoz. user#2 — SINOV. user#3 — ICHKI (xodim).
sqlite.prepare(`INSERT INTO users (id, email, password_hash, phone, created_at) VALUES (3, 'ichki@test.local', 'x', '+998903333333', ?)`).run(now);
// user#1 va user#2 ham nowTs() shaklida — "+00" li vaqt bilan.
sqlite.prepare(`UPDATE users SET created_at = ? WHERE id IN (1, 2)`).run(now);
sqlite.prepare(`UPDATE users SET is_test = 1 WHERE id = 2`).run();
sqlite.prepare(`UPDATE users SET is_internal = 1 WHERE id = 3`).run();

// KARTALAR — bugungi sana bilan (analytics oxirgi 29 kunni oladi).
const addCard = sqlite.prepare(
  `INSERT INTO cards (code, name, price, ts, user_id, profile_type) VALUES (?,?,?,?,?,?)`);
addCard.run('REAL01', 'Haqiqiy', 100000, ts, 1, 'personal');
addCard.run('TEST01', 'Sinov', 100000, ts, 2, 'personal');
addCard.run('INTR01', 'Ichki', 100000, ts, 3, 'personal');
// Biznes profillar — "Eski tizim" sanoqchisi uchun.
addCard.run('TESTBIZ', 'Sinov biznes', 0, ts, 2, 'business');

// BUYURTMALAR — har uchala akkauntdan bittadan to'langan + bittadan kutilayotgan.
// To'langanlari Payme orqali (daromad faqat Payme/Click'dan hisoblanadi —
// test-admin-revenue.mjs ga qarang); bu test esa SINOV/ICHKI filtrini qo'riqlaydi.
const addOrder = sqlite.prepare(
  `INSERT INTO web_orders (id, user_id, code, price, payload, status, created_at, payme_transaction_id) VALUES (?,?,?,?,'{}',?,?,?)`);
addOrder.run(1, 1, 'REAL01', 500000, 'paid', now, 'pm-1');
addOrder.run(2, 2, 'TEST01', 900000, 'paid', now, 'pm-2');
addOrder.run(3, 3, 'INTR01', 700000, 'paid', now, 'pm-3');
addOrder.run(4, 1, 'REAL01', 100000, 'pending', now, null);
addOrder.run(5, 2, 'TEST01', 100000, 'pending', now, null);
addOrder.run(6, 3, 'INTR01', 100000, 'pending', now, null);

// TRANZAKSIYALAR — komissiya.
const addTx = sqlite.prepare(
  `INSERT INTO transactions (user_id, amount, kind, created_at) VALUES (?,?,'platform_commission',?)`);
addTx.run(1, 50000, now);
addTx.run(2, 90000, now);
addTx.run(3, 70000, now);

const get = async (p) => (await worker.fetch(req(p, { cookie: cookie.admin }), env)).json();

// ── 1) /api/admin/stats ──────────────────────────────────────────────
const stats = await get('/api/admin/stats');
check('foydalanuvchilar = 1 (sinov va ichki chiqdi)', stats.userCount, 1);
// seedBasic: VIP001 + BIZ777 (user#1) + OTH222 (user#2, sinov).
// Yuqorida qo'shilgan: REAL01 (1), TEST01 (2), INTR01 (3), TESTBIZ (2).
// Qoladi: VIP001, BIZ777, REAL01 = 3.
check('kartalar = 3', stats.cardCount, 3);
check('karta summasi = 498000', stats.totalCardSalesValue, 199000 + 199000 + 100000);
// Bu SUMMA emas, "bajariladigan ish" sanoqchisi: sinov yashirinadi,
// ICHKI akkauntniki esa ro'yxatda ko'ringani uchun sanaladi ham.
// Ilgari bu yerda umuman filtr yo'q edi — 3 chiqardi.
check('kutilayotgan buyurtma = 2 (sinov chiqdi, ichki qoldi)', stats.pendingWebOrders, 2);

// ── 2) Daromad — faqat haqiqiy mijozning to'lovi ─────────────────────
const wallet = await get('/api/admin/platform-wallet');
check('daromad = 500000', wallet.balance, 500000);
check('to‘langan buyurtma = 1', wallet.paidOrders, 1);

// ── 3) /api/admin/analytics — ilgari BUTUNLAY filtrsiz edi ───────────
const an = await get('/api/admin/analytics');
const comm = an.breakdown.find((r) => r.kind === 'platform_commission');
check('komissiya summasi = 50000', comm.total, 50000);
check('komissiya soni = 1', comm.count, 1);
check('komissiya grafigi = 50000', an.commissionSeries.reduce((n, r) => n + r.total, 0), 50000);
check('karta grafigi = 1 ta', an.cardsSeries.reduce((n, r) => n + r.count, 0), 1);

// ── 3b) VAQT SHAKLI: "+00" li yozuvlar hisobdan TUSHIB QOLMASIN ─────
// Yuqoridagi qatorlar AYNAN nowTs() shaklida ("...+00", daqiqasiz
// mintaqa) yozilgan — SQLite bu shaklni parse qila olmaydi va
// `datetime(created_at)` NULL qaytaradi. Ilgari filtr shu funksiyaga
// tayanardi, shuning uchun ro'yxatdan o'tish va komissiya grafiklari
// BO'SH chiqardi. Endi kun bo'yicha (substr) solishtiriladi.
checkTrue('"+00" shaklini SQLite parse qila olmaydi (xato sababi)',
  sqlite.prepare(`SELECT datetime(?) AS d`).get(now).d === null);
checkTrue('shunga qaramay komissiya grafigi bo‘sh emas', an.commissionSeries.length > 0);
const signupTotal = an.signupsSeries.reduce((n, r) => n + r.count, 0);
check('ro‘yxatdan o‘tish grafigi = 1 (sinov va ichki chiqdi)', signupTotal, 1);

// ── 4) Buyurtmalar ro'yxati — IKKI XIL BELGI, IKKI XIL QOIDA ─────────
// `is_test` — umuman yashiriladi. `is_internal` — egasining o'z
// akkaunti: buyurtmalari HAQIQIY, ular bilan ishlash kerak, shuning
// uchun ro'yxatda QOLADI (faqat pul/statistika hisobiga kirmaydi).
// Bu ataylab shunday; buni "tuzatish" ishni buzadi.
const orders = await get('/api/admin/orders');
const ids = (orders.orders || []).filter((o) => o.source === 'web').map((o) => o.id).sort();
check('sinov yashirin, ichki ko‘rinadi', ids, [1, 3, 4, 6]);
// `?includeTest=1` — hech narsa o'chmagani isboti: hammasi qaytadi.
const all = await get('/api/admin/orders?includeTest=1');
check('includeTest bilan hammasi qaytadi', (all.orders || []).filter((o) => o.source === 'web').length, 6);

// ── 5) "Eski biznes profillar" sanoqchisi ────────────────────────────
const co = await get('/api/admin/companies/stats');
check('biznes profillar = 1 (BIZ777)', co.total, 1);

// ── 6) BAZA TEGILMAGAN ───────────────────────────────────────────────
// Filtr — ko'rinish, o'chirish emas. Yozuvlar joyida turibdi.
check('web_orders qatorlari joyida', sqlite.prepare(`SELECT COUNT(*) AS n FROM web_orders`).get().n, 6);
check('transactions qatorlari joyida', sqlite.prepare(`SELECT COUNT(*) AS n FROM transactions`).get().n, 3);
check('cards qatorlari joyida', sqlite.prepare(`SELECT COUNT(*) AS n FROM cards`).get().n, 7);
check('users qatorlari joyida', sqlite.prepare(`SELECT COUNT(*) AS n FROM users`).get().n, 3);

// ── 7) Belgi olinsa — raqamlar qaytadi ───────────────────────────────
sqlite.prepare(`UPDATE users SET is_test = 0 WHERE id = 2`).run();
sqlite.prepare(`UPDATE users SET is_internal = 0 WHERE id = 3`).run();
const back = await get('/api/admin/platform-wallet');
check('belgi olingach daromad = 2100000', back.balance, 500000 + 900000 + 700000);
const backStats = await get('/api/admin/stats');
check('belgi olingach foydalanuvchilar = 3', backStats.userCount, 3);
checkTrue('ya‘ni ma‘lumot yo‘qolmagan', back.paidOrders === 3);

done();
