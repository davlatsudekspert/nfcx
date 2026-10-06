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

// 1b) HAQIQIY DOMENLAR HECH QACHON "xato" EMAS (App Store, 2026-10).
// Ilgari mac.com/aol.com/aim.com → mail.com, ymail.com/email.com →
// gmail.com deb rad etilardi va ro'yxat cheksiz halqaga tushardi.
const REAL_DOMAINS = [
  // topshiriqdagi ro'yxat
  'mac.com', 'aol.com', 'aim.com', 'ymail.com', 'email.com',
  'me.com', 'icloud.com', 'yandex.ru', 'mail.ru', 'inbox.ru', 'bk.ru', 'list.ru', 'rambler.ru',
  'outlook.com', 'hotmail.com', 'live.com', 'proton.me', 'protonmail.com', 'gmx.com', 'zoho.com',
  // Apple "Hide My Email" va boshqa keng tarqalganlar
  'privaterelay.appleid.com', 'googlemail.com', 'msn.com', 'rocketmail.com', 'yahoo.com', 'yahoo.co.uk',
  'hotmail.co.uk', 'live.ru', 'gmx.de', 'gmx.net', 'web.de', 'pm.me', 'tutanota.com', 'fastmail.com',
  'foxmail.com', 'qq.com', '163.com', 'naver.com', 'myrambler.ru', 'email.ua', 'ukr.net', 'i.ua',
  'yandex.com', 'ya.ru', 'yandex.kz', 'mail.com', 'comcast.net', 'att.net', 'libero.it', 'orange.fr',
  'umail.uz', 'inbox.uz', 'mail.uz',
];
for (const d of REAL_DOMAINS) check(`haqiqiy domen: ${d} — taklif YO‘Q`, emailTypoSuggestion(`ali@${d}`), null);
// Katta harf va bo'shliq ham hisobga olinmaydi.
check('MAC.COM (katta harf) — taklif yo‘q', emailTypoSuggestion('  Ali@MAC.COM '), null);
// O'ziga o'zini taklif qilmaydi (cheksiz halqa bo'lardi).
check('googlemail.com o‘ziga taklif qilinmaydi', emailTypoSuggestion('ali@googlemail.com'), null);

// 1c) Haqiqiy xatolar hamon tutiladi (qo'shni harflar almashsa ham).
for (const [typo, fixed] of [
  ['gmai.com', 'gmail.com'], ['gamil.com', 'gmail.com'], ['gnail.com', 'gmail.com'], ['gmail.cm', 'gmail.com'],
  ['gmail.con', 'gmail.com'], ['hotmial.com', 'hotmail.com'], ['hotmail.co', 'hotmail.com'], ['outlok.com', 'outlook.com'],
  ['yahooo.com', 'yahoo.com'], ['iclod.com', 'icloud.com'], ['icloud.co', 'icloud.com'], ['mial.ru', 'mail.ru'],
  ['yanex.ru', 'yandex.ru'], ['ramler.ru', 'rambler.ru'], ['inbox.r', 'inbox.ru'], ['protonmial.com', 'protonmail.com'],
  ['gmail', 'gmail.com'],
]) check(`xato: ${typo} → ${fixed}`, emailTypoSuggestion(`ali@${typo}`), `ali@${fixed}`);

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

// Ilgari "xato" deb 422 olgan haqiqiy domenlar — endi kod ketadi (DNS
// stubida ular YO'Q: ma'lum pochta xizmati DNS'siz qabul qilinadi).
r = await ask({ email: 'reviewer@mac.com', phone: '+12025550101' }, '10.0.0.8');
check('mac.com + AQSh raqami: kod ketdi (422 email_typo EMAS)', [r.status, r.body?.channel], [200, 'email']);
r = await ask({ email: 'reviewer@aol.com', phone: '+12025550102' }, '10.0.0.9');
check('aol.com: kod ketdi', [r.status, r.body?.channel], [200, 'email']);
r = await ask({ email: 'reviewer@ymail.com', phone: '+12025550103' }, '10.0.0.10');
check('ymail.com: kod ketdi', [r.status, r.body?.channel], [200, 'email']);
check('uchala xat ham yuborildi', sent.length, 5);

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
