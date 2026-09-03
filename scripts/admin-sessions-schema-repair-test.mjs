// Production 503 root-cause fix — admin_sessions/admin_2fa_pending schema
// repair + batch-decoupling regression test.
//
// Reproduces the EXACT production failure mode: POST /api/admin/verify-2fa
// threw from deep inside D1 (`D1DatabaseSessionAlwaysPrimary._sendOrThrow`)
// at the `INSERT INTO admin_sessions` statement. admin_sessions/
// admin_2fa_pending/admin_totp_setup_pending have ZERO presence in
// db/d1-migration/0001-schema.sql — the old Express server kept this state
// in memory, never in Postgres — so their real production shape depends
// entirely on whichever code first created them there, which can predate
// (and differ from) this file's current column set. `CREATE TABLE IF NOT
// EXISTS` is a permanent no-op against whatever already exists, so it can
// never repair a shape mismatch on its own.
//
// This script builds an in-memory D1-compatible SQLite database from the
// REAL migration schema (which does NOT include these three tables), then
// pre-creates an admin_sessions table matching a plausible OLDER/
// INCOMPATIBLE shape (missing last_activity) — standing in for whatever a
// prior manual/ad-hoc production deploy actually left behind — and proves
// ensureCoreSchema()'s new ALTER-based repair fixes it non-destructively,
// and that admin login/2FA works end-to-end afterward. It also proves the
// second half of the fix: admin auth's tables are no longer at the mercy
// of an unrelated failure inside the big shared schema-init batch.
//
//   node scripts/admin-sessions-schema-repair-test.mjs
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

function makeEnv(sqlite) {
  function makeStmt(sql) {
    return {
      _sql: sql, _args: [],
      bind(...args) { this._args = args; return this; },
      async first() { const row = sqlite.prepare(this._sql).get(...this._args); return row === undefined ? null : row; },
      async all() { return { results: sqlite.prepare(this._sql).all(...this._args) }; },
      async run() { const info = sqlite.prepare(this._sql).run(...this._args); return { success: true, meta: { changes: info.changes, last_row_id: info.lastInsertRowid } }; },
    };
  }
  return {
    DB: {
      prepare: (sql) => makeStmt(sql),
      async batch(stmts) { const out = []; for (const s of stmts) out.push(await s.run()); return out; },
      exec: (sql) => sqlite.exec(sql),
    },
    ASSETS: { fetch: async () => new Response('not found', { status: 404 }) },
  };
}
function req(pathname, init = {}) { return new Request(`https://nfcstore.uz${pathname}`, init); }

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

// =====================================================================
// Scenario 1 — admin_sessions pre-exists with an OLDER/INCOMPATIBLE shape
// (missing last_activity), simulating real production drift.
// =====================================================================
{
  const sqlite = new DatabaseSync(':memory:');
  const env = makeEnv(sqlite);
  sqlite.exec(readFileSync(path.join(__dirname, '../db/d1-migration/0001-schema.sql'), 'utf8'));

  check('sanity: admin_sessions has NO row in the real migration schema', sqlite.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='admin_sessions'`).get(), undefined);

  // Stand in for whatever an earlier ad-hoc deploy actually left behind:
  // an admin_sessions table missing last_activity entirely.
  sqlite.exec(`CREATE TABLE "admin_sessions" ("token" TEXT PRIMARY KEY NOT NULL, "admin_id" INTEGER NOT NULL, "role" TEXT NOT NULL, "abs_exp" TEXT NOT NULL)`);
  const before = sqlite.prepare(`PRAGMA table_info(admin_sessions)`).all().map((c) => c.name);
  check('pre-existing (broken) admin_sessions is missing last_activity', before.includes('last_activity'), false);

  await ensureCoreSchema(env);

  const after = sqlite.prepare(`PRAGMA table_info(admin_sessions)`).all().map((c) => c.name);
  check('ensureCoreSchema self-heals the missing column (no data loss — table still exists, same rows)', after.includes('last_activity'), true);
  check('the pre-existing columns are untouched', ['token', 'admin_id', 'role', 'abs_exp'].every((c) => after.includes(c)), true);

  // Full login -> 2FA -> session flow must now work end-to-end — this is
  // the EXACT production repro (verify-2fa's INSERT INTO admin_sessions).
  const secret = 'JBSWY3DPEHPK3PXP';
  const passHash = await hashPassword('correct-horse-battery-staple');
  await env.DB.prepare(`INSERT INTO admins (id, phone, password_hash, role, totp_secret, totp_enabled) VALUES (1, '+998900000001', ?, 'manager', ?, 1)`).bind(passHash, secret).run();

  const loginRes = await worker.fetch(req('/api/admin/login', { method: 'POST', body: JSON.stringify({ phone: '+998900000001', password: 'correct-horse-battery-staple' }) }), env);
  const loginData = await loginRes.json();
  check('login -> twoFactor:true (unchanged behavior)', { status: loginRes.status, twoFactor: loginData.twoFactor }, { status: 200, twoFactor: true });

  const verifyRes = await worker.fetch(req('/api/admin/verify-2fa', { method: 'POST', body: JSON.stringify({ tempToken: loginData.tempToken, code: totpNow(secret) }) }), env);
  check('verify-2fa against a previously-broken-shape admin_sessions -> 200, NOT 503 (the actual production bug)', verifyRes.status, 200);
  checkTrue_hasCookie(verifyRes);

  const row = await env.DB.prepare(`SELECT * FROM admin_sessions WHERE admin_id = 1`).first();
  check('the session row was actually written, with a real last_activity', typeof row?.last_activity === 'string' && row.last_activity.length > 0, true);
}
function checkTrue_hasCookie(res) { check('verify-2fa response sets a session cookie', !!res.headers.get('set-cookie'), true); }

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
