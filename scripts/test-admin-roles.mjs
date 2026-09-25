// ADMIN ROLLARI — SERVER TEKSHIRUVI (2026-09-25 audit).
//
// Ilgari bir qator xavfli amallar serverda ISTALGAN adminga (hatto
// content_manager'ga) ochiq edi — interfeys tugmani yashirsa ham, so'rovni
// to'g'ridan-to'g'ri yuborib bajarish mumkin edi:
//   * Business ID arizasini "to'langan/faol" qilish (to'lovsiz);
//   * nom qoidasi va narxini o'zgartirish;
//   * jismoniy karta holati va bloklash;
//   * kompaniya tarifi, profilni butunlay o'chirish, ko'rishlar soni;
//   * marketplace kod partiyalari, auksion amallari, pullik e'lonni to'xtatish.
// Bu test har birini rol bo'yicha tekshiradi.
//
//   node scripts/test-admin-roles.mjs
import worker from '../hosting/worker.js';
import { makeEnv, seedBasic, req, cookie, makeChecker, sha256Hex } from './lib/d1-harness.mjs';

const { check, done } = makeChecker();
const { env, sqlite } = makeEnv({});
await seedBasic(env);
sqlite.prepare(`INSERT INTO admin_sessions (token, admin_id, role, abs_exp, last_activity) VALUES (?, 3, 'content_manager', '2999-01-01T00:00:00.000Z', ?)`)
  .run(sha256Hex('cm-token'), new Date().toISOString());
const CM = 'nfc_admin_session=cm-token';
const call = async (path, method, c, json) => {
  const r = await worker.fetch(req(path, { method, cookie: c, json }), env);
  return r.status;
};
// Jadvallarni yaratish.
await call('/api/admin/company-requests', 'GET', cookie.admin);
const now = new Date().toISOString();
sqlite.prepare(`INSERT INTO companies (company_id, owner_user_id, display_name, tier, price, status, created_at, updated_at)
  VALUES ('ACME', 1, 'Acme', 'silver', 0, 'pending_review', ?, ?)`).run(now, now);
sqlite.prepare(`INSERT INTO physical_cards (id, chip_token, owner_user_id, status) VALUES (1, 'tok1', 1, 'pending')`).run();

const forbidden = (s) => s === 403;
const allowed = (s) => s !== 403 && s !== 401;

// ── Business ID arizalari ──
check('CM: arizani tasdiqlay olmaydi', forbidden(await call('/api/admin/company-requests/ACME/status', 'PATCH', CM, { status: 'approved' })), true);
check('manager: arizani tasdiqlaydi', allowed(await call('/api/admin/company-requests/ACME/status', 'PATCH', cookie.manager, { status: 'approved' })), true);
check('manager: "faol" (to‘lovsiz) qila olmaydi', forbidden(await call('/api/admin/company-requests/ACME/status', 'PATCH', cookie.manager, { status: 'active' })), true);
check('super: "faol" qiladi', allowed(await call('/api/admin/company-requests/ACME/status', 'PATCH', cookie.admin, { status: 'active' })), true);
check('manager: nom qoidasi/narxi — yo‘q', forbidden(await call('/api/admin/company-id-rules', 'PUT', cookie.manager, { companyId: 'ZETA', rule: 'reserved' })), true);
check('super: nom qoidasi — ha', allowed(await call('/api/admin/company-id-rules', 'PUT', cookie.admin, { companyId: 'ZETA', rule: 'reserved' })), true);
check('CM: domen holati — yo‘q', forbidden(await call('/api/admin/company-domains/ACME', 'PATCH', CM, { status: 'active' })), true);

// ── jismoniy kartalar ──
check('CM: karta holati — yo‘q', forbidden(await call('/api/admin/physical-cards/1/status', 'POST', CM, { status: 'printing' })), true);
check('CM: kartani bloklash — yo‘q', forbidden(await call('/api/admin/physical-cards/1/active', 'POST', CM, { active: false })), true);
check('manager: karta holati — ha', allowed(await call('/api/admin/physical-cards/1/status', 'POST', cookie.manager, { status: 'printing' })), true);

// ── eski biznes profillar ──
check('CM: katalogdan yashirish — yo‘q', forbidden(await call('/api/admin/companies/BIZ777/status', 'POST', CM, { hidden: true })), true);
check('manager: tarifni o‘zgartirish — yo‘q', forbidden(await call('/api/admin/companies/BIZ777/tier', 'POST', cookie.manager, { tier: 'gold' })), true);

// ── profil ──
check('manager: profilni butunlay o‘chirish — yo‘q', forbidden(await call('/api/admin/records/OTH222', 'DELETE', cookie.manager)), true);
check('manager: ko‘rishlar sonini o‘zgartirish — yo‘q', forbidden(await call('/api/admin/records/VIP001/views', 'POST', cookie.manager, { views: 999 })), true);
{
  const s = await call('/api/admin/records/OTH222', 'DELETE', cookie.admin);
  check('super: profilni o‘chirish yo‘li endi ishlaydi (ilgari 404)', s !== 404 && s !== 403, true);
}

// ── marketplace, auksion, pullik e'lon ──
check('CM: marketplace mahsulot yaratish — yo‘q', forbidden(await call('/api/admin/marketplace/products', 'POST', CM, { sku: 'X' })), true);
check('CM: marketplace ro‘yxatini ko‘radi', allowed(await call('/api/admin/marketplace/products', 'GET', CM)), true);
check('CM: auksion yaratish — yo‘q', forbidden(await call('/api/admin/auctions', 'POST', CM, { code: 'ZZZ' })), true);
check('manager: sotuvchi to‘lovini belgilash — yo‘q', forbidden(await call('/api/admin/auctions/1/mark-payout-paid', 'POST', cookie.manager)), true);
check('CM: pullik e’lonni to‘xtatish — yo‘q', forbidden(await call('/api/admin/featured/1/stop', 'POST', CM, { reason: 'x' })), true);

done();
