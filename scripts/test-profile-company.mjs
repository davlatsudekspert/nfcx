// PROFILGA KOMPANIYA BIRIKTIRISH (2026-09).
//
// Egasining so'rovi: "Telegramda kanal profilda chiqadiku — shunaqa
// qilib" va "2 ta kompaniyasi bo'lsa bittasini tanlab profilda
// ko'rinsin".
//
// Eng muhimi — EGALIK: begona brendni o'z profiliga "o'zimniki" qilib
// biriktirib bo'lmasligi kerak. Bu SERVERDA tekshiriladi.
//
//   node scripts/test-profile-company.mjs
import worker from '../hosting/worker.js';
import { makeEnv, seedBasic, cookie, req, makeChecker } from './lib/d1-harness.mjs';

const { check, checkTrue, done } = makeChecker();
const { env } = makeEnv();
await seedBasic(env);

const j = async (path, init) => { const r = await worker.fetch(req(path, init), env); return { status: r.status, body: await r.json().catch(() => null) }; };
// Profilni tahrirlash PUT bilan (src/lib/auth.jsx authUpdateCard).
const patch = (json) => j('/api/records/VIP001', { method: 'PUT', cookie: cookie.user, json: { name: 'Muhammad', ...json } });

// user#1 ikkita kompaniya ochadi (egasining holati: "2 tasi bor").
for (const [id, nom] of [['ALFACO', 'Alfa Co'], ['BETACO', 'Beta Co']]) {
  await j('/api/companies', {
    method: 'POST', cookie: cookie.user,
    json: { companyId: id, displayName: nom, city: 'Toshkent', phone: '+998901234567', category: 'other', description: 'Test kompaniya tavsifi, yigirma belgidan uzunroq matn.' },
  });
}
await env.DB.prepare(`UPDATE companies SET status='active', logo_url='/uploads/a.png' WHERE company_id='ALFACO'`).run();
await env.DB.prepare(`UPDATE companies SET status='active' WHERE company_id='BETACO'`).run();
// user#2 ning kompaniyasi — begona.
await j('/api/companies', {
  method: 'POST', cookie: cookie.other,
  json: { companyId: 'OTHERCO', displayName: 'Other Co', city: 'Toshkent', phone: '+998901234568', category: 'other', description: 'Begona kompaniya tavsifi, yigirma belgidan uzunroq matn.' },
});
await env.DB.prepare(`UPDATE companies SET status='active' WHERE company_id='OTHERCO'`).run();

// ── 1) Boshida biriktirilmagan ────────────────────────────────────────
const before = await j('/api/records/VIP001');
check('1) boshida kompaniya yo‘q', [before.body.companyId || '', before.body.company || null], ['', null]);

// ── 2) O‘zining kompaniyasini biriktirish ─────────────────────────────
const ok = await patch({ companyId: 'ALFACO' });
check('2) biriktirildi', ok.status, 200);
const withCo = await j('/api/records/VIP001');
check('2) profilda ko‘rinadi', [withCo.body.company?.companyId, withCo.body.company?.displayName], ['ALFACO', 'Alfa Co']);
check('2) logotip ham keladi', withCo.body.company?.logoUrl, '/uploads/a.png');

// Ikkinchisiga ALMASHTIRISH — profilda BITTASI chiqadi.
await patch({ companyId: 'BETACO' });
const swapped = await j('/api/records/VIP001');
check('2) ikkinchisiga almashdi', swapped.body.company?.companyId, 'BETACO');

// ── 3) BEGONA kompaniyani biriktirib bo‘lmaydi ───────────────────────
const stranger = await patch({ companyId: 'OTHERCO' });
check('3) begona kompaniya rad etildi', [stranger.status, stranger.body?.error], [403, 'not_company_owner']);
const still = await j('/api/records/VIP001');
check('3) eski biriktirma buzilmadi', still.body.company?.companyId, 'BETACO');
const ghost = await patch({ companyId: 'YOQXXX' });
check('3) mavjud bo‘lmagan kompaniya rad etildi', ghost.status, 403);

// FAOL bo'lmagan o'z kompaniyasi ham biriktirilmaydi.
await env.DB.prepare(`UPDATE companies SET status='suspended' WHERE company_id='ALFACO'`).run();
check('3) to‘xtatilgan kompaniya rad etildi', (await patch({ companyId: 'ALFACO' })).status, 403);

// ── 4) Keyin to‘xtatilsa — blok chizilmaydi (o‘lik havola qolmasin) ──
await env.DB.prepare(`UPDATE companies SET status='suspended' WHERE company_id='BETACO'`).run();
const dead = await j('/api/records/VIP001');
check('4) to‘xtatilganda company bo‘sh', dead.body.company, null);
checkTrue('4) lekin biriktirma saqlanib qoladi', dead.body.companyId === 'BETACO');
// Qayta faollashsa — o'zi qaytadi, qo'lda tiklash shart emas.
await env.DB.prepare(`UPDATE companies SET status='active' WHERE company_id='BETACO'`).run();
check('4) qayta faollashsa qaytadi', (await j('/api/records/VIP001')).body.company?.companyId, 'BETACO');

// ── 5) Bekor qilish ──────────────────────────────────────────────────
check('5) bo‘sh qiymat biriktirmani olib tashlaydi', (await patch({ companyId: '' })).status, 200);
const cleared = await j('/api/records/VIP001');
check('5) endi ko‘rinmaydi', [cleared.body.companyId || '', cleared.body.company || null], ['', null]);

// ── 6) Begona odam boshqa profilga biriktira olmaydi ─────────────────
const notMine = await j('/api/records/VIP001', { method: 'PUT', cookie: cookie.other, json: { name: 'x', companyId: 'OTHERCO' } });
check('6) begona profil rad etildi', notMine.status, 403);

done();
