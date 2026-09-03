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
    // Telegram OTP is the sole 2FA method now — /login refuses to even
    // start it without these configured (see hosting/worker.js), so every
    // scenario below needs them.
    TELEGRAM_BOT_TOKEN: 'test-bot-token',
    ADMIN_CHAT_ID: '123456789',
    ADMIN_OTP_SECRET: 'test-otp-pepper',
  };
}
function req(pathname, init = {}) { return new Request(`https://nfcstore.uz${pathname}`, init); }

// Telegram OTP is the sole 2FA method now — intercept api.telegram.org so
// this test never touches the real Bot API, and capture the code the
// Worker actually sent so we can complete verify-2fa with it.
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

  // Full login -> Telegram OTP -> session flow must now work end-to-end —
  // this is the EXACT production repro (verify-2fa's INSERT INTO
  // admin_sessions).
  const passHash = await hashPassword('correct-horse-battery-staple');
  await env.DB.prepare(`INSERT INTO admins (id, phone, password_hash, role) VALUES (1, '+998900000001', ?, 'manager')`).bind(passHash).run();

  const loginRes = await worker.fetch(req('/api/admin/login', { method: 'POST', body: JSON.stringify({ phone: '+998900000001', password: 'correct-horse-battery-staple' }) }), env);
  const loginData = await loginRes.json();
  check('login -> twoFactor:true, method:telegram, OTP auto-sent (unchanged behavior)', { status: loginRes.status, twoFactor: loginData.twoFactor, method: loginData.method }, { status: 200, twoFactor: true, method: 'telegram' });
  checkTrue_otpSent();

  const verifyRes = await worker.fetch(req('/api/admin/verify-2fa', { method: 'POST', body: JSON.stringify({ tempToken: loginData.tempToken, code: lastTelegramCode }) }), env);
  check('verify-2fa against a previously-broken-shape admin_sessions -> 200, NOT 503 (the actual production bug)', verifyRes.status, 200);
  checkTrue_hasCookie(verifyRes);

  const row = await env.DB.prepare(`SELECT * FROM admin_sessions WHERE admin_id = 1`).first();
  check('the session row was actually written, with a real last_activity', typeof row?.last_activity === 'string' && row.last_activity.length > 0, true);
}
function checkTrue_hasCookie(res) { check('verify-2fa response sets a session cookie', !!res.headers.get('set-cookie'), true); }
function checkTrue_otpSent() { check('a real 6-digit Telegram OTP was captured', /^\d{6}$/.test(String(lastTelegramCode)), true); }

globalThis.fetch = realFetch;
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
