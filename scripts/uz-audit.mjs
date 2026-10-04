// O'TISHDAN KEYINGI AUDIT (jonli sayt O'zbekiston serverida).
//
// Hech narsa O'CHIRILMAYDI. Yoziladi faqat: _uz_audit_state (audit natijasi),
// ping orqali sintetik probe (_uz_audit_probe jadvali va audit/ fayl) va
// noto'g'ri parol bilan bitta login urinishi (rate_limits).
//
//   UZ_DB_URL UZ_DB_TOKEN UZ_S3_* CF_API_TOKEN CF_ACCOUNT [UZ_EXPORT_KEY UZ_EXPORT_URL]
//   node scripts/uz-audit.mjs           — to'liq audit, bo'limlar "## " bilan
//   node scripts/uz-audit.mjs --gate    — finalize-media sharti saqlangan auditlar
//                                         bo'yicha (yangi audit qilmaydi; 0 = bajarildi)
//   node scripts/uz-audit.mjs --should-run     — rejali audit kerakmi (10 = yo'q:
//                                         finalize-media'dan 48 soatdan ko'p o'tgan)
//   node scripts/uz-audit.mjs --mark-finalized — finalize-media vaqtini yozadi
//   GARAGE_LOG=fayl — Garage'ning xato/ogohlantirish qatorlari (docker --timestamps)
import { readFileSync, existsSync } from 'node:fs';
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
const now = new Date().toISOString();
if (process.argv.includes('--mark-finalized')) {
  await db.prepare(`INSERT OR REPLACE INTO "_uz_audit_state" ("k", "v", "ts") VALUES ('finalized_at', ?, ?)`).bind(now, now).run();
  say(`finalize-media vaqti yozildi: ${now}`);
  process.exit(0);
}
if (process.argv.includes('--should-run')) {
  const f = await db.prepare(`SELECT v FROM "_uz_audit_state" WHERE k = 'finalized_at'`).first('v');
  if (f && Date.now() - Date.parse(f) > 48 * 3.6e6) { say(`rejali audit to'xtatilgan: finalize-media ${f} da bajarilgan, 48 soatdan oshdi`); process.exit(10); }
  process.exit(0);
}

// Egasining sharti (finalize-media): oxirgi muammoli YOKI to'liq bo'lmagan
// (parallel yuk / Garage logi tekshirilmagan) auditdan keyingi toza auditlar;
// birinchisidan oxirgisigacha ≥24 soat, ≥5 audit, oralarida 10 soatdan uzun
// tanaffus yo'q (kuzatilmagan vaqt toza deb sanalmaydi), shu oraliqda R2
// fallback o'qishi 0 va oxirgi auditda faqat-R2 fayl 0.
const GAP_H = 10;
const loadRuns = async () => (await db.prepare(`SELECT ts, v FROM "_uz_audit_state" WHERE k LIKE 'run:%' ORDER BY ts`).all()).results.map((r) => ({ ts: r.ts, ...JSON.parse(r.v) }));
async function gateOf(runs) {
  const lastBad = [...runs].reverse().find((r) => r.verdict !== 'TOZA' || !r.full);
  let clean = lastBad ? runs.filter((r) => r.ts > lastBad.ts) : runs;
  for (let i = clean.length - 1; i > 0; i--) {
    if (Date.parse(clean[i].ts) - Date.parse(clean[i - 1].ts) > GAP_H * 3.6e6) { clean = clean.slice(i); break; }
  }
  const hours = clean.length ? (Date.parse(clean.at(-1).ts) - Date.parse(clean[0].ts)) / 3.6e6 : 0;
  let fallback = 0;
  if (clean.length && await hasTable('_uz_fallback_log')) {
    fallback = await db.prepare(`SELECT COUNT(*) AS n FROM "_uz_fallback_log" WHERE op IN ('head', 'get', 'head-error', 'get-error') AND ts >= ?`).bind(clean[0].ts).first('n');
  }
  const ready = clean.length >= 5 && hours >= 24 && fallback === 0 && clean.at(-1).r2Only === 0;
  const lines = [
    `toza oraliq: ${hours.toFixed(1)} soat, ${clean.length} audit${clean.length ? ` (${clean[0].ts.slice(0, 16)} dan)` : ''}${lastBad ? ` · oxirgi muammoli/to'liq bo'lmagan audit: ${lastBad.ts.slice(0, 16)}` : ''}`,
    `finalize-media sharti (≥24 soat uzluksiz toza, ≥5 to'liq audit, tanaffus ≤${GAP_H} soat, shu oraliqda R2 fallback 0 [hozir ${fallback}], faqat-R2 fayl 0): ${ready ? 'BAJARILDI' : 'hali yo\'q'}`,
  ];
  return { ready, lines };
}
if (GATE) {
  const runs = await loadRuns();
  const g = await gateOf(runs);
  const last = runs.at(-1);
  const fresh = !!last && Date.now() - Date.parse(last.ts) < 6 * 3.6e6;
  for (const l of g.lines) say(l);
  if (!fresh) say(`oxirgi audit: ${last?.ts || 'yo\'q'} — 6 soatdan eski, avval audit kerak`);
  process.exit(g.ready && fresh ? 0 : 3);
}
const cut = await db.prepare(`SELECT at FROM "_uz_cutover" ORDER BY at LIMIT 1`).first('at');
if (!cut) { say('XATO: _uz_cutover belgisi yo\'q — o\'tish bo\'lmagan'); process.exit(1); }
const cutMs = Date.parse(cut);
const hours = (Date.now() - cutMs) / 3.6e6;
await db.prepare(`INSERT OR IGNORE INTO "_uz_audit_state" ("k", "v", "ts") VALUES ('first_audit', ?, ?)`).bind(now, now).run();
const firstAudit = await db.prepare(`SELECT v FROM "_uz_audit_state" WHERE k = 'first_audit'`).first('v');
// Oldingi audit vaqti: muammo = SHU oraliqdagi yangi hodisalar (tarix alohida ko'rsatiladi).
const prevRun = await db.prepare(`SELECT ts FROM "_uz_audit_state" WHERE k LIKE 'run:%' ORDER BY ts DESC LIMIT 1`).first('ts');
const since = prevRun || firstAudit;
sec(`O'tish: ${cut} · ${hours.toFixed(1)} soat o'tdi`);
say(`bu audit hodisalarni ${since} dan beri tekshiradi (oldingi audit)`);
say(`birinchi audit: ${firstAudit} (R2 fallback va 5xx loglari audit deploy'idan beri yoziladi; undan oldingi oraliq uchun dalil — R2 da bor, Garage'da yo'q fayllar soni, 4-bo'lim)`);

// ── 1) R2 fallback ──────────────────────────────────────────────────
let fallbackReads = 0;
{
  sec('R2 fallback (_uz_fallback_log)');
  if (await hasTable('_uz_fallback_log')) {
    const g = (await db.prepare(`SELECT op, COUNT(*) AS n, MIN(ts) AS a, MAX(ts) AS b FROM "_uz_fallback_log" GROUP BY op`).all()).results;
    for (const r of g) say(`${r.op}: ${r.n} ta (${r.a} … ${r.b})`);
    const READ_OPS = `('head', 'get', 'head-error', 'get-error')`;
    const total = g.filter((r) => ['head', 'get', 'head-error', 'get-error'].includes(r.op)).reduce((a, r) => a + r.n, 0);
    fallbackReads = await db.prepare(`SELECT COUNT(*) AS n FROM "_uz_fallback_log" WHERE op IN ${READ_OPS} AND ts > ?`).bind(since).first('n');
    say(`R2 dan o'qish: jami ${total} · oldingi auditdan beri ${fallbackReads}`);
    const last = (await db.prepare(`SELECT ts, op, key FROM "_uz_fallback_log" ORDER BY id DESC LIMIT 8`).all()).results;
    for (const r of last) say(`  ${r.ts} ${r.op} ${String(r.key).slice(0, 90)}`);
    if (!g.length) say('yozuv yo\'q — R2 dan bitta ham fayl o\'qilmagan');
  } else say('jadval hali yo\'q — R2 fallback bitta ham ishlamagan (birinchi hodisada yaratiladi)');
  if (fallbackReads) problems.push(`R2 fallback ${fallbackReads} marta o'qildi (oldingi auditdan beri)`);
}

// ── 2) API xatolari (5xx) ───────────────────────────────────────────
{
  sec('API xatolari (_uz_error_log, 5xx)');
  if (await hasTable('_uz_error_log')) {
    const g = (await db.prepare(`SELECT method, path, status, COUNT(*) AS n, MAX(ts) AS b, MAX(detail) AS d FROM "_uz_error_log" GROUP BY method, path, status ORDER BY n DESC LIMIT 12`).all()).results;
    const total = g.reduce((a, r) => a + r.n, 0);
    const fresh = await db.prepare(`SELECT COUNT(*) AS n FROM "_uz_error_log" WHERE ts > ?`).bind(since).first('n');
    say(`jami: ${total} · oldingi auditdan beri: ${fresh}`);
    for (const r of g) say(`  ${r.n}× ${r.status} ${r.method} ${r.path} (oxirgi ${r.b}) ${String(r.d || '').slice(0, 100)}`);
    if (fresh) problems.push(`${fresh} ta xato javob (oldingi auditdan beri)`);
  } else say('jadval hali yo\'q — 5xx javob bo\'lmagan');
}

// ── 2b) Garage 403 → muvaffaqiyatli qayta urinishlar (foydalanuvchi ko'rmagan) ──
{
  sec('Garage 403 qayta urinishlari (_uz_s3_retry_log)');
  if (await hasTable('_uz_s3_retry_log')) {
    const g = (await db.prepare(`SELECT method, message, COUNT(*) AS n, MIN(skew) AS lo, MAX(skew) AS hi, MAX(ts) AS b FROM "_uz_s3_retry_log" GROUP BY method, message ORDER BY n DESC LIMIT 6`).all()).results;
    for (const r of g) say(`${r.n}× ${r.method} "${r.message}" soat farqi ${r.lo}…${r.hi} s (oxirgi ${r.b})`);
    const fresh = await db.prepare(`SELECT COUNT(*) AS n FROM "_uz_s3_retry_log" WHERE ts > ?`).bind(since).first('n');
    say(`oldingi auditdan beri: ${fresh} (muvaffaqiyatli qayta urinish — foydalanuvchi xato ko'rmagan)`);
    if (!g.length) say('yo\'q');
    // Fix'dan keyin (S3 so'rovlari keshsiz) 403 bo'lmasligi kerak — yangisi muammo.
    if (fresh) problems.push(`Garage 403 qayta urinishi ${fresh} ta (oldingi auditdan beri)`);
  } else say('yo\'q — 403 qayta urinish bo\'lmagan');
}

// ── 2c) Garage logi: vaqt va tur bo'yicha (fix: S3 so'rovlari keshsiz) ──
// Zararsiz: imzosiz (anonim) so'rovlar — o'zimizning holat tekshiruvi va
// skanerlar; 404 — yo'q faylni so'rash. Qolganlari jiddiy.
const FIX_TS = '2026-10-04T00:14:38Z';
let garageOk = false; // log o'qilmasa audit "to'liq emas" — gate oralig'iga kirmaydi
{
  sec("Garage logi (vaqt va tur bo'yicha)");
  if (E.GARAGE_LOG && existsSync(E.GARAGE_LOG)) {
    const cls = (l) => (/anonymous access/i.test(l) ? "anonim so'rov (zararsiz)"
      : /404 Not Found|NoSuchKey|Key not found/i.test(l) ? "404 fayl yo'q (zararsiz)"
        : /Invalid signature/i.test(l) ? '403 Invalid signature'
          : /InvalidRequest|Bad request|signed header/i.test(l) ? '400 InvalidRequest'
            : /\b5\d\d\b|Internal|panic|timed? ?out|quorum/i.test(l) ? '5xx/ichki xato' : 'boshqa');
    const benign = (c) => c.includes('zararsiz');
    const rows = readFileSync(E.GARAGE_LOG, 'utf8').split('\n').map((l) => {
      const m = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(\.\d+)?Z\s+(.*)$/.exec(l);
      return m ? { t: Date.parse(`${m[1]}Z`), iso: m[1], c: cls(m[3]), err: /error|panic|fatal/i.test(m[3]), l: m[3] } : null;
    }).filter(Boolean);
    // O'tishdan beri jurnal hech qachon bo'sh emas (fix'dan oldingi xatolar,
    // har run'ning anonim tekshiruvi) — bo'sh bo'lsa SSH/log o'qilmagan.
    garageOk = rows.length > 0;
    if (!garageOk) say("jurnal bo'sh — server logi o'qilmadi (audit to'liq emas)");
    const fixMs = Date.parse(FIX_TS);
    const tally = (a) => Object.entries(a.reduce((o, r) => ({ ...o, [r.c]: (o[r.c] || 0) + 1 }), {})).map(([k, v]) => `${k}: ${v}`).join(', ') || '0';
    say(`jurnal: ${rows.length} qator (${rows[0]?.iso || '-'} … ${rows.at(-1)?.iso || '-'} UTC)`);
    say(`fix (${FIX_TS}) OLDIDAN: ${tally(rows.filter((r) => r.t <= fixMs))}`);
    say(`fix'dan KEYIN: ${tally(rows.filter((r) => r.t > fixMs))}`);
    // 2026-10-04 00:58 dagi auditda "garage: 55 xato (1 soat)" — o'sha oyna.
    const win = rows.filter((r) => r.err && r.t >= Date.parse('2026-10-03T23:58:00Z') && r.t <= Date.parse('2026-10-04T00:59:30Z'));
    if (win.length) {
      const pre = win.filter((r) => r.t <= fixMs); const post = win.filter((r) => r.t > fixMs);
      say(`"55 ta" oynasi (23:58–00:59 UTC): ${win.length} ta — fix'dan OLDIN ${pre.length} [${tally(pre)}] · KEYIN ${post.length} [${tally(post)}]`);
    }
    const freshSerious = rows.filter((r) => r.t > Math.max(Date.parse(since), fixMs) && !benign(r.c));
    say(`oldingi auditdan beri (fix'dan keyin) jiddiy: ${freshSerious.length}`);
    for (const r of freshSerious.slice(-5)) say(`  ${r.iso} ${r.c}: ${r.l.replace(/\s+/g, ' ').slice(0, 160)}`);
    if (freshSerious.length) problems.push(`Garage logida ${freshSerious.length} ta yangi jiddiy xato`);
  } else say("Garage logi berilmagan — tekshirilmadi (audit to'liq emas)");
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
  // Garage javob bermasa ham audit yozilsin (muammoli) — aks holda bu run
  // tarixda ko'rinmay, toza oraliqni uzmasdi.
  let listed = true;
  try {
    do { const p = await bucket.list({ cursor }); all.push(...p.objects); cursor = p.truncated ? p.cursor : undefined; } while (cursor);
  } catch (e) { listed = false; say(`Garage ro'yxati olinmadi: ${String(e?.message || e).slice(0, 120)}`); problems.push('Garage ro\'yxati olinmadi'); }
  garage = all.filter((o) => o.key.startsWith('uploads/'));
  const fresh = garage.filter((o) => o.uploaded.getTime() > cutMs);
  say(`Garage: ${garage.length} fayl (uploads/) · o'tishdan keyin yuklangan: ${fresh.length} (${(fresh.reduce((a, o) => a + o.size, 0) / 1048576).toFixed(1)} MB)`);
  if (listed) try {
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

// ── 5b) Parallel yuk — ilova starti kabi (faqat o'qish) ──────────────
// 1101 ("Worker threw exception") worker'ning o'z logiga tushmaydi — uni
// faqat shunday tashqi parallel so'rovlar ko'rsatadi (2026-10-04 topilma).
{
  sec("Parallel yuk (ilova starti kabi: 3 to'lqin × 14 so'rov)");
  const P = ['/api/auth/me', '/api/feed', '/api/stories/feed', '/api/catalog/feed', '/api/companies', '/api/news', '/api/music', '/api/people/search?q=a', '/api/companies/search?q=a', '/api/feed', '/api/stories/feed', '/api/catalog/feed', '/api/auth/me', '/api/news'];
  const st = {}; const bad = []; let slow = 0;
  for (let w = 0; w < 3; w++) {
    const rr = await Promise.all(P.map((p) => hit(p)));
    rr.forEach((r, i) => {
      st[r.status] = (st[r.status] || 0) + 1;
      slow = Math.max(slow, r.ms);
      if (r.status === 0 || r.status >= 500) bad.push(`${P[i].split('?')[0]} ${r.status || r.err} ${new TextDecoder().decode(r.body.slice(0, 400)).match(/<title>([^<]+)/i)?.[1] || ''}`);
    });
    await new Promise((res) => setTimeout(res, 1000));
  }
  say(`statuslar: ${JSON.stringify(st)} · eng sekin: ${slow}ms`);
  for (const b of bad.slice(0, 6)) say(`  XATO ${b}`);
  if (bad.length) problems.push(`parallel yukda ${bad.length} ta 5xx/uzilish`);
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
// "To'liq" audit: parallel yuk (5b, doim) va Garage logi tekshirilgan.
// 2026-10-04 00:22/00:58 dagi auditlarda parallel yuk yo'q edi (1101 ko'rinmagan).
const full = garageOk;
await db.prepare(`INSERT OR REPLACE INTO "_uz_audit_state" ("k", "v", "ts") VALUES (?, ?, ?)`).bind(`run:${now}`, JSON.stringify({ hours: +hours.toFixed(2), verdict, fallbackReads, r2Only, full }), now).run();
const runs = await loadRuns();
sec('Xulosa');
say(`bu audit: ${verdict}${full ? '' : " (to'liq emas — gate oralig'iga kirmaydi)"}`);
say(`auditlar tarixi: ${runs.map((r) => `${r.ts.slice(5, 16)} ${r.verdict !== 'TOZA' ? 'muammoli' : r.full ? 'toza' : "toza, to'liq emas"}`).join(' · ')}`);
for (const l of (await gateOf(runs)).lines) say(l);
if (problems.length) process.exit(1);
