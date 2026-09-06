// hosting/api/telegram.js testi — haqiqiy worker.fetch, in-memory D1 (scripts/lib/d1-harness.mjs).
// Telegram sendMessage chaqiruvlari globalThis.fetch stub bilan ushlanadi.
//   node scripts/test-telegram.mjs
import worker, { ensureCoreSchema } from '../hosting/worker.js';
import { makeEnv, seedBasic, req, makeChecker } from './lib/d1-harness.mjs';

const { check, checkTrue, done } = makeChecker();

const tgSends = [];
globalThis.fetch = async (input, init) => {
  const u = String(input);
  if (u.startsWith('https://api.telegram.org/bottest-token/sendMessage')) {
    tgSends.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ ok: true, result: {} }), { headers: { 'content-type': 'application/json' } });
  }
  throw new Error('unexpected fetch ' + u);
};

const SECRET = 'wh-secret-123';
const update = (message) => ({ update_id: 1, message });
const webhook = (env, body, secret = SECRET) =>
  worker.fetch(req('/api/telegram/webhook', { method: 'POST', json: body, headers: secret ? { 'x-telegram-bot-api-secret-token': secret } : {} }), env);

// Bitta baza (ensureCoreSchema jarayon davomida bir marta ishlaydi); env
// o'zgaruvchilari sayoz nusxa orqali almashtiriladi.
const { env, sqlite } = makeEnv({ TELEGRAM_BOT_TOKEN: 'test-token', TELEGRAM_WEBHOOK_SECRET: SECRET });
await ensureCoreSchema(env);
await seedBasic(env);

// ===== bot nomi =====
{
  let res = await worker.fetch(req('/api/telegram/bot'), { ...env, TELEGRAM_BOT_USERNAME: undefined });
  check('GET /api/telegram/bot: unset -> {username:null}', [res.status, await res.json()], [200, { username: null }]);
  res = await worker.fetch(req('/api/telegram/bot'), { ...env, TELEGRAM_BOT_USERNAME: 'nfcsalebot' });
  check('GET /api/telegram/bot: env -> {username}', await res.json(), { username: 'nfcsalebot' });
}

// ===== webhook: sozlanmagan / noto'g'ri secret =====
{
  let res = await webhook({ ...env, TELEGRAM_WEBHOOK_SECRET: undefined }, update({ chat: { id: 1 }, from: { id: 1 }, text: '/start' }));
  check('webhook: TELEGRAM_WEBHOOK_SECRET unset -> 503', [res.status, (await res.json()).error], [503, 'telegram_webhook_not_configured']);

  res = await webhook(env, update({ chat: { id: 1 }, from: { id: 1 }, text: '/start' }), 'wrong');
  check('webhook: wrong secret -> 401', [res.status, (await res.json()).error], [401, 'unauthorized']);
  res = await webhook(env, update({ chat: { id: 1 }, from: { id: 1 }, text: '/start' }), '');
  check('webhook: missing secret header -> 401', res.status, 401);
  check('webhook: nothing sent on rejected updates', tgSends.length, 0);
}

// ===== webhook: /start, contact =====
{
  let res = await webhook(env, update({ chat: { id: 5001 }, from: { id: 5001, first_name: 'Ali' }, text: '/start' }));
  check('webhook: /start -> 200 {ok:true}', [res.status, await res.json()], [200, { ok: true }]);
  const start = tgSends[tgSends.length - 1];
  check('webhook: /start reply to chat with contact keyboard', [start.chat_id, start.reply_markup?.keyboard?.[0]?.[0]?.request_contact], [5001, true]);
  checkTrue('webhook: /start reply text has instructions (uz)', /Kontaktni ulashish/.test(start.text));

  // Boshqa birovning kontakti — rad etiladi
  res = await webhook(env, update({ chat: { id: 5001 }, from: { id: 5001 }, contact: { phone_number: '998907777777', user_id: 9999, first_name: 'X' } }));
  check('webhook: foreign contact -> 200 but not stored', [res.status, sqlite.prepare(`SELECT COUNT(*) AS n FROM bot_verifications`).get().n], [200, 0]);
  checkTrue('webhook: foreign contact warning sent', /o'zingizning kontaktingizni/.test(tgSends[tgSends.length - 1].text));

  // O'z kontakti — bot_verifications ga yoziladi (raqam + bilan normallashadi)
  res = await webhook(env, update({ chat: { id: 5001 }, from: { id: 5001, username: 'ali' }, contact: { phone_number: '998 90 777-77-77', user_id: 5001, first_name: 'Ali', last_name: 'Valiyev' } }));
  check('webhook: own contact -> 200 {ok:true}', [res.status, await res.json()], [200, { ok: true }]);
  let row = sqlite.prepare(`SELECT phone, tg_user_id, tg_name FROM bot_verifications`).all();
  check('webhook: bot_verifications row inserted (normalized phone)', row, [{ phone: '+998907777777', tg_user_id: 5001, tg_name: 'Ali Valiyev' }]);
  checkTrue('webhook: confirmation reply "Raqam tasdiqlandi"', /Raqam tasdiqlandi ✅/.test(tgSends[tgSends.length - 1].text));

  // Xuddi shu raqam boshqa tg akkauntdan — upsert (tg_user_id yangilanadi, qator ko'paymaydi)
  res = await webhook(env, update({ chat: { id: 6002 }, from: { id: 6002 }, contact: { phone_number: '+998907777777', user_id: 6002, first_name: 'Vali' } }));
  row = sqlite.prepare(`SELECT phone, tg_user_id, tg_name FROM bot_verifications`).all();
  check('webhook: same phone again -> upsert, still one row', row, [{ phone: '+998907777777', tg_user_id: 6002, tg_name: 'Vali' }]);

  // Tasdiqlangan raqam endi ro'yxatdan o'tish kodini oladi (auth moduli bilan bog'lanish)
  res = await worker.fetch(req('/api/auth/request-register-code', { method: 'POST', json: { phone: '+998907777777' } }), env);
  check('webhook -> register code: verified phone gets a code', [res.status, tgSends[tgSends.length - 1].chat_id], [200, 6002]);

  // Noma'lum matn / bo'sh update — baribir 200
  res = await webhook(env, update({ chat: { id: 5001 }, from: { id: 5001 }, text: 'salom' }));
  check('webhook: other text -> 200', res.status, 200);
  res = await webhook(env, { update_id: 2, edited_message: { chat: { id: 5001 }, text: 'x' } });
  check('webhook: update without message -> 200 {ok:true}', [res.status, await res.json()], [200, { ok: true }]);
  res = await worker.fetch(req('/api/telegram/webhook', { method: 'POST', body: 'not json', headers: { 'x-telegram-bot-api-secret-token': SECRET } }), env);
  check('webhook: invalid JSON body -> 200', res.status, 200);

  // Telegram API xato bersa ham webhook 200
  globalThis.fetch = async () => { throw new Error('network down'); };
  res = await webhook(env, update({ chat: { id: 5001 }, from: { id: 5001 }, text: '/start' }));
  check('webhook: telegram send failure still -> 200 {ok:true}', [res.status, await res.json()], [200, { ok: true }]);
}

done();
