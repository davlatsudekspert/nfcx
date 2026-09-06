import { cardContentCleanupStmts } from './card-cleanup.js';
// hosting/api/auth.js — ro'yxatdan o'tish (Telegram OTP) va parolni tiklash.
// CONTRACT.md ga qarang. Route topilmasa null qaytaradi.
//
// Javob shakllari server/index.js (Express) bilan BIR XIL — frontend
// src/pages/AuthPage.jsx + src/lib/auth.jsx shunga bog'langan:
//   POST /api/auth/request-register-code {phone}        → {ok:true} | 422 {error:'bad_phone'|'phone_not_verified'} | 429 | 503 {error:'tg_send_failed'}
//   POST /api/auth/register {email,password,phone,code,botAck,tosAccepted,promoCode}
//                                                        → 201 {user:{id,email}} + Set-Cookie | 422 | 409 {error:'email_taken'}
//   POST /api/auth/request-password-reset {email}        → doim {ok:true} (foydalanuvchi bor-yo'qligi oshkor qilinmaydi)
//   POST /api/auth/reset-password {email,code,password}  → {ok:true} | 422 {error:'bad_code'|matn}
//
// Kodlar (OTP) bazada SHA-256 hash sifatida saqlanadi (worker.js'dagi admin 2FA
// kabi) — D1 backup sizib chiqsa ham xom kod chiqmaydi.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^\+?\d{9,15}$/;

const REGISTER_OTP_TTL_MS = 5 * 60 * 1000;   // ro'yxatdan o'tish kodi — 5 daqiqa
const REGISTER_OTP_MAX = 3;                    // bir raqamga 10 daqiqada ko'pi bilan 3 ta kod
const REGISTER_OTP_WINDOW_MS = 10 * 60 * 1000;
const RESET_TTL_MS = 10 * 60 * 1000;           // parol tiklash kodi — 10 daqiqa
const RESET_MAX = 3;                           // bir emailga 15 daqiqada ko'pi bilan 3 ta kod
const RESET_WINDOW_MS = 15 * 60 * 1000;

// Telegram'ga yuboriladigan matnlar (server/bot.js OTP_MESSAGES bilan bir xil uslub).
const OTP_TEXT = {
  register: (code) => `✅ NFCSTORE ro'yxatdan o'tish kodi: <b>${code}</b>\n\nBu kodni hech kimga bermang. 5 daqiqa ichida amal qiladi.`,
  password_reset: (code) => `🔐 Parolni o'zgartirish kodi: <b>${code}</b>\n\nBu kodni hech kimga bermang. 10 daqiqa ichida amal qiladi.`,
};

// ---------- kichik yordamchilar ----------

// nowTs() formatida ("YYYY-MM-DD HH:MM:SS.mmm+00") — jadval ustunlari bilan
// lexikografik solishtirish to'g'ri ishlashi uchun.
const tsAt = (ms) => new Date(ms).toISOString().replace('T', ' ').replace('Z', '+00');

// Telefon: legacy kabi bo'sh joy/chiziq/qavs olib tashlanadi.
const normPhone = (v, H) => H.cleanStr(v, 20).replace(/[\s\-()]/g, '');

// 6 xonali kod — crypto tasodifiy (Math.random emas).
function sixDigitCode() {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 900000;
  return String(100000 + n);
}

function validateAuthBody(body, H) {
  const email = H.cleanStr(body.email, 120).toLowerCase();
  const password = typeof body.password === 'string' ? body.password : '';
  if (!EMAIL_RE.test(email)) return { error: 'Email formati noto’g’ri.' };
  if (password.length < 6) return { error: 'Parol kamida 6 belgidan iborat bo’lishi kerak.' };
  return { email, password };
}

// Ro'yxatdan o'tishga xos qo'shimcha tekshiruv: telefon, "botga yozdim" va
// oferta tasdig'i, tasdiqlash kodi — barchasi majburiy (legacy bilan bir xil).
function validateRegisterExtra(body, H) {
  const phone = normPhone(body.phone, H);
  const botAck = body.botAck === true;
  const tosAccepted = body.tosAccepted === true;
  const code = H.cleanStr(body.code, 6);
  if (!PHONE_RE.test(phone)) return { error: 'Telefon raqamini to’g’ri kiriting (masalan +998901234567).' };
  if (!botAck) return { error: 'Avval Telegram botimizga yozib, tasdiqlash katagini belgilang.' };
  if (!tosAccepted) return { error: 'Davom etish uchun ommaviy oferta shartlariga rozilik bering.' };
  if (!code) return { error: 'code_required' };
  return { phone, botAck, tosAccepted, code };
}

// ---------- bot_verifications ----------

// Shu raqam botga "Kontaktni ulashish" orqali ulangan bo'lsa — tg_user_id.
async function getTgUserIdForPhone(env, phone) {
  const row = await env.DB.prepare(`SELECT tg_user_id FROM bot_verifications WHERE phone = ? ORDER BY id DESC LIMIT 1`)
    .bind(phone).first();
  return row?.tg_user_id || null;
}

// ---------- phone_otp_codes (ro'yxatdan o'tish) ----------

async function countRecentPhoneOtps(env, phone, purpose, sinceTs) {
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM phone_otp_codes WHERE phone = ? AND purpose = ? AND created_at > ?`
  ).bind(phone, purpose, sinceTs).first();
  return Number(row?.n || 0);
}

async function createPhoneOtpCode(env, H, phone, purpose) {
  const code = sixDigitCode();
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO phone_otp_codes (phone, code, purpose, expires_at, used, created_at) VALUES (?, ?, ?, ?, 0, ?)`
  ).bind(phone, await H.sha256Hex(code), purpose, tsAt(now + REGISTER_OTP_TTL_MS), tsAt(now)).run();
  return code;
}

// Eng so'nggi faol kodni tekshiradi va ISHLATILGAN deb belgilaydi. Kod
// noto'g'ri bo'lsa ham o'sha kod kuydiriladi (jadvalda urinishlar ustuni
// yo'q) — 6 xonali kodni taxmin qilib bo'lmasin: har kodga 1 urinish, kod
// olish esa 3/10 daqiqa bilan cheklangan.
async function verifyAndConsumePhoneOtpCode(env, H, phone, code, purpose) {
  const row = await env.DB.prepare(
    `SELECT id, code FROM phone_otp_codes WHERE phone = ? AND purpose = ? AND used = 0 AND expires_at > ?
     ORDER BY id DESC LIMIT 1`
  ).bind(phone, purpose, H.nowTs()).first();
  if (!row) return false;
  const consumed = await env.DB.prepare(`UPDATE phone_otp_codes SET used = 1 WHERE id = ? AND used = 0`).bind(row.id).run();
  if (!consumed?.meta?.changes) return false; // parallel so'rov allaqachon ishlatgan
  return (await H.sha256Hex(code)) === row.code;
}

// ---------- password_reset_codes ----------

async function countRecentResetCodes(env, userId, sinceTs) {
  const row = await env.DB.prepare(`SELECT COUNT(*) AS n FROM password_reset_codes WHERE user_id = ? AND created_at > ?`)
    .bind(userId, sinceTs).first();
  return Number(row?.n || 0);
}

async function createPasswordResetCode(env, H, userId) {
  const code = sixDigitCode();
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO password_reset_codes (user_id, code, expires_at, used, created_at) VALUES (?, ?, ?, 0, ?)`
  ).bind(userId, await H.sha256Hex(code), tsAt(now + RESET_TTL_MS), tsAt(now)).run();
  return code;
}

async function verifyAndConsumePasswordResetCode(env, H, userId, code) {
  const row = await env.DB.prepare(
    `SELECT id, code FROM password_reset_codes WHERE user_id = ? AND used = 0 AND expires_at > ? ORDER BY id DESC LIMIT 1`
  ).bind(userId, H.nowTs()).first();
  if (!row) return false;
  const consumed = await env.DB.prepare(`UPDATE password_reset_codes SET used = 1 WHERE id = ? AND used = 0`).bind(row.id).run();
  if (!consumed?.meta?.changes) return false;
  return (await H.sha256Hex(code)) === row.code;
}

// ---------- users / cards / promo ----------

// Foydalanuvchini BUTUNLAY o'chiradi (server/db.js adminDeleteUser porti) —
// admin o'chirgan akkauntning emaili bo'shab, qayta ro'yxatdan o'tish
// mumkin bo'ladi.
//
// 2026-09 TUZATISH: bu yerdagi eski izohda "qolganlari CASCADE" deyilgan
// edi va bu NOTO'G'RI — `posts`, `menu_items`, `products`, `card_gallery`
// va h.k. `cards` ga FK bilan bog'lanmagan (sxemada FK umuman yo'q),
// shuning uchun hech narsa cascade bo'lmaydi. Natijada kartalar
// o'chirilgach, ularning kontenti (postlar, menyu, galereya, MIJOZ
// LIDLARI) bazada qolib ketardi va o'sha KOD keyin boshqa odamga o'tsa,
// eski egasining ma'lumotlari yangi profilda ko'rinardi.
// Endi kontent `cardContentCleanupStmts()` orqali tozalanadi.
async function hardDeleteUser(env, userId) {
  const codeSelect = `SELECT code FROM cards WHERE user_id = ?`;
  await env.DB.batch([
    ...cardContentCleanupStmts(env, codeSelect, [userId], new Date().toISOString()),
    env.DB.prepare(`DELETE FROM physical_cards WHERE owner_user_id = ?`).bind(userId),
    env.DB.prepare(`DELETE FROM cards WHERE user_id = ?`).bind(userId),
    env.DB.prepare(`UPDATE bot_orders SET user_id = NULL WHERE user_id = ?`).bind(userId),
    env.DB.prepare(`UPDATE auctions SET highest_bidder_id = NULL WHERE highest_bidder_id = ?`).bind(userId),
    env.DB.prepare(`DELETE FROM users WHERE id = ?`).bind(userId),
  ]);
}

async function createUser(env, H, { email, passwordHash, phone, botAck, tosAccepted }) {
  return env.DB.prepare(
    `INSERT INTO users (email, password_hash, phone, bot_ack, tos_accepted, created_at) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (email) DO NOTHING RETURNING id, email`
  ).bind(email, passwordHash, phone || null, botAck ? 1 : 0, tosAccepted ? 1 : 0, H.nowTs()).first();
}

// Har yangi foydalanuvchiga avtomatik, bepul, 8 xonali ID — sovg'a qilib
// bo'lmaydi, asosiy (is_primary) profil. Legacy createFreeAutoId bilan bir xil.
async function createFreeAutoId(env, userId, name) {
  for (let i = 0; i < 8; i++) {
    const code = String(Math.floor(10_000_000 + Math.random() * 89_999_999));
    const row = await env.DB.prepare(
      // `source = 'registration_auto'` — kartaning ISHONCHLI manba belgisi.
      // Katalog aynan shu belgi bo'yicha bu ID'ni ro'yxat/qidiruv/filtr va
      // sanoqdan chiqarib tashlaydi (hosting/worker.js catalogVisibleSql).
      // Foydalanuvchining kabineti, public profili va Admin Panel
      // ta'sirlanmaydi.
      `INSERT INTO cards (code, name, theme, hashtags, price, ts, user_id, is_primary, giftable, source)
       VALUES (?, ?, 'classic', '[]', 0, ?, ?, 1, 0, 'registration_auto')
       ON CONFLICT (code) DO NOTHING RETURNING code`
    ).bind(code, name || 'Yangi foydalanuvchi', Date.now(), userId).first().catch(() => null);
    if (row?.code) return row.code;
  }
  return null;
}

function generatePromoCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  let s = '';
  for (const b of bytes) s += chars[b % chars.length];
  return s;
}

// Har yangi foydalanuvchiga o'ziga xos promokod (UNIQUE to'qnashsa qayta uriniladi).
async function assignPromoCode(env, userId) {
  for (let i = 0; i < 8; i++) {
    const row = await env.DB.prepare(
      `UPDATE users SET promo_code = ? WHERE id = ? AND promo_code IS NULL RETURNING promo_code`
    ).bind(generatePromoCode(), userId).first().catch(() => null);
    if (row?.promo_code) return row.promo_code;
  }
  return null;
}

async function getUserIdByPromoCode(env, promoCode) {
  const row = await env.DB.prepare(`SELECT id FROM users WHERE promo_code = ?`).bind(promoCode).first();
  return row?.id || null;
}

// Do'stining promokodi kiritilgan bo'lsa — taklif qiluvchiga 10% chegirma krediti.
async function applyReferral(env, referrerId, referredId) {
  if (referrerId === referredId) return false;
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO referral_uses (referrer_id, referred_id, created_at) VALUES (?, ?, ?)`).bind(referrerId, referredId, tsAt(Date.now())),
    env.DB.prepare(`UPDATE users SET pending_discount_pct = MIN(pending_discount_pct + 10, 100) WHERE id = ?`).bind(referrerId),
  ]);
  return true;
}

// ---------- route'lar ----------

async function requestRegisterCode(request, env, H) {
  const body = await request.json().catch(() => ({}));
  const phone = normPhone(body?.phone, H);
  if (!PHONE_RE.test(phone)) return H.json({ error: 'bad_phone' }, 422);

  const tgUserId = await getTgUserIdForPhone(env, phone);
  if (!tgUserId) return H.json({ error: 'phone_not_verified' }, 422);

  // D1 asosidagi limit: bir raqamga 10 daqiqada ko'pi bilan 3 ta kod.
  const recent = await countRecentPhoneOtps(env, phone, 'register', tsAt(Date.now() - REGISTER_OTP_WINDOW_MS));
  if (recent >= REGISTER_OTP_MAX) return H.json({ error: 'too_many_requests' }, 429);

  const code = await createPhoneOtpCode(env, H, phone, 'register');
  const sent = await H.sendTelegramTo(env, tgUserId, OTP_TEXT.register(code));
  if (!sent) return H.json({ error: 'tg_send_failed' }, 503);
  return H.json({ ok: true });
}

async function register(request, env, H) {
  const body = await request.json().catch(() => ({}));
  const { email, password, error } = validateAuthBody(body || {}, H);
  if (error) return H.json({ error }, 422);
  const extra = validateRegisterExtra(body || {}, H);
  if (extra.error) return H.json({ error: extra.error }, 422);

  // Haqiqiy tekshiruv: raqam botga "Kontaktni ulashish" orqali yuborilgan
  // bo'lishi shart — checkbox o'zi hech narsani isbotlamaydi.
  if (!(await getTgUserIdForPhone(env, extra.phone))) return H.json({ error: 'phone_not_verified' }, 422);

  // Email bandligini kodni ishlatishdan OLDIN tekshiramiz — aks holda
  // foydalanuvchi bekorga yangi kod so'rashiga to'g'ri keladi.
  const existing = await env.DB.prepare(`SELECT id, deleted_at FROM users WHERE email = ?`).bind(email).first();
  if (existing && !existing.deleted_at) return H.json({ error: 'email_taken' }, 409);

  // Bot orqali yuborilgan kod — raqam HAQIQATAN shu odamniki ekanini isbotlaydi.
  if (!(await verifyAndConsumePhoneOtpCode(env, H, extra.phone, extra.code, 'register'))) {
    return H.json({ error: 'bad_code' }, 422);
  }

  if (existing?.deleted_at) {
    // Admin o'chirgan akkaunt emaili — eski qator butunlay tozalanadi, jurnalga yoziladi.
    await hardDeleteUser(env, existing.id);
    await H.logAdminActivity(env, {
      action: 'user_deleted',
      details: `O'chirilgan email qayta ro'yxatdan o'tdi: ${email} (eski #${existing.id} tozalandi)`,
      ip: H.reqIp(request),
    });
  }

  const user = await createUser(env, H, {
    email, passwordHash: await H.hashPassword(password),
    phone: extra.phone, botAck: extra.botAck, tosAccepted: extra.tosAccepted,
  });
  if (!user) return H.json({ error: 'email_taken' }, 409);

  await createFreeAutoId(env, user.id, email.split('@')[0]);
  await assignPromoCode(env, user.id);

  const promoInput = H.cleanStr(body?.promoCode, 12).toUpperCase();
  if (promoInput) {
    const referrerId = await getUserIdByPromoCode(env, promoInput);
    if (referrerId) await applyReferral(env, referrerId, user.id);
  }

  const s = await H.createUserSession(env, user.id, request);
  return H.jsonWithCookie({ user: { id: user.id, email: user.email } }, 201, s.cookie);
}

// Parol tiklash so'rovi — foydalanuvchi bor-yo'qligi oshkor qilinmaydi:
// har doim {ok:true}. Kod faqat email mavjud, akkaunt o'chirilmagan va
// telefoni botda tasdiqlangan bo'lsa Telegram'ga yuboriladi.
async function requestPasswordReset(request, env, H) {
  const body = await request.json().catch(() => ({}));
  const email = H.cleanStr(body?.email, 120).toLowerCase();
  if (!EMAIL_RE.test(email)) return H.json({ error: 'Email formati noto’g’ri.' }, 422);

  const row = await env.DB.prepare(
    `SELECT u.id, u.deleted_at, bv.tg_user_id
     FROM users u LEFT JOIN bot_verifications bv ON bv.phone = u.phone
     WHERE u.email = ? ORDER BY bv.id DESC LIMIT 1`
  ).bind(email).first();
  if (!row || row.deleted_at || !row.tg_user_id) return H.json({ ok: true });

  // D1 asosidagi limit: 15 daqiqada ko'pi bilan 3 ta kod (jimgina o'tkazib yuboriladi).
  const recent = await countRecentResetCodes(env, row.id, tsAt(Date.now() - RESET_WINDOW_MS));
  if (recent >= RESET_MAX) return H.json({ ok: true });

  const code = await createPasswordResetCode(env, H, row.id);
  await H.sendTelegramTo(env, row.tg_user_id, OTP_TEXT.password_reset(code));
  return H.json({ ok: true });
}

async function resetPassword(request, env, H) {
  const body = await request.json().catch(() => ({}));
  const { email, password, error } = validateAuthBody(body || {}, H);
  if (error) return H.json({ error }, 422);
  const code = H.cleanStr(body?.code, 6);
  if (!/^\d{6}$/.test(code)) return H.json({ error: 'bad_code' }, 422);

  const user = await env.DB.prepare(`SELECT id FROM users WHERE email = ? AND deleted_at IS NULL`).bind(email).first();
  if (!user) return H.json({ error: 'bad_code' }, 422);
  if (!(await verifyAndConsumePasswordResetCode(env, H, user.id, code))) return H.json({ error: 'bad_code' }, 422);

  // Parol yangilanadi va BARCHA sessiyalar bekor qilinadi (o'g'irlangan cookie ham).
  await env.DB.batch([
    env.DB.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`).bind(await H.hashPassword(password), user.id),
    env.DB.prepare(`DELETE FROM sessions WHERE user_id = ?`).bind(user.id),
  ]);
  return H.json({ ok: true });
}

export async function handle(request, env, url, H) {
  if (request.method !== 'POST') return null;
  switch (url.pathname) {
    case '/api/auth/request-register-code': return requestRegisterCode(request, env, H);
    case '/api/auth/register': return register(request, env, H);
    case '/api/auth/request-password-reset': return requestPasswordReset(request, env, H);
    case '/api/auth/reset-password': return resetPassword(request, env, H);
    default: return null;
  }
}
