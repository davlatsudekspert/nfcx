// hosting/uz-store.js — D1 va R2 adapterlari HAQIQIY D1/R2 kabi ishlaydimi.
//
//   node scripts/test-uz-store.mjs            — soxta sqld + soxta S3 (tarmoqsiz)
//   UZ_TEST_DB_URL=… UZ_TEST_DB_TOKEN=…       — haqiqiy sqld (O'zbekiston serveri)
//   UZ_TEST_S3_ENDPOINT=… UZ_TEST_S3_BUCKET=… UZ_TEST_S3_KEY_ID=… UZ_TEST_S3_SECRET=…
//                                             — haqiqiy Garage
//
// Haqiqiy serverda faqat vaqtinchalik `_uz_conformance_*` jadvali va
// `_uz_conformance/` kalitlari ishlatiladi, oxirida o'chiriladi.
import { DatabaseSync } from 'node:sqlite';
import { uzDb, uzBucket, signV4, isWriteSql, withUzStores, handleUzExport, uzMaintenance, uzMaintenanceBypass, maintenanceResponse, rowLiteralSql, rowColumnsSql, rowPairs, digestPairs, insertForPairs, withR2Fallback, uzLogError, uzWriteProbe } from '../hosting/uz-store.js';
import { hranaFetch } from './lib/hrana-fake.mjs';
import { s3Fetch } from './lib/s3-fake.mjs';

// O'z tekshiruvchisi — d1-harness'ga (va worker.js ga) bog'lanmaydi,
// shuning uchun haqiqiy serverga qarshi alohida ishga tushadi.
let pass = 0; let fail = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(ok ? 'PASS' : 'FAIL', '-', label, ok ? '' : `\n    actual:   ${JSON.stringify(actual)}\n    expected: ${JSON.stringify(expected)}`);
  ok ? pass++ : fail++;
}
const checkTrue = (label, actual) => check(label, !!actual, true);
const done = () => { console.log(`\n${pass} passed, ${fail} failed`); if (fail) process.exit(1); };
const E = process.env;
const realDb = !!(E.UZ_TEST_DB_URL && E.UZ_TEST_DB_TOKEN);
const realS3 = !!(E.UZ_TEST_S3_ENDPOINT && E.UZ_TEST_S3_KEY_ID && E.UZ_TEST_S3_SECRET);
console.log(`baza: ${realDb ? 'HAQIQIY sqld' : 'soxta'} · ombor: ${realS3 ? 'HAQIQIY S3' : 'soxta'}`);

const db = realDb
  ? uzDb({ url: E.UZ_TEST_DB_URL, token: E.UZ_TEST_DB_TOKEN })
  : uzDb({ url: 'https://db.uz.test', token: 'test-token', fetch: hranaFetch(new DatabaseSync(':memory:')) });

const errOf = async (p) => { try { await p; return null; } catch (e) { return String(e?.message || e); } };
const T = `_uz_conformance_${Date.now().toString(36)}`;

// ── D1 ────────────────────────────────────────────────────────────────
try {
  await db.prepare(`CREATE TABLE ${T} (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT UNIQUE, n INTEGER, f REAL, b BLOB, at TEXT DEFAULT (datetime('now')))`).run();

  const ins = await db.prepare(`INSERT INTO ${T} (code, n, f, b) VALUES (?, ?, ?, ?)`)
    .bind('A1', 42, 1.5, new Uint8Array([0, 1, 255])).run();
  check('run: meta.changes = 1', ins.meta.changes, 1);
  check('run: meta.last_row_id = 1', ins.meta.last_row_id, 1);
  check('run: success', ins.success, true);

  const row = await db.prepare(`SELECT code, n, f, b, typeof(n) AS tn, typeof(f) AS tf, typeof(b) AS tb FROM ${T} WHERE id = ?`).bind(1).first();
  check('turlar: INTEGER/REAL/BLOB saqlanadi', [row.tn, row.tf, row.tb], ['integer', 'real', 'blob']);
  check('qiymatlar: matn, son, kasr', [row.code, row.n, row.f], ['A1', 42, 1.5]);
  check('BLOB D1 kabi sonlar massivi', row.b, [0, 1, 255]);

  const uni = "O'zbekiston — Ўзбекистон — Қорақалпоғистон 🇺🇿 \"qo'shtirnoq\" \\ \n yangi qator";
  await db.prepare(`INSERT INTO ${T} (code, n) VALUES (?, ?)`).bind(uni, Number.MAX_SAFE_INTEGER).run();
  const u = await db.prepare(`SELECT code, n FROM ${T} WHERE code = ?`).bind(uni).first();
  check('unicode va maxsus belgilar o‘zgarmaydi', u.code, uni);
  check('2^53-1 aniq', u.n, Number.MAX_SAFE_INTEGER);

  await db.prepare(`INSERT INTO ${T} (code, n, f) VALUES (?, ?, ?)`).bind('B2', true, null).run();
  const bool = await db.prepare(`SELECT n, f FROM ${T} WHERE code = 'B2'`).first();
  check('boolean → 1, null → null', [bool.n, bool.f], [1, null]);

  check('first(): qator yo‘q → null', await db.prepare(`SELECT * FROM ${T} WHERE id = -1`).first(), null);
  check('first(col)', await db.prepare(`SELECT COUNT(*) AS c FROM ${T}`).first('c'), 3);
  checkTrue('first(yo‘q ustun) xato', /D1_COLUMN_NOTFOUND/.test(await errOf(db.prepare(`SELECT 1 AS a`).first('zz')) || ''));

  const base = db.prepare(`SELECT code FROM ${T} WHERE id = ?`);
  const s1 = base.bind(1); const s2 = base.bind(3);
  check('bind yangi statement qaytaradi (eskisi o‘zgarmaydi)', [await s1.first('code'), await s2.first('code')], ['A1', 'B2']);

  const all = await db.prepare(`SELECT id, code FROM ${T} ORDER BY id`).all();
  check('all(): results massiv', all.results.map((r) => r.id), [1, 2, 3]);
  check('all(): SELECT changes = 0', all.meta.changes, 0);

  const raw = await db.prepare(`SELECT id, code FROM ${T} WHERE id = 1`).raw({ columnNames: true });
  check('raw({columnNames})', raw, [['id', 'code'], [1, 'A1']]);

  const ret = await db.prepare(`INSERT INTO ${T} (code) VALUES ('R1') RETURNING id, code`).first();
  check('RETURNING', ret, { id: 4, code: 'R1' });

  const ign = await db.prepare(`INSERT OR IGNORE INTO ${T} (code) VALUES ('A1')`).run();
  check('INSERT OR IGNORE: changes = 0', ign.meta.changes, 0);

  const upd = await db.prepare(`UPDATE ${T} SET n = n + 1 WHERE code IN ('A1', 'B2')`).run();
  check('UPDATE: changes = 2', upd.meta.changes, 2);

  const dup = await errOf(db.prepare(`INSERT INTO ${T} (code) VALUES ('A1')`).run());
  checkTrue('UNIQUE xato matni (kod shunga tayanadi)', /UNIQUE constraint failed/i.test(dup || ''));
  checkTrue('no such table xato matni', /no such table/i.test(await errOf(db.prepare('SELECT * FROM _yoq_jadval_').all()) || ''));
  checkTrue('undefined bog‘lash — D1_TYPE_ERROR', /D1_TYPE_ERROR/.test(await errOf(db.prepare('SELECT ?').bind(undefined).all()) || ''));

  // batch — bitta tranzaksiya
  const res = await db.batch([
    db.prepare(`INSERT INTO ${T} (code) VALUES (?)`).bind('C1'),
    db.prepare(`SELECT COUNT(*) AS c FROM ${T}`),
    db.prepare(`UPDATE ${T} SET n = 7 WHERE code = ?`).bind('C1'),
  ]);
  check('batch: natijalar soni', res.length, 3);
  check('batch: o‘rtadagi SELECT yangi qatorni ko‘radi', res[1].results[0].c, 5);
  check('batch: UPDATE changes', res[2].meta.changes, 1);

  const before = await db.prepare(`SELECT COUNT(*) AS c FROM ${T}`).first('c');
  const bErr = await errOf(db.batch([
    db.prepare(`INSERT INTO ${T} (code) VALUES ('D1')`),
    db.prepare(`INSERT INTO ${T} (code) VALUES ('A1')`), // UNIQUE yiqiladi
    db.prepare(`INSERT INTO ${T} (code) VALUES ('D3')`),
  ]));
  checkTrue('batch: xato otiladi', /UNIQUE/i.test(bErr || ''));
  check('batch: HAMMASI bekor (D1 qo‘shilmadi)', await db.prepare(`SELECT COUNT(*) AS c FROM ${T}`).first('c'), before);
  check('batch: keyingi so‘rov ishlaydi (tranzaksiya ochiq qolmagan)', (await db.prepare(`INSERT INTO ${T} (code) VALUES ('E1')`).run()).meta.changes, 1);
  check('batch: bo‘sh massiv', await db.batch([]), []);

  check('json_extract va datetime', await db.prepare(`SELECT json_extract('{"a":{"b":5}}', '$.a.b') AS j, length(datetime('now')) AS l`).first(), { j: 5, l: 19 });

  // sqld so'rovni qayta yozadi: qo'shtirnoqdagi kalit so'z nomi o'zgarmaydi.
  check('kalit so‘z alias qo‘shtirnoqda saqlanadi', await db.prepare(`SELECT 1 AS "following", 2 AS "plan"`).first(), { following: 1, plan: 2 });
  // Yolg'iz surrogat (emoji o'rtasidan kesilgan) — so'rov yiqilmaydi, D1 kabi U+FFFD.
  const cut = '😀😀'.slice(0, 3);
  await db.prepare(`INSERT INTO ${T} (code) VALUES (?)`).bind(cut).run();
  check('yolg‘iz surrogat — U+FFFD bilan saqlanadi', await db.prepare(`SELECT code FROM ${T} WHERE code LIKE '😀%'`).first('code'), '😀\uFFFD');

  // D1 kabi tashqi kalitlar: ON DELETE CASCADE va yo'q ota-qator xatosi.
  await db.batch([
    db.prepare(`CREATE TABLE ${T}_p (id INTEGER PRIMARY KEY)`),
    db.prepare(`CREATE TABLE ${T}_c (id INTEGER PRIMARY KEY, pid INTEGER REFERENCES ${T}_p(id) ON DELETE CASCADE)`),
    db.prepare(`INSERT INTO ${T}_p (id) VALUES (1)`),
    db.prepare(`INSERT INTO ${T}_c (id, pid) VALUES (10, 1)`),
  ]);
  await db.prepare(`DELETE FROM ${T}_p WHERE id = 1`).run();
  check('FK: ON DELETE CASCADE ishlaydi (D1 kabi)', await db.prepare(`SELECT COUNT(*) AS c FROM ${T}_c`).first('c'), 0);
  checkTrue('FK: yo‘q ota-qator — FOREIGN KEY xatosi', /FOREIGN KEY constraint failed/i.test(await errOf(db.prepare(`INSERT INTO ${T}_c (id, pid) VALUES (11, 99)`).run()) || ''));

  const ex = await db.exec(`UPDATE ${T} SET n = 0 WHERE code = 'E1'; UPDATE ${T} SET n = 1 WHERE code = 'E1'`);
  check('exec: statement soni', ex.count, 2);
} finally {
  for (const t of [`${T}_c`, `${T}_p`, T]) await db.prepare(`DROP TABLE IF EXISTS ${t}`).run().catch(() => {});
}

// isWriteSql — batch BEGIN turi uchun
check('isWriteSql', ['SELECT 1', 'PRAGMA table_info(x)', 'INSERT INTO x VALUES (1)', ' update x set a=1', 'WITH a AS (SELECT 1) DELETE FROM x', 'PRAGMA foreign_keys = ON'].map(isWriteSql),
  [false, false, true, true, true, true]);

// ── SigV4: AWS rasmiy namunasi (GET Object, Range) ───────────────────
{
  const h = await signV4({
    method: 'GET', url: 'https://examplebucket.s3.amazonaws.com/test.txt',
    headers: { range: 'bytes=0-9' },
    payloadHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    keyId: 'AKIAIOSFODNN7EXAMPLE', secret: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY', region: 'us-east-1',
    now: new Date('2013-05-24T00:00:00Z'),
  });
  check('SigV4 = AWS hujjatidagi imzo',
    /Signature=([0-9a-f]+)/.exec(h.authorization)?.[1],
    'f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41');
}

// ── R2 ────────────────────────────────────────────────────────────────
const bucket = realS3
  ? uzBucket({ endpoint: E.UZ_TEST_S3_ENDPOINT, bucket: E.UZ_TEST_S3_BUCKET || 'nfcstore-uploads', keyId: E.UZ_TEST_S3_KEY_ID, secret: E.UZ_TEST_S3_SECRET, region: E.UZ_TEST_S3_REGION || 'garage' })
  : uzBucket({ endpoint: 'https://s3.uz.test', bucket: 'test-bucket', keyId: 'GKtest', secret: 'x', fetch: s3Fetch({ bucket: 'test-bucket' }) });
const P = `_uz_conformance/${Date.now().toString(36)}`;
const keys = [];
const bytesOf = async (o) => new Uint8Array(await o.arrayBuffer());
try {
  const data = new Uint8Array(1000).map((_, i) => i % 251);
  const k1 = `${P}/a_0123456789ab.jpg`; keys.push(k1);
  await bucket.put(k1, data, {
    httpMetadata: { contentType: 'image/jpeg', cacheControl: 'public, max-age=31536000, immutable' },
    customMetadata: { uploadedAt: '2026-10-03T00:00:00.000Z', actor: 'user:1' },
  });
  const head = await bucket.head(k1);
  check('head: hajm', head?.size, 1000);
  check('head: content-type va cache-control', [head?.httpMetadata.contentType, head?.httpMetadata.cacheControl], ['image/jpeg', 'public, max-age=31536000, immutable']);
  check('head: customMetadata', [head?.customMetadata.uploadedat || head?.customMetadata.uploadedAt, head?.customMetadata.actor], ['2026-10-03T00:00:00.000Z', 'user:1']);
  checkTrue('head: httpEtag qo‘shtirnoqda', /^".+"$/.test(head?.httpEtag || ''));
  const hh = new Headers(); head.writeHttpMetadata(hh);
  check('writeHttpMetadata', [hh.get('content-type'), hh.get('cache-control')], ['image/jpeg', 'public, max-age=31536000, immutable']);

  const full = await bucket.get(k1);
  check('get: baytlar aynan', Array.from(await bytesOf(full)).join(), Array.from(data).join());
  const part = await bucket.get(k1, { range: { offset: 10, length: 5 } });
  check('get range offset/length', Array.from(await bytesOf(part)), [10, 11, 12, 13, 14]);
  check('get range: size = to‘liq hajm', part.size, 1000);
  const tail = await bucket.get(k1, { range: { suffix: 3 } });
  check('get range suffix', Array.from(await bytesOf(tail)), Array.from(data.slice(997)));

  check('get: yo‘q kalit → null', await bucket.get(`${P}/yoq.jpg`), null);
  check('head: yo‘q kalit → null', await bucket.head(`${P}/yoq.jpg`), null);

  const k2 = `${P}/nom bo'shliq+ü (1).txt`; keys.push(k2);
  await bucket.put(k2, 'salom', { httpMetadata: { contentType: 'text/plain' } });
  check('maxsus belgili kalit', await (await bucket.get(k2)).text(), 'salom');

  // multipart: 5 MiB + kichik oxirgi bo'lak (worker shunday yozadi)
  const k3 = `${P}/video_0123456789ab.mp4`; keys.push(k3);
  const big = new Uint8Array(5 * 1024 * 1024 + 777).map((_, i) => (i * 7) % 256);
  const mp = await bucket.createMultipartUpload(k3, { httpMetadata: { contentType: 'video/mp4' } });
  const parts = [await mp.uploadPart(1, big.subarray(0, 5 * 1024 * 1024)), await mp.uploadPart(2, big.subarray(5 * 1024 * 1024))];
  await mp.complete(parts);
  const mh = await bucket.head(k3);
  check('multipart: hajm', mh?.size, big.length);
  check('multipart: content-type', mh?.httpMetadata.contentType, 'video/mp4');
  const mr = await bucket.get(k3, { range: { offset: 5 * 1024 * 1024 - 2, length: 4 } });
  check('multipart: bo‘laklar chegarasi to‘g‘ri ulangan', Array.from(await bytesOf(mr)), Array.from(big.subarray(5 * 1024 * 1024 - 2, 5 * 1024 * 1024 + 2)));

  const k5 = `${P}/mp-ret.bin`; keys.push(k5);
  const mp5 = await bucket.createMultipartUpload(k5, { httpMetadata: { contentType: 'video/mp4' } });
  const ret = await mp5.complete([await mp5.uploadPart(1, new Uint8Array(5 * 1024 * 1024)), await mp5.uploadPart(2, new Uint8Array(3))]);
  check('multipart complete: HEAD siz natija (hajm, tur)', [ret.size, ret.httpMetadata.contentType, /^".+"$/.test(ret.httpEtag)], [5 * 1024 * 1024 + 3, 'video/mp4', true]);

  const k4 = `${P}/abort.bin`;
  const ab = await bucket.createMultipartUpload(k4);
  await ab.uploadPart(1, new Uint8Array(10));
  await ab.abort();
  check('multipart abort: obyekt yo‘q', await bucket.head(k4), null);

  // list: sahifalab (limit 2) — barcha kalitlar, hajmlar bilan
  const seen = []; let cursor;
  do {
    const page = await bucket.list({ prefix: `${P}/`, limit: 2, cursor });
    seen.push(...page.objects.map((o) => [o.key, o.size]));
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  check('list: sahifalab hamma kalit', seen.sort(), [[k1, 1000], [k2, 5], [k3, big.length], [k5, 5 * 1024 * 1024 + 3]].sort());

  await bucket.delete(k1);
  check('delete: o‘chdi', await bucket.head(k1), null);
  await bucket.delete([k2, k3, `${P}/yoq-kalit`]);
  check('delete massiv (yo‘q kalit xato emas)', [await bucket.head(k2), await bucket.head(k3)], [null, null]);
} finally {
  await bucket.delete(keys).catch(() => {});
}

// ── withUzStores ─────────────────────────────────────────────────────
{
  const base = { DB: { d1: true }, UPLOADS: { r2: true } };
  check('UZ_STORE yo‘q — env o‘zgarmaydi', withUzStores(base) === base, true);
  const half = { ...base, UZ_STORE: 'on', UZ_DB_URL: 'https://db' };
  check('yarim sozlangan — D1/R2 da qoladi', withUzStores(half).DB, { d1: true });
  const fullEnv = { ...base, UZ_STORE: 'on', UZ_DB_URL: 'https://db', UZ_DB_TOKEN: 't', UZ_S3_ENDPOINT: 'https://s3', UZ_S3_BUCKET: 'b', UZ_S3_KEY_ID: 'k', UZ_S3_SECRET: 's' };
  const w = withUzStores(fullEnv);
  checkTrue('yoqilgan — DB adapter', typeof w.DB.prepare === 'function' && w.DB !== base.DB);
  checkTrue('yoqilgan — UPLOADS adapter', typeof w.UPLOADS.createMultipartUpload === 'function');
  check('bir marta o‘raladi (kesh)', withUzStores(fullEnv) === w, true);
}

// ── D1 eksporti (vaqtinchalik kalit bilan) ───────────────────────────
{
  const sq = new DatabaseSync(':memory:');
  sq.exec(`CREATE TABLE p (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, score REAL);
    INSERT INTO p (name, score) VALUES ('Ali', 1.0), ('Вали', 2.5), (NULL, NULL);
    CREATE TABLE w (k TEXT PRIMARY KEY, v BLOB) WITHOUT ROWID; INSERT INTO w VALUES ('a', X'01'), ('b', NULL);`);
  const run = (sql, a) => { const st = sq.prepare(sql); return st.columns().length ? { results: st.all(...a).map((r) => ({ ...r })) } : (st.run(...a), { results: [] }); };
  const st = (sql, a = []) => ({ bind: (...b) => st(sql, b), all: async () => run(sql, a) });
  const D = { prepare: (sql) => st(sql) };
  const KEY = 'k'.repeat(40);
  const call = (path, key, env = { DB: D, UZ_EXPORT_KEY: KEY }) => handleUzExport(new Request(`https://nfcstore.uz${path}`, { headers: key ? { 'x-uz-export-key': key } : {} }), env);
  check('eksport: boshqa yo‘l — null', await call('/api/feed', KEY), null);
  check('eksport: kalitsiz — 404', (await call('/__uz/export?op=schema')).status, 404);
  check('eksport: noto‘g‘ri kalit — 404', (await call('/__uz/export?op=schema', 'x'.repeat(40))).status, 404);
  check('eksport: secret qisqa/yo‘q — 404 (o‘chiq)', (await call('/__uz/export?op=schema', 'short', { DB: D, UZ_EXPORT_KEY: 'short' })).status, 404);
  const sc = await (await call('/__uz/export?op=schema', KEY)).json();
  check('eksport: sxema jadvallari', sc.master.filter((r) => r.type === 'table').map((r) => r.name), ['p', 'w']);
  check('eksport: ustunlar', sc.columns.p, ['id', 'name', 'score']);
  check('eksport: AUTOINCREMENT', sc.sequence, [{ name: 'p', seq: 3 }]);
  const r1 = await (await call('/__uz/export?op=rows&table=p&limit=2', KEY)).json();
  check('eksport: qatorlar (ustunma-ustun), sahifa', r1.rows, [['1', [['integer', '1'], ['text', 'Ali'], ['real', '1.0']]], ['2', [['integer', '2'], ['text', 'Вали'], ['real', '2.5']]]]);
  const r2 = await (await call(`/__uz/export?op=rows&table=p&limit=2&after=${r1.next}`, KEY)).json();
  check('eksport: keyingi sahifa', [r2.rows, r2.next], [[['3', [['integer', '3'], ['null', null], ['null', null]]]], null]);
  const r3 = await (await call('/__uz/export?op=rows&table=w', KEY)).json();
  check('eksport: WITHOUT ROWID', [r3.rowid, r3.rows], [false, [[null, [['text', 'a'], ['blob', '01']]], [null, [['text', 'b'], ['null', null]]]]]);
  // 120 ustunli jadval — D1 ning 100 ustun chegarasi: guruhlarga bo'linib birlashtiriladi.
  sq.exec(`CREATE TABLE wide (${Array.from({ length: 120 }, (_, i) => `k${i} TEXT`).join(', ')})`);
  sq.prepare(`INSERT INTO wide VALUES (${Array.from({ length: 120 }, () => '?').join(', ')})`).run(...Array.from({ length: 120 }, (_, i) => `v${i}`));
  const wr = await (await call('/__uz/export?op=rows&table=wide', KEY)).json();
  check('eksport: 120 ustun (guruhlab) — hamma qiymat joyida', [wr.rows.length, wr.rows[0][1].length, wr.rows[0][1][0], wr.rows[0][1][119]], [1, 120, ['text', 'v0'], ['text', 'v119']]);
  check('eksport: noma‘lum jadval rad etiladi', (await (await call('/__uz/export?op=rows&table=p%22;DROP', KEY)).json()).error, 'no_table');
  const dg = await (await call('/__uz/export?op=digest&table=p', KEY)).json();
  check('eksport: digest = uz-migrate bilan bir xil algoritm', dg, { count: 3, sha: await digestPairs([[['integer', '1'], ['text', 'Ali'], ['real', '1.0']], [['integer', '2'], ['text', 'Вали'], ['real', '2.5']], [['integer', '3'], ['null', null], ['null', null]]]) });
}

// ── Ustunma-ustun ko'rinish: NUL, REAL aniqligi, BLOB, katta son, 2.5 MB matn ──
{
  const sq = new DatabaseSync(':memory:');
  sq.exec(`CREATE TABLE a (id INTEGER PRIMARY KEY, t TEXT, r REAL, b BLOB, n);
    INSERT INTO a VALUES (1, 'salom' || char(0) || ' dunyo', 0.30000000000000004, X'00FF', 9007199254740993),
      (2, '', 1e308, NULL, -1), (3, 'Ўзбек 🇺🇿', -2.5, X'', NULL);
    CREATE TABLE b (id INTEGER PRIMARY KEY, t TEXT, r REAL, b BLOB, n);`);
  sq.prepare(`INSERT INTO a VALUES (4, ?, 2.0, NULL, 1.5)`).run('x'.repeat(2_500_000));
  const cols = ['id', 't', 'r', 'b', 'n'];
  for (const r of sq.prepare(`SELECT ${rowColumnsSql(cols)} FROM a`).all()) {
    const { sql, args } = insertForPairs('b', cols, rowPairs(r, cols.length));
    sq.prepare(sql).run(...args);
  }
  const dig = (t) => digestPairs(sq.prepare(`SELECT ${rowColumnsSql(cols)} FROM ${t} ORDER BY id`).all().map((r) => rowPairs(r, cols.length)));
  check('juftlik: NUL bilan matn baytma-bayt tiklanadi', sq.prepare(`SELECT length(CAST(t AS BLOB)) n FROM b WHERE id = 1`).get().n, 12);
  check('juftlik: REAL, BLOB, 2^53+2 aniq', sq.prepare(`SELECT quote(r) r, hex(b) b, quote(n) n FROM b WHERE id = 1`).get(), { r: '3.000000000000000445e-01', b: '00FF', n: '9007199254740993' });
  check('juftlik: turlar saqlanadi (REAL 2.0, ustunsiz 1.5)', sq.prepare(`SELECT typeof(r) r, typeof(n) n FROM b WHERE id = 4`).get(), { r: 'real', n: 'real' });
  check('juftlik: 2.5 MB matn hex siz (D1 2 MB chegarasi)', sq.prepare(`SELECT length(t) n FROM b WHERE id = 4`).get().n, 2_500_000);
  check('xesh: manba va nusxa bir xil', await dig('a') === await dig('b'), true);
  sq.exec(`UPDATE b SET t = 'salom' WHERE id = 1`);
  check('xesh: NUL dan keyingi qism yo‘qolsa — FARQ', await dig('a') === await dig('b'), false);
  check('literal (UZ ga yozish): NUL matn', sq.prepare(`SELECT ${rowLiteralSql(['t'])} AS q FROM a WHERE id = 1`).get().q, "CAST(X'73616C6F6D002064756E796F' AS TEXT)");
}

// ── Texnik ishlar rejimi ─────────────────────────────────────────────
{
  check('UZ_MAINTENANCE=on', [uzMaintenance({ UZ_MAINTENANCE: 'on' }), uzMaintenance({})], [true, false]);
  const K = 'z'.repeat(40);
  const rq = (h) => new Request('https://nfcstore.uz/api/feed', { headers: h });
  check('texnik rejim: kalit bilan o‘tadi, kalitsiz/noto‘g‘ri/qisqa — yo‘q', [
    await uzMaintenanceBypass(rq({ 'x-uz-export-key': K }), { UZ_EXPORT_KEY: K }),
    await uzMaintenanceBypass(rq({}), { UZ_EXPORT_KEY: K }),
    await uzMaintenanceBypass(rq({ 'x-uz-export-key': 'y'.repeat(40) }), { UZ_EXPORT_KEY: K }),
    await uzMaintenanceBypass(rq({ 'x-uz-export-key': 'off' }), { UZ_EXPORT_KEY: 'off' }),
  ], [true, false, false, false]);
  const api = maintenanceResponse(new Request('https://nfcstore.uz/api/feed', { headers: { accept: 'text/html' } }));
  check('texnik rejim: API — 503 JSON', [api.status, api.headers.get('content-type').split(';')[0], api.headers.get('retry-after')], [503, 'application/json', '300']);
  const page = maintenanceResponse(new Request('https://nfcstore.uz/ABC123', { headers: { accept: 'text/html' } }));
  check('texnik rejim: sahifa — 503 HTML', [page.status, page.headers.get('content-type').split(';')[0]], [503, 'text/html']);
}

// ── Birlashtirish: parallel so'rovlar BITTA HTTP da, xatolar alohida ──
{
  let calls = 0;
  // UZ_TEST_DB_URL berilsa — HAQIQIY sqld da (xatodan keyin pipeline davom etadimi).
  const hf = E.UZ_TEST_DB_URL ? (...a) => fetch(...a) : hranaFetch(new DatabaseSync(':memory:'));
  const cdb = E.UZ_TEST_DB_URL
    ? uzDb({ url: E.UZ_TEST_DB_URL, token: E.UZ_TEST_DB_TOKEN, fetch: (...a) => { calls++; return hf(...a); } })
    : uzDb({ url: 'https://db.uz.test', token: 'test-token', fetch: (...a) => { calls++; return hf(...a); } });
  await cdb.exec('DROP TABLE IF EXISTS co; CREATE TABLE co (id INTEGER PRIMARY KEY, v TEXT NOT NULL)');
  calls = 0;
  const res = await Promise.allSettled([
    cdb.prepare('INSERT INTO co (id, v) VALUES (1, ?)').bind('a').run(),
    cdb.prepare('INSERT INTO co (id, v) VALUES (1, ?)').bind('dup').run(),       // PK xatosi — faqat o'zi
    cdb.batch([cdb.prepare('INSERT INTO co (id, v) VALUES (2, ?)').bind('b'),
      cdb.prepare('INSERT INTO co (id, v) VALUES (3, NULL)')]),                   // NOT NULL — butun batch bekor
    cdb.prepare('INSERT INTO co (id, v) VALUES (4, ?)').bind('d').run(),
    cdb.prepare('SELECT COUNT(*) AS n FROM co').first('n'),
  ]);
  check('birlashtirish: 5 ta parallel so‘rov — 1 HTTP', calls, 1);
  check('birlashtirish: har biri o‘z natijasi/xatosi', res.map((r) => r.status), ['fulfilled', 'rejected', 'rejected', 'fulfilled', 'fulfilled']);
  checkTrue('birlashtirish: PK xatosi D1 matni bilan', /UNIQUE constraint failed/.test(String(res[1].reason?.message)));
  const rows = (await cdb.prepare('SELECT id, v FROM co ORDER BY id').all()).results.map((r) => `${r.id}${r.v}`);
  check('birlashtirish: batch yaxlit bekor, qolganlar yozildi', rows, ['1a', '4d']);
  calls = 0;
  await Promise.all(Array.from({ length: 130 }, (_, i) => cdb.prepare('SELECT ? AS x').bind(i).first('x')));
  check('birlashtirish: 130 so‘rov — 60 talik bo‘laklarda 3 HTTP', calls, 3);
  calls = 0;
  await cdb.prepare('SELECT 1').first(); await cdb.prepare('SELECT 2').first();
  check('ketma-ket await — har biri alohida HTTP', calls, 2);
  await cdb.exec('DROP TABLE IF EXISTS co');
}

// ── Post-cutover audit: fallback hodisasi, manba belgisi, xato logi, yozish probi ──
{
  const sf = s3Fetch({ bucket: 'fb' });
  const uzB = uzBucket({ endpoint: 'https://s3.uz.test', bucket: 'fb', keyId: 'k', secret: 's', fetch: sf });
  const r2store = new Map([['uploads/old.png', new Uint8Array([1, 2, 3])]]);
  const r2 = {
    async head(k) { return r2store.has(k) ? { key: k, size: r2store.get(k).length } : null; },
    async get(k) { return r2store.has(k) ? { key: k, size: r2store.get(k).length, arrayBuffer: async () => r2store.get(k).buffer } : null; },
    async delete(ks) { for (const k of [].concat(ks)) r2store.delete(k); },
  };
  const events = [];
  const fb = withR2Fallback(uzB, r2, async (op, key) => { events.push(`${op}:${key}`); });
  await uzB.put('uploads/new.png', new Uint8Array([9]));
  const a = await fb.head('uploads/new.png');
  check('fallback: UZ dagi fayl — manba uz, hodisa yo‘q', [a?.nfcStore, events.length], ['uz', 0]);
  const b = await fb.get('uploads/old.png');
  check('fallback: faqat R2 dagi fayl — manba r2, hodisa yozildi', [b?.nfcStore, events], ['r2', ['get:uploads/old.png']]);
  check('fallback: ikkalasida yo‘q — null, hodisa yo‘q', [await fb.head('uploads/none.png'), events.length], [null, 1]);
  await fb.delete(['uploads/old.png']);
  check('fallback: o‘chirish R2 mirror ham qayd etiladi', events.at(-1), 'delete-mirror:uploads/old.png');

  const edb = uzDb({ url: 'https://db.uz.test', token: 'test-token', fetch: hranaFetch(new DatabaseSync(':memory:')) });
  await uzLogError({ UZ_STORE_ACTIVE: '1', DB: edb }, { method: 'GET', path: '/api/feed', status: 503, detail: '{"error":"core_api_unavailable"}' });
  await uzLogError({ DB: edb }, { method: 'GET', path: '/x', status: 500 });   // UZ faol emas — yozilmaydi
  const logged = (await edb.prepare('SELECT method, path, status FROM _uz_error_log').all()).results;
  check('xato logi: faqat UZ faol bo‘lsa, yo‘l va status', logged.map((r) => `${r.method} ${r.path} ${r.status}`), ['GET /api/feed 503']);

  const probe = await uzWriteProbe({ DB: edb, UPLOADS: uzB });
  checkTrue('yozish probi: baza ok', /^ok /.test(probe.db));
  checkTrue('yozish probi: media put/get/range/head ok', /^ok put\/get\/range\/head/.test(probe.media));
  const auditKeys = (await uzB.list({ prefix: 'audit/' })).objects.map((o) => o.key);
  check('yozish probi: fayl faqat audit/ ostida', auditKeys.length === 1 && auditKeys[0].startsWith('audit/probe-'), true);
}

done();
