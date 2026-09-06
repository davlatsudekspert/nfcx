// Auksion taklif (bid) va g'olib to'lovi testi — haqiqiy worker.fetch,
// in-memory D1 (scripts/lib/d1-harness.mjs). Production D1'ga TEGMAYDI.
//   node scripts/test-auction-bid.mjs
//
// 2026-09 hotfix regressiyasi: /api/auctions/:id/bid AVVAL har doim qattiq
// yozilgan 503 `payments_disabled` qaytarardi (route Worker'ga
// ko'chirilmagan edi). Bu test o'sha ildiz sababni va porti qilingan
// biznes qoidalarini (server/db.js place_bid) qamrab oladi.
import worker from '../hosting/worker.js';
import { makeEnv, seedBasic, cookie, req, makeChecker } from './lib/d1-harness.mjs';

const PAYME_ENV = { PAYMENTS_ENABLED: 'true', PAYME_MERCHANT_ID: 'test-merchant', PAYME_KEY: 'test-key' };
const { env } = makeEnv(PAYME_ENV);
await seedBasic(env);
// 3-user — auksionlarning standart sotuvchisi (auctions.seller_id -> users.id
// FK). Fixture'dagi 1- va 2-user shunda IKKALASI ham taklif qila oladi.
await env.DB.prepare(`INSERT INTO users (id, email, password_hash, phone) VALUES (3, 'seller@test.local', 'x', '+998903333333')`).run();

const { check, checkTrue, done } = makeChecker();
const call = (pathname, init) => worker.fetch(req(pathname, init), env);
const j = async (pathname, init) => {
  const r = await call(pathname, init);
  let body = null; try { body = await r.json(); } catch { body = null; }
  return { status: r.status, body };
};

const iso = (msFromNow) => new Date(Date.now() + msFromNow).toISOString();
let nextId = 100;
// Standart sotuvchi — 3-user (fixture'da yo'q): shunda 1- va 2-user
// IKKALASI ham taklif qila oladi (OWN_AUCTION qoidasiga tushmasdan).
async function mkAuction({ sellerId = 3, startPrice = 100000, buyNow = null, endsIn = 3600_000, minIncrement = 25000, status = 'active', highest = null, current = null } = {}) {
  const id = nextId++;
  await env.DB.prepare(
    `INSERT INTO auctions (id, code, seller_id, start_price, buy_now_price, current_price, highest_bidder_id, ends_at, status, min_increment, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, 'AUC' + id, sellerId, startPrice, buyNow, current == null ? startPrice : current, highest, iso(endsIn), status, minIncrement, new Date().toISOString()).run();
  return id;
}
const auctionOf = (id) => env.DB.prepare(`SELECT * FROM auctions WHERE id = ?`).bind(id).first();

// ═══ 1. ILDIZ SABAB: taklif endi 503 emas ═══
{
  const id = await mkAuction();
  const r = await j(`/api/auctions/${id}/bid`, { method: 'POST', cookie: cookie.user, json: { amount: 100000 } });
  check('valid bid is accepted (was hardcoded 503 before the fix)', r.status, 200);
  check('valid bid response ok', [r.body.ok, r.body.buyNow, r.body.antiSnipe], [true, false, false]);
  const a = await auctionOf(id);
  check('current price + highest bidder updated', [Number(a.current_price), Number(a.highest_bidder_id)], [100000, 1]);
  const list = await j(`/api/auctions/${id}`);
  check('bid history returned by GET', list.body.bids.length, 1);
  check('GET reports the new current price', list.body.auction.currentPrice, 100000);
}

// ═══ 2. Autentifikatsiya / bloklangan foydalanuvchi ═══
{
  const id = await mkAuction();
  check('anonymous bid -> 401', (await j(`/api/auctions/${id}/bid`, { method: 'POST', json: { amount: 100000 } })).status, 401);

  await env.DB.prepare(`UPDATE users SET banned_until = ? WHERE id = 2`).bind(new Date(Date.now() + 86400_000).toISOString()).run();
  const r = await j(`/api/auctions/${id}/bid`, { method: 'POST', cookie: cookie.other, json: { amount: 100000 } });
  check('banned user -> 403 BANNED', [r.status, r.body.error], [403, 'BANNED']);
  await env.DB.prepare(`UPDATE users SET banned_until = NULL WHERE id = 2`).run();
}

// ═══ 3. Kirish ma'lumotlari va topilmagan auksion ═══
{
  const id = await mkAuction();
  check('missing amount -> 422', (await j(`/api/auctions/${id}/bid`, { method: 'POST', cookie: cookie.user, json: {} })).status, 422);
  check('non-numeric amount -> 422', (await j(`/api/auctions/${id}/bid`, { method: 'POST', cookie: cookie.user, json: { amount: 'ko‘p' } })).status, 422);
  const r = await j('/api/auctions/999999/bid', { method: 'POST', cookie: cookie.user, json: { amount: 100000 } });
  check('unknown auction -> 404 AUCTION_NOT_FOUND (not 503)', [r.status, r.body.error], [404, 'AUCTION_NOT_FOUND']);
}

// ═══ 4. TUGAGAN AUKSION -> 409, HECH QACHON 503 ═══
{
  const id = await mkAuction({ endsIn: -60_000 });
  const r = await j(`/api/auctions/${id}/bid`, { method: 'POST', cookie: cookie.user, json: { amount: 500000 } });
  check('bid on time-expired auction -> 409 AUCTION_ALREADY_CLOSED', [r.status, r.body.error], [409, 'AUCTION_ALREADY_CLOSED']);
  checkTrue('response is NOT 503', r.status !== 503);

  const closed = await mkAuction({ status: 'sold' });
  const r2 = await j(`/api/auctions/${closed}/bid`, { method: 'POST', cookie: cookie.user, json: { amount: 500000 } });
  check('bid on sold auction -> 409', [r2.status, r2.body.error], [409, 'AUCTION_ALREADY_CLOSED']);
}

// ═══ 5. "Faol / tugadi" ZIDDIYATI — dangasa yopish ═══
{
  const noBids = await mkAuction({ endsIn: -60_000 });
  const withBid = await mkAuction({ endsIn: -60_000, highest: 1, current: 300000 });
  await j('/api/auctions'); // ro'yxatni o'qish yopilishni ishga tushiradi

  const a1 = await auctionOf(noBids);
  check('expired auction with no bids -> status expired', a1.status, 'expired');
  const a2 = await auctionOf(withBid);
  check('expired auction with a bid -> status awaiting_payment', a2.status, 'awaiting_payment');
  checkTrue('awaiting_payment gets a 24h payment deadline', !!a2.payment_deadline);

  const listed = await j('/api/auctions');
  const ids = (listed.body.auctions || []).map((x) => x.id);
  checkTrue('expired auctions no longer listed as active', !ids.includes(noBids) && !ids.includes(withBid));

  const single = await j(`/api/auctions/${noBids}`);
  check('GET /api/auctions/:id no longer reports "active" for an ended auction', single.body.auction.status, 'expired');
}

// ═══ 6. O'z auksioni ═══
{
  const id = await mkAuction({ sellerId: 1 });
  const r = await j(`/api/auctions/${id}/bid`, { method: 'POST', cookie: cookie.user, json: { amount: 100000 } });
  check('own auction -> 409 OWN_AUCTION', [r.status, r.body.error], [409, 'OWN_AUCTION']);
}

// ═══ 7. Minimal narx va qadam ═══
{
  const id = await mkAuction({ startPrice: 200000, minIncrement: 25000 });
  const low = await j(`/api/auctions/${id}/bid`, { method: 'POST', cookie: cookie.user, json: { amount: 199999 } });
  check('first bid below start price -> 409 BID_TOO_LOW', [low.status, low.body.error], [409, 'BID_TOO_LOW']);
  check('BID_TOO_LOW carries minNext for the UI', low.body.minNext, 200000);

  check('first bid equal to start price is accepted', (await j(`/api/auctions/${id}/bid`, { method: 'POST', cookie: cookie.user, json: { amount: 200000 } })).status, 200);

  const under = await j(`/api/auctions/${id}/bid`, { method: 'POST', cookie: cookie.other, json: { amount: 210000 } });
  check('next bid below current+step -> 409 BID_TOO_LOW', [under.status, under.body.error], [409, 'BID_TOO_LOW']);
  check('minNext = current + min_increment', under.body.minNext, 225000);
  check('bid exactly at current+step is accepted', (await j(`/api/auctions/${id}/bid`, { method: 'POST', cookie: cookie.other, json: { amount: 225000 } })).status, 200);
  const a = await auctionOf(id);
  check('highest bidder is now user 2', Number(a.highest_bidder_id), 2);
}

// ═══ 8. Idempotentlik ═══
{
  const id = await mkAuction({ startPrice: 50000 });
  const key = 'idem-key-001';
  const first = await j(`/api/auctions/${id}/bid`, { method: 'POST', cookie: cookie.user, json: { amount: 50000, idempotencyKey: key } });
  const again = await j(`/api/auctions/${id}/bid`, { method: 'POST', cookie: cookie.user, json: { amount: 50000, idempotencyKey: key } });
  check('replayed idempotency key -> 200 idempotent', [again.status, again.body.ok, again.body.idempotent], [200, true, true]);
  check('replay returns the SAME bid id', again.body.bidId, first.body.bidId);
  const rows = await env.DB.prepare(`SELECT COUNT(*) AS n FROM bids WHERE auction_id = ?`).bind(id).first();
  check('replay did NOT insert a second bid row', Number(rows.n), 1);
  const a = await auctionOf(id);
  check('replay did NOT move the price', Number(a.current_price), 50000);
}

// ═══ 9. ANTI-SNIPE (+5 daqiqa) ═══
{
  const id = await mkAuction({ startPrice: 10000, endsIn: 60_000 });
  const before = await auctionOf(id);
  const r = await j(`/api/auctions/${id}/bid`, { method: 'POST', cookie: cookie.user, json: { amount: 10000 } });
  check('bid in the last 5 minutes reports antiSnipe', r.body.antiSnipe, true);
  const after = await auctionOf(id);
  const delta = new Date(after.ends_at).getTime() - new Date(before.ends_at).getTime();
  check('ends_at extended by exactly 5 minutes', delta, 300000);

  const far = await mkAuction({ startPrice: 10000, endsIn: 3600_000 });
  const r2 = await j(`/api/auctions/${far}/bid`, { method: 'POST', cookie: cookie.user, json: { amount: 10000 } });
  check('bid far from the end does NOT extend', r2.body.antiSnipe, false);
}

// ═══ 10. "Darhol sotib olish" ═══
{
  const id = await mkAuction({ startPrice: 100000, buyNow: 500000 });
  const r = await j(`/api/auctions/${id}/bid`, { method: 'POST', cookie: cookie.user, json: { amount: 500000 } });
  check('buy-now bid reports buyNow', [r.status, r.body.buyNow], [200, true]);
  const a = await auctionOf(id);
  check('buy-now closes bidding -> awaiting_payment', a.status, 'awaiting_payment');
  checkTrue('buy-now sets a payment deadline', !!a.payment_deadline);
  const late = await j(`/api/auctions/${id}/bid`, { method: 'POST', cookie: cookie.other, json: { amount: 900000 } });
  check('no further bids after buy-now -> 409', late.status, 409);
}

// ═══ 11. G'olib to'lovi (/pay) ═══
{
  const id = await mkAuction({ startPrice: 100000, buyNow: 400000 });
  await j(`/api/auctions/${id}/bid`, { method: 'POST', cookie: cookie.user, json: { amount: 400000 } });

  check('non-winner cannot pay -> 403 NOT_WINNER',
    (await j(`/api/auctions/${id}/pay`, { method: 'POST', cookie: cookie.other, json: { name: 'X', phone: '+998901234567' } })).body.error, 'NOT_WINNER');
  check('winner without name -> 422',
    (await j(`/api/auctions/${id}/pay`, { method: 'POST', cookie: cookie.user, json: { phone: '+998901234567' } })).status, 422);

  const pay = await j(`/api/auctions/${id}/pay`, { method: 'POST', cookie: cookie.user, json: { name: 'Aziz', phone: '+998901234567' } });
  check('winner payment creates a pending order (202)', [pay.status, pay.body.amount], [202, 400000]);
  checkTrue('winner payment returns a Payme checkout link', String(pay.body.payLink).startsWith('https://checkout.paycom.uz/'));

  const again = await j(`/api/auctions/${id}/pay`, { method: 'POST', cookie: cookie.user, json: { name: 'Aziz', phone: '+998901234567' } });
  check('repeat pay returns the SAME order (no double charge)', again.body.orderId, pay.body.orderId);

  const notAwaiting = await mkAuction();
  check('pay on an active auction -> 409 AUCTION_NOT_AWAITING_PAYMENT',
    (await j(`/api/auctions/${notAwaiting}/pay`, { method: 'POST', cookie: cookie.user, json: { name: 'A', phone: '+998901234567' } })).body.error,
    'AUCTION_NOT_AWAITING_PAYMENT');
}

// Ikkinchi/uchinchi makeEnv() uchun minimal seed. seedBasic() ishlatilmaydi:
// worker'ning ensureCoreSchema() promise'i JARAYON bo'yicha keshlanadi, ya'ni
// bu jarayondagi keyingi env'larda runtime jadvallari (admin_sessions...)
// yaratilmay qoladi. Bu testlarga admin kerak emas — faqat user sessiyasi.
async function seedUsersOnly(e) {
  await e.DB.prepare(`INSERT INTO users (id, email, password_hash, phone) VALUES (1, 'user@test.local', 'x', '+998901111111')`).run();
  await e.DB.prepare(`INSERT INTO users (id, email, password_hash, phone) VALUES (3, 'seller@test.local', 'x', '+998903333333')`).run();
  await e.DB.prepare(`INSERT INTO sessions (token, user_id, expires_at) VALUES ('user-token', 1, '2999-01-01T00:00:00.000Z')`).run();
}

// ═══ 12. To'lov o'chirilganda — yagona haqiqat manbai ═══
{
  const { env: offEnv } = makeEnv({ PAYMENTS_ENABLED: 'false' });
  await seedUsersOnly(offEnv);
  await offEnv.DB.prepare(
    `INSERT INTO auctions (id, code, seller_id, start_price, current_price, ends_at, status, min_increment, created_at)
     VALUES (900, 'AUC900', 3, 100000, 100000, ?, 'active', 25000, ?)`
  ).bind(iso(3600_000), new Date().toISOString()).run();

  const settings = await (await worker.fetch(req('/api/settings/payments-enabled'), offEnv)).json();
  check('payments-enabled reports disabled', [settings.enabled, settings.sandbox], [false, false]);

  const r = await worker.fetch(req('/api/auctions/900/bid', { method: 'POST', cookie: cookie.user, json: { amount: 100000 } }), offEnv);
  const b = await r.json();
  check('bid while payments disabled -> 503 payments_disabled', [r.status, b.error], [503, 'payments_disabled']);
}

// ═══ 13. Sandbox bayrog'i faqat oshkora sozlamadan ═══
{
  const { env: sbEnv } = makeEnv({ ...PAYME_ENV, PAYME_SANDBOX: 'true' });
  const s = await (await worker.fetch(req('/api/settings/payments-enabled'), sbEnv)).json();
  check('PAYME_SANDBOX=true -> sandbox true', [s.enabled, s.sandbox], [true, true]);
  checkTrue('settings response never leaks merchant id / key', !JSON.stringify(s).includes('test-merchant') && !JSON.stringify(s).includes('test-key'));

  const { env: domEnv } = makeEnv({ ...PAYME_ENV, PAYME_CHECKOUT_DOMAIN: 'checkout.test.paycom.uz' });
  const s2 = await (await worker.fetch(req('/api/settings/payments-enabled'), domEnv)).json();
  check('test checkout domain -> sandbox true', s2.sandbox, true);
}

done();
