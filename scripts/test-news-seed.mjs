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
import worker, { ensureCoreSchema, companyPlanStateD1, TRIAL_DAYS_LAUNCH, TRIAL_DAYS_DEFAULT, LAUNCH_PROMO_UNTIL } from '../hosting/worker.js';
import { SEED_NEWS, SEED_NEWS_PLAY, NEWS_SEED_KEY, NEWS_PLAY_KEY, NEWS_FIX_KEY, NEWS_FIX_FROM, _resetNewsSeedMemo } from '../hosting/api/news-seed.js';
import { PLAY_STORE_URL } from '../src/lib/appDownload.js';
import { APP_STORE_LIVE } from '../hosting/api/app-store.js';
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
check('0) ikkinchi to\'plamda 2 ta', SEED_NEWS_PLAY.length, 2);
for (const [i, n] of [...SEED_NEWS, ...SEED_NEWS_PLAY].entries()) {
  for (const l of ['uz', 'ru', 'en']) {
    checkTrue(`0) #${i} ${l}: sarlavha 10–200 belgi`, n[l].title.length >= 10 && n[l].title.length <= 200);
    checkTrue(`0) #${i} ${l}: matn 100–8000 belgi`, n[l].body.length >= 100 && n[l].body.length <= 8000);
  }
  checkTrue(`0) #${i}: rasm /business-assets/ ostida (admin tahririda safeUrl uni saqlaydi)`, n.image.startsWith('/business-assets/news/'));
  checkTrue(`0) #${i}: rasm fayli saytda bor`, existsSync(new URL(`../public${n.image}`, import.meta.url)));
}
checkTrue('0) ilova yangiligi App Store "tez kunda" deydi (yolg\'on va\'da yo\'q)', /App Store.{0,40}tez kunda/i.test(SEED_NEWS[0].uz.body));

// ── E'LONDAGI RAQAMLAR KOD BILAN BIR XILMI ──────────────────────────
// Yangilik — va'da. Kod o'zgarsa (limit, sinov muddati, Play havolasi)
// matn jim-jimsiz YOLG'ONGA aylanadi va uni hech kim sezmaydi.
// Shuning uchun raqamlar shu yerda kodning O'ZIDAN olinib solishtiriladi.
const PLAY_NEWS = SEED_NEWS_PLAY[0];
const BIZ_NEWS = SEED_NEWS_PLAY[1];

// Play Market: havola `src/lib/appDownload.js` dagi bilan bir xil bo'lsin.
const playHost = PLAY_STORE_URL.replace(/^https?:\/\//, '');
for (const l of ['uz', 'ru', 'en']) {
  checkTrue(`0) play (${l}): havola PLAY_STORE_URL bilan bir xil`, PLAY_NEWS[l].body.includes(playHost));
}
// iPhone: ilova App Store'da chiqsa, "tez orada" degan matn qolib ketmasin.
checkTrue('0) play: App Store holati kod bilan mos', APP_STORE_LIVE
  ? !/tez orada|скоро|coming soon/i.test(PLAY_NEWS.uz.body + PLAY_NEWS.ru.body + PLAY_NEWS.en.body)
  : /tez orada/i.test(PLAY_NEWS.uz.body));

// Biznes katalogi: bepul tarif va Premium chegaralari `companyPlanStateD1` dan.
const EXPIRED = new Date(Date.now() - 86400000).toISOString();
const ACTIVE = new Date(Date.now() + 86400000).toISOString();
const freePlan = companyPlanStateD1({ plan: 'free', trial_expires_at: EXPIRED }, Date.now(), false);
const trialPlan = companyPlanStateD1({ plan: 'free', trial_expires_at: ACTIVE }, Date.now(), false);
const premiumPlan = companyPlanStateD1({ plan: 'free', trial_expires_at: EXPIRED }, Date.now(), true);
checkTrue('0) biznes: bepul tarif chegarasi matnda bor', BIZ_NEWS.uz.body.includes(`bepul tarifda ${freePlan.itemLimit} ta tovar`));
checkTrue('0) biznes: Premium chegarasi matnda bor', BIZ_NEWS.uz.body.includes(`Premium egasida ${premiumPlan.itemLimit} ta`));
checkTrue('0) biznes: sinov davrida chegara yo\'q (kod ham shunday)', trialPlan.itemLimit === null
  && BIZ_NEWS.uz.body.includes('Sinov davrida — cheklovsiz'));
// Sinov muddatlari va aksiya sanasi.
const promoYear = new Date(Date.parse(LAUNCH_PROMO_UNTIL)).getUTCFullYear();
checkTrue('0) biznes: 90/30 kun va aksiya sanasi kod bilan mos',
  BIZ_NEWS.uz.body.includes(`sinov ${TRIAL_DAYS_LAUNCH} kun`)
  && BIZ_NEWS.uz.body.includes(`${TRIAL_DAYS_DEFAULT} kun`)
  && BIZ_NEWS.uz.body.includes(`${promoYear}-yil 31-dekabrgacha`));
// "Bepul" deyilgan joy — KOMPANIYA katalogi. Shaxsiy karta profilidagi
// katalog silver'dan boshlanadi; ikkisi chalkashmasin.
for (const l of ['uz', 'ru', 'en']) {
  checkTrue(`0) biznes (${l}): biznes hisob sahifasiga yo'llaydi`, BIZ_NEWS[l].body.includes('nfcstore.uz/business'));
}
checkTrue('0) stikerlar yangiligi /stikerlar sahifasiga yo\'llaydi', SEED_NEWS[2].uz.body.includes('nfcstore.uz/stikerlar'));
// Stikerdagi QR do'kon sahifasini ochmaydi — "QR'ni skanerlaydi va sahifangiz
// ochiladi" degan va'da hech bir tilda qolmasin.
for (const l of ['uz', 'ru', 'en']) {
  checkTrue(`0) stikerlar (${l}): QR do'kon sahifasini ochadi degan va'da yo'q`, !/(yoki QR|или сканирует QR|or scan the QR)/.test(SEED_NEWS[2][l].body));
  checkTrue(`0) stikerlar (${l}): /nfc-stiker qo'llanmasi tilga olingan`, SEED_NEWS[2][l].body.includes('nfcstore.uz/nfc-stiker'));
}

// 1) Birinchi GET — seed tushadi, eng yangisi tepada, ilova birinchi.
let r = await call('/api/news');
check('1) 200', r.status, 200);
check('1) 5 yangi + 1 eski = 6', r.body.news.length, 6);
check('1) tartib: yangi to\'plam tepada, keyin eskisi', r.body.news.map((n) => n.title),
  [SEED_NEWS_PLAY[0].uz.title, SEED_NEWS_PLAY[1].uz.title,
    SEED_NEWS[0].uz.title, SEED_NEWS[1].uz.title, SEED_NEWS[2].uz.title, 'Eski yangilik']);
const first = r.body.news[0];
check('1) ru sarlavha', first.titleRu, SEED_NEWS_PLAY[0].ru.title);
check('1) en matn', first.bodyEn, SEED_NEWS_PLAY[0].en.body);
check('1) rasm', first.imageUrl, SEED_NEWS_PLAY[0].image);
checkTrue('1) chop etilgan', first.published);
const old = r.body.news.find((n) => n.id === 1);
check('1) eski yangilik o\'zgarmadi', [old.title, old.imageUrl], ['Eski yangilik', '/uploads/x.png']);

// 2) Qayta GET va yangi izolyat (memo tozalanadi) — ikki nusxa yo'q.
r = await call('/api/news');
check('2) qayta so\'rov: yana 6', r.body.news.length, 6);
_resetNewsSeedMemo();
r = await call('/api/news');
check('2) yangi izolyat: yana 6', r.body.news.length, 6);
const mark = await env.DB.prepare(`SELECT COUNT(*) AS n FROM content_seeds WHERE key = ?`).bind(NEWS_SEED_KEY).first();
check('2) belgi bitta', Number(mark.n), 1);

// 3) Ikki izolyat bir vaqtda — baribir bitta nusxa.
const { env: env2 } = makeEnv({}, { atomicBatch: true });
await ensureCoreSchema(env2);
_resetNewsSeedMemo();
const { ensureNewsSeed } = await import('../hosting/api/news-seed.js');
await Promise.all([ensureNewsSeed(env2), (_resetNewsSeedMemo(), ensureNewsSeed(env2))]);
const c2 = await env2.DB.prepare(`SELECT COUNT(*) AS n FROM news`).first();
check('3) parallel: 5 ta, 10 ta emas', Number(c2.n), 5);

// 4) Admin o'chirsa — qayta tushmaydi.
_resetNewsSeedMemo();
const stikerId = (await call('/api/news')).body.news.find((n) => n.title === SEED_NEWS[2].uz.title).id;
r = await call(`/api/admin/news/${stikerId}`, { method: 'DELETE', cookie: cookie.admin });
check('4) admin o\'chirdi', r.status, 200);
_resetNewsSeedMemo();
r = await call('/api/news');
check('4) yangi izolyatda ham qaytmadi: 5', r.body.news.length, 5);
checkTrue('4) o\'chirilgani yo\'q', !r.body.news.some((n) => n.title === SEED_NEWS[2].uz.title));

// 5) Admin ro'yxati ham seed'ni ko'radi. (ensureCoreSchema modul
// darajasida bir marta ishlaydi, shuning uchun o'sha bazada tekshiriladi.)
_resetNewsSeedMemo();
r = await call('/api/admin/news', { cookie: cookie.admin });
check('5) admin GET: 5 ta (4 seed + eski)', r.body.news.length, 5);

// 6) Admin tahriri rasmni saqlaydi (safeUrl /business-assets/ ni o'tkazadi).
const id6 = r.body.news.find((n) => n.title === SEED_NEWS[0].uz.title).id;
r = await call(`/api/admin/news/${id6}`, { method: 'PUT', cookie: cookie.admin, json: { title: 'Tahrir', imageUrl: SEED_NEWS[0].image } });
check('6) tahrirdan keyin rasm joyida', r.body.imageUrl, SEED_NEWS[0].image);
_resetNewsSeedMemo();
r = await call('/api/news');
check('6) tahrirdan keyin ham qayta tushmadi: 5', r.body.news.length, 5);

// 7) TUZATISH: eski (QR va'dali) matn bilan tushgan bazada yangilanadi,
// admin tahrir qilgan ustunga tegilmaydi, ikkinchi marta ishlamaydi.
async function oldState(editRu) {
  const { env: e } = makeEnv({}, { atomicBatch: true });
  await e.DB.prepare(`CREATE TABLE IF NOT EXISTS content_seeds (key TEXT PRIMARY KEY, applied_at TEXT NOT NULL)`).run();
  await e.DB.prepare(`INSERT INTO content_seeds (key, applied_at) VALUES (?, 'x')`).bind(NEWS_SEED_KEY).run();
  await e.DB.prepare(`INSERT INTO news (id, title, body, title_ru, title_en, body_ru, body_en, image_url, published, created_at, updated_at)
    VALUES (9, ?, ?, ?, ?, ?, ?, ?, 1, '2026-09-26 07:49:00+00', '2026-09-26 07:49:00+00')`)
    .bind(SEED_NEWS[2].uz.title, NEWS_FIX_FROM.uz, SEED_NEWS[2].ru.title, SEED_NEWS[2].en.title,
      editRu ? 'Admin o\'zi yozgan matn' : NEWS_FIX_FROM.ru, NEWS_FIX_FROM.en, NEWS_FIX_FROM.image).run();
  return e;
}
{
  const e = await oldState(false);
  _resetNewsSeedMemo();
  const { ensureNewsSeed: run } = await import('../hosting/api/news-seed.js');
  await run(e);
  const row = await e.DB.prepare(`SELECT * FROM news WHERE id = 9`).first();
  check('7) uz matn tuzatildi', row.body, SEED_NEWS[2].uz.body);
  check('7) ru matn tuzatildi', row.body_ru, SEED_NEWS[2].ru.body);
  check('7) en matn tuzatildi', row.body_en, SEED_NEWS[2].en.body);
  check('7) muqova yangilandi', row.image_url, SEED_NEWS[2].image);
  const cnt = await e.DB.prepare(`SELECT COUNT(*) AS n FROM news`).first();
  // Eski to'plam QAYTA tushmaydi, lekin YANGI to'plam tushadi — bu
  // aynan ishlab turgan bazadagi holat (ishga tushirish yo'li).
  check('7) eski 1 + yangi to\'plam 2 = 3', Number(cnt.n), 3);
  const fresh = await e.DB.prepare(`SELECT title FROM news WHERE id <> 9 ORDER BY created_at`).all();
  check('7) yangi to\'plam ishlab turgan bazaga tushdi',
    (fresh.results || []).map((x) => x.title).sort(),
    [SEED_NEWS_PLAY[0].uz.title, SEED_NEWS_PLAY[1].uz.title].sort());
  const mk = await e.DB.prepare(`SELECT COUNT(*) AS n FROM content_seeds WHERE key = ?`).bind(NEWS_FIX_KEY).first();
  check('7) tuzatish belgisi', Number(mk.n), 1);
  // Admin keyin yana eski matnni qo'ysa ham tuzatish qayta ishlamaydi.
  await e.DB.prepare(`UPDATE news SET body = ? WHERE id = 9`).bind(NEWS_FIX_FROM.uz).run();
  _resetNewsSeedMemo();
  await run(e);
  const again = await e.DB.prepare(`SELECT body FROM news WHERE id = 9`).first();
  check('7) ikkinchi marta ishlamaydi', again.body, NEWS_FIX_FROM.uz);
}
{
  const e = await oldState(true);
  _resetNewsSeedMemo();
  const { ensureNewsSeed: run } = await import('../hosting/api/news-seed.js');
  await run(e);
  const row = await e.DB.prepare(`SELECT body, body_ru, body_en FROM news WHERE id = 9`).first();
  check('7) admin tahrirlagan ru matnga tegilmadi', row.body_ru, 'Admin o\'zi yozgan matn');
  check('7) qolgan tillar baribir tuzatildi', [row.body, row.body_en], [SEED_NEWS[2].uz.body, SEED_NEWS[2].en.body]);
}

done();
