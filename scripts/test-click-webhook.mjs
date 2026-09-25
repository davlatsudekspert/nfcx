// CLICK SHOP-API — Prepare va Complete marshrutlari (admin tekshiruvi, 2026-09-25).
//
// Kod (`handleClickRequestD1`) bor edi, lekin marshrut ULANMAGAN va
// `click_transactions` jadvali yaratilmagan edi: Click orqali to'lov
// oxiriga yetmasdi. Bu test haqiqiy `hosting/worker.js` ni Click
// imzosi (MD5) bilan chaqiradi:
//   * /api/pay/click/prepare va /complete (form-urlencoded, Click kabi);
//   * bitta manzil /api/pay/click (`action` bo'yicha);
//   * imzo, summa, takroriy so'rov, bekor qilingan to'lov;
//   * muvaffaqiyatli Complete: buyurtma `paid`, karta egasiga o'tdi,
//     `web_orders.click_transaction_id` yozildi (admin to'lov kanalini shundan biladi).
//
//   node scripts/test-click-webhook.mjs
import worker from '../hosting/worker.js';
import { makeEnv, seedBasic, req, makeChecker } from './lib/d1-harness.mjs';
import { createHash } from 'node:crypto';

const { check, checkTrue, done } = makeChecker();
const SECRET = 'click-secret-test';
const SERVICE = '12345';
const { env, sqlite } = makeEnv({
  PAYMENTS_ENABLED: 'true', CLICK_SERVICE_ID: SERVICE, CLICK_SECRET_KEY: SECRET, CLICK_MERCHANT_ID: '777',
});
await seedBasic(env);

const md5 = (s) => createHash('md5').update(s).digest('hex');
const sign = (p, withPrepare) => md5([
  p.click_trans_id, p.service_id, SECRET, p.merchant_trans_id,
  ...(withPrepare ? [p.merchant_prepare_id] : []),
  p.amount, p.action, p.sign_time,
].map((v) => (v == null ? '' : String(v))).join(''));
const post = async (path, params) => {
  const res = await worker.fetch(req(path, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString(),
  }), env);
  return { status: res.status, body: await res.json().catch(() => null) };
};
const one = (sql, ...a) => sqlite.prepare(sql).get(...a) || null;

// Kutilayotgan NFC ID xaridi: user#1, CLK123, 149 000 so'm.
sqlite.prepare(`INSERT INTO web_orders (id, user_id, code, kind, price, payload, status, created_at)
  VALUES (701, 1, 'CLK123', 'card_purchase', 149000, '{"name":"Click Xaridor"}', 'pending', ?)`)
  .run(new Date().toISOString().replace('T', ' ').replace('Z', '+00'));

const base = { click_trans_id: 900001, service_id: SERVICE, click_paydoc_id: 55501, merchant_trans_id: 701, amount: '149000.00', sign_time: '2026-09-25 10:00:00' };
const prep = { ...base, action: 0, error: 0, error_note: 'Success' };
prep.sign_string = sign(prep, false);

// ── Imzo va summa ──
{
  const bad = await post('/api/pay/click/prepare', { ...prep, sign_string: 'x'.repeat(32) });
  check('imzo noto‘g‘ri -> -1', bad.body?.error, -1);
  const wrongAmount = { ...prep, amount: '1000.00' };
  wrongAmount.sign_string = sign(wrongAmount, false);
  const amt = await post('/api/pay/click/prepare', wrongAmount);
  check('summa noto‘g‘ri -> -2', amt.body?.error, -2);
  const missing = { ...prep, merchant_trans_id: 999999 };
  missing.sign_string = sign(missing, false);
  check('buyurtma yo‘q -> -5', (await post('/api/pay/click/prepare', missing)).body?.error, -5);
}

// ── Prepare ──
let prepareId;
{
  const r = await post('/api/pay/click/prepare', prep);
  check('Prepare -> 200, error 0', [r.status, r.body?.error, r.body?.merchant_trans_id], [200, 0, '701']);
  prepareId = r.body?.merchant_prepare_id;
  checkTrue('merchant_prepare_id berildi', Number(prepareId) > 0);
  const again = await post('/api/pay/click/prepare', prep);
  check('takroriy Prepare -> o‘sha prepare id (yangi qator yo‘q)', [again.body?.error, again.body?.merchant_prepare_id], [0, prepareId]);
  check('buyurtma hali pending', one(`SELECT status FROM web_orders WHERE id = 701`).status, 'pending');
}

// ── Complete ──
{
  const comp = { ...base, action: 1, merchant_prepare_id: prepareId, error: 0, error_note: 'Success' };
  comp.sign_string = sign(comp, true);
  const noSign = await post('/api/pay/click/complete', { ...comp, sign_string: sign(prep, false) });
  check('Complete: Prepare imzosi bilan -> -1', noSign.body?.error, -1);
  const r = await post('/api/pay/click/complete', comp);
  check('Complete -> error 0, merchant_confirm_id', [r.body?.error, r.body?.merchant_confirm_id], [0, prepareId]);
  check('buyurtma paid', one(`SELECT status FROM web_orders WHERE id = 701`).status, 'paid');
  check('karta yaratildi va xaridorga berildi', one(`SELECT user_id FROM cards WHERE code = 'CLK123'`), { user_id: 1 });
  check('web_orders.click_transaction_id yozildi', one(`SELECT click_transaction_id FROM web_orders WHERE id = 701`).click_transaction_id, '900001');
  check('click_transactions: paid', one(`SELECT status FROM click_transactions WHERE click_trans_id = '900001'`).status, 'paid');
  const dup = await post('/api/pay/click/complete', comp);
  check('takroriy Complete -> -4 (allaqachon to‘langan)', dup.body?.error, -4);
}

// ── Bekor qilingan to'lov, bitta manzil (/api/pay/click, action bo'yicha) ──
{
  sqlite.prepare(`INSERT INTO web_orders (id, user_id, code, kind, price, payload, status, created_at)
    VALUES (702, 1, 'CLK124', 'card_purchase', 99000, '{"name":"X"}', 'pending', ?)`)
    .run(new Date().toISOString().replace('T', ' ').replace('Z', '+00'));
  const p2 = { click_trans_id: 900002, service_id: SERVICE, click_paydoc_id: 55502, merchant_trans_id: 702, amount: '99000', action: 0, sign_time: '2026-09-25 11:00:00', error: 0 };
  p2.sign_string = sign(p2, false);
  const r = await post('/api/pay/click', p2);
  check('bitta manzil: Prepare (action=0)', r.body?.error, 0);
  const c2 = { ...p2, action: 1, merchant_prepare_id: r.body?.merchant_prepare_id, error: -5017 };
  c2.sign_string = sign(c2, true);
  const cancel = await post('/api/pay/click', c2);
  check('Click bekor qildi (error<0) -> -9, buyurtma pending qoladi',
    [cancel.body?.error, one(`SELECT status FROM web_orders WHERE id = 702`).status, one(`SELECT click_transaction_id FROM web_orders WHERE id = 702`).click_transaction_id],
    [-9, 'pending', null]);
}

// ── To'lovlar o'chirilgan ──
{
  env.PAYMENTS_ENABLED = 'false';
  const r = await post('/api/pay/click/prepare', prep);
  check('to‘lovlar o‘chiq -> -8', r.body?.error, -8);
  env.PAYMENTS_ENABLED = 'true';
}

// ── GET yoki noma'lum yo'l Click'ga tushmaydi ──
{
  const res = await worker.fetch(req('/api/pay/click/prepare', { method: 'GET' }), env);
  checkTrue('GET -> Click javobi emas', res.status !== 200 || !(await res.clone().json().catch(() => ({}))).click_trans_id);
}

done();
