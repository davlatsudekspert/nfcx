// O'CHIRILGAN HISOBNING PROFILI VA KONTENTI OMMAGA CHIQMAYDI.
//
// NIMA UCHUN BU TEST BOR (egasining uch marta takrorlangan xabari):
// "admin paneldan o'chirdim, profil ham, storysi ham baribir Reels'da
// turibdi".
//
// Sabab: admin "foydalanuvchini o'chirish" — YUMSHOQ o'chirish
// (`users.deleted_at`), qator esa buyurtma/to'lov tarixi uchun ataylab
// qoladi. Ommaviy so'rovlarning BIRORTASI ham bu belgini tekshirmasdi:
// profil, reels, katalog, qidiruv, obunachilar — hammasi `cards` bilan
// ishlardi va karta qatori joyida edi.
//
// Bu test aynan shu holatni qayta yaratadi: avval hamma joyda
// KO'RINISHINI tekshiradi (aks holda test o'zi hech narsa isbotlamay
// "yashil" bo'lardi), keyin hisobni o'chiradi va YO'QOLISHINI
// tekshiradi.
//
//   node scripts/test-deleted-user-content.mjs
import worker from '../hosting/worker.js';
import { makeEnv, seedBasic, cookie, req, makeChecker } from './lib/d1-harness.mjs';

const { check, checkTrue, done } = makeChecker();
const { env } = makeEnv();
await seedBasic(env);

const j = async (path, init) => {
  const r = await worker.fetch(req(path, init), env);
  return { status: r.status, body: await r.json().catch(() => null) };
};

// ── Tayyorgarlik ─────────────────────────────────────────────────────
// OTH222 — user#2 ning kartasi (aynan egasining holatidek: begona
// profil, ichida posti va storysi bor).
const soon = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
await env.DB.prepare(
  `INSERT INTO posts (id, code, user_id, image_url, caption) VALUES (91, 'OTH222', 2, '/uploads/p.jpg', 'post')`,
).run();
await env.DB.prepare(
  `INSERT INTO stories (id, owner_kind, owner_id, user_id, image_url, caption, created_at, expires_at)
   VALUES (92, 'card', 'OTH222', 2, '/uploads/s.jpg', 'story', ?, ?)`,
).bind(new Date().toISOString(), soon).run();
// Kompaniya ham shu odamniki.
await env.DB.prepare(
  `INSERT INTO companies (company_id, owner_user_id, display_name, tier, price, status, created_at, updated_at)
   VALUES ('ELITEBIZ', '2', 'Elite', 'free', 0, 'active', datetime('now'), datetime('now'))`,
).run();
await env.DB.prepare(
  `INSERT INTO company_posts (id, company_id, image_url, caption, created_at)
   VALUES (93, 'ELITEBIZ', '/uploads/cp.jpg', 'co-post', ?)`,
).bind(new Date().toISOString()).run();
// user#1 user#2 ga obuna — story lentasi uchun.
await env.DB.prepare(`INSERT INTO follows (follower_id, followee_id) VALUES (1, 2)`).run();

const inFeed = (body, kind, code) =>
  (body?.feed || []).some((x) => x.kind === kind && String(x.code).toUpperCase() === code);
const inCatalog = (body) => (Array.isArray(body) ? body : []).some((x) => x.code === 'OTH222');

// ── 1) O'CHIRISHDAN OLDIN — HAMMA JOYDA BOR ──────────────────────────
// Bu bo'lim testning o'zini qo'riqlaydi: quyidagi "yo'q" tekshiruvlari
// faqat shu yerda "bor" bo'lgani uchun ma'noga ega.
const before = {
  profil: await j('/api/records/OTH222'),
  postlar: await j('/api/records/OTH222/posts'),
  storylar: await j('/api/records/OTH222/stories'),
  lenta: await j('/api/feed', { cookie: cookie.user }),
  storyLenta: await j('/api/stories/feed', { cookie: cookie.user }),
  katalog: await j('/api/records'),
  qidiruv: await j('/api/records/search?q=boshqa'),
  kompaniya: await j('/api/companies/ELITEBIZ'),
  kompaniyalar: await j('/api/companies'),
};
check('1) profil ochiladi', before.profil.status, 200);
check('1) posti bor', (before.postlar.body?.posts || []).length, 1);
check('1) storysi bor', (before.storylar.body?.stories || []).length, 1);
checkTrue('1) posti lentada', inFeed(before.lenta.body, 'post', 'OTH222'));
checkTrue('1) storysi lentada', inFeed(before.lenta.body, 'story', 'OTH222'));
checkTrue('1) kompaniya posti lentada', inFeed(before.lenta.body, 'post', 'ELITEBIZ'));
check('1) story lentasida bor', (before.storyLenta.body?.feed || []).length, 1);
checkTrue('1) katalogda bor', inCatalog(before.katalog.body));
check('1) qidiruvda bor', (before.qidiruv.body?.records || []).length, 1);
check('1) kompaniya sahifasi ochiladi', before.kompaniya.status, 200);
check('1) kompaniyalar ro‘yxatida bor', (before.kompaniyalar.body?.companies || []).length, 1);

// ── 2) ADMIN HISOBNI O'CHIRADI ───────────────────────────────────────
// Aynan admin panelidagi tugma bosadigan yo'l — qo'lda UPDATE emas.
const del = await j('/api/admin/users/2/delete', { method: 'POST', cookie: cookie.admin });
check('2) admin o‘chirdi', del.status, 200);
const row = await env.DB.prepare(`SELECT deleted_at FROM users WHERE id = 2`).first();
checkTrue('2) deleted_at qo‘yildi', !!row?.deleted_at);
// Qator ataylab qoladi — buyurtma va to'lov tarixi shu id ga bog'langan.
const still = await env.DB.prepare(`SELECT 1 AS x FROM cards WHERE code = 'OTH222'`).first();
checkTrue('2) karta qatori ataylab qoldi', !!still);

// ── 3) O'CHIRISHDAN KEYIN — HECH QAYERDA YO'Q ────────────────────────
const after = {
  profil: await j('/api/records/OTH222'),
  postlar: await j('/api/records/OTH222/posts'),
  storylar: await j('/api/records/OTH222/stories'),
  lenta: await j('/api/feed', { cookie: cookie.user }),
  storyLenta: await j('/api/stories/feed', { cookie: cookie.user }),
  katalog: await j('/api/records'),
  qidiruv: await j('/api/records/search?q=boshqa'),
  kompaniya: await j('/api/companies/ELITEBIZ'),
  kompaniyalar: await j('/api/companies'),
  kompaniyaPostlari: await j('/api/companies/ELITEBIZ/posts'),
};
check('3) profil endi topilmaydi', [after.profil.status, after.profil.body?.error], [404, 'not_found']);
check('3) postlari yo‘q', (after.postlar.body?.posts || []).length, 0);
check('3) storylari yo‘q', (after.storylar.body?.stories || []).length, 0);
check('3) posti lentadan ketdi', inFeed(after.lenta.body, 'post', 'OTH222'), false);
check('3) storysi lentadan ketdi', inFeed(after.lenta.body, 'story', 'OTH222'), false);
check('3) kompaniya posti lentadan ketdi', inFeed(after.lenta.body, 'post', 'ELITEBIZ'), false);
check('3) story lentasi bo‘shadi', (after.storyLenta.body?.feed || []).length, 0);
check('3) katalogdan ketdi', inCatalog(after.katalog.body), false);
check('3) qidiruvdan ketdi', (after.qidiruv.body?.records || []).length, 0);
check('3) kompaniya sahifasi yopildi', after.kompaniya.status, 404);
check('3) kompaniyalar ro‘yxatidan ketdi', (after.kompaniyalar.body?.companies || []).length, 0);
check('3) kompaniya postlari bo‘sh', (after.kompaniyaPostlari.body?.posts || []).length, 0);

// ── 4) BOSHQALARGA TEGMAYDI ──────────────────────────────────────────
// Filtr keng yozilsa (masalan JOIN bilan) begunoh profillarni ham
// yo'qotardi — shuning uchun qo'shni karta alohida tekshiriladi.
const vip = await j('/api/records/VIP001');
check('4) boshqa profil joyida', vip.status, 200);
checkTrue('4) boshqa profil katalogda', (after.katalog.body || []).some((x) => x.code === 'VIP001'));

// ── 5) EGASIZ KOD KO'RINISHDA QOLADI ─────────────────────────────────
// `user_id IS NULL` — hali sotilmagan kod. `JOIN users` ishlatilganda
// bunday kodlar jimgina katalogdan yo'qolardi.
await env.DB.prepare(
  `INSERT INTO cards (code, name, price, ts, user_id, profile_type) VALUES ('FREE55', 'Bo‘sh', 49000, 1000, NULL, 'personal')`,
).run();
const katalog2 = await j('/api/records');
checkTrue('5) egasiz kod katalogda qoldi', (katalog2.body || []).some((x) => x.code === 'FREE55'));

// ── 6) QAYTARIB BO'LADI ──────────────────────────────────────────────
// Yumshoq o'chirish — qaytariladigan amal. Belgi olinsa profil o'z
// joyiga qaytishi kerak (kontent o'chirilmagani uchun).
await env.DB.prepare(`UPDATE users SET deleted_at = NULL WHERE id = 2`).run();
const back = await j('/api/records/OTH222');
check('6) belgi olinsa profil qaytadi', back.status, 200);
const backFeed = await j('/api/feed', { cookie: cookie.user });
checkTrue('6) kontenti ham qaytadi', inFeed(backFeed.body, 'story', 'OTH222'));

done();
