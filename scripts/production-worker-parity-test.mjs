// Production-drift integration — production-parity test.
//
// Runs the ACTUAL hosting/worker.js default export (worker.fetch) against
// an in-memory, D1-API-compatible SQLite database (Node's built-in
// `node:sqlite`) loaded from the REAL db/d1-migration/0001-schema.sql, plus
// an in-memory R2 mock standing in for env.UPLOADS. Never touches
// production D1/R2 — everything here is local and throwaway.
//
//   node scripts/production-worker-parity-test.mjs
//
// Covers the production-drift integration checklist: R2 upload auth/GET/
// HEAD/ETag-304/Range-206/invalid-Range-416/missing-404, Followers routes,
// account/gift-cluster routes, admin manual-only routes, companies/search,
// news/categories/tap, the Payme callback route, that GET /api/orders has
// exactly one implementation, and that /uploads/* no longer falls through
// to the dead legacy self-proxy.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import worker, { ensureCoreSchema } from '../hosting/worker.js';

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

// ---------- minimal D1-compatible shim over node:sqlite (same pattern as
// scripts/payme-order-flow-test.mjs) ----------
const sqlite = new DatabaseSync(':memory:');
function makeStmt(sql) {
  return {
    _sql: sql, _args: [],
    bind(...args) { this._args = args; return this; },
    async first() {
      const row = sqlite.prepare(this._sql).get(...this._args);
      return row === undefined ? null : row;
    },
    async all() {
      const results = sqlite.prepare(this._sql).all(...this._args);
      return { results };
    },
    async run() {
      const info = sqlite.prepare(this._sql).run(...this._args);
      return { success: true, meta: { changes: info.changes, last_row_id: info.lastInsertRowid } };
    },
  };
}

// ---------- minimal in-memory R2 mock standing in for env.UPLOADS ----------
function makeR2Bucket() {
  const store = new Map();
  return {
    async put(key, bytes, opts = {}) {
      const buf = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
      store.set(key, {
        bytes: buf,
        httpMetadata: opts.httpMetadata || {},
        customMetadata: opts.customMetadata || {},
        httpEtag: `"${buf.length}-${key}"`,
      });
      return { key };
    },
    async head(key) {
      const obj = store.get(key);
      if (!obj) return null;
      return {
        size: obj.bytes.length,
        httpEtag: obj.httpEtag,
        writeHttpMetadata(headers) {
          if (obj.httpMetadata.contentType) headers.set('content-type', obj.httpMetadata.contentType);
          if (obj.httpMetadata.cacheControl) headers.set('cache-control', obj.httpMetadata.cacheControl);
        },
      };
    },
    async get(key, options = {}) {
      const obj = store.get(key);
      if (!obj) return null;
      let bytes = obj.bytes;
      if (options.range) bytes = bytes.slice(options.range.offset, options.range.offset + options.range.length);
      return {
        body: bytes,
        httpEtag: obj.httpEtag,
        writeHttpMetadata(headers) {
          if (obj.httpMetadata.contentType) headers.set('content-type', obj.httpMetadata.contentType);
          if (obj.httpMetadata.cacheControl) headers.set('cache-control', obj.httpMetadata.cacheControl);
        },
      };
    },
  };
}

const env = {
  DB: {
    prepare: (sql) => makeStmt(sql),
    async batch(stmts) {
      const out = [];
      for (const s of stmts) out.push(await s.run());
      return out;
    },
    exec: (sql) => sqlite.exec(sql),
  },
  UPLOADS: makeR2Bucket(),
  // env.ASSETS.fetch is only reached for a GET that nothing else claimed —
  // none of the checks below should fall through this far, but it must
  // exist so a genuinely-missed route fails loudly as a 404 rather than
  // throwing "env.ASSETS is undefined".
  ASSETS: { fetch: async () => new Response('not found', { status: 404 }) },
  // Payme stays OFF for this parity run (PAYMENTS_ENABLED must remain
  // false in production drift integration) — the check below only proves
  // the /api/pay/payme route exists and responds with the JSON-RPC
  // "disabled" shape, not that a real payment could go through.
};

// Real production schema (db/d1-migration/0001-schema.sql) — the same
// tables production D1 actually has (users, sessions, admins,
// admin_sessions, cards, physical_cards, news, categories,
// admin_ip_whitelist, admin_settings, support_messages, ...).
sqlite.exec(readFileSync(path.join(__dirname, '../db/d1-migration/0001-schema.sql'), 'utf8'));
await ensureCoreSchema(env);

// ---------- test fixtures: one signed-in user, one super_admin session ----------
await env.DB.prepare(`INSERT INTO users (id, email, password_hash) VALUES (1, 'user@test.local', 'x')`).run();
await env.DB.prepare(`INSERT INTO sessions (token, user_id, expires_at) VALUES ('user-token', 1, '2999-01-01T00:00:00.000Z')`).run();
await env.DB.prepare(`INSERT INTO admin_sessions (token, admin_id, role, abs_exp, last_activity) VALUES (?, 1, 'super_admin', '2999-01-01T00:00:00.000Z', ?)`).bind(sha256Hex('admin-token'), new Date().toISOString()).run();

function req(pathname, init = {}) {
  return new Request(`https://nfcstore.uz${pathname}`, init);
}
function withUserCookie(init = {}) {
  return { ...init, headers: { ...(init.headers || {}), cookie: 'nfc_session=user-token' } };
}
function withAdminCookie(init = {}) {
  return { ...init, headers: { ...(init.headers || {}), cookie: 'nfc_admin_session=admin-token' } };
}

// =====================================================================
// R2 uploads
// =====================================================================

// auth: no session -> 401, not a fall-through to the dead legacy proxy.
{
  const res = await worker.fetch(req('/api/upload', { method: 'POST', body: '{}' }), env);
  check('POST /api/upload with no session -> 401 unauthorized', res.status, 401);
}
{
  const body = JSON.stringify({});
  const res = await worker.fetch(req('/api/admin/upload', { method: 'POST', body }), env);
  check('POST /api/admin/upload with no admin session -> 401 unauthorized', res.status, 401);
}

// A real 1x1 PNG data URL, small enough to pass the 700KB image limit.
const PNG_1PX_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
let uploadedUrl = '';
{
  const body = JSON.stringify({ dataUrl: `data:image/png;base64,${PNG_1PX_B64}` });
  const res = await worker.fetch(req('/api/upload', withUserCookie({ method: 'POST', body })), env);
  const data = await res.json();
  check('POST /api/upload (signed-in, valid PNG) -> 200', res.status, 200);
  checkTrue('POST /api/upload returns a /uploads/ URL', typeof data.url === 'string' && data.url.startsWith('/uploads/'));
  uploadedUrl = data.url || '';
}

// GET the object back through the real R2-read route.
let etag = '';
if (uploadedUrl) {
  const res = await worker.fetch(req(uploadedUrl), env);
  const bytes = new Uint8Array(await res.arrayBuffer());
  check('GET /uploads/<key> -> 200', res.status, 200);
  check('GET /uploads/<key> content-type', res.headers.get('content-type'), 'image/png');
  check('GET /uploads/<key> cache-control', res.headers.get('cache-control'), 'public, max-age=31536000, immutable');
  check('GET /uploads/<key> body byte length matches upload', bytes.length, Buffer.from(PNG_1PX_B64, 'base64').length);
  etag = res.headers.get('etag') || '';
  checkTrue('GET /uploads/<key> sets an etag', !!etag);
}

// HEAD
if (uploadedUrl) {
  const res = await worker.fetch(req(uploadedUrl, { method: 'HEAD' }), env);
  check('HEAD /uploads/<key> -> 200', res.status, 200);
  checkTrue('HEAD /uploads/<key> sets content-length', !!res.headers.get('content-length'));
}

// ETag / If-None-Match -> 304
if (uploadedUrl && etag) {
  const res = await worker.fetch(req(uploadedUrl, { headers: { 'if-none-match': etag } }), env);
  check('GET /uploads/<key> with matching If-None-Match -> 304', res.status, 304);
}

// Range -> 206
if (uploadedUrl) {
  const full = Buffer.from(PNG_1PX_B64, 'base64');
  const res = await worker.fetch(req(uploadedUrl, { headers: { range: 'bytes=0-3' } }), env);
  const bytes = new Uint8Array(await res.arrayBuffer());
  check('GET /uploads/<key> with Range: bytes=0-3 -> 206', res.status, 206);
  check('Range response content-range', res.headers.get('content-range'), `bytes 0-3/${full.length}`);
  check('Range response body length', bytes.length, 4);
}

// invalid Range -> 416
if (uploadedUrl) {
  const res = await worker.fetch(req(uploadedUrl, { headers: { range: 'bytes=99999-999999' } }), env);
  check('GET /uploads/<key> with out-of-bounds Range -> 416', res.status, 416);
}

// missing file -> 404
{
  const res = await worker.fetch(req('/uploads/does-not-exist.png'), env);
  check('GET /uploads/<missing> -> 404', res.status, 404);
}

// path traversal -> 400, never reaches R2
{
  const res = await worker.fetch(req('/uploads/../secrets.txt'), env);
  check('GET /uploads/..%2Fsecrets.txt path traversal -> not 200', res.status !== 200, true);
}

// =====================================================================
// Structural invariants (source-level, not just behavioral)
// =====================================================================
const source = readFileSync(path.join(__dirname, '../hosting/worker.js'), 'utf8');
{
  const ordersHandlerCount = (source.match(/path === '\/api\/orders' && request\.method === 'GET'/g) || []).length;
  check('GET /api/orders has exactly one implementation in the source', ordersHandlerCount, 1);
}
{
  const legacyFallbackSection = source.slice(source.indexOf('LEGACY FALLBACK'));
  const legacyFallbackCondition = legacyFallbackSection.slice(0, legacyFallbackSection.indexOf('{') + 1);
  checkTrue("legacy fallback no longer self-proxies '/uploads/'", !legacyFallbackCondition.includes("startsWith('/uploads/')"));
}

// =====================================================================
// Followers
// =====================================================================
await env.DB.prepare(`INSERT INTO cards (code, name, user_id, ts, price) VALUES ('FOLLOWME', 'Followed User', 1, 0, 0)`).run();
await env.DB.prepare(`INSERT INTO users (id, email, password_hash) VALUES (2, 'other@test.local', 'x')`).run();
await env.DB.prepare(`INSERT INTO sessions (token, user_id, expires_at) VALUES ('user2-token', 2, '2999-01-01T00:00:00.000Z')`).run();
{
  const res = await worker.fetch(req('/api/follow/FOLLOWME', { method: 'POST', headers: { cookie: 'nfc_session=user2-token' } }), env);
  check('POST /api/follow/:code (Followers route reachable) -> 200', res.status, 200);
}
{
  const res = await worker.fetch(req('/api/follow-stats/FOLLOWME'), env);
  const data = await res.json();
  check('GET /api/follow-stats/:code reflects the new follow', data.followers, 1);
}

// =====================================================================
// Account/gift cluster (b1e3f34)
// =====================================================================
{
  const res = await worker.fetch(req('/api/conversations/unread-count', withUserCookie()), env);
  check('GET /api/conversations/unread-count (account cluster route reachable) -> 200', res.status, 200);
}
{
  const res = await worker.fetch(req('/api/gift-offers', withUserCookie()), env);
  check('GET /api/gift-offers (account cluster route reachable) -> 200', res.status, 200);
}
{
  const res = await worker.fetch(req('/api/referrals', withUserCookie()), env);
  check('GET /api/referrals (account cluster route reachable) -> 200', res.status, 200);
}
{
  const res = await worker.fetch(req('/api/auctions/won/pending', withUserCookie()), env);
  check('GET /api/auctions/won/pending (account cluster route reachable) -> 200', res.status, 200);
}

// =====================================================================
// Admin manual-only routes
// =====================================================================
{
  const res = await worker.fetch(req('/api/admin/ip-whitelist', withAdminCookie()), env);
  check('GET /api/admin/ip-whitelist (super_admin) -> 200', res.status, 200);
}
await env.DB.prepare(`INSERT INTO support_messages (id, user_id, message, status, created_at) VALUES (1, 1, 'hi', 'pending', '2026-01-01')`).run();
{
  const res = await worker.fetch(req('/api/admin/support-messages/1/reply', withAdminCookie({ method: 'POST', body: JSON.stringify({ reply: 'ok' }) })), env);
  check('POST /api/admin/support-messages/:id/reply -> 200', res.status, 200);
}
await env.DB.prepare(`INSERT INTO physical_cards (id, chip_token, active, status, created_at) VALUES (1, 'chip1', 1, 'pending', '2026-01-01')`).run();
{
  const res = await worker.fetch(req('/api/admin/physical-cards/1/status', withAdminCookie({ method: 'POST', body: JSON.stringify({ status: 'shipped' }) })), env);
  check('POST /api/admin/physical-cards/:id/status -> 200', res.status, 200);
}
{
  const res = await worker.fetch(req('/api/admin/physical-cards/1/active', withAdminCookie({ method: 'POST', body: JSON.stringify({ active: false }) })), env);
  check('POST /api/admin/physical-cards/:id/active -> 200', res.status, 200);
}
await env.DB.prepare(`UPDATE users SET pending_payout = 5000 WHERE id = 1`).run();
{
  const res = await worker.fetch(req('/api/admin/pending-payouts/1/clear', withAdminCookie({ method: 'POST', body: JSON.stringify({ amount: 5000 }) })), env);
  check('POST /api/admin/pending-payouts/:id/clear -> 200', res.status, 200);
}
{
  const res = await worker.fetch(req('/api/admin/news', withAdminCookie({ method: 'POST', body: JSON.stringify({ title: 'Salom' }) })), env);
  check('POST /api/admin/news (create) -> 201', res.status, 201);
  const created = await res.json();
  const res2 = await worker.fetch(req(`/api/admin/news/${created.id}`, withAdminCookie({ method: 'PUT', body: JSON.stringify({ title: 'Yangilangan' }) })), env);
  check('PUT /api/admin/news/:id -> 200', res2.status, 200);
  const res3 = await worker.fetch(req(`/api/admin/news/${created.id}`, withAdminCookie({ method: 'DELETE' })), env);
  check('DELETE /api/admin/news/:id -> 200', res3.status, 200);
}

// =====================================================================
// Public manual-only content
// =====================================================================
await env.DB.prepare(`INSERT INTO cards (code, name, user_id, ts, price, profile_type, hidden_from_directory) VALUES ('BIZCODE', 'Biz Name', 1, 1, 0, 'business', 0)`).run();
{
  const res = await worker.fetch(req('/api/companies/search?q=Biz'), env);
  const data = await res.json();
  check('GET /api/companies/search finds the business card', data.results?.[0]?.code, 'BIZCODE');
}
{
  const res = await worker.fetch(req('/api/categories'), env);
  check('GET /api/categories -> 200', res.status, 200);
}
{
  const res = await worker.fetch(req('/api/news'), env);
  const data = await res.json();
  check('GET /api/news -> 200 with news[]/liked[] shape', res.status === 200 && Array.isArray(data.news) && Array.isArray(data.liked), true);
}
{
  const res = await worker.fetch(req('/api/tap/does-not-exist'), env);
  const data = await res.json();
  check('GET /api/tap/:unknownChipToken -> active:true (unlinked chip default)', data.active, true);
}

// =====================================================================
// Payme callback still present (must stay additive / disabled)
// =====================================================================
{
  const res = await worker.fetch(req('/api/pay/payme', { method: 'POST', body: JSON.stringify({ id: 1, method: 'CheckPerformTransaction' }) }), env);
  const data = await res.json();
  check('POST /api/pay/payme route exists (JSON-RPC "disabled" shape while PAYMENTS_ENABLED is unset/false)', data?.error?.code, -32601);
}

// =====================================================================
// GET /api/settings/payments-enabled — single source of truth the
// frontend now polls at runtime (src/lib/paymentsEnabled.jsx) instead of
// a build-time-hardcoded flag that had to be manually kept in sync.
// =====================================================================
{
  const res = await worker.fetch(req('/api/settings/payments-enabled'), env);
  const data = await res.json();
  check('GET /api/settings/payments-enabled -> 200, enabled:false (matches this env\'s PAYMENTS_ENABLED unset/false)', { status: res.status, enabled: data.enabled }, { status: 200, enabled: false });
}
{
  const enabledEnv = { ...env, PAYMENTS_ENABLED: 'true', PAYME_MERCHANT_ID: 'test_merchant', PAYME_KEY: 'test_key' };
  const res = await worker.fetch(req('/api/settings/payments-enabled'), enabledEnv);
  const data = await res.json();
  check('GET /api/settings/payments-enabled -> enabled:true once PAYMENTS_ENABLED + credentials are set', data.enabled, true);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
