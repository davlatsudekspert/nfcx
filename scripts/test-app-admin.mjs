// ILOVA BO'YICHA ADMIN KO'RINISHLARI — hosting/api/app-admin.js
// va ilova build raqami (hosting/api/app-usage.js).
//   node scripts/test-app-admin.mjs
//
// Haqiqiy worker.fetch + in-memory D1/R2 (scripts/lib/d1-harness.mjs).
// Production D1/R2 ga TEGMAYDI. Tekshiriladi:
//   * uchala yo'l ham FAQAT admin uchun (mehmon va oddiy foydalanuvchi 401);
//   * avto-filtr jurnali: jadval hali yo'q bo'lsa bo'sh ro'yxat + nol
//     statistika; yozuv muallifi foydalanuvchiga (email) ulanadi;
//   * ilova kontenti: post, Reels, istoriya, biznes posti ko'rinadi;
//     o'chirilgan post va muddati o'tgan istoriya ko'rinmaydi;
//   * biznes katalogi buyurtmalari ro'yxati;
//   * `/api/auth/me` `x-app-build` bilan kelsa — admin ro'yxatida `appBuild`.
import worker from '../hosting/worker.js';
import { logBlockedUpload } from '../hosting/api/image-moderation.js';
import { makeEnv, seedBasic, cookie, req, makeChecker } from './lib/d1-harness.mjs';

const { check, checkTrue, done } = makeChecker();
const { env, sqlite } = makeEnv();
await seedBasic(env);

const call = async (pathname, init = {}) => {
  const res = await worker.fetch(req(pathname, init), env);
  return { status: res.status, body: await res.json().catch(() => null) };
};
const admin = (pathname) => call(pathname, { cookie: cookie.admin });
const ROUTES = ['/api/admin/content-blocks', '/api/admin/app-content', '/api/admin/company-orders'];

// ═══ 1. Faqat admin ═══
for (const path of ROUTES) {
  check(`1) mehmon: ${path}`, (await call(path)).status, 401);
  check(`1) oddiy foydalanuvchi: ${path}`, (await call(path, { cookie: cookie.user })).status, 401);
  check(`1) admin: ${path}`, (await admin(path)).status, 200);
}
check('1) faqat GET', (await call(ROUTES[0], { method: 'POST', cookie: cookie.admin, json: {} })).status, 405);

// ═══ 2. Avto-filtr: jadval hali yo'q ═══
{
  checkTrue('2) jadval hali yaratilmagan',
    !sqlite.prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'content_scan_blocks'`).get());
  const r = await admin('/api/admin/content-blocks');
  check('2) bo‘sh ro‘yxat', [r.body.items, r.body.hasMore], [[], false]);
  check('2) nol statistika, HAMMA kategoriya kaliti bilan', r.body.stats, {
    total: 0, today: 0, last7d: 0,
    byCategory: { sexual: 0, violence: 0, extremism: 0, political: 0, drugs: 0, hate: 0 },
  });
}

// ═══ 3. Avto-filtr: jurnal o'qiladi ═══
{
  // Yozuvchining O'ZI orqali — jadval shakli taxmin qilinmaydi.
  await logBlockedUpload(env, 'user:1', 'sexual', 'upload');
  await logBlockedUpload(env, 'admin:super_admin', 'violence', 'media');
  await logBlockedUpload(env, 'user:2', 'extremism', 'profile-bg');
  // Uchinchisi 10 kun oldin bo'lgan.
  sqlite.prepare(`UPDATE content_scan_blocks SET created_at = ? WHERE actor = 'user:2'`)
    .run(new Date(Date.now() - 10 * 86_400_000).toISOString());

  const r = await admin('/api/admin/content-blocks');
  check('3) statistika', [r.body.stats.total, r.body.stats.today, r.body.stats.last7d], [3, 2, 2]);
  check('3) kategoriyalar bo‘yicha', r.body.stats.byCategory,
    { sexual: 1, violence: 1, extremism: 1, political: 0, drugs: 0, hate: 0 });
  check('3) eng yangisi tepada', r.body.items.map((i) => i.category), ['violence', 'sexual', 'extremism']);
  const mine = r.body.items.find((i) => i.actor === 'user:1');
  check('3) muallif foydalanuvchiga ulandi (email, telefon, NFC ID)',
    mine && [mine.actorKind, mine.user?.userId, mine.user?.email, mine.user?.phone, mine.user?.code, mine.source],
    ['user', 1, 'user@test.local', '+998901111111', 'VIP001', 'upload']);
  checkTrue('3) sana ms da', typeof mine?.createdAt === 'number' && mine.createdAt > 0);
  const adm = r.body.items.find((i) => i.actor === 'admin:super_admin');
  check('3) admin yuklashi — foydalanuvchisiz', adm && [adm.actorKind, adm.user], ['admin', null]);

  const cat = await admin('/api/admin/content-blocks?category=extremism');
  check('3) kategoriya filtri', cat.body.items.map((i) => i.user?.email), ['other@test.local']);
  const q = await admin('/api/admin/content-blocks?q=USER@test');
  check('3) email bo‘yicha qidiruv', q.body.items.map((i) => i.actor), ['user:1']);
  check('3) % hammani qaytarmaydi', (await admin('/api/admin/content-blocks?q=%25')).body.items, []);
  const p1 = await admin('/api/admin/content-blocks?limit=2');
  const p2 = await admin('/api/admin/content-blocks?limit=2&page=2');
  check('3) sahifalash', [p1.body.items.length, p1.body.hasMore, p2.body.items.length, p2.body.hasMore], [2, true, 1, false]);
}

// ═══ 4. Ilova kontenti ═══
const now = new Date().toISOString();
const later = new Date(Date.now() + 86_400_000).toISOString();
const past = new Date(Date.now() - 3_600_000).toISOString();
sqlite.prepare(`INSERT INTO posts (id, code, user_id, image_url, caption, created_at) VALUES (801, 'VIP001', 1, '/uploads/p1.jpg', 'Salom rasm', '2026-09-01 10:00:00')`).run();
sqlite.prepare(`INSERT INTO posts (id, code, user_id, video_url, caption, created_at) VALUES (802, 'VIP001', 1, '/uploads/r1.mp4', 'Reels video', '2026-09-02 10:00:00')`).run();
sqlite.prepare(`INSERT INTO posts (id, code, user_id, image_url, caption, created_at) VALUES (803, 'OTH222', 2, '/uploads/p3.jpg', 'Boshqa post', '2026-09-03 10:00:00')`).run();
sqlite.prepare(`INSERT INTO post_likes (post_id, user_id) VALUES (801, 2)`).run();
sqlite.prepare(`INSERT INTO companies (company_id, owner_user_id, display_name, tier, price, status, created_at, updated_at)
  VALUES ('ELITE', '1', 'Elite Qurilish', 'free', 0, 'active', datetime('now'), datetime('now'))`).run();
sqlite.prepare(`INSERT INTO company_posts (id, company_id, image_url, caption, created_at) VALUES (901, 'ELITE', '/uploads/c1.jpg', 'Aksiya', ?)`).run(now);
sqlite.prepare(`INSERT INTO stories (id, owner_kind, owner_id, user_id, image_url, caption, created_at, expires_at) VALUES (951, 'card', 'VIP001', 1, '/uploads/s1.jpg', 'Istoriya', ?, ?)`).run(now, later);
sqlite.prepare(`INSERT INTO stories (id, owner_kind, owner_id, user_id, image_url, caption, created_at, expires_at) VALUES (952, 'card', 'VIP001', 1, '/uploads/s2.jpg', 'Eski istoriya', ?, ?)`).run(past, past);
{
  const r = await admin('/api/admin/app-content');
  const keys = r.body.items.map((i) => `${i.kind}:${i.id}`);
  check('4) hammasi, eng yangisi tepada (muddati o‘tgan istoriyasiz)', keys,
    ['story:951', 'company_post:901', 'post:803', 'reel:802', 'post:801']);
  check('4) statistika', r.body.stats, { posts: 2, reels: 1, stories: 1, companyPosts: 1 });
  const p = r.body.items.find((i) => i.id === 801 && i.source === 'post');
  check('4) post maydonlari', p && [p.deleteKind, p.isVideo, p.author.kind, p.author.id, p.author.name,
    p.author.user?.email, p.imageUrl, p.text, p.likes, p.comments],
  ['post', false, 'card', 'VIP001', 'Muhammad', 'user@test.local', '/uploads/p1.jpg', 'Salom rasm', 1, 0]);
  const reel = r.body.items.find((i) => i.id === 802);
  check('4) videoli post — Reels', reel && [reel.kind, reel.deleteKind, reel.isVideo, reel.videoUrl], ['reel', 'post', true, '/uploads/r1.mp4']);
  const cp = r.body.items.find((i) => i.id === 901);
  check('4) biznes posti', cp && [cp.kind, cp.deleteKind, cp.author.kind, cp.author.id, cp.author.name, cp.author.user?.userId],
    ['company_post', 'company_post', 'company', 'ELITE', 'Elite Qurilish', 1]);
  const st = r.body.items.find((i) => i.id === 951);
  check('4) istoriya', st && [st.deleteKind, st.views, typeof st.expiresAt], ['story', 0, 'number']);

  check('4) filtr: reel', (await admin('/api/admin/app-content?kind=reel')).body.items.map((i) => i.id), [802]);
  check('4) filtr: post (videosiz)', (await admin('/api/admin/app-content?kind=post')).body.items.map((i) => i.id), [803, 801]);
  check('4) filtr: story', (await admin('/api/admin/app-content?kind=story')).body.items.map((i) => i.id), [951]);
  check('4) filtr: company_post', (await admin('/api/admin/app-content?kind=company_post')).body.items.map((i) => i.id), [901]);
  check('4) qidiruv: matn', (await admin('/api/admin/app-content?q=boshqa')).body.items.map((i) => i.id), [803]);
  check('4) qidiruv: muallif email', (await admin('/api/admin/app-content?q=other@test')).body.items.map((i) => i.id), [803]);
  check('4) qidiruv: biznes nomi', (await admin('/api/admin/app-content?q=elite')).body.items.map((i) => i.id), [901]);
  const pg = await admin('/api/admin/app-content?limit=2&page=3');
  check('4) sahifalash', [pg.body.items.map((i) => i.id), pg.body.hasMore], [[801], false]);

  // O'chirish — mavjud admin yo'li, `deleteKind` bilan.
  const del = await call(`/api/admin/content/${p.deleteKind}/${p.id}`, {
    method: 'DELETE', cookie: cookie.admin, json: { reason: 'sinov' },
  });
  check('4) mavjud DELETE yo‘li ishladi', del.status, 200);
  const after = await admin('/api/admin/app-content');
  checkTrue('4) o‘chirilgan post ro‘yxatda YO‘Q', !after.body.items.some((i) => i.source === 'post' && i.id === 801));
  check('4) statistika kamaydi', after.body.stats.posts, 1);
  checkTrue('4) nusxa dalil arxivida',
    !!sqlite.prepare(`SELECT 1 FROM content_archive WHERE kind = 'post' AND content_id = 801`).get());
}

// ═══ 5. Biznes katalogi buyurtmalari ═══
{
  const empty = await admin('/api/admin/company-orders');
  check('5) hali buyurtma yo‘q', [empty.body.items, empty.body.stats], [[], { total: 0, new: 0, last7d: 0 }]);

  sqlite.prepare(`UPDATE companies SET orders_enabled = 1 WHERE company_id = 'ELITE'`).run();
  sqlite.prepare(`INSERT INTO company_catalog_items (id, company_id, name, price, created_at, updated_at)
    VALUES ('ITEM1', 'ELITE', 'G‘isht', 5000, datetime('now'), datetime('now'))`).run();
  // Haqiqiy mijoz yo'li orqali — jadval ustunlari taxmin qilinmaydi.
  const placed = await call('/api/companies/ELITE/orders', {
    method: 'POST', json: { itemId: 'ITEM1', qty: 2, name: 'Ali Valiyev', phone: '+998 90 123 45 67', note: 'tezroq' },
  });
  check('5) mijoz buyurtma berdi', placed.status, 201);
  sqlite.prepare(`INSERT INTO company_orders (company_id, item_name, qty, price, customer_name, customer_phone, status, created_at)
    VALUES ('ELITE', 'Eski buyurtma', 1, 100, 'Vali', '+998911111111', 'done', ?)`).run(new Date(Date.now() - 20 * 86_400_000).toISOString());

  const r = await admin('/api/admin/company-orders');
  check('5) statistika', r.body.stats, { total: 2, new: 1, last7d: 1 });
  const o = r.body.items[0];
  check('5) eng yangisi tepada, maydonlar', o && [o.company.id, o.company.name, o.company.owner?.email, o.itemId, o.itemName,
    o.qty, o.price, o.customerName, o.customerPhone, o.note, o.status],
  ['ELITE', 'Elite Qurilish', 'user@test.local', 'ITEM1', 'G‘isht', 2, 10000, 'Ali Valiyev', '+998 90 123 45 67', 'tezroq', 'new']);
  checkTrue('5) sana ms da', typeof o?.createdAt === 'number');
  check('5) holat filtri', (await admin('/api/admin/company-orders?status=done')).body.items.map((i) => i.itemName), ['Eski buyurtma']);
  check('5) qidiruv: mijoz', (await admin('/api/admin/company-orders?q=ali%20val')).body.items.map((i) => i.customerName), ['Ali Valiyev']);
  check('5) qidiruv: biznes nomi', (await admin('/api/admin/company-orders?q=elite%20qur')).body.items.length, 2);
}

// ═══ 6. Ilova build raqami ═══
{
  const APP = { 'x-app': 'nova', 'x-client': 'android' };
  await call('/api/auth/me', { cookie: cookie.user, headers: { ...APP, 'x-app-build': '231' } });
  await call('/api/auth/me', { cookie: cookie.other, headers: APP }); // eski versiya — sarlavhasiz
  const r = await admin('/api/admin/app-users');
  const u1 = r.body.items.find((i) => i.userId === 1);
  const u2 = r.body.items.find((i) => i.userId === 2);
  check('6) build raqami va platforma', u1 && [u1.appBuild, u1.platform, typeof u1.registeredAt], [231, 'android', 'string']);
  check('6) sarlavhasiz eski versiya — build bo‘sh, lekin sanaldi', u2 && [u2.appBuild, u2.opens], [null, 1]);

  // Keyingi ochilish sarlavhasiz yoki buzuq sarlavha bilan — oxirgi ma'lum raqam qoladi.
  await call('/api/auth/me', { cookie: cookie.user, headers: APP });
  await call('/api/auth/me', { cookie: cookie.user, headers: { ...APP, 'x-app-build': '12abc' } });
  const again = (await admin('/api/admin/app-users')).body.items.find((i) => i.userId === 1);
  check('6) oxirgi ma‘lum build saqlanadi, ochilishlar sanaladi', again && [again.appBuild, again.opens], [231, 3]);
  await call('/api/auth/me', { cookie: cookie.user, headers: { ...APP, 'x-app-build': '240' } });
  check('6) yangi build yoziladi', (await admin('/api/admin/app-users')).body.items.find((i) => i.userId === 1)?.appBuild, 240);
}

done();
