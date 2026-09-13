// KUTILAYOTGAN BUYURTMA TAYMERI — HAR QANDAY VAQT FORMATIDA ISHLAYDI.
//
// Bazada vaqt uch xil yozilgan va SQLite ulardan BIRINI parse qila
// olmaydi: "2026-09-07 00:21:21.065+00" (soat mintaqasida daqiqa yo'q).
// Aynan shu format worker.js `nowTs()` va eski Postgres ko'chirmasidan
// keladi — ya'ni premium va jismoniy karta buyurtmalarining HAMMASI.
//
// Ilgari bunday buyurtmada `expiresAtMs` NULL bo'lardi va mijoz
// to'lovni davom ettirish oynasida qancha vaqti qolganini KO'RMASDI.
//
//   node scripts/test-order-timer.mjs
import worker, { ensureCoreSchema } from '../hosting/worker.js';
import { PENDING_ORDER_TTL_MS } from '../hosting/api/order-window.js';
import { makeEnv, seedBasic, req, cookie, makeChecker } from './lib/d1-harness.mjs';

const { check, checkTrue, done } = makeChecker();
const { env, sqlite } = makeEnv({});
await ensureCoreSchema(env);
await seedBasic(env);

// Bir xil paytni UCH XIL formatda yozamiz.
const base = new Date('2026-09-13T09:00:00.000Z');
const forms = {
  101: base.toISOString().replace('T', ' ').replace('Z', '+00'), // nowTs()
  102: '2026-09-13 09:00:00',                                     // CURRENT_TIMESTAMP
  103: base.toISOString(),                                        // ISO
};
const add = sqlite.prepare(
  `INSERT INTO web_orders (id, user_id, code, price, payload, status, kind, created_at)
   VALUES (?, 1, ?, 149000, '{}', 'pending', 'card_purchase', ?)`);
for (const [id, ts] of Object.entries(forms)) add.run(Number(id), `COD${id}`, ts);

// Buzuq qiymat ham bo'lishi mumkin — u NULL qaytarishi kerak, yiqilmasligi.
add.run(104, 'COD104', 'umuman-sana-emas');

const res = await worker.fetch(req('/api/orders', { cookie: cookie.user }), env);
check('200 qaytadi', res.status, 200);
const { orders } = await res.json();
const byId = Object.fromEntries(orders.map((o) => [o.id, o]));

const expected = base.getTime() + PENDING_ORDER_TTL_MS;
for (const id of [101, 102, 103]) {
  check(`#${id}: muddat hisoblandi`, byId[id]?.expiresAtMs, expected);
}
check('buzuq sana — NULL, lekin so‘rov yiqilmadi', byId[104]?.expiresAtMs, null);

// To'lovni DAVOM ETTIRISH havolasi — kutilayotgan buyurtmada bo'lishi shart.
// Aks holda mijoz to'lovni yarmida tashlab ketsa, kod 24 soat band
// qolib, u qaytadan urinolmaydi ham.
checkTrue('kutilayotganda payLink bor', typeof byId[101]?.payLink === 'string');

// To'langan buyurtmada havola BO'LMASLIGI kerak.
sqlite.prepare(`UPDATE web_orders SET status = 'paid' WHERE id = 101`).run();
const after = await (await worker.fetch(req('/api/orders', { cookie: cookie.user }), env)).json();
const paid = after.orders.find((o) => o.id === 101);
check('to‘langanda payLink yo‘q', paid.payLink, null);
check('to‘langanda muddat ham yo‘q', paid.expiresAtMs, null);

// Kirmagan odam boshqaning buyurtmasini ko'rmaydi.
const anon = await (await worker.fetch(req('/api/orders'), env)).json();
check('kirmagan — bo‘sh ro‘yxat', anon.orders, []);

done();
