// BIR MARTALIK TUZATISH — qayta ishlatilgan post raqamiga yopishgan
// eski izoh va layklar (hosting/api/comments.js repairRecycledPostIdsOnce).
//   node scripts/test-recycled-post-repair.mjs
//
// Qoida: postning O'ZIDAN OLDIN yozilgan izoh/layk — o'chirilgan eski
// postniki. Faqat shular olinadi, nusxasi saqlanadi, bir marta bajariladi.
import worker from '../hosting/worker.js';
import { makeEnv, seedBasic, makeChecker, req, cookie } from './lib/d1-harness.mjs';
import { repairRecycledPostIdsOnce, resetRepairMemoForTest } from '../hosting/api/comments.js';

const { check, checkTrue, done } = makeChecker();
const { env, sqlite } = makeEnv();
await seedBasic(env); // bo'sh bazada bir marta ishlaydi va belgi qo'yadi

// Yangi post (bugun) — raqami eski o'chirilgan postniki bilan bir xil.
sqlite.prepare(`INSERT INTO posts (id, code, user_id, caption, created_at) VALUES (77, 'VIP001', 1, 'yangi', '2026-09-20 10:00:00')`).run();
// Eski postdan qolgan izoh (19-sentabr, E2E) va haqiqiy yangi izoh.
const addC = sqlite.prepare(`INSERT INTO content_comments (target_kind, target_id, user_id, author_code, body, created_at) VALUES ('post', 77, ?, '', ?, ?)`);
addC.run(1, 'NOVA E2E TEST — izoh', '2026-09-19 15:39:55.042+00');
addC.run(2, 'Zo‘r surat!', '2026-09-20 11:00:00.000+00');
// Layklar: eski (yopishgan) va haqiqiy.
sqlite.prepare(`INSERT INTO post_likes (post_id, user_id, created_at) VALUES (77, 1, '2026-09-19 15:39:50')`).run();
sqlite.prepare(`INSERT INTO post_likes (post_id, user_id, created_at) VALUES (77, 2, '2026-09-20 12:00:00')`).run();
sqlite.prepare(`INSERT INTO content_likes (target_kind, target_id, user_id, created_at) VALUES ('post', 77, 1, '2026-09-19T15:39:51.000Z')`).run();
// Boshqa, tegilmasligi kerak bo'lgan post.
sqlite.prepare(`INSERT INTO posts (id, code, user_id, caption, created_at) VALUES (78, 'VIP001', 1, 'eski', '2026-09-01 10:00:00')`).run();
addC.run(2, 'oddiy izoh', '2026-09-02 10:00:00.000+00');
sqlite.prepare(`UPDATE content_comments SET target_id = 78 WHERE body = 'oddiy izoh'`).run();

// Haqiqiy production holati: belgi hali qo'yilmagan.
sqlite.prepare(`DELETE FROM maintenance_runs`).run();
resetRepairMemoForTest();
await repairRecycledPostIdsOnce(env);

const live = sqlite.prepare(`SELECT body FROM content_comments WHERE deleted_at IS NULL ORDER BY id`).all().map((r) => r.body);
check('yopishgan test izohi olindi, haqiqiylari QOLDI', live, ['Zo‘r surat!', 'oddiy izoh']);
const arch = sqlite.prepare(`SELECT body, reason FROM content_comment_archive`).all();
check('olingan izoh arxivda (nusxa)', arch, [{ body: 'NOVA E2E TEST — izoh', reason: 'recycled_post_id' }]);
check('yopishgan layk olindi, haqiqiysi QOLDI', sqlite.prepare(`SELECT user_id FROM post_likes WHERE post_id = 77`).all().map((r) => r.user_id), [2]);
check('olingan layk zaxirada', sqlite.prepare(`SELECT post_id, user_id FROM post_likes_orphans`).all(), [{ post_id: 77, user_id: 1 }]);
check('content_likes ham tozalandi va zaxirada', [
  sqlite.prepare(`SELECT COUNT(*) AS n FROM content_likes WHERE target_id = 77`).get().n,
  sqlite.prepare(`SELECT COUNT(*) AS n FROM content_likes_orphans`).get().n,
], [0, 1]);
const run = sqlite.prepare(`SELECT details FROM maintenance_runs WHERE name = 'recycled_post_ids_2026_09'`).get();
check('natija jurnalga yozildi', JSON.parse(run.details), { comments: 1, postLikes: 1, contentLikes: 1 });

// Ikkinchi marta ishlamaydi — keyin yozilgan narsaga tegmaydi.
addC.run(1, 'yana eski ko‘rinishli', '2026-09-18 00:00:00.000+00');
resetRepairMemoForTest();
await repairRecycledPostIdsOnce(env);
checkTrue('bir marta bajariladi (belgi bor)', sqlite.prepare(`SELECT COUNT(*) AS n FROM content_comments WHERE body = 'yana eski ko‘rinishli' AND deleted_at IS NULL`).get().n === 1);

// ═══ Admin ro'yxatlarida E2E sinov yozuvlari ko'rinmaydi ═══
{
  const call = async (p) => (await worker.fetch(req(p, { cookie: cookie.admin }), env)).json();
  const listed = (await call('/api/admin/comments?state=all&limit=50')).comments.map((c) => c.body);
  checkTrue('Izohlar: sinov izohi yo‘q', !listed.some((b) => b.startsWith('NOVA E2E TEST')));
  checkTrue('Izohlar: oddiy izoh bor', listed.includes('Zo‘r surat!'));
  const arch = (await call('/api/admin/comments/archive')).items.map((c) => c.body);
  checkTrue('Izohlar arxivi: sinov izohi yo‘q', !arch.some((b) => b.startsWith('NOVA E2E TEST')));
  const ev = (await call('/api/admin/evidence?limit=100')).items.map((i) => i.body);
  checkTrue('Dalil arxivi: sinov yozuvi yo‘q', !ev.some((b) => b.startsWith('NOVA E2E TEST')));
}

done();
