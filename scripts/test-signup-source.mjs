// RO'YXATDAN O'TISH MANBASI — sayt yoki Android ilova.
//
// Egasining so'rovi: "Android ilova orqali ro'yxatdan o'tganlarni"
// ko'rish. Server ilovani allaqachon taniydi (`X-Client` sarlavhasi),
// lekin buni hech qayerda saqlamasdi.
//
// Ikkita narsa qo'riqlanadi:
//
//   1) Manba TO'G'RI yoziladi va noma'lum qiymat "web" bo'lib qoladi.
//      Yolg'on "android" yozib qo'ygandan ko'ra taniganini yozgani
//      ma'qul — aks holda statistika o'zini aldab turadi.
//
//   2) Ustun BO'LMASA ham ro'yxatdan o'tish ISHLAYDI. Statistika hech
//      qachon akkaunt ochilishiga to'siq bo'lmasligi kerak.
//
//   node scripts/test-signup-source.mjs
import worker, { ensureCoreSchema } from '../hosting/worker.js';
import { makeEnv, seedBasic, req, cookie, makeChecker } from './lib/d1-harness.mjs';

const { check, checkTrue, done } = makeChecker();
const { env, sqlite } = makeEnv({});
await ensureCoreSchema(env);
await seedBasic(env);

const clearLimits = () => { try { sqlite.prepare('DELETE FROM rate_limits').run(); } catch { /* yo'q */ } };
const reg = async (phone, client) => {
  clearLimits();
  return worker.fetch(req('/api/auth/register', {
    method: 'POST',
    json: { password: 'parol123', phone, tosAccepted: true },
    headers: client ? { 'x-client': client } : undefined,
  }), env);
};
const sourceOf = (phone) =>
  sqlite.prepare(`SELECT signup_source FROM users WHERE phone = ?`).get(phone)?.signup_source;

// ── 1) Ustun avtomatik qo'shilgan bo'lishi kerak ─────────────────────
const cols = sqlite.prepare(`PRAGMA table_info(users)`).all().map((c) => c.name);
checkTrue('signup_source ustuni avtomatik qo‘shildi', cols.includes('signup_source'));

// ── 2) Har bir sarlavha to'g'ri tanilsin ─────────────────────────────
for (const [client, want, label] of [
  ['android', 'android', 'Android ilova'],
  ['ios', 'ios', 'iOS ilova'],
  ['mobile', 'app', 'umumiy mobil'],
  [undefined, 'web', 'sarlavhasiz — sayt'],
  ['Android/1.4.0', 'android', 'versiya bilan ham tanilsin'],
  ['qandaydir-narsa', 'web', 'noma‘lum qiymat -> web'],
]) {
  const phone = '+99890' + String(1000000 + Math.floor(Math.random() * 8999999));
  const res = await reg(phone, client);
  check(`${label} -> 201`, res.status, 201);
  check(`${label} -> manba "${want}"`, sourceOf(phone), want);
}

// ── 3) Trafik hisobotida ko'rinsin ───────────────────────────────────
const d = await (await worker.fetch(req('/api/admin/traffic?days=30', { cookie: cookie.admin }), env)).json();
const by = Object.fromEntries((d.signups || []).map((r) => [r.src, r.count]));
check('hisobotda android = 2', by.android, 2);
check('hisobotda ios = 1', by.ios, 1);
check('hisobotda app = 1', by.app, 1);
// 2 tasi mening sinovimdan + 2 tasi fixture'dagi eski foydalanuvchi.
// Eski qatorlarda ustun bo'sh va u "web" deb hisoblanadi — ilova
// hali yo'q edi, ya'ni bu to'g'ri taxmin.
check('hisobotda web = 4 (2 yangi + 2 eski)', by.web, 4);

// ── 4) USTUN BO'LMASA ham ro'yxat ishlaydi ───────────────────────────
// Bu eng muhim tekshiruv: statistika uchun qo'shilgan ustun hech
// qachon akkaunt ochilishini to'xtatmasligi kerak.
sqlite.prepare(`ALTER TABLE users RENAME COLUMN signup_source TO signup_source_old`).run();
const res = await worker.fetch(req('/api/auth/register', {
  method: 'POST',
  json: { password: 'parol123', phone: '+998907654321', tosAccepted: true },
  headers: { 'x-client': 'android' },
}), env);
// Kesh tufayli kod ustun bor deb o'ylashi mumkin — ikkala javob ham
// maqbul, MUHIMI: server yiqilib qolmasin (5xx).
// ENG MUHIM TEKSHIRUV: ustun yo'qolsa ham odam ro'yxatdan o'tsin.
check('ustunsiz ham ro‘yxat ishlaydi', res.status, 201);
sqlite.prepare(`ALTER TABLE users RENAME COLUMN signup_source_old TO signup_source`).run();

done();
