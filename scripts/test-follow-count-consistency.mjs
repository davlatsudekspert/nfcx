// OBUNACHI SONI VA RO'YXATI — HAMMA JOYDA BIR XIL.
//
// ═══ NIMA UCHUN BU FAYL BOR ═══
//
// Play testeri (2026-09): "Obunachilar bir-biriga to'g'ri kelmayapti".
// Profilda "5 obunachi" turardi, raqam bosilganda ro'yxatda kamroq
// odam chiqardi.
//
// Sabab: sanoq `COUNT(*) FROM follows` edi — hamma qator. Ro'yxat esa
// faqat O'CHIRILMAGAN va kamida bitta OMMAVIY kartasi bor odamlarni
// ko'rsatadi. O'chirilgan sinov hisoblari va yashirin profillar
// sanoqda bor, ro'yxatda yo'q edi.
//
// Bu test to'rt xil obunachi bilan (oddiy, o'chirilgan, yashirin,
// kartasiz) HAR BIR sanoq manbasini ro'yxat uzunligi bilan
// SOLISHTIRADI:
//
//   * /api/follow-stats/:code     — profil
//   * /api/follow-list/:code      — ro'yxat (haqiqat)
//   * /api/auth/me                — o'z kartamdagi son (Home)
//   * /api/records                — katalog ro'yxati (Tanlov)
//   * /api/companies/:id          — biznes profili
//
//   node scripts/test-follow-count-consistency.mjs

import worker, { ensureCoreSchema } from '../hosting/worker.js';
import { makeEnv, seedBasic, req, cookie, makeChecker } from './lib/d1-harness.mjs';

const { check, done } = makeChecker();

const { env } = makeEnv({});
await ensureCoreSchema(env);
await seedBasic(env);

const get = (path, init = {}) => worker.fetch(req(path, init), env);
const json = async (path, init) => (await get(path, init)).json();

// ===== URUG' =====
//   3 — hisobi O'CHIRILGAN
//   4 — yagona kartasi katalogdan YASHIRILGAN
//   5 — kartasi UMUMAN yo'q
//   6 — oddiy, ko'rinadigan
const users = [
  [3, 'deleted@test.local', '2026-09-20T00:00:00.000Z'],
  [4, 'hidden@test.local', null],
  [5, 'nocard@test.local', null],
  [6, 'normal@test.local', null],
];
for (const [id, email, deleted] of users) {
  await env.DB.prepare(
    `INSERT INTO users (id, email, password_hash, deleted_at) VALUES (?, ?, 'x', ?)`
  ).bind(id, email, deleted).run();
}
for (const [code, uid, hidden] of [['DEL333', 3, 0], ['HID444', 4, 1], ['NRM666', 6, 0]]) {
  await env.DB.prepare(
    `INSERT INTO cards (code, name, price, ts, user_id, profile_type, hidden_from_directory)
       VALUES (?, ?, 0, 1000, ?, 'personal', ?)`
  ).bind(code, code, uid, hidden).run();
}

// Hamma 1-foydalanuvchiga (VIP001 egasi) obuna.
for (const f of [2, 3, 4, 5, 6]) {
  await env.DB.prepare(
    `INSERT INTO follows (follower_id, followee_id) VALUES (?, 1)`
  ).bind(f).run();
}
// 1-foydalanuvchi esa 2, 3, 4, 5 ga obuna.
for (const f of [2, 3, 4, 5]) {
  await env.DB.prepare(
    `INSERT INTO follows (follower_id, followee_id) VALUES (1, ?)`
  ).bind(f).run();
}

// ===== 1) SHAXSIY PROFIL =====
const followers = (await json('/api/follow-list/VIP001?dir=followers')).list || [];
const following = (await json('/api/follow-list/VIP001?dir=following')).list || [];
const stats = await json('/api/follow-stats/VIP001');

// Ro'yxat — haqiqat: faqat 2 va 6 ko'rinadi.
check('1) obunachilar ro‘yxati: faqat ko‘rinadiganlar',
  followers.map((r) => r.code).sort(), ['NRM666', 'OTH222']);
check('1) obunalar ro‘yxati: faqat ko‘rinadiganlar',
  following.map((r) => r.code), ['OTH222']);

check('1) follow-stats obunachi = ro‘yxat', stats.followers, followers.length);
check('1) follow-stats obuna = ro‘yxat', stats.following, following.length);

// ===== 2) O'Z KARTAM (Home) =====
{
  const me = await json('/api/auth/me', { cookie: cookie.user });
  const vip = (me.cards || []).find((c) => c.code === 'VIP001');
  check('2) /api/auth/me obunachi = ro‘yxat', vip?.followers, followers.length);
}

// ===== 3) KATALOG RO'YXATI (Tanlov) =====
{
  const all = await json('/api/records');
  const vip = (Array.isArray(all) ? all : []).find((r) => r.code === 'VIP001');
  check('3) /api/records obunachi = ro‘yxat', Number(vip?.followers), followers.length);
}

// ===== 4) BIZNES PROFILI =====
const CO = 'CNTTEST';
await env.DB.prepare(
  `INSERT INTO companies
     (company_id, owner_user_id, display_name, tier, price, status, created_at, updated_at)
   VALUES (?, '2', 'Sanoq Test', 'basic', 0, 'active', '2026-09-22', '2026-09-22')`
).bind(CO).run();
for (const uid of [1, 3, 4, 5, 6]) {
  await env.DB.prepare(
    `INSERT OR IGNORE INTO company_follows (company_id, user_id, created_at) VALUES (?, ?, '2026-09-22')`
  ).bind(CO, uid).run();
}
{
  const list = (await json(`/api/follow-list/${CO}?dir=followers`)).list || [];
  check('4) biznes obunachilari: faqat ko‘rinadiganlar',
    list.map((r) => r.code).sort(), ['NRM666', 'VIP001']);
  const st = await json(`/api/follow-stats/${CO}`);
  check('4) biznes follow-stats = ro‘yxat', st.followers, list.length);
  const res = await get(`/api/companies/${CO}`);
  const body = await res.json().catch(() => ({}));
  const company = body.company || body;
  check('4) biznes profili obunachi = ro‘yxat', Number(company?.followers), list.length);
}

done();
