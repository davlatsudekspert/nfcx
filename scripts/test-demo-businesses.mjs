// NAMUNA (DEMO) BIZNESLAR (2026-09-25).
//
// Egasi: "demo profillar qilib qo'ysang — biznes profillar har sohadan,
// narxlar reallikka yaqin, profil to'liq; fonlari sohasiga mos rasmli".
// Tekshiriladi: faqat manager+ yaratadi/o'chiradi; 12 ta biznes to'liq
// (logo, fon, ish vaqti, 8–12 mahsulot, 3 post); javobda `demo: true`;
// buyurtma rad etiladi; umumiy lenta va Tanlov katalogiga tushmaydi;
// qayta bosish ikki nusxa qilmaydi; haqiqiy odam olgan ID ga tegilmaydi;
// o'chirish faqat namunalarni o'chiradi; har bir rasm fayli mavjud.
//
//   node scripts/test-demo-businesses.mjs

import { existsSync } from 'node:fs';
import worker, { ensureCoreSchema } from '../hosting/worker.js';
import { DEMO_BUSINESSES, DEMO_IDS, demoImages } from '../hosting/api/demo-businesses.js';
import { makeEnv, seedBasic, req, cookie, makeChecker, sha256Hex } from './lib/d1-harness.mjs';

const { env, sqlite } = makeEnv();
await ensureCoreSchema(env);
await seedBasic(env);
await env.DB.prepare(`INSERT INTO admin_sessions (token, admin_id, role, abs_exp, last_activity) VALUES (?, 3, 'content_manager', '2999-01-01T00:00:00.000Z', ?)`)
  .bind(sha256Hex('cm-token'), new Date().toISOString()).run();
const cmCookie = 'nfc_admin_session=cm-token';
const { check, checkTrue, done } = makeChecker();

const call = async (path, init = {}) => {
  const res = await worker.fetch(req(path, init), env);
  return { status: res.status, body: await res.json().catch(() => null) };
};
const P = '/api/admin/demo-businesses';

// 0) Ma'lumotlarning o'zi: 12 ta, 4 soha, 8–12 mahsulot, 3 post, ID qoidasi.
check('0) 12 ta biznes', DEMO_BUSINESSES.length, 12);
const cats = new Set(DEMO_BUSINESSES.map((b) => b.category));
for (const c of ['restaurant', 'cafe', 'shop', 'market', 'services', 'construction', 'clinic', 'pharmacy', 'education']) {
  checkTrue(`0) soha bor: ${c}`, cats.has(c));
}
for (const b of DEMO_BUSINESSES) {
  checkTrue(`0) ${b.id}: ID 3–15 harf`, /^[A-Z]{3,15}$/.test(b.id));
  checkTrue(`0) ${b.id}: 8–12 mahsulot`, b.items.length >= 8 && b.items.length <= 12);
  check(`0) ${b.id}: 3 post`, b.posts.length, 3);
  checkTrue(`0) ${b.id}: aksiya narxi asl narxdan past`, b.items.every(([, , p, promo]) => promo == null || promo < p));
  checkTrue(`0) ${b.id}: telefon raqami yo'q (to'qima raqam haqiqiy odamga tushmasin)`, !/\+?998\s?\d{2}/.test(JSON.stringify(b)));
}

// 0b) Har bir rasm fayli saytda BOR (aks holda profil bo'sh ramka ko'rsatadi).
const missing = [];
for (const b of DEMO_BUSINESSES) {
  const img = demoImages(b);
  const files = [img.logo, img.cover, ...b.items.map((_, i) => img.item(i)), ...b.posts.map((_, i) => img.post(i))];
  for (const f of files) if (!existsSync(new URL(`../public${f}`, import.meta.url))) missing.push(f);
}
check('0b) hamma rasm fayli mavjud', missing.slice(0, 5), []);

// 1) Ruxsatlar.
let r = await call(P);
check('1) kirmagan: 401', r.status, 401);
r = await call(P, { cookie: cookie.user });
check('1) oddiy foydalanuvchi: 401', r.status, 401);
r = await call(P, { method: 'POST', cookie: cmCookie });
check('1) content_manager yarata olmaydi: 403', r.status, 403);
r = await call(P, { cookie: cmCookie });
check('1) content_manager holatni ko‘radi', [r.status, r.body.active, r.body.total], [200, 0, 12]);

// 2) Haqiqiy odam NAMUNAAVTO ni oldindan olgan — unga tegilmasin.
await call(P, { cookie: cookie.admin }); // jadvallar yaratilsin
sqlite.prepare(`INSERT INTO companies (company_id, owner_user_id, display_name, category, tier, price, status, created_at, updated_at)
  VALUES ('NAMUNAAVTO', '1', 'Haqiqiy Avto', 'services', 'free', 0, 'active', datetime('now'), datetime('now'))`).run();

// Haqiqiy biznesning posti va tovari — lenta/katalog ishlayotganini
// isbotlash uchun (aks holda "namuna yo'q" tekshiruvi bo'sh o'tardi).
sqlite.prepare(`INSERT INTO company_posts (company_id, image_url, caption, created_at) VALUES ('NAMUNAAVTO', '/uploads/real.jpg', 'haqiqiy post', datetime('now', '-5 days'))`).run();
sqlite.prepare(`INSERT INTO company_catalog_items (id, company_id, name, price, image_url, available, sort_order, created_at, updated_at)
  VALUES ('real-item', 'NAMUNAAVTO', 'Haqiqiy xizmat', 50000, '/uploads/ri.jpg', 1, 0, datetime('now'), datetime('now'))`).run();

// 3) Yaratish.
r = await call(P, { method: 'POST', cookie: cookie.manager });
check('3) yaratildi: 201', r.status, 201);
check('3) 11 tasi yaratildi, band ID o‘tkazib yuborildi', [r.body.created.length, r.body.skipped], [11, ['NAMUNAAVTO']]);
check('3) holatda "band" ko‘rinadi', r.body.businesses.find((b) => b.companyId === 'NAMUNAAVTO').taken, true);
check('3) haqiqiy kompaniya o‘zgarmadi', sqlite.prepare(`SELECT display_name, owner_user_id FROM companies WHERE company_id = 'NAMUNAAVTO'`).get(), { display_name: 'Haqiqiy Avto', owner_user_id: '1' });

// 4) Qayta bosish — ikki nusxa yo'q.
r = await call(P, { method: 'POST', cookie: cookie.admin });
check('4) qayta: hech narsa yaratilmadi', r.body.created, []);
check('4) mahsulotlar ikki barobar bo‘lmadi', sqlite.prepare(`SELECT COUNT(*) AS n FROM company_catalog_items WHERE company_id = 'NAMUNAKAFE'`).get().n, 11);

// 5) Profil — to'liq va «Namuna».
r = await call('/api/companies/NAMUNAKAFE');
const co = r.body.company;
check('5) profil ochiladi', r.status, 200);
check('5) demo belgisi', co.demo, true);
check('5) buyurtma o‘chiq', co.ordersEnabled, false);
check('5) logo va fon', [co.logoUrl, co.coverUrl], ['/business-assets/demo/namunakafe/logo.jpg', '/business-assets/demo/namunakafe/cover.jpg']);
check('5) galereya 4 ta', co.gallery.length, 4);
check('5) ish vaqti 7 kun', [co.hours.length, co.hours[1].open, co.hours[1].close], [7, '08:00', '22:00']);
check('5) katalog 11 ta, narxli', [co.catalog.length, co.catalog.every((i) => i.price > 0 && i.imageUrl)], [11, true]);
check('5) aksiya narxi', co.catalog.find((i) => i.name === 'Raf').promotionPrice, 30000);
check('5) tavsifda namuna eslatmasi', /namunaviy profili/.test(co.description), true);
check('5) telefon yo‘q', co.phone, '');
r = await call('/api/companies/NAMUNATAMIR');
check('5) "narx kelishiladi" xizmati', r.body.company.catalog.find((i) => i.name === 'Uy qurilishi').priceOnRequest, true);
r = await call('/api/companies/NAMUNAAVTO');
check('5) haqiqiy kompaniyada demo yo‘q', r.body.company.demo, false);

// 6) Ro'yxat.
r = await call('/api/companies');
const listed = r.body.companies.filter((c) => c.demo);
check('6) ro‘yxatda 11 namuna', listed.length, 11);
check('6) namunalar ro‘yxat oxirida', r.body.companies[0].companyId, 'NAMUNAAVTO');
check('6) haqiqiy biznesda demo kaliti yo‘q', 'demo' in r.body.companies.find((c) => c.companyId === 'NAMUNAAVTO'), false);

// 7) Postlar — profilda bor, umumiy lentada yo'q.
r = await call('/api/companies/NAMUNAKAFE/posts');
check('7) profilda 3 post, rasmli', [r.body.posts.length, r.body.posts.every((p) => p.imageUrl.startsWith('/business-assets/demo/'))], [3, true]);
r = await call('/api/feed', { cookie: cookie.other });
const feed = r.body.items || r.body.feed || r.body.posts || [];
check('7) lentada haqiqiy biznes posti bor', feed.some((p) => p.caption === 'haqiqiy post'), true);
check('7) lentada namuna posti yo‘q', feed.filter((p) => p.code !== 'NAMUNAAVTO' && DEMO_IDS.includes(p.code)).length, 0);

// 8) Tanlov katalogi — namuna tovarlari yo'q.
r = await call('/api/catalog/feed?limit=100');
check('8) katalog ishlaydi', r.status, 200);
const catItems = r.body.items || [];
check('8) katalogda haqiqiy tovar bor', catItems.some((i) => i.name === 'Haqiqiy xizmat'), true);
check('8) katalogda namuna tovari yo‘q', catItems.filter((i) => i.name !== 'Haqiqiy xizmat').length, 0);

// 9) Buyurtma — rad.
const itemId = co.catalog[0].id;
r = await call('/api/companies/NAMUNAKAFE/orders', { method: 'POST', json: { itemId, name: 'Ali', phone: '+998901234567', qty: 1 } });
check('9) buyurtma: 409 demo_business', [r.status, r.body?.error], [409, 'demo_business']);

// 10) Hech kimning "mening bizneslarim"iga tushmaydi.
r = await call('/api/companies/mine', { cookie: cookie.user });
check('10) foydalanuvchida faqat o‘z biznesi', (r.body.companies || []).map((c) => c.companyId), ['NAMUNAAVTO']);

// 11) O'chirish — faqat namunalar.
sqlite.prepare(`INSERT INTO company_follows (company_id, user_id, created_at) VALUES ('NAMUNAKAFE', '2', datetime('now'))`).run();
r = await call(P, { method: 'DELETE', cookie: cmCookie });
check('11) content_manager o‘chira olmaydi: 403', r.status, 403);
r = await call(P, { method: 'DELETE', cookie: cookie.manager });
check('11) o‘chirildi', [r.status, r.body.removed.length, r.body.active], [200, 11, 0]);
check('11) namuna kompaniyalari yo‘q', sqlite.prepare(`SELECT COUNT(*) AS n FROM companies WHERE owner_user_id = 'demo'`).get().n, 0);
check('11) mahsulot va postlar yo‘q', [
  sqlite.prepare(`SELECT COUNT(*) AS n FROM company_catalog_items WHERE company_id LIKE 'NAMUNA%' AND company_id <> 'NAMUNAAVTO'`).get().n,
  sqlite.prepare(`SELECT COUNT(*) AS n FROM company_posts WHERE company_id LIKE 'NAMUNA%' AND company_id <> 'NAMUNAAVTO'`).get().n,
  sqlite.prepare(`SELECT COUNT(*) AS n FROM company_follows WHERE company_id = 'NAMUNAKAFE'`).get().n,
], [0, 0, 0]);
check('11) haqiqiy kompaniya joyida', sqlite.prepare(`SELECT owner_user_id FROM companies WHERE company_id = 'NAMUNAAVTO'`).get()?.owner_user_id, '1');

// 12) Qayta yaratsa bo'ladi.
r = await call(P, { method: 'POST', cookie: cookie.admin });
check('12) qayta yaratildi', r.body.created.length, 11);

done();
