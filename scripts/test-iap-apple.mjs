// APPLE IN-APP PURCHASE (iOS Premium) — hosting/api/iap-apple.js.
//   node scripts/test-iap-apple.mjs
//   UZ_ADAPTER_TEST=1 node scripts/test-iap-apple.mjs   (sqld adapteri)
//
// Haqiqiy worker.fetch + xotiradagi baza (scripts/lib/social-fixture.mjs).
// JWS'lar soxta zanjir bilan imzolanadi (scripts/lib/apple-fake-chain.mjs);
// uning ildizi FAQAT `__setTrustedRootForTests` bilan beriladi.
// Tekshiriladi:
//   * config: bayroq o'chiq/yoqiq; account-token: barqaror UUID v4, mehmon 401;
//   * verify: bayroq o'chiq 503, imzo/bundle/mahsulot/tur xatolari,
//     max() bilan berish, idempotent, account_mismatch 403, already_linked 409,
//     tugagan/qaytarilgan berilmaydi, Sandbox faqat ruxsat bilan (muhit daftarda);
//   * notifications (bayroq O'CHIQ holatda ham): TEST, DID_RENEW uzaytiradi,
//     notificationUUID bo'yicha takror e'tiborsiz, REFUND faqat Apple bergan
//     vaqtni qaytaradi va sayt (Payme/Click) vaqtini HECH QACHON olmaydi,
//     qaytarilgan tranzaksiya eski JWS bilan qayta berilmaydi, appAccountToken
//     orqali bog'lash, noma'lum foydalanuvchi 200, yomon imzo 400.
//   * XAVFSIZLIK KO'RIGI (2026-10-06) regressiyalari (11–17 bo'limlar):
//     bir vaqtdagi verify poygasi + REFUND, noma'lum foydalanuvchi REFUND'i
//     va eski JWS, Payme ustiga qo'yib REFUND'dan qochish (aniq hisob),
//     o'chirilgan hisobdagi obuna, bir vaqtdagi takror bildirishnoma va
//     xatoda da'voni bo'shatish, 413, Family Sharing, sandbox bayroqsiz.
// Production'ga HECH QACHON tegmaydi.
import { setupSocial, cookie, makeChecker } from './lib/social-fixture.mjs';
import { makeChain, signJws } from './lib/apple-fake-chain.mjs';
import { __setTrustedRootForTests, __resetSigFailForTests, PRODUCTS } from '../hosting/api/iap-apple.js';

const { check, checkTrue, done } = makeChecker();
const { env, sqlite, call, resetLimits } = await setupSocial();

const chain = makeChain();
__setTrustedRootForTests(chain.rootB64);
const DAY = 86_400_000;
const NOW = Date.now();
const iso = (ms) => new Date(ms).toISOString();
const MONTHLY = 'uz.nfcstore.nova.premium.monthly';
const YEARLY = 'uz.nfcstore.nova.premium.yearly';

let seq = 1000;
const txPayload = (o = {}) => ({
  transactionId: String(o.transactionId ?? ++seq),
  originalTransactionId: String(o.originalTransactionId ?? 'OT1'),
  bundleId: 'uz.nfcstore.nova',
  productId: MONTHLY,
  type: 'Auto-Renewable Subscription',
  purchaseDate: NOW - DAY,
  originalPurchaseDate: NOW - DAY,
  expiresDate: NOW + 30 * DAY,
  environment: 'Production',
  signedDate: NOW,
  inAppOwnershipType: 'PURCHASED',
  ...o,
});
const signTx = (o) => signJws(txPayload(o), chain);
const verify = (o, who = cookie.user, extra = {}) => call('/api/iap/apple/verify', {
  method: 'POST', cookie: who, json: { signedTransaction: typeof o === 'string' ? o : signTx(o), ...extra },
});
let nseq = 0;
const notify = (type, tx, { subtype, uuid, renewal, signed } = {}) => {
  const data = { bundleId: 'uz.nfcstore.nova', environment: tx?.environment || 'Production', appAppleId: 1 };
  if (tx) data.signedTransactionInfo = signJws(tx, chain);
  if (renewal) data.signedRenewalInfo = signJws(renewal, chain);
  const payload = { notificationType: type, subtype, notificationUUID: uuid || `uuid-${++nseq}`, data, version: '2.0', signedDate: NOW };
  return call('/api/iap/apple/notifications', { method: 'POST', json: { signedPayload: signed || signJws(payload, chain) } });
};
const premiumOf = (id) => sqlite.prepare(`SELECT premium_expires_at AS p FROM users WHERE id = ?`).get(id)?.p ?? null;
const setPremium = (id, v) => sqlite.prepare(`UPDATE users SET premium_expires_at = ? WHERE id = ?`).run(v, id);
const ledger = (txid) => sqlite.prepare(`SELECT * FROM iap_apple_transactions WHERE transaction_id = ?`).get(String(txid));

// Qo'shimcha foydalanuvchilar: #3..#9 (sayt orqali to'lagan Premium bilan va poyga/o'chirish sinovlari).
for (const id of [3, 4, 5, 6, 7, 8, 9]) {
  sqlite.prepare(`INSERT INTO users (id, email, password_hash, phone) VALUES (?, ?, 'x', ?)`).run(id, `u${id}@test.local`, `+99890333000${id}`);
  sqlite.prepare(`INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, '2999-01-01T00:00:00.000Z')`).run(`u${id}-token`, id);
}
const c3 = 'nfc_session=u3-token';
const c4 = 'nfc_session=u4-token';
const cu = (id) => `nfc_session=u${id}-token`;
const near = (actual, expectedMs, tol = 5000) => Number.isFinite(Date.parse(actual)) && Math.abs(Date.parse(actual) - expectedMs) <= tol;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Baza kechikishi (D1 tarmoq aylanmasi) — har statement'ni kechiktiradi;
// `slow(sql, n)` → shu statement'ning n-chi bajarilishi uchun maxsus kechikish yoki xato.
function withLatency(hook) {
  const realDB = env.DB;
  env.DB = new Proxy(realDB, { get(t, k) {
    if (k === 'prepare') return (sql) => {
      const wrap = (st) => new Proxy(st, { get(o, m) {
        if (m === 'bind') return (...a) => wrap(o.bind(...a));
        if (m === 'first' || m === 'run' || m === 'all') return async (...a) => {
          const d = hook(sql);
          if (d instanceof Error) throw d;
          await sleep(d ?? 3);
          return o[m](...a);
        };
        const v = o[m]; return typeof v === 'function' ? v.bind(o) : v;
      } });
      return wrap(t.prepare(sql));
    };
    const v = t[k]; return typeof v === 'function' ? v.bind(t) : v;
  } });
  return () => { env.DB = realDB; };
}

// ═══ 1. Config ═══
{
  delete env.IAP_APPLE_ENABLED;
  const off = await call('/api/iap/apple/config');
  check('1) bayroq yo‘q — enabled:false', [off.status, off.body.enabled, off.body.products], [200, false, PRODUCTS]);
  check('1) mahsulotlar ro‘yxati', PRODUCTS, [MONTHLY, YEARLY]);
  env.IAP_APPLE_ENABLED = 'true';
  check('1) "true" ham o‘chiq (faqat "1")', (await call('/api/iap/apple/config')).body.enabled, false);
  env.IAP_APPLE_ENABLED = '1';
  const on = (await call('/api/iap/apple/config', { cookie: cookie.user })).body;
  check('1) bayroq 1 — enabled:true', [on.enabled, on.products], [true, PRODUCTS]);
  check('1) POST — 405', (await call('/api/iap/apple/config', { method: 'POST', json: {} })).status, 405);
  check('1) noma’lum yo‘l — 404', (await call('/api/iap/apple/nope')).status, 404);
}

// ═══ 2. Account token ═══
let token1, token2;
{
  check('2) mehmon — 401', (await call('/api/iap/apple/account-token')).status, 401);
  const a = await call('/api/iap/apple/account-token', { cookie: cookie.user });
  token1 = a.body.token;
  checkTrue(`2) UUID v4 (${token1})`, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(token1));
  check('2) qayta so‘rov — o‘sha token', (await call('/api/iap/apple/account-token', { cookie: cookie.user })).body.token, token1);
  token2 = (await call('/api/iap/apple/account-token', { cookie: cookie.other })).body.token;
  checkTrue('2) boshqa foydalanuvchi — boshqa token', token2 && token2 !== token1);
  check('2) bazada bitta qator', sqlite.prepare(`SELECT COUNT(*) AS n FROM iap_apple_account_tokens WHERE user_id = 1`).get().n, 1);
  // Bayroq o'chiq bo'lsa ham token beriladi (ilova oldindan olib qo'yadi).
  env.IAP_APPLE_ENABLED = '0';
  check('2) bayroq o‘chiq — token baribir', (await call('/api/iap/apple/account-token', { cookie: cookie.user })).body.token, token1);
  env.IAP_APPLE_ENABLED = '1';
}

// ═══ 3. Verify: kirish, bayroq, xatolar ═══
{
  check('3) mehmon — 401', (await verify({}, null)).body, { error: 'unauthorized' });
  env.IAP_APPLE_ENABLED = '0';
  const off = await verify({ appAccountToken: token1 });
  check('3) bayroq o‘chiq — 503 iap_disabled', [off.status, off.body], [503, { error: 'iap_disabled' }]);
  check('3) bayroq o‘chiq — hech narsa berilmadi', premiumOf(1), null);
  env.IAP_APPLE_ENABLED = '1';
  check('3) GET — 405', (await call('/api/iap/apple/verify', { cookie: cookie.user })).status, 405);
  check('3) signedTransaction yo‘q — 400', (await call('/api/iap/apple/verify', { method: 'POST', cookie: cookie.user, json: {} })).body, { error: 'bad_request' });
  check('3) JSON emas — 400', (await call('/api/iap/apple/verify', { method: 'POST', cookie: cookie.user, body: 'xx', headers: { 'content-type': 'application/json' } })).status, 400);
  const other = makeChain();
  const forged = await verify(signJws(txPayload({ appAccountToken: token1 }), other));
  check('3) begona ildiz — 400 invalid_signature', [forged.status, forged.body], [400, { error: 'invalid_signature' }]);
  const good = signTx({ appAccountToken: token1 });
  const [h, , s] = good.split('.');
  const tampered = Buffer.from(JSON.stringify(txPayload({ appAccountToken: token1, expiresDate: NOW + 9999 * DAY }))).toString('base64url');
  check('3) payload o‘zgartirilgan — 400', (await verify(`${h}.${tampered}.${s}`)).body, { error: 'invalid_signature' });
  check('3) boshqa bundle — 422', (await verify({ bundleId: 'com.example.other', appAccountToken: token1 })).body, { error: 'wrong_bundle' });
  check('3) noma’lum mahsulot — 422', (await verify({ productId: 'uz.nfcstore.nova.coins', appAccountToken: token1 })).body, { error: 'unknown_product' });
  check('3) obuna emas — 422', (await verify({ type: 'Non-Consumable', appAccountToken: token1 })).body, { error: 'wrong_type' });
  check('3) xatolardan keyin ham Premium yo‘q', premiumOf(1), null);
  check('3) xatolar bog‘lanish yaratmadi', sqlite.prepare(`SELECT COUNT(*) AS n FROM iap_apple_subscriptions`).get().n, 0);
}

// ═══ 4. Verify: berish, max(), idempotent ═══
const A1 = { transactionId: 'A1', originalTransactionId: 'OTA', appAccountToken: token1, expiresDate: NOW + 30 * DAY };
{
  const r = await verify(A1);
  check('4) berildi', [r.status, r.body], [200, { premium: true, premiumExpiresAt: iso(A1.expiresDate), productId: MONTHLY, environment: 'Production' }]);
  check('4) users.premium_expires_at', premiumOf(1), iso(A1.expiresDate));
  check('4) /api/auth/me — isPremium', (await call('/api/auth/me', { cookie: cookie.user })).body.user.isPremium, true);
  const L = ledger('A1');
  check('4) daftar: oldingi va berilgan', [L.prev_premium_expires_at, L.granted_premium_expires_at, L.granted, L.user_id, L.environment], [null, iso(A1.expiresDate), 1, 1, 'Production']);
  check('4) bog‘lanish OTA → user#1', sqlite.prepare(`SELECT user_id FROM iap_apple_subscriptions WHERE original_transaction_id = 'OTA'`).get().user_id, 1);
  // Takror — xuddi o'sha natija, ikki marta uzaymaydi.
  const again = await verify(A1);
  check('4) idempotent — javob bir xil', again.body, r.body);
  check('4) idempotent — muddat o‘zgarmadi', premiumOf(1), iso(A1.expiresDate));
  check('4) idempotent — daftarda bitta qator', sqlite.prepare(`SELECT COUNT(*) AS n FROM iap_apple_transactions WHERE transaction_id = 'A1'`).get().n, 1);
  // Token katta harf bilan kelsa ham o'sha odam.
  check('4) token katta harfda ham mos', (await verify({ ...A1, appAccountToken: token1.toUpperCase() })).status, 200);
  // appAccountToken'siz (masalan boshqa qurilmada sotib olingan) — bog'langan egasiga o'tadi.
  check('4) tokensiz, o‘z obunasi — 200', (await verify({ transactionId: 'A1b', originalTransactionId: 'OTA', expiresDate: NOW + 20 * DAY })).body.premiumExpiresAt, iso(A1.expiresDate));

  // max(): sayt orqali to'langan vaqt uzunroq — kamaymaydi.
  const web = iso(NOW + 100 * DAY);
  setPremium(1, web);
  const r2 = await verify({ transactionId: 'A2', originalTransactionId: 'OTA', appAccountToken: token1, expiresDate: NOW + 60 * DAY });
  check('4) max(): uzunroq sayt vaqti saqlandi', [r2.body.premium, r2.body.premiumExpiresAt, premiumOf(1)], [true, web, web]);
  // Eski shakldagi sana ('YYYY-MM-DD HH:MM:SS.mmm+00') ham to'g'ri solishtiriladi.
  const oldFmt = iso(NOW + 5 * DAY).replace('T', ' ').replace('Z', '+00');
  setPremium(1, oldFmt);
  const r3 = await verify({ transactionId: 'A3', originalTransactionId: 'OTA', appAccountToken: token1, expiresDate: NOW + 45 * DAY, productId: YEARLY });
  check('4) eski sana shakli < Apple — Apple muddati', [r3.body.premiumExpiresAt, r3.body.productId], [iso(NOW + 45 * DAY), YEARLY]);
  check('4) daftar A3: oldingi = eski qiymat', ledger('A3').prev_premium_expires_at, oldFmt);
}

// ═══ 5. Egalik ═══
{
  const m = await verify({ transactionId: 'B0', originalTransactionId: 'OTB', appAccountToken: token1 }, cookie.other);
  check('5) begona appAccountToken — 403 account_mismatch', [m.status, m.body], [403, { error: 'account_mismatch' }]);
  check('5) mismatch bog‘lamadi', sqlite.prepare(`SELECT COUNT(*) AS n FROM iap_apple_subscriptions WHERE original_transaction_id = 'OTB'`).get().n, 0);
  const l = await verify({ transactionId: 'A9', originalTransactionId: 'OTA' }, cookie.other);
  check('5) boshqaga bog‘langan obuna — 409 already_linked', [l.status, l.body], [409, { error: 'already_linked' }]);
  check('5) user#2 Premium olmadi', premiumOf(2), null);
  // user#2 token'i bilan, lekin obuna user#1 niki — baribir 409.
  check('5) o‘z tokeni, begona obuna — 409', (await verify({ transactionId: 'A10', originalTransactionId: 'OTA', appAccountToken: token2 }, cookie.other)).status, 409);
}

// ═══ 6. Tugagan / qaytarilgan / Sandbox ═══
{
  const e = await verify({ transactionId: 'B1', originalTransactionId: 'OTB', appAccountToken: token2, expiresDate: NOW - DAY }, cookie.other);
  check('6) tugagan — berilmaydi', [e.status, e.body], [200, { premium: false, reason: 'expired', premiumExpiresAt: null }]);
  check('6) tugagan — muddat yo‘q', premiumOf(2), null);
  const v = await verify({ transactionId: 'B2', originalTransactionId: 'OTB', appAccountToken: token2, revocationDate: NOW - 1000 }, cookie.other);
  check('6) qaytarilgan — berilmaydi', [v.status, v.body], [200, { premium: false, reason: 'revoked', premiumExpiresAt: null }]);
  check('6) qaytarilgan — muddat yo‘q', premiumOf(2), null);
  // O'sha tranzaksiyaning eski (revocationDate'siz) JWS'i — baribir berilmaydi.
  const stale = await verify({ transactionId: 'B2', originalTransactionId: 'OTB', appAccountToken: token2 }, cookie.other);
  check('6) qaytarilganning eski JWS — berilmaydi', [stale.body.premium, stale.body.reason, premiumOf(2)], [false, 'revoked', null]);
  // Sandbox — ruxsatsiz berilmaydi (bepul xarid bilan haqiqiy Premium bo'lmasin).
  const B3 = { transactionId: 'B3', originalTransactionId: 'OTS', appAccountToken: token2, environment: 'Sandbox', expiresDate: NOW + 3 * DAY };
  const sb0 = await verify(B3, cookie.other);
  check('6) Sandbox ruxsatsiz — 422 sandbox_not_allowed', [sb0.status, sb0.body], [422, { error: 'sandbox_not_allowed' }]);
  check('6) Sandbox ruxsatsiz — muddat yo‘q, bog‘lanmadi', [premiumOf(2), sqlite.prepare(`SELECT COUNT(*) AS n FROM iap_apple_subscriptions WHERE original_transaction_id = 'OTS'`).get().n], [null, 0]);
  check('6) Xcode muhiti ham — 422', (await verify({ ...B3, transactionId: 'B3x', environment: 'Xcode' }, cookie.other)).body, { error: 'sandbox_not_allowed' });
  env.IAP_APPLE_SANDBOX_USER_IDS = ' 7, 1 ';
  check('6) boshqa ID ro‘yxatda — baribir 422', (await verify(B3, cookie.other)).status, 422);
  env.IAP_APPLE_SANDBOX_USER_IDS = '7, 2';
  const sb = await verify(B3, cookie.other);
  check('6) ID ro‘yxatda (App Review demo) — beriladi', [sb.body.premium, sb.body.environment, premiumOf(2)], [true, 'Sandbox', iso(NOW + 3 * DAY)]);
  check('6) daftarda muhit — Sandbox', ledger('B3').environment, 'Sandbox');
  delete env.IAP_APPLE_SANDBOX_USER_IDS;
  env.IAP_APPLE_ALLOW_SANDBOX = '1';
  check('6) IAP_APPLE_ALLOW_SANDBOX=1 — hammaga', (await verify({ transactionId: 'B4', originalTransactionId: 'OTS2', environment: 'Sandbox', expiresDate: NOW + 2 * DAY }, c3)).body.premium, true);
  delete env.IAP_APPLE_ALLOW_SANDBOX;
  setPremium(3, null);
}

// ═══ 7. Bildirishnomalar (bayroq O'CHIQ — baribir ishlaydi) ═══
env.IAP_APPLE_ENABLED = '0';
{
  check('7) GET — 405', (await call('/api/iap/apple/notifications')).status, 405);
  check('7) signedPayload yo‘q — 400', (await call('/api/iap/apple/notifications', { method: 'POST', json: {} })).body, { error: 'bad_request' });
  const other = makeChain();
  const bad = signJws({ notificationType: 'TEST', notificationUUID: 'bad-1', data: {} }, other);
  check('7) begona imzo — 400', (await notify('TEST', null, { signed: bad })).body, { error: 'invalid_signature' });
  check('7) yomon imzo yozilmadi', sqlite.prepare(`SELECT COUNT(*) AS n FROM iap_apple_notifications WHERE notification_uuid = 'bad-1'`).get()?.n ?? 0, 0);
  const t = await notify('TEST', null);
  check('7) TEST — 200', [t.status, t.body], [200, { ok: true, result: 'test' }]);

  // DID_RENEW: user#1, OTA — yangi davr 90 kun.
  const before1 = premiumOf(1);
  const renew = txPayload({ transactionId: 'A4', originalTransactionId: 'OTA', expiresDate: NOW + 90 * DAY, appAccountToken: token1 });
  const r = await notify('DID_RENEW', renew, { uuid: 'n-renew-1', renewal: { autoRenewStatus: 1, originalTransactionId: 'OTA', signedDate: NOW } });
  check('7) DID_RENEW — 200 granted', [r.status, r.body], [200, { ok: true, result: 'granted' }]);
  check('7) DID_RENEW — muddat uzaydi', premiumOf(1), iso(NOW + 90 * DAY));
  check('7) daftar A4: oldingi qiymat', ledger('A4').prev_premium_expires_at, before1);
  const sub = sqlite.prepare(`SELECT status, auto_renew, last_transaction_id, expires_at FROM iap_apple_subscriptions WHERE original_transaction_id = 'OTA'`).get();
  check('7) obuna holati yangilandi', [sub.status, sub.auto_renew, sub.last_transaction_id, sub.expires_at], ['did_renew', 1, 'A4', iso(NOW + 90 * DAY)]);
  // Takror (o'sha UUID) — e'tiborsiz.
  setPremium(1, iso(NOW + 91 * DAY)); // agar qayta ishlansa ham o'zgarmasligi uchun belgi
  const dup = await notify('DID_RENEW', { ...renew, transactionId: 'A4dup', expiresDate: NOW + 400 * DAY }, { uuid: 'n-renew-1' });
  check('7) takror UUID — duplicate', [dup.status, dup.body.duplicate, dup.body.result], [200, true, 'granted']);
  check('7) takror — muddat o‘zgarmadi', premiumOf(1), iso(NOW + 91 * DAY));
  checkTrue('7) takror — daftarga yozilmadi', !ledger('A4dup'));
  setPremium(1, iso(NOW + 90 * DAY));
  check('7) notifications jadvalida bitta qator', sqlite.prepare(`SELECT COUNT(*) AS n FROM iap_apple_notifications WHERE notification_uuid = 'n-renew-1'`).get().n, 1);

  // REFUND A4: joriy muddat = A4 bergan qiymat → oldingisiga qaytadi.
  const ref = await notify('REFUND', { ...renew, revocationDate: NOW - 1000, revocationReason: 0 }, { uuid: 'n-refund-1' });
  check('7) REFUND — rolled_back', ref.body, { ok: true, result: 'rolled_back' });
  check('7) REFUND — oldingi qiymatga qaytdi', premiumOf(1), before1);
  checkTrue('7) daftar: revoked_at va rolled_back_at', ledger('A4').revoked_at && ledger('A4').rolled_back_at);
  // Qaytarilgan A4 ning eski JWS'i verify orqali — qayta berilmaydi.
  env.IAP_APPLE_ENABLED = '1';
  const re = await verify(renew);
  check('7) qaytarilgan A4 qayta berilmaydi', [re.body.premium, re.body.reason, premiumOf(1)], [false, 'revoked', before1]);
  env.IAP_APPLE_ENABLED = '0';
  // Qayta REFUND (boshqa UUID) — hech narsa o'zgarmaydi.
  check('7) qayta REFUND — o‘zgarishsiz', [(await notify('REFUND', { ...renew, revocationDate: NOW - 1000 })).body.result, premiumOf(1)], ['rolled_back', before1]);
  // REFUND_REVERSED — yana kuchda.
  const rev = await notify('REFUND_REVERSED', renew);
  check('7) REFUND_REVERSED — qayta berildi', [rev.body.result, premiumOf(1)], ['granted', iso(NOW + 90 * DAY)]);
}

// ═══ 8. REFUND sayt vaqtini HECH QACHON olmaydi ═══
{
  // user#3: Apple YILLIK, keyin sayt orqali (Payme/Click) +30 kun, keyin REFUND.
  // Aniq hisob (prev yo'q, berilgan payt T ≈ hozir):
  //   granted = T+365k, Payme → joriy = T+395k,
  //   delta = granted − max(prev, T, hozir) ≈ 365k,
  //   yangi = joriy − delta ≈ hozir + 30k — odamda faqat to'lagan 30 kuni qoladi.
  const tok3 = (await call('/api/iap/apple/account-token', { cookie: c3 })).body.token;
  env.IAP_APPLE_ENABLED = '1';
  const C1 = { transactionId: 'C1', originalTransactionId: 'OTC', appAccountToken: tok3, productId: YEARLY, expiresDate: NOW + 365 * DAY };
  check('8) user#3 Apple yillik', (await verify(C1, c3)).body.premiumExpiresAt, iso(C1.expiresDate));
  env.IAP_APPLE_ENABLED = '0';
  const paidWeb = iso(C1.expiresDate + 30 * DAY); // premiumExtendD1: joriy + 30 kun
  setPremium(3, paidWeb);
  const r = await notify('REFUND', txPayload({ ...C1, revocationDate: NOW }));
  check('8) Apple yillik + Payme 30 kun → REFUND: faqat Apple ulushi ayrildi', [r.status, r.body.result], [200, 'rolled_back']);
  const left3 = premiumOf(3);
  checkTrue(`8) qoldi ≈ hozir + 30 kun (${left3})`, near(left3, Date.now() + 30 * DAY));
  checkTrue('8) sayt vaqti olinmadi: qolgan ≥ 30 kun', Date.parse(left3) - Date.now() >= 30 * DAY - 5000);
  check('8) qayta REFUND — o‘zgarmaydi', [(await notify('REFUND', txPayload({ ...C1, revocationDate: NOW }))).body.result, premiumOf(3)], ['rolled_back', left3]);

  // user#5: oldin sayt vaqti (hozir+10 kun), keyin Apple yillik, keyin Payme +30.
  //   prev = N+10k, granted = N+365k, delta = 365 − 10 = 355k,
  //   joriy = N+395k → yangi = N+40k (aniq: 10 kun eski + 30 kun yangi sayt vaqti).
  setPremium(5, iso(NOW + 10 * DAY));
  env.IAP_APPLE_ENABLED = '1';
  const C5 = { transactionId: 'C5', originalTransactionId: 'OTC5', productId: YEARLY, expiresDate: NOW + 365 * DAY };
  check('8) user#5 Apple yillik (oldin sayt vaqti bor)', (await verify(C5, cu(5))).body.premiumExpiresAt, iso(NOW + 365 * DAY));
  env.IAP_APPLE_ENABLED = '0';
  setPremium(5, iso(NOW + 395 * DAY));
  check('8) REFUND → aniq N+40 kun', [(await notify('REFUND', txPayload({ ...C5, revocationDate: NOW }))).body.result, premiumOf(5)], ['rolled_back', iso(NOW + 40 * DAY)]);
  setPremium(5, null);

  // user#4: sayt vaqti Apple'dan uzun — Apple hech narsa qo'shmagan; REFUND uni olmaydi.
  const web4 = iso(NOW + 200 * DAY);
  setPremium(4, web4);
  const tok4 = (await call('/api/iap/apple/account-token', { cookie: c4 })).body.token;
  env.IAP_APPLE_ENABLED = '1';
  const D1 = { transactionId: 'D1', originalTransactionId: 'OTD', appAccountToken: tok4, expiresDate: NOW + 30 * DAY };
  check('8) user#4: sayt vaqti uzunroq — o‘zgarmaydi', (await verify(D1, c4)).body.premiumExpiresAt, web4);
  env.IAP_APPLE_ENABLED = '0';
  const r4 = await notify('REVOKE', txPayload({ ...D1, revocationDate: NOW }));
  check('8) REVOKE — sayt vaqti joyida', [r4.status, r4.body.result, premiumOf(4)], [200, 'rollback_skipped', web4]);
  // ±2 soniya: Apple bergan qiymatdan 1.5 s farq — baribir qaytariladi.
  const D2 = { transactionId: 'D2', originalTransactionId: 'OTD', appAccountToken: tok4, expiresDate: NOW + 300 * DAY };
  env.IAP_APPLE_ENABLED = '1';
  await verify(D2, c4);
  env.IAP_APPLE_ENABLED = '0';
  setPremium(4, iso(NOW + 300 * DAY + 1500));
  check('8) ±2 s ichida — qaytarildi', [(await notify('REFUND', txPayload({ ...D2, revocationDate: NOW }))).body.result, premiumOf(4)], ['rolled_back', web4]);
}

// ═══ 9. Foydalanuvchini topish, boshqa turlar ═══
{
  // Bog'lanmagan obuna, appAccountToken bor — token orqali topiladi va bog'lanadi.
  const e1 = txPayload({ transactionId: 'E1', originalTransactionId: 'OTE', appAccountToken: token2, expiresDate: NOW + 10 * DAY });
  const s = await notify('SUBSCRIBED', e1, { subtype: 'INITIAL_BUY' });
  check('9) SUBSCRIBED token orqali — granted', s.body.result, 'granted');
  check('9) bog‘landi OTE → user#2', sqlite.prepare(`SELECT user_id FROM iap_apple_subscriptions WHERE original_transaction_id = 'OTE'`).get()?.user_id, 2);
  check('9) user#2 muddati max()', premiumOf(2), iso(NOW + 10 * DAY));
  // Noma'lum: bog'lanmagan va tokensiz.
  const u = await notify('DID_RENEW', txPayload({ transactionId: 'X1', originalTransactionId: 'OTX' }));
  check('9) noma’lum foydalanuvchi — 200 unknown_user', [u.status, u.body.result], [200, 'unknown_user']);
  const row = sqlite.prepare(`SELECT result, user_id, notification_type FROM iap_apple_notifications WHERE original_transaction_id = 'OTX'`).get();
  check('9) noma’lum — jurnalda', [row.result, row.user_id, row.notification_type], ['unknown_user', null, 'DID_RENEW']);
  // EXPIRED — hech narsa olib tashlanmaydi (muddat o'zi tugaydi).
  const before = premiumOf(2);
  const ex = await notify('EXPIRED', txPayload({ transactionId: 'E0', originalTransactionId: 'OTE', expiresDate: NOW - DAY }), { subtype: 'VOLUNTARY' });
  check('9) EXPIRED — 200, berilmadi, olinmadi', [ex.body.result, premiumOf(2)], ['expired', before]);
  check('9) DID_CHANGE_RENEWAL_STATUS — 200', (await notify('DID_CHANGE_RENEWAL_STATUS', e1, { renewal: { autoRenewStatus: 0, signedDate: NOW } })).body.result, 'granted');
  check('9) auto_renew = 0 yozildi', sqlite.prepare(`SELECT auto_renew FROM iap_apple_subscriptions WHERE original_transaction_id = 'OTE'`).get().auto_renew, 0);
  check('9) DID_FAIL_TO_RENEW / GRACE_PERIOD_EXPIRED — 200',
    [(await notify('DID_FAIL_TO_RENEW', e1)).status, (await notify('GRACE_PERIOD_EXPIRED', e1)).status], [200, 200]);
  check('9) boshqa ilova bundle — e’tiborsiz 200', (await call('/api/iap/apple/notifications', { method: 'POST', json: {
    signedPayload: signJws({ notificationType: 'DID_RENEW', notificationUUID: 'n-other', data: { bundleId: 'com.other', signedTransactionInfo: 'x' } }, chain) } })).body,
  { ok: true, result: 'other_bundle' });
  // Tashqi imzo to'g'ri, ichki tranzaksiya begona zanjir — 400.
  const other = makeChain();
  const inner = signJws(e1, other);
  const outer = signJws({ notificationType: 'DID_RENEW', notificationUUID: 'n-inner-bad', data: { bundleId: 'uz.nfcstore.nova', signedTransactionInfo: inner } }, chain);
  check('9) ichki imzo begona — 400', (await call('/api/iap/apple/notifications', { method: 'POST', json: { signedPayload: outer } })).body, { error: 'invalid_signature' });
  check('9) ichki imzo xato — takror sifatida yozilmadi', sqlite.prepare(`SELECT COUNT(*) AS n FROM iap_apple_notifications WHERE notification_uuid = 'n-inner-bad'`).get().n, 0);
  // Noto'g'ri mahsulot bildirishnomada — 200, e'tiborsiz.
  check('9) noma’lum mahsulot — 200 unknown_product', (await notify('DID_RENEW', txPayload({ originalTransactionId: 'OTE', productId: 'x.y' }))).body.result, 'unknown_product');
}

// ═══ 10. Rate limit va shaxsiy ma'lumot ═══
{
  env.IAP_APPLE_ENABLED = '1';
  resetLimits();
  let last = 0;
  for (let i = 0; i < 61; i++) last = (await verify({ ...A1, transactionId: 'A1' })).status;
  check('10) 10 daqiqada 60 tadan keyin — 429', last, 429);
  resetLimits();
  const cols = ['iap_apple_account_tokens', 'iap_apple_subscriptions', 'iap_apple_transactions', 'iap_apple_notifications']
    .flatMap((t) => sqlite.prepare(`PRAGMA table_info(${t})`).all().map((c) => c.name));
  checkTrue('10) jadvallarda email/telefon yo‘q', !cols.some((c) => /email|phone/.test(c)));
}

// ═══ 11. Poyga: bir vaqtdagi verify + REFUND (ko'rik #1, race.mjs/attack.mjs) ═══
{
  env.IAP_APPLE_ENABLED = '1';
  resetLimits();
  // a) Kechikish bilan: birinchi so'rovning daftar INSERT'i 80 ms sekin.
  let ledgerInserts = 0;
  const restore = withLatency((sql) => (/INSERT OR IGNORE INTO iap_apple_transactions/.test(sql) && ledgerInserts++ === 0 ? 80 : 5));
  const R1 = { transactionId: 'R1', originalTransactionId: 'OTR1', productId: YEARLY, expiresDate: NOW + 365 * DAY };
  const rs = await Promise.all([verify(R1, cu(5)), verify(R1, cu(5))]);
  restore();
  check('11) ikkala verify — 200 premium', rs.map((r) => [r.status, r.body.premium]), [[200, true], [200, true]]);
  const L = ledger('R1');
  check('11) daftar: oldingi = asl qiymat (null), holat berildi', [L.prev_premium_expires_at, L.granted_premium_expires_at, L.granted], [null, iso(R1.expiresDate), 1]);
  check('11) daftarda bitta qator', sqlite.prepare(`SELECT COUNT(*) AS n FROM iap_apple_transactions WHERE transaction_id = 'R1'`).get().n, 1);
  env.IAP_APPLE_ENABLED = '0';
  check('11) REFUND → asl qiymatga (null)', [(await notify('REFUND', txPayload({ ...R1, revocationDate: NOW }))).body.result, premiumOf(5)], ['rolled_back', null]);
  // b) 4 ta bir vaqtdagi verify (kechikishsiz).
  env.IAP_APPLE_ENABLED = '1';
  const R2 = { transactionId: 'R2', originalTransactionId: 'OTR2', productId: YEARLY, expiresDate: NOW + 365 * DAY };
  const r4 = await Promise.all([1, 2, 3, 4].map(() => verify(R2, cu(6))));
  check('11) 4 ta verify — hammasi 200', r4.map((r) => r.status), [200, 200, 200, 200]);
  env.IAP_APPLE_ENABLED = '0';
  check('11) 4 talik poygadan keyin REFUND → null', [(await notify('REFUND', txPayload({ ...R2, revocationDate: NOW }))).body.result, premiumOf(6)], ['rolled_back', null]);
  // c) Da'vogar `users` ni yozishdan oldin yiqilsa — da'vo bo'shaydi, qayta urinish ishlaydi.
  env.IAP_APPLE_ENABLED = '1';
  let boom = true;
  const restore2 = withLatency((sql) => (boom && /UPDATE users SET premium_expires_at/.test(sql) ? ((boom = false), new Error('d1 tarmoq xatosi')) : 0));
  const R3 = { transactionId: 'R3', originalTransactionId: 'OTR3', expiresDate: NOW + 30 * DAY };
  const fail1 = await verify(R3, cu(7));
  restore2();
  check('11) xato — 503, daftarda da’vo qolmadi', [fail1.status, ledger('R3') ?? null, premiumOf(7)], [503, null, null]);
  check('11) qayta urinish — beriladi', [(await verify(R3, cu(7))).body.premium, premiumOf(7)], [true, iso(R3.expiresDate)]);
  setPremium(7, null);
  sqlite.prepare(`DELETE FROM iap_apple_subscriptions WHERE original_transaction_id = 'OTR3'`).run();
}

// ═══ 12. Noma'lum foydalanuvchi REFUND'i esda qoladi (ko'rik #3) ═══
{
  env.IAP_APPLE_ENABLED = '0';
  const T9 = txPayload({ transactionId: 'T9', originalTransactionId: 'OT9', productId: YEARLY, expiresDate: NOW + 365 * DAY });
  check('12) SUBSCRIBED bog‘lanmagan — unknown_user', (await notify('SUBSCRIBED', T9)).body.result, 'unknown_user');
  check('12) REFUND bog‘lanmagan — unknown_user', (await notify('REFUND', { ...T9, revocationDate: NOW })).body.result, 'unknown_user');
  const L = ledger('T9');
  check('12) daftarda revoked (user_id 0)', [!!L?.revoked_at, L?.user_id, L?.granted], [true, 0, 0]);
  env.IAP_APPLE_ENABLED = '1';
  const v = await verify({ transactionId: 'T9', originalTransactionId: 'OT9', productId: YEARLY, expiresDate: NOW + 365 * DAY }, cookie.other);
  const before = premiumOf(2);
  check('12) eski (qaytarishdan oldingi) JWS — berilmaydi', [v.status, v.body.premium, v.body.reason], [200, false, 'revoked']);
  check('12) user#2 muddati o‘zgarmadi', premiumOf(2), before);
}

// ═══ 13. O'chirilgan hisobdagi obuna (ko'rik #5) ═══
{
  env.IAP_APPLE_ENABLED = '1';
  const tok8 = (await call('/api/iap/apple/account-token', { cookie: cu(8) })).body.token;
  const F1 = { transactionId: 'F1', originalTransactionId: 'OTF', appAccountToken: tok8, expiresDate: NOW + 30 * DAY };
  check('13) user#8 obuna oldi', (await verify(F1, cu(8))).body.premium, true);
  check('13) user#9 — 409 (egasi tirik)', (await verify({ transactionId: 'F1b', originalTransactionId: 'OTF' }, cu(9))).status, 409);
  sqlite.prepare(`UPDATE users SET deleted_at = ? WHERE id = 8`).run(iso(NOW));
  // O'sha Apple ID egasi yangi hisob ochdi: StoreKit hali eski tokenni beradi.
  const F2 = { transactionId: 'F2', originalTransactionId: 'OTF', appAccountToken: tok8, expiresDate: NOW + 60 * DAY };
  const r = await verify(F2, cu(9));
  check('13) egasi o‘chirilgan — yangi hisobga ko‘chdi', [r.status, r.body.premium, premiumOf(9)], [200, true, iso(F2.expiresDate)]);
  check('13) bog‘lanish OTF → user#9', sqlite.prepare(`SELECT user_id FROM iap_apple_subscriptions WHERE original_transaction_id = 'OTF'`).get().user_id, 9);
  check('13) noma’lum token — 403', (await verify({ transactionId: 'F3', originalTransactionId: 'OTF', appAccountToken: '00000000-0000-4000-8000-000000000000' }, cu(9))).status, 403);
  check('13) tirik begona token — 403', (await verify({ transactionId: 'F4', originalTransactionId: 'OTF', appAccountToken: token1 }, cu(9))).status, 403);
}

// ═══ 14. Bir vaqtdagi takror bildirishnoma (ko'rik #7) ═══
{
  env.IAP_APPLE_ENABLED = '0';
  setPremium(9, iso(NOW + 60 * DAY));
  const G = txPayload({ transactionId: 'G1', originalTransactionId: 'OTF', expiresDate: NOW + 120 * DAY });
  const restore = withLatency(() => 5);
  const [a, b] = await Promise.all([notify('DID_RENEW', G, { uuid: 'n-conc' }), notify('DID_RENEW', G, { uuid: 'n-conc' })]);
  restore();
  check('14) faqat bittasi qayta ishladi', [a.body.duplicate === true, b.body.duplicate === true].sort(), [false, true]);
  check('14) natija granted, muddat bir marta', [(a.body.duplicate ? b : a).body.result, premiumOf(9)], ['granted', iso(NOW + 120 * DAY)]);
  // Qayta ishlashda xato — da'vo o'chadi, Apple'ning qayta yuborishi ishlaydi.
  let boom = true;
  const restore2 = withLatency((sql) => (boom && /UPDATE users SET premium_expires_at/.test(sql) ? ((boom = false), new Error('d1 tarmoq xatosi')) : 0));
  const G2 = txPayload({ transactionId: 'G2', originalTransactionId: 'OTF', expiresDate: NOW + 150 * DAY });
  const f = await notify('DID_RENEW', G2, { uuid: 'n-fail' });
  restore2();
  check('14) xato — 5xx, da’vo o‘chirildi', [f.status >= 500, sqlite.prepare(`SELECT COUNT(*) AS n FROM iap_apple_notifications WHERE notification_uuid = 'n-fail'`).get().n], [true, 0]);
  const again = await notify('DID_RENEW', G2, { uuid: 'n-fail' });
  check('14) qayta yuborish — granted', [again.body.result, again.body.duplicate ?? false, premiumOf(9)], ['granted', false, iso(NOW + 150 * DAY)]);
  check('14) jurnal: yakuniy natija', sqlite.prepare(`SELECT result FROM iap_apple_notifications WHERE notification_uuid = 'n-fail'`).get().result, 'granted');
}

// ═══ 15. Katta tana — 413 (ko'rik #8) ═══
{
  const big = JSON.stringify({ signedPayload: 'x'.repeat(130 * 1024) });
  const r1 = await call('/api/iap/apple/notifications', { method: 'POST', body: big, headers: { 'content-type': 'application/json' } });
  check('15) 128 KB dan katta tana — 413', [r1.status, r1.body], [413, { error: 'payload_too_large' }]);
  const r2 = await call('/api/iap/apple/notifications', { method: 'POST', body: '{}', headers: { 'content-type': 'application/json', 'content-length': '200000' } });
  // Tana kichik ('{}'), lekin sarlavha 200 KB deydi — o'qimasdan 413 (aks holda 400 bad_request bo'lardi).
  check('15) content-length katta — o‘qimasdan 413', [r2.status, r2.body], [413, { error: 'payload_too_large' }]);
  env.IAP_APPLE_ENABLED = '1';
  check('15) verify ham — 413', (await call('/api/iap/apple/verify', { method: 'POST', cookie: cookie.user, body: big, headers: { 'content-type': 'application/json' } })).status, 413);
}

// ═══ 16. Family Sharing (ko'rik #11) ═══
{
  env.IAP_APPLE_ENABLED = '1';
  const fs = await verify({ transactionId: 'H1', originalTransactionId: 'OTH', inAppOwnershipType: 'FAMILY_SHARED' }, cu(6));
  check('16) FAMILY_SHARED verify — 422', [fs.status, fs.body], [422, { error: 'family_shared_not_supported' }]);
  env.IAP_APPLE_ENABLED = '0';
  check('16) FAMILY_SHARED bildirishnoma — ignored', (await notify('SUBSCRIBED', txPayload({ transactionId: 'H2', originalTransactionId: 'OTA', inAppOwnershipType: 'FAMILY_SHARED' }))).body.result, 'ignored');
  checkTrue('16) daftarga yozilmadi', !ledger('H1') && !ledger('H2'));
}

// ═══ 17. Sandbox bildirishnomasi — bayroq o'chiq bo'lsa ham shart (ko'rik #2, #9) ═══
{
  env.IAP_APPLE_ENABLED = '0';
  const before = premiumOf(1);
  const S1 = txPayload({ transactionId: 'S1', originalTransactionId: 'OTA', environment: 'Sandbox', expiresDate: NOW + 900 * DAY });
  check('17) Sandbox DID_RENEW ruxsatsiz — sandbox_ignored', [(await notify('DID_RENEW', S1)).body.result, premiumOf(1)], ['sandbox_ignored', before]);
  checkTrue('17) daftarga yozilmadi', !ledger('S1'));
  env.IAP_APPLE_SANDBOX_USER_IDS = '1';
  check('17) ro‘yxatda — granted', [(await notify('DID_RENEW', S1)).body.result, premiumOf(1)], ['granted', iso(NOW + 900 * DAY)]);
  delete env.IAP_APPLE_SANDBOX_USER_IDS;
  setPremium(1, before);
}

// ═══ IMZO XATOLARI: bazaga minutiga ≤1 yozuv, IP bo'yicha 429 (ko'rik F6) ═══
{
  __resetSigFailForTests();
  const cnt = () => Number(sqlite.prepare(`SELECT value FROM admin_settings WHERE key = 'iap_apple_sig_fail_count'`).get()?.value || 0);
  const c0 = cnt();
  const bad = (ip) => call('/api/iap/apple/notifications', { method: 'POST', ip,
    json: { signedPayload: signJws({ notificationType: 'TEST', notificationUUID: 'forged' }, makeChain()) } });
  const st = [];
  for (let i = 0; i < 10; i++) st.push((await bad('192.0.2.77')).status);
  check('F6) 10 ta buzuq imzo — hammasi 400', st.every((x) => x === 400), true);
  check('F6) bazaga bitta yozuv (minutiga ≤1)', cnt() - c0, 1);
  check('F6) 11-chisi — 429', (await bad('192.0.2.77')).status, 429);
  check('F6) boshqa IP — cheklanmagan (400)', (await bad('192.0.2.78')).status, 400);
  check('F6) 429 bazaga yozmaydi', cnt() - c0, 1);
  __resetSigFailForTests();
}

__setTrustedRootForTests(null);
done('Apple IAP');
