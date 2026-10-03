// O'zbekiston serverida yangi isolate'ning birinchi so'rovi nechta tashqi
// so'rov (subrequest) yuboradi. Har "isolate" — alohida jarayon (modul
// keshlari toza). Sxema belgisi (ensureCoreSchema) bo'lmasa ~60 ta bo'lardi:
// Workers Free'da chegara 50, Paid'da esa Toshkentgacha bir necha soniya.
//   node scripts/test-uz-cold-start.mjs
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';

const self = fileURLToPath(import.meta.url);
const [mode, dbFile, version, route] = process.argv.slice(2);

if (mode === 'child') {
  const W = await import('../hosting/worker.js');
  const worker = W.default;
  const { uzDb, uzBucket } = await import('../hosting/uz-store.js');
  const { hranaFetch } = await import('./lib/hrana-fake.mjs');
  const { s3Fetch } = await import('./lib/s3-fake.mjs');
  const sqlite = new DatabaseSync(dbFile);
  sqlite.exec('PRAGMA foreign_keys = ON');
  let n = 0;
  const hf0 = hranaFetch(sqlite);
  // FAULT: bitta ALTER so'rovida tarmoq uziladi (Worker → Toshkent).
  let faulted = route.startsWith('FAULT') ? 0 : 1;
  const hf = (url, init) => {
    if (!faulted && String(init?.body || '').includes('ADD COLUMN source')) { faulted = 1; return Promise.reject(new TypeError('network connection lost')); }
    return hf0(url, init);
  };
  const sf = s3Fetch({ bucket: 'b' });
  const env = {
    DB: uzDb({ url: 'https://db.uz.test', token: 'test-token', fetch: (...a) => { n++; return hf(...a); } }),
    UPLOADS: uzBucket({ endpoint: 'https://s3.uz.test', bucket: 'b', keyId: 'k', secret: 's', fetch: (...a) => { n++; return sf(...a); } }),
    ASSETS: { fetch: async () => new Response('nf', { status: 404 }) },
    UZ_STORE_ACTIVE: '1',
    CF_VERSION_METADATA: { id: version },
  };
  const go = async (p) => { const r = await worker.fetch(new Request(`https://nfcstore.uz${p}`, { headers: { 'cf-connecting-ip': '198.51.100.9' } }), env, { waitUntil() {} }); await r.arrayBuffer(); return r; };
  // FAULT rejimida shu isolate'da IKKI so'rov: ikkinchisidan keyin ham belgi yozilmasligi kerak.
  if (route.startsWith('FAULT')) await go('/api/feed');
  const res = await go(route.startsWith('FAULT') ? '/api/feed' : route);
  // Ustun keshi (hasColumnD1) — belgi topilganda ham to'ldirilgan bo'lishi shart.
  const gates = [W.cardsHaveCompanyIdD1(), W.likesHaveCompanyIdD1(), W.usersHaveTrialColumnsD1(), W.usersHaveSignupSourceD1()];
  process.stdout.write(`\n@@${JSON.stringify({ status: res.status, n, gates })}`);
  process.exit(0);
}

let pass = 0; let fail = 0;
const check = (label, ok, info) => { console.log(ok ? 'PASS' : 'FAIL', '-', label, info ?? ''); ok ? pass++ : fail++; };
const dir = mkdtempSync(path.join(os.tmpdir(), 'uzcold-'));
const db = path.join(dir, 'uz.sqlite');
const s = new DatabaseSync(db);
s.exec(readFileSync(new URL('../db/d1-migration/0001-schema.sql', import.meta.url), 'utf8'));
s.close();
const run = (ver, r = '/api/feed') => {
  const out = execFileSync(process.execPath, [self, 'child', db, ver, r], { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
  return JSON.parse(out.slice(out.lastIndexOf('@@') + 2));
};
const first = run('v1');
check('1-isolate (yangi versiya): sxema to‘liq tekshiriladi', first.status === 200 && first.n > 20, `(${first.n} so‘rov, HTTP ${first.status})`);
const marker = new DatabaseSync(db).prepare(`SELECT COUNT(*) AS c FROM maintenance_runs WHERE name = 'core_schema:v1'`).get().c;
check('belgi yozildi (core_schema:v1)', marker === 1);
for (const r of ['/api/feed', '/api/auth/me', '/api/records']) {
  const again = run('v1', r);
  check(`keyingi isolate ${r}: ≤ 12 so‘rov (Free chegarasi 50)`, again.n <= 12 && again.status < 500, `(${again.n} so‘rov, HTTP ${again.status})`);
  check(`keyingi isolate ${r}: ustun keshi to'la (company_id, as_company_id, trial, signup_source)`, again.gates.every(Boolean), JSON.stringify(again.gates));
}
const vf = run('vf', 'FAULT');
const vfMarker = new DatabaseSync(db).prepare(`SELECT COUNT(*) AS c FROM maintenance_runs WHERE name = 'core_schema:vf'`).get().c;
check('ALTER da tarmoq uzilsa — shu isolate ikkinchi so‘rovdan keyin ham belgi YOZMAYDI', vfMarker === 0, `(belgi: ${vfMarker})`);
const v2 = run('v2');
check('yangi versiya (v2): sxema yana to‘liq tekshiriladi', v2.n > 20, `(${v2.n} so‘rov)`);
console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
