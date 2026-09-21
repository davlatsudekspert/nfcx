// RO'YXATDAGI OBUNACHI VA POST SONI.
//
// ═══ NIMA UCHUN BU FAYL BOR ═══
//
// Egasi telefonda ko'rdi: Tanlov ro'yxatida hamma odamning
// "Obunachilar" va "Postlar" soni 0 edi, lekin O'SHA odamning
// profilini ochganda 5 obunachi ko'rinardi.
//
// Sabab hisoblashda emas: ro'yxat javobida bu ikki maydon UMUMAN
// yo'q edi, mijoz esa yo'q maydonni 0 deb o'qiydi. Ya'ni ekranda
// turgan 0 — "obunachi yo'q" degani emas, "server aytmadi" degani.
//
// Bu test ikkala ro'yxatni ham profil bilan SOLISHTIRADI: raqam
// bir xil chiqishi shart. Agar kimdir kelajakda `SELECT` dan
// `user_id` ni yoki `socialCountsD1()` chaqiruvini olib tashlasa —
// shu yerda yiqiladi.
//
//   node scripts/test-list-social-counts.mjs

import worker, { ensureCoreSchema } from '../hosting/worker.js';
import { makeEnv, seedBasic, req, makeChecker } from './lib/d1-harness.mjs';

const { check, checkTrue, done } = makeChecker();

const { env } = makeEnv({});
await ensureCoreSchema(env);
await seedBasic(env);

const get = (path) => worker.fetch(req(path), env);

// ===== URUG': 2-foydalanuvchi 1-foydalanuvchiga obuna, VIP001 da 2 post =====
//
// `follows` FOYDALANUVCHI bo'yicha ishlaydi, `posts` esa KOD
// bo'yicha — shuning uchun ikkalasi alohida urug'lanadi.
await env.DB.prepare(
  `CREATE TABLE IF NOT EXISTS follows (
     follower_id INTEGER, followee_id INTEGER, created_at TEXT,
     PRIMARY KEY (follower_id, followee_id))`
).run().catch(() => {});
await env.DB.prepare(
  `INSERT INTO follows (follower_id, followee_id, created_at) VALUES (2, 1, '2026-09-21')`
).run();

for (const t of ['birinchi', 'ikkinchi']) {
  await env.DB.prepare(
    `INSERT INTO posts (code, user_id, caption, created_at)
       VALUES ('VIP001', 1, ?, '2026-09-21')`
  ).bind(t).run();
}

// ===== 1) PROFIL NIMA DEYDI =====
//
// Bu HAQIQAT manbai: ro'yxat shunga mos kelishi kerak.
let profileFollowers = null;
{
  const res = await get('/api/follow-stats/VIP001');
  const body = await res.json().catch(() => ({}));
  check('1) follow-stats 200', res.status, 200);
  profileFollowers = Number(body.followers);
  check('1) profilda obunachi soni', profileFollowers, 1);
}

// ===== 2) KATALOG RO'YXATI — /api/records =====
{
  const res = await get('/api/records');
  const body = await res.json();
  check('2) /api/records 200', res.status, 200);

  const vip = (Array.isArray(body) ? body : []).find((r) => r.code === 'VIP001');
  checkTrue('2) VIP001 ro‘yxatda bor', !!vip);

  // ASOSIY TEKSHIRUV: maydon BOR va profil bilan bir xil.
  checkTrue('2) followers maydoni yuborilgan', vip?.followers !== undefined);
  check('2) followers profil bilan bir xil', Number(vip?.followers), profileFollowers);
  checkTrue('2) posts maydoni yuborilgan', vip?.posts !== undefined);
  check('2) posts soni', Number(vip?.posts), 2);

  // Obunachisi yo'q odam 0 bo'lib qolsin — "hammaga bir xil son
  // qo'yib qo'yildi" degan xato ham shu yerda tutiladi.
  const oth = (Array.isArray(body) ? body : []).find((r) => r.code === 'OTH222');
  check('2) begona kartada obunachi 0', Number(oth?.followers), 0);
  check('2) begona kartada post 0', Number(oth?.posts), 0);
}

// ===== 3) QIDIRUV RO'YXATI — /api/records/search =====
{
  const res = await get('/api/records/search?q=Muhammad');
  const body = await res.json();
  check('3) qidiruv 200', res.status, 200);

  const vip = (body.records || []).find((r) => r.code === 'VIP001');
  checkTrue('3) VIP001 topildi', !!vip);
  checkTrue('3) followers maydoni yuborilgan', vip?.followers !== undefined);
  check('3) followers profil bilan bir xil', Number(vip?.followers), profileFollowers);
  check('3) posts soni', Number(vip?.posts), 2);

  // `user_id` HISOB uchun o'qiladi, lekin javobga CHIQMASLIGI
  // kerak — ichki identifikator mijozga kerak emas.
  checkTrue('3) user_id javobga chiqmagan', vip?.user_id === undefined);
}

done();
