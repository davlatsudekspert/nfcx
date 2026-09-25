// PLATFORMA DAROMADI — JONLI hisoblanishi kerak.
//
// NIMA UCHUN BU TEST BOR: bu raqam `platform_wallet.balance` dan
// o'qilardi, unga esa HOZIRGI kod hech qachon yozmaydi — faqat eski
// Express/Postgres tizimi oshirib borardi. Natijada ekranda "real pul"
// deb 7 990 000 turardi: eski tizimdan qotib qolgan, bugungi pulga
// aloqasi yo'q raqam. Hech qanday xato chiqmasdi va shu sabab uni
// oylab payqash mumkin emas edi.
//
// Endi raqam har safar TO'LANGAN buyurtmalardan hisoblanadi — va
// (egasining qarori, 2026-09-25) FAQAT Payme/Click orqali tushganlari.
// Qo'lda tasdiqlangan, eski, sinov, bot va sinov/ichki akkaunt
// to'lovlari — «Boshqa» (`otherTotal`), qaytarilganlar — alohida. Bu test
// aynan shuni qo'riqlaydi: kimdir qaytib `platform_wallet` ga o'tsa,
// sinov akkauntlarni chiqarishni yoki kanalni tekshirishni unutsa —
// shu yerda qulaydi.
//
//   node scripts/test-admin-revenue.mjs
import worker, { ensureCoreSchema } from '../hosting/worker.js';
import { makeEnv, seedBasic, req, cookie, makeChecker } from './lib/d1-harness.mjs';

const { check, checkTrue, done } = makeChecker();
const { env, sqlite } = makeEnv({});
await ensureCoreSchema(env);
await seedBasic(env);

// user#2 — SINOV akkaunt; user#3 — egasining ICHKI akkaunti.
sqlite.prepare(`UPDATE users SET is_test = 1 WHERE id = 2`).run();
sqlite.prepare(`INSERT INTO users (id, email, password_hash, created_at, is_internal) VALUES (3, 'owner@test.local', 'x', datetime('now'), 1)`).run();

// Eski tizimdan qolgan raqam — u ENDI ISHLATILMASLIGI kerak.
sqlite.prepare(`UPDATE platform_wallet SET balance = 7990000 WHERE id = 1`).run();

const order = sqlite.prepare(
  `INSERT INTO web_orders (id, user_id, code, price, status, payload, created_at, kind, payme_transaction_id, click_transaction_id, cancel_time)
   VALUES (?,?,?,?,?,'{}',datetime('now'),?,?,?,?)`);
order.run(1, 1, 'VIP001', 199000, 'paid', 'card_purchase', 'pm-1', null, null);    // Payme — hisobga kiradi
order.run(2, 1, 'BIZ777', 300000, 'paid', 'card_purchase', null, 'ck-1', null);    // Click — hisobga kiradi
order.run(3, 1, 'AAA111', 500000, 'pending', 'card_purchase', 'pm-3', null, null); // TO'LANMAGAN — hech qayerda
order.run(4, 1, 'BBB222', 400000, 'cancelled', 'card_purchase', 'pm-4', null, '2026-09-01 10:00:00'); // bekor — hech qayerda
order.run(5, 2, 'OTH222', 999000, 'paid', 'card_purchase', 'pm-5', null, null);    // SINOV akkaunt — «Boshqa»
order.run(6, 3, 'OWN001', 111000, 'paid', 'card_purchase', 'pm-6', null, null);    // ICHKI akkaunt — «Boshqa»
order.run(7, 1, 'LEG001', 70000, 'paid', 'card_purchase', null, null, null);       // eski (raqamsiz) — «Boshqa»
order.run(8, 1, 'TST001', 1000, 'paid', 'payme_test', 'pm-8', null, null);         // Payme sinovi — «Boshqa»
order.run(9, 1, 'MAN001', 50000, 'paid', 'card_purchase', 'pm-9', null, null);     // qo'lda tasdiqlangan — «Boshqa»
order.run(10, 1, 'REF001', 80000, 'paid', 'card_purchase', 'pm-10', null, '2026-09-02 10:00:00'); // qaytarilgan
sqlite.prepare(`INSERT INTO admin_activity_log (action, details, old_value, new_value, created_at)
  VALUES ('payment_confirmed_manually', 'web_orders #9 (card_purchase, MAN001)', 'pending', 'paid', datetime('now'))`).run();
// Jurnaldagi o'xshash, lekin BOSHQA buyurtma (#90) — #9 ni "qo'lda" qilib qo'ymasligi kerak.
sqlite.prepare(`INSERT INTO admin_activity_log (action, details, old_value, new_value, created_at)
  VALUES ('payment_confirmed_manually', 'web_orders #90 (card_purchase, ZZZ)', 'pending', 'paid', datetime('now'))`).run();
// Muvaffaqiyatsiz qo'lda urinish (#1) — kanalni o'zgartirmaydi.
sqlite.prepare(`INSERT INTO admin_activity_log (action, details, old_value, new_value, created_at)
  VALUES ('payment_confirmed_manually', 'web_orders #1 (card_purchase, VIP001)', 'pending', 'failed:code_taken', datetime('now'))`).run();
// Eski Telegram bot buyurtmasi — «Boshqa».
sqlite.prepare(`INSERT INTO bot_orders (id, tg_user_id, tg_name, code, price, status, created_at) VALUES (1, 555, 'Bot', 'BOT111', 99000, 'paid', datetime('now'))`).run();
sqlite.prepare(`INSERT INTO bot_orders (id, tg_user_id, tg_name, code, price, status, created_at) VALUES (2, 556, 'Bot', 'BOT222', 99000, 'pending', datetime('now'))`).run();

const res = await worker.fetch(req('/api/admin/platform-wallet', { cookie: cookie.admin }), env);
check('200 qaytadi', res.status, 200);
const d = await res.json();

// Faqat Payme (199 000) + Click (300 000) = 499 000
check('daromad = faqat Payme/Click orqali to‘langanlar', d.balance, 499000);
check('hisobga kirgan buyurtmalar soni = 2', d.paidOrders, 2);
check('qaytarilgan alohida (jamiga kirmaydi)', [d.refundedTotal, d.refundedOrders], [80000, 1]);
// sinov 999 000 + ichki 111 000 + eski 70 000 + Payme sinovi 1 000 + qo'lda 50 000 + bot 99 000
check('«Boshqa»: qo‘lda, eski, sinov, sinov/ichki akkaunt, bot', [d.otherTotal, d.otherOrders], [1330000, 6]);

// ENG MUHIMI: eski qotib qolgan raqam QAYTMASLIGI kerak.
checkTrue('eski platform_wallet raqami ishlatilmaydi', d.balance !== 7990000);

// Jadval O'CHIRILMAGAN — eski moliyaviy yozuv joyida qolsin.
const row = sqlite.prepare(`SELECT balance FROM platform_wallet WHERE id = 1`).get();
check('eski jadval tegilmadi (tarix saqlanadi)', row.balance, 7990000);
check('hech bir buyurtma o‘chirilmadi', sqlite.prepare(`SELECT COUNT(*) AS n FROM web_orders`).get().n, 10);

// Payme orqali yangi to'lov qo'shilsa raqam O'ZGARADI — ya'ni u haqiqatan jonli.
order.run(11, 1, 'CCC333', 50000, 'paid', 'card_purchase', 'pm-11', null, null);
const d2 = await (await worker.fetch(req('/api/admin/platform-wallet', { cookie: cookie.admin }), env)).json();
check('yangi Payme to‘lovi darhol qo‘shiladi', d2.balance, 549000);
// Raqamsiz "to'langan" yozuv esa daromadni o'zgartirmaydi.
order.run(12, 1, 'DDD444', 40000, 'paid', 'card_purchase', null, null, null);
const d3 = await (await worker.fetch(req('/api/admin/platform-wallet', { cookie: cookie.admin }), env)).json();
check('raqamsiz "to‘langan" yozuv daromadga kirmaydi, «Boshqa»ga tushadi', [d3.balance, d3.otherTotal], [549000, 1370000]);

// ── Buyurtmalar ro'yxati: ko'rinishlar va kanal belgisi ──
{
  const list = async (qs) => (await (await worker.fetch(req(`/api/admin/orders${qs}`, { cookie: cookie.admin }), env)).json()).orders;
  const paid = await list('?view=paid');
  // Ro'yxat ish uchun: ichki akkaunt buyurtmasi (#6) KO'RINADI, sinov (#5) yashirin.
  check('view=paid: Payme/Click orqali to‘langanlar', paid.map((o) => o.id).sort((a, b) => a - b), [1, 2, 6, 11]);
  const other = await list('?view=other');
  check('view=other: «Boshqa» (qo‘lda, eski, sinov, qaytarilgan, bekor, bot)',
    other.map((o) => `${o.source}-${o.id}`).sort(), ['bot-1', 'bot-2', 'web-10', 'web-12', 'web-4', 'web-7', 'web-8', 'web-9'].sort());
  check('view=refunded: faqat qaytarilgan Payme/Click', (await list('?view=refunded')).map((o) => o.id), [10]);
  const pending = await list('?view=pending');
  check('view=pending', pending.map((o) => o.id), [3]);
  const all = await list('');
  const byId = Object.fromEntries(all.filter((o) => o.source === 'web').map((o) => [o.id, o]));
  check('kanal: payme / click / legacy / test / manual', [byId[1].channel, byId[2].channel, byId[7].channel, byId[8].channel, byId[9].channel], ['payme', 'click', 'legacy', 'test', 'manual']);
  check('qaytarilgan belgisi', [byId[10].refunded, byId[1].refunded], [true, false]);
  check('bot qatori kanali', all.find((o) => o.source === 'bot').channel, 'bot');
  checkTrue('sinov akkaunt buyurtmasi standart ro‘yxatda yo‘q', !byId[5]);
}

// Faqat admin uchun.
const anon = await worker.fetch(req('/api/admin/platform-wallet'), env);
checkTrue('adminsiz ochilmaydi', anon.status === 401 || anon.status === 403);

done();
