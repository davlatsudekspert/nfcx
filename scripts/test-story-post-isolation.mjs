// STORY VA POST BIR-BIRIGA ARALASHMAYDI
//
// Egasining talabi: "Story qo'yayaptimi yoki Post qo'yayaptimi,
// foydalanuvchi hech qachon adashmasligi kerak". Interfeys ajratildi
// (scripts/test-story-post-separate.mjs), lekin ASL kafolat pastda:
// story yaratish POST jadvaliga tushmasligi va aksincha.
//
// Bu test manba matnini o'qimaydi — haqiqiy `hosting/worker.js` ga
// so'rov yuboradi va HAR IKKALA sonni o'lchaydi. Shuning uchun u
// "ko'rinishda to'g'ri" bilan "haqiqatan to'g'ri" ni farqlaydi.
//
//   node scripts/test-story-post-isolation.mjs
import worker from '../hosting/worker.js';
import { makeEnv, seedBasic, cookie, req, makeChecker } from './lib/d1-harness.mjs';

const { check, checkTrue, done } = makeChecker();
const { env } = makeEnv();
await seedBasic(env);

const call = async (path, init) => {
  const r = await worker.fetch(req(path, init), env);
  return { status: r.status, body: await r.json().catch(() => null) };
};

// Ikkala sonni BIR VAQTDA o'lchaydi — "bittasi oshdi, ikkinchisi
// o'zgarmadi" degan shartni aynan shu ko'rsatadi.
const counts = async (code) => ({
  stories: (await call(`/api/records/${code}/stories`)).body?.stories?.length ?? -1,
  posts: (await call(`/api/records/${code}/posts`)).body?.posts?.length ?? -1,
});

const addStory = (code, n, ck = cookie.user) => call(`/api/records/${code}/stories`,
  { method: 'POST', json: { imageUrl: `/uploads/st${n}.jpg`, agreed: true }, headers: { cookie: ck } });
const addPost = (code, n, ck = cookie.user) => call(`/api/records/${code}/posts`,
  { method: 'POST', json: { imageUrl: `/uploads/po${n}.jpg`, caption: `post ${n}`, agreed: true }, headers: { cookie: ck } });

// Ikkinchi shaxsiy profil (user#2 niki, faqat harflardan -> ekskluziv).
await env.DB.prepare(
  `INSERT INTO cards (code, name, price, ts, user_id, profile_type)
   VALUES ('TTSOTHER', 'Ikkinchi', 0, 1000, 2, 'personal')`,
).run();

// ── A) STORY YARATISH — FAQAT STORY SONI OSHADI ──────────────────────
{
  const before = await counts('VIP001');
  const r = await addStory('VIP001', 1);
  check('A) story yaratildi -> 201', r.status, 201);
  const after = await counts('VIP001');
  check('A) story soni +1', after.stories, before.stories + 1);
  check('A) POST soni O‘ZGARMADI', after.posts, before.posts);
  // Javob ham storyniki: postga xos maydon bo'lmasin.
  checkTrue('A) javobda story muddati bor', !!r.body?.expiresAt);
}

// ── B) POST YARATISH — FAQAT POST SONI OSHADI ────────────────────────
{
  const before = await counts('VIP001');
  const r = await addPost('VIP001', 1);
  check('B) post yaratildi -> 201', r.status, 201);
  const after = await counts('VIP001');
  check('B) post soni +1', after.posts, before.posts + 1);
  check('B) STORY soni O‘ZGARMADI', after.stories, before.stories);
  // Post DOIMIY: muddat maydoni bo'lmasligi kerak.
  checkTrue('B) postda muddat yo‘q (doimiy)', !r.body?.expiresAt);
  checkTrue('B) postda izoh saqlandi', r.body?.caption === 'post 1');
}

// ── C) PROFIL KONTEKSTI — BOSHQA PROFILGA YOZILMAYDI ─────────────────
// "VIP001 tanlangan bo'lsa TTS075 ga yozilmasin."
{
  const vipBefore = await counts('VIP001');
  const othBefore = await counts('TTSOTHER');

  await addStory('VIP001', 2);
  const vipAfterStory = await counts('VIP001');
  const othAfterStory = await counts('TTSOTHER');
  check('C) VIP001 storysi VIP001 ga tushdi', vipAfterStory.stories, vipBefore.stories + 1);
  check('C) boshqa profil storysi o‘zgarmadi', othAfterStory.stories, othBefore.stories);
  check('C) boshqa profil postlari ham o‘zgarmadi', othAfterStory.posts, othBefore.posts);

  await addPost('TTSOTHER', 2, cookie.other);
  const othAfterPost = await counts('TTSOTHER');
  const vipAfterPost = await counts('VIP001');
  check('C) TTSOTHER posti TTSOTHER ga tushdi', othAfterPost.posts, othBefore.posts + 1);
  check('C) VIP001 postlari o‘zgarmadi', vipAfterPost.posts, vipAfterStory.posts);
  check('C) VIP001 storylari ham o‘zgarmadi', vipAfterPost.stories, vipAfterStory.stories);
}

// ── C2) BEGONA PROFILGA UMUMAN YOZIB BO'LMAYDI ───────────────────────
{
  const before = await counts('TTSOTHER');
  const s = await addStory('TTSOTHER', 9, cookie.user);   // user#1 begona
  const p = await addPost('TTSOTHER', 9, cookie.user);
  check('C2) begona profilga story -> 403', s.status, 403);
  check('C2) begona profilga post -> 403', p.status, 403);
  const after = await counts('TTSOTHER');
  check('C2) begona profil storylari o‘zgarmadi', after.stories, before.stories);
  check('C2) begona profil postlari o‘zgarmadi', after.posts, before.posts);
}

// ── C3) SHAXSIY VA BIZNES ARALASHMAYDI ───────────────────────────────
// "NFCSTOREUZ business tanlangan bo'lsa personal VIP001 ga yozilmasin."
{
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO companies (company_id, owner_user_id, display_name, category, tier, price, status, created_at, updated_at)
     VALUES ('TESTBIZ', '1', 'TEST BIZNES', 'restoran', 'gold', 0, 'active', ?, ?)`,
  ).bind(now, now).run();

  const personalBefore = await counts('VIP001');

  const cs = await call('/api/companies/TESTBIZ/stories',
    { method: 'POST', json: { imageUrl: '/uploads/cs1.jpg', agreed: true }, headers: { cookie: cookie.user } });
  const cp = await call('/api/companies/TESTBIZ/posts',
    { method: 'POST', json: { imageUrl: '/uploads/cp1.jpg', caption: 'biz', agreed: true }, headers: { cookie: cookie.user } });
  checkTrue('C3) kompaniya storysi yaratildi', [200, 201].includes(cs.status), `status ${cs.status}`);
  checkTrue('C3) kompaniya posti yaratildi', [200, 201].includes(cp.status), `status ${cp.status}`);

  // ENG MUHIMI: shaxsiy profilga hech narsa tushmadi.
  const personalAfter = await counts('VIP001');
  check('C3) shaxsiy story soni o‘zgarmadi', personalAfter.stories, personalBefore.stories);
  check('C3) shaxsiy post soni o‘zgarmadi', personalAfter.posts, personalBefore.posts);

  // Va kompaniya lentasi o'zinikini ko'rsatadi.
  const cList = await call('/api/companies/TESTBIZ/stories');
  checkTrue('C3) kompaniya lentasi o‘zinikini beradi', (cList.body?.stories?.length ?? 0) >= 1);
}

// ── D) BAZADA HAM ARALASHMAGAN ───────────────────────────────────────
// Yuqoridagi sonlar API orqali o'lchandi. Endi JADVALLARNING O'ZINI
// so'raymiz: story `stories` da, post `posts` da bo'lishi shart.
{
  const st = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM stories WHERE owner_kind = 'card' AND owner_id = 'VIP001'`).first();
  const po = await env.DB.prepare(`SELECT COUNT(*) AS n FROM posts WHERE code = 'VIP001'`).first();
  checkTrue('D) stories jadvalida VIP001 storylari bor', Number(st?.n || 0) > 0);
  checkTrue('D) posts jadvalida VIP001 postlari bor', Number(po?.n || 0) > 0);

  // Story izohi post jadvaliga tushmagan bo'lsin (va aksincha).
  const crossPost = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM posts WHERE image_url LIKE '/uploads/st%'`).first();
  const crossStory = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM stories WHERE image_url LIKE '/uploads/po%'`).first();
  check('D) story mediasi POSTS jadvalida yo‘q', Number(crossPost?.n || 0), 0);
  check('D) post mediasi STORIES jadvalida yo‘q', Number(crossStory?.n || 0), 0);

  // Kompaniya kontenti shaxsiy jadval qatoriga tushmagan.
  const bizInPersonal = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM posts WHERE code = 'TESTBIZ'`).first();
  check('D) kompaniya posti shaxsiy jadvalda yo‘q', Number(bizInPersonal?.n || 0), 0);
  const bizStoryOwner = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM stories WHERE owner_kind = 'company' AND owner_id = 'TESTBIZ'`).first();
  checkTrue('D) kompaniya storysi company sifatida yozilgan', Number(bizStoryOwner?.n || 0) > 0);
}

// ── D2) O'CHIRISH HAM ARALASHMAYDI ───────────────────────────────────
{
  const before = await counts('VIP001');
  const story = (await call('/api/records/VIP001/stories')).body.stories[0];
  await call(`/api/stories/${story.id}`, { method: 'DELETE', headers: { cookie: cookie.user } });
  const after = await counts('VIP001');
  check('D2) story o‘chdi', after.stories, before.stories - 1);
  check('D2) POST soni o‘zgarmadi', after.posts, before.posts);

  const post = (await call('/api/records/VIP001/posts')).body.posts[0];
  await call(`/api/posts/${post.id}`, { method: 'DELETE', headers: { cookie: cookie.user } });
  const last = await counts('VIP001');
  check('D2) post o‘chdi', last.posts, after.posts - 1);
  check('D2) STORY soni o‘zgarmadi', last.stories, after.stories);
}

done('Story va post ajralishi');
