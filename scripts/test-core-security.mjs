// P0 xavfsizlik tuzatishlari testi — haqiqiy worker.fetch, in-memory D1.
import worker from '../hosting/worker.js';
import { makeEnv, seedBasic, req, cookie, makeChecker, sha256Hex } from './lib/d1-harness.mjs';
const { check, checkTrue, done } = makeChecker();
const { env } = makeEnv();
await seedBasic(env);
const f = (p, init) => worker.fetch(req(p, init), env);

// 1) noma'lum /api → JSON 404 (o'ziga-proxy yo'q)
let r = await f('/api/does-not-exist');
check('unknown /api → 404 json', [r.status, (await r.json()).error], [404, 'not_found']);
// 2) xavfsizlik header'lari
r = await f('/api/records');
check('security headers', [r.headers.get('x-content-type-options'), r.headers.get('x-frame-options'), r.headers.get('strict-transport-security')?.startsWith('max-age')], ['nosniff', 'DENY', true]);
checkTrue('CSP frame-ancestors', (r.headers.get('content-security-policy') || '').includes("frame-ancestors 'none'"));
// 3) sessiya: xom token qabul qilinadi va hash'ga ko'chiriladi
r = await f('/api/auth/me', { cookie: cookie.user });
check('legacy raw session accepted', r.status, 200);
const row = env.DB.prepare(`SELECT token FROM sessions WHERE user_id = 1`).first();
check('raw token upgraded to sha256', (await row).token, sha256Hex('user-token'));
r = await f('/api/auth/me', { cookie: cookie.user });
check('hashed session still works', r.status, 200);
// 4) login rate limit (email bo'yicha 5/15min)
for (let i = 0; i < 5; i++) r = await f('/api/auth/login', { method: 'POST', json: { email: 'user@test.local', password: 'wrongpass' } });
check('5th bad login → 401', r.status, 401);
r = await f('/api/auth/login', { method: 'POST', json: { email: 'user@test.local', password: 'wrongpass' } });
check('6th login → 429', r.status, 429);
// 5) views dedup — bitta tashrifchi 6 soatda 1 marta
r = await f('/api/records/VIP001/view', { method: 'POST' }); const v1 = (await r.json()).views;
r = await f('/api/records/VIP001/view', { method: 'POST' }); const v2 = (await r.json()).views;
check('views not double counted for same visitor', v2, v1);
r = await f('/api/records/VIP001/view', { method: 'POST', ip: '198.51.100.7' }); const v3 = (await r.json()).views;
check('different visitor counts', v3, v1 + 1);
// 6) admin rollari
r = await f('/api/admin/users/2/adjust-balance', { method: 'POST', cookie: cookie.manager, json: { amount: 1000, note: 'x' } });
check('manager cannot adjust balance', r.status, 403);
r = await f('/api/admin/users/2/adjust-balance', { method: 'POST', cookie: cookie.admin, json: { amount: 1000, note: 'x' } });
check('super_admin can adjust balance', r.status, 200);
r = await f('/api/admin/users/2/set-test', { method: 'POST', cookie: cookie.manager, json: { isTest: true } });
check('manager cannot set-test', r.status, 403);
r = await f('/api/admin/users/2/suspend', { method: 'POST', cookie: cookie.manager, json: { days: 1, reason: 'spam' } });
check('manager can suspend', r.status, 200);
// 7) TOTP o'chirish parolsiz → 403
r = await f('/api/admin/2fa/totp/disable', { method: 'POST', cookie: cookie.admin, json: {} });
check('totp disable requires password', r.status, 403);
// 8) /admin/me totpEnabled maydoni
r = await f('/api/admin/me', { cookie: cookie.admin });
check('admin me has totpEnabled', (await r.json()).totpEnabled, false);
// 9) noma'lum admin route → 404 (501 emas)
r = await f('/api/admin/nope', { cookie: cookie.admin });
check('unknown admin route → 404', r.status, 404);
// 10) profile_view hodisasi analytics uchun yoziladi
{
  const ev = await env.DB.prepare(`SELECT COUNT(*) AS n FROM card_events WHERE code = 'VIP001' AND event_type = 'profile_view'`).first();
  check('profile_view events logged (2 distinct visitors)', Number(ev.n), 2);
}
// 11) Payme finalize: premium_upgrade → users.is_premium; physical_card_order → physical_cards
{
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  await env.DB.prepare(`INSERT INTO web_orders (id, user_id, code, kind, price, payload, status, created_at) VALUES (901, 1, 'PREMIUM', 'premium_upgrade', 100000, '{}', 'pending', ?)`).bind(now).run();
  await env.DB.prepare(`INSERT INTO web_orders (id, user_id, code, kind, price, payload, status, created_at) VALUES (902, 1, 'VIP001', 'physical_card_order', 200000, ?, 'pending', ?)`)
    .bind(JSON.stringify({ shippingName: 'Test', shippingPhone: '+998901111111', shippingAddress: 'Toshkent' }), now).run();
  r = await f('/api/admin/orders/901/confirm-payment', { method: 'POST', cookie: cookie.admin, json: {} });
  check('premium order finalize ok', [r.status, (await r.json()).ok], [200, true]);
  const u = await env.DB.prepare(`SELECT is_premium FROM users WHERE id = 1`).first();
  check('user became premium', Number(u.is_premium), 1);
  r = await f('/api/admin/orders/902/confirm-payment', { method: 'POST', cookie: cookie.admin, json: {} });
  check('physical order finalize ok', [r.status, (await r.json()).ok], [200, true]);
  const pc = await env.DB.prepare(`SELECT linked_code, owner_user_id, shipping_name, length(chip_token) AS tl FROM physical_cards WHERE linked_code = 'VIP001'`).first();
  check('physical card row created', [pc?.linked_code, Number(pc?.owner_user_id), pc?.shipping_name, pc?.tl > 6], ['VIP001', 1, 'Test', true]);
  const o = await env.DB.prepare(`SELECT status FROM web_orders WHERE id IN (901, 902)`).all();
  check('orders marked paid', o.results.map((x) => x.status), ['paid', 'paid']);
}
done();
