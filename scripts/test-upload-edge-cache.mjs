// RASMLAR CLOUDFLARE CHEGARA KESHIDA (egasi, 2026-09: "rasmlar sekin").
//
// Rasm birinchi marta R2'dan o'qilgach, yaqin Cloudflare serverida
// saqlanadi; keyingi so'rov R2'ga bormaydi. Javob baytlari o'zgarmaydi.
// Video (2026-09-28): birinchi so'rov R2'dan (kuttirmaydi), fonda to'liq
// nusxa keshga yoziladi; keyingi Range qismlari keshdan 206.
//
//   node scripts/test-upload-edge-cache.mjs
import worker from '../hosting/worker.js';
import { makeEnv, req, makeChecker } from './lib/d1-harness.mjs';

const { check, done } = makeChecker();
const { env } = makeEnv();

// Cloudflare `caches.default` o'rnini bosuvchi xotira keshi. Haqiqiy
// Cloudflare kabi: Range bo'lsa to'liq 200 nusxadan 206 qism qaytaradi.
const cache = new Map();
globalThis.caches = {
  default: {
    async match(r) {
      const hit = cache.get(r.url);
      if (!hit) return undefined;
      const range = r.headers.get('range');
      if (!range) return new Response(hit.bytes, { status: 200, headers: hit.headers });
      const m = /^bytes=(\d+)-(\d*)$/.exec(range);
      const a = Number(m[1]); const b = m[2] ? Number(m[2]) : hit.bytes.length - 1;
      const h = new Headers(hit.headers);
      h.set('content-range', `bytes ${a}-${b}/${hit.bytes.length}`);
      h.set('content-length', String(b - a + 1));
      return new Response(hit.bytes.slice(a, b + 1), { status: 206, headers: h });
    },
    async put(r, res) {
      if (r.headers.get('range')) throw new Error('put Range bilan bo‘lmaydi');
      if (res.status !== 200) throw new Error('put faqat 200');
      cache.set(r.url, { bytes: new Uint8Array(await res.arrayBuffer()), headers: new Headers(res.headers) });
    },
  },
};
// Workers `ctx.waitUntil` — fon ishlarini yig'amiz.
const pending = [];
const ctx = { waitUntil: (p) => pending.push(p) };
const settle = async () => { await Promise.all(pending.splice(0)); };

// R2 o'qishlarini sanaymiz.
let gets = 0;
const origGet = env.UPLOADS.get.bind(env.UPLOADS);
env.UPLOADS.get = async (...a) => { gets++; return origGet(...a); };

const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3, 4]);
await env.UPLOADS.put('uploads/abc123.png', png, { httpMetadata: { contentType: 'image/png' } });
const vid = Uint8Array.from({ length: 64 }, (_, i) => i * 3);
await env.UPLOADS.put('uploads/v1.mp4', vid, { httpMetadata: { contentType: 'video/mp4' } });

const get = async (path, headers = {}) => {
  const res = await worker.fetch(req(path, { headers }), env, ctx);
  return { status: res.status, headers: res.headers, bytes: new Uint8Array(await res.arrayBuffer()) };
};

// 1) Birinchi so'rov — R2'dan, keshga yoziladi.
let r = await get('/uploads/abc123.png');
check('1) 200', r.status, 200);
check('1) baytlar to‘g‘ri', Array.from(r.bytes), Array.from(png));
check('1) R2 bir marta o‘qildi', gets, 1);
check('1) keshga yozildi', cache.has('https://nfcstore.uz/uploads/abc123.png'), true);
check('1) immutable kesh sarlavhasi', String(r.headers.get('cache-control')).includes('immutable'), true);

// 2) Ikkinchi so'rov — keshdan, R2'ga bormaydi.
r = await get('/uploads/abc123.png');
check('2) keshdan 200', r.status, 200);
check('2) baytlar o‘sha', Array.from(r.bytes), Array.from(png));
check('2) R2 qayta o‘qilmadi', gets, 1);
check('2) content-type saqlandi', r.headers.get('content-type'), 'image/png');

// 3) If-None-Match — keshdan 304.
const etag = r.headers.get('etag');
r = await get('/uploads/abc123.png', { 'if-none-match': etag });
check('3) 304', r.status, 304);

// 4) Video: birinchi Range so'rovi — R2'dan (kuttirmaydi), fonda keshga.
gets = 0;
r = await get('/uploads/v1.mp4', { range: 'bytes=0-9' });
check('4) video range 206 (R2)', r.status, 206);
check('4) R2 qismi to‘g‘ri', Array.from(r.bytes), Array.from(vid.slice(0, 10)));
check('4) javobda edge-hit yo‘q (birinchi so‘rov — miss)', r.headers.get('x-nfc-edge'), 'miss');
await settle();
check('4) video to‘liq keshga yozildi', cache.get('https://nfcstore.uz/uploads/v1.mp4')?.bytes.length, 64);
check('4) keshdagi baytlar asl', Array.from(cache.get('https://nfcstore.uz/uploads/v1.mp4').bytes), Array.from(vid));
check('4) keshda content-type', cache.get('https://nfcstore.uz/uploads/v1.mp4').headers.get('content-type'), 'video/mp4');
check('4) keshdagi nusxa 1 kun yashaydi', cache.get('https://nfcstore.uz/uploads/v1.mp4').headers.get('cache-control'), 'public, max-age=86400');

// 4b) Keyingi qismlar — keshdan 206, R2'ga bormaydi.
gets = 0;
r = await get('/uploads/v1.mp4', { range: 'bytes=10-19' });
check('4b) keshdan 206', r.status, 206);
check('4b) qism baytlari', Array.from(r.bytes), Array.from(vid.slice(10, 20)));
check('4b) content-range', r.headers.get('content-range'), 'bytes 10-19/64');
check('4b) edge-hit belgisi', r.headers.get('x-nfc-edge'), 'hit');
check('4b) odamga immutable', String(r.headers.get('cache-control')).includes('immutable'), true);
r = await get('/uploads/v1.mp4');
check('4b) to‘liq 200 keshdan', r.status, 200);
check('4b) to‘liq baytlar', Array.from(r.bytes), Array.from(vid));
await settle();
check('4b) R2 umuman o‘qilmadi', gets, 0);

// 4c) ctx yo'q (eski chaqiruv) — oddiy yo'l ishlaydi, kesh yozilmaydi.
cache.clear();
const plain = await worker.fetch(req('/uploads/v1.mp4', { headers: { range: 'bytes=0-3' } }), env);
check('4c) ctx siz 206', plain.status, 206);
check('4c) ctx siz keshga yozilmadi', cache.has('https://nfcstore.uz/uploads/v1.mp4'), false);

// 4d) HEAD va yo'q video — kesh ifloslanmaydi.
r = await get('/uploads/yoq.mp4', { range: 'bytes=0-3' });
await settle();
check('4d) yo‘q video 404', r.status, 404);
check('4d) keshda yo‘q', cache.has('https://nfcstore.uz/uploads/yoq.mp4'), false);

// 5) Yo'q fayl — 404, kesh ifloslanmaydi.
r = await get('/uploads/yoq.png');
check('5) 404', r.status, 404);
check('5) keshda yo‘q', cache.has('https://nfcstore.uz/uploads/yoq.png'), false);

// 6) Yo'l o'tish himoyasi o'z joyida.
r = await get('/uploads/..%2Fsecret.png');
check('6) bad_path', r.status, 400);

done();
