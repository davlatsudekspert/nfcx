// hosting/api/referrals.js — PROMOKOD MUKOFOTI: HAR DO'ST UCHUN +1 OY PREMIUM.
//
// ═══ NIMA UCHUN BOR ═══
//
// Egasi (2026-10-06): do'stini taklif qilgan odam mavjud 10% chegirma
// kreditidan TASHQARI har taklif qilingan do'st uchun +30 kun Premium
// oladi. Chegirma (auth.js `applyReferral`) o'zgarmagan.
//
// ═══ QOIDALAR ═══
//
//   * Muddat: premium_expires_at = max(hozir, joriy Premium muddati,
//     faol bepul sinov tugashi) + 30 kun — sinov paytida mukofot sinov
//     TUGAGANDAN keyin boshlanadi (sinov kunlari kuyib ketmaydi).
//   * Muddatsiz Premium (`is_premium = 1`) va o'chirilgan taklif qiluvchi
//     — mukofot yo'q.
//   * Faqat ro'yxatdan o'tish TASDIQLANGAN bo'lsa (email kodi yoki
//     Telegram orqali telefon) — chaqiruvchi (`auth.js`) `verified` beradi.
//   * Bir do'st uchun bir marta: `referral_rewards.referred_id` UNIQUE
//     (INSERT OR IGNORE — da'vo). O'zi yoki o'sha telefon raqami — yo'q.
//   * Chegara: bir taklif qiluvchiga oxirgi 365 kunda ko'pi bilan
//     REFERRAL_REWARD_MAX_PER_YEAR ta mukofot (24 oy).
//   * Taklif qiluvchiga ilova ichidagi bildirishnoma `referral_reward`
//     (aktyor — do'st; ro'yxatda faqat uning ochiq profil nomi chiqadi).
//
// ═══ MARSHRUTLAR ═══
//
//   GET /api/referrals/summary (kirish SHART)
//       → { code, link, invited, rewardedDays, nextRewardDays }
//   GET /api/admin/referrals/leaderboard (admin)
//       → { last30: [Row], allTime: [Row] },
//         Row = { rank, userId, name, code, count, rewardedDays }
//   GET /i/:code — worker.js (`inviteRedirect`): cookie `nfc_ref` + /register?ref=
//
// Jadval: referral_rewards (CREATE TABLE IF NOT EXISTS) — moliyaviy
// yozuv sifatida hisob o'chirilganda ham qoladi.

import { createNotification } from './notifications.js';

export const REFERRAL_REWARD_DAYS = 30;
export const REFERRAL_REWARD_MAX_PER_YEAR = 24;
export const INVITE_BASE = 'https://nfcstore.uz/i/';
const DAY_MS = 86_400_000;
const YEAR_MS = 365 * DAY_MS;

const ready = {};
export function ensureReferralSchema(env) {
  const key = env.UZ_STORE_ACTIVE ? 'uz' : 'd1';
  return (ready[key] ||= env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS referral_rewards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      referrer_id INTEGER NOT NULL,
      referred_id INTEGER NOT NULL UNIQUE,
      days INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      granted_until TEXT
    )`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS referral_rewards_referrer_idx ON referral_rewards(referrer_id, created_at)`),
  ]).catch((e) => { delete ready[key]; throw e; }));
}

// Bazadagi sana shakllari (ISO, 'YYYY-MM-DD HH:MM:SS', '...+00') — hammasi UTC.
function toMs(v) {
  if (v === null || v === undefined || v === '') return NaN;
  let s = String(v).trim().replace(' ', 'T');
  if (/\+00$/.test(s)) s = s.replace(/\+00$/, 'Z');
  else if (!/(Z|[+-]\d{2}:?\d{2})$/i.test(s)) s += 'Z';
  return Date.parse(s);
}
const changed = (res) => Number(res?.meta?.changes || 0) > 0;

/// MUKOFOT. Qaytaradi: { granted: true, until } yoki { granted: false, reason }.
/// Hech qachon xato otmaydi — ro'yxatdan o'tish buzilmasin.
export async function grantReferralReward(env, H, referrerId, referredId, { verified = false, now = Date.now() } = {}) {
  try {
    if (!verified) return { granted: false, reason: 'not_verified' };
    const a = Number(referrerId), b = Number(referredId);
    if (!a || !b || a === b) return { granted: false, reason: 'self' };
    await ensureReferralSchema(env);
    const [ref, friend] = await Promise.all([
      env.DB.prepare(`SELECT id, phone, is_premium, premium_expires_at, trial_expires_at, deleted_at FROM users WHERE id = ?`).bind(a).first(),
      env.DB.prepare(`SELECT id, phone, deleted_at FROM users WHERE id = ?`).bind(b).first(),
    ]);
    if (!ref || ref.deleted_at) return { granted: false, reason: 'referrer_deleted' };
    if (!friend || friend.deleted_at) return { granted: false, reason: 'referred_missing' };
    if (Number(ref.is_premium) === 1) return { granted: false, reason: 'lifetime' };
    if (ref.phone && friend.phone && String(ref.phone) === String(friend.phone)) return { granted: false, reason: 'self' };
    const recent = await env.DB.prepare(`SELECT COUNT(*) AS n FROM referral_rewards WHERE referrer_id = ? AND created_at > ?`)
      .bind(a, new Date(now - YEAR_MS).toISOString()).first();
    if ((Number(recent?.n) || 0) >= REFERRAL_REWARD_MAX_PER_YEAR) return { granted: false, reason: 'cap' };
    // DA'VO: bir do'st — bir mukofot.
    const claim = await env.DB.prepare(`INSERT OR IGNORE INTO referral_rewards (referrer_id, referred_id, days, created_at) VALUES (?, ?, ?, ?)`)
      .bind(a, b, REFERRAL_REWARD_DAYS, new Date(now).toISOString()).run();
    if (!changed(claim)) return { granted: false, reason: 'already' };
    let until = null;
    for (let attempt = 0; attempt < 4 && !until; attempt++) {
      const row = attempt === 0 ? ref : await env.DB.prepare(`SELECT premium_expires_at, trial_expires_at FROM users WHERE id = ?`).bind(a).first();
      const cur = row?.premium_expires_at ?? null;
      const curMs = toMs(cur);
      const trialMs = toMs(row?.trial_expires_at);
      const base = Math.max(now, Number.isFinite(curMs) ? curMs : 0, Number.isFinite(trialMs) && trialMs > now ? trialMs : 0);
      const next = new Date(base + REFERRAL_REWARD_DAYS * DAY_MS).toISOString();
      const res = await env.DB.prepare(`UPDATE users SET premium_expires_at = ? WHERE id = ? AND premium_expires_at IS ? AND COALESCE(is_premium, 0) = 0`)
        .bind(next, a, cur).run();
      if (changed(res)) until = next;
    }
    if (!until) {
      // Muddat yozilmadi — da'vo bo'shatiladi (keyingi urinish uchun).
      await env.DB.prepare(`DELETE FROM referral_rewards WHERE referred_id = ? AND granted_until IS NULL`).bind(b).run().catch(() => {});
      return { granted: false, reason: 'conflict' };
    }
    await env.DB.prepare(`UPDATE referral_rewards SET granted_until = ? WHERE referred_id = ?`).bind(until, b).run();
    await createNotification(env, {
      recipientUserId: a, actorUserId: b, kind: 'referral_reward',
      targetType: 'referral', targetId: String(REFERRAL_REWARD_DAYS), now: H.nowTs(),
    });
    return { granted: true, until };
  } catch (e) {
    console.error('referral_reward', String(e?.message || e).slice(0, 160));
    return { granted: false, reason: 'error' };
  }
}

// Ro'yxatdagi nom: asosiy kartaning ismi (email/telefon EMAS).
const NAME_SQL = (col) => `(SELECT name FROM cards WHERE user_id = ${col} ORDER BY is_primary DESC, ts ASC LIMIT 1)`;

async function leaderboard(env, sinceMs) {
  const sinceIso = sinceMs ? new Date(sinceMs).toISOString() : null;
  const where = sinceMs ? `WHERE r.created_at > ?` : '';
  const rows = await env.DB.prepare(
    `SELECT r.referrer_id AS uid, COUNT(*) AS n,
            COALESCE((SELECT SUM(w.days) FROM referral_rewards w WHERE w.referrer_id = r.referrer_id
                      AND w.granted_until IS NOT NULL ${sinceIso ? 'AND w.created_at > ?' : ''}), 0) AS days,
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
      env.DB.prepare(`SELECT COALESCE(SUM(days), 0) AS d FROM referral_rewards WHERE referrer_id = ? AND granted_until IS NOT NULL`).bind(user.id).first(),
    ]);
    const code = user.promoCode || null;
    return H.json({
      code,
      link: code ? `${INVITE_BASE}${code}` : null,
      invited: Number(inv?.n) || 0,
      rewardedDays: Number(rew?.d) || 0,
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
