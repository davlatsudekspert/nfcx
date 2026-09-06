// Kompaniya nomi taqiqlangan so'z filtri testi — frontend (src/lib/nameGuard.js)
// va backend (hosting/worker.js -> haqiqiy HTTP endpointlar) birgalikda.
//   node scripts/test-company-name-guard.mjs
import worker from '../hosting/worker.js';
import { companyNameBlocked } from '../src/lib/nameGuard.js';
import { makeEnv, seedBasic, cookie, req, makeChecker } from './lib/d1-harness.mjs';

const { env } = makeEnv();
await seedBasic(env);
const { check, checkTrue, done } = makeChecker();
const j = async (pathname, init) => {
  const r = await worker.fetch(req(pathname, init), env);
  let body = null; try { body = await r.json(); } catch { body = null; }
  return { status: r.status, body };
};

// Bloklanishi SHART bo'lgan variantlar — katta-kichik harf, tinish belgilari,
// bo'shliq, Unicode homogliflar, nol-kenglikdagi belgilar, to'liq kenglik.
const MUST_BLOCK = [
  'God', 'GOD', 'god', 'GoD', 'gOD',
  'NFC GOD Market', 'Toshkent God Servis', 'Servis GOD',
  'Godiva',                       // so'z ichida
  'g.o.d', 'G-O-D', 'g_o_d',      // tinish belgilari bilan ajratish
  'G O D', 'G  O  D',             // bo'shliq bilan ajratish (bosh harflar)
  'G0D', 'g0d',                   // raqam 0 -> o
  'Ｇｏｄ',           // to'liq kenglikdagi Ｇｏｄ (NFKC)
  'ĝöd',                // diakritiklar: ĝöd
  'g​o​d',              // nol-kenglikdagi ajratgich
  'Gоd',                     // kirill o
  'ɢod',                     // kichik bosh harf G
  'ɢᴏᴅ',           // ɢᴏᴅ
  'GØD',                     // Ø -> o
  '   gOd   ',                    // atrofdagi bo'shliqlar
];

// Bloklanmasligi SHART — begunoh nomlar (yolg'on ijobiy bo'lmasin)
const MUST_PASS = [
  'Chicago Doner', 'Mango Delivery', 'Fargo Dizayn', 'Go Digital Group',
  'NFC Dorixona', 'Good Food', 'Gold Market', 'Tashkent Gold', 'Dogma',
  'Grand Osiyo Depo', 'Osiyo Savdo', 'Bogota Kafe',
];

// ═══ 1. Frontend filtri ═══
{
  let bad = 0;
  for (const v of MUST_BLOCK) if (!companyNameBlocked(v)) { console.log('   miss:', JSON.stringify(v)); bad++; }
  check(`frontend blocks all ${MUST_BLOCK.length} evasion variants`, bad, 0);
  let fp = 0;
  for (const v of MUST_PASS) if (companyNameBlocked(v)) { console.log('   false positive:', JSON.stringify(v)); fp++; }
  check(`frontend allows all ${MUST_PASS.length} legitimate names`, fp, 0);
  check('empty / null name is not blocked', [companyNameBlocked(''), companyNameBlocked(null), companyNameBlocked(undefined)], [false, false, false]);
}

// ═══ 2. Backend CREATE (POST /api/companies) ═══
// Company ID faqat A-Z harflaridan iborat bo'lishi kerak — indeksni
// harflarga aylantiramiz (0 -> AAA, 1 -> AAB, ...).
const letterId = (prefix, i) => prefix + String.fromCharCode(65 + Math.floor(i / 26) % 26) + String.fromCharCode(65 + (i % 26)) + 'X';
const baseBody = (displayName, id) => ({
  companyId: id, displayName, category: 'market', city: 'Toshkent',
  phone: '+998901234567', description: 'Yetarli uzunlikdagi tavsif matni shu yerda turadi.',
});
{
  let n = 0;
  for (const [i, name] of MUST_BLOCK.entries()) {
    const r = await j('/api/companies', { method: 'POST', cookie: cookie.user, json: baseBody(name, letterId('BLK', i)) });
    if (r.status !== 422 || r.body?.error !== 'name_not_allowed') { console.log('   not blocked by API:', JSON.stringify(name), r.status, JSON.stringify(r.body)); n++; }
  }
  check('backend create rejects every variant with 422 name_not_allowed', n, 0);

  const ok = await j('/api/companies', { method: 'POST', cookie: cookie.user, json: baseBody('Chicago Doner', 'CHICAGO') });
  checkTrue('backend create ACCEPTS a legitimate name', ok.status < 400);
}

// ═══ 3. Backend UPDATE (PATCH /api/companies/:id) ═══
{
  const bad = await j('/api/companies/CHICAGO', { method: 'PATCH', cookie: cookie.user, json: { displayName: 'G.O.D Servis' } });
  check('backend update rejects a blocked rename -> 422', [bad.status, bad.body?.error], [422, 'name_not_allowed']);

  const good = await j('/api/companies/CHICAGO', { method: 'PATCH', cookie: cookie.user, json: { displayName: 'Chicago Doner 2' } });
  checkTrue('backend update ACCEPTS a legitimate rename', good.status < 400);

  const still = await env.DB.prepare(`SELECT display_name FROM companies WHERE company_id = 'CHICAGO'`).first();
  check('rejected rename did NOT reach the database', still.display_name, 'Chicago Doner 2');
}

// ═══ 4. Frontend va backend filtri BIR XIL ═══
{
  let mismatch = 0;
  for (const [i, name] of [...MUST_BLOCK, ...MUST_PASS].entries()) {
    const fe = companyNameBlocked(name);
    const r = await j('/api/companies', { method: 'POST', cookie: cookie.user, json: baseBody(name, letterId('SYN', i)) });
    const be = r.status === 422 && r.body?.error === 'name_not_allowed';
    if (fe !== be) { console.log('   diverged:', JSON.stringify(name), 'fe=', fe, 'be=', be); mismatch++; }
  }
  check('frontend guard and worker guard agree on every case', mismatch, 0);
}

done();
