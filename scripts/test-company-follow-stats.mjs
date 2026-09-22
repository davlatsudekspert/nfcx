// BIZNES PROFILIDA OBUNACHILAR SONI.
//
// ═══ NIMA UCHUN BU FAYL BOR ═══
//
// Egasi telefonda ko'rdi: biznes profilida "0 obunachi"
// turardi, holbuki odamlar obuna bo'lgan edi.
//
// Sabab: obunachilar IKKI JADVALDA yashaydi —
//
//     shaxsiy    -> follows          (followee_id = user id)
//     kompaniya  -> company_follows  (company_id)
//
// `/api/follow-stats/:code` esa faqat `getRecordOwner()` ni
// chaqirardi. U SHAXSIY karta egasini topadi va kompaniya
// identifikatori uchun `null` qaytaradi, javob esa
// `{followers: 0}` bo'lib tugardi.
//
// Nuqson bilinmasdi, chunki 0 xato emas: ekran uni "hali hech
// kim obuna bo'lmagan" deb ko'rsatardi.
//
// `/api/follow-list/:code` da bu ayni muammo allaqachon
// tuzatilgan edi — ya'ni ro'yxat to'g'ri, son noto'g'ri
// bo'lib qolgan. Bu test ikkalasini SOLIShTIRADI.
//
//   node scripts/test-company-follow-stats.mjs

import worker, { ensureCoreSchema } from '../hosting/worker.js';
import { makeEnv, seedBasic, req, cookie, makeChecker } from './lib/d1-harness.mjs';

const { check, checkTrue, done } = makeChecker();

const { env } = makeEnv({});
await ensureCoreSchema(env);
await seedBasic(env);

const get = (path, init = {}) => worker.fetch(req(path, init), env);

// ===== URUG': kompaniya va unga ikki obunachi =====
const CO = 'NFCTEST';
await env.DB.prepare(
  `INSERT INTO companies
     (company_id, owner_user_id, display_name, tier, price, status,
      created_at, updated_at)
   VALUES (?, '1', 'NFCSTORE Test', 'basic', 0, 'active',
           '2026-09-22', '2026-09-22')`
).bind(CO).run();

for (const uid of [1, 2]) {
  await env.DB.prepare(
    `INSERT OR IGNORE INTO company_follows (company_id, user_id, created_at)
       VALUES (?, ?, '2026-09-22')`
  ).bind(CO, uid).run();
}

// ===== 1) SON =====
{
  const res = await get(`/api/follow-stats/${CO}`);
  const body = await res.json().catch(() => ({}));
  check('1) follow-stats 200', res.status, 200);

  // ASOSIY TEKSHIRUV.
  check('1) kompaniya obunachilari sanaldi', Number(body.followers), 2);

  // Kompaniya kimgadir obuna bo'lolmaydi.
  check('1) following har doim 0', Number(body.following), 0);
}

// ===== 2) SON RO'YXAT BILAN MOS KELSIN =====
//
// Ikkalasi boshqa-boshqa raqam bersa, odam "5 obunachi" deb
// bosadi va ro'yxatda 2 tasini ko'radi.
{
  const res = await get(`/api/follow-list/${CO}?dir=followers`);
  const body = await res.json().catch(() => ({}));
  check('2) follow-list 200', res.status, 200);
  check('2) ro‘yxat uzunligi son bilan bir xil',
    (body.list || []).length, 2);
}

// ===== 3) KIRGAN ODAM O'ZI OBUNAMI =====
{
  const res = await get(`/api/follow-stats/${CO}`, { cookie: cookie.user });
  const body = await res.json().catch(() => ({}));
  checkTrue('3) obuna bo‘lgan odamga isFollowing true', body.isFollowing === true);
}

// ===== 4) SHAXSIY YO'L BUZILMAGAN =====
//
// Kompaniya shoxi qo'shilganda shaxsiy yo'l ishlashdan
// to'xtamasligi kerak.
{
  const res = await get('/api/follow-stats/VIP001');
  const body = await res.json().catch(() => ({}));
  check('4) shaxsiy kod hamon 200', res.status, 200);
  checkTrue('4) javobda followers maydoni bor', body.followers !== undefined);
}

// ===== 5) YO'Q KOD 500 BERMASIN =====
{
  const res = await get('/api/follow-stats/YOQKOD9');
  const body = await res.json().catch(() => ({}));
  check('5) noma‘lum kod 200', res.status, 200);
  check('5) noma‘lum kodda 0', Number(body.followers), 0);
}

done();
