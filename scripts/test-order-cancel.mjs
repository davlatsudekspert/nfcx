// Kutilayotgan buyurtmani admin bekor qilishi — kod qayta sotuvga chiqadi.
//   node scripts/test-order-cancel.mjs
//
// NIMA UCHUN: createPendingWebOrderD1() bitta kod uchun ikkinchi
// kutilayotgan buyurtma yaratmaydi. Ya'ni to'lovni yarim yo'lda tashlab
// ketilgan kodni BOSHQA HECH KIM sotib ololmasdi va bekor qilish yo'li
// yo'q edi — kod abadiy bloklanardi.
import worker from '../hosting/worker.js';
import { makeEnv, seedBasic, cookie, req, makeChecker } from './lib/d1-harness.mjs';

const { env } = makeEnv();
await seedBasic(env);
const { check, checkTrue, done } = makeChecker();
const call = async (pathname, init) => {
  const r = await worker.fetch(req(pathname, init), env);
  let body = null; try { body = await r.json(); } catch { body = null; }
  return { status: r.status, body };
};
const mkOrder = async (code, extra = '') => {
  await env.DB.prepare(
    `INSERT INTO web_orders (user_id, code, kind, price, payload, status, created_at${extra ? ', payme_transaction_id' : ''})
     VALUES (1, ?, 'card_purchase', 149000, '{}', 'pending', ?${extra ? ", 'tx_" + code + "'" : ''})`
  ).bind(code, new Date().toISOString()).run();
  const row = await env.DB.prepare(`SELECT id FROM web_orders WHERE code = ? AND status = 'pending'`).bind(code).first();
  return Number(row.id);
};
const pendingCount = async (code) =>
  Number((await env.DB.prepare(`SELECT COUNT(*) AS n FROM web_orders WHERE code = ? AND status = 'pending'`).bind(code).first()).n);

// ═══ 1. Bekor qilish kutilayotgan buyurtmani yopadi ═══
{
  const id = await mkOrder('TST001');
  check('boshida kutilayotgan buyurtma bor', await pendingCount('TST001'), 1);
  const r = await call(`/api/admin/orders/${id}/cancel`, { method: 'POST', cookie: cookie.admin });
  check('bekor qilish 200', r.status, 200);
  check('javobda kod qaytadi', r.body?.code, 'TST001');
  check('endi kutilayotgan buyurtma YO\'Q — kod bo\'sh', await pendingCount('TST001'), 0);
  const row = await env.DB.prepare(`SELECT status, cancel_time, cancel_reason FROM web_orders WHERE id = ?`).bind(id).first();
  check('holat cancelled', row.status, 'cancelled');
  checkTrue('cancel_time qo\'yildi', !!row.cancel_time);
  check('cancel_reason O\'YLAB TOPILMAGAN (Payme kodi)', row.cancel_reason, null);
}

// ═══ 2. Bekor qilingach kod QAYTA SOTUVGA chiqadi ═══
// Eng muhim tekshiruv: endi shu kodga yangi buyurtma yaratish mumkin.
{
  const again = await mkOrder('TST001');
  checkTrue('bekor qilingandan keyin yangi buyurtma yaratildi', again > 0);
  check('yangi buyurtma kutilmoqda', await pendingCount('TST001'), 1);
}

// ═══ 3. FAOL Payme tranzaksiyasi bor buyurtmaga TEGILMAYDI ═══
// Aks holda mijoz to'lovni yakunlaganda pul o'tadi, karta berilmaydi.
{
  const id = await mkOrder('TST077', 'payme');
  const r = await call(`/api/admin/orders/${id}/cancel`, { method: 'POST', cookie: cookie.admin });
  check('faol Payme tranzaksiyasi -> 409 payme_active', [r.status, r.body?.error], [409, 'payme_active']);
  check('buyurtma hamon kutilmoqda', await pendingCount('TST077'), 1);
}

// ═══ 4. Payme tranzaksiyasi ESKI (12 soatdan oshgan) -> bekor qilinadi ═══
{
  const old = new Date(Date.now() - 13 * 60 * 60 * 1000).toISOString();
  await env.DB.prepare(`UPDATE web_orders SET created_at = ? WHERE code = 'TST077' AND status = 'pending'`).bind(old).run();
  const row = await env.DB.prepare(`SELECT id FROM web_orders WHERE code = 'TST077' AND status = 'pending'`).first();
  const r = await call(`/api/admin/orders/${row.id}/cancel`, { method: 'POST', cookie: cookie.admin });
  check('12 soatdan eski tranzaksiya -> bekor qilinadi', r.status, 200);
  check('kod bo\'shadi', await pendingCount('TST077'), 0);
}

// ═══ 5. TO'LANGAN buyurtmaga TEGILMAYDI ═══
{
  await env.DB.prepare(`INSERT INTO web_orders (user_id, code, kind, price, payload, status, created_at) VALUES (1,'TST075','card_purchase',49000,'{}','paid',?)`)
    .bind(new Date().toISOString()).run();
  const row = await env.DB.prepare(`SELECT id FROM web_orders WHERE code = 'TST075'`).first();
  const r = await call(`/api/admin/orders/${row.id}/cancel`, { method: 'POST', cookie: cookie.admin });
  check('to\'langan buyurtma -> 409', [r.status, r.body?.error], [409, 'not_pending']);
  const after = await env.DB.prepare(`SELECT status FROM web_orders WHERE id = ?`).bind(row.id).first();
  check('to\'langan buyurtma holati O\'ZGARMAGAN', after.status, 'paid');
}

// ═══ 6. RUXSAT: faqat super_admin ═══
{
  const id = await mkOrder('TST900');
  const anon = await call(`/api/admin/orders/${id}/cancel`, { method: 'POST' });
  checkTrue('loginsiz bekor qilib bo\'lmaydi', anon.status === 401 || anon.status === 403);
  const mgr = await call(`/api/admin/orders/${id}/cancel`, { method: 'POST', cookie: cookie.manager });
  check('manager bekor qila olmaydi -> 403', mgr.status, 403);
  check('buyurtma hamon kutilmoqda', await pendingCount('TST900'), 1);
}

// ═══ 7. Mavjud bo'lmagan buyurtma -> 404 ═══
{
  const r = await call('/api/admin/orders/999999/cancel', { method: 'POST', cookie: cookie.admin });
  check('topilmadi -> 404', [r.status, r.body?.error], [404, 'not_found']);
}

done();
