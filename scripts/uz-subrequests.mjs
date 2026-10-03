// Haqiqiy O'zbekiston bazasi/omboriga ulangan worker (Node'da) har bir
// sahifa uchun nechta tashqi so'rov (subrequest) yuborishini sanaydi.
// Cloudflare bitta so'rovga chegaralangan son beradi — undan oshsa sahifa
// "Too many subrequests" bilan yiqiladi.
//   UZ_DB_URL=… UZ_DB_TOKEN=… UZ_S3_*=… node scripts/uz-subrequests.mjs /api/feed /KOD …
import { uzDb, uzBucket } from '../hosting/uz-store.js';

const W = (await import('../hosting/worker.js')).default;
const e = process.env;
let n = 0; const log = [];
const counted = (tag) => (url, init) => {
  n++;
  let what = tag;
  try { if (tag === 'db') what = JSON.parse(init.body).requests.filter((r) => r.stmt || r.batch).map((r) => r.stmt?.sql || `BATCH ${r.batch.steps.length}`).join(' ; '); } catch { /* */ }
  log.push(String(what).replace(/\s+/g, ' ').replace(/^PRAGMA foreign_keys = ON ; /, '').slice(0, 90));
  return fetch(url, init);
};
const env = {
  DB: uzDb({ url: e.UZ_DB_URL, token: e.UZ_DB_TOKEN, fetch: counted('db') }),
  UPLOADS: uzBucket({ endpoint: e.UZ_S3_ENDPOINT, bucket: e.UZ_S3_BUCKET, keyId: e.UZ_S3_KEY_ID, secret: e.UZ_S3_SECRET, region: 'garage', fetch: counted('s3') }),
  ASSETS: { fetch: async () => new Response('<!doctype html><html><head></head><body></body></html>', { headers: { 'content-type': 'text/html' } }) },
  UZ_STORE_ACTIVE: '1',
  CF_VERSION_METADATA: { id: `count-${Date.now()}` },
};
for (const p of process.argv.slice(2)) {
  n = 0; log.length = 0;
  const t0 = Date.now();
  let status = 0; let detail = '';
  try {
    const r = await W.fetch(new Request(`https://nfcstore.uz${p}`, { headers: { 'cf-connecting-ip': '198.51.100.9', accept: 'text/html' } }), env, { waitUntil() {} });
    status = r.status; const b = await r.text(); if (status >= 400) detail = b.slice(0, 120);
  } catch (err) { detail = String(err?.message || err).slice(0, 120); }
  const cnt = {}; for (const l of log) cnt[l] = (cnt[l] || 0) + 1;
  const top = Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `${v}× ${k}`).join(' | ');
  console.log(`${p.replace(/\?.*/, '')} → HTTP ${status}, ${n} so'rov, ${Date.now() - t0}ms ${detail} · ${top}`);
}
process.exit(0);
