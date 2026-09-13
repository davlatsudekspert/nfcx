// JISMONIY KARTA NARXI — BITTA MANBA.
//
// Narx ilgari sayt kodida NUSXA sifatida saqlanardi
// (src/lib/pricing.js PHYSICAL_CARD_FEE) va backendda alohida
// (hosting/api/account.js). Ular ajralib ketsa, sayt bir summani
// ko'rsatib turadi, server esa boshqasini oladi — mijoz uchun eng
// yomon xato turi.
//
// Endi narx `/api/settings/physical-nfc-pricing` javobida ham keladi
// va mobil ilova uni SHU YERDAN o'qiydi. Bu test ikkisi bir xilligini
// qo'riqlaydi: e'lon qilingan narx BUYURTMA summasi bilan mos kelsin.
//
//   node scripts/test-physical-card-fee.mjs
import worker, { ensureCoreSchema } from '../hosting/worker.js';
import { PHYSICAL_CARD_FEE } from '../hosting/api/account.js';
import { makeEnv, seedBasic, req, cookie, makeChecker } from './lib/d1-harness.mjs';

const { check, checkTrue, done } = makeChecker();
// Payme kalitlari — buyurtma oqimi ular bo'lmasa 503 qaytaradi.
const { env, sqlite } = makeEnv({
  PAYMENTS_ENABLED: 'true',
  PAYME_MERCHANT_ID: 'test-merchant',
  PAYME_KEY: 'test-key',
});
await ensureCoreSchema(env);
await seedBasic(env);

// ── 1) Narx ochiq endpointda e'lon qilinadi ──────────────────────────
const res = await worker.fetch(req('/api/settings/physical-nfc-pricing'), env);
check('200 qaytadi', res.status, 200);
const body = await res.json();
check('physicalCardFee e‘lon qilingan', body.physicalCardFee, PHYSICAL_CARD_FEE);

// Mavjud maydonlar JOYIDA — sayt bu javobni allaqachon o'qiydi.
checkTrue('tiers joyida', Array.isArray(body.tiers) && body.tiers.length > 0);
checkTrue('delivery joyida', typeof body.delivery?.minDays === 'number');

// ── 2) E'lon qilingan narx HAQIQIY buyurtma summasiga teng ───────────
// VIP001 — user#1 niki (seedBasic). Tarif `exclusive` bo'lgani uchun
// jismoniy karta imkoniyati ochiq.
for (const qty of [1, 3]) {
  const order = await worker.fetch(req('/api/records/VIP001/order-physical-card', {
    method: 'POST',
    cookie: cookie.user,
    json: { shippingName: 'Mijoz', shippingPhone: '+998901112233', quantity: qty },
  }), env);
  const ob = await order.json();
  check(`${qty} dona: 202`, order.status, 202);
  check(`${qty} dona: summa e‘londagiga teng`, ob.amount, body.physicalCardFee * qty);
  check(`${qty} dona: soni qaytadi`, ob.quantity, qty);
}

// ── 3) Butun bo'lmagan son qabul qilinmaydi ──────────────────────────
// 2.5 ni 3 ga yaxlitlash mijoz so'ramagan kartani sotish bo'lardi.
const bad = await worker.fetch(req('/api/records/VIP001/order-physical-card', {
  method: 'POST',
  cookie: cookie.user,
  json: { shippingName: 'Mijoz', shippingPhone: '+998901112233', quantity: 2.5 },
}), env);
check('kasr son rad etiladi', bad.status, 422);

// ── 4) Begona ID ga buyurtma bermaydi ────────────────────────────────
const other = await worker.fetch(req('/api/records/OTH222/order-physical-card', {
  method: 'POST',
  cookie: cookie.user,
  json: { shippingName: 'Mijoz', shippingPhone: '+998901112233', quantity: 1 },
}), env);
check('begona ID — 403', other.status, 403);

// ── 5) Yozuvlar bazada qoldi ─────────────────────────────────────────
const n = sqlite.prepare(
  `SELECT COUNT(*) AS n FROM web_orders WHERE kind = 'physical_card_order'`
).get().n;
check('ikkita buyurtma yozildi', n, 2);

done();
