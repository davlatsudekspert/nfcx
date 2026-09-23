// PROMOKOD — TAKLIF QILINGANLAR RO'YXATI (egasi, 2026-09).
//
// Ilovadagi "Promokod" bo'limida ro'yxat bo'sh kartalar bo'lib
// chiqardi: server `referredEmail` yuborardi, ilova `email` o'qirdi.
// Endi ism ham qaytadi, telefon bilan ochilgan akkauntning ichki
// manzili esa ko'rsatilmaydi.
//
//   node scripts/test-referrals.mjs
import worker from '../hosting/worker.js';
import { makeEnv, seedBasic, req, cookie, makeChecker } from './lib/d1-harness.mjs';

const { check, done } = makeChecker();
// Email xizmati O'CHIQ: ro'yxat kodsiz (eski qoida) — test tarmoqqa chiqmaydi.
const { env, sqlite } = makeEnv({});
await seedBasic(env);
sqlite.prepare(`UPDATE users SET promo_code = 'ABC234' WHERE id = 1`).run();

const post = (path, json, ip) => worker.fetch(req(path, { method: 'POST', json, ip }), env);

// 1) Email bilan, promokodni kichik harf va bo'shliq bilan kiritdi.
let res = await post('/api/auth/register', {
  email: 'dost@example.com', password: 'parol123', phone: '+998903330001',
  tosAccepted: true, promoCode: ' abc234 ',
}, '198.51.100.1');
check('1) ro‘yxat -> 201', res.status, 201);

// 2) Telefon bilan (email yo'q -> ichki manzil).
res = await post('/api/auth/register', {
  password: 'parol123', phone: '+998903330002', tosAccepted: true, promoCode: 'ABC234',
}, '198.51.100.2');
check('2) telefon bilan ro‘yxat -> 201', res.status, 201);

// 3) Noto'g'ri kod — ro'yxat baribir o'tadi, taklif yozilmaydi.
res = await post('/api/auth/register', {
  email: 'begona@example.com', password: 'parol123', phone: '+998903330003',
  tosAccepted: true, promoCode: 'ZZZZZZ',
}, '198.51.100.3');
check('3) noto‘g‘ri kod bilan ham ro‘yxat -> 201', res.status, 201);

res = await worker.fetch(req('/api/referrals', { cookie: cookie.user }), env);
const body = await res.json();
check('4) egasi 2 ta taklifni ko‘radi', body.referrals.length, 2);
const byEmail = Object.fromEntries(body.referrals.map((r) => [r.referredEmail, r]));
check('4) email bilan ochilgan — email va ism bor',
  [byEmail['dost@example.com']?.referredName], ['dost']);
const phoneOne = body.referrals.find((r) => r.referredEmail === '');
check('4) telefon bilan ochilgan — ichki manzil ko‘rinmaydi', !!phoneOne, true);
check('4) har birida sana bor', body.referrals.every((r) => !!r.createdAt), true);
check('4) javobda ichki manzil umuman yo‘q', JSON.stringify(body).includes('nfcstore.local'), false);

// 5) Chegirma krediti: har taklif +10%.
const pct = sqlite.prepare(`SELECT pending_discount_pct AS p FROM users WHERE id = 1`).get().p;
check('5) egasiga 20% chegirma krediti', pct, 20);

// 6) Boshqa odam birovning ro'yxatini ko'rmaydi.
res = await worker.fetch(req('/api/referrals', { cookie: cookie.other }), env);
check('6) boshqa odamda ro‘yxat bo‘sh', (await res.json()).referrals.length, 0);

done();
