import { cardContentCleanupStmts } from './card-cleanup.js';
// hosting/api/auth.js — ro'yxatdan o'tish (Telegram OTP) va parolni tiklash.
// CONTRACT.md ga qarang. Route topilmasa null qaytaradi.
//
// Javob shakllari server/index.js (Express) bilan BIR XIL — frontend
// src/pages/AuthPage.jsx + src/lib/auth.jsx shunga bog'langan:
//   POST /api/auth/request-register-code {email}|{phone} → {ok:true,channel:'email'|'telegram'|'none'}
//                                                        | 422 {error:'bad_phone'|'phone_not_verified'} | 429
//                                                        | 503 {error:'email_send_failed'|'tg_send_failed'}
//   POST /api/auth/tg-link/start                        → {token,url} | 429 | 503 {error:'bot_not_configured'}
//   GET  /api/auth/tg-link/status?token=                → {status:'pending'|'linked'|'expired', phone?}
//   POST /api/auth/register {email,emailCode,password,phone,tosAccepted,promoCode,
//                            linkToken}  ← yangi, tugmali oqim
//                           {…,code,botAck}  ← eski, kodli oqim (hali qabul qilinadi)
//                                                        → 201 {user:{id,email}} + Set-Cookie | 422 | 409 {error:'email_taken'}
//   POST /api/auth/request-password-reset {email}        → doim {ok:true} (foydalanuvchi bor-yo'qligi oshkor qilinmaydi)
//   POST /api/auth/reset-password {email,password, linkToken | code}  → {ok:true} | 422 {error:'bad_code'|matn}
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

// EMAILGA yuboriladigan kod xati. Telegram matnidan farqli: HTML,
// va kod KATTA qilib ko'rsatiladi — odam uni pochta ilovasidan
// ko'chirib olishi kerak.
function emailCodeHtml(H, { title, intro, code, ttlText }) {
  return H.emailShellD1({
    title,
    body: `<p style="margin:0 0 14px">${intro}</p>`
      + `<div style="margin:0;padding:16px 0;text-align:center;background:#0f0f12;border:1px solid #2a2a30;border-radius:12px">`
      + `<span style="font:700 30px/1 'Courier New',monospace;letter-spacing:.22em;color:#e8c977">${code}</span></div>`,
    footer: `${ttlText} Bu kodni HECH KIMGA bermang \u2014 NFCSTORE xodimlari ham uni hech qachon so\u2018ramaydi.`
      + `<br />Agar bu siz bo\u2018lmasangiz, xatni e\u2019tiborsiz qoldiring.`,
  });
}

const EMAIL_OTP_TEXT = {
  register: (code) => ({
    subject: 'NFCSTORE — ro\u2018yxatdan o\u2018tish kodi: ' + code,
    intro: 'NFCSTORE\u2019da ro\u2018yxatdan o\u2018tishni yakunlash uchun quyidagi kodni kiriting:',
    title: 'Ro\u2018yxatdan o\u2018tish kodi',
    ttl: 'Kod 5 daqiqa ichida amal qiladi.',
  }),
  password_reset: (code) => ({
    subject: 'NFCSTORE — parolni o\u2018zgartirish kodi: ' + code,
    intro: 'Parolingizni o\u2018zgartirish uchun quyidagi kodni kiriting:',
    title: 'Parolni o\u2018zgartirish kodi',
    ttl: 'Kod 10 daqiqa ichida amal qiladi.',
  }),
};

// ---------- kichik yordamchilar ----------

// Bot username'i: bo'sh joy va boshidagi "@" olib tashlanadi.
// `hosting/api/telegram.js` dagi nusxasi bilan bir xil bo'lishi shart
// (ikkalasi ham shu qiymatdan havola yasaydi).
export function tgUsername(env) {
  return String(env?.TELEGRAM_BOT_USERNAME || '').trim().replace(/^@+/, '');
}

// nowTs() formatida ("YYYY-MM-DD HH:MM:SS.mmm+00") — jadval ustunlari bilan
// lexikografik solishtirish to'g'ri ishlashi uchun.
const tsAt = (ms) => new Date(ms).toISOString().replace('T', ' ').replace('Z', '+00');

// Telefon: legacy kabi bo'sh joy/chiziq/qavs olib tashlanadi.
// Telefon YAGONA ko'rinishga keltiriladi: "+998901234567".
//
// Avval bu funksiya faqat bo'shliq/chiziq/qavsni olib tashlardi va "+"
// qo'shmasdi. Natijada odam "998901234567" deb yozsa, baza shu holda
// saqlardi; kirishda esa raqam "+998..." ga keltirilardi va qator
// TOPILMASDI - odam o'z akkauntiga kira olmay qolardi. Bot ham raqamni
// doim "+" bilan yozadi, ya'ni Telegram ulash ham mos kelmasdi.
const normPhone = (v, H) => H.normalizePhoneD1(v);

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

// ═══════════════════════════════════════════════════════════════════════
// EMAILSIZ AKKAUNT (2026-09)
//
// Endi ro'yxatdan o'tishda TELEFON majburiy, email esa ixtiyoriy —
// O'zbekistonda ko'p odam email ishlatmaydi va uni so'rash bekorga
// to'siq bo'lardi.
//
// Lekin `users.email` ustuni bazada `NOT NULL UNIQUE`. Uni bo'sh
// qilinadigan holga keltirish SQLite'da jadvalni QAYTA QURISHNI talab
// qiladi — bu ishlab turgan bazada xavfli amal va bu yerda qilinmaydi.
//
// Shuning uchun emailsiz akkauntga TASHQARIGA CHIQMAYDIGAN ichki manzil
// yoziladi: p998901234567@nfcstore.local. Bu manzil:
//   * hech qachon foydalanuvchiga ko'rsatilmaydi (`publicEmail()`);
//   * hech qachon xat yuborilmaydi (.local domeni marshrutlanmaydi);
//   * telefon bo'yicha YAGONALIKNI bepul ta'minlaydi — bir raqamga
//     ikkinchi emailsiz akkaunt ochib bo'lmaydi (UNIQUE ishlaydi).
// Amalga oshirilishi hosting/worker.js da (yagona manba) va `H` orqali
// keladi — ikki nusxa bo'lsa, vaqt o'tib biri o'zgarib qolardi.

// Ro'yxatdan o'tishga xos qo'shimcha tekshiruv: telefon, "botga yozdim" va
// oferta tasdig'i, tasdiqlash kodi — barchasi majburiy (legacy bilan bir xil).
function validateRegisterExtra(body, H) {
  const phone = normPhone(body.phone, H);
  const tosAccepted = body.tosAccepted === true;
  const linkToken = H.cleanStr(body.linkToken, 64);
  if (!PHONE_RE.test(phone)) return { error: 'Telefon raqamini to’g’ri kiriting (masalan +998901234567).' };
  if (!tosAccepted) return { error: 'Davom etish uchun ommaviy oferta shartlariga rozilik bering.' };
  // Telegram tasdig'i endi ro'yxatdan o'tishda TALAB QILINMAYDI (2026-09).
  //
  // Nega: "Telegram" so'zining o'zi ro'yxatdan o'tish formasida to'siq
  // bo'lib ko'rinardi va odamlar shu joyda to'xtardi. Tasdiqlash endi
  // kabinetdagi "Profilingizni himoyalang" bo'limida — u yerda u to'siq
  // emas, IMTIYOZ bo'lib ko'rinadi (parolni tiklash va xabarlar shunga
  // bog'liq).
  //
  // Token YUBORILGAN bo'lsa (masalan kelajakdagi boshqa oqimdan) u
  // qabul qilinadi va raqam tokendan olinadi — bu qat'iyroq tekshiruv.
  return { phone, tosAccepted, linkToken, botAck: !!linkToken, code: '' };
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

// ---------- email_otp_codes (emailga yuborilgan kodlar) ----------
//
// Tuzilishi telefon kodlariniki bilan ataylab bir xil: ikkala kanal
// ham bir xil qoidalarga bo'ysunadi (kod hash bo'lib saqlanadi, bitta
// urinish, tezlik cheklovi).

async function countRecentEmailOtps(env, email, purpose, sinceTs) {
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM email_otp_codes WHERE email = ? AND purpose = ? AND created_at > ?`
  ).bind(email, purpose, sinceTs).first();
  return Number(row?.n || 0);
}

async function createEmailOtpCode(env, H, email, purpose, ttlMs) {
  const code = sixDigitCode();
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO email_otp_codes (email, code, purpose, expires_at, used, created_at) VALUES (?, ?, ?, ?, 0, ?)`
  ).bind(email, await H.sha256Hex(code), purpose, tsAt(now + ttlMs), tsAt(now)).run();
  return code;
}

// Eng so'nggi faol kodni tekshiradi va ISHLATILGAN deb belgilaydi. Kod
// noto'g'ri bo'lsa ham o'sha kod kuydiriladi — 6 xonali kodni taxmin
// qilib bo'lmasin (har kodga 1 urinish, kod olish esa cheklangan).
async function verifyAndConsumeEmailOtpCode(env, H, email, code, purpose) {
  const row = await env.DB.prepare(
    `SELECT id, code FROM email_otp_codes WHERE email = ? AND purpose = ? AND used = 0 AND expires_at > ?
     ORDER BY id DESC LIMIT 1`
  ).bind(email, purpose, H.nowTs()).first();
  if (!row) return false;
  const consumed = await env.DB.prepare(`UPDATE email_otp_codes SET used = 1 WHERE id = ? AND used = 0`).bind(row.id).run();
  if (!consumed?.meta?.changes) return false; // parallel so'rov allaqachon ishlatgan
  return (await H.sha256Hex(code)) === row.code;
}

// Kodni emailga yuboradi. Natijani BUTUNLIGICHA qaytaradi — chaqiruvchi
// xato sababini javobga qo'sha olishi uchun.
async function sendEmailOtp(env, H, email, purpose, code) {
  const t = EMAIL_OTP_TEXT[purpose](code);
  return H.sendEmailD1(env, {
    to: email,
    subject: t.subject,
    html: emailCodeHtml(H, { title: t.title, intro: t.intro, code, ttlText: t.ttl }),
    text: `${t.intro}\n\n${code}\n\n${t.ttl}`,
  });
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

// Akkaunt ochish uchun SHART bo'lgan ustunlar soni. Qolganlari
// ixtiyoriy va ular yo'q bo'lsa ham ro'yxat ishlayveradi.
const BASE_USER_COLS = 6;

async function createUser(env, H, { email, passwordHash, phone, botAck, tosAccepted, source }) {
  // Ustunlar RO'YXAT sifatida yig'iladi. Ilgari bu yerda ikkita
  // to'liq INSERT yozilgan edi (sinov ustuni bor/yo'q holatlari
  // uchun) — har yangi ixtiyoriy ustun ularning sonini ikki
  // barobar oshirardi va biri yangilanmay qolib ketishi oson edi.
  const cols = ['email', 'password_hash', 'phone', 'bot_ack', 'tos_accepted', 'created_at'];
  const vals = [email, passwordHash, phone || null, botAck ? 1 : 0, tosAccepted ? 1 : 0, H.nowTs()];

  // 30 KUNLIK SINOV (2026-09). Yangi hisob birinchi oy davomida barcha
  // pullik imkoniyatlardan foydalanadi. Muddat tugagach tarifga
  // qaytadi. Ustun bo'lmasa (juda eski baza) — yozilmaydi, hisob
  // avvalgidek ochiladi: sinov "qo'shimcha", "shart" emas.
  if (H.usersHaveTrialColumnsD1 && H.usersHaveTrialColumnsD1()) {
    cols.push('trial_expires_at');
    vals.push(H.trialEndsAtD1());
  }

  // RO'YXATDAN O'TISH MANBASI — "web" yoki "android"/"ios"/"app".
  // Xuddi sinov ustuni kabi: bo'lmasa yozilmaydi va ro'yxatdan o'tish
  // baribir ishlayveradi. Statistika hech qachon akkaunt ochilishiga
  // to'siq bo'lmasligi kerak.
  if (H.usersHaveSignupSourceD1 && H.usersHaveSignupSourceD1()) {
    cols.push('signup_source');
    vals.push(source || 'web');
  }

  const insert = (c, v) => env.DB.prepare(
    `INSERT INTO users (${c.join(', ')}) VALUES (${c.map(() => '?').join(', ')})
     ON CONFLICT (email) DO NOTHING RETURNING id, email`
  ).bind(...v).first();

  try {
    return await insert(cols, vals);
  } catch (err) {
    // IXTIYORIY USTUNLAR RO'YXATNI TO'XTATMASIN.
    //
    // `trial_expires_at` va `signup_source` — "qo'shimcha": biri
    // sinov muddati, ikkinchisi statistika. Ularsiz ham akkaunt
    // to'liq ishlaydi. Lekin ustun bazada yo'q bo'lib qolsa (qo'lda
    // o'chirilgan, ALTER o'tmagan, kesh eskirgan) INSERT butunlay
    // yiqilardi va ODAM RO'YXATDAN O'TA OLMASDI — bu test bilan
    // aniqlandi.
    //
    // Shuning uchun bir marta ASOSIY ustunlar bilan qayta uriniladi.
    // Xato boshqa sababdan bo'lsa (bazaga yozib bo'lmayapti) bu
    // urinish ham yiqiladi va xato yuqoriga chiqadi — ya'ni haqiqiy
    // muammo yashirilmaydi.
    if (cols.length === BASE_USER_COLS) throw err;
    console.error('createUser ixtiyoriy ustunsiz qayta urinish:', err?.message || err);
    return insert(cols.slice(0, BASE_USER_COLS), vals.slice(0, BASE_USER_COLS));
  }
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

// ---------- tg_link_tokens: BIR BOSISHDA bog'lanish ----------
//
// Eski oqim: bot 6 xonali kod yuborardi, odam uni SAYTGA YOZARDI.
// Bu firibgarlik sxemasining aynan ko'rinishi — odamlarga "Telegramga
// kelgan kodni hech kimga bermang" deb to'g'ri o'rgatilgan, biz esa
// xuddi shuni so'rar edik. Natijada odamlar qo'rqib ketardi.
//
// Yangi oqim TESKARI yo'nalishda:
//   1. sayt bir martalik token yaratadi va t.me/<bot>?start=<token>
//      havolasini beradi;
//   2. odam botga o'tadi, "Boshlash" va "Kontaktni ulashish" tugmasini
//      bosadi — bot tokenni telefon raqamiga bog'laydi;
//   3. sayt holatni so'rab turadi va o'zi davom etadi.
//
// Telegramdan saytga HECH QANDAY sir ko'chmaydi. Ya'ni bizdan "kod
// ayting" degan so'rov chiqmaydi va odamga shuni ochiq aytish mumkin.
const TG_LINK_TTL_MS = 15 * 60 * 1000;   // 15 daqiqa — botga o'tib qaytishga yetadi
const TG_LINK_IP_MAX = 10;               // bitta IP 15 daqiqada 10 ta token
const TG_LINK_WINDOW_MS = 15 * 60 * 1000;

// Token bazada XESH holida yotadi (kod/parol kabi): bazani o'qigan odam
// tayyor havolani yig'a olmasin.
async function createTgLinkToken(env, H) {
  const token = H.newToken(16);
  const now = Date.now();
  // Eski yozuvlar vaqti-vaqti bilan tozalanadi — jadval o'smasin.
  if (Math.random() < 0.05) {
    await env.DB.prepare(`DELETE FROM tg_link_tokens WHERE expires_at < ?`).bind(now).run().catch(() => {});
  }
  await env.DB.prepare(
    `INSERT INTO tg_link_tokens (token, status, expires_at, created_at) VALUES (?, 'pending', ?, ?)`
  ).bind(await H.sha256Hex(token), now + TG_LINK_TTL_MS, now).run();
  return token;
}

async function getTgLinkRow(env, H, token) {
  const clean = H.cleanStr(token, 64);
  if (!/^[0-9a-f]{32}$/.test(clean)) return null;
  const row = await env.DB.prepare(
    `SELECT token, status, phone, tg_user_id FROM tg_link_tokens WHERE token = ? AND expires_at > ?`
  ).bind(await H.sha256Hex(clean), Date.now()).first();
  return row || null;
}

async function startTgLink(request, env, H) {
  if (await H.rateLimitD1(env, 'tglink:ip:' + H.reqIp(request), TG_LINK_IP_MAX, TG_LINK_WINDOW_MS)) {
    return H.json({ error: 'too_many_requests' }, 429);
  }
  // `@` OLIB TASHLANADI. Telegram bot username'ini hamma joyda "@" bilan
  // ko'rsatadi (BotFather ham, botning o'zi ham), shuning uchun uni
  // sozlamaga ham "@nfcsalebot" deb yozib qo'yish juda tabiiy. Havola
  // esa "t.me/@nfcsalebot" bo'lib buziladi va tugma jim ishlamay
  // qoladi — xato ham chiqmaydi, shunchaki ochilmaydi.
  //
  // Egasi aynan shunday yozdi. Sozlamani to'g'rilashni talab qilish
  // o'rniga kod ikkala ko'rinishni ham qabul qiladi.
  const username = tgUsername(env);
  if (!username) return H.json({ error: 'bot_not_configured' }, 503);
  const token = await createTgLinkToken(env, H);
  return H.json({ token, url: `https://t.me/${username}?start=${token}` });
}

// Sayt shu manzilni so'rab turadi. Javob ATAYLAB kam narsa aytadi:
// bog'langan bo'lsa — raqam (odam uni ko'rib, o'ziniki ekaniga ishonch
// hosil qilsin), aks holda faqat "kutilmoqda".
async function tgLinkStatus(request, env, H, url) {
  const row = await getTgLinkRow(env, H, url.searchParams.get('token'));
  if (!row) return H.json({ status: 'expired' });
  if (row.status !== 'linked') return H.json({ status: 'pending' });
  return H.json({ status: 'linked', phone: row.phone || '' });
}

// ---------- route'lar ----------

// RO'YXATDAN O'TISH KODI — endi EMAILGA.
//
// Egasining qarori: "ro'yxatdan o'tishda emailga kod kelsin, lekin
// telefon raqam ham yozilsin; telefonni ichkarida (sozlamalarda) TG
// bot orqali tasdiqlasin".
//
// Nima uchun email BIRINCHI kanal: Telegram kodini olish uchun odam
// AVVAL botga kirib kontaktini ulashi kerak edi — ya'ni ro'yxatdan
// o'tishdan oldin butunlay boshqa ilovada ish bajarishi kerak edi.
// Email esa hammada bor va hech qanday oldindan tayyorgarlik
// talab qilmaydi.
//
// Telefon/Telegram yo'li OLIB TASHLANMADI: email xizmati o'chirilgan
// yoki xat ketmagan bo'lsa, eski yo'l zaxira sifatida ishlaydi.
// Javobdagi `channel` frontendga kod QAYERGA ketganini aytadi.
async function requestRegisterCode(request, env, H) {
  const body = await request.json().catch(() => ({}));
  const email = H.cleanStr(body?.email, 120).toLowerCase();

  // Email yozilgan, lekin xizmat O'CHIQ: kod umuman kerak emas
  // (`register` ham o'sha holatda kod so'ramaydi). Frontendga shuni
  // ochiq aytamiz — aks holda u Telegram yo'liga tushib, botni
  // ulamagan odamga "phone_not_verified" degan chalkash xato
  // ko'rsatilardi.
  if (email && EMAIL_RE.test(email) && !H.emailEnabledD1(env)) {
    return H.json({ ok: true, channel: 'none' });
  }

  if (email && EMAIL_RE.test(email) && H.emailEnabledD1(env)) {
    // Limit EMAIL bo'yicha: bitta manzilga 10 daqiqada 3 ta kod.
    const recent = await countRecentEmailOtps(env, email, 'register', tsAt(Date.now() - REGISTER_OTP_WINDOW_MS));
    if (recent >= REGISTER_OTP_MAX) return H.json({ error: 'too_many_requests' }, 429);
    // Begona manzilga xat yog'dirmaslik uchun IP bo'yicha ham cheklov.
    if (await H.rateLimitD1(env, 'regcode:ip:' + H.reqIp(request), 10, REGISTER_OTP_WINDOW_MS)) {
      return H.json({ error: 'too_many_requests' }, 429);
    }
    const code = await createEmailOtpCode(env, H, email, 'register', REGISTER_OTP_TTL_MS);
    const sent = await sendEmailOtp(env, H, email, 'register', code);
    if (!sent?.ok) {
      // SABAB javobga qo'shiladi. Bu MAXFIY EMAS: `reason` faqat
      // "http_403" kabi holat kodi yoki "network"/"bad_address" —
      // Resend javobining matni ham, kalit ham bu yerga tushmaydi.
      //
      // Nima uchun kerak: xato faqat Cloudflare loglarida qolganda
      // sababni topish uchun har safar terminal ochish kerak bo'ladi.
      // Holat kodi esa o'zi aytadi: 401 — kalit noto'g'ri, 403 —
      // yuborishga ruxsat yo'q (masalan jo'natuvchi tasdiqlanmagan
      // manzil), 422 — `from` formati noto'g'ri.
      // Sabab sifatida faqat HOLAT KODI qaytariladi ("http_400").
      // Resend'ning to'liq matni `console.error` ga ketadi — uni
      // ochiq endpointda doimiy ko'rsatib turishning hojati yo'q.
      //
      // DIQQAT, kelajak uchun: Resend NOTO'G'RI API KALIT uchun ham
      // 401 emas, 400 qaytaradi ("API key is invalid"). Ya'ni
      // "400 = so'rov formati noto'g'ri" deb o'ylash xato — kalitni
      // ham tekshirish kerak. Aynan shu bir necha urinishni yeb
      // qo'ygan edi.
      return H.json({ error: 'email_send_failed', reason: sent?.reason || 'unknown' }, 503);
    }
    return H.json({ ok: true, channel: 'email' });
  }

  // ---- Zaxira yo'l: Telegram (eski oqim, bitma-bit avvalgidek) ----
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
  return H.json({ ok: true, channel: 'telegram' });
}

// Ro'yxatdan o'tish. 2026-09 dan beri: TELEFON majburiy, EMAIL ixtiyoriy,
// Telegram tasdig'i esa umuman talab qilinmaydi (validateRegisterExtra
// izohiga qarang). MAVJUD AKKAUNTLARGA HECH QANDAY TA'SIRI YO'Q — bu yo'l
// faqat yangi qatorlar yaratadi, eski qatorlar va ularning parollari
// tegilmaydi.
async function register(request, env, H) {
  const body = await request.json().catch(() => ({}));
  const password = typeof body?.password === 'string' ? body.password : '';
  if (password.length < 6) return H.json({ error: 'Parol kamida 6 belgidan iborat bo’lishi kerak.' }, 422);

  const extra = validateRegisterExtra(body || {}, H);
  if (extra.error) return H.json({ error: extra.error }, 422);

  // TEZLIK CHEKLOVI. Ilgari ro'yxatdan o'tishda Telegram tasdig'i to'siq
  // bo'lib turardi; endi u yo'q, ya'ni bitta skript minglab akkaunt ochib
  // tashlashi mumkin edi. Bitta IP - soatiga 5 ta akkaunt.
  if (await H.rateLimitD1(env, 'register:ip:' + H.reqIp(request), 5, 60 * 60_000)) {
    return H.json({ error: 'too_many_requests' }, 429);
  }

  // EMAIL VA UNING KODI.
  //
  // Egasining qarori: ro'yxatdan o'tishda kod EMAILGA keladi. Demak
  // email endi majburiy va u TASDIQLANGAN bo'lishi kerak.
  //
  // Lekin bu FAQAT email xizmati yoqilgan bo'lsa amal qiladi. Xizmat
  // o'chiq bo'lsa (kalit tugadi, Resend uzildi) eski qoida ishlaydi:
  // email ixtiyoriy, kod so'ralmaydi. Egasining tanlovi shu edi —
  // "ro'yxat to'xtamasin". Aks holda xizmatdagi bitta uzilish butun
  // sayt uchun yangi mijozlarni yopib qo'yardi.
  const emailOn = H.emailEnabledD1(env);
  const rawEmail = H.cleanStr(body?.email, 120).toLowerCase();
  if (rawEmail && !EMAIL_RE.test(rawEmail)) return H.json({ error: 'Email formati noto’g’ri.' }, 422);
  if (emailOn && !rawEmail) return H.json({ error: 'email_required' }, 422);
  const email = rawEmail || H.placeholderEmailForD1(extra.phone);

  if (emailOn) {
    const emailCode = H.cleanStr(body?.emailCode, 6);
    if (!emailCode) return H.json({ error: 'email_code_required' }, 422);
    if (!(await verifyAndConsumeEmailOtpCode(env, H, rawEmail, emailCode, 'register'))) {
      return H.json({ error: 'bad_email_code' }, 422);
    }
  }

  // Token yuborilgan bo'lsa — raqam FORMDAN emas, TOKENDAN tasdiqlanadi.
  if (extra.linkToken) {
    const link = await getTgLinkRow(env, H, extra.linkToken);
    if (!link || link.status !== 'linked' || !link.phone) return H.json({ error: 'link_not_confirmed' }, 422);
    if (link.phone !== extra.phone) return H.json({ error: 'link_phone_mismatch' }, 422);
  }

  // TELEFON YAGONALIGI. Ustunda UNIQUE yo'q (eski bazada takror raqamlar
  // bo'lishi mumkin va uni majburlab qo'yish ishlab turgan ma'lumotni
  // buzardi), shuning uchun tekshiruv shu yerda. O'chirilgan akkauntlar
  // hisobga olinmaydi — ularning raqami qayta ishlatilishi mumkin.
  const phoneTaken = await env.DB.prepare(
    `SELECT id FROM users WHERE phone = ? AND deleted_at IS NULL LIMIT 1`
  ).bind(extra.phone).first();
  if (phoneTaken) return H.json({ error: 'phone_taken' }, 409);

  const existing = await env.DB.prepare(`SELECT id, deleted_at FROM users WHERE email = ?`).bind(email).first();
  if (existing && !existing.deleted_at) {
    // Ichki (ko'rinmas) manzil band bo'lsa, sabab email emas — TELEFON.
    // Odamga "email band" deyish chalkash bo'lardi.
    return H.json({ error: H.isPlaceholderEmailD1(email) ? 'phone_taken' : 'email_taken' }, 409);
  }

  if (extra.linkToken) {
    const burned = await env.DB.prepare(`DELETE FROM tg_link_tokens WHERE token = ?`)
      .bind(await H.sha256Hex(extra.linkToken)).run();
    if (!burned?.meta?.changes) return H.json({ error: 'link_not_confirmed' }, 422);
  }

  return finishRegistration(request, env, H, { email, password, extra, existing, body });
}

// Ro'yxatdan o'tishning OXIRGI qismi — tasdiqlash usuli (token yoki kod)
// tekshirilgandan KEYIN bajariladi. Ikki yo'l uchun bitta joyda turadi:
// nusxa bo'lsa, vaqt o'tib biri o'zgarib, ikkinchisi eskirib qolardi.
async function finishRegistration(request, env, H, { email, password, extra, existing, body }) {
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
    // Sayt orqalimi yoki Android ilova orqalimi — `X-Client`
    // sarlavhasidan aniqlanadi (izohi worker.js `signupSourceD1` da).
    source: H.signupSourceD1 ? H.signupSourceD1(request) : 'web',
  });
  if (!user) return H.json({ error: 'email_taken' }, 409);

  // Karta nomi HAQIQIY emaildan olinadi. Ichki (ko'rinmas) manzil bo'lsa
  // undan nom yasash mumkin emas - aks holda kartada
  // "p998907770001" degan yozuv turardi.
  await createFreeAutoId(env, user.id, H.isPlaceholderEmailD1(email) ? '' : email.split('@')[0]);
  await assignPromoCode(env, user.id);

  const promoInput = H.cleanStr(body?.promoCode, 12).toUpperCase();
  if (promoInput) {
    const referrerId = await getUserIdByPromoCode(env, promoInput);
    if (referrerId) await applyReferral(env, referrerId, user.id);
  }

  const s = await H.createUserSession(env, user.id, request);
  // MOBIL: login bilan bir xil naqsh — `X-Client: mobile` bo'lsa token
  // javob tanasida ham qaytadi, aks holda javob avvalgidek qoladi.
  // Shunda ilova ro'yxatdan o'tgandan keyin darhol kirgan holatda
  // bo'ladi va qayta login so'ralmaydi.
  // MOBIL ILOVA: token javob TANASIDA qaytadi.
  //
  // `mobile` dan tashqari `android` va `ios` ham qabul qilinadi:
  // ilova bu sarlavhada o'z platformasini yozadi (ro'yxatdan o'tish
  // manbasi admin "Trafik" bo'limida shundan ajratiladi). Ilgari
  // faqat `mobile` tekshirilardi va Android ilova to'g'ri manba
  // yuborganida tokensiz qolardi.
  //
  // Veb uchun HECH NARSA o'zgarmaydi: brauzer bu sarlavhani umuman
  // yubormaydi, demak javobi bitma-bit avvalgidek.
  const wantsToken = H.isMobileClientD1(request);
  return H.jsonWithCookie({
    user: { id: user.id, email: H.publicEmailD1(user.email) },
    ...(wantsToken ? { token: s.token } : {}),
  }, 201, s.cookie);
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
  // Akkaunt EMAIL yoki TELEFON bilan topiladi: emailsiz ro'yxatdan
  // o'tgan odamda email umuman yo'q, u faqat raqamini biladi.
  const login = H.cleanStr(body?.email ?? body?.login, 120).toLowerCase();
  const password = typeof body?.password === 'string' ? body.password : '';
  if (password.length < 6) return H.json({ error: 'Parol kamida 6 belgidan iborat bo’lishi kerak.' }, 422);

  // ── EMAIL HAVOLASI ORQALI (2026-09) ────────────────────────────────
  // Token o'zi qaysi akkaunt ekanini biladi, shuning uchun bu yo'l
  // login/telefon maydonini UMUMAN talab qilmaydi va boshqa
  // tekshiruvlardan oldin hal qilinadi.
  const emailTokenEarly = H.cleanStr(body?.emailToken, 96);
  if (emailTokenEarly) {
    const ip0 = H.reqIp(request);
    if (await H.rateLimitD1(env, `emailresetuse:${ip0}`, 10, 60 * 60_000)) return H.json({ error: 'rate_limited' }, 429);
    const userId = await burnEmailResetToken(env, H, emailTokenEarly);
    if (!userId) return H.json({ error: 'link_expired' }, 422);
    const hash = await H.hashPassword(password);
    await env.DB.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`).bind(hash, userId).run();
    // Boshqa qurilmalardagi ochiq sessiyalar YOPILADI: parol
    // o'zgargach, eski sessiya ochiq qolishi mumkin emas.
    await env.DB.prepare(`DELETE FROM sessions WHERE user_id = ?`).bind(userId).run();
    return H.json({ ok: true });
  }

  const asPhone = H.normalizePhoneD1(login);
  const isEmail = EMAIL_RE.test(login);
  if (!isEmail && !asPhone) return H.json({ error: 'bad_login' }, 422);
  const code = H.cleanStr(body?.code, 6);
  const linkToken = H.cleanStr(body?.linkToken, 64);
  // Email havolasi yuqorida hal qilindi; bu yerga faqat Telegram yoki
  // kod yo'li bilan kelinadi.
  if (!linkToken && !/^\d{6}$/.test(code)) return H.json({ error: 'bad_code' }, 422);

  const user = isEmail
    ? await env.DB.prepare(`SELECT id, phone FROM users WHERE email = ? AND deleted_at IS NULL`).bind(login).first()
    : await env.DB.prepare(
      `SELECT id, phone FROM users WHERE phone = ? AND deleted_at IS NULL ORDER BY id ASC LIMIT 1`
    ).bind(asPhone).first();
  if (!user) return H.json({ error: 'bad_code' }, 422);

  if (linkToken) {
    // YANGI YO'L: kod yozilmaydi. Odam botda "Kontaktni ulashish" ni
    // bosadi va Telegram raqamni O'ZI tasdiqlaydi. Shu raqam akkauntdagi
    // raqam bilan mos kelsa — parolni yangilashga haqli.
    //
    // Nega bu xavfsiz: raqam mijozdan emas, Telegramdan keladi; token
    // bir martalik va 15 daqiqada kuyadi; akkauntda raqam yo'q bo'lsa
    // bu yo'l umuman ochilmaydi.
    const link = await getTgLinkRow(env, H, linkToken);
    if (!link || link.status !== 'linked' || !link.phone) return H.json({ error: 'link_not_confirmed' }, 422);
    if (!user.phone || normPhone(user.phone, H) !== link.phone) return H.json({ error: 'link_phone_mismatch' }, 422);
    const burned = await env.DB.prepare(`DELETE FROM tg_link_tokens WHERE token = ?`)
      .bind(await H.sha256Hex(linkToken)).run();
    if (!burned?.meta?.changes) return H.json({ error: 'link_not_confirmed' }, 422);
  } else if (!(await verifyAndConsumePasswordResetCode(env, H, user.id, code))) {
    return H.json({ error: 'bad_code' }, 422);
  }

  // Parol yangilanadi va BARCHA sessiyalar bekor qilinadi (o'g'irlangan cookie ham).
  await env.DB.batch([
    env.DB.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`).bind(await H.hashPassword(password), user.id),
    env.DB.prepare(`DELETE FROM sessions WHERE user_id = ?`).bind(user.id),
  ]);
  return H.json({ ok: true });
}

// ── EMAIL ORQALI PAROL TIKLASH (2026-09) ─────────────────────────────
//
// Telegram yo'liga QO'SHIMCHA, uning o'rniga emas: emailsiz ro'yxatdan
// o'tganlar avvalgidek botdan foydalanadi, emaili borlar esa pochtadan
// havola oladi.
//
// XAVFSIZLIK QOIDALARI:
//  1. AKKAUNT BORLIGI OSHKOR QILINMAYDI. Manzil bazada bo'lsa ham,
//     bo'lmasa ham javob BIR XIL ({ok:true}) — aks holda bu forma
//     "qaysi email ro'yxatdan o'tgan" degan tekshirgichga aylanardi.
//  2. Token XESHLANIB saqlanadi, bir martalik, 30 daqiqada kuyadi.
//  3. Tezlik cheklovi: bitta manzilga soatiga 3 marta, bitta IP dan
//     soatiga 10 marta.
const EMAIL_RESET_TTL_MS = 30 * 60 * 1000;

async function requestEmailReset(request, env, H) {
  const body = await request.json().catch(() => ({}));
  const email = H.cleanStr(body?.email, 120).toLowerCase();
  const ok = () => H.json({ ok: true });
  if (!EMAIL_RE.test(email)) return H.json({ error: 'bad_login' }, 422);

  const ip = H.reqIp(request);
  if (await H.rateLimitD1(env, `emailreset:ip:${ip}`, 10, 60 * 60_000)) return H.json({ error: 'rate_limited' }, 429);
  if (await H.rateLimitD1(env, `emailreset:to:${email}`, 3, 60 * 60_000)) return ok();
  if (!H.emailEnabledD1(env)) return ok();

  // Placeholder email (raqam bilan ro'yxatdan o'tganlar) hech qachon
  // haqiqiy manzil emas — u orqali tiklash yo'li ochilmaydi.
  if (H.isPlaceholderEmailD1(email)) return ok();
  const user = await env.DB.prepare(
    `SELECT id FROM users WHERE email = ? AND deleted_at IS NULL`,
  ).bind(email).first();
  if (!user) return ok();

  const token = H.newToken(32);
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO email_reset_tokens (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)`,
  ).bind(await H.sha256Hex(token), user.id, new Date(now + EMAIL_RESET_TTL_MS).toISOString(), new Date(now).toISOString()).run();

  const origin = new URL(request.url).origin;
  const link = `${origin}/login?reset=${encodeURIComponent(token)}`;
  await H.sendEmailD1(env, {
    to: email,
    subject: 'NFCSTORE — parolni tiklash',
    html: H.emailShellD1({
      title: 'Parolni tiklash',
      body: 'Quyidagi tugmani bosing va yangi parol qo‘ying. Havola <b>30 daqiqa</b> amal qiladi va bir marta ishlaydi.',
      buttonLabel: 'Yangi parol qo‘yish',
      buttonUrl: link,
      footer: 'Agar bu so‘rovni siz yubormagan bo‘lsangiz, bu xatni e’tiborsiz qoldiring — parolingiz o‘zgarmaydi.',
    }),
    text: `Parolni tiklash: ${link}\n\nHavola 30 daqiqa amal qiladi. So'rovni siz yubormagan bo'lsangiz, e'tiborsiz qoldiring.`,
  });
  return ok();
}

// Tokenni tekshiradi va KUYDIRADI. Yaroqli bo'lsa user_id qaytadi.
async function burnEmailResetToken(env, H, token) {
  const hash = await H.sha256Hex(token);
  const row = await env.DB.prepare(
    `SELECT user_id, expires_at FROM email_reset_tokens WHERE token = ?`,
  ).bind(hash).first();
  if (!row) return null;
  // Kuydirish MUDDATNI TEKSHIRISHDAN OLDIN: token qanday bo'lmasin,
  // bir marta ishlatilgach yo'q bo'ladi.
  const burned = await env.DB.prepare(`DELETE FROM email_reset_tokens WHERE token = ?`).bind(hash).run();
  if (!burned?.meta?.changes) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;
  return Number(row.user_id);
}

export async function handle(request, env, url, H) {
  if (url.pathname === '/api/auth/tg-link/status' && request.method === 'GET') {
    return tgLinkStatus(request, env, H, url);
  }
  if (request.method !== 'POST') return null;
  switch (url.pathname) {
    case '/api/auth/tg-link/start': return startTgLink(request, env, H);
    case '/api/auth/request-register-code': return requestRegisterCode(request, env, H);
    case '/api/auth/register': return register(request, env, H);
    case '/api/auth/request-password-reset': return requestPasswordReset(request, env, H);
    case '/api/auth/request-email-reset': return requestEmailReset(request, env, H);
    case '/api/auth/reset-password': return resetPassword(request, env, H);
    default: return null;
  }
}
