// GOOGLE PLAY TEKSHIRUVCHISI HISOBI.
//
// Egasi (2026-09-23): "o'zing bitta hisob ochib, test login parol qilib
// ber". Play Console ilovaga kirish uchun login/parol so'raydi; oddiy
// ro'yxatdan o'tish email KODINI so'raydi va tekshiruvchi pochtani ocha
// olmaydi. Admin tugmasi oldindan tasdiqlangan alohida hisob yaratadi.
//
// Chegaralar:
//   * faqat admin (mehmon va oddiy foydalanuvchi — 401);
//   * parol javobda bir marta; u bilan KODSIZ kirish mumkin;
//   * qayta bosilsa — yangi parol, eskisi ishlamaydi;
//   * NFC ID va Premium beriladi; jurnalga parol YOZILMAYDI.
//
//   node scripts/test-review-account.mjs

import worker from '../hosting/worker.js';
import { makeEnv, seedBasic, req, cookie, makeChecker } from './lib/d1-harness.mjs';

const { env } = makeEnv();
await seedBasic(env);
const { check, checkTrue, done } = makeChecker();

const call = async (path, init = {}) => {
  const res = await worker.fetch(req(path, init), env);
  return { status: res.status, body: await res.json().catch(() => null) };
};
const make = (who) => call('/api/admin/review-account', { method: 'POST', ...who });

check('1) mehmon — 401', (await make({})).status, 401);
check('1) oddiy foydalanuvchi — 401', (await make({ cookie: cookie.user })).status, 401);

let r = await make({ cookie: cookie.admin });
check('2) admin — 200', r.status, 200);
check('2) email', r.body.email, 'review@nfcstore.uz');
checkTrue('2) parol yetarlicha uzun', String(r.body.password || '').length >= 14);
checkTrue('2) NFC ID berildi', /^\d{8}$/.test(r.body.code));
const first = r.body.password;

let login = await call('/api/auth/login', { method: 'POST', json: { email: 'review@nfcstore.uz', password: first } });
check('3) parol bilan KODSIZ kirish', login.status, 200);

const u = await env.DB.prepare(`SELECT premium_expires_at, tos_accepted FROM users WHERE email = 'review@nfcstore.uz'`).first();
checkTrue('3) Premium muddati kelajakda', Date.parse(u.premium_expires_at) > Date.now() + 60 * 86400000);
check('3) shartlar qabul qilingan', u.tos_accepted, 1);

r = await make({ cookie: cookie.admin });
check('4) qayta bosish — yangi parol', [r.body.created, r.body.password !== first], [false, true]);
login = await call('/api/auth/login', { method: 'POST', json: { email: 'review@nfcstore.uz', password: first } });
check('4) eski parol ishlamaydi', login.status, 401);
login = await call('/api/auth/login', { method: 'POST', json: { email: 'review@nfcstore.uz', password: r.body.password } });
check('4) yangi parol ishlaydi', login.status, 200);
const cards = await env.DB.prepare(`SELECT COUNT(*) AS n FROM cards c JOIN users u ON u.id = c.user_id WHERE u.email = 'review@nfcstore.uz'`).first();
check('4) NFC ID takrorlanmadi', cards.n, 1);

const logs = await env.DB.prepare(`SELECT details FROM admin_activity`).all().catch(() => ({ results: [] }));
checkTrue('5) jurnalda parol yoq', !(logs.results || []).some((l) => String(l.details).includes(r.body.password)));

done();
