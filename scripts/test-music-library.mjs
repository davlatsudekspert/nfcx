// MUSIQA KUTUBXONASI (2026-09-25).
//
// Egasi: "reelsga musiqa qo'shadigan qilish kerak". 1-bosqich: admin
// kutubxonaga trek yuklaydi, ilova faqat YOQILGAN treklarni ko'radi.
// Tekshiriladi: jadval yo'q bo'lsa ham ommaviy ro'yxat yiqilmaydi,
// faqat manager+ qo'sha oladi, faqat o'zimizning /uploads audio manzili
// qabul qilinadi, ishlatilgan trek o'chirilmaydi, audio yuklash yo'li
// faqat audio qabul qiladi.
//
//   node scripts/test-music-library.mjs

import worker, { ensureCoreSchema } from '../hosting/worker.js';
import { makeEnv, seedBasic, req, cookie, makeChecker, sha256Hex } from './lib/d1-harness.mjs';

const { env } = makeEnv();
await ensureCoreSchema(env);
await seedBasic(env);
await env.DB.prepare(`INSERT INTO admin_sessions (token, admin_id, role, abs_exp, last_activity) VALUES (?, 3, 'content_manager', '2999-01-01T00:00:00.000Z', ?)`)
  .bind(sha256Hex('cm-token'), new Date().toISOString()).run();
const cmCookie = 'nfc_admin_session=cm-token';
const { check, done } = makeChecker();

const call = async (path, init = {}) => {
  const res = await worker.fetch(req(path, init), env);
  return { status: res.status, body: await res.json().catch(() => null) };
};

// 1) Jadval hali yo'q — ilova bo'sh ro'yxat oladi (503 emas).
let r = await call('/api/music');
check('jadval yo‘q: 200', r.status, 200);
check('jadval yo‘q: bo‘sh ro‘yxat', r.body.tracks, []);
check('janrlar keladi', r.body.genres.includes('Ta’sirli'), true);

// 2) Ruxsatlar.
r = await call('/api/admin/music', { method: 'POST', json: { title: 'X', audioUrl: '/uploads/music_a.mp3' } });
check('kirmagan: 401', r.status, 401);
r = await call('/api/admin/music', { method: 'POST', cookie: cmCookie, json: { title: 'X', audioUrl: '/uploads/music_a.mp3' } });
check('content_manager qo‘sha olmaydi: 403', r.status, 403);
r = await call('/api/admin/music', { cookie: cmCookie });
check('content_manager ro‘yxatni ko‘radi', r.status, 200);

// 3) Noto'g'ri manzillar.
const bad = ['https://evil.example/a.mp3', '/uploads/../secret.mp3', '/uploads/music_a.exe', 'javascript:alert(1)', ''];
for (const audioUrl of bad) {
  r = await call('/api/admin/music', { method: 'POST', cookie: cookie.manager, json: { title: 'X', audioUrl } });
  check(`yomon manzil rad etiladi: ${audioUrl || '(bo‘sh)'}`, r.status, 422);
}
r = await call('/api/admin/music', { method: 'POST', cookie: cookie.manager, json: { title: '  ', audioUrl: '/uploads/music_a.mp3' } });
check('nomsiz trek: 422', r.body?.error, 'title_required');
r = await call('/api/admin/music', { method: 'POST', cookie: cookie.manager, json: { title: 'X', audioUrl: '/uploads/music_a.mp3', clipUrl: 'https://x/y.mp3' } });
check('yomon 30 s bo‘lak: 422', r.body?.error, 'bad_clip');

// 4) Qo'shish.
r = await call('/api/admin/music', {
  method: 'POST', cookie: cookie.manager,
  json: { title: 'Yurak sadosi', artist: 'NFCSTORE', genre: 'Ta’sirli', durationSec: 214.4, audioUrl: '/uploads/music_1.mp3', clipUrl: '/uploads/music_1c.mp3', source: 'O‘z kanalimiz' },
});
check('manager qo‘shadi: 201', r.status, 201);
const a = r.body.track;
check('trek maydonlari', [a.title, a.artist, a.genre, a.durationSec, a.clipUrl, a.enabled, a.source], ['Yurak sadosi', 'NFCSTORE', 'Ta’sirli', 214, '/uploads/music_1c.mp3', true, 'O‘z kanalimiz']);
r = await call('/api/admin/music', { method: 'POST', cookie: cookie.admin, json: { title: 'Bahor', genre: 'nomaʼlum', audioUrl: '/uploads/music_2.mp3' } });
const b = r.body.track;
check('noma’lum janr → Boshqa', b.genre, 'Boshqa');

// 5) Ommaviy ro'yxat: admin maydonlari ko'rinmaydi, filtrlar ishlaydi.
r = await call('/api/music');
check('ommaviy: 2 ta trek', r.body.tracks.length, 2);
check('ommaviy: manba/yaratuvchi yashirin', ['source', 'createdBy', 'enabled'].some((k) => k in r.body.tracks[0]), false);
check('janr filtri', (await call('/api/music?genre=' + encodeURIComponent('Ta’sirli'))).body.tracks.map((t) => t.id), [a.id]);
check('qidiruv (ijrochi)', (await call('/api/music?q=nfcst')).body.tracks.map((t) => t.id), [a.id]);
check('qidiruvda % belgisi hammasini qaytarmaydi', (await call('/api/music?q=%25')).body.tracks.length, 2);

// 6) Yashirish va tahrirlash.
r = await call(`/api/admin/music/${b.id}`, { method: 'PATCH', cookie: cookie.manager, json: { enabled: false, title: 'Bahor tongi' } });
check('yashirish: 200', [r.status, r.body.track.enabled, r.body.track.title], [200, false, 'Bahor tongi']);
check('yashirilgan ommaviy ro‘yxatda yo‘q', (await call('/api/music')).body.tracks.map((t) => t.id), [a.id]);
check('admin ro‘yxatida bor', (await call('/api/admin/music', { cookie: cookie.manager })).body.tracks.length, 2);
r = await call(`/api/admin/music/${b.id}`, { method: 'PATCH', cookie: cmCookie, json: { enabled: true } });
check('content_manager tahrirlay olmaydi', r.status, 403);
r = await call(`/api/admin/music/${b.id}`, { method: 'PATCH', cookie: cookie.manager, json: {} });
check('bo‘sh tahrir: 422', r.status, 422);

// 7) O'chirish: ishlatilgani 409, ishlatilmagani R2 bilan birga.
await env.UPLOADS.put('uploads/music_2.mp3', new Uint8Array([1, 2, 3]));
await env.DB.prepare(`UPDATE music_tracks SET uses = 3 WHERE id = ?`).bind(a.id).run();
r = await call(`/api/admin/music/${a.id}`, { method: 'DELETE', cookie: cookie.manager });
check('ishlatilgan trek o‘chirilmaydi', [r.status, r.body.error, r.body.uses], [409, 'in_use', 3]);
r = await call(`/api/admin/music/${b.id}`, { method: 'DELETE', cookie: cookie.manager });
check('ishlatilmagan trek o‘chadi', r.status, 200);
check('R2 fayli ham o‘chdi', env.UPLOADS._store.has('uploads/music_2.mp3'), false);
check('topilmadi: 404', (await call(`/api/admin/music/${b.id}`, { method: 'DELETE', cookie: cookie.manager })).status, 404);

// 8) Audio yuklash yo'li: mp3 o'tadi, rasm o'tmaydi, oddiy foydalanuvchi kira olmaydi.
const mp3 = new Uint8Array(4096); mp3.set([0x49, 0x44, 0x33, 3, 0]);
const jpg = new Uint8Array(4096); jpg.set([0xff, 0xd8, 0xff, 0xe0]);
const upload = (bytes, type, c) => call('/api/admin/upload-audio', { method: 'POST', cookie: c, body: bytes, headers: { 'content-type': type, 'x-file-name': 'trek.mp3' } });
r = await upload(mp3, 'audio/mpeg', cookie.admin);
check('mp3 yuklanadi', [r.status, /^\/uploads\/music[\w-]*/.test(r.body?.url || '')], [200, true]);
check('yuklangan manzil kutubxonaga mos', /^\/uploads\/[\w\-./]{1,200}\.(mp3|m4a|aac|ogg|oga|wav)$/i.test(r.body?.url || '') || r.body?.url, true);
r = await upload(jpg, 'image/jpeg', cookie.admin);
check('rasm rad etiladi', r.status >= 400, true);
r = await upload(mp3, 'audio/mpeg', cookie.user);
check('oddiy foydalanuvchi: 401', r.status, 401);

done();
