// ISTORIYAGA JAVOB VA KIM KO'RDI (hosting/api/story-replies.js).
//
// Tekshiriladi: kirgan odam faol istoriyaga matn yoki emoji bilan javob
// yozadi; o'ziga, muddati o'tganga, bloklangan holatda, egasi o'chirilgan
// yoki faol bo'lmagan kompaniyaga yozib bo'lmaydi; uzunlik, bo'sh va emoji
// tekshiruvi; spam chegarasi; ko'rganlar ro'yxati FAQAT egasiga, mehmonlar
// sanaladi lekin ro'yxatda yo'q; egasining qutisi sahifalanadi; egasiga
// istoriya ro'yxatida `replyCount`, begonaga yo'q.
//
//   node scripts/test-story-replies.mjs
import { setupSocial, cookie, makeChecker } from './lib/social-fixture.mjs';

const { check, checkTrue, done } = makeChecker();
const { sqlite, call, resetLimits } = await setupSocial();

// user#3 — uchinchi odam (javob yozuvchi, kartasi bor).
sqlite.prepare(`INSERT INTO users (id, email, password_hash) VALUES (3, 'third@test.local', 'x')`).run();
sqlite.prepare(`INSERT INTO sessions (token, user_id, expires_at) VALUES ('third-token', 3, '2999-01-01T00:00:00.000Z')`).run();
sqlite.prepare(`INSERT INTO cards (code, name, avatar_url, price, ts, user_id) VALUES ('THR333', 'Uchinchi', '/uploads/av3.jpg', 1, 1, 3)`).run();
const third = 'nfc_session=third-token';

const mk = async (path) => (await call(path, { method: 'POST', cookie: cookie.user, json: { agreed: true, imageUrl: '/uploads/st1abc.jpg' } })).body?.id;
const sId = await mk('/api/records/VIP001/stories');
const scId = await mk('/api/companies/ACMEUZ/stories');
checkTrue('0) istoriyalar', sId && scId);
const reply = (kind, id, json, ck = cookie.other) => call(`/api/stories/${kind}/${id}/reply`, { method: 'POST', cookie: ck, json });

// ── 1) Javob yozish ────────────────────────────────────────────────
let r = await reply('story', sId, { text: '  Narxi qancha?  ' });
check('1) matnli javob: 201', [r.status, r.body.reply.text, r.body.reply.emoji, r.body.reply.storyKind, r.body.reply.ownerId], [201, 'Narxi qancha?', null, 'story', 'VIP001']);
r = await reply('story', sId, { emoji: '🔥' }, third);
check('1) emoji javob', [r.status, r.body.reply.emoji, r.body.reply.text], [201, '🔥', '']);
r = await reply('story', sId, { emoji: '❤️' }, third);
check('1) VS16 li emoji', r.status, 201);
r = await reply('story', sId, { emoji: '👨‍👩‍👧' }, third);
check('1) ZWJ emoji', r.status, 201);
r = await reply('company_story', scId, { text: 'Ochiqmisiz?', emoji: '👍' });
check('1) kompaniya istoriyasiga matn + emoji', [r.status, r.body.reply.ownerKind, r.body.reply.emoji], [201, 'company', '👍']);

// ── 2) Rad etiladiganlar ───────────────────────────────────────────
for (const [label, kind, id, json, ck, status, err] of [
  ['kirmagan', 'story', sId, { text: 'a' }, null, 401, 'unauthorized'],
  ['o‘z istoriyasi', 'story', sId, { text: 'a' }, cookie.user, 409, 'own_story'],
  ['bo‘sh', 'story', sId, { text: '   ' }, cookie.other, 422, 'empty'],
  ['501 belgi', 'story', sId, { text: 'x'.repeat(501) }, cookie.other, 422, 'too_long'],
  ['emoji o‘rniga harf', 'story', sId, { emoji: 'abc' }, cookie.other, 422, 'bad_emoji'],
  ['emoji o‘rniga raqam', 'story', sId, { emoji: '123' }, cookie.other, 422, 'bad_emoji'],
  ['yo‘q istoriya', 'story', 99999, { text: 'a' }, cookie.other, 404, 'not_found'],
  ['tur mos emas', 'company_story', sId, { text: 'a' }, cookie.other, 404, 'not_found'],
]) {
  r = await reply(kind, id, json, ck);
  check(`2) ${label}: ${status} ${err}`, [r.status, r.body?.error], [status, err]);
}
check('2) 500 belgi — mumkin', (await reply('story', sId, { text: 'x'.repeat(500) })).status, 201);
r = await call(`/api/stories/story/${sId}/reply`, { method: 'GET', cookie: cookie.other });
check('2) GET reply: 405', r.status, 405);

// Muddati o'tgan.
sqlite.prepare(`UPDATE stories SET expires_at = '2000-01-01T00:00:00.000Z' WHERE id = ?`).run(scId);
check('2) muddati o‘tgan: 404', (await reply('company_story', scId, { text: 'a' })).status, 404);
sqlite.prepare(`UPDATE stories SET expires_at = '2999-01-01T00:00:00.000Z' WHERE id = ?`).run(scId);
// Faol bo'lmagan kompaniya.
sqlite.prepare(`UPDATE companies SET status = 'suspended' WHERE company_id = 'ACMEUZ'`).run();
check('2) faol bo‘lmagan kompaniya: 404', (await reply('company_story', scId, { text: 'a' })).status, 404);
sqlite.prepare(`UPDATE companies SET status = 'active' WHERE company_id = 'ACMEUZ'`).run();
// Bloklar: egasi javobchini bloklagan / javobchi egasini bloklagan.
await call('/api/blocks', { method: 'POST', cookie: cookie.user, json: { kind: 'record', id: 'THR333' } });
check('2) egasi bloklagan: 403 blocked', [(await reply('story', sId, { text: 'a' }, third)).status], [403]);
await call('/api/blocks/record/THR333', { method: 'DELETE', cookie: cookie.user });
check('2) blok olindi — yana yozadi', (await reply('story', sId, { text: 'a' }, third)).status, 201);
await call('/api/blocks', { method: 'POST', cookie: third, json: { kind: 'company', id: 'ACMEUZ' } });
check('2) javobchi kompaniyani bloklagan: 403', (await reply('company_story', scId, { text: 'a' }, third)).body?.error, 'blocked');
await call('/api/blocks/company/ACMEUZ', { method: 'DELETE', cookie: third });
// Ban.
sqlite.prepare(`UPDATE users SET banned_until = '2999-01-01T00:00:00.000Z' WHERE id = 3`).run();
check('2) bloklangan (ban) hisob: 403 banned', (await reply('story', sId, { text: 'a' }, third)).body?.error, 'banned');
sqlite.prepare(`UPDATE users SET banned_until = NULL WHERE id = 3`).run();

// Spam chegarasi: 10 daqiqada 30 tadan ko'p — 429.
resetLimits();
let last;
for (let i = 0; i < 31; i++) last = await reply('story', sId, { text: `s${i}` }, third);
check('2) 31-javob: 429', last.status, 429);
resetLimits();

// ── 3) Ko'rganlar (faqat egasi) ────────────────────────────────────
await call(`/api/stories/${sId}/view`, { method: 'POST', cookie: cookie.other });
await call(`/api/stories/${sId}/view`, { method: 'POST', cookie: third });
await call(`/api/stories/${sId}/view`, { method: 'POST' });                          // mehmon
await call(`/api/stories/${sId}/view`, { method: 'POST', ip: '198.51.100.77' });      // boshqa mehmon
await call(`/api/stories/${sId}/like`, { method: 'POST', cookie: third });
r = await call(`/api/stories/story/${sId}/viewers`, { cookie: cookie.user });
check('3) egasi: 200', r.status, 200);
check('3) count — hamma (mehmonlar ham)', [r.body.count, r.body.guestCount], [4, 2]);
check('3) ro‘yxatda faqat kirganlar', r.body.viewers.map((v) => v.code).sort(), ['OTH222', 'THR333']);
const v3 = r.body.viewers.find((v) => v.code === 'THR333');
check('3) ko‘ruvchi shakli', [v3.name, v3.avatarUrl, v3.liked, typeof v3.viewedAt], ['Uchinchi', '/uploads/av3.jpg', true, 'number']);
checkTrue('3) likeCount va replyCount', r.body.likeCount === 1 && r.body.replyCount > 5);
checkTrue('3) ro‘yxatda email/ID yo‘q', !JSON.stringify(r.body).includes('@test.local') && !r.body.viewers.some((v) => 'id' in v || 'userId' in v));
r = await call(`/api/stories/story/${sId}/viewers?limit=1`, { cookie: cookie.user });
check('3) sahifalash', [r.body.viewers.length, r.body.hasMore], [1, true]);
check('3) begona: 403', (await call(`/api/stories/story/${sId}/viewers`, { cookie: cookie.other })).status, 403);
check('3) mehmon: 401', (await call(`/api/stories/story/${sId}/viewers`)).status, 401);
check('3) yo‘q istoriya: 404', (await call('/api/stories/story/99999/viewers', { cookie: cookie.user })).status, 404);
// O'chirilgan hisob ro'yxatda yo'q.
sqlite.prepare(`UPDATE users SET deleted_at = '2026-10-01' WHERE id = 3`).run();
r = await call(`/api/stories/story/${sId}/viewers`, { cookie: cookie.user });
check('3) o‘chirilgan hisob ro‘yxatda yo‘q', r.body.viewers.map((v) => v.code), ['OTH222']);

// ── 4) Egasining qutisi ────────────────────────────────────────────
r = await call('/api/my/story-replies', { cookie: cookie.user });
check('4) 200', r.status, 200);
checkTrue('4) o‘chirilgan hisobning javoblari yashirin', r.body.items.every((i) => i.from.code !== 'THR333'));
sqlite.prepare(`UPDATE users SET deleted_at = NULL WHERE id = 3`).run();
r = await call('/api/my/story-replies?limit=2', { cookie: cookie.user });
check('4) sahifa: 2 ta, yana bor', [r.body.items.length, r.body.hasMore], [2, true]);
const first = r.body.items[0];
checkTrue('4) yangisi birinchi, shakl to‘liq', ['id', 'storyKind', 'storyId', 'ownerKind', 'ownerId', 'text', 'emoji', 'createdAt', 'from', 'story'].every((k) => k in first));
check('4) istoriya ko‘rinishi', [first.story.active, first.story.imageUrl], [true, '/uploads/st1abc.jpg']);
r = await call(`/api/my/story-replies?storyKind=company_story&storyId=${scId}`, { cookie: cookie.user });
check('4) bitta istoriya bo‘yicha filtr', r.body.items.map((i) => i.text), ['Ochiqmisiz?']);
check('4) yaroqsiz filtr: 422', (await call('/api/my/story-replies?storyKind=x&storyId=1', { cookie: cookie.user })).status, 422);
r = await call('/api/my/story-replies', { cookie: cookie.other });
check('4) boshqa odamning qutisi bo‘sh (o‘zgalarnikini ko‘rmaydi)', r.body.items, []);
check('4) kirmagan: 401', (await call('/api/my/story-replies')).status, 401);
// Istoriya o'chsa ham javob qutida qoladi.
await call(`/api/stories/${scId}`, { method: 'DELETE', cookie: cookie.user });
r = await call(`/api/my/story-replies?storyKind=company_story&storyId=${scId}`, { cookie: cookie.user });
check('4) istoriya o‘chdi — javob qoldi, story: null', [r.body.items.length, r.body.items[0]?.story], [1, null]);

// ── 5) replyCount — faqat egasiga ──────────────────────────────────
r = await call('/api/records/VIP001/stories', { cookie: cookie.user });
checkTrue('5) egasiga replyCount', r.body.stories[0].replyCount > 5);
r = await call('/api/records/VIP001/stories', { cookie: cookie.other });
checkTrue('5) begonaga replyCount yo‘q', !('replyCount' in r.body.stories[0]));
r = await call('/api/records/VIP001/stories');
checkTrue('5) mehmonga replyCount yo‘q', !('replyCount' in r.body.stories[0]));
checkTrue('5) eski maydonlar joyida', ['id', 'imageUrl', 'videoUrl', 'caption', 'createdAt', 'expiresAt', 'likeCount', 'liked', 'viewCount'].every((k) => k in r.body.stories[0]));

done();
