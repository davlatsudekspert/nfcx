// Admin buyurtmalar ro'yxati sinov foydalanuvchilarni yashiradi.
//
// Egasining so'rovi (2026-09): "statistikalarni nol qilib yubor —
// o'zimiz qilgan ishlar bular". YECHIM O'CHIRISH EMAS: buyurtmalar,
// to'lovlar va Payme tarixi moliyaviy yozuv, ularni o'chirish Payme
// bilan solishtirishni buzardi. Shuning uchun "Sinov" deb belgilangan
// foydalanuvchining buyurtmalari shunchaki KO'RSATILMAYDI.
//
//   node scripts/test-admin-orders-test-filter.mjs
import worker, { ensureCoreSchema } from '../hosting/worker.js';
import { makeEnv, seedBasic, cookie, req, makeChecker } from './lib/d1-harness.mjs';

const { check, checkTrue, done } = makeChecker();
const { env } = makeEnv();
await ensureCoreSchema(env);
await seedBasic(env);

const now = new Date().toISOString();
// user#1 — oddiy mijoz, user#2 — egasining sinov akkaunti.
await env.DB.prepare(`INSERT INTO web_orders (id, user_id, code, price, payload, status, kind, created_at)
  VALUES (501, 1, 'ABC123', 49000, '{}', 'pending', 'card_purchase', ?)`).bind(now).run();
await env.DB.prepare(`INSERT INTO web_orders (id, user_id, code, price, payload, status, kind, created_at)
  VALUES (502, 2, 'TST001', 200000, '{}', 'paid', 'card_purchase', ?)`).bind(now).run();

const list = async (q = '') => {
  const r = await worker.fetch(req(`/api/admin/orders${q}`, { cookie: cookie.admin }), env);
  const body = await r.json().catch(() => null);
  return { status: r.status, codes: (body?.orders || []).map((o) => o.code) };
};

// ── 1) Sinov belgisi qo'yilmagan: hammasi ko'rinadi ───────────────────
{
  const r = await list();
  check('1) ikkalasi ham ko‘rinadi', [r.status, r.codes.includes('ABC123'), r.codes.includes('TST001')], [200, true, true]);
}

// ── 2) user#2 "Sinov" deb belgilanadi ────────────────────────────────
await worker.fetch(req('/api/admin/users/2/set-test', { method: 'POST', cookie: cookie.admin, json: { isTest: true } }), env);
{
  const r = await list();
  check('2) sinov akkauntning buyurtmasi YASHIRINDI', r.codes.includes('TST001'), false);
  check('2) oddiy mijozniki joyida', r.codes.includes('ABC123'), true);
}

// ── 3) YOZUV O'CHIRILMAGAN — bazada turibdi ──────────────────────────
{
  const row = await env.DB.prepare(`SELECT status, price FROM web_orders WHERE id = 502`).first();
  check('3) buyurtma bazada saqlanib qolgan', [row?.status, Number(row?.price)], ['paid', 200000]);
  const n = await env.DB.prepare(`SELECT COUNT(*) AS n FROM web_orders`).first();
  check('3) jami buyurtmalar soni o‘zgarmagan', Number(n.n), 2);
}

// ── 4) `?includeTest=1` — hammasi qaytadan ko'rinadi ─────────────────
{
  const r = await list('?includeTest=1');
  check('4) belgilangan holatda hammasi ko‘rinadi', [r.codes.includes('ABC123'), r.codes.includes('TST001')], [true, true]);
}

// ── 5) Sinovdan chiqarilsa — qaytadan ro'yxatda ──────────────────────
await worker.fetch(req('/api/admin/users/2/set-test', { method: 'POST', cookie: cookie.admin, json: { isTest: false } }), env);
{
  const r = await list();
  check('5) sinovdan chiqarilgach qaytadan ko‘rinadi', r.codes.includes('TST001'), true);
}

// ── 6) ICHKI AKKAUNT: buyurtmasi KO'RINADI, lekin pul hisobiga kirmaydi ──
// Egasining o'z akkaunti shunday belgilanadi: buyurtmalar bilan
// ishlashi kerak, lekin uning sinov to'lovlari umumiy hisobni buzmasin.
await worker.fetch(req('/api/admin/users/2/set-internal', { method: 'POST', cookie: cookie.admin, json: { isInternal: true } }), env);
{
  const r = await list();
  check('6) ichki akkaunt buyurtmasi baribir ko‘rinadi', r.codes.includes('TST001'), true);
  const fin = await worker.fetch(req('/api/admin/finance/overview?range=all', { cookie: cookie.admin }), env);
  const body = await fin.json().catch(() => null);
  checkTrue('6) moliya bo‘limi javob berdi', fin.status === 200 && !!body);
  // 502 — 200 000 to'langan buyurtma. Ichki akkaunt belgilangach u
  // yalpi tushumga KIRMASLIGI kerak.
  check('6) ichki akkaunt summasi yalpi tushumga kirmaydi',
    Number(body?.gross ?? body?.overview?.gross ?? 0) >= 200000, false);
}

done();
