// MARKETPLACE — UNIVERSAL NFC AKTIVATSIYA (2026-09)
//
// Maqsad: NFCSTORE fizik mahsulotlari Uzum Market va boshqa
// marketplace'larda sotiladi. Xaridor QR'ni skanerlaydi, aktivatsiya
// kodini kiritadi va SHAXSIY yoki BIZNES profilni o'zi tanlaydi.
//
// BU TEST ENG AVVALO BITTA NARSANI QO'RIQLAYDI: PARALLEL TIZIM
// YARATILMAGANINI.
//   • yangi ID generatori YO'Q — `auth.js: createFreeAutoId`;
//   • marketplace tarifi/limiti YO'Q — 'auto' da `tier_override`
//     umuman yozilmaydi, ya'ni ID oddiy bepul ID bilan AYNAN bir xil;
//   • marketplace profil modeli YO'Q — oddiy `cards` / `companies`.
//
// Qolgani — pul va egalik bilan bog'liq qattiq talablar: bitta kodni
// ikki odam egallab ololmasligi, yarim qolgan aktivatsiyadan orfan
// yozuv qolmasligi, tugmani ikki marta bosish ikkinchi ID yaratmasligi.
//
// Hammasi HAQIQIY `hosting/worker.js` va haqiqiy SQLite ustida yuradi.
//
//   node scripts/test-marketplace.mjs
import { readFileSync } from 'node:fs';
import worker from '../hosting/worker.js';
import { makeEnv, seedBasic, cookie, req, makeChecker } from './lib/d1-harness.mjs';
import { normalizeActivationCode, formatActivationCode, generateActivationCode } from '../hosting/api/marketplace.js';
import { stripComments } from './lib/strip-comments.mjs';

const { check, checkTrue, done } = makeChecker();
const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');

const jsonOf = async (res) => { try { return await res.json(); } catch { return null; } };

// BITTA UMUMIY BAZA. `worker.js` dagi `ensureCoreSchema` jarayon
// davomida BIR MARTA ishlaydi (`coreSchemaReady` — modul darajasidagi
// promise), shuning uchun bitta test faylida ikkinchi baza yaratib
// bo'lmaydi: ikkinchisida admin jadvallari umuman yaratilmasdi.
const { env: DB_ENV } = makeEnv();
await seedBasic(DB_ENV);

// HAR BO'LIM O'Z IP SI BILAN. Tezlik chegarasi (rateLimitD1) bazada
// saqlanadi, ya'ni umumiy bazada oldingi bo'limning urinishlari
// keyingisini 429 ga tushirib qo'yardi. Haqiqiy hayotda ham har
// xaridor boshqa IP dan keladi.
let ipCounter = 0;
function nextIp() { ipCounter += 1; return `203.0.113.${ipCounter}`; }
let BLOCK_IP = nextIp();
const call = (env, path, init = {}) => worker.fetch(req(path, { ip: BLOCK_IP, ...init }), env, { waitUntil() {} });

async function setup() { BLOCK_IP = nextIp(); return DB_ENV; }

// Umumiy bazada `SELECT ... FROM marketplace_activations` ni WHERE'siz
// o'qish BOSHQA bo'limning qatorini olib kelardi. Har doim kod dumi
// bo'yicha aniq qator.
const rowOfCode = (env, code, cols = '*') =>
  env.DB.prepare(`SELECT ${cols} FROM marketplace_activations WHERE code_tail = ?`).bind(code.slice(-4)).first();

// Kompaniya qatori: `tier` NOT NULL, shuning uchun to'liq yoziladi.
const addCompany = (env, id, ownerUserId, name) => env.DB.prepare(
  `INSERT INTO companies (company_id, owner_user_id, display_name, category, city, description, phone, tier, price, status, created_at, updated_at)
   VALUES (?,?,?,'other','Toshkent','Test kompaniya','+998900000000','free',0,'active','2026-01-01','2026-01-01')`
).bind(id, String(ownerUserId), name).run();

async function makeProduct(env, over = {}) {
  const res = await call(env, '/api/admin/marketplace/products', {
    method: 'POST', cookie: cookie.admin,
    json: { name: 'NFC Smart Sticker', sku: `UZ-NFC-${Math.random().toString(36).slice(2, 8).toUpperCase()}`, marketplace: 'uzum', physicalType: 'nfc_sticker', includedTier: 'auto', ...over },
  });
  return (await jsonOf(res))?.product;
}

async function makeCodes(env, productId, quantity = 1) {
  const res = await call(env, '/api/admin/marketplace/batch', {
    method: 'POST', cookie: cookie.admin, json: { productId, quantity },
  });
  return jsonOf(res);
}

// ── 0) KOD SHAKLI VA NORMALIZATSIYA ──────────────────────────────────
// Odam kodni kichik harfda, chiziqchasiz, bo'shliq bilan kiritadi —
// hammasi BIR XIL kodga olib kelishi shart.
{
  const code = generateActivationCode();
  checkTrue('0) kod NF-XXXX-XXXX shaklida', /^NF-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(code));
  const n = normalizeActivationCode(code);
  check('0) normalizatsiya 8 belgi', n.length, 8);
  check('0) kichik harf ham ishlaydi', normalizeActivationCode(code.toLowerCase()), n);
  check('0) chiziqchasiz ham', normalizeActivationCode(code.replace(/-/g, '')), n);
  check('0) bo‘shliq bilan ham', normalizeActivationCode(` ${code.replace(/-/g, ' ')} `), n);
  check('0) qayta formatlash aslini beradi', formatActivationCode(n), code);
  // Chalkashadigan belgilar alifboda YO'Q.
  checkTrue('0) I/O/0/1 ishlatilmaydi', !/[IO01]/.test(n));
  check('0) qisqa kod rad etiladi', normalizeActivationCode('NF-AB'), '');
  check('0) uzun kod rad etiladi', normalizeActivationCode('NF-ABCD-EFGH-JK'), '');
  // 500 kod — takrorlanish bo'lmasin.
  const seen = new Set();
  for (let i = 0; i < 500; i++) seen.add(generateActivationCode());
  check('0) 500 kodda takror yo‘q', seen.size, 500);
}

// ── 1) BATCH: DUPLICATE = 0 ──────────────────────────────────────────
{
  const env = await setup();
  const product = await makeProduct(env);
  checkTrue('1) mahsulot yaratildi', !!product?.id);
  check('1) SKU katta harfda', product.sku, product.sku.toUpperCase());

  const batch = await makeCodes(env, product.id, 100);
  check('1) 100 kod yaratildi', batch.codes.length, 100);
  const uniq = new Set(batch.codes.map((c) => c.code));
  check('1) DUPLICATE = 0', uniq.size, 100);
  checkTrue('1) batch id berildi', /^B/.test(batch.batchId));

  // TO'LIQ KOD BAZADA SAQLANMAYDI.
  const rows = await env.DB.prepare(`SELECT code_hash, code_tail FROM marketplace_activations LIMIT 5`).all();
  for (const r of rows.results) {
    checkTrue('1) bazada xesh (64 hex)', /^[0-9a-f]{64}$/.test(r.code_hash));
    check('1) bazada faqat 4 belgi dumi', r.code_tail.length, 4);
  }
  const plain = batch.codes[0].code;
  const hit = await env.DB.prepare(`SELECT COUNT(*) AS n FROM marketplace_activations WHERE code_tail = ? OR code_hash = ?`).bind(plain, plain).first();
  checkTrue('1) ochiq kod bazada topilmaydi', Number(hit.n) === 0);

  // Admin ro'yxatida ham to'liq kod yo'q.
  const list = await jsonOf(await call(env, '/api/admin/marketplace/activations', { cookie: cookie.admin }));
  checkTrue('1) admin ro‘yxati maskalangan', list.activations.every((a) => /^\*\*\*\*-/.test(a.codeMasked) && !('code' in a)));

  // SKU takrorlanmaydi.
  const dup = await call(env, '/api/admin/marketplace/products', { method: 'POST', cookie: cookie.admin, json: { name: 'X', sku: product.sku } });
  check('1) bir xil SKU rad etiladi', dup.status, 409);
}

// ── 2) MEHMON VA NOTO'G'RI KOD ───────────────────────────────────────
{
  const env = await setup();
  const product = await makeProduct(env);
  const batch = await makeCodes(env, product.id, 1);
  const code = batch.codes[0].code;

  check('2) admin cookie’siz batch yo‘q', (await call(env, '/api/admin/marketplace/batch', { method: 'POST', json: { productId: product.id, quantity: 1 } })).status, 401);
  check('2) admin cookie’siz ro‘yxat yo‘q', (await call(env, '/api/admin/marketplace/activations', {})).status, 401);

  check('2) yo‘q kod -> 404', (await call(env, '/api/activate/check', { method: 'POST', json: { code: 'NF-ZZZZ-ZZZZ' } })).status, 404);
  check('2) buzuq kod -> 422', (await call(env, '/api/activate/check', { method: 'POST', json: { code: 'salom' } })).status, 422);

  const okCheck = await call(env, '/api/activate/check', { method: 'POST', json: { code } });
  check('2) to‘g‘ri kod -> 200', okCheck.status, 200);
  const info = await jsonOf(okCheck);
  check('2) mahsulot nomi qaytadi', info.product.name, 'NFC Smart Sticker');

  // Tekshiruv hech narsani O'ZGARTIRMAYDI.
  const st = await rowOfCode(env, code, 'status');
  check('2) tekshiruv holatni o‘zgartirmadi', st.status, 'new');

  // Kirmasdan faollashtirib bo'lmaydi.
  check('2) login’siz aktivatsiya -> 401', (await call(env, '/api/activate', { method: 'POST', json: { code, profileKind: 'personal' } })).status, 401);
}

// ── 3) SHAXSIY: YANGI PROFIL + MAVJUD ALLOKATOR ──────────────────────
{
  const env = await setup();
  const product = await makeProduct(env);
  const code = (await makeCodes(env, product.id, 1)).codes[0].code;

  // Odamda ALLAQACHON asosiy profil bo'lgan holat — aynan shu yerda
  // yangi karta uni surib qo'ymasligi tekshiriladi.
  await env.DB.prepare(`UPDATE cards SET is_primary = 1 WHERE code = 'VIP001'`).run();
  const before = await env.DB.prepare(`SELECT COUNT(*) AS n FROM cards WHERE user_id = 1`).first();
  const res = await call(env, '/api/activate', { method: 'POST', cookie: cookie.user, json: { code, profileKind: 'personal', name: 'Yangi' } });
  check('3) aktivatsiya -> 201', res.status, 201);
  const out = await jsonOf(res);
  check('3) natija shaxsiy', out.result.profileKind, 'personal');

  const newCode = out.result.profileCode;
  checkTrue('3) ID 8 xonali raqam (mavjud allokator shakli)', /^\d{8}$/.test(newCode));

  const after = await env.DB.prepare(`SELECT COUNT(*) AS n FROM cards WHERE user_id = 1`).first();
  check('3) aynan BITTA yangi karta', Number(after.n) - Number(before.n), 1);

  const card = await env.DB.prepare(`SELECT user_id, is_primary, source, tier_override, giftable FROM cards WHERE code = ?`).bind(newCode).first();
  check('3) karta shu odamniki', Number(card.user_id), 1);
  // Odamda allaqachon asosiy profil bor edi (VIP001) — yangi karta uni
  // SURIB QO'YMASLIGI kerak.
  check('3) mavjud asosiy profil surilmadi', Number(card.is_primary), 0);
  const primary = await env.DB.prepare(`SELECT COUNT(*) AS n FROM cards WHERE user_id = 1 AND is_primary = 1`).first();
  checkTrue('3) asosiy profil bittadan oshmadi', Number(primary.n) <= 1);
  check('3) manba belgisi yozildi', card.source, 'marketplace_activation');
  check('3) sovg‘a qilib bo‘lmaydi', Number(card.giftable), 0);
  // ENG MUHIMI: 'auto' tarifda ALOHIDA limit yozilmaydi.
  check('3) auto tarifda tier_override YOZILMAYDI', card.tier_override, null);

  // Katalogda ko'rinmaydi — u SOTUVDA emas.
  const cat = await jsonOf(await call(env, '/api/records', {}));
  checkTrue('3) katalogda ko‘rinmaydi', !(cat || []).some((r) => r.code === newCode));
  // Lekin EGASINING kabinetida bor.
  const me = await jsonOf(await call(env, '/api/auth/me', { cookie: cookie.user }));
  checkTrue('3) kabinetda ko‘rinadi', (me.cards || []).some((c) => c.code === newCode));

  const act = await rowOfCode(env, code, 'status, activated_profile_kind AS kind, activated_profile_code AS code, activated_by_user_id AS uid');
  check('3) kod ACTIVATED', act.status, 'activated');
  check('3) profil turi yozildi', act.kind, 'personal');
  check('3) profil kodi yozildi', act.code, newCode);
  check('3) kim faollashtirgani yozildi', Number(act.uid), 1);

  // Audit.
  const log = await env.DB.prepare(`SELECT action, details FROM admin_activity_log WHERE action = 'marketplace_activated'`).first();
  checkTrue('3) audit yozuvi bor', !!log);
  checkTrue('3) auditda to‘liq kod YO‘Q', /^\*\*\*\*-/.test(String(log.details).split(' ')[0]));
}

// ── 4) SHAXSIY: MAVJUD PROFILGA BOG'LASH ─────────────────────────────
{
  const env = await setup();
  const product = await makeProduct(env);
  const code = (await makeCodes(env, product.id, 1)).codes[0].code;
  const before = await env.DB.prepare(`SELECT COUNT(*) AS n FROM cards WHERE user_id = 1`).first();

  const res = await call(env, '/api/activate', { method: 'POST', cookie: cookie.user, json: { code, profileKind: 'personal', profileCode: 'VIP001' } });
  check('4) mavjud profilga bog‘landi', res.status, 201);
  check('4) profil kodi o‘sha', (await jsonOf(res)).result.profileCode, 'VIP001');
  const after = await env.DB.prepare(`SELECT COUNT(*) AS n FROM cards WHERE user_id = 1`).first();
  check('4) YANGI karta yaratilmadi', Number(after.n), Number(before.n));
}

// ── 5) EGALIK: BEGONA PROFIL/KOMPANIYA RAD ETILADI ───────────────────
{
  const env = await setup();
  const product = await makeProduct(env);
  const codes = (await makeCodes(env, product.id, 3)).codes;

  // OTH222 — 2-foydalanuvchiniki.
  const r1 = await call(env, '/api/activate', { method: 'POST', cookie: cookie.user, json: { code: codes[0].code, profileKind: 'personal', profileCode: 'OTH222' } });
  check('5) begona shaxsiy profil -> 403', r1.status, 403);
  // Kod BEHUDA sarflanmadi.
  const s1 = await env.DB.prepare(`SELECT status FROM marketplace_activations WHERE code_tail = ?`).bind(codes[0].code.slice(-4)).first();
  check('5) rad etilgach kod yana ishlatsa bo‘ladi', s1.status, 'new');

  await addCompany(env, 'FOREIGNCO', 2, 'Begona');
  const r2 = await call(env, '/api/activate', { method: 'POST', cookie: cookie.user, json: { code: codes[1].code, profileKind: 'business', companyId: 'FOREIGNCO' } });
  check('5) begona kompaniya -> 403', r2.status, 403);
  const s2 = await env.DB.prepare(`SELECT status FROM marketplace_activations WHERE code_tail = ?`).bind(codes[1].code.slice(-4)).first();
  check('5) kompaniya rad etilgach ham kod tirik', s2.status, 'new');

  const r3 = await call(env, '/api/activate', { method: 'POST', cookie: cookie.user, json: { code: codes[2].code } });
  check('5) profil turi berilmasa -> 422', r3.status, 422);
}

// ── 6) BIZNES: O'ZINING KOMPANIYASI ──────────────────────────────────
{
  const env = await setup();
  const product = await makeProduct(env);
  const code = (await makeCodes(env, product.id, 1)).codes[0].code;
  await addCompany(env, 'MYCO', 1, 'Mening');

  const opts = await jsonOf(await call(env, '/api/activate/options', { cookie: cookie.user }));
  checkTrue('6) tanlovda o‘z kompaniyasi bor', opts.business.some((b) => b.companyId === 'MYCO'));
  checkTrue('6) tanlovda BEGONA kompaniya yo‘q', !opts.business.some((b) => b.companyId === 'FOREIGNCO'));
  checkTrue('6) tanlovda o‘z profillari bor', opts.personal.some((p) => p.code === 'VIP001'));
  checkTrue('6) tanlovda BEGONA profil yo‘q', !opts.personal.some((p) => p.code === 'OTH222'));

  const res = await call(env, '/api/activate', { method: 'POST', cookie: cookie.user, json: { code, profileKind: 'business', companyId: 'MYCO' } });
  check('6) biznes aktivatsiyasi -> 201', res.status, 201);
  const out = await jsonOf(res);
  check('6) natija biznes', out.result.profileKind, 'business');
  check('6) kompaniya kodi', out.result.profileCode, 'MYCO');
  // YANGI "marketplace business" modeli YARATILMADI.
  const tables = await env.DB.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%marketplace%'`).all();
  check('6) faqat ikkita marketplace jadvali', tables.results.map((r) => r.name).sort().join(','), 'marketplace_activations,marketplace_products');
}

// ── 7) IDEMPOTENTLIK: TUGMANI IKKI MARTA BOSISH ──────────────────────
{
  const env = await setup();
  const product = await makeProduct(env);
  const code = (await makeCodes(env, product.id, 1)).codes[0].code;

  const first = await jsonOf(await call(env, '/api/activate', { method: 'POST', cookie: cookie.user, json: { code, profileKind: 'personal' } }));
  const cardsAfterFirst = await env.DB.prepare(`SELECT COUNT(*) AS n FROM cards WHERE user_id = 1`).first();

  const res2 = await call(env, '/api/activate', { method: 'POST', cookie: cookie.user, json: { code, profileKind: 'personal' } });
  check('7) ikkinchi bosish xato emas', res2.status, 200);
  const second = await jsonOf(res2);
  checkTrue('7) "allaqachon faollashtirilgan" deb belgilangan', second.alreadyActivated === true);
  check('7) O‘SHA profil qaytadi', second.result.profileCode, first.result.profileCode);
  const cardsAfterSecond = await env.DB.prepare(`SELECT COUNT(*) AS n FROM cards WHERE user_id = 1`).first();
  check('7) IKKINCHI ID yaratilmadi', Number(cardsAfterSecond.n), Number(cardsAfterFirst.n));

  // BOSHQA odam esa bu kodni ololmaydi.
  const other = await call(env, '/api/activate', { method: 'POST', cookie: cookie.other, json: { code, profileKind: 'personal' } });
  check('7) boshqa odam -> 409', other.status, 409);
  check('7) sababi aniq', (await jsonOf(other)).error, 'already_activated');
}

// ── 8) BIR VAQTDA IKKI SO'ROV: G'OLIB BITTA ──────────────────────────
{
  const env = await setup();
  const product = await makeProduct(env);
  const code = (await makeCodes(env, product.id, 1)).codes[0].code;

  // Ikkala so'rov ham HAR XIL odamdan va bir vaqtda.
  const [a, b] = await Promise.all([
    call(env, '/api/activate', { method: 'POST', cookie: cookie.user, json: { code, profileKind: 'personal' } }),
    call(env, '/api/activate', { method: 'POST', cookie: cookie.other, json: { code, profileKind: 'personal' } }),
  ]);
  const statuses = [a.status, b.status].sort();
  check('8) faqat BITTASI muvaffaqiyatli', statuses.filter((s) => s === 201).length, 1);
  check('8) ikkinchisi konflikt', statuses.filter((s) => s === 409).length, 1);

  const act = await rowOfCode(env, code, 'status, activated_by_user_id AS uid');
  check('8) kod bir marta faollashdi', act.status, 'activated');
  checkTrue('8) bitta egasi bor', act.uid != null);

  // Yutqazgan tomondan ORFAN karta qolmasin.
  const loserId = Number(act.uid) === 1 ? 2 : 1;
  const loserCards = await env.DB.prepare(`SELECT COUNT(*) AS n FROM cards WHERE user_id = ? AND source = 'marketplace_activation'`).bind(loserId).first();
  check('8) yutqazganda ORFAN ID qolmadi', Number(loserCards.n), 0);
}

// ── 8b) HAQIQIY POYGA — QO'LDA ARALASHTIRILGAN ───────────────────────
//
// 8-bo'lim `Promise.all` bilan ikki so'rov yuboradi, LEKIN test
// muhitida SQLite sinxron: ikkinchi so'rov birinchisi TUGAGANDAN keyin
// o'qiydi va poyga umuman yuz bermaydi. Buni mutatsiya bilan
// isbotladik — qulflarni butunlay olib tashlaganda ham 8-bo'lim
// yashil qolardi, ya'ni u hech narsani qo'riqlamasdi.
//
// Shuning uchun bu yerda aralashuv QO'LDA, aniq nuqtada yasaladi:
// A so'rovi kerakli SQL ga yetganda TO'XTATILADI, B to'liq ishlab
// bo'ladi, keyin A davom etadi. Bu — real hayotdagi eng yomon
// tartib, va aynan shuni qulf ushlashi kerak.
function gatedEnv(env, sqlNeedle) {
  let release;
  const gate = new Promise((r) => { release = r; });
  let armed = true;
  const wrapped = {
    ...env,
    DB: {
      ...env.DB,
      prepare(sql) {
        const stmt = env.DB.prepare(sql);
        if (!sql.includes(sqlNeedle)) return stmt;
        const orig = stmt.first.bind(stmt);
        stmt.first = async (...args) => {
          if (armed) { armed = false; await gate; }
          return orig(...args);
        };
        return stmt;
      },
      batch: (stmts) => env.DB.batch(stmts),
    },
  };
  return { wrapped, release: () => release() };
}

{
  const env = await setup();
  const product = await makeProduct(env);

  // ── A) A BAND QILISHDAN OLDIN TO'XTAYDI, B HAMMASINI TUGATADI ────
  {
    const code = (await makeCodes(env, product.id, 1)).codes[0].code;
    const { wrapped, release } = gatedEnv(env, `SET status = 'activating'`);
    const aPromise = worker.fetch(req('/api/activate', { method: 'POST', cookie: cookie.user, ip: nextIp(), json: { code, profileKind: 'personal' } }), wrapped, { waitUntil() {} });
    // A endi qulfda turibdi. B to'liq o'tadi.
    const b = await call(env, '/api/activate', { method: 'POST', cookie: cookie.other, json: { code, profileKind: 'personal' } });
    check('8b-A) B muvaffaqiyatli', b.status, 201);
    release();
    const a = await aPromise;
    check('8b-A) A rad etildi', a.status, 409);
    const act = await rowOfCode(env, code, 'status, activated_by_user_id AS uid');
    check('8b-A) kod bir marta faollashdi', act.status, 'activated');
    check('8b-A) egasi B', Number(act.uid), 2);
    // ORFAN = hech qaysi aktivatsiyaga bog'lanmagan marketplace ID.
    // (Vaqt bo'yicha filtr ishlamaydi: butun test bir necha soniyada
    // o'tadi va oldingi bo'limlarning kartalari ham tushib qolardi.)
    const orphan = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM cards WHERE source = 'marketplace_activation'
        AND code NOT IN (SELECT COALESCE(activated_profile_code,'') FROM marketplace_activations)`
    ).first();
    check('8b-A) ORFAN ID qolmadi', Number(orphan.n), 0);
  }

  // ── B) IKKALASI HAM BAND QILADI, A YAKUNDA TO'XTAYDI ─────────────
  // Eng nozik holat: A qulfni oladi, B undan keyin oladi (bandlik
  // egasi almashadi), so'ng A yakuniy yozuvga keladi. A shu yerda
  // TO'XTASHI va yaratgan kartasini o'chirishi shart.
  {
    const code = (await makeCodes(env, product.id, 1)).codes[0].code;
    const { wrapped, release } = gatedEnv(env, `SET status = 'activated'`);
    const aPromise = worker.fetch(req('/api/activate', { method: 'POST', cookie: cookie.user, ip: nextIp(), json: { code, profileKind: 'personal' } }), wrapped, { waitUntil() {} });
    // A band qildi va yakuniy yozuv oldida turibdi. B ham urinadi.
    const b = await call(env, '/api/activate', { method: 'POST', cookie: cookie.other, json: { code, profileKind: 'personal' } });
    release();
    const a = await aPromise;
    const codes2 = [a.status, b.status];
    check('8b-B) faqat BITTASI muvaffaqiyatli', codes2.filter((x) => x === 201).length, 1);
    const act = await rowOfCode(env, code, 'status, activated_by_user_id AS uid, activated_profile_code AS pcode');
    check('8b-B) kod faollashgan', act.status, 'activated');
    // Yutqazgan tomonda ORFAN karta qolmasin.
    const loser = a.status === 201 ? 2 : 1;
    const orphan = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM cards WHERE user_id = ? AND source = 'marketplace_activation'
        AND code NOT IN (SELECT COALESCE(activated_profile_code,'') FROM marketplace_activations)`
    ).bind(loser).first();
    check('8b-B) yutqazganda ORFAN ID qolmadi', Number(orphan.n), 0);
    // Faollashgan profil HAQIQATAN g'olibniki.
    const owner = await env.DB.prepare(`SELECT user_id AS uid FROM cards WHERE code = ?`).bind(act.pcode).first();
    check('8b-B) profil g‘olibniki', Number(owner.uid), Number(act.uid));
  }
}

// ── 8c) YARIM QOLGAN BANDLIK — EGASI ALMASHADI ───────────────────────
//
// Worker aktivatsiya o'rtasida to'xtab qolsa (crash/timeout), kod
// `activating` holatida osilib qolardi va ODAM O'Z MAHSULOTINI
// BOSHQA FAOLLASHTIRA OLMASDI. Shuning uchun bandlikning muddati bor
// (RESERVE_TTL_MS): eskirgan bandlikni boshqa urinish OLIB QO'YADI.
//
// Bu — yakuniy `UPDATE ... WHERE reserved_by_user_id = ?` shartining
// YAGONA haqiqiy ishlaydigan holati: A band qilgan, B eskirgan
// bandlikni olgan va tugatgan, A esa kechikib qaytgan. A shu yerda
// to'xtashi VA yaratgan kartasini o'chirishi shart.
{
  const env = await setup();
  const product = await makeProduct(env);
  const code = (await makeCodes(env, product.id, 1)).codes[0].code;

  const { wrapped, release } = gatedEnv(env, `SET status = 'activated'`);
  const aPromise = worker.fetch(req('/api/activate', { method: 'POST', cookie: cookie.user, ip: nextIp(), json: { code, profileKind: 'personal' } }), wrapped, { waitUntil() {} });
  // A band qildi va yakuniy yozuv oldida turibdi. Endi uning
  // bandligini "eskirgan" qilamiz — worker to'xtab qolgan holat.
  await new Promise((r) => setTimeout(r, 10));
  await env.DB.prepare(`UPDATE marketplace_activations SET reserved_at = ? WHERE code_tail = ?`)
    .bind(new Date(Date.now() - 10 * 60 * 1000).toISOString(), code.slice(-4)).run();

  const b = await call(env, '/api/activate', { method: 'POST', cookie: cookie.other, json: { code, profileKind: 'personal' } });
  check('8c) eskirgan bandlikni B oldi', b.status, 201);
  release();
  const a = await aPromise;
  check('8c) kechikkan A rad etildi', a.status, 409);

  const act = await rowOfCode(env, code, 'status, activated_by_user_id AS uid, activated_profile_code AS pcode');
  check('8c) kod bir marta faollashdi', act.status, 'activated');
  check('8c) egasi B', Number(act.uid), 2);
  const owner = await env.DB.prepare(`SELECT user_id AS uid FROM cards WHERE code = ?`).bind(act.pcode).first();
  check('8c) profil ham B niki', Number(owner.uid), 2);
  // A ID ajratib ulgurgan edi — u ORFAN bo'lib qolmasligi SHART.
  const orphan = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM cards WHERE source = 'marketplace_activation'
      AND code NOT IN (SELECT COALESCE(activated_profile_code,'') FROM marketplace_activations)`
  ).first();
  check('8c) A ning ORFAN ID si tozalandi', Number(orphan.n), 0);
}

// ── 9) 100 PARALLEL ID AJRATISH: DUPLICATE = 0 ───────────────────────
// Talab: ID allokatori poygada ham takroriy ID bermasin.
{
  const env = await setup();
  const product = await makeProduct(env);
  const codes = (await makeCodes(env, product.id, 100)).codes;
  // 100 ta alohida foydalanuvchi — har biri o'z kodi bilan.
  const stmts = [];
  for (let i = 10; i < 110; i++) {
    stmts.push(env.DB.prepare(`INSERT INTO users (id, email, password_hash) VALUES (?, ?, 'x')`).bind(i, `u${i}@test.local`));
    stmts.push(env.DB.prepare(`INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, '2999-01-01T00:00:00.000Z')`).bind(`tok${i}`, i));
  }
  await env.DB.batch(stmts);

  const results = await Promise.all(codes.map((c, i) => call(env, '/api/activate', {
    method: 'POST', cookie: `nfc_session=tok${10 + i}`, json: { code: c.code, profileKind: 'personal' },
  })));
  const okCount = results.filter((r) => r.status === 201).length;
  check('9) 100 aktivatsiya muvaffaqiyatli', okCount, 100);

  // Faqat SHU bo'limning 100 foydalanuvchisi (umumiy bazada boshqa
  // bo'limlar ham marketplace ID yaratgan).
  const all = await env.DB.prepare(`SELECT code FROM cards WHERE source = 'marketplace_activation' AND user_id BETWEEN 10 AND 109`).all();
  check('9) 100 ta ID yaratildi', all.results.length, 100);
  check('9) DUPLICATE ID = 0', new Set(all.results.map((r) => r.code)).size, 100);
  const bad = all.results.filter((r) => !/^\d{8}$/.test(r.code));
  check('9) hammasi mavjud allokator shaklida', bad.length, 0);
}

// ── 10) BLOK / MUDDAT / SOTILDI ──────────────────────────────────────
{
  const env = await setup();
  const product = await makeProduct(env);
  const codes = (await makeCodes(env, product.id, 4)).codes;
  const idOf = async (c) => Number((await env.DB.prepare(`SELECT id FROM marketplace_activations WHERE code_tail = ?`).bind(c.code.slice(-4)).first()).id);

  const blockId = await idOf(codes[0]);
  await call(env, `/api/admin/marketplace/activations/${blockId}/block`, { method: 'POST', cookie: cookie.admin });
  const blocked = await call(env, '/api/activate', { method: 'POST', cookie: cookie.user, json: { code: codes[0].code, profileKind: 'personal' } });
  check('10) bloklangan kod -> 409', blocked.status, 409);
  check('10) sababi aniq', (await jsonOf(blocked)).error, 'code_blocked');

  await call(env, `/api/admin/marketplace/activations/${blockId}/unblock`, { method: 'POST', cookie: cookie.admin });
  check('10) blokdan chiqarilgach ishlaydi', (await call(env, '/api/activate', { method: 'POST', cookie: cookie.user, json: { code: codes[0].code, profileKind: 'personal' } })).status, 201);

  const expId = await idOf(codes[1]);
  await call(env, `/api/admin/marketplace/activations/${expId}/expire`, { method: 'POST', cookie: cookie.admin });
  check('10) muddati o‘tgan kod -> 409', (await call(env, '/api/activate', { method: 'POST', cookie: cookie.user, json: { code: codes[1].code, profileKind: 'personal' } })).status, 409);

  const soldId = await idOf(codes[2]);
  await call(env, `/api/admin/marketplace/activations/${soldId}/mark-sold`, { method: 'POST', cookie: cookie.admin });
  const soldRow = await env.DB.prepare(`SELECT status, sold_at FROM marketplace_activations WHERE id = ?`).bind(soldId).first();
  check('10) sotilgan deb belgilandi', soldRow.status, 'sold');
  checkTrue('10) sotilgan sana yozildi', !!soldRow.sold_at);
  check('10) sotilgan kod baribir faollashadi', (await call(env, '/api/activate', { method: 'POST', cookie: cookie.user, json: { code: codes[2].code, profileKind: 'personal' } })).status, 201);

  // FAOLLASHTIRILGAN KOD admin amallari bilan JIMGINA O'CHMAYDI.
  check('10) faollashgan kodni bloklab bo‘lmaydi', (await call(env, `/api/admin/marketplace/activations/${soldId}/block`, { method: 'POST', cookie: cookie.admin })).status, 409);
  check('10) oddiy "reset" yo‘q', (await call(env, `/api/admin/marketplace/activations/${soldId}/reset`, { method: 'POST', cookie: cookie.admin })).status, 404);
  check('10) reassign tasdiqsiz rad etiladi', (await call(env, `/api/admin/marketplace/activations/${soldId}/reassign`, { method: 'POST', cookie: cookie.admin, json: { confirm: true } })).status, 422);
  check('10) reassign sabab bilan ishlaydi', (await call(env, `/api/admin/marketplace/activations/${soldId}/reassign`, { method: 'POST', cookie: cookie.admin, json: { confirm: true, reason: 'Xaridor kartani qaytardi' } })).status, 200);
  const reLog = await env.DB.prepare(`SELECT COUNT(*) AS n FROM admin_activity_log WHERE action = 'marketplace_reassigned'`).first();
  check('10) reassign auditga tushdi', Number(reLog.n), 1);
}

// ── 11) BUYURTMA VA STATISTIKA ───────────────────────────────────────
{
  const env = await setup();
  const product = await makeProduct(env);
  // Statistika BUTUN bazani sanaydi, shuning uchun bu bo'limning
  // hissasi FARQ bilan o'lchanadi (umumiy bazada oldingi bo'limlar
  // ham yozuv qoldirgan). Baza surati kodlar yaratilishidan OLDIN.
  const base = await jsonOf(await call(env, '/api/admin/marketplace/stats', { cookie: cookie.admin }));
  const batch = await makeCodes(env, product.id, 3);
  const codes = batch.codes;

  const first = await rowOfCode(env, codes[0].code, 'id');
  await call(env, `/api/admin/marketplace/activations/${first.id}/attach-order`, {
    method: 'POST', cookie: cookie.admin, json: { marketplaceOrderId: 'UZUM-55501', customerReference: 'Ali' },
  });
  const withOrder = await jsonOf(await call(env, '/api/admin/marketplace/activations?search=UZUM-55501', { cookie: cookie.admin }));
  check('11) buyurtma raqami bo‘yicha topildi', withOrder.activations.length, 1);
  check('11) buyurtma biriktirilgach "sotilgan"', withOrder.activations[0].status, 'sold');

  await call(env, '/api/activate', { method: 'POST', cookie: cookie.user, json: { code: codes[1].code, profileKind: 'personal' } });
  const stats = await jsonOf(await call(env, '/api/admin/marketplace/stats', { cookie: cookie.admin }));
  check('11) jami kod +3', stats.total - base.total, 3);
  check('11) faollashgan +1', stats.counts.activated - base.counts.activated, 1);
  check('11) shaxsiy aktivatsiya +1', stats.profileKinds.personal - base.profileKinds.personal, 1);
  check('11) biznes aktivatsiya o‘zgarmadi', stats.profileKinds.business - base.profileKinds.business, 0);
  const mkNow = stats.byMarketplace.find((m) => m.marketplace === 'uzum')?.count || 0;
  const mkBefore = base.byMarketplace.find((m) => m.marketplace === 'uzum')?.count || 0;
  check('11) marketplace kesimi +3', mkNow - mkBefore, 3);
  const mine = stats.byProduct.find((p) => p.sku === product.sku);
  check('11) mahsulot kesimi: 3 kod', mine.count, 3);
  check('11) mahsulot kesimi: 1 faollashgan', mine.activated, 1);

  // TO'LIQ kod bilan qidirish — xesh bo'yicha aniq topadi.
  const byCode = await jsonOf(await call(env, `/api/admin/marketplace/activations?search=${encodeURIComponent(codes[1].code)}`, { cookie: cookie.admin }));
  check('11) to‘liq kod bo‘yicha qidiruv', byCode.activations.length, 1);
  check('11) topilgani faollashgan', byCode.activations[0].status, 'activated');
  // Filtrlar BATCH bilan birga — bo'limlar bir-biriga aralashmasin.
  const byStatus = await jsonOf(await call(env, `/api/admin/marketplace/activations?status=activated&batchId=${batch.batchId}`, { cookie: cookie.admin }));
  check('11) holat bo‘yicha filtr', byStatus.activations.length, 1);
  const byKind = await jsonOf(await call(env, `/api/admin/marketplace/activations?profileKind=business&batchId=${batch.batchId}`, { cookie: cookie.admin }));
  check('11) profil turi bo‘yicha filtr', byKind.activations.length, 0);
  const byProduct = await jsonOf(await call(env, `/api/admin/marketplace/activations?productId=${product.id}`, { cookie: cookie.admin }));
  check('11) mahsulot bo‘yicha filtr', byProduct.activations.length, 3);
}

// ── 12) FIZIK QURILMA ────────────────────────────────────────────────
{
  const env = await setup();
  const product = await makeProduct(env, { physicalType: 'nfc_card' });
  const code = (await makeCodes(env, product.id, 1)).codes[0].code;
  const dev = await env.DB.prepare(`INSERT INTO physical_cards (chip_token, linked_code, owner_user_id) VALUES ('TOKEN123', NULL, NULL) RETURNING id`).first();
  await env.DB.prepare(`UPDATE marketplace_activations SET physical_device_id = ? WHERE code_tail = ?`).bind(dev.id, code.slice(-4)).run();

  const out = await jsonOf(await call(env, '/api/activate', { method: 'POST', cookie: cookie.user, json: { code, profileKind: 'personal' } }));
  const card = await env.DB.prepare(`SELECT owner_user_id AS uid, linked_code AS code, active FROM physical_cards WHERE id = ?`).bind(dev.id).first();
  check('12) qurilma egasiga o‘tdi', Number(card.uid), 1);
  check('12) qurilma profilga bog‘landi', card.code, out.result.profileCode);
  check('12) qurilma faol', Number(card.active), 1);

  // Admin ro'yxatida FAQAT token dumi.
  const list = await jsonOf(await call(env, `/api/admin/marketplace/activations?search=${encodeURIComponent(code)}`, { cookie: cookie.admin }));
  check('12) admin faqat token dumini ko‘radi', list.activations[0].deviceTokenTail, 'N123');
  checkTrue('12) to‘liq chip token qaytmaydi', !JSON.stringify(list).includes('TOKEN123'));
}

// ── 13) YANGI GENERATOR YOZILMAGANI — MANBA DARAJASIDA ───────────────
// Kod o'zgarganda ham qoida buzilmasin: marketplace moduli O'Z ID
// generatorini yozmasligi SHART.
{
  const src = read('../hosting/api/marketplace.js');
  checkTrue('13) mavjud allokator import qilingan', /import \{ createFreeAutoId \} from '\.\/auth\.js';/.test(src));
  checkTrue('13) allokator chaqirilgan', /await createFreeAutoId\(/.test(src));
  // O'z ID generatori bo'lmasin: 8 xonali raqam yasaydigan naqsh.
  checkTrue('13) o‘z ID generatori YO‘Q', !/10_000_000|10000000 \+ Math\.random/.test(src));
  checkTrue('13) cards ga to‘g‘ridan-to‘g‘ri INSERT yo‘q', !/INSERT INTO cards/i.test(src));
  // Alohida tarif/limit jadvali bo'lmasin.
  checkTrue('13) marketplace tarif jadvali yo‘q', !/marketplace_(tiers|limits|plans|users|profiles)/.test(src));
  // Mavjud tier ustuni ishlatiladi, yangisi emas.
  checkTrue('13) mavjud tier_override ustuni ishlatiladi', /UPDATE cards SET tier_override = \?/.test(src));
  // Kod URL'da tashilmaydi: tekshiruv ham, aktivatsiya ham POST.
  checkTrue('13) tekshiruv POST (kod URL’da emas)', /path === '\/api\/activate\/check' && method === 'POST'/.test(src));
  checkTrue('13) aktivatsiya POST', /path === '\/api\/activate' && method === 'POST'/.test(src));
  // Egalik SERVER tomonda.
  checkTrue('13) shaxsiy egalik serverda', /getRecordOwner\(env, wanted\)/.test(src));
  checkTrue('13) kompaniya egaligi serverda', /FROM companies WHERE company_id = \? AND owner_user_id = \?/.test(src));
  // Qurilma tashqaridan berilmaydi.
  checkTrue('13) qurilma body dan olinmaydi', !/body\.deviceId|body\.physicalDeviceId|body\.chipToken/.test(src));
  // Tezlik chegarasi mavjud mexanizmdan.
  checkTrue('13) mavjud rateLimitD1 ishlatiladi', /H\.rateLimitD1\(/.test(src));

  const worker = read('../hosting/worker.js');
  checkTrue('13) modul ro‘yxatga ulangan', /API_MODULES = \[[^\]]*apiMarketplace\]/.test(worker));
  checkTrue('13) marketplace ID katalogda yashiriladi', /CARD_SOURCE_MARKETPLACE = 'marketplace_activation'/.test(worker));

  const auth = read('../hosting/api/auth.js');
  checkTrue('13) allokator eksport qilingan', /export async function createFreeAutoId/.test(auth));
  checkTrue('13) allokator noyoblikni bazaga qoldiradi', /ON CONFLICT \(code\) DO NOTHING/.test(auth));
  // Ro'yxatdan o'tish xulqi O'ZGARMADI: standart asosiy profil.
  checkTrue('13) standart qiymat: asosiy profil', /opts\.primary === false \? 0 : 1/.test(auth));
  checkTrue('13) standart manba: registration_auto', /opts\.source \|\| 'registration_auto'/.test(auth));
}

// ── 14) MAVJUD OQIMLAR BUZILMADI ─────────────────────────────────────
{
  const env = await setup();
  // Kabinetda seedBasic dagi 2 ta karta + shu test yaratgan
  // marketplace ID lari bo'ladi. Muhimi — ikkalasi ham JOYIDA.
  const before = await jsonOf(await call(env, '/api/auth/me', { cookie: cookie.user }));
  checkTrue('14) kabinet ishlaydi', (before.cards || []).some((c) => c.code === 'VIP001') && (before.cards || []).some((c) => c.code === 'BIZ777'));
  const cat = await jsonOf(await call(env, '/api/records', {}));
  checkTrue('14) katalog ishlaydi', Array.isArray(cat) && cat.length > 0);
  checkTrue('14) katalogda sotiladigan karta bor', cat.some((r) => r.code === 'VIP001'));
  const prof = await jsonOf(await call(env, '/api/records/VIP001', {}));
  check('14) profil ishlaydi', prof.code, 'VIP001');
  // Ro'yxatdan o'tish — asosiy profil avvalgidek beriladi.
  const reg = await call(env, '/api/auth/register', {
    method: 'POST', json: { email: 'yangi@test.local', password: 'parol123', phone: '+998903334455', tosAccepted: true },
  });
  checkTrue('14) ro‘yxatdan o‘tish ishlaydi', reg.status === 200 || reg.status === 201);
  const newUser = await env.DB.prepare(`SELECT id FROM users WHERE email = 'yangi@test.local'`).first();
  const auto = await env.DB.prepare(`SELECT code, is_primary, source FROM cards WHERE user_id = ?`).bind(newUser.id).first();
  checkTrue('14) avtomatik ID berildi', /^\d{8}$/.test(auto.code));
  check('14) u ASOSIY profil (xulq o‘zgarmadi)', Number(auto.is_primary), 1);
  check('14) manbasi registration_auto', auto.source, 'registration_auto');
}

// ── 15) AKTIVATSIYA SAHIFASI — MANBA QOIDALARI ───────────────────────
// Sahifa brauzerda alohida sinaladi (73 tekshiruv). Bu yerda faqat
// buzilishi OSON va oqibati OG'IR bo'lgan qoidalar qo'riqlanadi.
{
  // Izohlar chalg'itmasin: ular ichida ham `localStorage` kabi
  // so'zlar uchraydi (aynan "localStorage EMAS" deb yozilgan joyda).
  const page = stripComments(read('../src/pages/ActivatePage.jsx'));
  const app = read('../src/App.jsx');
  const db = read('../src/lib/db.js');

  // KOD URL'GA TUSHMASIN: ikkala so'rov ham POST.
  checkTrue('15) tekshiruv POST bilan', /fetch\('\/api\/activate\/check', \{\s*\n?\s*method: 'POST'/.test(db));
  checkTrue('15) aktivatsiya POST bilan', /fetch\('\/api\/activate', \{\s*\n?\s*method: 'POST'/.test(db));
  checkTrue('15) kod URL parametriga qo‘shilmaydi', !/activate\?[^']*code=/.test(db) && !/activate\/\$\{code/.test(db));
  checkTrue('15) sahifa ham kodni manzilga yozmaydi', !/navigate\([^)]*code/.test(page));

  // Kod `sessionStorage` da — `localStorage` da EMAS (brauzerda abadiy
  // qolib ketmasin).
  checkTrue('15) kod sessionStorage da', /sessionStorage\.setItem\(STORAGE_KEY/.test(page));
  checkTrue('15) localStorage ishlatilmaydi', !/localStorage/.test(page));
  checkTrue('15) muvaffaqiyatdan keyin kod o‘chiriladi', (page.match(/storeCode\(''\)/g) || []).length >= 2);

  // Marshrut ulangan va sahifa "bare" (sayt menyusi ko'rinmaydi).
  checkTrue('15) /activate marshruti bor', /cleanRoute === 'activate'\) \{ page = <ActivatePage \/>; bare = true; \}/.test(app));
  checkTrue('15) marshrut band ro‘yxatida', /activate: ActivatePage/.test(app));

  // Biznes uchun YANGI oqim yozilmagan — saytning o'z kompaniya
  // ochish sahifasiga yuboriladi.
  checkTrue('15) kompaniya ochish mavjud oqimga yuboradi', /navigate\('\/company\/create'\)/.test(page));
  checkTrue('15) sahifada kompaniya YARATISH so‘rovi yo‘q', !/\/api\/companies/.test(page));
}

// ── 16) ADMIN BO'LIMI — MANBA QOIDALARI ──────────────────────────────
// Bo'lim brauzerda alohida sinaladi (35 tekshiruv + CSV/chop etish).
// Bu yerda faqat oqibati OG'IR bo'lgan qoidalar.
{
  const tab = stripComments(read('../src/components/admin/MarketplaceTab.jsx'));
  const admin = stripComments(read('../src/pages/AdminPage.jsx'));

  checkTrue('16) bo‘lim admin panelga ulangan', /tab === 22 && <MarketplaceTab/.test(admin));
  checkTrue('16) menyuda "Marketplace" bor', /\{ index: 22, label: 'Marketplace'/.test(admin));
  // `adminApi` PROP orqali — import qilinsa aylanma bog'liqlik.
  checkTrue('16) adminApi prop orqali keladi', /export default function MarketplaceTab\(\{ adminApi/.test(tab));
  checkTrue('16) AdminPage dan import qilinmaydi', !/from '\.\.\/\.\.\/pages\/AdminPage/.test(tab));

  // TO'LIQ KOD: faqat yaratilgan zahoti. Ro'yxat MASKALANGANNI
  // ko'rsatadi va admin buni ochiq o'qiydi.
  checkTrue('16) ro‘yxatda maskalangan kod', /\{r\.codeMasked\}/.test(tab));
  checkTrue('16) ro‘yxatda to‘liq kod chizilmaydi', !/\{r\.code\}/.test(tab));
  checkTrue('16) chip token faqat dumi', /\{r\.deviceTokenTail \? `…\$\{r\.deviceTokenTail\}` : '—'\}/.test(tab));
  checkTrue('16) kodlar bir marta ko‘rinishi aytiladi', /BOSHQA KO‘RSATILMAYDI/.test(tab));
  checkTrue('16) tasdiqsiz yopib bo‘lmaydi', /disabled=\{!acked\}/.test(tab));

  // FAOLLASHTIRILGAN KOD UCHUN ODDIY "RESET" YO'Q.
  checkTrue('16) reset tugmasi yo‘q', !/'reset'/.test(tab));
  checkTrue('16) qayta taqsimlash sabab so‘raydi', /reason\.trim\(\)\.length < 10/.test(tab));
  checkTrue('16) qayta taqsimlash tasdiq so‘raydi', /window\.confirm\(/.test(tab));
  checkTrue('16) faollashgan kodda faqat qayta taqsimlash', /r\.status === 'activated' \? \(/.test(tab));

  // QR ichida FAQAT sahifa manzili — kodning o'zi emas. Konvert
  // ochilmasdan skanerlansa kod sizib chiqardi.
  checkTrue('16) QR da faqat /activate manzili', /QRCode\.toDataURL\(`\$\{origin\}\/activate`/.test(tab));
  checkTrue('16) QR ichiga kod yozilmaydi', !/toDataURL\([^)]*c\.code/.test(tab));
  // `qrcode` OG'IR — faqat chop etish bosilganda yuklanadi.
  checkTrue('16) qrcode faqat kerak bo‘lganda yuklanadi', /await import\('qrcode'\)/.test(tab));

  // Jadvallar o'z o'ramida suriladi — aks holda 360px telefonda
  // BUTUN sahifa ufqiy surilardi (brauzerda o'lchangan xato).
  const tables = (tab.match(/<table className="table table-sm">/g) || []).length;
  const wrappers = (tab.match(/<div className="overflow-x-auto">/g) || []).length;
  check('16) har jadval o‘z o‘ramida', wrappers, tables);

  // `?tab=` chuqur havolasi — izohda VA'DA qilingan edi, endi rost.
  checkTrue('16) ?tab= chuqur havolasi ishlaydi', /new URLSearchParams\(window\.location\.search\)\.get\('tab'\)/.test(admin));
  checkTrue('16) noto‘g‘ri tab raqami rad etiladi', /n >= 0 && n < TABS\.length \? n : 0/.test(admin));
}

done();
