// BIZNES PROFIL AVTO-TASDIQ (egasi, 2026-09-26): "biznes profil ro'yxatdan
// o'tganda admin avto tasdiqlasin".
//
// Nima tekshiriladi:
//   • bepul (avto ID) kompaniya darhol `active` — ommaviy ro'yxatda va
//     begona odamga ham ochiladi;
//   • nom tanlangan (pullik) kompaniya `approved` — to'lovga tayyor,
//     lekin hali ommaviy emas (faollashuv to'lovdan keyin);
//   • holat jurnalida `auto` yozuvi bor (admin kim/qachon ko'radi);
//   • COMPANY_AUTO_APPROVE=off — eski tartib: `pending_review`.
//   • taqiqlangan nom avto-tasdiqdan OLDIN rad etiladi.
//
//   node scripts/test-company-auto-approve.mjs
import worker from '../hosting/worker.js';
import { makeEnv, seedBasic, cookie, req, makeChecker } from './lib/d1-harness.mjs';

const { check, checkTrue, done } = makeChecker();
const body = (extra) => ({
  displayName: 'Avto Test', city: 'Toshkent', phone: '+998901234567', category: 'other',
  description: 'Avto-tasdiq sinovi uchun kompaniya tavsifi, yigirma belgidan uzun.', ...extra,
});

// Bitta baza: worker runtime jadvallari modul darajasida bir marta yaratiladi.
const { env } = makeEnv();
await seedBasic(env);
const call = (path, init) => worker.fetch(req(path, init), env);

{

  // 1) Bepul — darhol active
  const free = await call('/api/companies', { method: 'POST', cookie: cookie.user, json: body({ auto: true }) });
  check('bepul: 201', free.status, 201);
  const fc = (await free.json()).company;
  check('bepul: status active', fc.status, 'active');
  const list = await (await call('/api/companies')).json();
  checkTrue('bepul: ommaviy ro‘yxatda', (list.companies || []).some((c) => c.companyId === fc.companyId));
  const pub = await call(`/api/companies/${fc.companyId}`);
  check('bepul: begona odamga ochiq (200)', pub.status, 200);

  // 2) Pullik — approved (to'lovga tayyor), ommaviy emas
  const paid = await call('/api/companies', { method: 'POST', cookie: cookie.user, json: body({ companyId: 'AVTOTEST' }) });
  check('pullik: 201', paid.status, 201);
  const pc = (await paid.json()).company;
  check('pullik: status approved', pc.status, 'approved');
  const pubPaid = await call('/api/companies/AVTOTEST');
  check('pullik: hali ommaviy emas (404)', pubPaid.status, 404);

  // 3) Jurnal
  const log = await env.DB.prepare(`SELECT from_status, to_status, actor FROM company_status_log WHERE company_id = ? ORDER BY rowid`).bind('AVTOTEST').all();
  check('jurnal: draft→pending_review→approved', (log.results || []).map((r) => `${r.from_status}>${r.to_status}`), ['draft>pending_review', 'pending_review>approved']);
  check('jurnal: avto-tasdiq actor', (log.results || [])[1]?.actor, 'auto');

  // 4) Taqiqlangan nom — baribir rad etiladi
  const bad = await call('/api/companies', { method: 'POST', cookie: cookie.user, json: body({ auto: true, displayName: 'NFC GOD Market' }) });
  checkTrue('taqiqlangan nom: 422', bad.status === 422);
}

{
  // 5) Bayroq o'chiq — eski tartib
  env.COMPANY_AUTO_APPROVE = 'off';
  const r = await call('/api/companies', { method: 'POST', cookie: cookie.user, json: body({ auto: true }) });
  check('off: 201', r.status, 201);
  check('off: status pending_review', (await r.json()).company.status, 'pending_review');
}

done();
