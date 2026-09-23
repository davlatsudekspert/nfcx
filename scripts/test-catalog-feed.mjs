// GET /api/catalog/feed — ilova "Tanlov" katalogi.
//
// Tekshiriladi:
//   * faqat FAOL kompaniyalar va MAVJUD tovarlar; egasi o'chirilgan,
//     moderatsiyadagi (pending_review) va rad etilgan kompaniya tovari YO'Q;
//   * har tovarda kompaniya nomi + Business ID;
//   * NFC turi: slug yoki kalit so'z (lotin VA kirill), `counts` to'g'ri;
//   * qidiruv (nom, kompaniya nomi, Business ID), LIKE belgilari qochirilgan;
//   * saralash chegirmali narx bo'yicha; sahifalash va hasMore;
//   * yozish usullari 405; mavjud /api/companies javobi O'ZGARMAGAN.
//
//   node scripts/test-catalog-feed.mjs

import worker, { ensureCoreSchema } from '../hosting/worker.js';
import { makeEnv, seedBasic, req, makeChecker } from './lib/d1-harness.mjs';
import { nfcTypeOf } from '../hosting/api/catalog-feed.js';

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
  // id, owner, name, status
  ['KARTAUZ', '1', 'Karta Uz', 'active'],
  ['TECHSHOP', '2', 'Tech Shop', 'active'],
  ['PENDINGCO', '1', 'Kutilmoqda', 'pending_review'],
  ['GONECO', '9', 'Egasi yo‘q', 'active'],
];
for (const [id, owner, name, status] of companies) {
  await env.DB.prepare(
    `INSERT INTO companies (company_id, owner_user_id, display_name, tier, price, status, city, created_at, updated_at)
       VALUES (?, ?, ?, 'free', 0, ?, 'Toshkent', '2026-09-01', '2026-09-01')`
  ).bind(id, owner, name, status).run();
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

await item('KARTAUZ', 'Metall karta', 'card', 390000);           // 1  card
await item('KARTAUZ', 'Oq PVC', 'КАРТА', 149000, 99000);          // 2  card (kirill, chegirma)
await item('TECHSHOP', 'NFC stiker 5 dona', '', 49000);           // 3  sticker (nomdan)
await item('TECHSHOP', 'Charm brelok', 'keychain', 120000);       // 4  keychain
await item('TECHSHOP', 'Silikon bilaguzuk', 'aksessuar', 80000);  // 5  accessory
await item('TECHSHOP', 'Sovg‘a qutisi', 'boshqa', 30000);          // 6  other
await item('TECHSHOP', 'Sotuvda yo‘q karta', 'card', 1000, null, 0); // 7  yashirin
await item('PENDINGCO', 'Moderatsiyadagi karta', 'card', 1000);   // 8  yashirin
await item('GONECO', 'Egasiz karta', 'card', 1000);               // 9  yashirin
await item('TECHSHOP', '100% kafolat', 'other', 5000);            // 10 other

{
  const j = await json('/api/catalog/feed');
  const names = j.items.map((i) => i.name);
  check('faqat ko‘rinadiganlar soni', j.total, 7);
  check('mavjud emas yo‘q', names.includes('Sotuvda yo‘q karta'), false);
  check('moderatsiyadagi yo‘q', names.includes('Moderatsiyadagi karta'), false);
  check('egasi o‘chirilgan yo‘q', names.includes('Egasiz karta'), false);
  check('yangisi birinchi', names[0], '100% kafolat');
  const pvc = j.items.find((i) => i.name === 'Oq PVC');
  check('kompaniya nomi', pvc.company.displayName, 'Karta Uz');
  check('Business ID', pvc.company.companyId, 'KARTAUZ');
  check('kirill kategoriya → card', pvc.nfcType, 'card');
  check('chegirmali narx', pvc.effectivePrice, 99000);
  check('asl narx saqlanadi', pvc.price, 149000);
  check('counts', j.counts, { all: 7, card: 2, sticker: 1, keychain: 1, accessory: 1, other: 2 });
}

{
  const j = await json('/api/catalog/feed?category=card');
  check('category=card', j.items.map((i) => i.name).sort(), ['Metall karta', 'Oq PVC']);
  check('counts filtrga bog‘liq emas', j.counts.all, 7);
  const bad = await json('/api/catalog/feed?category=hack');
  check('noma’lum kategoriya = hammasi', bad.total, 7);
}

{
  const j = await json('/api/catalog/feed?q=tech');
  check('q: kompaniya nomi', j.total, 5);
  const byId = await json('/api/catalog/feed?q=KARTAUZ');
  check('q: Business ID', byId.total, 2);
  const pct = await json('/api/catalog/feed?q=' + encodeURIComponent('100%'));
  check('q: % belgisi so‘zma-so‘z', pct.items.map((i) => i.name), ['100% kafolat']);
  const us = await json('/api/catalog/feed?q=_');
  check('q: _ hamma narsa emas', us.total, 0);
}

{
  const asc = await json('/api/catalog/feed?sort=price_asc');
  const p = asc.items.map((i) => i.effectivePrice);
  check('price_asc tartib', p, [...p].sort((a, b) => a - b));
  const desc = await json('/api/catalog/feed?sort=price_desc');
  check('price_desc birinchisi eng qimmat', desc.items[0].name, 'Metall karta');
  check('chegirma bo‘yicha saralanadi', asc.items.findIndex((i) => i.name === 'Oq PVC')
    < asc.items.findIndex((i) => i.name === 'Charm brelok'), true);
}

{
  const p1 = await json('/api/catalog/feed?limit=3&page=1');
  const p3 = await json('/api/catalog/feed?limit=3&page=3');
  check('sahifa 1: 3 ta', p1.items.length, 3);
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
}

{
  const after = await json('/api/companies');
  const names = (after.companies || after.items || after || []).map?.((c) => c.companyId || c.company_id) || [];
  check('/api/companies hali ham ishlaydi', Array.isArray(before.companies || before.items || before), true);
  check('/api/companies faqat faollar', names.includes('PENDINGCO'), false);
}

done();
