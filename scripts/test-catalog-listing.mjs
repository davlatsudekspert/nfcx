// UMUMIY KATALOG LISTINGI — kompaniya katalogiga yozish (2026-09).
//
// Tekshiriladi:
//   * yangi ustunlar ADD COLUMN bilan qo'shiladi, `catalogSchema: 2`;
//   * mahsulot/xizmat turi, global kategoriya, bir nechta rasm saqlanadi;
//   * "Narx kelishiladi" FAQAT xizmatda: narx 0 va aksiya yo'q bo'ladi;
//     mahsulotda bu bayroq e'tiborsiz qoladi;
//   * biznesning O'Z bo'limi (`category`) erkin matn bo'lib qoladi;
//   * PATCH yuborilmagan maydonlarga tegmaydi; tur o'zgarsa bayroq tushadi;
//   * yaroqsiz tur/kategoriya/rasm manzili qabul qilinmaydi;
//   * eski ilovaning `type` maydoni ham tushuniladi.
//
//   node scripts/test-catalog-listing.mjs
import worker from '../hosting/worker.js';
import { makeEnv, seedBasic, cookie, req, makeChecker } from './lib/d1-harness.mjs';

const { check, done } = makeChecker();
const { env } = makeEnv();
await seedBasic(env);

const call = (path, init) => worker.fetch(req(path, init), env);
const j = async (path, init) => { const r = await call(path, init); return { status: r.status, body: await r.json().catch(() => null) }; };

await j('/api/companies', {
  method: 'POST', cookie: cookie.user,
  json: { companyId: 'SALONUZ', displayName: 'Salon Uz', city: 'Toshkent', phone: '+998901234567', category: 'services', description: 'Go‘zallik saloni — soch, manikyur va boshqa xizmatlar.' },
});
await env.DB.prepare(`UPDATE companies SET status='active' WHERE company_id='SALONUZ'`).run();

const add = (json) => j('/api/companies/SALONUZ/catalog', { method: 'POST', cookie: cookie.user, json });
const find = (res, name) => res.body.company.catalog.find((i) => i.name === name);

const s1 = await add({
  name: 'Soch turmagi', kind: 'service', marketCategory: 'beauty', category: 'Sartaroshlik',
  price: 150000, promotionPrice: 120000, priceOnRequest: true,
  images: ['/uploads/a.jpg', '/uploads/b.jpg', 'javascript:alert(1)', '/uploads/a.jpg'],
});
check('POST 201', s1.status, 201);
check('catalogSchema 2', s1.body.company.catalogSchema, 2);
const hair = find(s1, 'Soch turmagi');
check('tur saqlandi', hair.kind, 'service');
check('global kategoriya saqlandi', hair.marketCategory, 'beauty');
check('o‘z bo‘limi erkin matn', [hair.category, hair.section], ['Sartaroshlik', 'Sartaroshlik']);
check('narx kelishiladi', [hair.priceOnRequest, hair.price, hair.promotionPrice], [true, 0, null]);
check('rasmlar: xavfsiz, takrorsiz, birinchisi muqova', [hair.imageUrl, hair.images], ['/uploads/a.jpg', ['/uploads/a.jpg', '/uploads/b.jpg']]);

const s2 = await add({ name: 'Shampun', kind: 'product', marketCategory: 'hack', price: 90000, priceOnRequest: true });
const sh = find(s2, 'Shampun');
check('mahsulotda narx kelishiladi yo‘q', [sh.priceOnRequest, sh.price], [false, 90000]);
check('yaroqsiz kategoriya → aniqlanadi', sh.marketCategory, 'other');
check('tur saqlandi (mahsulot)', sh.kind, 'product');

const s3 = await add({ name: 'Manikyur', type: 'service', price: 80000 });
check('eski `type` maydoni tushuniladi', find(s3, 'Manikyur').kind, 'service');

const s4 = await add({ name: 'Konsultatsiya', price: 50000 });
check('tur ko‘rsatilmasa — soha bo‘yicha (services → xizmat)', find(s4, 'Konsultatsiya').kind, 'service');

// PATCH: faqat nom — qolganiga tegilmaydi.
const id = hair.id;
const p1 = await j(`/api/companies/SALONUZ/catalog/${id}`, { method: 'PATCH', cookie: cookie.user, json: { name: 'Soch turmagi (to‘y)' } });
const h1 = find(p1, 'Soch turmagi (to‘y)');
check('PATCH: boshqa maydonlar joyida', [h1.kind, h1.marketCategory, h1.priceOnRequest, h1.images.length], ['service', 'beauty', true, 2]);

// PATCH: mahsulotga aylantirish — narx kelishiladi tushadi.
const p2 = await j(`/api/companies/SALONUZ/catalog/${id}`, { method: 'PATCH', cookie: cookie.user, json: { kind: 'product', price: 200000 } });
const h2 = find(p2, 'Soch turmagi (to‘y)');
check('PATCH: mahsulot → narx majburiy', [h2.kind, h2.priceOnRequest, h2.price], ['product', false, 200000]);

// PATCH: rasmlarni almashtirish.
const p3 = await j(`/api/companies/SALONUZ/catalog/${id}`, { method: 'PATCH', cookie: cookie.user, json: { images: ['/uploads/c.jpg'] } });
check('PATCH: rasmlar almashtirildi', find(p3, 'Soch turmagi (to‘y)').images, ['/uploads/c.jpg']);

// Global lenta ham shu maydonlarni ko'radi.
const feed = await j('/api/catalog/feed?kind=service');
check('lenta: xizmatlar', feed.body.items.map((i) => i.name).sort(), ['Konsultatsiya', 'Manikyur']);

// Boshqa odam yoza olmaydi.
const foreign = await j('/api/companies/SALONUZ/catalog', { method: 'POST', cookie: cookie.other, json: { name: 'X', price: 1 } });
check('begona egasi yozolmaydi', foreign.status >= 400, true);

done();
