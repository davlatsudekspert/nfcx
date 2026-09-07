// Kutilayotgan buyurtmani DAVOM ETTIRISH (2026-09).
//   node scripts/test-pending-paylink.mjs
//
// NIMA UCHUN: "To'lovlar" sahifasida va kabinetdagi "Buyurtmalarim"da
// kutilayotgan buyurtma yonida FAQAT "Kutilmoqda" yozuvi turardi —
// to'lovni tugatishning hech qanday yo'li yo'q edi. Mijoz band qilib
// to'lamasa, kod 24 soat band qolardi va u qaytadan ham urinolmasdi
// (o'zining kutilayotgan buyurtmasi to'sqinlik qilardi).
import worker from '../hosting/worker.js';
import { makeEnv, seedBasic, cookie, req, makeChecker } from './lib/d1-harness.mjs';

const { env } = makeEnv();
await seedBasic(env);
env.PAYMENTS_ENABLED = 'true'; env.PAYME_MERCHANT_ID = 'M1'; env.PAYME_KEY = 'k';
const { check, checkTrue, done } = makeChecker();
const j = async (p, init) => { const r = await worker.fetch(req(p, init), env); let b=null; try{b=await r.json()}catch{} return {status:r.status, body:b}; };

// Kutilayotgan va to'langan buyurtma
await env.DB.prepare(`INSERT INTO web_orders (id,user_id,code,kind,price,payload,status) VALUES (501,1,'TTS075','card_purchase',49000,'{}','pending')`).run();
await env.DB.prepare(`INSERT INTO web_orders (id,user_id,code,kind,price,payload,status) VALUES (502,1,'OLD001','card_purchase',99000,'{}','paid')`).run();

{
  const r = await j('/api/orders', { cookie: cookie.user });
  const by = Object.fromEntries((r.body?.orders || []).map((o) => [o.id, o]));

  // ═══ Kutilayotganda havola BOR ═══
  checkTrue('kutilayotgan buyurtmada payLink bor', !!by[501]?.payLink);
  const dec = Buffer.from(String(by[501].payLink).split('/').pop(), 'base64').toString();
  check('havola shu buyurtmaga', dec.includes('ac.order_id=501'), true);
  check('summa tiyinda (49 000 -> 4 900 000)', dec.includes('a=4900000'), true);

  // ═══ To'langanda havola YO'Q ═══
  // Yakunlangan buyurtmani qayta to'lash mumkin bo'lmasligi kerak.
  check('to\'langan buyurtmada payLink yo\'q', by[502]?.payLink, null);
}

// ═══ BOSHQA foydalanuvchi ko'ra olmaydi ═══
{
  const other = await j('/api/orders', { cookie: cookie.other });
  const codes = (other.body?.orders || []).map((o) => o.id);
  check('begona buyurtma ro\'yxatda yo\'q', codes.includes(501), false);
}

// ═══ Kalitlar yo'q bo'lsa havola bo'sh ═══
// Merchant ID bo'lmasa noto'g'ri havola yasalmasligi kerak.
{
  const e2 = { ...env, PAYME_MERCHANT_ID: '' };
  const r = await worker.fetch(req('/api/orders', { cookie: cookie.user }), e2);
  const b = await r.json();
  const row = (b.orders || []).find((o) => o.id === 501);
  check('merchant ID siz havola bo\'sh', row?.payLink, '');
}

done();
