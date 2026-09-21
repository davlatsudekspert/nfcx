// ILOVANING RO'YXATDAN O'TISH SO'ROVI SERVERGA MOS KELADIMI.
//
// ═══ NIMA UCHUN BU FAYL BOR ═══
//
// Ilova `POST /api/auth/register` ga kodni `code` nomi bilan
// yuborardi. Server esa `emailCode` ni o'qiydi:
//
//     const emailCode = H.cleanStr(body?.emailCode, 6);
//     if (!emailCode) return H.json({ error: 'email_code_required' }, 422);
//
// Xato BIR HAFTA KO'RINMADI, chunki email xizmati o'chiq edi va
// server bu blokni umuman bajarmasdi (`if (emailOn)`). Xizmat
// yoqilgan kuni ro'yxatdan o'tish darhol yiqildi: odam emailga
// kelgan TO'G'RI kodni kiritardi, server esa "kod umuman
// yuborilmagan" deb javob berardi. Ekranda esa umumiy
// "Nimadir noto'g'ri ketdi" chiqardi.
//
// ═══ QANDAY TEKSHIRADI ═══
//
// Kalitlar ro'yxati QO'LDA YOZILMAGAN — u Dart manbasidan o'qiladi.
// Ya'ni ilovada kalit nomi o'zgarsa, bu test o'zgarishni ko'radi va
// HAQIQIY worker.js ga yuborib, natijani tekshiradi.
//
//   node scripts/test-nova-register-payload.mjs

import { readFileSync } from 'node:fs';
import worker, { ensureCoreSchema } from '../hosting/worker.js';
import { makeEnv, seedBasic, req, makeChecker } from './lib/d1-harness.mjs';

const { check, checkTrue, done } = makeChecker();

// ── 1. ILOVA QANDAY TANA YUBORADI — MANBADAN ──────────────────────
const dart = readFileSync(
  new URL('../mobile_nova/lib/data/repositories/auth_repository.dart', import.meta.url),
  'utf8',
);
const start = dart.indexOf("postSession('/api/auth/register'");
if (start < 0) throw new Error('auth_repository.dart da register so\'rovi topilmadi');
const body = dart.slice(start, dart.indexOf('});', start));
// `'kalit': qiymat` — izohlar oralab ketsa ham naqsh ishlaydi.
const keys = [...body.matchAll(/'([A-Za-z][A-Za-z0-9_]*)':/g)].map((m) => m[1]);

check('1) ilova kodni `emailCode` deb yuboradi',
  keys.includes('emailCode'), true);
check('1) eski `code` nomi qolmagan', keys.includes('code'), false);
for (const k of ['name', 'email', 'phone', 'password', 'tosAccepted']) {
  checkTrue(`1) \`${k}\` yuboriladi`, keys.includes(k));
}

// ── 2. SERVER AYNAN SHU NOMNI O'QIYDIMI ───────────────────────────
const server = readFileSync(new URL('../hosting/api/auth.js', import.meta.url), 'utf8');
const readsKey = /const emailCode = H\.cleanStr\(body\?\.([A-Za-z0-9_]+)/.exec(server)?.[1];
check('2) server o‘qiydigan nom', readsKey, 'emailCode');
checkTrue('2) ilova va server bir xil nomni ishlatadi', keys.includes(readsKey));

// ── 3. HAQIQIY WORKER: ILOVANING TANASI BILAN RO'YXAT ─────────────
const { env } = makeEnv({
  RESEND_API_KEY: 'test-resend-key',
  RESEND_FROM: 'NFCSTORE <no-reply@nfcstore.uz>',
});
await ensureCoreSchema(env);
await seedBasic(env);

// Resend ushlanadi — tarmoqqa chiqilmaydi.
const mails = [];
globalThis.fetch = async (input, init) => {
  if (String(input).startsWith('https://api.resend.com/')) {
    mails.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ id: 'msg_1' }),
      { status: 200, headers: { 'content-type': 'application/json' } });
  }
  throw new Error('kutilmagan fetch ' + input);
};

const post = (path, json) => worker.fetch(req(path, { method: 'POST', json }), env);
const EMAIL = 'yangi@example.com';
const PHONE = '+998901234599';

let res = await post('/api/auth/request-register-code', { email: EMAIL });
check('3) kanal email', [res.status, (await res.json()).channel], [200, 'email']);
const code = (String(mails.at(-1)?.html || '').match(/>(\d{6})</) || [])[1];
checkTrue('3) xatda 6 xonali kod bor', /^\d{6}$/.test(code || ''));

// ILOVANING TANASI — kalitlar yuqorida manbadan o'qilgani bilan bir xil.
const appBody = {
  name: 'Sinov',
  email: EMAIL,
  phone: PHONE,
  password: 'parol123',
  emailCode: code,
  botAck: true,
  tosAccepted: true,
};
res = await post('/api/auth/register', appBody);
check('3) ilova tanasi bilan ro‘yxat -> 201', res.status, 201);

// ── 4. QOIDA YUMSHATILMAGANINI TEKSHIRAMIZ ────────────────────────
// Kodsiz, noto'g'ri kod va ISHLATILGAN kod — uchalasi ham rad etilsin
// va HECH QANDAY hisob yaratilmasin.
{
  const before = Number((await env.DB.prepare('SELECT COUNT(*) AS n FROM users').first()).n);

  let r = await post('/api/auth/register',
    { ...appBody, email: 'boshqa@example.com', phone: '+998901234588', emailCode: undefined });
  check('4) kodsiz -> 422 email_code_required',
    [r.status, (await r.json()).error], [422, 'email_code_required']);

  r = await post('/api/auth/register',
    { ...appBody, email: 'boshqa@example.com', phone: '+998901234588', emailCode: '000000' });
  check('4) noto‘g‘ri kod -> 422 bad_email_code',
    [r.status, (await r.json()).error], [422, 'bad_email_code']);

  // Bir martalik: o'sha kod ikkinchi marta o'tmaydi.
  r = await post('/api/auth/register',
    { ...appBody, email: EMAIL, phone: '+998901234577', emailCode: code });
  checkTrue('4) ishlatilgan kod qayta o‘tmaydi', r.status === 422 || r.status === 409);

  const after = Number((await env.DB.prepare('SELECT COUNT(*) AS n FROM users').first()).n);
  check('4) rad etilganlardan hisob YARATILMADI', after, before);
}

done();
