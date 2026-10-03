// Cloudflare D1/R2 → O'zbekiston serveri (sqld + Garage) ko'chirish vositasi.
//
// FAQAT GitHub Actions'dan (.github/workflows/uz-server.yml) ishlatiladi —
// kalitlar muhit o'zgaruvchilarida keladi va hech qayerga yozilmaydi.
// Cloudflare tomonida HECH NARSA o'zgartirilmaydi va o'chirilmaydi:
// faqat o'qiladi (D1 eksporti, R2 ro'yxati va yuklab olish).
//
//   node scripts/uz-migrate.mjs r2-probe                 — R2: nechta fayl, jami hajm
//   node scripts/uz-migrate.mjs r2-copy                  — R2 → Garage (bor bo'lsa o'tkazib yuboradi)
//   node scripts/uz-migrate.mjs r2-verify                — har fayl: bor, hajmi va turi bir xil
//   node scripts/uz-migrate.mjs db-import d1.sqlite [--replace]
//   node scripts/uz-migrate.mjs db-verify d1.sqlite      — har jadval: qatorlar soni va SHA-256
//
// Muhit: CF_API_TOKEN, CF_ACCOUNT, R2_BUCKET; UZ_DB_URL, UZ_DB_TOKEN;
// UZ_S3_ENDPOINT, UZ_S3_BUCKET, UZ_S3_KEY_ID, UZ_S3_SECRET.
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { uzDb, uzBucket } from '../hosting/uz-store.js';

const E = process.env;
const [cmd, ...args] = process.argv.slice(2);
const flag = (f) => args.includes(f);
const say = (...a) => console.log(...a);
const md5 = (b) => createHash('md5').update(b).digest('hex');
const sha256 = (s) => createHash('sha256').update(s).digest('hex');
const mb = (n) => `${(n / 1024 / 1024).toFixed(1)} MB`;

function need(...names) {
  const miss = names.filter((n) => !E[n]);
  if (miss.length) { console.error(`Muhit o'zgaruvchisi yo'q: ${miss.join(', ')}`); process.exit(2); }
}

// ── Cloudflare R2 (REST API, faqat o'qish) ────────────────────────────

const CF = () => `${E.CF_API_BASE || 'https://api.cloudflare.com'}/client/v4/accounts/${E.CF_ACCOUNT}/r2/buckets/${E.R2_BUCKET || 'nfcstore-uploads'}`;
const cfHeaders = () => ({ authorization: `Bearer ${E.CF_API_TOKEN}` });

async function r2List() {
  const out = [];
  let cursor = '';
  for (let page = 0; page < 1000; page++) {
    const u = new URL(`${CF()}/objects`);
    u.searchParams.set('per_page', '1000');
    if (cursor) u.searchParams.set('cursor', cursor);
    const res = await fetch(u, { headers: cfHeaders() });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body.success === false) {
      throw new Error(`R2 ro'yxati: HTTP ${res.status} ${JSON.stringify(body.errors || []).slice(0, 200)}`);
    }
    const items = body.result || [];
    out.push(...items);
    const info = body.result_info || {};
    cursor = info.cursor || '';
    if (!items.length || !cursor || info.is_truncated === false) break;
  }
  // Takroriy kalitlar bo'lmasin (sahifalash xatosidan himoya).
  const byKey = new Map(out.map((o) => [o.key, o]));
  return [...byKey.values()].sort((a, b) => (a.key < b.key ? -1 : 1));
}

async function r2Get(key) {
  const res = await fetch(`${CF()}/objects/${encodeURIComponent(key)}`, { headers: cfHeaders() });
  if (!res.ok) throw new Error(`R2 get ${key}: HTTP ${res.status}`);
  return { bytes: new Uint8Array(await res.arrayBuffer()), headers: res.headers };
}

const r2HttpMeta = (o, headers) => {
  const hm = o.http_metadata || o.httpMetadata || {};
  const m = {};
  const ct = hm.contentType || hm.content_type || headers?.get('content-type');
  if (ct) m.contentType = ct;
  const cc = hm.cacheControl || hm.cache_control || headers?.get('cache-control');
  if (cc) m.cacheControl = cc;
  for (const f of ['contentDisposition', 'contentEncoding', 'contentLanguage']) if (hm[f]) m[f] = hm[f];
  return m;
};

const bucket = () => uzBucket({
  endpoint: E.UZ_S3_ENDPOINT, bucket: E.UZ_S3_BUCKET || 'nfcstore-uploads',
  keyId: E.UZ_S3_KEY_ID, secret: E.UZ_S3_SECRET, region: E.UZ_S3_REGION || 'garage',
});

async function uzListAll(b, prefix = '') {
  const out = [];
  let cursor;
  do {
    const page = await b.list({ prefix, cursor });
    out.push(...page.objects);
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return out;
}

async function pool(items, n, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const it = items[i++]; await fn(it); }
  }));
}

const PART = 16 * 1024 * 1024;

async function copyOne(b, o, stats) {
  const r2Etag = String(o.etag || '').replace(/"/g, '');
  const plainMd5 = /^[0-9a-f]{32}$/.test(r2Etag);
  const have = await b.head(o.key);
  if (have && have.size === Number(o.size) && (!plainMd5 || have.etag === r2Etag)) { stats.skipped++; return; }
  const { bytes, headers } = await r2Get(o.key);
  if (bytes.length !== Number(o.size)) throw new Error(`${o.key}: hajm ${bytes.length} ≠ ${o.size}`);
  const sum = md5(bytes);
  if (plainMd5 && sum !== r2Etag) throw new Error(`${o.key}: R2 dan buzuq yuklandi (md5)`);
  const meta = { httpMetadata: r2HttpMeta(o, headers), customMetadata: o.custom_metadata || o.customMetadata || {} };
  if (bytes.length <= PART) {
    const put = await b.put(o.key, bytes, meta);
    if (put.etag !== sum) throw new Error(`${o.key}: Garage md5 mos emas`);
  } else {
    const mp = await b.createMultipartUpload(o.key, meta);
    try {
      const parts = [];
      for (let off = 0, n = 1; off < bytes.length; off += PART, n++) parts.push(await mp.uploadPart(n, bytes.subarray(off, off + PART)));
      await mp.complete(parts);
    } catch (e) { await mp.abort().catch(() => {}); throw e; }
    const h = await b.head(o.key);
    if (h?.size !== bytes.length) throw new Error(`${o.key}: multipart hajmi mos emas`);
  }
  stats.copied++; stats.bytes += bytes.length;
}

async function r2Copy() {
  need('CF_API_TOKEN', 'CF_ACCOUNT', 'UZ_S3_ENDPOINT', 'UZ_S3_KEY_ID', 'UZ_S3_SECRET');
  const list = await r2List();
  const b = bucket();
  const stats = { copied: 0, skipped: 0, bytes: 0, failed: [] };
  await pool(list, 6, async (o) => {
    for (let attempt = 1; ; attempt++) {
      try { await copyOne(b, o, stats); return; } catch (e) {
        if (attempt >= 3) { stats.failed.push(`${o.key}: ${e.message}`); return; }
        await new Promise((r) => setTimeout(r, 2000 * attempt));
      }
    }
  });
  say(`R2 → Garage: jami ${list.length}, ko'chirildi ${stats.copied} (${mb(stats.bytes)}), oldin bor edi ${stats.skipped}, xato ${stats.failed.length}`);
  for (const f of stats.failed.slice(0, 20)) say(`  XATO ${f}`);
  if (stats.failed.length) process.exit(1);
}

async function r2Verify() {
  need('CF_API_TOKEN', 'CF_ACCOUNT', 'UZ_S3_ENDPOINT', 'UZ_S3_KEY_ID', 'UZ_S3_SECRET');
  const [src, dst] = await Promise.all([r2List(), uzListAll(bucket())]);
  const have = new Map(dst.map((o) => [o.key, o]));
  const missing = []; const badSize = []; const badMd5 = [];
  for (const o of src) {
    const d = have.get(o.key);
    if (!d) { missing.push(o.key); continue; }
    if (d.size !== Number(o.size)) badSize.push(o.key);
    const e = String(o.etag || '').replace(/"/g, '');
    if (/^[0-9a-f]{32}$/.test(e) && d.etag !== e) badMd5.push(o.key);
  }
  // Turi (content-type) — tasodifiy 40 ta faylda HEAD bilan.
  const b = bucket();
  const sample = src.filter((o) => have.has(o.key)).filter((_, i, a) => i % Math.max(1, Math.floor(a.length / 40)) === 0).slice(0, 40);
  const badType = [];
  await pool(sample, 6, async (o) => {
    const h = await b.head(o.key);
    const want = r2HttpMeta(o).contentType;
    if (want && h?.httpMetadata.contentType !== want) badType.push(`${o.key} (${h?.httpMetadata.contentType} ≠ ${want})`);
  });
  const srcKeys = new Set(src.map((o) => o.key));
  const dstReal = dst.filter((o) => !o.key.startsWith('_uz_conformance/'));
  const extra = dstReal.filter((o) => !srcKeys.has(o.key));
  const srcBytes = src.reduce((n, o) => n + Number(o.size), 0);
  const dstBytes = dstReal.reduce((n, o) => n + o.size, 0);
  say(`R2: ${src.length} fayl, ${mb(srcBytes)} · Garage: ${dstReal.length} fayl, ${mb(dstBytes)}`);
  say(`yo'q: ${missing.length} · hajmi boshqa: ${badSize.length} · md5 boshqa: ${badMd5.length} · turi boshqa (${sample.length} tadan): ${badType.length} · faqat Garage'da: ${extra.length}`);
  for (const k of [...missing, ...badSize, ...badMd5, ...badType].slice(0, 15)) say(`  ${k}`);
  if (missing.length || badSize.length || badMd5.length || badType.length) process.exit(1);
  say('R2 TEKSHIRUVI: HAMMASI MOS');
}

async function r2Probe() {
  need('CF_API_TOKEN', 'CF_ACCOUNT');
  const list = await r2List();
  const total = list.reduce((n, o) => n + Number(o.size), 0);
  const big = list.filter((o) => Number(o.size) > PART).length;
  const withMeta = list.filter((o) => r2HttpMeta(o).contentType).length;
  const prefixes = {};
  for (const o of list) { const p = o.key.split('/')[0]; prefixes[p] = (prefixes[p] || 0) + 1; }
  say(`R2: ${list.length} fayl, ${mb(total)}, 16 MB dan kattasi ${big} ta, content-type bilan ${withMeta} ta`);
  say(`papkalar: ${JSON.stringify(prefixes)}`);
  if (list[0]) say(`namuna maydonlari: ${Object.keys(list[0]).join(', ')}`);
}

// ── D1 (eksport fayli) → sqld ─────────────────────────────────────────

const qid = (s) => `"${String(s).replace(/"/g, '""')}"`;
const SKIP_TABLE = (n) => /^sqlite_/.test(n) || /^_cf_/.test(n) || /^_uz_/.test(n);

function localSchema(local) {
  return local.prepare(`SELECT type, name, tbl_name, sql FROM sqlite_master WHERE sql IS NOT NULL ORDER BY rowid`).all()
    .filter((r) => !SKIP_TABLE(r.name) && !SKIP_TABLE(r.tbl_name));
}

function tableColumns(local, table) {
  return local.prepare(`PRAGMA table_xinfo(${qid(table)})`).all().filter((c) => !c.hidden).map((c) => c.name);
}

// Qatorning aniq SQL ko'rinishi: quote() turini saqlaydi (INTEGER/REAL/TEXT/BLOB).
function rowsSql(table, cols) {
  return `SELECT ${cols.map((c) => `quote(${qid(c)})`).join(` || ',' || `)} AS q FROM ${qid(table)} ORDER BY ${cols.map(qid).join(', ')}`;
}

async function tableDigest(run, table, cols) {
  const rows = await run(rowsSql(table, cols));
  const h = createHash('sha256');
  for (const r of rows) h.update(`${r.q}\n`);
  return { count: rows.length, sha: h.digest('hex') };
}

async function compare(local, target) {
  const schema = localSchema(local);
  const tables = schema.filter((r) => r.type === 'table').map((r) => r.name);
  const runLocal = async (sql) => local.prepare(sql).all();
  const runTarget = async (sql) => (await target.prepare(sql).all()).results;
  const report = [];
  let ok = true;
  for (const t of tables) {
    const cols = tableColumns(local, t);
    const [a, b] = await Promise.all([tableDigest(runLocal, t, cols), tableDigest(runTarget, t, cols).catch((e) => ({ count: -1, sha: e.message }))]);
    const same = a.count === b.count && a.sha === b.sha;
    if (!same) ok = false;
    report.push({ t, n: a.count, same, target: b.count });
  }
  // AUTOINCREMENT hisoblagichlari (keyingi ID) ham bir xil bo'lsin.
  const seqL = local.prepare(`SELECT name, seq FROM sqlite_sequence ORDER BY name`).all().filter((r) => !SKIP_TABLE(r.name));
  const seqT = (await target.prepare(`SELECT name, seq FROM sqlite_sequence ORDER BY name`).all().catch(() => ({ results: [] }))).results.filter((r) => !SKIP_TABLE(r.name));
  const seqSame = JSON.stringify(seqL.map((r) => [r.name, Number(r.seq)])) === JSON.stringify(seqT.map((r) => [r.name, Number(r.seq)]));
  if (!seqSame) ok = false;
  // Sxema: indekslar, triggerlar, ko'rinishlar nomlari.
  const tSchema = (await target.prepare(`SELECT type, name FROM sqlite_master WHERE sql IS NOT NULL ORDER BY type, name`).all()).results
    .filter((r) => !SKIP_TABLE(r.name)).map((r) => `${r.type}:${r.name}`);
  const lSchema = schema.map((r) => `${r.type}:${r.name}`).sort();
  const schemaSame = JSON.stringify(lSchema) === JSON.stringify([...tSchema].sort());
  if (!schemaSame) ok = false;
  return { ok, report, seqSame, schemaSame, lSchema, tSchema };
}

function printCompare(c) {
  const rows = c.report.reduce((n, r) => n + r.n, 0);
  say(`jadvallar: ${c.report.length} · qatorlar: ${rows} · sxema mos: ${c.schemaSame ? 'ha' : 'YO‘Q'} · AUTOINCREMENT mos: ${c.seqSame ? 'ha' : 'YO‘Q'}`);
  const bad = c.report.filter((r) => !r.same);
  for (const r of bad.slice(0, 20)) say(`  MOS EMAS: ${r.t} (D1 ${r.n} qator, UZ ${r.target})`);
  if (!c.schemaSame) {
    const l = new Set(c.lSchema); const t = new Set(c.tSchema);
    say(`  sxema farqi: faqat D1: ${[...l].filter((x) => !t.has(x)).slice(0, 8).join(', ')} · faqat UZ: ${[...t].filter((x) => !l.has(x)).slice(0, 8).join(', ')}`);
  }
  say(c.ok ? 'BAZA TEKSHIRUVI: HAMMASI MOS (har jadval qatorlari soni va SHA-256)' : 'BAZA TEKSHIRUVI: FARQ BOR');
}

const openLocal = (file) => new DatabaseSync(file, { readOnly: true });
const openTarget = () => uzDb({ url: E.UZ_DB_URL, token: E.UZ_DB_TOKEN, foreignKeys: false });

async function dbImport(file) {
  need('UZ_DB_URL', 'UZ_DB_TOKEN');
  const local = openLocal(file);
  const target = openTarget();
  const existing = (await target.prepare(`SELECT type, name FROM sqlite_master WHERE type IN ('table','view','trigger') AND name NOT LIKE 'sqlite_%'`).all()).results;
  if (existing.length && !flag('--replace')) {
    console.error(`UZ bazasi bo'sh emas (${existing.length} obyekt). Qayta yozish uchun --replace.`);
    process.exit(1);
  }
  if (existing.length) {
    // Avvalgi SINOV nusxasini olib tashlash (workflow buni faqat UZ_STORE
    // yoqilmaganda ruxsat beradi — jonli bazaga tegilmaydi).
    const drops = [
      ...existing.filter((r) => r.type === 'view').map((r) => `DROP VIEW IF EXISTS ${qid(r.name)}`),
      ...existing.filter((r) => r.type === 'trigger').map((r) => `DROP TRIGGER IF EXISTS ${qid(r.name)}`),
      ...existing.filter((r) => r.type === 'table').map((r) => `DROP TABLE IF EXISTS ${qid(r.name)}`),
    ];
    await target.batch(drops.map((s) => target.prepare(s)));
    await target.prepare(`DELETE FROM sqlite_sequence`).run().catch(() => {});
    say(`UZ bazasidagi avvalgi nusxa tozalandi (${existing.length} obyekt)`);
  }

  const schema = localSchema(local);
  const tables = schema.filter((r) => r.type === 'table');
  await target.batch(tables.map((r) => target.prepare(r.sql)));

  let total = 0;
  for (const { name } of tables) {
    const cols = tableColumns(local, name);
    const withoutRowid = /\bWITHOUT\s+ROWID\b/i.test(tables.find((t) => t.name === name).sql);
    const info = local.prepare(`PRAGMA table_info(${qid(name)})`).all();
    const pk = info.filter((c) => c.pk);
    const rowidAlias = pk.length === 1 && /^integer$/i.test(pk[0].type);
    // Yashirin rowid ham saqlansin (INTEGER PRIMARY KEY bo'lmagan jadvallarda).
    const keepRowid = !withoutRowid && !rowidAlias;
    const selCols = keepRowid ? ['rowid', ...cols] : cols;
    const insCols = keepRowid ? ['rowid', ...cols] : cols;
    const sel = `SELECT ${selCols.map((c) => (c === 'rowid' ? 'quote(rowid)' : `quote(${qid(c)})`)).join(` || ',' || `)} AS q FROM ${qid(name)}`;
    const head = `INSERT INTO ${qid(name)} (${insCols.map((c) => (c === 'rowid' ? 'rowid' : qid(c))).join(', ')}) VALUES `;
    let chunk = [];
    const flush = async () => {
      if (!chunk.length) return;
      await target.batch(chunk.map((v) => target.prepare(`${head}(${v})`)));
      chunk = [];
    };
    for (const r of local.prepare(sel).iterate()) {
      chunk.push(r.q);
      total++;
      if (chunk.length >= 200) await flush();
    }
    await flush();
  }

  const rest = schema.filter((r) => r.type !== 'table');
  if (rest.length) await target.batch(rest.map((r) => target.prepare(r.sql)));

  const seq = local.prepare(`SELECT name, seq FROM sqlite_sequence`).all().filter((r) => !SKIP_TABLE(r.name));
  if (seq.length) {
    await target.batch([
      target.prepare(`DELETE FROM sqlite_sequence`),
      ...seq.map((r) => target.prepare(`INSERT INTO sqlite_sequence (name, seq) VALUES (?, ?)`).bind(r.name, Number(r.seq))),
    ]);
  }
  say(`D1 → UZ: ${tables.length} jadval, ${total} qator, ${rest.length} indeks/trigger/ko'rinish yozildi`);

  const fk = (await target.prepare(`PRAGMA foreign_key_check`).all()).results.length;
  const ic = (await target.prepare(`PRAGMA integrity_check`).first())?.integrity_check;
  say(`integrity_check: ${ic} · foreign_key_check: ${fk} ta (D1 dagi bilan bir xil bo'lishi kerak)`);
  const c = await compare(local, target);
  printCompare(c);
  if (!c.ok || ic !== 'ok') process.exit(1);
}

async function dbVerify(file) {
  need('UZ_DB_URL', 'UZ_DB_TOKEN');
  const c = await compare(openLocal(file), openTarget());
  printCompare(c);
  if (!c.ok) process.exit(1);
}

const commands = {
  'r2-probe': r2Probe,
  'r2-copy': r2Copy,
  'r2-verify': r2Verify,
  'db-import': () => dbImport(args.find((a) => !a.startsWith('--'))),
  'db-verify': () => dbVerify(args.find((a) => !a.startsWith('--'))),
};
if (!commands[cmd]) { console.error(`buyruq: ${Object.keys(commands).join(' | ')}`); process.exit(2); }
await commands[cmd]().catch((e) => { console.error(`XATO: ${e.message}`); process.exit(1); });
