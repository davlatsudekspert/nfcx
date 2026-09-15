// TARIF NARXLARI VA KOD BAHOSI — ilova uchun ikkita ochiq endpoint (2026-09).
//
// NIMA UCHUN. Ilovada narx jadvali yo'q (qoida: narx serverdan). U
// tarif narxini katalogdagi ENG ARZON BO'SH KODDAN olardi — bo'sh kod
// bo'lmagan tarifda narx o'rniga "Yo'q / hozircha" turardi. Kod
// qidiruvi esa faqat BAZADA BOR kartalarni topardi: hali hech kim
// olmagan kod (III777) uchun "Bunday kod topilmadi" chiqardi — holbuki
// aynan shunday kod sotib olinadi.
//
//   • GET /api/pricing — tarif narxlari, PERSONAL_TIER_PRICE dan;
//   • GET /api/records/:code/quote — kod band/bo'sh, tarifi, narxi.
//     Narx xarid oqimidagi personalPurchaseQuote() dan — ya'ni bu
//     yerdagi summa to'lovdagi summa bilan hech qachon farq qilmaydi.
//
//   node scripts/test-pricing-quote.mjs
import worker, { PERSONAL_TIER_PRICE, personalPurchaseQuote } from '../hosting/worker.js';
import { makeEnv, seedBasic, req, makeChecker } from './lib/d1-harness.mjs';

const { check, checkTrue, done } = makeChecker();
const { env } = makeEnv();
await seedBasic(env);

const j = async (path, init) => { const r = await worker.fetch(req(path, init), env); return { status: r.status, body: await r.json().catch(() => null) }; };

// ── 1) /api/pricing ───────────────────────────────────────────────────
const pricing = await j('/api/pricing');
check('1) /api/pricing 200', pricing.status, 200);
check('1) bronze = PERSONAL_TIER_PRICE.free', pricing.body?.tiers?.bronze, PERSONAL_TIER_PRICE.free);
check('1) silver', pricing.body?.tiers?.silver, PERSONAL_TIER_PRICE.silver);
check('1) gold', pricing.body?.tiers?.gold, PERSONAL_TIER_PRICE.gold);
check('1) premium', pricing.body?.tiers?.premium, PERSONAL_TIER_PRICE.premium);
check('1) exclusive ("...dan")', pricing.body?.tiers?.exclusive, PERSONAL_TIER_PRICE.exclusive);
checkTrue('1) jismoniy karta va Premium narxi ham bor', pricing.body?.physicalCardFee > 0 && pricing.body?.profilePremiumFee > 0);
checkTrue('1) "free" kaliti YO‘Q — ilova uni "Bepul" deb o‘qirdi', !('free' in (pricing.body?.tiers || {})));

// ── 2) BAZADA YO'Q KOD — bo'sh, narxi xarid oqimi bilan bir xil ──────
for (const code of ['III777', 'ABC123', 'AAA000']) {
  const q = await j(`/api/records/${code}/quote`);
  const ref = personalPurchaseQuote(code);
  check(`2) ${code}: 200`, q.status, 200);
  check(`2) ${code}: bazada yo‘q, sotib olinadi`, [q.body?.exists, q.body?.available], [false, true]);
  check(`2) ${code}: narx = personalPurchaseQuote`, q.body?.price, ref.amount);
  check(`2) ${code}: tarif`, q.body?.tier, ref.tier === 'free' ? 'bronze' : ref.tier);
}
checkTrue('2) oddiy AAA000 kod "bronze" deb keladi ("free" emas)', (await j('/api/records/BQX417/quote')).body?.tier === 'bronze');

// ── 3) BAND KOD — egasi bor ───────────────────────────────────────────
const taken = await j('/api/records/VIP001/quote');
check('3) VIP001 band', [taken.status, taken.body?.exists, taken.body?.available, taken.body?.price], [200, true, false, 0]);
const biz = await j('/api/records/BIZ777/quote');
check('3) BIZ777 band', [biz.body?.exists, biz.body?.available], [true, false]);

// ── 4) SOTILMAYDIGAN SHAKL ────────────────────────────────────────────
const free8 = await j('/api/records/12345678/quote');
check('4) 8 xonali bepul ID sotilmaydi', [free8.status, free8.body?.available, free8.body?.reason], [200, false, 'not_purchasable']);
const blocked = await j('/api/records/GOD001/quote');
checkTrue('4) bloklangan prefiks rad etiladi', blocked.status === 400 || blocked.body?.available === false);
const bad = await j('/api/records/AB/quote');
check('4) yaroqsiz kod — 400', bad.status, 400);

// ── 5) FAQAT O'QIYDI ──────────────────────────────────────────────────
const before = await env.DB.prepare(`SELECT COUNT(*) AS n FROM cards`).first();
await j('/api/records/QQQ999/quote');
const after = await env.DB.prepare(`SELECT COUNT(*) AS n FROM cards`).first();
check('5) baho so‘ralganda karta yaratilmaydi', Number(after.n), Number(before.n));
const post = await j('/api/records/QQQ999/quote', { method: 'POST' });
checkTrue('5) POST qabul qilinmaydi', post.status !== 200 || post.body?.available === undefined);

done('Tarif narxlari va kod bahosi');
