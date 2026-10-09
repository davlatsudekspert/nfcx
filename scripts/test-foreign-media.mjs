// BEGONA FAYL (2026-10, api/content-guard.js `foreignMediaUrls`):
//   * boshqa foydalanuvchi yuklagan fayl (R2 `customMetadata.actor`) postga,
//     istoriyaga, kompaniya posti/istoriyasiga, karuselga va ko'rgazmaga
//     ulanmaydi — 403 `foreign_media`;
//   * o'z fayli (`user:<id>` yoki `user:<email>`), admin fayli, metama'lumotsiz
//     eski fayl, yo'q fayl va HEAD xatosi — ruxsat;
//   * egasining O'Z mavjud kontentida turgan fayl — ruxsat.
//   node scripts/test-foreign-media.mjs   (UZ_ADAPTER_TEST=1 bilan ham)
import { setupSocial, cookie, makeChecker } from './lib/social-fixture.mjs';

const { check, checkTrue, done } = makeChecker();
const { env, sqlite, call, resetLimits } = await setupSocial();

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48, 0x44, 0x52, ...new Array(64).fill(1)]);
const upload = async (ck) => {
  const r = await call('/api/upload-media', { method: 'POST', cookie: ck, headers: { 'content-type': 'image/png' }, body: PNG });
  if (r.status !== 200) throw new Error(`upload ${r.status} ${JSON.stringify(r.body)}`);
  return r.body.url;
};
let seq = 0;
const putR2 = async (meta) => {
  const url = `/uploads/fm_${Date.now().toString(36)}_${seq++}.jpg`;
  await env.UPLOADS.put(url.slice(1), PNG, { httpMetadata: { contentType: 'image/jpeg' }, ...(meta ? { customMetadata: meta } : {}) });
  return url;
};
const post = (json, ck = cookie.user, code = 'VIP001') => call(`/api/records/${code}/posts`, { method: 'POST', cookie: ck, json: { agreed: true, ...json } });
const story = (json, ck = cookie.user) => call('/api/records/VIP001/stories', { method: 'POST', cookie: ck, json: { agreed: true, ...json } });
const cpost = (json) => call('/api/companies/ACMEUZ/posts', { method: 'POST', cookie: cookie.user, json: { agreed: true, ...json } });
const cstory = (json) => call('/api/companies/ACMEUZ/stories', { method: 'POST', cookie: cookie.user, json: { agreed: true, ...json } });
const isForeign = (r) => r.status === 403 && r.body?.error === 'foreign_media'
  && r.body?.message === "Bu faylni ishlatib bo'lmaydi. O'zingiz yuklagan rasm yoki videoni tanlang.";

const mine = await upload(cookie.user);
const theirs = await upload(cookie.other);
const adminFile = await putR2({ actor: 'admin:super_admin', uploadedAt: new Date().toISOString() });
const bare = await putR2(null);
const emptyActor = await putR2({ uploadedAt: new Date().toISOString() });
const mineByEmail = await putR2({ actor: 'user:user@test.local' });
const theirsByEmail = await putR2({ actor: 'user:other@test.local' });
const posts0 = sqlite.prepare(`SELECT COUNT(*) AS n FROM posts`).get().n;

// ═══ 1. Begona fayl — har chop etish yo'lida 403 ═══
let r = await post({ imageUrl: theirs, caption: 'x' });
checkTrue('1) post: other user file -> 403 foreign_media', isForeign(r));
check('1) nothing written', sqlite.prepare(`SELECT COUNT(*) AS n FROM posts`).get().n, posts0);
checkTrue('1) post: other user (email actor) -> 403', isForeign(await post({ imageUrl: theirsByEmail })));
checkTrue('1) story -> 403', isForeign(await story({ imageUrl: theirs })));
checkTrue('1) company post -> 403', isForeign(await cpost({ imageUrl: theirs })));
checkTrue('1) company story -> 403', isForeign(await cstory({ imageUrl: theirs })));
checkTrue('1) carousel (2nd item) -> 403', isForeign(await post({ media: [{ type: 'image', url: mine }, { type: 'image', url: theirs }] })));
checkTrue('1) showcase personal -> 403', isForeign(await post({ showcase: true, mediaUrls: [mine, theirs], title: 'T' })));
checkTrue('1) showcase company -> 403', isForeign(await cpost({ showcase: true, mediaUrls: [theirs], title: 'T' })));
resetLimits();

// ═══ 2. Ruxsat etilganlar ═══
r = await post({ imageUrl: mine });
check('2) own upload -> 201', r.status, 201);
check('2) admin file -> 201', (await post({ imageUrl: adminFile })).status, 201);
check('2) metadata-less file -> 201', (await post({ imageUrl: bare })).status, 201);
check('2) no actor in metadata -> 201', (await story({ imageUrl: emptyActor })).status, 201);
check('2) own file by email actor -> 201', (await cstory({ imageUrl: mineByEmail })).status, 201);
check('2) missing object -> 201', (await post({ imageUrl: '/uploads/fm_missing_1.jpg' })).status, 201);
check('2) carousel own + admin -> 201', (await cpost({ media: [{ type: 'image', url: mine }, { type: 'image', url: adminFile }] })).status, 201);
check('2) showcase own -> 201', (await post({ showcase: true, mediaUrls: [mine, bare], title: 'T' })).status, 201);
check('2) uploader may use it -> 201', (await post({ imageUrl: theirs }, cookie.other, 'OTH222')).status, 201);
resetLimits();

// ═══ 3. HEAD xatosi — ruxsat (eski/vaqtincha) ═══
const brokenEnv = { ...env, UPLOADS: Object.assign(Object.create(env.UPLOADS), { head: async () => { throw new Error('r2 down'); } }) };
const { default: worker } = await import('../hosting/worker.js');
const { req } = await import('./lib/d1-harness.mjs');
const res = await worker.fetch(req('/api/records/VIP001/posts', { method: 'POST', cookie: cookie.user, json: { agreed: true, imageUrl: theirs } }), brokenEnv);
check('3) head throws -> allowed', res.status, 201);

// ═══ 4. Egasining O'Z mavjud kontentidagi fayl — ruxsat ═══
const legacy = await putR2({ actor: 'user:2' });
checkTrue('4) before: foreign', isForeign(await story({ imageUrl: legacy })));
sqlite.prepare(`INSERT INTO posts (code, user_id, image_url, caption) VALUES ('VIP001', 1, ?, 'eski')`).run(legacy);
check('4) referenced by own post -> 201', (await story({ imageUrl: legacy })).status, 201);
const legacy2 = await putR2({ actor: 'user:2' });
sqlite.prepare(`INSERT INTO company_posts (company_id, image_url, caption, created_at) VALUES ('ACMEUZ', ?, 'eski', ?)`).run(legacy2, new Date().toISOString());
check('4) referenced by own company post -> 201', (await post({ imageUrl: legacy2 })).status, 201);
// Begona odamning postida turgan fayl — baribir begona.
const legacy3 = await putR2({ actor: 'user:2' });
sqlite.prepare(`INSERT INTO posts (code, user_id, image_url, caption) VALUES ('OTH222', 2, ?, 'begona')`).run(legacy3);
checkTrue('4) referenced only by other user content -> 403', isForeign(await post({ imageUrl: legacy3 })));

done();
