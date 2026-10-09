// BIZNES POSTIDA MAHSULOT BELGILASH (hosting/api/product-tags.js).
//
// Tekshiriladi: biznes posti o'z katalogidagi 5 tagacha mahsulotni
// belgilaydi; begona kompaniyaning mahsuloti, yo'q mahsulot, 6 ta va
// yaroqsiz qiymat rad etiladi (post yozilmaydi); lenta va kompaniya
// ro'yxatida `products` katalog shaklida chiqadi; mahsulot o'chirilsa
// belgi ko'rinmaydi; post o'chirilsa belgilar ham ketadi; shaxsiy postda
// `products` doim bo'sh.
//
//   node scripts/test-product-tags.mjs
import { setupSocial, cookie, makeChecker } from './lib/social-fixture.mjs';

const { check, checkTrue, done } = makeChecker();
const { sqlite, call } = await setupSocial();

const now = new Date().toISOString();
const item = (id, company, name, price, extra = {}) => sqlite.prepare(
  `INSERT INTO company_catalog_items (id, company_id, name, price, promotion_price, image_url, available, created_at, updated_at, price_on_request)
   VALUES (?,?,?,?,?,?,?,?,?,?)`
).run(id, company, name, price, extra.promo ?? null, extra.image ?? `/uploads/${id}.jpg`, extra.available ?? 1, now, now, extra.por ?? 0);
for (let i = 1; i <= 6; i++) item(`a${i}`, 'ACMEUZ', `Mahsulot ${i}`, i * 10000);
item('svc', 'ACMEUZ', 'Xizmat', 0, { por: 1 });
item('o1', 'OTHERCO', 'Begona', 5000);

const cpost = (json, ck = cookie.user, id = 'ACMEUZ') =>
  call(`/api/companies/${id}/posts`, { method: 'POST', cookie: ck, json: { agreed: true, imageUrl: '/uploads/tagpost.jpg', ...json } });

// ── 1) Belgilash ───────────────────────────────────────────────────
let r = await cpost({ productIds: ['a1', 'a2', 'a2', 'svc'] });
check('1) 201', r.status, 201);
const pid = r.body.post.id;
check('1) takror olib tashlanadi, tartib saqlanadi', r.body.post.products.map((p) => p.id), ['a1', 'a2', 'svc']);
check('1) mahsulot shakli', r.body.post.products[0], {
  id: 'a1', companyId: 'ACMEUZ', name: 'Mahsulot 1', price: 10000, promotionPrice: null, currency: 'UZS',
  imageUrl: '/uploads/a1.jpg', available: true, kind: r.body.post.products[0].kind, priceOnRequest: false, priceSoon: false,
});
checkTrue('1) kind — product|service', ['product', 'service'].includes(r.body.post.products[0].kind));
check('1) "narx kelishiladi" bayrog‘i', r.body.post.products[2].priceOnRequest, true);
r = await cpost({ productIds: ['a1', 'a2', 'a3', 'a4', 'a5'] });
check('1) 5 ta — chegarada', [r.status, r.body.post.products.length], [201, 5]);
r = await cpost({});
check('1) belgisiz post: products bo‘sh', [r.status, r.body.post.products], [201, []]);
const plainId = r.body.post.id;

// ── 2) Rad etiladiganlar (post YOZILMAYDI) ─────────────────────────
const cnt = () => sqlite.prepare(`SELECT COUNT(*) AS n FROM company_posts WHERE company_id = 'ACMEUZ'`).get().n;
const before = cnt();
for (const [label, ids, err] of [
  ['6 ta', ['a1', 'a2', 'a3', 'a4', 'a5', 'a6'], 'too_many_products'],
  ['begona kompaniya mahsuloti', ['a1', 'o1'], 'bad_products'],
  ['yo‘q mahsulot', ['nope'], 'bad_products'],
  ['yaroqsiz belgi', ['a1;DROP'], 'bad_products'],
  ['massiv emas', 'a1', 'bad_products'],
]) {
  r = await cpost({ productIds: ids });
  check(`2) ${label}: 422 ${err}`, [r.status, r.body?.error], [422, err]);
}
check('2) rad etilganda post yozilmadi', cnt(), before);
r = await cpost({ productIds: ['o1'] }, cookie.other, 'ACMEUZ');
check('2) begona egasi: 403', r.status, 403);
r = await cpost({ productIds: ['a1'] }, cookie.other, 'OTHERCO');
check('2) OTHERCO egasi ACME mahsulotini belgilay olmaydi', [r.status, r.body?.error], [422, 'bad_products']);

// Shaxsiy post `productIds` ni e'tiborsiz qoldiradi.
r = await call('/api/records/VIP001/posts', { method: 'POST', cookie: cookie.user, json: { agreed: true, imageUrl: '/uploads/pp.jpg', productIds: ['a1'] } });
check('2) shaxsiy post: products doim bo‘sh', [r.status, r.body.products], [201, []]);
const personalId = r.body.id;

// ── 3) Lenta va ro'yxat ────────────────────────────────────────────
r = await call('/api/feed?limit=30', { cookie: cookie.other });
const f = r.body.feed.find((x) => x.authorKind === 'company' && x.id === pid);
check('3) lentada products', f?.products?.map((p) => p.id), ['a1', 'a2', 'svc']);
check('3) lentada belgisiz biznes posti: []', r.body.feed.find((x) => x.authorKind === 'company' && x.id === plainId)?.products, []);
check('3) lentada shaxsiy post: []', r.body.feed.find((x) => x.authorKind === 'card' && x.id === personalId)?.products, []);
r = await call('/api/companies/ACMEUZ/posts');
check('3) kompaniya ro‘yxatida products', r.body.posts.find((p) => p.id === pid)?.products?.map((p) => p.id), ['a1', 'a2', 'svc']);

// ── 4) Mahsulot o'chirilsa / boshqa kompaniyaga o'tsa ko'rinmaydi ──
sqlite.prepare(`DELETE FROM company_catalog_items WHERE id = 'a2'`).run();
sqlite.prepare(`UPDATE company_catalog_items SET company_id = 'OTHERCO' WHERE id = 'svc'`).run();
r = await call('/api/companies/ACMEUZ/posts');
check('4) faqat tirik va o‘ziniki qoladi', r.body.posts.find((p) => p.id === pid)?.products?.map((p) => p.id), ['a1']);

// ── 5) Post o'chirilsa belgilar ham ketadi ─────────────────────────
r = await call(`/api/companies/ACMEUZ/posts/${pid}`, { method: 'DELETE', cookie: cookie.user });
check('5) o‘chirish 200', r.status, 200);
check('5) belgilar ketdi', sqlite.prepare(`SELECT COUNT(*) AS n FROM post_products WHERE target_id = ?`).get(pid).n, 0);

// ── 6) Jadval yo'q bo'lsa lenta yiqilmaydi ─────────────────────────
sqlite.exec(`ALTER TABLE post_products RENAME TO post_products_tmp`);
r = await call('/api/feed?limit=30');
check('6) jadvalsiz: lenta 200, products bo‘sh', [r.status, r.body.feed.find((x) => x.authorKind === 'company')?.products], [200, []]);
sqlite.exec(`ALTER TABLE post_products_tmp RENAME TO post_products`);

done();
