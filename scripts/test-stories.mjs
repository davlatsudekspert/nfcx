// ISTORYA va KOMPANIYA POSTLARI (2026-09).
//
// Diqqat qaratilgan joylar:
//   • qoidalar roziligi SERVERDA tekshiriladi (frontendni chetlab
//     o'tib bo'lmasin);
//   • media faqat o'zimizning R2 dan;
//   • istorya 24 soatdan keyin ko'rinmaydi;
//   • daraja chegarasi: gold+ yoki premium obunachi;
//   • egalik: begona odam qo'shmaydi va o'chirmaydi;
//   • shaxsiy karta va kompaniya istoryalari ARALASHMAYDI.
//
//   node scripts/test-stories.mjs
import worker from '../hosting/worker.js';
import { makeEnv, seedBasic, cookie, req, makeChecker } from './lib/d1-harness.mjs';

const { check, checkTrue, done } = makeChecker();
const { env } = makeEnv();
await seedBasic(env);

const j = async (path, init) => { const r = await worker.fetch(req(path, init), env); return { status: r.status, body: await r.json().catch(() => null) }; };
const IMG = '/uploads/story-1.jpg';

// seedBasic: VIP001 (user#1) — faqat harflardan iborat emas, 6 belgili.
// Daraja tekshiruvi uchun aniq bilamiz: VIP001 -> qaysi daraja?
const tier = await j('/api/records/VIP001', { cookie: cookie.user });
const access = tier.body?.access || tier.body?.record?.access;

// ── 1) QOIDALAR ROZILIGI ──────────────────────────────────────────────
const noAgree = await j('/api/records/VIP001/stories', { method: 'POST', cookie: cookie.user, json: { imageUrl: IMG } });
check('1) rozilik yo‘q — rad etildi', [noAgree.status, noAgree.body?.error], [422, 'rules_not_accepted']);
const fakeAgree = await j('/api/records/VIP001/stories', { method: 'POST', cookie: cookie.user, json: { imageUrl: IMG, agreed: 'yes' } });
check('1) "yes" rozilik emas', fakeAgree.status, 422);

// ── 2) MEDIA MANBAI ───────────────────────────────────────────────────
for (const bad of ['https://evil.example/x.jpg', '/uploads/../secret', '/uploads/x.exe', '']) {
  const r = await j('/api/records/VIP001/stories', { method: 'POST', cookie: cookie.user, json: { imageUrl: bad, agreed: true } });
  checkTrue(`2) begona manba rad etildi: ${JSON.stringify(bad)}`, r.status === 422);
}

// ── 3) DARAJA CHEGARASI ───────────────────────────────────────────────
// Avval past darajaga tushiramiz — istorya YOPIQ bo'lishi kerak.
await env.DB.prepare(`UPDATE cards SET tier_override = 'free' WHERE code = 'VIP001'`).run().catch(() => {});
const locked = await j('/api/records/VIP001/stories', { method: 'POST', cookie: cookie.user, json: { imageUrl: IMG, agreed: true } });
check('3) free darajada yopiq', [locked.status, locked.body?.error, locked.body?.feature], [403, 'feature_locked', 'story']);

// Gold — ochiladi.
await env.DB.prepare(`UPDATE cards SET tier_override = 'gold' WHERE code = 'VIP001'`).run();
const okStory = await j('/api/records/VIP001/stories', { method: 'POST', cookie: cookie.user, json: { imageUrl: IMG, agreed: true, caption: 'salom' } });
check('3) gold darajada ochiq', okStory.status, 201);

// Premium OBUNACHI — ID darajasi past bo'lsa ham qo'ya oladi.
await env.DB.prepare(`UPDATE cards SET tier_override = 'free' WHERE code = 'VIP001'`).run();
await env.DB.prepare(`UPDATE users SET is_premium = 1 WHERE id = 1`).run().catch(() => {});
const premSub = await j('/api/records/VIP001/stories', { method: 'POST', cookie: cookie.user, json: { imageUrl: IMG, agreed: true } });
check('3) premium obunachi qo‘ya oladi', premSub.status, 201);
await env.DB.prepare(`UPDATE cards SET tier_override = 'gold' WHERE code = 'VIP001'`).run();

// ── 4) O'QISH VA MUDDAT ───────────────────────────────────────────────
const list = await j('/api/records/VIP001/stories');
check('4) ikkita istorya ko‘rinadi', list.body.stories.length, 2);
checkTrue('4) mehmon ham ko‘radi (kirish shart emas)', list.status === 200);

// Muddati o'tgani KO'RINMAYDI.
await env.DB.prepare(`UPDATE stories SET expires_at = '2000-01-01T00:00:00.000Z' WHERE id = ?`).bind(list.body.stories[0].id).run();
const afterExpiry = await j('/api/records/VIP001/stories');
check('4) muddati o‘tgani ko‘rinmaydi', afterExpiry.body.stories.length, 1);

// ── 5) EGALIK ─────────────────────────────────────────────────────────
const stranger = await j('/api/records/VIP001/stories', { method: 'POST', cookie: cookie.other, json: { imageUrl: IMG, agreed: true } });
check('5) begona qo‘sha olmaydi', [stranger.status, stranger.body?.error], [403, 'not_owner']);
const mine = afterExpiry.body.stories[0].id;
const delOther = await j(`/api/stories/${mine}`, { method: 'DELETE', cookie: cookie.other });
check('5) begona o‘chira olmaydi', delOther.status, 404);
const delMine = await j(`/api/stories/${mine}`, { method: 'DELETE', cookie: cookie.user });
check('5) egasi o‘chiradi', delMine.status, 200);
const anon = await j('/api/records/VIP001/stories', { method: 'POST', json: { imageUrl: IMG, agreed: true } });
check('5) kirmagan odam qo‘sha olmaydi', anon.status, 401);

// ── 6) KOMPANIYA: POST VA ISTORYA ────────────────────────────────────
await j('/api/companies', {
  method: 'POST', cookie: cookie.user,
  json: { companyId: 'NFCTEST', displayName: 'Test', city: 'Toshkent', phone: '+998901234567', category: 'other', description: 'Test kompaniya tavsifi, yigirma belgidan uzunroq matn.' },
});
await env.DB.prepare(`UPDATE companies SET status='active' WHERE company_id='NFCTEST'`).run();

const cNoAgree = await j('/api/companies/NFCTEST/posts', { method: 'POST', cookie: cookie.user, json: { imageUrl: IMG } });
check('6) kompaniya posti — rozilik shart', cNoAgree.status, 422);
const cPost = await j('/api/companies/NFCTEST/posts', { method: 'POST', cookie: cookie.user, json: { imageUrl: IMG, agreed: true, caption: 'yangi taom' } });
check('6) post joylandi', cPost.status, 201);
const cPosts = await j('/api/companies/NFCTEST/posts');
check('6) postlar ochiq ko‘rinadi', [cPosts.status, cPosts.body.posts.length, cPosts.body.posts[0].caption], [200, 1, 'yangi taom']);
const cStory = await j('/api/companies/NFCTEST/stories', { method: 'POST', cookie: cookie.user, json: { imageUrl: IMG, agreed: true } });
check('6) kompaniya istoryasi joylandi', cStory.status, 201);

// Shaxsiy va kompaniya istoryalari ARALASHMAYDI — bu bitta jadval,
// shuning uchun ayni shu narsa tekshiriladi.
const cardStories = await j('/api/records/VIP001/stories');
const compStories = await j('/api/companies/NFCTEST/stories');
check('6) kompaniyada 1 ta', compStories.body.stories.length, 1);
checkTrue('6) shaxsiyga kompaniya istoryasi tushmadi', !cardStories.body.stories.some((x) => x.id === cStory.body.id));

// Begona odam kompaniya postini qo'sha/o'chira olmaydi.
const cStranger = await j('/api/companies/NFCTEST/posts', { method: 'POST', cookie: cookie.other, json: { imageUrl: IMG, agreed: true } });
checkTrue('6) begona post qo‘sha olmaydi', cStranger.status === 403 || cStranger.status === 404);
const cDelStranger = await j(`/api/companies/NFCTEST/posts/${cPost.body.post.id}`, { method: 'DELETE', cookie: cookie.other });
checkTrue('6) begona post o‘chira olmaydi', cDelStranger.status === 403 || cDelStranger.status === 404);
check('6) egasi post o‘chiradi', (await j(`/api/companies/NFCTEST/posts/${cPost.body.post.id}`, { method: 'DELETE', cookie: cookie.user })).status, 200);

// ── 7) CHEGARA ────────────────────────────────────────────────────────
for (let i = 0; i < 12; i += 1) {
  await j('/api/companies/NFCTEST/stories', { method: 'POST', cookie: cookie.user, json: { imageUrl: IMG, agreed: true } });
}
const capped = await j('/api/companies/NFCTEST/stories');
checkTrue('7) istorya soni cheklangan', capped.body.stories.length <= 10);

console.log('\\naccess:', access || '(nomaʼlum)');
done();
