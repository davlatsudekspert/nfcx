// Muddati o'tgan "kutilmoqda" buyurtmalar HAMMASI BIRDAN yopiladi (egasi,
// 2026-09-28: "buyurtmalar osilib o'tmasligi kerak").
//   node scripts/test-order-expire-sweep.mjs
import worker, { expireStaleWebOrdersD1 } from '../hosting/worker.js';
import { makeEnv, seedBasic, cookie, req, makeChecker } from './lib/d1-harness.mjs';

const { env } = makeEnv();
await seedBasic(env);
const { check, checkTrue, done } = makeChecker();
const H = 60 * 60 * 1000;
const iso = (ms) => new Date(ms).toISOString();
// Uch xil vaqt formati (order-window.js ga qarang).
const sqlite = (ms) => iso(ms).slice(0, 19).replace('T', ' ');
const nowTs = (ms) => iso(ms).slice(0, 23).replace('T', ' ') + '+00';
const mk = async (code, createdAt, status = 'pending', kind = 'card_purchase', tx = null) => {
  const r = await env.DB.prepare(
    `INSERT INTO web_orders (user_id, code, kind, price, payload, status, created_at, payme_transaction_id)
     VALUES (1, ?, ?, 149000, '{}', ?, ?, ?) RETURNING id`
  ).bind(code, kind, status, createdAt, tx).first();
  return Number(r.id);
};
const st = async (id) => (await env.DB.prepare(`SELECT status FROM web_orders WHERE id = ?`).bind(id).first()).status;
const now = Date.now();

const oldIso = await mk('EXP001', iso(now - 6 * 24 * H));
const oldSql = await mk('EXP002', sqlite(now - 11 * 24 * H));
const oldTs = await mk('EXP003', nowTs(now - 25 * H), 'pending', 'physical_card_order');
const oldTx = await mk('EXP004', iso(now - 4 * 24 * H), 'pending', 'premium_upgrade', 'tx_old');
const fresh = await mk('EXP005', iso(now - 2 * H));
const freshTx = await mk('EXP006', iso(now - 1 * H), 'pending', 'card_purchase', 'tx_new');
const paid = await mk('EXP007', iso(now - 9 * 24 * H), 'paid');
const broken = await mk('EXP008', 'buzuq-vaqt');

const n = await expireStaleWebOrdersD1(env);
check('4 ta eskirgan buyurtma yopildi', n, 4);
for (const [id, name] of [[oldIso, 'ISO 6 kun'], [oldSql, 'SQLite 11 kun'], [oldTs, 'nowTs 25 soat'], [oldTx, 'eski Payme tx 4 kun']]) {
  check(`${name} -> cancelled`, await st(id), 'cancelled');
}
check('2 soatlik buyurtma TEGILMAYDI (mijoz hali to\'layotgan bo\'lishi mumkin)', await st(fresh), 'pending');
check('1 soatlik Payme tranzaksiyasi TEGILMAYDI', await st(freshTx), 'pending');
check('to\'langan buyurtma TEGILMAYDI', await st(paid), 'paid');
check('vaqti o\'qilmaydigan qator TEGILMAYDI', await st(broken), 'pending');
const row = await env.DB.prepare(`SELECT cancel_time, cancel_reason FROM web_orders WHERE id = ?`).bind(oldTx).first();
check('cancel_time/cancel_reason Payme protokoliniki — tegilmaydi', [row.cancel_time ?? null, row.cancel_reason ?? null], [null, null]);
check('ikkinchi marta — hech narsa qolmadi (idempotent)', await expireStaleWebOrdersD1(env), 0);

// Kod qayta sotuvga chiqdi: shu kodga yangi kutilayotgan buyurtma yaratiladi.
const { createPendingWebOrderD1 } = await import('../hosting/worker.js');
const again = await createPendingWebOrderD1(env, { userId: 1, code: 'EXP001', price: 149000, payload: {} });
checkTrue('yopilgan kod qayta band qilinadi', !!again);

// Admin ro'yxati ochilganda ham yopiladi (kunlik cron'ni kutmasdan).
const late = await mk('EXP009', iso(now - 3 * 24 * H));
const r = await worker.fetch(req('/api/admin/orders', { cookie: cookie.admin }), env);
check('admin buyurtmalar ro\'yxati 200', r.status, 200);
check('ro\'yxat ochilganda eskirgan buyurtma yopildi', await st(late), 'cancelled');

done();
