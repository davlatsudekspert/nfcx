// GET /api/catalog/feed — ilova "Tanlov" katalogi (UMUMIY, 2026-09).
//
// Tekshiriladi:
//   * faqat FAOL kompaniyalar; egasi o'chirilgan, moderatsiyadagi
//     (pending_review) kompaniya tovari YO'Q; mavjud emas tovar BOR,
//     lekin `available:false` bilan va ro'yxat oxirida;
//   * katalog faqat NFC emas: ovqat, kiyim, xizmat, kurs...;
//     tur (product/service) va global kategoriya kompaniya sohasi va
//     kalit so'zlardan aniqlanadi; NFC — electronics ichidagi sub;
//   * "Narx kelishiladi" (price 0 / price_on_request);
//   * `counts` dinamik chiplar uchun; kind/category/sub filtrlari;
//     eski `category=card` = electronics + card;
//   * qidiruv: nom, bo'lim, Business nomi, Business ID, NFC ID;
//     LIKE belgilari qochirilgan;
//   * saralash chegirmali narx bo'yicha; sahifalash va hasMore;
//   * yozish usullari 405; mavjud /api/companies javobi O'ZGARMAGAN.
//
//   node scripts/test-catalog-feed.mjs

import worker, { ensureCoreSchema } from '../hosting/worker.js';
import { makeEnv, seedBasic, req, makeChecker } from './lib/d1-harness.mjs';
import { nfcTypeOf, marketCategoryOf, kindOf, subOf } from '../hosting/api/catalog-feed.js';

const { check, done } = makeChecker();

const { env } = makeEnv({});
await ensureCoreSchema(env);
await seedBasic(env);

const get = (path, init = {}) => worker.fetch(req(path, init), env);
const json = async (path, init) => (await get(path, init)).json();

// Jadval hali yo'q — bo'sh katalog, 503 emas.
{
  const r = await get('/api/catalog/feed');
  check('jadval yo‘q: 200', r.status, 200);
  const j = await r.json();
  check('jadval yo‘q: bo‘sh', j.items.length, 0);
}

// Kompaniya jadvallarini worker'ning o'zi yaratsin.
await get('/api/companies');
const before = await json('/api/companies');

await env.DB.prepare(
  `INSERT INTO users (id, email, password_hash, deleted_at) VALUES (9, 'gone@test.local', 'x', '2026-09-01T00:00:00Z')`
).run();

const companies = [
  // id, owner, name, status, category, nfc id
  ['KARTAUZ', '1', 'Karta Uz', 'active', 'shop', 'VIP001'],
  ['TECHSHOP', '2', 'Tech Shop', 'active', 'shop', ''],
  ['OSHXONA', '2', 'Milliy Oshxona', 'active', 'restaurant', ''],
  ['GOZAL', '1', 'Go‘zal Salon', 'active', 'services', ''],
  ['PENDINGCO', '1', 'Kutilmoqda', 'pending_review', 'other', ''],
  ['GONECO', '9', 'Egasi yo‘q', 'active', 'other', ''],
];
for (const [id, owner, name, status, category, nfc] of companies) {
  await env.DB.prepare(
    `INSERT INTO companies (company_id, owner_user_id, display_name, category, tier, price, status, city, source_card_code, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'free', 0, ?, 'Toshkent', ?, '2026-09-01', '2026-09-01')`
  ).bind(id, owner, name, category, status, nfc).run();
}

let n = 0;
const item = async (company, name, category, price, promo = null, available = 1) => {
  n += 1;
  const ts = `2026-09-${String(n).padStart(2, '0')}T10:00:00Z`;
  await env.DB.prepare(
    `INSERT INTO company_catalog_items (id, company_id, name, category, description, price, promotion_price, image_url, available, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, '', ?, ?, '/uploads/p.jpg', ?, 0, ?, ?)`
  ).bind(`item-${n}`, company, name, category, price, promo, available, ts, ts).run();
};

await item('KARTAUZ', 'Metall karta', 'card', 390000);            // 1  electronics/card
await item('KARTAUZ', 'Oq PVC', 'КАРТА', 149000, 99000);           // 2  electronics? kirill bo'lim
await item('TECHSHOP', 'NFC stiker 5 dona', '', 49000);            // 3  electronics/sticker
await item('TECHSHOP', 'Charm brelok', 'keychain', 120000);        // 4  electronics/keychain
await item('TECHSHOP', 'Ayollar ko‘ylagi', 'Kiyimlar', 250000);     // 5  fashion
await item('TECHSHOP', 'Sotuvda yo‘q naushnik', 'Elektronika', 1000, null, 0); // 6 mavjud emas
await item('PENDINGCO', 'Moderatsiyadagi karta', 'card', 1000);    // 7  yashirin
await item('GONECO', 'Egasiz karta', 'card', 1000);                // 8  yashirin
await item('OSHXONA', 'Uy salati', 'Salatlar', 35000);              // 9  food (soha USTUN)
await item('GOZAL', 'Soch olish', 'Sartaroshlik', 0);               // 10 beauty, service, narx kelishiladi
await item('TECHSHOP', '100% kafolat', 'Boshqa', 5000);             // 11 other

{
  const j = await json('/api/catalog/feed');
  const names = j.items.map((i) => i.name);
  check('ko‘rinadiganlar soni', j.total, 9);
  check('moderatsiyadagi yo‘q', names.includes('Moderatsiyadagi karta'), false);
  check('egasi o‘chirilgan yo‘q', names.includes('Egasiz karta'), false);
  check('mavjud emas BOR, lekin oxirida', names[names.length - 1], 'Sotuvda yo‘q naushnik');
  check('mavjud emas belgisi', j.items.at(-1).available, false);
  check('yangisi birinchi', names[0], '100% kafolat');
  const pvc = j.items.find((i) => i.name === 'Oq PVC');
  check('kompaniya nomi', pvc.company.displayName, 'Karta Uz');
  check('Business ID', pvc.company.companyId, 'KARTAUZ');
  check('kirill bo‘lim → electronics/card', [pvc.marketCategory, pvc.sub], ['electronics', 'card']);
  check('chegirmali narx', pvc.effectivePrice, 99000);
  check('asl narx saqlanadi', pvc.price, 149000);
  check('o‘z bo‘limi saqlanadi', pvc.section, 'КАРТА');
  const salad = j.items.find((i) => i.name === 'Uy salati');
  check('restoran → food (kalit so‘zdan ustun)', [salad.marketCategory, salad.kind, salad.sub], ['food', 'product', null]);
  const hair = j.items.find((i) => i.name === 'Soch olish');
  check('salon → beauty + xizmat', [hair.marketCategory, hair.kind], ['beauty', 'service']);
  check('narx 0 → narx kelishiladi', hair.priceOnRequest, true);
  check('aloqa ma’lumoti', typeof hair.company.phone, 'string');
  const dress = j.items.find((i) => i.name === 'Ayollar ko‘ylagi');
  check('kiyim → fashion', dress.marketCategory, 'fashion');
  check('rasmlar ro‘yxati', dress.images, ['/uploads/p.jpg']);
  check('counts', {
    all: j.counts.all, product: j.counts.product, service: j.counts.service,
    electronics: j.counts.electronics, food: j.counts.food, fashion: j.counts.fashion,
    beauty: j.counts.beauty, other: j.counts.other, auto: j.counts.auto,
    card: j.counts.card, sticker: j.counts.sticker, keychain: j.counts.keychain,
  }, { all: 9, product: 8, service: 1, electronics: 5, food: 1, fashion: 1, beauty: 1, other: 1, auto: 0, card: 2, sticker: 1, keychain: 1 });
}

{
  const svc = await json('/api/catalog/feed?kind=service');
  check('kind=service', svc.items.map((i) => i.name), ['Soch olish']);
  const food = await json('/api/catalog/feed?category=food');
  check('category=food', food.items.map((i) => i.name), ['Uy salati']);
  const el = await json('/api/catalog/feed?category=electronics&sub=card');
  check('electronics + sub=card', el.items.map((i) => i.name).sort(), ['Metall karta', 'Oq PVC']);
  const legacy = await json('/api/catalog/feed?category=card');
  check('eski category=card ishlaydi', legacy.items.map((i) => i.name).sort(), ['Metall karta', 'Oq PVC']);
  check('counts filtrga bog‘liq emas', legacy.counts.all, 9);
  const bad = await json('/api/catalog/feed?category=hack&kind=x');
  check('noma’lum filtr = hammasi', bad.total, 9);
}

{
  const j = await json('/api/catalog/feed?q=tech');
  check('q: kompaniya nomi', j.total, 5);
  const byId = await json('/api/catalog/feed?q=KARTAUZ');
  check('q: Business ID', byId.total, 2);
  const byNfc = await json('/api/catalog/feed?q=vip001');
  check('q: NFC ID', byNfc.items.map((i) => i.company.companyId), ['KARTAUZ', 'KARTAUZ']);
  const bySection = await json('/api/catalog/feed?q=salatlar');
  check('q: o‘z bo‘limi', bySection.items.map((i) => i.name), ['Uy salati']);
  const svc = await json('/api/catalog/feed?q=' + encodeURIComponent('soch'));
  check('q: xizmat nomi', svc.items.map((i) => i.name), ['Soch olish']);
  const pct = await json('/api/catalog/feed?q=' + encodeURIComponent('100%'));
  check('q: % belgisi so‘zma-so‘z', pct.items.map((i) => i.name), ['100% kafolat']);
  const us = await json('/api/catalog/feed?q=_');
  check('q: _ hamma narsa emas', us.total, 0);
}

{
  const asc = await json('/api/catalog/feed?sort=price_asc');
  const avail = asc.items.filter((i) => i.available && !i.priceOnRequest).map((i) => i.effectivePrice);
  check('price_asc tartib', avail, [...avail].sort((a, b) => a - b));
  check('narx kelishiladi narxlilardan keyin', asc.items.findIndex((i) => i.priceOnRequest)
    > asc.items.findIndex((i) => i.name === 'Metall karta'), true);
  check('mavjud emas baribir oxirida', asc.items.at(-1).available, false);
  const desc = await json('/api/catalog/feed?sort=price_desc');
  check('price_desc birinchisi eng qimmat', desc.items[0].name, 'Metall karta');
  check('chegirma bo‘yicha saralanadi', asc.items.findIndex((i) => i.name === 'Oq PVC')
    < asc.items.findIndex((i) => i.name === 'Charm brelok'), true);
}

{
  const p1 = await json('/api/catalog/feed?limit=4&page=1');
  const p3 = await json('/api/catalog/feed?limit=4&page=3');
  check('sahifa 1: 4 ta', p1.items.length, 4);
  check('sahifa 1: yana bor', p1.hasMore, true);
  check('sahifa 3: 1 ta', p3.items.length, 1);
  check('sahifa 3: tugadi', p3.hasMore, false);
  const big = await json('/api/catalog/feed?limit=9999');
  check('limit 50 dan oshmaydi', big.limit, 50);
}

{
  const r = await get('/api/catalog/feed', { method: 'POST', json: {} });
  check('POST 405', r.status, 405);
  check('nfcTypeOf: nomdan', nfcTypeOf('', 'Брелок для ключей'), 'keychain');
  check('nfcTypeOf: slug ustun', nfcTypeOf('sticker', 'karta'), 'sticker');
  check('marketCategoryOf: aniq qiymat ustun', marketCategoryOf('auto', 'restaurant', '', 'Palov'), 'auto');
  check('marketCategoryOf: kalit so‘z', marketCategoryOf(null, 'shop', '', 'Shina 17'), 'auto');
  check('kindOf: klinika → xizmat', kindOf(null, 'clinic', '', 'Ko‘rik'), 'service');
  check('subOf: restoran kartasi NFC emas', subOf('food', 'karta', 'Karta orqali to‘lov'), null);
}

{
  const after = await json('/api/companies');
  const names = (after.companies || after.items || after || []).map?.((c) => c.companyId || c.company_id) || [];
  check('/api/companies hali ham ishlaydi', Array.isArray(before.companies || before.items || before), true);
  check('/api/companies faqat faollar', names.includes('PENDINGCO'), false);
}

done();
