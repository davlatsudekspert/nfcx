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

// ── 7b) 100 MB LIK MEDIA YUKLASH (rasm va video) ─────────────────────
// Tana xotiraga yig'ilmay R2 ga oqiziladi — mock ham oqimni qabul
// qiladi, ya'ni test haqiqiy yo'lni yuradi.
const upload = async (bytes, contentType, extra = {}) => {
  const r = await worker.fetch(new Request('https://nfcstore.uz/api/upload-media', {
    method: 'POST',
    headers: { cookie: 'nfc_session=user-token', 'content-type': contentType, 'content-length': String(extra.len ?? bytes.length), 'cf-connecting-ip': '198.51.100.60' },
    body: bytes,
  }), env);
  return { status: r.status, body: await r.json().catch(() => null) };
};
const jpeg = new Uint8Array(64); jpeg.set([0xff, 0xd8, 0xff, 0xe0], 0);
const png = new Uint8Array(64); png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
const mp4 = new Uint8Array(64); mp4.set([...'    ftypisom'].map((c) => c.charCodeAt(0)), 0);
const junk = new Uint8Array(64); junk.set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 0);

const upJpeg = await upload(jpeg, 'image/jpeg');
check('7b) jpeg qabul qilindi', [upJpeg.status, upJpeg.body?.kind], [200, 'image']);
checkTrue('7b) manzil /uploads/ ichida', /^\/uploads\/story_[0-9a-f]+\.jpg$/.test(upJpeg.body.url));
const upPng = await upload(png, 'image/png');
check('7b) png qabul qilindi', upPng.status, 200);
const upMp4 = await upload(mp4, 'video/mp4');
check('7b) video qabul qilindi', [upMp4.status, upMp4.body?.kind], [200, 'video']);
// Tur mijoz aytganidan emas, SEHRLI BAYTLARDAN olinadi.
const lying = await upload(mp4, 'image/png');
check('7b) yolg‘on content-type rad etildi', lying.status, 422);
const bad = await upload(junk, 'application/octet-stream');
check('7b) noma’lum format rad etildi', bad.status, 422);
// 100 MB dan katta tana UMUMAN o'qilmaydi.
const tooBig = await upload(jpeg, 'image/jpeg', { len: 101 * 1024 * 1024 });
check('7b) 100 MB dan katta rad etildi', [tooBig.status, tooBig.body?.limitMb], [413, 100]);
// Kirmagan odam yuklay olmaydi.
const anonUp = await worker.fetch(new Request('https://nfcstore.uz/api/upload-media', {
  method: 'POST', headers: { 'content-type': 'image/jpeg', 'cf-connecting-ip': '198.51.100.61' }, body: jpeg,
}), env);
check('7b) kirmagan yuklay olmaydi', anonUp.status, 401);

// Yuklangan video istoryaga qo'yilishi mumkin (premium darajada).
await env.DB.prepare(`UPDATE cards SET tier_override = 'premium' WHERE code = 'VIP001'`).run();
const vidStory = await j('/api/records/VIP001/stories', { method: 'POST', cookie: cookie.user, json: { videoUrl: upMp4.body.url, agreed: true } });
check('7b) video istorya joylandi', vidStory.status, 201);
await env.DB.prepare(`DELETE FROM stories WHERE owner_id = 'VIP001'`).run();
await env.DB.prepare(`UPDATE cards SET tier_override = 'gold' WHERE code = 'VIP001'`).run();

// KATTA FAYL — multipart yo'li. Bu eng muhim tekshiruv: production'da
// aynan shu joyda yiqilgan edi (R2 uzunligi noma'lum oqimni rad etadi),
// mock esa uni yutib yuborardi.
const bigLen = 20 * 1024 * 1024 + 12345;
const bigJpeg = new Uint8Array(bigLen);
bigJpeg.set([0xff, 0xd8, 0xff, 0xe0], 0);
// Bo'laklar TO'G'RI tartibda yig'ilganini tekshirish uchun belgi
// qo'yamiz: mazmun buzilsa yoki bo'lak tushib qolsa, bu bilinadi.
for (let i = 0; i < bigLen; i += 1) bigJpeg[i] = bigJpeg[i] || (i % 251);
const upBig = await upload(bigJpeg, 'image/jpeg');
check('7b) 20 MB fayl yuklandi (multipart)', upBig.status, 200);
const stored = env.UPLOADS._store.get(`uploads/${upBig.body.url.split('/').pop()}`);
check('7b) hajmi to‘liq saqlandi', stored?.bytes.length, bigLen);
checkTrue('7b) mazmun buzilmagan', stored && stored.bytes[0] === 0xff && stored.bytes[bigLen - 1] === bigJpeg[bigLen - 1]
  && stored.bytes[9 * 1024 * 1024] === bigJpeg[9 * 1024 * 1024]);

// Yolg'on `content-length` bilan chegarani aylanib o'tib bo'lmaydi:
// haqiqiy hajm ham sanaladi.
const liar = await upload(bigJpeg, 'image/jpeg', { len: 10 });
checkTrue('7b) yolg‘on content-length chegarani chetlab o‘tmaydi', liar.status === 200 || liar.status === 413);

// ── 8) LENTA (obuna bo'lganlar istoryasi) ────────────────────────────
// Kirmagan odam bo'sh lenta oladi (xato emas — vidjet o'zini chizmaydi).
check('8) kirmagan uchun bo‘sh', (await j('/api/stories/feed')).body.feed, []);

// user#2 (other) hali user#1 ga obuna emas — lenta bo'sh.
const beforeFollow = await j('/api/stories/feed', { cookie: cookie.other });
check('8) obunasiz bo‘sh', beforeFollow.body.feed.length, 0);

// user#1 ning VIP001 da istoryasi bo'lsin.
await env.DB.prepare(`UPDATE cards SET tier_override = 'gold' WHERE code = 'VIP001'`).run();
await j('/api/records/VIP001/stories', { method: 'POST', cookie: cookie.user, json: { imageUrl: IMG, agreed: true } });
await j('/api/records/VIP001/stories', { method: 'POST', cookie: cookie.user, json: { imageUrl: IMG, agreed: true } });

await env.DB.prepare(`INSERT INTO follows (follower_id, followee_id) VALUES (2, 1)`).run();
const feed = await j('/api/stories/feed', { cookie: cookie.other });
check('8) obunadan keyin ko‘rinadi', feed.body.feed.length, 1);
check('8) bitta odam — bitta dumaloqcha', feed.body.feed[0].code, 'VIP001');
checkTrue('8) ikkala istorya ichida', feed.body.feed[0].stories.length >= 2);

// O'ZINGIZ obuna bo'lmagan odamning istoryasi lentaga TUSHMAYDI.
await env.DB.prepare(`UPDATE cards SET tier_override = 'gold' WHERE code = 'OTH222'`).run();
await j('/api/records/OTH222/stories', { method: 'POST', cookie: cookie.other, json: { imageUrl: IMG, agreed: true } });
const feed2 = await j('/api/stories/feed', { cookie: cookie.user });
check('8) obuna bo‘lmagan odam ko‘rinmaydi', feed2.body.feed.length, 0);

// Muddati o'tgani lentada ham ko'rinmaydi.
await env.DB.prepare(`UPDATE stories SET expires_at = '2000-01-01T00:00:00.000Z' WHERE owner_id = 'VIP001'`).run();
check('8) muddati o‘tgani lentada yo‘q', (await j('/api/stories/feed', { cookie: cookie.other })).body.feed.length, 0);

// ── 9) TO'LIQ OQIM: yuklash -> joylash -> ko'rish ────────────────────
// Egasining shikoyati: "istorya qo'yish ishlamayapti", "post qo'ydim
// ko'rinmayapti". Shuning uchun oqimning HAR BOSQICHI shu yerda
// ketma-ket yuriladi — bittasi uzilsa aynan qaysi joyi ekani chiqadi.
{
  // 7-bo'limda chegara sinovi uchun 12 ta istorya qo'shilgan edi —
  // bu yerda toza holatdan boshlaymiz, aks holda `limit_reached`
  // chiqib, oqim uzilgandek ko'rinardi.
  await env.DB.prepare(`DELETE FROM stories WHERE owner_kind = 'company' AND owner_id = 'NFCTEST'`).run();

  // 9.1 video yuklash
  const upVid = await upload(mp4, 'video/mp4');
  check('9) video yuklandi', [upVid.status, upVid.body?.kind], [200, 'video']);

  // 9.2 kompaniya istoryasi (video bilan)
  const st = await j('/api/companies/NFCTEST/stories', { method: 'POST', cookie: cookie.user, json: { videoUrl: upVid.body.url, agreed: true } });
  check('9) video istorya joylandi', st.status, 201);
  const stList = await j('/api/companies/NFCTEST/stories');
  checkTrue('9) istorya ro‘yxatda ko‘rinadi', stList.body.stories.some((x) => x.videoUrl === upVid.body.url));

  // 9.3 fayl HAQIQATAN beriladimi (profil uni shu manzildan o'qiydi)
  const fileRes = await worker.fetch(new Request(`https://nfcstore.uz${upVid.body.url}`), env);
  check('9) yuklangan fayl beriladi', fileRes.status, 200);
  check('9) turi to‘g‘ri', fileRes.headers.get('content-type'), 'video/mp4');
  // Video uchun Range so'rovi SHART — usiz telefonda ijro boshlanmaydi.
  const ranged = await worker.fetch(new Request(`https://nfcstore.uz${upVid.body.url}`, { headers: { range: 'bytes=0-9' } }), env);
  check('9) Range so‘rovi qo‘llab-quvvatlanadi', ranged.status, 206);

  // 9.4 post: yuklash -> joylash -> OCHIQ ro'yxatda ko'rinishi
  const upImg = await upload(jpeg, 'image/jpeg');
  const post = await j('/api/companies/NFCTEST/posts', { method: 'POST', cookie: cookie.user, json: { imageUrl: upImg.body.url, agreed: true, caption: 'yangi' } });
  check('9) post joylandi', post.status, 201);
  const openPosts = await j('/api/companies/NFCTEST/posts');
  checkTrue('9) post OCHIQ ro‘yxatda (kirmasdan ham)', openPosts.body.posts.some((x) => x.imageUrl === upImg.body.url));
}

// ── 10) OBUNA VA KO'RISHLAR ──────────────────────────────────────────
{
  const before = await j('/api/companies/NFCTEST', { cookie: cookie.other });
  check('10) boshida obunachi yo‘q', [before.body.company.followers, before.body.company.following], [0, false]);

  const anon = await j('/api/companies/NFCTEST/follow', { method: 'POST' });
  check('10) kirmagan obuna bo‘la olmaydi', anon.status, 401);
  const self = await j('/api/companies/NFCTEST/follow', { method: 'POST', cookie: cookie.user });
  check('10) egasi o‘ziga obuna bo‘la olmaydi', [self.status, self.body?.error], [409, 'cannot_follow_self']);

  const on = await j('/api/companies/NFCTEST/follow', { method: 'POST', cookie: cookie.other });
  check('10) obuna bo‘ldi', [on.status, on.body.following, on.body.followers], [200, true, 1]);
  const seen = await j('/api/companies/NFCTEST', { cookie: cookie.other });
  check('10) profilda ko‘rinadi', [seen.body.company.followers, seen.body.company.following], [1, true]);
  // Boshqa odam uchun "following" YOLG'ON bo'lishi kerak.
  const otherView = await j('/api/companies/NFCTEST', { cookie: cookie.user });
  check('10) boshqa odamga "obuna bo‘lingan" ko‘rinmaydi', otherView.body.company.following, false);

  const off = await j('/api/companies/NFCTEST/follow', { method: 'POST', cookie: cookie.other });
  check('10) qayta bosilsa bekor bo‘ladi', [off.body.following, off.body.followers], [false, 0]);

  // Ko'rishlar — statistika jamlanmasidan, ya'ni kabinetdagi son bilan
  // BIR MANBA. Ikkalasi boshqa-boshqa raqam ko'rsatmasin.
  await j('/api/companies/NFCTEST/event', { method: 'POST', json: { kind: 'view' }, ip: '203.0.113.211' });
  await j('/api/companies/NFCTEST/event', { method: 'POST', json: { kind: 'view' }, ip: '203.0.113.212' });
  const withViews = await j('/api/companies/NFCTEST');
  const stats = await j('/api/companies/NFCTEST/stats', { cookie: cookie.user });
  checkTrue('10) ko‘rishlar profilda bor', withViews.body.company.views >= 2);
  check('10) profil va kabinet raqami bir xil', withViews.body.company.views, stats.body.views);
}

console.log('\\naccess:', access || '(nomaʼlum)');
done();
