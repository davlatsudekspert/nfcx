// Telefon uzunligi qoidasi FAQAT O'ZGARGAN raqamga qo'llanadi.
// Qoidadan oldin saqlangan (uzunligi boshqacha) raqami bor profil yoki
// kompaniya boshqa maydonlarini (ism, tavsif...) saqlay olishi kerak;
// yangi noto'g'ri raqam esa baribir rad etiladi.
//   node scripts/test-phone-unchanged.mjs
import { readFileSync } from 'node:fs';
import worker from '../hosting/worker.js';
import { makeEnv, seedBasic, cookie, req, makeChecker } from './lib/d1-harness.mjs';

const { env } = makeEnv();
await seedBasic(env);
const { check, checkTrue, done } = makeChecker();
const j = async (pathname, init) => {
  const r = await worker.fetch(req(pathname, init), env);
  let body = null; try { body = await r.json(); } catch { body = null; }
  return { status: r.status, body };
};
const LEGACY = '+99890123456';   // 8 ta raqam — bugungi qoida bo'yicha xato
const BAD_NEW = '+9989012345';

// ═══ 1. Profil (PUT /api/records/:code) ═══
{
  await env.DB.prepare(`UPDATE cards SET phone = ? WHERE code = 'VIP001'`).bind(LEGACY).run();
  const same = await j('/api/records/VIP001', { method: 'PUT', cookie: cookie.user, json: { name: 'Muhammad Yangi', phone: LEGACY } });
  check('record: unchanged legacy phone does not block saving', same.status, 200);
  check('record: other fields saved', same.body?.name, 'Muhammad Yangi');
  const bad = await j('/api/records/VIP001', { method: 'PUT', cookie: cookie.user, json: { name: 'Muhammad', phone: BAD_NEW } });
  check('record: CHANGED bad phone still rejected', bad.status, 422);
  const good = await j('/api/records/VIP001', { method: 'PUT', cookie: cookie.user, json: { name: 'Muhammad', phone: '+998901234567' } });
  check('record: changed valid phone accepted', good.status, 200);
  const back = await j('/api/records/VIP001', { method: 'PUT', cookie: cookie.user, json: { name: 'Muhammad', phone: LEGACY } });
  check('record: cannot switch BACK to a bad phone once fixed', back.status, 422);
  // Yangi ID (POST) — har doim qat'iy.
  const post = await j('/api/records/NEW123', { method: 'POST', cookie: cookie.user, json: { name: 'Yangi', phone: LEGACY } });
  check('record POST (new): bad phone rejected', [post.status, /Telefon/.test(post.body?.error || '')], [422, true]);
}

// ═══ 2. Kompaniya (PATCH /api/companies/:id) ═══
{
  const created = await j('/api/companies', { method: 'POST', cookie: cookie.user, json: {
    companyId: 'TELFIX', displayName: 'Telefon Servis', category: 'market', city: 'Toshkent',
    phone: '+998901234567', description: 'Yetarli uzunlikdagi tavsif matni shu yerda turadi.' } });
  checkTrue('company created', created.status < 400);
  await env.DB.prepare(`UPDATE companies SET phone = ? WHERE company_id = 'TELFIX'`).bind(LEGACY).run().catch(() => {});
  const row = await env.DB.prepare(`SELECT phone FROM companies WHERE company_id = 'TELFIX'`).first().catch(() => null);
  check('company legacy phone seeded', row?.phone, LEGACY);
  const same = await j('/api/companies/TELFIX', { method: 'PATCH', cookie: cookie.user, json: { displayName: 'Telefon Servis 2', phone: LEGACY } });
  check('company: unchanged legacy phone does not block saving', same.status, 200);
  const bad = await j('/api/companies/TELFIX', { method: 'PATCH', cookie: cookie.user, json: { phone: BAD_NEW } });
  check('company: CHANGED bad phone still rejected', [bad.status, bad.body?.error], [422, 'bad_phone']);
  const create = await j('/api/companies', { method: 'POST', cookie: cookie.user, json: {
    companyId: 'TELNEW', displayName: 'Telefon Yangi', category: 'market', city: 'Toshkent',
    phone: LEGACY, description: 'Yetarli uzunlikdagi tavsif matni shu yerda turadi.' } });
  check('company create: bad phone rejected (strict)', create.status, 422);
}

// ═══ 3. Sayt formalari ham shunday (server bilan bir xil) ═══
{
  const ws = readFileSync(new URL('../src/pages/CompanyWorkspacePage.jsx', import.meta.url), 'utf8');
  checkTrue('workspace form validates only changed phone/whatsapp', /phoneChanged\('phone'\) && uzPhoneLengthBad\(form\.phone\)/.test(ws) && /phoneChanged\('whatsapp'\) && uzPhoneLengthBad\(form\.whatsapp\)/.test(ws));
  const acc = readFileSync(new URL('../src/pages/AccountPage.jsx', import.meta.url), 'utf8');
  checkTrue('account form validates only changed phone', /String\(form\.phone \?\? ''\)\.trim\(\) !== String\(card\.phone \?\? ''\)\.trim\(\) && uzPhoneLengthBad\(form\.phone\)/.test(acc));
}

// ═══ 4. Havolalar 404 bermasin ═══
{
  const cp = readFileSync(new URL('../src/pages/CompaniesPage.jsx', import.meta.url), 'utf8');
  checkTrue('"Band qilish" -> /company/create', cp.includes('navigate(`/company/create?id=') && !cp.includes('/kompaniyalar/yaratish'));
  const w = readFileSync(new URL('../hosting/worker.js', import.meta.url), 'utf8');
  checkTrue('Telegram order link -> /workspace/<id>', w.includes('Kabinet: nfcstore.uz/workspace/') && !w.includes('Kabinet: nfcstore.uz/kompaniyalar/'));
}

done();
