// KO'RGAZMA (Showcase, 2026-10) — API shartnomasi §3–§4.
//   * yaratish tekshiruvi (1..5 rasm, video yo'q, sarlavha ≤80, narx 0..1e10,
//     faqat https YouTube/Instagram havola, katalog mahsuloti faqat o'sha
//     kompaniyadan — shaxsiy postda e'tiborsiz);
//   * JSON maydonlari (showcase, title, priceUzs, linkUrl, catalogItem,
//     mediaUrls, pending) profil, kompaniya, lenta va post sahifasida;
//   * GET /api/showcase — faqat videosiz showcase=1 yoki rasmli reel, "qiziq
//     emas", reklama (featured: true);
//   * `catalog_item` shikoyati va admin o'chirishi (dalil arxivi bilan).
//   node scripts/test-showcase.mjs
import { setupSocial, cookie, makeChecker } from './lib/social-fixture.mjs';

const { check, checkTrue, done } = makeChecker();
const { sqlite, call, resetLimits } = await setupSocial();

const ITEM = 'b9fa1d77-794a-4b7a-b972-aecb1dce7c02';
const now = new Date().toISOString();
sqlite.prepare(`INSERT INTO company_catalog_items (id, company_id, name, price, promotion_price, image_url, available, created_at, updated_at)
  VALUES (?,?,?,?,?,?,?,?,?)`).run(ITEM, 'ACMEUZ', 'Qizil choynak', 150000, 125000, '/uploads/item1.jpg', 1, now, now);
sqlite.prepare(`INSERT INTO company_catalog_items (id, company_id, name, price, promotion_price, image_url, available, created_at, updated_at)
  VALUES (?,?,?,?,?,?,?,?,?)`).run('other-item-1', 'OTHERCO', 'Begona', 5000, null, '/uploads/item2.jpg', 1, now, now);

const post = (json, ck = cookie.user) => call('/api/records/VIP001/posts', { method: 'POST', cookie: ck, json: { agreed: true, ...json } });
const cpost = (json) => call('/api/companies/ACMEUZ/posts', { method: 'POST', cookie: cookie.user, json: { agreed: true, ...json } });
const SC = { showcase: true, mediaUrls: ['/uploads/sc1.jpg', '/uploads/sc2.png'], caption: 'tavsif', title: 'Choynak', priceUzs: 125000 };

// ═══ 1. Shaxsiy ko'rgazma posti ═══
let r = await post({ ...SC, linkUrl: 'https://youtu.be/abc123', imageSeconds: 7, catalogItemId: ITEM });
check('1) 201', r.status, 201);
const p1 = r.body;
check('1) fields', [p1.showcase, p1.title, p1.priceUzs, p1.linkUrl, p1.catalogItem, p1.imageSeconds, p1.pending],
  [true, 'Choynak', 125000, 'https://youtu.be/abc123', null, 7, false]);
check('1) mediaUrls', p1.mediaUrls, ['/uploads/sc1.jpg', '/uploads/sc2.png']);
check('1) first image = imageUrl', [p1.imageUrl, p1.videoUrl], ['/uploads/sc1.jpg', '']);
const extras = sqlite.prepare(`SELECT showcase, title, price_uzs, catalog_item_id, link_url, image_seconds FROM post_extras WHERE post_kind = 'post' AND post_id = ?`).get(p1.id);
check('1) stored (catalog ignored for personal)', { ...extras }, { showcase: 1, title: 'Choynak', price_uzs: 125000, catalog_item_id: null, link_url: 'https://youtu.be/abc123', image_seconds: 7 });

// ═══ 2. Tekshiruv ═══
const bad = async (label, json, err) => {
  const x = await post({ ...SC, ...json });
  check(`2) ${label}`, [x.status, x.body?.error], [422, err]);
};
await bad('6 images', { mediaUrls: [1, 2, 3, 4, 5, 6].map((i) => `/uploads/m${i}.jpg`) }, 'too_many_media');
await bad('no images', { mediaUrls: [] }, 'bad_media');
await bad('foreign url', { mediaUrls: ['https://evil.example/a.jpg'] }, 'bad_media');
await bad('video in mediaUrls', { mediaUrls: ['/uploads/a.jpg', '/uploads/story_x.mp4'] }, 'showcase_images_only');
await bad('videoUrl', { videoUrl: '/uploads/story_x.mp4' }, 'showcase_images_only');
await bad('title 81', { title: 'x'.repeat(81) }, 'bad_title');
await bad('price negative', { priceUzs: -1 }, 'bad_price');
await bad('price fraction', { priceUzs: 1.5 }, 'bad_price');
await bad('price too big', { priceUzs: 10_000_000_001 }, 'bad_price');
await bad('http link', { linkUrl: 'http://youtube.com/watch?v=1' }, 'bad_link');
await bad('other host', { linkUrl: 'https://evil.com/x' }, 'bad_link');
await bad('lookalike host', { linkUrl: 'https://youtube.com.evil.com/x' }, 'bad_link');
r = await post({ ...SC, title: 'x'.repeat(80), priceUzs: 10_000_000_000, linkUrl: 'https://www.instagram.com/p/xyz/' });
check('2) limits inclusive + instagram ok', [r.status, r.body?.priceUzs, r.body?.linkUrl], [201, 10_000_000_000, 'https://www.instagram.com/p/xyz/']);
r = await post({ ...SC, priceUzs: null, title: '', mediaUrls: ['/uploads/one.jpg'] });
check('2) no price/title, one image', [r.status, r.body?.priceUzs, r.body?.title, r.body?.mediaUrls], [201, null, null, ['/uploads/one.jpg']]);
resetLimits();

// ═══ 3. Kompaniya ko'rgazmasi + katalog ═══
r = await cpost({ ...SC, catalogItemId: ITEM });
check('3) company 201', r.status, 201);
const cp = r.body.post;
check('3) catalogItem', cp.catalogItem, { id: ITEM, companyId: 'ACMEUZ', name: 'Qizil choynak', priceUzs: 125000, image: '/uploads/item1.jpg' });
check('3) showcase fields', [cp.showcase, cp.title, cp.priceUzs, cp.pending], [true, 'Choynak', 125000, false]);
r = await cpost({ ...SC, catalogItemId: 'other-item-1' });
check('3) foreign catalog item -> 422', [r.status, r.body?.error], [422, 'bad_catalog_item']);
r = await cpost({ ...SC, catalogItemId: 'bad id!' });
check('3) bad id format -> 422', [r.status, r.body?.error], [422, 'bad_catalog_item']);
r = await cpost({ ...SC, catalogItemId: 123 });
check('3) unknown numeric id -> 422', r.status, 422);

// ═══ 4. JSON hamma joyda ═══
r = await call('/api/records/VIP001/posts', { cookie: cookie.other });
const lp = (r.body?.posts || []).find((p) => p.id === p1.id);
check('4) profile list fields', [lp?.showcase, lp?.title, lp?.priceUzs, lp?.linkUrl, lp?.catalogItem, lp?.pending, lp?.mediaUrls?.length],
  [true, 'Choynak', 125000, 'https://youtu.be/abc123', null, false, 2]);
r = await call('/api/companies/ACMEUZ/posts', { cookie: cookie.other });
const lc = (r.body?.posts || []).find((p) => p.id === cp.id);
check('4) company list catalogItem', lc?.catalogItem?.id, ITEM);
r = await call('/api/feed', { cookie: cookie.other });
const fp = (r.body?.feed || []).find((p) => p.id === cp.id && p.commentKind === 'company_post');
check('4) feed fields', [fp?.showcase, fp?.catalogItem?.name, fp?.mediaUrls?.length, fp?.pending], [true, 'Qizil choynak', 2, false]);
const plain = (r.body?.feed || []).find((p) => p.kind === 'post' && !p.showcase);
checkTrue('4) plain posts carry defaults', !plain || (plain.showcase === false && plain.catalogItem === null && Array.isArray(plain.mediaUrls)));
r = await call(`/post/${p1.id}`);
checkTrue('4) post page title + price', r.status === 200 && r.body.includes('Choynak') && r.body.includes('125 000 so\'m') && r.body.includes('https://youtu.be/abc123'));
r = await call(`/post/${cp.id}?company=1`);
checkTrue('4) company post page product link', r.status === 200 && r.body.includes('/company/acmeuz') && r.body.includes('Qizil choynak'));
// Mahsulot o'chirilsa — catalogItem null (yetim emas).
sqlite.prepare(`UPDATE company_catalog_items SET company_id = 'OTHERCO' WHERE id = ?`).run(ITEM);
r = await call('/api/companies/ACMEUZ/posts', { cookie: cookie.other });
check('4) moved item -> catalogItem null', (r.body?.posts || []).find((p) => p.id === cp.id)?.catalogItem, null);
sqlite.prepare(`UPDATE company_catalog_items SET company_id = 'ACMEUZ' WHERE id = ?`).run(ITEM);
resetLimits();

// ═══ 5. GET /api/showcase ═══
const vid = await post({ videoUrl: '/uploads/story_vid.mp4', caption: 'video' });
const reelImg = await post({ imageUrl: '/uploads/reel.jpg', reel: true });
const plainImg = await post({ imageUrl: '/uploads/plain.jpg' });
const more = [];
for (let i = 0; i < 5; i++) {
  const x = await call(`/api/records/${i % 2 ? 'OTH222' : 'VIP001'}/posts`, { method: 'POST', cookie: i % 2 ? cookie.other : cookie.user,
    json: { agreed: true, ...SC, title: `S${i}`, mediaUrls: [`/uploads/s${i}.jpg`] } });
  more.push(x.body?.id);
}
sqlite.prepare(`UPDATE posts SET created_at = datetime('now', '-1 hour')`).run();
sqlite.prepare(`UPDATE company_posts SET created_at = datetime('now', '-1 hour')`).run();
r = await call('/api/showcase?limit=20', { cookie: cookie.other });
check('5) 200 + shape', [r.status, Array.isArray(r.body?.items), typeof r.body?.hasMore, 'cursor' in r.body], [200, true, 'boolean', true]);
const ids = (r.body?.items || []).map((x) => `${x.commentKind}:${x.id}`);
checkTrue('5) showcase post included', ids.includes(`post:${p1.id}`));
checkTrue('5) company showcase included', ids.includes(`company_post:${cp.id}`));
checkTrue('5) image reel included', ids.includes(`post:${reelImg.body.id}`));
checkTrue('5) video excluded', !ids.includes(`post:${vid.body.id}`));
checkTrue('5) plain image excluded', !ids.includes(`post:${plainImg.body.id}`));
checkTrue('5) items carry showcase fields', (r.body?.items || []).every((x) => 'showcase' in x && 'mediaUrls' in x));
// Sahifalash — kursor bilan takror yo'q.
const p1page = await call('/api/showcase?limit=3', { cookie: cookie.other });
const p2page = await call(`/api/showcase?limit=3&cursor=${encodeURIComponent(p1page.body.cursor)}`, { cookie: cookie.other });
const a = p1page.body.items.map((x) => `${x.commentKind}:${x.id}`);
const b = p2page.body.items.map((x) => `${x.commentKind}:${x.id}`);
checkTrue('5) cursor paging, no overlap', p1page.body.hasMore && b.length > 0 && !b.some((k) => a.includes(k)));
// "Qiziq emas"
r = await call('/api/reels/hide', { method: 'POST', cookie: cookie.other, json: { kind: 'post', id: p1.id } });
check('5) hide ok', r.status, 200);
r = await call('/api/showcase?limit=20', { cookie: cookie.other });
checkTrue('5) hidden item gone', !(r.body?.items || []).some((x) => x.commentKind === 'post' && x.id === p1.id));
// Reklama — faqat ko'rgazma nishoni, `featured: true`.
const ts = (ms) => new Date(ms).toISOString().replace('T', ' ').replace('Z', '+00');
sqlite.prepare(`INSERT INTO featured_slots (user_id, target_kind, target_id, days, price, status, starts_at, ends_at, created_at)
  VALUES (2, 'post', ?, 1, 29000, 'active', ?, ?, ?)`).run(Number(more[1]), ts(Date.now() - 60_000), ts(Date.now() + 3_600_000), ts(Date.now() - 60_000));
sqlite.prepare(`INSERT INTO featured_slots (user_id, target_kind, target_id, days, price, status, starts_at, ends_at, created_at)
  VALUES (1, 'post', ?, 1, 29000, 'active', ?, ?, ?)`).run(Number(vid.body.id), ts(Date.now() - 60_000), ts(Date.now() + 3_600_000), ts(Date.now() - 60_000));
r = await call('/api/showcase?limit=10', { cookie: cookie.other });
const feat = (r.body?.items || []).filter((x) => x.featured).map((x) => x.id);
check('5) featured showcase ad mixed in, video ad not', feat, [more[1]]);

// ═══ 6. catalog_item shikoyati ═══
r = await call('/api/reports', { method: 'POST', cookie: cookie.other, json: { targetKind: 'catalog_item', targetId: ITEM, reason: 'spam' } });
check('6) report catalog_item 201', r.status, 201);
r = await call('/api/admin/reports?status=new', { cookie: cookie.admin });
const rep = (r.body?.reports || []).find((x) => x.targetKind === 'catalog_item');
check('6) admin preview', [rep?.preview?.text?.startsWith('Qizil choynak'), rep?.preview?.imageUrl, rep?.author?.code], [true, '/uploads/item1.jpg', 'ACMEUZ']);
r = await call(`/api/admin/content/catalog_item/${ITEM}`, { method: 'DELETE', cookie: cookie.user });
check('6) non-admin delete -> 401', r.status, 401);
r = await call(`/api/admin/content/catalog_item/${ITEM}`, { method: 'DELETE', cookie: cookie.admin, json: { reason: 'spam' } });
check('6) admin delete ok', r.body, { ok: true });
check('6) item gone', sqlite.prepare(`SELECT COUNT(*) AS n FROM company_catalog_items WHERE id = ?`).get(ITEM).n, 0);
const arch = sqlite.prepare(`SELECT kind, owner_kind, owner_id, image_url, body, deleted_by_admin FROM content_archive WHERE kind = 'catalog_item'`).get();
check('6) archived', [arch?.owner_kind, arch?.owner_id, arch?.image_url, String(arch?.body || '').startsWith(ITEM), String(arch?.deleted_by_admin || '').startsWith('admin#')],
  ['company', 'ACMEUZ', '/uploads/item1.jpg', true, true]);
check('6) report resolved', sqlite.prepare(`SELECT status FROM content_reports WHERE target_kind = 'catalog_item'`).get()?.status, 'resolved');
r = await call(`/api/admin/content/catalog_item/${ITEM}`, { method: 'DELETE', cookie: cookie.admin });
check('6) second delete alreadyGone', r.body, { ok: true, alreadyGone: true });

done();
