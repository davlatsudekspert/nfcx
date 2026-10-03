// O'TISHDAN KEYINGI AUDIT (jonli sayt O'zbekiston serverida).
//
// Hech narsa O'CHIRILMAYDI. Yoziladi faqat: _uz_audit_state (audit natijasi),
// ping orqali sintetik probe (_uz_audit_probe jadvali va audit/ fayl) va
// noto'g'ri parol bilan bitta login urinishi (rate_limits).
//
//   UZ_DB_URL UZ_DB_TOKEN UZ_S3_* CF_API_TOKEN CF_ACCOUNT [UZ_EXPORT_KEY UZ_EXPORT_URL]
//   node scripts/uz-audit.mjs           — to'liq audit, bo'limlar "## " bilan
//   node scripts/uz-audit.mjs --gate    — finalize-media sharti: ≥24 soat, toza,
//                                         R2 fallback o'qishi 0 va R2-only fayl 0
import { uzDb, uzBucket } from '../hosting/uz-store.js';

const E = process.env;
const GATE = process.argv.includes('--gate');
const BASE = E.AUDIT_BASE || 'https://nfcstore.uz';
const db = uzDb({ url: E.UZ_DB_URL, token: E.UZ_DB_TOKEN });
const bucket = uzBucket({ endpoint: E.UZ_S3_ENDPOINT, bucket: E.UZ_S3_BUCKET || 'nfcstore-uploads', keyId: E.UZ_S3_KEY_ID, secret: E.UZ_S3_SECRET, region: 'garage' });
const problems = [];
const say = (s) => console.log(s);
const sec = (t) => say(`## ${t}`);
const ms = (t0) => `${Date.now() - t0}ms`;
const hasTable = async (n) => !!(await db.prepare(`SELECT 1 AS x FROM sqlite_master WHERE type = 'table' AND name = ?`).bind(n).first('x'));

async function hit(path, init = {}) {
  const t0 = Date.now();
  try {
    const res = await fetch(`${BASE}${path}`, { redirect: 'manual', signal: AbortSignal.timeout(45_000), ...init, headers: { 'user-agent': 'nfcstore-uz-audit', ...(init.headers || {}) } });
    const body = new Uint8Array(await res.arrayBuffer());
    return { status: res.status, ms: Date.now() - t0, h: res.headers, body, pop: String(res.headers.get('cf-ray') || '').split('-')[1] || '?' };
  } catch (e) {
    return { status: 0, ms: Date.now() - t0, h: new Headers(), body: new Uint8Array(), err: String(e?.message || e).slice(0, 80), pop: '?' };
  }
}

// ── 0) O'tish vaqti va audit holati ──────────────────────────────────
await db.exec(`CREATE TABLE IF NOT EXISTS "_uz_audit_state" ("k" TEXT PRIMARY KEY NOT NULL, "v" TEXT, "ts" TEXT NOT NULL)`);
const cut = await db.prepare(`SELECT at FROM "_uz_cutover" ORDER BY at LIMIT 1`).first('at');
if (!cut) { say('XATO: _uz_cutover belgisi yo\'q — o\'tish bo\'lmagan'); process.exit(1); }
const cutMs = Date.parse(cut);
const hours = (Date.now() - cutMs) / 3.6e6;
const now = new Date().toISOString();
await db.prepare(`INSERT OR IGNORE INTO "_uz_audit_state" ("k", "v", "ts") VALUES ('first_audit', ?, ?)`).bind(now, now).run();
const firstAudit = await db.prepare(`SELECT v FROM "_uz_audit_state" WHERE k = 'first_audit'`).first('v');
sec(`O'tish: ${cut} · ${hours.toFixed(1)} soat o'tdi`);
say(`birinchi audit: ${firstAudit} (R2 fallback va 5xx loglari audit deploy'idan beri yoziladi; undan oldingi oraliq uchun dalil — R2 da bor, Garage'da yo'q fayllar soni, 4-bo'lim)`);

// ── 1) R2 fallback ──────────────────────────────────────────────────
let fallbackReads = 0;
{
  sec('R2 fallback (_uz_fallback_log)');
  if (await hasTable('_uz_fallback_log')) {
    const g = (await db.prepare(`SELECT op, COUNT(*) AS n, MIN(ts) AS a, MAX(ts) AS b FROM "_uz_fallback_log" GROUP BY op`).all()).results;
    for (const r of g) say(`${r.op}: ${r.n} ta (${r.a} … ${r.b})`);
    fallbackReads = g.filter((r) => ['head', 'get', 'head-error', 'get-error'].includes(r.op)).reduce((a, r) => a + r.n, 0);
    const last = (await db.prepare(`SELECT ts, op, key FROM "_uz_fallback_log" ORDER BY id DESC LIMIT 8`).all()).results;
    for (const r of last) say(`  ${r.ts} ${r.op} ${String(r.key).slice(0, 90)}`);
    if (!g.length) say('yozuv yo\'q — R2 dan bitta ham fayl o\'qilmagan');
  } else say('jadval hali yo\'q — R2 fallback bitta ham ishlamagan (birinchi hodisada yaratiladi)');
  if (fallbackReads) problems.push(`R2 fallback ${fallbackReads} marta o'qildi`);
}

// ── 2) API xatolari (5xx) ───────────────────────────────────────────
{
  sec('API xatolari (_uz_error_log, 5xx)');
  if (await hasTable('_uz_error_log')) {
    const g = (await db.prepare(`SELECT method, path, status, COUNT(*) AS n, MAX(ts) AS b, MAX(detail) AS d FROM "_uz_error_log" GROUP BY method, path, status ORDER BY n DESC LIMIT 12`).all()).results;
    const total = g.reduce((a, r) => a + r.n, 0);
    say(`jami: ${total}`);
    for (const r of g) say(`  ${r.n}× ${r.status} ${r.method} ${r.path} (oxirgi ${r.b}) ${String(r.d || '').slice(0, 100)}`);
    if (total) problems.push(`${total} ta 5xx javob`);
  } else say('jadval hali yo\'q — 5xx javob bo\'lmagan');
}

// ── 3) Haqiqiy foydalanuvchi yozuvlari (organik write) ───────────────
{
  sec("O'tishdan keyingi haqiqiy yozuvlar (UZ bazasi)");
  const tables = (await db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_uz_%' AND name NOT LIKE '_cf_%'`).all()).results.map((r) => r.name);
  const infos = await Promise.all(tables.map((t) => db.prepare(`SELECT name FROM pragma_table_info(?)`).bind(t).all().then((r) => [t, r.results.map((c) => c.name)])));
  const withTs = infos.filter(([, cols]) => cols.includes('created_at'));
  const counts = await Promise.all(withTs.map(([t]) => db.prepare(`SELECT COUNT(*) AS n FROM "${t}" WHERE julianday(created_at) > julianday(?)`).bind(cut).first('n').then((n) => [t, n], () => [t, -1])));
  const nonzero = counts.filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  say(`created_at bor jadvallar: ${withTs.length} · yangi qatorli: ${nonzero.length} · jami yangi qator: ${nonzero.reduce((a, [, n]) => a + n, 0)}`);
  say(nonzero.slice(0, 12).map(([t, n]) => `${t} +${n}`).join(' · ') || 'hali yangi qator yo\'q (tun/erta tong)');
  const sess = await db.prepare(`SELECT COUNT(*) AS n FROM sessions WHERE expires_at > ?`).bind(now).first('n').catch(() => '?');
  say(`faol sessiyalar: ${sess}`);
  const ic = await db.prepare(`PRAGMA quick_check`).first().catch((e) => ({ quick_check: e.message }));
  say(`quick_check: ${Object.values(ic || {})[0]}`);
  if (Object.values(ic || {})[0] !== 'ok') problems.push('baza quick_check ok emas');
}

// ── 4) Media: yangi fayllar, R2-only fayllar ─────────────────────────
let r2Only = -1;
let garage = [];
{
  sec("Media (Garage ↔ R2)");
  const all = [];
  let cursor;
  do { const p = await bucket.list({ cursor }); all.push(...p.objects); cursor = p.truncated ? p.cursor : undefined; } while (cursor);
  garage = all.filter((o) => o.key.startsWith('uploads/'));
  const fresh = garage.filter((o) => o.uploaded.getTime() > cutMs);
  say(`Garage: ${garage.length} fayl (uploads/) · o'tishdan keyin yuklangan: ${fresh.length} (${(fresh.reduce((a, o) => a + o.size, 0) / 1048576).toFixed(1)} MB)`);
  try {
    const r2 = [];
    let c = '';
    for (let i = 0; i < 100; i++) {
      const u = new URL(`https://api.cloudflare.com/client/v4/accounts/${E.CF_ACCOUNT}/r2/buckets/nfcstore-uploads/objects`);
      u.searchParams.set('per_page', '1000'); if (c) u.searchParams.set('cursor', c);
      const res = await fetch(u, { headers: { authorization: `Bearer ${E.CF_API_TOKEN}` }, signal: AbortSignal.timeout(120_000) });
      const body = await res.json();
      if (!res.ok || body.success === false) throw new Error(`HTTP ${res.status}`);
      r2.push(...(body.result || []));
      c = body.result_info?.cursor || '';
      if (!c || body.result_info?.is_truncated === false) break;
    }
    const g = new Set(all.map((o) => o.key));
    const only = r2.filter((o) => !g.has(o.key));
    r2Only = only.length;
    const freshInR2 = fresh.filter((o) => r2.some((x) => x.key === o.key)).length;
    say(`R2: ${r2.length} fayl · R2 da bor, Garage'da yo'q (fallback faqat shularda ishlashi mumkin): ${r2Only}`);
    for (const o of only.slice(0, 5)) say(`  faqat R2: ${o.key}`);
    say(`o'tishdan keyingi yangi fayllardan R2 ga tushgani: ${freshInR2} (kutilgan 0 — yozish faqat UZ ga)`);
    if (r2Only) problems.push(`${r2Only} ta fayl faqat R2 da`);
    if (freshInR2) problems.push(`${freshInR2} ta yangi fayl R2 ga yozilgan`);
  } catch (e) { say(`R2 ro'yxati olinmadi: ${e.message}`); problems.push('R2 ro\'yxati olinmadi'); }
  // Yangi yuklangan fayllar sayt orqali to'g'ri beriladimi (haqiqiy upload → download).
  const sample = [...fresh.slice(-10), ...garage.filter((_, i) => i % Math.max(1, Math.floor(garage.length / 10)) === 0).slice(0, 10)];
  const res = await Promise.all(sample.map(async (o) => { const r = await hit(`/${o.key}`); return { o, r }; }));
  const bad = res.filter(({ o, r }) => r.status !== 200 || r.body.length !== o.size);
  say(`/uploads/ orqali yuklab olish: ${res.length - bad.length}/${res.length} to'g'ri (200 va hajmi mos; ${fresh.slice(-10).length} tasi yangi)`);
  for (const { o, r } of bad.slice(0, 5)) say(`  XATO ${r.status} ${o.key} (${r.body.length}/${o.size}) ${r.err || ''}`);
  const stores = {}; for (const { r } of res) { const s = r.h.get('x-nfc-store') || '-'; stores[s] = (stores[s] || 0) + 1; }
  say(`berilgan manba (x-nfc-store, keshdan kelganlarda to'ldirilgan paytdagisi): ${JSON.stringify(stores)}`);
  if (bad.length) problems.push(`${bad.length} ta fayl yuklab olinmadi`);
}

// ── 5) Sahifalar va API ─────────────────────────────────────────────
let feedJson = '';
{
  sec('Sahifalar va API (profil, lenta, Reels, login)');
  const codes = (await db.prepare(`SELECT code FROM cards WHERE user_id IS NOT NULL AND code IS NOT NULL ORDER BY views DESC LIMIT 8`).all()).results.map((r) => r.code);
  const gets = ['/', '/api/feed', '/api/stories/feed', '/api/catalog/feed', '/api/companies', '/api/news', '/api/music', '/api/people/search?q=a', '/api/companies/search?q=a', '/api/auth/me', ...codes.map((c) => `/${encodeURIComponent(c)}`)];
  const rs = [];
  for (const p of gets) { const r = await hit(p, { headers: p.startsWith('/api/') ? {} : { accept: 'text/html' } }); rs.push([p, r]); if (p === '/api/feed') feedJson = new TextDecoder().decode(r.body); }
  const login = await hit('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'uz-audit@nfcstore.invalid', password: 'not-a-real-password' }) });
  rs.push(['POST /api/auth/login (noto\'g\'ri parol → 4xx kutiladi)', login]);
  const badR = rs.filter(([p, r]) => r.status === 0 || r.status >= 500 || (p.startsWith('POST') ? !(r.status >= 400 && r.status < 500) : r.status >= 400));
  say(`${rs.length - badR.length}/${rs.length} to'g'ri · ${rs.map(([p, r]) => `${p.split('?')[0].slice(0, 22)} ${r.status} ${r.ms}ms`).join(' · ')}`);
  for (const [p, r] of badR) say(`  XATO ${p}: ${r.status} ${r.err || new TextDecoder().decode(r.body.slice(0, 120))}`);
  if (badR.length) problems.push(`${badR.length} ta sahifa/API xato`);
  // Reels: lentadagi videolar — Range (206), pleyer qanday so'rasa shunday.
  const vids = [...new Set((feedJson.match(/\/uploads\/[^"\\?]+\.(mp4|webm|mov)/gi) || []))].slice(0, 4);
  const vr = await Promise.all(vids.map((v) => hit(v, { headers: { range: 'bytes=0-65535' } })));
  say(`Reels videolari (lentadan ${vids.length} ta, Range 0-64KB): ${vr.map((r) => `${r.status} ${r.ms}ms edge=${r.h.get('x-nfc-edge') || '-'}`).join(' · ') || 'lentada video topilmadi'}`);
  if (vr.some((r) => r.status !== 206)) problems.push('Reels video Range javobi 206 emas');
}

// ── 6) /uploads/* chegara keshi (Cloudflare edge cache) ─────────────
{
  sec('/uploads/* chegara keshi (edge cache) o\'lchovi');
  const imgs = [...new Set((feedJson.match(/\/uploads\/[^"\\?]+\.(png|jpe?g|webp)/gi) || []))].slice(0, 4);
  if (imgs.length < 4) imgs.push(...garage.filter((o) => /\.(png|jpe?g|webp)$/i.test(o.key)).slice(0, 4 - imgs.length).map((o) => `/${o.key}`));
  const rows = [];
  for (const p of imgs) {
    const a = await hit(p); const b = await hit(p);
    rows.push(`rasm ${p.slice(9, 25)}…: 1) ${a.h.get('x-nfc-edge') || '-'} ${a.ms}ms → 2) ${b.h.get('x-nfc-edge') || '-'} ${b.ms}ms [${b.pop}]`);
  }
  const vid = (feedJson.match(/\/uploads\/[^"\\?]+\.(mp4|webm)/i) || [])[0];
  if (vid) {
    const a = await hit(vid, { headers: { range: 'bytes=0-65535' } });
    await new Promise((r) => setTimeout(r, 8000));
    const b = await hit(vid, { headers: { range: 'bytes=0-65535' } });
    rows.push(`video ${vid.slice(9, 25)}…: 1) ${a.h.get('x-nfc-edge') || '-'} ${a.ms}ms → (8 s) 2) ${b.h.get('x-nfc-edge') || '-'} ${b.ms}ms [${b.pop}]`);
  }
  for (const r of rows) say(r);
  const second = rows.filter((r) => /2\) hit/.test(r)).length;
  say(`ikkinchi so'rovda keshdan: ${second}/${rows.length} (kesh har Cloudflare nuqtasida alohida)`);
  if (rows.length && !second) problems.push('edge cache ishlamayapti (ikkinchi so\'rovda ham miss)');
}

// ── 7) Sintetik yozish/o'qish (jonli Worker → UZ) ───────────────────
if (E.UZ_EXPORT_KEY) {
  sec("Sintetik yozish/o'qish (jonli Worker, audit jadvali va audit/ fayl)");
  const r = await hit(`/__uz/ping?probe=1&write=1&_=${Date.now()}`, { headers: { 'x-uz-export-key': E.UZ_EXPORT_KEY } });
  let j = {}; try { j = JSON.parse(new TextDecoder().decode(r.body)); } catch { /* */ }
  say(`HTTP ${r.status} store=${j.store} db=${j.db} bucket=${j.bucket} · yozish: baza ${j.write?.db} · media ${j.write?.media}`);
  if (r.status !== 200 || j.store !== 'uz' || !/^ok/.test(j.write?.db || '') || !/^ok/.test(j.write?.media || '')) problems.push('sintetik yozish/o\'qish xato');
}

// ── 8) D1 ga kech yozuvchi (eski Worker) bormi ──────────────────────
if (E.UZ_EXPORT_KEY && E.UZ_EXPORT_URL) {
  sec('Cloudflare D1 o\'zgarmayaptimi (eski nfcstore-api kabi yozuvchi)');
  const exp = async (q) => { const u = new URL(E.UZ_EXPORT_URL); for (const [k, v] of Object.entries(q)) u.searchParams.set(k, v); const res = await fetch(u, { headers: { 'x-uz-export-key': E.UZ_EXPORT_KEY }, signal: AbortSignal.timeout(60_000) }); if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); };
  try {
    const schema = await exp({ op: 'schema' });
    const tabs = schema.master.filter((r) => r.type === 'table').map((r) => r.name);
    const dig = {};
    for (const t of tabs) { const d = await exp({ op: 'digest', table: t }); dig[t] = `${d.count}:${d.sha}`; }
    const prev = await db.prepare(`SELECT v, ts FROM "_uz_audit_state" WHERE k = 'd1_digest'`).first();
    if (!prev) {
      await db.prepare(`INSERT INTO "_uz_audit_state" ("k", "v", "ts") VALUES ('d1_digest', ?, ?)`).bind(JSON.stringify(dig), now).run();
      say(`asos olindi: ${tabs.length} jadval (keyingi auditlar shu bilan solishtiradi)`);
    } else {
      const old = JSON.parse(prev.v);
      const changed = tabs.filter((t) => old[t] !== dig[t]);
      say(`${prev.ts} dan beri D1 da o'zgargan jadval: ${changed.length}${changed.length ? ` — ${changed.slice(0, 8).join(', ')}` : ' (D1 ga hech kim yozmayapti)'}`);
      if (changed.length) problems.push(`D1 ga kimdir yozyapti: ${changed.slice(0, 5).join(', ')}`);
    }
  } catch (e) { say(`D1 eksporti o'qilmadi: ${e.message}`); }
}

// ── Xulosa ──────────────────────────────────────────────────────────
const verdict = problems.length ? `MUAMMO: ${problems.join('; ')}` : 'TOZA';
await db.prepare(`INSERT OR REPLACE INTO "_uz_audit_state" ("k", "v", "ts") VALUES (?, ?, ?)`).bind(`run:${now}`, JSON.stringify({ hours: +hours.toFixed(2), verdict, fallbackReads, r2Only }), now).run();
const runs = (await db.prepare(`SELECT ts, v FROM "_uz_audit_state" WHERE k LIKE 'run:%' ORDER BY ts`).all()).results.map((r) => ({ ts: r.ts, ...JSON.parse(r.v) }));
sec('Xulosa');
say(`bu audit: ${verdict}`);
say(`auditlar tarixi: ${runs.map((r) => `${r.ts.slice(5, 16)} ${r.verdict === 'TOZA' ? 'toza' : 'MUAMMO'}`).join(' · ')}`);
const ready = hours >= 24 && !problems.length && fallbackReads === 0 && r2Only === 0 && runs.every((r) => r.verdict === 'TOZA');
say(`finalize-media sharti (≥24 soat, hamma auditlar toza, fallback 0, faqat-R2 0): ${ready ? 'BAJARILDI' : `hali yo'q (${hours.toFixed(1)} soat)`}`);
if (GATE && !ready) process.exit(3);
if (problems.length) process.exit(1);
