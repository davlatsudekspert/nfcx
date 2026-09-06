// hosting/api/media.js testi — haqiqiy worker.fetch + in-memory D1/R2 (scripts/lib/d1-harness.mjs).
//   node scripts/test-media.mjs
import worker from '../hosting/worker.js';
import { makeEnv, seedBasic, cookie, req, makeChecker } from './lib/d1-harness.mjs';

const { check, checkTrue, done } = makeChecker();
const { env } = makeEnv();
await seedBasic(env);

const setTier = (code, tier) => env.DB.prepare(`UPDATE cards SET tier_override = ? WHERE code = ?`).bind(tier, code).run();
const call = async (pathname, init) => {
  const res = await worker.fetch(req(pathname, init), env);
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
};
const PDF_B64 = Buffer.from('%PDF-1.4\n1 0 obj << >> endobj\n%%EOF').toString('base64');
const PDF_DATA_URL = `data:application/pdf;base64,${PDF_B64}`;

// =========================== files ===========================
{
  const r = await call('/api/records/VIP001/files');
  check('GET /files public (empty)', r, { status: 200, body: { files: [] } });
  check('GET /files bad code -> 400', (await call('/api/records/GOD123/files')).status, 400);
  check('GET /files/manage no session -> 401', (await call('/api/records/VIP001/files/manage')).status, 401);
  check('GET /files/manage not owner -> 403', (await call('/api/records/VIP001/files/manage', { cookie: cookie.other })).status, 403);
  check('POST /files no session -> 401', (await call('/api/records/VIP001/files', { method: 'POST', json: { dataUrl: PDF_DATA_URL } })).status, 401);
}
let fileId = 0; let fileUrl = '';
{
  await setTier('VIP001', 'gold'); // FILE_LIMIT.gold = 5
  const r = await call('/api/records/VIP001/files', { method: 'POST', cookie: cookie.user, json: { title: 'Katalog', dataUrl: PDF_DATA_URL } });
  check('POST /files (gold) -> 201', r.status, 201);
  checkTrue('POST /files row shape', r.body && typeof r.body.id === 'number' && r.body.title === 'Katalog' && /^\/uploads\/file_[a-f0-9]{24}\.pdf$/.test(r.body.fileUrl) && r.body.sizeBytes === Buffer.from(PDF_B64, 'base64').length && r.body.sort === 0 && typeof r.body.createdAt === 'string');
  fileId = r.body.id; fileUrl = r.body.fileUrl;
  checkTrue('POST /files stored PDF in R2 with content-type', env.UPLOADS._store.get(fileUrl.slice(1))?.httpMetadata.contentType === 'application/pdf');
  const served = await worker.fetch(req(fileUrl), env);
  check('GET /uploads/<pdf> served -> 200 application/pdf', [served.status, served.headers.get('content-type')], [200, 'application/pdf']);
  check('POST /files untitled -> "Hujjat"', (await call('/api/records/VIP001/files', { method: 'POST', cookie: cookie.user, json: { dataUrl: PDF_DATA_URL } })).body.title, 'Hujjat');
  check('POST /files bad dataUrl -> 422 bad_file', await call('/api/records/VIP001/files', { method: 'POST', cookie: cookie.user, json: { dataUrl: 'data:image/png;base64,AAAA' } }), { status: 422, body: { error: 'bad_file' } });
  check('POST /files wrong magic -> 422 bad_file', (await call('/api/records/VIP001/files', { method: 'POST', cookie: cookie.user, json: { dataUrl: `data:application/pdf;base64,${Buffer.from('hello world').toString('base64')}` } })).status, 422);
  await setTier('OTH222', 'silver');
  check('POST /files silver -> 403 feature_locked', await call('/api/records/OTH222/files', { method: 'POST', cookie: cookie.other, json: { dataUrl: PDF_DATA_URL } }), { status: 403, body: { error: 'feature_locked', feature: 'fileCatalog' } });
  check('POST /files not owner -> 403 forbidden', await call('/api/records/OTH222/files', { method: 'POST', cookie: cookie.user, json: { dataUrl: PDF_DATA_URL } }), { status: 403, body: { error: 'forbidden' } });
  for (let i = 0; i < 3; i += 1) await env.DB.prepare(`INSERT INTO card_files (code, title, file_url) VALUES ('VIP001', 'f', '/uploads/x.pdf')`).run();
  check('POST /files at limit -> 429 limit_reached', await call('/api/records/VIP001/files', { method: 'POST', cookie: cookie.user, json: { dataUrl: PDF_DATA_URL } }), { status: 429, body: { error: 'limit_reached', limit: 5 } });
  const mg = await call('/api/records/VIP001/files/manage', { cookie: cookie.user });
  check('GET /files/manage shape', [mg.status, mg.body.files.length, mg.body.limit, mg.body.count, mg.body.allowed], [200, 5, 5, 5, true]);
  const pub = await call('/api/records/VIP001/files');
  check('GET /files public lists 5 with shape', [pub.body.files.length, Object.keys(pub.body.files[0])], [5, ['id', 'title', 'fileUrl', 'sizeBytes', 'sort', 'createdAt']]);
  const up = await call(`/api/records/VIP001/files/${fileId}`, { method: 'PUT', cookie: cookie.user, json: { title: 'Yangi', sort: 2 } });
  check('PUT /files/:id -> updated', [up.status, up.body.title, up.body.sort, up.body.fileUrl], [200, 'Yangi', 2, fileUrl]);
  check('PUT /files/:id not owner -> 403', (await call(`/api/records/VIP001/files/${fileId}`, { method: 'PUT', cookie: cookie.other, json: { title: 'x' } })).status, 403);
  check('PUT /files/:id unknown -> 404', (await call('/api/records/VIP001/files/99999', { method: 'PUT', cookie: cookie.user, json: { title: 'x' } })).status, 404);
  check('DELETE /files/:id no session -> 401', (await call(`/api/records/VIP001/files/${fileId}`, { method: 'DELETE' })).status, 401);
  check('DELETE /files/:id -> ok', await call(`/api/records/VIP001/files/${fileId}`, { method: 'DELETE', cookie: cookie.user }), { status: 200, body: { ok: true } });
  check('DELETE /files/:id removed R2 object', env.UPLOADS._store.has(fileUrl.slice(1)), false);
  check('GET /files after delete -> 4', (await call('/api/records/VIP001/files')).body.files.length, 4);
}

// =========================== team ===========================
{
  check('GET /team public (empty)', await call('/api/records/BIZ777/team'), { status: 200, body: { team: [] } });
  check('POST /team no session -> 401', (await call('/api/records/BIZ777/team', { method: 'POST', json: { name: 'A' } })).status, 401);
  check('POST /team not owner -> 403', (await call('/api/records/BIZ777/team', { method: 'POST', cookie: cookie.other, json: { name: 'A' } })).status, 403);
  check('POST /team personal profile -> 403 not_business', await call('/api/records/VIP001/team', { method: 'POST', cookie: cookie.user, json: { name: 'A' } }), { status: 403, body: { error: 'not_business' } });
  await setTier('BIZ777', 'free'); // TEAM_LIMIT.free = 3
  const c = await call('/api/records/BIZ777/team', { method: 'POST', cookie: cookie.user, json: { name: 'Ali', position: 'CEO', memberCode: 'vip-001', photoUrl: '/uploads/p.jpg', sort: 1 } });
  check('POST /team -> 201 shape', c, { status: 201, body: { id: c.body?.id, name: 'Ali', position: 'CEO', photoUrl: '/uploads/p.jpg', memberCode: 'VIP001', sort: 1 } });
  check('POST /team name required -> 422', (await call('/api/records/BIZ777/team', { method: 'POST', cookie: cookie.user, json: { position: 'x' } })).status, 422);
  const pub = await call('/api/records/BIZ777/team');
  check('GET /team public joins memberName', pub.body.team[0].memberName, 'Muhammad');
  await call('/api/records/BIZ777/team', { method: 'POST', cookie: cookie.user, json: { name: 'B' } });
  await call('/api/records/BIZ777/team', { method: 'POST', cookie: cookie.user, json: { name: 'C' } });
  check('POST /team at limit -> 429', await call('/api/records/BIZ777/team', { method: 'POST', cookie: cookie.user, json: { name: 'D' } }), { status: 429, body: { error: 'limit_reached', limit: 3 } });
  const mg = await call('/api/records/BIZ777/team/manage', { cookie: cookie.user });
  check('GET /team/manage shape', [mg.status, mg.body.team.length, mg.body.limit, mg.body.count, mg.body.eligible], [200, 3, 3, 3, true]);
  check('GET /team/manage personal -> eligible:false', (await call('/api/records/VIP001/team/manage', { cookie: cookie.user })).body.eligible, false);
  check('GET /team/manage not owner -> 403', (await call('/api/records/BIZ777/team/manage', { cookie: cookie.other })).status, 403);
  const up = await call(`/api/records/BIZ777/team/${c.body.id}`, { method: 'PUT', cookie: cookie.user, json: { position: 'CTO', memberCode: '' } });
  check('PUT /team/:id -> updated', [up.status, up.body.position, up.body.memberCode, up.body.name], [200, 'CTO', null, 'Ali']);
  check('PUT /team/:id empty name -> 422', (await call(`/api/records/BIZ777/team/${c.body.id}`, { method: 'PUT', cookie: cookie.user, json: { name: '' } })).status, 422);
  check('PUT /team/:id unknown -> 404', (await call('/api/records/BIZ777/team/99999', { method: 'PUT', cookie: cookie.user, json: { name: 'Z' } })).status, 404);
  check('DELETE /team/:id -> ok', await call(`/api/records/BIZ777/team/${c.body.id}`, { method: 'DELETE', cookie: cookie.user }), { status: 200, body: { ok: true } });
  check('GET /team after delete -> 2', (await call('/api/records/BIZ777/team')).body.team.length, 2);
}

// =========================== gallery ===========================
{
  check('GET /gallery public (empty)', await call('/api/records/BIZ777/gallery'), { status: 200, body: { gallery: [] } });
  check('POST /gallery free tier -> 403 feature_locked', await call('/api/records/BIZ777/gallery', { method: 'POST', cookie: cookie.user, json: { imageUrl: '/uploads/a.jpg' } }), { status: 403, body: { error: 'feature_locked', feature: 'gallery' } });
  await setTier('BIZ777', 'silver'); // GALLERY_LIMIT.silver = 6
  check('POST /gallery personal -> 403 not_business', (await call('/api/records/VIP001/gallery', { method: 'POST', cookie: cookie.user, json: { imageUrl: '/uploads/a.jpg' } })).body.error, 'not_business');
  check('POST /gallery bad image -> 422', await call('/api/records/BIZ777/gallery', { method: 'POST', cookie: cookie.user, json: { imageUrl: 'javascript:alert(1)' } }), { status: 422, body: { error: 'image_required' } });
  const c = await call('/api/records/BIZ777/gallery', { method: 'POST', cookie: cookie.user, json: { imageUrl: '/uploads/a.jpg', caption: 'Ofis', sort: 2 } });
  check('POST /gallery -> 201 shape', c, { status: 201, body: { id: c.body?.id, imageUrl: '/uploads/a.jpg', caption: 'Ofis', sort: 2 } });
  check('POST /gallery external https ok', (await call('/api/records/BIZ777/gallery', { method: 'POST', cookie: cookie.user, json: { imageUrl: 'https://example.com/x.jpg' } })).status, 201);
  const mg = await call('/api/records/BIZ777/gallery/manage', { cookie: cookie.user });
  check('GET /gallery/manage shape', [mg.status, mg.body.gallery.length, mg.body.limit, mg.body.count, mg.body.eligible], [200, 2, 6, 2, true]);
  check('GET /gallery/manage no session -> 401', (await call('/api/records/BIZ777/gallery/manage')).status, 401);
  for (let i = 0; i < 4; i += 1) await env.DB.prepare(`INSERT INTO card_gallery (code, image_url) VALUES ('BIZ777', '/uploads/g.jpg')`).run();
  check('POST /gallery at limit -> 429', await call('/api/records/BIZ777/gallery', { method: 'POST', cookie: cookie.user, json: { imageUrl: '/uploads/b.jpg' } }), { status: 429, body: { error: 'limit_reached', limit: 6 } });
  const up = await call(`/api/records/BIZ777/gallery/${c.body.id}`, { method: 'PUT', cookie: cookie.user, json: { caption: 'Yangi' } });
  check('PUT /gallery/:id -> updated', up, { status: 200, body: { id: c.body.id, imageUrl: '/uploads/a.jpg', caption: 'Yangi', sort: 2 } });
  check('PUT /gallery/:id not owner -> 403', (await call(`/api/records/BIZ777/gallery/${c.body.id}`, { method: 'PUT', cookie: cookie.other, json: { caption: 'x' } })).status, 403);
  check('DELETE /gallery/:id -> ok', await call(`/api/records/BIZ777/gallery/${c.body.id}`, { method: 'DELETE', cookie: cookie.user }), { status: 200, body: { ok: true } });
  check('GET /gallery public after delete -> 5', (await call('/api/records/BIZ777/gallery')).body.gallery.length, 5);
}

// =========================== videos ===========================
{
  const mp4 = new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, ...new Array(64).fill(1)]); // ....ftypisom...
  const post = (code, body, qs = '', c = cookie.user) => call(`/api/records/${code}/video${qs}`, { method: 'POST', cookie: c || undefined, body, headers: { 'content-type': 'video/mp4' } });
  check('GET /videos public (empty)', await call('/api/records/VIP001/videos'), { status: 200, body: { videos: [] } });
  check('POST /video no session -> 401', (await post('VIP001', mp4, '', null)).status, 401);
  check('POST /video not owner -> 403', (await post('OTH222', mp4)).status, 403);
  check('POST /video gold -> 403 feature_locked', await post('VIP001', mp4), { status: 403, body: { error: 'feature_locked', feature: 'video' } });
  await setTier('VIP001', 'premium'); // VIDEO_LIMITS.premium = { count: 1, mb: 30 }
  check('POST /video bad bytes -> 422', await post('VIP001', new Uint8Array(50)), { status: 422, body: { error: 'bad_file' } });
  const c = await post('VIP001', mp4, '?title=Reels&thumb=%2Fuploads%2Ft.jpg');
  check('POST /video -> 201', c.status, 201);
  checkTrue('POST /video row shape', c.body && /^\/uploads\/video_[a-f0-9]{24}\.mp4$/.test(c.body.videoUrl) && c.body.thumbUrl === '/uploads/t.jpg' && c.body.title === 'Reels' && c.body.sizeBytes === mp4.length && c.body.sort === 0 && typeof c.body.createdAt === 'string');
  checkTrue('POST /video stored in R2 as video/mp4', env.UPLOADS._store.get(c.body.videoUrl.slice(1))?.httpMetadata.contentType === 'video/mp4');
  check('POST /video at limit -> 429', await post('VIP001', mp4), { status: 429, body: { error: 'limit_reached', limit: 1 } });
  check('GET /videos public lists 1', (await call('/api/records/VIP001/videos')).body.videos.length, 1);
  const up = await call(`/api/records/VIP001/videos/${c.body.id}`, { method: 'PUT', cookie: cookie.user, json: { title: 'Yangi', sort: 3 } });
  check('PUT /records/:code/videos/:id -> updated', [up.status, up.body.title, up.body.sort, up.body.thumbUrl], [200, 'Yangi', 3, '/uploads/t.jpg']);
  const up2 = await call(`/api/videos/${c.body.id}`, { method: 'PUT', cookie: cookie.user, json: { thumbUrl: '/uploads/t2.jpg' } });
  check('PUT /api/videos/:id -> updated', [up2.status, up2.body.thumbUrl, up2.body.title], [200, '/uploads/t2.jpg', 'Yangi']);
  check('PUT /api/videos/:id not owner -> 403', (await call(`/api/videos/${c.body.id}`, { method: 'PUT', cookie: cookie.other, json: { title: 'x' } })).status, 403);
  check('PUT /api/videos/:id no session -> 401', (await call(`/api/videos/${c.body.id}`, { method: 'PUT', json: { title: 'x' } })).status, 401);
  check('PUT /api/videos/:id unknown -> 404', (await call('/api/videos/99999', { method: 'PUT', cookie: cookie.user, json: { title: 'x' } })).status, 404);
  check('DELETE /api/videos/:id -> ok', await call(`/api/videos/${c.body.id}`, { method: 'DELETE', cookie: cookie.user }), { status: 200, body: { ok: true } });
  check('DELETE /api/videos/:id removed R2 object', env.UPLOADS._store.has(c.body.videoUrl.slice(1)), false);
  check('GET /videos after delete -> 0', (await call('/api/records/VIP001/videos')).body.videos.length, 0);
}

// unmatched paths fall through to the worker's 404
check('unknown /api/records/:code/other -> 404 not_found', (await call('/api/records/VIP001/other')).status, 404);

done();
