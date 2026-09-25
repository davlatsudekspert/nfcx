// "Ommabop" katalog tartibi va tovar ko'rishlari (2026-09-25).
//
// Ilova Asosiy sahifasidagi «Tanlovdan» qatori eng ko'p ko'rilgan
// tovarlarni boshida ko'rsatadi. Tekshiriladi:
//   * POST /api/catalog/items/:id/view — bir kishi bir kunda bir marta
//     sanaladi (qayta ochish reytingni ko'tarmaydi);
//   * noma'lum yoki faol bo'lmagan biznes tovari — 404, yozilmaydi;
//   * mehmonning xom IP manzili saqlanmaydi (faqat xesh);
//   * kirgan foydalanuvchi `u:<id>` — hisob o'chirilganda purge tozalaydi;
//   * sort=popular: mavjudlari oldin, keyin 30 kunlik ko'rishlar, keyin
//     yangisi; 30 kundan eski ko'rishlar hisobga olinmaydi;
//   * sort=new o'zgarmagan; GET 405; bir IP'dan ko'p ko'rish cheklanadi.
//
//   node scripts/test-catalog-popular.mjs

import worker, { ensureCoreSchema } from '../hosting/worker.js';
import { makeEnv, seedBasic, req, makeChecker } from './lib/d1-harness.mjs';
import { purgeStmts } from '../hosting/api/account-purge.js';

const { check, done } = makeChecker();

const { env, sqlite } = makeEnv({});
await ensureCoreSchema(env);
await seedBasic(env);

const get = (path, init = {}) => worker.fetch(req(path, init), env);
const json = async (path, init) => (await get(path, init)).json();
const view = (id, init = {}) => get(`/api/catalog/items/${id}/view`, { method: 'POST', ...init });

// Jadvallar hali yo'q: ommabop — bo'sh, 503 emas; ko'rish — 404.
{
  const r = await get('/api/catalog/feed?sort=popular');
  check('jadval yo‘q: popular 200', r.status, 200);
  check('jadval yo‘q: ko‘rish 404', (await view('item-1')).status, 404);
}

await get('/api/companies');
for (const [id, status] of [['SHOP', 'active'], ['WAIT', 'pending_review']]) {
  await env.DB.prepare(
    `INSERT INTO companies (company_id, owner_user_id, display_name, category, tier, price, status, city, created_at, updated_at)
       VALUES (?, '2', ?, 'shop', 'free', 0, ?, 'Toshkent', '2026-09-01', '2026-09-01')`
  ).bind(id, id, status).run();
}
const item = async (id, company, day, available = 1) => {
  const ts = `2026-09-${String(day).padStart(2, '0')}T10:00:00Z`;
  await env.DB.prepare(
    `INSERT INTO company_catalog_items (id, company_id, name, category, description, price, image_url, available, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, 'Boshqa', '', 1000, '/uploads/p.jpg', ?, 0, ?, ?)`
  ).bind(id, company, id, available, ts, ts).run();
};
await item('a', 'SHOP', 1);
await item('b', 'SHOP', 2);
await item('c', 'SHOP', 3);
await item('d', 'SHOP', 4);          // eng yangi, hech kim ko'rmagan
await item('off', 'SHOP', 5, 0);     // mavjud emas — ko'p ko'rilsa ham oxirida
await item('hidden', 'WAIT', 6);

// Ko'rishlar.
{
  check('noma’lum tovar 404', (await view('nope')).status, 404);
  check('moderatsiyadagi biznes tovari 404', (await view('hidden')).status, 404);
  check('GET 405', (await get('/api/catalog/items/a/view')).status, 405);

  const r = await view('a');
  check('ko‘rish 200', r.status, 200);
  check('ko‘rish javobi', await r.json(), { ok: true });
  await view('a'); await view('a');
  const count = (id) => sqlite.prepare(`SELECT COUNT(*) AS n FROM company_catalog_item_views WHERE item_id = ?`).get(id).n;
  check('bir kishi bir kunda — bitta', count('a'), 1);

  // Uchta boshqa mehmon "b" ni, ikkitasi "c" ni ko'radi.
  for (const ip of ['198.51.100.1', '198.51.100.2', '198.51.100.3']) await view('b', { ip });
  for (const ip of ['198.51.100.1', '198.51.100.2']) await view('c', { ip });
  // Kirgan foydalanuvchi — alohida kishi.
  await view('c', { cookie: 'nfc_session=user-token' });
  // "off" eng ko'p ko'rilgan, lekin mavjud emas.
  for (const ip of ['198.51.100.4', '198.51.100.5', '198.51.100.6', '198.51.100.7']) await view('off', { ip });

  const keys = sqlite.prepare(`SELECT visitor_key FROM company_catalog_item_views`).all().map((x) => x.visitor_key);
  check('xom IP saqlanmaydi', keys.some((k) => k.includes('198.51.100') || k.includes('203.0.113')), false);
  check('mehmon kaliti — xesh', keys.filter((k) => k.startsWith('v:')).every((k) => /^v:[0-9a-f]{64}$/.test(k)), true);
  check('kirgan foydalanuvchi kaliti', keys.filter((k) => k.startsWith('u:')), ['u:1']);
}

{
  const pop = await json('/api/catalog/feed?sort=popular');
  // b=3, c=3 (teng — yangisi oldin: c), a=1, d=0; off oxirida.
  check('popular tartib', pop.items.map((i) => i.id), ['c', 'b', 'a', 'd', 'off']);
  const neu = await json('/api/catalog/feed?sort=new');
  check('sort=new o‘zgarmagan', neu.items.map((i) => i.id), ['d', 'c', 'b', 'a', 'off']);
  const lim = await json('/api/catalog/feed?sort=popular&limit=2');
  check('popular + limit', [lim.items.map((i) => i.id), lim.hasMore], [['c', 'b'], true]);
}

// 30 kundan eski ko'rishlar hisobga olinmaydi.
{
  const old = new Date(Date.now() - 45 * 86_400_000).toISOString().slice(0, 10);
  for (let k = 0; k < 10; k += 1) {
    await env.DB.prepare(`INSERT INTO company_catalog_item_views (item_id, visitor_key, view_day, created_at) VALUES ('d', ?, ?, ?)`)
      .bind(`v:old${k}`, old, `${old}T00:00:00Z`).run();
  }
  const pop = await json('/api/catalog/feed?sort=popular');
  check('eski ko‘rishlar hisobga olinmaydi', pop.items.map((i) => i.id), ['c', 'b', 'a', 'd', 'off']);
}

// Bir IP'dan soatiga 120 tadan ortig'i yozilmaydi (UA almashtirilsa ham).
{
  for (let k = 0; k < 125; k += 1) {
    await view('a', { ip: '192.0.2.9', headers: { 'user-agent': `bot-${k}` } });
  }
  const n = sqlite.prepare(`SELECT COUNT(*) AS n FROM company_catalog_item_views WHERE item_id = 'a'`).get().n;
  check('IP cheklovi: 1 + 120 dan oshmaydi', n, 121);
}

// Purge: foydalanuvchining ko'rishlari va o'chirilgan biznes tovarlarining ko'rishlari.
{
  const has = (sql) => sqlite.prepare(sql).get().n;
  const cfg = {
    tables: new Set(sqlite.prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`).all().map((x) => x.name)),
    cols: new Set(), flags: {},
  };
  const stmts = purgeStmts(env, { id: 1, deleted_at: '2026-08-01T00:00:00Z', deletion_source: 'app' }, '2026-09-25T00:00:00Z', 'ref-1', cfg);
  const sqls = stmts.map((s) => s._sql);
  check('purge: foydalanuvchi ko‘rishlari', sqls.some((s) => s.includes(`company_catalog_item_views WHERE visitor_key = 'u:1'`)), true);
  const stmts2 = purgeStmts(env, { id: 2, deleted_at: '2026-08-01T00:00:00Z', deletion_source: 'app' }, '2026-09-25T00:00:00Z', 'ref-2', cfg);
  for (const s of stmts2.filter((x) => x._sql.includes('company_catalog_item_views'))) s._runSync();
  check('purge: biznes egasi o‘chsa — tovar ko‘rishlari ham', has(`SELECT COUNT(*) AS n FROM company_catalog_item_views WHERE item_id IN ('a','b','c','d','off')`), 0);
}

done();
