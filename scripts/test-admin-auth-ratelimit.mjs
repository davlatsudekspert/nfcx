// Maqsadli test (2026-09 hotfix): admin login/2FA rate-limit endi
// /login, /2fa/telegram/send, /verify-2fa orasida BIR XIL byudjetni
// baham ko'rmaydi (avvalgi bug — bitta 2FA login shu 3ta so'rovni
// to'liq sarflab qo'yardi), 429 javobida Retry-After bor, va
// muvaffaqiyatli kirish shu IP uchun hisoblagichni tozalaydi.
// Himoyaning o'zi (har endpoint 3/30min, login uchun qo'shimcha D1 5/30min)
// KAMAYTIRILMAGAN — faqat noto'g'ri ulashilgan byudjet tuzatilgan.
import worker, { hashPassword } from '../hosting/worker.js';
import { makeEnv, seedBasic, req, makeChecker } from './lib/d1-harness.mjs';

const { check, checkTrue, done } = makeChecker();
const { env } = makeEnv();
await seedBasic(env);
const f = (p, init) => worker.fetch(req(p, init), env);

// Admin ID#1 (harness default) parolini haqiqiy hash bilan almashtiramiz —
// TOTP yoqilmagan (login to'g'ridan-to'g'ri muvaffaqiyatga olib boradi).
const pwHash = await hashPassword('CorrectHorse123');
await env.DB.prepare(`UPDATE admins SET password_hash = ? WHERE id = 1`).bind(pwHash).run();

// 1) Login byudjeti (3/30min): 3 marta noto'g'ri parol -> 4-si 429 + Retry-After
for (let i = 0; i < 3; i++) {
  const r = await f('/api/admin/login', { method: 'POST', json: { phone: '+998900000000', password: 'wrong' } });
  check(`login attempt ${i + 1} -> 401`, r.status, 401);
}
let r = await f('/api/admin/login', { method: 'POST', json: { phone: '+998900000000', password: 'wrong' } });
check('4th login attempt -> 429', r.status, 429);
checkTrue('429 has Retry-After header', Number(r.headers.get('retry-after')) > 0);
const body429 = await r.json();
checkTrue('429 body has retryAfterSec', Number(body429.retryAfterSec) > 0);

// 2) Boshqa endpoint (/verify-2fa) shu IP uchun HALI HAM ishlaydi —
// login'ning byudjeti tugagani verify-2fa'ga ta'sir qilmaydi (eski bug
// aynan shu edi: bitta umumiy hisoblagich).
r = await f('/api/admin/verify-2fa', { method: 'POST', json: { tempToken: 'does-not-exist', code: '000000' } });
check('verify-2fa NOT rate-limited by login budget (expired, not 429)', r.status, 401);
const bodyVerify = await r.json();
check('verify-2fa unaffected response is "expired"', bodyVerify.error, 'expired');

// 3) verify-2fa'ning O'Z byudjeti alohida ishlaydi: 3 ta noto'g'ri urinishdan
// keyin 4-si 429 (login band bo'lishidan qat'i nazar, chunki alohida IP
// ishlatilmoqda — shu IP'ning login byudjeti band, verify2fa esa yangi).
for (let i = 0; i < 2; i++) {
  const rr = await f('/api/admin/verify-2fa', { method: 'POST', json: { tempToken: 'nope', code: '111111' } });
  check(`verify-2fa own-budget attempt ${i + 2} -> 401 (not yet limited)`, rr.status, 401);
}
r = await f('/api/admin/verify-2fa', { method: 'POST', json: { tempToken: 'nope', code: '111111' } });
check('verify-2fa own budget exhausted -> 429', r.status, 429);
checkTrue('verify-2fa 429 has Retry-After', Number(r.headers.get('retry-after')) > 0);

// 4) Muvaffaqiyatli kirish (yangi IP — o'z toza byudjeti bilan) shu IP
// uchun hisoblagichni TOZALAYDI: kirishdan keyin xuddi shu IP'dan yana
// 3 marta noto'g'ri parol kiritish HALI HAM 429'gacha yetmasligi kerak
// (agar reset ishlamasa, muvaffaqiyatli chaqiruv byudjetning bir qismini
// band qilib qo'yar edi va faqat 2 marta noto'g'ri urinish qolar edi).
const ip2 = '203.0.113.77'; // toza byudjet uchun boshqa IP (login/verify2fa byudjetlari IP bo'yicha)
r = await f('/api/admin/login', { method: 'POST', json: { phone: '+998900000000', password: 'CorrectHorse123' }, ip: ip2 });
check('login success (no TOTP) -> 200', r.status, 200);
const okBody = await r.json();
checkTrue('login success sets admin cookie', (r.headers.get('set-cookie') || '').includes('nfc_admin_session='));
check('login success flags totpSetupRecommended', okBody.totpSetupRecommended, true);
// Reset tasdiqlandi bo'lsa, xuddi shu IP'dan yana 3 marta noto'g'ri parol
// (muvaffaqiyatli chaqiruv + 3 = 4 bo'lardi, agar reset ishlamasa 3-chi
// so'rovning o'ziyoq 429 bo'lar edi, chunki muvaffaqiyat 1ta joy band qilgan).
for (let i = 0; i < 3; i++) {
  const rr = await f('/api/admin/login', { method: 'POST', json: { phone: '+998900000000', password: 'wrong' }, ip: ip2 });
  check(`post-success reset: attempt ${i + 1} -> 401 (not 429)`, rr.status, 401);
}
r = await f('/api/admin/login', { method: 'POST', json: { phone: '+998900000000', password: 'wrong' }, ip: ip2 });
check('post-success reset: 4th attempt now 429', r.status, 429);

done();
