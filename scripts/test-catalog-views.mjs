// KATALOG TOVARLARI — KO'RISHLAR SONI (necha kishi ko'rgan).
//   node scripts/test-catalog-views.mjs
//
// Ko'rish allaqachon yozilardi (`POST /api/catalog/items/:id/view`,
// "Ommabop" saralash uchun), lekin son hech qayerda qaytmasdi. Endi
// Tanlov katalogi (`/api/catalog/feed`) va biznes vitrinasi
// (`/api/companies/:id`) har tovarga `views` beradi: bir kishi bir
// marta (kunlar emas, kishilar sanaladi).
//
// Haqiqiy worker.fetch + in-memory D1 (scripts/lib/d1-harness.mjs).
import worker from '../hosting/worker.js';
import { makeEnv, seedBasic, cookie, req, makeChecker } from './lib/d1-harness.mjs';

const { check, done } = makeChecker();
const { env, sqlite } = makeEnv();
await seedBasic(env);

sqlite.prepare(
  `INSERT INTO companies (company_id, owner_user_id, display_name, category, tier, price, status, city, created_at, updated_at)
   VALUES ('KARTAUZ', 2, 'Karta Uz', 'shop', 'free', 0, 'active', 'Toshkent', '2026-09-01', '2026-09-01')`,
).run();
for (const [id, name] of [['item-1', 'Metall karta'], ['item-2', 'NFC stiker']]) {
  sqlite.prepare(
    `INSERT INTO company_catalog_items (id, company_id, name, category, description, price, image_url, available, sort_order, created_at, updated_at)
     VALUES (?, 'KARTAUZ', ?, 'card', '', 100000, '/uploads/p.jpg', 1, 0, '2026-09-01', '2026-09-01')`,
  ).run(id, name);
}

const call = async (path, init = {}) => {
  const res = await worker.fetch(req(path, init), env);
  return { status: res.status, body: await res.json().catch(() => null) };
};
const view = (id, init) => call(`/api/catalog/items/${id}/view`, { method: 'POST', ...init });

check('ko‘rish — kirgan odam', (await view('item-1', { cookie: cookie.user })).status, 200);
await view('item-1', { cookie: cookie.user }); // o'sha odam qayta — sanalmaydi
await view('item-1', { headers: { 'user-agent': 'Mehmon/1' } });
// Boshqa kun — o'sha odam yana yozadi, lekin KISHI soni o'zgarmaydi.
sqlite.prepare(
  `INSERT INTO company_catalog_item_views (item_id, visitor_key, view_day, created_at) VALUES ('item-1', 'u:1', '2026-09-02', '2026-09-02')`,
).run();

const feed = await call('/api/catalog/feed?limit=50');
const f1 = (feed.body?.items || []).find((i) => i.id === 'item-1');
const f2 = (feed.body?.items || []).find((i) => i.id === 'item-2');
check('Tanlov katalogi — item-1 2 kishi', f1?.views, 2);
check('Tanlov katalogi — item-2 0', f2?.views, 0);

const co = await call('/api/companies/KARTAUZ');
const c1 = (co.body?.company?.catalog || co.body?.catalog || []).find((i) => i.id === 'item-1');
check('Biznes vitrinasi — item-1 2 kishi', c1?.views, 2);

done();
