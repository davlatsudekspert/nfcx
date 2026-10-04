// ULASHILGAN POST / REELS SAHIFASI — /post/:id
//   node scripts/test-post-page.mjs
//
// Ilova Reels'ni `https://nfcstore.uz/post/<id>?code=<kod>` bilan
// ulashadi (kompaniya posti — `&company=1`). Havola PROFILNI emas,
// aynan shu post/videoni ochishi kerak (egasi, 2026-10-04).
//
// Haqiqiy worker.fetch + in-memory D1 (scripts/lib/d1-harness.mjs).
import worker from '../hosting/worker.js';
import { makeEnv, seedBasic, req, makeChecker } from './lib/d1-harness.mjs';

const { check, checkTrue, done } = makeChecker();
const { env, sqlite } = makeEnv();
await seedBasic(env);

sqlite.prepare(
  `INSERT INTO posts (id, code, user_id, image_url, video_url, caption, created_at)
   VALUES (100, 'VIP001', 1, '', '/uploads/r.mp4', 'Toshkent <kechasi> & "yoritgich"', datetime('now'))`,
).run();
sqlite.prepare(
  `INSERT INTO posts (id, code, user_id, image_url, caption, created_at)
   VALUES (101, 'VIP001', 1, '/uploads/p.jpg', '', datetime('now'))`,
).run();

const get = async (path, method = 'GET') => {
  const res = await worker.fetch(req(path, { method }), env);
  return { status: res.status, type: res.headers.get('content-type') || '', html: await res.text() };
};

// ═══ 1. Video post (Reels) ═══
{
  const r = await get('/post/100?code=VIP001');
  check('1) 200 HTML', [r.status, r.type.startsWith('text/html')], [200, true]);
  checkTrue('1) videoning o‘zi sahifada', r.html.includes('<video src="https://nfcstore.uz/uploads/r.mp4"'));
  checkTrue('1) og:video (Telegram/WhatsApp kartochkasi)', r.html.includes('property="og:video" content="https://nfcstore.uz/uploads/r.mp4"'));
  checkTrue('1) muallif profiliga havola', r.html.includes('href="/VIP001"'));
  checkTrue('1) izoh xavfsiz (HTML qochirilgan)', r.html.includes('Toshkent &lt;kechasi&gt; &amp; &quot;yoritgich&quot;') && !r.html.includes('<kechasi>'));
  checkTrue('1) canonical shu post', r.html.includes('href="https://nfcstore.uz/post/100?code=VIP001"'));
  checkTrue('1) ilovada ochish tugmasi', r.html.includes('href="/app"'));
  const h = await get('/post/100?code=VIP001', 'HEAD');
  check('1) HEAD — 200, tanasiz', [h.status, h.html], [200, '']);
}

// ═══ 2. Rasmli post ═══
{
  const r = await get('/post/101');
  check('2) 200', r.status, 200);
  checkTrue('2) rasm va og:image', r.html.includes('<img src="https://nfcstore.uz/uploads/p.jpg"') && r.html.includes('property="og:image" content="https://nfcstore.uz/uploads/p.jpg"'));
  checkTrue('2) og:video yo‘q', !r.html.includes('og:video'));
}

// ═══ 3. Yo'q / o'chirilgan ═══
{
  const r = await get('/post/999');
  check('3) yo‘q post — 404', r.status, 404);
  checkTrue('3) "Post topilmadi"', r.html.includes('Post topilmadi'));
  // Shaxsiy post `company=1` bilan so'ralsa — kompaniya jadvalida yo'q.
  check('3) noto‘g‘ri tur — 404', (await get('/post/100?company=1')).status, 404);
  sqlite.prepare(`UPDATE users SET deleted_at = datetime('now') WHERE id = 1`).run();
  check('3) egasi o‘chirilgan — 404', (await get('/post/100')).status, 404);
  sqlite.prepare(`UPDATE users SET deleted_at = NULL WHERE id = 1`).run();
}

// ═══ 3b. Kompaniya posti ═══
{
  sqlite.prepare(`INSERT INTO companies (company_id, owner_user_id, display_name, tier, price, status, created_at, updated_at) VALUES ('KARTAUZ', 1, 'Karta Uz', 'free', 0, 'active', datetime('now'), datetime('now'))`).run();
  sqlite.prepare(`INSERT INTO company_posts (id, company_id, image_url, video_url, caption, created_at) VALUES (100, 'KARTAUZ', '', '/uploads/c.mp4', 'Yangi kolleksiya', datetime('now'))`).run();
  const r = await get('/post/100?code=KARTAUZ&company=1');
  check('3b) kompaniya posti — 200', r.status, 200);
  checkTrue('3b) kompaniya videosi (shaxsiy 100-post emas)', r.html.includes('/uploads/c.mp4') && !r.html.includes('/uploads/r.mp4'));
  checkTrue('3b) vitrina havolasi /c/KARTAUZ', r.html.includes('href="/c/KARTAUZ"'));
  sqlite.prepare(`UPDATE companies SET status = 'suspended' WHERE company_id = 'KARTAUZ'`).run();
  check('3b) faol bo‘lmagan kompaniya — 404', (await get('/post/100?company=1')).status, 404);
}

// ═══ 4. Boshqa yo'llar o'zgarmadi ═══
{
  const r = await get('/post/abc');
  checkTrue('4) /post/abc bu ishlovchiga tushmaydi', !r.html.includes('Post topilmadi'));
}

done();
