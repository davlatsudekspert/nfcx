// HISOBNI O'CHIRISH, 1-BOSQICH (ACCOUNT_DELETION_PLAN.md, 8.1 PR-1).
//
// Bu bosqich HECH NARSA O'CHIRMAYDI. U faqat qaytarib bo'lmaydigan
// o'chirish yo'llarini yopadi va o'chirilgan hisobni oxirigacha
// yashiradi:
//
//   (a) B1/B11: o'chirish navbatidagi hisob emaili (yoki faqat
//       telefonli hisobning ichki manzili) bilan qayta ro'yxatdan
//       o'tish 409 `account_pending_deletion` qaytaradi. Ilgari eski
//       qator `DELETE FROM users` bilan o'chirilardi va CASCADE uning
//       `transactions`, `wallet_topups`, `web_orders`, `bids`,
//       `premium_requests`, `support_messages` qatorlarini ham olib
//       ketardi. Email xizmati o'chiq bo'lsa buni begona odam ham
//       qila olardi.
//   (b) B1/B2/B11: sovg'a faollashtirishda ham xuddi shunday. Bot
//       buyurtmasi bor hisobda eski yo'l FK xatosi bilan yiqilardi.
//   (c) Oddiy ro'yxatdan o'tish va oddiy sovg'a faollashtirish
//       o'zgarmagan.
//   (d) B5: o'chirilgan hisobning izohlari ro'yxatda ham, sanoqda ham
//       ko'rinmaydi. Hisob tiklansa (`deleted_at = NULL`) qaytadi.
//   (e) B14: `DELETE /api/account` hisob egasi yuborgan va unga kelgan
//       kutilayotgan sovg'a takliflarini bekor qiladi (o'chirmaydi).
//
// PR-1 review'dan keyingi tuzatishlar:
//   (b) sovg'a faollashtirishda o'chirilgan email 409 i PAROLDAN KEYIN:
//       kodi bor odam noto'g'ri parol bilan email holatini bilolmaydi.
//   (c) jurnalga email emas, `KOD — #userId` yoziladi (B13).
//   (d) muallifi o'chirilgan (yashirin) izohga javob ham, like ham yo'q.
//   (f) admin o'chirishi ham kutilayotgan takliflarni bekor qiladi (B14),
//       jurnalda email yo'q (B13).
//   (g) avval o'chirilgan hisob bilan qolgan eski kutilayotgan
//       takliflar ro'yxatda ko'rinmaydi (faqat o'qish filtri).
//   (h) o'chirilgan hisob kartasiga yangi taklif -> RECIPIENT_NOT_FOUND.
//
// Haqiqiy `hosting/worker.js`, in-memory D1 (`scripts/lib/d1-harness.mjs`,
// foreign key'lar yoqilgan). Production D1/R2 ga TEGMAYDI, tarmoqqa
// chiqmaydi.
//
//   node scripts/test-account-deletion-pr1.mjs
import worker from '../hosting/worker.js';
import { makeEnv, seedBasic, req, cookie, makeChecker } from './lib/d1-harness.mjs';
import { scryptSync, randomBytes } from 'node:crypto';

const { check, checkTrue, done } = makeChecker();
const { env, sqlite } = makeEnv({ TELEGRAM_BOT_TOKEN: 'test-token' });
await seedBasic(env);

// Qo'shimcha foydalanuvchilar (seedBasic: #1 VIP001/BIZ777, #2 OTH222).
// Raqamlar ataylab katta: `users.id` AUTOINCREMENT emas va API orqali
// ochilgan hisoblar keyingi bo'sh raqamni oladi — to'qnashmasin.
sqlite.prepare(`INSERT INTO users (id, email, password_hash, is_premium) VALUES (203, 'three@test.local', 'x', 1)`).run();
sqlite.prepare(`INSERT INTO users (id, email, password_hash, is_premium) VALUES (204, 'four@test.local', 'x', 1)`).run();
sqlite.prepare(`INSERT INTO cards (code, name, price, ts, user_id) VALUES ('THR333', 'Uchinchi', 0, 1, 203)`).run();
sqlite.prepare(`INSERT INTO cards (code, name, price, ts, user_id) VALUES ('FOU444', 'Tortinchi', 0, 1, 204)`).run();
for (const [tok, uid] of [['three-token', 203], ['four-token', 204]]) {
  sqlite.prepare(`INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, '2999-01-01T00:00:00.000Z')`).run(tok, uid);
}
const as3 = 'nfc_session=three-token';
const as4 = 'nfc_session=four-token';

// ── Tarmoq stub'i: Resend (email kodi) va Telegram shu yerda ushlanadi ──
const mails = [];
globalThis.fetch = async (input, init = {}) => {
  const u = String(typeof input === 'string' ? input : input.url);
  if (u.startsWith('https://api.resend.com/')) {
    mails.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ id: 'msg_1' }), { headers: { 'content-type': 'application/json' } });
  }
  if (u.startsWith('https://api.telegram.org/')) {
    return new Response(JSON.stringify({ ok: true, result: {} }), { headers: { 'content-type': 'application/json' } });
  }
  throw new Error('unexpected fetch ' + u);
};
const lastMailCode = () => (String(mails[mails.length - 1]?.html || '').match(/>(\d{6})</) || [])[1];

// Email xizmati kalit bilan yoqiladi (`emailEnabledD1` har so'rovda
// `env` ni o'qiydi), shuning uchun bitta bazada ikkala holat sinaladi.
const emailOn = () => { env.RESEND_API_KEY = 'test-resend-key'; env.RESEND_FROM = 'NFCSTORE <no-reply@nfcstore.uz>'; };
const emailOff = () => { delete env.RESEND_API_KEY; delete env.RESEND_FROM; };

// Ro'yxat IP bo'yicha cheklangan (soatiga 5 ta). Hamma so'rov bitta
// "IP" dan keladi, shuning uchun har tekshiruv oldidan bo'shatiladi.
const noLimit = () => sqlite.prepare(`DELETE FROM rate_limits`).run();

const call = async (path, init = {}) => {
  const res = await worker.fetch(req(path, init), env);
  const body = await res.json().catch(() => null);
  return { res, status: res.status, body, setCookie: res.headers.get('set-cookie') || '' };
};
const n = (sql, ...args) => Number(sqlite.prepare(sql).get(...args)?.n || 0);

// ── Loglar: 409 yo'lida email yoki telefon konsolga ham chiqmasin (B13) ──
const logged = [];
const realConsole = { log: console.log, warn: console.warn, error: console.error };
const captureConsole = () => {
  for (const k of ['log', 'warn', 'error']) console[k] = (...a) => { logged.push(a.map(String).join(' ')); };
};
const restoreConsole = () => Object.assign(console, realConsole);

// ── Moliyaviy yozuvlar: ular HECH QACHON o'chmasligi kerak ─────────────
// Har biri sxemada `users` ga `ON DELETE CASCADE` bilan bog'langan.
const FIN_TABLES = ['transactions', 'wallet_topups', 'web_orders', 'bids', 'premium_requests', 'support_messages'];
let auctionSeq = 900;
function seedFinancial(uid, tag) {
  sqlite.prepare(`INSERT INTO transactions (user_id, amount, kind, note) VALUES (?, 50000, 'topup', ?)`).run(uid, tag);
  sqlite.prepare(`INSERT INTO wallet_topups (user_id, amount, status) VALUES (?, 50000, 'paid')`).run(uid);
  sqlite.prepare(`INSERT INTO web_orders (user_id, code, price, payload, status, kind) VALUES (?, ?, 99000, '{}', 'paid', 'card_purchase')`).run(uid, tag);
  sqlite.prepare(`INSERT INTO premium_requests (user_id, amount, status) VALUES (?, 20000, 'approved')`).run(uid);
  sqlite.prepare(`INSERT INTO support_messages (user_id, message) VALUES (?, 'salom')`).run(uid);
  const aid = ++auctionSeq;
  sqlite.prepare(`INSERT INTO auctions (id, code, start_price, current_price, ends_at, status) VALUES (?, ?, 1000, 1000, '2026-01-01 00:00:00+00', 'ended')`).run(aid, tag);
  sqlite.prepare(`INSERT INTO bids (auction_id, user_id, amount) VALUES (?, ?, 1000)`).run(aid, uid);
}
const finCounts = (uid) => Object.fromEntries(
  FIN_TABLES.map((t) => [t, n(`SELECT COUNT(*) AS n FROM ${t} WHERE user_id = ?`, uid)]),
);
const ONE_EACH = Object.fromEntries(FIN_TABLES.map((t) => [t, 1]));
const userRow = (uid) => sqlite.prepare(`SELECT id, email, password_hash, phone, deleted_at FROM users WHERE id = ?`).get(uid) || null;

// Haqiqiy parol xeshi — worker'dagi `hashPassword` bilan bir xil
// format: `saltHex:hashHex`, scrypt tuzi esa hex SATRNING o'zi.
const hashPw = (pw) => {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(pw, salt, 64, { N: 16384, r: 8, p: 1 }).toString('hex')}`;
};

// O'chirish navbatidagi (soft-deleted) hisob: kartasi, jismoniy
// kartasi va moliyaviy tarixi bilan.
function seedDeletedUser(uid, email, phone, code, passwordHash = 'old-hash') {
  sqlite.prepare(`INSERT INTO users (id, email, password_hash, phone, deleted_at) VALUES (?, ?, ?, ?, '2026-09-01 10:00:00+00')`).run(uid, email, passwordHash, phone);
  sqlite.prepare(`INSERT INTO cards (code, name, price, ts, user_id) VALUES (?, 'Eski egasi', 0, 1, ?)`).run(code, uid);
  sqlite.prepare(`INSERT INTO physical_cards (chip_token, linked_code, owner_user_id, status) VALUES (?, ?, ?, 'delivered')`).run('chip-' + code, code, uid);
  seedFinancial(uid, code);
}
// Hisob va unga bog'langan hamma narsa joyidami — bitta tekshiruv.
function snapshot(uid, code) {
  return {
    user: userRow(uid),
    fin: finCounts(uid),
    card: sqlite.prepare(`SELECT code, user_id FROM cards WHERE code = ?`).get(code) || null,
    physical: n(`SELECT COUNT(*) AS n FROM physical_cards WHERE owner_user_id = ?`, uid),
  };
}

// =====================================================================
// (a) QAYTA RO'YXATDAN O'TISH — O'CHIRISH NAVBATIDAGI HISOB
// =====================================================================

// a1) Email xizmati O'CHIQ: kod so'ralmaydi, ya'ni emailni biladigan
// har kim shu so'rovni yubora oladi (B11). Eski yo'l shu yerda hisobni
// va to'lov tarixini butunlay o'chirardi (B1).
{
  seedDeletedUser(60, 'victim@test.local', '+998907770060', 'VIC060');
  const before = snapshot(60, 'VIC060');
  check('a1) boshlang‘ich holat: hisob o‘chirish navbatida, moliyaviy yozuvlar bor',
    [!!before.user?.deleted_at, before.fin, before.physical], [true, ONE_EACH, 1]);

  emailOff();
  noLimit();
  const logsBefore = n(`SELECT COUNT(*) AS n FROM admin_activity_log`);
  captureConsole();
  const r = await call('/api/auth/register', {
    method: 'POST',
    json: { email: 'victim@test.local', phone: '+998907771160', password: 'secret123', tosAccepted: true },
  });
  restoreConsole();
  check('a1) email xizmati o‘chiq -> 409 account_pending_deletion', [r.status, r.body], [409, { error: 'account_pending_deletion' }]);
  check('a1) eski hisob, kartasi, qurilmasi va moliyaviy yozuvlari o‘zgarmadi', snapshot(60, 'VIC060'), before);
  check('a1) shu email bilan yangi hisob ochilmadi', n(`SELECT COUNT(*) AS n FROM users WHERE email = 'victim@test.local'`), 1);
  check('a1) yangi telefon bilan ham hisob ochilmadi', n(`SELECT COUNT(*) AS n FROM users WHERE phone = '+998907771160'`), 0);
  check('a1) sessiya berilmadi', r.setCookie, '');
  check('a1) admin jurnaliga hech narsa yozilmadi', n(`SELECT COUNT(*) AS n FROM admin_activity_log`), logsBefore);
  checkTrue('a1) konsolga email yoki telefon chiqmadi',
    !logged.some((l) => l.includes('victim@test.local') || l.includes('+998907770060')));
}

// a2) Faqat telefon bilan ochilgan hisob (email = ichki manzil). Hisob
// ilova orqali o'chiriladi, keyin O'SHA telefon bilan qayta ro'yxat.
// Email xizmati o'chiq: telefon tasdiqlanmaydi, ya'ni raqamni
// biladigan begona odam ham shu so'rovni yubora oladi.
{
  emailOff();
  noLimit();
  const reg = await call('/api/auth/register', {
    method: 'POST', json: { phone: '+998907770061', password: 'secret123', tosAccepted: true },
  });
  check('a2) faqat telefon bilan ro‘yxat -> 201', reg.status, 201);
  const uid = Number(reg.body?.user?.id);
  const token = reg.setCookie.split(';')[0].split('=')[1];
  seedFinancial(uid, 'PH0061');
  const code = sqlite.prepare(`SELECT code FROM cards WHERE user_id = ?`).get(uid)?.code;
  checkTrue('a2) bepul ID berilgan', /^\d{8}$/.test(code || ''));

  const del = await call('/api/account', { method: 'DELETE', cookie: `nfc_session=${token}` });
  check('a2) hisob ilovadan o‘chirildi (soft)', [del.status, del.body], [200, { ok: true }]);
  const before = snapshot(uid, code);
  checkTrue('a2) deleted_at qo‘yilgan', !!before.user?.deleted_at);

  noLimit();
  captureConsole();
  const again = await call('/api/auth/register', {
    method: 'POST', json: { phone: '+998907770061', password: 'otherpass1', tosAccepted: true },
  });
  restoreConsole();
  check('a2) o‘sha telefon bilan qayta ro‘yxat -> 409 account_pending_deletion', [again.status, again.body], [409, { error: 'account_pending_deletion' }]);
  check('a2) eski hisob va moliyaviy yozuvlari o‘zgarmadi', snapshot(uid, code), before);
  check('a2) moliyaviy yozuvlar joyida', before.fin, ONE_EACH);
  check('a2) yangi hisob ochilmadi', n(`SELECT COUNT(*) AS n FROM users WHERE phone = '+998907770061'`), 1);
  checkTrue('a2) konsolga telefon chiqmadi', !logged.some((l) => l.includes('+998907770061')));
}

// a3) Email xizmati YOQIQ va kod TO'G'RI. PR-1 da bu ham 409: xavfsiz
// purge (tombstone) keyingi bosqichda (PR-2). Hozircha hech narsa
// o'chirilmaydi.
{
  emailOn();
  noLimit();
  const before = snapshot(60, 'VIC060');
  const rc = await call('/api/auth/request-register-code', {
    method: 'POST', json: { email: 'victim@test.local', phone: '+998907771162' },
  });
  check('a3) kod so‘rash -> 200 (email)', [rc.status, rc.body?.channel], [200, 'email']);
  const code = lastMailCode();
  checkTrue('a3) kod emailga ketdi', /^\d{6}$/.test(code || ''));
  noLimit();
  const r = await call('/api/auth/register', {
    method: 'POST',
    json: { email: 'victim@test.local', phone: '+998907771162', password: 'secret123', tosAccepted: true, emailCode: code },
  });
  check('a3) kod to‘g‘ri bo‘lsa ham -> 409 account_pending_deletion', [r.status, r.body], [409, { error: 'account_pending_deletion' }]);
  check('a3) eski hisob va moliyaviy yozuvlari o‘zgarmadi', snapshot(60, 'VIC060'), before);
  check('a3) sessiya berilmadi', r.setCookie, '');
}

// =====================================================================
// (b) SOVG'A FAOLLASHTIRISH — O'CHIRISH NAVBATIDAGI EMAIL
// =====================================================================
sqlite.prepare(`INSERT INTO nfc_gifts (code, recipient_name, activation_code, status) VALUES ('GFT901', 'A', 'GIFT-0901', 'reserved')`).run();
sqlite.prepare(`INSERT INTO nfc_gifts (code, recipient_name, activation_code, status) VALUES ('GFT902', 'B', 'GIFT-0902', 'reserved')`).run();
sqlite.prepare(`INSERT INTO nfc_gifts (code, recipient_name, activation_code, status) VALUES ('GFT903', 'C', 'GIFT-0903', 'reserved')`).run();
const giftBody = (over = {}) => ({ activationCode: 'GIFT-0901', email: 'giftvictim@test.local', password: 'secret12', name: 'Kimdir', ...over });
const giftRow = (code) => sqlite.prepare(`SELECT status, activated_by_user_id FROM nfc_gifts WHERE code = ?`).get(code);

{
  // Parol haqiqiy xesh: to'g'ri parol bilan 409 `account_pending_deletion`
  // yo'liga yetib boriladi, noto'g'risi bilan esa yo'q.
  seedDeletedUser(70, 'giftvictim@test.local', '+998907770070', 'GV0070', hashPw('secret12'));
  const before = snapshot(70, 'GV0070');

  // Aktivatsiya kodi AVVAL tekshiriladi: kodsiz odam email holatini
  // bilib ololmaydi.
  const wrong = await call('/api/nfc-gifts/GFT901/activate', { method: 'POST', json: giftBody({ activationCode: 'NOPE' }) });
  check('b0) noto‘g‘ri aktivatsiya kodi -> 401 bad_code (email holati oshkor bo‘lmaydi)', [wrong.status, wrong.body], [401, { error: 'bad_code' }]);

  // Kod TO'G'RI, parol NOTO'G'RI: o'chirilgan email ham, tirik hisob
  // emaili ham bir xil `email_taken` beradi. Ilgari o'chirilgan email
  // `account_pending_deletion` berardi, ya'ni kodi bor odam istalgan
  // emailning holatini bilib olardi.
  const logsBefore = n(`SELECT COUNT(*) AS n FROM admin_activity_log`);
  const probeDeleted = await call('/api/nfc-gifts/GFT901/activate', { method: 'POST', json: giftBody({ password: 'wrongpass1' }) });
  const probeAlive = await call('/api/nfc-gifts/GFT901/activate', { method: 'POST', json: giftBody({ email: 'three@test.local', password: 'wrongpass1' }) });
  check('b0) o‘chirilgan email + noto‘g‘ri parol -> 409 email_taken', [probeDeleted.status, probeDeleted.body], [409, { error: 'email_taken' }]);
  check('b0) javob tirik hisob + noto‘g‘ri parol bilan bir xil (email holati oshkor bo‘lmaydi)',
    [probeDeleted.status, probeDeleted.body], [probeAlive.status, probeAlive.body]);
  check('b0) noto‘g‘ri parol: hisob va yozuvlari o‘zgarmadi', snapshot(70, 'GV0070'), before);
  check('b0) noto‘g‘ri parol: sovg‘a ishlatilmadi', giftRow('GFT901'), { status: 'reserved', activated_by_user_id: null });
  check('b0) noto‘g‘ri parol: jurnalga hech narsa yozilmadi', n(`SELECT COUNT(*) AS n FROM admin_activity_log`), logsBefore);

  captureConsole();
  const r = await call('/api/nfc-gifts/GFT901/activate', { method: 'POST', json: giftBody() });
  restoreConsole();
  check('b1) o‘chirilgan email (to‘g‘ri parol) bilan faollashtirish -> 409 account_pending_deletion', [r.status, r.body], [409, { error: 'account_pending_deletion' }]);
  check('b1) eski hisob, kartasi, qurilmasi va moliyaviy yozuvlari o‘zgarmadi', snapshot(70, 'GV0070'), before);
  check('b1) moliyaviy yozuvlar joyida', before.fin, ONE_EACH);
  check('b1) sovg‘a ishlatilmadi', giftRow('GFT901'), { status: 'reserved', activated_by_user_id: null });
  check('b1) sovg‘a kartasi yaratilmadi', n(`SELECT COUNT(*) AS n FROM cards WHERE code = 'GFT901'`), 0);
  check('b1) sessiya berilmadi', r.setCookie, '');
  check('b1) admin jurnaliga hech narsa yozilmadi', n(`SELECT COUNT(*) AS n FROM admin_activity_log`), logsBefore);
  checkTrue('b1) konsolga email chiqmadi', !logged.some((l) => l.includes('giftvictim@test.local')));
}

// b2) Bot buyurtmasi bor hisob (B2). `bot_orders.user_id` da ON DELETE
// qoidasiz FK bor: eski yo'l "FOREIGN KEY constraint failed" bilan
// yiqilardi. Endi xato yo'q, javob o'sha 409.
{
  seedDeletedUser(71, 'botvictim@test.local', '+998907770071', 'BV0071', hashPw('secret12'));
  sqlite.prepare(`INSERT INTO bot_orders (tg_user_id, code, price, status, user_id) VALUES (555, 'BV0071', 49000, 'paid', 71)`).run();
  const before = snapshot(71, 'BV0071');
  const r = await call('/api/nfc-gifts/GFT903/activate', {
    method: 'POST', json: giftBody({ activationCode: 'GIFT-0903', email: 'botvictim@test.local' }),
  });
  check('b2) bot buyurtmasi bor o‘chirilgan email -> 409 (FK xatosi yo‘q)', [r.status, r.body], [409, { error: 'account_pending_deletion' }]);
  check('b2) hisob va yozuvlari o‘zgarmadi', snapshot(71, 'BV0071'), before);
  check('b2) bot buyurtmasi joyida', n(`SELECT COUNT(*) AS n FROM bot_orders WHERE user_id = 71`), 1);
  check('b2) sovg‘a ishlatilmadi', giftRow('GFT903').status, 'reserved');
}

// =====================================================================
// (c) ODDIY YO'LLAR O'ZGARMAGAN
// =====================================================================
{
  emailOff();
  noLimit();
  const r = await call('/api/auth/register', {
    method: 'POST', json: { email: 'Fresh@Test.local', phone: '+998907771170', password: 'secret123', tosAccepted: true },
  });
  check('c1) oddiy ro‘yxat (email o‘chiq) -> 201', [r.status, r.body?.user?.email], [201, 'fresh@test.local']);
  checkTrue('c1) sessiya berildi', r.setCookie.startsWith('nfc_session='));
  checkTrue('c1) bepul ID yaratildi', n(`SELECT COUNT(*) AS n FROM cards WHERE user_id = ?`, r.body?.user?.id) === 1);

  noLimit();
  const dup = await call('/api/auth/register', {
    method: 'POST', json: { email: 'fresh@test.local', phone: '+998907771171', password: 'secret123', tosAccepted: true },
  });
  check('c1) tirik hisob emaili -> 409 email_taken (avvalgidek)', [dup.status, dup.body?.error], [409, 'email_taken']);

  emailOn();
  noLimit();
  const rc = await call('/api/auth/request-register-code', { method: 'POST', json: { email: 'fresh2@test.local', phone: '+998907771172' } });
  check('c2) kod so‘rash -> 200', rc.status, 200);
  noLimit();
  const r2 = await call('/api/auth/register', {
    method: 'POST',
    json: { email: 'fresh2@test.local', phone: '+998907771172', password: 'secret123', tosAccepted: true, emailCode: lastMailCode() },
  });
  check('c2) oddiy ro‘yxat (email yoqiq, kod bilan) -> 201', [r2.status, r2.body?.user?.email], [201, 'fresh2@test.local']);
  emailOff();

  const g = await call('/api/nfc-gifts/GFT902/activate', {
    method: 'POST', json: giftBody({ activationCode: 'GIFT-0902', email: 'giftnew@test.local' }),
  });
  check('c3) oddiy sovg‘a faollashtirish -> 201 {ok, code}', [g.status, g.body], [201, { ok: true, code: 'GFT902' }]);
  const nu = sqlite.prepare(`SELECT id FROM users WHERE email = 'giftnew@test.local'`).get();
  check('c3) sovg‘a kartasi yangi egaga', sqlite.prepare(`SELECT user_id FROM cards WHERE code = 'GFT902'`).get()?.user_id, nu?.id);
  check('c3) sovg‘a faollashdi', giftRow('GFT902'), { status: 'activated', activated_by_user_id: nu?.id });
  checkTrue('c3) sessiya berildi', g.setCookie.startsWith('nfc_session='));
  check('c3) jurnal yozildi (avvalgidek)', sqlite.prepare(`SELECT action FROM admin_activity_log ORDER BY id DESC LIMIT 1`).get()?.action, 'nfc_gift_activated');
  // B13: jurnalda email emas, hisob raqami.
  check('c3) jurnal: `KOD — #userId`, email yo‘q', sqlite.prepare(`SELECT details FROM admin_activity_log ORDER BY id DESC LIMIT 1`).get()?.details, `GFT902 — #${nu?.id}`);

  // Tirik hisob emaili + to'g'ri parol: mavjud hisobga faollashtiriladi.
  const g2 = await call('/api/nfc-gifts/GFT901/activate', {
    method: 'POST', json: giftBody({ email: 'giftnew@test.local', password: 'secret12' }),
  });
  check('c3) tirik hisob (to‘g‘ri parol) -> 201', [g2.status, g2.body], [201, { ok: true, code: 'GFT901' }]);
  check('c3) jurnalning hech bir qatorida faollashtirgan email yo‘q',
    n(`SELECT COUNT(*) AS n FROM admin_activity_log WHERE COALESCE(details,'') || COALESCE(old_value,'') || COALESCE(new_value,'') LIKE '%giftnew@test.local%'`), 0);
}

// =====================================================================
// (e) B14: DELETE /api/account KUTILAYOTGAN SOVG'A TAKLIFLARINI BEKOR QILADI
// =====================================================================
{
  const ins = (code, from, to, status) => sqlite.prepare(
    `INSERT INTO gift_offers (code, from_user_id, to_user_id, status, created_at) VALUES (?, ?, ?, ?, '2026-09-20 10:00:00+00') RETURNING id`,
  ).get(code, from, to, status).id;
  const incoming = ins('OTH222', 2, 1, 'pending');   // #1 ga kelgan
  const outgoing = ins('VIP001', 1, 2, 'pending');   // #1 yuborgan
  const history = ins('BIZ777', 1, 203, 'accepted');   // tarix — tegilmaydi
  const unrelated = ins('THR333', 203, 2, 'pending');  // #1 ga aloqasi yo'q
  const offer = (id) => sqlite.prepare(`SELECT status, decided_at FROM gift_offers WHERE id = ?`).get(id);
  const total = n(`SELECT COUNT(*) AS n FROM gift_offers`);

  // #2 ning kodi kutilayotgan taklif bilan qulflangan.
  const locked = await call('/api/records/OTH222/gift', { method: 'POST', cookie: cookie.other, json: { toCode: 'FOU444' } });
  check('e) o‘chirishdan oldin: #2 kodi qulflangan -> 409 ALREADY_PENDING', [locked.status, locked.body], [409, { error: 'ALREADY_PENDING' }]);

  const del = await call('/api/account', { method: 'DELETE', cookie: cookie.user });
  check('e) DELETE /api/account -> 200 {ok:true} (javob o‘zgarmagan)', [del.status, del.body], [200, { ok: true }]);
  checkTrue('e) #1 qatori qoldi, deleted_at qo‘yildi', !!userRow(1)?.deleted_at);
  check('e) #1 sessiyalari yopildi', n(`SELECT COUNT(*) AS n FROM sessions WHERE user_id = 1`), 0);

  check('e) #1 ga kelgan taklif bekor qilindi', [offer(incoming).status, !!offer(incoming).decided_at], ['cancelled', true]);
  check('e) #1 yuborgan taklif bekor qilindi', [offer(outgoing).status, !!offer(outgoing).decided_at], ['cancelled', true]);
  check('e) yakunlangan taklif tegilmadi', offer(history), { status: 'accepted', decided_at: null });
  check('e) begona taklif tegilmadi', offer(unrelated), { status: 'pending', decided_at: null });
  check('e) hech bir taklif o‘chirilmadi', n(`SELECT COUNT(*) AS n FROM gift_offers`), total);

  const unlocked = await call('/api/records/OTH222/gift', { method: 'POST', cookie: cookie.other, json: { toCode: 'FOU444' } });
  check('e) #2 kodini yana taklif qila oladi -> 201', unlocked.status, 201);
  // Keyingi bo'limga xalaqit bermasin.
  if (unlocked.body?.id) sqlite.prepare(`UPDATE gift_offers SET status = 'cancelled' WHERE id = ?`).run(unlocked.body.id);
}

// =====================================================================
// (d) B5: O'CHIRILGAN HISOBNING IZOHLARI KO'RINMAYDI
// =====================================================================
{
  // #2 ning posti. Post izohlardan OLDIN yaratilgan bo'lishi shart
  // (`freshPostSql`: postdan oldingi izoh unga tegishli emas).
  sqlite.prepare(`INSERT INTO posts (id, code, user_id, caption, created_at) VALUES (81, 'OTH222', 2, 'post', '2026-01-01 00:00:00+00')`).run();
  const write = async (who, body, parentId) =>
    (await call('/api/comments/post/81', { method: 'POST', cookie: who, json: { body, parentId } })).body?.comment?.id;
  const c3 = await write(as3, 'tirik muallif izohi');
  const c4 = await write(as4, 'o‘chadigan muallif izohi');
  const r4 = await write(as4, 'o‘chadigan muallif javobi', c3);
  checkTrue('d) uchala izoh yozildi', [c3, c4, r4].every((x) => Number(x) > 0));

  const list = async (who) => {
    const r = await call('/api/comments/post/81', who ? { cookie: who } : {});
    return { ids: (r.body?.comments || []).map((c) => c.id).sort((a, b) => a - b), total: r.body?.total };
  };
  const postCount = async () => (await call('/api/records/OTH222/posts')).body?.posts?.find((p) => Number(p.id) === 81)?.commentCount;
  const all3 = [c3, c4, r4].sort((a, b) => a - b);

  check('d) o‘chirishdan oldin: ro‘yxatda 3 ta, total 3', await list(), { ids: all3, total: 3 });
  check('d) o‘chirishdan oldin: post sanog‘i 3', await postCount(), 3);

  const del = await call('/api/account', { method: 'DELETE', cookie: as4 });
  check('d) #204 hisobini o‘chirdi', del.status, 200);

  check('d) anonim ro‘yxat: #204 izohi va javobi yo‘q, total 1', await list(), { ids: [c3], total: 1 });
  check('d) #2 (post egasi) ham ko‘rmaydi', await list(cookie.other), { ids: [c3], total: 1 });
  check('d) post ostidagi sanoq 1 (lenta bilan bir manba)', await postCount(), 1);
  check('d) izohlar bazadan o‘chirilmadi va yumshoq o‘chirilmadi',
    n(`SELECT COUNT(*) AS n FROM content_comments WHERE target_kind = 'post' AND target_id = 81 AND deleted_at IS NULL`), 3);
  check('d) arxivga ham yozilmadi (hech narsa o‘chmagan)',
    n(`SELECT COUNT(*) AS n FROM content_comment_archive WHERE comment_id IN (?, ?)`, c4, r4), 0);

  const adm = await call('/api/admin/comments?state=live&limit=50', { cookie: cookie.admin });
  checkTrue('d) admin moderatsiyasi #204 izohini baribir ko‘radi',
    (adm.body?.comments || []).some((c) => c.id === c4));

  // Yashirin izohga javob ham, like ham qo'yib bo'lmaydi. Ilgari
  // `parentId` bilan qo'lda yuborilgan so'rov unga javob yozardi va
  // o'chirilgan odamga bildirishnoma ketardi; like ham qabul qilinardi.
  const likesOf = (cid) => n(`SELECT COUNT(*) AS n FROM content_likes WHERE target_kind = 'comment' AND target_id = ?`, cid);
  const commentRows = () => n(`SELECT COUNT(*) AS n FROM content_comments`);
  const rowsBefore = commentRows();
  const rep = await call('/api/comments/post/81', { method: 'POST', cookie: as3, json: { body: 'yashirin izohga javob', parentId: c4 } });
  check('d) yashirin izohga javob -> 404 parent_not_found', [rep.status, rep.body], [404, { error: 'parent_not_found' }]);
  check('d) javob yozilmadi', commentRows(), rowsBefore);
  const lk = await call(`/api/content-likes/comment/${c4}`, { method: 'POST', cookie: as3 });
  check('d) yashirin izohga like -> 404 not_found', [lk.status, lk.body], [404, { error: 'not_found' }]);
  const lkReply = await call(`/api/content-likes/comment/${r4}`, { method: 'POST', cookie: as3 });
  check('d) yashirin javobga like -> 404 not_found', [lkReply.status, lkReply.body], [404, { error: 'not_found' }]);
  check('d) like yozilmadi', [likesOf(c4), likesOf(r4)], [0, 0]);
  // Tirik muallif izohiga like avvalgidek ishlaydi.
  const lkAlive = await call(`/api/content-likes/comment/${c3}`, { method: 'POST', cookie: cookie.other });
  check('d) tirik muallif izohiga like -> 200 liked (avvalgidek)', [lkAlive.status, lkAlive.body?.liked, likesOf(c3)], [200, true, 1]);

  // Hisob tiklansa — izohlar o'z joyiga qaytadi.
  sqlite.prepare(`UPDATE users SET deleted_at = NULL WHERE id = 204`).run();
  check('d) tiklangach: ro‘yxatda yana 3 ta, total 3', await list(), { ids: all3, total: 3 });
  check('d) tiklangach: post sanog‘i 3', await postCount(), 3);

  // ...va unga yana javob yozish, like qo'yish mumkin.
  const rep2 = await call('/api/comments/post/81', { method: 'POST', cookie: as3, json: { body: 'endi javob', parentId: c4 } });
  check('d) tiklangach: izohga javob -> 201', rep2.status, 201);
  const lk2 = await call(`/api/content-likes/comment/${c4}`, { method: 'POST', cookie: as3 });
  check('d) tiklangach: izohga like -> 200 liked', [lk2.status, lk2.body?.liked, likesOf(c4)], [200, true, 1]);
}

// =====================================================================
// (f) ADMIN O'CHIRISHI HAM KUTILAYOTGAN TAKLIFLARNI BEKOR QILADI (B14)
//     VA JURNALGA EMAIL YOZMAYDI (B13)
// =====================================================================
const insOffer = (code, from, to, status) => sqlite.prepare(
  `INSERT INTO gift_offers (code, from_user_id, to_user_id, status, created_at) VALUES (?, ?, ?, ?, '2026-09-21 10:00:00+00') RETURNING id`,
).get(code, from, to, status).id;
const offerRow = (id) => sqlite.prepare(`SELECT status, decided_at FROM gift_offers WHERE id = ?`).get(id);
{
  sqlite.prepare(`INSERT INTO users (id, email, password_hash) VALUES (305, 'five@test.local', 'x')`).run();
  sqlite.prepare(`INSERT INTO cards (code, name, price, ts, user_id) VALUES ('FIV555', 'Beshinchi', 0, 1, 305)`).run();
  sqlite.prepare(`INSERT INTO sessions (token, user_id, expires_at) VALUES ('five-token', 305, '2999-01-01T00:00:00.000Z')`).run();
  const incoming = insOffer('OTH222', 2, 305, 'pending');   // #305 ga kelgan
  const outgoing = insOffer('FIV555', 305, 203, 'pending'); // #305 yuborgan
  const history = insOffer('FIV555', 305, 2, 'rejected');   // tarix — tegilmaydi
  const unrelated = insOffer('THR333', 203, 2, 'pending');  // #305 ga aloqasi yo'q
  const total = n(`SELECT COUNT(*) AS n FROM gift_offers`);

  const r = await call('/api/admin/users/305/delete', { method: 'POST', cookie: cookie.admin });
  check('f) admin o‘chirishi -> 200 {ok:true} (javob o‘zgarmagan)', [r.status, r.body], [200, { ok: true }]);
  checkTrue('f) #305 qatori qoldi, deleted_at qo‘yildi', !!userRow(305)?.deleted_at);
  check('f) #305 sessiyalari yopildi', n(`SELECT COUNT(*) AS n FROM sessions WHERE user_id = 305`), 0);
  check('f) #305 ga kelgan taklif bekor qilindi', [offerRow(incoming).status, !!offerRow(incoming).decided_at], ['cancelled', true]);
  check('f) #305 yuborgan taklif bekor qilindi', [offerRow(outgoing).status, !!offerRow(outgoing).decided_at], ['cancelled', true]);
  check('f) yakunlangan taklif tegilmadi', offerRow(history), { status: 'rejected', decided_at: null });
  check('f) begona taklif tegilmadi', offerRow(unrelated), { status: 'pending', decided_at: null });
  check('f) hech bir taklif o‘chirilmadi', n(`SELECT COUNT(*) AS n FROM gift_offers`), total);
  sqlite.prepare(`UPDATE gift_offers SET status = 'cancelled' WHERE id = ?`).run(unrelated);

  const log = sqlite.prepare(`SELECT details, old_value FROM admin_activity_log WHERE action = 'user_deleted' ORDER BY id DESC LIMIT 1`).get();
  check('f) jurnal: old_value hisob raqami, email emas', log?.old_value, '#305');
  check('f) jurnalning hech bir qatorida #305 emaili yo‘q',
    n(`SELECT COUNT(*) AS n FROM admin_activity_log WHERE COALESCE(details,'') || COALESCE(old_value,'') || COALESCE(new_value,'') LIKE '%five@test.local%'`), 0);
}

// =====================================================================
// (g) AVVAL O'CHIRILGAN HISOB BILAN QOLGAN ESKI KUTILAYOTGAN TAKLIFLAR
//     RO'YXATDA KO'RINMAYDI (faqat o'qish filtri, qatorlar o'zgarmaydi)
// =====================================================================
{
  // PR-1 dan oldin o'chirilgan hisob: takliflari bekor qilinmagan.
  sqlite.prepare(`INSERT INTO users (id, email, password_hash, deleted_at) VALUES (306, 'six@test.local', 'x', '2026-09-01 10:00:00+00')`).run();
  const legacyIn = insOffer('LEG001', 306, 2, 'pending');  // o'chirilgandan #2 ga
  const legacyOut = insOffer('LEG002', 2, 306, 'pending'); // #2 dan o'chirilganga
  const aliveIn = insOffer('THR333', 203, 2, 'pending');   // tirik yuboruvchi — ko'rinadi
  const aliveOut = insOffer('OTH222', 2, 204, 'pending');  // tirik oluvchi — ko'rinadi

  const r = await call('/api/gift-offers', { cookie: cookie.other });
  const inIds = (r.body?.incoming || []).map((o) => o.id);
  const outIds = (r.body?.outgoing || []).map((o) => o.id);
  check('g) GET /api/gift-offers -> 200', r.status, 200);
  check('g) o‘chirilgan yuboruvchining taklifi kelganlarda yo‘q', inIds.includes(legacyIn), false);
  check('g) o‘chirilgan oluvchiga taklif yuborilganlarda yo‘q', outIds.includes(legacyOut), false);
  checkTrue('g) javobda o‘chirilgan hisob emaili yo‘q', !JSON.stringify(r.body).includes('six@test.local'));
  check('g) tirik yuboruvchi taklifi ko‘rinadi (avvalgidek)',
    (r.body?.incoming || []).find((o) => o.id === aliveIn)?.fromEmail, 'three@test.local');
  check('g) tirik oluvchiga taklif ko‘rinadi (avvalgidek)',
    (r.body?.outgoing || []).find((o) => o.id === aliveOut)?.toEmail, 'four@test.local');
  check('g) eski qatorlar o‘zgarmadi (tuzatish ishi yo‘q)', [offerRow(legacyIn), offerRow(legacyOut)],
    [{ status: 'pending', decided_at: null }, { status: 'pending', decided_at: null }]);
  for (const id of [aliveIn, aliveOut]) sqlite.prepare(`UPDATE gift_offers SET status = 'cancelled' WHERE id = ?`).run(id);
}

// =====================================================================
// (h) O'CHIRILGAN HISOB KARTASIGA YANGI TAKLIF -> RECIPIENT_NOT_FOUND
// =====================================================================
{
  // Yuboruvchi kod — shu bo'lim uchun alohida (#2 ning yangi kartasi),
  // oldingi bo'limlardagi takliflar unga ta'sir qilmasin.
  // VIC060 — (a1) dagi o'chirish navbatidagi #60 ning kartasi.
  sqlite.prepare(`INSERT INTO cards (code, name, price, ts, user_id) VALUES ('OTH229', 'Boshqa 2', 0, 2, 2)`).run();
  const pendingOf = () => n(`SELECT COUNT(*) AS n FROM gift_offers WHERE code = 'OTH229' AND status = 'pending'`);
  check('h) boshlang‘ich holat: OTH229 bo‘yicha kutilayotgan taklif yo‘q', pendingOf(), 0);
  const total = n(`SELECT COUNT(*) AS n FROM gift_offers`);
  const r = await call('/api/records/OTH229/gift', { method: 'POST', cookie: cookie.other, json: { toCode: 'VIC060' } });
  check('h) o‘chirilgan hisob kartasiga taklif -> 409 RECIPIENT_NOT_FOUND', [r.status, r.body], [409, { error: 'RECIPIENT_NOT_FOUND' }]);
  check('h) taklif yaratilmadi (kod qulflanmadi)', [n(`SELECT COUNT(*) AS n FROM gift_offers`), pendingOf()], [total, 0]);
  const unknown = await call('/api/records/OTH229/gift', { method: 'POST', cookie: cookie.other, json: { toCode: 'NOSUCH' } });
  check('h) javob mavjud bo‘lmagan kod bilan bir xil', [r.status, r.body], [unknown.status, unknown.body]);

  const ok = await call('/api/records/OTH229/gift', { method: 'POST', cookie: cookie.other, json: { toCode: 'THR333' } });
  check('h) tirik hisob kartasiga taklif -> 201 (avvalgidek)', [ok.status, ok.body?.ok], [201, true]);
}

done();
