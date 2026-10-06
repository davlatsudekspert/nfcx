// REELS "SIZ UCHUN": GET /api/reels va POST /api/reels/hide (api/reels.js).
//
// Tekshiriladi: faqat reels (video yoki rasmli reel belgisi; oddiy rasm va
// istoriya yo'q); yangisi eskisidan, faolligi yuqori biroz yangidan oldin;
// obuna, ko'rilgan va o'zining reels'i koeffitsientlari; "qiziq emas"
// (401 / 422 / idempotent / chiqmaydi); bloklangan muallif va rejadagi post
// yo'q; xilma-xillik (qo'shni emas, sahifada ≤ 2); kursor bilan barqaror
// sahifalash (takror yo'q, tushib qolish yo'q, suratdan keyingi reels
// zanjirda chiqmaydi); buzuq kursor; reklama faqat 4/9-o'rinda va zanjirda
// bir marta; mehmon; kadr shakli `/api/feed` bilan bir xil.
//
//   node scripts/test-reels-ranking.mjs
//   UZ_ADAPTER_TEST=1 node scripts/test-reels-ranking.mjs
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { setupSocial, cookie, makeChecker } from './lib/social-fixture.mjs';
import { ensureMusic } from '../hosting/api/music.js';

const { check, checkTrue, done } = makeChecker();
const { env, sqlite, call, resetLimits } = await setupSocial();
const run = (sql, ...a) => sqlite.prepare(sql).run(...a);

// Qo'shimcha mualliflar: user#3..#14, kartalar A03..A14.
const AUTH = [];
for (let i = 3; i <= 14; i++) {
  const code = `A${String(i).padStart(2, '0')}`;
  run(`INSERT INTO users (id, email, password_hash, phone) VALUES (?, ?, 'x', ?)`, i, `u${i}@test.local`, `+9989000000${String(i).padStart(2, '0')}`);
  run(`INSERT INTO cards (code, name, price, ts, user_id, profile_type) VALUES (?, ?, 0, 1000, ?, 'personal')`, code, `Muallif ${i}`, i);
  AUTH.push(code);
}
run(`INSERT INTO sessions (token, user_id, expires_at) VALUES ('third-token', 3, '2999-01-01T00:00:00.000Z')`);
const third = 'nfc_session=third-token';

// Sxema: lenta (post ustunlari) va reels (post_extras, reel_hidden, featured).
check('0) lenta ochiladi', (await call('/api/feed')).status, 200);
// Musiqa jadvali (production'da bor) — `reel` belgisi shu JOIN orqali o'qiladi.
await ensureMusic(env);
check('0) reels ochiladi (bo‘sh)', (await call('/api/reels')).body, { items: [], nextCursor: null, hasMore: false });

const H = 3600e3;
const postsTs = (ms) => new Date(ms).toISOString().slice(0, 19).replace('T', ' ');
const viewTs = (ms) => new Date(ms).toISOString().replace('T', ' ').replace('Z', '+00');
const ago = (h) => Date.now() - h * H;
const owner = (code) => (code === 'VIP001' || code === 'BIZ777' ? 1 : code === 'OTH222' ? 2 : Number(code.slice(1)));
let nextId = 1;
const addPost = (code, hours, { video = true, caption = '', publishAt = null } = {}) => {
  const id = nextId++;
  run(`INSERT INTO posts (id, code, user_id, image_url, video_url, caption, created_at, publish_at) VALUES (?,?,?,?,?,?,?,?)`,
    id, code, owner(code), '/uploads/i.jpg', video ? '/uploads/v.mp4' : null, caption || `p${id}`, postsTs(ago(hours)), publishAt);
  return id;
};
const addCPost = (company, hours, { video = true, caption = '' } = {}) => {
  const r = run(`INSERT INTO company_posts (company_id, image_url, video_url, caption, created_at) VALUES (?,?,?,?,?)`,
    company, '/uploads/c.jpg', video ? '/uploads/c.mp4' : null, caption || 'c', new Date(ago(hours)).toISOString());
  return Number(r.lastInsertRowid);
};
const reelFlag = (kind, id) => run(`INSERT INTO post_extras (post_kind, post_id, music_id, music_start, reel, image_seconds, created_at) VALUES (?, ?, NULL, 0, 1, 10, ?)`, kind, id, new Date().toISOString());
const saveN = (kind, id, n, hours = 1) => {
  for (let u = 0; u < n; u++) run(`INSERT INTO user_saves (user_id, kind, ref, created_at) VALUES (?, ?, ?, ?)`, 500 + u, kind, String(id), new Date(ago(hours)).toISOString());
};
const view = (kind, id, viewer, hours = 1) => run(`INSERT INTO content_views (target_kind, target_id, viewer, created_at) VALUES (?, ?, ?, ?)`, kind, id, viewer, viewTs(ago(hours)));
const reset = () => {
  for (const t of ['posts', 'company_posts', 'stories', 'post_likes', 'content_likes', 'content_comments', 'content_views', 'content_view_hits',
    'user_saves', 'follows', 'company_follows', 'reel_hidden', 'featured_slots', 'post_extras', 'user_blocks']) {
    // Ba'zi jadvallar birinchi chaqiruvda yaratiladi (masalan bloklar).
    try { run(`DELETE FROM ${t}`); } catch (e) { if (!/no such table/.test(String(e?.message))) throw e; }
  }
  resetLimits();
};
const reels = (ck, q = '') => call(`/api/reels${q}`, ck ? { cookie: ck } : {});
const keysOf = (r) => (r.body.items || []).map((p) => `${p.commentKind}:${p.id}`);
const idx = (r, kind, id) => keysOf(r).indexOf(`${kind}:${id}`);
const walk = async (ck, limit, between) => {
  const pages = [];
  let cursor = null;
  for (let n = 0; n < 50; n++) {
    const r = await reels(ck, `?limit=${limit}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
    if (r.status !== 200) throw new Error(`reels ${r.status} ${JSON.stringify(r.body)}`);
    pages.push(r.body);
    if (between) await between(n, r.body);
    if (!r.body.hasMore) break;
    cursor = r.body.nextCursor;
  }
  return pages;
};

// ── 1) Faqat reels ──────────────────────────────────────────────────
reset();
const v1 = addPost('A03', 2, { caption: 'video' });
const photo = addPost('A04', 1, { video: false, caption: 'rasm' });
const imgReel = addPost('A05', 3, { video: false, caption: 'rasmli reel' });
reelFlag('post', imgReel);
const cv = addCPost('OTHERCO', 4, { caption: 'biznes video' });
const cImg = addCPost('OTHERCO', 5, { video: false, caption: 'biznes rasm' });
run(`INSERT INTO stories (owner_kind, owner_id, image_url, video_url, caption, created_at, expires_at) VALUES ('card', 'A06', '/uploads/s.jpg', '/uploads/s.mp4', 'istoriya', ?, ?)`,
  viewTs(ago(1)), viewTs(Date.now() + 20 * H));
let r = await reels(null);
check('1) mehmon: 200', r.status, 200);
check('1) faqat reels: video, rasmli reel, biznes video', keysOf(r).sort(),
  [`company_post:${cv}`, `post:${imgReel}`, `post:${v1}`].sort());
checkTrue('1) oddiy rasm va istoriya yo‘q', idx(r, 'post', photo) < 0 && idx(r, 'company_post', cImg) < 0 && r.body.items.every((p) => p.kind === 'post'));
check('1) rasmli reel belgisi', r.body.items.find((p) => p.id === imgReel)?.reel, true);
check('1) oxiri: hasMore=false, nextCursor=null', [r.body.hasMore, r.body.nextCursor], [false, null]);
// Kadr shakli /api/feed bilan bir xil (kirgan tomoshabin).
r = await reels(cookie.user);
const feed = await call('/api/feed', { cookie: cookie.user });
for (const k of [`post:${v1}`, `post:${imgReel}`, `company_post:${cv}`]) {
  const a = r.body.items.find((p) => `${p.commentKind}:${p.id}` === k);
  const b = feed.body.feed.find((p) => `${p.commentKind}:${p.id}` === k);
  check(`1) shakl kalitlari = /api/feed (${k})`, Object.keys(a || {}).sort(), Object.keys(b || { x: 1 }).sort());
}
// limit chegaralari
check('1) limit=0 -> 1 ta', (await reels(null, '?limit=0')).body.items.length, 1);
check('1) limit=abc -> standart', (await reels(null, '?limit=abc')).body.items.length, 3);

// ── 2) Yangilik va faollik ──────────────────────────────────────────
reset();
const fresh = addPost('A03', 1);
const old = addPost('A04', 200);
r = await reels(null);
checkTrue('2) teng faollikda yangisi eskisidan oldin', idx(r, 'post', fresh) < idx(r, 'post', old));
reset();
const busy = addPost('A03', 4);
const quiet = addPost('A04', 2);
saveN('post', busy, 20);
run(`INSERT INTO content_comments (target_kind, target_id, user_id, author_code, body, created_at) VALUES ('post', ?, 3, 'A03', 'zo‘r', ?)`, busy, viewTs(ago(1)));
r = await reels(null);
checkTrue('2) faolligi yuqori biroz yangidan oldin', idx(r, 'post', busy) === 0 && idx(r, 'post', quiet) === 1);

// ── 3) Obuna koeffitsienti ──────────────────────────────────────────
reset();
const near = addPost('A03', 5);
const followedP = addPost('A04', 10);
const cFollowed = addCPost('OTHERCO', 10);
r = await reels(null);
checkTrue('3) mehmonda yangisi oldin', idx(r, 'post', near) === 0);
run(`INSERT INTO follows (follower_id, followee_id, created_at) VALUES (1, 4, ?)`, postsTs(ago(48)));
run(`INSERT INTO company_follows (company_id, user_id, created_at) VALUES ('OTHERCO', 1, ?)`, new Date(ago(48)).toISOString());
r = await reels(cookie.user);
checkTrue('3) obuna bo‘lingan odam va kompaniya oldinga chiqdi',
  idx(r, 'post', near) === 2 && [idx(r, 'post', followedP), idx(r, 'company_post', cFollowed)].sort().join() === '0,1');

// ── 4) Ko'rilgan jarima ─────────────────────────────────────────────
reset();
const seenP = addPost('A03', 2);
const unseen = addPost('A04', 8);
r = await reels(cookie.user);
checkTrue('4) hali ko‘rilmagan: yangisi oldin', idx(r, 'post', seenP) === 0);
view('post', seenP, 'u:1');
r = await reels(cookie.user);
checkTrue('4) ko‘rilgan reels pastga tushdi', idx(r, 'post', seenP) === 1 && idx(r, 'post', unseen) === 0);
checkTrue('4) boshqa tomoshabinga ta’sir qilmaydi', idx(await reels(cookie.other), 'post', seenP) === 0);
// Mehmon kaliti — comments.js `contentViewerKey` (IP|UA|til hash).
const guestKey = `a:${createHash('sha256').update('203.0.113.5||').digest('hex')}`;
view('post', seenP, guestKey);
checkTrue('4) mehmon ko‘rgani ham hisobga olinadi', idx(await reels(null), 'post', seenP) === 1);

// ── 5) O'zining reels'i ─────────────────────────────────────────────
reset();
const mineP = addPost('VIP001', 2);
const othersP = addPost('A03', 6);
checkTrue('5) o‘ziniki pastroq', idx(await reels(cookie.user), 'post', mineP) === 1);
checkTrue('5) boshqaga oddiy', idx(await reels(cookie.other), 'post', mineP) === 0);
checkTrue('5) o‘ziniki baribir bor', idx(await reels(cookie.user), 'post', othersP) === 0);

// ── 6) "Qiziq emas" ─────────────────────────────────────────────────
reset();
const h1 = addPost('A03', 1);
const h2 = addPost('A04', 2);
const hc = addCPost('OTHERCO', 3);
const hide = (ck, json) => call('/api/reels/hide', { method: 'POST', cookie: ck, json });
check('6) mehmon: 401', (await hide(null, { kind: 'post', id: h1 })).status, 401);
for (const bad of [{ kind: 'story', id: h1 }, { kind: 'post', id: 0 }, { kind: 'post', id: -3 }, { kind: 'post', id: 'abc' }, { kind: 'post', id: 1.5 }, {}]) {
  const x = await hide(cookie.user, bad);
  check(`6) yomon nishon 422 ${JSON.stringify(bad)}`, [x.status, x.body?.error], [422, 'bad_target']);
}
check('6) GET /api/reels/hide -> 405', (await call('/api/reels/hide')).status, 405);
check('6) POST /api/reels -> 405', (await call('/api/reels', { method: 'POST', cookie: cookie.user, json: {} })).status, 405);
let x = await hide(cookie.user, { kind: 'post', id: h1 });
check('6) yashirildi', [x.status, x.body], [200, { ok: true }]);
x = await hide(cookie.user, { kind: 'post', id: h1 });
check('6) takroriy — idempotent', [x.status, x.body], [200, { ok: true }]);
check('6) bitta qator', sqlite.prepare(`SELECT COUNT(*) AS n FROM reel_hidden WHERE user_id = 1`).get().n, 1);
check('6) kompaniya posti ham', (await hide(cookie.user, { kind: 'company_post', id: hc })).status, 200);
r = await reels(cookie.user);
check('6) yashirilganlar chiqmaydi', keysOf(r), [`post:${h2}`]);
check('6) boshqa odamga chiqadi', keysOf(await reels(cookie.other)).length, 3);

// ── 7) Bloklangan muallif, rejadagi post ────────────────────────────
reset();
const b1 = addPost('A03', 1);
const b2 = addPost('A04', 2);
const later = addPost('A05', 0, { publishAt: postsTs(Date.now() + 2 * H) });
check('7) blok', (await call('/api/blocks', { method: 'POST', cookie: cookie.user, json: { kind: 'record', id: 'A03' } })).status, 200);
check('7) bloklangan muallif yo‘q', keysOf(await reels(cookie.user)), [`post:${b2}`]);
check('7) mehmonga chiqadi, rejadagi esa hech kimga', keysOf(await reels(null)).sort(), [`post:${b1}`, `post:${b2}`].sort());
checkTrue('7) rejadagi post yo‘q', idx(await reels(cookie.other), 'post', later) < 0);

// ── 8) Xilma-xillik ─────────────────────────────────────────────────
reset();
const all8 = [];
for (let i = 0; i < 6; i++) all8.push(addPost('A03', 1 + i * 0.1)); // A03 — eng yangi 6 ta
for (const code of AUTH.slice(1, 10)) for (let j = 0; j < 2; j++) all8.push(addPost(code, 5 + j));
const pages8 = await walk(cookie.user, 10);
let consecutive = 0;
let over = 0;
for (const pg of pages8) {
  const authors = pg.items.map((p) => p.code);
  authors.forEach((a, i) => { if (i && authors[i - 1] === a) consecutive++; });
  const cnt = {};
  for (const a of authors) cnt[a] = (cnt[a] || 0) + 1;
  if (Object.values(cnt).some((n) => n > 2)) over++;
}
check('8) sahifalar soni', pages8.map((p) => p.items.length), [10, 10, 4]);
check('8) bir muallif qo‘shni o‘rinda emas', consecutive, 0);
check('8) sahifada bir muallifdan ≤ 2', over, 0);
check('8) hammasi chiqdi, takrorsiz', pages8.flatMap((p) => p.items.map((i) => i.id)).sort((a, b) => a - b), all8.slice().sort((a, b) => a - b));
check('8) 1-sahifa eng yangi muallifdan boshlanadi', pages8[0].items[0].code, 'A03');

// ── 9) Barqaror sahifalash ──────────────────────────────────────────
reset();
const elig = [];
for (let i = 0; i < 14; i++) elig.push(`post:${addPost(AUTH[i % 12], 1 + i)}`);
for (let i = 0; i < 3; i++) elig.push(`company_post:${addCPost(i % 2 ? 'OTHERCO' : 'ACMEUZ', 2 + i * 3)}`);
let pages = await walk(cookie.other, 4);
let got = pages.flatMap((p) => p.items.map((i) => `${i.commentKind}:${i.id}`));
check('9) takror yo‘q', got.length, new Set(got).size);
check('9) hamma reels bor', got.slice().sort(), elig.slice().sort());
checkTrue('9) oxirgidan boshqa sahifalar to‘la', pages.slice(0, -1).every((p) => p.items.length === 4 && p.hasMore && typeof p.nextCursor === 'string'));
check('9) oxirgi sahifa', [pages.at(-1).hasMore, pages.at(-1).nextCursor], [false, null]);

// Zanjir o'rtasida: yangi reels, ko'rish, layk, "qiziq emas" va o'chirish.
const firstPageKeys = new Set();
let newId = null;
let hiddenKey = null;
let deletedKey = null;
pages = await walk(cookie.other, 4, async (n, body) => {
  if (n !== 0) return;
  body.items.forEach((i) => firstPageKeys.add(`${i.commentKind}:${i.id}`));
  newId = addPost('A12', 0, { caption: 'surat keyin' });
  const rest = elig.filter((k) => !firstPageKeys.has(k));
  // Keyingi sahifadagi biriga ko'rish va layk (suratdan keyin) — tartib siljimasin.
  const [vk, vid] = rest[0].split(':');
  run(`INSERT INTO content_views (target_kind, target_id, viewer, created_at) VALUES (?, ?, 'u:2', ?)`, vk, Number(vid), viewTs(Date.now()));
  saveN(vk, Number(vid), 30, 0);
  hiddenKey = rest[1];
  const [hk, hid] = hiddenKey.split(':');
  check('9) zanjir o‘rtasida yashirish', (await hide(cookie.other, { kind: hk, id: Number(hid) })).status, 200);
  // Allaqachon ko'rsatilgan oxirgi kadr o'chiriladi — langar.
  deletedKey = `${body.items.at(-1).commentKind}:${body.items.at(-1).id}`;
  const [dk, did] = deletedKey.split(':');
  run(dk === 'post' ? `DELETE FROM posts WHERE id = ?` : `DELETE FROM company_posts WHERE id = ?`, Number(did));
});
got = pages.flatMap((p) => p.items.map((i) => `${i.commentKind}:${i.id}`));
check('9) zanjir: takror yo‘q', got.length, new Set(got).size);
checkTrue('9) suratdan keyingi reels zanjirda yo‘q', !got.includes(`post:${newId}`));
check('9) zanjir: yashirilgandan boshqa hammasi (hech biri tushib qolmadi)', got.slice().sort(), elig.filter((k) => k !== hiddenKey).sort());
// Surat — so'rovdan oldingi soniya; yangi reels'ni 2 s oldinga suramiz.
run(`UPDATE posts SET created_at = ? WHERE id = ?`, postsTs(Date.now() - 2000), newId);
checkTrue('9) yangi so‘rovda yangi reels bor', idx(await reels(cookie.other, '?limit=20'), 'post', newId) >= 0);
void deletedKey;

// ── 10) Buzuq kursor ────────────────────────────────────────────────
// Yangilik bali so'rov soniyasiga bog'liq: soniya chegarasida deyarli teng
// ikki reels o'rin almashishi mumkin. Shuning uchun buzuq kursorli javob
// undan OLDINGI yoki KEYINGI kursorsiz 1-sahifaning biri bilan bir xil
// bo'lishi kerak (ikkalasi bir soniyada bo'lsa — ikkalasi bir xil).
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
for (const bad of ['%%%', 'abc', 'x'.repeat(5000), b64({ v: 1, s: 'x' }), b64({ v: 2 }), b64([1, 2]),
  b64({ v: 1, s: Date.now() - 30 * 86400e3, o: 0, w: 5, k: [], a: [], x: [] }),
  b64({ v: 1, s: Date.now(), o: 5, w: 5, k: ['story:1'], a: [], x: [] }),
  b64({ v: 1, s: Date.now(), o: 1e9, w: 5, k: [], a: [], x: [] })]) {
  const before = keysOf(await reels(cookie.other, '?limit=5'));
  r = await reels(cookie.other, `?limit=5&cursor=${encodeURIComponent(bad)}`);
  const after = keysOf(await reels(cookie.other, '?limit=5'));
  const got10 = JSON.stringify(keysOf(r));
  checkTrue(`10) buzuq kursor -> 1-sahifa (${bad.slice(0, 16)})`,
    r.status === 200 && (got10 === JSON.stringify(before) || got10 === JSON.stringify(after)));
}

// ── 11) Reklama: 4 va 9-o'rinda, zanjirda bir marta ─────────────────
reset();
const nowTs = viewTs(Date.now());
const until = viewTs(Date.now() + 10 * H);
const organic = [];
for (let i = 0; i < 22; i++) organic.push(`post:${addPost(AUTH[i % 12], 1 + i)}`);
const ads = [addPost('OTH222', 300), addPost('OTH222', 301), addPost('VIP001', 302)].map((id) => `post:${id}`);
const photoAd = addPost('OTH222', 1, { video: false });
const slot = (kind, id) => run(`INSERT INTO featured_slots (user_id, target_kind, target_id, days, price, status, starts_at, ends_at, created_at)
  VALUES (2, ?, ?, 1, 29000, 'active', ?, ?, ?)`, kind, id, nowTs, until, nowTs);
for (const k of ads) slot('post', Number(k.split(':')[1]));
slot('post', photoAd);
// Reklama ham oddiy tartibda bo'lardi (yangi, faol) — u yerda takrorlanmasin.
saveN('post', Number(ads[0].split(':')[1]), 50);
pages = await walk(third, 10);
const adPos = pages.map((p) => p.items.map((it, i) => (it.featured ? i : -1)).filter((i) => i >= 0));
check('11) reklama o‘rinlari (sahifa bo‘yicha)', adPos, [[4, 9], [4], []]);
const featuredKeys = pages.flatMap((p) => p.items.filter((i) => i.featured).map((i) => `${i.commentKind}:${i.id}`));
check('11) har reklama bir marta', featuredKeys.slice().sort(), ads.slice().sort());
got = pages.flatMap((p) => p.items.map((i) => `${i.commentKind}:${i.id}`));
check('11) takror yo‘q (reklama oddiy kadr bo‘lib qaytmaydi)', got.length, new Set(got).size);
checkTrue('11) rasmli (reels emas) reklama yo‘q', !got.includes(`post:${photoAd}`));
check('11) oddiy reels hammasi bor', got.filter((k) => !ads.includes(k)).sort(), organic.slice().sort());
checkTrue('11) 0-o‘rinda reklama yo‘q', pages.every((p) => !p.items[0]?.featured));
// limit=3 — 4-o'rin yo'q, reklama ham yo'q.
check('11) kichik sahifada reklama yo‘q', (await reels(third, '?limit=3')).body.items.filter((i) => i.featured).length, 0);
// Bloklangan muallifning reklamasi ham chiqmaydi.
await call('/api/blocks', { method: 'POST', cookie: third, json: { kind: 'record', id: 'OTH222' } });
r = await reels(third);
check('11) bloklangan muallif reklamasi yo‘q', r.body.items.filter((i) => i.featured).map((i) => i.code), ['VIP001']);
check('11) mehmonga reklama ham', (await reels(null)).body.items.filter((i) => i.featured).length, 2);

// ── 12) To'lqinlar (UZ adapteri, alohida jarayon — scripts/lib/wave-probe.mjs) ──
// Mehmon: nomzodlar → sanoqlar → sahifa shakli = 3 HTTP. Kirgan: sessiya
// so'rovi token xeshidan keyin ALOHIDA HTTP bo'lib ketadi, lekin nomzodlar
// bilan PARALLEL (ketma-ket chuqurlik baribir 3) — lentadagi kabi (+1).
{
  const probe = fileURLToPath(new URL('./lib/wave-probe.mjs', import.meta.url));
  const out = execFileSync(process.execPath, [probe], { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
  const w = JSON.parse(out.slice(out.lastIndexOf('@@') + 2));
  check('12) /api/reels mehmon: 3 HTTP, 200', [w['/api/reels anon']?.status, w['/api/reels anon']?.waves], [200, 3]);
  check('12) /api/reels kirgan: 4 HTTP, 200', [w['/api/reels t1']?.status, w['/api/reels t1']?.waves], [200, 4]);
}

done();
