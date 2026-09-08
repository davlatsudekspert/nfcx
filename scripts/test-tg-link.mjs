// Telegram bilan BIR BOSISHDA bog'lanish (2026-09).
//
// Nega bu oqim yozildi: avval bot 6 xonali kod yuborardi va odam uni
// SAYTGA KO'CHIRARDI. Bu firibgarlik sxemasining aynan ko'rinishi —
// odamlarga "Telegramga kelgan kodni hech kimga bermang" deb to'g'ri
// o'rgatilgan, biz esa xuddi shuni so'rar edik va odamlar qo'rqardi.
//
// Endi yo'nalish teskari: sayt token beradi, odam botda bitta tugma
// bosadi, sayt o'zi davom etadi. Test shu oqimning HIMOYALARINI
// qo'riqlaydi:
//
//   1. token bazada XESH holida yotadi (o'g'irlangan baza tayyor
//      havola bermasin);
//   2. raqam FORMDAN emas, TELEGRAMDAN olinadi — birov boshqa odamning
//      raqami bilan ro'yxatdan o'ta olmaydi;
//   3. token BIR MARTALIK va muddatli;
//   4. parol tiklashda token akkauntdagi raqamga MOS kelishi shart.
//
//   node scripts/test-tg-link.mjs
import worker, { ensureCoreSchema } from '../hosting/worker.js';
import { makeEnv, seedBasic, req, sha256Hex, makeChecker } from './lib/d1-harness.mjs';

const { check, checkTrue, done } = makeChecker();
const { env, sqlite } = makeEnv({ TELEGRAM_BOT_TOKEN: 'test-token', TELEGRAM_BOT_USERNAME: 'nfcsalebot', TELEGRAM_WEBHOOK_SECRET: 'hook-secret' });
await ensureCoreSchema(env);
await seedBasic(env);

globalThis.fetch = async (input, init) => {
  if (String(input).startsWith('https://api.telegram.org/')) {
    return new Response(JSON.stringify({ ok: true, result: {} }), { headers: { 'content-type': 'application/json' } });
  }
  throw new Error('unexpected fetch ' + input);
};

const post = (path, json, init = {}) => worker.fetch(req(path, { method: 'POST', json, ...init }), env);
const get = (path) => worker.fetch(req(path), env);
const jsonOf = async (res) => ({ status: res.status, body: await res.json().catch(() => null) });

// Telegram Update — bot webhook'iga.
const update = (msg) => worker.fetch(req('/api/telegram/webhook', {
  method: 'POST', json: { message: msg }, headers: { 'x-telegram-bot-api-secret-token': 'hook-secret' },
}), env);

const startToken = async () => (await jsonOf(await post('/api/auth/tg-link/start', {}))).body.token;

// ── 1) Token yaratish ──────────────────────────────────────────────────
{
  const r = await jsonOf(await post('/api/auth/tg-link/start', {}));
  check('1) token beriladi', r.status, 200);
  checkTrue('1b) token 32 hex', /^[0-9a-f]{32}$/.test(r.body.token || ''));
  check('1c) havola bot nomiga ishora qiladi', r.body.url, `https://t.me/nfcsalebot?start=${r.body.token}`);

  // Bazada TOKENNING O'ZI emas, xeshi yotadi.
  const row = sqlite.prepare(`SELECT token, status, phone FROM tg_link_tokens ORDER BY created_at DESC LIMIT 1`).get();
  check('1d) bazada xesh, ochiq token emas', row.token, sha256Hex(r.body.token));
  check('1e) boshlang\'ich holat: kutilmoqda, raqam yo\'q', [row.status, row.phone], ['pending', null]);

  const st = await jsonOf(await get(`/api/auth/tg-link/status?token=${r.body.token}`));
  check('1f) holat: pending', st.body, { status: 'pending' });
}

// ── 2) Botdagi bitta tugma — tasdiqlash ────────────────────────────────
{
  const token = await startToken();
  await update({ chat: { id: 501 }, from: { id: 501 }, text: `/start ${token}` });
  check('2) /start dan keyin hali pending', (await jsonOf(await get(`/api/auth/tg-link/status?token=${token}`))).body.status, 'pending');

  // "Kontaktni ulashish" — raqamni TELEGRAM tasdiqlaydi.
  await update({ chat: { id: 501 }, from: { id: 501 }, contact: { user_id: 501, phone_number: '998905550001', first_name: 'Aziz' } });
  const st = await jsonOf(await get(`/api/auth/tg-link/status?token=${token}`));
  check('2b) tasdiqlangach status linked + raqam', st.body, { status: 'linked', phone: '+998905550001' });
}

// ── 3) BOSHQA odamning kontakti tokenni tasdiqlamaydi ──────────────────
// Bot faqat yuboruvchining O'Z kontaktini qabul qiladi; aks holda
// birov do'stining kontaktini yuborib, uning raqamiga akkaunt ochardi.
{
  const token = await startToken();
  await update({ chat: { id: 502 }, from: { id: 502 }, text: `/start ${token}` });
  await update({ chat: { id: 502 }, from: { id: 502 }, contact: { user_id: 999, phone_number: '998905559999', first_name: 'Begona' } });
  check('3) begona kontakt -> hali pending', (await jsonOf(await get(`/api/auth/tg-link/status?token=${token}`))).body.status, 'pending');
}

// ── 4) Ro'yxatdan o'tish: raqam TOKENDAN olinadi ───────────────────────
{
  const token = await startToken();
  await update({ chat: { id: 503 }, from: { id: 503 }, text: `/start ${token}` });
  await update({ chat: { id: 503 }, from: { id: 503 }, contact: { user_id: 503, phone_number: '998905550003', first_name: 'Dilnoza' } });

  // Mijoz boshqa raqam yozib yuborsa — rad etiladi.
  const bad = await jsonOf(await post('/api/auth/register', {
    email: 'x1@test.local', password: 'parol123', phone: '+998905550009', tosAccepted: true, linkToken: token,
  }));
  check('4) formadagi raqam tokendagidan farq qilsa -> rad', [bad.status, bad.body.error], [422, 'link_phone_mismatch']);

  const ok = await jsonOf(await post('/api/auth/register', {
    email: 'x1@test.local', password: 'parol123', phone: '+998905550003', tosAccepted: true, linkToken: token,
  }));
  check('4b) to\'g\'ri raqam bilan akkaunt yaratildi', ok.status, 201);
  const u = sqlite.prepare(`SELECT phone, bot_ack, tos_accepted FROM users WHERE email = 'x1@test.local'`).get();
  check('4c) raqam saqlandi', u, { phone: '+998905550003', bot_ack: 1, tos_accepted: 1 });

  // Token BIR MARTALIK.
  const again = await jsonOf(await post('/api/auth/register', {
    email: 'x2@test.local', password: 'parol123', phone: '+998905550003', tosAccepted: true, linkToken: token,
  }));
  check('4d) o\'sha token ikkinchi marta ishlamaydi', [again.status, again.body.error], [422, 'link_not_confirmed']);
  check('4e) ikkinchi akkaunt yaratilmadi', sqlite.prepare(`SELECT COUNT(*) AS n FROM users WHERE email = 'x2@test.local'`).get().n, 0);
}

// ── 5) Tasdiqlanmagan / soxta / eskirgan token ─────────────────────────
{
  const fresh = await startToken();   // botga umuman borilmagan
  const r = await jsonOf(await post('/api/auth/register', {
    email: 'x3@test.local', password: 'parol123', phone: '+998905550003', tosAccepted: true, linkToken: fresh,
  }));
  check('5) tasdiqlanmagan token -> rad', [r.status, r.body.error], [422, 'link_not_confirmed']);

  for (const fake of ['0'.repeat(32), 'zzzz', '']) {
    const rr = await jsonOf(await post('/api/auth/register', {
      email: 'x4@test.local', password: 'parol123', phone: '+998905550003', tosAccepted: true, linkToken: fake,
    }));
    // Bo'sh token — eski (kodli) yo'lga tushadi, u ham kodsiz o'tmaydi.
    checkTrue(`5b) soxta token o'tmaydi: ${JSON.stringify(fake)}`, rr.status !== 201);
  }

  // Muddati o'tgan token.
  const stale = await startToken();
  sqlite.prepare(`UPDATE tg_link_tokens SET status = 'linked', phone = '+998905550003', expires_at = 1 WHERE token = ?`).run(sha256Hex(stale));
  const st = await jsonOf(await get(`/api/auth/tg-link/status?token=${stale}`));
  check('5c) eskirgan token holati: expired', st.body, { status: 'expired' });
}

// ── 6) Parolni tiklash — kodsiz ────────────────────────────────────────
{
  const userPhone = '+998901111111'; // seedBasic: user#1
  const token = await startToken();
  await update({ chat: { id: 601 }, from: { id: 601 }, text: `/start ${token}` });
  await update({ chat: { id: 601 }, from: { id: 601 }, contact: { user_id: 601, phone_number: userPhone.slice(1), first_name: 'Ega' } });

  // Boshqa odamning akkauntiga tegib bo'lmaydi: raqam mos kelmasa rad.
  const wrong = await jsonOf(await post('/api/auth/reset-password', {
    email: 'other@test.local', password: 'yangiparol', linkToken: token,
  }));
  check('6) begona akkaunt -> rad', [wrong.status, wrong.body.error], [422, 'link_phone_mismatch']);

  const before = sqlite.prepare(`SELECT password_hash FROM users WHERE id = 1`).get().password_hash;
  const ok = await jsonOf(await post('/api/auth/reset-password', {
    email: 'user@test.local', password: 'yangiparol', linkToken: token,
  }));
  check('6b) o\'z akkauntida parol yangilandi', [ok.status, ok.body], [200, { ok: true }]);
  checkTrue('6c) parol xeshi haqiqatan o\'zgardi',
    sqlite.prepare(`SELECT password_hash FROM users WHERE id = 1`).get().password_hash !== before);
  check('6d) barcha sessiyalar bekor qilindi',
    sqlite.prepare(`SELECT COUNT(*) AS n FROM sessions WHERE user_id = 1`).get().n, 0);

  const reuse = await jsonOf(await post('/api/auth/reset-password', {
    email: 'user@test.local', password: 'boshqaparol', linkToken: token,
  }));
  check('6e) token qayta ishlatilmaydi', [reuse.status, reuse.body.error], [422, 'link_not_confirmed']);
}

// ── 7) Kabinet: "Profilingizni himoyalang" va parol almashtirish ───────
// Ro'yxatdan o'tishda Telegram endi so'ralmaydi, shuning uchun ikkita
// narsa ISHLASHI shart bo'lib qoldi:
//   a) botni ULAMAGAN odam ham parolini o'zgartira olsin (aks holda u
//      qamalib qoladi);
//   b) botni keyin ulaganda akkauntga to'g'ri biriktirilsin.
{
  const raw = (path, init) => worker.fetch(req(path, init), env);
  const call = async (path, json, init = {}) => {
    const r = await raw(path, { method: 'POST', json, ...init });
    return { status: r.status, body: await r.json().catch(() => null) };
  };
  const reg = await call('/api/auth/register', {
    password: 'birinchi123', phone: '+998905551212', tosAccepted: true, email: 'settings@test.local',
  });
  check('7) yangi akkaunt (Telegramsiz)', reg.status, 201);
  const cookieHdr = 'nfc_session=' + (await (async () => {
    const r = await raw('/api/auth/login', { method: 'POST', json: { email: '+998905551212', password: 'birinchi123' } });
    return (r.headers.get('set-cookie') || '').match(/nfc_session=([0-9a-f]+)/)[1];
  })());

  // a) Joriy parol bilan almashtirish — Telegram TALAB QILINMAYDI.
  let r = await call('/api/settings/change-password-direct', { currentPassword: 'xato', newPassword: 'ikkinchi123' }, { cookie: cookieHdr });
  check('7a) joriy parol xato -> 401', [r.status, r.body.error], [401, 'bad_current_password']);
  r = await call('/api/settings/change-password-direct', { currentPassword: 'birinchi123', newPassword: '123' }, { cookie: cookieHdr });
  check('7b) qisqa yangi parol -> 422', [r.status, r.body.error], [422, 'weak_password']);
  r = await call('/api/settings/change-password-direct', { currentPassword: 'birinchi123', newPassword: 'ikkinchi123' }, { cookie: cookieHdr });
  check('7c) Telegramsiz ham parol almashadi', [r.status, r.body], [200, { ok: true }]);
  r = await call('/api/auth/login', { email: '+998905551212', password: 'ikkinchi123' });
  check('7d) yangi parol bilan kirish ishlaydi', r.status, 200);
  r = await call('/api/auth/login', { email: '+998905551212', password: 'birinchi123' });
  check('7e) eski parol endi ishlamaydi', r.status, 401);

  // Sessiya SAQLANADI: odam parolini almashtirgani uchun o'zi tizimdan
  // chiqib qolmasin (boshqa qurilmalardagi sessiyalar esa yopiladi).
  const me = await (await raw('/api/auth/me', { cookie: cookieHdr })).json();
  check('7f) o\'z sessiyasi ochiq qoladi', typeof me.user?.id, 'number');
  check('7g) Telegram hali ulanmagan', me.user?.telegramLinked, false);

  // b) Telegramni keyin ulash.
  const token = await startToken();
  await update({ chat: { id: 701 }, from: { id: 701 }, text: `/start ${token}` });
  await update({ chat: { id: 701 }, from: { id: 701 }, contact: { user_id: 701, phone_number: '998905551212', first_name: 'Ega' } });
  r = await call('/api/settings/link-telegram', { linkToken: token }, { cookie: cookieHdr });
  check('7h) Telegram akkauntga ulandi', [r.status, r.body.phone], [200, '+998905551212']);
  const me2 = await (await raw('/api/auth/me', { cookie: cookieHdr })).json();
  check('7i) endi telegramLinked = true', me2.user?.telegramLinked, true);

  r = await call('/api/settings/link-telegram', { linkToken: token }, { cookie: cookieHdr });
  check('7j) token bir martalik', r.status === 200, false);

  // Sessiyasiz ikkala endpoint ham yopiq.
  r = await call('/api/settings/change-password-direct', { currentPassword: 'x', newPassword: 'yangi123' });
  check('7k) sessiyasiz parol almashtirib bo\'lmaydi', r.status, 401);
  r = await call('/api/settings/link-telegram', { linkToken: '0'.repeat(32) });
  check('7l) sessiyasiz Telegram ulab bo\'lmaydi', r.status, 401);
}

done();
