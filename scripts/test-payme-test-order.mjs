// Payme sertifikatsiya sinovi buyurtmasi.
import worker, { finalizePaidWebOrderD1, getWebOrderD1 } from '../hosting/worker.js';
import { makeEnv, seedBasic, cookie, req, makeChecker } from './lib/d1-harness.mjs';
const { env } = makeEnv(); await seedBasic(env);
env.PAYMENTS_ENABLED='true'; env.PAYME_MERCHANT_ID='M1'; env.PAYME_KEY='k';
const { check, checkTrue, done } = makeChecker();
const call = async (path, init) => { const r = await worker.fetch(req(path, init), env); let b=null; try{b=await r.json()}catch{} return {status:r.status, body:b}; };

// ═══ RUXSAT ═══
{
  const anon = await call('/api/admin/payme-test-order', { method:'POST', json:{amount:1} });
  checkTrue('loginsiz yaratib bo\'lmaydi', anon.status === 401 || anon.status === 403);
  const mgr = await call('/api/admin/payme-test-order', { method:'POST', cookie: cookie.manager, json:{amount:1} });
  check('manager ham yarata olmaydi', mgr.status, 403);
}
// ═══ SUMMA CHEKLOVI ═══
{
  for (const bad of [0, -5, 10001, 1000000]) {
    const r = await call('/api/admin/payme-test-order', { method:'POST', cookie: cookie.admin, json:{amount:bad} });
    check(`${bad} so'm rad etiladi`, r.status, 422);
  }
}
// ═══ YARATISH va TO'LOV YO'LI ═══
{
  const r = await call('/api/admin/payme-test-order', { method:'POST', cookie: cookie.admin, json:{amount:1} });
  check('1 so\'mlik buyurtma yaratildi', r.status, 201);
  check('summa 1 so\'m', r.body?.amount, 1);
  const link = r.body?.payLink || '';
  const dec = Buffer.from(link.split('/').pop(), 'base64').toString();
  check('havolada 100 tiyin', dec.includes('a=100'), true);

  const id = r.body.orderId;
  // Payme oqimi: to'lov yakunlanadi
  const fin = await finalizePaidWebOrderD1(env, id);
  check('to\'lov yakunlandi', fin.ok, true);
  check('holat paid', (await getWebOrderD1(env, id))?.status, 'paid');
  // TAKRORIY PerformTransaction — yiqilmasligi kerak (idempotent)
  const again = await finalizePaidWebOrderD1(env, id);
  check('takroriy chaqiruv ham ok', [again.ok, again.alreadyPaid], [true, true]);

  // HECH NARSA BERILMAGAN: karta yaratilmagan, premium yoqilmagan
  const card = await env.DB.prepare(`SELECT code FROM cards WHERE code='PAYMETEST'`).first();
  check('karta YARATILMAGAN', card, null);
  const u = await env.DB.prepare(`SELECT is_premium FROM users ORDER BY id LIMIT 1`).first();
  checkTrue('premium yoqilmagan', !u.is_premium);
}
done();
