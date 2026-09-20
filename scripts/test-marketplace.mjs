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
  //
  // ORFAN = hech qaysi aktivatsiyaga bog'lanmagan marketplace ID.
  // Ilgari bu yerda "yutqazgan foydalanuvchining marketplace
  // kartalari soni" sanalardi va test QALTIS edi: baza umumiy,
  // oldingi bo'limlar 1-foydalanuvchiga karta yaratgan, g'olib esa
  // tasodifiy — 1-foydalanuvchi yutqazsa test o'z-o'zidan yiqilardi.
  // Qaltis qo'riqchi yo'qidan yomon: u odamni "yana bir marta
  // ishga tushir" deb o'rgatadi.
  const orphan = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM cards WHERE source = 'marketplace_activation'
      AND code NOT IN (SELECT COALESCE(activated_profile_code,'') FROM marketplace_activations)`
  ).first();
  check('8) yutqazganda ORFAN ID qolmadi', Number(orphan.n), 0);
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
  // QURILMA TASHQARIDAN KELADI — LEKIN FAQAT BO'SH QURILMA.
  //
  // Stiker tokeni sir emas: u chipning o'zida yozilgan va istalgan
  // odam o'qiy oladi. Shuning uchun "tekkizilgan stiker" yo'li
  // ATAYLAB body orqali keladi, himoya esa SO'ROVDA emas — SQL da:
  // faqat egasiz va hech qayerga bog'lanmagan qator tanlanadi.
  const handler = src.slice(src.indexOf('async function activateHandler'));
  // Ichki identifikator (id) hech qachon tashqaridan olinmaydi —
  // aks holda raqamni oshirib begona stikerga tegib bo'lardi.
  checkTrue('13) qurilma ID si body dan olinmaydi',
    !/body\.deviceId|body\.physicalDeviceId/.test(handler));
  checkTrue('13) tekkizilgan token tozalanadi',
    /H\.shortText\(body\.deviceToken, 64\)\.replace\(\/\[\^A-Za-z0-9_-\]\/g, ''\)/.test(handler));
  checkTrue('13) faqat EGASIZ va BOG‘LANMAGAN stiker tanlanadi',
    /chip_token = \? AND owner_user_id IS NULL AND \(linked_code IS NULL OR linked_code = ''\)/.test(handler));
  // Begona (egasi bor) qurilma — aniq rad javobi.
  checkTrue('13) begona qurilma rad etiladi', /error: 'device_taken' \}, 409/.test(handler));
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

  // STANDART TANLOV — MAVJUD PROFIL, "yangi" EMAS.
  //
  // Ro'yxatdan o'tishning O'ZI bepul NFC ID beradi. Marketplace'dan
  // kelgan yangi xaridorda aktivatsiyaga yetganda allaqachon bitta
  // profil bor. Standart "yangi profil yaratish" bo'lib qolsa, u
  // IKKINCHI profilni olardi va stiker BO'SH profilga ishora
  // qilardi — ismi va kontaktlari bor birinchi profil esa kartasiz
  // qolardi. Brauzerda aynan shu holat tutildi.
  checkTrue('15) standart tanlov — mavjud profil', /setChoice\(kind === 'business' \? primary\.companyId : primary\.code\)/.test(page));
  checkTrue('15) asosiy profil ustun', /list\.find\(\(x\) => x\.isPrimary\) \|\| list\[0\]/.test(page));
  // "Yangi profil yaratish" varianti YO'QOLMADI.
  checkTrue('15) "yangi profil" varianti qoldi', /t\('Yangi profil yaratish'\)/.test(page));

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

  // CSV BRAUZERDA o'qiladi — fayl serverga YUKLANMAYDI. Shunda har
  // satr uchun aniq natija qaytariladi.
  checkTrue('16) CSV brauzerda o‘qiladi', /await file\.text\(\)/.test(tab));
  checkTrue('16) fayl serverga yuborilmaydi', !/FormData|multipart/.test(tab));
  // Excel saqlagan faylda BOM birinchi ustun nomiga yopishadi.
  checkTrue('16) BOM olib tashlanadi', /replace\(\/\^\\uFEFF\/, ''\)/.test(tab));
  // `code` HAR DOIM shart; qolganidan hech bo'lmasa bittasi —
  // ishlab chiqarish fayli faqat `chip_token` bilan keladi
  // (buyurtma hali yo'q), sotuv fayli esa buyurtma raqami bilan.
  checkTrue('16) code ustuni majburiy',
    /iCode < 0 \|\| \(iOrder < 0 && iChip < 0\)/.test(tab));
  checkTrue('16) chip_token ustuni o‘qiladi', /idx\('chip_token'/.test(tab));
  checkTrue('16) noto‘g‘ri tab raqami rad etiladi', /n >= 0 && n < TABS\.length \? n : 0/.test(admin));
}

// ── 17) XAVFSIZLIK AUDITI ────────────────────────────────────────────
// Talabdagi ro'yxat bo'yicha, har biri alohida. Bu bo'lim HAQIQIY
// so'rovlar yuboradi — manba matnini o'qish bilan cheklanmaydi.
{
  const env = await setup();
  const product = await makeProduct(env);
  const codes = (await makeCodes(env, product.id, 6)).codes;

  // ── BRUTE-FORCE / ENUMERATSIYA ─────────────────────────────────────
  // Chegara IP bo'yicha. 20 urinishdan keyin 429.
  {
    const ip = '198.18.0.1';
    let blockedAt = 0;
    for (let i = 1; i <= 30; i += 1) {
      const r = await worker.fetch(req('/api/activate/check', { method: 'POST', ip, json: { code: `NF-AAAA-${String(i).padStart(4, '2')}` } }), env, { waitUntil() {} });
      if (r.status === 429) { blockedAt = i; break; }
    }
    checkTrue('17) brute-force to‘xtatiladi', blockedAt > 0 && blockedAt <= 22, `${blockedAt}-urinishda`);
  }

  // Mavjud VA mavjud bo'lmagan kod uchun javob ENUMERATSIYAGA yordam
  // bermasin: ikkalasi ham "bad_code", faqat HTTP holati farq qiladi
  // (404 — topilmadi). Muhimi, javobda mahsulot/egasi haqida hech
  // narsa chiqmaydi.
  {
    const ip = '198.18.0.2';
    const miss = await worker.fetch(req('/api/activate/check', { method: 'POST', ip, json: { code: 'NF-ZZZZ-ZZZZ' } }), env, { waitUntil() {} });
    const body = await miss.json();
    check('17) yo‘q kod javobi quruq', Object.keys(body).join(','), 'error');
    check('17) sabab umumiy', body.error, 'bad_code');
  }

  // ── IDOR: BEGONA PROFIL / KOMPANIYA / QURILMA ──────────────────────
  {
    const ip = '198.18.0.3';
    // Begona shaxsiy profil.
    const r1 = await worker.fetch(req('/api/activate', { method: 'POST', ip, cookie: cookie.user, json: { code: codes[0].code, profileKind: 'personal', profileCode: 'OTH222' } }), env, { waitUntil() {} });
    check('17) IDOR: begona profil rad etildi', r1.status, 403);

    // Begona QURILMA tashqaridan berilmaydi — `body` dagi qurilma
    // maydonlari UMUMAN o'qilmaydi.
    const dev = await env.DB.prepare(`INSERT INTO physical_cards (chip_token, linked_code, owner_user_id) VALUES ('FOREIGNTOKEN', NULL, 2) RETURNING id`).first();
    const r2 = await worker.fetch(req('/api/activate', { method: 'POST', ip, cookie: cookie.user, json: { code: codes[0].code, profileKind: 'personal', deviceId: dev.id, physicalDeviceId: dev.id, chipToken: 'FOREIGNTOKEN' } }), env, { waitUntil() {} });
    check('17) begona qurilma bilan ham aktivatsiya o‘tdi (qurilma E’TIBORSIZ)', r2.status, 201);
    const untouched = await env.DB.prepare(`SELECT owner_user_id AS uid, linked_code AS code FROM physical_cards WHERE id = ?`).bind(dev.id).first();
    check('17) BEGONA qurilma egasi o‘zgarmadi', Number(untouched.uid), 2);
    check('17) begona qurilma bog‘lanmadi', untouched.code, null);
  }

  // ── QAYTA YUBORISH (REPLAY) ────────────────────────────────────────
  // Bir marta ishlagan kod ikkinchi odam uchun ishlamaydi.
  {
    const ip = '198.18.0.4';
    const replay = await worker.fetch(req('/api/activate', { method: 'POST', ip, cookie: cookie.other, json: { code: codes[0].code, profileKind: 'personal' } }), env, { waitUntil() {} });
    check('17) replay: boshqa odam uchun ishlamaydi', replay.status, 409);
    check('17) replay sababi aniq', (await replay.json()).error, 'already_activated');
  }

  // ── ADMIN ENDPOINTLARI HIMOYALANGAN ────────────────────────────────
  {
    const ip = '198.18.0.5';
    const paths = [
      ['/api/admin/marketplace/products', 'GET'],
      ['/api/admin/marketplace/products', 'POST'],
      ['/api/admin/marketplace/batch', 'POST'],
      ['/api/admin/marketplace/activations', 'GET'],
      ['/api/admin/marketplace/stats', 'GET'],
      ['/api/admin/marketplace/activations/1/block', 'POST'],
    ];
    for (const [path, method] of paths) {
      // Mehmon.
      const guest = await worker.fetch(req(path, { method, ip, json: method === 'POST' ? {} : undefined }), env, { waitUntil() {} });
      check(`17) ${method} ${path} — mehmon 401`, guest.status, 401);
      // ODDIY FOYDALANUVCHI sessiyasi bilan ham YO'Q.
      const asUser = await worker.fetch(req(path, { method, ip, cookie: cookie.user, json: method === 'POST' ? {} : undefined }), env, { waitUntil() {} });
      check(`17) ${method} ${path} — oddiy user 401`, asUser.status, 401);
    }
  }

  // ── SQL INJEKSIYA ──────────────────────────────────────────────────
  // Qidiruv va kod maydonlari to'g'ridan-to'g'ri SQL ga tushmaydi.
  {
    const ip = '198.18.0.6';
    const evil = "' OR 1=1 --";
    const r = await worker.fetch(req(`/api/admin/marketplace/activations?search=${encodeURIComponent(evil)}`, { ip, cookie: cookie.admin }), env, { waitUntil() {} });
    check('17) SQL injeksiya: so‘rov yiqilmadi', r.status, 200);
    const found = (await r.json()).activations;
    check('17) SQL injeksiya: hech narsa qaytmadi', found.length, 0);
    const still = await env.DB.prepare(`SELECT COUNT(*) AS n FROM marketplace_activations`).first();
    checkTrue('17) SQL injeksiya: yozuvlar joyida', Number(still.n) > 0);

    const r2 = await worker.fetch(req('/api/activate/check', { method: 'POST', ip, json: { code: evil } }), env, { waitUntil() {} });
    check('17) kod maydonida injeksiya rad etiladi', r2.status, 422);
  }

  // ── LOG SIZIB CHIQISHI ─────────────────────────────────────────────
  // Audit logda TO'LIQ kod BO'LMASLIGI shart.
  {
    const logs = await env.DB.prepare(`SELECT action, details, old_value, new_value FROM admin_activity_log WHERE action LIKE 'marketplace%'`).all();
    checkTrue('17) marketplace audit yozuvlari bor', logs.results.length > 0);
    const allText = JSON.stringify(logs.results);
    const leaked = codes.filter((c) => allText.includes(c.code));
    check('17) auditda to‘liq kod YO‘Q', leaked.length, 0);
    checkTrue('17) auditda maskalangan ko‘rinish bor', /\*\*\*\*-/.test(allText));
    // Parol/xesh ham tushmasin.
    checkTrue('17) auditda kod xeshi ham yo‘q', !/[0-9a-f]{64}/.test(allText));
  }

  // ── JAVOBDA SIR QAYTMAYDI ──────────────────────────────────────────
  {
    const ip = '198.18.0.7';
    const list = await (await worker.fetch(req('/api/admin/marketplace/activations?limit=500', { ip, cookie: cookie.admin }), env, { waitUntil() {} })).json();
    const text = JSON.stringify(list);
    checkTrue('17) javobda kod xeshi yo‘q', !/[0-9a-f]{64}/.test(text));
    checkTrue('17) javobda "code_hash" maydoni yo‘q', !text.includes('code_hash'));
    checkTrue('17) javobda to‘liq chip token yo‘q', !text.includes('FOREIGNTOKEN'));
    for (const row of list.activations) {
      checkTrue('17) har qatorda faqat maskalangan kod', /^\*\*\*\*-[A-Z2-9]{4}$/.test(row.codeMasked) && row.code === undefined);
      break;
    }
  }

  // ── MUDDATI O'TGAN KOD ─────────────────────────────────────────────
  {
    const ip = '198.18.0.8';
    await env.DB.prepare(`UPDATE marketplace_activations SET expires_at = ? WHERE code_tail = ?`)
      .bind('2020-01-01T00:00:00.000Z', codes[1].code.slice(-4)).run();
    const r = await worker.fetch(req('/api/activate', { method: 'POST', ip, cookie: cookie.user, json: { code: codes[1].code, profileKind: 'personal' } }), env, { waitUntil() {} });
    check('17) muddati o‘tgan kod rad etiladi', r.status, 409);
    check('17) sababi aniq', (await r.json()).error, 'code_expired');
    // Tekshiruv bosqichida ham.
    const c = await worker.fetch(req('/api/activate/check', { method: 'POST', ip, json: { code: codes[1].code } }), env, { waitUntil() {} });
    check('17) tekshiruvda ham muddat ko‘rsatiladi', (await c.json()).error, 'code_expired');
  }

  // ── KOD URL'DA TASHILMAYDI ─────────────────────────────────────────
  // GET orqali kod yuborib bo'lmasligi: bunday marshrut YO'Q.
  {
    const ip = '198.18.0.9';
    const g1 = await worker.fetch(req(`/api/activate?code=${codes[2].code}`, { ip, cookie: cookie.user }), env, { waitUntil() {} });
    checkTrue('17) GET /api/activate?code= ishlamaydi', g1.status === 404 || g1.status === 405, `${g1.status}`);
    const g2 = await worker.fetch(req(`/api/activate/${codes[2].code}`, { ip, cookie: cookie.user }), env, { waitUntil() {} });
    checkTrue('17) GET /api/activate/<kod> ishlamaydi', g2.status === 404 || g2.status === 405, `${g2.status}`);
    // Kod HAMON ishlatilmagan.
    const st = await rowOfCode(env, codes[2].code, 'status');
    check('17) urinishlar kodni sarflamadi', st.status, 'new');
  }
}

// ── 18) CSV DAN BUYURTMALARNI BOG'LASH ───────────────────────────────
// Uzum API si hali yo'q: omborchi qaysi kodni qaysi buyurtmaga
// solganini yozib boradi va o'sha ro'yxat import qilinadi.
{
  const env = await setup();
  const product = await makeProduct(env);
  const codes = (await makeCodes(env, product.id, 4)).codes;

  // Bittasini oldindan faollashtiramiz — import uni BUZMASLIGI kerak.
  await call(env, '/api/activate', { method: 'POST', cookie: cookie.user, json: { code: codes[3].code, profileKind: 'personal' } });

  const res = await call(env, '/api/admin/marketplace/orders/import', {
    method: 'POST', cookie: cookie.admin,
    json: {
      rows: [
        { code: codes[0].code, marketplaceOrderId: 'UZUM-1001', customerReference: 'Ali' },
        // Kichik harf va chiziqchasiz — normalizatsiya ishlashi kerak.
        { code: codes[1].code.toLowerCase().replace(/-/g, ''), marketplaceOrderId: 'UZUM-1002' },
        { code: 'NF-ZZZZ-ZZZZ', marketplaceOrderId: 'UZUM-1003' },   // yo'q kod
        { code: 'salom', marketplaceOrderId: 'UZUM-1004' },          // buzuq
        { code: codes[2].code, marketplaceOrderId: '' },             // buyurtmasiz
        { code: codes[3].code, marketplaceOrderId: 'UZUM-1005' },    // faollashtirilgan
      ],
    },
  });
  check('18) import ishladi', res.status, 200);
  const out = await jsonOf(res);
  check('18) 3 ta bog‘landi', out.linked, 3);
  check('18) 6 qator kelgan', out.total, 6);
  check('18) 3 ta muammo qaytdi', out.problems.length, 3);
  const reasons = out.problems.map((p) => p.reason).sort();
  check('18) sabablar aniq', reasons.join(','), 'bad_code,not_found,order_required');
  // Qaysi SATRDA ekani ham aytiladi — 2000 qatorli faylda bu shart.
  checkTrue('18) satr raqami bor', out.problems.every((p) => Number.isInteger(p.line) && p.line > 0));

  const r0 = await rowOfCode(env, codes[0].code, 'marketplace_order_id AS o, customer_reference AS c, status, sold_at AS s');
  check('18) buyurtma yozildi', r0.o, 'UZUM-1001');
  check('18) mijoz havolasi yozildi', r0.c, 'Ali');
  check('18) holat "sotilgan"', r0.status, 'sold');
  checkTrue('18) sotilgan sana qo‘yildi', !!r0.s);

  const r1 = await rowOfCode(env, codes[1].code, 'marketplace_order_id AS o, status');
  check('18) normalizatsiya ishladi', r1.o, 'UZUM-1002');

  const r2 = await rowOfCode(env, codes[2].code, 'marketplace_order_id AS o, status');
  check('18) buyurtmasiz qator tegmadi', r2.o, null);
  check('18) uning holati o‘zgarmadi', r2.status, 'new');

  // FAOLLASHTIRILGAN kod: buyurtma yoziladi, LEKIN holat buzilmaydi.
  const r3 = await rowOfCode(env, codes[3].code, 'marketplace_order_id AS o, status, activated_profile_code AS p');
  check('18) faollashgan kodga buyurtma yozildi', r3.o, 'UZUM-1005');
  check('18) LEKIN holati "activated" qoldi', r3.status, 'activated');
  checkTrue('18) profili joyida', !!r3.p);

  // Bo'sh ro'yxat — aniq xato.
  check('18) bo‘sh ro‘yxat rad etiladi', (await call(env, '/api/admin/marketplace/orders/import', { method: 'POST', cookie: cookie.admin, json: { rows: [] } })).status, 422);
  // Faqat admin.
  check('18) import mehmonga yopiq', (await call(env, '/api/admin/marketplace/orders/import', { method: 'POST', json: { rows: [{ code: 'x', marketplaceOrderId: 'y' }] } })).status, 401);
  check('18) import oddiy userga yopiq', (await call(env, '/api/admin/marketplace/orders/import', { method: 'POST', cookie: cookie.user, json: { rows: [{ code: 'x', marketplaceOrderId: 'y' }] } })).status, 401);

  // Audit.
  const log = await env.DB.prepare(`SELECT details FROM admin_activity_log WHERE action = 'marketplace_orders_imported'`).first();
  check('18) auditda natija bor', log.details, '3/6');
  // Javobda to'liq kod FAQAT muammoli satrlarda (admin o'zi yuborgan).
  checkTrue('18) javobda kod xeshi yo‘q', !/[0-9a-f]{64}/.test(JSON.stringify(out)));
}

// ── 19) SKU MAPPING VA ADAPTER TAYYORLIGI ────────────────────────────
// Uzum API si hozir YO'Q va u ishga tushirishga to'siq emas. Bu
// bo'lim API'siz oqim TO'LIQ ishlashini tekshiradi: SKU mapping,
// qo'lda bog'lash, CSV import, SOLD/ACTIVATED holatlari.
{
  const env = await setup();

  // ── MARKETPLACE'NING O'Z SKU SI ────────────────────────────────────
  const p1 = await makeProduct(env, { sku: 'UZ-STICKER-A', externalSku: 'uzum-777001' });
  check('19) tashqi SKU katta harfda saqlandi', p1.externalSku, 'UZUM-777001');
  const p2 = await makeProduct(env, { sku: 'UZ-CARD-B' });
  check('19) tashqi SKU ixtiyoriy', p2.externalSku, '');

  // E'lon joylangandan KEYIN ham qo'yish mumkin.
  const patched = await jsonOf(await call(env, `/api/admin/marketplace/products/${p2.id}`, {
    method: 'PATCH', cookie: cookie.admin, json: { externalSku: 'uzum-777002' },
  }));
  check('19) keyin ham qo‘yiladi', patched.product.externalSku, 'UZUM-777002');
  check('19) faollik o‘zgarmadi', patched.product.active, true);
  // Faollik alohida ham ishlayveradi (eski xulq buzilmadi).
  const off = await jsonOf(await call(env, `/api/admin/marketplace/products/${p2.id}`, {
    method: 'PATCH', cookie: cookie.admin, json: { active: false },
  }));
  check('19) faollikni o‘chirish ishlaydi', off.product.active, false);
  check('19) tashqi SKU saqlanib qoldi', off.product.externalSku, 'UZUM-777002');
  check('19) bo‘sh so‘rov rad etiladi', (await call(env, `/api/admin/marketplace/products/${p2.id}`, { method: 'PATCH', cookie: cookie.admin, json: {} })).status, 422);

  // ── SKU MOSLIGI OMBORDAGI XATONI TUTADI ────────────────────────────
  const aCodes = (await makeCodes(env, p1.id, 3)).codes;
  const res = await jsonOf(await call(env, '/api/admin/marketplace/orders/import', {
    method: 'POST', cookie: cookie.admin,
    json: {
      rows: [
        // Bizning ichki SKU bilan.
        { code: aCodes[0].code, sku: 'UZ-STICKER-A', marketplaceOrderId: 'UZUM-2001' },
        // Marketplace'ning O'Z SKU si bilan (kichik harfda).
        { code: aCodes[1].code, sku: 'uzum-777001', marketplaceOrderId: 'UZUM-2002' },
        // BOSHQA mahsulotning SKU si — konvertga noto'g'ri kod
        // solingan degani.
        { code: aCodes[2].code, sku: 'UZ-CARD-B', marketplaceOrderId: 'UZUM-2003' },
      ],
    },
  }));
  check('19) 2 ta bog‘landi', res.linked, 2);
  check('19) 1 ta mos kelmadi', res.problems.length, 1);
  check('19) sabab: sku_mismatch', res.problems[0].reason, 'sku_mismatch');
  check('19) qaysi satr ekani aytildi', res.problems[0].line, 3);
  const bad = await rowOfCode(env, aCodes[2].code, 'marketplace_order_id AS o, status');
  check('19) mos kelmagan kodga buyurtma YOZILMADI', bad.o, null);
  check('19) holati ham o‘zgarmadi', bad.status, 'new');
  const good = await rowOfCode(env, aCodes[1].code, 'marketplace_order_id AS o, status');
  check('19) tashqi SKU bo‘yicha bog‘landi', good.o, 'UZUM-2002');
  check('19) holati SOLD', good.status, 'sold');

  // ── SOLD -> ACTIVATED TO'LIQ YO'LI ─────────────────────────────────
  const act = await jsonOf(await call(env, '/api/activate', {
    method: 'POST', cookie: cookie.user, json: { code: aCodes[0].code, profileKind: 'personal' },
  }));
  checkTrue('19) sotilgan kod faollashdi', !!act.result.profileCode);
  const done1 = await rowOfCode(env, aCodes[0].code, 'status, marketplace_order_id AS o, sold_at AS s, activated_at AS a');
  check('19) holat ACTIVATED', done1.status, 'activated');
  check('19) buyurtma raqami saqlanib qoldi', done1.o, 'UZUM-2001');
  checkTrue('19) sotilgan sana ham joyida', !!done1.s);
  checkTrue('19) faollashgan sana yozildi', !!done1.a);

  // ── QO'LDA BOG'LASH HAM ISHLAYDI (API'siz) ─────────────────────────
  const manualRow = await rowOfCode(env, aCodes[2].code, 'id');
  await call(env, `/api/admin/marketplace/activations/${manualRow.id}/attach-order`, {
    method: 'POST', cookie: cookie.admin, json: { marketplaceOrderId: 'UZUM-2003', customerReference: 'Qo‘lda' },
  });
  const manual = await rowOfCode(env, aCodes[2].code, 'marketplace_order_id AS o, status, customer_reference AS c');
  check('19) qo‘lda bog‘lash ishladi', manual.o, 'UZUM-2003');
  check('19) holat SOLD ga o‘tdi', manual.status, 'sold');
  check('19) mijoz havolasi yozildi', manual.c, 'Qo‘lda');

  // ── ADAPTER SEAMI: IMPORT FAYL EMAS, QATORLAR QABUL QILADI ─────────
  // Kelajakdagi Uzum API si shu yerga ULANADI — alohida aktivatsiya
  // tizimi yozilmaydi.
  const src = read('../hosting/api/marketplace.js');
  checkTrue('19) import qatorlar qabul qiladi', /Array\.isArray\(body\.rows\)/.test(src));
  checkTrue('19) import fayl qabul qilmaydi', !/formData\(\)|multipart/i.test(src));
  checkTrue('19) adapter seami hujjatlashtirilgan', /ADAPTER bo'lib ulanadi/.test(src));
  // Uzum uchun ALOHIDA marshrut/jadval bo'lmasin.
  checkTrue('19) Uzumga alohida marshrut yo‘q', !/\/api\/(uzum|admin\/uzum)/.test(src));
  checkTrue('19) Uzumga alohida jadval yo‘q', !/uzum_(orders|activations|products)/.test(src));
}

// ── 20) AKTIVATSIYALAR TARIXI ────────────────────────────────────────
// Kodlar ro'yxati "hozir nima" ni ko'rsatadi, tarix esa "nima
// bo'ldi" ni. "Bu kod nega bloklangan?" degan savolga faqat tarix
// javob beradi — jumladan qayta taqsimlash SABABI.
{
  const env = await setup();
  const product = await makeProduct(env);
  const codes = (await makeCodes(env, product.id, 2)).codes;
  const id = Number((await rowOfCode(env, codes[0].code, 'id')).id);

  await call(env, `/api/admin/marketplace/activations/${id}/block`, { method: 'POST', cookie: cookie.admin });
  await call(env, `/api/admin/marketplace/activations/${id}/unblock`, { method: 'POST', cookie: cookie.admin });
  await call(env, '/api/activate', { method: 'POST', cookie: cookie.user, json: { code: codes[1].code, profileKind: 'personal' } });

  const res = await call(env, '/api/admin/marketplace/history', { cookie: cookie.admin });
  check('20) tarix ochildi', res.status, 200);
  const hist = (await jsonOf(res)).history;
  const actions = hist.map((h) => h.action);
  checkTrue('20) mahsulot yaratilishi yozilgan', actions.includes('marketplace_product_created'));
  checkTrue('20) kodlar yaratilishi yozilgan', actions.includes('marketplace_codes_created'));
  checkTrue('20) bloklash yozilgan', actions.includes('marketplace_blocked'));
  checkTrue('20) blokdan chiqarish yozilgan', actions.includes('marketplace_unblocked'));
  checkTrue('20) faollashtirish yozilgan', actions.includes('marketplace_activated'));
  // Faqat marketplace amallari — boshqa bo'limlarning jurnali
  // aralashib ketmasin.
  checkTrue('20) faqat marketplace amallari', actions.every((a) => a.startsWith('marketplace')));
  // Eng yangisi tepada.
  checkTrue('20) yangisi tepada', hist.length > 1 && hist[0].createdAt >= hist[hist.length - 1].createdAt);
  // Holat o'zgarishi ko'rinadi.
  const blocked = hist.find((h) => h.action === 'marketplace_blocked');
  check('20) qaysi holatdan qaysiga', `${blocked.from}->${blocked.to}`, 'new->blocked');

  // TO'LIQ KOD TARIXDA HAM YO'Q.
  const text = JSON.stringify(hist);
  const leaked = codes.filter((c) => text.includes(c.code));
  check('20) tarixda to‘liq kod yo‘q', leaked.length, 0);
  checkTrue('20) maskalangan ko‘rinish bor', /\*\*\*\*-/.test(text));
  checkTrue('20) xesh ham yo‘q', !/[0-9a-f]{64}/.test(text));

  // Faqat admin.
  check('20) tarix mehmonga yopiq', (await call(env, '/api/admin/marketplace/history', {})).status, 401);
  check('20) tarix oddiy userga yopiq', (await call(env, '/api/admin/marketplace/history', { cookie: cookie.user })).status, 401);

  // Alohida jurnal jadvali YARATILMADI — mavjud `admin_activity_log`.
  const src = read('../hosting/api/marketplace.js');
  checkTrue('20) mavjud jurnal ishlatiladi', /FROM admin_activity_log/.test(src));
  checkTrue('20) alohida jurnal jadvali yo‘q', !/marketplace_(log|history|audit)\b/.test(src));

  // Interfeysda ham bor.
  const tab = stripComments(read('../src/components/admin/MarketplaceTab.jsx'));
  checkTrue('20) "Tarix" bo‘limi bor', /\['history', 'Tarix'\]/.test(tab));
  checkTrue('20) amallar o‘zbekcha nomlanadi', /marketplace_reassigned: 'Qayta taqsimlandi'/.test(tab));
  checkTrue('20) noma’lum amal jim yo‘qolmaydi', /ACTION_LABEL\[r\.action\] \? t\(ACTION_LABEL\[r\.action\]\) : r\.action/.test(tab));
}

// ── 21) MARKETPLACE RO'YXATI — YAGONA MANBA ──────────────────────────
// Ro'yxat ilgari IKKI joyda edi (backend id'lari va admin
// komponentidagi yozuvlar). Ular ajralib ketsa xato JIM bo'lardi:
// admin ro'yxatdan yangi marketplace'ni tanlaydi, backend uni
// tanimaydi va mahsulotni indamay 'uzum' deb saqlab qo'yadi.
{
  const env = await setup();

  // Ro'yxat MAHSULOTLAR javobida keladi — qo'shimcha so'rovsiz.
  const list = await jsonOf(await call(env, '/api/admin/marketplace/products', { cookie: cookie.admin }));
  checkTrue('21) katalog javobda bor', !!list.catalog);
  const mkIds = list.catalog.marketplaces.map((m) => m.id);
  check('21) marketplace ro‘yxati', mkIds.join(','), 'uzum,yandex,wildberries,ozon,other');
  checkTrue('21) Yandex Market bor', list.catalog.marketplaces.some((m) => m.id === 'yandex' && m.label === 'Yandex Market'));
  checkTrue('21) har birida yozuv bor', list.catalog.marketplaces.every((m) => m.id && m.label));
  checkTrue('21) mahsulot turlari ham keladi', list.catalog.physicalTypes.length >= 6);
  checkTrue('21) tariflar ham keladi', list.catalog.tiers.some((x) => x.id === 'auto'));

  // YANDEX HAQIQATAN ISHLAYDI — saqlanadi, filtrlanadi, sanaladi.
  const yandex = await makeProduct(env, { sku: 'YA-NFC-01', marketplace: 'yandex' });
  check('21) yandex saqlandi', yandex.marketplace, 'yandex');
  await makeCodes(env, yandex.id, 2);
  const filtered = await jsonOf(await call(env, '/api/admin/marketplace/activations?marketplace=yandex', { cookie: cookie.admin }));
  check('21) yandex bo‘yicha filtr', filtered.activations.length, 2);
  const stats = await jsonOf(await call(env, '/api/admin/marketplace/stats', { cookie: cookie.admin }));
  check('21) statistikada yandex', stats.byMarketplace.find((m) => m.marketplace === 'yandex')?.count, 2);

  // Noma'lum marketplace JIM 'uzum' bo'lib qolmasin deb emas —
  // aksincha, u ATAYLAB standart qiymatga tushadi. Muhimi: bu
  // faqat NOMA'LUM qiymat uchun, ro'yxatdagilar uchun emas.
  const unknown = await makeProduct(env, { sku: 'XX-01', marketplace: 'temu' });
  check('21) noma’lum qiymat standartga tushadi', unknown.marketplace, 'uzum');

  // Frontendda IKKINCHI nusxa qolmasin.
  const tab = stripComments(read('../src/components/admin/MarketplaceTab.jsx'));
  checkTrue('21) frontendda marketplace ro‘yxati yo‘q', !/const MARKETPLACES = \[/.test(tab));
  checkTrue('21) frontendda mahsulot turlari ro‘yxati yo‘q', !/const PHYSICAL_TYPES = \[/.test(tab));
  checkTrue('21) frontendda tarif ro‘yxati yo‘q', !/const TIERS = \[/.test(tab));
  checkTrue('21) frontend serverdan oladi', /d\.catalog/.test(tab));
  // Atoqli otlar qattiq yozilmasin (ular endi serverdan keladi).
  checkTrue('21) "Uzum Market" frontendda qotirilmagan', !/'Uzum Market'/.test(tab));
  checkTrue('21) "Yandex Market" frontendda qotirilmagan', !/'Yandex Market'/.test(tab));

  // Backendda esa BITTA ta'rif bo'lsin.
  const src = read('../hosting/api/marketplace.js');
  check('21) backendda bitta ta’rif', (src.match(/^const MARKETPLACES = \[/gm) || []).length, 1);
}

// ── 22) FIZIK STIKER HAQIQATAN ISHLAYDIMI ────────────────────────────
//
// Aktivatsiya kod -> profil bog'lanishini to'g'ri qilardi, LEKIN
// STIKERNING O'ZI hech qayerga olib bormasdi: chipdagi token uchun
// yo'naltirish marshruti yo'q edi va admin panelda kodga qurilma
// biriktirish ham yo'q edi. Ya'ni marketplace mahsuloti FIZIK
// jihatdan ishlamasdi.
{
  const env = await setup();
  const product = await makeProduct(env);
  const codes = (await makeCodes(env, product.id, 5)).codes;
  const idOf = async (c) => Number((await rowOfCode(env, c.code, 'id')).id);

  // ── QURILMANI BIRIKTIRISH ──────────────────────────────────────────
  const id0 = await idOf(codes[0]);
  const att = await call(env, `/api/admin/marketplace/activations/${id0}/attach-device`, {
    method: 'POST', cookie: cookie.admin, json: { chipToken: 'CHIP-AAA1' },
  });
  check('22) qurilma biriktirildi', att.status, 200);
  const dev = await env.DB.prepare(`SELECT id, owner_user_id AS uid, linked_code AS lc FROM physical_cards WHERE chip_token = 'CHIP-AAA1'`).first();
  checkTrue('22) qurilma yozuvi yaratildi', !!dev);
  check('22) hali egasi yo‘q', dev.uid, null);
  const bound = await rowOfCode(env, codes[0].code, 'physical_device_id AS d');
  check('22) kodga bog‘landi', Number(bound.d), Number(dev.id));

  // Bir stikerni IKKI kodga biriktirib bo'lmaydi.
  const id1 = await idOf(codes[1]);
  const dup = await call(env, `/api/admin/marketplace/activations/${id1}/attach-device`, {
    method: 'POST', cookie: cookie.admin, json: { chipToken: 'CHIP-AAA1' },
  });
  check('22) band stiker ikkinchi kodga o‘tmaydi', dup.status, 409);
  check('22) sababi aniq', (await jsonOf(dup)).error, 'device_taken');

  // Odamga tegishli stiker ham olinmaydi.
  await env.DB.prepare(`INSERT INTO physical_cards (chip_token, owner_user_id) VALUES ('CHIP-OWNED', 2)`).run();
  const owned = await call(env, `/api/admin/marketplace/activations/${id1}/attach-device`, {
    method: 'POST', cookie: cookie.admin, json: { chipToken: 'CHIP-OWNED' },
  });
  check('22) begona stiker olinmaydi', owned.status, 409);

  check('22) token majburiy', (await call(env, `/api/admin/marketplace/activations/${id1}/attach-device`, { method: 'POST', cookie: cookie.admin, json: {} })).status, 422);
  check('22) biriktirish mehmonga yopiq', (await call(env, `/api/admin/marketplace/activations/${id1}/attach-device`, { method: 'POST', json: { chipToken: 'X' } })).status, 401);

  // ── /t/<token> — BOG'LANMAGAN ──────────────────────────────────────
  const r1 = await call(env, '/t/CHIP-AAA1');
  check('22) bog‘lanmagan token -> yo‘naltirish', r1.status, 302);
  // Token yo'naltirishda OLIB KETILADI: aynan shu narsa "har qanday stiker +
  // har qanday kod" ishlashini ta'minlaydi — odam tekkizgan stiker o'zi
  // faollashtirish sahifasiga ergashadi, oldindan juftlashtirish shart emas.
  check('22) ...faollashtirish sahifasiga', r1.headers.get('location'), '/activate?d=CHIP-AAA1');
  // KESHLANMASIN: profil keyin o'zgaradi.
  check('22) kesh yo‘q', r1.headers.get('cache-control'), 'no-store');

  // ── AKTIVATSIYA -> STIKER PROFILGA ISHORA QILADI ──────────────────
  const out = await jsonOf(await call(env, '/api/activate', {
    method: 'POST', cookie: cookie.user, json: { code: codes[0].code, profileKind: 'personal' },
  }));
  const r2 = await call(env, '/t/CHIP-AAA1');
  check('22) endi profilga yo‘naltiradi', r2.status, 302);
  check('22) aynan o‘sha profilga', r2.headers.get('location'), `/${out.result.profileCode.toLowerCase()}?t=CHIP-AAA1`);
  const after = await env.DB.prepare(`SELECT owner_user_id AS uid, linked_code AS lc, active FROM physical_cards WHERE chip_token = 'CHIP-AAA1'`).first();
  check('22) qurilma egasiga o‘tdi', Number(after.uid), 1);
  check('22) profilga bog‘landi', after.lc, out.result.profileCode);
  check('22) faol', Number(after.active), 1);

  // ── BIZNES: kompaniya sahifasiga ──────────────────────────────────
  await addCompany(env, 'TAPCO', 1, 'Tegish Kompaniyasi');
  const id2 = await idOf(codes[2]);
  await call(env, `/api/admin/marketplace/activations/${id2}/attach-device`, {
    method: 'POST', cookie: cookie.admin, json: { chipToken: 'CHIP-BIZ1' },
  });
  await call(env, '/api/activate', { method: 'POST', cookie: cookie.user, json: { code: codes[2].code, profileKind: 'business', companyId: 'TAPCO' } });
  const r3 = await call(env, '/t/CHIP-BIZ1');
  check('22) biznes -> kompaniya sahifasi', r3.headers.get('location'), '/c/tapco');
  // `linked_code` — cards.code ga FK; kompaniya u yerga YOZILMAYDI.
  const bizDev = await env.DB.prepare(`SELECT linked_code AS lc, linked_company_id AS cid FROM physical_cards WHERE chip_token = 'CHIP-BIZ1'`).first();
  check('22) linked_code bo‘sh qoldi', bizDev.lc, null);
  check('22) kompaniya alohida ustunda', bizDev.cid, 'TAPCO');

  // ── NOMA'LUM TOKEN — YOLG'ON VA'DA BERMAYMIZ ──────────────────────
  const r4 = await call(env, '/t/YOQBUNDAY');
  check('22) noma’lum token -> bosh sahifa', r4.headers.get('location'), '/');
  // Xavfsizlik: token shakliga tushmaydigan narsa marshrutga
  // umuman kirmaydi (SPA qobig'i qaytadi, yo'naltirish emas).
  const r5 = await call(env, '/t/' + encodeURIComponent("' OR 1=1 --"));
  checkTrue('22) injeksiya urinishi yo‘naltirilmaydi', r5.status !== 302, `${r5.status}`);

  // ── CSV: chip_token ustuni ────────────────────────────────────────
  const imp = await jsonOf(await call(env, '/api/admin/marketplace/orders/import', {
    method: 'POST', cookie: cookie.admin,
    json: {
      rows: [
        // Faqat token (ishlab chiqarish fayli — buyurtma hali yo'q).
        { code: codes[3].code, chipToken: 'CHIP-CSV1' },
        // Token + buyurtma birga.
        { code: codes[4].code, chipToken: 'CHIP-CSV2', marketplaceOrderId: 'UZUM-7001' },
        // Band token — qator BOG'LANMASIN.
        { code: codes[1].code, chipToken: 'CHIP-AAA1', marketplaceOrderId: 'UZUM-7002' },
      ],
    },
  }));
  check('22) CSV: 2 qator bog‘landi', imp.linked, 2);
  check('22) CSV: band token muammo sifatida qaytdi', imp.problems[0].reason, 'device_taken');
  const csv1 = await rowOfCode(env, codes[3].code, 'physical_device_id AS d, marketplace_order_id AS o, status');
  checkTrue('22) CSV: token biriktirildi', csv1.d != null);
  check('22) CSV: buyurtmasiz qator holatini o‘zgartirmadi', csv1.status, 'new');
  const csv2 = await rowOfCode(env, codes[4].code, 'physical_device_id AS d, marketplace_order_id AS o, status');
  checkTrue('22) CSV: token va buyurtma birga', csv2.d != null && csv2.o === 'UZUM-7001');
  check('22) CSV: buyurtma bilan SOLD', csv2.status, 'sold');
  // Band token bo'lgan qatorning buyurtmasi ham YOZILMASIN.
  const csv3 = await rowOfCode(env, codes[1].code, 'marketplace_order_id AS o');
  check('22) band token: buyurtma ham yozilmadi', csv3.o, null);

  // ── MANBA QOIDALARI ───────────────────────────────────────────────
  const worker = read('../hosting/worker.js');
  // 301 BO'LMASIN: brauzer abadiy keshlaydi va profil almashganda
  // karta eski profilga olib boraverardi.
  checkTrue('22) doimiy yo‘naltirish (301) ishlatilmaydi',
    !/status: 301[\s\S]{0,200}chip_token/.test(worker));
  checkTrue('22) 302 va no-store', /status: 302,\s*\n?\s*headers: \{ location: pathname, 'cache-control': 'no-store' \}/.test(worker));
}

// ── 23) HAR QANDAY STIKER + HAR QANDAY KOD ───────────────────
//
// HAQIQIY ISH TARTIBI. Egasi 10 ta yoki 100 ta stikerni oldindan
// tayyorlaydi va yopishtirilgan holda do'konga topshiradi. QAYSI
// stiker qaysi xaridorga tushishini U BILMAYDI — demak stikerni
// kodga OLDINDAN juftlashtirish mumkin emas.
//
// Shuning uchun juftlik ODAM STIKERGA TEKKIZGANDA hosil bo'ladi:
// stiker `/activate` ga o'z tokenini olib keladi, xaridor konvertdan
// olingan kodni kiritadi va aynan QO'LIDAGI stiker bog'lanadi.
//
// Bu bo'lim shuni isbotlaydi: 2-kod bilan mintalgan stiker 0-kod
// bilan faollashtirilsa ham to'g'ri ishlaydi.
{
  const env = await setup();
  const product = await makeProduct(env);
  const batch = await makeCodes(env, product.id, 4);
  const codes = batch.codes;
  const idOf = async (c) => Number((await rowOfCode(env, c.code, 'id')).id);

  // Batch stikerni ham chiqaradi — aks holda egasi 100 ta tokenni
  // qo'lda o'ylab topishi kerak bo'lardi.
  checkTrue('23) batch stiker tokenini ham beradi', codes.every((c) => /^[A-Za-z0-9_-]{4,}$/.test(c.chipToken || '')));
  check('23) tokenlar takrorlanmaydi', new Set(codes.map((c) => c.chipToken)).size, codes.length);

  // JUFTLASHTIRILMAGAN: token kodning qatoriga yozilmagan.
  const pre = await rowOfCode(env, codes[0].code, 'physical_device_id AS d');
  check('23) kod stikersiz tug‘iladi', pre.d, null);

  // ── XARIDOR 2-KOD UCHUN MINTALGAN STIKERNI OLDI ────────────
  const tapped = codes[2].chipToken;          // qo'ldagi stiker
  const envelope = codes[0].code;             // konvertdagi kod — BOSHQA
  const hop = await call(env, `/t/${tapped}`);
  check('23) tegish -> faollashtirish', hop.status, 302);
  check('23) token o‘zi bilan ketadi', hop.headers.get('location'), `/activate?d=${tapped}`);

  const act = await jsonOf(await call(env, '/api/activate', {
    method: 'POST', cookie: cookie.user, json: { code: envelope, profileKind: 'personal', deviceToken: tapped },
  }));
  checkTrue('23) faollashdi', !!act?.result?.profileCode);
  const profile = act.result.profileCode;

  // QO'LDAGI stiker bog'landi — kod bilan "o'z" stikeri emas.
  const tdev = await env.DB.prepare(`SELECT owner_user_id AS uid, linked_code AS lc, active FROM physical_cards WHERE chip_token = ?`).bind(tapped).first();
  check('23) tegilgan stiker egasiga o‘tdi', Number(tdev.uid), 1);
  check('23) tegilgan stiker profilga bog‘landi', tdev.lc, profile);
  check('23) tegilgan stiker faol', Number(tdev.active), 1);

  const usedRow = await rowOfCode(env, envelope, 'physical_device_id AS d, status');
  const tdevId = await env.DB.prepare(`SELECT id FROM physical_cards WHERE chip_token = ?`).bind(tapped).first();
  check('23) kod qatori tegilgan stikerni ko‘rsatadi', Number(usedRow.d), Number(tdevId.id));
  check('23) kod faollashgan', usedRow.status, 'activated');

  // 2-kodning O'ZI tegilmagan: u hali ham sotilishi kerak.
  const donor = await rowOfCode(env, codes[2].code, 'status, physical_device_id AS d, activated_profile_code AS p');
  check('23) stiker "egasi" kod o‘zgarmadi', donor.status, 'new');
  check('23) stiker "egasi" kod hali bo‘sh', donor.d, null);
  check('23) stiker "egasi" kod faollashmadi', donor.p, null);

  // Tegilgan stiker endi profilga olib boradi.
  check('23) stiker profilni ochadi', (await call(env, `/t/${tapped}`)).headers.get('location'), `/${profile.toLowerCase()}?t=${tapped}`);

  // ── IKKINCHI XARIDOR, BOSHQA STIKER, BOSHQA KOD ────────────
  const tapped2 = codes[3].chipToken;
  const act2 = await jsonOf(await call(env, '/api/activate', {
    method: 'POST', cookie: cookie.other, json: { code: codes[1].code, profileKind: 'personal', deviceToken: tapped2 },
  }));
  checkTrue('23) ikkinchi xaridor faollashtirdi', !!act2?.result?.profileCode);
  const dev2 = await env.DB.prepare(`SELECT owner_user_id AS uid, linked_code AS lc FROM physical_cards WHERE chip_token = ?`).bind(tapped2).first();
  check('23) ikkinchi stiker ikkinchi odamga', Number(dev2.uid), 2);
  check('23) ikkinchi stiker o‘z profiliga', dev2.lc, act2.result.profileCode);
  // BIRINCHISI TEGILMADI.
  const still = await env.DB.prepare(`SELECT owner_user_id AS uid, linked_code AS lc FROM physical_cards WHERE chip_token = ?`).bind(tapped).first();
  check('23) birinchi stiker o‘zgarmadi', `${still.uid}|${still.lc}`, `1|${profile}`);

  // ── BOSHQANING ISHLAB TURGAN STIKERINI TORTIB OLIB BO'LMAYDI ──
  //
  // Token sir emas — u stikerning o'zida yozilgan. Shuning uchun
  // "begona tokenni yuboraman" hujumi ALOHIDA tekshiriladi.
  const steal = await call(env, '/api/activate', {
    method: 'POST', cookie: cookie.user, json: { code: codes[2].code, profileKind: 'personal', deviceToken: tapped2 },
  });
  checkTrue('23) band stiker aktivatsiyani to‘xtatmaydi', steal.status === 200 || steal.status === 201);
  const afterSteal = await env.DB.prepare(`SELECT owner_user_id AS uid, linked_code AS lc FROM physical_cards WHERE chip_token = ?`).bind(tapped2).first();
  check('23) band stiker egasida qoldi', Number(afterSteal.uid), 2);
  check('23) band stiker profili o‘zgarmadi', afterSteal.lc, act2.result.profileCode);
  const stealRow = await rowOfCode(env, codes[2].code, 'status, physical_device_id AS d');
  check('23) kod baribir faollashdi', stealRow.status, 'activated');
  check('23) kodga begona stiker yozilmadi', stealRow.d, null);

  // ── AXLAT TOKEN AKTIVATSIYANI BUZMAYDI ─────────────────
  const batch2 = await makeCodes(env, product.id, 2);
  const junk = await call(env, '/api/activate', {
    method: 'POST', cookie: cookie.other, json: { code: batch2.codes[0].code, profileKind: 'personal', deviceToken: 'YO\'Q-BUNDAY-TOKEN' },
  });
  checkTrue('23) noma’lum token bilan ham faollashadi', junk.status === 200 || junk.status === 201);
  check('23) noma’lum token yozilmadi', (await rowOfCode(env, batch2.codes[0].code, 'physical_device_id AS d')).d, null);

  // ── STIKERSIZ HAM ISHLAYDI (QR + kod, NFC o'qimaydigan telefon) ──
  const noTap = await call(env, '/api/activate', {
    method: 'POST', cookie: cookie.other, json: { code: batch2.codes[1].code, profileKind: 'personal' },
  });
  checkTrue('23) stikersiz faollashtirish ham ishlaydi', noTap.status === 200 || noTap.status === 201);

  // ── MANBA QOIDALARI ────────────────────────────────
  const page = stripComments(read('../src/pages/ActivatePage.jsx'));
  // Token URL'da QOLMASIN: brauzer tarixi va "share" orqali sizadi.
  checkTrue('23) token URL’dan olib tashlanadi', /replaceState/.test(page) && /delete\('d'\)/.test(page));
  // Aktivatsiya kodidan farqli — token uzoq muddat saqlanmaydi.
  checkTrue('23) token localStorage’ga yozilmaydi', !/localStorage[\s\S]{0,80}nfc_activation_device/.test(page));
  checkTrue('23) token sessionStorage’da',
    /DEVICE_KEY = 'nfc_activation_device'/.test(page) && /sessionStorage\.setItem\(DEVICE_KEY/.test(page));
  checkTrue('23) token so‘rov bilan yuboriladi', /deviceToken/.test(page));

  // Admin egasi 100 ta chipga nimani yozishini BILISHI kerak.
  const tab = stripComments(read('../src/components/admin/MarketplaceTab.jsx'));
  checkTrue('23) stiker manzillari yuklab olinadi', /tap_url,chip_token/.test(tab));
  checkTrue('23) manzil /t/<token> ko‘rinishida', /\/t\/\$\{c\.chipToken\}/.test(tab));
  // Kod CSV'siga stiker QO'SHILMAYDI: bir qatorda turgani "juftlik"
  // degan yolg‘on taassurot berardi.
  checkTrue('23) kodlar CSV’sida stiker yo‘q', /const head = 'code,sku,product,marketplace,batch/.test(tab));

  const mk = stripComments(read('../hosting/api/marketplace.js'));
  // Faqat EGASIZ va BOG'LANMAGAN stiker qabul qilinadi.
  checkTrue('23) faqat egasiz stiker qabul qilinadi',
    /owner_user_id IS NULL AND \(linked_code IS NULL OR linked_code = ''\)/.test(mk));
  // Batch tokenni kod qatoriga YOZMAYDI.
  checkTrue('23) batch stikerni kodga biriktirmaydi',
    !/INSERT INTO marketplace_activations[\s\S]{0,600}physical_device_id/.test(mk));
}

done();
