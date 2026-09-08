// hosting/api/account.js testi — haqiqiy worker.fetch, in-memory D1 shim
// (scripts/lib/d1-harness.mjs). Production D1/R2 ga tegmaydi.
//
//   node scripts/test-account.mjs
import worker from '../hosting/worker.js';
import { makeEnv, seedBasic, req, cookie, makeChecker } from './lib/d1-harness.mjs';

const { check, checkTrue, done } = makeChecker();

// ---- Telegram stub: barcha api.telegram.org chaqiruvlari shu yerda ushlanadi
const tgSent = [];
globalThis.fetch = async (input, init = {}) => {
  const u = typeof input === 'string' ? input : input.url;
  if (u.includes('api.telegram.org')) {
    const body = JSON.parse(init.body || '{}');
    tgSent.push(body);
    return new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json' } });
  }
  throw new Error(`unexpected fetch: ${u}`);
};
const lastOtp = () => (tgSent.at(-1)?.text.match(/<b>(\d{6})<\/b>/) || [])[1];

const { env, sqlite } = makeEnv({ TELEGRAM_BOT_TOKEN: 'tok', ADMIN_CHAT_ID: '777' });
await seedBasic(env);
const call = async (path, init) => {
  const res = await worker.fetch(req(path, init), env);
  const body = await res.json().catch(() => null);
  return { res, status: res.status, body };
};

// =====================================================================
// Settings: parol (Telegram OTP)
// =====================================================================
{
  const r = await call('/api/settings/request-password-code', { method: 'POST' });
  check('request-password-code no cookie -> 401', [r.status, r.body], [401, { error: 'unauthorized' }]);
}
{
  // user#1 telefoni bor, lekin botga ulanmagan
  const r = await call('/api/settings/request-password-code', { method: 'POST', cookie: cookie.user });
  check('request-password-code tg not linked -> 422', [r.status, r.body], [422, { error: 'tg_not_linked' }]);
}
{
  await env.DB.prepare(`UPDATE users SET phone = NULL WHERE id = 2`).run();
  const r = await call('/api/settings/request-password-code', { method: 'POST', cookie: cookie.other });
  check('request-password-code no phone -> 422', [r.status, r.body], [422, { error: 'no_phone' }]);
  await env.DB.prepare(`UPDATE users SET phone = '+998902222222' WHERE id = 2`).run();
}
await env.DB.prepare(`INSERT INTO bot_verifications (phone, tg_user_id, tg_name) VALUES ('+998901111111', 5001, 'M')`).run();
{
  const r = await call('/api/settings/request-password-code', { method: 'POST', cookie: cookie.user });
  check('request-password-code -> 200 ok', [r.status, r.body], [200, { ok: true }]);
  check('OTP sent to linked tg user', [tgSent.at(-1)?.chat_id, /\d{6}/.test(lastOtp() || '')], [5001, true]);
}
{
  const r = await call('/api/settings/change-password', { method: 'POST', cookie: cookie.user, json: { code: '', newPassword: 'abcdefg' } });
  check('change-password missing code -> 422', [r.status, r.body], [422, { error: 'code_required' }]);
  const r2 = await call('/api/settings/change-password', { method: 'POST', cookie: cookie.user, json: { code: '123456', newPassword: '123' } });
  check('change-password weak -> 422', [r2.status, r2.body], [422, { error: 'weak_password' }]);
  const r3 = await call('/api/settings/change-password', { method: 'POST', cookie: cookie.user, json: { code: '000000', newPassword: 'abcdefg' } });
  check('change-password wrong code -> 422', [r3.status, r3.body], [422, { error: 'bad_code' }]);
  const r4 = await call('/api/settings/change-password', { method: 'POST', json: { code: '000000', newPassword: 'abcdefg' } });
  check('change-password no cookie -> 401', r4.status, 401);
}
{
  const code = lastOtp();
  const r = await call('/api/settings/change-password', { method: 'POST', cookie: cookie.user, json: { code, newPassword: 'newpass123' } });
  check('change-password ok -> 200', [r.status, r.body], [200, { ok: true }]);
  const row = sqlite.prepare(`SELECT password_hash FROM users WHERE id = 1`).get();
  checkTrue('password hash updated (salt:hash)', /^[0-9a-f]{32}:[0-9a-f]{128}$/.test(row.password_hash));
  const login = await call('/api/auth/login', { method: 'POST', json: { email: 'user@test.local', password: 'newpass123' } });
  check('new password logs in via /api/auth/login', login.status, 200);
  const again = await call('/api/settings/change-password', { method: 'POST', cookie: cookie.user, json: { code, newPassword: 'newpass456' } });
  check('same OTP cannot be reused -> 422', [again.status, again.body], [422, { error: 'bad_code' }]);
}
{
  // 3/10 daqiqa limit — 1 ta ishlatilgan; yana 2 ta ok, 4-si 429
  const a = await call('/api/settings/request-password-code', { method: 'POST', cookie: cookie.user });
  const b = await call('/api/settings/request-password-code', { method: 'POST', cookie: cookie.user });
  const c = await call('/api/settings/request-password-code', { method: 'POST', cookie: cookie.user });
  check('password code rate limit 3/10min -> 4th is 429', [a.status, b.status, c.status, c.body], [200, 200, 429, { error: 'too_many_requests' }]);
}

// =====================================================================
// Settings: telefon o'zgartirish (Telegram OTP)
// =====================================================================
{
  const r = await call('/api/settings/request-phone-change-code', { method: 'POST', json: { newPhone: '+998903333333' } });
  check('request-phone-change-code no cookie -> 401', r.status, 401);
  const r2 = await call('/api/settings/request-phone-change-code', { method: 'POST', cookie: cookie.user, json: { newPhone: 'abc' } });
  check('request-phone-change-code bad phone -> 422', [r2.status, r2.body], [422, { error: 'bad_phone' }]);
  const r3 = await call('/api/settings/request-phone-change-code', { method: 'POST', cookie: cookie.user, json: { newPhone: '+998903333333' } });
  check('request-phone-change-code not verified in bot -> 422', [r3.status, r3.body], [422, { error: 'phone_not_verified' }]);
}
await env.DB.prepare(`INSERT INTO bot_verifications (phone, tg_user_id, tg_name) VALUES ('+998903333333', 5003, 'N')`).run();
{
  const r = await call('/api/settings/request-phone-change-code', { method: 'POST', cookie: cookie.user, json: { newPhone: '+998 90 333-33-33' } });
  check('request-phone-change-code -> 200 (phone normalized)', [r.status, r.body, tgSent.at(-1)?.chat_id], [200, { ok: true }, 5003]);
  const row = sqlite.prepare(`SELECT phone, purpose, used FROM phone_otp_codes ORDER BY id DESC LIMIT 1`).get();
  check('phone_otp_codes row', row, { phone: '+998903333333', purpose: 'phone_change', used: 0 });
}
{
  const r = await call('/api/settings/confirm-phone-change', { method: 'POST', json: { newPhone: '+998903333333', code: '123456' } });
  check('confirm-phone-change no cookie -> 401', r.status, 401);
  const r2 = await call('/api/settings/confirm-phone-change', { method: 'POST', cookie: cookie.user, json: { newPhone: '+998903333333', code: '' } });
  check('confirm-phone-change code required -> 422', [r2.status, r2.body], [422, { error: 'code_required' }]);
  const r3 = await call('/api/settings/confirm-phone-change', { method: 'POST', cookie: cookie.user, json: { newPhone: 'x', code: '123456' } });
  check('confirm-phone-change bad phone -> 422', [r3.status, r3.body], [422, { error: 'bad_phone' }]);
  const r4 = await call('/api/settings/confirm-phone-change', { method: 'POST', cookie: cookie.user, json: { newPhone: '+998903333333', code: '000000' } });
  check('confirm-phone-change wrong code -> 422', [r4.status, r4.body], [422, { error: 'bad_code' }]);
  const r5 = await call('/api/settings/confirm-phone-change', { method: 'POST', cookie: cookie.user, json: { newPhone: '+998903333333', code: lastOtp() } });
  check('confirm-phone-change ok -> 200 {ok, phone}', [r5.status, r5.body], [200, { ok: true, phone: '+998903333333' }]);
  check('users.phone updated', sqlite.prepare(`SELECT phone FROM users WHERE id = 1`).get().phone, '+998903333333');
}
{
  const s = [];
  for (let i = 0; i < 3; i++) s.push((await call('/api/settings/request-phone-change-code', { method: 'POST', cookie: cookie.user, json: { newPhone: '+998903333333' } })).status);
  check('phone code rate limit 3/10min per phone (1 used) -> 200,200,429', s, [200, 200, 429]);
}

// =====================================================================
// Support
// =====================================================================
{
  const r = await call('/api/support', { method: 'POST', json: { message: 'hi' } });
  check('POST /api/support no cookie -> 401', r.status, 401);
  const r2 = await call('/api/support', { method: 'POST', cookie: cookie.user, json: { message: '   ' } });
  check('POST /api/support empty -> 422', [r2.status, r2.body], [422, { error: 'message_required' }]);
  const before = tgSent.length;
  const r3 = await call('/api/support', { method: 'POST', cookie: cookie.user, json: { message: 'Salom admin' } });
  check('POST /api/support -> 201 {id, createdAt}', [r3.status, typeof r3.body?.id, typeof r3.body?.createdAt], [201, 'number', 'string']);
  check('admin notified in Telegram (ADMIN_CHAT_ID)', [tgSent.length - before, tgSent.at(-1)?.chat_id, tgSent.at(-1)?.text.includes('Salom admin')], [1, '777', true]);
  const anon = await call('/api/support');
  check('GET /api/support anon -> {messages: []}', [anon.status, anon.body], [200, { messages: [] }]);
  const list = await call('/api/support', { cookie: cookie.user });
  check('GET /api/support -> messages list shape', [list.status, list.body.messages.length, Object.keys(list.body.messages[0]).sort()],
    [200, 1, ['createdAt', 'id', 'message', 'repliedAt', 'reply', 'status']]);
  check('GET /api/support other user sees nothing', (await call('/api/support', { cookie: cookie.other })).body, { messages: [] });
  const st = [];
  for (let i = 0; i < 5; i++) st.push((await call('/api/support', { method: 'POST', cookie: cookie.user, json: { message: `m${i}` } })).status);
  check('POST /api/support rate limit 5/min -> 201x4 then 429', st, [201, 201, 201, 201, 429]);
}

// =====================================================================
// Premium request + payments
// =====================================================================
{
  const r = await call('/api/premium/request', { method: 'POST' });
  check('POST /api/premium/request no cookie -> 401', r.status, 401);
  const r2 = await call('/api/premium/request', { method: 'POST', cookie: cookie.user });
  check('POST /api/premium/request payments disabled -> 503', [r2.status, r2.body], [503, { error: 'payments_disabled' }]);
}
const payEnv = { ...env, PAYMENTS_ENABLED: 'true', PAYME_MERCHANT_ID: 'm1', PAYME_KEY: 'k' };
const callPay = async (path, init) => { const res = await worker.fetch(req(path, init), payEnv); return { res, status: res.status, body: await res.json().catch(() => null) }; };
let premiumOrderId;
{
  const r = await callPay('/api/premium/request', { method: 'POST', cookie: cookie.user });
  check('POST /api/premium/request -> 201 {orderId, amount, payLink}', [r.status, typeof r.body?.orderId, r.body?.amount, r.body?.payLink?.startsWith('https://checkout.paycom.uz/')], [201, 'number', 20000, true]);
  premiumOrderId = r.body.orderId;
  const row = sqlite.prepare(`SELECT user_id, code, kind, price, status FROM web_orders WHERE id = ?`).get(premiumOrderId);
  check('web_orders premium row', row, { user_id: 1, code: 'PREMIUM', kind: 'premium_upgrade', price: 20000, status: 'pending' });
  // 2026-09: takroriy so'rov XATO EMAS — o'sha buyurtmaning havolasi
  // qaytariladi (batafsil: pastdagi "PREMIUM (20 000)" bo'limi).
  const dup = await callPay('/api/premium/request', { method: 'POST', cookie: cookie.user });
  check('takroriy premium so\'rovi -> o\'sha buyurtma', [dup.status, dup.body.orderId, dup.body.reused], [200, premiumOrderId, true]);
  const other = await callPay('/api/premium/request', { method: 'POST', cookie: cookie.other });
  check('other user can still request premium (per-user pending check) -> 201', other.status, 201);
  sqlite.prepare(`UPDATE web_orders SET status = 'cancelled' WHERE id = ?`).run(other.body.orderId);
  sqlite.prepare(`UPDATE users SET is_premium = 1 WHERE id = 2`).run();
  const prem = await callPay('/api/premium/request', { method: 'POST', cookie: cookie.other });
  check('already premium -> 409 ALREADY_PREMIUM', [prem.status, prem.body], [409, { error: 'ALREADY_PREMIUM' }]);
  sqlite.prepare(`UPDATE users SET is_premium = 0 WHERE id = 2`).run();
}
{
  const r = await call('/api/payments');
  check('GET /api/payments no cookie -> 401', r.status, 401);
  const r2 = await call('/api/payments', { cookie: cookie.user });
  check('GET /api/payments -> {payments, pendingPayout}', [r2.status, r2.body.payments.length, r2.body.pendingPayout, Object.keys(r2.body.payments[0]).sort()],
    [200, 1, 0, ['code', 'createdAt', 'id', 'kind', 'price', 'status']]);
  sqlite.prepare(`UPDATE users SET pending_payout = 15000 WHERE id = 1`).run();
  check('pendingPayout reflected', (await call('/api/payments', { cookie: cookie.user })).body.pendingPayout, 15000);
  const one = await call(`/api/payments/${premiumOrderId}`, { cookie: cookie.user });
  check('GET /api/payments/:id -> {id, kind, status, price}', [one.status, one.body], [200, { id: premiumOrderId, kind: 'premium_upgrade', status: 'pending', price: 20000 }]);
  const notMine = await call(`/api/payments/${premiumOrderId}`, { cookie: cookie.other });
  check('GET /api/payments/:id other user -> 404', [notMine.status, notMine.body], [404, { error: 'not_found' }]);
  check('GET /api/payments/:id no cookie -> 401', (await call(`/api/payments/${premiumOrderId}`)).status, 401);
  check('GET /api/payments/999 -> 404', (await call('/api/payments/999', { cookie: cookie.user })).status, 404);
}

// =====================================================================
// set-primary
// =====================================================================
{
  check('set-primary no cookie -> 401', (await call('/api/records/VIP001/set-primary', { method: 'POST' })).status, 401);
  const r = await call('/api/records/VIP001/set-primary', { method: 'POST', cookie: cookie.other });
  check('set-primary not owner -> 403', [r.status, r.body], [403, { error: 'forbidden' }]);
  check('set-primary unknown code -> 403', (await call('/api/records/NOP000/set-primary', { method: 'POST', cookie: cookie.user })).status, 403);
  const ok = await call('/api/records/BIZ777/set-primary', { method: 'POST', cookie: cookie.user });
  check('set-primary -> 200 {ok}', [ok.status, ok.body], [200, { ok: true }]);
  const rows = sqlite.prepare(`SELECT code, is_primary FROM cards WHERE user_id = 1 ORDER BY code`).all();
  check('only BIZ777 primary', rows, [{ code: 'BIZ777', is_primary: 1 }, { code: 'VIP001', is_primary: 0 }]);
  await call('/api/records/VIP001/set-primary', { method: 'POST', cookie: cookie.user });
  check('switch primary to VIP001', sqlite.prepare(`SELECT code FROM cards WHERE user_id = 1 AND is_primary = 1`).all(), [{ code: 'VIP001' }]);
}

// =====================================================================
// gift (gift_offers yaratish)
// =====================================================================
{
  check('gift no cookie -> 401', (await call('/api/records/VIP001/gift', { method: 'POST', json: { toCode: 'OTH222' } })).status, 401);
  const v = await call('/api/records/VIP001/gift', { method: 'POST', cookie: cookie.user, json: {} });
  check('gift toCode required -> 422', [v.status, v.body], [422, { error: 'to_code_required' }]);
  const f = await call('/api/records/VIP001/gift', { method: 'POST', cookie: cookie.other, json: { toCode: 'BIZ777' } });
  check('gift not owner -> 403 NOT_OWNER', [f.status, f.body], [403, { error: 'NOT_OWNER' }]);
  const self = await call('/api/records/VIP001/gift', { method: 'POST', cookie: cookie.user, json: { toCode: 'BIZ777' } });
  check('gift to self -> 409 CANNOT_GIFT_SELF', [self.status, self.body], [409, { error: 'CANNOT_GIFT_SELF' }]);
  const nf = await call('/api/records/VIP001/gift', { method: 'POST', cookie: cookie.user, json: { toCode: 'ZZZ999' } });
  check('gift recipient not found -> 409', [nf.status, nf.body], [409, { error: 'RECIPIENT_NOT_FOUND' }]);
  sqlite.prepare(`UPDATE cards SET giftable = 0 WHERE code = 'BIZ777'`).run();
  const ng = await call('/api/records/BIZ777/gift', { method: 'POST', cookie: cookie.user, json: { toCode: 'oth222' } });
  check('gift not giftable -> 409', [ng.status, ng.body], [409, { error: 'NOT_GIFTABLE' }]);
  const ok = await call('/api/records/VIP001/gift', { method: 'POST', cookie: cookie.user, json: { toCode: 'oth222' } });
  check('gift -> 201 {ok, id}', [ok.status, ok.body.ok, typeof ok.body.id], [201, true, 'number']);
  check('gift_offers row', sqlite.prepare(`SELECT code, from_user_id, to_user_id, status FROM gift_offers WHERE id = ?`).get(ok.body.id),
    { code: 'VIP001', from_user_id: 1, to_user_id: 2, status: 'pending' });
  const dup = await call('/api/records/VIP001/gift', { method: 'POST', cookie: cookie.user, json: { toCode: 'OTH222' } });
  check('duplicate pending gift -> 409 ALREADY_PENDING', [dup.status, dup.body], [409, { error: 'ALREADY_PENDING' }]);
  const incoming = await call('/api/gift-offers', { cookie: cookie.other });
  check('recipient sees it in core GET /api/gift-offers incoming', incoming.body.incoming.map((g) => g.code), ['VIP001']);
  const cancel = await call(`/api/gift-offers/${ok.body.id}/cancel`, { method: 'POST', cookie: cookie.user });
  check('core cancel still works', cancel.status, 200);
}

// =====================================================================
// order-physical-card
// =====================================================================
{
  const shipping = { shippingName: 'Ali', shippingPhone: '+998901234567', shippingAddress: 'Toshkent, Chilonzor 1' };
  const d = await call('/api/records/VIP001/order-physical-card', { method: 'POST', cookie: cookie.user, json: shipping });
  check('order-physical-card payments disabled -> 503', [d.status, d.body], [503, { error: 'payments_disabled' }]);
  check('order-physical-card no cookie -> 401', (await callPay('/api/records/VIP001/order-physical-card', { method: 'POST', json: shipping })).status, 401);
  const f = await callPay('/api/records/VIP001/order-physical-card', { method: 'POST', cookie: cookie.other, json: shipping });
  check('order-physical-card not owner -> 403', [f.status, f.body], [403, { error: 'forbidden' }]);
  const v = await callPay('/api/records/VIP001/order-physical-card', { method: 'POST', cookie: cookie.user, json: { shippingName: 'Ali' } });
  check('order-physical-card missing shipping -> 422', [v.status, v.body], [422, { error: 'shipping_required' }]);
  const ok = await callPay('/api/records/VIP001/order-physical-card', { method: 'POST', cookie: cookie.user, json: shipping });
  check('order-physical-card -> 202 {orderId, amount, payLink}', [ok.status, typeof ok.body.orderId, ok.body.amount, ok.body.payLink.startsWith('https://checkout.paycom.uz/')], [202, 'number', 200000, true]);
  const row = sqlite.prepare(`SELECT user_id, code, kind, price, status, payload FROM web_orders WHERE id = ?`).get(ok.body.orderId);
  // 2026-09: payload'ga bosma maket maydonlari qo'shildi. Bu chaqiruvda
  // maket yuborilmagan, shuning uchun ular BO'SH bo'lishi kerak —
  // to'ldirilgan holat scripts/test-card-print-order.mjs da tekshiriladi.
  check('web_orders physical row', { ...row, payload: JSON.parse(row.payload) }, {
    user_id: 1, code: 'VIP001', kind: 'physical_card_order', price: 200000, status: 'pending',
    payload: { ...shipping, shippingCarrier: '', quantity: 1, designFrontUrl: '', designBackUrl: '', printSpec: '' },
  });
  // free-tier kod uchun feature_locked (physicalCardDesigner min silver)
  sqlite.prepare(`INSERT INTO cards (code, name, price, ts, user_id) VALUES ('12345678', 'Free', 0, 2000, 1)`).run();
  const locked = await callPay('/api/records/12345678/order-physical-card', { method: 'POST', cookie: cookie.user, json: shipping });
  check('order-physical-card free-tier id -> 403 feature_locked', [locked.status, locked.body], [403, { error: 'feature_locked', feature: 'physicalCardDesigner' }]);
}

// =====================================================================
// DELETE /api/records/:code
// =====================================================================
{
  check('DELETE no cookie -> 401', (await call('/api/records/VIP001', { method: 'DELETE' })).status, 401);
  const f = await call('/api/records/VIP001', { method: 'DELETE', cookie: cookie.other });
  check('DELETE not owner -> 403', [f.status, f.body], [403, { error: 'forbidden' }]);
  check('DELETE bad code -> 400', (await call('/api/records/AB', { method: 'DELETE', cookie: cookie.user })).status, 400);
  check('DELETE unknown -> 404', (await call('/api/records/NOP000', { method: 'DELETE', cookie: cookie.user })).status, 404);
  const last = await call('/api/records/OTH222', { method: 'DELETE', cookie: cookie.other });
  check('DELETE last card -> 409 last_card', [last.status, last.body], [409, { error: 'last_card' }]);

  // bog'liq qatorlar: post + like, menu, gallery, pending gift offer, physical card link
  sqlite.prepare(`INSERT INTO posts (id, code, user_id, caption) VALUES (50, 'VIP001', 1, 'p')`).run();
  sqlite.prepare(`INSERT INTO post_likes (post_id, user_id) VALUES (50, 2)`).run();
  sqlite.prepare(`INSERT INTO card_likes (code, user_id) VALUES ('VIP001', 2)`).run();
  sqlite.prepare(`INSERT INTO menu_categories (id, code, name) VALUES (7, 'VIP001', 'c')`).run();
  sqlite.prepare(`INSERT INTO menu_items (code, category_id, name) VALUES ('VIP001', 7, 'i')`).run();
  sqlite.prepare(`INSERT INTO card_gallery (code, image_url) VALUES ('VIP001', '/uploads/a.jpg')`).run();
  sqlite.prepare(`INSERT INTO gift_offers (code, from_user_id, to_user_id, status) VALUES ('VIP001', 1, 2, 'pending')`).run();
  sqlite.prepare(`INSERT INTO physical_cards (chip_token, linked_code, owner_user_id) VALUES ('chip1', 'VIP001', 1)`).run();
  const ok = await call('/api/records/VIP001', { method: 'DELETE', cookie: cookie.user });
  check('DELETE own (primary) card -> 200 {ok, freeId:false}', [ok.status, ok.body], [200, { ok: true, freeId: false }]);
  check('card gone', sqlite.prepare(`SELECT COUNT(*) AS n FROM cards WHERE code = 'VIP001'`).get().n, 0);
  const counts = ['posts', 'post_likes', 'card_likes', 'menu_categories', 'menu_items', 'card_gallery']
    .map((t) => sqlite.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n);
  check('dependent rows removed', counts, [0, 0, 0, 0, 0, 0]);
  check('pending gift offer cancelled', sqlite.prepare(`SELECT status FROM gift_offers WHERE code = 'VIP001' ORDER BY id DESC LIMIT 1`).get().status, 'cancelled');
  check('physical card unlinked', sqlite.prepare(`SELECT linked_code FROM physical_cards WHERE chip_token = 'chip1'`).get().linked_code, null);
  check('primary moved to oldest remaining card', sqlite.prepare(`SELECT code FROM cards WHERE user_id = 1 AND is_primary = 1`).all(), [{ code: 'BIZ777' }]);
  const free = await call('/api/records/12345678', { method: 'DELETE', cookie: cookie.user });
  check('DELETE 8-digit free id -> freeId:true', [free.status, free.body], [200, { ok: true, freeId: true }]);
}

// =====================================================================
// GET /api/gifts/public
// =====================================================================
{
  const empty = await call('/api/gifts/public');
  check('gifts/public empty -> {gifts:[], hasMore:false}', [empty.status, empty.body], [200, { gifts: [], hasMore: false }]);
  sqlite.prepare(`INSERT INTO admin_settings (key, value) VALUES ('public_gifts_cutoff', '2020-01-01')`).run();
  sqlite.prepare(`INSERT INTO cards (code, name, price, ts, user_id, is_primary) VALUES ('PUB100', 'Public Guy', 0, 500, 2, 1)`).run();
  for (let i = 0; i < 14; i++) {
    sqlite.prepare(`INSERT INTO gift_offers (code, from_user_id, to_user_id, status, decided_at) VALUES (?, 1, 2, 'accepted', ?)`)
      .run(`GFT${String(i).padStart(3, '0')}`, `2026-03-${String(i + 1).padStart(2, '0')} 10:00:00+00`);
  }
  sqlite.prepare(`INSERT INTO gift_offers (code, from_user_id, to_user_id, status, decided_at) VALUES ('OLD000', 1, 2, 'accepted', '2019-01-01 10:00:00+00')`).run();
  sqlite.prepare(`INSERT INTO gift_offers (code, from_user_id, to_user_id, status) VALUES ('PEN000', 1, 2, 'pending')`).run();
  const p1 = await call('/api/gifts/public?page=1');
  check('gifts/public page1 -> 12 items, hasMore', [p1.body.gifts.length, p1.body.hasMore, p1.body.gifts[0]], [12, true, { code: 'GFT013', recipientName: 'Public Guy', recipientCode: 'PUB100', date: '2026-03-14 10:00:00+00' }]);
  const p2 = await call('/api/gifts/public?page=2');
  check('gifts/public page2 -> 2 items, no more (cutoff + pending excluded)', [p2.body.gifts.length, p2.body.hasMore, p2.body.gifts.map((g) => g.code)], [2, false, ['GFT001', 'GFT000']]);
  checkTrue('sender never exposed', !JSON.stringify(p1.body).includes('from'));
  sqlite.prepare(`UPDATE cards SET hidden_from_directory = 1 WHERE code = 'PUB100'`).run();
  const hidden = await call('/api/gifts/public?limit=1');
  check('hidden recipient -> name/code null', hidden.body.gifts[0], { code: 'GFT013', recipientName: null, recipientCode: null, date: '2026-03-14 10:00:00+00' });
}

// =====================================================================
// NFC gift activation flow
// =====================================================================
{
  sqlite.prepare(`INSERT INTO nfc_gifts (code, recipient_name, activation_code, status) VALUES ('GIF001', 'Dilnoza', 'ABCD-1234', 'reserved')`).run();
  sqlite.prepare(`INSERT INTO nfc_gifts (code, recipient_name, activation_code, status) VALUES ('GIF002', 'Done', 'ZZZZ-0000', 'activated')`).run();
  const g = await call('/api/nfc-gifts/gif001');
  check('GET /api/nfc-gifts/:code -> pending gift (no activation code)', [g.status, g.body], [200, { gift: { code: 'GIF001', recipientName: 'Dilnoza' } }]);
  check('GET activated gift -> null', (await call('/api/nfc-gifts/GIF002')).body, { gift: null });
  check('GET unknown -> null', (await call('/api/nfc-gifts/NOP000')).body, { gift: null });

  const v0 = await call('/api/nfc-gifts/GIF001/verify', { method: 'POST', json: { activationCode: '  ' } });
  check('verify empty -> 422', [v0.status, v0.body], [422, { error: 'code_required' }]);
  const v1 = await call('/api/nfc-gifts/GIF001/verify', { method: 'POST', json: { activationCode: 'WRONG' } });
  check('verify wrong -> 401 bad_code', [v1.status, v1.body], [401, { error: 'bad_code' }]);
  const v2 = await call('/api/nfc-gifts/GIF001/verify', { method: 'POST', json: { activationCode: ' abcd-1234 ' } });
  check('verify ok (case/space-insensitive) -> {ok}', [v2.status, v2.body], [200, { ok: true }]);
  check('verify does not consume', sqlite.prepare(`SELECT status FROM nfc_gifts WHERE code = 'GIF001'`).get().status, 'reserved');

  const base = { activationCode: 'ABCD-1234', email: 'Dilnoza@Test.local', password: 'secret12', name: 'Dilnoza', username: 'dili', phone: '+998905555555', bio: 'Hi', instagram: '@dili', telegram: '@dili_tg', youtube: 'https://youtube.com/@dili', tiktok: 'javascript:alert(1)', avatarUrl: '/uploads/av.png' };
  check('activate missing code -> 422', (await call('/api/nfc-gifts/GIF001/activate', { method: 'POST', json: { ...base, activationCode: '' } })).body, { error: 'code_required' });
  check('activate bad email -> 422', (await call('/api/nfc-gifts/GIF001/activate', { method: 'POST', json: { ...base, email: 'nope' } })).body, { error: 'bad_email' });
  check('activate weak password -> 422', (await call('/api/nfc-gifts/GIF001/activate', { method: 'POST', json: { ...base, password: '123' } })).body, { error: 'weak_password' });
  check('activate no name -> 422', (await call('/api/nfc-gifts/GIF001/activate', { method: 'POST', json: { ...base, name: '' } })).body, { error: 'name_required' });
  const bad = await call('/api/nfc-gifts/GIF001/activate', { method: 'POST', json: { ...base, activationCode: 'NOPE' } });
  check('activate wrong code -> 401, nothing created', [bad.status, bad.body, sqlite.prepare(`SELECT COUNT(*) AS n FROM users WHERE email = 'dilnoza@test.local'`).get().n], [401, { error: 'bad_code' }, 0]);
  const taken = await call('/api/nfc-gifts/GIF001/activate', { method: 'POST', json: { ...base, email: 'user@test.local', password: 'wrongpass' } });
  check('activate with existing email + wrong password -> 409 email_taken', [taken.status, taken.body], [409, { error: 'email_taken' }]);

  const ok = await call('/api/nfc-gifts/GIF001/activate', { method: 'POST', json: base });
  const setCookie = ok.res.headers.get('set-cookie') || '';
  check('activate -> 201 {ok, code} + session cookie', [ok.status, ok.body, setCookie.startsWith('nfc_session='), setCookie.includes('HttpOnly')], [201, { ok: true, code: 'GIF001' }, true, true]);
  const newUser = sqlite.prepare(`SELECT id, email, promo_code FROM users WHERE email = 'dilnoza@test.local'`).get();
  check('user created (lowercased email, promo code assigned)', [!!newUser, /^[A-Z2-9]{6}$/.test(newUser?.promo_code || '')], [true, true]);
  const card = sqlite.prepare(`SELECT name, user_id, is_primary, tier_override, avatar_url, tg, instagram, about, phone, extra_links, price FROM cards WHERE code = 'GIF001'`).get();
  check('card created + owned + primary + exclusive', { ...card, extra_links: JSON.parse(card.extra_links) },
    { name: 'Dilnoza (@dili)', user_id: newUser.id, is_primary: 1, tier_override: 'exclusive', avatar_url: '/uploads/av.png', tg: 'dili_tg', instagram: 'dili', about: 'Hi', phone: '+998905555555', extra_links: [{ label: 'YouTube', url: 'https://youtube.com/@dili' }], price: 0 });
  check('nfc_gift activated', sqlite.prepare(`SELECT status, activated_by_user_id FROM nfc_gifts WHERE code = 'GIF001'`).get(), { status: 'activated', activated_by_user_id: newUser.id });
  const token = setCookie.split(';')[0].split('=')[1];
  const me = await call('/api/auth/me', { cookie: `nfc_session=${token}` });
  check('session cookie logs the new user in', [me.status, me.body?.email || me.body?.user?.email], [200, 'dilnoza@test.local']);
  check('admin activity logged', sqlite.prepare(`SELECT action, details FROM admin_activity_log ORDER BY id DESC LIMIT 1`).get(), { action: 'nfc_gift_activated', details: 'GIF001 — dilnoza@test.local' });
  const again = await call('/api/nfc-gifts/GIF001/activate', { method: 'POST', json: base });
  check('activate twice -> 401 bad_code (already activated)', [again.status, again.body], [401, { error: 'bad_code' }]);
  // Record's public GET works and shows it as gift/exclusive
  const rec = await call('/api/records/GIF001');
  check('GET /api/records/GIF001 -> isGift + exclusive', [rec.status, rec.body.isGift, rec.body.tierOverride], [200, true, 'exclusive']);
}

// Unknown route still falls through to 404
check('unrelated path -> module returns null (404)', (await call('/api/account-nope')).status, 404);

// Worker moduli src/lib/pricing.js dan import qila olmaydi — konstanta sinxronligini tekshiramiz.
{
  const { PROFILE_PREMIUM_FEE } = await import('../src/lib/pricing.js');
  const { readFileSync } = await import('node:fs');
  const m = readFileSync(new URL('../hosting/api/account.js', import.meta.url), 'utf8').match(/const PROFILE_PREMIUM_FEE = (\d+);/);
  check('PROFILE_PREMIUM_FEE sync (account.js == pricing.js)', Number(m?.[1]), PROFILE_PREMIUM_FEE);
}

// ═══ PREMIUM (20 000) — KUTAYOTGAN BUYURTMA XATO EMAS ═══
// Odam bir marta "To'lash" ni bossa (yoki brauzer to'lov oynasini
// bloklasa, yoki u oynani yopib yuborsa) buyurtma "pending" bo'lib
// qolardi va undan KEYINGI HAR BIR urinish 409 ALREADY_PENDING
// berardi — ya'ni odam premiumni umuman sotib ololmasdi.
{
  env.PAYMENTS_ENABLED = 'true';
  env.PAYME_MERCHANT_ID = '6a9a5ff90a7dc281fc7e03e2';
  env.PAYME_KEY = 'test_key_local_only';
  const prem = () => call('/api/premium/request', { method: 'POST', cookie: cookie.user });
  // Yuqoridagi bo'lim allaqachon kutayotgan buyurtma qoldirgan — toza
  // holatdan boshlaymiz.
  await env.DB.prepare(`UPDATE web_orders SET status = 'cancelled' WHERE kind = 'premium_upgrade' AND status = 'pending'`).run();

  const first = await prem();
  check('premium: birinchi urinish -> 201', [first.status, first.body.amount], [201, 20000]);
  checkTrue('premium: to\'lov havolasi bor', /^https:\/\/checkout\.paycom\.uz\//.test(first.body.payLink || ''));

  const again = await prem();
  check('premium: ikkinchi urinish ham ISHLAYDI (xato emas)', again.status, 200);
  check('premium: o\'sha buyurtma qaytariladi, yangisi emas',
    [again.body.orderId, again.body.reused], [first.body.orderId, true]);
  check('premium: havola ham o\'sha', again.body.payLink, first.body.payLink);
  check('premium: bitta buyurtma qoladi (ikki marta pul yechilmaydi)',
    sqlite.prepare(`SELECT COUNT(*) AS n FROM web_orders WHERE kind = 'premium_upgrade' AND status = 'pending'`).get().n, 1);

  // Allaqachon premium bo'lsa — buyurtma umuman yaratilmaydi.
  await env.DB.prepare(`UPDATE users SET is_premium = 1 WHERE id = 1`).run();
  const done2 = await prem();
  check('premium: allaqachon premium -> 409', [done2.status, done2.body.error], [409, 'ALREADY_PREMIUM']);
  await env.DB.prepare(`UPDATE users SET is_premium = 0 WHERE id = 1`).run();
}

done();
