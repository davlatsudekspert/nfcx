// Confirms the agreed security posture: IP Whitelist stays fully
// implemented (table, CRUD endpoints, enforcement code all intact) but is
// OFF by default/whenever explicitly disabled — so office AND home admins
// can both log in, via EITHER TOTP or the opt-in Telegram fallback,
// regardless of source IP, as long as the setting isn't turned on.
//
// Runs the ACTUAL hosting/worker.js default export (worker.fetch) against
// an in-memory, D1-API-compatible SQLite database. Never touches
// production D1 or the real Telegram Bot API. All three scenarios below
// share ONE database (ensureCoreSchema()'s module-level caches — the same
// ones a real Worker isolate relies on — only run their CREATE TABLE
// statements once per process, so a second "fresh" in-memory DB later in
// the same file would silently skip them) — each scenario cleans up the
// admin_settings/admin_ip_whitelist rows it touches before the next one.
//
//   node scripts/admin-ip-whitelist-off-test.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createHmac } from 'node:crypto';
import worker, { ensureCoreSchema, hashPassword } from '../hosting/worker.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let pass = 0;
let fail = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(ok ? 'PASS' : 'FAIL', '-', label, ok ? '' : `\n    actual:   ${JSON.stringify(actual)}\n    expected: ${JSON.stringify(expected)}`);
  ok ? pass++ : fail++;
}

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
  TELEGRAM_BOT_TOKEN: 'test-token',
  ADMIN_CHAT_ID: '999',
};
sqlite.exec(readFileSync(path.join(__dirname, '../db/d1-migration/0001-schema.sql'), 'utf8'));
await ensureCoreSchema(env);

function req(pathname, init = {}) { return new Request(`https://nfcstore.uz${pathname}`, init); }

const realFetch = globalThis.fetch;
let lastTelegramCall = null;
globalThis.fetch = async (url, init) => {
  const href = typeof url === 'string' ? url : url.url;
  if (href.startsWith('https://api.telegram.org/')) {
    lastTelegramCall = { body: init?.body ? JSON.parse(init.body) : null };
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

async function totpLogin(phone, secret, ipHeader) {
  const loginRes = await worker.fetch(req('/api/admin/login', { method: 'POST', headers: ipHeader, body: JSON.stringify({ phone, password: 'correct-horse-battery-staple' }) }), env);
  const loginData = await loginRes.json();
  if (loginRes.status !== 200) return { loginStatus: loginRes.status };
  const verifyRes = await worker.fetch(req('/api/admin/verify-2fa', { method: 'POST', headers: ipHeader, body: JSON.stringify({ tempToken: loginData.tempToken, code: totpNow(secret) }) }), env);
  return { loginStatus: loginRes.status, verifyStatus: verifyRes.status, hasCookie: !!verifyRes.headers.get('set-cookie') };
}
async function telegramLogin(phone, ipHeader) {
  const loginRes = await worker.fetch(req('/api/admin/login', { method: 'POST', headers: ipHeader, body: JSON.stringify({ phone, password: 'correct-horse-battery-staple' }) }), env);
  const loginData = await loginRes.json();
  if (loginRes.status !== 200) return { loginStatus: loginRes.status };
  const sendRes = await worker.fetch(req('/api/admin/2fa/telegram/send', { method: 'POST', headers: ipHeader, body: JSON.stringify({ tempToken: loginData.tempToken }) }), env);
  if (sendRes.status !== 200) return { loginStatus: loginRes.status, sendStatus: sendRes.status };
  const code = lastTelegramCall.body.text.match(/(\d{6})/)[1];
  const verifyRes = await worker.fetch(req('/api/admin/verify-2fa', { method: 'POST', headers: ipHeader, body: JSON.stringify({ tempToken: loginData.tempToken, code }) }), env);
  return { loginStatus: loginRes.status, sendStatus: sendRes.status, verifyStatus: verifyRes.status, hasCookie: !!verifyRes.headers.get('set-cookie') };
}

// A fresh, never-reused fake IP per call — sidesteps the shared (IP-keyed,
// module-level, 3-per-30-min) login rate limiter entirely, since that's
// orthogonal to what this file is testing.
let ipCounter = 0;
const nextIp = (prefix) => ({ 'cf-connecting-ip': `${prefix}.${10 + (ipCounter++)}` });

const passHash = await hashPassword('correct-horse-battery-staple');
const secretOffice = 'JBSWY3DPEHPK3PXP';
const secretHome = 'MFRGGZDFMZTWQ2LK';

// =====================================================================
// Scenario A — fresh install, no admin_settings row for
// ip_whitelist_enabled at all (the true out-of-the-box default).
// =====================================================================
{
  await sqlite.prepare(`INSERT INTO admins (id, phone, password_hash, role, totp_secret, totp_enabled) VALUES (1, '+998900000101', ?, 'manager', ?, 1)`).run(passHash, secretOffice);
  await sqlite.prepare(`INSERT INTO admins (id, phone, password_hash, role, totp_secret, totp_enabled) VALUES (2, '+998900000102', ?, 'manager', ?, 1)`).run(passHash, secretHome);

  const row = await sqlite.prepare(`SELECT value FROM admin_settings WHERE key = 'ip_whitelist_enabled'`).get();
  check('sanity: no ip_whitelist_enabled row exists yet (true default state)', row, undefined);

  const office = await totpLogin('+998900000101', secretOffice, nextIp('10.10.10'));
  check('[default, no setting row] office IP + TOTP -> PASS', { verifyStatus: office.verifyStatus, hasCookie: office.hasCookie }, { verifyStatus: 200, hasCookie: true });

  const home = await totpLogin('+998900000102', secretHome, nextIp('95.130.11'));
  check('[default, no setting row] home IP + TOTP -> PASS', { verifyStatus: home.verifyStatus, hasCookie: home.hasCookie }, { verifyStatus: 200, hasCookie: true });
}

// =====================================================================
// Scenario B — the feature is fully wired (an IP is on the list, e.g.
// the office one from earlier use) but the enforcement setting is
// explicitly OFF ('false'). This is the agreed steady state: data/
// feature preserved, enforcement disabled.
// =====================================================================
{
  await sqlite.prepare(`INSERT INTO admins (id, phone, password_hash, role, totp_secret, totp_enabled) VALUES (3, '+998900000103', ?, 'manager', ?, 1)`).run(passHash, secretOffice);
  await sqlite.prepare(`INSERT INTO admins (id, phone, password_hash, role, totp_secret, totp_enabled) VALUES (4, '+998900000104', ?, 'manager', ?, 1)`).run(passHash, secretHome);
  await sqlite.prepare(`INSERT INTO admin_ip_whitelist (ip, label, created_at) VALUES ('192.168.1.50', 'Ofis', datetime('now'))`).run();
  await sqlite.prepare(`INSERT INTO admin_settings (key, value) VALUES ('ip_whitelist_enabled', 'false')`).run();

  const savedList = await sqlite.prepare(`SELECT ip, label FROM admin_ip_whitelist`).all();
  check('the office IP entry is still there — the LIST/feature is preserved, not deleted', savedList, [{ ip: '192.168.1.50', label: 'Ofis' }]);

  const officeTotp = await totpLogin('+998900000103', secretOffice, { 'cf-connecting-ip': '192.168.1.50' });
  check('[explicit OFF] office IP (on the list) + TOTP -> PASS', { verifyStatus: officeTotp.verifyStatus, hasCookie: officeTotp.hasCookie }, { verifyStatus: 200, hasCookie: true });

  const homeTotp = await totpLogin('+998900000104', secretHome, nextIp('95.130.11'));
  check('[explicit OFF] home IP (NOT on the list) + TOTP -> still PASS', { verifyStatus: homeTotp.verifyStatus, hasCookie: homeTotp.hasCookie }, { verifyStatus: 200, hasCookie: true });

  const homeTelegram = await telegramLogin('+998900000104', nextIp('95.130.11'));
  check('[explicit OFF] home IP (NOT on the list) + Telegram fallback -> PASS', { sendStatus: homeTelegram.sendStatus, verifyStatus: homeTelegram.verifyStatus, hasCookie: homeTelegram.hasCookie }, { sendStatus: 200, verifyStatus: 200, hasCookie: true });

  const officeTelegram = await telegramLogin('+998900000103', nextIp('10.10.10'));
  check('[explicit OFF] office IP + Telegram fallback -> PASS', { sendStatus: officeTelegram.sendStatus, verifyStatus: officeTelegram.verifyStatus, hasCookie: officeTelegram.hasCookie }, { sendStatus: 200, verifyStatus: 200, hasCookie: true });

  // Cleanup so the next scenario starts from a clean whitelist state.
  await sqlite.prepare(`DELETE FROM admin_settings WHERE key = 'ip_whitelist_enabled'`).run();
  await sqlite.prepare(`DELETE FROM admin_ip_whitelist`).run();
}

// =====================================================================
// Scenario C — sanity control: same setup as B, but enforcement is ON.
// Proves Scenario B passes BECAUSE it's off, not because the code is inert.
// =====================================================================
{
  await sqlite.prepare(`INSERT INTO admins (id, phone, password_hash, role, totp_secret, totp_enabled) VALUES (5, '+998900000105', ?, 'manager', ?, 1)`).run(passHash, secretOffice);
  await sqlite.prepare(`INSERT INTO admin_ip_whitelist (ip, label, created_at) VALUES ('172.16.0.9', 'Ofis', datetime('now'))`).run();
  await sqlite.prepare(`INSERT INTO admin_settings (key, value) VALUES ('ip_whitelist_enabled', 'true')`).run();

  const office = await totpLogin('+998900000105', secretOffice, { 'cf-connecting-ip': '172.16.0.9' });
  check('[control: ON] office IP (on the list) + TOTP -> still PASS', office.verifyStatus, 200);

  const loginRes = await worker.fetch(req('/api/admin/login', { method: 'POST', headers: nextIp('95.130.11'), body: JSON.stringify({ phone: '+998900000105', password: 'correct-horse-battery-staple' }) }), env);
  check('[control: ON] home IP (NOT on the list) is correctly BLOCKED — proves the feature is real, not dead code', loginRes.status, 403);

  await sqlite.prepare(`DELETE FROM admin_settings WHERE key = 'ip_whitelist_enabled'`).run();
  await sqlite.prepare(`DELETE FROM admin_ip_whitelist`).run();
}

globalThis.fetch = realFetch;
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
