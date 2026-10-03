// HAQIQIY ma'lumotlar bilan tenglik sinovi: bir xil worker kodi ikki marta —
//   A) D1 eksport nusxasi (node:sqlite, D1 kabi)        — "Cloudflare'dagi holat"
//   B) O'zbekiston serveri (sqld + Garage, uz-store.js) — "ko'chirilgandan keyin"
// bir xil ochiq GET so'rovlarga javob beradi va javoblar solishtiriladi.
// Jonli saytga (nfcstore.uz) BIRORTA so'rov yuborilmaydi.
//
//   node scripts/uz-parity.mjs d1.sqlite
// Har tomon ALOHIDA jarayonda ishlaydi — worker'ning xotiradagi keshlari
// (sxema, yangiliklar va h.k.) bir tomondan ikkinchisiga o'tib qolmasin.
// Muhit: UZ_DB_URL, UZ_DB_TOKEN, UZ_S3_ENDPOINT, UZ_S3_BUCKET, UZ_S3_KEY_ID, UZ_S3_SECRET
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import worker from '../hosting/worker.js';
import { uzDb, uzBucket } from '../hosting/uz-store.js';

const E = process.env;
const [file, side] = process.argv.slice(2);

// D1 kabi shim (atomik batch) — fayl nusxasi ustida.
function d1Shim(sqlite) {
  const exec = (sql, args) => {
    const s = sqlite.prepare(sql);
    if (s.columns().length) return { success: true, results: s.all(...args).map((r) => ({ ...r })), meta: { changes: 0 } };
    const i = s.run(...args);
    return { success: true, results: [], meta: { changes: Number(i.changes), last_row_id: Number(i.lastInsertRowid) } };
  };
  const stmt = (sql, args = []) => ({
    _sql: sql, _args: args,
    bind: (...a) => stmt(sql, a),
    async all() { return exec(sql, args); },
    async run() { return exec(sql, args); },
    async first(col) { const r = exec(sql, args).results[0]; if (!r) return null; return col === undefined ? r : r[col]; },
  });
  return {
    prepare: (sql) => stmt(sql),
    // SINXRON — parallel batch'lar bitta tranzaksiyaga aralashmaydi (D1 kabi atomik).
    async batch(list) {
      sqlite.exec('BEGIN');
      try { const out = list.map((x) => exec(x._sql, x._args)); sqlite.exec('COMMIT'); return out; } catch (e) { sqlite.exec('ROLLBACK'); throw e; }
    },
  };
}

const vars = (() => {
  try {
    const txt = readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8').replace(/^\s*\/\/.*$/gm, '');
    return JSON.parse(txt).vars || {};
  } catch { return {}; }
})();
const assets = { fetch: async () => new Response('not found', { status: 404 }) };
const ctx = { waitUntil() {}, passThroughOnException() {} };

const makeEnv = (which) => (which === 'A'
  ? { ...vars, DB: d1Shim((() => { const d = new DatabaseSync(file); d.exec('PRAGMA foreign_keys = ON'); return d; })()), ASSETS: assets }
  : {
    ...vars,
    DB: uzDb({ url: E.UZ_DB_URL, token: E.UZ_DB_TOKEN }),
    UPLOADS: uzBucket({ endpoint: E.UZ_S3_ENDPOINT, bucket: E.UZ_S3_BUCKET || 'nfcstore-uploads', keyId: E.UZ_S3_KEY_ID, secret: E.UZ_S3_SECRET }),
    ASSETS: assets,
  });

// Ochiq sahifalar va API'lar — haqiqiy ma'lumotdan olingan kodlar bilan.
// Ro'yxat har ikki jarayonda AYNAN bir xil chiqishi uchun faqat o'qiladi.
const ro = new DatabaseSync(file, { readOnly: true });
const q = (sql) => { try { return ro.prepare(sql).all(); } catch { return []; } };
const codes = q(`SELECT code FROM cards WHERE code IS NOT NULL ORDER BY ts DESC LIMIT 8`).map((r) => r.code);
const companies = q(`SELECT id FROM companies ORDER BY rowid DESC LIMIT 5`).map((r) => r.id);
const paths = [
  '/api/feed', '/api/home-feed', '/api/news', '/api/featured', '/api/catalog/feed', '/api/catalog',
  '/api/marketplace/products', '/api/music/library', '/sitemap-business.xml', '/robots.txt',
  ...codes.flatMap((c) => [`/${c}`, `/api/cards/${c}`, `/api/profile/${c}`]),
  ...companies.flatMap((id) => [`/api/companies/${id}`, `/api/companies/${id}/catalog`, `/c/${id}`]),
];

// Vaqtga bog'liq maydonlar (hozirgi vaqt, so'rov ID) solishtirilmaydi.
const VOLATILE = /^(now|server_time|serverTime|generated_at|generatedAt|request_id|requestId|nonce)$/;
const norm = (v) => {
  if (Array.isArray(v)) return v.map(norm);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).filter(([k]) => !VOLATILE.test(k)).map(([k, x]) => [k, norm(x)]));
  return v;
};
async function call(env, path) {
  const res = await worker.fetch(new Request(`https://nfcstore.uz${path}`, { headers: { 'cf-connecting-ip': '198.51.100.7', accept: 'application/json, text/html' } }), env, ctx);
  const text = await res.text();
  let body = text;
  try { body = norm(JSON.parse(text)); } catch { body = text.replace(/nonce="[^"]*"/g, '').replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z/g, 'T'); }
  return { status: res.status, type: res.headers.get('content-type'), body: typeof body === 'string' ? body : JSON.stringify(body) };
}

if (side) {
  // Bola jarayon: bir tomonning javoblari JSON bo'lib stdout'ga.
  const env = makeEnv(side);
  const out = [];
  for (const p of paths) out.push(await call(env, p));
  process.stdout.write(`\n@@RESULT@@${JSON.stringify(out)}`);
  process.exit(0);
}

const self = fileURLToPath(import.meta.url);
const runSide = (which) => {
  const txt = execFileSync(process.execPath, [self, file, which], { env: E, maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] }).toString();
  return JSON.parse(txt.slice(txt.lastIndexOf('@@RESULT@@') + 10));
};
const resA = runSide('A');
const resB = runSide('B');
let same = 0; const diff = [];
paths.forEach((p, i) => {
  const a = resA[i]; const b = resB[i];
  if (a.status === b.status && a.body === b.body) { same++; return; }
  let at = 0; while (at < a.body.length && a.body[at] === b.body[at]) at++;
  diff.push(`${p}: D1 ${a.status} / UZ ${b.status} · farq ${at}-belgida: «${a.body.slice(Math.max(0, at - 30), at + 50)}» ≠ «${b.body.slice(Math.max(0, at - 30), at + 50)}»`);
});
console.log(`tenglik: ${same}/${paths.length} javob bir xil (${codes.length} profil, ${companies.length} biznes)`);
for (const d of diff.slice(0, 12)) console.log(`  FARQ ${d}`);

// Fayllar: worker /uploads/ orqali O'zbekiston omboridan beradimi (to'liq va qism).
const envB = makeEnv('B');
const keys = (await envB.UPLOADS.list({ prefix: 'uploads/', limit: 5 })).objects.map((o) => o.key);
let mediaOk = 0;
for (const k of keys) {
  const full = await worker.fetch(new Request(`https://nfcstore.uz/${k}`), envB, ctx);
  const part = await worker.fetch(new Request(`https://nfcstore.uz/${k}`, { headers: { range: 'bytes=0-9' } }), envB, ctx);
  const ok = full.status === 200 && part.status === 206 && (await part.arrayBuffer()).byteLength === Math.min(10, Number(full.headers.get('content-length')));
  await full.body?.cancel();
  if (ok) mediaOk++; else console.log(`  FAYL MUAMMO ${k}: ${full.status}/${part.status}`);
}
console.log(`fayllar: ${mediaOk}/${keys.length} — /uploads/ orqali to'liq (200) va qism (206) berildi`);
if (diff.length || mediaOk !== keys.length) process.exit(1);
