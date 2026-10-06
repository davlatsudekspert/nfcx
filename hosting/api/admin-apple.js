// hosting/api/admin-apple.js — ADMIN "APPLE / iOS" BO'LIMI (2026-10, egasining so'rovi).
//
// ═══ NIMA UCHUN BOR ═══
//
// iOS'da Premium obunasi va "Ko'tarish" Apple In-App Purchase orqali
// sotiladi (api/iap-apple.js, api/iap-apple-boost.js). Egasi shu yerda
// ko'radi: sozlamalar holati, obunalar, tranzaksiyalar, kreditlar,
// Apple bildirishnomalari va muammolar — HAMMASI FAQAT O'QISH.
//
// ═══ MAXFIYLIK ═══
//
//   * Faqat manager+ (requireAdmin + roleAtLeast('manager')).
//   * Foydalanuvchi — faqat `userId` va asosiy NFC kodi (email/telefon YO'Q).
//   * JWS tanasi, appAccountToken, sirlar — hech qachon qaytarilmaydi.
//   * Tranzaksiya raqamlari manager uchun maskalangan (oxirgi 6 belgi),
//     super_admin uchun to'liq.
//   * Holatlar serverda hisoblanadi (UI faqat ko'rsatadi).
//
// ═══ MARSHRUTLAR (hammasi GET) ═══
//
//   /api/admin/apple/summary
//   /api/admin/apple/subscriptions?state=active|expired|autorenew_off|expiring|revoked&env=&q=&cursor=
//   /api/admin/apple/transactions?kind=premium|boost&state=&env=&userId=&cursor=
//   /api/admin/apple/notifications?type=&result=&env=&since=&cursor=
//   /api/admin/apple/credits?state=unused|used|revoked&cursor=
// Sahifa — 50 ta, keyset kursor (`nextCursor`, `hasMore`).
// Shuningdek: `appleForUser` (foydalanuvchi kartochkasi) va
// `appleAttention` (menyu belgisi) — admin-control.js chaqiradi.

import { PRODUCTS, BUNDLE_ID, iapAppleEnabled } from './iap-apple.js';
import { BOOST_PRODUCTS } from './iap-apple-boost.js';
import { salesState } from './featured.js';

const PAGE = 50;
const DAY_MS = 86_400_000;
const CLAIM_STALE_MS = 60_000;
const TABLES = ['iap_apple_account_tokens', 'iap_apple_subscriptions', 'iap_apple_transactions', 'iap_apple_notifications',
  'iap_apple_boost_transactions', 'iap_apple_boost_credits'];

async function tableSet(env) {
  const r = await env.DB.prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`).all().catch(() => null);
  return new Set((r?.results || []).map((x) => x.name));
}
async function cols(env, table) {
  const r = await env.DB.prepare(`PRAGMA table_info("${table}")`).all().catch(() => null);
  return new Set((r?.results || []).map((x) => x.name));
}
const num = (v) => Number(v || 0);
async function all(env, sql, ...b) { try { return (await env.DB.prepare(sql).bind(...b).all()).results || []; } catch { return []; } }
async function one(env, sql, ...b) { try { return await env.DB.prepare(sql).bind(...b).first(); } catch { return null; } }

const PRIMARY_CODE = (col) => `(SELECT code FROM cards WHERE user_id = ${col} ORDER BY is_primary DESC, ts ASC LIMIT 1)`;
export const maskTx = (id, isSuper) => {
  if (id === null || id === undefined || id === '') return null;
  const s = String(id);
  return isSuper ? s : (s.length > 6 ? `…${s.slice(-6)}` : s);
};
const envKey = (e) => (e === 'Production' ? 'production' : (e === 'Sandbox' ? 'sandbox' : 'other'));
const ENVS = { Production: 'Production', Sandbox: 'Sandbox' };

// Kursor: base64url JSON [kalit, ikkinchi kalit]. Worker'da `Buffer` yo'q
// (nodejs_compat yoqilmagan) — btoa/atob + UTF-8.
const encCursor = (a, b) => {
  const bytes = new TextEncoder().encode(JSON.stringify([a, b]));
  let bin = '';
  for (const x of bytes) bin += String.fromCharCode(x);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
function decCursor(c) {
  if (!c) return null;
  try {
    const s = String(c).replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(s + '='.repeat((4 - (s.length % 4)) % 4));
    const v = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (ch) => ch.charCodeAt(0))));
    return Array.isArray(v) && v.length === 2 ? v : null;
  } catch { return null; }
}
// Keyset sahifalash: ORDER BY k1 DESC, k2 DESC.
function page(rows, k1, k2) {
  const more = rows.length > PAGE;
  const items = rows.slice(0, PAGE);
  const last = items[items.length - 1];
  return { items, hasMore: more, nextCursor: more && last ? encCursor(last[k1], last[k2]) : null };
}
function cursorWhere(cursor, c1, c2, where, binds) {
  const cur = decCursor(cursor);
  if (!cur) return;
  where.push(`(${c1} < ? OR (${c1} = ? AND ${c2} < ?))`);
  binds.push(cur[0], cur[0], cur[1]);
}

// Obuna holati (serverda): revoked > active/autorenew_off > expired.
function subState(r, nowIso) {
  if (r.revoked) return 'revoked';
  // `auto_renew` NULL — noma'lum (renewal ma'lumoti kelmagan): faol deb olinadi.
  if (r.expires_at && String(r.expires_at) > nowIso) return r.auto_renew !== null && r.auto_renew !== undefined && Number(r.auto_renew) === 0 ? 'autorenew_off' : 'active';
  return 'expired';
}

// ═══ HOLAT ═══
async function summary(env, H, admin) {
  const isSuper = admin.role === 'super_admin';
  const t = await tableSet(env);
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const d1 = new Date(now - DAY_MS).toISOString();
  const d7 = new Date(now - 7 * DAY_MS).toISOString();
  const d30 = new Date(now - 30 * DAY_MS).toISOString();
  const in7 = new Date(now + 7 * DAY_MS).toISOString();
  const staleIso = new Date(now - CLAIM_STALE_MS).toISOString();
  const has = (x) => t.has(x);

  const sales = await salesState(env, H).catch(() => null);
  const sandboxIds = String(env.IAP_APPLE_SANDBOX_USER_IDS ?? '').split(',').map((x) => Number(x.trim())).filter((x) => Number.isInteger(x) && x > 0);
  let sandboxUsers = null;
  if (isSuper) {
    sandboxUsers = [];
    for (const id of sandboxIds.slice(0, 50)) {
      const r = await one(env, `SELECT ${PRIMARY_CODE('?')} AS code`, id);
      sandboxUsers.push({ userId: id, code: r?.code || null });
    }
  }

  const [subs, revoked, boostTx, credits, notif24, notif7, lastNotif, unknownUser, staleNotif, staleClaims, sigCount, sigLast, appTotals, builds] = await Promise.all([
    has('iap_apple_subscriptions') ? all(env, `SELECT environment AS env,
        SUM(CASE WHEN expires_at > ? AND COALESCE(auto_renew, 1) <> 0 THEN 1 ELSE 0 END) AS active,
        SUM(CASE WHEN expires_at > ? AND auto_renew = 0 THEN 1 ELSE 0 END) AS autorenew_off,
        SUM(CASE WHEN expires_at > ? AND expires_at <= ? THEN 1 ELSE 0 END) AS expiring7d,
        COUNT(*) AS total
      FROM iap_apple_subscriptions GROUP BY environment`, nowIso, nowIso, nowIso, in7) : [],
    has('iap_apple_transactions') ? all(env, `SELECT environment AS env, COUNT(*) AS n FROM iap_apple_transactions
      WHERE revoked_at IS NOT NULL AND revoked_at >= ? GROUP BY environment`, d30) : [],
    has('iap_apple_boost_transactions') ? all(env, `SELECT environment AS env, product_id AS product,
        CASE WHEN revoked_at IS NOT NULL THEN 'revoked' WHEN state = 'done' AND slot_id IS NOT NULL THEN 'slot'
             WHEN state = 'done' AND credit_id IS NOT NULL THEN 'credit' ELSE state END AS st, COUNT(*) AS n
      FROM iap_apple_boost_transactions WHERE created_at >= ? GROUP BY env, product, st`, d30) : [],
    has('iap_apple_boost_credits') ? all(env, `SELECT environment AS env,
        SUM(CASE WHEN revoked_at IS NOT NULL THEN 1 ELSE 0 END) AS revoked,
        SUM(CASE WHEN revoked_at IS NULL AND used_at IS NOT NULL THEN 1 ELSE 0 END) AS used,
        SUM(CASE WHEN revoked_at IS NULL AND used_at IS NULL THEN 1 ELSE 0 END) AS unused
      FROM iap_apple_boost_credits GROUP BY environment`) : [],
    has('iap_apple_notifications') ? all(env, `SELECT result, COUNT(*) AS n FROM iap_apple_notifications WHERE received_at >= ? GROUP BY result`, d1) : [],
    has('iap_apple_notifications') ? all(env, `SELECT result, COUNT(*) AS n FROM iap_apple_notifications WHERE received_at >= ? GROUP BY result`, d7) : [],
    has('iap_apple_notifications') ? one(env, `SELECT MAX(received_at) AS at FROM iap_apple_notifications`) : null,
    has('iap_apple_notifications') ? one(env, `SELECT COUNT(*) AS n FROM iap_apple_notifications WHERE result = 'unknown_user' AND received_at >= ?`, d7) : null,
    has('iap_apple_notifications') ? one(env, `SELECT COUNT(*) AS n FROM iap_apple_notifications WHERE result = 'processing' AND received_at < ?`, staleIso) : null,
    has('iap_apple_boost_transactions') ? one(env, `SELECT COUNT(*) AS n FROM iap_apple_boost_transactions WHERE state = 'claimed' AND created_at < ?`, staleIso) : null,
    one(env, `SELECT value FROM admin_settings WHERE key = 'iap_apple_sig_fail_count'`),
    one(env, `SELECT value FROM admin_settings WHERE key = 'iap_apple_sig_fail_last'`),
    has('app_users') ? all(env, `SELECT CASE WHEN LOWER(a.platform) LIKE '%ios%' THEN 'ios' WHEN LOWER(a.platform) LIKE '%android%' THEN 'android' ELSE 'other' END AS platform,
        COUNT(*) AS total, SUM(CASE WHEN a.last_seen >= ? THEN 1 ELSE 0 END) AS active7d
      FROM app_users a JOIN users u ON u.id = a.user_id
      WHERE u.deleted_at IS NULL AND COALESCE(u.is_test, 0) = 0 AND COALESCE(u.is_internal, 0) = 0
      GROUP BY 1`, d7) : [],
    has('app_users') && (await cols(env, 'app_users')).has('app_build') ? all(env, `SELECT
        CASE WHEN LOWER(a.platform) LIKE '%ios%' THEN 'ios' WHEN LOWER(a.platform) LIKE '%android%' THEN 'android' ELSE 'other' END AS platform,
        a.app_build AS build, COUNT(*) AS users, SUM(CASE WHEN a.last_seen >= ? THEN 1 ELSE 0 END) AS active7d
      FROM app_users a JOIN users u ON u.id = a.user_id
      WHERE u.deleted_at IS NULL AND COALESCE(u.is_test, 0) = 0 AND COALESCE(u.is_internal, 0) = 0
      GROUP BY 1, 2 ORDER BY 1, 2 DESC LIMIT 40`, d7) : [],
  ]);

  const byEnv = () => ({ production: {}, sandbox: {}, other: {} });
  const subsOut = byEnv();
  for (const r of subs) {
    subsOut[envKey(r.env)] = { active: num(r.active), autorenewOff: num(r.autorenew_off), expiring7d: num(r.expiring7d), total: num(r.total), revoked30d: 0 };
  }
  for (const r of revoked) {
    const k = envKey(r.env);
    subsOut[k] = { active: 0, autorenewOff: 0, expiring7d: 0, total: 0, ...subsOut[k], revoked30d: num(r.n) };
  }
  const boostOut = byEnv();
  for (const r of boostTx) {
    const k = envKey(r.env);
    const prod = String(r.product || '');
    boostOut[k][prod] = boostOut[k][prod] || {};
    boostOut[k][prod][String(r.st)] = num(r.n);
  }
  const creditsOut = byEnv();
  for (const r of credits) creditsOut[envKey(r.env)] = { unused: num(r.unused), used: num(r.used), revoked: num(r.revoked) };
  const toMap = (rows) => Object.fromEntries(rows.map((r) => [String(r.result || ''), num(r.n)]));
  const problems = {
    unknownUser7d: num(unknownUser?.n),
    staleProcessing: num(staleNotif?.n),
    staleBoostClaims: num(staleClaims?.n),
    signatureFailures: num(sigCount?.value),
    lastSignatureFailureAt: sigLast?.value || null,
  };
  return {
    flags: {
      iapEnabled: iapAppleEnabled(env),
      boostEnabled: iapAppleEnabled(env) && !!H.paymentsEnabledD1(env),
      allowSandboxAll: String(env.IAP_APPLE_ALLOW_SANDBOX ?? '') === '1',
      sandboxUserCount: sandboxIds.length,
      ...(isSuper ? { sandboxUserIds: sandboxUsers } : {}),
      featuredSales: sales ? { mode: sales.mode, open: sales.open, usersCount: sales.usersCount, openAt: sales.openAt } : null,
    },
    bundleId: BUNDLE_ID,
    products: {
      premium: PRODUCTS,
      boost: BOOST_PRODUCTS.map((p) => ({ productId: p.productId, days: p.days })),
      pricesNote: 'Narxlar App Store Connect’da belgilanadi.',
    },
    counts: { subscriptions: subsOut, boostTx30d: boostOut, credits: creditsOut },
    notifications: { last24h: toMap(notif24), last7d: toMap(notif7), lastNotificationAt: lastNotif?.at || null },
    problems,
    attention: problems.staleProcessing + problems.staleBoostClaims + problems.unknownUser7d,
    app: {
      totals: Object.fromEntries(appTotals.map((r) => [r.platform, { total: num(r.total), active7d: num(r.active7d) }])),
      builds: builds.map((r) => ({ platform: r.platform, build: r.build === null ? null : num(r.build), users: num(r.users), active7d: num(r.active7d) })),
    },
  };
}

// Menyu belgisi (admin-control.js overview) — e'tibor talab qiladigan holatlar soni.
export async function appleAttention(env) {
  const t = await tableSet(env);
  const staleIso = new Date(Date.now() - CLAIM_STALE_MS).toISOString();
  const d7 = new Date(Date.now() - 7 * DAY_MS).toISOString();
  const [a, b, c] = await Promise.all([
    t.has('iap_apple_notifications') ? one(env, `SELECT COUNT(*) AS n FROM iap_apple_notifications WHERE result = 'processing' AND received_at < ?`, staleIso) : null,
    t.has('iap_apple_boost_transactions') ? one(env, `SELECT COUNT(*) AS n FROM iap_apple_boost_transactions WHERE state = 'claimed' AND created_at < ?`, staleIso) : null,
    t.has('iap_apple_notifications') ? one(env, `SELECT COUNT(*) AS n FROM iap_apple_notifications WHERE result = 'unknown_user' AND received_at >= ?`, d7) : null,
  ]);
  return num(a?.n) + num(b?.n) + num(c?.n);
}

// ═══ RO'YXATLAR ═══
async function subscriptions(env, admin, url) {
  if (!(await tableSet(env)).has('iap_apple_subscriptions')) return { items: [], hasMore: false, nextCursor: null };
  const isSuper = admin.role === 'super_admin';
  const nowIso = new Date().toISOString();
  const in7 = new Date(Date.now() + 7 * DAY_MS).toISOString();
  const d30 = new Date(Date.now() - 30 * DAY_MS).toISOString();
  const state = String(url.searchParams.get('state') || '');
  const env_ = ENVS[url.searchParams.get('env')] || null;
  const q = String(url.searchParams.get('q') || '').trim().slice(0, 64);
  const where = [];
  const binds = [];
  const REVOKED = `EXISTS (SELECT 1 FROM iap_apple_transactions x WHERE x.original_transaction_id = s.original_transaction_id AND x.revoked_at IS NOT NULL AND x.revoked_at >= ?)`;
  if (state === 'active') { where.push(`s.expires_at > ? AND COALESCE(s.auto_renew, 1) <> 0`); binds.push(nowIso); }
  if (state === 'autorenew_off') { where.push(`s.expires_at > ? AND s.auto_renew = 0`); binds.push(nowIso); }
  if (state === 'expiring') { where.push(`s.expires_at > ? AND s.expires_at <= ?`); binds.push(nowIso, in7); }
  if (state === 'expired') { where.push(`(s.expires_at IS NULL OR s.expires_at <= ?)`); binds.push(nowIso); }
  if (state === 'revoked') { where.push(REVOKED); binds.push(d30); }
  if (env_) { where.push(`s.environment = ?`); binds.push(env_); }
  if (q) {
    if (/^\d{1,9}$/.test(q)) { where.push(`(s.user_id = ? OR s.original_transaction_id = ?)`); binds.push(Number(q), q); }
    else { where.push(`(s.user_id IN (SELECT user_id FROM cards WHERE UPPER(code) = UPPER(?)) OR s.original_transaction_id = ?)`); binds.push(q, q); }
  }
  cursorWhere(url.searchParams.get('cursor'), 's.updated_at', 's.original_transaction_id', where, binds);
  const rows = await all(env, `SELECT s.original_transaction_id, s.user_id, s.product_id, s.environment, s.last_transaction_id,
      s.expires_at, s.status, s.auto_renew, s.created_at, s.updated_at, ${PRIMARY_CODE('s.user_id')} AS code,
      ${REVOKED} AS revoked
    FROM iap_apple_subscriptions s ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY s.updated_at DESC, s.original_transaction_id DESC LIMIT ${PAGE + 1}`, d30, ...binds);
  const p = page(rows, 'updated_at', 'original_transaction_id');
  return {
    ...p,
    items: p.items.map((r) => ({
      originalTransactionId: maskTx(r.original_transaction_id, isSuper), lastTransactionId: maskTx(r.last_transaction_id, isSuper),
      userId: num(r.user_id), code: r.code || null, productId: r.product_id, environment: r.environment,
      expiresAt: r.expires_at || null, autoRenew: r.auto_renew === null ? null : !!num(r.auto_renew),
      lastEvent: r.status || null, state: subState(r, nowIso), createdAt: r.created_at, updatedAt: r.updated_at,
    })),
  };
}

function premiumTxState(r) {
  if (r.revoked_at) return r.rolled_back_at ? 'revoked_rolled_back' : 'revoked';
  const g = num(r.granted);
  if (g === 1) return 'granted';
  if (g === 2) return 'claimed';
  return 'not_granted';
}
function boostTxState(r) {
  if (r.revoked_at) return 'revoked';
  if (r.state === 'done') return r.slot_id ? 'slot' : (r.credit_id ? 'credit' : 'done');
  return String(r.state || '');
}

async function transactions(env, admin, url) {
  const isSuper = admin.role === 'super_admin';
  const kind = url.searchParams.get('kind') === 'boost' ? 'boost' : 'premium';
  const t = await tableSet(env);
  const table = kind === 'boost' ? 'iap_apple_boost_transactions' : 'iap_apple_transactions';
  if (!t.has(table)) return { kind, items: [], hasMore: false, nextCursor: null };
  const c = await cols(env, table);
  const priceSel = c.has('price') ? 'x.price, x.currency' : 'NULL AS price, NULL AS currency';
  const state = String(url.searchParams.get('state') || '');
  const env_ = ENVS[url.searchParams.get('env')] || null;
  const userId = Number(url.searchParams.get('userId'));
  const where = [];
  const binds = [];
  if (kind === 'premium') {
    if (state === 'granted') where.push(`x.granted = 1 AND x.revoked_at IS NULL`);
    if (state === 'claimed') where.push(`x.granted = 2 AND x.revoked_at IS NULL`);
    if (state === 'not_granted') where.push(`x.granted = 0 AND x.revoked_at IS NULL`);
    if (state === 'revoked') where.push(`x.revoked_at IS NOT NULL`);
  } else {
    if (state === 'slot') where.push(`x.state = 'done' AND x.slot_id IS NOT NULL AND x.revoked_at IS NULL`);
    if (state === 'credit') where.push(`x.state = 'done' AND x.credit_id IS NOT NULL AND x.revoked_at IS NULL`);
    if (state === 'claimed') where.push(`x.state = 'claimed'`);
    if (state === 'revoked') where.push(`x.revoked_at IS NOT NULL`);
  }
  if (env_) { where.push(`x.environment = ?`); binds.push(env_); }
  if (Number.isInteger(userId) && userId >= 0 && url.searchParams.has('userId')) { where.push(`x.user_id = ?`); binds.push(userId); }
  cursorWhere(url.searchParams.get('cursor'), 'x.created_at', 'x.transaction_id', where, binds);
  const rows = await all(env, `SELECT x.*, ${priceSel}, ${PRIMARY_CODE('x.user_id')} AS code FROM ${table} x
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY x.created_at DESC, x.transaction_id DESC LIMIT ${PAGE + 1}`, ...binds);
  const p = page(rows, 'created_at', 'transaction_id');
  return {
    kind,
    ...p,
    items: p.items.map((r) => kind === 'premium' ? {
      transactionId: maskTx(r.transaction_id, isSuper), originalTransactionId: maskTx(r.original_transaction_id, isSuper),
      userId: num(r.user_id), code: r.code || null, productId: r.product_id, environment: r.environment,
      expiresAt: r.expires_at || null, prevPremiumExpiresAt: r.prev_premium_expires_at || null,
      grantedPremiumExpiresAt: r.granted_premium_expires_at || null, state: premiumTxState(r),
      revokedAt: r.revoked_at || null, rolledBackAt: r.rolled_back_at || null, source: r.source || null,
      price: r.price === null ? null : num(r.price), currency: r.currency || null, createdAt: r.created_at,
    } : {
      transactionId: maskTx(r.transaction_id, isSuper), userId: num(r.user_id), code: r.code || null,
      productId: r.product_id, days: num(r.days), environment: r.environment, state: boostTxState(r),
      intentId: r.intent_id === null ? null : num(r.intent_id), slotId: r.slot_id === null ? null : num(r.slot_id),
      creditId: r.credit_id === null ? null : num(r.credit_id), revokedAt: r.revoked_at || null,
      price: r.price === null ? null : num(r.price), currency: r.currency || null, createdAt: r.created_at,
    }),
  };
}

async function notifications(env, admin, url) {
  if (!(await tableSet(env)).has('iap_apple_notifications')) return { items: [], hasMore: false, nextCursor: null };
  const isSuper = admin.role === 'super_admin';
  const where = [];
  const binds = [];
  const type = String(url.searchParams.get('type') || '').slice(0, 40);
  const result = String(url.searchParams.get('result') || '').slice(0, 40);
  const env_ = ENVS[url.searchParams.get('env')] || null;
  const sinceRaw = url.searchParams.get('since');
  const sinceMs = sinceRaw ? (Number.isFinite(Number(sinceRaw)) ? Number(sinceRaw) : Date.parse(sinceRaw)) : NaN;
  if (type) { where.push(`notification_type = ?`); binds.push(type); }
  if (result) { where.push(`result = ?`); binds.push(result); }
  if (env_) { where.push(`environment = ?`); binds.push(env_); }
  if (Number.isFinite(sinceMs)) { where.push(`received_at >= ?`); binds.push(new Date(sinceMs).toISOString()); }
  cursorWhere(url.searchParams.get('cursor'), 'received_at', 'notification_uuid', where, binds);
  const rows = await all(env, `SELECT n.*, ${PRIMARY_CODE('n.user_id')} AS code FROM iap_apple_notifications n
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY received_at DESC, notification_uuid DESC LIMIT ${PAGE + 1}`, ...binds);
  const p = page(rows, 'received_at', 'notification_uuid');
  return {
    ...p,
    items: p.items.map((r) => ({
      uuid: maskTx(r.notification_uuid, isSuper), type: r.notification_type, subtype: r.subtype || null,
      environment: r.environment || null, result: r.result, userId: r.user_id === null ? null : num(r.user_id), code: r.code || null,
      transactionId: maskTx(r.transaction_id, isSuper), originalTransactionId: maskTx(r.original_transaction_id, isSuper),
      receivedAt: r.received_at,
    })),
  };
}

async function credits(env, admin, url) {
  if (!(await tableSet(env)).has('iap_apple_boost_credits')) return { items: [], hasMore: false, nextCursor: null };
  const isSuper = admin.role === 'super_admin';
  const state = String(url.searchParams.get('state') || '');
  const where = [];
  const binds = [];
  if (state === 'unused') where.push(`revoked_at IS NULL AND used_at IS NULL`);
  if (state === 'used') where.push(`revoked_at IS NULL AND used_at IS NOT NULL`);
  if (state === 'revoked') where.push(`revoked_at IS NOT NULL`);
  const cur = decCursor(url.searchParams.get('cursor'));
  if (cur) { where.push(`id < ?`); binds.push(Number(cur[0])); }
  const rows = await all(env, `SELECT c.*, ${PRIMARY_CODE('c.user_id')} AS code FROM iap_apple_boost_credits c
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY id DESC LIMIT ${PAGE + 1}`, ...binds);
  const p = page(rows, 'id', 'id');
  return {
    ...p,
    items: p.items.map((r) => ({
      creditId: num(r.id), userId: num(r.user_id), code: r.code || null, days: num(r.days), productId: r.product_id,
      environment: r.environment, transactionId: maskTx(r.transaction_id, isSuper),
      state: r.revoked_at ? 'revoked' : (r.used_at ? 'used' : 'unused'),
      usedSlotId: r.used_slot_id === null ? null : num(r.used_slot_id), createdAt: r.created_at, usedAt: r.used_at || null, revokedAt: r.revoked_at || null,
    })),
  };
}

// ═══ FOYDALANUVCHI KARTOCHKASI ═══ (admin-control.js `userDetail`)
export async function appleForUser(env, admin, userId) {
  // Faqat manager+ (ko'rik F4) — chaqiruvchi tekshirmasa ham.
  if (!['manager', 'super_admin'].includes(String(admin?.role || ''))) return null;
  const t = await tableSet(env);
  if (!TABLES.some((x) => t.has(x))) return null;
  const isSuper = admin.role === 'super_admin';
  const nowIso = new Date().toISOString();
  const [tok, subs, ptx, btx, cr] = await Promise.all([
    t.has('iap_apple_account_tokens') ? one(env, `SELECT 1 AS x FROM iap_apple_account_tokens WHERE user_id = ?`, userId) : null,
    t.has('iap_apple_subscriptions') ? all(env, `SELECT * FROM iap_apple_subscriptions WHERE user_id = ? ORDER BY updated_at DESC LIMIT 10`, userId) : [],
    t.has('iap_apple_transactions') ? all(env, `SELECT * FROM iap_apple_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 20`, userId) : [],
    t.has('iap_apple_boost_transactions') ? all(env, `SELECT * FROM iap_apple_boost_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 20`, userId) : [],
    t.has('iap_apple_boost_credits') ? all(env, `SELECT * FROM iap_apple_boost_credits WHERE user_id = ? ORDER BY id DESC LIMIT 20`, userId) : [],
  ]);
  return {
    hasToken: !!tok,
    subscriptions: subs.map((r) => ({
      originalTransactionId: maskTx(r.original_transaction_id, isSuper), productId: r.product_id, environment: r.environment,
      expiresAt: r.expires_at || null, autoRenew: r.auto_renew === null ? null : !!num(r.auto_renew), lastEvent: r.status || null,
      state: subState(r, nowIso),
    })),
    premiumTx: ptx.map((r) => ({ transactionId: maskTx(r.transaction_id, isSuper), productId: r.product_id, environment: r.environment,
      expiresAt: r.expires_at || null, state: premiumTxState(r), createdAt: r.created_at })),
    boostTx: btx.map((r) => ({ transactionId: maskTx(r.transaction_id, isSuper), productId: r.product_id, days: num(r.days),
      environment: r.environment, state: boostTxState(r), createdAt: r.created_at })),
    credits: cr.map((r) => ({ creditId: num(r.id), days: num(r.days), state: r.revoked_at ? 'revoked' : (r.used_at ? 'used' : 'unused'), createdAt: r.created_at })),
  };
}

/// Faol Apple obunasi bormi (Premium olib qo'yishdan oldin — worker.js).
export async function activeAppleSubscription(env, userId) {
  const t = await tableSet(env);
  if (!t.has('iap_apple_subscriptions')) return null;
  return one(env, `SELECT original_transaction_id, product_id, environment, expires_at, auto_renew FROM iap_apple_subscriptions
    WHERE user_id = ? AND expires_at > ? ORDER BY expires_at DESC LIMIT 1`, userId, new Date().toISOString());
}

export async function handle(request, env, url, H) {
  const p = url.pathname;
  if (!p.startsWith('/api/admin/apple/')) return null;
  if (request.method !== 'GET') return H.json({ error: 'method_not_allowed' }, 405);
  const admin = await H.requireAdmin(request, env);
  if (!admin) return H.json({ error: 'unauthorized' }, 401);
  if (!H.roleAtLeast(admin, 'manager')) return H.json({ error: 'forbidden' }, 403);
  if (p === '/api/admin/apple/summary') return H.json(await summary(env, H, admin));
  if (p === '/api/admin/apple/subscriptions') return H.json(await subscriptions(env, admin, url));
  if (p === '/api/admin/apple/transactions') return H.json(await transactions(env, admin, url));
  if (p === '/api/admin/apple/notifications') return H.json(await notifications(env, admin, url));
  if (p === '/api/admin/apple/credits') return H.json(await credits(env, admin, url));
  return H.json({ error: 'not_found' }, 404);
}
