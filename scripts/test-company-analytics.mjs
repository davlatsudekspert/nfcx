// BIZNES STATISTIKASI — YOZISHDAN GRAFIKKA QADAR
//
// NIMA UCHUN. Bir paytlar bu funksiya "BACKEND REQUIRED" deb
// belgilangan edi — ya'ni "hali yo'q". Tekshirilganda ma'lum bo'ldiki
// u TO'LIQ ishlaydi va saytga ham ulangan. Bunday noaniqlik
// qaytmasligi uchun endi butun yo'l mashina tomonidan tekshiriladi.
//
// YO'L:
//   ommaviy sahifa  -> POST /api/companies/:id/event  {kind, ref}
//                   -> company_stats jadvali (faqat KUNLIK SANOQ)
//   egasi kabinetda -> GET  /api/companies/:id/stats?days=30
//                   -> CompanyStatsPanel grafigi
//
// Test manba matnini emas, HAQIQIY worker javobini tekshiradi.
//
//   node scripts/test-company-analytics.mjs
import worker from '../hosting/worker.js';
import { makeEnv, seedBasic, cookie, req, makeChecker } from './lib/d1-harness.mjs';

const { check, checkTrue, done } = makeChecker();
const { env } = makeEnv();
await seedBasic(env);

const call = async (path, init) => {
  const r = await worker.fetch(req(path, init), env);
  return { status: r.status, body: await r.json().catch(() => null) };
};

const now = new Date().toISOString();
await env.DB.prepare(
  `INSERT INTO companies (company_id, owner_user_id, display_name, category, tier, price, status, created_at, updated_at)
   VALUES ('TESTCO', '1', 'TEST KOMPANIYA', 'restoran', 'gold', 0, 'active', ?, ?)`,
).bind(now, now).run();

// ── 1) MARSHRUT YETIB BORADIMI ───────────────────────────────────────
// "Handler bor" degani "so'rov yetib boradi" degani EMAS — saytda bu
// xato ikki marta uchragan (`/api/feed`, `/api/my/nfc-devices`).
{
  const r = await call('/api/companies/TESTCO/stats?days=30', { headers: { cookie: cookie.user } });
  check('1) egasi statistikani oladi -> 200', r.status, 200);
  checkTrue('1) "not_found" qaytmaydi', r.body?.error !== 'not_found');
  checkTrue('1) grafik qatori bor', Array.isArray(r.body?.series));
  check('1) 30 kunlik qator', r.body?.series?.length, 30);
  check('1) boshida ko‘rish nol', r.body?.views, 0);
}

// ── 2) EGALIK — BEGONA KO'RMAYDI ─────────────────────────────────────
// Statistika tijorat ma'lumoti: raqobatchi ko'rmasligi kerak.
{
  const foreign = await call('/api/companies/TESTCO/stats?days=30', { headers: { cookie: cookie.other } });
  checkTrue('2) begona foydalanuvchi -> 403/404', [403, 404].includes(foreign.status), `status ${foreign.status}`);
  checkTrue('2) begonaga raqam berilmaydi', !Array.isArray(foreign.body?.series));

  const anon = await call('/api/companies/TESTCO/stats?days=30');
  checkTrue('2) kirmagan -> 401/403/404', [401, 403, 404].includes(anon.status), `status ${anon.status}`);
  checkTrue('2) anonimga raqam berilmaydi', !Array.isArray(anon.body?.series));
}

// ── 3) OMMAVIY YOZISH YO'LI ──────────────────────────────────────────
// Hodisani KIRMAGAN tashrifchi ham yubora olishi kerak — aks holda
// ko'rishlar faqat tizimga kirganlardan sanalardi.
{
  const view = await call('/api/companies/TESTCO/event', { method: 'POST', json: { kind: 'view' } });
  check('3) anonim "view" qabul qilinadi', view.status, 200);

  await call('/api/companies/TESTCO/event', { method: 'POST', json: { kind: 'action', ref: 'phone' } });
  await call('/api/companies/TESTCO/event', { method: 'POST', json: { kind: 'action', ref: 'phone' } });
  await call('/api/companies/TESTCO/event', { method: 'POST', json: { kind: 'action', ref: 'telegram' } });
  await call('/api/companies/TESTCO/event', { method: 'POST', json: { kind: 'item', ref: '42' } });

  const bad = await call('/api/companies/TESTCO/event', { method: 'POST', json: { kind: 'yolgon' } });
  check('3) noma’lum tur -> 422', bad.status, 422);
  const noRef = await call('/api/companies/TESTCO/event', { method: 'POST', json: { kind: 'action' } });
  check('3) manzilsiz "action" -> 422', noRef.status, 422);
}

// ── 4) YOZILGAN RAQAM GRAFIKDA KO'RINADI ─────────────────────────────
// Eng muhim shart: yozish va o'qish BIR XIL ma'lumotga tayansin.
{
  const r = await call('/api/companies/TESTCO/stats?days=30', { headers: { cookie: cookie.user } });
  check('4) ko‘rish sanaldi', r.body?.views, 1);
  check('4) tugma bosilishi sanaldi', r.body?.taps, 3);
  // Bugungi kun grafikda oxirgi nuqta.
  check('4) bugungi kun grafikda', r.body?.series?.[r.body.series.length - 1]?.views, 1);
  // Tugmalar ko'plik bo'yicha tartiblanadi.
  check('4) eng ko‘p bosilgan birinchi', r.body?.actions?.[0]?.key, 'phone');
  check('4) uning soni', r.body?.actions?.[0]?.hits, 2);
  checkTrue('4) ikkinchi tugma ham bor', r.body?.actions?.some((a) => a.key === 'telegram'));
  // Katalog elementi alohida sanaladi.
  checkTrue('4) element bosilishi sanaldi', r.body?.items?.some((i) => String(i.id) === '42'));
}

// ── 5) SAHTA RAQAM BO'LMASIN ─────────────────────────────────────────
// Boshqa kompaniya raqamlari aralashib ketmasin.
{
  await env.DB.prepare(
    `INSERT INTO companies (company_id, owner_user_id, display_name, category, tier, price, status, created_at, updated_at)
     VALUES ('OTHERCO', '2', 'BOSHQA', 'restoran', 'gold', 0, 'active', ?, ?)`,
  ).bind(now, now).run();
  const r = await call('/api/companies/OTHERCO/stats?days=30', { headers: { cookie: cookie.other } });
  check('5) yangi kompaniyada ko‘rish nol', r.body?.views, 0);
  check('5) tugma ham nol', r.body?.taps, 0);
  check('5) qator baribir to‘liq (grafik uzilmaydi)', r.body?.series?.length, 30);
}

// ── 6) NOFAOL KOMPANIYA ──────────────────────────────────────────────
// To'lanmagan/kutilayotgan kompaniyaga raqam yozilmaydi.
{
  await env.DB.prepare(`UPDATE companies SET status = 'draft' WHERE company_id = 'OTHERCO'`).run();
  await call('/api/companies/OTHERCO/event', { method: 'POST', json: { kind: 'view' } });
  const r = await call('/api/companies/OTHERCO/stats?days=30', { headers: { cookie: cookie.other } });
  check('6) nofaol kompaniyaga yozilmaydi', r.body?.views, 0);
}

// ── 7) KUN CHEGARASI ─────────────────────────────────────────────────
{
  const few = await call('/api/companies/TESTCO/stats?days=1', { headers: { cookie: cookie.user } });
  checkTrue('7) juda kichik qiymat eng kamiga tortiladi', few.body?.series?.length >= 7);
  const many = await call('/api/companies/TESTCO/stats?days=9999', { headers: { cookie: cookie.user } });
  checkTrue('7) juda katta qiymat cheklanadi', many.body?.series?.length <= 90);
}

// ── 8) SAYT SHU ENDPOINTGA ULANGAN ───────────────────────────────────
// Backend ishlab, frontend boshqa manzilga qarab tursa — foyda yo'q.
{
  const { readFileSync } = await import('node:fs');
  const lib = readFileSync(new URL('../src/lib/company.js', import.meta.url), 'utf8');
  const page = readFileSync(new URL('../src/pages/CompanyWorkspacePage.jsx', import.meta.url), 'utf8');
  const pub = readFileSync(new URL('../src/pages/CompanyPublicPage.jsx', import.meta.url), 'utf8');
  checkTrue('8) o‘qish TO‘G‘RI manzildan', /\/stats\?days=/.test(lib));
  checkTrue('8) kabinet statistikani chaqiradi', /getCompanyStats\(companyId, days\)/.test(page));
  checkTrue('8) ommaviy sahifa "view" yuboradi', /companyEvent\(company\.companyId, 'view'\)/.test(pub));
  checkTrue('8) tugma bosilishi ham yuboriladi', /companyEvent\([^)]*'action'/.test(pub));
  // Shaxsiy profil analitikasi BOSHQA yo'l — aralashtirilmasin.
  const db = readFileSync(new URL('../src/lib/db.js', import.meta.url), 'utf8');
  checkTrue('8) shaxsiy analitika alohida manzilda', /\/records\/\$\{encodeURIComponent\(code\)\}\/analytics/.test(db));
}

// ── 9) KUTILMAGAN JAVOB QORA EKRAN BERMASIN ──────────────────────────
// Panel ilgari faqat "javob bormi?" deb qarardi va darhol
// `data.series.map(...)` chaqirardi. Javob BO'LIB, lekin kutilgan
// shaklda BO'LMASLIGI mumkin: eski keshdan kelgan nusxa, xato
// obyekti yoki bo'sh massiv (`[]` — u ham "rost"). O'shanda
// `undefined.map` xatosi butun daraxtni yiqitib, odam QOP-QORA
// ekran ko'rardi — hech qanday izohsiz. Brauzerda takrorlandi.
{
  const { readFileSync } = await import('node:fs');
  const { stripComments } = await import('./lib/strip-comments.mjs');
  const page = stripComments(readFileSync(new URL('../src/pages/CompanyWorkspacePage.jsx', import.meta.url), 'utf8'));
  const from = page.indexOf('function CompanyStatsPanel');
  const panel = page.slice(from, page.indexOf('\nfunction ', from + 10));

  checkTrue('9) panel topildi', from > 0 && panel.length > 200);
  // Uchala ro'yxat ham MASSIV ekani tekshirilsin.
  for (const f of ['series', 'actions', 'items']) {
    checkTrue(`9) "${f}" massiv ekani tekshiriladi`,
      new RegExp(`Array\\.isArray\\(data\\?\\.${f}\\)`).test(panel));
  }
  // Tekshirilmagan to'g'ridan-to'g'ri murojaat qolmasin.
  for (const f of ['series', 'actions', 'items']) {
    checkTrue(`9) xom "data.${f}" ishlatilmaydi`, !new RegExp(`data\\.${f}[.\\[]`).test(panel));
  }
  checkTrue('9) shakl mos kelmasa ochiq xabar', /Statistikani yuklab bo/.test(panel));
  // Sonlar ham son bo'lsin (NaN ekranga chiqmasin).
  checkTrue('9) sonlar Number bilan olinadi', /Number\(data\?\.views\)/.test(panel));
}

done('Biznes statistikasi');
