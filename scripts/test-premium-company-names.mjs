// Admin: premium kompaniya nomlari ro'yxati (yangi endpoint) testi.
import worker, { ensureCoreSchema } from '../hosting/worker.js';
import { makeEnv, seedBasic, cookie, req, makeChecker } from './lib/d1-harness.mjs';
const { check, checkTrue, done } = makeChecker();
const { env } = makeEnv();
await ensureCoreSchema(env);
await seedBasic(env);
const j = async (p, init = {}) => { const r = await worker.fetch(req(p, { cookie: cookie.admin, ...init }), env); return { status: r.status, body: await r.json().catch(() => null) }; };

const r = await j('/api/admin/premium-company-names');
check('1) 200', r.status, 200);
check('2) 235 ta nom (KING Level 2 dan level_top ga ko‘chdi)', (r.body?.names || []).length, 235);
const by = Object.fromEntries((r.body?.names || []).map((x) => [x.name, x]));
check('3) BANK level_0 4 990 000 AVAILABLE', [by.BANK?.level, by.BANK?.price, by.BANK?.status], ['level_0', 4990000, 'AVAILABLE']);
check('3) PIZZA level_4 990 000', [by.PIZZA?.level, by.PIZZA?.price], ['level_4', 990000]);

// Eng yuqori daraja (egasining ro'yxati) — 9 990 000. Admin ro'yxatida
// ham, ochiq qidiruvda ham AYNAN shu narx chiqishi kerak: ikkalasi bir
// manbadan (src/lib/exclusivePricing.js) o'qiydi, lekin qidiruv yo'li
// boshqa (companyAvailability) — shuning uchun ikkalasi tekshiriladi.
for (const name of ['KING', 'ONE', 'UZB', 'USD', 'EURO', 'UFC', 'AMG', 'GTR', 'BIR', 'ONA', 'OTA', 'OYI', 'ADA']) {
  check(`3t) ${name} level_top 9 990 000`, [by[name]?.level, by[name]?.price], ['level_top', 9990000]);
  const q = await j(`/api/companies/check?id=${name}`);
  check(`3t) ${name} qidiruvda ham`, [q.body?.available, q.body?.price, q.body?.premiumName], [true, 9990000, true]);
}

// Admin qo'lda narx qo'ysa — u avtomatik narxdan USTUN.
await j('/api/admin/company-id-rules', { method: 'PUT', json: { companyId: 'BANK', rule: 'allow', priceOverride: 7000000, note: 'maxsus' } });
const r2 = await j('/api/admin/premium-company-names');
const bank = (r2.body?.names || []).find((x) => x.name === 'BANK');
check('4) admin narxi ustun', [bank?.price, bank?.autoPrice, bank?.priceOverride], [7000000, 4990000, 7000000]);
const chk = await j('/api/companies/check?id=BANK');
check('4b) qidiruvda ham admin narxi', chk.body?.price, 7000000);

// Reserved qilinsa — holat o'zgaradi.
await j('/api/admin/company-id-rules', { method: 'PUT', json: { companyId: 'AERO', rule: 'reserved' } });
const r3 = await j('/api/admin/premium-company-names');
check('5) AERO RESERVED', (r3.body?.names || []).find((x) => x.name === 'AERO')?.status, 'RESERVED');

// Sotilgan nom — OWNED, va qayta sotuvga chiqmaydi.
await env.DB.prepare(`INSERT INTO companies (company_id, owner_user_id, display_name, category, city, phone, description, status, tier, price, created_at, updated_at)
  VALUES ('CAFE', 1, 'Cafe', 'food', 'Toshkent', '+998901111111', 'test', 'active', 'premium', 2990000, ?, ?)`).bind(new Date().toISOString(), new Date().toISOString()).run();
const r4 = await j('/api/admin/premium-company-names');
check('6) CAFE OWNED', (r4.body?.names || []).find((x) => x.name === 'CAFE')?.status, 'OWNED');
const chk2 = await j('/api/companies/check?id=CAFE');
check('6b) egallangan nom sotilmaydi', chk2.body?.available, false);

done();
