// "NARXI TEZ KUNDA" VA OCHIQ KOMPANIYA JAVOBI MAXFIYLIGI (2026-09-27).
//
// Egasining talabi: yangi mahsulotlar do'konda "Narxi tez kunda" bilan
// turadi. Bu "Narx kelishiladi" emas — mahsulotga ham qo'yiladi va
// narx e'lon qilinishi bilan tushadi.
//
// Tekshiriladi:
//   * `priceSoon` saqlanadi: narx 0, aksiya yo'q, `catalogSchema: 3`;
//   * eski ilova buzilmaydi: bunday tovarda `priceOnRequest` ham true
//     ("0 so'm" chiqmaydi);
//   * bayroqni bilmaydigan mijoz (PATCH'da `priceSoon` yo'q) uni
//     tasodifan o'chirmaydi; lekin aniq narx yozsa — narx e'lon qilinadi;
//   * umumiy lenta ham `priceSoon` ni ko'radi;
//   * ochiq GET /api/companies/:id da egasining emaili va admin
//     izohlari FAQAT egasiga ko'rinadi.
//
//   node scripts/test-catalog-price-soon.mjs
import worker from '../hosting/worker.js';
import { makeEnv, seedBasic, cookie, req, makeChecker } from './lib/d1-harness.mjs';

const { check, done } = makeChecker();
const { env } = makeEnv();
await seedBasic(env);

const call = (path, init) => worker.fetch(req(path, init), env);
const j = async (path, init) => { const r = await call(path, init); return { status: r.status, body: await r.json().catch(() => null) }; };

await j('/api/companies', {
  method: 'POST', cookie: cookie.user,
  json: { companyId: 'NFCSHOP', displayName: 'NFC Shop', city: 'Toshkent', phone: '+998901234567', category: 'services', description: 'NFC kartalar, stikerlar va aksessuarlar do‘koni.' },
});
await env.DB.prepare(`UPDATE companies SET status='active', admin_note='ichki izoh', custom_domain_note='domen izohi' WHERE company_id='NFCSHOP'`).run();

const add = (json) => j('/api/companies/NFCSHOP/catalog', { method: 'POST', cookie: cookie.user, json });
const patch = (id, json) => j(`/api/companies/NFCSHOP/catalog/${id}`, { method: 'PATCH', cookie: cookie.user, json });
const find = (res, name) => res.body.company.catalog.find((i) => i.name === name);

// 1) Mahsulot, narxi tez kunda — yuborilgan narx va aksiya e'tiborsiz.
const a1 = await add({
  name: 'Avto NFC stiker', kind: 'product', marketCategory: 'electronics', category: 'Avto aksessuarlar',
  price: 75000, promotionPrice: 70000, priceSoon: true, images: ['/uploads/avto-1.jpg', '/uploads/avto-2.jpg'],
});
check('POST 201', a1.status, 201);
check('catalogSchema 3', a1.body.company.catalogSchema, 3);
const avto = find(a1, 'Avto NFC stiker');
check('tez kunda: narx 0, aksiya yo‘q', [avto.priceSoon, avto.price, avto.promotionPrice], [true, 0, null]);
check('eski ilova uchun narx ham yashirin', avto.priceOnRequest, true);
check('mahsulot turi saqlandi', avto.kind, 'product');
check('rasmlar saqlandi', avto.images, ['/uploads/avto-1.jpg', '/uploads/avto-2.jpg']);

// 2) Oddiy tovar — bayroq yo'q, narx joyida.
const a2 = await add({ name: 'NFC karta', kind: 'product', price: 220000 });
const card = find(a2, 'NFC karta');
check('oddiy tovar: priceSoon false, narx ko‘rinadi', [card.priceSoon, card.priceOnRequest, card.price], [false, false, 220000]);

// 3) Xizmat: "Narx kelishiladi" va "tez kunda" birga kelsa — tez kunda.
const a3 = await add({ name: 'O‘rnatish xizmati', kind: 'service', priceOnRequest: true, priceSoon: true, price: 30000 });
const svc = find(a3, 'O‘rnatish xizmati');
check('xizmat: tez kunda ustun', [svc.priceSoon, svc.priceOnRequest, svc.price], [true, true, 0]);
const svcRow = await env.DB.prepare(`SELECT price_on_request, price_soon FROM company_catalog_items WHERE id = ?`).bind(svc.id).first();
check('bazada ikki holat aralashmaydi', [svcRow.price_on_request, svcRow.price_soon], [0, 1]);

// 4) Bayroqni bilmaydigan mijoz faqat nomni o'zgartirdi — bayroq joyida.
const p1 = await patch(avto.id, { name: 'Avto NFC stiker Ø80' });
const avto1 = find(p1, 'Avto NFC stiker Ø80');
check('PATCH nom: tez kunda saqlandi', [avto1.priceSoon, avto1.price], [true, 0]);

// 5) Eski ilova narx 0 bilan qayta saqlasa ham bayroq tushmaydi.
const p2 = await patch(avto.id, { price: 0, description: 'Ichkaridan yopishtiriladi' });
check('PATCH narx 0: tez kunda saqlandi', find(p2, 'Avto NFC stiker Ø80').priceSoon, true);

// 6) Egasi narxni e'lon qildi (bayroqni bilmaydigan forma orqali).
const p3 = await patch(avto.id, { price: 85000 });
const avto3 = find(p3, 'Avto NFC stiker Ø80');
check('PATCH aniq narx: narx e‘lon qilindi', [avto3.priceSoon, avto3.priceOnRequest, avto3.price], [false, false, 85000]);

// 7) Aniq bayroq bilan qaytarish.
const p4 = await patch(avto.id, { priceSoon: true });
const avto4 = find(p4, 'Avto NFC stiker Ø80');
check('PATCH priceSoon:true — narx yana yashirin', [avto4.priceSoon, avto4.price], [true, 0]);
const p5 = await patch(avto.id, { priceSoon: false, price: 90000 });
check('PATCH priceSoon:false + narx', [find(p5, 'Avto NFC stiker Ø80').priceSoon, find(p5, 'Avto NFC stiker Ø80').price], [false, 90000]);
await patch(avto.id, { priceSoon: true });

// 8) Ustun yo'q davrdagi (eski) qator — bayroq yo'q.
await env.DB.prepare(`UPDATE company_catalog_items SET price_soon = 0 WHERE id = ?`).bind(card.id).run();
const g0 = await j('/api/companies/NFCSHOP');
check('eski qator: priceSoon false', find(g0, 'NFC karta').priceSoon, false);

// 9) Umumiy lenta.
const feed = await j('/api/catalog/feed');
const fAvto = feed.body.items.find((i) => i.name === 'Avto NFC stiker Ø80');
check('lenta: tez kunda', [fAvto?.priceSoon, fAvto?.priceOnRequest, fAvto?.price], [true, true, 0]);
check('lenta: oddiy tovar', feed.body.items.find((i) => i.name === 'NFC karta')?.priceSoon, false);

// 10) MAXFIYLIK: tashrifchi va begona odam egasining emailini ko'rmaydi.
const PRIVATE = ['ownerEmail', 'adminNote', 'rejectedReason', 'customDomainNote'];
const anon = await j('/api/companies/NFCSHOP');
check('kirmagan tashrifchi: 200', anon.status, 200);
check('kirmagan tashrifchi: maxfiy maydon yo‘q', PRIVATE.filter((k) => k in anon.body.company), []);
check('kirmagan tashrifchi: katalog bor', anon.body.company.catalog.length, 3);
const other = await j('/api/companies/NFCSHOP', { cookie: cookie.other });
check('begona foydalanuvchi: maxfiy maydon yo‘q', PRIVATE.filter((k) => k in other.body.company), []);
const owner = await j('/api/companies/NFCSHOP', { cookie: cookie.user });
check('egasi: o‘z emaili va izohlarini ko‘radi',
  [owner.body.company.ownerEmail, owner.body.company.adminNote, owner.body.company.customDomainNote],
  ['user@test.local', 'ichki izoh', 'domen izohi']);

// 11) Begona odam bayroqni o'zgartira olmaydi.
const foreign = await j(`/api/companies/NFCSHOP/catalog/${avto.id}`, { method: 'PATCH', cookie: cookie.other, json: { priceSoon: false, price: 1 } });
check('begona PATCH rad etiladi', foreign.status >= 400, true);

done();
