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
// Haqiqiy himoya funksiyasi orqali tekshirish (to'g'ridan-to'g'ri INSERT
// uni chetlab o'tadi, shuning uchun test hech narsa isbotlamasdi).
const { activeWebOrderByCodeD1 } = await import('../hosting/worker.js');
const H_activeOrder = (code) => activeWebOrderByCodeD1(env, code);
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

// ═══ 4. Payme tranzaksiyasi ESKI (muddatdan oshgan) -> bekor qilinadi ═══
{
  const old = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
  await env.DB.prepare(`UPDATE web_orders SET created_at = ? WHERE code = 'TST077' AND status = 'pending'`).bind(old).run();
  const row = await env.DB.prepare(`SELECT id FROM web_orders WHERE code = 'TST077' AND status = 'pending'`).first();
  const r = await call(`/api/admin/orders/${row.id}/cancel`, { method: 'POST', cookie: cookie.admin });
  check('muddatdan eski tranzaksiya -> bekor qilinadi', r.status, 200);
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

// ═══ 8. MUDDAT AVTOMATIK TUGAYDI — bu mexanizm AVVALDAN bor ═══
// `activeWebOrderByCodeD1()` muddati o'tgan kutilayotgan buyurtmani
// avtomatik 'cancelled' qiladi va kod qayta sotuvga chiqadi.
// Bu yerda o'sha xulq QO'RIQLANADI (24 soat — order-window.js).
{
  await mkOrder('EXP111');
  // 23 soatlik — hali bloklaydi (mijoz to'layotgan bo'lishi mumkin).
  await env.DB.prepare(`UPDATE web_orders SET created_at = ? WHERE code = 'EXP111' AND status = 'pending'`)
    .bind(new Date(Date.now() - 23 * 3600_000).toISOString()).run();
  const active23 = await H_activeOrder('EXP111');
  checkTrue('23 soatlik buyurtma kodni HALI bloklaydi', !!active23);

  // 25 soatlik — avtomatik bekor qilinadi, kod bo'shaydi.
  await env.DB.prepare(`UPDATE web_orders SET created_at = ? WHERE code = 'EXP111' AND status = 'pending'`)
    .bind(new Date(Date.now() - 25 * 3600_000).toISOString()).run();
  const active25 = await H_activeOrder('EXP111');
  check('25 soatlik buyurtma kodni BLOKLAMAYDI', active25, null);
  check('u avtomatik bekor qilingan', await pendingCount('EXP111'), 0);
}

// ═══ 9. Kabinet API taymer uchun muddat vaqtini qaytaradi ═══
{
  await env.DB.prepare(`DELETE FROM web_orders WHERE code = 'TMR001'`).run();
  await mkOrder('TMR001');
  const r = await call('/api/orders', { cookie: cookie.user });
  const o = (r.body?.orders || []).find((x) => x.code === 'TMR001');
  checkTrue('kutilayotgan buyurtmada expiresAtMs bor', typeof o?.expiresAtMs === 'number');
  const hoursLeft = (o.expiresAtMs - Date.now()) / 3600_000;
  checkTrue('muddat ~24 soatdan keyin (23.5-24.5 oralig\'ida)', hoursLeft > 23.5 && hoursLeft < 24.5);
  const paid = (r.body?.orders || []).find((x) => x.code === 'TST075');
  check('to\'langan buyurtmada taymer yo\'q', paid?.expiresAtMs ?? null, null);
}

// ═══ 10. VAQTNI O'QIB BO'LMASA — taymer KO'RSATILMAYDI (noto'g'ri emas) ═══
// worker.js `nowTs()` formati ("...+00") SQLite sana funksiyalarini buzadi
// va strftime NULL qaytaradi. Bunday holatda noto'g'ri vaqt ko'rsatgandan
// ko'ra, umuman ko'rsatmagan afzal.
{
  await mkOrder('BADTS1');
  await env.DB.prepare(`UPDATE web_orders SET created_at = ? WHERE code = 'BADTS1' AND status = 'pending'`)
    .bind('2020-01-01 00:00:00.000+00').run();
  const r = await call('/api/orders', { cookie: cookie.user });
  const o = (r.body?.orders || []).find((x) => x.code === 'BADTS1');
  check('o\'qib bo\'lmaydigan vaqt -> taymer yo\'q (null)', o?.expiresAtMs ?? null, null);
}

done();
