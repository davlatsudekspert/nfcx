// MUROJAATGA JAVOB FOYDALANUVCHIGA YETIB BORADI (2026-10).
//
// Tekshiriladi: foydalanuvchi yozadi; admin javobi standart 'replied';
// 'planned'/'resolved' bilan javob; noto'g'ri holat va bo'sh javob —
// 422; egasiga `support_reply` bildirishnomasi (begonaga emas) va u
// GET /api/notifications da chiqadi; holatni matnsiz o'zgartirish;
// ro'yxat filtri va sanoq; admin bo'lmagan — 401; eski {reply} shakli.
//
//   node scripts/test-support-replies.mjs
//   UZ_ADAPTER_TEST=1 node scripts/test-support-replies.mjs
import worker from '../hosting/worker.js';
import { makeEnv, seedBasic, cookie, req, makeChecker } from './lib/d1-harness.mjs';

const { check, checkTrue, done } = makeChecker();
const { env, sqlite } = makeEnv();
await seedBasic(env);

const call = async (pathname, init = {}) => {
  const res = await worker.fetch(req(pathname, init), env);
  const text = await res.text();
  let body = null;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: res.status, body };
};
const send = (ck, message) => call('/api/support', { method: 'POST', cookie: ck, json: { message } });
const reply = (id, json, ck = cookie.admin) => call(`/api/admin/support-messages/${id}/reply`, { method: 'POST', cookie: ck, json });
const setStatus = (id, json, ck = cookie.admin) => call(`/api/admin/support-messages/${id}/status`, { method: 'POST', cookie: ck, json });
const list = (q = '', ck = cookie.admin) => call(`/api/admin/support-messages${q}`, { cookie: ck });
const notifs = (ck) => call('/api/notifications', { cookie: ck });
const statusOf = (id) => sqlite.prepare(`SELECT status FROM support_messages WHERE id = ?`).get(id)?.status;

// ── 1) Foydalanuvchi yozadi ──────────────────────────────────────────
const m1 = await send(cookie.user, 'Ilova sekin ochilyapti');
const m2 = await send(cookie.user, 'Qorong‘i rejim qo‘shing');
const m3 = await send(cookie.user, 'Rasm yuklanmayapti');
const m4 = await send(cookie.other, 'Begona murojaat');
check('1) murojaatlar yaratildi', [m1.status, m2.status, m3.status, m4.status], [201, 201, 201, 201]);
check('1) yangi murojaat — pending', statusOf(m1.body.id), 'pending');

// ── 2) Admin bo'lmagan — kira olmaydi ────────────────────────────────
check('2) mehmon: ro‘yxat 401', (await call('/api/admin/support-messages')).status, 401);
check('2) mehmon: javob 401', (await call(`/api/admin/support-messages/${m1.body.id}/reply`, { method: 'POST', json: { reply: 'x' } })).status, 401);
check('2) oddiy foydalanuvchi: ro‘yxat 401', (await list('', cookie.user)).status, 401);
check('2) oddiy foydalanuvchi: javob 401', (await reply(m1.body.id, { reply: 'x' }, cookie.user)).status, 401);
check('2) oddiy foydalanuvchi: holat 401', (await setStatus(m1.body.id, { status: 'resolved' }, cookie.user)).status, 401);
check('2) holat o‘zgarmadi', statusOf(m1.body.id), 'pending');

// ── 3) Tekshiruv: bo'sh javob, noto'g'ri holat, yo'q murojaat ────────
let r = await reply(m1.body.id, { reply: '   ' });
check('3) bo‘sh javob — 422 reply_required', [r.status, r.body?.error], [422, 'reply_required']);
r = await reply(m1.body.id, { reply: 'Salom', status: 'pending' });
check('3) javob bilan pending — 422 bad_status', [r.status, r.body?.error], [422, 'bad_status']);
r = await reply(m1.body.id, { reply: 'Salom', status: 'closed' });
check('3) noma’lum holat — 422 bad_status', [r.status, r.body?.error], [422, 'bad_status']);
check('3) rad etilgan javob yozilmadi', statusOf(m1.body.id), 'pending');
r = await reply(999999, { reply: 'Salom' });
check('3) yo‘q murojaat — 404', r.status, 404);
check('3) rad etilganlar bildirishnoma yaratmadi', (await notifs(cookie.user)).body.items, []);

// ── 4) Eski shakl {reply} — standart 'replied' ───────────────────────
r = await reply(m1.body.id, { reply: 'Ilovani yangilang, tezlashdi.' });
check('4) eski shakl {reply}: 200 ok', [r.status, r.body?.ok], [200, true]);
check('4) standart holat — replied', [r.body?.status, statusOf(m1.body.id)], ['replied', 'replied']);

// ── 5) Bildirishnoma — faqat egasiga ─────────────────────────────────
let n = await notifs(cookie.user);
check('5) egasida bitta bildirishnoma', n.body.items.length, 1);
const it = n.body.items[0] || {};
check('5) tur, nishon turi va ID', [it.type, it.targetType, it.targetId], ['support_reply', 'support', String(m1.body.id)]);
check('5) aktyorsiz: sarlavha bo‘sh, o‘qilmagan', [it.title, it.actorCode, it.read], ['', '', false]);
check('5) o‘qilmaganlar sanog‘ida', n.body.unreadCount, 1);
check('5) begonaga bildirishnoma yo‘q', (await notifs(cookie.other)).body.items, []);
check('5) bazada aktyor NULL', sqlite.prepare(`SELECT actor_user_id AS a FROM notifications WHERE kind = 'support_reply'`).get()?.a, null);

// ── 6) planned va resolved bilan javob ───────────────────────────────
r = await reply(m2.body.id, { reply: 'Rahmat! Taklifingiz qabul qilindi.', status: 'planned' });
check('6) planned: 200', [r.status, r.body?.status, statusOf(m2.body.id)], [200, 'planned', 'planned']);
r = await reply(m3.body.id, { reply: 'Muammo hal qilindi.', status: 'resolved' });
check('6) resolved: 200', [r.status, r.body?.status, statusOf(m3.body.id)], [200, 'resolved', 'resolved']);
n = await notifs(cookie.user);
check('6) har javobga alohida bildirishnoma', n.body.items.map((i) => i.targetId).sort(), [m1.body.id, m2.body.id, m3.body.id].map(String).sort());
check('6) o‘qilmagan — 3', n.body.unreadCount, 3);
// Bitta murojaatga ikkinchi javob — yangi bildirishnoma (NULL aktyor dedup'ni to'smaydi).
r = await reply(m3.body.id, { reply: 'Yana bir izoh', status: 'resolved' });
check('6) ikkinchi javob: 200', r.status, 200);
check('6) ikkinchi javob ham yetib bordi', (await notifs(cookie.user)).body.unreadCount, 4);
// O'qildi qilish ishlaydi.
r = await call(`/api/notifications/${it.id}/read`, { method: 'POST', cookie: cookie.user });
check('6) o‘qildi qilish', [r.status, r.body?.unreadCount], [200, 3]);

// ── 7) Holatni matnsiz o'zgartirish ──────────────────────────────────
const before = sqlite.prepare(`SELECT COUNT(*) AS n FROM notifications`).get().n;
r = await setStatus(m1.body.id, { status: 'resolved' });
check('7) holat: resolved', [r.status, r.body?.status, statusOf(m1.body.id)], [200, 'resolved', 'resolved']);
r = await setStatus(m4.body.id, { status: 'planned' });
check('7) javobsiz murojaat — planned', [r.status, statusOf(m4.body.id)], [200, 'planned']);
r = await setStatus(m4.body.id, { status: 'pending' });
check('7) qaytadan pending', [r.status, statusOf(m4.body.id)], [200, 'pending']);
r = await setStatus(m1.body.id, { status: 'done' });
check('7) noto‘g‘ri holat — 422', [r.status, r.body?.error], [422, 'bad_status']);
r = await setStatus(m1.body.id, {});
check('7) holatsiz — 422', [r.status, r.body?.error], [422, 'bad_status']);
check('7) yo‘q murojaat — 404', (await setStatus(999999, { status: 'resolved' })).status, 404);
check('7) holat o‘zgarishi bildirishnoma yubormaydi', sqlite.prepare(`SELECT COUNT(*) AS n FROM notifications`).get().n, before);
check('7) javob matni saqlanib qoldi', sqlite.prepare(`SELECT reply FROM support_messages WHERE id = ?`).get(m1.body.id).reply, 'Ilovani yangilang, tezlashdi.');

// ── 8) Ro'yxat: filtr va sanoq ───────────────────────────────────────
// Hozir: m1 resolved, m2 planned, m3 resolved, m4 pending. Eski qator — 'replied'.
sqlite.prepare(`INSERT INTO support_messages (user_id, message, reply, status, created_at, replied_at) VALUES (2, 'eski', 'eski javob', 'replied', '2025-01-01 00:00:00', '2025-01-02 00:00:00')`).run();
r = await list();
check('8) hammasi: 5 ta', r.body.messages.length, 5);
check('8) sanoq', r.body.counts, { pending: 1, replied: 1, resolved: 2, planned: 1, total: 5 });
// Eski maydonlar joyida; admin audit (2026-10) faqat QO'SHDI: javoblar tarixi, ilova platformasi va build.
check('8) eski maydonlar joyida', ['createdAt', 'id', 'message', 'repliedAt', 'reply', 'status', 'userCode', 'userEmail', 'userId'].every((k) => k in r.body.messages[0]), true);
check('8) yangi maydonlar', Object.keys(r.body.messages[0]).filter((k) => !['createdAt', 'id', 'message', 'repliedAt', 'reply', 'status', 'userCode', 'userEmail', 'userId'].includes(k)).sort(), ['appBuild', 'platform', 'replies']);
const ids = async (q) => (await list(q)).body.messages.map((m) => m.id).sort((a, b) => a - b);
check('8) filtr: pending', await ids('?status=pending'), [m4.body.id]);
check('8) filtr: resolved', await ids('?status=resolved'), [m1.body.id, m3.body.id].sort((a, b) => a - b));
check('8) filtr: planned', await ids('?status=planned'), [m2.body.id]);
check('8) filtr: replied (eski qator)', (await list('?status=replied')).body.messages.map((m) => m.message), ['eski']);
check('8) noma’lum filtr — hammasi', (await ids('?status=xyz')).length, 5);
check('8) sanoq filtrdan qat’i nazar umumiy', (await list('?status=planned')).body.counts.total, 5);

// ── 9) Foydalanuvchi ro'yxati — shakl o'zgarmagan ────────────────────
r = await call('/api/support', { cookie: cookie.user });
check('9) foydalanuvchi o‘z murojaatlarini ko‘radi', r.body.messages.length, 3);
check('9) maydonlar o‘zgarmagan', Object.keys(r.body.messages[0]).sort(), ['createdAt', 'id', 'message', 'repliedAt', 'reply', 'status']);
check('9) yangi holatlar ko‘rinadi', r.body.messages.map((m) => m.status).sort(), ['planned', 'resolved', 'resolved']);
checkTrue('9) javob matni bor', r.body.messages.every((m) => m.reply));

// ── 10) Manager ham (ruxsat avvalgidek — har qanday admin sessiyasi) ─
sqlite.prepare(`INSERT OR IGNORE INTO admins (id, phone, password_hash, role, totp_enabled) VALUES (2, '+998900000002', 'x', 'manager', 0)`).run();
r = await reply(m4.body.id, { reply: 'Batafsilroq yozing.' }, cookie.manager);
check('10) manager javob bera oladi', [r.status, statusOf(m4.body.id)], [200, 'replied']);
check('10) begonaga (m4 egasi) bildirishnoma keldi', (await notifs(cookie.other)).body.items.map((i) => [i.type, i.targetId]), [['support_reply', String(m4.body.id)]]);

// ── 11) Javoblar tarixi, 4000 belgi, sahifalash, platforma (admin audit) ──
{
  const h = await send(cookie.user, 'Tarix uchun murojaat');
  await reply(h.body.id, { reply: 'Birinchi javob', status: 'planned' });
  const long = 'x'.repeat(3900);
  await reply(h.body.id, { reply: long, status: 'resolved' });
  const item = (await list()).body.messages.find((m) => m.id === h.body.id);
  check('11) tarix: ikkala javob tartibda', item.replies.map((x) => [x.reply.length, x.status]), [[14, 'planned'], [3900, 'resolved']]);
  check('11) oxirgisi `reply` da (moslik)', item.reply.length, 3900);
  check('11) 4000 belgigacha', (await reply(h.body.id, { reply: 'y'.repeat(5000) })).status, 200);
  check('11) 4000 da kesildi', sqlite.prepare(`SELECT length(reply) AS n FROM support_messages WHERE id = ?`).get(h.body.id).n, 4000);
  const old = (await list('?status=replied')).body.messages.find((m) => m.message === 'eski');
  check('11) eski javob (jadvalgacha) — tarixda bitta', old.replies.map((x) => x.reply), ['eski javob']);
  await call('/api/auth/me', { cookie: cookie.user, headers: { 'x-app': 'nova', 'x-client': 'ios', 'x-app-build': '77' } });
  const withApp = (await list()).body.messages.find((m) => m.id === h.body.id);
  check('11) ilova platformasi va build', [withApp.platform, withApp.appBuild], ['ios', 77]);
  const page = await list('?limit=2');
  check('11) sahifalash: limit + hasMore', [page.body.messages.length, page.body.hasMore], [2, true]);
}

done();
