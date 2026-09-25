// hosting/api/admin-control.js — ADMIN BOSHQARUV MARKAZI (2026-09-25).
//
// Egasining so'rovi: "admin panel haqiqiy tizimni boshqaradigan panel
// bo'lsin". Bu modul uchta narsani beradi — hammasi FAQAT O'QIYDI,
// bazaga hech narsa yozmaydi:
//
//   GET /api/admin/overview
//       Bosh sahifa: tushum (faqat Payme/Click — `revenueBucketSqlD1`),
//       foydalanuvchilar, ilova faolligi, Premium, va "E'TIBOR TALAB
//       QILADI" navbati (kutilayotgan buyurtma, chop etiladigan karta,
//       Business ID arizasi, shikoyat, javobsiz murojaat, o'chirish
//       navbati). Menyu yonidagi sonlar (badge) ham shundan.
//   GET /api/admin/premium-users?filter=active|expiring|expired|trial|all&q=
//       Premium obunachilar: tugash sanasi, oxirgi to'lov.
//   GET /api/admin/users/:id/detail
//       Bitta foydalanuvchi kartochkasi: ID'lar, bizneslar, buyurtmalar
//       (to'lov kanali bilan), jismoniy kartalar, murojaatlar, ilova.
//
// SANALAR: bazada vaqt ikki xil shaklda ("…T…Z" va "… …+00"), shuning
// uchun `datetime()` ishlatilmaydi — birinchi 19 belgi 'T' siz
// solishtiriladi (worker.js DAY_COL_D1 izohiga qarang).
//
// Jadval yo'q bo'lsa (yangi baza) — o'sha qism 0 qaytaradi, xato emas.

import { ensurePurgeSchema, PURGE_GRACE_DAYS } from './account-purge.js';

const DAY_MS = 86_400_000;
const SEC = (c) => `replace(substr(${c}, 1, 19), 'T', ' ')`;
const secAt = (ms) => new Date(ms).toISOString().slice(0, 19).replace('T', ' ');
// Toshkent vaqti (UTC+5) bo'yicha "bugun" boshlanishi — UTC da.
function tashkentDayStartMs(now) {
  const local = new Date(now + 5 * 3600_000);
  return Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - 5 * 3600_000;
}

async function tableSet(env) {
  const r = await env.DB.prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`).all();
  return new Set((r.results || []).map((x) => x.name));
}
async function columnSet(env, table) {
  try {
    const r = await env.DB.prepare(`PRAGMA table_info("${table}")`).all();
    return new Set((r.results || []).map((x) => x.name));
  } catch { return new Set(); }
}
const num = (v) => Number(v || 0);
async function one(env, sql, ...binds) {
  try { return await env.DB.prepare(sql).bind(...binds).first(); } catch { return null; }
}
async function all(env, sql, ...binds) {
  try { return (await env.DB.prepare(sql).bind(...binds).all()).results || []; } catch { return []; }
}

// Premium holati — worker.js dagi qoida bilan bir xil:
// is_premium=1 (eski, muddatsiz) YOKI premium_expires_at kelajakda.
function premiumState(u, nowIso) {
  const exp = u.premium_expires_at ? String(u.premium_expires_at) : '';
  const trial = u.trial_expires_at ? String(u.trial_expires_at) : '';
  if (Number(u.is_premium) === 1) return { state: 'active', until: null, legacy: true };
  if (exp && exp > nowIso) return { state: 'active', until: exp, legacy: false };
  if (trial && trial > nowIso) return { state: 'trial', until: trial, legacy: false };
  if (exp) return { state: 'expired', until: exp, legacy: false };
  return { state: 'none', until: null, legacy: false };
}

async function overview(env, H, admin, now) {
  await H.ensureWebOrderTimestampColumns(env);
  const t = await tableSet(env);
  const userCols = await columnSet(env, 'users');
  const nowIso = new Date(now).toISOString();
  const todayStart = secAt(tashkentDayStartMs(now));
  const d7 = secAt(now - 7 * DAY_MS);
  const d30 = secAt(now - 30 * DAY_MS);
  const TEST = H.TEST_USER_IDS_D1;
  const counted = H.revenueBucketSqlD1('counted', 'w');
  const rev = (since) => one(env, `SELECT COALESCE(SUM(w.price),0) AS total, COUNT(*) AS n FROM web_orders w WHERE ${counted} AND ${SEC('w.created_at')} >= ?`, since);

  const hasPrem = userCols.has('premium_expires_at');
  const hasTrial = userCols.has('trial_expires_at');
  const premiumActiveSql = `(is_premium = 1${hasPrem ? ` OR (premium_expires_at IS NOT NULL AND premium_expires_at > ?)` : ''})`;
  const premBinds = hasPrem ? [nowIso] : [];
  const in7 = new Date(now + 7 * DAY_MS).toISOString();
  const physCols = t.has('physical_cards') ? await columnSet(env, 'physical_cards') : new Set();
  const isSuper = admin.role === 'super_admin';

  const [
    revToday, rev7, rev30, usersTotal, usersToday, users7,
    appDay, appWeek, premActive, premExpiring, trialActive, cardsTotal,
    pendingOrders, stalePending, physicalToPrint, companyReview, companyActivate, domainsPending,
    reportsOpen, supportPending, blocks24h, recentPays, recentUsers, refunded30,
  ] = await Promise.all([
    rev(todayStart), rev(d7), rev(d30),
    one(env, `SELECT COUNT(*) AS n FROM users WHERE is_test = 0 AND is_internal = 0 AND deleted_at IS NULL`),
    one(env, `SELECT COUNT(*) AS n FROM users WHERE is_test = 0 AND is_internal = 0 AND ${SEC('created_at')} >= ?`, todayStart),
    one(env, `SELECT COUNT(*) AS n FROM users WHERE is_test = 0 AND is_internal = 0 AND ${SEC('created_at')} >= ?`, d7),
    t.has('app_users') ? one(env, `SELECT COUNT(*) AS n FROM app_users WHERE last_seen >= ? AND user_id NOT IN ${TEST}`, new Date(now - DAY_MS).toISOString()) : null,
    t.has('app_users') ? one(env, `SELECT COUNT(*) AS n FROM app_users WHERE last_seen >= ? AND user_id NOT IN ${TEST}`, new Date(now - 7 * DAY_MS).toISOString()) : null,
    one(env, `SELECT COUNT(*) AS n FROM users WHERE deleted_at IS NULL AND is_test = 0 AND is_internal = 0 AND ${premiumActiveSql}`, ...premBinds),
    hasPrem ? one(env, `SELECT COUNT(*) AS n FROM users WHERE deleted_at IS NULL AND is_test = 0 AND is_internal = 0 AND is_premium = 0 AND premium_expires_at > ? AND premium_expires_at <= ?`, nowIso, in7) : null,
    hasTrial ? one(env, `SELECT COUNT(*) AS n FROM users WHERE deleted_at IS NULL AND is_test = 0 AND is_internal = 0 AND trial_expires_at > ? AND NOT ${premiumActiveSql}`, nowIso, ...premBinds) : null,
    one(env, `SELECT COUNT(*) AS n FROM cards WHERE (user_id IS NULL OR user_id NOT IN ${TEST})`),
    one(env, `SELECT COUNT(*) AS n FROM web_orders WHERE status = 'pending' AND user_id NOT IN (SELECT id FROM users WHERE is_test = 1)`),
    // 24 soatdan eski "kutilmoqda" — odatda tashlab ketilgan to'lov, kod band turibdi.
    one(env, `SELECT COUNT(*) AS n FROM web_orders WHERE status = 'pending' AND user_id NOT IN (SELECT id FROM users WHERE is_test = 1) AND ${SEC('created_at')} < ?`, secAt(now - DAY_MS)),
    t.has('physical_cards') ? one(env, `SELECT COUNT(*) AS n FROM physical_cards WHERE status IN ('pending','printing') AND owner_user_id IS NOT NULL${physCols.has('marketplace_batch_id') ? ' AND marketplace_batch_id IS NULL' : ''}`) : null,
    t.has('companies') ? one(env, `SELECT COUNT(*) AS n FROM companies WHERE status = 'pending_review'`) : null,
    t.has('companies') ? one(env, `SELECT COUNT(*) AS n FROM companies WHERE status IN ('payment_pending','paid')`) : null,
    t.has('companies') ? one(env, `SELECT COUNT(*) AS n FROM companies WHERE custom_domain IS NOT NULL AND custom_domain <> '' AND COALESCE(NULLIF(custom_domain_status,''),'pending') = 'pending'`) : null,
    t.has('content_reports') ? one(env, `SELECT COUNT(*) AS n FROM content_reports WHERE status IN ('new','reviewing') AND (note IS NULL OR note NOT LIKE 'NOVA E2E TEST%')`) : null,
    one(env, `SELECT COUNT(*) AS n FROM support_messages WHERE status = 'pending'`),
    t.has('content_scan_blocks') ? one(env, `SELECT COUNT(*) AS n FROM content_scan_blocks WHERE created_at >= ?`, new Date(now - DAY_MS).toISOString()) : null,
    all(env, `SELECT w.id, w.code, w.kind, w.price, w.created_at, ${H.webOrderChannelSqlD1('w')} AS channel, u.email
      FROM web_orders w LEFT JOIN users u ON u.id = w.user_id WHERE ${counted}
      ORDER BY ${SEC('w.created_at')} DESC, w.id DESC LIMIT 6`),
    all(env, `SELECT id, email, created_at${userCols.has('signup_source') ? ', signup_source' : ", '' AS signup_source"},
        (SELECT code FROM cards WHERE user_id = users.id ORDER BY is_primary DESC, ts ASC LIMIT 1) AS code
      FROM users WHERE is_test = 0 AND is_internal = 0 AND deleted_at IS NULL ORDER BY ${SEC('created_at')} DESC, id DESC LIMIT 6`),
    one(env, `SELECT COALESCE(SUM(w.price),0) AS total, COUNT(*) AS n FROM web_orders w WHERE ${H.revenueBucketSqlD1('refunded', 'w')} AND ${SEC('w.cancel_time')} >= ?`, d30),
  ]);

  // O'chirish navbati — faqat super_admin ko'radi va boshqaradi.
  let deletions = null;
  if (isSuper && (await ensurePurgeSchema(env).then(() => true).catch(() => false))) {
    const cols = await columnSet(env, 'users');
    if (cols.has('purged_at')) {
      const graceCut = secAt(now - PURGE_GRACE_DAYS * DAY_MS);
      const [unrev, blocked, waiting] = await Promise.all([
        one(env, `SELECT COUNT(*) AS n FROM users WHERE deleted_at IS NOT NULL AND purged_at IS NULL
          AND NOT (COALESCE(deletion_source,'') IN ('self','email') OR purge_reviewed_at IS NOT NULL)`),
        one(env, `SELECT COUNT(*) AS n FROM users WHERE purged_at IS NULL AND purge_blocked_reason IS NOT NULL`),
        one(env, `SELECT COUNT(*) AS n FROM users WHERE deleted_at IS NOT NULL AND purged_at IS NULL AND ${SEC('deleted_at')} > ?`, graceCut),
      ]);
      deletions = { unreviewed: num(unrev?.n), blocked: num(blocked?.n), waiting: num(waiting?.n) };
    }
  }

  const queue = {
    pendingOrders: num(pendingOrders?.n),
    stalePendingOrders: num(stalePending?.n),
    physicalToPrint: num(physicalToPrint?.n),
    companyReview: num(companyReview?.n),
    companyActivate: num(companyActivate?.n),
    domainsPending: num(domainsPending?.n),
    reports: num(reportsOpen?.n),
    supportUnanswered: num(supportPending?.n),
    blocks24h: num(blocks24h?.n),
    deletionsNeedAction: deletions ? deletions.unreviewed + deletions.blocked : 0,
  };
  return {
    now: nowIso,
    revenue: {
      today: { total: num(revToday?.total), count: num(revToday?.n) },
      d7: { total: num(rev7?.total), count: num(rev7?.n) },
      d30: { total: num(rev30?.total), count: num(rev30?.n) },
      // Qaytarilgan (so'nggi 30 kunda qaytarish so'ralgan) — jamiga kirmaydi.
      refunded30: { total: num(refunded30?.total), count: num(refunded30?.n) },
    },
    users: { total: num(usersTotal?.n), today: num(usersToday?.n), d7: num(users7?.n) },
    app: { day: num(appDay?.n), week: num(appWeek?.n) },
    premium: { active: num(premActive?.n), expiring7d: num(premExpiring?.n), trial: num(trialActive?.n) },
    cards: { total: num(cardsTotal?.n) },
    queue,
    deletions,
    // Menyu yonidagi sonlar (AdminPage.jsx ADMIN_NAV `badgeKey`).
    badges: {
      pendingOrders: queue.pendingOrders,
      physicalToPrint: queue.physicalToPrint,
      companyRequests: queue.companyReview + queue.companyActivate + queue.domainsPending,
      reports: queue.reports,
      supportUnanswered: queue.supportUnanswered,
      accountDeletions: queue.deletionsNeedAction,
    },
    recent: {
      payments: recentPays.map((r) => ({ id: r.id, code: r.code, kind: r.kind, amount: num(r.price), channel: r.channel, email: r.email || null, createdAt: r.created_at })),
      signups: recentUsers.map((r) => ({ id: r.id, email: r.email, code: r.code || null, source: r.signup_source || 'web', createdAt: r.created_at })),
    },
  };
}

const PREMIUM_FILTERS = ['active', 'expiring', 'expired', 'trial', 'all'];
async function premiumUsers(env, H, url, now) {
  const cols = await columnSet(env, 'users');
  const hasPrem = cols.has('premium_expires_at');
  const hasTrial = cols.has('trial_expires_at');
  const filter = PREMIUM_FILTERS.includes(url.searchParams.get('filter')) ? url.searchParams.get('filter') : 'active';
  const q = String(url.searchParams.get('q') || '').trim().slice(0, 60).toLowerCase();
  const nowIso = new Date(now).toISOString();
  const in7 = new Date(now + 7 * DAY_MS).toISOString();
  const prem = hasPrem ? 'premium_expires_at' : 'NULL';
  const trial = hasTrial ? 'trial_expires_at' : 'NULL';
  const where = ['u.deleted_at IS NULL'];
  const binds = [];
  if (filter === 'active') { where.push(`(u.is_premium = 1 OR ${prem} > ?)`); binds.push(nowIso); }
  if (filter === 'expiring') { where.push(`u.is_premium = 0 AND ${prem} > ? AND ${prem} <= ?`); binds.push(nowIso, in7); }
  if (filter === 'expired') { where.push(`u.is_premium = 0 AND ${prem} IS NOT NULL AND ${prem} <= ?`); binds.push(nowIso); }
  if (filter === 'trial') { // COALESCE: premium_expires_at NULL bo'lsa `NOT (NULL > ?)` NULL beradi va qator tushib qolardi.
    where.push(`${trial} > ? AND u.is_premium = 0 AND NOT (COALESCE(${prem}, '') > ?)`); binds.push(nowIso, nowIso); }
  if (filter === 'all') where.push(`(u.is_premium = 1 OR ${prem} IS NOT NULL OR ${trial} IS NOT NULL)`);
  if (q) {
    where.push(`(LOWER(u.email) LIKE ? OR u.phone LIKE ? OR EXISTS (SELECT 1 FROM cards c WHERE c.user_id = u.id AND LOWER(c.code) LIKE ?))`);
    binds.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  const rows = await all(env, `SELECT u.id, u.email, u.phone, u.is_premium, u.is_test, u.is_internal, u.created_at,
      ${prem} AS premium_expires_at, ${trial} AS trial_expires_at,
      (SELECT GROUP_CONCAT(code) FROM cards WHERE user_id = u.id) AS codes,
      (SELECT MAX(w.created_at) FROM web_orders w WHERE w.user_id = u.id AND w.kind = 'premium_upgrade' AND w.status = 'paid') AS last_paid_at,
      (SELECT COUNT(*) FROM web_orders w WHERE w.user_id = u.id AND w.kind = 'premium_upgrade' AND w.status = 'paid') AS paid_count
    FROM users u WHERE ${where.join(' AND ')}
    ORDER BY COALESCE(${prem}, ${trial}, '') ASC, u.id DESC LIMIT 300`, ...binds);
  const users = rows.map((r) => {
    const p = premiumState(r, nowIso);
    return {
      id: r.id, email: r.email, phone: r.phone || null, codes: r.codes ? String(r.codes).split(',') : [],
      state: p.state, until: p.until, legacy: p.legacy, isTest: !!r.is_test, isInternal: !!r.is_internal,
      lastPaidAt: r.last_paid_at || null, paidCount: num(r.paid_count), createdAt: r.created_at,
    };
  });
  return { filter, users };
}

async function userDetail(env, H, id, now) {
  const t = await tableSet(env);
  const cols = await columnSet(env, 'users');
  const pick = (c) => (cols.has(c) ? c : `NULL AS ${c}`);
  const u = await one(env, `SELECT id, email, phone, created_at, is_test, is_internal, is_premium, deleted_at,
      suspended_until, suspend_reason, strike_count, bot_ack, ${pick('premium_expires_at')}, ${pick('trial_expires_at')},
      ${pick('signup_source')}, ${pick('deletion_source')}, ${pick('purged_at')}
    FROM users WHERE id = ?`, id);
  if (!u) return null;
  await H.ensureWebOrderTimestampColumns(env);
  const nowIso = new Date(now).toISOString();
  const cardCols = await columnSet(env, 'cards');
  const cPick = (c) => (cardCols.has(c) ? c : `NULL AS ${c}`);
  const [cards, companies, orders, physical, support, app, reports] = await Promise.all([
    all(env, `SELECT code, name, ${cPick('profile_type')}, ${cPick('verified')}, ${cPick('tier_override')}, ${cPick('is_primary')}, views, created_at
      FROM cards WHERE user_id = ? ORDER BY ${cardCols.has('is_primary') ? 'is_primary DESC, ' : ''}ts ASC`, id),
    t.has('companies') ? all(env, `SELECT company_id, display_name, status, plan, created_at FROM companies WHERE CAST(owner_user_id AS TEXT) = CAST(? AS TEXT) ORDER BY created_at DESC`, id) : [],
    all(env, `SELECT w.id, w.code, w.kind, w.price, w.status, w.created_at, ${H.webOrderChannelSqlD1('w')} AS channel,
        (w.status = 'paid' AND w.cancel_time IS NOT NULL) AS refunded
      FROM web_orders w WHERE w.user_id = ? ORDER BY ${SEC('w.created_at')} DESC, w.id DESC LIMIT 50`, id),
    t.has('physical_cards') ? all(env, `SELECT id, linked_code, status, active, created_at FROM physical_cards WHERE owner_user_id = ? ORDER BY id DESC LIMIT 20`, id) : [],
    all(env, `SELECT id, message, reply, status, created_at FROM support_messages WHERE user_id = ? ORDER BY id DESC LIMIT 10`, id),
    t.has('app_users') ? one(env, `SELECT platform, first_seen, last_seen, opens FROM app_users WHERE user_id = ?`, id) : null,
    t.has('content_reports') ? one(env, `SELECT COUNT(*) AS n FROM content_reports WHERE owner_code IN (SELECT code FROM cards WHERE user_id = ?) AND status IN ('new','reviewing')`, id) : null,
  ]);
  const p = premiumState(u, nowIso);
  const paid = orders.filter((o) => o.status === 'paid');
  return {
    user: {
      id: u.id, email: u.email, phone: u.phone || null, createdAt: u.created_at, signupSource: u.signup_source || 'web',
      isTest: !!u.is_test, isInternal: !!u.is_internal, deletedAt: u.deleted_at || null, purgedAt: u.purged_at || null,
      deletionSource: u.deletion_source || null, suspendedUntil: u.suspended_until || null, suspendReason: u.suspend_reason || null,
      strikes: num(u.strike_count), telegram: !!u.bot_ack,
      premium: { state: p.state, until: p.until, legacy: p.legacy, trialUntil: u.trial_expires_at || null },
    },
    cards: cards.map((c) => ({ code: c.code, name: c.name, type: c.profile_type || 'personal', verified: !!c.verified, tier: c.tier_override || null, primary: !!c.is_primary, views: num(c.views), createdAt: c.created_at })),
    companies: companies.map((c) => ({ id: c.company_id, name: c.display_name, status: c.status, plan: c.plan || null, createdAt: c.created_at })),
    orders: orders.map((o) => ({ id: o.id, code: o.code, kind: o.kind, amount: num(o.price), status: o.status, channel: o.channel, refunded: !!num(o.refunded), createdAt: o.created_at })),
    totals: {
      // Faqat Payme/Click orqali, qaytarilmagan — admin hisobi bilan bir xil qoida.
      countedPaid: paid.filter((o) => ['payme', 'click'].includes(o.channel) && !num(o.refunded)).reduce((n, o) => n + num(o.price), 0),
      paidOrders: paid.length,
    },
    physicalCards: physical.map((x) => ({ id: x.id, code: x.linked_code, status: x.status, active: !!x.active, createdAt: x.created_at })),
    support: support.map((s) => ({ id: s.id, message: s.message, reply: s.reply, status: s.status, createdAt: s.created_at })),
    app: app ? { platform: app.platform, firstSeen: app.first_seen, lastSeen: app.last_seen, opens: num(app.opens) } : null,
    openReports: num(reports?.n),
  };
}

export async function handle(request, env, url, H) {
  const path = url.pathname;
  const detailMatch = path.match(/^\/api\/admin\/users\/(\d+)\/detail$/);
  const known = path === '/api/admin/overview' || path === '/api/admin/premium-users' || detailMatch;
  if (!known || request.method !== 'GET') return null;
  const admin = await H.requireAdmin(request, env);
  if (!admin) return H.json({ error: 'unauthorized' }, 401);
  const now = Date.now();
  if (path === '/api/admin/overview') return H.json(await overview(env, H, admin, now));
  if (path === '/api/admin/premium-users') return H.json(await premiumUsers(env, H, url, now));
  const d = await userDetail(env, H, Number(detailMatch[1]), now);
  return d ? H.json(d) : H.json({ error: 'not_found' }, 404);
}
