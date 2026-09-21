// IZOHGA JAVOB VA IZOHGA LIKE.
//
// ═══ NIMA UCHUN BU FAYL BOR ═══
//
// Izohlar bor edi, lekin ular bir yo'nalishli: odam yozardi va unga
// javob berishning yo'li yo'q edi. Yoqtirish ham faqat kontentga
// qo'yilardi, izohga emas.
//
// Ikkalasi ham MAVJUD tizim ustiga qo'shildi: javob — o'sha
// `content_comments` jadvalida `parent_id` ustuni, like esa o'sha
// `content_likes` jadvali, turi `comment`. Parallel jadval ham,
// parallel endpoint ham yaratilmadi.
//
// Bu test aynan shu chegaralarni qo'riqlaydi:
//   * javob BIR QAVAT — javobga javob yozib bo'lmaydi;
//   * begona kontentning izohiga javob yozib bo'lmaydi;
//   * javob haqidagi xabar OTA IZOH MUALLIFIGA ketadi;
//   * like takrorlanmaydi va qayta bosilsa olinadi;
//   * o'chirilgan izohga na javob, na like.
//
//   node scripts/test-comment-threads.mjs

import worker from '../hosting/worker.js';
import { makeEnv, seedBasic, req, cookie, makeChecker } from './lib/d1-harness.mjs';

const { env } = makeEnv();
await seedBasic(env);
const { check, checkTrue, done } = makeChecker();

// Izoh yozish Premium talab qiladi — qoida o'zgarmadi.
await env.DB.prepare(`UPDATE users SET is_premium = 1 WHERE id = 1`).run();
await env.DB.prepare(`UPDATE users SET is_premium = 1 WHERE id = 2`).run();

// user#2 ning posti (OTH222) va user#1 ning posti (VIP001).
await env.DB.prepare(
  `INSERT INTO posts (id, code, user_id, caption, created_at)
   VALUES (10, 'OTH222', 2, 'B ning posti', '2026-01-01 00:00:00')`
).run();
await env.DB.prepare(
  `INSERT INTO posts (id, code, user_id, caption, created_at)
   VALUES (11, 'VIP001', 1, 'A ning posti', '2026-01-01 00:00:00')`
).run();

const call = async (path, init = {}) => {
  const res = await worker.fetch(req(path, init), env);
  return { status: res.status, body: await res.json().catch(() => null) };
};
const asA = { cookie: cookie.user };   // user#1
const asB = { cookie: cookie.other };  // user#2

const write = (post, body, who, parentId) =>
  call(`/api/comments/post/${post}`, {
    method: 'POST', ...who,
    json: parentId ? { body, parentId } : { body },
  });

// ===== 1) ODDIY IZOH =====
let r = await write(10, 'Birinchi izoh', asA);
check('1) izoh yozildi', r.status, 201);
const root = r.body?.comment?.id;
checkTrue('1) id qaytdi', Number.isInteger(root));
check('1) ota izohda parentId = 0', r.body?.comment?.parentId, 0);

// ===== 2) JAVOB =====
r = await write(10, 'Javob', asB, root);
check('2) javob yozildi', r.status, 201);
const reply = r.body?.comment?.id;
check('2) javobda parentId ota izoh', r.body?.comment?.parentId, root);

// ===== 3) BIR QAVAT — JAVOBGA JAVOB YO'Q =====
//
// Bo'lmasa zanjir cho'zilib, ilovada o'qilmay qolardi.
r = await write(10, 'Javobga javob', asA, reply);
check('3) javobga javob -> 422',
  [r.status, r.body?.error], [422, 'nested_reply_not_allowed']);

// ===== 4) BEGONA KONTENT IZOHIGA JAVOB YO'Q =====
//
// `root` 10-postning izohi. Uni 11-post ostiga "ko'chirish"
// urinishi rad etilishi kerak — aks holda qo'lda yuborilgan so'rov
// izohni boshqa post ostida ko'rsatardi.
r = await write(11, 'Boshqa post ostidan', asA, root);
check('4) begona ota izoh -> 404',
  [r.status, r.body?.error], [404, 'parent_not_found']);

// ===== 5) TARTIB: OTA VA JAVOBI BIRGA =====
{
  await write(10, 'Ikkinchi mavzu', asA);
  const list = (await call('/api/comments/post/10', asA)).body;
  const ids = (list.comments || []).map((c) => [c.id, c.parentId]);
  const rootAt = ids.findIndex(([i]) => i === root);
  const replyAt = ids.findIndex(([i]) => i === reply);
  checkTrue('5) javob otasidan KEYIN turadi', replyAt === rootAt + 1);
  check('5) jami sanoq javobni ham hisoblaydi', list.total, 3);
}

// ===== 6) IZOHGA LIKE =====
{
  let res = await call(`/api/content-likes/comment/${root}`, { method: 'POST', ...asB });
  check('6) like qo‘yildi', [res.status, res.body?.liked, res.body?.count], [200, true, 1]);

  // Takroriy bosish — OLIB TASHLAYDI, ikkinchi qator YARATMAYDI.
  res = await call(`/api/content-likes/comment/${root}`, { method: 'POST', ...asB });
  check('6) qayta bosish olib tashladi', [res.body?.liked, res.body?.count], [false, 0]);

  res = await call(`/api/content-likes/comment/${root}`, { method: 'POST', ...asB });
  check('6) uchinchi bosish qayta qo‘ydi', [res.body?.liked, res.body?.count], [true, 1]);

  const rows = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM content_likes WHERE target_kind = 'comment' AND target_id = ?`
  ).bind(root).first();
  check('6) bazada bitta qator', Number(rows.n), 1);
}

// ===== 7) RO'YXAT LIKE SANOG'INI BERADI =====
{
  const asBList = (await call('/api/comments/post/10', asB)).body;
  const mine = (asBList.comments || []).find((c) => c.id === root);
  check('7) like soni va holati (bosgan odam)', [mine.likes, mine.liked], [1, true]);

  const asAList = (await call('/api/comments/post/10', asA)).body;
  const other = (asAList.comments || []).find((c) => c.id === root);
  check('7) boshqa odamda liked=false', [other.likes, other.liked], [1, false]);

  const anon = (await call('/api/comments/post/10')).body;
  const pub = (anon.comments || []).find((c) => c.id === root);
  check('7) kirmagan odamda ham sanoq ko‘rinadi', [pub.likes, pub.liked], [1, false]);
}

// ===== 8) SESSIYASIZ LIKE YO'Q =====
{
  const res = await call(`/api/content-likes/comment/${root}`, { method: 'POST' });
  check('8) sessiyasiz -> 401', res.status, 401);
}

// ===== 9) MAVJUD BO'LMAGAN IZOH =====
{
  const res = await call('/api/content-likes/comment/999999', { method: 'POST', ...asA });
  check('9) yo‘q izohga like -> 404', res.status, 404);
}

// ===== 10) O'CHIRILGAN IZOHGA NA JAVOB, NA LIKE =====
{
  const del = await call(`/api/comments/${root}`, { method: 'DELETE', ...asA });
  check('10) muallif o‘chirdi', del.status, 200);

  let res = await write(10, 'O‘chirilganga javob', asB, root);
  check('10) o‘chirilganga javob -> 404', res.status, 404);

  res = await call(`/api/content-likes/comment/${root}`, { method: 'POST', ...asA });
  check('10) o‘chirilganga like -> 404', res.status, 404);
}

// ===== 11) JAVOB XABARI OTA IZOH MUALLIFIGA =====
//
// Ilgari izoh haqidagi xabar DOIM kontent egasiga ketardi. Javobda
// bu noto'g'ri: savol berilgan odam bilmay qolardi.
{
  const r2 = await write(11, 'A ning postiga izoh', asB);
  const rootOnA = r2.body?.comment?.id;
  await write(11, 'B ga javob', asA, rootOnA);

  const rows = await env.DB.prepare(
    `SELECT recipient_user_id, actor_user_id FROM notifications
      WHERE kind = 'comment' ORDER BY id DESC LIMIT 1`
  ).first();
  // Javobni user#1 yozdi, ota izoh muallifi — user#2.
  check('11) xabar ota izoh muallifiga',
    [Number(rows.recipient_user_id), Number(rows.actor_user_id)], [2, 1]);
}

done();
