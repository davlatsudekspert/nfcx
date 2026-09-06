// Admin 2FA maqsadli testi (2026-09 production 503 root-cause).
//
// Qamrov: Google TOTP (haqiqiy RFC 6238 kod), Telegram OTP (bot chaqiruvi
// stub qilinadi va kod javobdan olinadi), noto'g'ri kod, muddati tugagan kod,
// bir martalik kod (replay), muddati tugagan sessiya, rate-limit, va
// PRODUCTION DRIFT: `admin_sessions` jadvalida bizning INSERT to'ldirmaydigan
// qo'shimcha NOT NULL ustun bo'lsa ham /verify-2fa ishlashi kerak (aynan shu
// production'da 503 sababi bo'lgan), hamda D1 butunlay yiqilganda 503
// fail-closed bo'lib, javobda hech qanday maxfiy qiymat bo'lmasligi.
import { createHmac } from 'node:crypto';
import worker, { hashPassword } from '../hosting/worker.js';
import { makeEnv, seedBasic, req, makeChecker } from './lib/d1-harness.mjs';

const { check, checkTrue, done } = makeChecker();

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const SECRET = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP'; // faqat test uchun, production bilan aloqasi yo'q
function base32Decode(input) {
  const clean = String(input).toUpperCase().replace(/[^A-Z2-7]/g, '');
  const bytes = []; let bits = 0, value = 0;
  for (const ch of clean) {
    value = (value << 5) | BASE32.indexOf(ch); bits += 5;
    if (bits >= 8) { bits -= 8; bytes.push((value >>> bits) & 0xff); }
  }
  return Buffer.from(bytes);
}
// hosting/worker.js dagi hotp() bilan bir xil (HMAC-SHA1, 8 bayt hisoblagich, 6 xona)
function totpCode(secret, counter = Math.floor(Date.now() / 1000 / 30)) {
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(counter / 2 ** 32), 0);
  buf.writeUInt32BE(counter >>> 0, 4);
  const sig = createHmac('sha1', base32Decode(secret)).update(buf).digest();
  const off = sig[sig.length - 1] & 0x0f;
  const code = ((sig[off] & 0x7f) << 24) | ((sig[off + 1] & 0xff) << 16) | ((sig[off + 2] & 0xff) << 8) | (sig[off + 3] & 0xff);
  return String(code % 1_000_000).padStart(6, '0');
}

// DIQQAT: worker.js dagi ensureCoreSchema/ensureAdminAuthTables o'z
// va'dasini PROCESS bo'yicha kesh qiladi, shuning uchun bitta process ichida
// ikkinchi marta makeEnv() chaqirilganda ular yangi DB'da qayta ishlamaydi.
// Shu sababli runtime jadvallarni (0001-schema.sql da yo'q) test o'zi
// yaratadi — bu faqat harness plumbing, production kodga aloqasi yo'q.
const CANONICAL_SESSIONS = `CREATE TABLE IF NOT EXISTS admin_sessions (
  token TEXT PRIMARY KEY NOT NULL, admin_id INTEGER NOT NULL, role TEXT NOT NULL,
  abs_exp TEXT NOT NULL, last_activity TEXT NOT NULL);`;
// Production drift simulyatsiyasi: jadval BIZDAN OLDIN, boshqa shaklda
// yaratilgan — qo'shimcha `expires_at TEXT NOT NULL` ustuni bor.
const DRIFTED_SESSIONS = `CREATE TABLE IF NOT EXISTS admin_sessions (
  token TEXT PRIMARY KEY NOT NULL, admin_id INTEGER NOT NULL, role TEXT NOT NULL,
  abs_exp TEXT NOT NULL, last_activity TEXT NOT NULL, expires_at TEXT NOT NULL);`;

async function freshEnv({ totp = true, telegram = false, driftSessions = false } = {}) {
  const extra = telegram ? { TELEGRAM_BOT_TOKEN: 'test-bot-token', ADMIN_CHAT_ID: '111' } : {};
  const { env, sqlite } = makeEnv(extra);
  sqlite.exec(CANONICAL_SESSIONS);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS admin_2fa_pending (
    temp_token TEXT PRIMARY KEY NOT NULL, admin_id INTEGER NOT NULL, method TEXT NOT NULL,
    code TEXT, attempts INTEGER DEFAULT 0 NOT NULL, expires_at TEXT NOT NULL);`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS admin_totp_setup_pending (
    admin_id INTEGER PRIMARY KEY NOT NULL, secret TEXT NOT NULL, created_at TEXT NOT NULL);`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS rate_limits (
    key TEXT PRIMARY KEY NOT NULL, hits INTEGER DEFAULT 0 NOT NULL, window_start INTEGER NOT NULL);`);
  try { sqlite.exec(`ALTER TABLE admins ADD COLUMN totp_last_counter INTEGER;`); } catch { /* allaqachon bor */ }
  await seedBasic(env);
  const pwHash = await hashPassword('CorrectHorse123');
  await env.DB.prepare(`UPDATE admins SET password_hash = ?, totp_enabled = ?, totp_secret = ? WHERE id = 1`)
    .bind(pwHash, totp ? 1 : 0, totp ? SECRET : null).run();
  if (driftSessions) {
    // seedBasic fixture sessiyalarini yozib bo'lgach jadvalni "eski
    // production" shakliga almashtiramiz (fixture cookie'lar bu testda
    // kerak emas). Diqqat: seedBasic'ning O'ZI ham shu constraint'ga
    // urilib yiqiladi — bu production xatosining aynan o'zi.
    sqlite.exec('DROP TABLE admin_sessions;');
    sqlite.exec(DRIFTED_SESSIONS);
  }
  return { env, sqlite, f: (p, init) => worker.fetch(req(p, init), env) };
}

// Har bir test o'z IP'sidan foydalanadi — rate-limit (3/30min) testlarni
// bir-biriga ta'sir qilmasin. Modul-darajadagi hisoblagich process bo'ylab.
let ipCounter = 0;
const nextIp = () => `198.51.100.${++ipCounter}`;

async function loginStep(f, ip) {
  const r = await f('/api/admin/login', { method: 'POST', ip, json: { phone: '+998900000000', password: 'CorrectHorse123' } });
  return { status: r.status, body: await r.json() };
}

// ── 1) Google TOTP: to'g'ri kod → 200 + admin cookie ──────────────────────
{
  const { f } = await freshEnv();
  const ip = nextIp();
  const login = await loginStep(f, ip);
  check('TOTP: login → twoFactor totp', [login.status, login.body.twoFactor, login.body.method], [200, true, 'totp']);
  const r = await f('/api/admin/verify-2fa', { method: 'POST', ip, json: { tempToken: login.body.tempToken, code: totpCode(SECRET) } });
  const body = await r.json();
  check('TOTP: valid code → 200 {ok:true}', [r.status, body.ok], [200, true]);
  checkTrue('TOTP: admin cookie set', (r.headers.get('set-cookie') || '').includes('nfc_admin_session='));
  checkTrue('TOTP: response leaks no secret', !JSON.stringify(body).includes(SECRET));
}

// ── 2) Noto'g'ri TOTP kodi → 401 bad_code, sessiya berilmaydi ────────────
{
  const { f } = await freshEnv();
  const ip = nextIp();
  const login = await loginStep(f, ip);
  const r = await f('/api/admin/verify-2fa', { method: 'POST', ip, json: { tempToken: login.body.tempToken, code: '000000' } });
  check('TOTP: wrong code → 401 bad_code', [r.status, (await r.json()).error], [401, 'bad_code']);
  checkTrue('TOTP: wrong code sets no cookie', !(r.headers.get('set-cookie') || '').includes('nfc_admin_session='));
}

// ── 3) Bir martalik: xuddi shu TOTP kodi ikkinchi marta ishlamaydi ───────
{
  const { f } = await freshEnv();
  const ip = nextIp();
  const code = totpCode(SECRET);
  const first = await loginStep(f, ip);
  const r1 = await f('/api/admin/verify-2fa', { method: 'POST', ip, json: { tempToken: first.body.tempToken, code } });
  check('TOTP replay: first use → 200', r1.status, 200);
  const second = await loginStep(f, ip);
  const r2 = await f('/api/admin/verify-2fa', { method: 'POST', ip, json: { tempToken: second.body.tempToken, code } });
  check('TOTP replay: same code again → 401', [r2.status, (await r2.json()).error], [401, 'bad_code']);
}

// ── 4) Muddati tugagan pending (2FA sessiyasi) → 401 expired ─────────────
{
  const { env, f } = await freshEnv();
  const ip = nextIp();
  const login = await loginStep(f, ip);
  await env.DB.prepare(`UPDATE admin_2fa_pending SET expires_at = ? WHERE temp_token = ?`)
    .bind(new Date(Date.now() - 60_000).toISOString(), login.body.tempToken).run();
  const r = await f('/api/admin/verify-2fa', { method: 'POST', ip, json: { tempToken: login.body.tempToken, code: totpCode(SECRET) } });
  check('expired pending → 401 expired', [r.status, (await r.json()).error], [401, 'expired']);
  const left = await env.DB.prepare(`SELECT COUNT(*) AS n FROM admin_2fa_pending WHERE temp_token = ?`).bind(login.body.tempToken).first();
  check('expired pending row cleaned up', Number(left.n), 0);
}

// ── 5) Telegram OTP: yuborilgan kod bilan tasdiqlash ─────────────────────
{
  const { f } = await freshEnv({ telegram: true });
  const ip = nextIp();
  const login = await loginStep(f, ip);
  let sentCode = null;
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (String(url).includes('api.telegram.org')) {
      const text = JSON.parse(init.body).text || '';
      sentCode = (text.match(/\b(\d{6})\b/) || [])[1] || null;
      return new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json' } });
    }
    return realFetch(url, init);
  };
  const send = await f('/api/admin/2fa/telegram/send', { method: 'POST', ip, json: { tempToken: login.body.tempToken } });
  check('Telegram: send → 200 method telegram', [send.status, (await send.json()).method], [200, 'telegram']);
  checkTrue('Telegram: 6 xonali kod yuborildi', /^\d{6}$/.test(sentCode || ''));

  const wrong = await f('/api/admin/verify-2fa', { method: 'POST', ip, json: { tempToken: login.body.tempToken, code: sentCode === '000000' ? '111111' : '000000' } });
  check('Telegram: wrong code → 401 bad_code', [wrong.status, (await wrong.json()).error], [401, 'bad_code']);

  const ok = await f('/api/admin/verify-2fa', { method: 'POST', ip, json: { tempToken: login.body.tempToken, code: sentCode } });
  check('Telegram: correct code → 200', [ok.status, (await ok.json()).ok], [200, true]);
  checkTrue('Telegram: admin cookie set', (ok.headers.get('set-cookie') || '').includes('nfc_admin_session='));

  const reuse = await f('/api/admin/verify-2fa', { method: 'POST', ip: nextIp(), json: { tempToken: login.body.tempToken, code: sentCode } });
  check('Telegram: kod bir martalik (qayta ishlatib bo\'lmaydi) → 401', reuse.status, 401);
  globalThis.fetch = realFetch;
}

// ── 6) Google kodi Telegram kodi sifatida (va aksincha) tekshirilmasin ───
{
  const { env, f } = await freshEnv({ telegram: true });
  const ip = nextIp();
  const login = await loginStep(f, ip);
  // pending 'telegram' rejimida, lekin foydalanuvchi Google TOTP kodini kiritadi
  await env.DB.prepare(`UPDATE admin_2fa_pending SET method = 'telegram', code = ? WHERE temp_token = ?`)
    .bind('deadbeef', login.body.tempToken).run();
  const r = await f('/api/admin/verify-2fa', { method: 'POST', ip, json: { tempToken: login.body.tempToken, code: totpCode(SECRET) } });
  check('telegram rejimida TOTP kodi qabul qilinmaydi → 401', r.status, 401);
}

// ── 7) Muddati tugagan sessiya: /2fa/telegram/send → 401 expired ─────────
{
  const { env, f } = await freshEnv({ telegram: true });
  const ip = nextIp();
  const login = await loginStep(f, ip);
  await env.DB.prepare(`UPDATE admin_2fa_pending SET expires_at = ? WHERE temp_token = ?`)
    .bind(new Date(Date.now() - 1000).toISOString(), login.body.tempToken).run();
  const r = await f('/api/admin/2fa/telegram/send', { method: 'POST', ip, json: { tempToken: login.body.tempToken } });
  check('expired session → telegram/send 401 expired', [r.status, (await r.json()).error], [401, 'expired']);
}

// ── 8) Rate-limit: 4-urinish 429 + Retry-After (himoya pasaytirilmagan) ──
{
  const { f } = await freshEnv();
  const ip = nextIp();
  const login = await loginStep(f, ip);
  for (let i = 0; i < 3; i++) {
    const rr = await f('/api/admin/verify-2fa', { method: 'POST', ip, json: { tempToken: login.body.tempToken, code: '000000' } });
    check(`rate-limit: attempt ${i + 1} → 401 (hali bloklanmagan)`, rr.status, 401);
  }
  const r = await f('/api/admin/verify-2fa', { method: 'POST', ip, json: { tempToken: login.body.tempToken, code: '000000' } });
  check('rate-limit: 4-urinish → 429', r.status, 429);
  checkTrue('rate-limit: Retry-After sarlavhasi bor', Number(r.headers.get('retry-after')) > 0);
}

// ── 9) PRODUCTION DRIFT: admin_sessions'da qo'shimcha NOT NULL ustun ─────
// Aynan shu holat production'da /verify-2fa 503 qaytarishiga sabab bo'lgan.
{
  const { env, f } = await freshEnv({ driftSessions: true });
  const ip = nextIp();
  const login = await loginStep(f, ip);
  const r = await f('/api/admin/verify-2fa', { method: 'POST', ip, json: { tempToken: login.body.tempToken, code: totpCode(SECRET) } });
  check('drifted admin_sessions: verify-2fa hali ham 200', [r.status, (await r.json()).ok], [200, true]);
  const rawCookie = (r.headers.get('set-cookie') || '').match(/nfc_admin_session=([0-9a-f]+)/);
  checkTrue('drifted: cookie berildi', !!rawCookie);
  // Sessiya haqiqatan saqlangan (eski jadvalga moslashib yoki v2 fallback'ga)
  const inLegacy = await env.DB.prepare(`SELECT COUNT(*) AS n FROM admin_sessions`).first();
  let inV2 = { n: 0 };
  try { inV2 = await env.DB.prepare(`SELECT COUNT(*) AS n FROM admin_sessions_v2`).first(); } catch { /* yaratilmagan bo'lishi mumkin */ }
  checkTrue('drifted: sessiya biror jadvalga yozildi', Number(inLegacy.n) + Number(inV2.n) > 0);
  // Va shu cookie bilan /api/admin/me haqiqatan authenticated qaytaradi
  const me = await f('/api/admin/me', { ip, cookie: `nfc_admin_session=${rawCookie[1]}` });
  check('drifted: /api/admin/me authenticated', (await me.json()).authenticated, true);
}

// ── 10) Haqiqiy server xatosi → fail-closed 503, maxfiy ma'lumot yo'q ────
{
  const { env, f } = await freshEnv();
  const ip = nextIp();
  const login = await loginStep(f, ip);
  const realPrepare = env.DB.prepare.bind(env.DB);
  env.DB.prepare = (sql) => {
    if (/INSERT INTO "admin_sessions|PRAGMA table_info|CREATE TABLE IF NOT EXISTS "admin_sessions_v2|INSERT INTO "admin_sessions_v2/.test(sql)) {
      return { bind: () => ({ run: async () => { throw new Error('D1_ERROR: simulated failure'); }, first: async () => { throw new Error('D1_ERROR: simulated failure'); }, all: async () => { throw new Error('D1_ERROR: simulated failure'); } }), run: async () => { throw new Error('D1_ERROR: simulated failure'); }, all: async () => { throw new Error('D1_ERROR: simulated failure'); }, first: async () => { throw new Error('D1_ERROR: simulated failure'); } };
    }
    return realPrepare(sql);
  };
  const r = await f('/api/admin/verify-2fa', { method: 'POST', ip, json: { tempToken: login.body.tempToken, code: totpCode(SECRET) } });
  const body = await r.json();
  env.DB.prepare = realPrepare;
  check('server exception → 503 verify_2fa_unavailable', [r.status, body.error], [503, 'verify_2fa_unavailable']);
  checkTrue('503 javobida sessiya cookie berilmaydi (fail-closed)', !(r.headers.get('set-cookie') || '').includes('nfc_admin_session='));
  checkTrue('503 javobi maxfiy qiymat oshkor qilmaydi', !JSON.stringify(body).includes(SECRET) && !JSON.stringify(body).includes('CorrectHorse123'));
}

done();
