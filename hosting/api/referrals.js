// hosting/api/referrals.js — PROMOKOD MUKOFOTI: HAR DO'ST UCHUN +1 OY PREMIUM.
//
// ═══ NIMA UCHUN BOR ═══
//
// Egasi (2026-10-06): do'stini taklif qilgan odam mavjud 10% chegirma
// kreditidan TASHQARI har taklif qilingan do'st uchun +30 kun Premium
// oladi. Chegirma (auth.js `applyReferral`) o'zgarmagan — u ro'yxatdan
// o'tishda darhol beriladi.
//
// ═══ KECHIKTIRILGAN MUKOFOT (ko'rik F1, 2026-10-06) ═══
//
// Ilgari mukofot ro'yxatdan o'tishning o'zida berilardi — bitta odam
// bir nechta email bilan "do'st" ochib, cheksiz Premium yig'a olardi.
// Endi:
//
//   1) Ro'yxatdan o'tishda faqat KUTILAYOTGAN yozuv qoladi
//      (`recordPendingReward`, status 'pending'). Muddat tegilmaydi.
//   2) Kunlik cron (`processReferralRewards`) va do'st /api/auth/me ni
//      ochganda (soatiga bir marta, shu isolate ichida) yozuv tekshiriladi.
//      HAMMASI bajarilsa beriladi:
//        * do'st hisobi kamida 7 kunlik, o'chirilmagan, ban/muzlatilmagan;
//        * haqiqiy faollik: ilovada kamida 2 xil kun (app_users
//          first_seen/last_seen sanalari farq qiladi), YOKI kamida bitta
//          post/istorya, YOKI profil rasmi (avatar) qo'yilgan;
//        * do'stning normallangan emaili taklif qiluvchinikidan va shu
//          taklif qiluvchining boshqa (kutilayotgan/berilgan) do'stlarinikidan
//          farq qiladi — bir xil pochta qutisidan ERTAROQ ochilgan hisob
//          yutadi, keyingilari 'rejected' (duplicate_email);
//        * Telegram orqali tasdiqlangan telefon taklif qiluvchiniki emas.
//   3) 60 kun ichida shartlarga yetmagan yozuv — 'expired'.
//   4) O'chirgich: `REFERRAL_REWARD_ENABLED` = '1' bo'lsagina beriladi.
//      O'chiq bo'lsa yozuvlar baribir 'pending' bo'lib to'planadi
//      (muddati ham o'tmaydi — yoqilganda ko'rib chiqiladi).
//
// ═══ ATOMAR CHEGARA (ko'rik F2) ═══
//
//   * Da'vo — BITTA shartli UPDATE: 'pending' → 'granting', faqat shu
//     taklif qiluvchining oxirgi 365 kundagi 'granting'+'granted'
//     yozuvlari soni REFERRAL_REWARD_MAX_PER_YEAR (24) dan kam bo'lsa.
//     Ikki parallel ishlov chegarani oshira olmaydi.
//   * Premium muddati va 'granted' holati BITTA batch (tranzaksiya)da,
//     joriy muddat o'qilgan qiymatga teng bo'lsagina yoziladi (CAS);
//     cheklangan sonli qayta o'qish/urinish. Hech qachon da'vo
//     o'chirilmaydi: oxirigacha yozilmasa holat 'granting' qoladi va
//     cron keyin qayta uradi.
//
// ═══ HOLATLAR ═══
//
//   pending → granting → granted
//   pending → expired (60 kun) | rejected (reason: self, same_phone,
//             duplicate_email, referrer_deleted, referred_deleted, lifetime)
//   Eski (holatsiz, granted_until bor) qatorlar — 'granted' deb yangilanadi.
//
// ═══ QOIDALAR (o'zgarmagan) ═══
//
//   * Muddat: premium_expires_at = max(hozir, joriy Premium muddati,
//     faol bepul sinov tugashi) + 30 kun.
//   * Muddatsiz Premium (`is_premium = 1`) — mukofot yo'q.
//   * Faqat ro'yxatdan o'tish TASDIQLANGAN bo'lsa (email kodi yoki
//     Telegram orqali telefon) — yozuv shundagina ochiladi.
//   * Bir do'st uchun bir yozuv: `referral_rewards.referred_id` UNIQUE.
//   * Taklif qiluvchiga ilova ichidagi bildirishnoma `referral_reward`
//     (aktyor — do'st; faqat saytda ko'rinadi, ilovada yashiriladi).
//
// ═══ MARSHRUTLAR ═══
//
//   GET /api/referrals/summary (kirish SHART)
//       → { code, link, invited, rewardedDays, pendingRewards, nextRewardDays }
//   GET /api/admin/referrals/leaderboard (admin)
//       → { last30: [Row], allTime: [Row] },
//         Row = { rank, userId, name, code, count, rewardedDays }
//   GET /i/:code — worker.js (`inviteRedirect`): cookie `nfc_ref` + /register?ref=
//
// Jadval: referral_rewards (CREATE TABLE IF NOT EXISTS + ADD COLUMN) —
// moliyaviy yozuv sifatida hisob o'chirilganda ham qoladi.

import { createNotification } from './notifications.js';

export const REFERRAL_REWARD_DAYS = 30;
export const REFERRAL_REWARD_MAX_PER_YEAR = 24;
export const REFERRAL_MIN_AGE_DAYS = 7;
export const REFERRAL_PENDING_TTL_DAYS = 60;
export const INVITE_BASE = 'https://nfcstore.uz/i/';
const DAY_MS = 86_400_000;
const YEAR_MS = 365 * DAY_MS;
const GRANT_ATTEMPTS = 5;

// Eski jadvalga qo'shiladigan ustunlar (ADD COLUMN; bor bo'lsa xato yutiladi).
const EXTRA_COLUMNS = [
  ['status', 'TEXT'],
  ['reason', 'TEXT'],
  ['friend_email_norm', 'TEXT'],
  ['friend_phone_verified', 'INTEGER'],
  ['claimed_at', 'TEXT'],
  ['granted_at', 'TEXT'],
  ['updated_at', 'TEXT'],
];

const ready = {};
export function ensureReferralSchema(env) {
  const key = env.UZ_STORE_ACTIVE ? 'uz' : 'd1';
  return (ready[key] ||= (async () => {
    await env.DB.batch([
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS referral_rewards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        referrer_id INTEGER NOT NULL,
        referred_id INTEGER NOT NULL UNIQUE,
        days INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        granted_until TEXT
      )`),
      env.DB.prepare(`CREATE INDEX IF NOT EXISTS referral_rewards_referrer_idx ON referral_rewards(referrer_id, created_at)`),
    ]);
    const info = await env.DB.prepare(`PRAGMA table_info(referral_rewards)`).all().catch(() => null);
    const have = new Set((info?.results || []).map((c) => String(c.name)));
    for (const [col, type] of EXTRA_COLUMNS) {
      if (have.has(col)) continue;
      await env.DB.prepare(`ALTER TABLE referral_rewards ADD COLUMN ${col} ${type}`).run().catch((e) => {
        if (!/duplicate column/i.test(String(e?.message || e))) throw e;
      });
    }
    await env.DB.batch([
      env.DB.prepare(`CREATE INDEX IF NOT EXISTS referral_rewards_status_idx ON referral_rewards(status, created_at)`),
      // Eski (holatsiz) qatorlar: muddat yozilgan — berilgan.
      env.DB.prepare(`UPDATE referral_rewards SET status = 'granted', granted_at = COALESCE(granted_at, created_at),
                        claimed_at = COALESCE(claimed_at, created_at)
                      WHERE status IS NULL AND granted_until IS NOT NULL`),
      env.DB.prepare(`UPDATE referral_rewards SET status = 'pending' WHERE status IS NULL`),
    ]);
  })().catch((e) => { delete ready[key]; throw e; }));
}

// Bazadagi sana shakllari (ISO, 'YYYY-MM-DD HH:MM:SS', '...+00') — hammasi UTC.
function toMs(v) {
  if (v === null || v === undefined || v === '') return NaN;
  let s = String(v).trim().replace(' ', 'T');
  if (/\+00$/.test(s)) s = s.replace(/\+00$/, 'Z');
  else if (!/(Z|[+-]\d{2}:?\d{2})$/i.test(s)) s += 'Z';
  return Date.parse(s);
}
const iso = (ms) => new Date(ms).toISOString();

/// EMAILNI NORMALLASH (bir pochta qutisi — bitta qiymat):
/// kichik harf; gmail.com/googlemail.com — nuqtalar va "+teg" olib
/// tashlanadi, domen gmail.com; boshqa domenlarda faqat "+teg".
/// Ichki (telefon) manzil yoki noto'g'ri qiymat — null.
export function normalizeEmail(email, H = null) {
  const e = String(email || '').trim().toLowerCase();
  if (!e || (H?.isPlaceholderEmailD1 && H.isPlaceholderEmailD1(e))) return null;
  const at = e.lastIndexOf('@');
  if (at <= 0 || at === e.length - 1) return null;
  let local = e.slice(0, at);
  let domain = e.slice(at + 1);
  const plus = local.indexOf('+');
  if (plus >= 0) local = local.slice(0, plus);
  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    local = local.replace(/\./g, '');
    domain = 'gmail.com';
  }
  return local ? `${local}@${domain}` : null;
}

export const referralRewardEnabled = (env) => String(env?.REFERRAL_REWARD_ENABLED || '') === '1';

/// RO'YXATDAN O'TISHDA: faqat kutilayotgan yozuv (muddat tegilmaydi).
/// Qaytaradi: { recorded: true } yoki { recorded: false, reason }.
/// Hech qachon xato otmaydi — ro'yxatdan o'tish buzilmasin.
export async function recordPendingReward(env, H, referrerId, referredId,
  { verified = false, email = '', phoneVerified = false, now = Date.now() } = {}) {
  try {
    if (!verified) return { recorded: false, reason: 'not_verified' };
    const a = Number(referrerId), b = Number(referredId);
    if (!a || !b || a === b) return { recorded: false, reason: 'self' };
    await ensureReferralSchema(env);
    const ref = await env.DB.prepare(`SELECT deleted_at FROM users WHERE id = ?`).bind(a).first();
    if (!ref || ref.deleted_at) return { recorded: false, reason: 'referrer_deleted' };
    const t = iso(now);
    const res = await env.DB.prepare(
      `INSERT OR IGNORE INTO referral_rewards
         (referrer_id, referred_id, days, created_at, status, friend_email_norm, friend_phone_verified, updated_at)
       VALUES (?, ?, ?, ?, 'pending', ?, ?, ?)`
    ).bind(a, b, REFERRAL_REWARD_DAYS, t, normalizeEmail(email, H), phoneVerified ? 1 : 0, t).run();
    return Number(res?.meta?.changes || 0) > 0 ? { recorded: true } : { recorded: false, reason: 'already' };
  } catch (e) {
    console.error('referral_pending', String(e?.message || e).slice(0, 160));
    return { recorded: false, reason: 'error' };
  }
}

// Bitta so'rov xato bersa (jadval hali yo'q) — signal yo'q deb hisoblanadi.
const flag = async (env, sql, id) => {
  const r = await env.DB.prepare(sql).bind(id).first().catch(() => null);
  return !!(r && Number(r.ok) === 1);
};

/// DO'STNING FAOLLIGI: 2 xil kun ilovada, YOKI post/istorya, YOKI avatar.
async function friendActive(env, id) {
  return (await flag(env, `SELECT 1 AS ok FROM app_users WHERE user_id = ?
                             AND substr(first_seen, 1, 10) <> substr(last_seen, 1, 10) LIMIT 1`, id))
    || (await flag(env, `SELECT 1 AS ok FROM posts WHERE user_id = ? LIMIT 1`, id))
    || (await flag(env, `SELECT 1 AS ok FROM stories WHERE user_id = ? LIMIT 1`, id))
    || (await flag(env, `SELECT 1 AS ok FROM cards WHERE user_id = ? AND COALESCE(avatar_url, '') <> '' LIMIT 1`, id));
}

const setState = (env, id, from, status, reason, now) =>
  env.DB.prepare(`UPDATE referral_rewards SET status = ?, reason = ?, updated_at = ? WHERE id = ? AND status = ?`)
    .bind(status, reason, iso(now), id, from).run();

/// SHARTLAR. Qaytaradi: 'ok' | 'wait' | { reject: reason }.
async function qualify(env, H, row, now) {
  const [ref, friend] = await Promise.all([
    env.DB.prepare(`SELECT id, email, phone, is_premium, deleted_at FROM users WHERE id = ?`).bind(row.referrer_id).first(),
    env.DB.prepare(`SELECT id, email, phone, created_at, deleted_at, banned_until, suspended_until FROM users WHERE id = ?`)
      .bind(row.referred_id).first(),
  ]);
  if (!ref || ref.deleted_at) return { reject: 'referrer_deleted' };
  if (!friend || friend.deleted_at) return { reject: 'referred_deleted' };
  if (Number(ref.is_premium) === 1) return { reject: 'lifetime' };
  if (Number(ref.id) === Number(friend.id)) return { reject: 'self' };
  // Telefon: Telegram orqali tasdiqlangan raqam taklif qiluvchiniki bo'lsa.
  if (ref.phone && friend.phone && String(ref.phone) === String(friend.phone)) return { reject: 'same_phone' };
  // Email: taklif qiluvchiniki va shu taklif qiluvchining ERTAROQ
  // do'stlariniki bilan bir pochta qutisi bo'lmasin.
  const norm = row.friend_email_norm || normalizeEmail(friend.email, H);
  if (norm) {
    if (norm === normalizeEmail(ref.email, H)) return { reject: 'duplicate_email' };
    const dup = await env.DB.prepare(
      `SELECT 1 AS ok FROM referral_rewards WHERE referrer_id = ? AND id < ? AND friend_email_norm = ?
         AND status IN ('pending', 'granting', 'granted') LIMIT 1`
    ).bind(row.referrer_id, row.id, norm).first();
    if (dup) return { reject: 'duplicate_email' };
  }
  const ageMs = now - toMs(friend.created_at);
  if (!(ageMs >= REFERRAL_MIN_AGE_DAYS * DAY_MS)) return 'wait';
  const blocked = (v) => { const ms = toMs(v); return Number.isFinite(ms) && ms > now; };
  if (blocked(friend.banned_until) || blocked(friend.suspended_until)) return 'wait';
  if (!(await friendActive(env, Number(friend.id)))) return 'wait';
  return 'ok';
}

/// 'granting' YOZUVNI YAKUNLASH: muddat + 'granted' bitta tranzaksiyada (CAS).
/// Qaytaradi: { granted, until?, reason? }. Muvaffaqiyatsiz — holat 'granting' qoladi.
async function finishGrant(env, H, row, now) {
  const a = Number(row.referrer_id);
  for (let attempt = 0; attempt < GRANT_ATTEMPTS; attempt++) {
    const u = await env.DB.prepare(`SELECT premium_expires_at, trial_expires_at, is_premium, deleted_at FROM users WHERE id = ?`)
      .bind(a).first();
    if (!u || u.deleted_at) {
      await setState(env, row.id, 'granting', 'rejected', 'referrer_deleted', now);
      return { granted: false, reason: 'referrer_deleted' };
    }
    if (Number(u.is_premium) === 1) {
      await setState(env, row.id, 'granting', 'rejected', 'lifetime', now);
      return { granted: false, reason: 'lifetime' };
    }
    const cur = u.premium_expires_at ?? null;
    const curMs = toMs(cur);
    const trialMs = toMs(u.trial_expires_at);
    const base = Math.max(now, Number.isFinite(curMs) ? curMs : 0, Number.isFinite(trialMs) && trialMs > now ? trialMs : 0);
    const next = iso(base + REFERRAL_REWARD_DAYS * DAY_MS);
    // Ikkala UPDATE ham bitta tranzaksiyada va ikkalasi ham "muddat hali
    // `cur`" shartiga bog'liq: yo ikkalasi yoziladi, yo hech biri.
    await env.DB.batch([
      env.DB.prepare(
        `UPDATE referral_rewards SET status = 'granted', granted_until = ?, granted_at = ?, reason = NULL, updated_at = ?
          WHERE id = ? AND status = 'granting'
            AND (SELECT premium_expires_at FROM users WHERE id = ?) IS ?
            AND (SELECT COALESCE(is_premium, 0) FROM users WHERE id = ?) = 0`
      ).bind(next, iso(now), iso(now), row.id, a, cur, a),
      env.DB.prepare(
        `UPDATE users SET premium_expires_at = ?
          WHERE id = ? AND premium_expires_at IS ? AND COALESCE(is_premium, 0) = 0
            AND EXISTS (SELECT 1 FROM referral_rewards WHERE id = ? AND status = 'granted' AND granted_until = ?)`
      ).bind(next, a, cur, row.id, next),
    ]);
    const after = await env.DB.prepare(`SELECT status, granted_until FROM referral_rewards WHERE id = ?`).bind(row.id).first();
    if (after?.status === 'granted') {
      if (after.granted_until !== next) return { granted: false, reason: 'already' };
      await createNotification(env, {
        recipientUserId: a, actorUserId: Number(row.referred_id), kind: 'referral_reward',
        targetType: 'referral', targetId: String(REFERRAL_REWARD_DAYS), now: H.nowTs(),
      }).catch(() => {});
      return { granted: true, until: next };
    }
    if (after?.status !== 'granting') return { granted: false, reason: 'state_changed' };
  }
  return { granted: false, reason: 'conflict' };
}

/// BITTA YOZUVNI KO'RIB CHIQISH (pending yoki granting).
async function processRow(env, H, row, now) {
  if (row.status === 'granting') return finishGrant(env, H, row, now);
  const q = await qualify(env, H, row, now);
  if (q === 'wait') return { granted: false, reason: 'wait' };
  if (q !== 'ok') {
    await setState(env, row.id, 'pending', 'rejected', q.reject, now);
    return { granted: false, reason: q.reject };
  }
  // ATOMAR DA'VO: chegara shu UPDATE'ning WHERE qismida.
  const claim = await env.DB.prepare(
    `UPDATE referral_rewards SET status = 'granting', claimed_at = ?, updated_at = ?
      WHERE id = ? AND status = 'pending'
        AND (SELECT COUNT(*) FROM referral_rewards c
              WHERE c.referrer_id = ? AND c.status IN ('granting', 'granted') AND c.claimed_at > ?) < ?`
  ).bind(iso(now), iso(now), row.id, row.referrer_id, iso(now - YEAR_MS), REFERRAL_REWARD_MAX_PER_YEAR).run();
  if (!(Number(claim?.meta?.changes || 0) > 0)) {
    const cur = await env.DB.prepare(`SELECT status FROM referral_rewards WHERE id = ?`).bind(row.id).first();
    if (cur?.status === 'pending') {
      // Yillik chegara to'lgan — yozuv kutishda qoladi (60 kunda eskiradi).
      await env.DB.prepare(`UPDATE referral_rewards SET reason = 'cap', updated_at = ? WHERE id = ? AND status = 'pending'`)
        .bind(iso(now), row.id).run().catch(() => {});
      return { granted: false, reason: 'cap' };
    }
    return { granted: false, reason: 'already' };
  }
  return finishGrant(env, H, { ...row, status: 'granting' }, now);
}

/// CRON / KIRISH: kutilayotgan mukofotlarni ko'rib chiqish.
/// `referredId` berilsa — faqat shu do'stning yozuvi (/api/auth/me).
/// Qaytaradi: { granted, expired, rejected } (faqat sonlar).
export async function processReferralRewards(env, H, { now = Date.now(), referredId = null, limit = 200 } = {}) {
  const out = { granted: 0, expired: 0, rejected: 0 };
  if (!referralRewardEnabled(env)) return { ...out, disabled: true };
  try {
    await ensureReferralSchema(env);
    const ttlCut = iso(now - REFERRAL_PENDING_TTL_DAYS * DAY_MS);
    const exp = await env.DB.prepare(
      `UPDATE referral_rewards SET status = 'expired', reason = COALESCE(reason, 'no_activity'), updated_at = ?
        WHERE status = 'pending' AND created_at < ?${referredId ? ' AND referred_id = ?' : ''}`
    ).bind(iso(now), ttlCut, ...(referredId ? [Number(referredId)] : [])).run();
    out.expired = Number(exp?.meta?.changes || 0);
    const ageCut = iso(now - REFERRAL_MIN_AGE_DAYS * DAY_MS);
    const rows = await env.DB.prepare(
      `SELECT id, referrer_id, referred_id, status, friend_email_norm, friend_phone_verified
         FROM referral_rewards
        WHERE (status = 'granting' OR (status = 'pending' AND created_at <= ?))${referredId ? ' AND referred_id = ?' : ''}
        ORDER BY id ASC LIMIT ?`
    ).bind(ageCut, ...(referredId ? [Number(referredId)] : []), Math.max(1, Math.min(1000, Number(limit) || 200))).all();
    for (const row of rows?.results || []) {
      try {
        const r = await processRow(env, H, row, now);
        if (r.granted) out.granted++;
        else if (!['wait', 'cap', 'conflict', 'already', 'state_changed'].includes(r.reason)) out.rejected++;
      } catch (e) {
        console.error('referral_process', String(e?.message || e).slice(0, 160));
      }
    }
  } catch (e) {
    console.error('referral_process', String(e?.message || e).slice(0, 160));
  }
  return out;
}

// /api/auth/me dan: shu isolate ichida bir do'st uchun soatiga bir marta.
const meChecked = new Map();
const ME_THROTTLE_MS = 60 * 60_000;
export async function checkReferralOnOpen(env, H, userId, now = Date.now()) {
  if (!referralRewardEnabled(env) || !userId) return null;
  const last = meChecked.get(userId);
  if (last && now - last < ME_THROTTLE_MS) return null;
  if (meChecked.size > 5000) meChecked.clear();
  meChecked.set(userId, now);
  try {
    await ensureReferralSchema(env);
    const has = await env.DB.prepare(
      `SELECT 1 AS ok FROM referral_rewards WHERE referred_id = ? AND status IN ('pending', 'granting') LIMIT 1`
    ).bind(Number(userId)).first();
    if (!has) return null;
    return await processReferralRewards(env, H, { now, referredId: Number(userId), limit: 1 });
  } catch (e) {
    console.error('referral_me', String(e?.message || e).slice(0, 160));
    return null;
  }
}
export function __resetReferralThrottleForTests() { meChecked.clear(); }

// Ro'yxatdagi nom: asosiy kartaning ismi (email/telefon EMAS).
const NAME_SQL = (col) => `(SELECT name FROM cards WHERE user_id = ${col} ORDER BY is_primary DESC, ts ASC LIMIT 1)`;

async function leaderboard(env, sinceMs) {
  const sinceIso = sinceMs ? new Date(sinceMs).toISOString() : null;
  const where = sinceMs ? `WHERE r.created_at > ?` : '';
  const rows = await env.DB.prepare(
    `SELECT r.referrer_id AS uid, COUNT(*) AS n,
            COALESCE((SELECT SUM(w.days) FROM referral_rewards w WHERE w.referrer_id = r.referrer_id
                      AND w.status = 'granted' ${sinceIso ? 'AND w.granted_at > ?' : ''}), 0) AS days,
            u.promo_code AS code, ${NAME_SQL('r.referrer_id')} AS name
       FROM referral_uses r JOIN users u ON u.id = r.referrer_id
       ${where}
      GROUP BY r.referrer_id ORDER BY n DESC, days DESC, r.referrer_id ASC LIMIT 50`
  ).bind(...(sinceMs ? [sinceIso, sqlTs(sinceMs)] : [])).all();
  return (rows?.results || []).map((r, i) => ({
    rank: i + 1, userId: Number(r.uid), name: String(r.name || ''), code: String(r.code || ''),
    count: Number(r.n) || 0, rewardedDays: Number(r.days) || 0,
  }));
}

// `referral_uses.created_at` ikki shaklda bo'ladi ('YYYY-MM-DD HH:MM:SS' standart
// va auth.js `tsAt` — '...+00'); ikkalasi ham shu satr bilan to'g'ri solishtiriladi.
const sqlTs = (ms) => new Date(ms).toISOString().replace('T', ' ').slice(0, 19);

export async function handle(request, env, url, H) {
  const p = url.pathname;
  if (p === '/api/referrals/summary') {
    if (request.method !== 'GET') return H.json({ error: 'method_not_allowed' }, 405);
    const user = await H.getCurrentUser(request, env);
    if (!user) return H.json({ error: 'unauthorized' }, 401);
    await ensureReferralSchema(env);
    const [inv, rew] = await Promise.all([
      env.DB.prepare(`SELECT COUNT(*) AS n FROM referral_uses WHERE referrer_id = ?`).bind(user.id).first(),
      env.DB.prepare(`SELECT COALESCE(SUM(CASE WHEN status = 'granted' THEN days ELSE 0 END), 0) AS d,
                             COALESCE(SUM(CASE WHEN status IN ('pending', 'granting') THEN 1 ELSE 0 END), 0) AS p
                        FROM referral_rewards WHERE referrer_id = ?`).bind(user.id).first(),
    ]);
    const code = user.promoCode || null;
    return H.json({
      code,
      link: code ? `${INVITE_BASE}${code}` : null,
      invited: Number(inv?.n) || 0,
      rewardedDays: Number(rew?.d) || 0,
      // Do'stlari hali 7 kun/faollik shartiga yetmagan mukofotlar soni.
      pendingRewards: Number(rew?.p) || 0,
      nextRewardDays: REFERRAL_REWARD_DAYS,
    });
  }
  if (p === '/api/admin/referrals/leaderboard') {
    if (request.method !== 'GET') return H.json({ error: 'method_not_allowed' }, 405);
    const admin = await H.requireAdmin(request, env);
    if (!admin) return H.json({ error: 'unauthorized' }, 401);
    await ensureReferralSchema(env);
    const [last30, allTime] = await Promise.all([
      leaderboard(env, Date.now() - 30 * DAY_MS),
      leaderboard(env, null),
    ]);
    return H.json({ last30, allTime });
  }
  return null;
}

/// TAKLIF HAVOLASI: GET /i/:code (worker.js chaqiradi).
/// Kod bor bo'lsa — `nfc_ref` cookie (30 kun, Lax) va ro'yxat sahifasiga
/// `?ref=` bilan; yo'q bo'lsa — bosh sahifaga, cookie'siz.
export async function inviteRedirect(request, env, url) {
  const m = url.pathname.match(/^\/i\/([A-Za-z0-9]{4,12})\/?$/);
  const code = m ? m[1].toUpperCase() : '';
  const row = code
    ? await env.DB.prepare(`SELECT id FROM users WHERE promo_code = ? AND deleted_at IS NULL`).bind(code).first().catch(() => null)
    : null;
  const headers = { 'cache-control': 'no-store' };
  if (!row) return new Response(null, { status: 302, headers: { ...headers, location: '/' } });
  const secure = url.protocol === 'https:' ? '; Secure' : '';
  return new Response(null, {
    status: 302,
    headers: {
      ...headers,
      location: `/register?ref=${encodeURIComponent(code)}`,
      'set-cookie': `nfc_ref=${code}; Path=/; Max-Age=${30 * 86400}; SameSite=Lax; HttpOnly${secure}`,
    },
  });
}
