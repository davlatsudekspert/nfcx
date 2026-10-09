// NFCSTORE Ko'rgazma namunalari (api/showcase-samples.js) — BIR MARTA.
//   * kompaniya yoki katalog mahsuloti yo'q — hech narsa yozilmaydi, belgi yo'q;
//   * hammasi bor — 3 ta ko'rgazma (rasm, sarlavha, havola, katalog, musiqa);
//   * qayta chaqiruv / yangi isolate — dublikat yo'q;
//   * GET /api/showcase ularni ko'rsatadi (narxsiz, catalogItem bilan).
//   node scripts/test-showcase-samples.mjs
import { setupSocial, makeChecker } from './lib/social-fixture.mjs';
import { seedShowcaseSamples, SAMPLES, SAMPLES_COMPANY, SHOWCASE_SAMPLES_MIGRATION } from '../hosting/api/showcase-samples.js';

const { check, checkTrue, done } = makeChecker();
const { env, sqlite, call, addCompany } = await setupSocial();

// 1) Kompaniya yo'q — hech narsa.
let r = await seedShowcaseSamples(env);
check('1) no company', [r.applied, r.reason], [false, 'no_company']);
const migRows = () => sqlite.prepare(`SELECT COUNT(*) AS n FROM app_migrations WHERE name = ?`).get(SHOWCASE_SAMPLES_MIGRATION).n;
check('1) no marker', migRows(), 0);

// 2) Kompaniya bor, katalog yo'q — hech narsa.
addCompany(SAMPLES_COMPANY, 1, { name: 'NFCSTORE' });
r = await seedShowcaseSamples(env);
check('2) no catalog item', [r.applied, r.reason], [false, 'no_catalog_item']);
check('2) no posts', sqlite.prepare(`SELECT COUNT(*) AS n FROM company_posts WHERE company_id = ?`).get(SAMPLES_COMPANY).n, 0);

// 3) Hammasi bor.
const now = new Date().toISOString();
for (const s of SAMPLES) {
  sqlite.prepare(`INSERT INTO company_catalog_items (id, company_id, name, price, image_url, available, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?)`).run(s.catalogItemId, SAMPLES_COMPANY, s.title, 0, s.mediaUrls[0], 1, now, now);
}
r = await seedShowcaseSamples(env);
check('3) applied', [r.applied, r.created?.length], [true, 3]);
const posts = sqlite.prepare(`SELECT cp.id, cp.image_url, cp.media_json, cp.video_url, pe.showcase, pe.title, pe.price_uzs, pe.link_url, pe.catalog_item_id
  FROM company_posts cp JOIN post_extras pe ON pe.post_kind = 'company_post' AND pe.post_id = cp.id
  WHERE cp.company_id = ? ORDER BY cp.id`).all(SAMPLES_COMPANY);
check('3) 3 showcase posts', posts.length, 3);
checkTrue('3) all showcase, no video, no price', posts.every((p) => p.showcase === 1 && !p.video_url && p.price_uzs == null));
checkTrue('3) links own channels', posts.every((p) => /^https:\/\/www\.(youtube\.com\/shorts|instagram\.com)\//.test(p.link_url)));
checkTrue('3) 1..5 images each', posts.every((p) => { const m = JSON.parse(p.media_json); return m.length >= 1 && m.length <= 5 && m[0].url === p.image_url; }));
check('3) marker set', migRows(), 1);

// 4) Qayta — dublikat yo'q (shu isolate va "yangi isolate").
r = await seedShowcaseSamples(env);
check('4) cached', r.applied, false);
r = await seedShowcaseSamples({ ...env, DB: env.DB });
check('4) still once', sqlite.prepare(`SELECT COUNT(*) AS n FROM company_posts WHERE company_id = ?`).get(SAMPLES_COMPANY).n, 3);

// 5) Lentada.
// Bir muallif bir sahifada 2 tadan ko'p turmaydi (reels.js AUTHOR_MAX_PER_PAGE) —
// sahifalab yig'amiz.
const all = [];
let cursor = '';
for (let page = 0; page < 5; page += 1) {
  r = await call(`/api/showcase?limit=10${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
  check(`5) page ${page} 200`, r.status, 200);
  all.push(...(r.body.items || []));
  cursor = r.body.nextCursor || r.body.cursor || '';
  if (!r.body.hasMore || !cursor) break;
}
const mine = all.filter((it) => SAMPLES.some((s) => s.title === it.title));
check('5) 3 in feed', mine.length, 3);
checkTrue('5) catalogItem + linkUrl + mediaUrls', mine.every((it) => it.catalogItem && it.catalogItem.companyId === SAMPLES_COMPANY && it.linkUrl && it.mediaUrls.length >= 3 && it.priceUzs == null));

// 6) Egasi o'chirsa — qaytib yaratilmaydi.
sqlite.prepare(`DELETE FROM company_posts WHERE company_id = ?`).run(SAMPLES_COMPANY);
await call('/api/showcase?limit=10');
check('6) not recreated', sqlite.prepare(`SELECT COUNT(*) AS n FROM company_posts WHERE company_id = ?`).get(SAMPLES_COMPANY).n, 0);

done();
