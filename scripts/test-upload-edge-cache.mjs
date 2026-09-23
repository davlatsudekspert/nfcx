// RASMLAR CLOUDFLARE CHEGARA KESHIDA (egasi, 2026-09: "rasmlar sekin").
//
// Rasm birinchi marta R2'dan o'qilgach, yaqin Cloudflare serverida
// saqlanadi; keyingi so'rov R2'ga bormaydi. Video (Range) va katta
// fayllar keshlanmaydi. Javob baytlari o'zgarmaydi.
//
//   node scripts/test-upload-edge-cache.mjs
import worker from '../hosting/worker.js';
import { makeEnv, req, makeChecker } from './lib/d1-harness.mjs';

const { check, done } = makeChecker();
const { env } = makeEnv();

// Cloudflare `caches.default` o'rnini bosuvchi xotira keshi.
const cache = new Map();
globalThis.caches = {
  default: {
    async match(r) { const hit = cache.get(r.url); return hit ? hit.clone() : undefined; },
    async put(r, res) { cache.set(r.url, res.clone()); },
  },
};

// R2 o'qishlarini sanaymiz.
let gets = 0;
const origGet = env.UPLOADS.get.bind(env.UPLOADS);
env.UPLOADS.get = async (...a) => { gets++; return origGet(...a); };

const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3, 4]);
await env.UPLOADS.put('uploads/abc123.png', png, { httpMetadata: { contentType: 'image/png' } });
await env.UPLOADS.put('uploads/v1.mp4', new Uint8Array(64), { httpMetadata: { contentType: 'video/mp4' } });

const get = async (path, headers = {}) => {
  const res = await worker.fetch(req(path, { headers }), env);
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

// 4) Video va Range — keshlanmaydi.
r = await get('/uploads/v1.mp4', { range: 'bytes=0-9' });
check('4) video range 206', r.status, 206);
r = await get('/uploads/v1.mp4');
check('4) video to‘liq 200', r.status, 200);
check('4) video keshga yozilmadi', cache.has('https://nfcstore.uz/uploads/v1.mp4'), false);

// 5) Yo'q fayl — 404, kesh ifloslanmaydi.
r = await get('/uploads/yoq.png');
check('5) 404', r.status, 404);
check('5) keshda yo‘q', cache.has('https://nfcstore.uz/uploads/yoq.png'), false);

// 6) Yo'l o'tish himoyasi o'z joyida.
r = await get('/uploads/..%2Fsecret.png');
check('6) bad_path', r.status, 400);

done();
