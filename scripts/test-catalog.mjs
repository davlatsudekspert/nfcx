// hosting/api/catalog.js testi — restoran menyusi / mahsulotlar / xizmatlar
// (/api/records/:code/{menu|products|services}[/manage|/categories[/:id]|/items[/:id]]).
// Haqiqiy worker.fetch + in-memory SQLite (scripts/lib/d1-harness.mjs).
// Production D1/R2 ga HECH QACHON tegmaydi.
//
//   node scripts/test-catalog.mjs
import worker, { ensureCoreSchema } from '../hosting/worker.js';
import { makeEnv, seedBasic, cookie, req, makeChecker } from './lib/d1-harness.mjs';

const { check, checkTrue, done } = makeChecker();
const { env } = makeEnv();
await ensureCoreSchema(env);
await seedBasic(env);

const call = async (pathname, init = {}) => {
  const res = await worker.fetch(req(pathname, init), env);
  let body = null;
  try { body = await res.json(); } catch { body = null; }
  return { status: res.status, body };
};
const setSlug = (code, slug) => env.DB.prepare(`UPDATE cards SET category_slug = ? WHERE code = ?`).bind(slug, code).run();
const setTier = (code, tier) => env.DB.prepare(`UPDATE cards SET tier_override = ? WHERE code = ?`).bind(tier, code).run();

const PREMIUM_LIMITS = { cat: 20, item: 300, images: true };

// ================= MENU (BIZ777 → food) =================
await setSlug('BIZ777', 'food');

let r = await call('/api/records/BIZ777/menu');
check('public GET menu — 200 empty', [r.status, r.body], [200, { menu: [] }]);

r = await call('/api/records/GOD123/menu');
check('public GET bad code → 400 bad_code', [r.status, r.body], [400, { error: 'bad_code' }]);

r = await call('/api/records/BIZ777/menu/categories');
check('unmatched sub-route (GET categories) → 404 not_found', [r.status, r.body?.error], [404, 'not_found']);

r = await call('/api/records/BIZ777/menu/manage');
check('manage without session → 401', [r.status, r.body], [401, { error: 'unauthorized' }]);

r = await call('/api/records/BIZ777/menu/manage', { cookie: cookie.other });
check('manage as non-owner → 403 forbidden', [r.status, r.body], [403, { error: 'forbidden' }]);

r = await call('/api/records/BIZ777/menu/categories', { method: 'POST', cookie: cookie.other, json: { name: 'X' } });
check('create category as non-owner → 403 forbidden', [r.status, r.body], [403, { error: 'forbidden' }]);

r = await call('/api/records/BIZ777/menu/manage', { cookie: cookie.user });
check('manage as owner — full shape (premium tier limits, counts 0, eligible)', [r.status, r.body],
  [200, { menu: [], limits: PREMIUM_LIMITS, counts: { cats: 0, items: 0 }, eligible: true }]);

r = await call('/api/records/BIZ777/menu/categories', { method: 'POST', cookie: cookie.user, json: { name: '' } });
check('create category empty name → 422 name_required', [r.status, r.body], [422, { error: 'name_required' }]);

r = await call('/api/records/BIZ777/menu/categories', { method: 'POST', cookie: cookie.user, json: { name: '  Salatlar  ' } });
check('create category → 201 {id,name,sort,enabled}', [r.status, r.body], [201, { id: 1, name: 'Salatlar', sort: 0, enabled: true }]);
const catA = r.body.id;

r = await call('/api/records/BIZ777/menu/categories', { method: 'POST', cookie: cookie.user, json: { name: 'Ichimliklar', sort: -1 } });
check('create 2nd category with sort', [r.status, r.body], [201, { id: 2, name: 'Ichimliklar', sort: -1, enabled: true }]);
const catB = r.body.id;

r = await call('/api/records/BIZ777/menu/items', { method: 'POST', cookie: cookie.user, json: { categoryId: 999, name: 'Olivye' } });
check('create item with unknown category → 422 bad_category', [r.status, r.body], [422, { error: 'bad_category' }]);

r = await call('/api/records/BIZ777/menu/items', { method: 'POST', cookie: cookie.user, json: { categoryId: catA, name: '' } });
check('create item empty name → 422 name_required', [r.status, r.body], [422, { error: 'name_required' }]);

r = await call('/api/records/BIZ777/menu/items', {
  method: 'POST', cookie: cookie.user,
  json: { categoryId: catA, name: 'Olivye', description: 'Klassik', price: '25000', discountPrice: '', imageUrl: '/uploads/olivye.jpg', featured: true, sort: 2 },
});
check('create item → 201 full item shape', [r.status, r.body], [201, {
  id: 1, categoryId: catA, name: 'Olivye', description: 'Klassik', price: 25000, discountPrice: null,
  imageUrl: '/uploads/olivye.jpg', available: true, featured: true, sort: 2,
}]);
const itemA = r.body.id;

r = await call('/api/records/BIZ777/menu/items', {
  method: 'POST', cookie: cookie.user,
  json: { categoryId: catA, name: 'Sezar', price: 30000, discountPrice: 27000, imageUrl: 'https://evil.example/x.jpg', available: false, sort: 1 },
});
check('create item — external imageUrl dropped, discountPrice kept, available false', [r.status, r.body], [201, {
  id: 2, categoryId: catA, name: 'Sezar', description: null, price: 30000, discountPrice: 27000,
  imageUrl: null, available: false, featured: false, sort: 1,
}]);
const itemB = r.body.id;

r = await call('/api/records/BIZ777/menu');
check('public GET — categories ordered by sort,id with items ordered by sort,id (availability visible)', [r.status, r.body], [200, {
  menu: [
    { id: catB, name: 'Ichimliklar', sort: -1, enabled: true, items: [] },
    { id: catA, name: 'Salatlar', sort: 0, enabled: true, items: [
      { id: itemB, categoryId: catA, name: 'Sezar', description: null, price: 30000, discountPrice: 27000, imageUrl: null, available: false, featured: false, sort: 1 },
      { id: itemA, categoryId: catA, name: 'Olivye', description: 'Klassik', price: 25000, discountPrice: null, imageUrl: '/uploads/olivye.jpg', available: true, featured: true, sort: 2 },
    ] },
  ],
}]);

r = await call(`/api/records/BIZ777/menu/items/${itemA}`, { method: 'PUT', cookie: cookie.user, json: { available: false, price: 26000, categoryId: catB } });
check('update item (available/price/categoryId) → 200 updated row', [r.status, r.body], [200, {
  id: itemA, categoryId: catB, name: 'Olivye', description: 'Klassik', price: 26000, discountPrice: null,
  imageUrl: '/uploads/olivye.jpg', available: false, featured: true, sort: 2,
}]);

r = await call(`/api/records/BIZ777/menu/items/${itemA}`, { method: 'PUT', cookie: cookie.user, json: {} });
check('update item with no fields → 404 not_found (legacy)', [r.status, r.body], [404, { error: 'not_found' }]);

r = await call('/api/records/BIZ777/menu/items/777', { method: 'PUT', cookie: cookie.user, json: { name: 'X' } });
check('update nonexistent item → 404 not_found', [r.status, r.body], [404, { error: 'not_found' }]);

// Cross-code kategoriya (IDOR): boshqa kartaning kategoriyasi qabul qilinmaydi.
await env.DB.prepare(`INSERT INTO menu_categories (id, code, name) VALUES (50, 'OTH222', 'Foreign')`).run();
r = await call('/api/records/BIZ777/menu/items', { method: 'POST', cookie: cookie.user, json: { categoryId: 50, name: 'Hack' } });
check('create item into another card\'s category → 422 bad_category', [r.status, r.body], [422, { error: 'bad_category' }]);
r = await call(`/api/records/BIZ777/menu/items/${itemA}`, { method: 'PUT', cookie: cookie.user, json: { categoryId: 50 } });
check('move item into another card\'s category → 422 bad_category', [r.status, r.body], [422, { error: 'bad_category' }]);
r = await call('/api/records/BIZ777/menu/categories/50', { method: 'PUT', cookie: cookie.user, json: { name: 'Pwned' } });
check('update another card\'s category via own code → 404 not_found', [r.status, r.body], [404, { error: 'not_found' }]);
r = await call('/api/records/BIZ777/menu/categories/50', { method: 'DELETE', cookie: cookie.user });
const foreign = await env.DB.prepare(`SELECT name FROM menu_categories WHERE id = 50`).first();
check('delete another card\'s category via own code → {ok:true} but row untouched', [r.status, r.body, foreign?.name], [200, { ok: true }, 'Foreign']);

r = await call(`/api/records/BIZ777/menu/categories/${catA}`, { method: 'PUT', cookie: cookie.user, json: { enabled: false, name: 'Salatlar 2' } });
check('update category (disable + rename) → 200', [r.status, r.body], [200, { id: catA, name: 'Salatlar 2', sort: 0, enabled: false }]);

r = await call('/api/records/BIZ777/menu');
check('public GET hides disabled category', [r.status, r.body.menu.map((c) => c.id)], [200, [catB]]);

r = await call('/api/records/BIZ777/menu/manage', { cookie: cookie.user });
check('manage includes disabled category + counts', [r.status, r.body.menu.map((c) => [c.id, c.enabled, c.items.length]), r.body.counts],
  [200, [[catB, true, 1], [catA, false, 1]], { cats: 2, items: 2 }]);

// ---- limitlar (silver: cat 1 / item 15 / images false) ----
await setTier('BIZ777', 'silver');
r = await call('/api/records/BIZ777/menu/manage', { cookie: cookie.user });
check('silver tier → manage limits {1,15,false}', [r.status, r.body.limits], [200, { cat: 1, item: 15, images: false }]);
r = await call('/api/records/BIZ777/menu/categories', { method: 'POST', cookie: cookie.user, json: { name: 'Uchinchi' } });
check('category limit reached (2 >= 1) → 429 limit_reached', [r.status, r.body], [429, { error: 'limit_reached', limit: 1 }]);
r = await call(`/api/records/BIZ777/menu/items/${itemB}`, { method: 'PUT', cookie: cookie.user, json: { imageUrl: '/uploads/new.jpg' } });
check('silver (images:false) → imageUrl stripped on update', [r.status, r.body.imageUrl], [200, null]);
r = await call('/api/records/BIZ777/menu/items', { method: 'POST', cookie: cookie.user, json: { categoryId: catB, name: 'Choy', imageUrl: '/uploads/choy.jpg' } });
check('silver (images:false) → imageUrl stripped on create', [r.status, r.body.imageUrl, r.body.name], [201, null, 'Choy']);
const itemC = r.body.id;

// admin_settings override: silver item limit → 3 (3 ta bor → keyingisi 429)
await env.DB.prepare(`INSERT INTO admin_settings (key, value) VALUES ('menu_limits', ?)`).bind(JSON.stringify({ silver: { item: 3, images: true } })).run();
r = await call('/api/records/BIZ777/menu/manage', { cookie: cookie.user });
check('admin_settings menu_limits override merged (cat default, item 3, images true)', [r.status, r.body.limits], [200, { cat: 1, item: 3, images: true }]);
r = await call('/api/records/BIZ777/menu/items', { method: 'POST', cookie: cookie.user, json: { categoryId: catB, name: 'Kofe' } });
check('item limit reached (3 >= 3) → 429 limit_reached limit 3', [r.status, r.body], [429, { error: 'limit_reached', limit: 3 }]);

await setTier('BIZ777', 'free');
r = await call('/api/records/BIZ777/menu/manage', { cookie: cookie.user });
check('free tier → 403 feature_locked restaurantMenu', [r.status, r.body], [403, { error: 'feature_locked', feature: 'restaurantMenu' }]);
await setTier('BIZ777', null);

// ---- eligibility: shaxsiy karta (VIP001, exclusive) ----
r = await call('/api/records/VIP001/menu/categories', { method: 'POST', cookie: cookie.user, json: { name: 'X' } });
check('personal card: create menu category → 403 not_restaurant', [r.status, r.body], [403, { error: 'not_restaurant' }]);
r = await call('/api/records/VIP001/products/categories', { method: 'POST', cookie: cookie.user, json: { name: 'X' } });
check('personal card: create product category → 403 not_business', [r.status, r.body], [403, { error: 'not_business' }]);
r = await call('/api/records/VIP001/services/items', { method: 'POST', cookie: cookie.user, json: { categoryId: 1, name: 'X' } });
check('personal card: create service item → 403 not_service_business', [r.status, r.body], [403, { error: 'not_service_business' }]);
r = await call('/api/records/VIP001/menu/manage', { cookie: cookie.user });
check('personal card: manage read allowed, eligible:false', [r.status, r.body.eligible, r.body.menu], [200, false, []]);
r = await call('/api/records/VIP001/menu/items/1', { method: 'PUT', cookie: cookie.user, json: { name: 'Y' } });
check('personal card: update item → 403 not_restaurant', [r.status, r.body], [403, { error: 'not_restaurant' }]);

// ---- delete ----
r = await call(`/api/records/BIZ777/menu/items/${itemC}`, { method: 'DELETE', cookie: cookie.user });
check('delete item → {ok:true}', [r.status, r.body], [200, { ok: true }]);
r = await call(`/api/records/BIZ777/menu/categories/${catB}`, { method: 'DELETE', cookie: cookie.user });
const orphan = await env.DB.prepare(`SELECT COUNT(*) AS n FROM menu_items WHERE category_id = ?`).bind(catB).first();
check('delete category → {ok:true}, its items removed', [r.status, r.body, Number(orphan.n)], [200, { ok: true }, 0]);
r = await call('/api/records/BIZ777/menu/manage', { cookie: cookie.user });
check('counts after delete', r.body.counts, { cats: 1, items: 1 });

// ================= PRODUCTS (BIZ777 → retail-*) =================
await setSlug('BIZ777', 'retail-electronics');

r = await call('/api/records/BIZ777/menu');
check('after slug change to retail: public menu hidden (not eligible) → {menu:[]}', [r.status, r.body], [200, { menu: [] }]);
r = await call('/api/records/BIZ777/menu/categories', { method: 'POST', cookie: cookie.user, json: { name: 'X' } });
check('retail business: create menu category → 403 not_restaurant', [r.status, r.body], [403, { error: 'not_restaurant' }]);
r = await call(`/api/records/BIZ777/menu/categories/${catA}`, { method: 'DELETE', cookie: cookie.user });
check('retail business: delete old menu category still allowed (cleanup)', [r.status, r.body], [200, { ok: true }]);

r = await call('/api/records/BIZ777/products');
check('public GET products — 200 empty', [r.status, r.body], [200, { products: [] }]);
r = await call('/api/records/BIZ777/products/manage');
check('products manage without session → 401', r.status, 401);
r = await call('/api/records/BIZ777/products/manage', { cookie: cookie.other });
check('products manage non-owner → 403', r.status, 403);
r = await call('/api/records/BIZ777/products/manage', { cookie: cookie.user });
check('products manage owner shape', [r.status, r.body], [200, { products: [], limits: PREMIUM_LIMITS, counts: { cats: 0, items: 0 }, eligible: true }]);

r = await call('/api/records/BIZ777/products/categories', { method: 'POST', cookie: cookie.user, json: { name: 'Telefonlar' } });
check('create product category → 201', [r.status, r.body], [201, { id: 1, name: 'Telefonlar', sort: 0, enabled: true }]);
const pcat = r.body.id;
r = await call('/api/records/BIZ777/products/items', {
  method: 'POST', cookie: cookie.user,
  json: { categoryId: pcat, name: 'iPhone', price: 12000000, discountPrice: 11500000, imageUrl: '/uploads/ip.jpg' },
});
check('create product → 201 shape', [r.status, r.body], [201, {
  id: 1, categoryId: pcat, name: 'iPhone', description: null, price: 12000000, discountPrice: 11500000,
  imageUrl: '/uploads/ip.jpg', available: true, featured: false, sort: 0,
}]);
const pitem = r.body.id;
r = await call(`/api/records/BIZ777/products/items/${pitem}`, { method: 'PUT', cookie: cookie.user, json: { discountPrice: null, featured: true, description: 'Yangi' } });
check('update product → 200', [r.status, r.body], [200, {
  id: pitem, categoryId: pcat, name: 'iPhone', description: 'Yangi', price: 12000000, discountPrice: null,
  imageUrl: '/uploads/ip.jpg', available: true, featured: true, sort: 0,
}]);
await env.DB.prepare(`INSERT INTO product_categories (id, code, name) VALUES (60, 'OTH222', 'Foreign')`).run();
r = await call('/api/records/BIZ777/products/items', { method: 'POST', cookie: cookie.user, json: { categoryId: 60, name: 'Hack' } });
check('product item into another card\'s category → 422 bad_category', [r.status, r.body], [422, { error: 'bad_category' }]);
r = await call('/api/records/BIZ777/products');
check('public GET products with items', [r.status, r.body.products.length, r.body.products[0].items[0].name], [200, 1, 'iPhone']);
await setTier('BIZ777', 'silver');
r = await call('/api/records/BIZ777/products/categories', { method: 'POST', cookie: cookie.user, json: { name: 'Ikkinchi' } });
check('product category limit (silver cat 1) → 429', [r.status, r.body], [429, { error: 'limit_reached', limit: 1 }]);
await setTier('BIZ777', null);
r = await call(`/api/records/BIZ777/products/items/${pitem}`, { method: 'DELETE', cookie: cookie.user });
check('delete product → {ok:true}', [r.status, r.body], [200, { ok: true }]);
r = await call(`/api/records/BIZ777/products/categories/${pcat}`, { method: 'DELETE', cookie: cookie.user });
check('delete product category → {ok:true}', [r.status, r.body], [200, { ok: true }]);

// ================= SERVICES (BIZ777 → boshqa soha) =================
await setSlug('BIZ777', 'construction');

r = await call('/api/records/BIZ777/products');
check('after slug change to construction: public products hidden → {products:[]}', [r.status, r.body], [200, { products: [] }]);
r = await call('/api/records/BIZ777/products/categories', { method: 'POST', cookie: cookie.user, json: { name: 'X' } });
check('service business: create product category → 403 not_business', [r.status, r.body], [403, { error: 'not_business' }]);

r = await call('/api/records/BIZ777/services');
check('public GET services — 200 empty', [r.status, r.body], [200, { services: [] }]);
r = await call('/api/records/BIZ777/services/manage');
check('services manage without session → 401', r.status, 401);
r = await call('/api/records/BIZ777/services/manage', { cookie: cookie.other });
check('services manage non-owner → 403', r.status, 403);
r = await call('/api/records/BIZ777/services/manage', { cookie: cookie.user });
check('services manage owner shape', [r.status, r.body], [200, { services: [], limits: PREMIUM_LIMITS, counts: { cats: 0, items: 0 }, eligible: true }]);

r = await call('/api/records/BIZ777/services/categories', { method: 'POST', cookie: cookie.user, json: { name: 'Remont' } });
check('create service category → 201', [r.status, r.body], [201, { id: 1, name: 'Remont', sort: 0, enabled: true }]);
const scat = r.body.id;
r = await call('/api/records/BIZ777/services/items', {
  method: 'POST', cookie: cookie.user,
  json: { categoryId: scat, name: 'Suvoq', price: 50000, priceType: 'from', imageUrl: '/uploads/s.jpg' },
});
check('create service → 201 shape with priceType', [r.status, r.body], [201, {
  id: 1, categoryId: scat, name: 'Suvoq', description: null, price: 50000, priceType: 'from',
  imageUrl: '/uploads/s.jpg', available: true, featured: false, sort: 0,
}]);
const sitem = r.body.id;
r = await call('/api/records/BIZ777/services/items', { method: 'POST', cookie: cookie.user, json: { categoryId: scat, name: 'Loyiha', priceType: 'bogus', discountPrice: 5 } });
check('create service — invalid priceType → fixed, no discountPrice key', [r.status, r.body.priceType, 'discountPrice' in r.body, r.body.price], [201, 'fixed', false, null]);
r = await call(`/api/records/BIZ777/services/items/${sitem}`, { method: 'PUT', cookie: cookie.user, json: { priceType: 'negotiable', price: null } });
check('update service priceType → negotiable', [r.status, r.body.priceType, r.body.price], [200, 'negotiable', null]);
r = await call(`/api/records/BIZ777/services/items/${sitem}`, { method: 'PUT', cookie: cookie.user, json: { priceType: 'nope' } });
check('update service invalid priceType → fixed', [r.status, r.body.priceType], [200, 'fixed']);
await env.DB.prepare(`INSERT INTO service_categories (id, code, name) VALUES (70, 'OTH222', 'Foreign')`).run();
r = await call('/api/records/BIZ777/services/items', { method: 'POST', cookie: cookie.user, json: { categoryId: 70, name: 'Hack' } });
check('service item into another card\'s category → 422 bad_category', [r.status, r.body], [422, { error: 'bad_category' }]);
r = await call('/api/records/BIZ777/services');
check('public GET services with items', [r.status, r.body.services.length, r.body.services[0].items.map((i) => i.name)], [200, 1, ['Suvoq', 'Loyiha']]);
await setTier('BIZ777', 'silver');
r = await call('/api/records/BIZ777/services/categories', { method: 'POST', cookie: cookie.user, json: { name: 'Ikkinchi' } });
check('service category limit (silver cat 1) → 429', [r.status, r.body], [429, { error: 'limit_reached', limit: 1 }]);
await env.DB.prepare(`INSERT INTO admin_settings (key, value) VALUES ('service_limits', ?)`).bind(JSON.stringify({ silver: { item: 2 } })).run();
r = await call('/api/records/BIZ777/services/items', { method: 'POST', cookie: cookie.user, json: { categoryId: scat, name: 'Uchinchi' } });
check('service item limit via service_limits override (2 >= 2) → 429', [r.status, r.body], [429, { error: 'limit_reached', limit: 2 }]);
await setTier('BIZ777', null);
r = await call(`/api/records/BIZ777/services/items/${sitem}`, { method: 'DELETE', cookie: cookie.user });
check('delete service → {ok:true}', [r.status, r.body], [200, { ok: true }]);
r = await call(`/api/records/BIZ777/services/categories/${scat}`, { method: 'DELETE', cookie: cookie.user });
check('delete service category → {ok:true}', [r.status, r.body], [200, { ok: true }]);
r = await call('/api/records/BIZ777/services/manage', { cookie: cookie.user });
check('services counts after delete', r.body.counts, { cats: 0, items: 0 });

// Unknown method/path combos fall through to worker 404 (module returns null).
r = await call('/api/records/BIZ777/services/items', { method: 'GET' });
check('GET /services/items → 404', r.status, 404);
r = await call('/api/records/BIZ777/services/manage', { method: 'POST', cookie: cookie.user, json: {} });
check('POST /services/manage → 404', r.status, 404);

done();
