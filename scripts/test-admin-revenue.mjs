// PLATFORMA DAROMADI — JONLI hisoblanishi kerak.
//
// NIMA UCHUN BU TEST BOR: bu raqam `platform_wallet.balance` dan
// o'qilardi, unga esa HOZIRGI kod hech qachon yozmaydi — faqat eski
// Express/Postgres tizimi oshirib borardi. Natijada ekranda "real pul"
// deb 7 990 000 turardi: eski tizimdan qotib qolgan, bugungi pulga
// aloqasi yo'q raqam. Hech qanday xato chiqmasdi va shu sabab uni
// oylab payqash mumkin emas edi.
//
// Endi raqam har safar TO'LANGAN buyurtmalardan hisoblanadi. Bu test
// aynan shuni qo'riqlaydi: kimdir qaytib `platform_wallet` ga o'tsa
// yoki sinov akkauntlarni chiqarishni unutsa — shu yerda qulaydi.
//
//   node scripts/test-admin-revenue.mjs
import worker, { ensureCoreSchema } from '../hosting/worker.js';
import { makeEnv, seedBasic, req, cookie, makeChecker } from './lib/d1-harness.mjs';

const { check, checkTrue, done } = makeChecker();
const { env, sqlite } = makeEnv({});
await ensureCoreSchema(env);
await seedBasic(env);

// user#2 — SINOV akkaunt.
sqlite.prepare(`UPDATE users SET is_test = 1 WHERE id = 2`).run();

// Eski tizimdan qolgan raqam — u ENDI ISHLATILMASLIGI kerak.
sqlite.prepare(`UPDATE platform_wallet SET balance = 7990000 WHERE id = 1`).run();

const order = sqlite.prepare(
  `INSERT INTO web_orders (user_id, code, price, status, payload, created_at)
   VALUES (?,?,?,?,'{}',datetime('now'))`);
order.run(1, 'VIP001', 199000, 'paid');      // hisobga kiradi
order.run(1, 'BIZ777', 300000, 'paid');      // hisobga kiradi
order.run(1, 'AAA111', 500000, 'pending');   // TO'LANMAGAN — kirmaydi
order.run(1, 'BBB222', 400000, 'cancelled'); // bekor — kirmaydi
order.run(2, 'OTH222', 999000, 'paid');      // SINOV akkaunt — kirmaydi

const res = await worker.fetch(req('/api/admin/platform-wallet', { cookie: cookie.admin }), env);
check('200 qaytadi', res.status, 200);
const d = await res.json();

// 199 000 + 300 000 = 499 000
check('daromad = to‘langanlar yig‘indisi', d.balance, 499000);
check('to‘langan buyurtmalar soni = 2', d.paidOrders, 2);

// ENG MUHIMI: eski qotib qolgan raqam QAYTMASLIGI kerak.
checkTrue('eski platform_wallet raqami ishlatilmaydi', d.balance !== 7990000);

// Jadval O'CHIRILMAGAN — eski moliyaviy yozuv joyida qolsin.
const row = sqlite.prepare(`SELECT balance FROM platform_wallet WHERE id = 1`).get();
check('eski jadval tegilmadi (tarix saqlanadi)', row.balance, 7990000);

// To'lov qo'shilsa raqam O'ZGARADI — ya'ni u haqiqatan jonli.
order.run(1, 'CCC333', 50000, 'paid');
const d2 = await (await worker.fetch(req('/api/admin/platform-wallet', { cookie: cookie.admin }), env)).json();
check('yangi to‘lov darhol qo‘shiladi', d2.balance, 549000);

// Faqat admin uchun.
const anon = await worker.fetch(req('/api/admin/platform-wallet'), env);
checkTrue('adminsiz ochilmaydi', anon.status === 401 || anon.status === 403);

done();
