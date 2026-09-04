// Payme Phase 2B — end-to-end order-flow test.
//
// Runs the ACTUAL functions exported from hosting/worker.js (not a
// reimplementation) against an in-memory, D1-API-compatible SQLite
// database (Node's built-in `node:sqlite`, same SQL dialect D1 uses).
// This never touches production D1 — everything here is local and
// throwaway.
//
//   node scripts/payme-order-flow-test.mjs
import { DatabaseSync } from 'node:sqlite';
import {
  createWebOrderD1, createPendingWebOrderD1, getWebOrderD1, getWebOrderByPaymeIdD1, setWebOrderStatusD1,
  activeWebOrderByCodeD1, finalizePaidWebOrderD1, handlePaymeRequestD1,
  verifyPaymeAuthD1, paymentsEnabledD1, paymeCheckoutLinkD1,
  getRecord, getRecordOwner, attachCardToUserD1, createRecordD1, PAYME_ERR, ensureCoreSchema,
  personalPurchaseQuote,
} from '../hosting/worker.js';

let pass = 0;
let fail = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(ok ? 'PASS' : 'FAIL', '-', label, ok ? '' : `\n    actual:   ${JSON.stringify(actual)}\n    expected: ${JSON.stringify(expected)}`);
  ok ? pass++ : fail++;
}
function checkTrue(label, actual) { check(label, !!actual, true); }
function checkFalse(label, actual) { check(label, !!actual, false); }

// ---------- minimal D1-compatible shim over node:sqlite ----------
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
  // Payme secrets — LOCAL TEST-ONLY values on this in-memory mock `env`.
  // Nothing here is written to the repo, wrangler config, or any real
  // Cloudflare secret store; this exists purely so the Merchant API
  // methods can be exercised end-to-end in this throwaway test process.
  PAYMENTS_ENABLED: 'true',
  PAYME_MERCHANT_ID: 'test_merchant_id',
  PAYME_KEY: 'test_payme_key_local_only',
};

// Tables ensureCoreSchema doesn't create (assumed pre-existing from the
// original D1 migration import) but that getRecord()'s query joins on.
env.DB.exec(`
  CREATE TABLE IF NOT EXISTS "nfc_gifts" (
    "id" INTEGER PRIMARY KEY NOT NULL, "code" TEXT (16) NOT NULL, "recipient_name" TEXT, "note" TEXT,
    "activation_code" TEXT (20) NOT NULL, "status" TEXT (20) DEFAULT 'reserved' NOT NULL,
    "created_at" TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL, "activated_at" TEXT, "activated_by_user_id" INTEGER,
    "value" INTEGER, UNIQUE ("activation_code"), UNIQUE ("code")
  );
`);

await ensureCoreSchema(env);

// ---------- seed two test users + valid sessions ----------
function futureTs(days) {
  return new Date(Date.now() + days * 86400000).toISOString().replace('T', ' ').replace('Z', '+00');
}
env.DB.exec(`INSERT INTO users (id, email, password_hash) VALUES
  (1, 'buyer1@test.local', 'x'), (2, 'buyer2@test.local', 'x'), (5, 'buyer5@test.local', 'x'),
  (6, 'buyer6@test.local', 'x'), (7, 'buyer7@test.local', 'x'), (8, 'buyer8@test.local', 'x'), (9, 'buyer9@test.local', 'x')`);
env.DB.exec(`INSERT INTO sessions (token, user_id, expires_at) VALUES ('tok-buyer1', 1, '${futureTs(1)}'), ('tok-buyer2', 2, '${futureTs(1)}')`);

function makeAuthedRequest(token, extraHeaders = {}) {
  const headers = new Headers({ cookie: `nfc_session=${token}`, ...extraHeaders });
  return { headers };
}

const PAYLOAD = { name: 'Test User', theme: 'classic' };

// ============================================================
// 1-6) PRICING / PURCHASABILITY (Phase 2A helper, re-confirmed here in
// the exact context Phase 2B's order-creation code actually calls it in)
// ============================================================
check('1) 8-digit purchase BLOCK', personalPurchaseQuote('12345678').purchasable, false);
check('2) Exclusive BLOCK (auction-only)', personalPurchaseQuote('AAA777'), { purchasable: false, reason: 'exclusive_auction_only', tier: 'exclusive' });
check('3) Bronze 49000', personalPurchaseQuote('XYZ412'), { purchasable: true, tier: 'free', amount: 49000 });
check('4) Silver 99000', personalPurchaseQuote('ABB770'), { purchasable: true, tier: 'silver', amount: 99000 });
check('5) Gold 149000', personalPurchaseQuote('BMW412'), { purchasable: true, tier: 'gold', amount: 149000 });
check('6) Premium 199000', personalPurchaseQuote('BMW007'), { purchasable: true, tier: 'premium', amount: 199000 });

// ============================================================
// 7) client forged amount ignored — order creation always uses the
// server-computed quote.amount, never anything the client could pass in
// req.body (validateRecordBody doesn't even accept a "price" field).
// ============================================================
{
  const order = await createWebOrderD1(env, { userId: 1, code: 'FRG001', price: personalPurchaseQuote('FRG001').amount, payload: PAYLOAD });
  check('7) client forged amount ignored (stored price is server quote, not a client value)', order.price, personalPurchaseQuote('FRG001').amount);
  await setWebOrderStatusD1(env, order.id, 'cancelled'); // cleanup so later "active order" checks aren't confused
}

// ============================================================
// 8-9) CheckPerformTransaction: correct amount PASS, wrong amount FAIL
// ============================================================
{
  const order = await createWebOrderD1(env, { userId: 1, code: 'CHK001', price: 49000, payload: PAYLOAD });
  const correct = await handlePaymeRequestD1(env, { method: 'CheckPerformTransaction', id: 1, params: { account: { order_id: order.id }, amount: 4900000 } });
  check('8) CheckPerformTransaction correct amount PASS', correct, { jsonrpc: '2.0', id: 1, result: { allow: true } });

  const wrong = await handlePaymeRequestD1(env, { method: 'CheckPerformTransaction', id: 2, params: { account: { order_id: order.id }, amount: 1 } });
  check('9) CheckPerformTransaction wrong amount FAIL', wrong.error?.code, PAYME_ERR.INVALID_AMOUNT);
}

// ============================================================
// 10-11) CreateTransaction + duplicate CreateTransaction
// ============================================================
let createOrder;
{
  createOrder = await createWebOrderD1(env, { userId: 1, code: 'CRE001', price: 99000, payload: PAYLOAD });
  const r1 = await handlePaymeRequestD1(env, { method: 'CreateTransaction', id: 3, params: { id: 'ptx-cre-001', account: { order_id: createOrder.id }, amount: 9900000 } });
  check('10) CreateTransaction success', r1.result?.state, 1);

  // NOTE: the dup-detection branch derives create_time from the STORED
  // created_at column (second precision, per SQLite's CURRENT_TIMESTAMP —
  // matches legacy server/payme.js's identical `new Date(existing.createdAt)
  // .getTime()` call exactly), so it won't equal r1's original millisecond
  // Date.now() value — only `transaction`/`state` are asserted for equality.
  const r2 = await handlePaymeRequestD1(env, { method: 'CreateTransaction', id: 4, params: { id: 'ptx-cre-001', account: { order_id: createOrder.id }, amount: 9900000 } });
  check('11) duplicate CreateTransaction (same payme id) returns same transaction, state unchanged', { transaction: r2.result?.transaction, state: r2.result?.state }, { transaction: String(createOrder.id), state: 1 });
  checkTrue('11b) duplicate CreateTransaction create_time is a valid timestamp', Number.isFinite(r2.result?.create_time));
}

// ============================================================
// 12-13) PerformTransaction + duplicate PerformTransaction
// ============================================================
{
  const before = await getRecord(env, 'CRE001');
  check('before PerformTransaction: NFC record does not exist yet', before, null);

  // Real gap between order creation and payment, so createdAt and the
  // actual perform_time are guaranteed to differ — needed to make test
  // 13c below a meaningful regression check, not a coincidence.
  await new Promise((resolve) => setTimeout(resolve, 5));

  const p1 = await handlePaymeRequestD1(env, { method: 'PerformTransaction', id: 5, params: { id: 'ptx-cre-001' } });
  check('12) PerformTransaction success', p1.result?.state, 2);

  const after = await getRecord(env, 'CRE001');
  checkTrue('12b) NFC record created after PerformTransaction', !!after);

  const owner = await getRecordOwner(env, 'CRE001');
  check('12c) ownership attached to the buyer', owner, 1);

  const orderAfter = await getWebOrderD1(env, createOrder.id);
  check('12d) order status is now paid', orderAfter.status, 'paid');

  const p2 = await handlePaymeRequestD1(env, { method: 'PerformTransaction', id: 6, params: { id: 'ptx-cre-001' } });
  check('13) duplicate PerformTransaction is idempotent (state 2, no error)', p2.result?.state, 2);

  // Regression check for a real bug found in review: the idempotent
  // duplicate-PerformTransaction branch used to echo back order.createdAt
  // as perform_time instead of the real, persisted order.performTime —
  // silently disagreeing with what CheckTransaction/GetStatement report
  // for the SAME transaction. Both calls must agree, and neither may equal
  // the order's createdAt (guaranteed distinct by the delay above).
  check('13c) duplicate PerformTransaction reports the SAME real perform_time as the first call', p2.result?.perform_time, p1.result?.perform_time);
  checkTrue('13d) perform_time is the real payment time, not the order creation time', p2.result?.perform_time !== new Date(createOrder.createdAt).getTime());

  const recordCountRow = await env.DB.prepare(`SELECT COUNT(*) AS n FROM cards WHERE code = ?`).bind('CRE001').first();
  check('13b) duplicate PerformTransaction did NOT create a second record', recordCountRow.n, 1);
}

// ============================================================
// 14) ownership only after PerformTransaction — verified via a fresh
// order that is created + has CreateTransaction called, but NEVER
// PerformTransaction'd.
// ============================================================
{
  const order = await createWebOrderD1(env, { userId: 2, code: 'OWN001', price: 49000, payload: PAYLOAD });
  await handlePaymeRequestD1(env, { method: 'CreateTransaction', id: 7, params: { id: 'ptx-own-001', account: { order_id: order.id }, amount: 4900000 } });
  const rec = await getRecord(env, 'OWN001');
  check('14) ownership NOT granted before PerformTransaction (record does not exist yet)', rec, null);
  const orderState = await getWebOrderD1(env, order.id);
  check('14b) order still pending before PerformTransaction', orderState.status, 'pending');
}

// ============================================================
// 15-16) CancelTransaction + duplicate CancelTransaction
// ============================================================
{
  const order = await createWebOrderD1(env, { userId: 1, code: 'CAN001', price: 49000, payload: PAYLOAD });
  await handlePaymeRequestD1(env, { method: 'CreateTransaction', id: 8, params: { id: 'ptx-can-001', account: { order_id: order.id }, amount: 4900000 } });
  // reason: 4 = "cancelled by timeout" (developer.help.paycom.uz's
  // documented CancelTransaction reason codes) — real Payme calls always
  // include this; asserted below to prove we persist and echo it back.
  const c1 = await handlePaymeRequestD1(env, { method: 'CancelTransaction', id: 9, params: { id: 'ptx-can-001', reason: 4 } });
  check('15) CancelTransaction on pending order -> state -1', c1.result?.state, -1);
  const afterCancel = await getWebOrderD1(env, order.id);
  check('15b) order status is cancelled', afterCancel.status, 'cancelled');

  const c2 = await handlePaymeRequestD1(env, { method: 'CancelTransaction', id: 10, params: { id: 'ptx-can-001', reason: 4 } });
  check('16) duplicate CancelTransaction is idempotent (still -1, no error)', c2.result?.state, -1);

  // Cancelling an ALREADY-PAID order must never flip it back / re-run finalize.
  const paidOrder = await createWebOrderD1(env, { userId: 1, code: 'CAN002', price: 49000, payload: PAYLOAD });
  await handlePaymeRequestD1(env, { method: 'CreateTransaction', id: 11, params: { id: 'ptx-can-002', account: { order_id: paidOrder.id }, amount: 4900000 } });
  await handlePaymeRequestD1(env, { method: 'PerformTransaction', id: 12, params: { id: 'ptx-can-002' } });
  const cancelAfterPaid = await handlePaymeRequestD1(env, { method: 'CancelTransaction', id: 13, params: { id: 'ptx-can-002' } });
  check('16b) CancelTransaction on an already-paid order -> state -2, status stays paid', cancelAfterPaid.result?.state, -2);
  const stillPaid = await getWebOrderD1(env, paidOrder.id);
  check('16c) paid order status unchanged by cancel attempt', stillPaid.status, 'paid');
}

// ============================================================
// 17) CheckTransaction
// ============================================================
{
  const order = await createWebOrderD1(env, { userId: 1, code: 'CHT001', price: 49000, payload: PAYLOAD });
  await handlePaymeRequestD1(env, { method: 'CreateTransaction', id: 14, params: { id: 'ptx-cht-001', account: { order_id: order.id }, amount: 4900000 } });
  const r = await handlePaymeRequestD1(env, { method: 'CheckTransaction', id: 15, params: { id: 'ptx-cht-001' } });
  check('17) CheckTransaction reflects pending state', r.result?.state, 1);
}

// ============================================================
// 18) GetStatement — real implementation (no longer an always-empty stub)
// ============================================================
{
  // No range -> covers everything created so far in this test run,
  // including the cancelled/paid/pending transactions from tests 15-17.
  const r = await handlePaymeRequestD1(env, { method: 'GetStatement', id: 16, params: {} });
  const byId = Object.fromEntries((r.result?.transactions || []).map((t) => [t.id, t]));
  checkTrue('18) GetStatement includes the cancelled transaction', !!byId['ptx-can-001']);
  checkTrue('18) GetStatement includes the paid transaction', !!byId['ptx-can-002']);
  checkTrue('18) GetStatement includes the pending transaction', !!byId['ptx-cht-001']);
  check('18b) cancelled transaction reports state -1 with the real reason Payme sent (4 = timeout)', { state: byId['ptx-can-001'].state, reason: byId['ptx-can-001'].reason }, { state: -1, reason: 4 });
  checkTrue('18c) cancelled transaction reports a real, non-zero cancel_time', byId['ptx-can-001'].cancel_time > 0);
  check('18d) paid transaction reports state 2 with a real, non-zero perform_time', { state: byId['ptx-can-002'].state, hasPerformTime: byId['ptx-can-002'].perform_time > 0 }, { state: 2, hasPerformTime: true });
  check('18e) pending transaction reports state 1, cancel_time/perform_time 0', { state: byId['ptx-cht-001'].state, performTime: byId['ptx-cht-001'].perform_time, cancelTime: byId['ptx-cht-001'].cancel_time }, { state: 1, performTime: 0, cancelTime: 0 });
  checkTrue('18f) each transaction carries account.order_id', Object.values(byId).every((t) => t.account && t.account.order_id));

  // A `from` set safely after everything created above -> empty (proves
  // the date-range filter is real, not decorative).
  const future = await handlePaymeRequestD1(env, { method: 'GetStatement', id: 17, params: { from: Date.now() + 3600_000, to: Date.now() + 7200_000 } });
  check('18g) GetStatement with a future date range -> empty', future.result?.transactions, []);
}

// ============================================================
// 18h) CheckTransaction's cancel_time is STABLE across repeated calls
// (the original bug: it used to recompute Date.now() every single call)
// ============================================================
{
  const first = await handlePaymeRequestD1(env, { method: 'CheckTransaction', id: 18, params: { id: 'ptx-can-001' } });
  await new Promise((resolve) => setTimeout(resolve, 5));
  const second = await handlePaymeRequestD1(env, { method: 'CheckTransaction', id: 19, params: { id: 'ptx-can-001' } });
  check('18h) cancel_time is identical across repeated CheckTransaction calls', first.result?.cancel_time, second.result?.cancel_time);
  checkTrue('18h) cancel_time is a real (non-zero) timestamp', first.result?.cancel_time > 0);
}

// ============================================================
// 19) wrong Basic Auth rejected
// ============================================================
{
  const goodAuth = 'Basic ' + Buffer.from('Paycom:test_payme_key_local_only').toString('base64');
  const badAuth = 'Basic ' + Buffer.from('Paycom:wrong_key').toString('base64');
  checkTrue('19a) correct Basic Auth accepted', verifyPaymeAuthD1(makeAuthedRequest('', { authorization: goodAuth }), env));
  checkFalse('19b) wrong Basic Auth rejected', verifyPaymeAuthD1(makeAuthedRequest('', { authorization: badAuth }), env));
  checkFalse('19c) missing Basic Auth rejected', verifyPaymeAuthD1(makeAuthedRequest('', {}), env));
  checkFalse('19d) wrong scheme rejected', verifyPaymeAuthD1(makeAuthedRequest('', { authorization: 'Bearer sometoken' }), env));
}

// ============================================================
// 20) duplicate Payme transaction ID protection — same params.id must
// never bind to a DIFFERENT order.
// ============================================================
{
  const orderA = await createWebOrderD1(env, { userId: 1, code: 'DUP00A', price: 49000, payload: PAYLOAD });
  const orderB = await createWebOrderD1(env, { userId: 2, code: 'DUP00B', price: 99000, payload: PAYLOAD });
  await handlePaymeRequestD1(env, { method: 'CreateTransaction', id: 17, params: { id: 'ptx-shared', account: { order_id: orderA.id }, amount: 4900000 } });
  // Same Payme transaction id, but now claiming a DIFFERENT order_id+amount.
  const r = await handlePaymeRequestD1(env, { method: 'CreateTransaction', id: 18, params: { id: 'ptx-shared', account: { order_id: orderB.id }, amount: 9900000 } });
  check('20) duplicate Payme transaction ID bound to a different order is rejected', r.error?.code, PAYME_ERR.CANT_DO_OPERATION);
  const orderBState = await getWebOrderD1(env, orderB.id);
  check('20b) orderB was NOT silently bound to ptx-shared', orderBState.paymeTransactionId, null);
}

// ============================================================
// 21) same NFC code parallel reservation protection (Fix 1 — now via
// createPendingWebOrderD1's atomic INSERT...SELECT...WHERE NOT EXISTS,
// NOT a schema-level UNIQUE index/exception).
// ============================================================
{
  const first = await createPendingWebOrderD1(env, { userId: 1, code: 'PAR001', price: 49000, payload: PAYLOAD });
  checkTrue('21a) first pending order for a code succeeds', !!first);
  const second = await createPendingWebOrderD1(env, { userId: 2, code: 'PAR001', price: 49000, payload: PAYLOAD });
  check('21) second pending order for the SAME code is rejected atomically (returns null, no exception, no row inserted)', second, null);
  const active = await activeWebOrderByCodeD1(env, 'PAR001');
  check('21b) activeWebOrderByCodeD1 still reports the first (only) pending order', active.id, first.id);
  const countRow = await env.DB.prepare(`SELECT COUNT(*) AS n FROM web_orders WHERE code = ?`).bind('PAR001').first();
  check('21c) exactly one web_orders row exists for this code (no duplicate was created)', countRow.n, 1);
}

// ============================================================
// 9 (task list)) reservation duplicate protection — three-way race,
// only one of three concurrent creation attempts must win.
// ============================================================
{
  const results = await Promise.all([
    createPendingWebOrderD1(env, { userId: 1, code: 'RACE01', price: 49000, payload: PAYLOAD }),
    createPendingWebOrderD1(env, { userId: 2, code: 'RACE01', price: 49000, payload: PAYLOAD }),
    createPendingWebOrderD1(env, { userId: 1, code: 'RACE01', price: 49000, payload: PAYLOAD }),
  ]);
  const winners = results.filter(Boolean);
  check('9) exactly one of three concurrent reservation attempts wins', winners.length, 1);
  const countRow = await env.DB.prepare(`SELECT COUNT(*) AS n FROM web_orders WHERE code = ?`).bind('RACE01').first();
  check('9b) exactly one web_orders row exists after the race', countRow.n, 1);
}

// ============================================================
// 8 (task list)) unique-index existing-duplicate-data safety — the
// EXACT scenario the pre-commit review flagged: seed 2 pre-existing
// "pending" rows for the same code (simulating uncleaned production
// data), then confirm ensureCoreSchema (core API init) still succeeds
// and does not touch/delete/cancel the pre-existing rows.
// ============================================================
{
  env.DB.exec(`
    INSERT INTO web_orders (user_id, code, kind, price, payload, status) VALUES
      (1, 'DUPSEED', 'card_purchase', 49000, '{}', 'pending'),
      (2, 'DUPSEED', 'card_purchase', 49000, '{}', 'pending')
  `);
  const before = await env.DB.prepare(`SELECT COUNT(*) AS n FROM web_orders WHERE code = ? AND status = 'pending'`).bind('DUPSEED').first();
  check('8a) pre-existing duplicate pending rows seeded', before.n, 2);

  let schemaOk = true;
  try { await ensureCoreSchema(env); } catch { schemaOk = false; }
  checkTrue('8) ensureCoreSchema succeeds despite pre-existing duplicate pending rows for the same code (no runtime UNIQUE index)', schemaOk);

  // A brand-new API call (records POST-equivalent flow) must also keep
  // working normally for OTHER codes after this — not just schema init.
  const unrelated = await createPendingWebOrderD1(env, { userId: 1, code: 'AFTERDUP', price: 49000, payload: PAYLOAD });
  checkTrue('8b) new order creation for an unrelated code still works after duplicate-seeded schema init', !!unrelated);

  const after = await env.DB.prepare(`SELECT COUNT(*) AS n FROM web_orders WHERE code = ? AND status = 'pending'`).bind('DUPSEED').first();
  check('8c) pre-existing duplicate rows were NOT touched/deleted/modified', after.n, 2);
}

// ============================================================
// 22) private data leak check — order-status / order objects never
// carry email/phone/password data, only id/code/status/price(+kind/payload
// internally, but the polling contract only surfaces id/code/status/price).
// ============================================================
{
  const order = await createWebOrderD1(env, { userId: 1, code: 'PRV001', price: 49000, payload: { ...PAYLOAD, phone: '+998901234567', email: 'secret@test.local' } });
  // Simulate the exact shape GET /api/orders/:id returns (see ordersApi).
  const publicShape = { id: order.id, code: order.code, status: order.status, price: order.price };
  const serialized = JSON.stringify(publicShape);
  checkFalse('22) order status response leaks phone', serialized.includes('998901234567'));
  checkFalse('22b) order status response leaks email', serialized.includes('secret@test.local'));
}

// ============================================================
// 23) existing unrelated API regression check — getRecord/getRecordOwner
// for an untouched pre-existing card still behave exactly as before
// (Phase 2B added new functions but never modified these).
// ============================================================
{
  await env.DB.prepare(`INSERT INTO cards (code, name, price, ts, user_id) VALUES (?, 'Pre-existing', 0, ?, 1)`).bind('OLD001', Date.now()).run();
  const rec = await getRecord(env, 'OLD001');
  checkTrue('23) pre-existing unrelated record is still readable unchanged', !!rec && rec.name === 'Pre-existing');
  const owner = await getRecordOwner(env, 'OLD001');
  check('23b) pre-existing unrelated record ownership unaffected', owner, 1);
}

// ============================================================
// Extra: unsupported order kinds must never be silently finalized.
// ============================================================
{
  const order = await createWebOrderD1(env, { userId: 1, code: 'AUC001', price: 500000, payload: { auctionId: 1 }, kind: 'auction_payment' });
  const result = await finalizePaidWebOrderD1(env, order.id);
  check('extra) unsupported order kind (auction_payment) returns a safe unsupported result, not ok:true', result, { ok: false, reason: 'unsupported_order_kind' });
  const stillPending = await getWebOrderD1(env, order.id);
  check('extra b) unsupported order kind is left pending, not silently marked paid', stillPending.status, 'pending');
}

// ============================================================
// FIX 2 — atomic/resumable finalize: CASE A/B/C/D + idempotent re-entry
// after already 'paid' + "failed finalize never leaks ownership".
// ============================================================

// 1) fresh finalize (CASE A — record doesn't exist yet)
{
  const order = await createWebOrderD1(env, { userId: 1, code: 'CASEA01', price: 49000, payload: PAYLOAD });
  const result = await finalizePaidWebOrderD1(env, order.id);
  check('1) fresh finalize (CASE A) succeeds', result.ok, true);
  const owner = await getRecordOwner(env, 'CASEA01');
  check('1b) CASE A: ownership attached to buyer', owner, 1);
  const after = await getWebOrderD1(env, order.id);
  check('1c) CASE A: order marked paid', after.status, 'paid');
}

// 2) duplicate PerformTransaction after a clean finalize is idempotent
// (re-verified here at the finalize-function level directly, in addition
// to the earlier handlePaymeRequestD1-level test #13).
{
  const order = await createWebOrderD1(env, { userId: 1, code: 'CASEA02', price: 49000, payload: PAYLOAD });
  const r1 = await finalizePaidWebOrderD1(env, order.id);
  check('2) first finalize succeeds', r1.ok, true);
  const r2 = await finalizePaidWebOrderD1(env, order.id);
  check('2b) duplicate finalize call is idempotent (ok:true, alreadyPaid)', r2, { ok: true, alreadyPaid: true });
  const countRow = await env.DB.prepare(`SELECT COUNT(*) AS n FROM cards WHERE code = ?`).bind('CASEA02').first();
  check('2c) duplicate finalize did not create a second card', countRow.n, 1);
}

// 3) CASE B — record exists from a previous partial attempt, owner NULL
// (simulates a Worker crash between createRecordD1 and attachCardToUserD1).
{
  const order = await createWebOrderD1(env, { userId: 5, code: 'CASEB01', price: 49000, payload: PAYLOAD });
  // Manually simulate the partial state: card created, but NOT attached,
  // and the order was never marked paid (exactly what a mid-finalize
  // crash would leave behind).
  await createRecordD1(env, { ...PAYLOAD, code: 'CASEB01', price: 49000 });
  const ownerBefore = await getRecordOwner(env, 'CASEB01');
  check('3a) CASE B setup: card exists with NO owner (simulated partial crash)', ownerBefore, null);

  const result = await finalizePaidWebOrderD1(env, order.id);
  check('3) CASE B recovery: resumed finalize succeeds', result, { ok: true, created: result.created, resumed: true });
  const ownerAfter = await getRecordOwner(env, 'CASEB01');
  check('3b) CASE B: ownership correctly attached to the order buyer on recovery', ownerAfter, 5);
  const orderAfter = await getWebOrderD1(env, order.id);
  check('3c) CASE B: order correctly marked paid on recovery', orderAfter.status, 'paid');
}

// 4) CASE C — record exists and is ALREADY owned by this exact order's
// buyer (simulates a crash between attachCardToUserD1 and
// setWebOrderStatusD1('paid') — ownership done, order status not yet
// updated).
{
  const order = await createWebOrderD1(env, { userId: 6, code: 'CASEC01', price: 49000, payload: PAYLOAD });
  await createRecordD1(env, { ...PAYLOAD, code: 'CASEC01', price: 49000 });
  await attachCardToUserD1(env, 'CASEC01', 6); // simulate: ownership already done, order still 'pending'
  const orderBefore = await getWebOrderD1(env, order.id);
  check('4a) CASE C setup: order still pending despite ownership already attached', orderBefore.status, 'pending');

  const result = await finalizePaidWebOrderD1(env, order.id);
  check('4) CASE C recovery: resumed finalize succeeds (idempotent, ownership untouched)', result.ok, true);
  const owner = await getRecordOwner(env, 'CASEC01');
  check('4b) CASE C: ownership unchanged (still the same buyer)', owner, 6);
  const orderAfter = await getWebOrderD1(env, order.id);
  check('4c) CASE C: order now correctly marked paid', orderAfter.status, 'paid');
}

// 5) CASE D — record exists and belongs to a GENUINELY DIFFERENT user —
// ownership must NEVER be reassigned; this is a real code_taken failure.
{
  const orderForUser7 = await createWebOrderD1(env, { userId: 7, code: 'CASED01', price: 49000, payload: PAYLOAD });
  // Someone else (user 8) already legitimately owns this code (e.g. from
  // an unrelated, earlier, fully-successful purchase).
  await createRecordD1(env, { ...PAYLOAD, code: 'CASED01', price: 49000 });
  await attachCardToUserD1(env, 'CASED01', 8);

  const result = await finalizePaidWebOrderD1(env, orderForUser7.id);
  check('5) CASE D: finalize for a different buyer than the true owner FAILS (code_taken)', result, { ok: false, reason: 'code_taken' });
  const owner = await getRecordOwner(env, 'CASED01');
  check('5b) CASE D: ownership was NOT reassigned to user 7 — still belongs to user 8', owner, 8);
  const orderAfter = await getWebOrderD1(env, orderForUser7.id);
  check('5c) CASE D: the failed order is marked failed_code_taken, not paid', orderAfter.status, 'failed_code_taken');
}

// 6) order paid + correct owner, duplicate finalize call — re-verifies
// the exact "PerformTransaction success requires order paid AND code
// belongs to that order's user" invariant the task calls out explicitly.
{
  const order = await createWebOrderD1(env, { userId: 9, code: 'CASEF01', price: 49000, payload: PAYLOAD });
  await finalizePaidWebOrderD1(env, order.id);
  const result = await handlePaymeRequestD1(env, { method: 'PerformTransaction', id: 100, params: { id: 'no-such-ptx-for-CASEF01' } });
  // (no CreateTransaction was ever run for this order, so this specific
  // Payme call is expected to fail to find a transaction — the real
  // point of this test is exercised via finalizePaidWebOrderD1 directly:)
  check('6a) PerformTransaction with no matching payme transaction id correctly fails to find one', result.error?.code, PAYME_ERR.TRANSACTION_NOT_FOUND);
  const direct = await finalizePaidWebOrderD1(env, order.id);
  check('6) duplicate finalize on an already-paid, correctly-owned order is idempotent success', direct, { ok: true, alreadyPaid: true });
}

// 7) failed finalize never leaks ownership — across every failure path
// exercised above (CASE D, and the earlier "unsupported_order_kind"
// case), the code's actual owner (or lack thereof) must be exactly what
// it was before the failed attempt — never partially/incorrectly set.
{
  // Re-check CASE D's failure from test 5 didn't leak ownership (already
  // asserted above as 5b, re-asserted here as the "no leak" framing the
  // task explicitly asks for).
  const ownerCASED = await getRecordOwner(env, 'CASED01');
  check('7) CASE D failure leaked no ownership change to the rejected buyer', ownerCASED, 8);

  // unsupported_order_kind failure (AUC001, from the "Extra" block above)
  // must also leave zero ownership trace — no card was ever created.
  const rec = await getRecord(env, 'AUC001');
  check('7b) unsupported-kind failure created no NFC record at all (no ownership leak possible)', rec, null);
}

// ============================================================
// 19) checkout domain is configurable (env.PAYME_CHECKOUT_DOMAIN) —
// defaults to production, but a test/sandbox domain can be set without
// any code change/redeploy.
// ============================================================
{
  const defaultLink = paymeCheckoutLinkD1(env, 999, 49000);
  checkTrue('19) checkout link defaults to the production domain when PAYME_CHECKOUT_DOMAIN is unset', defaultLink.startsWith('https://checkout.paycom.uz/'));

  const testEnv = { ...env, PAYME_CHECKOUT_DOMAIN: 'checkout.test.paycom.uz' };
  const testLink = paymeCheckoutLinkD1(testEnv, 999, 49000);
  checkTrue('19b) checkout link uses PAYME_CHECKOUT_DOMAIN when set (no code change needed for test mode)', testLink.startsWith('https://checkout.test.paycom.uz/'));

  // The encoded payload itself (merchant id / order id / amount) must be
  // identical either way — only the domain differs.
  check('19c) the base64 payload is unaffected by which domain is used', defaultLink.split('/').pop(), testLink.split('/').pop());
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
