// Admin auksionni bekor qilishi — "To'lov kutilmoqda" holati ham.
//   node scripts/test-auction-cancel.mjs
//
// NIMA UCHUN: bekor qilish avval FAQAT 'active' auksionga ruxsat berardi.
// "To'lov kutilmoqda" (awaiting_payment) holatidagi auksion uchun admin
// panelida tugma ko'rinsa ham, backend uni DOIM 409 bilan rad etardi.
// Bunday auksion butunlay tirik qolib ketishi mumkin edi: g'olib
// foydalanuvchi o'chirilsa `highest_bidder_id` NULL bo'ladi, lekin holat
// o'zgarmaydi — to'lov oqimi ham, bekor qilish ham ishlamaydi.
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
const now = new Date().toISOString();
// ID ni qo'lda bermaymiz — API yaratadigan auksionlar avtomatik ID oladi
// va qo'lda yozilgan raqamlar bilan to'qnashadi.
const mkAuction = async (code, status, bidderId = null) => {
  const row = await env.DB.prepare(
    `INSERT INTO auctions (code, seller_id, start_price, current_price, highest_bidder_id, ends_at, status, min_increment, created_at)
     VALUES (?, NULL, 100000, 150000, ?, ?, ?, 25000, ?) RETURNING id`
  ).bind(code, bidderId, now, status, now).first();
  return Number(row.id);
};
const statusOf = async (id) => (await env.DB.prepare(`SELECT status FROM auctions WHERE id = ?`).bind(id).first())?.status;

// ═══ 1. "To'lov kutilmoqda" auksioni BEKOR QILINADI (asosiy tuzatish) ═══
{
  const id_NAN404 = await mkAuction('NAN404', 'awaiting_payment', null); // g'olib o'chirilgan
  const r = await call(`/api/admin/auctions/${id_NAN404}/cancel`, { method: 'POST', cookie: cookie.admin, json: {} });
  check("awaiting_payment auksioni bekor qilinadi", r.status, 200);
  check('holat cancelled', await statusOf(id_NAN404), 'cancelled');
}

// ═══ 2. Bekor qilingach KOD QAYTA SOTUVGA chiqadi ═══
// Admin shu kod uchun yangi auksion ocha oladi (avval 'already_in_auction'
// emas), ya'ni kod band emas.
{
  const r = await call('/api/admin/auctions', {
    method: 'POST', cookie: cookie.admin,
    json: { code: 'NAN404', startPrice: 150000, hours: 24 },
  });
  checkTrue('bekor qilingandan keyin kod uchun yangi auksion ochiladi', r.status === 201 || r.status === 200);
}

// ═══ 3. 'active' auksion avvalgidek bekor qilinadi ═══
{
  const id_BBB777 = await mkAuction('BBB777', 'active', null);
  const r = await call(`/api/admin/auctions/${id_BBB777}/cancel`, { method: 'POST', cookie: cookie.admin, json: {} });
  check('active auksion bekor qilinadi', r.status, 200);
  check('holat cancelled', await statusOf(id_BBB777), 'cancelled');
}

// ═══ 4. IKKI MARTA bosilsa mablag' IKKI MARTA bo'shatilmaydi ═══
// Eng muhim xavfsizlik tekshiruvi: shartli UPDATE holatni bir marta
// o'zgartiradi, ikkinchi chaqiruv 409 qaytaradi va hech narsa yozmaydi.
{
  const id_DBL001 = await mkAuction('DBL001', 'awaiting_payment', 1);
  await env.DB.prepare(`INSERT INTO bids (auction_id, user_id, amount, created_at) VALUES (?, 1, 200000, ?)`).bind(id_DBL001, now).run();
  await env.DB.prepare(`UPDATE users SET held_balance = 200000 WHERE id = 1`).run();

  const first = await call(`/api/admin/auctions/${id_DBL001}/cancel`, { method: 'POST', cookie: cookie.admin, json: {} });
  check('birinchi bekor qilish 200', first.status, 200);
  const afterFirst = Number((await env.DB.prepare(`SELECT held_balance AS b FROM users WHERE id = 1`).first()).b);
  check("mablag' bir marta bo'shatildi", afterFirst, 0);

  const second = await call(`/api/admin/auctions/${id_DBL001}/cancel`, { method: 'POST', cookie: cookie.admin, json: {} });
  check('ikkinchi bekor qilish 409', second.status, 409);
  const afterSecond = Number((await env.DB.prepare(`SELECT held_balance AS b FROM users WHERE id = 1`).first()).b);
  check("mablag' IKKI MARTA bo'shatilmadi", afterSecond, afterFirst);
  const tx = await env.DB.prepare(`SELECT COUNT(*) AS n FROM transactions WHERE ref_id = ? AND kind = 'bid_release'`).bind(id_DBL001).first();
  check("bo'shatish yozuvi ham bir marta", Number(tx.n), 1);
}

// ═══ 5. Sotilgan auksionga TEGILMAYDI ═══
{
  const id_SLD001 = await mkAuction('SLD001', 'sold', 1);
  const r = await call(`/api/admin/auctions/${id_SLD001}/cancel`, { method: 'POST', cookie: cookie.admin, json: {} });
  check('sotilgan auksion -> 409', [r.status, r.body?.error], [409, 'cannot_cancel']);
  check("holati o'zgarmagan", await statusOf(id_SLD001), 'sold');
}

// ═══ 6. RUXSAT: mehmon bekor qila olmaydi ═══
{
  const id_PRM001 = await mkAuction('PRM001', 'awaiting_payment', null);
  const anon = await call(`/api/admin/auctions/${id_PRM001}/cancel`, { method: 'POST', json: {} });
  checkTrue("loginsiz bekor qilib bo'lmaydi", anon.status === 401 || anon.status === 403);
  check("holati o'zgarmagan", await statusOf(id_PRM001), 'awaiting_payment');
}

done();
