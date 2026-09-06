// hosting/api/auth.js testi — haqiqiy worker.fetch, in-memory D1 (scripts/lib/d1-harness.mjs).
// Telegram yuborishlari globalThis.fetch stub bilan ushlanadi (tarmoqqa chiqilmaydi).
//   node scripts/test-auth.mjs
import worker, { ensureCoreSchema } from '../hosting/worker.js';
import { makeEnv, seedBasic, req, cookie, makeChecker } from './lib/d1-harness.mjs';

const { check, checkTrue, done } = makeChecker();
const { env, sqlite } = makeEnv({ TELEGRAM_BOT_TOKEN: 'test-token' });
await ensureCoreSchema(env);
await seedBasic(env);

// Telegram sendMessage stub — yuborilgan xabarlar shu yerda to'planadi.
const tgSends = [];
globalThis.fetch = async (input, init) => {
  const u = String(input);
  if (u.startsWith('https://api.telegram.org/')) {
    tgSends.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ ok: true, result: {} }), { headers: { 'content-type': 'application/json' } });
  }
  throw new Error('unexpected fetch ' + u);
};
const lastCode = () => (tgSends[tgSends.length - 1]?.text.match(/<b>(\d{6})<\/b>/) || [])[1];
const post = (path, json, init = {}) => worker.fetch(req(path, { method: 'POST', json, ...init }), env);

// ===== request-register-code =====
{
  let res = await post('/api/auth/request-register-code', { phone: 'abc' });
  check('request-code: bad phone -> 422', [res.status, (await res.json()).error], [422, 'bad_phone']);

  res = await post('/api/auth/request-register-code', { phone: '+998 90 123-45-67' });
  check('request-code: not verified in bot -> 422', [res.status, (await res.json()).error], [422, 'phone_not_verified']);
  check('request-code: no telegram send when unverified', tgSends.length, 0);

  await env.DB.prepare(`INSERT INTO bot_verifications (phone, tg_user_id, tg_name) VALUES ('+998901234567', 777001, 'Ali')`).run();
  res = await post('/api/auth/request-register-code', { phone: '+998 90 123-45-67' });
  check('request-code: verified -> 200 {ok:true}', [res.status, await res.json()], [200, { ok: true }]);
  check('request-code: telegram send captured to tg_user_id', [tgSends.length, tgSends[0].chat_id], [1, 777001]);
  checkTrue('request-code: message contains 6-digit code', /^\d{6}$/.test(lastCode() || ''));
  const otpRow = sqlite.prepare(`SELECT phone, purpose, used, length(code) AS len FROM phone_otp_codes ORDER BY id DESC LIMIT 1`).get();
  check('request-code: row stored, hashed (sha256 hex), purpose register', otpRow, { phone: '+998901234567', purpose: 'register', used: 0, len: 64 });

  // Limit: 10 daqiqada 3 ta — 4-chisi 429
  await post('/api/auth/request-register-code', { phone: '+998901234567' });
  await post('/api/auth/request-register-code', { phone: '+998901234567' });
  res = await post('/api/auth/request-register-code', { phone: '+998901234567' });
  check('request-code: 4th within 10 min -> 429', [res.status, (await res.json()).error], [429, 'too_many_requests']);
  check('request-code: only 3 sends', tgSends.length, 3);
}

// ===== register =====
const regBody = (over = {}) => ({
  email: 'New.User@Test.local', password: 'secret123', phone: '+998901234567',
  code: lastCode(), botAck: true, tosAccepted: true, promoCode: '', ...over,
});
{
  let res = await post('/api/auth/register', regBody({ email: 'bad' }));
  check('register: bad email -> 422', res.status, 422);
  res = await post('/api/auth/register', regBody({ password: '123' }));
  check('register: short password -> 422', res.status, 422);
  res = await post('/api/auth/register', regBody({ botAck: false }));
  check('register: botAck missing -> 422', res.status, 422);
  res = await post('/api/auth/register', regBody({ code: '' }));
  check('register: code missing -> 422 code_required', [res.status, (await res.json()).error], [422, 'code_required']);
  res = await post('/api/auth/register', regBody({ phone: '+998909999999' }));
  check('register: unverified phone -> 422', [res.status, (await res.json()).error], [422, 'phone_not_verified']);
  res = await post('/api/auth/register', regBody({ email: 'user@test.local' }));
  check('register: duplicate email -> 409 (code NOT consumed)', [res.status, (await res.json()).error], [409, 'email_taken']);

  // Noto'g'ri kod → 422, va o'sha kod kuyadi
  res = await post('/api/auth/register', regBody({ code: '000000' }));
  check('register: wrong code -> 422 bad_code', [res.status, (await res.json()).error], [422, 'bad_code']);
  res = await post('/api/auth/register', regBody());
  check('register: correct code after wrong attempt is burned -> 422', (await res.json()).error, 'bad_code');

  // Yangi kod (limit oynasini bo'shatamiz) — referral uchun user#1 ga promo beramiz
  sqlite.prepare(`UPDATE phone_otp_codes SET created_at = '2000-01-01 00:00:00+00'`).run();
  sqlite.prepare(`UPDATE users SET promo_code = 'FRIEND1' WHERE id = 1`).run();
  await post('/api/auth/request-register-code', { phone: '+998901234567' });
  res = await post('/api/auth/register', regBody({ promoCode: 'friend1' }));
  const body = await res.json();
  check('register: happy path -> 201 {user:{id,email}}', [res.status, body.user?.email, typeof body.user?.id], [201, 'new.user@test.local', 'number']);
  const setCookie = res.headers.get('set-cookie') || '';
  checkTrue('register: Set-Cookie nfc_session', /^nfc_session=[0-9a-f]{64}; Path=\/; HttpOnly/.test(setCookie));
  const u = sqlite.prepare(`SELECT email, phone, bot_ack, tos_accepted, promo_code, length(password_hash) AS hl FROM users WHERE id = ?`).get(body.user.id);
  check('register: user row', [u.email, u.phone, u.bot_ack, u.tos_accepted], ['new.user@test.local', '+998901234567', 1, 1]);
  checkTrue('register: promo_code assigned (6 chars)', /^[A-Z2-9]{6}$/.test(u.promo_code || ''));
  checkTrue('register: password hashed (salt:hash)', u.hl > 100);
  const card = sqlite.prepare(`SELECT code, name, price, is_primary, giftable, theme, hashtags FROM cards WHERE user_id = ?`).get(body.user.id);
  check('register: free 8-digit ID card', [/^\d{8}$/.test(card?.code || ''), card?.name, card?.price, card?.is_primary, card?.giftable, card?.theme, card?.hashtags], [true, 'new.user', 0, 1, 0, 'classic', '[]']);
  const ref = sqlite.prepare(`SELECT referrer_id, referred_id FROM referral_uses`).all();
  check('register: referral recorded', ref, [{ referrer_id: 1, referred_id: body.user.id }]);
  check('register: referrer discount +10', sqlite.prepare(`SELECT pending_discount_pct AS p FROM users WHERE id = 1`).get().p, 10);
  check('register: OTP consumed', sqlite.prepare(`SELECT used FROM phone_otp_codes ORDER BY id DESC LIMIT 1`).get().used, 1);

  // Cookie ishlaydi
  const token = setCookie.match(/^nfc_session=([0-9a-f]+)/)[1];
  res = await worker.fetch(req('/api/auth/me', { cookie: `nfc_session=${token}` }), env);
  const me = await res.json();
  check('register: session cookie works on /api/auth/me', [me.user?.id, me.cards?.length], [body.user.id, 1]);

  res = await post('/api/auth/register', regBody());
  check('register: same email again -> 409', res.status, 409);

  // Admin o'chirgan akkaunt emaili qayta ro'yxatdan o'tadi (eski qator tozalanadi)
  sqlite.prepare(`INSERT INTO users (id, email, password_hash, deleted_at) VALUES (50, 'gone@test.local', 'x', '2026-01-01 00:00:00+00')`).run();
  sqlite.prepare(`INSERT INTO cards (code, name, price, ts, user_id) VALUES ('GON001', 'Old', 0, 1, 50)`).run();
  sqlite.prepare(`UPDATE phone_otp_codes SET created_at = '2000-01-01 00:00:00+00'`).run();
  await post('/api/auth/request-register-code', { phone: '+998901234567' });
  res = await post('/api/auth/register', regBody({ email: 'gone@test.local' }));
  const gone = await res.json();
  check('register: deleted account email re-registers -> 201', [res.status, gone.user?.email], [201, 'gone@test.local']);
  check('register: old deleted row + its cards removed', [sqlite.prepare(`SELECT COUNT(*) AS n FROM users WHERE id = 50`).get().n, sqlite.prepare(`SELECT COUNT(*) AS n FROM cards WHERE code = 'GON001'`).get().n], [0, 0]);
  checkTrue('register: new id differs from deleted one', gone.user.id !== 50);
  check('register: admin activity logged', sqlite.prepare(`SELECT action FROM admin_activity_log ORDER BY id DESC LIMIT 1`).get()?.action, 'user_deleted');
}

// ===== password reset =====
{
  const before = tgSends.length;
  let res = await post('/api/auth/request-password-reset', { email: 'nobody@test.local' });
  check('reset-request: unknown email -> {ok:true} (no enumeration)', [res.status, await res.json()], [200, { ok: true }]);
  res = await post('/api/auth/request-password-reset', { email: 'other@test.local' }); // phone botda yo'q
  check('reset-request: user without bot verification -> {ok:true}, no send', [await res.json(), tgSends.length], [{ ok: true }, before]);
  res = await post('/api/auth/request-password-reset', { email: 'not-an-email' });
  check('reset-request: bad email format -> 422', res.status, 422);

  // user#1 telefoni botda tasdiqlanadi
  await env.DB.prepare(`INSERT INTO bot_verifications (phone, tg_user_id, tg_name) VALUES ('+998901111111', 777111, 'User1')`).run();
  res = await post('/api/auth/request-password-reset', { email: 'USER@test.local' });
  check('reset-request: verified user -> {ok:true} + telegram send', [await res.json(), tgSends.length, tgSends[tgSends.length - 1].chat_id], [{ ok: true }, before + 1, 777111]);
  const resetRow = sqlite.prepare(`SELECT user_id, used, length(code) AS len FROM password_reset_codes ORDER BY id DESC LIMIT 1`).get();
  check('reset-request: row stored hashed for user#1', resetRow, { user_id: 1, used: 0, len: 64 });

  // Noto'g'ri kod → 422 (kod kuyadi)
  res = await post('/api/auth/reset-password', { email: 'user@test.local', code: '000000', password: 'newpass123' });
  check('reset: wrong code -> 422 bad_code', [res.status, (await res.json()).error], [422, 'bad_code']);
  res = await post('/api/auth/reset-password', { email: 'user@test.local', code: 'abc', password: 'newpass123' });
  check('reset: malformed code -> 422 bad_code', (await res.json()).error, 'bad_code');
  res = await post('/api/auth/reset-password', { email: 'user@test.local', code: '123456', password: '123' });
  check('reset: short password -> 422', res.status, 422);
  check('reset: sessions intact after failed attempt', sqlite.prepare(`SELECT COUNT(*) AS n FROM sessions WHERE user_id = 1`).get().n, 1);

  // Yangi kod → happy path
  await post('/api/auth/request-password-reset', { email: 'user@test.local' });
  const code = lastCode();
  res = await post('/api/auth/reset-password', { email: 'user@test.local', code, password: 'newpass123' });
  check('reset: happy path -> {ok:true}', [res.status, await res.json()], [200, { ok: true }]);
  check('reset: all sessions of user deleted', sqlite.prepare(`SELECT COUNT(*) AS n FROM sessions WHERE user_id = 1`).get().n, 0);
  res = await worker.fetch(req('/api/auth/me', { cookie: cookie.user }), env);
  check('reset: old cookie no longer valid', (await res.json()).user, null);
  res = await post('/api/auth/login', { email: 'user@test.local', password: 'newpass123' });
  check('reset: login with new password works', [res.status, (await res.json()).user?.id], [200, 1]);
  res = await post('/api/auth/reset-password', { email: 'user@test.local', code, password: 'another123' });
  check('reset: code cannot be reused', res.status, 422);

  // Limit: 15 daqiqada 3 ta — keyingilari jimgina yuborilmaydi
  const sends0 = tgSends.length;
  await post('/api/auth/request-password-reset', { email: 'user@test.local' });
  await post('/api/auth/request-password-reset', { email: 'user@test.local' });
  res = await post('/api/auth/request-password-reset', { email: 'user@test.local' });
  check('reset-request: rate limited silently (still ok:true)', [await res.json(), tgSends.length], [{ ok: true }, sends0 + 1]);
}

// Modul boshqa route'larga aralashmaydi
{
  const res = await worker.fetch(req('/api/auth/whatever', { method: 'POST', json: {} }), env);
  check('unknown /api/auth route -> 404', res.status, 404);
}

done();
