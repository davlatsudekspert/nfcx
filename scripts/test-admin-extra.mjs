// hosting/api/admin-extra.js testi — haqiqiy worker.fetch, in-memory D1 (scripts/lib/d1-harness.mjs).
//   node scripts/test-admin-extra.mjs
import worker from '../hosting/worker.js';
import { makeEnv, seedBasic, cookie, req, makeChecker, sha256Hex } from './lib/d1-harness.mjs';

const { env, sqlite } = makeEnv();
await seedBasic(env);
// content_manager sessiyasi — nfc-gifts uchun 403 tekshiruvi (super_admin | manager ruxsat).
await env.DB.prepare(`INSERT INTO admin_sessions (token, admin_id, role, abs_exp, last_activity) VALUES (?, 3, 'content_manager', '2999-01-01T00:00:00.000Z', ?)`)
  .bind(sha256Hex('content-token'), new Date().toISOString()).run();
const contentCookie = 'nfc_admin_session=content-token';

const { check, checkTrue, done } = makeChecker();
const call = (pathname, init) => worker.fetch(req(pathname, init), env);
const j = async (pathname, init) => { const r = await call(pathname, init); let body = null; try { body = await r.json(); } catch { body = null; } return { status: r.status, body }; };

// ---------- auth ----------
{
  const r = await j('/api/admin/categories');
  check('401 without cookie', [r.status, r.body], [401, { error: 'unauthorized' }]);
  check('404 unknown admin route still falls through', (await j('/api/admin/does-not-exist', { cookie: cookie.admin })).status, 404);
}

// ---------- 403 for manager on super_admin-only routes ----------
for (const [label, pathname, init] of [
  ['users/:id/delete', '/api/admin/users/2/delete', { method: 'POST' }],
  ['orders/:id/confirm-payment', '/api/admin/orders/1/confirm-payment', { method: 'POST' }],
  ['bot-orders/:id/confirm-payment', '/api/admin/bot-orders/1/confirm-payment', { method: 'POST' }],
  ['company-settings/limits POST', '/api/admin/company-settings/limits', { method: 'POST', json: { kind: 'menu', tier: 'gold', cat: 1, item: 1 } }],
  ['company-settings/limits DELETE', '/api/admin/company-settings/limits/menu/gold', { method: 'DELETE' }],
  ['company-settings/physical-pricing', '/api/admin/company-settings/physical-pricing', { method: 'POST', json: { tiers: [{ minQty: 1, maxQty: null, pricePerUnit: 1 }] } }],
  ['company-settings/delivery', '/api/admin/company-settings/delivery', { method: 'POST', json: { minDays: 1, maxDays: 2 } }],
]) {
  const r = await j(pathname, { ...init, cookie: cookie.manager });
  check(`403 manager on ${label}`, [r.status, r.body], [403, { error: 'forbidden' }]);
}
{
  const r = await j('/api/admin/nfc-gifts', { method: 'POST', cookie: contentCookie, json: { code: 'GIFTX1', recipientName: 'X' } });
  check('403 content_manager on nfc-gifts POST', [r.status, r.body], [403, { error: 'forbidden' }]);
}

// ---------- categories ----------
{
  let r = await j('/api/admin/categories', { method: 'POST', cookie: cookie.admin, json: { slug: 'Food & Drink', nameUz: 'Oziq-ovqat', nameRu: 'Еда', nameEn: 'Food', sort: 10 } });
  check('POST category 201', r.status, 201);
  check('POST category shape', r.body, { id: 1, slug: 'fooddrink', parentSlug: null, nameUz: 'Oziq-ovqat', nameRu: 'Еда', nameEn: 'Food', sort: 10, enabled: true });
  const mainId = r.body.id;
  r = await j('/api/admin/categories', { method: 'POST', cookie: cookie.admin, json: { slug: 'cafe', nameUz: 'Kafe', parentSlug: 'fooddrink', sort: 1 } });
  check('POST child category', [r.status, r.body.parentSlug, r.body.nameRu], [201, 'fooddrink', '']);
  const childId = r.body.id;
  r = await j('/api/admin/categories', { method: 'POST', cookie: cookie.admin, json: { slug: 'cafe', nameUz: 'Dup' } });
  check('POST duplicate slug 409', [r.status, r.body], [409, { error: 'slug_exists' }]);
  r = await j('/api/admin/categories', { method: 'POST', cookie: cookie.admin, json: { slug: '', nameUz: 'X' } });
  check('POST missing slug 422', [r.status, r.body], [422, { error: 'slug_required' }]);
  r = await j('/api/admin/categories', { method: 'POST', cookie: cookie.admin, json: { slug: 'x', nameUz: '' } });
  check('POST missing name 422', [r.status, r.body], [422, { error: 'name_required' }]);

  r = await j(`/api/admin/categories/${childId}`, { method: 'PUT', cookie: cookie.admin, json: { enabled: false } });
  check('PUT enabled=false (partial, others kept)', [r.status, r.body.enabled, r.body.nameUz, r.body.sort, r.body.parentSlug], [200, false, 'Kafe', 1, 'fooddrink']);
  r = await j(`/api/admin/categories/${childId}`, { method: 'PUT', cookie: cookie.admin, json: { sort: 7, nameRu: 'Кафе' } });
  check('PUT sort+nameRu', [r.body.sort, r.body.nameRu, r.body.enabled], [7, 'Кафе', false]);
  r = await j('/api/admin/categories/999', { method: 'PUT', cookie: cookie.admin, json: { sort: 1 } });
  check('PUT unknown 404', r.status, 404);

  r = await j('/api/admin/categories', { cookie: cookie.manager });
  check('GET categories (manager ok, includes disabled, sorted)', [r.status, r.body.categories.map((c) => [c.slug, c.enabled])], [200, [['cafe', false], ['fooddrink', true]]]);

  await env.DB.prepare(`UPDATE cards SET category_slug = 'fooddrink' WHERE code = 'BIZ777'`).run();
  r = await j(`/api/admin/categories/${mainId}`, { method: 'DELETE', cookie: cookie.admin });
  check('DELETE category referenced by cards 409', [r.status, r.body], [409, { error: 'category_in_use', count: 1 }]);
  await env.DB.prepare(`UPDATE cards SET category_slug = NULL WHERE code = 'BIZ777'`).run();
  r = await j(`/api/admin/categories/${childId}`, { method: 'DELETE', cookie: cookie.admin });
  check('DELETE child ok', [r.status, r.body], [200, { ok: true }]);
  r = await j(`/api/admin/categories/${mainId}`, { method: 'DELETE', cookie: cookie.admin });
  check('DELETE main ok', [r.status, r.body], [200, { ok: true }]);
  r = await j('/api/admin/categories/999', { method: 'DELETE', cookie: cookie.admin });
  check('DELETE unknown 404', r.status, 404);
  check('categories table empty', sqlite.prepare(`SELECT COUNT(*) AS n FROM categories`).get().n, 0);
}

// ---------- verify / views ----------
{
  let r = await j('/api/admin/records/vip001/verify', { method: 'POST', cookie: cookie.manager, json: { verified: true } });
  check('verify true', [r.status, r.body], [200, { code: 'VIP001', name: 'Muhammad', verified: true }]);
  check('verify persisted', sqlite.prepare(`SELECT verified FROM cards WHERE code = 'VIP001'`).get().verified, 1);
  r = await j('/api/admin/records/VIP001/verify', { method: 'POST', cookie: cookie.admin, json: { verified: false } });
  check('verify false', r.body.verified, false);
  r = await j('/api/admin/records/NOPE99/verify', { method: 'POST', cookie: cookie.admin, json: { verified: true } });
  check('verify unknown 404', [r.status, r.body], [404, { error: 'not_found' }]);

  r = await j('/api/admin/records/vip001/views', { method: 'POST', cookie: cookie.admin, json: { views: 1234.4 } });
  check('views set', [r.status, r.body], [200, { code: 'VIP001', name: 'Muhammad', views: 1234 }]);
  r = await j('/api/admin/records/VIP001/views', { method: 'POST', cookie: cookie.admin, json: { views: -1 } });
  check('views negative 422', [r.status, r.body], [422, { error: 'bad_views' }]);
  r = await j('/api/admin/records/VIP001/views', { method: 'POST', cookie: cookie.admin, json: { views: 'abc' } });
  check('views NaN 422', r.status, 422);
  r = await j('/api/admin/records/NOPE99/views', { method: 'POST', cookie: cookie.admin, json: { views: 1 } });
  check('views unknown 404', r.status, 404);
}

// ---------- users delete (super only) ----------
{
  let r = await j('/api/admin/users/2/delete', { method: 'POST', cookie: cookie.admin });
  check('user delete ok', [r.status, r.body], [200, { ok: true }]);
  const u = sqlite.prepare(`SELECT deleted_at, email FROM users WHERE id = 2`).get();
  checkTrue('user soft-deleted (deleted_at set, row kept)', u && u.deleted_at && u.email === 'other@test.local');
  check('user sessions removed', sqlite.prepare(`SELECT COUNT(*) AS n FROM sessions WHERE user_id = 2`).get().n, 0);
  check('other user sessions untouched', sqlite.prepare(`SELECT COUNT(*) AS n FROM sessions WHERE user_id = 1`).get().n, 1);
  r = await j('/api/admin/users/999/delete', { method: 'POST', cookie: cookie.admin });
  check('user delete unknown 404', r.status, 404);
}

// ---------- nfc gifts ----------
{
  let r = await j('/api/admin/nfc-gifts', { method: 'POST', cookie: cookie.admin, json: { code: 'gift01', recipientName: 'Ali', note: 'tug‘ilgan kun', value: '50000' } });
  check('gift created 201', r.status, 201);
  check('gift response shape', [r.body.id, r.body.code, /^NFC-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/.test(r.body.activationCode || '')], [1, 'GIFT01', true]);
  const g = sqlite.prepare(`SELECT * FROM nfc_gifts WHERE code = 'GIFT01'`).get();
  check('gift row', [g.recipient_name, g.note, g.value, g.status, g.activation_code === r.body.activationCode], ['Ali', 'tug‘ilgan kun', 50000, 'reserved', true]);
  r = await j('/api/admin/nfc-gifts', { method: 'POST', cookie: cookie.admin, json: { code: 'GIFT01', recipientName: 'B' } });
  check('gift already reserved 409', [r.status, r.body], [409, { error: 'ALREADY_RESERVED' }]);
  r = await j('/api/admin/nfc-gifts', { method: 'POST', cookie: cookie.admin, json: { code: 'VIP001', recipientName: 'B' } });
  check('gift code taken 409', [r.status, r.body], [409, { error: 'CODE_TAKEN' }]);
  r = await j('/api/admin/nfc-gifts', { method: 'POST', cookie: cookie.admin, json: { code: 'GOD001' } });
  check('gift blocked code 422', [r.status, r.body], [422, { error: 'bad_code' }]);
  r = await j('/api/admin/nfc-gifts', { method: 'POST', cookie: cookie.admin, json: { code: 'GIFT02', value: -5 } });
  check('gift bad value 422', [r.status, r.body], [422, { error: 'bad_value' }]);
  r = await j('/api/admin/nfc-gifts', { method: 'POST', cookie: cookie.manager, json: { code: 'GIFT02', recipientName: '' } });
  check('manager may create gift (value null)', [r.status, r.body.code, sqlite.prepare(`SELECT value, recipient_name AS rn FROM nfc_gifts WHERE code = 'GIFT02'`).get()], [201, 'GIFT02', { value: null, rn: null }]);
  r = await j('/api/admin/nfc-gifts', { cookie: cookie.admin });
  check('GET nfc-gifts (core) lists both', [r.status, r.body.gifts.map((x) => x.code).sort()], [200, ['GIFT01', 'GIFT02']]);
}

// ---------- confirm-payment (web + bot) ----------
{
  await env.DB.prepare(`INSERT INTO web_orders (id, user_id, code, price, payload, status, kind, created_at) VALUES (10, 1, 'NEW123', 100000, ?, 'pending', 'card_purchase', ?)`)
    .bind(JSON.stringify({ name: 'Yangi Mijoz', role: 'CEO' }), new Date().toISOString()).run();
  let r = await j('/api/admin/orders/10/confirm-payment', { method: 'POST', cookie: cookie.admin });
  check('web confirm ok', [r.status, r.body.ok, r.body.created?.code, r.body.created?.name], [200, true, 'NEW123', 'Yangi Mijoz']);
  check('web order paid + card attached to user', [
    sqlite.prepare(`SELECT status FROM web_orders WHERE id = 10`).get().status,
    sqlite.prepare(`SELECT user_id, price FROM cards WHERE code = 'NEW123'`).get(),
  ], ['paid', { user_id: 1, price: 100000 }]);
  r = await j('/api/admin/orders/10/confirm-payment', { method: 'POST', cookie: cookie.admin });
  check('web confirm again → 200 idempotent alreadyPaid (worker finalize semantics)', [r.status, r.body], [200, { ok: true, alreadyPaid: true }]);
  r = await j('/api/admin/orders/999/confirm-payment', { method: 'POST', cookie: cookie.admin });
  check('web confirm unknown 409 already_processed', [r.status, r.body], [409, { error: 'already_processed' }]);
  await env.DB.prepare(`INSERT INTO web_orders (id, user_id, code, price, payload, status, kind, created_at) VALUES (11, 1, 'CANC01', 1000, '{}', 'cancelled', 'card_purchase', ?)`).bind(new Date().toISOString()).run();
  r = await j('/api/admin/orders/11/confirm-payment', { method: 'POST', cookie: cookie.admin });
  check('web confirm cancelled 409', r.status, 409);
  await env.DB.prepare(`INSERT INTO web_orders (id, user_id, code, price, payload, status, kind, created_at) VALUES (12, 1, 'PREM01', 1000, '{}', 'pending', 'auction_payment', ?)`).bind(new Date().toISOString()).run();
  r = await j('/api/admin/orders/12/confirm-payment', { method: 'POST', cookie: cookie.admin });
  check('web confirm unsupported kind → 200 {ok:false} and stays pending', [r.status, r.body, sqlite.prepare(`SELECT status FROM web_orders WHERE id = 12`).get().status], [200, { ok: false, reason: 'unsupported_order_kind' }, 'pending']);

  await env.DB.prepare(`INSERT INTO bot_orders (id, tg_user_id, tg_username, tg_name, code, price, status, created_at) VALUES (5, 777, 'ali', 'Ali', 'BOT001', 50000, 'pending', ?)`).bind(new Date().toISOString()).run();
  r = await j('/api/admin/bot-orders/5/confirm-payment', { method: 'POST', cookie: cookie.admin });
  check('bot confirm ok', [r.status, r.body.ok, r.body.order.id, r.body.order.status, r.body.order.code, r.body.order.tgUsername, r.body.order.price], [200, true, 5, 'paid', 'BOT001', 'ali', 50000]);
  check('bot card created TELEGRAM MIJOZ', sqlite.prepare(`SELECT name, price, user_id FROM cards WHERE code = 'BOT001'`).get(), { name: 'TELEGRAM MIJOZ', price: 50000, user_id: null });
  r = await j('/api/admin/bot-orders/5/confirm-payment', { method: 'POST', cookie: cookie.admin });
  check('bot confirm again 409', [r.status, r.body], [409, { error: 'already_processed' }]);
  r = await j('/api/admin/bot-orders/999/confirm-payment', { method: 'POST', cookie: cookie.admin });
  check('bot confirm unknown 409', r.status, 409);
  check('activity log: 2 paid + 1 failed(unsupported), idempotent re-confirm not logged',
    sqlite.prepare(`SELECT new_value AS v, COUNT(*) AS n FROM admin_activity_log WHERE action = 'payment_confirmed_manually' GROUP BY new_value ORDER BY new_value`).all(),
    [{ v: 'failed:unsupported_order_kind', n: 1 }, { v: 'paid', n: 2 }]);
}

// ---------- export-stats (CSV) ----------
{
  const res = await call('/api/admin/export-stats?range=7d', { cookie: cookie.manager });
  const bytes = new Uint8Array(await res.arrayBuffer());
  const text = new TextDecoder('utf-8').decode(bytes); // BOM tashlab yuboriladi (spec)
  check('export 200 text/csv', [res.status, res.headers.get('content-type')], [200, 'text/csv; charset=utf-8']);
  check('export content-disposition .csv', res.headers.get('content-disposition'), 'attachment; filename="nfcstore_statistika_7d.csv"');
  check('export starts with UTF-8 BOM', Array.from(bytes.slice(0, 3)), [0xEF, 0xBB, 0xBF]);
  checkTrue('export header', text.startsWith('Sana,Yangi ro’yxatdan o’tganlar,Yangi NFC ID (sotilgan),Yangi Premium,Buyurtmalar,To’lovlar,Tushum (so’m),Auksion (yaratilgan),Auksion (sotilgan)\r\n'));
  const today = new Date().toISOString().slice(0, 10);
  const todayLine = text.split('\r\n').find((l) => l.startsWith(today + ','));
  // users 1,2 bugun; NEW123 + BOT001 kartalar bugun (price>0); web_orders 3 ta bugun, 1 ta paid
  check('export today row', todayLine, `${today},2,2,0,3,1,0,0,0`);
  checkTrue('export JAMI row', text.includes('\r\nJAMI,2,2,0,3,1,0,0,0\r\n'));
  checkTrue('export summary block', text.includes('— JAMLAMA —') && text.includes('Jami foydalanuvchilar (davr oxiriga),2') && text.includes('Jami Premium foydalanuvchilar,0'));
  const all = await call('/api/admin/export-stats?range=all', { cookie: cookie.admin });
  const allText = await all.text();
  check('export range=all ok', [all.status, all.headers.get('content-disposition')], [200, 'attachment; filename="nfcstore_statistika_all.csv"']);
  checkTrue('export range=all includes 1970 seed cards', allText.includes('1970-01-01,0,3,0,0,0,0,0,0'));
  check('export 401 without cookie', (await call('/api/admin/export-stats?range=7d')).status, 401);
}

// ---------- companies: status / tier ----------
{
  let r = await j('/api/admin/companies/biz777/status', { method: 'POST', cookie: cookie.manager, json: { hidden: true } });
  check('company suspend (hidden)', [r.status, r.body], [200, { code: 'BIZ777', name: 'Elite Qurilish', hiddenFromDirectory: true }]);
  r = await j('/api/admin/companies/BIZ777/status', { method: 'POST', cookie: cookie.admin, json: { hidden: false } });
  check('company activate', r.body.hiddenFromDirectory, false);
  r = await j('/api/admin/companies/BIZ777/status', { method: 'POST', cookie: cookie.admin, json: { status: 'suspended' } });
  check('company status:suspended alias', r.body.hiddenFromDirectory, true);
  r = await j('/api/admin/companies/VIP001/status', { method: 'POST', cookie: cookie.admin, json: { hidden: true } });
  check('company status on personal card 404', [r.status, r.body], [404, { error: 'not_found' }]);

  r = await j('/api/admin/companies/biz777/tier', { method: 'POST', cookie: cookie.admin, json: { tier: 'Gold' } });
  check('company tier set', [r.status, r.body, sqlite.prepare(`SELECT tier_override FROM cards WHERE code = 'BIZ777'`).get().tier_override], [200, { code: 'BIZ777', tierOverride: 'gold' }, 'gold']);
  r = await j('/api/admin/companies/BIZ777/tier', { method: 'POST', cookie: cookie.admin, json: { tier: 'platinum' } });
  check('company bad tier 422', [r.status, r.body], [422, { error: 'bad_tier' }]);
  r = await j('/api/admin/companies/BIZ777/tier', { method: 'POST', cookie: cookie.admin, json: { tier: null } });
  check('company tier auto (null)', [r.body, sqlite.prepare(`SELECT tier_override FROM cards WHERE code = 'BIZ777'`).get().tier_override], [{ code: 'BIZ777', tierOverride: null }, null]);
  r = await j('/api/admin/companies/VIP001/tier', { method: 'POST', cookie: cookie.admin, json: { tier: 'gold' } });
  check('company tier on personal card 404', r.status, 404);
  const detail = await j('/api/admin/companies/BIZ777', { cookie: cookie.admin });
  check('GET company (core) reflects hidden flag', [detail.status, detail.body.hiddenFromDirectory, detail.body.tierOverride], [200, true, null]);
}

// ---------- company-settings (super only) ----------
{
  let r = await j('/api/admin/company-settings/limits', { method: 'POST', cookie: cookie.admin, json: { kind: 'menu', tier: 'gold', cat: 5, item: 50, images: false } });
  check('limits set (flat body)', [r.status, r.body], [200, { kind: 'menu', tier: 'gold', limits: { cat: 5, item: 50, images: false } }]);
  r = await j('/api/admin/company-settings/limits', { method: 'POST', cookie: cookie.admin, json: { kind: 'product', tier: 'silver', limits: { cat: 2, item: 20 } } });
  check('limits set ({limits} body)', r.body, { kind: 'product', tier: 'silver', limits: { cat: 2, item: 20, images: true } });
  check('limits stored in admin_settings', [JSON.parse(sqlite.prepare(`SELECT value FROM admin_settings WHERE key = 'menu_limits'`).get().value), JSON.parse(sqlite.prepare(`SELECT value FROM admin_settings WHERE key = 'product_limits'`).get().value)],
    [{ gold: { cat: 5, item: 50, images: false } }, { silver: { cat: 2, item: 20, images: true } }]);
  r = await j('/api/admin/company-settings/limits', { method: 'POST', cookie: cookie.admin, json: { kind: 'menu', tier: 'diamond', cat: 1, item: 1 } });
  check('limits bad tier 422', [r.status, r.body], [422, { error: 'bad_input' }]);
  r = await j('/api/admin/company-settings/limits', { method: 'POST', cookie: cookie.admin, json: { kind: 'other', tier: 'gold', cat: 1, item: 1 } });
  check('limits bad kind 422', r.status, 422);
  let cs = await j('/api/admin/company-settings', { cookie: cookie.admin });
  check('GET company-settings (core) merges override', [cs.body.menuLimits.gold, cs.body.menuLimits.free.isCustom], [{ cat: 5, item: 50, images: false, isCustom: true }, false]);
  r = await j('/api/admin/company-settings/limits/menu/gold', { method: 'DELETE', cookie: cookie.admin });
  check('limits reset', [r.status, r.body], [200, { ok: true }]);
  cs = await j('/api/admin/company-settings', { cookie: cookie.admin });
  check('GET company-settings after reset → default', cs.body.menuLimits.gold, { cat: 8, item: 100, images: true, isCustom: false });
  r = await j('/api/admin/company-settings/limits/menu/diamond', { method: 'DELETE', cookie: cookie.admin });
  check('limits reset bad tier 422', r.status, 422);

  const tiers = [{ minQty: 1, maxQty: 9, pricePerUnit: 130000 }, { minQty: 10, maxQty: '', pricePerUnit: 90000 }];
  r = await j('/api/admin/company-settings/physical-pricing', { method: 'POST', cookie: cookie.admin, json: { tiers } });
  check('physical pricing set', [r.status, r.body], [200, { tiers: [{ minQty: 1, maxQty: 9, pricePerUnit: 130000 }, { minQty: 10, maxQty: null, pricePerUnit: 90000 }] }]);
  r = await j('/api/admin/company-settings/physical-pricing', { method: 'POST', cookie: cookie.admin, json: { tiers: [{ minQty: 5, maxQty: 2, pricePerUnit: 1 }] } });
  check('physical pricing bad tier 422', [r.status, r.body], [422, { error: 'bad_tier' }]);
  r = await j('/api/admin/company-settings/physical-pricing', { method: 'POST', cookie: cookie.admin, json: { tiers: [] } });
  check('physical pricing empty 422', [r.status, r.body], [422, { error: 'bad_input' }]);

  r = await j('/api/admin/company-settings/delivery', { method: 'POST', cookie: cookie.admin, json: { minDays: 2, maxDays: 4 } });
  check('delivery set', [r.status, r.body], [200, { minDays: 2, maxDays: 4 }]);
  r = await j('/api/admin/company-settings/delivery', { method: 'POST', cookie: cookie.admin, json: { minDays: 5, maxDays: 4 } });
  check('delivery bad 422', [r.status, r.body], [422, { error: 'bad_input' }]);
  cs = await j('/api/admin/company-settings', { cookie: cookie.admin });
  check('GET company-settings reflects pricing+delivery', [cs.body.physicalNfcTiers, cs.body.delivery], [[{ minQty: 1, maxQty: 9, pricePerUnit: 130000 }, { minQty: 10, maxQty: null, pricePerUnit: 90000 }], { minDays: 2, maxDays: 4 }]);

  const log = sqlite.prepare(`SELECT action FROM admin_activity_log ORDER BY id`).all().map((x) => x.action);
  for (const a of ['category_created', 'category_updated', 'category_deleted', 'card_verified', 'card_unverified', 'card_views_set', 'user_deleted', 'nfc_gift_created', 'payment_confirmed_manually', 'stats_exported', 'company_suspended', 'company_activated', 'company_tier_set', 'company_limits_changed', 'company_limits_reset', 'physical_nfc_pricing_changed', 'delivery_days_changed']) {
    checkTrue(`activity logged: ${a}`, log.includes(a));
  }
}

done();
