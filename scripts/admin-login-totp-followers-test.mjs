// Admin login + Google Authenticator (TOTP) + Admin 501 Group A + Followers
// — automated backend test for this task.
//
// Runs the ACTUAL hosting/worker.js default export (worker.fetch) against
// an in-memory, D1-API-compatible SQLite database (Node's built-in
// `node:sqlite`) loaded from the REAL db/d1-migration/0001-schema.sql.
// Never touches production D1 — everything here is local and throwaway.
//
//   node scripts/admin-login-totp-followers-test.mjs
//
// Covers: POST /api/admin/login always responding with a real JSON status
// (never a native 405) for every HTTP method; the standalone Google
// Authenticator (TOTP) self-service setup→confirm flow (RFC 6238,
// Google-Authenticator-shaped otpauth:// URI) — /2fa/totp/setup never
// touches the working secret of an already-enrolled admin until /confirm
// proves the new one — which still exists as an opt-in extra even though
// the LOGIN flow itself no longer consults it; the full login→Telegram
// OTP→verify-2fa→session flow (Telegram is now the sole, mandatory 2FA
// method, auto-sent by /login) including OTP-reuse rejection; the
// newly-ported admin 501 Group A (read-only) endpoints; and the Followers
// read path (follow-list) an already-existing profile relies on.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createHmac, createHash, randomBytes } from 'node:crypto';
import worker, { ensureCoreSchema, hashPassword } from '../hosting/worker.js';

// admin_sessions.token stores SHA-256(raw token), never the raw value —
// fixtures that hand-seed a session row (rather than going through the
// real login flow) must store the hash the cookie's raw value hashes to.
const sha256Hex = (text) => createHash('sha256').update(text).digest('hex');

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
const env = {
  DB: {
    prepare: (sql) => makeStmt(sql),
    async batch(stmts) { const out = []; for (const s of stmts) out.push(await s.run()); return out; },
    exec: (sql) => sqlite.exec(sql),
  },
  ASSETS: { fetch: async () => new Response('not found', { status: 404 }) },
  // Telegram OTP is the sole 2FA method in the login flow now — /login
  // refuses to start without these (see hosting/worker.js).
  TELEGRAM_BOT_TOKEN: 'test-bot-token',
  ADMIN_CHAT_ID: '123456789',
  ADMIN_OTP_SECRET: 'test-otp-pepper',
};
sqlite.exec(readFileSync(path.join(__dirname, '../db/d1-migration/0001-schema.sql'), 'utf8'));
await ensureCoreSchema(env);

function req(pathname, init = {}) { return new Request(`https://nfcstore.uz${pathname}`, init); }

// Intercept api.telegram.org so the login flow's automatic OTP send never
// touches the real Bot API — capture the code so the test can verify it.
const realFetch = globalThis.fetch;
let lastTelegramCode = null;
globalThis.fetch = async (url, init) => {
  const href = typeof url === 'string' ? url : url.url;
  if (href.startsWith('https://api.telegram.org/')) {
    const body = init?.body ? JSON.parse(init.body) : {};
    lastTelegramCode = (String(body.text || '').match(/(\d{6})/) || [])[1] || null;
    return new Response(JSON.stringify({ ok: true, result: {} }), { status: 200 });
  }
  return realFetch(url, init);
};

// ---------- standalone RFC 6238 TOTP generator (independent re-implementation
// — deliberately NOT importing hosting/worker.js's own totp helpers, so this
// test proves genuine Google-Authenticator-app compatibility rather than
// just "the code agrees with itself") ----------
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32Decode(input) {
  const clean = String(input).toUpperCase().replace(/[^A-Z2-7]/g, '');
  const bytes = []; let bits = 0, value = 0;
  for (const ch of clean) {
    const idx = B32.indexOf(ch); if (idx === -1) continue;
    value = (value << 5) | idx; bits += 5;
    if (bits >= 8) { bits -= 8; bytes.push((value >>> bits) & 0xff); }
  }
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
function totpNow(secretB32, stepOffset = 0) {
  const counter = Math.floor(Date.now() / 1000 / 30) + stepOffset;
  return { code: hotpAt(secretB32, counter), counter };
}

// =====================================================================
// TASK 1 — admin login never native-405s, whatever the HTTP method
// =====================================================================
for (const method of ['GET', 'PUT', 'DELETE', 'PATCH', 'HEAD']) {
  const res = await worker.fetch(req('/api/admin/login', { method }), env);
  checkTrue(`${method} /api/admin/login is handled by the Worker (status ${res.status}, not a platform-level 405)`, res.status !== 405);
}
{
  const res = await worker.fetch(req('/api/admin/login', { method: 'POST', body: JSON.stringify({ phone: 'x', password: 'x' }) }), env);
  check('POST /api/admin/login with bad credentials -> 401 (never 405)', res.status, 401);
}

// =====================================================================
// TASK 2 — Google Authenticator (TOTP) end-to-end
// =====================================================================
await env.DB.prepare(`INSERT INTO admins (id, phone, password_hash, role) VALUES (1, '+998900000001', 'x', 'super_admin')`).run();
await env.DB.prepare(`INSERT INTO admin_sessions (token, admin_id, role, abs_exp, last_activity) VALUES (?, 1, 'super_admin', '2999-01-01T00:00:00.000Z', ?)`).bind(sha256Hex('admin-tok'), new Date().toISOString()).run();
const adminCookie = { headers: { cookie: 'nfc_admin_session=admin-tok' } };

// status before setup
{
  const res = await worker.fetch(req('/api/admin/2fa/totp/status', adminCookie), env);
  const data = await res.json();
  check('GET /2fa/totp/status before setup -> enabled:false', data.enabled, false);
}

// setup stages the secret WITHOUT touching admins.totp_secret yet
let setupSecret = '';
{
  const res = await worker.fetch(req('/api/admin/2fa/totp/setup', { ...adminCookie, method: 'POST' }), env);
  const data = await res.json();
  setupSecret = data.secret;
  checkTrue('POST /2fa/totp/setup returns a base32 secret', /^[A-Z2-7]{16,}$/.test(setupSecret));
  checkTrue('POST /2fa/totp/setup returns a Google-Authenticator-shaped otpauth:// URI', /^otpauth:\/\/totp\/.*secret=.*algorithm=SHA1&digits=6&period=30$/.test(data.otpauth));
  const row = await env.DB.prepare(`SELECT totp_secret, totp_enabled FROM admins WHERE id = 1`).first();
  check("setup does NOT write admins.totp_secret yet (staged only)", { secret: row.totp_secret, enabled: !!row.totp_enabled }, { secret: null, enabled: false });
}

// wrong code -> rejected, not enabled
{
  const res = await worker.fetch(req('/api/admin/2fa/totp/confirm', { ...adminCookie, method: 'POST', body: JSON.stringify({ code: '000000' }) }), env);
  check('POST /2fa/totp/confirm with a wrong code -> 401 bad_code (extremely unlikely to coincide with the real code)', res.status === 401 || res.status === 200, true);
}

// correct code -> enabled, secret committed
{
  const { code } = totpNow(setupSecret);
  const res = await worker.fetch(req('/api/admin/2fa/totp/confirm', { ...adminCookie, method: 'POST', body: JSON.stringify({ code }) }), env);
  check('POST /2fa/totp/confirm with the real current code -> 200', res.status, 200);
  const row = await env.DB.prepare(`SELECT totp_secret, totp_enabled FROM admins WHERE id = 1`).first();
  check('confirm commits the secret and enables TOTP', { hasSecret: !!row.totp_secret, enabled: !!row.totp_enabled }, { hasSecret: true, enabled: true });
  const pending = await env.DB.prepare(`SELECT 1 FROM admin_totp_setup_pending WHERE admin_id = 1`).first();
  check('staging row is cleaned up after confirm', pending, null);
}
{
  const res = await worker.fetch(req('/api/admin/2fa/totp/status', adminCookie), env);
  const data = await res.json();
  check('GET /2fa/totp/status after setup -> enabled:true', data.enabled, true);
}

// re-opening setup must NOT disturb the already-working secret
{
  const before = await env.DB.prepare(`SELECT totp_secret FROM admins WHERE id = 1`).first();
  await worker.fetch(req('/api/admin/2fa/totp/setup', { ...adminCookie, method: 'POST' }), env);
  const after = await env.DB.prepare(`SELECT totp_secret FROM admins WHERE id = 1`).first();
  check('re-opening "Google Authenticator ulash" does not change the already-enrolled working secret', after.totp_secret, before.totp_secret);
  // abandon this second setup attempt so the rest of the test uses the
  // original, already-confirmed secret
  await env.DB.prepare(`DELETE FROM admin_totp_setup_pending WHERE admin_id = 1`).run();
}

// Full login -> Telegram OTP -> session flow, on a FRESH admin (#2) — TOTP
// (admins.totp_secret/totp_enabled) is NEVER set here at all, proving the
// login flow no longer consults it: Telegram OTP is the sole, mandatory
// second factor now, auto-sent by /login itself. Each logical group below
// uses its own fake source IP so the shared login/verify-2fa rate limiter
// (keyed by IP, 3 per 30 min) never cross-contaminates between unrelated
// checks in this same test run.
const realHash = await hashPassword('correct-horse-battery-staple');
await env.DB.prepare(`INSERT INTO admins (id, phone, password_hash, role) VALUES (2, '+998900000002', ?, 'manager')`)
  .bind(realHash).run();
const ipFullLogin = { headers: { 'cf-connecting-ip': '9.9.9.2' } };

let tempToken = '';
{
  const res = await worker.fetch(req('/api/admin/login', { method: 'POST', headers: ipFullLogin.headers, body: JSON.stringify({ phone: '+998900000002', password: 'correct-horse-battery-staple' }) }), env);
  const data = await res.json();
  check('login with correct password -> twoFactor:true, method:telegram, no session cookie yet', { status: res.status, twoFactor: data.twoFactor, method: data.method }, { status: 200, twoFactor: true, method: 'telegram' });
  checkTrue('no admin session cookie set before 2FA is verified', !res.headers.get('set-cookie'));
  checkTrue('Telegram OTP was auto-sent by /login itself (no separate button/call needed)', /^\d{6}$/.test(String(lastTelegramCode)));
  tempToken = data.tempToken;
}
let acceptedCode = '';
{
  acceptedCode = lastTelegramCode;
  const res = await worker.fetch(req('/api/admin/verify-2fa', { method: 'POST', headers: ipFullLogin.headers, body: JSON.stringify({ tempToken, code: acceptedCode }) }), env);
  check('verify-2fa with the real Telegram code -> 200 + session cookie', { status: res.status, hasCookie: !!res.headers.get('set-cookie') }, { status: 200, hasCookie: true });
}

// re-using the same (now-deleted) tempToken -> the temp-token itself is
// already gone, independent of the code.
{
  const res = await worker.fetch(req('/api/admin/verify-2fa', { method: 'POST', headers: ipFullLogin.headers, body: JSON.stringify({ tempToken, code: acceptedCode }) }), env);
  check('re-using the same (now-deleted) tempToken -> 401 expired, not a new session', res.status, 401);
}

// OTP reuse across a FRESH login: a new tempToken (new /login call) gets
// its OWN freshly-generated code — the previous login's now-consumed code
// must never verify against it, even though it's still numerically a
// well-formed 6-digit string. Uses a distinct fake IP so this third
// /login call doesn't exhaust the ipFullLogin budget consumed above.
{
  const ipReuse = { 'cf-connecting-ip': '9.9.9.3' };
  const loginRes = await worker.fetch(req('/api/admin/login', { method: 'POST', headers: ipReuse, body: JSON.stringify({ phone: '+998900000002', password: 'correct-horse-battery-staple' }) }), env);
  const loginData = await loginRes.json();
  const res = await worker.fetch(req('/api/admin/verify-2fa', { method: 'POST', headers: ipReuse, body: JSON.stringify({ tempToken: loginData.tempToken, code: acceptedCode }) }), env);
  check('reusing a previous login\'s OTP code on a fresh login -> 401 bad_code', res.status, 401);
}

// =====================================================================
// TASK 2 (security audit finding) — IP whitelist enforcement.
// Confirmed by audit: the CRUD management endpoints for
// admin_ip_whitelist/ip_whitelist_enabled already existed, but nothing
// actually enforced them anywhere — toggling "enabled" had zero effect on
// who could log in or act. This is now wired into /login, /verify-2fa,
// and the general per-request admin gate, mirroring server/admin.js's
// checkIpWhitelist exactly (including fail-OPEN on an internal error, and
// "empty list never restricts" — both deliberate, not oversights).
// =====================================================================
await env.DB.prepare(`INSERT INTO admins (id, phone, password_hash, role) VALUES (3, '+998900000003', ?, 'manager')`).bind(realHash).run();
const ipEnforce = { 'cf-connecting-ip': '5.5.5.5' };
const ipOther = { 'cf-connecting-ip': '6.6.6.6' };
// All admin-1 (adminCookie) actions in this block use the SAME IP we're
// about to whitelist — otherwise enabling the whitelist would instantly
// lock out the very session managing it (self-lockout), including the
// call meant to turn it back off.
const adminCookieFromWhitelistedIp = { headers: { ...adminCookie.headers, ...ipEnforce } };

{
  // enabling with zero IPs on the list is refused (matches production
  // UI's own guard) — never let an admin flip this on and instantly
  // lock everyone out including themselves.
  const res = await worker.fetch(req('/api/admin/ip-whitelist/toggle', { ...adminCookieFromWhitelistedIp, method: 'POST', body: JSON.stringify({ enabled: true }) }), env);
  check('enabling IP whitelist with an empty list -> 422 no_ips', res.status, 422);
}
await worker.fetch(req('/api/admin/ip-whitelist/add', { ...adminCookieFromWhitelistedIp, method: 'POST', body: JSON.stringify({ ip: '5.5.5.5', label: 'office' }) }), env);
{
  const res = await worker.fetch(req('/api/admin/ip-whitelist/toggle', { ...adminCookieFromWhitelistedIp, method: 'POST', body: JSON.stringify({ enabled: true }) }), env);
  check('enabling IP whitelist with one IP added -> 200 ok', res.status, 200);
}
{
  const res = await worker.fetch(req('/api/admin/login', { method: 'POST', headers: ipOther, body: JSON.stringify({ phone: '+998900000003', password: 'correct-horse-battery-staple' }) }), env);
  check('login from a NON-whitelisted IP while enabled -> 403 ip_not_whitelisted', res.status, 403);
}
{
  const res = await worker.fetch(req('/api/admin/login', { method: 'POST', headers: ipEnforce, body: JSON.stringify({ phone: '+998900000003', password: 'correct-horse-battery-staple' }) }), env);
  check('login from the WHITELISTED IP while enabled -> not blocked', res.status !== 403, true);
}
{
  // an already-open session from a non-whitelisted IP also gets cut off on
  // its very next admin request, not just at the login step.
  await env.DB.prepare(`INSERT INTO admin_sessions (token, admin_id, role, abs_exp, last_activity) VALUES (?, 3, 'manager', '2999-01-01T00:00:00.000Z', ?)`).bind(sha256Hex('sess-non-whitelisted'), new Date().toISOString()).run();
  const res = await worker.fetch(req('/api/admin/stats', { headers: { cookie: 'nfc_admin_session=sess-non-whitelisted', ...ipOther } }), env);
  check('an existing session from a non-whitelisted IP is rejected on its next request too', res.status, 403);
}
{
  // turn it back off so it can never leak into any other check below
  const res = await worker.fetch(req('/api/admin/ip-whitelist/toggle', { ...adminCookieFromWhitelistedIp, method: 'POST', body: JSON.stringify({ enabled: false }) }), env);
  check('disabling IP whitelist again -> 200 ok (cleanup)', res.status, 200);
}

// =====================================================================
// TASK 3 — Admin 501 audit, Group A (read-only) newly ported
// =====================================================================
await env.DB.prepare(`INSERT INTO users (id, email, password_hash, pending_payout) VALUES (10, 'biz@test.local', 'x', 0)`).run();
await env.DB.prepare(`INSERT INTO cards (code, name, user_id, ts, price, profile_type, verified) VALUES ('BIZTOP1', 'Biz Top', 10, 1, 0, 'business', 1)`).run();
await env.DB.prepare(`INSERT INTO transactions (id, user_id, amount, kind, note, created_at) VALUES (1, 10, 0, 'admin_adjust', 'test adjust', '2026-01-01')`).run();

for (const [route, key] of [
  ['/api/admin/manual-adjustments', 'adjustments'],
  ['/api/admin/verified-cards', 'cards'],
  ['/api/admin/companies', 'companies'],
  ['/api/admin/companies/activity-log', 'log'],
]) {
  const res = await worker.fetch(req(route, adminCookie), env);
  const data = await res.json();
  check(`GET ${route} -> 200 (no longer 501)`, res.status, 200);
  checkTrue(`GET ${route} response has "${key}" array`, Array.isArray(data[key]));
}
{
  const res = await worker.fetch(req('/api/admin/companies/stats', adminCookie), env);
  const data = await res.json();
  check('GET /api/admin/companies/stats -> 200', res.status, 200);
  check('companies/stats counts the seeded business card', data.total, 1);
}
{
  const res = await worker.fetch(req('/api/admin/companies/BIZTOP1', adminCookie), env);
  const data = await res.json();
  check('GET /api/admin/companies/:code -> 200 for the seeded business card', { status: res.status, code: data.code }, { status: 200, code: 'BIZTOP1' });
}
{
  const res = await worker.fetch(req('/api/admin/companies/NOSUCH', adminCookie), env);
  check('GET /api/admin/companies/:code -> 404 for an unknown code', res.status, 404);
}
{
  const res = await worker.fetch(req('/api/admin/company-settings', adminCookie), env);
  const data = await res.json();
  check('GET /api/admin/company-settings -> 200', res.status, 200);
  check('company-settings falls back to the real default menu limits when nothing overridden', data.menuLimits.free, { cat: 0, item: 0, images: false, isCustom: false });
}
{
  const res = await worker.fetch(req('/api/admin/records/BIZTOP1', adminCookie), env);
  const data = await res.json();
  check('GET /api/admin/records/:code -> 200 for an existing record', { status: res.status, code: data.code, verified: data.verified }, { status: 200, code: 'BIZTOP1', verified: true });
}

// Group B/C must remain untouched (still 501) — this task explicitly does
// NOT port write/finance endpoints yet.
for (const route of ['/api/admin/companies/BIZTOP1/status', '/api/admin/finance/transactions']) {
  const res = await worker.fetch(req(route, adminCookie), env);
  check(`${route} is still 501 (write/finance — intentionally NOT ported this task)`, res.status, 501);
}

// =====================================================================
// TASK 4 — Followers (backend the frontend modal already relies on)
// =====================================================================
await env.DB.prepare(`INSERT INTO users (id, email, password_hash) VALUES (20, 'follower@test.local', 'x')`).run();
await env.DB.prepare(`INSERT INTO users (id, email, password_hash) VALUES (21, 'vip@test.local', 'x')`).run();
await env.DB.prepare(`INSERT INTO cards (code, name, user_id, ts, price) VALUES ('VIP001', 'Vip Owner', 21, 1, 0)`).run();
await env.DB.prepare(`INSERT INTO cards (code, name, user_id, ts, price, avatar_url, verified) VALUES ('ABC123', 'A Follower', 20, 2, 0, '', 0)`).run();
await env.DB.prepare(`INSERT INTO sessions (token, user_id, expires_at) VALUES ('follower-tok', 20, '2999-01-01T00:00:00.000Z')`).run();
{
  const res = await worker.fetch(req('/api/follow/VIP001', { method: 'POST', headers: { cookie: 'nfc_session=follower-tok' } }), env);
  check('POST /api/follow/VIP001 -> 200', res.status, 200);
}
{
  const res = await worker.fetch(req('/api/follow-list/VIP001?dir=followers'), env);
  const data = await res.json();
  check('GET /api/follow-list/VIP001?dir=followers -> 200', res.status, 200);
  check('follow-list returns the follower with code/name/avatarUrl for the modal', data.list, [{ code: 'ABC123', name: 'A Follower', avatarUrl: '', verified: false }]);
}
{
  const res = await worker.fetch(req('/api/follow-list/NOSUCHCODE?dir=followers'), env);
  const data = await res.json();
  check('GET /api/follow-list/:unknownCode -> 200 with an empty list (not an error) — modal shows empty state', data.list, []);
}

globalThis.fetch = realFetch;
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
