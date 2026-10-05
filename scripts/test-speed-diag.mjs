// Tezlik diagnostikasi (hosting/speed-diag.js):
//   node scripts/test-speed-diag.mjs
// - `x-nfc-timing: 1` bo'lsa javobga server-timing qo'shiladi, javob tanasi
//   o'zgarmaydi; sarlavhasiz so'rov umuman o'zgarmaydi.
// - /api/diag/speed va /tezlik ishlaydi, sahifadagi skript sintaksisi to'g'ri.
import worker from '../hosting/worker.js';
import { summarizeTiming, timedDb, TEZLIK_HTML } from '../hosting/speed-diag.js';
import { makeEnv, seedBasic, cookie, req, makeChecker } from './lib/d1-harness.mjs';

const { env } = makeEnv();
await seedBasic(env);
const { check, checkTrue, done } = makeChecker();
const call = (path, init = {}) => worker.fetch(req(path, init), env);

// 1. To'lqinlarni hisoblash: ustma-ust tushganlar bitta to'lqin.
{
  const s = summarizeTiming({ t0: 0, stmts: 4, spans: [[10, 50], [12, 40], [60, 90], [70, 95]] }, 100);
  check('ustma-ust so\'rovlar bitta to\'lqin', s.waves, 2);
  check('baza vaqti — birlashma uzunligi', s.dbMs, 40 + 35);
  check('jami vaqt', s.totalMs, 100);
  check('bo\'sh — 0 to\'lqin', summarizeTiming({ t0: 5, stmts: 0, spans: [] }, 5).waves, 0);
}

// 2. Sarlavhasiz so'rov o'zgarmaydi.
{
  const r = await call('/api/records/VIP001');
  check('sarlavhasiz: 200', r.status, 200);
  checkTrue('sarlavhasiz: server-timing YO\'Q', !r.headers.get('server-timing'));
}

// 3. Sarlavha bilan: server-timing bor, tana bir xil.
{
  const plain = await (await call('/api/records/VIP001')).json();
  const r = await call('/api/records/VIP001', { headers: { 'x-nfc-timing': '1' } });
  check('timing: 200', r.status, 200);
  const st = r.headers.get('server-timing') || '';
  checkTrue('timing: total va db bor', /total;dur=\d+/.test(st) && /db;dur=\d+;desc="waves=\d+ stmts=\d+"/.test(st));
  checkTrue('timing: kamida bitta to\'lqin', Number(r.headers.get('x-nfc-waves')) >= 1);
  check('timing: javob tanasi o\'zgarmagan', JSON.stringify(await r.json()), JSON.stringify(plain));
}

// 4. Yozish (batch ichidagi statement'lar o'ralgan bo'lsa ham) ishlaydi.
{
  const r = await call('/api/records/VIP001', { method: 'PUT', cookie: cookie.user, headers: { 'x-nfc-timing': '1' }, json: { name: 'Muhammad', musicUrls: [] } });
  check('timing bilan PUT ham ishlaydi', r.status, 200);
  const db = timedDb(env.DB, { t0: Date.now(), spans: [], stmts: 0 });
  const res = await db.batch([db.prepare('SELECT 1 AS a'), db.prepare('SELECT ? AS b').bind(2)]);
  check('timedDb.batch o\'ralgan statement\'larni ochadi', res.length, 2);
}

// 5. /api/diag/speed va /tezlik.
{
  const r = await call('/api/diag/speed');
  check('diag: 200', r.status, 200);
  const j = await r.json();
  check('diag: 3 ta o\'lchov', (j.dbPingMs || []).length, 3);
  check('diag: no-store', r.headers.get('cache-control'), 'no-store');
  const p = await call('/tezlik');
  check('tezlik: 200', p.status, 200);
  checkTrue('tezlik: html', /text\/html/.test(p.headers.get('content-type') || ''));
  const html = await p.text();
  checkTrue('tezlik: sarlavha', html.includes('Tezlik tekshiruvi'));
  const script = (html.match(/<script>([\s\S]*?)<\/script>/) || [])[1] || '';
  let ok = true;
  try { new Function(script); } catch (e) { ok = false; console.error(e); }
  checkTrue('tezlik: sahifa skripti sintaksisi to\'g\'ri', ok && script.length > 500);
  checkTrue('tezlik: shablonda ${...} qoldig\'i yo\'q', !TEZLIK_HTML.includes('${'));
}

done();
