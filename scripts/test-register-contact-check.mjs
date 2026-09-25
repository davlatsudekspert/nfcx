// RO'YXATDA EMAIL VA TELEFON TEKSHIRUVI (2026-09-25).
//
// Egasi: "gmail xato yozilsa ham kod ketdi deyapti", "raqam yetmasa qabul
// qilmaslik kerak". Kod yuborilishidan OLDIN: imlo xatosi (taklif bilan),
// pochta qabul qilmaydigan domen, davlat bo'yicha raqam uzunligi.
//
//   node scripts/test-register-contact-check.mjs
import worker from '../hosting/worker.js';
import { emailTypoSuggestion, phoneProblem } from '../hosting/api/contact-check.js';
import { makeEnv, seedBasic, req, makeChecker } from './lib/d1-harness.mjs';

const { check, done } = makeChecker();

// 1) Sof funksiyalar.
check('gmial.com → gmail.com', emailTypoSuggestion('ali@gmial.com'), 'ali@gmail.com');
check('gmail.co → gmail.com', emailTypoSuggestion('ali@gmail.co'), 'ali@gmail.com');
check('mail.r → mail.ru', emailTypoSuggestion('ali@mail.r'), 'ali@mail.ru');
check('yandx.ru → yandex.ru', emailTypoSuggestion('ali@yandx.ru'), 'ali@yandex.ru');
check('mail.kz — to‘g‘ri (mahalliy domen)', emailTypoSuggestion('ali@mail.kz'), null);
check('yandex.uz — to‘g‘ri', emailTypoSuggestion('ali@yandex.uz'), null);
check('kompaniya domeni — to‘g‘ri', emailTypoSuggestion('ali@nfcstore.uz'), null);
check('gmail.com — to‘g‘ri', emailTypoSuggestion('ali@gmail.com'), null);
check('UZ to‘liq', phoneProblem('+998901234567'), null);
check('UZ bitta kam', phoneProblem('+99890123456'), 'phone_short');
check('RU to‘liq', phoneProblem('+79161234567'), null);
check('RU bitta kam', phoneProblem('+7916123456'), 'phone_short');
check('KG bitta kam', phoneProblem('+99670011122'), 'phone_short');
check('TR ortiqcha', phoneProblem('+9053212345678'), 'phone_long');
check('jadvalda yo‘q davlat — umumiy qoida', phoneProblem('+85212345678'), null);

// 2) Endpoint: kod yuborilmaydi.
const { env } = makeEnv({ RESEND_API_KEY: 'test-resend-key', RESEND_FROM: 'NFCSTORE <no-reply@nfcstore.uz>' });
await seedBasic(env);
const sent = [];
const realFetch = globalThis.fetch;
let dns = {};
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u.startsWith('https://cloudflare-dns.com/')) {
    const name = new URL(u).searchParams.get('name');
    const type = new URL(u).searchParams.get('type');
    const rec = dns[name] || { Status: 3 };
    return new Response(JSON.stringify(type === 'MX' ? rec : { Status: 0, Answer: [] }), { status: 200 });
  }
  if (u.startsWith('https://api.resend.com/')) { sent.push(JSON.parse(init.body).to); return new Response('{"id":"x"}', { status: 200 }); }
  return realFetch(url, init);
};
const ask = async (body, ip) => {
  const res = await worker.fetch(req('/api/auth/request-register-code', { method: 'POST', json: body, ip }), env);
  return { status: res.status, body: await res.json().catch(() => null) };
};

let r = await ask({ email: 'ali@gmial.com', phone: '+998901112233' }, '10.0.0.1');
check('imlo xatosi: 422 + taklif', [r.status, r.body?.error, r.body?.detail], [422, 'email_typo', 'ali@gmail.com']);
r = await ask({ email: 'ali@nosuchdomain-xyz.uz', phone: '+998901112233' }, '10.0.0.2');
check('domen yo‘q: 422', [r.status, r.body?.error], [422, 'email_domain_invalid']);
r = await ask({ email: 'ali@gmail.com', phone: '+99890111223' }, '10.0.0.3');
check('UZ raqam yetmaydi: 422', [r.status, r.body?.error, r.body?.reason], [422, 'bad_phone', 'phone_short']);
r = await ask({ email: 'ali@gmail.com', phone: '+7916111223' }, '10.0.0.4');
check('RU raqam yetmaydi: 422', [r.status, r.body?.reason], [422, 'phone_short']);
check('hech bir holatda kod yuborilmadi', sent.length, 0);

dns['realco.uz'] = { Status: 0, Answer: [{ type: 15, data: '10 mx.realco.uz.' }] };
r = await ask({ email: 'ali@realco.uz', phone: '+79161112233' }, '10.0.0.5');
check('haqiqiy domen + to‘liq RU raqam: kod ketdi', [r.status, r.body?.channel], [200, 'email']);
r = await ask({ email: 'vali@gmail.com', phone: '+998901112244' }, '10.0.0.6');
check('gmail + to‘liq UZ raqam: kod ketdi', [r.status, r.body?.channel], [200, 'email']);
check('ikkala xat yuborildi', sent.length, 2);

// DNS ishlamasa — to'sib qo'yilmaydi.
globalThis.fetch = async (url, init) => {
  if (String(url).startsWith('https://cloudflare-dns.com/')) throw new Error('network');
  if (String(url).includes('resend.com')) { sent.push('x'); return new Response('{"id":"x"}', { status: 200 }); }
  return realFetch(url, init);
};
r = await ask({ email: 'ali@otherco.uz', phone: '+998901112255' }, '10.0.0.7');
check('DNS javob bermasa — kod baribir ketadi', r.status, 200);
globalThis.fetch = realFetch;

done();
