// hosting/api/iap-apple.js — APPLE IN-APP PURCHASE: PREMIUM OBUNASI (iOS).
//
// ═══ NIMA UCHUN BOR ═══
//
// App Store qoidasi (3.1.1): iOS ilovada raqamli imkoniyat (Premium)
// faqat Apple In-App Purchase orqali sotiladi. Sayt va Android'dagi
// Payme/Click to'lovi o'zgarmaydi — bu modul ularga TEGMAYDI. Ikkala yo'l
// ham BITTA ustunni uzaytiradi: `users.premium_expires_at`.
//
// ═══ KONTRAKT (ilova shunga qarab yozilgan) ═══
//
//   Bundle ID: uz.nfcstore.nova. Mahsulotlar (auto-renewable, bitta
//   "NFCSTORE Premium" guruhi): PRODUCTS (pastda).
//   Bayroq: env `IAP_APPLE_ENABLED` = '1' — yoqiq; boshqa har qanday qiymat — o'chiq.
//
//   GET  /api/iap/apple/config          (kirish ixtiyoriy)
//        → { enabled: boolean, products: [...] }
//   GET  /api/iap/apple/account-token   (kirish SHART, aks holda 401)
//        → { token: '<uuid v4>' }  — har foydalanuvchiga bitta, o'zgarmaydi.
//        Ilova uni `applicationUserName` qilib beradi → StoreKit 2 `appAccountToken`.
//   POST /api/iap/apple/verify          (kirish SHART) { signedTransaction }
//        401 unauthorized | 503 iap_disabled | 429 too_many_requests | 413 payload_too_large
//        | 400 bad_request | 400 invalid_signature
//        | 422 wrong_bundle | unknown_product | wrong_type | bad_transaction
//            | family_shared_not_supported | sandbox_not_allowed
//        | 403 account_mismatch | 409 already_linked
//        → 200 { premium: true, premiumExpiresAt, productId, environment }
//        → 200 { premium: false, reason: 'expired' | 'revoked', premiumExpiresAt }
//   POST /api/iap/apple/notifications   (kirishsiz — App Store Server Notifications V2)
//        { signedPayload } → 200 { ok: true, result, duplicate? } | 400 bad_request | invalid_signature
//        | 413 payload_too_large (128 KB dan katta — tana o'qilmaydi)
//
//   KO'TARISH (consumable, api/iap-apple-boost.js — to'liq kontrakt o'sha yerda):
//   POST /api/iap/apple/boost-intent {targetKind, targetId, days} (kirish SHART)
//   POST /api/iap/apple/verify {signedTransaction, intentId?} — consumable bo'lsa
//        → {boost:'active', slot} | {boost:'credited', creditId, days} | {boost:'revoked'}
//   POST /api/iap/apple/boost-redeem {creditId, targetKind, targetId}
//   GET  /api/iap/apple/boost-credits
//
// ═══ QOIDALAR ═══
//
//   * Imzo: hosting/api/apple-jws.js (Apple Root CA - G3 ga pin).
//   * EGALIK: tranzaksiyada `appAccountToken` bo'lsa — u SHU foydalanuvchining
//     tokeni bo'lishi shart (403). `originalTransactionId` birinchi ko'rilganda
//     foydalanuvchiga bog'lanadi (`iap_apple_subscriptions`, PRIMARY KEY);
//     boshqasiga bog'langan bo'lsa — 409. Bitta Apple obunasi bilan ikki
//     hisobga Premium berib bo'lmaydi. Egasi O'CHIRILGAN bo'lsa — yangi
//     hisobga ko'chiriladi (token egasi o'chirilgan bo'lsa 403 ham emas).
//   * Family Sharing o'chiq: `inAppOwnershipType = FAMILY_SHARED` berilmaydi.
//   * BERISH: `premium_expires_at = max(joriy, expiresDate)`. max() tufayli
//     tabiiy idempotent: bitta tranzaksiya ikki marta kelsa ham muddat
//     ikki marta uzaymaydi. Har `transactionId` uchun daftar qatori
//     (`iap_apple_transactions`) — DA'VO: uni qo'shgan so'rovgina `users`
//     ni yozadi (poyga himoyasi, `grantTransaction` izohi).
//   * QAYTARISH (REFUND/REVOKE): faqat Apple QO'SHGAN vaqt olib tashlanadi
//     (`revokeTransaction` izohi, formula bilan); sayt (Payme/Click) orqali
//     to'langan vaqt HECH QACHON olinmaydi. Qaytarilgan tranzaksiya qayta
//     berilmaydi (eski JWS bilan ham, foydalanuvchi noma'lum bo'lgan
//     bo'lsa ham), REFUND_REVERSED bo'lmaguncha.
//   * Sandbox faqat ruxsat bilan: `IAP_APPLE_ALLOW_SANDBOX=1` yoki user ID
//     `IAP_APPLE_SANDBOX_USER_IDS` da (App Review demo hisobi). Aks holda
//     verify 422 `sandbox_not_allowed`, bildirishnoma `sandbox_ignored`.
//     Muhit daftarga yoziladi.
//   * Bildirishnomalar bayroq O'CHIQ bo'lsa ham qayta ishlanadi (Apple TEST
//     va sandbox yuboradi). Imzosi to'g'ri har payload'ga 200 (foydalanuvchi
//     topilmasa ham — log); imzo noto'g'ri — 400. `notificationUUID` avval
//     `processing` bo'lib da'vo qilinadi — faqat da'vogar qayta ishlaydi;
//     xatoda da'vo o'chiriladi (Apple qayta yuboradi).
//
// ═══ MA'LUM CHEKLOVLAR (ataylab) ═══
//
//   * Sayt orqali olingan Premium bor odam Apple obunasini olsa, muddatlar
//     QO'SHILMAYDI — max() (uzunrog'i qoladi).
//   * Billing Grace Period hisobga olinmaydi (faqat `expiresDate`).
//
// ═══ JADVALLAR (faqat CREATE TABLE IF NOT EXISTS) ═══
//
//   iap_apple_account_tokens (user_id PK, token UNIQUE)
//   iap_apple_subscriptions  (original_transaction_id PK → user_id, holat)
//   iap_apple_transactions   (transaction_id PK — daftar)
//   iap_apple_notifications  (notification_uuid PK — takrorga qarshi)
// Shaxsiy ma'lumot (email/telefon) YO'Q — faqat user_id va Apple raqamlari.
// Moliyaviy yozuv sifatida hisob o'chirilganda ham qoladi.

import { verifyAppleJws } from './apple-jws.js';
// "Ko'tarish" (FEATURED) consumable'lari — alohida modul, tekshiruvlar shu yerda umumiy.
import * as boost from './iap-apple-boost.js';
import { salesState } from './featured.js';

export const BUNDLE_ID = 'uz.nfcstore.nova';
export const PRODUCTS = ['uz.nfcstore.nova.premium.monthly', 'uz.nfcstore.nova.premium.yearly'];
const SUBSCRIPTION_TYPE = 'Auto-Renewable Subscription';
const ROLLBACK_TOLERANCE_MS = 2000;
const VERIFY_RATE_LIMIT = 60;
const VERIFY_RATE_WINDOW_MS = 10 * 60_000;

export const iapAppleEnabled = (env) => String(env.IAP_APPLE_ENABLED ?? '') === '1';

// ═══ FAQAT TESTLAR UCHUN ═══
// scripts/test-iap-apple.mjs soxta zanjir yasaydi va uning ildizini shu
// yerda beradi. env orqali EMAS — production'da hech qanday sozlama
// (secret, var) ildizni almashtira olmaydi; bu funksiyani worker hech
// qayerda chaqirmaydi.
let testRootB64 = null;
export function __setTrustedRootForTests(b64) { testRootB64 = b64 || null; }
const verifyJws = (jws) => verifyAppleJws(jws, testRootB64 ? { rootCertB64: testRootB64 } : {});

// Isolate bo'yicha bir marta — lekin D1 va O'zbekiston bazasi uchun
// alohida (ko'chirish paytida env.DB almashsa, jadval yangi bazada ham bo'lsin).
const ready = {};
export function ensureSchema(env) {
  const key = env.UZ_STORE_ACTIVE ? 'uz' : 'd1';
  return (ready[key] ||= env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS iap_apple_account_tokens (
      user_id INTEGER PRIMARY KEY NOT NULL,
      token TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS iap_apple_subscriptions (
      original_transaction_id TEXT PRIMARY KEY NOT NULL,
      user_id INTEGER NOT NULL,
      product_id TEXT,
      environment TEXT,
      last_transaction_id TEXT,
      expires_at TEXT,
      status TEXT,
      auto_renew INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS iap_apple_subscriptions_user_idx ON iap_apple_subscriptions(user_id)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS iap_apple_transactions (
      transaction_id TEXT PRIMARY KEY NOT NULL,
      original_transaction_id TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      product_id TEXT,
      environment TEXT,
      purchase_date TEXT,
      expires_at TEXT,
      prev_premium_expires_at TEXT,
      granted_premium_expires_at TEXT,
      granted INTEGER NOT NULL DEFAULT 0,
      revoked_at TEXT,
      rolled_back_at TEXT,
      source TEXT,
      created_at TEXT NOT NULL
    )`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS iap_apple_transactions_orig_idx ON iap_apple_transactions(original_transaction_id)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS iap_apple_notifications (
      notification_uuid TEXT PRIMARY KEY NOT NULL,
      notification_type TEXT,
      subtype TEXT,
      environment TEXT,
      original_transaction_id TEXT,
      transaction_id TEXT,
      user_id INTEGER,
      result TEXT,
      received_at TEXT NOT NULL
    )`),
  ]).then(() => addPriceColumns(env, 'iap_apple_transactions'))
    .catch((e) => { delete ready[key]; throw e; }));
}

// NARX (kelajakdagi tushum hisoboti uchun, admin audit 2026-10): StoreKit
// JWS `price` (milli-birlik, butun son) va `currency` (ISO 4217). Faqat
// ADD COLUMN — ustun bor bo'lsa xato jim o'tkaziladi.
export async function addPriceColumns(env, table) {
  await env.DB.prepare(`ALTER TABLE ${table} ADD COLUMN price INTEGER`).run().catch(() => {});
  await env.DB.prepare(`ALTER TABLE ${table} ADD COLUMN currency TEXT`).run().catch(() => {});
}
const priceOf = (p) => (Number.isInteger(Number(p?.price)) && p?.price !== null && p?.price !== undefined ? Number(p.price) : null);
const currencyOf = (p) => (typeof p?.currency === 'string' && /^[A-Z]{3}$/.test(p.currency) ? p.currency : null);

// IMZO XATOLARI SANOG'I (admin "Apple / iOS" holati): faqat son va oxirgi
// vaqt — tana saqlanmaydi.
async function countSignatureFailure(env) {
  try {
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO admin_settings (key, value) VALUES ('iap_apple_sig_fail_count', '1')
        ON CONFLICT(key) DO UPDATE SET value = CAST(COALESCE(CAST(admin_settings.value AS INTEGER), 0) + 1 AS TEXT)`),
      env.DB.prepare(`INSERT INTO admin_settings (key, value) VALUES ('iap_apple_sig_fail_last', ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value`).bind(new Date().toISOString()),
    ]);
  } catch (e) {
    console.error('iap apple sig counter', e?.message);
  }
}

// ═══ YORDAMCHILAR ═══

// Bazadagi sana uch shaklda bo'ladi (ISO, 'YYYY-MM-DD HH:MM:SS', '...+00') — hammasi UTC.
function toMs(v) {
  if (v === null || v === undefined || v === '') return NaN;
  let s = String(v).trim().replace(' ', 'T');
  if (/\+00$/.test(s)) s = s.replace(/\+00$/, 'Z');
  else if (!/(Z|[+-]\d{2}:?\d{2})$/i.test(s)) s += 'Z';
  return Date.parse(s);
}
const isoOf = (ms) => new Date(ms).toISOString();
const msField = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : null);
const changed = (res) => Number(res?.meta?.changes || 0) > 0;

// SANDBOX FAQAT RUXSAT BILAN (xavfsizlik ko'rigi, 2026-10-06).
//
// Sandbox xaridi bepul — har kim TestFlight/sandbox hisobi bilan "sotib
// olib" haqiqiy Premium olib qo'yardi. Endi production'dan boshqa muhit
// (Sandbox, Xcode, LocalTesting) faqat:
//   * `IAP_APPLE_ALLOW_SANDBOX` = '1' (masalan staging), yoki
//   * foydalanuvchi ID'si `IAP_APPLE_SANDBOX_USER_IDS` ro'yxatida
//     (vergul bilan; App Review demo hisobi shu yerga yoziladi).
// Bu shart `IAP_APPLE_ENABLED` dan qat'i nazar ishlaydi (bildirishnomalar
// bayroq o'chiq bo'lsa ham qayta ishlanadi).
export function sandboxAllowed(env, userId) {
  if (String(env.IAP_APPLE_ALLOW_SANDBOX ?? '') === '1') return true;
  if (!userId) return false;
  return String(env.IAP_APPLE_SANDBOX_USER_IDS ?? '').split(',')
    .map((s) => s.trim()).filter(Boolean).includes(String(userId));
}
const isProduction = (tx) => tx.environment === 'Production';

async function currentExpiry(env, userId) {
  const row = await env.DB.prepare(`SELECT premium_expires_at AS exp FROM users WHERE id = ?`).bind(userId).first();
  return row ? (row.exp ?? null) : undefined; // undefined — foydalanuvchi yo'q
}

// Hisob bormi va o'chirilmaganmi.
async function userLive(env, userId) {
  const row = await env.DB.prepare(`SELECT deleted_at FROM users WHERE id = ?`).bind(userId).first();
  return !!row && !row.deleted_at;
}

async function getOrCreateToken(env, userId) {
  const sel = () => env.DB.prepare(`SELECT token FROM iap_apple_account_tokens WHERE user_id = ?`).bind(userId).first();
  let row = await sel();
  if (row?.token) return row.token;
  await env.DB.prepare(`INSERT OR IGNORE INTO iap_apple_account_tokens (user_id, token, created_at) VALUES (?, ?, ?)`)
    .bind(userId, crypto.randomUUID(), new Date().toISOString()).run();
  row = await sel();
  return row?.token || null;
}

async function userIdByToken(env, token) {
  if (!token) return null;
  const row = await env.DB.prepare(`SELECT user_id FROM iap_apple_account_tokens WHERE token = ?`)
    .bind(String(token).toLowerCase()).first();
  return row ? Number(row.user_id) : null;
}

// Obuna egasi: { userId, live } yoki null (bog'lanmagan).
async function ownerOf(env, otid) {
  const row = await env.DB.prepare(`SELECT s.user_id AS uid, u.id AS existing, u.deleted_at AS deleted
      FROM iap_apple_subscriptions s LEFT JOIN users u ON u.id = s.user_id
      WHERE s.original_transaction_id = ?`).bind(otid).first();
  if (!row) return null;
  return { userId: Number(row.uid), live: row.existing != null && !row.deleted };
}

// `originalTransactionId` → foydalanuvchi. Birinchi kelgan yutadi
// (PRIMARY KEY + INSERT OR IGNORE). Qaytaradi: haqiqiy egasi (user id).
//
// O'CHIRILGAN HISOB: egasi o'chirilgan (yoki qatori yo'q) bo'lsa, obuna
// yangi hisobga ko'chiriladi — aks holda odam hisobini o'chirib qaytadan
// ochsa, o'z Apple obunasi "already_linked" bo'lib qolardi. Ko'chirish
// shartli UPDATE bilan: bir vaqtda ikki so'rov kelsa, faqat bittasi yutadi.
async function bindOwner(env, tx, userId) {
  const now = new Date().toISOString();
  await env.DB.prepare(`INSERT OR IGNORE INTO iap_apple_subscriptions
      (original_transaction_id, user_id, product_id, environment, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .bind(tx.originalTransactionId, userId, tx.productId, tx.environment, now, now).run();
  let owner = await ownerOf(env, tx.originalTransactionId);
  if (owner && owner.userId !== Number(userId) && !owner.live) {
    const res = await env.DB.prepare(`UPDATE iap_apple_subscriptions SET user_id = ?, updated_at = ?
        WHERE original_transaction_id = ? AND user_id = ?`)
      .bind(userId, now, tx.originalTransactionId, owner.userId).run();
    if (changed(res)) console.warn('iap apple: obuna o‘chirilgan hisobdan ko‘chirildi', `user#${owner.userId} -> user#${userId}`, `otid=${tx.originalTransactionId}`);
    owner = await ownerOf(env, tx.originalTransactionId);
  }
  return owner ? owner.userId : null;
}

async function touchSubscription(env, tx, status, renewal) {
  const autoRenew = renewal && Number.isFinite(Number(renewal.autoRenewStatus)) ? Number(renewal.autoRenewStatus) : null;
  await env.DB.prepare(`UPDATE iap_apple_subscriptions SET
        product_id = ?, environment = ?, last_transaction_id = ?, status = ?,
        auto_renew = COALESCE(?, auto_renew),
        expires_at = CASE WHEN expires_at IS NULL OR expires_at < ? THEN ? ELSE expires_at END,
        updated_at = ?
      WHERE original_transaction_id = ?`)
    .bind(tx.productId, tx.environment, tx.transactionId, status, autoRenew,
      isoOf(tx.expiresDate), isoOf(tx.expiresDate), new Date().toISOString(), tx.originalTransactionId)
    .run().catch((e) => console.error('iap apple subscription status', e?.message || e));
}

// JWS payload'ini (StoreKit `JWSTransactionDecodedPayload`) tekshiradi va
// keraklisini oladi. Muammo bo'lsa — `{ problem }`.
function normalizeTx(p) {
  if (!p || typeof p !== 'object') return { problem: 'bad_transaction' };
  if (p.bundleId !== BUNDLE_ID) return { problem: 'wrong_bundle' };
  // KO'TARISH — consumable (muddatsiz, `expiresDate` yo'q).
  const boostDays = boost.boostDaysOf(p.productId);
  if (boostDays) {
    if (p.type !== 'Consumable') return { problem: 'wrong_type' };
    if (p.inAppOwnershipType === 'FAMILY_SHARED') return { problem: 'family_shared_not_supported' };
    const transactionId = p.transactionId != null ? String(p.transactionId) : '';
    if (!/^[0-9A-Za-z_-]{1,64}$/.test(transactionId)) return { problem: 'bad_transaction' };
    return {
      tx: {
        kind: 'boost', transactionId, originalTransactionId: String(p.originalTransactionId ?? transactionId).slice(0, 64),
        productId: p.productId, days: boostDays,
        purchaseDate: msField(p.purchaseDate), revocationDate: msField(p.revocationDate),
        environment: typeof p.environment === 'string' ? p.environment.slice(0, 20) : null,
        appAccountToken: typeof p.appAccountToken === 'string' && p.appAccountToken ? p.appAccountToken.toLowerCase() : null,
        price: priceOf(p), currency: currencyOf(p),
      },
    };
  }
  if (!PRODUCTS.includes(p.productId)) return { problem: 'unknown_product' };
  if (p.type !== SUBSCRIPTION_TYPE) return { problem: 'wrong_type' };
  // Family Sharing o'chiq: oila a'zosiga ulashilgan xarid bilan Premium berilmaydi.
  if (p.inAppOwnershipType === 'FAMILY_SHARED') return { problem: 'family_shared_not_supported' };
  const transactionId = p.transactionId != null ? String(p.transactionId) : '';
  const originalTransactionId = p.originalTransactionId != null ? String(p.originalTransactionId) : '';
  if (!/^[0-9A-Za-z_-]{1,64}$/.test(transactionId) || !/^[0-9A-Za-z_-]{1,64}$/.test(originalTransactionId)) return { problem: 'bad_transaction' };
  const expiresDate = msField(p.expiresDate);
  if (!expiresDate) return { problem: 'bad_transaction' };
  const token = typeof p.appAccountToken === 'string' && p.appAccountToken ? p.appAccountToken.toLowerCase() : null;
  return {
    tx: {
      kind: 'premium', transactionId, originalTransactionId, productId: p.productId, expiresDate,
      purchaseDate: msField(p.purchaseDate),
      revocationDate: msField(p.revocationDate),
      environment: typeof p.environment === 'string' ? p.environment.slice(0, 20) : null,
      appAccountToken: token,
      price: priceOf(p), currency: currencyOf(p),
    },
  };
}

// ═══ DAFTAR (iap_apple_transactions) ═══
//
// `granted` holati: 0 — berilmagan (tugagan / qaytarilgan / noma'lum
// foydalanuvchi), 2 — DA'VO QILINGAN (berish jarayonda), 1 — berildi.
// `created_at` — da'vo (berish) payti; qaytarishda Apple qo'shgan
// vaqtni hisoblash uchun ham shu ishlatiladi.
const LEDGER_NONE = 0;
const LEDGER_DONE = 1;
const LEDGER_CLAIMED = 2;
const CLAIM_STALE_MS = 60_000;

async function ledgerRow(env, txid) {
  return env.DB.prepare(`SELECT * FROM iap_apple_transactions WHERE transaction_id = ?`).bind(txid).first();
}

async function insertLedger(env, userId, tx, { prev = null, granted = null, state = LEDGER_NONE, source, revokedAt = null, at }) {
  return env.DB.prepare(`INSERT OR IGNORE INTO iap_apple_transactions
      (transaction_id, original_transaction_id, user_id, product_id, environment, purchase_date, expires_at,
       prev_premium_expires_at, granted_premium_expires_at, granted, revoked_at, source, created_at, price, currency)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(tx.transactionId, tx.originalTransactionId, userId, tx.productId, tx.environment,
      tx.purchaseDate ? isoOf(tx.purchaseDate) : null, isoOf(tx.expiresDate),
      prev, granted, state, revokedAt, source, at || new Date().toISOString(), tx.price ?? null, tx.currency ?? null)
    .run();
}

// ═══ BERISH ═══
// Qaytaradi: { premium, reason?, premiumExpiresAt }.
//
// POYGA (xavfsizlik ko'rigi, 2026-10-06): avval bir vaqtda kelgan ikki
// verify ikkalasi ham `users` ni yozardi va daftarga KEYINGI so'rovning
// "oldingi qiymati" (= Apple bergan muddat) tushib qolardi — keyin REFUND
// hech narsani qaytarmasdi. Endi daftar qatori — DA'VO: `INSERT OR IGNORE`
// qatorni haqiqatan qo'shgan so'rovgina `users` ni yozadi. Yutqazgan
// so'rov hech narsa yozmaydi va joriy holatni qaytaradi. Da'vo qilgan
// so'rov yiqilsa (qator 2 holatida qolsa), 60 soniyadan keyin boshqa
// so'rov uni shartli UPDATE bilan qayta da'vo qiladi.
async function grantTransaction(env, userId, tx, source) {
  if (tx.revocationDate) return revokeTransaction(env, userId, tx, source);
  let row = await ledgerRow(env, tx.transactionId);
  const curNow = async () => (await currentExpiry(env, userId)) ?? null;
  if (row?.revoked_at) return { premium: false, reason: 'revoked', premiumExpiresAt: await curNow() };
  const now = Date.now();
  if (!(tx.expiresDate > now)) {
    const cur = await curNow();
    if (!row) await insertLedger(env, userId, tx, { prev: cur, source });
    return { premium: false, reason: 'expired', premiumExpiresAt: cur };
  }
  // Yutqazgan / takroriy so'rov javobi — hech narsa yozilmaydi.
  const settled = async (r) => {
    const cur = await curNow();
    if (Number(r?.granted) === LEDGER_CLAIMED) {
      const curMs = toMs(cur);
      return { premium: true, premiumExpiresAt: Number.isFinite(curMs) && curMs >= tx.expiresDate ? cur : isoOf(tx.expiresDate) };
    }
    const curMs = toMs(cur);
    if (Number.isFinite(curMs) && curMs > now) return { premium: true, premiumExpiresAt: cur };
    return { premium: false, reason: 'expired', premiumExpiresAt: cur };
  };

  let claimed = false;
  let tookOver = false;
  let prepared = null; // da'vo qatoriga yozilgan { prev, next }
  const claimAt = new Date(now).toISOString();
  if (!row) {
    const cur = await currentExpiry(env, userId);
    if (cur === undefined) return { premium: false, reason: 'expired', premiumExpiresAt: null };
    const curMs = toMs(cur);
    const next = Number.isFinite(curMs) && curMs >= tx.expiresDate ? cur : isoOf(tx.expiresDate);
    const ins = await insertLedger(env, userId, tx, { prev: cur, granted: next, state: LEDGER_CLAIMED, source, at: claimAt });
    claimed = changed(ins);
    if (claimed) prepared = { prev: cur, next };
    else row = await ledgerRow(env, tx.transactionId);
  }
  if (!claimed) {
    if (!row || row.revoked_at) return row?.revoked_at ? { premium: false, reason: 'revoked', premiumExpiresAt: await curNow() } : settled(row);
    const state = Number(row.granted);
    const stale = state === LEDGER_CLAIMED && !(now - toMs(row.created_at) < CLAIM_STALE_MS);
    if (state === LEDGER_DONE || (state === LEDGER_CLAIMED && !stale)) return settled(row);
    // Eskirgan da'vo (yoki tugamagan, qaytarilmagan 0-holat) — shartli qayta da'vo.
    const res = await env.DB.prepare(`UPDATE iap_apple_transactions SET granted = ?, created_at = ?, user_id = ?
        WHERE transaction_id = ? AND granted = ? AND created_at = ? AND revoked_at IS NULL`)
      .bind(LEDGER_CLAIMED, claimAt, userId, tx.transactionId, state, row.created_at).run();
    if (!changed(res)) return settled(await ledgerRow(env, tx.transactionId));
    claimed = true;
    tookOver = true;
    // Oldingi da'vogar `users` ni yozib ulgurgan bo'lishi mumkin — uning
    // oldingi/berilgan qiymati saqlanadi (pastdagi `next === cur` holati).
    prepared = { prev: row.prev_premium_expires_at ?? null, next: row.granted_premium_expires_at ?? null };
  }

  // Da'vo bizniki: max(joriy, expiresDate). `users` boshqa yo'l bilan
  // (masalan Payme) o'zgarsa, shartli UPDATE 0 qator qaytaradi — qayta
  // o'qiymiz va O'Z daftar qatorimizdagi oldingi/berilgan qiymatni yangilaymiz.
  // `users` yozilishidan OLDIN xato bo'lsa — da'vo bo'shatiladi (qator
  // o'chiriladi), Apple/ilovaning qayta urinishi darhol ishlaydi. `users`
  // yozilgandan keyin esa qator qoladi (qaytarish uchun u kerak).
  let userWritten = false;
  try {
    for (let attempt = 0; attempt < 4; attempt++) {
      const cur = await currentExpiry(env, userId);
      if (cur === undefined) throw new Error('iap_apple_no_user');
      const curMs = toMs(cur);
      const next = Number.isFinite(curMs) && curMs >= tx.expiresDate ? cur : isoOf(tx.expiresDate);
      const alreadyApplied = next === cur && prepared && prepared.next === cur;
      if (!alreadyApplied && (!prepared || prepared.prev !== cur || prepared.next !== next)) {
        await env.DB.prepare(`UPDATE iap_apple_transactions SET prev_premium_expires_at = ?, granted_premium_expires_at = ?
            WHERE transaction_id = ? AND granted = ?`)
          .bind(cur, next, tx.transactionId, LEDGER_CLAIMED).run();
        prepared = { prev: cur, next };
      }
      if (next !== cur) {
        const res = await env.DB.prepare(`UPDATE users SET premium_expires_at = ? WHERE id = ? AND premium_expires_at IS ?`)
          .bind(next, userId, cur).run();
        if (!changed(res)) continue;
      }
      userWritten = true;
      await env.DB.prepare(`UPDATE iap_apple_transactions SET granted = ? WHERE transaction_id = ? AND granted = ?`)
        .bind(LEDGER_DONE, tx.transactionId, LEDGER_CLAIMED).run();
      return { premium: true, premiumExpiresAt: next };
    }
    throw new Error('iap_apple_grant_conflict');
  } catch (e) {
    if (!userWritten && !tookOver) {
      // UPDATE bajarilib, javobi yo'qolgan bo'lishi mumkin (tarmoq) — `users`
      // bizning qiymatimizga teng bo'lsa, qator QOLADI (qaytarish uchun kerak).
      const cur = await currentExpiry(env, userId).catch(() => undefined);
      const landed = prepared && prepared.next !== prepared.prev && cur !== undefined && cur === prepared.next;
      if (!landed) {
        await env.DB.prepare(`DELETE FROM iap_apple_transactions WHERE transaction_id = ? AND granted = ? AND created_at = ?`)
          .bind(tx.transactionId, LEDGER_CLAIMED, claimAt).run().catch(() => {});
      }
    }
    throw e;
  }
}

// ═══ QAYTARISH (REFUND / REVOKE) ═══
//
// Faqat Apple QO'SHGAN vaqt olib tashlanadi, sayt (Payme/Click) vaqti
// HECH QACHON:
//   * joriy muddat Apple bergan qiymatga teng (±2 s) — daftardagi oldingi
//     qiymatga qaytariladi;
//   * aks holda (ustiga Payme/Click qo'shilgan) — joriydan faqat Apple
//     ulushi ayriladi:
//       start = max(prev, berilgan payt, hozir)   // ishlatib bo'lingan qism olinmaydi
//       delta = max(0, granted − start)
//       yangi = min(joriy, max(prev, joriy − delta))
//     Misol: prev yo'q, Apple yillik (granted = T+365k), keyin Payme +30 kun
//     (joriy = T+395k), darhol REFUND → yangi ≈ T+30k: odamda faqat to'lagan
//     30 kuni qoladi. Muddat hech qachon OSHMAYDI.
// Qaytarilgan tranzaksiya qayta berilmaydi (eski JWS bilan ham),
// REFUND_REVERSED bo'lmaguncha. Foydalanuvchi noma'lum bo'lsa ham daftarga
// `revoked_at` bilan yoziladi (user_id = 0) — keyin kimdir eski JWS bilan
// kelsa, berilmaydi.
async function revokeTransaction(env, userId, tx, source) {
  const nowMs = Date.now();
  const nowIso = isoOf(nowMs);
  const exp = async () => (userId ? (await currentExpiry(env, userId)) ?? null : null);
  let row = await ledgerRow(env, tx.transactionId);
  if (!row) {
    const ins = await insertLedger(env, userId || 0, tx, { source, revokedAt: nowIso });
    if (changed(ins)) return { premium: false, reason: 'revoked', premiumExpiresAt: await exp(), outcome: 'not_granted' };
    row = await ledgerRow(env, tx.transactionId);
  }
  if (row.rolled_back_at) return { premium: false, reason: 'revoked', premiumExpiresAt: await exp(), outcome: 'rolled_back' };
  // Qaytarishni da'vo qilamiz: faqat bitta so'rov `revoked_at` ni qo'yadi.
  const claim = await env.DB.prepare(`UPDATE iap_apple_transactions SET revoked_at = ? WHERE transaction_id = ? AND revoked_at IS NULL`)
    .bind(nowIso, tx.transactionId).run();
  if (!changed(claim)) return { premium: false, reason: 'revoked', premiumExpiresAt: await exp(), outcome: 'not_granted' };
  const owner = Number(row.user_id) || userId;
  const state = Number(row.granted);
  let outcome = 'not_granted';
  if ((state === LEDGER_DONE || state === LEDGER_CLAIMED) && row.granted_premium_expires_at && owner) {
    outcome = 'rollback_skipped';
    const gMs = toMs(row.granted_premium_expires_at);
    const prev = row.prev_premium_expires_at ?? null;
    const prevMs = toMs(prev);
    const tMs = toMs(row.created_at);
    for (let attempt = 0; attempt < 4; attempt++) {
      const cur = await currentExpiry(env, owner);
      const curMs = toMs(cur);
      if (!Number.isFinite(curMs) || !Number.isFinite(gMs)) break;
      let next;
      if (Math.abs(curMs - gMs) <= ROLLBACK_TOLERANCE_MS) {
        next = prev;
      } else {
        const start = Math.max(Number.isFinite(prevMs) ? prevMs : -Infinity, Number.isFinite(tMs) ? tMs : -Infinity, nowMs);
        const delta = Math.max(0, gMs - start);
        if (!delta) break;
        let nMs = curMs - delta;
        if (Number.isFinite(prevMs)) nMs = Math.max(prevMs, nMs);
        nMs = Math.min(curMs, nMs);
        next = isoOf(nMs);
      }
      if (next === cur || (next !== null && toMs(next) === curMs)) break;
      const res = await env.DB.prepare(`UPDATE users SET premium_expires_at = ? WHERE id = ? AND premium_expires_at IS ?`)
        .bind(next, owner, cur).run();
      if (changed(res)) { outcome = 'rolled_back'; break; }
    }
    if (outcome === 'rolled_back') {
      await env.DB.prepare(`UPDATE iap_apple_transactions SET rolled_back_at = ? WHERE transaction_id = ?`)
        .bind(nowIso, tx.transactionId).run();
    } else {
      console.warn('iap apple: qaytarishda olinadigan Apple vaqti qolmagan', `user#${owner}`, `tx=${tx.transactionId}`);
    }
  }
  return { premium: false, reason: 'revoked', premiumExpiresAt: owner ? (await currentExpiry(env, owner)) ?? null : null, outcome };
}

// ═══ MARSHRUTLAR ═══

const BODY_LIMIT = 128 * 1024;

// Tanani chegarali o'qiydi: `content-length` katta bo'lsa — o'qimasdan,
// sarlavha yo'q/yolg'on bo'lsa — oqim chegaradan oshganda to'xtatiladi.
// Qaytaradi: { tooLarge: true } | { value: object|null }.
async function readJsonLimited(request, limit = BODY_LIMIT) {
  const cl = Number(request.headers.get('content-length'));
  if (Number.isFinite(cl) && cl > limit) return { tooLarge: true };
  if (!request.body) return { value: null };
  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) { reader.cancel().catch(() => {}); return { tooLarge: true }; }
      chunks.push(value);
    }
  } catch { return { value: null }; }
  const buf = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { buf.set(c, off); off += c.byteLength; }
  try {
    const v = JSON.parse(new TextDecoder().decode(buf));
    return { value: v && typeof v === 'object' && !Array.isArray(v) ? v : null };
  } catch { return { value: null }; }
}

async function handleVerify(request, env, H) {
  const user = await H.getCurrentUser(request, env);
  if (!user) return H.json({ error: 'unauthorized' }, 401);
  if (!iapAppleEnabled(env)) return H.json({ error: 'iap_disabled' }, 503);
  if (await H.rateLimitD1(env, `iap_apple_verify:${user.id}`, VERIFY_RATE_LIMIT, VERIFY_RATE_WINDOW_MS)) {
    return H.json({ error: 'too_many_requests' }, 429);
  }
  const body = await readJsonLimited(request);
  if (body.tooLarge) return H.json({ error: 'payload_too_large' }, 413);
  const signed = body.value?.signedTransaction;
  if (typeof signed !== 'string' || !signed) return H.json({ error: 'bad_request' }, 400);
  let payload;
  try { ({ payload } = await verifyJws(signed)); }
  catch (e) {
    console.warn('iap apple verify: imzo rad etildi', e?.code || e?.message);
    return H.json({ error: 'invalid_signature' }, 400);
  }
  const { tx, problem } = normalizeTx(payload);
  if (problem) return H.json({ error: problem }, 422);
  if (!isProduction(tx) && !sandboxAllowed(env, user.id)) return H.json({ error: 'sandbox_not_allowed' }, 422);
  await ensureSchema(env);
  const myToken = String((await getOrCreateToken(env, user.id)) || '').toLowerCase();
  if (tx.appAccountToken && tx.appAccountToken !== myToken) {
    // Token boshqa TIRIK hisobniki (yoki umuman noma'lum) — rad. Token egasi
    // o'chirilgan bo'lsa — o'sha odam yangi hisob ochgan: ruxsat.
    const tokenOwner = await userIdByToken(env, tx.appAccountToken);
    if (!tokenOwner || await userLive(env, tokenOwner)) return H.json({ error: 'account_mismatch' }, 403);
  }
  if (tx.kind === 'boost') {
    const [b, st] = await boost.verifyBoost(env, H, user, tx, body.value);
    return H.json(b, st);
  }
  const owner = await bindOwner(env, tx, user.id);
  if (owner !== Number(user.id)) return H.json({ error: 'already_linked' }, 409);
  const r = await grantTransaction(env, user.id, tx, 'verify');
  await touchSubscription(env, tx, r.premium ? 'active' : r.reason, null);
  if (!r.premium) return H.json({ premium: false, reason: r.reason === 'revoked' ? 'revoked' : 'expired', premiumExpiresAt: r.premiumExpiresAt });
  return H.json({ premium: true, premiumExpiresAt: r.premiumExpiresAt, productId: tx.productId, environment: tx.environment });
}

// Muddatni uzaytirishi mumkin bo'lgan turlar (tranzaksiya o'zi hal qiladi:
// tugagan bo'lsa — berilmaydi, hech narsa olib tashlanmaydi).
const APPLY_TYPES = new Set([
  'SUBSCRIBED', 'DID_RENEW', 'DID_CHANGE_RENEWAL_STATUS', 'DID_CHANGE_RENEWAL_PREF', 'DID_FAIL_TO_RENEW',
  'EXPIRED', 'GRACE_PERIOD_EXPIRED', 'OFFER_REDEEMED', 'RENEWAL_EXTENDED', 'REFUND_REVERSED', 'REFUND_DECLINED',
  'PRICE_INCREASE',
]);
const REVOKE_TYPES = new Set(['REFUND', 'REVOKE']);

class BadInnerSignature extends Error {}

async function processNotification(env, p) {
  const type = String(p.notificationType || '');
  const data = p.data && typeof p.data === 'object' ? p.data : {};
  const base = { type, subtype: p.subtype ? String(p.subtype) : null, environment: data.environment || null, otid: null, txid: null, userId: null };
  if (type === 'TEST') return { ...base, result: 'test' };
  if (data.bundleId && data.bundleId !== BUNDLE_ID) return { ...base, result: 'other_bundle' };
  if (typeof data.signedTransactionInfo !== 'string') return { ...base, result: 'no_transaction' };
  let txPayload, renewal = null;
  try {
    txPayload = (await verifyJws(data.signedTransactionInfo)).payload;
    if (typeof data.signedRenewalInfo === 'string') renewal = (await verifyJws(data.signedRenewalInfo)).payload;
  } catch (e) {
    throw new BadInnerSignature(e?.code || 'inner');
  }
  const { tx, problem } = normalizeTx(txPayload);
  if (problem) return { ...base, result: problem === 'family_shared_not_supported' ? 'ignored' : problem };
  Object.assign(base, { otid: tx.originalTransactionId, txid: tx.transactionId, environment: tx.environment || base.environment });
  const isRevoke = REVOKE_TYPES.has(type) || !!tx.revocationDate;
  if (tx.kind === 'boost') {
    // Consumable: faqat qaytarish muhim. CONSUMPTION_REQUEST — faqat qayd
    // (Apple'ga iste'mol ma'lumoti YUBORILMAYDI).
    if (type === 'CONSUMPTION_REQUEST') return { ...base, result: 'consumption_ack' };
    if (isRevoke) return { ...base, result: await boost.revokeBoost(env, tx, 0) };
    if (type === 'REFUND_REVERSED') return { ...base, result: await boost.restoreBoost(env, tx) };
    return { ...base, result: 'ignored' };
  }

  // Kim? Avval bog'lanish; bo'lmasa (yoki egasi o'chirilgan bo'lsa)
  // appAccountToken → tirik foydalanuvchi → bog'laymiz.
  const owner = await ownerOf(env, tx.originalTransactionId);
  let userId = owner?.userId || null;
  if ((!owner || !owner.live) && tx.appAccountToken) {
    const byToken = await userIdByToken(env, tx.appAccountToken);
    if (byToken && byToken !== userId && await userLive(env, byToken)) userId = await bindOwner(env, tx, byToken);
  }
  if (!userId) {
    console.warn('iap apple notification: foydalanuvchi topilmadi', type, `otid=${tx.originalTransactionId}`);
    // Qaytarish baribir daftarga — eski JWS bilan keyin berib yuborilmasin.
    if (isRevoke) await revokeTransaction(env, 0, tx, `notification:${type}`);
    return { ...base, result: 'unknown_user' };
  }
  base.userId = userId;
  let result;
  if (isRevoke) {
    // Qaytarish sandbox shartiga bog'liq emas — olib tashlash doim xavfsiz.
    result = (await revokeTransaction(env, userId, tx, `notification:${type}`)).outcome;
  } else if (!isProduction(tx) && !sandboxAllowed(env, userId)) {
    result = 'sandbox_ignored';
  } else if (APPLY_TYPES.has(type)) {
    if (type === 'REFUND_REVERSED') {
      // Pul qaytarish bekor qilindi — tranzaksiya yana kuchda.
      // Daftardagi qaytarilgan qator olib tashlanadi — pastda yangidan yoziladi.
      await env.DB.prepare(`DELETE FROM iap_apple_transactions WHERE transaction_id = ? AND revoked_at IS NOT NULL`)
        .bind(tx.transactionId).run();
    }
    const r = await grantTransaction(env, userId, tx, `notification:${type}`);
    result = r.premium ? 'granted' : r.reason;
  } else {
    result = 'ignored';
  }
  await touchSubscription(env, tx, type.toLowerCase(), renewal);
  return { ...base, result };
}

async function handleNotification(request, env, H) {
  const body = await readJsonLimited(request);
  if (body.tooLarge) return H.json({ error: 'payload_too_large' }, 413);
  const signedPayload = body.value?.signedPayload;
  if (typeof signedPayload !== 'string' || !signedPayload) return H.json({ error: 'bad_request' }, 400);
  let payload;
  try { ({ payload } = await verifyJws(signedPayload)); }
  catch (e) {
    console.warn('iap apple notification: imzo rad etildi', e?.code || e?.message);
    await countSignatureFailure(env);
    return H.json({ error: 'invalid_signature' }, 400);
  }
  const uuid = typeof payload.notificationUUID === 'string' ? payload.notificationUUID.slice(0, 80) : '';
  if (!uuid) return H.json({ error: 'bad_request' }, 400);
  await ensureSchema(env);
  // TAKRORGA QARSHI DA'VO: avval `processing` qatori. Faqat uni haqiqatan
  // qo'shgan so'rov qayta ishlaydi; bir vaqtda kelgan nusxa 200 duplicate.
  // Xatoda da'vo o'chiriladi — Apple'ning qayta yuborishi ishlaydi.
  const claimAt = new Date().toISOString();
  const ins = await env.DB.prepare(`INSERT OR IGNORE INTO iap_apple_notifications
      (notification_uuid, notification_type, subtype, result, received_at) VALUES (?, ?, ?, 'processing', ?)`)
    .bind(uuid, String(payload.notificationType || '').slice(0, 60), payload.subtype ? String(payload.subtype).slice(0, 60) : null, claimAt).run();
  if (!changed(ins)) {
    const seen = await env.DB.prepare(`SELECT result, received_at FROM iap_apple_notifications WHERE notification_uuid = ?`).bind(uuid).first();
    const stale = seen?.result === 'processing' && !(Date.now() - toMs(seen.received_at) < CLAIM_STALE_MS);
    if (!stale) return H.json({ ok: true, duplicate: true, result: seen?.result ?? 'processing' });
    const take = await env.DB.prepare(`UPDATE iap_apple_notifications SET received_at = ?
        WHERE notification_uuid = ? AND result = 'processing' AND received_at = ?`)
      .bind(claimAt, uuid, seen.received_at).run();
    if (!changed(take)) return H.json({ ok: true, duplicate: true, result: 'processing' });
  }
  const release = () => env.DB.prepare(`DELETE FROM iap_apple_notifications WHERE notification_uuid = ? AND result = 'processing' AND received_at = ?`)
    .bind(uuid, claimAt).run().catch(() => {});
  let r;
  try { r = await processNotification(env, payload); }
  catch (e) {
    await release();
    if (e instanceof BadInnerSignature) {
      console.warn('iap apple notification: ichki imzo rad etildi', e.message);
      await countSignatureFailure(env);
      return H.json({ error: 'invalid_signature' }, 400);
    }
    throw e; // baza xatosi — worker 503 beradi, Apple qayta yuboradi
  }
  await env.DB.prepare(`UPDATE iap_apple_notifications SET notification_type = ?, subtype = ?, environment = ?,
      original_transaction_id = ?, transaction_id = ?, user_id = ?, result = ? WHERE notification_uuid = ?`)
    .bind(r.type, r.subtype, r.environment, r.otid, r.txid, r.userId, r.result, uuid).run();
  return H.json({ ok: true, result: r.result });
}

export async function handle(request, env, url, H) {
  const p = url.pathname;
  if (!p.startsWith('/api/iap/apple/')) return null;
  const m = request.method;
  if (p === '/api/iap/apple/config') {
    if (m !== 'GET') return H.json({ error: 'method_not_allowed' }, 405);
    const sales = await salesState(env, H);
    return H.json({
      enabled: iapAppleEnabled(env), products: PRODUCTS,
      // Ko'tarish: Apple bayrog'i VA FEATURED sotuvi (to'lovlar) yoqiq bo'lsa.
      boostEnabled: iapAppleEnabled(env) && !!H.paymentsEnabledD1(env),
      boostProducts: boost.BOOST_PRODUCTS.map((x) => ({ productId: x.productId, days: x.days })),
      // Ko'tarish sotuvi 1000 foydalanuvchida ochiladi (api/featured.js).
      boostSalesOpen: sales.open, usersCount: sales.usersCount, openAt: sales.openAt,
    });
  }
  if (p === '/api/iap/apple/boost-intent' || p === '/api/iap/apple/boost-redeem' || p === '/api/iap/apple/boost-credits') {
    const wantMethod = p === '/api/iap/apple/boost-credits' ? 'GET' : 'POST';
    if (m !== wantMethod) return H.json({ error: 'method_not_allowed' }, 405);
    const user = await H.getCurrentUser(request, env);
    if (!user) return H.json({ error: 'unauthorized' }, 401);
    if (p === '/api/iap/apple/boost-credits') return H.json(...await boost.listCredits(env, user));
    // Yangi ushlab turish faqat bayroq yoqiq bo'lsa; to'langan kreditni
    // ishlatish — bayroqdan qat'i nazar (pul olingan).
    if (p === '/api/iap/apple/boost-intent' && !iapAppleEnabled(env)) return H.json({ error: 'iap_disabled' }, 503);
    const body = await readJsonLimited(request);
    if (body.tooLarge) return H.json({ error: 'payload_too_large' }, 413);
    const out = p === '/api/iap/apple/boost-intent'
      ? await boost.handleIntent(env, H, user, body.value || {})
      : await boost.redeemCredit(env, H, user, body.value || {});
    return H.json(...out);
  }
  if (p === '/api/iap/apple/account-token') {
    if (m !== 'GET') return H.json({ error: 'method_not_allowed' }, 405);
    const user = await H.getCurrentUser(request, env);
    if (!user) return H.json({ error: 'unauthorized' }, 401);
    await ensureSchema(env);
    return H.json({ token: await getOrCreateToken(env, user.id) });
  }
  if (p === '/api/iap/apple/verify') {
    if (m !== 'POST') return H.json({ error: 'method_not_allowed' }, 405);
    return handleVerify(request, env, H);
  }
  if (p === '/api/iap/apple/notifications') {
    if (m !== 'POST') return H.json({ error: 'method_not_allowed' }, 405);
    return handleNotification(request, env, H);
  }
  return null;
}
