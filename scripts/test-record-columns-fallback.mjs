// USTUN QO'SHILMASA HAM PROFIL SAQLANADI (production 503 himoyasi).
//
// Nima bo'lgan: `cards` jadvaliga `company_id` ustuni ishga tushishda
// `ALTER TABLE` bilan qo'shiladi, xatosi esa jimgina yutilardi. Ustun
// nomi esa `RECORD_COLUMNS` ichiga qo'shilgan edi — ya'ni ALTER biror
// sababdan o'tmasa, /api/auth/me, katalog VA profil saqlash birdaniga
// "no such column: company_id" bilan yiqilib, butun ported API 503
// qaytarardi. Egasi aynan shuni ko'rdi: "Saqlashda xatolik yuz berdi".
//
// Bu test ANIQ o'sha holatni yasaydi: ALTER hech narsa qilmaydi. Talab
// qilinadigan xulq — kompaniya biriktirish ishlamaydi (aniq xato bilan),
// QOLGAN HAMMA NARSA esa avvalgidek ishlaydi.
//
//   node scripts/test-record-columns-fallback.mjs
import worker, { cardsHaveCompanyIdD1, likesHaveCompanyIdD1 } from '../hosting/worker.js';
import { makeEnv, seedBasic, cookie, req, makeChecker } from './lib/d1-harness.mjs';

const { check, checkTrue, done } = makeChecker();
const { env } = makeEnv();

// ── ALTER ni "o'ldiramiz" ────────────────────────────────────────────
// Faqat SHU bitta buyruq: qolgan hamma so'rov haqiqiy bazaga boradi.
const realPrepare = env.DB.prepare.bind(env.DB);
let alterSeen = 0;
env.DB.prepare = (sql) => {
  if (/ALTER\s+TABLE\s+(cards\s+ADD\s+COLUMN\s+company_id|card_likes\s+ADD\s+COLUMN\s+as_company_id)/i.test(String(sql))) {
    alterSeen += 1;
    const stub = { bind: () => stub, async run() { return { success: true, meta: { changes: 0 } }; }, async first() { return null; }, async all() { return { results: [] }; } };
    return stub;
  }
  return realPrepare(sql);
};

await seedBasic(env);
const j = async (path, init) => { const r = await worker.fetch(req(path, init), env); return { status: r.status, body: await r.json().catch(() => null) }; };

checkTrue('0) ALTER urinib ko‘rildi', alterSeen > 0);
check('0) ustun YO‘Q deb aniqlandi', cardsHaveCompanyIdD1(), false);
check('0) layk ustuni ham YO‘Q', likesHaveCompanyIdD1(), false);

// ── 1) Profil saqlash ISHLAYDI ───────────────────────────────────────
const saved = await j('/api/records/VIP001', { method: 'PUT', cookie: cookie.user, json: { name: 'Yangi Ism', phone: '+998901234567' } });
check('1) saqlandi (503 emas)', saved.status, 200);
check('1) ism yozildi', saved.body?.name, 'Yangi Ism');

// ── 2) /api/auth/me ham yiqilmaydi ───────────────────────────────────
const me = await j('/api/auth/me', { cookie: cookie.user });
check('2) auth/me ishlaydi', me.status, 200);
checkTrue('2) kartalar keldi', Array.isArray(me.body?.cards) && me.body.cards.length >= 2);

// ── 3) Profil sahifasi va katalog ham ishlaydi ───────────────────────
check('3) profil ochiladi', (await j('/api/records/VIP001')).status, 200);
check('3) katalog ochiladi', (await j('/api/records')).status, 200);

// ── 4) Kompaniya biriktirish — ANIQ xato, umumiy 503 emas ────────────
// Odam "saqlandi" deb o'ylab qolmasligi kerak, lekin xato ham
// tushunarli bo'lishi shart.
await j('/api/companies', {
  method: 'POST', cookie: cookie.user,
  json: { companyId: 'MYBRAND', displayName: 'My Brand', city: 'Toshkent', phone: '+998901112233', category: 'other', description: 'Test kompaniya tavsifi, yigirma belgidan uzunroq matn.' },
});
await env.DB.prepare(`UPDATE companies SET status='active' WHERE company_id='MYBRAND'`).run();
const attach = await j('/api/records/VIP001', { method: 'PUT', cookie: cookie.user, json: { name: 'Yangi Ism', companyId: 'MYBRAND' } });
check('4) aniq xato qaytdi', [attach.status, attach.body?.error], [503, 'company_link_unavailable']);

// ── 5) Obuna ham ishlaydi (standart yuz shunchaki bo‘sh) ─────────────
const follow = await j('/api/follow/OTH222', { method: 'POST', cookie: cookie.user, json: {} });
check('5) obuna bo‘ldi', follow.status, 200);
check('5) yuz — shaxsiy', (await j('/api/follow-stats/OTH222', { cookie: cookie.user })).body?.asCompanyId, '');

// ── 6) Layk ham ishlaydi (faqat yuzsiz) ─────────────────────────────
const like = await j('/api/records/OTH222/like', { method: 'POST', cookie: cookie.user, json: {} });
check('6) layk bosildi', [like.status, like.body?.liked, like.body?.asCompanyId], [200, true, '']);
check('6) son sanaladi', (await j('/api/records/OTH222/like', { cookie: cookie.user })).body?.count, 1);
const likeList = (await j('/api/records/OTH222/like-list')).body?.list;
check('6) ro‘yxat ham ishlaydi', [likeList.length, likeList[0].kind], [1, 'person']);

done();
