// TEKSHIRILMAY O'TGAN YUKLASH -> ADMIN NAVBATI (egasi, 2026-10-06).
// Filtr yoqiq, lekin Gemini ishlamadi: yuklash o'tadi, fayl esa admin
// "Shikoyatlar" navbatiga `unchecked` sababi bilan tushadi; postda
// ishlatilgan bo'lsa shu postga bog'lanadi; admin o'chirsa shikoyat yopiladi.
// 2026-10: filtr o'chiq bo'lsa (kalit yo'q) ham navbatga tushadi —
// tekshirilmagan fayl jim o'tib ketmasin (content-guard.js).
//   node scripts/test-unchecked-queue.mjs
import worker from '../hosting/worker.js';
import { makeEnv, seedBasic, cookie, req, makeChecker } from './lib/d1-harness.mjs';

const { check, checkTrue, done } = makeChecker();
const { env: base } = makeEnv();
await seedBasic(base);
const env = { ...base, GEMINI_API_KEY: 'test-key' };
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init = {}) => {
  const u = String(input?.url || input);
  if (u.includes('generativelanguage.googleapis.com')) return new Response('boom', { status: 500 });
  return realFetch(input, init);
};
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const j = async (e, path, init) => {
  const r = await worker.fetch(req(path, init), e);
  return { status: r.status, body: await r.json().catch(() => null) };
};
const queued = async (e) => (await e.DB.prepare(`SELECT * FROM content_reports WHERE target_kind = 'media'`).all()).results || [];
// Shikoyat jadvali birinchi so'rovda yaratiladi.
await j(env, '/api/admin/reports', { cookie: cookie.admin });

// 1. Filtr ishlamadi -> yuklash o'tadi va navbatga tushadi.
const up = await j(env, '/api/upload', { method: 'POST', cookie: cookie.user, json: { dataUrl: `data:image/png;base64,${PNG}` } });
check('upload passes when filter is down', up.status, 200);
let q = await queued(env);
check('one unchecked report queued', q.length, 1);
check('report reason = unchecked', [q[0]?.reason, q[0]?.status, q[0]?.target_id], ['unchecked', 'new', up.body?.url]);

// 2. Xuddi shu fayl ikki marta yozilmaydi.
const { queueUncheckedUpload } = await import('../hosting/api/image-moderation.js');
await queueUncheckedUpload(env, { actor: 'user:1', url: up.body.url, source: 'upload' });
check('no duplicate for same file', (await queued(env)).length, 1);

// 3. Filtr o'chiq (kalit yo'q) -> baribir navbatga yoziladi (2026-10).
const up2 = await j(base, '/api/upload', { method: 'POST', cookie: cookie.user, json: { dataUrl: `data:image/png;base64,${PNG}` } });
check('filter off: upload ok', up2.status, 200);
check('filter off: still queued', (await queued(env)).length, 2);

// 4. Admin ro'yxati: postga bog'lanmagan fayl `media` bo'lib ko'rinadi.
let list = await j(env, '/api/admin/reports?status=new', { cookie: cookie.admin });
let row = (list.body?.reports || []).find((r) => r.reason === 'unchecked' && (r.mediaUrl || r.targetId) === up.body.url);
check('admin sees media report', [row?.targetKind, row?.preview?.imageUrl], ['media', up.body.url]);

// 5. Postda ishlatilsa — shu postga bog'lanadi.
await env.DB.prepare(`INSERT INTO posts (code, caption, image_url, created_at) VALUES ('VIP001', 'test', ?, ?)`)
  .bind(up.body.url, new Date().toISOString()).run().catch((e) => console.log('post insert', e.message));
const post = await env.DB.prepare(`SELECT id FROM posts WHERE image_url = ?`).bind(up.body.url).first();
list = await j(env, '/api/admin/reports?status=new', { cookie: cookie.admin });
row = (list.body?.reports || []).find((r) => r.reason === 'unchecked' && r.mediaUrl === up.body.url);
check('linked to post', [row?.targetKind, row?.targetId, row?.mediaUrl], ['post', String(post?.id), up.body.url]);

// 6. Admin postni o'chiradi -> "tekshirilmagan" shikoyat ham yopiladi.
const del = await j(env, `/api/admin/content/post/${post.id}`, { method: 'DELETE', cookie: cookie.admin });
check('admin delete ok', del.status, 200);
check('media report resolved', (await queued(env)).find((x) => x.target_id === up.body.url)?.status, 'resolved');

// 7. Bog'lanmagan faylni o'chirish: fayl ombordan ketadi, shikoyat yopiladi.
await env.DB.prepare(`DELETE FROM content_reports`).run();
const up3 = await j(env, '/api/upload', { method: 'POST', cookie: cookie.user, json: { dataUrl: `data:image/png;base64,${PNG}` } });
const key = up3.body.url.slice(1);
checkTrue('file stored', !!(await env.UPLOADS.get(key)));
const dm = await j(env, '/api/admin/content/media', { method: 'DELETE', cookie: cookie.admin, json: { url: up3.body.url } });
check('media delete ok', dm.status, 200);
checkTrue('file removed from storage', !(await env.UPLOADS.get(key)));
check('report resolved', (await queued(env))[0]?.status, 'resolved');
check('bad url rejected', (await j(env, '/api/admin/content/media', { method: 'DELETE', cookie: cookie.admin, json: { url: '/etc/passwd' } })).status, 422);
check('non-admin rejected', (await j(env, '/api/admin/content/media', { method: 'DELETE', cookie: cookie.user, json: { url: up3.body.url } })).status, 401);

globalThis.fetch = realFetch;
done();
