// Google/Yandex va Telegram uchun profil kartochkalari + bizneslar sitemap'i
// (egasi, 2026-09-28: "biznes profillar Google'da chiqsin, qonunga zid
// bo'lmasin").
//   node scripts/test-seo-profiles.mjs
//
// QONUN/MAXFIYLIK TEKSHIRUVLARI ASOSIY: shaxsiy NFC ID hech qachon
// sitemap'da yo'q, har doim `noindex`, kartochkada telefon/email yo'q.
import worker, { ensureCoreSchema } from '../hosting/worker.js';
import { makeEnv, seedBasic, req, makeChecker } from './lib/d1-harness.mjs';
import { readFileSync } from 'node:fs';

const INDEX_HTML = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const { env } = makeEnv({
  ASSETS: {
    fetch: async (request) => {
      const p = new URL(request.url).pathname;
      if (p === '/' || p === '/index.html') {
        return new Response(INDEX_HTML, { status: 200, headers: { 'content-type': 'text/html' } });
      }
      return new Response('not found', { status: 404 });
    },
  },
});
await ensureCoreSchema(env);
await seedBasic(env);
const { check, checkTrue, done } = makeChecker();
const run = (sql, ...b) => env.DB.prepare(sql).bind(...b).run();
const co = (id, owner, name, status = 'active', extra = {}) => run(
  `INSERT INTO companies (company_id, owner_user_id, owner_email, display_name, phone, description, city, logo_url, cover_url, gallery_json, tier, price, status, created_at, updated_at)
   VALUES (?, ?, 'egasi@test.local', ?, '+998901234567', ?, ?, ?, ?, '[]', 'free', 0, ?, '2026-09-01', ?)`,
  id, owner, name, extra.description ?? null, extra.city ?? null, extra.logo ?? null, extra.cover ?? null, status, extra.updated ?? '2026-09-20 10:00:00',
);
await co('GULDONA', '1', 'Guldona gullari', 'active', { description: 'Andijondagi eng yangi gullar & buketlar <yetkazib berish>', city: 'Andijon', cover: '/uploads/g.jpg' });
await co("G'OYA", '2', "G'oya studiyasi", 'active', { city: 'Toshkent' });
await co('QORALAMA', '1', 'Qoralama biznes', 'draft');
await co('NAMUNA', 'demo', 'Namuna kafe', 'active');
await run(`INSERT INTO users (id, email, password_hash, phone, is_test) VALUES (7, 'sinov@test.local', 'x', '+998907777777', 1)`);
await co('SINOVBIZ', '7', 'Sinov biznes', 'active');
await run(`INSERT INTO users (id, email, password_hash, phone, deleted_at) VALUES (8, 'ochgan@test.local', 'x', '+998908888888', '2026-09-27 00:00:00')`);
await co('OCHGANBIZ', '8', "O'chgan biznes", 'active');
await run(`UPDATE cards SET avatar_url = '/uploads/m.jpg' WHERE code = 'VIP001'`);

const bot = (path) => worker.fetch(req(path, { headers: { 'user-agent': 'TelegramBot (like TwitterBot)' } }), env);
const meta = (html, key) => (html.match(new RegExp(`<meta[^>]*(?:name|property)="${key}"[^>]*content="([^"]*)"`, 'i')) || [])[1] ?? null;
const title = (html) => (html.match(/<title>([\s\S]*?)<\/title>/i) || [])[1];
const canon = (html) => (html.match(/<link[^>]*rel="canonical"[^>]*href="([^"]*)"/i) || [])[1];

// ═══ 1. Bizneslar sitemap'i ═══
{
  const r = await bot('/sitemap-business.xml');
  check('sitemap 200', r.status, 200);
  checkTrue('xml turi', /application\/xml/.test(r.headers.get('content-type') || ''));
  const xml = await r.text();
  checkTrue('faol biznes bor', xml.includes('<loc>https://nfcstore.uz/c/GULDONA</loc>'));
  checkTrue("O' apostrofli ID XML-escape bilan", xml.includes('<loc>https://nfcstore.uz/c/G&apos;OYA</loc>'));
  checkTrue('lastmod kun formatida', xml.includes('<lastmod>2026-09-20</lastmod>'));
  for (const [id, why] of [['QORALAMA', 'faol emas'], ['NAMUNA', 'namuna (soxta)'], ['SINOVBIZ', 'sinov akkaunti'], ['OCHGANBIZ', 'egasi o\'chirilgan']]) {
    checkTrue(`${why} biznes sitemap'da YO'Q`, !xml.includes(`/c/${id}<`));
  }
  checkTrue('shaxsiy NFC ID sitemap\'da YO\'Q', !/VIP001|OTH222/.test(xml));
  checkTrue('telefon/email sitemap\'da YO\'Q', !/998|@/.test(xml));
}

// ═══ 2. Statik indeks ikkala ro'yxatga ishora qiladi ═══
{
  const idx = readFileSync(new URL('../public/sitemap.xml', import.meta.url), 'utf8');
  checkTrue('sitemap.xml — indeks', idx.includes('<sitemapindex'));
  checkTrue('indeksda sahifalar', idx.includes('https://nfcstore.uz/sitemap-pages.xml'));
  checkTrue('indeksda bizneslar', idx.includes('https://nfcstore.uz/sitemap-business.xml'));
  const pages = readFileSync(new URL('../public/sitemap-pages.xml', import.meta.url), 'utf8');
  checkTrue('sahifalar ro\'yxati saqlangan', pages.includes('<loc>https://nfcstore.uz/narxlar</loc>'));
}

// ═══ 3. Biznes sahifasi — o'z sarlavhasi, tavsifi, rasmi ═══
{
  const r = await bot('/c/GULDONA');
  check('biznes sahifasi 200', r.status, 200);
  const html = await r.text();
  check('sarlavha', title(html), 'Guldona gullari — NFCSTORE');
  check('og:title', meta(html, 'og:title'), 'Guldona gullari — NFCSTORE');
  checkTrue('tavsif HTML-escape qilingan', (meta(html, 'description') || '').includes('&amp; buketlar &lt;yetkazib berish&gt;'));
  check('rasm — muqova', meta(html, 'og:image'), 'https://nfcstore.uz/uploads/g.jpg');
  check('kanonik — /c/ manzil', canon(html), 'https://nfcstore.uz/c/GULDONA');
  checkTrue('biznes indekslanadi (noindex yo\'q)', !/noindex/.test(meta(html, 'robots') || ''));
  checkTrue('telefon/email kartochkada YO\'Q', !html.includes('998901234567') && !html.includes('egasi@test.local'));
  checkTrue('SPA qobig\'i joyida (sahifa ochiladi)', html.includes('id="root"'));
}
{
  const html = await (await bot('/company/guldona')).text();
  check('/company/ kichik harf ham shu biznes, kanonik /c/', canon(html), 'https://nfcstore.uz/c/GULDONA');
  const g = await (await bot(`/c/${encodeURIComponent("g'oya")}`)).text();
  check("O' li ID ochiladi", title(g), "G'oya studiyasi — NFCSTORE");
  checkTrue('tavsifsiz biznesga shahar bilan tavsif', (meta(g, 'description') || '').includes('Toshkent'));
}
{
  const html = await (await bot('/c/NAMUNA')).text();
  check('namuna biznes — noindex', meta(html, 'robots'), 'noindex, follow');
  for (const id of ['QORALAMA', 'OCHGANBIZ', 'YOQBIZNES']) {
    const h = await (await bot(`/c/${id}`)).text();
    checkTrue(`${id}: umumiy qobiq (kartochka yo'q)`, !title(h)?.includes(' — NFCSTORE') || title(h) === 'NFCSTORE — raqamli profil va NFC karta');
  }
}

// ═══ 4. Shaxsiy NFC ID — faqat ism va rasm, HAR DOIM noindex ═══
{
  const r = await bot('/VIP001');
  check('shaxsiy profil 200', r.status, 200);
  const html = await r.text();
  check('sarlavha — ism', title(html), 'Muhammad — NFCSTORE');
  check('shaxsiy profil — noindex', meta(html, 'robots'), 'noindex, follow');
  check('rasm — avatar', meta(html, 'og:image'), 'https://nfcstore.uz/uploads/m.jpg');
  checkTrue('tavsifda shaxsiy ma\'lumot yo\'q', !/998|@|Muhammad/.test(meta(html, 'description') || ''));
  checkTrue('telefon/email sahifada YO\'Q', !html.includes('998901111111') && !html.includes('user@test.local'));
  const lower = await (await bot('/vip001')).text();
  check('kichik harfli kod ham topiladi', title(lower), 'Muhammad — NFCSTORE');
}
{
  await run(`UPDATE users SET deleted_at = '2026-09-27 00:00:00' WHERE id = 2`);
  const html = await (await bot('/OTH222')).text();
  checkTrue('egasi o\'chirilgan profil — ism chiqmaydi', !html.includes('Boshqa — NFCSTORE'));
  const page = await (await bot('/narxlar')).text();
  checkTrue('oddiy sahifa (/narxlar) tegilmaydi', !page.includes('noindex'));
}

// ═══ 5. Boshqa domen (kompaniyaning o'z domeni) — bu yo'l ishlamaydi ═══
{
  const r = await worker.fetch(new Request('https://menu.example.uz/VIP001', { headers: { 'user-agent': 'TelegramBot' } }), env);
  const html = await r.text().catch(() => '');
  checkTrue('begona domenda shaxsiy kartochka yo\'q', !html.includes('Muhammad — NFCSTORE'));
}

done();
