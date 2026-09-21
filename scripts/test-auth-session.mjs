// AUTH / SESSIYA — HAQIQIY WORKER VA HAQIQIY SQLITE USTIDA
//
// NIMA UCHUN AYNAN BU TEKSHIRILADI. Sessiya xatolari saytda eng
// og'riqli turdagi nosozlik: odam ishlab turib to'satdan tizimdan
// chiqib ketadi va nima bo'lganini tushunmaydi. Avval shunga yaqin
// hol bo'lgan: `/api/auth/me` anonim tashrifchiga XATO qaytarsa,
// frontend buni "sessiya tugadi" deb o'qib, saqlangan holatni
// tozalab yuborardi.
//
// Shuning uchun asosiy shart: ANONIM TASHRIFCHI — XATO EMAS.
// `/api/auth/me` 200 va `user: null` qaytarishi kerak; 401 emas.
//
// Bu test manba matnini o'qimaydi — haqiqiy `hosting/worker.js` ga
// so'rov yuboradi.
//
//   node scripts/test-auth-session.mjs
import worker from '../hosting/worker.js';
import { makeEnv, seedBasic, cookie, req, makeChecker } from './lib/d1-harness.mjs';

const { check, checkTrue, done } = makeChecker();
const { env } = makeEnv();
await seedBasic(env);

const call = async (path, init) => {
  const r = await worker.fetch(req(path, init), env);
  return { status: r.status, body: await r.json().catch(() => null), headers: r.headers };
};

// ── 1) ANONIM TASHRIFCHI ─────────────────────────────────────────────
// Eng muhim shart. Sayt ochiq — profil ko'rish uchun kirish shart emas.
{
  const r = await call('/api/auth/me');
  check('1) anonim /auth/me -> 200 (401 EMAS)', r.status, 200);
  check('1) user: null', r.body?.user, null);
  checkTrue('1) javob "xato" emas', !r.body?.error);
}

// ── 2) YAROQSIZ VA BUZUQ COOKIE ──────────────────────────────────────
// Buzuq cookie bilan kelgan odam ham "chiqib ketgan" holatga tushsin,
// lekin sayt YIQILMASIN.
{
  for (const [name, ck] of [
    ['yaroqsiz', 'session=buzuq-token'],
    ['bo‘sh', 'session='],
    ['boshqa cookie', 'other=1'],
    ['uzun axlat', `session=${'x'.repeat(400)}`],
  ]) {
    const r = await call('/api/auth/me', { headers: { cookie: ck } });
    check(`2) ${name} cookie -> 200`, r.status, 200);
    check(`2) ${name} cookie -> user null`, r.body?.user, null);
  }
}

// ── 3) TIZIMGA KIRGAN ODAM ───────────────────────────────────────────
{
  const r = await call('/api/auth/me', { headers: { cookie: cookie.user } });
  check('3) kirgan odam -> 200', r.status, 200);
  checkTrue('3) user obyekti bor', !!r.body?.user?.id);
  // Parol hech qachon qaytarilmaydi.
  const raw = JSON.stringify(r.body || {});
  checkTrue('3) javobda parol yo‘q', !/password|parol_hash|password_hash/i.test(raw));
}

// ── 4) HIMOYALANGAN YO'L — 401 VA 403 FARQI ──────────────────────────
// Bu ikkisi ARALASHTIRILMASLIGI kerak:
//   401 = kirmagansiz          -> kirish oynasi
//   403 = kirgansiz, lekin sizniki emas -> kirish oynasi EMAS
// Aralashsa, begona profilga urinish odamni tizimdan chiqarib
// yuborardi.
{
  const anon = await call('/api/records/VIP001/stories', { method: 'POST', json: { imageUrl: '/uploads/a.jpg', agreed: true } });
  check('4) kirmagan -> 401', anon.status, 401);
  check('4) sababi unauthorized', anon.body?.error, 'unauthorized');

  const foreign = await call('/api/records/VIP001/stories', {
    method: 'POST', json: { imageUrl: '/uploads/a.jpg', agreed: true }, headers: { cookie: cookie.other },
  });
  check('4) begona profil -> 403 (401 EMAS)', foreign.status, 403);
  check('4) sababi not_owner', foreign.body?.error, 'not_owner');
  checkTrue('4) 403 sessiyani tugatmaydi', foreign.body?.error !== 'unauthorized');

  // 403 dan keyin sessiya HAMON tirik bo'lishi shart.
  const after = await call('/api/auth/me', { headers: { cookie: cookie.other } });
  check('4) 403 dan keyin sessiya tirik', after.status, 200);
  checkTrue('4) 403 dan keyin user saqlanadi', !!after.body?.user?.id);
}

// ── 5) CHIQISH ───────────────────────────────────────────────────────
{
  const r = await call('/api/auth/logout', { method: 'POST', headers: { cookie: cookie.user } });
  checkTrue('5) logout javob beradi', r.status === 200 || r.status === 204, `status ${r.status}`);
  // Cookie o'chirilishi kerak (Max-Age=0 yoki o'tgan sana).
  const sc = r.headers.get('set-cookie') || '';
  checkTrue('5) cookie o‘chiriladi', /max-age=0|expires=/i.test(sc), sc.slice(0, 80));
}

// ── 6) OCHIQ MA'LUMOT KIRISHSIZ HAM OCHILADI ─────────────────────────
// Profil, story va postlar tashrifchiga ochiq — aks holda NFC kartani
// bosgan odam avval ro'yxatdan o'tishi kerak bo'lardi.
{
  for (const [name, path] of [
    ['profil', '/api/records/VIP001'],
    ['storylar', '/api/records/VIP001/stories'],
    ['postlar', '/api/records/VIP001/posts'],
  ]) {
    const r = await call(path);
    check(`6) ${name} kirishsiz ochiladi`, r.status, 200);
  }
}

// ── 7) YO'Q PROFIL — 404, SESSIYA XATOSI EMAS ────────────────────────
{
  const r = await call('/api/records/YOQ999');
  checkTrue('7) yo‘q profil -> 404 yoki 400', [400, 404].includes(r.status), `status ${r.status}`);
  checkTrue('7) bu sessiya xatosi emas', r.body?.error !== 'unauthorized');
}

done('Auth / sessiya');
