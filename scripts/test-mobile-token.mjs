// MOBIL ILOVA TOKENI — `X-Client` sarlavhasi bo'yicha.
//
// Nima qo'riqlanadi: Android ilova ro'yxatdan o'tish MANBASINI to'g'ri
// yozish uchun `X-Client: android` yuboradi. Ilgari token faqat
// `X-Client: mobile` da qaytarilardi — ya'ni to'g'ri manba yuborgan
// ilova tokensiz qolib, kira olmasdi. Ikkala talab endi bir vaqtda
// bajariladi.
//
// VEB TEGILMAGAN: brauzer bu sarlavhani umuman yubormaydi va uning
// javobida token BO'LMASLIGI kerak (u cookie bilan ishlaydi).
//
//   node scripts/test-mobile-token.mjs
import worker, { ensureCoreSchema } from '../hosting/worker.js';
import { makeEnv, seedBasic, req, makeChecker } from './lib/d1-harness.mjs';

const { check, checkTrue, done } = makeChecker();
const { env, sqlite } = makeEnv({});
await ensureCoreSchema(env);
await seedBasic(env);

// Haqiqiy parol bilan foydalanuvchi — login oqimini to'liq bosib o'tamiz.
const { hashPassword } = await import('../hosting/worker.js');
sqlite.prepare(`UPDATE users SET password_hash = ? WHERE id = 1`)
  .run(await hashPassword('parol12345'));

const login = (client) => worker.fetch(req('/api/auth/login', {
  method: 'POST',
  json: { login: 'user@test.local', password: 'parol12345' },
  headers: client ? { 'x-client': client } : {},
}), env);

// DIQQAT: kirish urinishlari hisob bo'yicha 15 daqiqada 5 tagacha
// cheklangan (brute-force himoyasi). Shuning uchun bu yerda aynan
// 5 ta so'rov bor va tokenni QAYTA kirmasdan saqlab qolamiz —
// aks holda oxirgi tekshiruv 429 ga urilib, xato sabab chalg'itardi.
let mobileToken = '';
for (const client of ['mobile', 'android', 'ios', 'ANDROID']) {
  const r = await login(client);
  const b = await r.json();
  check(`${client}: 200`, r.status, 200);
  checkTrue(`${client}: token qaytdi`, typeof b.token === 'string' && b.token.length > 20);
  if (client === 'android') mobileToken = b.token;
}

// VEB — sarlavhasiz.
const web = await login(null);
const wb = await web.json();
check('veb: 200', web.status, 200);
checkTrue('veb javobida token YO‘Q', wb.token === undefined);
checkTrue('veb cookie oladi', /nfc_session=/.test(web.headers.get('set-cookie') || ''));

// Token HAQIQATAN ishlashi kerak — Bearer bilan.
const me = await worker.fetch(req('/api/auth/me', {
  headers: { authorization: `Bearer ${mobileToken}` },
}), env);
const mb = await me.json();
check('Bearer bilan /me ishlaydi', mb.user?.id, 1);
checkTrue('kartalar ham qaytdi', Array.isArray(mb.cards) && mb.cards.length > 0);

// Noto'g'ri token — kirmagan holat.
const bad = await worker.fetch(req('/api/auth/me', {
  headers: { authorization: 'Bearer yolgon-token' },
}), env);
check('yolg‘on token — user null', (await bad.json()).user, null);

done();
