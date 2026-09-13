// BOT USERNAME'idagi "@" havolani buzmasin.
//
// Egasi Cloudflare'ga `TELEGRAM_BOT_USERNAME = @nfcsalebot` deb yozdi —
// bu juda tabiiy, chunki Telegram username'ni hamma joyda "@" bilan
// ko'rsatadi. Lekin havola "t.me/@nfcsalebot" bo'lib buziladi va tugma
// JIM ishlamay qoladi: xato chiqmaydi, shunchaki ochilmaydi. Aynan
// shunday xatolarni topish eng qiyin.
//
//   node scripts/test-tg-username.mjs
import worker, { ensureCoreSchema } from '../hosting/worker.js';
import { makeEnv, seedBasic, req, makeChecker } from './lib/d1-harness.mjs';

const { check, checkTrue, done } = makeChecker();
const { env } = makeEnv({ TELEGRAM_BOT_TOKEN: 'test-token' });
await ensureCoreSchema(env);
await seedBasic(env);

const post = (path, json) => worker.fetch(req(path, { method: 'POST', json }), env);
const get = (path) => worker.fetch(req(path), env);

// Har bir yozilish usuli bir xil, TO'G'RI havola berishi kerak.
for (const [label, value] of [
  ['@ bilan', '@nfcsalebot'],
  ['@ siz', 'nfcsalebot'],
  ['bo‘sh joy bilan', '  @nfcsalebot  '],
  ['ikkita @ bilan', '@@nfcsalebot'],
]) {
  env.TELEGRAM_BOT_USERNAME = value;
  const res = await post('/api/auth/tg-link/start', {});
  const body = await res.json();
  check(`${label} -> to‘g‘ri havola`, [res.status, String(body.url || '').split('?')[0]],
    [200, 'https://t.me/nfcsalebot']);
  checkTrue(`${label} -> havolada "@" yo‘q`, !String(body.url || '').includes('@'));

  // Frontend zaxira havolani shu endpointdan oladi — u ham toza bo'lsin.
  const bot = await (await get('/api/telegram/bot')).json();
  check(`${label} -> /api/telegram/bot toza`, bot.username, 'nfcsalebot');
}

// Qo'yilmagan bo'lsa — aniq xato (jim ishlamaslik emas).
env.TELEGRAM_BOT_USERNAME = '';
let res = await post('/api/auth/tg-link/start', {});
check('qo‘yilmagan -> 503 bot_not_configured', [res.status, (await res.json()).error], [503, 'bot_not_configured']);

// Faqat "@" ham bo'sh deb hisoblansin — aks holda "t.me/" ochilardi.
env.TELEGRAM_BOT_USERNAME = '@';
res = await post('/api/auth/tg-link/start', {});
check('faqat "@" -> 503 bot_not_configured', [res.status, (await res.json()).error], [503, 'bot_not_configured']);

// ===== SOZLAMALAR: ekrandagi yozuv KANALGA mos bo'lsin =====
//
// Egasi shuni yozdi: "bu yerda telegramga kod kelmayapti". Aslida kod
// KELGAN edi — emailiga. Server kanalni akkauntga qarab tanlaydi,
// ekranda esa har doim "Telegram botingizga yuborildi" deb turardi.
// Ya'ni odam noto'g'ri joyni ochib, kodni kuta-kuta o'tirdi.
//
// Server javobidagi `channel` ekranda ISHLATILISHI shart.
import { readFileSync } from 'node:fs';
const settings = readFileSync(new URL('../src/pages/SettingsPage.jsx', import.meta.url), 'utf8');

checkTrue('sozlamalar: kanal server javobidan olinadi', /setChannel\(res\?\.channel === 'email'/.test(settings));
checkTrue('sozlamalar: xabar kanalga qarab yoziladi',
  /channel === 'email'/.test(settings) && settings.includes('Kod emailingizga yuborildi'));
checkTrue('sozlamalar: maydon yozuvi ham kanalga qarab',
  settings.includes("t('Emailga kelgan 6 xonali kod')"));
// Tugma bosilgunga qadar kanal NOMA'LUM — shuning uchun u neytral
// bo'lishi kerak, "Telegram'ga kod yuborish" emas.
checkTrue('sozlamalar: tugma neytral', !settings.includes("Telegram'ga kod yuborish"));

done();
