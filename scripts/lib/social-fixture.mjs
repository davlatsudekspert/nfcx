// Ijtimoiy imkoniyatlar testlari (2026-10) uchun umumiy tayyorlov:
// haqiqiy worker + xotiradagi D1 (d1-harness), user#1 (VIP001, BIZ777),
// user#2 (OTH222), user#1 ning faol kompaniyasi ACMEUZ, user#2 niki OTHERCO.
// Production'ga HECH QACHON tegmaydi.
import worker from '../../hosting/worker.js';
import { makeEnv, seedBasic, req, cookie, makeChecker } from './d1-harness.mjs';

export { cookie, makeChecker };

export async function setupSocial(extraEnv = {}) {
  const { env, sqlite } = makeEnv(extraEnv, { atomicBatch: true });
  await seedBasic(env);
  // Kompaniya sxemasi va ustunlari (companyApi birinchi chaqiruvda yaratadi).
  await worker.fetch(req('/api/companies/check?id=ZZZZ'), env);
  const now = new Date().toISOString();
  const addCompany = (id, owner, extra = {}) => sqlite.prepare(
    `INSERT INTO companies (company_id, owner_user_id, owner_email, display_name, category, city, address, phone, telegram,
       latitude, longitude, tier, price, status, admin_note, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(id, String(owner), extra.email ?? `owner${owner}@secret.local`, extra.name ?? id, extra.category ?? 'shop',
    extra.city ?? 'Toshkent', extra.address ?? null, extra.phone ?? null, extra.telegram ?? null,
    extra.lat ?? null, extra.lng ?? null, 'free', 0, extra.status ?? 'active', extra.adminNote ?? 'ichki izoh', now, now);
  addCompany('ACMEUZ', 1, { phone: '+998901234567', telegram: '@acme', address: 'Toshkent, Chilonzor', lat: 41.2995, lng: 69.2401 });
  addCompany('OTHERCO', 2, { phone: '+998907654321' });
  const call = async (pathname, init = {}) => {
    const res = await worker.fetch(req(pathname, init), env);
    const text = await res.text();
    let body = null;
    try { body = JSON.parse(text); } catch { body = text; }
    return { status: res.status, body, headers: res.headers };
  };
  const resetLimits = () => sqlite.prepare(`DELETE FROM rate_limits`).run();
  return { env, sqlite, call, addCompany, resetLimits, worker };
}
