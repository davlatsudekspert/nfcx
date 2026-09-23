// DALIL ARXIVI — hosting/api/content-archive.js.
//   node scripts/test-content-archive.mjs
//
// Haqiqiy worker.fetch + in-memory D1/R2 (scripts/lib/d1-harness.mjs).
// Tekshiriladi:
//   * post, istoriya, kompaniya posti/istoriyasi o'chirilganda — egasi,
//     admin yoki kartani tozalash — nusxa arxivga tushadi, fayl R2 da qoladi;
//   * begona odam o'chira olmaydi va arxivga hech narsa yozilmaydi;
//   * "Dalil arxivi" faqat admin uchun, izohlar ham shu ro'yxatda,
//     muallif va profil egasi (email, telefon) bilan;
//   * shubhali belgisi, qidiruv va filtrlar; har qidiruv jurnalga yoziladi.
import worker from '../hosting/worker.js';
import { cardContentCleanupStmts } from '../hosting/api/card-cleanup.js';
import { makeEnv, seedBasic, cookie, req, makeChecker } from './lib/d1-harness.mjs';

const { check, checkTrue, done } = makeChecker();
const { env, sqlite } = makeEnv();
await seedBasic(env);

const call = async (pathname, init) => {
  const res = await worker.fetch(req(pathname, init), env);
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
};
const put = async (name) => { await env.UPLOADS.put(`uploads/${name}`, new Uint8Array([1, 2, 3])); return `/uploads/${name}`; };
const inR2 = async (url) => !!(await env.UPLOADS.head(url.slice(1)));
const archived = (kind, id) => env.DB.prepare(
  `SELECT * FROM content_archive WHERE kind = ? AND content_id = ?`).bind(kind, id).first();
const now = new Date().toISOString();
const later = new Date(Date.now() + 86_400_000).toISOString();

// ═══ 1. Egasi o'z postini o'chiradi ═══
const postImg = await put('post_a1.jpg');
sqlite.prepare(`INSERT INTO posts (id, code, user_id, image_url, caption, created_at) VALUES (501, 'VIP001', 1, ?, 'Salom dunyo', ?)`)
  .run(postImg, '2026-09-01 10:00:00');
{
  const foreign = await call('/api/posts/501', { method: 'DELETE', cookie: cookie.other });
  check('1) begona odam o‘chira olmaydi', foreign.status, 404);
  checkTrue('1) begona urinish arxivga YOZILMADI', !(await archived('post', 501)));

  const own = await call('/api/posts/501', { method: 'DELETE', cookie: cookie.user });
  check('1) egasi o‘chirdi', own.status, 200);
  checkTrue('1) post lentadan ketdi', !sqlite.prepare(`SELECT 1 FROM posts WHERE id = 501`).get());
  const a = await archived('post', 501);
  check('1) arxivda: kim, qayerda, nima, kim o‘chirgan',
    a && [a.owner_kind, a.owner_id, a.user_id, a.image_url, a.body, a.created_at, a.deleted_by_user_id, a.reason],
    ['card', 'VIP001', '1', postImg, 'Salom dunyo', '2026-09-01 10:00:00', 1, 'owner']);
  checkTrue('1) rasm fayli R2 da QOLDI', await inR2(postImg));
}

// ═══ 2. Egasi o'z istoriyasini o'chiradi ═══
const storyVid = await put('story_v1.mp4');
sqlite.prepare(`INSERT INTO stories (id, owner_kind, owner_id, user_id, video_url, caption, created_at, expires_at) VALUES (601, 'card', 'VIP001', 1, ?, 'video', ?, ?)`)
  .run(storyVid, now, later);
{
  check('2) begona odam istoriyani o‘chira olmaydi', (await call('/api/stories/601', { method: 'DELETE', cookie: cookie.other })).status, 404);
  check('2) egasi o‘chirdi', (await call('/api/stories/601', { method: 'DELETE', cookie: cookie.user })).status, 200);
  const a = await archived('story', 601);
  check('2) istoriya arxivda', a && [a.owner_id, a.video_url, a.reason], ['VIP001', storyVid, 'owner']);
  checkTrue('2) video fayli R2 da QOLDI', await inR2(storyVid));
}

// ═══ 3. Kompaniya posti va istoriyasi ═══
sqlite.prepare(`INSERT INTO companies (company_id, owner_user_id, display_name, tier, price, status, created_at, updated_at)
  VALUES ('ELITE', '1', 'Elite Qurilish', 'free', 0, 'active', datetime('now'), datetime('now'))`).run();
await call('/api/companies/ELITE/posts'); // jadvallar yaratilsin
sqlite.prepare(`INSERT INTO company_posts (id, company_id, image_url, caption, created_at) VALUES (701, 'ELITE', '/uploads/co1.jpg', 'Aksiya', ?)`).run(now);
sqlite.prepare(`INSERT INTO stories (id, owner_kind, owner_id, user_id, image_url, created_at, expires_at) VALUES (702, 'company', 'ELITE', 1, '/uploads/co2.jpg', ?, ?)`).run(now, later);
{
  check('3) begona kompaniya postini o‘chira olmaydi', (await call('/api/companies/ELITE/posts/701', { method: 'DELETE', cookie: cookie.other })).status >= 400, true);
  checkTrue('3) begona urinish arxivga YOZILMADI', !(await archived('company_post', 701)));
  check('3) egasi kompaniya postini o‘chirdi', (await call('/api/companies/ELITE/posts/701', { method: 'DELETE', cookie: cookie.user })).status, 200);
  const a = await archived('company_post', 701);
  check('3) kompaniya posti arxivda (egasi user#1)', a && [a.owner_kind, a.owner_id, a.user_id, a.body], ['company', 'ELITE', '1', 'Aksiya']);
  check('3) egasi kompaniya istoriyasini o‘chirdi', (await call('/api/companies/ELITE/stories/702', { method: 'DELETE', cookie: cookie.user })).status, 200);
  const s = await archived('story', 702);
  check('3) kompaniya istoriyasi arxivda', s && [s.owner_kind, s.owner_id, s.image_url], ['company', 'ELITE', '/uploads/co2.jpg']);
}

// ═══ 4. Admin o'chiradi ═══
sqlite.prepare(`INSERT INTO posts (id, code, user_id, image_url, caption, created_at) VALUES (801, 'OTH222', 2, '/uploads/bad.jpg', 'Taqiqlangan matn', ?)`).run(now);
{
  check('4) oddiy foydalanuvchi admin yo‘lini ocha olmaydi', (await call('/api/admin/content/post/801', { method: 'DELETE', cookie: cookie.user })).status, 401);
  const r = await call('/api/admin/content/post/801', { method: 'DELETE', cookie: cookie.admin, json: { reason: 'extremism' } });
  check('4) admin o‘chirdi', r.status, 200);
  const a = await archived('post', 801);
  check('4) arxivda admin va sabab', a && [a.user_id, a.deleted_by_admin, a.reason, a.body], ['2', 'admin#1:super_admin', 'extremism', 'Taqiqlangan matn']);
}

// ═══ 5. Karta tozalanganda ham hammasi arxivga tushadi ═══
sqlite.prepare(`INSERT INTO posts (id, code, user_id, caption, created_at) VALUES (901, 'BIZ777', 1, 'eski post', ?)`).run(now);
sqlite.prepare(`INSERT INTO card_videos (id, code, video_url, title) VALUES (902, 'BIZ777', '/uploads/video_x.mp4', 'Rolik')`).run();
sqlite.prepare(`INSERT INTO card_files (id, code, title, file_url) VALUES (903, 'BIZ777', 'Prays', '/uploads/file_x.pdf')`).run();
{
  await env.DB.batch(cardContentCleanupStmts(env, `SELECT code FROM cards WHERE code = ?`, ['BIZ777'], new Date().toISOString()));
  checkTrue('5) karta posti o‘chdi', !sqlite.prepare(`SELECT 1 FROM posts WHERE id = 901`).get());
  const p = await archived('post', 901);
  const v = await archived('card_video', 902);
  const f = await archived('card_file', 903);
  check('5) post, video, fayl arxivda (card_cleanup)',
    [p?.reason, v?.video_url, f?.file_url, f?.user_id], ['card_cleanup', '/uploads/video_x.mp4', '/uploads/file_x.pdf', '1']);
}

// ═══ 6. Izoh arxivi ham "Dalil arxivi"da ═══
sqlite.prepare(`UPDATE users SET is_premium = 1 WHERE id = 2`).run(); // izoh — Premium uchun
sqlite.prepare(`INSERT INTO posts (id, code, user_id, caption, created_at) VALUES (950, 'VIP001', 1, 'post', ?)`).run(now);
{
  const c = await call('/api/comments/post/950', { method: 'POST', cookie: cookie.other, json: { body: 'Haqoratli izoh' } });
  check('6) izoh yozildi', c.status, 201);
  check('6) muallif izohni o‘zi o‘chirdi', (await call(`/api/comments/${c.body.comment.id}`, { method: 'DELETE', cookie: cookie.other })).status, 200);
}

// ═══ 7. Dalil arxivi — faqat admin ═══
{
  check('7) mehmon kira olmaydi', (await call('/api/admin/evidence')).status, 401);
  check('7) oddiy foydalanuvchi kira olmaydi', (await call('/api/admin/evidence', { cookie: cookie.user })).status, 401);
  const r = await call('/api/admin/evidence?limit=100', { cookie: cookie.admin });
  check('7) admin ko‘radi', r.status, 200);
  const items = r.body.items;
  checkTrue('7) izoh ham ro‘yxatda', items.some((i) => i.source === 'comment' && i.body === 'Haqoratli izoh'));
  const cm = items.find((i) => i.source === 'comment');
  check('7) izoh muallifi (email, telefon) va profil egasi',
    [cm.author.email, cm.author.phone, cm.owner.id, cm.owner.user?.email, cm.target],
    ['other@test.local', '+998902222222', 'VIP001', 'user@test.local', { kind: 'post', id: 950 }]);
  check('7) izohni kim o‘chirgani', cm.deletedBy.user?.userId, '2');
  const ad = items.find((i) => i.source === 'content' && i.contentId === 801);
  check('7) admin o‘chirgan post: muallif, egasi, admin',
    [ad.author.email, ad.owner.id, ad.owner.name, ad.deletedBy.admin, ad.imageUrl],
    ['other@test.local', 'OTH222', 'Boshqa', 'admin#1:super_admin', '/uploads/bad.jpg']);
  checkTrue('7) vaqtlar raqam (ms)', typeof ad.createdAt === 'number' && typeof ad.deletedAt === 'number');
  const co = items.find((i) => i.kind === 'company_post');
  check('7) kompaniya posti egasi', [co.owner.kind, co.owner.name, co.owner.user?.email], ['company', 'Elite Qurilish', 'user@test.local']);
}

// ═══ 8. Qidiruv va filtrlar ═══
{
  const byCode = await call('/api/admin/evidence?q=oth222', { cookie: cookie.admin });
  checkTrue('8) NFC ID bo‘yicha (katta-kichik harf farqsiz)', byCode.body.items.length >= 1 && byCode.body.items.every((i) => i.owner.id === 'OTH222' || i.author.code === 'OTH222'));
  const byEmail = await call('/api/admin/evidence?q=other@test.local', { cookie: cookie.admin });
  checkTrue('8) email bo‘yicha — shu odam yozgan hamma narsa', byEmail.body.items.length >= 2 && byEmail.body.items.every((i) => i.author.userId === '2'));
  const onlyComments = await call('/api/admin/evidence?source=comment', { cookie: cookie.admin });
  checkTrue('8) faqat izohlar', onlyComments.body.items.length >= 1 && onlyComments.body.items.every((i) => i.source === 'comment'));
  const videos = await call('/api/admin/evidence?kind=card_video', { cookie: cookie.admin });
  check('8) tur bo‘yicha', videos.body.items.map((i) => i.kind), ['card_video']);
  const log = sqlite.prepare(`SELECT COUNT(*) AS n FROM admin_activity_log WHERE action = 'evidence_search'`).get();
  checkTrue('8) har qidiruv admin jurnalida', Number(log.n) >= 2);
}

// ═══ 9. Shubhali belgisi ═══
{
  const target = (await call('/api/admin/evidence?kind=post', { cookie: cookie.admin })).body.items.find((i) => i.contentId === 801);
  check('9) oddiy foydalanuvchi belgilay olmaydi', (await call('/api/admin/evidence/flag', { method: 'POST', cookie: cookie.user, json: { source: 'content', id: target.id } })).status, 401);
  check('9) noto‘g‘ri manba rad etiladi', (await call('/api/admin/evidence/flag', { method: 'POST', cookie: cookie.admin, json: { source: 'x', id: 1 } })).status, 422);
  const f = await call('/api/admin/evidence/flag', { method: 'POST', cookie: cookie.admin, json: { source: 'content', id: target.id, note: 'IIV so‘rovi №12' } });
  check('9) belgilandi', f.body, { ok: true, flagged: true });
  const flagged = await call('/api/admin/evidence?flagged=1', { cookie: cookie.admin });
  check('9) faqat shubhalilar ro‘yxati', flagged.body.items.map((i) => [i.contentId, i.flag?.note, i.flag?.by]), [[801, 'IIV so‘rovi №12', 'admin#1:super_admin']]);
  await call('/api/admin/evidence/flag', { method: 'POST', cookie: cookie.admin, json: { source: 'content', id: target.id, flagged: false } });
  check('9) belgi olib tashlandi', (await call('/api/admin/evidence?flagged=1', { cookie: cookie.admin })).body.items.length, 0);
  const log = sqlite.prepare(`SELECT action FROM admin_activity_log WHERE action LIKE 'evidence_%flag' ORDER BY id`).all().map((r) => r.action);
  check('9) belgilash jurnalda', log, ['evidence_flag', 'evidence_unflag']);
}

// ═══ 10. Ommaviy javoblarda arxiv chiqmaydi ═══
{
  const pub = await call('/api/records/VIP001/posts');
  const txt = JSON.stringify(pub.body || {});
  checkTrue('10) o‘chirilgan post ommaviy lentada yo‘q', !txt.includes('Salom dunyo'));
}

done();
