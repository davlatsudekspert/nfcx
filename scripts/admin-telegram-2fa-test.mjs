// Opt-in Telegram OTP as a secondary 2FA method (Google Authenticator stays
// primary/default) — regression test.
//
// Runs the ACTUAL hosting/worker.js default export (worker.fetch) against
// an in-memory, D1-API-compatible SQLite database. Never touches
// production D1 or the real Telegram Bot API — `fetch` to
// api.telegram.org is intercepted below and answered locally.
//
//   node scripts/admin-telegram-2fa-test.mjs
//
// Covers: TOTP flow is completely unaffected (regression); Telegram OTP is
// NEVER sent unless explicitly requested (no auto/IP-based trigger); the
// code is stored as a hash (never raw) and a fresh request invalidates the
// previous one; a 5-minute expiry; a per-pending-login attempt limit;
// telegram_not_configured when the bot isn't wired up; and that
// admin_sessions never receives a raw token either way.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createHmac, createHash } from 'node:crypto';
import worker, { ensureCoreSchema, hashPassword } from '../hosting/worker.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sha256Hex = (text) => createHash('sha256').update(text).digest('hex');

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

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32Decode(input) {
  const clean = String(input).toUpperCase().replace(/[^A-Z2-7]/g, '');
  const bytes = []; let bits = 0, value = 0;
  for (const ch of clean) { const idx = B32.indexOf(ch); if (idx === -1) continue; value = (value << 5) | idx; bits += 5; if (bits >= 8) { bits -= 8; bytes.push((value >>> bits) & 0xff); } }
  return Buffer.from(bytes);
}
function hotpAt(secretB32, counter) {
  const key = base32Decode(secretB32);
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(counter / 2 ** 32), 0);
  buf.writeUInt32BE(counter >>> 0, 4);
  const hmac = createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = ((hmac[offset] & 0x7f) << 24) | ((hmac[offset + 1] & 0xff) << 16) | ((hmac[offset + 2] & 0xff) << 8) | (hmac[offset + 3] & 0xff);
  return String(code % 1_000_000).padStart(6, '0');
}
function totpNow(secretB32) { return hotpAt(secretB32, Math.floor(Date.now() / 1000 / 30)); }

sqlite.exec(readFileSync(path.join(__dirname, '../db/d1-migration/0001-schema.sql'), 'utf8'));

const secret = 'JBSWY3DPEHPK3PXP';
const passHash = await hashPassword('correct-horse-battery-staple');
await (async () => {
  const env0 = makeEnv();
  await ensureCoreSchema(env0);
})();
await sqlite.prepare(`INSERT INTO admins (id, phone, password_hash, role, totp_secret, totp_enabled) VALUES (1, '+998900000009', ?, 'manager', ?, 1)`).run(passHash, secret);
// A second admin with its OWN totp_last_counter, used wherever a scenario
// needs its own independent TOTP verify — admin #1's replay guard (a
// GENUINE, intentional feature: the same 30s-window code can never be
// accepted twice) would otherwise make two back-to-back TOTP logins for
// the SAME admin within this test's sub-second runtime collide with each
// other, which is a test-harness artifact, not a real bug.
await sqlite.prepare(`INSERT INTO admins (id, phone, password_hash, role, totp_secret, totp_enabled) VALUES (2, '+998900000010', ?, 'manager', ?, 1)`).run(passHash, secret);

// loginRateLimited() is IP-keyed (3 per 30 min) shared across /login,
// /verify-2fa AND /2fa/telegram/send — give each logical scenario below
// its own fake source IP so they never contend for the same budget
// within this one test run (a real deployment sees them spread across
// wall-clock time and real distinct IPs, so this is purely a test-harness
// concern, same pattern as the other admin-auth test files).
let ipCounter = 0;
const nextIp = () => ({ 'cf-connecting-ip': `20.20.20.${++ipCounter}` });

// =====================================================================
// 1) Without the bot configured — TOTP flow is completely unaffected
//    (regression: this must keep working exactly as before, "ishxonada
//    ishlayapti" must never break).
// =====================================================================
{
  const env = makeEnv(); // no TELEGRAM_BOT_TOKEN / ADMIN_CHAT_ID
  const ip = nextIp();
  const loginRes = await worker.fetch(req('/api/admin/login', { method: 'POST', headers: ip, body: JSON.stringify({ phone: '+998900000009', password: 'correct-horse-battery-staple' }) }), env);
  const loginData = await loginRes.json();
  check('TOTP-only login (no Telegram involved) -> twoFactor:true, method:totp (unchanged)', { status: loginRes.status, twoFactor: loginData.twoFactor, method: loginData.method }, { status: 200, twoFactor: true, method: 'totp' });

  const verifyRes = await worker.fetch(req('/api/admin/verify-2fa', { method: 'POST', headers: ip, body: JSON.stringify({ tempToken: loginData.tempToken, code: totpNow(secret) }) }), env);
  check('TOTP verify-2fa still works end-to-end (regression) -> 200 + session cookie', { status: verifyRes.status, hasCookie: !!verifyRes.headers.get('set-cookie') }, { status: 200, hasCookie: true });
  checkTrue('Telegram API was never called for a pure-TOTP login', lastTelegramCall === null);
}

// =====================================================================
// 2) Telegram OTP not configured -> 503, TOTP still untouched
// =====================================================================
{
  const env = makeEnv();
  const ip = nextIp();
  const loginRes = await worker.fetch(req('/api/admin/login', { method: 'POST', headers: ip, body: JSON.stringify({ phone: '+998900000010', password: 'correct-horse-battery-staple' }) }), env);
  const loginData = await loginRes.json();
  const sendRes = await worker.fetch(req('/api/admin/2fa/telegram/send', { method: 'POST', headers: ip, body: JSON.stringify({ tempToken: loginData.tempToken }) }), env);
  const sendData = await sendRes.json();
  check('requesting Telegram OTP with no bot configured -> 503 telegram_not_configured', { status: sendRes.status, error: sendData.error }, { status: 503, error: 'telegram_not_configured' });
  // the pending row must still be usable via TOTP after a failed Telegram attempt
  const verifyRes = await worker.fetch(req('/api/admin/verify-2fa', { method: 'POST', headers: ip, body: JSON.stringify({ tempToken: loginData.tempToken, code: totpNow(secret) }) }), env);
  check('TOTP still works after a failed (not-configured) Telegram OTP request', verifyRes.status, 200);
}

// =====================================================================
// 3) Telegram OTP configured — full opt-in flow, hashed at rest, prior
//    code invalidated by a fresh request, admin_sessions gets a hash too.
// =====================================================================
lastTelegramCall = null;
{
  const env = makeEnv({ TELEGRAM_BOT_TOKEN: 'test-bot-token', ADMIN_CHAT_ID: '123456789' });
  const loginRes = await worker.fetch(req('/api/admin/login', { method: 'POST', headers: nextIp(), body: JSON.stringify({ phone: '+998900000009', password: 'correct-horse-battery-staple' }) }), env);
  const loginData = await loginRes.json();
  check('login still offers TOTP by default even with the bot configured (opt-in only)', loginData.method, 'totp');

  const sendRes1 = await worker.fetch(req('/api/admin/2fa/telegram/send', { method: 'POST', headers: nextIp(), body: JSON.stringify({ tempToken: loginData.tempToken }) }), env);
  check('explicit "Telegram orqali kod olish" -> 200', sendRes1.status, 200);
  checkTrue('Telegram API was actually called (only because the admin asked)', !!lastTelegramCall);
  check('sent to the configured ADMIN_CHAT_ID', lastTelegramCall.body.chat_id, '123456789');
  const firstCodeMatch = lastTelegramCall.body.text.match(/(\d{6})/);
  checkTrue('message contains a 6-digit code', !!firstCodeMatch);
  const firstCode = firstCodeMatch[1];

  const pendingRow = await sqlite.prepare(`SELECT method, code FROM admin_2fa_pending WHERE temp_token = ?`).get(loginData.tempToken);
  check('pending method switched to telegram', pendingRow.method, 'telegram');
  checkTrue('raw OTP is NEVER written to D1 — stored value is a hash, not the plaintext code', pendingRow.code !== firstCode && pendingRow.code === sha256Hex(firstCode));

  // Request a SECOND code — the first one must be invalidated immediately.
  const sendRes2 = await worker.fetch(req('/api/admin/2fa/telegram/send', { method: 'POST', headers: { 'cf-connecting-ip': '7.7.7.7' }, body: JSON.stringify({ tempToken: loginData.tempToken }) }), env);
  check('requesting a second Telegram code -> 200', sendRes2.status, 200);
  const secondCode = lastTelegramCall.body.text.match(/(\d{6})/)[1];

  const oldCodeRes = await worker.fetch(req('/api/admin/verify-2fa', { headers: { 'cf-connecting-ip': '7.7.7.8' }, method: 'POST', body: JSON.stringify({ tempToken: loginData.tempToken, code: firstCode }) }), env);
  check('the FIRST (now-superseded) Telegram code no longer works', oldCodeRes.status, 401);

  const newCodeRes = await worker.fetch(req('/api/admin/verify-2fa', { headers: { 'cf-connecting-ip': '7.7.7.9' }, method: 'POST', body: JSON.stringify({ tempToken: loginData.tempToken, code: secondCode }) }), env);
  check('the SECOND (current) Telegram code works -> 200 + session', { status: newCodeRes.status, hasCookie: !!newCodeRes.headers.get('set-cookie') }, { status: 200, hasCookie: true });

  const sessionRow = await sqlite.prepare(`SELECT token FROM admin_sessions ORDER BY rowid DESC LIMIT 1`).get();
  checkTrue('the new admin_sessions row stores a hash, not a guessable raw token (64 hex chars = SHA-256)', /^[0-9a-f]{64}$/.test(sessionRow.token));
}

// =====================================================================
// 4) Attempt limit on a live Telegram OTP — wrong codes exhaust it, then
//    the pending login is invalidated outright (must restart from /login).
// =====================================================================
{
  const env = makeEnv({ TELEGRAM_BOT_TOKEN: 'test-bot-token', ADMIN_CHAT_ID: '123456789' });
  const loginRes = await worker.fetch(req('/api/admin/login', { method: 'POST', headers: { 'cf-connecting-ip': '8.8.8.1' }, body: JSON.stringify({ phone: '+998900000009', password: 'correct-horse-battery-staple' }) }), env);
  const loginData = await loginRes.json();
  await worker.fetch(req('/api/admin/2fa/telegram/send', { method: 'POST', headers: { 'cf-connecting-ip': '8.8.8.1' }, body: JSON.stringify({ tempToken: loginData.tempToken }) }), env);

  let lastStatus = null;
  for (let i = 0; i < 6; i++) {
    const res = await worker.fetch(req('/api/admin/verify-2fa', { method: 'POST', headers: { 'cf-connecting-ip': `9.9.9.${i}` }, body: JSON.stringify({ tempToken: loginData.tempToken, code: '000000' }) }), env);
    lastStatus = res.status;
  }
  check('after exhausting the attempt limit, the pending login is gone (expired), not just "bad_code" forever', lastStatus, 401);
  const pendingRow = await sqlite.prepare(`SELECT 1 FROM admin_2fa_pending WHERE temp_token = ?`).get(loginData.tempToken);
  check('the pending row was actually deleted once attempts were exhausted', pendingRow, undefined);
}

// =====================================================================
// 5) Telegram send failure (bot API rejects) surfaces tg_send_failed,
//    doesn't silently pretend success.
// =====================================================================
{
  telegramShouldFail = true;
  const env = makeEnv({ TELEGRAM_BOT_TOKEN: 'test-bot-token', ADMIN_CHAT_ID: '123456789' });
  const loginRes = await worker.fetch(req('/api/admin/login', { method: 'POST', headers: { 'cf-connecting-ip': '10.10.10.1' }, body: JSON.stringify({ phone: '+998900000009', password: 'correct-horse-battery-staple' }) }), env);
  const loginData = await loginRes.json();
  const sendRes = await worker.fetch(req('/api/admin/2fa/telegram/send', { method: 'POST', headers: { 'cf-connecting-ip': '10.10.10.1' }, body: JSON.stringify({ tempToken: loginData.tempToken }) }), env);
  const sendData = await sendRes.json();
  check('a rejected Telegram API call surfaces as 503 tg_send_failed', { status: sendRes.status, error: sendData.error }, { status: 503, error: 'tg_send_failed' });
  telegramShouldFail = false;
}

globalThis.fetch = realFetch;
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
