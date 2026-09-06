// hosting/api/admin-finance.js testi — haqiqiy worker.fetch + in-memory D1 shim
// (scripts/lib/d1-harness.mjs). Production D1/R2 ga tegmaydi.
//   node scripts/test-admin-finance.mjs
import worker from '../hosting/worker.js';
import { makeEnv, seedBasic, cookie, req, makeChecker } from './lib/d1-harness.mjs';

const { check, checkTrue, done } = makeChecker();
const { env } = makeEnv();
await seedBasic(env);
const F = '/api/admin/finance';
const call = async (path, init = {}) => { const res = await worker.fetch(req(path, init), env); const data = await res.clone().json().catch(() => null); return { res, data }; };
const get = (path, c = cookie.admin) => call(path, { cookie: c });
const post = (path, json, c = cookie.admin) => call(path, { method: 'POST', json, cookie: c });
const del = (path, c = cookie.admin) => call(path, { method: 'DELETE', cookie: c });

// ---------- fixtures: web_orders (paid / cancelled / pending), bot_orders ----------
await env.DB.prepare(`INSERT INTO web_orders (id, user_id, code, price, payload, status, created_at, kind, payme_transaction_id) VALUES (1, 1, 'VIP001', 199000, '{}', 'paid', '2026-03-05T10:00:00.000Z', 'card_purchase', 'payme-abc-1')`).run();
await env.DB.prepare(`INSERT INTO web_orders (id, user_id, code, price, payload, status, created_at, kind, payme_transaction_id) VALUES (2, 1, 'VIP001', 50000, '{}', 'paid', '2026-03-20 12:30:00', 'premium_upgrade', 'payme-abc-2')`).run();
await env.DB.prepare(`INSERT INTO web_orders (id, user_id, code, price, payload, status, created_at, kind) VALUES (3, 2, 'OTH222', 49000, '{}', 'cancelled', '2026-03-21T09:00:00.000Z', 'card_purchase')`).run();
await env.DB.prepare(`INSERT INTO web_orders (id, user_id, code, price, payload, status, created_at, kind) VALUES (4, 2, 'OTH222', 49000, '{}', 'pending', '2026-03-22T09:00:00.000Z', 'card_purchase')`).run();
await env.DB.prepare(`INSERT INTO web_orders (id, user_id, code, price, payload, status, created_at, kind) VALUES (5, 1, 'BIZ777', 300000, '{}', 'paid', '2026-04-02T09:00:00.000Z', 'card_purchase')`).run();
await env.DB.prepare(`INSERT INTO bot_orders (id, tg_user_id, tg_name, code, price, status, created_at) VALUES (1, 555, 'Bot Foydalanuvchi', 'BOT111', 99000, 'paid', '2026-03-10T08:00:00.000Z')`).run();
await env.DB.prepare(`INSERT INTO bot_orders (id, tg_user_id, tg_name, code, price, status, created_at) VALUES (2, 556, 'Bot Pending', 'BOT222', 99000, 'pending', '2026-03-11T08:00:00.000Z')`).run();

// ---------- auth ----------
{
  const { res, data } = await call(`${F}/transactions?from=2026-03-01&to=2026-03-31`);
  check('GET transactions no cookie -> 401', [res.status, data?.error], [401, 'unauthorized']);
}
{
  const { res } = await call(`${F}/expenses`, { method: 'POST', json: { title: 'x', amount: 1 } });
  check('POST expenses no cookie -> 401', res.status, 401);
}
for (const [label, fn] of [
  ['GET transactions', () => get(`${F}/transactions?range=month`, cookie.manager)],
  ['GET reconciliation', () => get(`${F}/reconciliation?year=2026`, cookie.manager)],
  ['POST bank-actual', () => post(`${F}/bank-actual`, { period: '2026-03', actualAmount: 1 }, cookie.manager)],
  ['GET rates', () => get(`${F}/rates`, cookie.manager)],
  ['POST rates', () => post(`${F}/rates`, { scope: 'payme', params: { pct: 1 } }, cookie.manager)],
  ['GET expenses', () => get(`${F}/expenses`, cookie.manager)],
  ['POST expenses', () => post(`${F}/expenses`, { title: 'x', amount: 1 }, cookie.manager)],
  ['DELETE expenses/1', () => del(`${F}/expenses/1`, cookie.manager)],
  ['GET documents', () => get(`${F}/documents`, cookie.manager)],
  ['POST documents', () => post(`${F}/documents`, { name: 'x', url: 'https://a.b/c' }, cookie.manager)],
  ['DELETE documents/1', () => del(`${F}/documents/1`, cookie.manager)],
  ['GET report', () => get(`${F}/report?range=month`, cookie.manager)],
]) {
  const { res, data } = await fn();
  check(`${label} manager -> 403 forbidden`, [res.status, data?.error], [403, 'forbidden']);
}
{
  const { res, data } = await get(`${F}/does-not-exist`);
  check('GET unknown finance sub-path -> 404 not_found (module returns null)', [res.status, data?.error], [404, 'not_found']);
  const r2 = await call(`${F}/expenses`, { method: 'PUT', cookie: cookie.admin, json: {} });
  check('PUT expenses (unsupported method) -> 404', r2.res.status, 404);
}

// ---------- validation (422) ----------
for (const [label, fn] of [
  ['transactions from=2026-13-01', () => get(`${F}/transactions?from=2026-13-01&to=2026-12-31`)],
  ['transactions to=2026-02-30 (calendar-invalid)', () => get(`${F}/transactions?from=2026-02-01&to=2026-02-30`)],
  ['transactions from > to', () => get(`${F}/transactions?from=2026-04-01&to=2026-03-01`)],
  ["transactions from=' OR 1=1 --", () => get(`${F}/transactions?from=${encodeURIComponent("' OR 1=1 --")}`)],
  ['transactions type=bogus', () => get(`${F}/transactions?range=month&type=bogus`)],
  ['transactions status=bogus', () => get(`${F}/transactions?range=month&status=bogus`)],
  ['reconciliation period=2026-13', () => get(`${F}/reconciliation?period=2026-13`)],
  ['reconciliation year=abc', () => get(`${F}/reconciliation?year=abc`)],
  ['bank-actual bad period', () => post(`${F}/bank-actual`, { period: '2026/03', actualAmount: 1 })],
  ['rates bad scope', () => post(`${F}/rates`, { scope: 'crypto', params: { pct: 1 } })],
  ['rates bad effectiveFrom', () => post(`${F}/rates`, { scope: 'payme', params: { pct: 1 }, effectiveFrom: '01.03.2026' })],
  ['rates missing params', () => post(`${F}/rates`, { scope: 'payme' })],
  ['expenses missing title', () => post(`${F}/expenses`, { amount: 100 })],
  ['expenses bad amount', () => post(`${F}/expenses`, { title: 'x', amount: 0 })],
  ['expenses bad spentOn', () => post(`${F}/expenses`, { title: 'x', amount: 100, spentOn: '2026-3-1' })],
  ['expenses list from=bad', () => get(`${F}/expenses?from=bad`)],
  ['documents missing url', () => post(`${F}/documents`, { name: 'x' })],
  ['documents javascript: url', () => post(`${F}/documents`, { name: 'x', url: 'javascript:alert(1)' })],
  ['documents dataUrl bad mime', () => post(`${F}/documents`, { name: 'x', dataUrl: 'data:text/html;base64,PGh0bWw+' })],
  ['report from=bad', () => get(`${F}/report?from=2026-99-99`)],
]) {
  const { res } = await fn();
  check(`422 ${label}`, res.status, 422);
}

// ---------- transactions ----------
{
  const { res, data } = await get(`${F}/transactions?range=custom&from=2026-03-01&to=2026-03-31&type=&status=&q=&page=1`);
  check('GET transactions (March) -> 200', res.status, 200);
  check('transactions: web paid+cancelled + bot paid, pending excluded, April excluded', data.items.length, 4);
  check('transactions: total/page/limit shape', [data.total, data.page, data.limit], [4, 1, 50]);
  check('transactions: sorted newest first', data.items.map((i) => `${i.source}-${i.id}`), ['web-3', 'web-2', 'bot-1', 'web-1']);
  const w = data.items.find((i) => i.source === 'web' && i.id === 1);
  check('transactions: web item shape', w, { id: 1, source: 'web', kind: 'card_purchase', code: 'VIP001', amount: 199000, status: 'paid', paymeTxnId: 'payme-abc-1', userEmail: 'user@test.local', createdAt: '2026-03-05T10:00:00.000Z' });
  const b = data.items.find((i) => i.source === 'bot');
  check('transactions: bot item shape', [b.kind, b.code, b.amount, b.paymeTxnId, b.userEmail], ['card_purchase', 'BOT111', 99000, null, 'Bot Foydalanuvchi']);
}
{
  const { data } = await get(`${F}/transactions?from=2026-03-01&to=2026-03-31&status=paid`);
  check('transactions status=paid -> 3 (2 web + 1 bot)', [data.items.length, data.total], [3, 3]);
}
{
  const { data } = await get(`${F}/transactions?from=2026-03-01&to=2026-03-31&type=premium_upgrade`);
  check('transactions type=premium_upgrade -> 1 web, no bot rows', [data.items.length, data.items[0]?.id], [1, 2]);
  const k = await get(`${F}/transactions?from=2026-03-01&to=2026-03-31&kind=premium_upgrade`);
  check('transactions kind= alias works like type=', k.data.items.length, 1);
}
{
  const { data } = await get(`${F}/transactions?from=2026-03-01&to=2026-03-31&q=${encodeURIComponent('payme-ABC-2')}`);
  check('transactions q= matches payme txn id case-insensitively', data.items.map((i) => i.id), [2]);
  const e = await get(`${F}/transactions?from=2026-03-01&to=2026-03-31&q=other%40test`);
  check('transactions q= matches user email', e.data.items.map((i) => i.id), [3]);
  const c = await get(`${F}/transactions?from=2026-03-01&to=2026-03-31&q=bot1`);
  check('transactions q= matches bot code', c.data.items.map((i) => i.source), ['bot']);
  const inj = await get(`${F}/transactions?from=2026-03-01&to=2026-03-31&q=${encodeURIComponent("%' OR 1=1 --")}`);
  check('transactions q= SQL-ish text is bound, not interpolated -> 0 rows', inj.data.items.length, 0);
}
{
  const { data } = await get(`${F}/transactions?from=2026-03-01&to=2026-04-30&limit=10&page=2`);
  check('transactions limit clamps to 10; page 2 has no web rows (4 web total) -> only bot row', [data.limit, data.page, data.items.map((i) => i.source)], [10, 2, ['bot']]);
}

// ---------- rates ----------
{
  const { res, data } = await get(`${F}/rates`);
  check('GET rates -> 200 with seeded payme/bank/tax', [res.status, Object.keys(data.current).sort()], [200, ['bank', 'payme', 'tax']]);
  check('rates: payme seed params', data.current.payme.params, { pct: 0, fixed: 0, mode: 'settlement_deducted' });
  check('rates: history per scope', [data.history.payme.length, data.history.bank.length, data.history.tax.length], [1, 1, 1]);
  checkTrue('rates: row shape', typeof data.current.payme.id === 'number' && /^\d{4}-\d{2}-\d{2}$/.test(data.current.payme.effectiveFrom) && typeof data.current.payme.note === 'string');
}
{
  const { res, data } = await post(`${F}/rates`, { scope: 'payme', params: { pct: '1.5', fixed: -5, mode: 'separate', bogus$: 1 }, effectiveFrom: '2026-01-01', note: 'Payme shartnoma' });
  check('POST rates payme -> ok + rate', [res.status, data.ok, data.rate.scope, data.rate.effectiveFrom, data.rate.note], [200, true, 'payme', '2026-01-01', 'Payme shartnoma']);
  check('POST rates: params cleaned (numbers >= 0, mode enum, bad keys dropped)', data.rate.params, { pct: 1.5, fixed: 0, mode: 'separate' });
  const r = await get(`${F}/rates`);
  // Legacy semantics: `current` = newest effective_from <= today. The seed row is dated
  // today, so a back-dated 2026-01-01 row lands in history but does NOT become current.
  check('GET rates after back-dated POST: history grows, current still the today-dated seed', [r.data.current.payme.params.pct, r.data.history.payme.length, r.data.history.payme[1].params.pct], [0, 2, 1.5]);
}
{
  const { data } = await post(`${F}/rates`, { scope: 'tax', key: 'turnoverPct', value: 4, effectiveFrom: '2026-01-01' });
  check('POST rates key/value merges onto current params', data.rate.params, { turnoverPct: 4, socialMonthly: 0 });
  // Back-dated rows drive the March calculations below (2% payme, 25000 bank monthly).
  await post(`${F}/rates`, { scope: 'payme', params: { pct: 2, fixed: 0, mode: 'settlement_deducted' }, effectiveFrom: '2026-01-01' });
  await post(`${F}/rates`, { scope: 'bank', params: { monthlyFee: 25000, extraFee: 0 }, effectiveFrom: '2026-01-01' });
  const today = new Date().toISOString().slice(0, 10);
  await post(`${F}/rates`, { scope: 'payme', params: { pct: 3, fixed: 0, mode: 'settlement_deducted' }, effectiveFrom: today });
  const r1 = await get(`${F}/rates`);
  check('rates: same-day row as seed -> newest id wins current (frontend default effectiveFrom = today)', [r1.data.current.payme.params.pct, r1.data.current.payme.effectiveFrom], [3, today]);
  const future = await post(`${F}/rates`, { scope: 'payme', params: { pct: 9 }, effectiveFrom: '2999-01-01' });
  const r = await get(`${F}/rates`);
  check('rates: future-dated row is in history but not current', [future.res.status, r.data.current.payme.params.pct, r.data.history.payme[0].params.pct], [200, 3, 9]);
}

// ---------- reconciliation + bank-actual ----------
// March web paid gross = 199000 + 50000 = 249000 (bot_orders not counted, legacy parity); payme 2% -> fee 4980; expected 244020
{
  const { res, data } = await get(`${F}/reconciliation?year=2026`);
  check('GET reconciliation?year -> 200, 12 months', [res.status, data.year, data.months.length], [200, 2026, 12]);
  const m = data.months.find((x) => x.period === '2026-03');
  check('reconciliation March: gross/orders/fee/expected/pending', m, { period: '2026-03', gross: 249000, orders: 2, paymeFee: 4980, expected: 244020, actual: null, diff: null, status: 'pending', note: '' });
  check('reconciliation April: gross from April row only', [data.months[3].gross, data.months[3].orders], [300000, 1]);
}
{
  const { res, data } = await post(`${F}/bank-actual`, { period: '2026-03', actualAmount: 244020, note: 'Trastbank' });
  check('POST bank-actual -> ok row', [res.status, data], [200, { ok: true, row: { period: '2026-03', actualAmount: 244020, note: 'Trastbank' } }]);
  const r = await get(`${F}/reconciliation?period=2026-03`);
  check('GET reconciliation?period -> matched, diff 0, note', [r.data.months.length, r.data.month.status, r.data.month.diff, r.data.month.actual, r.data.month.note], [1, 'matched', 0, 244020, 'Trastbank']);
  const up = await post(`${F}/bank-actual`, { period: '2026-03', actualAmount: '240000.4' });
  check('POST bank-actual upsert overwrites', up.data.row, { period: '2026-03', actualAmount: 240000, note: null });
  const r2 = await get(`${F}/reconciliation?year=2026`);
  check('reconciliation after upsert -> difference -4020', [r2.data.months[2].status, r2.data.months[2].diff], ['difference', -4020]);
  const cnt = await env.DB.prepare(`SELECT COUNT(*) AS n FROM finance_bank_actuals`).first();
  check('bank_actuals: one row per period (upsert, not duplicate)', cnt.n, 1);
}

// ---------- expenses ----------
let expenseId = 0;
{
  const { res, data } = await post(`${F}/expenses`, { title: '  Reklama  ', category: 'ads', amount: '50000', spentOn: '2026-03-15', note: 'Instagram' });
  check('POST expenses -> ok expense', [res.status, data.ok, data.expense.title, data.expense.category, data.expense.amount, data.expense.spentOn, data.expense.note], [200, true, 'Reklama', 'ads', 50000, '2026-03-15', 'Instagram']);
  expenseId = data.expense.id;
  const d = await post(`${F}/expenses`, { title: 'Domen', category: 'not-a-category', amount: 120000.6 });
  check('POST expenses: unknown category -> other, amount rounded, spentOn defaults to today', [d.data.expense.category, d.data.expense.amount, d.data.expense.spentOn], ['other', 120001, new Date().toISOString().slice(0, 10)]);
}
{
  const { res, data } = await get(`${F}/expenses`);
  check('GET expenses -> 200 list + categories', [res.status, data.expenses.length, data.categories.includes('ads'), data.total], [200, 2, true, 170001]);
  const m = await get(`${F}/expenses?from=2026-03-01&to=2026-03-31`);
  check('GET expenses?from&to filters by spent_on', m.data.expenses.map((e) => e.id), [expenseId]);
  const none = await get(`${F}/expenses?from=2020-01-01&to=2020-12-31`);
  check('GET expenses empty range -> []', none.data.expenses, []);
}
{
  const { res, data } = await del(`${F}/expenses/${expenseId}`);
  check('DELETE expenses/:id -> ok true', [res.status, data], [200, { ok: true }]);
  const again = await del(`${F}/expenses/${expenseId}`);
  check('DELETE expenses/:id again -> ok false', again.data, { ok: false });
}

// ---------- documents ----------
let docId = 0; let uploadedUrl = '';
{
  const { res, data } = await post(`${F}/documents`, { name: 'Payme hisobot', docType: 'payme_report', period: '2026-03', url: 'https://example.com/report.pdf' });
  check('POST documents (link) -> ok doc', [res.status, data.ok, data.doc.name, data.doc.docType, data.doc.period, data.doc.url], [200, true, 'Payme hisobot', 'payme_report', '2026-03', 'https://example.com/report.pdf']);
  docId = data.doc.id;
  const alias = await post(`${F}/documents`, { title: 'Alias', kind: 'invoice', fileUrl: 'https://example.com/inv.pdf' });
  check('POST documents accepts title/kind/fileUrl aliases', [alias.data.doc.name, alias.data.doc.docType], ['Alias', 'invoice']);
}
{
  const pdf = Buffer.from('%PDF-1.4 test finance doc').toString('base64');
  const { res, data } = await post(`${F}/documents`, { name: 'Bank ko‘chirmasi', docType: 'bank_statement', period: '2026-03', dataUrl: `data:application/pdf;base64,${pdf}` });
  check('POST documents (dataUrl) -> ok, stored under /uploads/fin_*.pdf', [res.status, data.ok, /^\/uploads\/fin_[0-9a-f]{20}\.pdf$/.test(data.doc.url)], [200, true, true]);
  uploadedUrl = data.doc.url;
  const file = await worker.fetch(req(uploadedUrl), env);
  check('uploaded doc is served back by the R2 /uploads/* route', [file.status, file.headers.get('content-type'), await file.text()], [200, 'application/pdf', '%PDF-1.4 test finance doc']);
  const big = await post(`${F}/documents`, { name: 'x', dataUrl: `data:application/pdf;base64,${Buffer.alloc(15 * 1024 * 1024 + 1).toString('base64')}` });
  check('POST documents dataUrl > 15MB -> 413', big.res.status, 413);
}
{
  const { res, data } = await get(`${F}/documents`);
  check('GET documents -> 200 list (newest first) + types', [res.status, data.documents.length, data.types.length, data.documents[0].url], [200, 3, 6, uploadedUrl]);
  checkTrue('documents: createdAt present', !!data.documents[0].createdAt);
  const d = await del(`${F}/documents/${docId}`);
  check('DELETE documents/:id -> ok true', d.data, { ok: true });
  const again = await del(`${F}/documents/${docId}`);
  check('DELETE documents/:id again -> ok false', again.data, { ok: false });
}

// ---------- report (XLSX) + reports (JSON) ----------
{
  const res = await worker.fetch(req(`${F}/report?range=custom&from=2026-03-01&to=2026-03-31`, { cookie: cookie.admin }), env);
  const bytes = new Uint8Array(await res.arrayBuffer());
  check('GET report -> 200 xlsx headers', [res.status, res.headers.get('content-type'), res.headers.get('content-disposition')], [200, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'attachment; filename="nfcstore_moliya_custom.xlsx"']);
  check('report: ZIP local-header signature', [...bytes.slice(0, 4)], [0x50, 0x4b, 0x03, 0x04]);
  const text = Buffer.from(bytes).toString('latin1');
  checkTrue('report: contains workbook + 4 worksheets', ['xl/workbook.xml', 'xl/worksheets/sheet1.xml', 'xl/worksheets/sheet4.xml', '[Content_Types].xml'].every((n) => text.includes(n)));
  checkTrue('report: end-of-central-directory present', text.lastIndexOf('PK\x05\x06') === bytes.length - 22);
  checkTrue('report: transactions sheet carries fixture code', text.includes('VIP001') && text.includes('payme-abc-1'));
}
{
  const { res, data } = await get(`${F}/reports?from=2026-03-01&to=2026-03-31`);
  check('GET reports (JSON) -> 200 shape', [res.status, Object.keys(data).sort()], [200, ['daily', 'overview', 'range', 'reconciliation', 'transactions']]);
  // gross = 199000 + 50000 + bot 99000 = 348000; payme 2% -> 3980 + 1000 + 1980 = 6960 (settlement_deducted)
  const o = data.overview;
  check('reports overview: gross incl. bot, paymeFee, expected, orderCount', [o.grossSales, o.paymeFee, o.paymeMode, o.expectedBankSettlement, o.orderCount], [348000, 6960, 'settlement_deducted', 341040, 3]);
  check('reports overview: bank actual + reconciliation diff', [o.actualBankSettlement, o.reconciliationDifference], [240000, 240000 - 341040]);
  check('reports overview: tax 4% of base, bank monthly fee, ratesConfigured', [o.taxBase, o.turnoverPct, o.turnoverTax, o.bankFees, o.ratesConfigured, o.months], [348000, 4, 13920, 25000, true, ['2026-03']]);
  check('reports overview: manualExpenses only within range (Reklama deleted)', o.manualExpenses, 0);
  check('reports overview: netCashFlow = actual - bankFees - turnoverTax - socialTax - expenses', o.netCashFlow, 240000 - 25000 - 13920 - 0 - 0);
  check('reports overview: byType sorted desc', o.byType, [{ kind: 'card_purchase', total: 298000 }, { kind: 'premium_upgrade', total: 50000 }]);
  check('reports daily: web-only days with fee/expected', data.daily, [{ day: '2026-03-05', gross: 199000, orders: 1, paymeFee: 3980, expected: 195020 }, { day: '2026-03-20', gross: 50000, orders: 1, paymeFee: 1000, expected: 49000 }]);
  check('reports transactions/reconciliation nested', [data.transactions.items.length, data.reconciliation.year, data.reconciliation.months.length], [4, 2026, 12]);
  const fmt = await get(`${F}/report?from=2026-03-01&to=2026-03-31&format=json`);
  check('GET report?format=json -> same JSON shape', [fmt.res.status, fmt.data.overview.grossSales], [200, 348000]);
}

// ---------- admin activity log ----------
{
  const rows = (await env.DB.prepare(`SELECT action FROM admin_activity_log WHERE action LIKE 'finance_%' ORDER BY id`).all()).results.map((r) => r.action);
  const uniq = [...new Set(rows)].sort();
  check('admin_activity_log: every finance write is logged', uniq, ['finance_bank_actual_set', 'finance_document_added', 'finance_document_deleted', 'finance_expense_added', 'finance_expense_deleted', 'finance_rate_changed', 'finance_report_exported']);
}

done();
