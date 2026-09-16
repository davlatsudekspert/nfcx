// ILOVA ↔ SERVER uchma-uch sinovini BITTA BUYRUQ bilan ishga tushiradi.
//
//   node scripts/test-live-app.mjs
//
// Nima qiladi: lokal API serverini (production worker + xotiradagi D1)
// bo'sh portda ko'taradi, Flutter tomondagi `test/live_api_test.dart`
// ni o'shanga qaratib ishga tushiradi va oxirida serverni o'chiradi.
//
// NIMA UCHUN ALOHIDA SKRIPT: testni qo'lda ikki terminalda ishga
// tushirish kerak bo'lsa, u AMALDA ishlatilmaydi. Bitta buyruq esa
// CI ga ham, odamga ham birdek qulay.
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

/// Bo'sh portni OPERATSION TIZIMDAN so'raymiz. Qattiq yozilgan port
/// (8787) band bo'lsa, test tushunarsiz tarzda yiqilardi.
const freePort = () =>
  new Promise((resolve, reject) => {
    const srv = createServer();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForServer(port, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/categories`);
      if (res.ok) return true;
    } catch {
      // hali ko'tarilmadi
    }
    await wait(300);
  }
  return false;
}

const port = await freePort();
const flutter = process.env.FLUTTER || 'flutter';

const server = spawn(process.execPath, [path.join(ROOT, 'scripts/dev-api-server.mjs'), '--port', String(port)], {
  cwd: ROOT,
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverLog = '';
server.stdout.on('data', (b) => { serverLog += b; });
server.stderr.on('data', (b) => { serverLog += b; });

const stop = () => { if (!server.killed) server.kill('SIGTERM'); };
process.on('exit', stop);
process.on('SIGINT', () => { stop(); process.exit(130); });

if (!(await waitForServer(port))) {
  stop();
  console.error('Lokal API ko‘tarilmadi:\n' + serverLog);
  process.exit(1);
}
console.log(`Lokal API tayyor: http://127.0.0.1:${port}\n`);

const test = spawn(flutter, ['test', 'test/live_api_test.dart'], {
  cwd: path.join(ROOT, 'mobile'),
  stdio: 'inherit',
  env: { ...process.env, API_BASE: `http://127.0.0.1:${port}` },
});

test.on('exit', (code) => {
  stop();
  if (code !== 0) console.error('\nServer jurnali:\n' + serverLog.split('\n').slice(-40).join('\n'));
  process.exit(code ?? 1);
});
