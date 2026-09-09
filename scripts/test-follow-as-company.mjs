// KIM NOMIDAN OBUNA — shaxsiy profil yoki o'z KOMPANIYANGIZ.
//
// Egasining shikoyati: "menda biznes ham bor, o'sha profildan obuna
// bo'lganim bilinishi kerak — hozir jismoniyim turibdi".
//
// Muhim qoida: obuna baribir BITTA odamdan bitta. Bu yerda faqat
// KO'RSATILADIGAN yuz tanlanadi. Aks holda bitta odam ham shaxsiy,
// ham kompaniya nomidan obuna bo'lib, obunachilar sonini ikki barobar
// shishirib qo'yardi — test aynan shuni qo'riqlaydi.
//
//   node scripts/test-follow-as-company.mjs
import worker from '../hosting/worker.js';
import { makeEnv, seedBasic, cookie, req, makeChecker } from './lib/d1-harness.mjs';

const { check, checkTrue, done } = makeChecker();
const { env } = makeEnv();
await seedBasic(env);

const j = async (path, init) => { const r = await worker.fetch(req(path, init), env); return { status: r.status, body: await r.json().catch(() => null) }; };

// user#2 (other) o'ziga kompaniya ochadi va uni faollashtiramiz.
await j('/api/companies', {
  method: 'POST', cookie: cookie.other,
  json: { companyId: 'ONEBRAND', displayName: 'One Brand', city: 'Toshkent', phone: '+998901234567', category: 'other', description: 'Test kompaniya tavsifi, yigirma belgidan uzunroq matn.' },
});
await env.DB.prepare(`UPDATE companies SET status='active', logo_url='/uploads/logo.png' WHERE company_id='ONEBRAND'`).run();

// ── 1) Oddiy obuna — shaxsiy yuz ──────────────────────────────────────
const plain = await j('/api/follow/VIP001', { method: 'POST', cookie: cookie.other });
check('1) obuna bo‘ldi', plain.status, 200);
const list1 = await j('/api/follow-list/VIP001?dir=followers');
check('1) shaxsiy yuz ko‘rinadi', [list1.body.list.length, list1.body.list[0].kind, list1.body.list[0].code], [1, 'person', 'OTH222']);

// ── 2) Yuzni KOMPANIYAGA almashtirish ────────────────────────────────
const swap = await j('/api/follow/VIP001', { method: 'POST', cookie: cookie.other, json: { asCompanyId: 'ONEBRAND' } });
check('2) yuz almashtirildi', [swap.status, swap.body?.identityChanged], [200, true]);

const list2 = await j('/api/follow-list/VIP001?dir=followers');
const row = list2.body.list[0];
check('2) OBUNACHILAR SONI O‘ZGARMADI', list2.body.list.length, 1);
check('2) endi kompaniya yuzi', [row.kind, row.code, row.name], ['company', 'ONEBRAND', 'One Brand']);
check('2) logotip olindi', row.avatarUrl, '/uploads/logo.png');
// Kompaniya orqasiga butunlay yashirinib olmaslik kerak.
check('2) kim ekani ham ko‘rinadi', row.personCode, 'OTH222');

// Statistikada tanlangan yuz qaytadi — tugma yonidagi tanlov
// to'g'ri holatda ochilsin.
const stats = await j('/api/follow-stats/VIP001', { cookie: cookie.other });
check('2) statistikada tanlov ko‘rinadi', [stats.status, stats.body?.asCompanyId], [200, 'ONEBRAND']);

// ── 3) BEGONA kompaniya nomidan obuna bo‘lib bo‘lmaydi ───────────────
const stranger = await j('/api/follow/OTH222', { method: 'POST', cookie: cookie.user, json: { asCompanyId: 'ONEBRAND' } });
check('3) begona kompaniya rad etildi', [stranger.status, stranger.body?.error], [403, 'not_company_owner']);
const noSuch = await j('/api/follow/OTH222', { method: 'POST', cookie: cookie.user, json: { asCompanyId: 'YOQXXX' } });
checkTrue('3) mavjud bo‘lmagan kompaniya rad etildi', noSuch.status === 403 || noSuch.status === 422);

// FAOL bo'lmagan kompaniya nomidan ham bo'lmaydi.
await env.DB.prepare(`UPDATE companies SET status='suspended' WHERE company_id='ONEBRAND'`).run();
const suspended = await j('/api/follow/VIP001', { method: 'POST', cookie: cookie.other, json: { asCompanyId: 'ONEBRAND' } });
check('3) to‘xtatilgan kompaniya rad etildi', suspended.status, 403);
// To'xtatilgan bo'lsa ro'yxatda SHAXSIY yuzga qaytadi — "teshik"
// qolmasin.
const list3 = await j('/api/follow-list/VIP001?dir=followers');
check('3) to‘xtatilganda shaxsiy yuzga qaytadi', list3.body.list[0].kind, 'person');
await env.DB.prepare(`UPDATE companies SET status='active' WHERE company_id='ONEBRAND'`).run();

// ── 4) Shaxsiy yuzga qaytarish ───────────────────────────────────────
const back = await j('/api/follow/VIP001', { method: 'POST', cookie: cookie.other, json: {} });
check('4) shaxsiyga qaytdi', [back.status, back.body?.identityChanged], [200, true]);
check('4) ro‘yxatda shaxsiy', (await j('/api/follow-list/VIP001?dir=followers')).body.list[0].kind, 'person');
// Hech narsa o'zgarmagan bo'lsa — eski xatti-harakat (409) saqlanadi.
const again = await j('/api/follow/VIP001', { method: 'POST', cookie: cookie.other, json: {} });
check('4) o‘zgarish yo‘q — ALREADY_FOLLOWING', [again.status, again.body?.error], [409, 'ALREADY_FOLLOWING']);

// ── 5) Obunani bekor qilish sonni to‘g‘ri kamaytiradi ────────────────
await j('/api/unfollow/VIP001', { method: 'POST', cookie: cookie.other });
check('5) ro‘yxat bo‘shadi', (await j('/api/follow-list/VIP001?dir=followers')).body.list.length, 0);

// ── 6) SERVER YUZNI ESLAB QOLADI ─────────────────────────────────────
// Interfeys tanlovni brauzerda eslab qoladi, LEKIN haqiqiy manba —
// server. Bir necha profilga ketma-ket kompaniya nomidan obuna bo'lish
// ishlashi va har birida to'g'ri yuz qaytishi kerak.
await j('/api/follow/VIP001', { method: 'POST', cookie: cookie.other, json: { asCompanyId: 'ONEBRAND' } });
const st1 = await j('/api/follow-stats/VIP001', { cookie: cookie.other });
check('6) birinchi profilda kompaniya yuzi', st1.body?.asCompanyId, 'ONEBRAND');

// user#1 ning ikkinchi kartasi (BIZ777) — o'sha odamning o'zi, lekin
// boshqa profil. Obuna user#2 dan boradi.
await j('/api/follow/BIZ777', { method: 'POST', cookie: cookie.other, json: { asCompanyId: 'ONEBRAND' } });
const st2 = await j('/api/follow-stats/BIZ777', { cookie: cookie.other });
check('6) ikkinchi profilda ham kompaniya yuzi', st2.body?.asCompanyId, 'ONEBRAND');

// Obuna bo'lmagan profilda `asCompanyId` BO'SH qaytadi — interfeys
// shunda o'zining eslab qolgan tanlovini ishlatadi.
const st3 = await j('/api/follow-stats/OTH222', { cookie: cookie.user });
check('6) obuna bo‘lmaganda bo‘sh qaytadi', [st3.body?.isFollowing, st3.body?.asCompanyId], [false, '']);

done();
