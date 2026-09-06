// hosting/api/admin-finance.js — CONTRACT.md ga qarang. Route topilmasa null qaytaradi.
//
// MOLIYA / BUXGALTERIYA — faqat Super Admin (manager → 403). server/admin.js
// + server/db.js'dagi finance_* mantiqining D1 (SQLite) porti: web_orders /
// bot_orders'dan FAQAT O'QIYDI, finance_* jadvallarini boshqaradi. Javob
// shakllari legacy Express bilan bir xil (src/pages/AdminPage.jsx FinanceTab
// shunga bog'langan). /api/admin/finance/overview core dispatch'da (worker.js).
//
//   GET    /api/admin/finance/transactions   ?range=|from=&to=&type=|kind=&status=&q=&page=&limit=
//   GET    /api/admin/finance/reconciliation ?year=YYYY | ?period=YYYY-MM
//   POST   /api/admin/finance/bank-actual    {period, actualAmount, note}
//   GET    /api/admin/finance/rates
//   POST   /api/admin/finance/rates          {scope, params|key+value, effectiveFrom?, note?}
//   GET    /api/admin/finance/expenses       ?from=&to=
//   POST   /api/admin/finance/expenses       {title, category, amount, spentOn?, note?}
//   DELETE /api/admin/finance/expenses/:id
//   GET    /api/admin/finance/documents
//   POST   /api/admin/finance/documents      {name|title, docType|kind, period, url|fileUrl | dataUrl}
//   DELETE /api/admin/finance/documents/:id
//   GET    /api/admin/finance/report         ?range=... → XLSX (format=json → JSON)
//   GET    /api/admin/finance/reports        ?range=... → JSON {overview, daily, transactions, reconciliation}

const PREFIX = '/api/admin/finance/';
const RATE_SCOPES = ['payme', 'bank', 'tax'];
const EXPENSE_CATEGORIES = ['hosting', 'domain', 'ads', 'printing', 'delivery', 'office', 'salary', 'tax', 'bank', 'other'];
const DOC_TYPES = ['payme_report', 'bank_statement', 'tax', 'invoice', 'receipt', 'other'];
const TX_KINDS = ['card_purchase', 'auction_payment', 'premium_upgrade', 'premium_follow', 'physical_card_order'];
const TX_STATUSES = ['paid', 'cancelled', 'failed_code_taken'];
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;
const YM_RE = /^\d{4}-\d{2}$/;
const DOC_MAX_BYTES = 15 * 1024 * 1024;
const DOC_DATAURL_RE = /^data:(application\/pdf|text\/csv|image\/(?:png|jpeg|jpg|webp)|application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet|application\/vnd\.ms-excel);base64,([A-Za-z0-9+/=\s]+)$/;
const DOC_EXT = { 'application/pdf': 'pdf', 'text/csv': 'csv', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/webp': 'webp', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx', 'application/vnd.ms-excel': 'xls' };

// ---------- umumiy yordamchilar ----------
const ymd = (x) => (x instanceof Date ? x : new Date(x)).toISOString().slice(0, 10);
// Regex + haqiqiy kalendar tekshiruvi (2026-02-30 kabi sanalar o'tmaydi).
function validYmd(s) {
  if (typeof s !== 'string' || !YMD_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}
function validYm(s) {
  if (typeof s !== 'string' || !YM_RE.test(s)) return false;
  const mo = Number(s.slice(5, 7));
  return mo >= 1 && mo <= 12;
}
function parseParams(text) {
  try { const v = JSON.parse(text || '{}'); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; } catch { return {}; }
}
function monthsInRange(fromIso, toIso) {
  const out = [];
  const a = new Date(fromIso); const b = new Date(toIso);
  const endKey = b.getUTCFullYear() * 12 + b.getUTCMonth();
  let y = a.getUTCFullYear(); let m = a.getUTCMonth();
  while (y * 12 + m <= endKey && out.length < 120) {
    out.push(`${y}-${String(m + 1).padStart(2, '0')}`);
    if (++m > 11) { m = 0; y++; }
  }
  return out;
}

// ?range=today|7d|30d|month|prev_month|custom&from=YYYY-MM-DD&to=YYYY-MM-DD
// `from`/`to` berilgan bo'lsa (range qiymatidan qat'i nazar) custom deb
// olinadi; noto'g'ri sana → {error:'bad_date'} (chaqiruvchi 422 qaytaradi).
// Chegara: inclusive (`datetime(created_at) BETWEEN datetime(?) AND datetime(?)`).
function parseRange(url) {
  const range = String(url.searchParams.get('range') || '30d');
  const f = url.searchParams.get('from') || '';
  const t = url.searchParams.get('to') || '';
  if (f && !validYmd(f)) return { error: 'bad_date' };
  if (t && !validYmd(t)) return { error: 'bad_date' };
  const now = new Date();
  const y = now.getUTCFullYear(); const mo = now.getUTCMonth();
  let fromIso; let toIso = now.toISOString();
  if (range === 'custom' || f || t) {
    if (f) fromIso = `${f}T00:00:00.000Z`;
    if (t) toIso = `${t}T23:59:59.999Z`;
    if (!fromIso) fromIso = new Date(Date.now() - 30 * 864e5).toISOString();
    if (f && t && f > t) return { error: 'bad_date' };
    return { fromIso, toIso, range: 'custom' };
  }
  if (range === 'today') fromIso = new Date(Date.UTC(y, mo, now.getUTCDate())).toISOString();
  else if (range === '7d') fromIso = new Date(Date.now() - 7 * 864e5).toISOString();
  else if (range === 'month') fromIso = new Date(Date.UTC(y, mo, 1)).toISOString();
  else if (range === 'prev_month') { fromIso = new Date(Date.UTC(y, mo - 1, 1)).toISOString(); toIso = new Date(Date.UTC(y, mo, 1) - 1).toISOString(); }
  else fromIso = new Date(Date.now() - 30 * 864e5).toISOString();
  return { fromIso, toIso, range: ['today', '7d', 'month', 'prev_month'].includes(range) ? range : '30d' };
}

// ---------- stavkalar (finance_rates) ----------
// Legacy initDb: har scope uchun bitta nol boshlang'ich qator. HARD-CODE YO'Q.
async function ensureRateSeeds(env) {
  const have = new Set(((await env.DB.prepare(`SELECT DISTINCT scope FROM finance_rates`).all()).results || []).map((r) => r.scope));
  const today = ymd(new Date());
  for (const scope of RATE_SCOPES) {
    if (have.has(scope)) continue;
    const params = scope === 'payme' ? { pct: 0, fixed: 0, mode: 'settlement_deducted' }
      : scope === 'bank' ? { cashPct: 0, transferPct: 0, monthlyFee: 0, extraFee: 0 }
        : { turnoverPct: 0, socialMonthly: 0 };
    await env.DB.prepare(`INSERT INTO finance_rates (scope, params, effective_from, note, created_at) VALUES (?, ?, ?, ?, ?)`)
      .bind(scope, JSON.stringify(params), today, "Boshlang'ich — hali to'ldirilmagan", new Date().toISOString()).run();
  }
}
// Berilgan sanaga (YYYY-MM-DD) amal qiladigan scope stavkasi (yo'q bo'lsa eng eskisi, u ham yo'q bo'lsa {}).
async function rateOn(env, scope, dateStr) {
  const row = await env.DB.prepare(`SELECT params FROM finance_rates WHERE scope = ? AND effective_from <= ? ORDER BY effective_from DESC, id DESC LIMIT 1`).bind(scope, dateStr).first();
  if (row) return parseParams(row.params);
  const fb = await env.DB.prepare(`SELECT params FROM finance_rates WHERE scope = ? ORDER BY effective_from ASC, id ASC LIMIT 1`).bind(scope).first();
  return fb ? parseParams(fb.params) : {};
}
// Kunlik keshlangan rateOn — computePeriod / daily uchun.
function rateCache(env, scope) {
  const cache = new Map();
  return async (day) => {
    if (!cache.has(day)) cache.set(day, await rateOn(env, scope, day));
    return cache.get(day);
  };
}
const rateRow = (r) => ({ id: r.id, scope: r.scope, params: parseParams(r.params), effectiveFrom: String(r.effective_from).slice(0, 10), note: r.note, createdAt: r.created_at });
async function getRates(env) {
  const rows = (await env.DB.prepare(`SELECT id, scope, params, effective_from, note, created_at FROM finance_rates ORDER BY scope, effective_from DESC, id DESC`).all()).results || [];
  const today = ymd(new Date());
  const current = {};
  const history = { payme: [], bank: [], tax: [] };
  for (const raw of rows) {
    const r = rateRow(raw);
    (history[r.scope] || (history[r.scope] = [])).push(r);
    if (!current[r.scope] && r.effectiveFrom <= today) current[r.scope] = r;
  }
  for (const s of RATE_SCOPES) if (!current[s] && history[s]?.length) current[s] = history[s][history[s].length - 1];
  return { current, history };
}

// ---------- davr hisob-kitobi (legacy financeComputePeriod porti) ----------
const paymeFeeFor = (price, p) => Math.round(price * (Number(p.pct) || 0) / 100) + (Number(p.fixed) || 0);
async function computePeriod(env, fromIso, toIso) {
  const [web, bot] = await Promise.all([
    env.DB.prepare(`SELECT kind, price, substr(created_at,1,10) AS day FROM web_orders WHERE status = 'paid' AND datetime(created_at) BETWEEN datetime(?) AND datetime(?)`).bind(fromIso, toIso).all(),
    env.DB.prepare(`SELECT price, substr(created_at,1,10) AS day FROM bot_orders WHERE status = 'paid' AND datetime(created_at) BETWEEN datetime(?) AND datetime(?)`).bind(fromIso, toIso).all().catch(() => ({ results: [] })),
  ]);
  const orders = [
    ...(web.results || []).map((r) => ({ price: Number(r.price) || 0, kind: r.kind || 'card_purchase', day: r.day })),
    ...(bot.results || []).map((r) => ({ price: Number(r.price) || 0, kind: 'card_purchase', day: r.day })),
  ];
  const paymeOn = rateCache(env, 'payme');
  let grossSales = 0; let paymeFee = 0; const byType = {};
  for (const o of orders) {
    grossSales += o.price;
    byType[o.kind] = (byType[o.kind] || 0) + o.price;
    paymeFee += paymeFeeFor(o.price, await paymeOn(o.day));
  }
  const months = monthsInRange(fromIso, toIso);
  const monthCount = Math.max(1, months.length);
  const toDate = ymd(toIso);
  const [paymeParams, bankParams, taxParams] = await Promise.all([rateOn(env, 'payme', toDate), rateOn(env, 'bank', toDate), rateOn(env, 'tax', toDate)]);
  const paymeMode = paymeParams.mode === 'separate' ? 'separate' : 'settlement_deducted';
  const refunds = 0; // Refund — hozircha tizimda ma'lumot yo'q. Kelajakda alohida jadval.

  const exp = await env.DB.prepare(`SELECT COALESCE(SUM(amount),0) AS total FROM finance_expenses WHERE spent_on BETWEEN ? AND ?`).bind(ymd(fromIso), toDate).first();
  const manualExpenses = Number(exp?.total || 0);

  const bank = await env.DB.prepare(`SELECT COALESCE(SUM(actual_amount),0) AS total, COUNT(*) AS n FROM finance_bank_actuals WHERE period IN (${months.map(() => '?').join(',')})`).bind(...months).first();
  // Davr uchun umuman yozuv bo'lmasa — "hali kiritilmagan" (null), 0 bilan aralashmasin.
  const actualBankSettlement = Number(bank?.n || 0) > 0 ? Number(bank.total || 0) : null;

  const expectedBankSettlement = paymeMode === 'settlement_deducted' ? grossSales - refunds - paymeFee : grossSales - refunds;
  const reconciliationDifference = actualBankSettlement != null ? actualBankSettlement - expectedBankSettlement : null;
  // §8: Payme komissiyasi soliq bazasidan AVTOMATIK chiqarilmaydi.
  const taxBase = grossSales - refunds;
  const turnoverPct = Number(taxParams.turnoverPct) || 0;
  const turnoverTax = Math.round(taxBase * turnoverPct / 100);
  const socialMonthly = Number(taxParams.socialMonthly) || 0;
  const socialTax = socialMonthly * monthCount;
  const bankFees = (Number(bankParams.monthlyFee) || 0) * monthCount + (Number(bankParams.extraFee) || 0);
  const settlementForNet = actualBankSettlement != null ? actualBankSettlement : expectedBankSettlement;
  const netCashFlow = settlementForNet - bankFees - turnoverTax - socialTax - manualExpenses;
  return {
    fromIso, toIso, months,
    grossSales, refunds, paymeFee, paymeMode,
    expectedBankSettlement, actualBankSettlement, reconciliationDifference,
    taxBase, turnoverPct, turnoverTax, socialMonthly, socialTax,
    bankFees, manualExpenses, netCashFlow,
    orderCount: orders.length,
    byType: Object.entries(byType).map(([kind, total]) => ({ kind, total })).sort((a, b) => b.total - a.total),
    rates: { payme: paymeParams, bank: bankParams, tax: taxParams },
    ratesConfigured: Boolean((Number(paymeParams.pct) || Number(paymeParams.fixed)) || Number(taxParams.turnoverPct) || Number(taxParams.socialMonthly) || Number(bankParams.monthlyFee)),
  };
}
async function dailyBreakdown(env, fromIso, toIso) {
  const rows = (await env.DB.prepare(`SELECT substr(created_at,1,10) AS day, COALESCE(SUM(price),0) AS gross, COUNT(*) AS orders FROM web_orders WHERE status = 'paid' AND datetime(created_at) BETWEEN datetime(?) AND datetime(?) GROUP BY substr(created_at,1,10) ORDER BY day`).bind(fromIso, toIso).all()).results || [];
  const paymeOn = rateCache(env, 'payme');
  const out = [];
  for (const r of rows) {
    const p = await paymeOn(r.day);
    const gross = Number(r.gross); const orders = Number(r.orders);
    const fee = Math.round(gross * (Number(p.pct) || 0) / 100) + (Number(p.fixed) || 0) * orders;
    out.push({ day: r.day, gross, orders, paymeFee: fee, expected: gross - fee });
  }
  return out;
}
// Oy bo'yicha reconciliation: expected (hisob) ↔ actual (admin kiritgan).
async function monthlyReconciliation(env, year) {
  const y = String(year);
  const [actuals, sales] = await Promise.all([
    env.DB.prepare(`SELECT period, actual_amount, note, updated_at FROM finance_bank_actuals WHERE period LIKE ? ORDER BY period`).bind(`${y}-%`).all(),
    env.DB.prepare(`SELECT substr(created_at,1,7) AS period, COALESCE(SUM(price),0) AS gross, COUNT(*) AS orders FROM web_orders WHERE status = 'paid' AND substr(created_at,1,4) = ? GROUP BY substr(created_at,1,7)`).bind(y).all(),
  ]);
  const actualMap = Object.fromEntries((actuals.results || []).map((a) => [a.period, a]));
  const salesMap = Object.fromEntries((sales.results || []).map((s) => [s.period, s]));
  const out = [];
  for (let mo = 1; mo <= 12; mo++) {
    const period = `${y}-${String(mo).padStart(2, '0')}`;
    const gross = Number(salesMap[period]?.gross || 0);
    const orders = Number(salesMap[period]?.orders || 0);
    const p = await rateOn(env, 'payme', `${period}-15`);
    const paymeFee = Math.round(gross * (Number(p.pct) || 0) / 100) + (Number(p.fixed) || 0) * orders;
    const expected = p.mode === 'separate' ? gross : gross - paymeFee;
    const a = actualMap[period];
    const actual = a ? Number(a.actual_amount) : null;
    const diff = actual != null ? actual - expected : null;
    const status = actual == null ? 'pending' : diff === 0 ? 'matched' : 'difference';
    out.push({ period, gross, orders, paymeFee, expected, actual, diff, status, note: a?.note || '' });
  }
  return out;
}

// Tranzaksiyalar ro'yxati (sayt + bot buyurtmalari birlashtirilgan, legacy shakl).
async function listTransactions(env, { fromIso, toIso, type = '', status = '', q = '', page = 1, limit = 50 }) {
  const lim = Math.min(200, Math.max(10, Number(limit) || 50));
  const pg = Math.max(1, Number(page) || 1);
  const off = (pg - 1) * lim;
  const args = [fromIso, toIso];
  const where = [`w.status <> 'pending'`, `datetime(w.created_at) BETWEEN datetime(?) AND datetime(?)`];
  if (type) { args.push(type); where.push(`w.kind = ?`); }
  if (status) { args.push(status); where.push(`w.status = ?`); }
  if (q) { const like = `%${q}%`; args.push(like, like, like); where.push(`(LOWER(w.code) LIKE LOWER(?) OR LOWER(u.email) LIKE LOWER(?) OR LOWER(w.payme_transaction_id) LIKE LOWER(?))`); }
  const [web, cnt] = await Promise.all([
    env.DB.prepare(`SELECT w.id, 'web' AS source, w.kind, w.code, w.price AS amount, w.status, w.payme_transaction_id AS paymeTxnId, u.email AS userEmail, w.created_at AS createdAt
      FROM web_orders w LEFT JOIN users u ON u.id = w.user_id WHERE ${where.join(' AND ')} ORDER BY datetime(w.created_at) DESC, w.id DESC LIMIT ? OFFSET ?`).bind(...args, lim, off).all(),
    env.DB.prepare(`SELECT COUNT(*) AS n FROM web_orders w LEFT JOIN users u ON u.id = w.user_id WHERE ${where.join(' AND ')}`).bind(...args).first(),
  ]);
  let bot = [];
  if (!type || type === 'card_purchase') {
    const bArgs = [fromIso, toIso];
    const bWhere = [`status <> 'pending'`, `datetime(created_at) BETWEEN datetime(?) AND datetime(?)`];
    if (status) { bArgs.push(status); bWhere.push(`status = ?`); }
    if (q) { bArgs.push(`%${q}%`); bWhere.push(`LOWER(code) LIKE LOWER(?)`); }
    const r = await env.DB.prepare(`SELECT id, 'bot' AS source, 'card_purchase' AS kind, code, price AS amount, status, NULL AS paymeTxnId, tg_name AS userEmail, created_at AS createdAt
      FROM bot_orders WHERE ${bWhere.join(' AND ')} ORDER BY datetime(created_at) DESC LIMIT 100`).bind(...bArgs).all().catch(() => ({ results: [] }));
    bot = r.results || [];
  }
  const items = [...(web.results || []), ...bot]
    .map((r) => ({ ...r, amount: Number(r.amount) }))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return { items, total: Number(cnt?.n || 0) + bot.length, page: pg, limit: lim };
}

const expenseRow = (r) => ({ id: r.id, title: r.title, category: r.category, amount: Number(r.amount), spentOn: String(r.spent_on).slice(0, 10), note: r.note, createdAt: r.created_at });
const docRow = (r) => ({ id: r.id, name: r.name, docType: r.doc_type, period: r.period, url: r.url, createdAt: r.created_at });

// ---------- XLSX (kutubxonasiz): STORE-only ZIP + SpreadsheetML inline strings ----------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(bytes) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function zipStore(files) {
  const enc = new TextEncoder();
  const parts = []; const central = []; let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name); const data = typeof f.data === 'string' ? enc.encode(f.data) : f.data;
    const crc = crc32(data);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
    lh.setUint16(10, 0, true); lh.setUint16(12, 0x21, true); lh.setUint32(14, crc, true); lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true);
    lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
    parts.push(new Uint8Array(lh.buffer), name, data);
    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true); cd.setUint16(4, 20, true); cd.setUint16(6, 20, true); cd.setUint16(8, 0x0800, true); cd.setUint16(10, 0, true);
    cd.setUint16(12, 0, true); cd.setUint16(14, 0x21, true); cd.setUint32(16, crc, true); cd.setUint32(20, data.length, true); cd.setUint32(24, data.length, true);
    cd.setUint16(28, name.length, true); cd.setUint16(30, 0, true); cd.setUint16(32, 0, true); cd.setUint16(34, 0, true); cd.setUint16(36, 0, true); cd.setUint32(38, 0, true); cd.setUint32(42, offset, true);
    central.push(new Uint8Array(cd.buffer), name);
    offset += 30 + name.length + data.length;
  }
  const cdSize = central.reduce((n, p) => n + p.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(4, 0, true); end.setUint16(6, 0, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, cdSize, true); end.setUint32(16, offset, true); end.setUint16(20, 0, true);
  const all = [...parts, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(all.reduce((n, p) => n + p.length, 0));
  let pos = 0; for (const p of all) { out.set(p, pos); pos += p.length; }
  return out;
}
const xmlEsc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
function colRef(i) { let s = ''; let n = i + 1; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }
function sheetXml(rows, widths = []) {
  const cols = widths.length ? `<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>` : '';
  const body = rows.map((row, r) => `<row r="${r + 1}">${(row || []).map((v, c) => {
    if (v == null || v === '') return '';
    const ref = `${colRef(c)}${r + 1}`;
    if (typeof v === 'number' && Number.isFinite(v)) return `<c r="${ref}"><v>${v}</v></c>`;
    return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEsc(v)}</t></is></c>`;
  }).join('')}</row>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${cols}<sheetData>${body}</sheetData></worksheet>`;
}
function buildXlsx(sheets) {
  const files = [
    { name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>` },
    { name: '_rels/.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { name: 'xl/workbook.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s, i) => `<sheet name="${xmlEsc(s.name.slice(0, 31))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>` },
    { name: 'xl/_rels/workbook.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}</Relationships>` },
    ...sheets.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: sheetXml(s.rows, s.widths) })),
  ];
  return zipStore(files);
}

// Buxgalter uchun paket — jamlama + tranzaksiyalar + kunlik + oylik solishtirish.
async function buildReport(env, r) {
  const [ov, daily, tx] = await Promise.all([computePeriod(env, r.fromIso, r.toIso), dailyBreakdown(env, r.fromIso, r.toIso), listTransactions(env, { fromIso: r.fromIso, toIso: r.toIso, limit: 200, page: 1 })]);
  const year = new Date(r.toIso).getUTCFullYear();
  const recon = await monthlyReconciliation(env, year);
  return { overview: ov, daily, transactions: tx, reconciliation: { year, months: recon }, range: r.range };
}
function reportXlsx({ overview: ov, daily, transactions: tx, reconciliation }) {
  const summary = [
    ['MOLIYA HISOBOTI (ichki / dastlabki)', ''],
    ['Oraliq', `${ov.fromIso.slice(0, 10)} … ${ov.toIso.slice(0, 10)}`],
    [],
    ['Jami savdo (gross)', ov.grossSales], ['Refund', ov.refunds], ['Payme komissiyasi', ov.paymeFee],
    ['Payme rejimi', ov.paymeMode === 'settlement_deducted' ? 'Settlementdan ushlanadi' : 'Alohida'],
    ['Payme’dan kutilgan tushum (expected)', ov.expectedBankSettlement],
    ['Bankka real tushgan (actual)', ov.actualBankSettlement == null ? 'kiritilmagan' : ov.actualBankSettlement],
    ['Solishtirish farqi', ov.reconciliationDifference == null ? '—' : ov.reconciliationDifference],
    [],
    ['Soliq bazasi', ov.taxBase], [`Aylanma solig‘i (${ov.turnoverPct}%)`, ov.turnoverTax], ['Ijtimoiy soliq', ov.socialTax],
    ['Bank xizmat haqi', ov.bankFees], ['Boshqa xarajatlar', ov.manualExpenses],
    [],
    ['SOF PUL OQIMI', ov.netCashFlow],
    [],
    ['To‘lov turi bo‘yicha:', ''],
    ...ov.byType.map((b) => [b.kind, b.total]),
  ];
  const txRows = tx.items.map((t) => [String(t.createdAt).slice(0, 10), t.source, t.kind, t.code, t.amount, t.status, t.paymeTxnId || '', t.userEmail || '']);
  return buildXlsx([
    { name: 'Jamlama', rows: summary, widths: [40, 20] },
    { name: 'Tranzaksiyalar', rows: [['Sana', 'Manba', 'Tur', 'Kod', 'Summa', 'Holat', 'Payme txn', 'Foydalanuvchi'], ...txRows], widths: [12, 8, 16, 12, 14, 14, 26, 26] },
    { name: 'Kunlik', rows: [['Kun', 'Buyurtma', 'Gross', 'Payme fee', 'Expected'], ...daily.map((d) => [d.day, d.orders, d.gross, d.paymeFee, d.expected])], widths: [12, 10, 14, 14, 14] },
    { name: `Solishtirish ${reconciliation.year}`, rows: [['Oy', 'Buyurtma', 'Gross', 'Payme fee', 'Expected', 'Actual', 'Farq', 'Holat'], ...reconciliation.months.map((m) => [m.period, m.orders, m.gross, m.paymeFee, m.expected, m.actual == null ? '' : m.actual, m.diff == null ? '' : m.diff, m.status])], widths: [10, 10, 14, 14, 14, 14, 12, 12] },
  ]);
}

// ---------- hujjat fayli (dataUrl) → R2 uploads/fin_<hex>.<ext> ----------
function randomHex(bytes) {
  const b = new Uint8Array(bytes); crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}
async function storeDocDataUrl(env, dataUrl, actor) {
  const m = DOC_DATAURL_RE.exec(dataUrl);
  if (!m) return { error: 'bad_file', status: 422 };
  let bytes;
  try {
    const bin = atob(m[2].replace(/\s+/g, ''));
    bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  } catch { return { error: 'bad_file', status: 422 }; }
  if (!bytes.length) return { error: 'bad_file', status: 422 };
  if (bytes.length > DOC_MAX_BYTES) return { error: 'too_large', status: 413 };
  if (!env.UPLOADS) return { error: 'upload_failed', status: 500 };
  const filename = `fin_${randomHex(10)}.${DOC_EXT[m[1]] || 'bin'}`;
  try {
    await env.UPLOADS.put(`uploads/${filename}`, bytes, {
      httpMetadata: { contentType: m[1], cacheControl: 'public, max-age=31536000, immutable' },
      customMetadata: { uploadedAt: new Date().toISOString(), actor: String(actor || '').slice(0, 120) },
    });
  } catch { return { error: 'upload_failed', status: 500 }; }
  return { url: `/uploads/${filename}` };
}

// ---------- router ----------
function matchRoute(sub, method) {
  const idMatch = sub.match(/^(expenses|documents)\/(\d+)$/);
  if (idMatch) return method === 'DELETE' ? { name: idMatch[1] === 'expenses' ? 'expense_delete' : 'document_delete', id: Number(idMatch[2]) } : null;
  const table = {
    'GET transactions': 'transactions', 'GET reconciliation': 'reconciliation', 'POST bank-actual': 'bank_actual',
    'GET rates': 'rates_get', 'POST rates': 'rates_set',
    'GET expenses': 'expenses_get', 'POST expenses': 'expense_add',
    'GET documents': 'documents_get', 'POST documents': 'document_add',
    'GET report': 'report', 'GET reports': 'reports',
  };
  const name = table[`${method} ${sub}`];
  return name ? { name } : null;
}

export async function handle(request, env, url, H) {
  const path = url.pathname;
  if (!path.startsWith(PREFIX)) return null;
  const route = matchRoute(path.slice(PREFIX.length), request.method);
  if (!route) return null;

  const admin = await H.requireAdmin(request, env);
  if (!admin) return H.json({ error: 'unauthorized' }, 401);
  // Moliyaviy ma'lumot — faqat Super Admin (server/admin.js requireSuperAdmin bilan bir xil).
  if (admin.role !== 'super_admin') return H.json({ error: 'forbidden' }, 403);
  const ip = H.reqIp(request);
  const actor = `admin#${admin.adminId}`;
  const readBody = () => request.json().catch(() => ({})).then((b) => (b && typeof b === 'object' ? b : {}));

  switch (route.name) {
    case 'transactions': {
      const r = parseRange(url);
      if (r.error) return H.json({ error: r.error }, 422);
      const type = H.cleanStr(url.searchParams.get('type') || url.searchParams.get('kind'), 24);
      const status = H.cleanStr(url.searchParams.get('status'), 20);
      if (type && !TX_KINDS.includes(type)) return H.json({ error: 'bad_type' }, 422);
      if (status && !TX_STATUSES.includes(status)) return H.json({ error: 'bad_status' }, 422);
      const data = await listTransactions(env, {
        fromIso: r.fromIso, toIso: r.toIso, type, status,
        q: H.cleanStr(url.searchParams.get('q'), 60),
        page: Number(url.searchParams.get('page')) || 1,
        limit: Number(url.searchParams.get('limit')) || 50,
      });
      return H.json({ ...data, fromIso: r.fromIso, toIso: r.toIso, range: r.range });
    }

    case 'reconciliation': {
      const period = url.searchParams.get('period') || '';
      const yearParam = url.searchParams.get('year');
      if (period && !validYm(period)) return H.json({ error: 'bad_period' }, 422);
      const year = period ? Number(period.slice(0, 4)) : yearParam ? Number(yearParam) : new Date().getUTCFullYear();
      if (!Number.isInteger(year) || year < 2000 || year > 2100) return H.json({ error: 'bad_year' }, 422);
      const months = await monthlyReconciliation(env, year);
      if (period) return H.json({ year, period, month: months.find((m) => m.period === period) || null, months: months.filter((m) => m.period === period) });
      return H.json({ year, months });
    }

    case 'bank_actual': {
      const body = await readBody();
      const period = H.cleanStr(body.period, 7);
      if (!validYm(period)) return H.json({ error: 'bad_period' }, 422);
      const amt = Math.max(0, Math.round(Number(body.actualAmount) || 0));
      const note = H.shortText(body.note, 200) || null;
      const prev = await env.DB.prepare(`SELECT actual_amount FROM finance_bank_actuals WHERE period = ?`).bind(period).first();
      const row = await env.DB.prepare(`INSERT INTO finance_bank_actuals (period, actual_amount, note, updated_at) VALUES (?, ?, ?, ?)
        ON CONFLICT (period) DO UPDATE SET actual_amount = excluded.actual_amount, note = excluded.note, updated_at = excluded.updated_at
        RETURNING period, actual_amount AS actualAmount, note`).bind(period, amt, note, H.nowTs()).first();
      await H.logAdminActivity(env, { action: 'finance_bank_actual_set', details: `${period} → ${amt}`, oldValue: prev ? prev.actual_amount : null, newValue: amt, ip });
      return H.json({ ok: true, row: { period: row.period, actualAmount: Number(row.actualAmount), note: row.note } });
    }

    case 'rates_get': {
      await ensureRateSeeds(env);
      return H.json(await getRates(env));
    }

    case 'rates_set': {
      const body = await readBody();
      const scope = H.cleanStr(body.scope, 12);
      if (!RATE_SCOPES.includes(scope)) return H.json({ error: 'bad_scope' }, 422);
      const effRaw = H.cleanStr(body.effectiveFrom, 10);
      if (effRaw && !validYmd(effRaw)) return H.json({ error: 'bad_date' }, 422);
      const eff = effRaw || ymd(new Date());
      await ensureRateSeeds(env);
      const before = await getRates(env);
      // `params` obyekti (frontend) yoki `key`+`value` (bitta maydon, joriy qiymatlar ustiga).
      let raw = body.params && typeof body.params === 'object' && !Array.isArray(body.params) ? body.params : null;
      if (!raw && typeof body.key === 'string' && body.key) raw = { ...(before.current?.[scope]?.params || {}), [body.key]: body.value };
      if (!raw) return H.json({ error: 'params_required' }, 422);
      const clean = {};
      for (const [k, v] of Object.entries(raw)) {
        if (!/^[A-Za-z_][A-Za-z0-9_]{0,31}$/.test(k)) continue;
        if (k === 'mode') clean.mode = v === 'separate' ? 'separate' : 'settlement_deducted';
        else clean[k] = Math.max(0, Number(v) || 0);
      }
      const row = await env.DB.prepare(`INSERT INTO finance_rates (scope, params, effective_from, note, created_at) VALUES (?, ?, ?, ?, ?) RETURNING id, scope, params, effective_from, note, created_at`)
        .bind(scope, JSON.stringify(clean), eff, H.shortText(body.note, 200) || null, H.nowTs()).first();
      const rate = rateRow(row);
      await H.logAdminActivity(env, { action: 'finance_rate_changed', details: `${scope} → ${eff}`, oldValue: JSON.stringify(before.current?.[scope]?.params || {}), newValue: JSON.stringify(rate.params), ip });
      return H.json({ ok: true, rate });
    }

    case 'expenses_get': {
      const from = url.searchParams.get('from') || '';
      const to = url.searchParams.get('to') || '';
      if ((from && !validYmd(from)) || (to && !validYmd(to))) return H.json({ error: 'bad_date' }, 422);
      const where = []; const args = [];
      if (from) { where.push(`spent_on >= ?`); args.push(from); }
      if (to) { where.push(`spent_on <= ?`); args.push(to); }
      const limit = Math.min(500, Number(url.searchParams.get('limit')) || 200);
      const rows = await env.DB.prepare(`SELECT id, title, category, amount, spent_on, note, created_at FROM finance_expenses ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY spent_on DESC, id DESC LIMIT ?`).bind(...args, limit).all();
      const expenses = (rows.results || []).map(expenseRow);
      return H.json({ expenses, categories: EXPENSE_CATEGORIES, total: expenses.reduce((n, e) => n + e.amount, 0) });
    }

    case 'expense_add': {
      const body = await readBody();
      const title = H.shortText(body.title, 120);
      if (!title) return H.json({ error: 'title_required' }, 422);
      const amount = Math.round(Number(body.amount) || 0);
      if (!(amount > 0)) return H.json({ error: 'bad_amount' }, 422);
      const category = EXPENSE_CATEGORIES.includes(body.category) ? body.category : 'other';
      const spentRaw = H.cleanStr(body.spentOn, 10);
      if (spentRaw && !validYmd(spentRaw)) return H.json({ error: 'bad_date' }, 422);
      const row = await env.DB.prepare(`INSERT INTO finance_expenses (title, category, amount, spent_on, note, created_at) VALUES (?, ?, ?, ?, ?, ?) RETURNING id, title, category, amount, spent_on, note, created_at`)
        .bind(title, category, amount, spentRaw || ymd(new Date()), H.shortText(body.note, 300) || null, H.nowTs()).first();
      const expense = expenseRow(row);
      await H.logAdminActivity(env, { action: 'finance_expense_added', details: `${expense.title} — ${expense.amount}`, ip });
      return H.json({ ok: true, expense });
    }

    case 'expense_delete': {
      const existing = await env.DB.prepare(`SELECT title, amount FROM finance_expenses WHERE id = ?`).bind(route.id).first();
      const res = await env.DB.prepare(`DELETE FROM finance_expenses WHERE id = ?`).bind(route.id).run();
      const ok = Number(res?.meta?.changes || 0) > 0;
      if (ok) await H.logAdminActivity(env, { action: 'finance_expense_deleted', details: `#${route.id} ${existing?.title || ''} — ${existing?.amount ?? ''}`, ip });
      return H.json({ ok });
    }

    case 'documents_get': {
      const limit = Math.min(500, Number(url.searchParams.get('limit')) || 200);
      const rows = await env.DB.prepare(`SELECT id, name, doc_type, period, url, created_at FROM finance_docs ORDER BY created_at DESC, id DESC LIMIT ?`).bind(limit).all();
      return H.json({ documents: (rows.results || []).map(docRow), types: DOC_TYPES });
    }

    case 'document_add': {
      const body = await readBody();
      const name = H.shortText(body.name ?? body.title, 160);
      let docUrl = H.safeUrl(body.url ?? body.fileUrl);
      const dataUrl = typeof body.dataUrl === 'string' ? body.dataUrl : '';
      if (dataUrl) {
        const stored = await storeDocDataUrl(env, dataUrl, actor);
        if (stored.error) return H.json({ error: stored.error }, stored.status);
        docUrl = stored.url;
      }
      if (!name || !docUrl) return H.json({ error: 'name_url_required' }, 422);
      const docTypeRaw = body.docType ?? body.kind;
      const docType = DOC_TYPES.includes(docTypeRaw) ? docTypeRaw : 'other';
      const row = await env.DB.prepare(`INSERT INTO finance_docs (name, doc_type, period, url, created_at) VALUES (?, ?, ?, ?, ?) RETURNING id, name, doc_type, period, url, created_at`)
        .bind(name, docType, H.shortText(body.period, 16) || null, docUrl, H.nowTs()).first();
      const doc = docRow(row);
      await H.logAdminActivity(env, { action: 'finance_document_added', details: doc.name, newValue: doc.url, ip });
      return H.json({ ok: true, doc });
    }

    case 'document_delete': {
      const existing = await env.DB.prepare(`SELECT name, url FROM finance_docs WHERE id = ?`).bind(route.id).first();
      const res = await env.DB.prepare(`DELETE FROM finance_docs WHERE id = ?`).bind(route.id).run();
      const ok = Number(res?.meta?.changes || 0) > 0;
      if (ok) await H.logAdminActivity(env, { action: 'finance_document_deleted', details: `#${route.id} ${existing?.name || ''}`, oldValue: existing?.url || null, ip });
      return H.json({ ok });
    }

    case 'report':
    case 'reports': {
      const r = parseRange(url);
      if (r.error) return H.json({ error: r.error }, 422);
      const data = await buildReport(env, r);
      if (route.name === 'reports' || url.searchParams.get('format') === 'json') return H.json(data);
      const bytes = reportXlsx(data);
      await H.logAdminActivity(env, { action: 'finance_report_exported', details: `Oraliq: ${r.range}`, ip });
      return new Response(bytes, {
        status: 200,
        headers: {
          'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'content-disposition': `attachment; filename="nfcstore_moliya_${r.range}.xlsx"`,
          'cache-control': 'no-store',
        },
      });
    }

    default:
      return null;
  }
}
