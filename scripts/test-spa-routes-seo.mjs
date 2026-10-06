// SAYT SAHIFALARI: SEO META, HAQIQIY 404 VA SITEMAP (sayt auditi, 2026-10).
//
// HAQIQIY XATOLAR:
//   • robotlar (Google, Telegram) /stikerlar, /privacy, /delete-account ...
//     uchun bosh sahifaning sarlavhasi, tavsifi va `canonical: /` ni
//     ko'rardi — index.html dagi qattiq yozilgan qiymatlar;
//   • mavjud bo'lmagan manzil 200 bilan bosh sahifani berardi (soft 404);
//   • "NFCSTORE" nomli kompaniyada sarlavha "NFCSTORE — NFCSTORE" edi;
//   • brauzer shaxsiy profilda server bergan `noindex` ni `index,follow`
//     ga almashtirardi, canonical esa kichik harfda (/vip001) edi.
//
//   node scripts/test-spa-routes-seo.mjs
import { readFileSync } from 'node:fs';
import worker from '../hosting/worker.js';
import { SEO_ROUTES, SPA_PAGES, classifySpaPath, seoForRoute } from '../hosting/api/seo-routes.js';
import { seoForProfile, seoForCompany } from '../src/lib/seo.js';
import { APP_STORE_STATUS, APP_STORE_URL, appPageTitle } from '../hosting/api/app-store.js';
import { makeEnv, seedBasic, req, makeChecker } from './lib/d1-harness.mjs';

const { check, checkTrue, done } = makeChecker();
const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const INDEX_HTML = read('index.html');

// ── 0) index.html qobig'ida qattiq canonical yo'q ─────────────────────
checkTrue('0) index.html: canonical qattiq yozilmagan', !/<link[^>]*rel="canonical"/i.test(INDEX_HTML));
checkTrue('0) index.html: og:url qattiq yozilmagan', !/<meta[^>]*property="og:url"/i.test(INDEX_HTML));

// ── 1) App.jsx marshrutlari = Worker ro'yxati ─────────────────────────
{
  const app = read('src/App.jsx');
  const staticBlock = app.match(/const STATIC_ROUTES = \{([\s\S]*?)\n\};/)?.[1] || '';
  const staticKeys = [...staticBlock.matchAll(/^\s*(?:'([^']+)'|([A-Za-z]+)):\s*[A-Za-z]/gm)].map((m) => m[1] || m[2]);
  const extraBlock = app.match(/const RESERVED = new Set\(\[([\s\S]*?)\]\);/)?.[1] || '';
  const extraKeys = [...extraBlock.matchAll(/'([^']+)'/g)].map((m) => m[1]);
  const appPages = [...new Set([...staticKeys, ...extraKeys])].sort();
  checkTrue(`1) App.jsx sahifalari o‘qildi (${appPages.length})`, appPages.length > 30);
  check('1) App.jsx dagi har sahifa Worker ro‘yxatida', appPages.filter((k) => !SPA_PAGES.has(k)), []);
  check('1) Worker ro‘yxatida App.jsx da yo‘q sahifa yo‘q', [...SPA_PAGES].filter((k) => !appPages.includes(k)), []);
  checkTrue('1) App.jsx: noma’lum yo‘l — NotFoundPage', /else \{ page = <NotFoundPage \/>; notFound = true; \}/.test(app));
  checkTrue('1) SeoSync /c/ va /yangiliklar/:id ga tegmaydi', /\^\(c\|company\)\\\/\[\^\/\]\+\$\/\.test\(route\) \|\| \/\^yangiliklar/.test(app));
}

// ── 2) SEO ro'yxati: har yozuvda uch til, yangi sahifalar bor ─────────
for (const [key, entry] of Object.entries(SEO_ROUTES)) {
  checkTrue(`2) ${key}: uz/ru/en sarlavha va tavsif`, ['uz', 'ru', 'en'].every((l) => entry[l]?.title && entry[l]?.description));
}
for (const r of ['privacy', 'delete-account', 'kotarish', 'activate', 'biznes-namuna', 'register', 'stikerlar', 'nfc-stiker', 'ilova-yuklash', 'narxlar']) {
  checkTrue(`2) /${r} — bosh sahifa matni EMAS`, seoForRoute(r, 'uz').title !== SEO_ROUTES.home.uz.title);
}
check('2) /register sarlavhasi', seoForRoute('register', 'uz').title, "Ro'yxatdan o'tish");
check('2) /register — noindex', seoForRoute('register', 'uz').noindex, true);
check('2) /privacy — canonical o‘zi', seoForRoute('privacy', 'en').path, '/privacy');
check('2) /ilova-yuklash sarlavhasi App Store holatidan', seoForRoute('ilova-yuklash', 'ru').title, appPageTitle('ru'));
check('2) App Store holati URL dan', APP_STORE_STATUS, APP_STORE_URL ? 'live' : 'review');
// Sahifalar App Store holatini o'zi yozmaydi — hammasi app-store.js dan.
for (const f of ['src/pages/AppDownloadPage.jsx', 'src/pages/NfcStickerHelpPage.jsx', 'src/components/HomeWhatsNew.jsx', 'src/components/AppWelcomeModal.jsx']) {
  const src = read(f);
  checkTrue(`2) ${f}: App Store holati yagona manbadan`, /appStore(Badge|Text)\(/.test(src) && !/'Tez kunda'|'App Store — (tez kunda|скоро|coming soon)'/.test(src));
}

// ── 3) Shaxsiy profil va kompaniya (brauzer tomoni) ───────────────────
{
  const p = seoForProfile({ code: 'VIP001', name: 'Muhammad' }, 'en');
  check('3) shaxsiy profil — noindex', [p.noindex, p.robots], [true, 'noindex, follow']);
  check('3) profil canonical katta harfda (Worker og:url bilan bir xil)', p.path, '/VIP001');
  const c = seoForCompany({ companyId: 'NFCSTOREUZ', displayName: 'NFCSTORE', city: 'Toshkent' }, 'ru');
  check('3) kompaniya sarlavhasi — nomi', c.title, 'NFCSTORE');
  check('3) kompaniya canonical', c.path, '/c/NFCSTOREUZ');
  checkTrue('3) kompaniya tavsifi ruscha', /Контакты/.test(c.description));
  check('3) namuna kompaniya — noindex', seoForCompany({ companyId: 'X', demo: true }).noindex, true);
}

// ── 4) Yo'llarni tasniflash ───────────────────────────────────────────
for (const [path, kind] of [
  ['/', 'page'], ['/narxlar', 'page'], ['/NARXLAR', 'page'], ['/delete-account', 'page'], ['/company/create', 'page'],
  ['/VIP001', 'profile'], ['/vip001', 'profile'], ['/12345678', 'profile'], ['/kompaniya', 'profile'],
  ['/c/NFCSTOREUZ', 'dynamic'], ['/company/guldona', 'dynamic'], ["/c/g'oya", 'dynamic'], ['/yangiliklar/9', 'dynamic'],
  ['/qr-2', 'dynamic'], ['/i/ABC', 'dynamic'], ['/post/12', 'dynamic'], ['/t/tok_1', 'dynamic'],
  ['/VIP001/menyu', 'dynamic'], ['/business/VIP001', 'dynamic'], ['/workspace/X', 'dynamic'], ['/u/x', 'dynamic'],
  ['/this-is-not-real/xyz', 'unknown'], ['/foo/bar/baz', 'unknown'], ['/a', 'unknown'], ['/wp-login.php', 'unknown'],
]) {
  check(`4) ${path} → ${kind}`, classifySpaPath(path).kind, kind);
}

// ── 5) Haqiqiy worker ─────────────────────────────────────────────────
const { env } = makeEnv({
  ASSETS: {
    fetch: async (request) => {
      const p = new URL(request.url).pathname;
      if (p === '/' || p === '/index.html') {
        return new Response(INDEX_HTML, { status: 200, headers: { 'content-type': 'text/html', etag: '"abc"' } });
      }
      return new Response('not found', { status: 404 });
    },
  },
});
await seedBasic(env);
await env.DB.prepare(
  `INSERT INTO companies (company_id, owner_user_id, owner_email, display_name, phone, gallery_json, tier, price, status, created_at, updated_at)
   VALUES ('NFCSTOREUZ', '1', 'egasi@test.local', 'NFCSTORE', '+998901234567', '[]', 'free', 0, 'active', '2026-09-01', '2026-09-01')`,
).run();

const get = async (path, accept = 'text/html') => {
  const r = await worker.fetch(req(path, { headers: { accept, 'user-agent': 'Googlebot' } }), env);
  return { status: r.status, html: await r.text(), headers: r.headers };
};
const meta = (html, key) => (html.match(new RegExp(`<meta[^>]*(?:name|property)="${key}"[^>]*content="([^"]*)"`, 'i')) || [])[1] ?? null;
const title = (html) => (html.match(/<title>([\s\S]*?)<\/title>/i) || [])[1];
const canons = (html) => [...html.matchAll(/<link[^>]*rel="canonical"[^>]*href="([^"]*)"/gi)].map((m) => m[1]);

{
  const r = await get('/stikerlar');
  check('5) /stikerlar 200', r.status, 200);
  check('5) /stikerlar sarlavhasi', title(r.html), `${SEO_ROUTES.stikerlar.uz.title} — NFCSTORE.UZ`);
  check('5) /stikerlar og:title', meta(r.html, 'og:title'), `${SEO_ROUTES.stikerlar.uz.title} — NFCSTORE.UZ`);
  check('5) /stikerlar tavsifi', meta(r.html, 'description'), SEO_ROUTES.stikerlar.uz.description);
  check('5) /stikerlar canonical (bitta)', canons(r.html), ['https://nfcstore.uz/stikerlar']);
  check('5) /stikerlar og:url', meta(r.html, 'og:url'), 'https://nfcstore.uz/stikerlar');
  check('5) /stikerlar indekslanadi', meta(r.html, 'robots'), 'index,follow');
  checkTrue('5) qobiq joyida (SPA ochiladi)', r.html.includes('<div id="root"></div>'));
  checkTrue('5) etag olib tashlangan (boshqa yo‘lning 304 i tushmasin)', !r.headers.get('etag'));
}
{
  const r = await get('/');
  check('5) / canonical', canons(r.html), ['https://nfcstore.uz/']);
  check('5) / sarlavhasi', title(r.html), `${SEO_ROUTES.home.uz.title} — NFCSTORE.UZ`);
}
for (const [path, canon] of [['/privacy', '/privacy'], ['/delete-account', '/delete-account'], ['/nfc-stiker', '/nfc-stiker'], ['/ilova-yuklash', '/ilova-yuklash'], ['/narxlar', '/narxlar']]) {
  const r = await get(path);
  check(`5) ${path} canonical`, canons(r.html), [`https://nfcstore.uz${canon}`]);
  checkTrue(`5) ${path} — bosh sahifa sarlavhasi emas`, !title(r.html).startsWith(SEO_ROUTES.home.uz.title));
}
{
  const r = await get('/login');
  check('5) /login — noindex', meta(r.html, 'robots'), 'noindex,nofollow');
  const reg = await get('/register');
  check('5) /register sarlavhasi', title(reg.html), "Ro'yxatdan o'tish — NFCSTORE.UZ");
}
{
  const r = await get('/this-is-not-real/xyz');
  check('5) noma’lum yo‘l — 404', r.status, 404);
  check('5) 404 — noindex', meta(r.html, 'robots'), 'noindex, follow');
  check('5) 404 — canonical yo‘q', canons(r.html), []);
  check('5) 404 sarlavhasi', title(r.html), 'Sahifa topilmadi — NFCSTORE.UZ');
  checkTrue('5) 404 da ham SPA qobig‘i (React sahifani ko‘rsatadi)', r.html.includes('<div id="root"></div>'));
}
{
  const r = await get('/VIP001');
  check('5) shaxsiy profil — 200', r.status, 200);
  check('5) shaxsiy profil sarlavhasi saqlangan', title(r.html), 'Muhammad — NFCSTORE');
  check('5) shaxsiy profil — noindex', meta(r.html, 'robots'), 'noindex, follow');
  check('5) shaxsiy profil canonical = og:url', [canons(r.html)[0], meta(r.html, 'og:url')], ['https://nfcstore.uz/VIP001', 'https://nfcstore.uz/VIP001']);
  const empty = await get('/abc123');
  check('5) bo‘sh ID — 200 (band qilish sahifasi)', empty.status, 200);
  check('5) bo‘sh ID — noindex', meta(empty.html, 'robots'), 'noindex, follow');
  check('5) bo‘sh ID canonical katta harfda', canons(empty.html), ['https://nfcstore.uz/ABC123']);
}
{
  const r = await get('/c/NFCSTOREUZ');
  check('5) "NFCSTORE" kompaniyasi — sarlavha takrorlanmaydi', title(r.html), 'NFCSTORE');
  check('5) kompaniya og:title', meta(r.html, 'og:title'), 'NFCSTORE');
  const missing = await get('/c/YOQKOMPANIYA');
  check('5) topilmagan kompaniya — 200 (React "faol emas" ko‘rsatadi)', missing.status, 200);
}
{
  const qr = await get('/qr-2');
  check('5) /qr-2 — yo‘naltirish saqlangan', qr.status, 302);
  const auk = await worker.fetch(req('/auksion/12', { headers: { accept: 'text/html' }, redirect: 'manual' }), env);
  check('5) /auksion/12 — 301 /narxlar', [auk.status, auk.headers.get('location')], [301, '/narxlar']);
  const post = await get('/post/999');
  check('5) /post/:id — o‘z ishlovchisi (404 sahifa)', [post.status, /Post topilmadi/.test(post.html)], [404, true]);
  const api = await get('/api/nope', 'application/json');
  check('5) /api — JSON 404 o‘zgarmagan', api.status, 404);
  const asset = await get('/assets/x.js', '*/*');
  check('5) yo‘q fayl — oddiy 404', [asset.status, asset.html], [404, 'not found']);
}

// ── 6) sitemap-pages.xml ──────────────────────────────────────────────
{
  const xml = read('public/sitemap-pages.xml');
  const locs = [...xml.matchAll(/<loc>https:\/\/nfcstore\.uz([^<]*)<\/loc>/g)].map((m) => m[1] || '/');
  checkTrue('6) /auksion sitemap‘da YO‘Q (bekor qilingan)', !locs.some((l) => l.startsWith('/auksion')));
  for (const p of ['/support', '/privacy', '/delete-account']) checkTrue(`6) ${p} sitemap‘da`, locs.includes(p));
  for (const p of locs) {
    const info = classifySpaPath(p);
    checkTrue(`6) ${p}: sahifa va indekslanadi`, info.kind === 'page' && !seoForRoute(info.route, 'uz').noindex);
  }
}

done();
