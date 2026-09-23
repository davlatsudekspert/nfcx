// TARIF, 30 KUNLIK SINOV VA OYLIK PREMIUM.
//
// Egasining qarori (suhbatda tasdiqlangan):
//   1) eski Premium egalari MUDDATSIZ qoladi — sotib olgan narsasi
//      tortib olinmaydi;
//   2) bepul tarif limiti faqat YANGI qo'shishga ta'sir qiladi —
//      mavjud katalog qisqarmaydi;
//   3) 30 kunlik sinov faqat YANGI hisoblarga.
//
// Shu uchtasi ham shu testda qo'riqlanadi: ularning biri buzilsa,
// pul to'lagan yoki allaqachon ishlayotgan mijoz zarar ko'radi.
//
//   node scripts/test-plans-and-trial.mjs
import worker, { companyPlanStateD1, trialEndsAtD1, premiumExtendD1, trialActiveD1 } from '../hosting/worker.js';
import { makeEnv, seedBasic, cookie, req, makeChecker } from './lib/d1-harness.mjs';

const { check, checkTrue, done } = makeChecker();
const { env } = makeEnv();
await seedBasic(env);

const j = async (path, init) => { const r = await worker.fetch(req(path, init), env); return { status: r.status, body: await r.json().catch(() => null) }; };
const DAY = 86400000;
const inDays = (n) => new Date(Date.now() + n * DAY).toISOString();

// ── 1) SINOV — "pol" sifatida ishlaydi ───────────────────────────────
check('1) sinov faol', trialActiveD1({ trialExpiresAt: inDays(5) }), true);
check('1) sinov tugagan', trialActiveD1({ trialExpiresAt: inDays(-1) }), false);
// Maydon BO'SH — eski hisob. Sinov UMUMAN qo'llanmaydi.
check('1) maydonsiz hisob — sinov yo‘q', trialActiveD1({}), false);
checkTrue('1) trialEndsAtD1 ~30 kun', (() => {
  const d = (Date.parse(trialEndsAtD1()) - Date.now()) / DAY;
  return d > 29.9 && d < 30.1;
})());

// ── 2) PREMIUM MUDDATI — uzaytirish ustiga qo'shiladi ────────────────
// Odam muddati tugamasdan yana to'lasa, qolgan kunlari YO'QOLMASLIGI
// kerak — aks holda u pulini yo'qotadi.
checkTrue('2) tugamagan muddat ustiga qo‘shiladi', (() => {
  const cur = inDays(10);
  const next = premiumExtendD1(cur);
  const d = (Date.parse(next) - Date.parse(cur)) / DAY;
  return d > 29.9 && d < 30.1;
})());
checkTrue('2) tugagan muddat — bugundan hisoblanadi', (() => {
  const d = (Date.parse(premiumExtendD1(inDays(-40))) - Date.now()) / DAY;
  return d > 29.9 && d < 30.1;
})());
checkTrue('2) muddatsiz (null) — bugundan', (() => {
  const d = (Date.parse(premiumExtendD1(null)) - Date.now()) / DAY;
  return d > 29.9 && d < 30.1;
})());

// ── 3) ESKI PREMIUM EGALARI TEGILMAYDI ──────────────────────────────
await env.DB.prepare(`UPDATE users SET is_premium = 1 WHERE id = 1`).run();
const me = await j('/api/auth/me', { cookie: cookie.user });
check('3) muddatsiz egada premium faol', me.body?.user?.isPremium, true);
checkTrue('3) muddat sanasi yo‘q — ya‘ni muddatsiz', !me.body?.user?.premiumExpiresAt);
await env.DB.prepare(`UPDATE users SET is_premium = 0 WHERE id = 1`).run();

// ── 4) OYLIK OBUNA — muddat bo'yicha faol ───────────────────────────
await env.DB.prepare(`UPDATE users SET premium_expires_at = ? WHERE id = 1`).bind(inDays(7)).run();
check('4) muddat ichida premium faol', (await j('/api/auth/me', { cookie: cookie.user })).body?.user?.isPremium, true);
await env.DB.prepare(`UPDATE users SET premium_expires_at = ? WHERE id = 1`).bind(inDays(-1)).run();
check('4) muddat o‘tgach o‘chadi', (await j('/api/auth/me', { cookie: cookie.user })).body?.user?.isPremium, false);
await env.DB.prepare(`UPDATE users SET premium_expires_at = NULL WHERE id = 1`).run();

// ── 5) KOMPANIYA TARIFI ─────────────────────────────────────────────
// Eski kompaniya (trial_expires_at bo'sh) — cheklovsiz.
check('5) eski kompaniya cheklovsiz', companyPlanStateD1({ trial_expires_at: null }),
  { legacy: true, trialActive: false, free: false, itemLimit: null, canPost: true });
// Sinov davomida — cheklovsiz.
const inTrial = companyPlanStateD1({ trial_expires_at: inDays(10), plan: 'free' });
check('5) sinov davomida cheklovsiz', [inTrial.trialActive, inTrial.itemLimit, inTrial.canPost], [true, null, true]);
// Sinov tugagan, bepul tarif — 5 ta, post/istorya yopiq.
const freeAfter = companyPlanStateD1({ trial_expires_at: inDays(-1), plan: 'free' });
check('5) bepul tarif: 5 ta va post yopiq', [freeAfter.itemLimit, freeAfter.canPost], [5, false]);
// Sotib olingan nom — cheklovsiz.
const paidAfter = companyPlanStateD1({ trial_expires_at: inDays(-1), plan: 'paid' });
check('5) sotib olingan nom cheklovsiz', [paidAfter.itemLimit, paidAfter.canPost], [null, true]);

// ── 6) BEPUL KOMPANIYA OCHISH — to'lovsiz, avtomatik ID ─────────────
const created = await j('/api/companies', {
  method: 'POST', cookie: cookie.user,
  json: { auto: true, displayName: 'Bepul Biznes', city: 'Toshkent', phone: '+998901112233', category: 'other', description: 'Bepul ochilgan biznes hisobi, yigirma belgidan uzunroq tavsif.' },
});
check('6) bepul hisob ochildi', created.status, 201);
const auto = created.body?.company;
checkTrue('6) ID avtomatik berildi', /^[A-Z]{9}$/.test(auto?.companyId || ''));
check('6) narxi 0', auto?.price, 0);
check('6) tarifi bepul', auto?.plan?.free, false);           // sinov davom etyapti
check('6) sinov faol', auto?.plan?.trialActive, true);

// ── 7) BEPUL TARIF LIMITI — MAVJUDLAR SAQLANADI ─────────────────────
// Sinovni ataylab tugatamiz va katalogga 6 ta yozuv qo'yamiz.
const cid = auto.companyId;
await env.DB.prepare(`UPDATE companies SET status='active', trial_expires_at = ? WHERE company_id = ?`).bind(inDays(-1), cid).run();
const addItem = (n) => j(`/api/companies/${cid}/catalog`, { method: 'POST', cookie: cookie.user, json: { name: `Mahsulot ${n}`, price: 1000 } });
for (let i = 1; i <= 5; i += 1) check(`7) ${i}-yozuv qo‘shildi`, (await addItem(i)).status, 201);
const sixth = await addItem(6);
check('7) 6-yozuv rad etildi', [sixth.status, sixth.body?.error, sixth.body?.limit], [409, 'plan_limit_reached', 5]);
// MAVJUD yozuvlar joyida qoladi — bu eng muhim kafolat.
const after = await j(`/api/companies/${cid}`);
check('7) mavjud 5 ta yozuv saqlandi', (after.body?.company?.catalog || []).length, 5);

// ── 8) BEPUL TARIFDA ISTORYA VA POST YOPIQ ──────────────────────────
const post = await j(`/api/companies/${cid}/posts`, { method: 'POST', cookie: cookie.user, json: { agreed: true, imageUrl: '/uploads/a.png' } });
check('8) post yopiq', [post.status, post.body?.error], [403, 'plan_locked']);
const story = await j(`/api/companies/${cid}/stories`, { method: 'POST', cookie: cookie.user, json: { agreed: true, imageUrl: '/uploads/a.png' } });
check('8) istorya yopiq', [story.status, story.body?.error], [403, 'plan_locked']);

// ── 8b) OYLIK PREMIUM — 25 TA, POST/ISTORYA OCHIQ ───────────────────
// Egasining qarori (2026-09): bepul ID + Premium = 25 ta tovar.
check('8b) 6-rad javobida Premium limiti aytiladi', [sixth.body?.premium, sixth.body?.premiumLimit], [false, 25]);
const minePlan = async () => (await j('/api/companies/mine', { cookie: cookie.user })).body?.companies?.find((c) => c.companyId === cid)?.plan;
check('8b) bepul: premiumItemLimit ko‘rsatiladi', (await minePlan())?.premiumItemLimit, 25);
await env.DB.prepare(`UPDATE users SET premium_expires_at = ? WHERE id = 1`).bind(inDays(20)).run();
const pp = await minePlan();
check('8b) Premium: 25 ta, post ochiq', [pp?.premium, pp?.itemLimit, pp?.canPost], [true, 25, true]);
check('8b) kompaniya sahifasida ham', (await j(`/api/companies/${cid}`)).body?.company?.plan?.itemLimit, 25);
for (let i = 6; i <= 25; i += 1) {
  const r = await addItem(i);
  if (r.status !== 201) check(`8b) ${i}-yozuv qo‘shildi`, r.status, 201);
}
const t26 = await addItem(26);
check('8b) 26-yozuv rad etildi', [t26.status, t26.body?.limit, t26.body?.premium, t26.body?.premiumLimit], [409, 25, true, null]);
check('8b) Premium: post ochiq', (await j(`/api/companies/${cid}/posts`, { method: 'POST', cookie: cookie.user, json: { agreed: true, imageUrl: '/uploads/p.png' } })).status, 201);
// Premium tugadi — yana 5 ta; 25 ta yozuv O'CHMAYDI.
await env.DB.prepare(`UPDATE users SET premium_expires_at = ? WHERE id = 1`).bind(inDays(-1)).run();
const back = await addItem(26);
check('8b) Premium tugagach yana 5 ta limit', [back.status, back.body?.limit], [409, 5]);
check('8b) 25 ta yozuv saqlandi', ((await j(`/api/companies/${cid}`)).body?.company?.catalog || []).length, 25);
check('8b) Premium tugagach post yopiq', (await j(`/api/companies/${cid}/posts`, { method: 'POST', cookie: cookie.user, json: { agreed: true, imageUrl: '/uploads/q.png' } })).body?.error, 'plan_locked');
// Eski (muddatsiz) Premium ham hisoblanadi.
await env.DB.prepare(`UPDATE users SET premium_expires_at = NULL, is_premium = 1 WHERE id = 1`).run();
check('8b) eski muddatsiz Premium ham 25 ta', (await minePlan())?.itemLimit, 25);
await env.DB.prepare(`UPDATE users SET is_premium = 0 WHERE id = 1`).run();

// ── 9) NOM SOTIB OLINSA — CHEKLOV YO'Q ──────────────────────────────
await env.DB.prepare(`UPDATE companies SET plan = 'paid' WHERE company_id = ?`).bind(cid).run();
check('9) 27-yozuv endi qo‘shiladi', (await addItem(27)).status, 201);
check('9) post ham ochildi', (await j(`/api/companies/${cid}/posts`, { method: 'POST', cookie: cookie.user, json: { agreed: true, imageUrl: '/uploads/a.png' } })).status, 201);

// ── 10) ESKI KOMPANIYAGA CHEKLOV TEGMAYDI ───────────────────────────
// `trial_expires_at` bo'sh — bu o'zgarishdan oldin ochilgan kompaniya.
await env.DB.prepare(`UPDATE companies SET plan = 'free', trial_expires_at = NULL WHERE company_id = ?`).bind(cid).run();
check('10) eskida limit yo‘q', (await addItem(28)).status, 201);
check('10) eskida post ochiq', (await j(`/api/companies/${cid}/posts`, { method: 'POST', cookie: cookie.user, json: { agreed: true, imageUrl: '/uploads/b.png' } })).status, 201);

done();
