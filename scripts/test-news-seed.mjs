// NFCSTORE'NING O'Z YANGILIKLARI — bir martalik seed (hosting/api/news-seed.js).
//
// Egasi: "Yangiliklarga o'zing joyla: ilova ishlaganini, mavzularni va
// stikerlar savdosi yo'lga qo'yilganini". Tekshiriladi: GET /api/news
// 3 ta yangilikni uz/ru/en va rasmi bilan qaytaradi; qayta so'rov (yangi
// izolyat ham) ikki nusxa qilmaydi; admin o'chirgan yangilik QAYTA
// TUSHMAYDI; mavjud yangiliklarga tegilmaydi; rasm fayllari saytda bor.
//
//   node scripts/test-news-seed.mjs

import { existsSync } from 'node:fs';
import worker, { ensureCoreSchema } from '../hosting/worker.js';
import { SEED_NEWS, NEWS_SEED_KEY, _resetNewsSeedMemo } from '../hosting/api/news-seed.js';
import { makeEnv, seedBasic, req, cookie, makeChecker } from './lib/d1-harness.mjs';

const { check, checkTrue, done } = makeChecker();
const { env } = makeEnv({}, { atomicBatch: true });
await ensureCoreSchema(env);
await seedBasic(env);

// Oldindan bor yangilik — seed unga tegmasligi kerak.
await env.DB.prepare(`INSERT INTO news (id, title, body, image_url, published, created_at, updated_at)
  VALUES (1, 'Eski yangilik', 'matn', '/uploads/x.png', 1, '2026-09-01 10:00:00+00', '2026-09-01 10:00:00+00')`).run();

const call = async (path, init = {}) => {
  const res = await worker.fetch(req(path, init), env);
  return { status: res.status, body: await res.json().catch(() => null) };
};

// 0) Ma'lumotning o'zi.
check('0) 3 ta yangilik', SEED_NEWS.length, 3);
for (const [i, n] of SEED_NEWS.entries()) {
  for (const l of ['uz', 'ru', 'en']) {
    checkTrue(`0) #${i} ${l}: sarlavha 10–200 belgi`, n[l].title.length >= 10 && n[l].title.length <= 200);
    checkTrue(`0) #${i} ${l}: matn 100–8000 belgi`, n[l].body.length >= 100 && n[l].body.length <= 8000);
  }
  checkTrue(`0) #${i}: rasm /business-assets/ ostida (admin tahririda safeUrl uni saqlaydi)`, n.image.startsWith('/business-assets/news/'));
  checkTrue(`0) #${i}: rasm fayli saytda bor`, existsSync(new URL(`../public${n.image}`, import.meta.url)));
}
checkTrue('0) ilova yangiligi App Store "tez kunda" deydi (yolg\'on va\'da yo\'q)', /App Store.{0,40}tez kunda/i.test(SEED_NEWS[0].uz.body));
checkTrue('0) stikerlar yangiligi /stikerlar sahifasiga yo\'llaydi', SEED_NEWS[2].uz.body.includes('nfcstore.uz/stikerlar'));

// 1) Birinchi GET — seed tushadi, eng yangisi tepada, ilova birinchi.
let r = await call('/api/news');
check('1) 200', r.status, 200);
check('1) 3 yangi + 1 eski = 4', r.body.news.length, 4);
check('1) tartib: ilova, mavzular, stikerlar, eski', r.body.news.map((n) => n.title), [SEED_NEWS[0].uz.title, SEED_NEWS[1].uz.title, SEED_NEWS[2].uz.title, 'Eski yangilik']);
const first = r.body.news[0];
check('1) ru sarlavha', first.titleRu, SEED_NEWS[0].ru.title);
check('1) en matn', first.bodyEn, SEED_NEWS[0].en.body);
check('1) rasm', first.imageUrl, SEED_NEWS[0].image);
checkTrue('1) chop etilgan', first.published);
const old = r.body.news.find((n) => n.id === 1);
check('1) eski yangilik o\'zgarmadi', [old.title, old.imageUrl], ['Eski yangilik', '/uploads/x.png']);

// 2) Qayta GET va yangi izolyat (memo tozalanadi) — ikki nusxa yo'q.
r = await call('/api/news');
check('2) qayta so\'rov: yana 4', r.body.news.length, 4);
_resetNewsSeedMemo();
r = await call('/api/news');
check('2) yangi izolyat: yana 4', r.body.news.length, 4);
const mark = await env.DB.prepare(`SELECT COUNT(*) AS n FROM content_seeds WHERE key = ?`).bind(NEWS_SEED_KEY).first();
check('2) belgi bitta', Number(mark.n), 1);

// 3) Ikki izolyat bir vaqtda — baribir bitta nusxa.
const { env: env2 } = makeEnv({}, { atomicBatch: true });
await ensureCoreSchema(env2);
_resetNewsSeedMemo();
const { ensureNewsSeed } = await import('../hosting/api/news-seed.js');
await Promise.all([ensureNewsSeed(env2), (_resetNewsSeedMemo(), ensureNewsSeed(env2))]);
const c2 = await env2.DB.prepare(`SELECT COUNT(*) AS n FROM news`).first();
check('3) parallel: 3 ta, 6 ta emas', Number(c2.n), 3);

// 4) Admin o'chirsa — qayta tushmaydi.
_resetNewsSeedMemo();
const stikerId = (await call('/api/news')).body.news.find((n) => n.title === SEED_NEWS[2].uz.title).id;
r = await call(`/api/admin/news/${stikerId}`, { method: 'DELETE', cookie: cookie.admin });
check('4) admin o\'chirdi', r.status, 200);
_resetNewsSeedMemo();
r = await call('/api/news');
check('4) yangi izolyatda ham qaytmadi: 3', r.body.news.length, 3);
checkTrue('4) o\'chirilgani yo\'q', !r.body.news.some((n) => n.title === SEED_NEWS[2].uz.title));

// 5) Admin ro'yxati ham seed'ni ko'radi. (ensureCoreSchema modul
// darajasida bir marta ishlaydi, shuning uchun o'sha bazada tekshiriladi.)
_resetNewsSeedMemo();
r = await call('/api/admin/news', { cookie: cookie.admin });
check('5) admin GET: 3 ta (2 seed + eski)', r.body.news.length, 3);

// 6) Admin tahriri rasmni saqlaydi (safeUrl /business-assets/ ni o'tkazadi).
const id6 = r.body.news.find((n) => n.title === SEED_NEWS[0].uz.title).id;
r = await call(`/api/admin/news/${id6}`, { method: 'PUT', cookie: cookie.admin, json: { title: 'Tahrir', imageUrl: SEED_NEWS[0].image } });
check('6) tahrirdan keyin rasm joyida', r.body.imageUrl, SEED_NEWS[0].image);
_resetNewsSeedMemo();
r = await call('/api/news');
check('6) tahrirdan keyin ham qayta tushmadi: 3', r.body.news.length, 3);

done();
