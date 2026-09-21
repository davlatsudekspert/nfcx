// UMUMIY BILDIRISHNOMA TIZIMI — ilova va sayt uchun bitta.
//
// Haqiqiy `hosting/worker.js` + xotiradagi SQLite (d1-harness).
// Production D1/R2 ga TEGMAYDI.
//
//   node scripts/test-notifications.mjs

import worker from '../hosting/worker.js';
import { makeEnv, seedBasic, req, cookie, makeChecker } from './lib/d1-harness.mjs';

const { env } = makeEnv();
await seedBasic(env);
const { check, checkTrue, done } = makeChecker();

// user#1 — "A" (harakat qiluvchi), user#2 — "B" (qabul qiluvchi).
// B ning kartasi OTH222, A niki VIP001.
//
// Izoh yozish Premium talab qiladi (egasining qarori), shuning
// uchun A ga Premium beriladi — aks holda 3-sinov 403 da to'xtardi
// va biz tekshirmoqchi bo'lgan narsaga yetib bormasdi.
await env.DB.prepare(`UPDATE users SET is_premium = 1 WHERE id = 1`).run();

// B ning posti.
// `posts` da matn ustuni `caption` deb ataladi (`text` emas) —
// sxemadan tekshirildi.
await env.DB.prepare(
  `INSERT INTO posts (id, code, user_id, caption, created_at)
   VALUES (10, 'OTH222', 2, 'B ning posti', '2026-01-01 00:00:00')`
).run();

const call = async (path, init = {}) => {
  const res = await worker.fetch(req(path, init), env);
  return { status: res.status, body: await res.json().catch(() => null) };
};
const asA = { cookie: cookie.user };   // user#1
const asB = { cookie: cookie.other };  // user#2

const countFor = async (userId) => {
  const r = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM notifications WHERE recipient_user_id = ?`
  ).bind(userId).first().catch(() => ({ n: -1 }));
  return Number(r?.n ?? -1);
};

// ── 1) OBUNA ─────────────────────────────────────────────────────
const follow = await call('/api/follow/OTH222', { method: 'POST', cookie: cookie.user, json: {} });
checkTrue('1) obuna o’tdi', follow.status === 200);
check('1) B da bitta bildirishnoma', await countFor(2), 1);

// ── 2) LIKE ──────────────────────────────────────────────────────
await call('/api/posts/10/like', { method: 'POST', ...asA });
check('2) like bildirishnoma qo’shdi', await countFor(2), 2);

// ── 5) TAKRORIY LIKE — YANGI BILDIRISHNOMA YO’Q ──────────────
// Like olinadi va qayta qo'yiladi: unique indeks takrorini to'sadi.
await call('/api/posts/10/like', { method: 'POST', ...asA });  // oldi
await call('/api/posts/10/like', { method: 'POST', ...asA });  // qayta qo'ydi
check('5) takroriy like YANGI bildirishnoma bermadi', await countFor(2), 2);

// ── 3) IZOH ──────────────────────────────────────────────────────
const cmt = await call('/api/comments/post/10', { method: 'POST', ...asA, json: { body: 'Zo’r post' } });
checkTrue('3) izoh yozildi', cmt.status === 200 || cmt.status === 201);
check('3) izoh bildirishnoma qo’shdi', await countFor(2), 3);

// ── 4) O’ZIGA BILDIRISHNOMA YO’Q ──────────────────────────
// B o'z postiga like bosadi.
const beforeSelf = await countFor(2);
await call('/api/posts/10/like', { method: 'POST', ...asB });
check('4) o’z postiga like — bildirishnoma yaratmadi', await countFor(2), beforeSelf);

// ── 6) RO’YXAT — FAQAT EGASINIKI ───────────────────────────────
const listB = await call('/api/notifications', asB);
check('6) B o’z ro’yxatini oldi', listB.status, 200);
check('6) uchta yozuv', listB.body.items.length, 3);
check('6) hammasi o’qilmagan', listB.body.unreadCount, 3);

const listA = await call('/api/notifications', asA);
check('6) A da bildirishnoma yo’q', listA.body.items.length, 0);

// Kirmagan odam.
const anon = await call('/api/notifications');
check('6) tokensiz — ruxsatsiz', anon.status, 401);

// ── 7) BEGONA BILDIRISHNOMANI O’QILDI QILIB BO’LMAYDI ──────
const firstId = listB.body.items[0].id;
const foreign = await call(`/api/notifications/${firstId}/read`, { method: 'POST', ...asA });
check('7) begona yozuv — rad etildi', foreign.status, 404);
const stillUnread = await call('/api/notifications', asB);
check('7) rad etilgandan keyin ham o’qilmagan', stillUnread.body.unreadCount, 3);

// ── 8) O’QILDI ───────────────────────────────────────────────
const readOne = await call(`/api/notifications/${firstId}/read`, { method: 'POST', ...asB });
check('8) o’qildi qilindi', readOne.status, 200);
check('8) o’qilmaganlar kamaydi', readOne.body.unreadCount, 2);

// Takroriy so'rov — xato emas (idempotent).
const readAgain = await call(`/api/notifications/${firstId}/read`, { method: 'POST', ...asB });
check('8) takroriy o’qildi — xato emas', readAgain.status, 200);
check('8) sanoq o’zgarmadi', readAgain.body.unreadCount, 2);

// ── 8b) QURILMALARARO SINXRONIZATSIYA ────────────────
//
// Ilova va sayt BITTA jadvalni o'qiydi, shuning uchun bir joyda
// o'qilgan xabar ikkinchisida ham o'qilgan bo'lishi kerak. Bu
// yerda "ikkinchi mijoz" — YANGI ro'yxat so'rovi: u holatni
// qurilmadan emas, serverdan oladi.
const otherClient = await call('/api/notifications', asB);
const syncedItem = otherClient.body.items.find((x) => x.id === firstId);
check('8b) boshqa mijozda ham O’QILGAN', syncedItem?.read, true);
check('8b) boshqa mijozda sanoq ham bir xil', otherClient.body.unreadCount, 2);

// ── 9) HAMMASINI O’QILDI ────────────────────────────────────
const all = await call('/api/notifications/read-all', { method: 'POST', ...asB });
check('9) hammasi o’qildi', all.body.unreadCount, 0);
const afterAll = await call('/api/notifications', asB);
check('9) ro’yxatda ham nol', afterAll.body.unreadCount, 0);
check('9) yozuvlar YO’QOLMADI', afterAll.body.items.length, 3);

// ── 10) O’CHIRILGAN NISHON ILOVANI YIQITMAYDI ────────────────
await env.DB.prepare(`DELETE FROM posts WHERE id = 10`).run();
const afterDelete = await call('/api/notifications', asB);
check('10) post o’chirilgach ham ro’yxat ochiladi', afterDelete.status, 200);
checkTrue('10) yozuvlar joyida', afterDelete.body.items.length === 3);

// Aktyorning kartasi o'chirilsa ham.
await env.DB.prepare(`DELETE FROM cards WHERE code = 'VIP001'`).run();
const noActor = await call('/api/notifications', asB);
check('10) aktyor kartasi o’chirilgach ham ochiladi', noActor.status, 200);

// ── QO’SHIMCHA: yozuvning shakli ───────────────────────────────
const item = afterDelete.body.items[0];
checkTrue('shakl: id bor', typeof item.id === 'number' && item.id > 0);
checkTrue('shakl: type follow/like/comment', ['follow', 'like', 'comment'].includes(item.type));
checkTrue('shakl: read maydoni bor', typeof item.read === 'boolean');
checkTrue('shakl: createdAt bor', !!item.createdAt);

done();
