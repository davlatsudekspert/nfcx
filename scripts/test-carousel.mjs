// KARUSEL: bitta postda 10 tagacha rasm (hosting/api/carousel.js).
//
// Tekshiriladi: `media` bilan shaxsiy va biznes posti yaratiladi, birinchi
// rasm `imageUrl` ga yoziladi (eski ilova), video karuselda yo'q, 10 tadan
// ortiq va begona manzil rad etiladi, eski mijoz (`imageUrl`) o'zgarmaydi,
// lenta / profil / kompaniya ro'yxati / saqlanganlar `media` ni beradi,
// egalik va rozilik tekshiriladi.
//
//   node scripts/test-carousel.mjs
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';
import { setupSocial, cookie, makeChecker } from './lib/social-fixture.mjs';
import { purgeStmts } from '../hosting/api/account-purge.js';

const { check, checkTrue, done } = makeChecker();
const { sqlite, call } = await setupSocial();

const img = (n) => `/uploads/car${n}abc.jpg`;
const media = (n) => Array.from({ length: n }, (_, i) => ({ url: img(i + 1), type: 'image' }));
const post = (json, ck = cookie.user, code = 'VIP001') =>
  call(`/api/records/${code}/posts`, { method: 'POST', cookie: ck, json: { agreed: true, ...json } });
const cpost = (json, ck = cookie.user, id = 'ACMEUZ') =>
  call(`/api/companies/${id}/posts`, { method: 'POST', cookie: ck, json: { agreed: true, ...json } });

// ── 1) Shaxsiy karusel ──────────────────────────────────────────────
let r = await post({ media: media(3), caption: 'karusel' });
check('1) 3 rasmli karusel: 201', r.status, 201);
check('1) imageUrl = birinchi rasm (eski ilova uchun)', [r.body.imageUrl, r.body.videoUrl], [img(1), '']);
check('1) media — 3 ta rasm, tartib saqlangan', r.body.mediaItems, media(3));
check('1) mahsulot belgisi shaxsiy postda yo‘q', r.body.products, []);
const carId = r.body.id;
const row = sqlite.prepare(`SELECT image_url, video_url, media_json FROM posts WHERE id = ?`).get(carId);
check('1) bazada: image_url birinchi rasm, media_json JSON', [row.image_url, row.video_url, JSON.parse(row.media_json).length], [img(1), null, 3]);

r = await post({ media: media(10) });
check('1) 10 ta — chegarada: 201', [r.status, r.body.mediaItems.length], [201, 10]);
r = await post({ media: [...media(2), { url: img(1), type: 'image' }] });
check('1) takror rasm jim tashlanadi', [r.status, r.body.mediaItems.length], [201, 2]);

// ── 2) Rad etiladiganlar ───────────────────────────────────────────
const before = sqlite.prepare(`SELECT COUNT(*) AS n FROM posts`).get().n;
for (const [label, m, err] of [
  ['11 ta rasm', media(11), 'too_many_media'],
  ['video karuselda', [{ url: img(1), type: 'image' }, { url: '/uploads/v1abc.mp4', type: 'video' }], 'carousel_images_only'],
  ['tashqi manzil', [{ url: 'https://evil.example/x.jpg', type: 'image' }, { url: img(1), type: 'image' }], 'bad_media'],
  ['papkadan chiqish', [{ url: '/uploads/../secret.jpg', type: 'image' }], 'bad_media'],
  ['ichki papka', [{ url: '/uploads/a/b.jpg', type: 'image' }], 'bad_media'],
  ['exe', [{ url: '/uploads/virus.exe', type: 'image' }], 'bad_media'],
  ['rasm deb video', [{ url: '/uploads/v1abc.mp4', type: 'image' }], 'bad_media'],
  ['noma’lum tur', [{ url: img(1), type: 'audio' }], 'bad_media'],
  ['bo‘sh massiv', [], 'bad_media'],
  ['massiv emas', 'salom', 'bad_media'],
]) {
  r = await post({ media: m });
  check(`2) ${label}: 422 ${err}`, [r.status, r.body?.error], [422, err]);
}
r = await post({ media: media(11) });
check('2) chegara javobda', r.body?.limit, 10);
check('2) rad etilganda post yozilmadi', sqlite.prepare(`SELECT COUNT(*) AS n FROM posts`).get().n, before);

// ── 3) Bitta element — oddiy post (video ham mumkin) ───────────────
r = await post({ media: [{ url: '/uploads/v1abc.mp4', type: 'video' }] });
check('3) bitta video: 201, videoUrl', [r.status, r.body.videoUrl, r.body.imageUrl], [201, '/uploads/v1abc.mp4', '']);
check('3) media — bitta video', r.body.mediaItems, [{ url: '/uploads/v1abc.mp4', type: 'video' }]);
check('3) media_json yozilmaydi', sqlite.prepare(`SELECT media_json FROM posts WHERE id = ?`).get(r.body.id).media_json, null);
r = await post({ media: [{ url: img(7) }] });
check('3) tur ko‘rsatilmasa kengaytmadan aniqlanadi', [r.status, r.body.mediaItems], [201, [{ url: img(7), type: 'image' }]]);

// ── 4) Eski mijoz (media yo'q) — o'zgarmagan ───────────────────────
r = await post({ imageUrl: '/uploads/old.jpg', caption: 'eski' });
check('4) eski shakl: 201', r.status, 201);
check('4) eski maydonlar joyida', [r.body.imageUrl, r.body.caption, typeof r.body.id, typeof r.body.createdAt, r.body.likeCount, r.body.liked],
  ['/uploads/old.jpg', 'eski', 'number', 'number', 0, false]);
check('4) media eski maydonlardan yasaladi', r.body.mediaItems, [{ url: '/uploads/old.jpg', type: 'image' }]);
const oldId = r.body.id;
r = await post({ videoUrl: '/uploads/old.mp4', imageUrl: '/uploads/oldthumb.jpg' });
check('4) eski video+muqova: media video, muqova thumbUrl', r.body.mediaItems, [{ url: '/uploads/old.mp4', type: 'video', thumbUrl: '/uploads/oldthumb.jpg' }]);

// ── 5) Egalik, kirish, rozilik ──────────────────────────────────────
r = await call('/api/records/VIP001/posts', { method: 'POST', json: { agreed: true, media: media(2) } });
check('5) kirmagan: 401', r.status, 401);
r = await post({ media: media(2) }, cookie.other);
check('5) begona profil: 403', r.status, 403);
r = await call('/api/records/VIP001/posts', { method: 'POST', cookie: cookie.user, json: { media: media(2) } });
check('5) roziliksiz: 422 rules_not_accepted', [r.status, r.body?.error], [422, 'rules_not_accepted']);

// ── 6) Profil ro'yxati ─────────────────────────────────────────────
r = await call('/api/records/VIP001/posts');
const list = r.body.posts;
checkTrue('6) hamma postda media massiv', list.every((p) => Array.isArray(p.mediaItems) && p.mediaItems.length >= 1));
check('6) karusel ro‘yxatda 3 rasm', list.find((p) => p.id === carId).mediaItems.length, 3);
check('6) eski post media bitta', list.find((p) => p.id === oldId).mediaItems, [{ url: '/uploads/old.jpg', type: 'image' }]);
checkTrue('6) eski maydonlar ham bor', list.every((p) => 'imageUrl' in p && 'videoUrl' in p && 'likeCount' in p && 'commentCount' in p && 'viewCount' in p));

// ── 7) Biznes karuseli ─────────────────────────────────────────────
r = await cpost({ media: media(4), caption: 'biznes karusel' });
check('7) biznes karusel: 201', [r.status, r.body.post.imageUrl, r.body.post.mediaItems.length], [201, img(1), 4]);
const cId = r.body.post.id;
r = await cpost({ media: media(11) });
check('7) biznes 11 ta: 422', [r.status, r.body.error], [422, 'too_many_media']);
r = await cpost({ media: [{ url: img(1), type: 'image' }, { url: '/uploads/v.mp4', type: 'video' }] });
check('7) biznes video karuselda: 422', [r.status, r.body.error], [422, 'carousel_images_only']);
r = await cpost({ media: media(2) }, cookie.other);
check('7) begona kompaniya: 403', r.status, 403);
r = await cpost({ imageUrl: '/uploads/oldbiz.jpg' });
check('7) biznes eski shakl: 201, media bitta', [r.status, r.body.post.mediaItems], [201, [{ url: '/uploads/oldbiz.jpg', type: 'image' }]]);
r = await call('/api/companies/ACMEUZ/posts');
check('7) kompaniya ro‘yxatida karusel', r.body.posts.find((p) => p.id === cId).mediaItems.length, 4);
checkTrue('7) kompaniya ro‘yxati: eski maydonlar joyida', r.body.posts.every((p) => 'imageUrl' in p && 'authorName' in p && 'likeCount' in p && Array.isArray(p.mediaItems)));

// ── 8) Lenta ───────────────────────────────────────────────────────
r = await call('/api/feed?limit=30', { cookie: cookie.other });
const feed = r.body.feed;
const fCar = feed.find((f) => f.id === carId && f.authorKind === 'card');
const fBiz = feed.find((f) => f.id === cId && f.authorKind === 'company');
check('8) lentada shaxsiy karusel', [fCar?.mediaItems?.length, fCar?.imageUrl], [3, img(1)]);
check('8) lentada biznes karusel', fBiz?.mediaItems?.length, 4);
checkTrue('8) lentadagi hamma postda media', feed.filter((f) => f.kind === 'post').every((f) => Array.isArray(f.mediaItems) && f.mediaItems.length));
checkTrue('8) eski lenta maydonlari joyida', feed.every((f) => ['kind', 'id', 'code', 'authorKind', 'name', 'avatarUrl', 'imageUrl', 'videoUrl', 'caption', 'createdAt', 'likeCount', 'liked', 'likeable', 'commentKind', 'commentCount', 'viewCount'].every((k) => k in f)));
checkTrue('8) lentada ichki ustunlar (media_json, co_*) chiqmaydi', feed.every((f) => !Object.keys(f).some((k) => k.includes('_'))));

// ── 8b) ESKI ILOVA: javobda `media` kaliti UMUMAN yo'q ─────────────
// O'rnatilgan eski ilova (`Post.fromJson`) `media` dagi har `url` ni RASM
// deb oladi — video postda butun MP4 rasm sifatida yuklanardi. Shuning
// uchun yangi maydon `mediaItems` deb nomlangan.
{
  const hasMediaKey = (v) => Array.isArray(v) ? v.some(hasMediaKey)
    : (v && typeof v === 'object') ? Object.entries(v).some(([k, x]) => k === 'media' || hasMediaKey(x)) : false;
  await call('/api/saves', { method: 'POST', cookie: cookie.other, json: { kind: 'post', ref: String(carId) } });
  await call('/api/saves', { method: 'POST', cookie: cookie.other, json: { kind: 'company_post', ref: String(cId) } });
  const video = await post({ media: [{ url: '/uploads/v9abc.mp4', type: 'video' }] });
  const bizNew = await cpost({ media: media(2) });
  const responses = {
    'lenta (mehmon)': await call('/api/feed?limit=30'),
    'lenta (kirgan)': await call('/api/feed?limit=30', { cookie: cookie.other }),
    'profil postlari': await call('/api/records/VIP001/posts', { cookie: cookie.user }),
    'kompaniya postlari': await call('/api/companies/ACMEUZ/posts', { cookie: cookie.user }),
    'saqlangan postlar': await call('/api/saves?kind=post', { cookie: cookie.other }),
    'saqlangan biznes postlari': await call('/api/saves?kind=company_post', { cookie: cookie.other }),
    'shaxsiy post yaratish (video)': video,
    'biznes post yaratish': bizNew,
  };
  for (const [label, res] of Object.entries(responses)) {
    checkTrue(`8b) ${label}: 200/201 va javobda "media" kaliti YO‘Q`, res.status < 300 && !hasMediaKey(res.body));
  }
  check('8b) video post: mediaItems bor, imageUrl bo‘sh (eski ilova MP4 ni rasm deb olmaydi)',
    [video.body.mediaItems, video.body.imageUrl], [[{ url: '/uploads/v9abc.mp4', type: 'video' }], '']);
  check('8b) saqlangan karta mediaItems bilan', responses['saqlangan postlar'].body.items[0].post?.mediaItems?.length, 3);
}

// ── 9) Buzuq media_json — post yiqilmaydi, oddiy maydonga qaytadi ──
sqlite.prepare(`UPDATE posts SET media_json = '{buzuq' WHERE id = ?`).run(carId);
r = await call('/api/records/VIP001/posts');
check('9) buzuq JSON: birinchi rasm bilan', r.body.posts.find((p) => p.id === carId).mediaItems, [{ url: img(1), type: 'image' }]);
sqlite.prepare(`UPDATE posts SET media_json = ? WHERE id = ?`).run(JSON.stringify([{ url: 'https://evil.example/a.jpg', type: 'image' }, { url: img(2), type: 'image' }]), carId);
r = await call('/api/records/VIP001/posts');
check('9) bazadagi begona manzil javobga chiqmaydi', r.body.posts.find((p) => p.id === carId).mediaItems, [{ url: img(2), type: 'image' }]);

// ── 10) Post o'chirilganda karusel rasmlari dalil arxivida ─────────
r = await post({ media: media(3) });
const delId = r.body.id;
r = await call(`/api/posts/${delId}`, { method: 'DELETE', cookie: cookie.user });
check('10) o‘chirish: 200', r.status, 200);
const arch = sqlite.prepare(`SELECT image_url, media_json FROM content_archive WHERE kind = 'post' AND content_id = ? ORDER BY id DESC`).get(delId);
check('10) arxivda birinchi rasm va butun karusel', [arch?.image_url, JSON.parse(arch?.media_json || '[]').length], [img(1), 3]);

// ── 11) FAQAT CRON ISHLAGAN ISOLATE (S1) ──────────────────────────
// Hisob purge'i yangi isolate'da (`ensureCoreSchema` chaqirilmagan) ham
// karuselni arxivga yozishi va 2..N rasmlarni R2 dan O'CHIRMASLIGI kerak.
{
  const probe = fileURLToPath(new URL('./lib/cron-purge-probe.mjs', import.meta.url));
  const db = path.join(mkdtempSync(path.join(os.tmpdir(), 'cronpurge-')), 'db.sqlite');
  const run = (mode) => {
    const out = execFileSync(process.execPath, [probe, mode, db], { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
    return JSON.parse(out.slice(out.lastIndexOf('@@') + 2));
  };
  run('prepare');
  const c = run('cron');
  check('11) cron isolate: modul bayrog‘i boshida o‘chiq (haqiqiy sinov)', c.flagBefore, false);
  check('11) hisob purge qilindi, post ketdi', [c.purged, c.postGone], [true, true]);
  check('11) arxivda butun karusel', c.archMedia, [c.IMG.a, c.IMG.b, c.IMG.c]);
  check('11) karusel rasmlari R2 da QOLDI, faqat avatar o‘chdi', c.r2, { a: true, b: true, c: true, avatar: false });
  check('11) navbat bo‘shadi', c.queueLeft, 0);
}

// ── 12) Purge qarori ustunlar konfiguratsiyasidan (bayroqdan emas) ─────
{
  const env2 = { DB: { prepare: (sql) => ({ sql, bind() { return this; } }) } };
  const base = ['users', 'cards', 'posts', 'company_posts', 'companies', 'content_archive', 'purge_media_queue'];
  const sqlOf = (cols) => purgeStmts(env2, { id: 1 }, 'x', 'ref', { tables: new Set(base), cols: new Set(cols), flags: {} }).map((st) => st.sql);
  const full = sqlOf(['posts.media_json', 'company_posts.media_json', 'content_archive.media_json']);
  checkTrue('12) ustunlar bor: arxiv media_json yozadi', full.some((q) => /INSERT INTO content_archive[\s\S]*media_json/.test(q)));
  checkTrue('12) ustunlar bor: karusel navbatga qo‘yiladi', full.some((q) => /purge_media_queue[\s\S]*json_each[\s\S]*posts x/.test(q)));
  const noArch = sqlOf(['posts.media_json', 'company_posts.media_json']);
  checkTrue('12) arxivda ustun yo‘q: media_json yozilmaydi', !noArch.some((q) => /INSERT INTO content_archive[\s\S]*media_json/.test(q)));
  checkTrue('12) arxivda ustun yo‘q: karusel rasmlari navbatga QO‘YILMAYDI (dalil yo‘qolmasin)', !noArch.some((q) => /purge_media_queue[\s\S]*json_each[\s\S]*\.media_json/.test(q)));
}

done();
