// Telegram OTP as the SOLE, MANDATORY 2FA method — regression test.
//
// Google Authenticator/TOTP has been removed from the login flow entirely
// (per the latest decision): password correct -> /login itself generates
// a 6-digit code, hashes it with HMAC-SHA256 keyed by env.ADMIN_OTP_SECRET,
// stores only the hash, and sends the raw code to the admin's Telegram via
// the Bot API — no separate "get code" button, no opt-in choice. admins.
// totp_secret/totp_enabled/totp_last_counter stay in the schema untouched,
// simply never read by /login or /verify-2fa any more (the standalone
// /2fa/totp/setup|confirm|disable|status self-service endpoints are
// covered separately in admin-login-totp-followers-test.mjs).
//
// Runs the ACTUAL hosting/worker.js default export (worker.fetch) against
// an in-memory, D1-API-compatible SQLite database. Never touches
// production D1 or the real Telegram Bot API — `fetch` to
// api.telegram.org is intercepted below and answered locally.
//
//   node scripts/admin-telegram-2fa-test.mjs
//
// Covers: telegram_not_configured before any pending row is created; wrong
// password rejected before any OTP is ever sent; the correct password
// auto-sends a real 6-digit code with no separate request needed; the code
// is stored as an HMAC-SHA256(ADMIN_OTP_SECRET, code) hash — never raw,
// and NOT just a plain unsalted hash either; wrong OTP rejected; correct
// OTP creates a session whose token is also stored as a hash, never raw;
// expired OTP rejected; OTP reuse (same code, same or fresh login)
// rejected; a per-pending attempt limit that permanently invalidates the
// pending login once exhausted; a rejected Telegram send surfacing as
// tg_send_failed with no dangling pending row; and that the standalone
// manual-resend endpoint still works and stays consistent with the same
// hashing scheme.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createHmac, createHash } from 'node:crypto';
import worker, { ensureCoreSchema, hashPassword } from '../hosting/worker.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sha256Hex = (text) => createHash('sha256').update(text).digest('hex');
const OTP_SECRET = 'test-otp-pepper-do-not-use-in-prod';
const hmacOtpHash = (code) => createHmac('sha256', OTP_SECRET).update(code).digest('hex');

let pass = 0;
let fail = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(ok ? 'PASS' : 'FAIL', '-', label, ok ? '' : `\n    actual:   ${JSON.stringify(actual)}\n    expected: ${JSON.stringify(expected)}`);
  ok ? pass++ : fail++;
}
function checkTrue(label, actual) { check(label, !!actual, true); }

const sqlite = new DatabaseSync(':memory:');
function makeStmt(sql) {
  return {
    _sql: sql, _args: [],
    bind(...args) { this._args = args; return this; },
    async first() { const row = sqlite.prepare(this._sql).get(...this._args); return row === undefined ? null : row; },
    async all() { return { results: sqlite.prepare(this._sql).all(...this._args) }; },
    async run() { const info = sqlite.prepare(this._sql).run(...this._args); return { success: true, meta: { changes: info.changes, last_row_id: info.lastInsertRowid } }; },
  };
}
function makeEnv(extra = {}) {
  return {
    DB: {
      prepare: (sql) => makeStmt(sql),
      async batch(stmts) { const out = []; for (const s of stmts) out.push(await s.run()); return out; },
      exec: (sql) => sqlite.exec(sql),
    },
    ASSETS: { fetch: async () => new Response('not found', { status: 404 }) },
    ...extra,
  };
}
function req(pathname, init = {}) { return new Request(`https://nfcstore.uz${pathname}`, init); }
const fullyConfigured = { TELEGRAM_BOT_TOKEN: 'test-bot-token', ADMIN_CHAT_ID: '123456789', ADMIN_OTP_SECRET: OTP_SECRET };

// Intercept only calls to api.telegram.org — everything else (there
// shouldn't be any in this test) passes through to the real global fetch.
const realFetch = globalThis.fetch;
let lastTelegramCall = null;
let telegramShouldFail = false;
globalThis.fetch = async (url, init) => {
  const href = typeof url === 'string' ? url : url.url;
  if (href.startsWith('https://api.telegram.org/')) {
    lastTelegramCall = { url: href, body: init?.body ? JSON.parse(init.body) : null };
    if (telegramShouldFail) return new Response(JSON.stringify({ ok: false, description: 'simulated failure' }), { status: 200 });
    return new Response(JSON.stringify({ ok: true, result: {} }), { status: 200 });
  }
  return realFetch(url, init);
};

sqlite.exec(readFileSync(path.join(__dirname, '../db/d1-migration/0001-schema.sql'), 'utf8'));

const passHash = await hashPassword('correct-horse-battery-staple');
await (async () => {
  const env0 = makeEnv();
  await ensureCoreSchema(env0);
})();
// Two admins, TOTP columns left completely untouched (null/0) — proves the
// login flow needs nothing from them any more.
await sqlite.prepare(`INSERT INTO admins (id, phone, password_hash, role) VALUES (1, '+998900000009', ?, 'manager')`).run(passHash);
await sqlite.prepare(`INSERT INTO admins (id, phone, password_hash, role) VALUES (2, '+998900000010', ?, 'manager')`).run(passHash);

// loginRateLimited() is IP-keyed (3 per 30 min) shared across /login,
// /verify-2fa AND /2fa/telegram/send — give each logical scenario below
// its own fake source IP so they never contend for the same budget within
// this one test run.
let ipCounter = 0;
const nextIp = () => ({ 'cf-connecting-ip': `20.20.20.${++ipCounter}` });
const codeOf = () => (lastTelegramCall?.body?.text.match(/(\d{6})/) || [])[1];

// =====================================================================
// 1) Telegram not configured — /login refuses BEFORE creating any pending
//    row or touching the admin's password result beyond the check itself.
// =====================================================================
{
  const env = makeEnv(); // no TELEGRAM_BOT_TOKEN / ADMIN_CHAT_ID / ADMIN_OTP_SECRET
  const ip = nextIp();
  const res = await worker.fetch(req('/api/admin/login', { method: 'POST', headers: ip, body: JSON.stringify({ phone: '+998900000009', password: 'correct-horse-battery-staple' }) }), env);
  const data = await res.json();
  check('correct password but Telegram not configured -> 503 telegram_not_configured', { status: res.status, error: data.error }, { status: 503, error: 'telegram_not_configured' });
  checkTrue('no Telegram API call was made', lastTelegramCall === null);
  const pendingCount = await sqlite.prepare(`SELECT COUNT(*) AS n FROM admin_2fa_pending`).get();
  check('no pending 2FA row was left behind', pendingCount.n, 0);
}

// =====================================================================
// 2) Wrong password — rejected before any OTP is generated/sent, whether
//    or not Telegram is configured.
// =====================================================================
{
  const env = makeEnv(fullyConfigured);
  const ip = nextIp();
  const res = await worker.fetch(req('/api/admin/login', { method: 'POST', headers: ip, body: JSON.stringify({ phone: '+998900000009', password: 'wrong-password' }) }), env);
  check('wrong password -> 401 bad_credentials', res.status, 401);
  checkTrue('no Telegram API call was made for a wrong password', lastTelegramCall === null);
}

// =====================================================================
// 3) Correct password, Telegram configured — OTP auto-sent, hashed at
//    rest with the keyed HMAC (not a plain unsalted hash), wrong code
//    rejected, correct code creates a session whose token is also hashed.
// =====================================================================
lastTelegramCall = null;
let acceptedTempToken = '';
let acceptedCode = '';
{
  const env = makeEnv(fullyConfigured);
  const ip = nextIp();
  const loginRes = await worker.fetch(req('/api/admin/login', { method: 'POST', headers: ip, body: JSON.stringify({ phone: '+998900000009', password: 'correct-horse-battery-staple' }) }), env);
  const loginData = await loginRes.json();
  check('correct password -> 200, twoFactor:true, method:telegram', { status: loginRes.status, twoFactor: loginData.twoFactor, method: loginData.method }, { status: 200, twoFactor: true, method: 'telegram' });
  checkTrue('no admin session cookie set before the OTP is verified', !loginRes.headers.get('set-cookie'));
  checkTrue('Telegram API was called automatically — no separate request needed', !!lastTelegramCall);
  check('sent to the configured ADMIN_CHAT_ID', lastTelegramCall.body.chat_id, '123456789');
  const code = codeOf();
  checkTrue('message contains a real 6-digit code', /^\d{6}$/.test(String(code)));

  const pendingRow = await sqlite.prepare(`SELECT method, code FROM admin_2fa_pending WHERE temp_token = ?`).get(loginData.tempToken);
  check('pending method is telegram', pendingRow.method, 'telegram');
  checkTrue('raw OTP is NEVER written to D1 — stored value is a hash, not the plaintext code', pendingRow.code !== code);
  check('stored hash is HMAC-SHA256 keyed with ADMIN_OTP_SECRET, not just a plain sha256(code)', pendingRow.code, hmacOtpHash(code));
  checkTrue('the stored hash is NOT merely an unkeyed sha256(code) — proves the secret is actually used', pendingRow.code !== sha256Hex(code));

  const wrongRes = await worker.fetch(req('/api/admin/verify-2fa', { method: 'POST', headers: ip, body: JSON.stringify({ tempToken: loginData.tempToken, code: '000000' }) }), env);
  check('wrong OTP -> 401 bad_code (assuming it does not coincidentally match)', wrongRes.status === 401 || code === '000000', true);

  const okRes = await worker.fetch(req('/api/admin/verify-2fa', { method: 'POST', headers: ip, body: JSON.stringify({ tempToken: loginData.tempToken, code }) }), env);
  check('correct OTP -> 200 + session cookie', { status: okRes.status, hasCookie: !!okRes.headers.get('set-cookie') }, { status: 200, hasCookie: true });

  const sessionRow = await sqlite.prepare(`SELECT token FROM admin_sessions ORDER BY rowid DESC LIMIT 1`).get();
  checkTrue('raw session token is NEVER written to D1 — stored value is a 64-hex-char SHA-256 hash', /^[0-9a-f]{64}$/.test(sessionRow.token));

  acceptedTempToken = loginData.tempToken;
  acceptedCode = code;
}

// =====================================================================
// 4) OTP reuse — the already-used tempToken is gone (expired), and the
//    same code replayed against a FRESH login (its own fresh code) also
//    fails.
// =====================================================================
{
  const env = makeEnv(fullyConfigured);
  const ip = nextIp();
  const reuseSameRes = await worker.fetch(req('/api/admin/verify-2fa', { method: 'POST', headers: ip, body: JSON.stringify({ tempToken: acceptedTempToken, code: acceptedCode }) }), env);
  check('reusing the same (now-deleted) tempToken -> 401 expired', reuseSameRes.status, 401);

  const loginRes = await worker.fetch(req('/api/admin/login', { method: 'POST', headers: ip, body: JSON.stringify({ phone: '+998900000009', password: 'correct-horse-battery-staple' }) }), env);
  const loginData = await loginRes.json();
  const reuseFreshRes = await worker.fetch(req('/api/admin/verify-2fa', { method: 'POST', headers: ip, body: JSON.stringify({ tempToken: loginData.tempToken, code: acceptedCode }) }), env);
  check('replaying a previous OTP code against a fresh login -> 401 bad_code', reuseFreshRes.status, 401);
}

// =====================================================================
// 5) Expired OTP — a pending row past its expires_at is rejected and
//    cleaned up, even with the objectively correct code.
// =====================================================================
{
  const env = makeEnv(fullyConfigured);
  const ip = nextIp();
  const loginRes = await worker.fetch(req('/api/admin/login', { method: 'POST', headers: ip, body: JSON.stringify({ phone: '+998900000010', password: 'correct-horse-battery-staple' }) }), env);
  const loginData = await loginRes.json();
  const code = codeOf();
  await sqlite.prepare(`UPDATE admin_2fa_pending SET expires_at = '2000-01-01T00:00:00.000Z' WHERE temp_token = ?`).run(loginData.tempToken);
  const res = await worker.fetch(req('/api/admin/verify-2fa', { method: 'POST', headers: ip, body: JSON.stringify({ tempToken: loginData.tempToken, code }) }), env);
  check('expired OTP -> 401 expired even with the correct code', res.status, 401);
  const pendingRow = await sqlite.prepare(`SELECT 1 FROM admin_2fa_pending WHERE temp_token = ?`).get(loginData.tempToken);
  check('the expired pending row was cleaned up', pendingRow, undefined);
}

// =====================================================================
// 6) Attempt limit — wrong codes exhaust it, then the pending login is
//    invalidated outright (must restart from /login).
// =====================================================================
{
  const env = makeEnv(fullyConfigured);
  const ip = nextIp();
  const loginRes = await worker.fetch(req('/api/admin/login', { method: 'POST', headers: ip, body: JSON.stringify({ phone: '+998900000009', password: 'correct-horse-battery-staple' }) }), env);
  const loginData = await loginRes.json();

  // Each attempt below uses its own fake IP — otherwise the shared
  // login-rate-limiter (3 per IP per 30 min, spanning /login and
  // /verify-2fa together) would block attempts 4-6 with 429 before the
  // attempt-limit logic under test ever gets to run, which is a
  // test-harness artifact, not the behavior being tested here.
  let lastStatus = null;
  for (let i = 0; i < 6; i++) {
    const res = await worker.fetch(req('/api/admin/verify-2fa', { method: 'POST', headers: nextIp(), body: JSON.stringify({ tempToken: loginData.tempToken, code: '000000' }) }), env);
    lastStatus = res.status;
  }
  check('after exhausting the attempt limit, the pending login is gone (expired), not just "bad_code" forever', lastStatus, 401);
  const pendingRow = await sqlite.prepare(`SELECT 1 FROM admin_2fa_pending WHERE temp_token = ?`).get(loginData.tempToken);
  check('the pending row was actually deleted once attempts were exhausted', pendingRow, undefined);
}

// =====================================================================
// 7) Telegram send failure during /login itself surfaces tg_send_failed,
//    and leaves no dangling pending row behind.
// =====================================================================
{
  telegramShouldFail = true;
  const env = makeEnv(fullyConfigured);
  const ip = nextIp();
  const res = await worker.fetch(req('/api/admin/login', { method: 'POST', headers: ip, body: JSON.stringify({ phone: '+998900000010', password: 'correct-horse-battery-staple' }) }), env);
  const data = await res.json();
  check('a rejected Telegram API call during /login surfaces as 503 tg_send_failed', { status: res.status, error: data.error }, { status: 503, error: 'tg_send_failed' });
  // Scoped to THIS admin (id 2) — earlier scenarios intentionally leave
  // their own still-live (not yet expired/exhausted) pending rows for
  // OTHER admins around, which is correct app behavior, not a leak.
  const pendingCount = await sqlite.prepare(`SELECT COUNT(*) AS n FROM admin_2fa_pending WHERE admin_id = 2`).get();
  check('no pending row was left behind after the failed send', pendingCount.n, 0);
  telegramShouldFail = false;
}

// =====================================================================
// 8) Standalone manual-resend endpoint (/2fa/telegram/send) — no longer
//    called by the frontend, but still correct if ever used (e.g. the
//    first message got lost): invalidates the auto-sent code and uses the
//    same keyed hash.
// =====================================================================
{
  const env = makeEnv(fullyConfigured);
  // A distinct IP per call — 4 requests here would otherwise exceed the
  // shared 3-per-IP-per-30-min login rate limiter on their own.
  const loginRes = await worker.fetch(req('/api/admin/login', { method: 'POST', headers: nextIp(), body: JSON.stringify({ phone: '+998900000009', password: 'correct-horse-battery-staple' }) }), env);
  const loginData = await loginRes.json();
  const firstCode = codeOf();

  const sendRes = await worker.fetch(req('/api/admin/2fa/telegram/send', { method: 'POST', headers: nextIp(), body: JSON.stringify({ tempToken: loginData.tempToken }) }), env);
  check('manual resend -> 200', sendRes.status, 200);
  const secondCode = codeOf();

  const oldCodeRes = await worker.fetch(req('/api/admin/verify-2fa', { method: 'POST', headers: nextIp(), body: JSON.stringify({ tempToken: loginData.tempToken, code: firstCode }) }), env);
  check('the auto-sent (now-superseded) code no longer works after a manual resend', oldCodeRes.status, 401);

  const newCodeRes = await worker.fetch(req('/api/admin/verify-2fa', { method: 'POST', headers: nextIp(), body: JSON.stringify({ tempToken: loginData.tempToken, code: secondCode }) }), env);
  check('the resent code works -> 200 + session', { status: newCodeRes.status, hasCookie: !!newCodeRes.headers.get('set-cookie') }, { status: 200, hasCookie: true });
}

globalThis.fetch = realFetch;
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
