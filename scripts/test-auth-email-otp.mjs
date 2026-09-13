// EMAILGA TASDIQLASH KODI — ro'yxatdan o'tish va sozlamalar.
//
// Egasining talabi: "ro'yxatdan o'tishda emailga kod kelsin, lekin
// telefon raqam ham yozilsin; email bilan kirsa email orqali
// tasdiqlash, telefon bilan kirsa Telegram orqali".
//
// Bu test ikkita narsani qo'riqlaydi:
//
//   1) QOIDA: email xizmati YOQILGAN bo'lsa, kodsiz akkaunt ochib
//      bo'lmaydi. Kimdir kelajakda `emailOn` shartini noto'g'ri yozsa,
//      tasdiqlanmagan email bilan ro'yxatdan o'tish ochilib ketardi.
//
//   2) ZAXIRA: email xizmati O'CHIQ bo'lsa, ro'yxat TO'XTAMAYDI —
//      eski qoida bilan ishlaydi. Egasining aniq tanlovi shu edi:
//      Resend uzilgani butun saytni yangi mijozlar uchun yopib
//      qo'ymasin.
//
//   node scripts/test-auth-email-otp.mjs
import worker, { ensureCoreSchema } from '../hosting/worker.js';
import { makeEnv, seedBasic, req, makeChecker } from './lib/d1-harness.mjs';

const { check, checkTrue, done } = makeChecker();

// Resend kalitlari QO'YILGAN muhit — ya'ni email yoqilgan.
const { env, sqlite } = makeEnv({
  TELEGRAM_BOT_TOKEN: 'test-token',
  RESEND_API_KEY: 'test-resend-key',
  RESEND_FROM: 'NFCSTORE <no-reply@nfcstore.uz>',
});
await ensureCoreSchema(env);
await seedBasic(env);

// Tashqi chaqiruvlar ushlanadi — tarmoqqa chiqilmaydi.
const mails = [];
const tgSends = [];
let mailStatus = 200;
globalThis.fetch = async (input, init) => {
  const u = String(input);
  if (u.startsWith('https://api.resend.com/')) {
    mails.push(JSON.parse(init.body));
    return new Response(JSON.stringify(mailStatus === 200 ? { id: 'msg_1' } : { message: 'nope' }),
      { status: mailStatus, headers: { 'content-type': 'application/json' } });
  }
  if (u.startsWith('https://api.telegram.org/')) {
    tgSends.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ ok: true, result: {} }), { headers: { 'content-type': 'application/json' } });
  }
  throw new Error('unexpected fetch ' + u);
};

const post = (path, json, init = {}) => worker.fetch(req(path, { method: 'POST', json, ...init }), env);
// Test ichida o'nlab so'rov yuboriladi va IP bo'yicha cheklovlar
// (ro'yxat 5/soat, kirish 10/15daq) tekshirmoqchi bo'lgan narsamizdan
// OLDIN ishga tushib ketadi. Shuning uchun qadamlar orasida tozalanadi
// — cheklovning O'ZI 4-bo'limda alohida tekshiriladi.
const clearLimits = () => { try { sqlite.prepare('DELETE FROM rate_limits').run(); } catch { /* jadval hali yo'q */ } };
// Xatdagi 6 xonali kod — HTML ichidan.
const lastMailCode = () => (String(mails[mails.length - 1]?.html || '').match(/>(\d{6})</) || [])[1];

// ===== 1) Ro'yxatdan o'tish: kod EMAILGA ketadi =====
{
  const res = await post('/api/auth/request-register-code', { email: 'yangi@example.com' });
  const body = await res.json();
  check('1) email kanali tanlandi', [res.status, body], [200, { ok: true, channel: 'email' }]);
  check('1) xat yuborildi', mails.length, 1);
  check('1) manzil to‘g‘ri', [].concat(mails[0].to), ['yangi@example.com']);
  checkTrue('1) mavzuda kod bor', /\d{6}/.test(mails[0].subject || ''));
  checkTrue('1) xatda 6 xonali kod bor', /^\d{6}$/.test(lastMailCode() || ''));
  // Telegram UMUMAN chaqirilmasligi kerak — email asosiy kanal.
  check('1) telegram chaqirilmadi', tgSends.length, 0);

  const row = sqlite.prepare(
    `SELECT email, purpose, used, length(code) AS len FROM email_otp_codes ORDER BY id DESC LIMIT 1`).get();
  // Kod HASH bo'lib saqlanadi (64 belgi = sha256 hex): D1 backup sizib
  // chiqsa ham xom kod chiqmaydi.
  check('1) qator saqlandi, kod hashlangan', row, { email: 'yangi@example.com', purpose: 'register', used: 0, len: 64 });
}

// ===== 2) Kodsiz / noto'g'ri kod bilan akkaunt ochib bo'lmaydi =====
{
  const base = { email: 'yangi@example.com', password: 'parol123', phone: '+998901112233', tosAccepted: true };

  let res = await post('/api/auth/register', base);
  check('2) kodsiz -> 422', [res.status, (await res.json()).error], [422, 'email_code_required']);

  res = await post('/api/auth/register', { ...base, emailCode: '000000' });
  check('2) noto‘g‘ri kod -> 422', [res.status, (await res.json()).error], [422, 'bad_email_code']);

  // Emailsiz ham o'tmasin: kod aynan emailga bog'langan.
  res = await post('/api/auth/register', { password: 'parol123', phone: '+998901112244', tosAccepted: true });
  check('2) emailsiz -> 422', [res.status, (await res.json()).error], [422, 'email_required']);

  const left = sqlite.prepare(`SELECT COUNT(*) AS n FROM users WHERE email = 'yangi@example.com'`).get();
  check('2) hech qanday akkaunt ochilmadi', left.n, 0);
}

// ===== 3) To'g'ri kod bilan — akkaunt ochiladi =====
{
  // Yuqoridagi urinishlar kodni kuydirgan (har kodga 1 urinish),
  // shuning uchun yangisini so'raymiz.
  await post('/api/auth/request-register-code', { email: 'yangi@example.com' });
  const code = lastMailCode();

  const res = await post('/api/auth/register', {
    email: 'yangi@example.com', password: 'parol123', phone: '+998901112233',
    tosAccepted: true, emailCode: code,
  });
  check('3) to‘g‘ri kod -> 201', res.status, 201);
  const row = sqlite.prepare(`SELECT email, phone FROM users WHERE email = 'yangi@example.com'`).get();
  // TELEFON ham saqlanadi — egasining talabi: "telefon nomer ham
  // yozilsin". U keyin sozlamalarda Telegram orqali tasdiqlanadi.
  check('3) email va telefon saqlandi', row, { email: 'yangi@example.com', phone: '+998901112233' });

  // Kod ISHLATILGAN deb belgilanishi shart — qayta ishlatib bo'lmasin.
  const used = sqlite.prepare(
    `SELECT used FROM email_otp_codes WHERE email = 'yangi@example.com' ORDER BY id DESC LIMIT 1`).get();
  check('3) kod kuydirildi', used.used, 1);
}

// ===== 4) Tezlik cheklovi: bitta manzilga 10 daqiqada 3 ta kod =====
{
  const before = mails.length;
  await post('/api/auth/request-register-code', { email: 'limit@example.com' });
  await post('/api/auth/request-register-code', { email: 'limit@example.com' });
  await post('/api/auth/request-register-code', { email: 'limit@example.com' });
  const res = await post('/api/auth/request-register-code', { email: 'limit@example.com' });
  check('4) 4-chi so‘rov -> 429', [res.status, (await res.json()).error], [429, 'too_many_requests']);
  check('4) 4-chi xat yuborilmadi', mails.length - before, 3);
}

// ===== 5) Xat ketmasa — 503, kod "ketdi" deb aytilmaydi =====
{
  mailStatus = 500;
  const res = await post('/api/auth/request-register-code', { email: 'xato@example.com' });
  check('5) yuborilmasa -> 503', [res.status, (await res.json()).error], [503, 'email_send_failed']);
  mailStatus = 200;
}

// ===== 5b) JO'NATUVCHI manzili noto'g'ri bo'lsa =====
//
// Jonli muhitda aynan shu sodir bo'ldi: Windows PowerShell'da
// `wrangler secret put` ga yozilgan qiymat oxirida ko'rinmas `\r`
// qolgan edi. Qiymat ko'zga to'g'ri ko'rinardi, Resend esa butun
// so'rovni 400 bilan rad etardi va sabab noma'lum qolardi.
{
  const savedFrom = env.RESEND_FROM;
  const beforeMail = mails.length;

  // Ko'rinmas `\r` — TOZALANISHI va xat NORMAL ketishi kerak.
  env.RESEND_FROM = 'NFCSTORE <no-reply@nfcstore.uz>\r';
  clearLimits();
  let res = await post('/api/auth/request-register-code', { email: 'crlf@example.com' });
  check('5b) oxiridagi \\r tozalanadi -> 200', [res.status, (await res.json()).channel], [200, 'email']);
  check('5b) xat yuborildi', mails.length - beforeMail, 1);
  // Resend'ga TOZA qiymat ketishi shart.
  check('5b) resend toza qiymat oldi', mails[mails.length - 1].from, 'NFCSTORE <no-reply@nfcstore.uz>');

  // HAQIQATAN buzuq qiymat — so'rov Resend'ga UMUMAN yuborilmasin.
  env.RESEND_FROM = 'NFCSTORE no-reply@nfcstore.uz';
  const beforeBad = mails.length;
  clearLimits();
  res = await post('/api/auth/request-register-code', { email: 'badfrom@example.com' });
  const body = await res.json();
  check('5b) buzuq jo‘natuvchi -> 503 bad_from', [res.status, body.error, body.reason], [503, 'email_send_failed', 'bad_from']);
  check('5b) bekorga so‘rov yuborilmadi', mails.length - beforeBad, 0);

  env.RESEND_FROM = savedFrom;
}

// ===== 6) ZAXIRA: email xizmati O'CHIQ bo'lsa ro'yxat to'xtamaydi =====
//
// Egasining aniq tanlovi. Alohida muhit: RESEND kalitlari YO'Q.
{
  // ALOHIDA muhit ochilmaydi: `ensureCoreSchema` modul darajasida bir
  // marta ishlaydi, ya'ni yangi muhit runtime jadvallarini
  // (admin_sessions, rate_limits) umuman olmaydi. Shuning uchun SHU
  // muhitdan kalitlarni vaqtincha olib turamiz — xizmat uzilganini
  // aynan shunday taqlid qilamiz.
  const savedKey = env.RESEND_API_KEY;
  const savedFrom = env.RESEND_FROM;
  delete env.RESEND_API_KEY;
  delete env.RESEND_FROM;
  const postOff = (path, json) => worker.fetch(req(path, { method: 'POST', json }), env);

  let res = await postOff('/api/auth/request-register-code', { email: 'kimdir@example.com' });
  // "none" — kod kerak emas, frontend qadamni o'tkazib yuboradi.
  // Telegram yo'liga TUSHMASLIGI kerak: botni ulamagan odamga
  // "phone_not_verified" degan chalkash xato chiqardi.
  check('6) xizmat o‘chiq -> channel:none', [res.status, await res.json()], [200, { ok: true, channel: 'none' }]);
  check('6) xat yuborilmadi', mails.length, mails.length);

  clearLimits();
  res = await postOff('/api/auth/register', {
    email: 'kimdir@example.com', password: 'parol123', phone: '+998905556677', tosAccepted: true,
  });
  check('6) kodsiz ham ro‘yxat ishlaydi -> 201', res.status, 201);

  // Emailsiz ham (eski qoida: email ixtiyoriy) ishlashi kerak.
  clearLimits();
  res = await postOff('/api/auth/register', { password: 'parol123', phone: '+998905556688', tosAccepted: true });
  check('6) emailsiz ham ishlaydi -> 201', res.status, 201);

  env.RESEND_API_KEY = savedKey;
  env.RESEND_FROM = savedFrom;
}

// ===== 7) Sozlamalar: kanal akkauntga qarab tanlanadi =====
{
  clearLimits();
  // Haqiqiy emaili bor odam -> EMAIL kanali.
  const before = mails.length;
  const session = await post('/api/auth/login', { email: 'yangi@example.com', password: 'parol123' });
  const setCookie = session.headers.get('set-cookie') || '';
  const token = (setCookie.match(/nfc_session=([^;]+)/) || [])[1];
  checkTrue('7) kirish ishladi', !!token);

  const res = await worker.fetch(req('/api/settings/request-password-code', {
    method: 'POST', json: {}, cookie: `nfc_session=${token}`,
  }), env);
  check('7) haqiqiy email -> email kanali', [res.status, await res.json()], [200, { ok: true, channel: 'email' }]);
  check('7) xat yuborildi', mails.length - before, 1);
  check('7) parol kodi xati o‘sha manzilga', [].concat(mails[mails.length - 1].to), ['yangi@example.com']);
  checkTrue('7) xatda 6 xonali kod bor', /^\d{6}$/.test(lastMailCode() || ''));

  // Kod BAZADA xom holda — bu jadval avvaldan shunday ishlaydi
  // (`change-password` uni xom solishtiradi). Shu kod bilan parol
  // almashishi kerak.
  const code = sqlite.prepare(
    `SELECT code FROM password_reset_codes ORDER BY id DESC LIMIT 1`).get().code;
  const ch = await worker.fetch(req('/api/settings/change-password', {
    method: 'POST', json: { code, newPassword: 'yangiparol1' }, cookie: `nfc_session=${token}`,
  }), env);
  check('7) emaildagi kod bilan parol almashdi', ch.status, 200);
  const again = await post('/api/auth/login', { email: 'yangi@example.com', password: 'yangiparol1' });
  check('7) yangi parol ishlaydi', again.status, 200);
}

// ===== 8) Sozlamalar: emaili YO'Q odam -> Telegram kanali =====
{
  // Raqam bilan ro'yxatdan o'tgan odamning emaili ko'rinmas (ichki)
  // manzil — unga xat yuborilmasligi SHART, aks holda Resend'da
  // "bounce" bo'lib domen obro'si tushadi.
  clearLimits();
  await post('/api/auth/request-register-code', { email: 'tg@example.com' });
  const code = lastMailCode();
  await post('/api/auth/register', {
    email: 'tg@example.com', password: 'parol123', phone: '+998907778899', tosAccepted: true, emailCode: code,
  });
  // Telefonni ko'rinmas manzilga aylantiramiz (raqam bilan
  // ro'yxatdan o'tgan eski foydalanuvchini taqlid qilamiz).
  sqlite.prepare(`UPDATE users SET email = 'p998907778899@nfcstore.local' WHERE phone = '+998907778899'`).run();
  sqlite.prepare(`INSERT INTO bot_verifications (phone, tg_user_id, tg_name) VALUES ('+998907778899', 777009, 'Vali')`).run();

  clearLimits();
  const session = await post('/api/auth/login', { email: '+998907778899', password: 'parol123' });
  const token = ((session.headers.get('set-cookie') || '').match(/nfc_session=([^;]+)/) || [])[1];
  checkTrue('8) telefon bilan kirish ishladi', !!token);

  const beforeMail = mails.length;
  const beforeTg = tgSends.length;
  const res = await worker.fetch(req('/api/settings/request-password-code', {
    method: 'POST', json: {}, cookie: `nfc_session=${token}`,
  }), env);
  check('8) ko‘rinmas email -> telegram kanali', [res.status, await res.json()], [200, { ok: true, channel: 'telegram' }]);
  check('8) ko‘rinmas manzilga xat YUBORILMADI', mails.length - beforeMail, 0);
  check('8) telegram ishlatildi', tgSends.length - beforeTg, 1);
  check('8) kod egasining chatiga ketdi', tgSends[tgSends.length - 1].chat_id, 777009);
}

done();
