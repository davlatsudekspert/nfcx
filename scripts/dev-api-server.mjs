// LOKAL nfcstore.uz API — ishlab chiqish va qo'lda tekshirish uchun.
//
// NIMA QILADI: production'da Cloudflare'da turgan AYNAN O'SHA
// `hosting/worker.js` ni oddiy Node HTTP serveri ostida ishga
// tushiradi. D1 o'rniga — xotiradagi SQLite (haqiqiy sxema:
// `db/d1-migration/0001-schema.sql`), R2 o'rniga — xotiradagi mock.
// Ya'ni javob shakllari, xatolar, huquq tekshiruvlari — hammasi
// jonli sayt bilan bir xil, chunki kod bir xil.
//
// NIMA UCHUN KERAK: mobil ilovani (Flutter) qo'lda ochib tekshirish
// uchun ishlaydigan API kerak. Jonli `nfcstore.uz` ga ulanish har
// doim ham mumkin emas (tarmoq siyosati, haqiqiy foydalanuvchi
// ma'lumotiga tegib qo'yish xavfi). Bu server esa bir buyruq bilan
// ko'tariladi va ichida faqat demo ma'lumot bo'ladi.
//
// ISHLATISH:
//   node scripts/dev-api-server.mjs            # http://127.0.0.1:8787
//   node scripts/dev-api-server.mjs --port 9000
//   PORT=9000 node scripts/dev-api-server.mjs
//
// Ilovani shunga qaratish:
//   flutter run --dart-define=API_BASE=http://10.0.2.2:8787   # Android emulyator
//
// PRODUCTION'GA TEGMAYDI: bu yerda hech qanday tashqi ulanish yo'q —
// na D1, na R2, na Payme. Ma'lumot process to'xtaganda yo'qoladi.
import http from 'node:http';
import { makeEnv } from './lib/d1-harness.mjs';
import { seedDemo, DEMO } from './lib/demo-seed.mjs';
import worker from '../hosting/worker.js';
import { ensureCoreSchema } from '../hosting/worker.js';

const argPort = (() => {
  const i = process.argv.indexOf('--port');
  return i > 0 ? Number(process.argv[i + 1]) : null;
})();
const PORT = argPort || Number(process.env.PORT) || 8787;
const HOST = process.env.HOST || '0.0.0.0';

const { env } = makeEnv({
  // To'lov endpointlari "yoqilgan" ko'rinsin — ilovadagi to'lov
  // ekranlari shunda haqiqiy yo'lni yuradi (Payme'ga chiqishdan
  // oldingi hamma qadam tekshiriladi).
  PAYMENTS_ENABLED: 'true',
  PAYME_SANDBOX: 'true',
  PAYME_CHECKOUT_DOMAIN: 'checkout.test.paycom.uz',
  PAYME_MERCHANT_ID: 'demo-merchant',
  PAYME_KEY: 'demo-key',
  SITE_ORIGIN: `http://127.0.0.1:${PORT}`,
});

await ensureCoreSchema(env);
await seedDemo(env);

/// Node so'rovini Web `Request` ga o'giradi. Worker faqat shu
/// shaklni biladi.
async function toRequest(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (Array.isArray(v)) v.forEach((one) => headers.append(k, one));
    else if (v != null) headers.set(k, v);
  }
  // Worker IP'ni shu sarlavhadan oladi (rate-limit, admin whitelist).
  if (!headers.has('cf-connecting-ip')) {
    headers.set('cf-connecting-ip', req.socket.remoteAddress || '127.0.0.1');
  }
  const host = headers.get('host') || `127.0.0.1:${PORT}`;
  return new Request(`http://${host}${req.url}`, {
    method: req.method,
    headers,
    body: ['GET', 'HEAD'].includes(req.method) ? undefined : body,
  });
}

const server = http.createServer(async (req, res) => {
  const started = Date.now();
  try {
    const request = await toRequest(req);
    const response = await worker.fetch(request, env);
    const headers = {};
    response.headers.forEach((v, k) => { headers[k] = v; });
    const buf = Buffer.from(await response.arrayBuffer());
    res.writeHead(response.status, headers);
    res.end(buf);
    const ms = Date.now() - started;
    console.log(`${String(response.status).padEnd(3)} ${req.method.padEnd(6)} ${req.url}  ${ms}ms`);
  } catch (error) {
    console.error('XATO', req.method, req.url, error);
    res.writeHead(500, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'dev_server_error', detail: String(error && error.message) }));
  }
});

server.listen(PORT, HOST, () => {
  console.log(`\nnfcstore lokal API  →  http://127.0.0.1:${PORT}`);
  console.log(`  demo login:  ${DEMO.email} / ${DEMO.password}`);
  console.log('  demo token:  dev-token-dilshod   (Authorization: Bearer ...)');
  console.log('  profillar:   VIP001 (Dilshod), ABC123 (Malika), DDD333 (Latte Coffee)');
  console.log('  emulyator:   http://10.0.2.2:' + PORT + '\n');
});
