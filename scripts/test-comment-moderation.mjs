// IZOH MODERATSIYASI — SOFT-DELETE VA DALIL ARXIVI.
//
// Haqiqiy `hosting/worker.js` + xotiradagi SQLite (d1-harness).
// Production D1/R2 ga TEGMAYDI.
//
//   node scripts/test-comment-moderation.mjs
//
// NIMA UCHUN BU TEST BOR.
//
// Izoh DELETE qilinganda qator jadvaldan butunlay yo'qolardi.
// Ya'ni haqorat yozgan odam uni o'zi o'chirib, keyin "men bunday
// yozmadim" deyishi mumkin edi — va bizda javob yo'q edi.
//
// Endi o'chirish ikki ish qiladi: ommadan yashiradi VA to'liq
// nusxasini arxivga yozadi. Bu testning butun vazifasi — o'sha
// ikkalasi ham HAQIQATDAN bajarilishini tekshirish, va arxivga
// maxfiy narsa (admin sessiya kaliti) tushib qolmasligini.

import worker from '../hosting/worker.js';
import { makeEnv, seedBasic, req, cookie, makeChecker } from './lib/d1-harness.mjs';

const { env } = makeEnv();
await seedBasic(env);
const { check, checkTrue, done } = makeChecker();

// Izoh yozish Premium talab qiladi (egasining qarori).
await env.DB.prepare(`UPDATE users SET is_premium = 1 WHERE id = 1`).run();
await env.DB.prepare(`UPDATE users SET is_premium = 1 WHERE id = 2`).run();

// user#2 ning posti — user#1 unga izoh yozadi.
await env.DB.prepare(
  `INSERT INTO posts (id, code, user_id, caption, created_at)
   VALUES (10, 'OTH222', 2, 'B ning posti', '2026-01-01 00:00:00')`
).run();

const call = async (path, init = {}) => {
  const res = await worker.fetch(req(path, init), env);
  return { status: res.status, body: await res.json().catch(() => null) };
};
const asA = { cookie: cookie.user };    // user#1 — izoh muallifi
const asB = { cookie: cookie.other };   // user#2 — post egasi
const asAdmin = { cookie: cookie.admin };

const write = async (body, who = asA) =>
  (await call('/api/comments/post/10', { method: 'POST', ...who, json: { body } }))
    .body?.comment?.id;

const liveCount = async () => (await call('/api/comments/post/10')).body?.total;
const rowsIn = async (sql, ...args) =>
  (await env.DB.prepare(sql).bind(...args).all().catch(() => null))?.results || [];

// ── 1) MUALLIF O'Z IZOHINI O'CHIRADI ─────────────────────────────
const c1 = await write('birinchi izoh');
checkTrue('1) izoh yozildi', Number.isInteger(c1) && c1 > 0);
check('1) sanoq 1', await liveCount(), 1);

const del1 = await call(`/api/comments/${c1}`, { method: 'DELETE', ...asA });
check('1) o‘chirish o‘tdi', del1.status, 200);
check('1) ommaviy sanoq 0 ga tushdi', await liveCount(), 0);

// ── 2) QATOR JADVALDA QOLDI (yo'q qilinmadi) ─────────────────────
const live = await rowsIn(`SELECT * FROM content_comments WHERE id = ?`, c1);
check('2) qator jadvalda TURIBDI', live.length, 1);
checkTrue('2) unga deleted_at qo‘yilgan', !!live[0]?.deleted_at);
check('2) matn saqlanib qoldi', String(live[0]?.body || ''), 'birinchi izoh');

// ── 3) DALIL ARXIVI YOZILDI ──────────────────────────────────────
const arch = await rowsIn(`SELECT * FROM content_comment_archive WHERE comment_id = ?`, c1);
check('3) arxivda bitta yozuv', arch.length, 1);
check('3) arxivda matn aynan o‘zi', String(arch[0]?.body || ''), 'birinchi izoh');
check('3) arxivda muallif qayd etilgan', Number(arch[0]?.user_id), 1);
check('3) o‘chirgan odam qayd etilgan', Number(arch[0]?.deleted_by_user_id), 1);
check('3) o‘zi o‘chirgani belgilangan', String(arch[0]?.reason || ''), 'author');
checkTrue('3) hali tiklanmagan', arch[0]?.restored_at == null);

// ── 4) O'CHIRILGAN IZOH OMMAVIY RO'YXATDA YO'Q ───────────────────
const pub = await call('/api/comments/post/10');
check('4) ommaviy ro‘yxat bo‘sh', (pub.body?.comments || []).length, 0);

// ── 5) LENTA SANOG'I HAM O'CHIRILGANNI SANAMAYDI ─────────────────
// Bu alohida so'rov (`countsFor`) — u ham yangilanмagan bo'lsa,
// kadr ostida "izohlar: 1" turardi, ochganda esa hech nima.
const feed = await call('/api/feed', asB);
const row10 = (feed.body?.feed || []).find((f) => f.kind === 'post' && f.id === 10);
checkTrue('5) lentada post bor', !!row10);
check('5) lenta sanog‘i ham 0', Number(row10?.commentCount), 0);

// ── 6) TAKRORIY O'CHIRISH ARXIVGA IKKINCHI NUSXA YOZMAYDI ────────
await call(`/api/comments/${c1}`, { method: 'DELETE', ...asA });
check('6) arxivda hamon bitta yozuv',
  (await rowsIn(`SELECT * FROM content_comment_archive WHERE comment_id = ?`, c1)).length, 1);

// ── 7) POST EGASI BEGONA IZOHNI O'CHIRA OLADI ────────────────────
const c2 = await write('ikkinchi izoh');
const del2 = await call(`/api/comments/${c2}`, { method: 'DELETE', ...asB });
check('7) egasi o‘chira oldi', del2.status, 200);
check('7) arxivda "owner" deb belgilandi',
  String((await rowsIn(`SELECT * FROM content_comment_archive WHERE comment_id = ?`, c2))[0]?.reason || ''),
  'owner');

// ── 8) BEGONA ODAM O'CHIRA OLMAYDI ───────────────────────────────
const c3 = await write('uchinchi izoh');
// user#2 emas, user#1 emas — uchinchi odam kerak. Uni yaratamiz.
await env.DB.prepare(
  `INSERT INTO users (id, email, password_hash, is_premium) VALUES (3, 'c@x.uz', 'x', 1)`
).run();
await env.DB.prepare(
  `INSERT INTO sessions (token, user_id, expires_at) VALUES ('third-token', 3, '2099-01-01 00:00:00')`
).run();
const del3 = await call(`/api/comments/${c3}`, {
  method: 'DELETE', cookie: 'nfc_session=third-token',
});
check('8) begona odam o‘chira olmadi', del3.status, 403);
check('8) izoh joyida', await liveCount(), 1);

// ── 9) ADMIN: SABABSIZ O'CHIRIB BO'LMAYDI ────────────────────────
const noReason = await call(`/api/admin/comments/${c3}`, {
  method: 'DELETE', ...asAdmin, json: {},
});
check('9) sababsiz rad etildi', noReason.status, 422);
check('9) sababi aytildi', String(noReason.body?.error || ''), 'reason_required');
check('9) izoh hamon joyida', await liveCount(), 1);

// ── 10) ADMIN COOKIE'SIZ MODERATSIYA YO'Q ────────────────────────
check('10) cookie‘siz ro‘yxat yo‘q', (await call('/api/admin/comments')).status, 401);
check('10) cookie‘siz o‘chirish yo‘q',
  (await call(`/api/admin/comments/${c3}`, { method: 'DELETE', json: { reason: 'x' } })).status, 401);
check('10) oddiy foydalanuvchi admin emas',
  (await call('/api/admin/comments', asA)).status, 401);

// ── 11) ADMIN SABAB BILAN O'CHIRADI ──────────────────────────────
const modDel = await call(`/api/admin/comments/${c3}`, {
  method: 'DELETE', ...asAdmin, json: { reason: 'Haqoratli til' },
});
check('11) admin o‘chirdi', modDel.status, 200);
check('11) ommadan yo‘qoldi', await liveCount(), 0);

const a3 = (await rowsIn(`SELECT * FROM content_comment_archive WHERE comment_id = ?`, c3))[0];
check('11) sabab arxivda', String(a3?.reason || ''), 'Haqoratli til');
checkTrue('11) qaysi admin ekani yozilgan', /^admin#\d+:/.test(String(a3?.deleted_by_admin || '')));

// ── 12) ARXIVGA MAXFIY NARSA TUSHMADI ────────────────────────────
// `getCurrentAdmin` `{adminId, role, token}` qaytaradi. `token` —
// sessiya kaliti; u arxivga tushsa, admin paneli uni ochiq
// ko'rsatardi va istalgan moderator boshqasining sessiyasini
// o'g'irlay olardi.
const allArchive = await rowsIn(`SELECT * FROM content_comment_archive`);
const archiveText = JSON.stringify(allArchive);
checkTrue('12) arxivda admin sessiya kaliti YO‘Q',
  !archiveText.includes('admin-token') && !archiveText.includes('manager-token'));

// ── 13) ADMIN RO'YXATI: live / deleted / all ─────────────────────
const liveList = await call('/api/admin/comments?state=live', asAdmin);
check('13) live ro‘yxat bo‘sh', (liveList.body?.comments || []).length, 0);

const delList = await call('/api/admin/comments?state=deleted', asAdmin);
check('13) o‘chirilganlar 3 ta', (delList.body?.comments || []).length, 3);
checkTrue('13) o‘chirilganda deletedAt bor',
  (delList.body?.comments || []).every((c) => Number(c.deletedAt) > 0));

const allList = await call('/api/admin/comments?state=all', asAdmin);
check('13) hammasi 3 ta', (allList.body?.comments || []).length, 3);

// ── 14) ADMIN QIDIRUVI ───────────────────────────────────────────
const q = await call('/api/admin/comments?state=all&q=uchinchi', asAdmin);
check('14) qidiruv bitta topdi', (q.body?.comments || []).length, 1);
check('14) topilgani to‘g‘ri', Number(q.body?.comments?.[0]?.id), c3);

// ── 15) DALIL ARXIVI ENDPOINTI ───────────────────────────────────
const archApi = await call('/api/admin/comments/archive', asAdmin);
check('15) arxivda 3 ta voqea', (archApi.body?.items || []).length, 3);
checkTrue('15) har birida matn bor',
  (archApi.body?.items || []).every((i) => String(i.body || '').length > 0));
check('15) cookie‘siz arxiv yo‘q', (await call('/api/admin/comments/archive')).status, 401);

// ── 16) TIKLASH ──────────────────────────────────────────────────
const restore = await call(`/api/admin/comments/${c3}/restore`, { method: 'POST', ...asAdmin });
check('16) tiklandi', restore.status, 200);
check('16) ommaga qaytdi', await liveCount(), 1);

// Arxiv yozuvi O'CHIRILMAYDI — voqea qoladi.
const a3b = (await rowsIn(`SELECT * FROM content_comment_archive WHERE comment_id = ?`, c3))[0];
checkTrue('16) arxiv yozuvi JOYIDA qoldi', !!a3b);
checkTrue('16) unga "tiklandi" belgisi qo‘yildi', !!a3b?.restored_at);
check('16) sabab hamon ko‘rinadi', String(a3b?.reason || ''), 'Haqoratli til');

// ── 17) NOMA'LUM ADMIN YO'LI ANIQ 404 ────────────────────────────
check('17) noma‘lum admin yo‘li 404',
  (await call('/api/admin/comments/yoq/yoq', asAdmin)).status, 404);
check('17) mavjud bo‘lmagan izoh 404',
  (await call('/api/admin/comments/999999', { method: 'DELETE', ...asAdmin, json: { reason: 'x' } })).status, 404);

// ═══════════════════════════════════════════════════════════════════
// YO'L-YO'LAKAY TOPILGAN IKKI XATO — QAYTIB KELMASIN
// ═══════════════════════════════════════════════════════════════════

// ── 18) IZOH VAQTI HAQIQIY VAQT ──────────────────────────────────
//
// D1 sanasi `2026-09-21 02:46:37.595+00` ko'rinishida: offset
// MINUTSIZ. `Date.parse` bunday satrni tanimaydi va NaN beradi.
// `comments.js` da `Date.parse(...) || Date.now()` turardi —
// ya'ni HAR BIR izoh "hozir yozilgan" deb qaytardi. Ilovada
// hamma izohning vaqti noto'g'ri edi, lekin yangi izoh yozilganda
// natija to'g'ri ko'rinardi va shuning uchun sezilmasdi.
const oldCid = await write('eski izoh');
await env.DB.prepare(
  `UPDATE content_comments SET created_at = '2026-03-05 07:08:09.123+00' WHERE id = ?`
).bind(oldCid).run();

const withOld = await call('/api/comments/post/10');
const oldRow = (withOld.body?.comments || []).find((c) => c.id === oldCid);
checkTrue('18) eski izoh ro‘yxatda', !!oldRow);
check('18) vaqti SAQLANGAN sana, "hozir" emas',
  new Date(Number(oldRow?.createdAt)).toISOString().slice(0, 10), '2026-03-05');

// ── 19) BLOKLANGAN ODAM IZOH YOZA OLMAYDI ────────────────────────
//
// `getCurrentUser` ban muddatini allaqachon `parseDbDate` bilan
// hisoblaydi. `comments.js` esa uning ustiga IKKINCHI tekshiruv
// qo'ygan edi — `Date.parse(...) > Date.now()`. U NaN qaytarib,
// shart DOIM `false` bo'lardi: ya'ni bloklangan odam auksionda
// qatnasha olmasdi, lekin izohni bemalol yozaverardi.
await env.DB.prepare(
  `UPDATE users SET banned_until = '2099-01-01 00:00:00+00' WHERE id = 1`
).run();
const banned = await call('/api/comments/post/10', {
  method: 'POST', ...asA, json: { body: 'bloklangan odamning izohi' },
});
check('19) bloklangan odam rad etildi', banned.status, 403);
check('19) sababi aytildi', String(banned.body?.error || ''), 'banned');

// Muddati O'TGAN ban esa to'sib qo'ymasligi kerak.
await env.DB.prepare(
  `UPDATE users SET banned_until = '2020-01-01 00:00:00+00' WHERE id = 1`
).run();
const unbanned = await call('/api/comments/post/10', {
  method: 'POST', ...asA, json: { body: 'muddati o‘tgan ban to‘smaydi' },
});
check('19) muddati o‘tgan ban to‘smaydi', unbanned.status, 201);

// ═══════════════════════════════════════════════════════════════════
// 20) SAYT UCHUN IZOHLAR SONI
// ═══════════════════════════════════════════════════════════════════
//
// Sayt post ostida "Izohlar · 4" ko'rsatadi. Son bo'lmasa u
// "izoh yozish" deb turardi va odam ichida gap borligini
// BILMASDI — ya'ni mavjud izohlar ko'rinmay qolardi.
//
// Eng muhimi: O'CHIRILGAN izoh sanalmasligi kerak. Aks holda
// "Izohlar · 4" yozuvini bosgan odam uchtasini ko'rardi.
await env.DB.prepare(`UPDATE users SET banned_until = NULL WHERE id = 1`).run();

const listPath = '/api/records/OTH222/posts';
const postsOf = async () => (await call(listPath, asA)).body?.posts || [];

const fresh = (await postsOf()).find((p) => Number(p.id) === 10);
checkTrue('20) post ro‘yxatda', !!fresh);
check('20) sanoq maydoni BOR', typeof fresh?.commentCount, 'number');

const before = Number(fresh?.commentCount) || 0;
const newId = await write('sayt uchun izoh');
checkTrue('20) izoh yozildi', Number.isInteger(newId));
check('20) sanoq oshdi',
  Number((await postsOf()).find((p) => Number(p.id) === 10)?.commentCount), before + 1);

await call(`/api/comments/${newId}`, { method: 'DELETE', ...asA });
check('20) o‘chirilgani SANALMAYDI',
  Number((await postsOf()).find((p) => Number(p.id) === 10)?.commentCount), before);

// ── 21) KOMPANIYA POSTIDA HAM ────────────────────────────────────
// IKKI QOIDA, IKKALASI HAM SXEMADAN TEKSHIRILDI:
//   * `tier`, `price`, `updated_at` — NOT NULL;
//   * `company_id` KATTA HARFDA. Server uni `companyId()` bilan
//     normallashtiradi ('nova' -> 'NOVA'), shuning uchun kichik
//     harfli qator hech qachon topilmasdi va ro'yxat bo'sh
//     kelardi — xato emas, shunchaki bo'sh.
await env.DB.prepare(
  `INSERT INTO companies
     (company_id, owner_user_id, display_name, tier, price, status, created_at, updated_at)
   VALUES ('NOVA', '2', 'Nova', 'basic', 0, 'active',
           '2026-01-01 00:00:00', '2026-01-01 00:00:00')`
).run();
await env.DB.prepare(
  `INSERT INTO company_posts (id, company_id, caption, created_at)
   VALUES (5, 'NOVA', 'kompaniya posti', '2026-01-01 00:00:00')`
).run();

const coPosts = async () =>
  (await call('/api/companies/NOVA/posts', asA)).body?.posts || [];
const coPost = (await coPosts()).find((p) => Number(p.id) === 5);
checkTrue('21) kompaniya posti ro‘yxatda', !!coPost);
check('21) sanoq maydoni BOR', typeof coPost?.commentCount, 'number');
check('21) boshida nol', Number(coPost?.commentCount), 0);

const coComment = (await call('/api/comments/company_post/5', {
  method: 'POST', ...asA, json: { body: 'narxi qancha?' },
})).body?.comment?.id;
checkTrue('21) kompaniya postiga izoh yozildi', Number.isInteger(coComment));
check('21) sanoq oshdi',
  Number((await coPosts()).find((p) => Number(p.id) === 5)?.commentCount), 1);

done('Izoh moderatsiyasi');
