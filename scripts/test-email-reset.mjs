// Email orqali parol tiklash — hosting/api/auth.js + Resend integratsiyasi.
//
// Nima uchun bu test bor: parolni tiklash — hisobni egallab olishning
// eng qisqa yo'li. Shu sabab quyidagilar QULFLANADI:
//   - akkaunt borligi oshkor qilinmasligi (javob har doim bir xil);
//   - token bir martalik va muddatli ekani;
//   - parol o'zgargach boshqa qurilmalardagi sessiyalar yopilishi;
//   - kalit qo'yilmaguncha hech narsa yuborilmasligi.
//
//   node scripts/test-email-reset.mjs
import worker, { ensureCoreSchema, sendEmailD1, emailEnabledD1 } from '../hosting/worker.js';
import { makeEnv, seedBasic, req, makeChecker, sha256Hex } from './lib/d1-harness.mjs';

const { check, checkTrue, done } = makeChecker();

// Resend'ga haqiqiy so'rov YUBORILMAYDI — fetch almashtiriladi.
const sent = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input?.url;
  if (String(url).includes('api.resend.com')) {
    sent.push({ auth: init?.headers?.authorization, body: JSON.parse(init.body) });
    return new Response(JSON.stringify({ id: 'test' }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  return realFetch(input, init);
};

const { env } = makeEnv({ RESEND_API_KEY: 'test_key', RESEND_FROM: 'NFCSTORE <no-reply@nfcstore.uz>' });
await ensureCoreSchema(env);
await seedBasic(env);

const call = async (p, json, ip = '203.0.113.9') => {
  const r = await worker.fetch(req(p, { method: 'POST', json, ip }), env);
  return { status: r.status, body: await r.json().catch(() => null) };
};

// ── 1) Akkaunt borligi OSHKOR QILINMAYDI ──────────────────────────────
const known = await call('/api/auth/request-email-reset', { email: 'user@test.local' });
const unknown = await call('/api/auth/request-email-reset', { email: 'yoq@test.local' }, '203.0.113.10');
check('1) mavjud manzil -> ok', [known.status, known.body], [200, { ok: true }]);
check('1) mavjud emas -> AYNAN shu javob', [unknown.status, unknown.body], [200, { ok: true }]);
check('1) xat faqat mavjud manzilga ketdi', sent.length, 1);
check('1) xat to‘g‘ri manzilga', sent[0]?.body?.to, ['user@test.local']);
checkTrue('1) kalit sarlavhada', sent[0]?.auth === 'Bearer test_key');

// Havoladagi token
const link = /https?:\/\/[^\s"']*\/login\?reset=([A-Za-z0-9_-]+)/.exec(sent[0]?.body?.html || '');
checkTrue('1) xatda tiklash havolasi bor', !!link);
const token = link ? link[1] : '';

// ── 2) Token BAZADA XESHLANGAN holda turadi ───────────────────────────
{
  const rows = await env.DB.prepare('SELECT token, user_id FROM email_reset_tokens').all();
  check('2) bitta token yozildi', (rows.results || []).length, 1);
  checkTrue('2) ochiq matnda saqlanmagan', (rows.results || [])[0]?.token !== token);
  check('2) xeshi mos', (rows.results || [])[0]?.token, await sha256Hex(token));
}

// ── 3) Parol almashadi, boshqa sessiyalar yopiladi ────────────────────
await env.DB.prepare(`INSERT INTO sessions (token, user_id, expires_at) VALUES ('other-device', 1, '2999-01-01T00:00:00.000Z')`).run();
const before = await env.DB.prepare('SELECT password_hash FROM users WHERE id = 1').first();
const ok = await call('/api/auth/reset-password', { emailToken: token, password: 'yangiparol123' });
check('3) 200 ok', [ok.status, ok.body], [200, { ok: true }]);
const after = await env.DB.prepare('SELECT password_hash FROM users WHERE id = 1').first();
checkTrue('3) parol o‘zgardi', before.password_hash !== after.password_hash);
const left = await env.DB.prepare(`SELECT COUNT(*) AS n FROM sessions WHERE user_id = 1`).first();
check('3) boshqa qurilmalardagi sessiyalar yopildi', Number(left.n), 0);

// ── 4) Token BIR MARTALIK ─────────────────────────────────────────────
const again = await call('/api/auth/reset-password', { emailToken: token, password: 'boshqaparol1' });
check('4) ikkinchi marta ishlamaydi', [again.status, again.body?.error], [422, 'link_expired']);

// ── 5) MUDDATI O'TGAN token ishlamaydi ────────────────────────────────
{
  const stale = 'stale-token-value-123456';
  await env.DB.prepare(`INSERT INTO email_reset_tokens (token, user_id, expires_at, created_at) VALUES (?, 1, ?, ?)`)
    .bind(await sha256Hex(stale), new Date(Date.now() - 60_000).toISOString(), new Date().toISOString()).run();
  const r = await call('/api/auth/reset-password', { emailToken: stale, password: 'yanaparol12' });
  check('5) muddati o‘tgan token rad etiladi', [r.status, r.body?.error], [422, 'link_expired']);
  const rows = await env.DB.prepare(`SELECT COUNT(*) AS n FROM email_reset_tokens`).first();
  check('5) ...va baribir kuydiriladi', Number(rows.n), 0);
}

// ── 6) O'YLAB TOPILGAN token ishlamaydi ───────────────────────────────
const fake = await call('/api/auth/reset-password', { emailToken: 'aaaaaaaaaaaaaaaaaaaaaaaa', password: 'parol12345' });
check('6) soxta token rad etiladi', [fake.status, fake.body?.error], [422, 'link_expired']);

// ── 7) Qisqa parol qabul qilinmaydi ───────────────────────────────────
const short = await call('/api/auth/reset-password', { emailToken: 'x'.repeat(24), password: '123' });
check('7) qisqa parol rad etiladi', short.status, 422);

// ── 8) Placeholder email (raqam bilan ro'yxatdan o'tganlar) ───────────
// Ularda haqiqiy pochta yo'q — bu yo'l umuman ochilmasligi kerak.
{
  const n = sent.length;
  await env.DB.prepare(`INSERT INTO users (id, email, password_hash, phone) VALUES (9, 'p998901234567@nfcstore.local', 'x', '+998901234567')`).run();
  const r = await call('/api/auth/request-email-reset', { email: 'p998901234567@nfcstore.local' }, '203.0.113.11');
  check('8) javob baribir bir xil', [r.status, r.body], [200, { ok: true }]);
  check('8) xat YUBORILMAYDI', sent.length, n);
}

// ── 9) Kalit qo'yilmagan bo'lsa hech narsa yuborilmaydi ───────────────
{
  // Yangi env YARATILMAYDI: ensureCoreSchema modul darajasida bir marta
  // keshlanadi, shuning uchun ikkinchi bazada runtime jadvallari
  // ochilmasdi. O'sha bazaning O'ZI, faqat kalitlarsiz.
  const off = { ...env, RESEND_API_KEY: undefined, RESEND_FROM: undefined };
  checkTrue('9) email o‘chiq', !emailEnabledD1(off));
  const n = sent.length;
  const r = await worker.fetch(req('/api/auth/request-email-reset', { method: 'POST', json: { email: 'user@test.local' }, ip: '203.0.113.12' }), off);
  check('9) javob baribir ok (sabab oshkor qilinmaydi)', [r.status, await r.json()], [200, { ok: true }]);
  check('9) xat yuborilmadi', sent.length, n);
  const res = await sendEmailD1(off, { to: 'a@b.uz', subject: 's', html: 'h' });
  check('9) sendEmail -> disabled', res, { ok: false, reason: 'disabled' });
}

done();
