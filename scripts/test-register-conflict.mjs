// RO'YXATDA "BAND" XATOSI — KOD YUBORISHDAN OLDIN (egasi, 2026-09 surat).
//
// Tester emailiga kelgan kodni kiritdi va "Bu ma'lumot allaqachon band"
// degan tushunarsiz xatoni ko'rdi. Sabab: telefon raqami boshqa
// akkauntda edi, server buni faqat OXIRIDA — kod kiritilgandan keyin
// aytardi, kodni esa undan oldin yondirib qo'yardi.
//
// Bu test qo'riqlaydi:
//   1) band telefon/email -> kod SO'RASHDA darhol 409, xat ketmaydi;
//   2) register band telefonda kodni YONDIRMAYDI;
//   3) bo'sh telefon/email bilan oddiy yo'l o'zgarmagan.
//
//   node scripts/test-register-conflict.mjs
import worker, { ensureCoreSchema } from '../hosting/worker.js';
import { makeEnv, seedBasic, req, makeChecker } from './lib/d1-harness.mjs';

const { check, done } = makeChecker();

const { env, sqlite } = makeEnv({
  RESEND_API_KEY: 'test-resend-key',
  RESEND_FROM: 'NFCSTORE <no-reply@nfcstore.uz>',
});
await ensureCoreSchema(env);
await seedBasic(env); // user@test.local +998901111111, other@test.local +998902222222

const mails = [];
globalThis.fetch = async (input, init) => {
  const u = String(input);
  if (u.startsWith('https://api.resend.com/')) {
    mails.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ id: 'msg_1' }), { headers: { 'content-type': 'application/json' } });
  }
  throw new Error('unexpected fetch ' + u);
};
const post = (path, json) => worker.fetch(req(path, { method: 'POST', json }), env);
const clearLimits = () => { try { sqlite.prepare('DELETE FROM rate_limits').run(); } catch { /* yo'q */ } };
const lastMailCode = () => (String(mails[mails.length - 1]?.html || '').match(/>(\d{6})</) || [])[1];

// ===== 1) Kod so'rashda band telefon/email darhol aytiladi =====
{
  let res = await post('/api/auth/request-register-code', { email: 'yangi@example.com', phone: '+998 90 111 11 11' });
  check('1) band telefon -> 409 phone_taken', [res.status, (await res.json()).error], [409, 'phone_taken']);
  res = await post('/api/auth/request-register-code', { email: 'USER@test.local', phone: '+998905556677' });
  check('1) band email -> 409 email_taken', [res.status, (await res.json()).error], [409, 'email_taken']);
  check('1) hech qanday xat ketmadi', mails.length, 0);

  // O'chirilgan akkauntning raqami qayta ishlatilishi mumkin.
  sqlite.prepare(`UPDATE users SET deleted_at = CURRENT_TIMESTAMP WHERE id = 2`).run();
  res = await post('/api/auth/request-register-code', { email: 'yangi@example.com', phone: '+998902222222' });
  check('1) o‘chirilgan akkaunt raqami -> 200', res.status, 200);
  check('1) xat ketdi', mails.length, 1);
  sqlite.prepare(`UPDATE users SET deleted_at = NULL WHERE id = 2`).run();
}

// ===== 2) Register band telefonda kodni yondirmaydi =====
{
  clearLimits();
  await post('/api/auth/request-register-code', { email: 'ikki@example.com', phone: '+998903334455' });
  const code = lastMailCode();
  // Shu orada raqam boshqa odamga tegib qoldi (yoki eski ilova tekshiruvsiz yubordi).
  let res = await post('/api/auth/register', {
    email: 'ikki@example.com', password: 'parol123', phone: '+998901111111', tosAccepted: true, emailCode: code,
  });
  check('2) band telefon -> 409 phone_taken', [res.status, (await res.json()).error], [409, 'phone_taken']);
  const row = sqlite.prepare(`SELECT used FROM email_otp_codes WHERE email = 'ikki@example.com' ORDER BY id DESC LIMIT 1`).get();
  check('2) kod yondirilmadi', row.used, 0);

  // Raqamni to'g'rilab, O'SHA kod bilan davom etadi.
  res = await post('/api/auth/register', {
    email: 'ikki@example.com', password: 'parol123', phone: '+998903334455', tosAccepted: true, emailCode: code,
  });
  check('2) o‘sha kod bilan -> 201', res.status, 201);
}

// ===== 3) Band email: register ham aniq aytadi =====
{
  clearLimits();
  const res = await post('/api/auth/register', {
    email: 'ikki@example.com', password: 'parol123', phone: '+998907778899', tosAccepted: true, emailCode: '123456',
  });
  check('3) band email -> 409 email_taken', [res.status, (await res.json()).error], [409, 'email_taken']);
}

done();
