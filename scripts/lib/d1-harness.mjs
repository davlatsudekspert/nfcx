// Umumiy test harness: haqiqiy hosting/worker.js ni in-memory SQLite (node:sqlite,
// D1 API mos shim) + in-memory R2 mock bilan ishga tushiradi. Production D1/R2 ga
// HECH QACHON tegmaydi. Schema: db/d1-migration/0001-schema.sql (haqiqiy).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { ensureCoreSchema } from '../../hosting/worker.js';

export const sha256Hex = (text) => createHash('sha256').update(text).digest('hex');
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function makeEnv(extraEnv = {}) {
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
  const store = new Map();
  const UPLOADS = {
    // R2 `put` FAQAT uzunligi ma'lum qiymatni qabul qiladi.
    //
    // Mock avval istalgan `ReadableStream` ni yutardi va shuning uchun
    // test production'da ishlamaydigan kodni "yashil" deb ko'rsatdi
    // (qo'lda qurilgan oqimni R2 rad etadi). Endi mock ham xuddi
    // R2 kabi rad etadi — katta fayl uchun multipart yo'li majburiy.
    async put(key, bytes, opts = {}) {
      if (bytes && typeof bytes.getReader === 'function') {
        throw new Error('R2 put: ReadableStream uzunligi noma\u2019lum — multipart ishlating');
      }
      const buf = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
      store.set(key, { bytes: buf, httpMetadata: opts.httpMetadata || {}, customMetadata: opts.customMetadata || {}, httpEtag: `"${buf.length}-${key}"` });
      return { key };
    },
    // Multipart — bo'laklar tartib raqami bo'yicha yig'iladi.
    async createMultipartUpload(key, opts = {}) {
      const collected = new Map();
      let done = false;
      return {
        key,
        async uploadPart(n, body) {
          if (done) throw new Error('multipart tugagan');
          collected.set(n, body instanceof Uint8Array ? body : new Uint8Array(body));
          return { partNumber: n, etag: `p${n}` };
        },
        async complete(parts) {
          done = true;
          const ordered = parts.map((p) => collected.get(p.partNumber));
          if (ordered.some((x) => !x)) throw new Error('bo\u2018lak yetishmaydi');
          const total = ordered.reduce((n, p) => n + p.length, 0);
          const buf = new Uint8Array(total);
          let off = 0;
          for (const p of ordered) { buf.set(p, off); off += p.length; }
          store.set(key, { bytes: buf, httpMetadata: opts.httpMetadata || {}, customMetadata: opts.customMetadata || {}, httpEtag: `"${buf.length}-${key}"` });
          return { key };
        },
        async abort() { done = true; collected.clear(); },
      };
    },
    async head(key) { const o = store.get(key); if (!o) return null; return { size: o.bytes.length, httpEtag: o.httpEtag, writeHttpMetadata(h) { if (o.httpMetadata.contentType) h.set('content-type', o.httpMetadata.contentType); } }; },
    async get(key, options = {}) { const o = store.get(key); if (!o) return null; let bytes = o.bytes; if (options.range) bytes = bytes.slice(options.range.offset, options.range.offset + options.range.length); return { body: bytes, httpEtag: o.httpEtag, writeHttpMetadata(h) { if (o.httpMetadata.contentType) h.set('content-type', o.httpMetadata.contentType); } }; },
    async delete(key) { store.delete(key); },
    _store: store,
  };
  const env = {
    DB: { prepare: (sql) => makeStmt(sql), async batch(stmts) { const out = []; for (const s of stmts) out.push(await s.run()); return out; }, exec: (sql) => sqlite.exec(sql) },
    UPLOADS,
    ASSETS: { fetch: async () => new Response('not found', { status: 404 }) },
    ...extraEnv,
  };
  sqlite.exec(readFileSync(path.join(__dirname, '../../db/d1-migration/0001-schema.sql'), 'utf8'));
  return { env, sqlite };
}

// Standart fixture: user#1 (cookie 'user-token'), super_admin sessiyasi (cookie 'admin-token'), VIP001 kartasi user#1 niki
export async function seedBasic(env) {
  await ensureCoreSchema(env); // worker runtime jadvallari (admin_sessions, rate_limits, ...)
  await env.DB.prepare(`INSERT INTO users (id, email, password_hash, phone) VALUES (1, 'user@test.local', 'x', '+998901111111')`).run();
  await env.DB.prepare(`INSERT INTO users (id, email, password_hash, phone) VALUES (2, 'other@test.local', 'x', '+998902222222')`).run();
  await env.DB.prepare(`INSERT INTO sessions (token, user_id, expires_at) VALUES ('user-token', 1, '2999-01-01T00:00:00.000Z')`).run();
  await env.DB.prepare(`INSERT INTO sessions (token, user_id, expires_at) VALUES ('other-token', 2, '2999-01-01T00:00:00.000Z')`).run();
  await env.DB.prepare(`INSERT INTO admins (id, phone, password_hash, role, totp_enabled) VALUES (1, '+998900000000', 'x', 'super_admin', 0)`).run().catch(() => {});
  await env.DB.prepare(`INSERT INTO admin_sessions (token, admin_id, role, abs_exp, last_activity) VALUES (?, 1, 'super_admin', '2999-01-01T00:00:00.000Z', ?)`).bind(sha256Hex('admin-token'), new Date().toISOString()).run();
  await env.DB.prepare(`INSERT INTO admin_sessions (token, admin_id, role, abs_exp, last_activity) VALUES (?, 2, 'manager', '2999-01-01T00:00:00.000Z', ?)`).bind(sha256Hex('manager-token'), new Date().toISOString()).run();
  await env.DB.prepare(`INSERT INTO cards (code, name, price, ts, user_id, profile_type) VALUES ('VIP001', 'Muhammad', 199000, 1000, 1, 'personal')`).run();
  await env.DB.prepare(`INSERT INTO cards (code, name, price, ts, user_id, profile_type) VALUES ('BIZ777', 'Elite Qurilish', 199000, 1000, 1, 'business')`).run();
  await env.DB.prepare(`INSERT INTO cards (code, name, price, ts, user_id, profile_type) VALUES ('OTH222', 'Boshqa', 49000, 1000, 2, 'personal')`).run();
}

export const cookie = { user: 'nfc_session=user-token', other: 'nfc_session=other-token', admin: 'nfc_admin_session=admin-token', manager: 'nfc_admin_session=manager-token' };

export function req(pathname, init = {}) {
  const headers = new Headers(init.headers || {});
  if (init.json !== undefined) { headers.set('content-type', 'application/json'); init = { ...init, body: JSON.stringify(init.json) }; }
  if (init.cookie) headers.set('cookie', init.cookie);
  headers.set('cf-connecting-ip', init.ip || '203.0.113.5');
  return new Request(`https://nfcstore.uz${pathname}`, { ...init, headers });
}

export function makeChecker() {
  let pass = 0, fail = 0;
  function check(label, actual, expected) {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    console.log(ok ? 'PASS' : 'FAIL', '-', label, ok ? '' : `\n    actual:   ${JSON.stringify(actual)}\n    expected: ${JSON.stringify(expected)}`);
    ok ? pass++ : fail++;
  }
  const checkTrue = (label, actual) => check(label, !!actual, true);
  const done = () => { console.log(`\n${pass} passed, ${fail} failed`); if (fail) process.exit(1); };
  return { check, checkTrue, done };
}
