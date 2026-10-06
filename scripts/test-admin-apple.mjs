// ADMIN "APPLE / iOS" — hosting/api/admin-apple.js (+ Premium olib qo'yish va Apple slot to'xtatish).
//   node scripts/test-admin-apple.mjs
//   UZ_ADAPTER_TEST=1 node scripts/test-admin-apple.mjs   (sqld adapteri)
//
// Tekshiriladi: ruxsat (mehmon 401, content_manager 403, manager 200);
// holat (bayroqlar, Production/Sandbox sonlari, muammolar, imzo xatolari
// sanog'i, ilova build'lari); ro'yxatlar (filtr, keyset sahifalash,
// manager uchun maskalangan / super_admin uchun to'liq tranzaksiya raqami,
// user_id 0 qaytarilgan qator); foydalanuvchi kartochkasida `apple`;
// overview `appleAttention`; javoblarda email/telefon/JWS/appAccountToken yo'q;
// narx/valyuta daftarda; faol Apple obunasi bo'lsa Premium olib qo'yish 409
// (force bilan — ha); Apple slotini to'xtatishda kredit qayta berish.
// Production'ga HECH QACHON tegmaydi.
import { setupSocial, cookie, makeChecker } from './lib/social-fixture.mjs';
import { sha256Hex } from './lib/d1-harness.mjs';
import { makeChain, signJws } from './lib/apple-fake-chain.mjs';
import { __setTrustedRootForTests } from '../hosting/api/iap-apple.js';

const { check, checkTrue, done } = makeChecker();
const { env, sqlite, call, resetLimits } = await setupSocial({
  PAYMENTS_ENABLED: 'true', PAYME_MERCHANT_ID: 'test_merchant_local_only', PAYME_KEY: 'test_payme_key_local_only',
  IAP_APPLE_ENABLED: '1', IAP_APPLE_SANDBOX_USER_IDS: '2',
});
const chain = makeChain();
__setTrustedRootForTests(chain.rootB64);
sqlite.prepare(`INSERT INTO admin_settings (key, value) VALUES ('featured_sales_open', 'open'), ('featured_sales_opened_at', ?)`).run(new Date(Date.now() - 3 * 86400000).toISOString());
sqlite.prepare(`INSERT INTO admin_sessions (token, admin_id, role, abs_exp, last_activity) VALUES (?, 3, 'content_manager', '2999-01-01T00:00:00.000Z', ?)`)
  .run(sha256Hex('content-token'), new Date().toISOString());
const contentCookie = 'nfc_admin_session=content-token';
const DAY = 86_400_000;
const NOW = Date.now();
let seq = 7000;
const ptx = (o = {}) => ({ transactionId: String(++seq), originalTransactionId: 'OTX1', bundleId: 'uz.nfcstore.nova', productId: 'uz.nfcstore.nova.premium.monthly',
  type: 'Auto-Renewable Subscription', purchaseDate: NOW, expiresDate: NOW + 30 * DAY, environment: 'Production', signedDate: NOW,
  price: 49990, currency: 'USD', ...o });
const verify = (t, who = cookie.user, extra = {}) => { resetLimits(); return call('/api/iap/apple/verify', { method: 'POST', cookie: who, json: { signedTransaction: signJws(t, chain), ...extra } }); };
const A = (path, who = cookie.manager) => call(`/api/admin/apple/${path}`, { cookie: who });
const leaks = (body) => /@test\.local|\+998|eyJ|appAccountToken/i.test(JSON.stringify(body));

// ═══ Tayyorlov: haqiqiy oqimlar ═══
const tok1 = (await call('/api/iap/apple/account-token', { cookie: cookie.user })).body.token;
const T1 = ptx({ transactionId: 'TXA0000001', appAccountToken: tok1 });
check('0) premium verify', (await verify(T1)).body.premium, true);
const T2 = ptx({ transactionId: 'TXA0000002', originalTransactionId: 'OTX2', environment: 'Sandbox', expiresDate: NOW + 3 * DAY });
check('0) sandbox verify (ro‘yxatda)', (await verify(T2, cookie.other)).body.premium, true);
sqlite.prepare(`INSERT INTO posts (id, code, user_id, caption, created_at) VALUES (501, 'VIP001', 1, 'p', '2026-01-01 00:00:00')`).run();
resetLimits();
const intent = (await call('/api/iap/apple/boost-intent', { method: 'POST', cookie: cookie.user, json: { targetKind: 'post', targetId: 501, days: 3 } })).body;
const B1 = { transactionId: 'BOOST00001', originalTransactionId: 'BOOST00001', bundleId: 'uz.nfcstore.nova', productId: 'uz.nfcstore.nova.boost.3d', type: 'Consumable',
  purchaseDate: NOW, environment: 'Production', signedDate: NOW, price: 2990, currency: 'USD' };
check('0) boost verify — faol', (await verify(B1, cookie.user, { intentId: intent.intentId })).body.boost, 'active');
const B2 = { ...B1, transactionId: 'BOOST00002', originalTransactionId: 'BOOST00002', productId: 'uz.nfcstore.nova.boost.1d' };
check('0) boost verify — kredit', (await verify(B2)).body.boost, 'credited');
// Noma'lum foydalanuvchi REFUND'i (user_id 0) va noma'lum DID_RENEW.
const notify = (type, t, uuid) => call('/api/iap/apple/notifications', { method: 'POST', json: { signedPayload: signJws({ notificationType: type, notificationUUID: uuid,
  data: { bundleId: 'uz.nfcstore.nova', signedTransactionInfo: signJws(t, chain) }, signedDate: NOW }, chain) } });
await notify('REFUND', ptx({ transactionId: 'TXZ0000009', originalTransactionId: 'OTZ', revocationDate: NOW }), 'u-z-1');
await notify('DID_RENEW', ptx({ transactionId: 'TXZ0000010', originalTransactionId: 'OTZ2' }), 'u-z-2');
// Imzo xatosi (begona zanjir) — sanaladi.
await call('/api/iap/apple/notifications', { method: 'POST', json: { signedPayload: signJws({ notificationType: 'TEST', notificationUUID: 'bad' }, makeChain()) } });
// Osilib qolgan holatlar.
sqlite.prepare(`INSERT INTO iap_apple_notifications (notification_uuid, notification_type, result, received_at) VALUES ('stuck', 'DID_RENEW', 'processing', ?)`).run(new Date(NOW - 5 * 60_000).toISOString());
sqlite.prepare(`INSERT INTO iap_apple_boost_transactions (transaction_id, user_id, product_id, days, environment, state, created_at) VALUES ('STALE0001', 1, 'uz.nfcstore.nova.boost.1d', 1, 'Production', 'claimed', ?)`).run(new Date(NOW - 5 * 60_000).toISOString());
// Ilova foydalanuvchilari (build bilan).
await call('/api/auth/me', { cookie: cookie.user, headers: { 'x-app': 'nova', 'x-client': 'ios', 'x-app-build': '42' } });
await call('/api/auth/me', { cookie: cookie.other, headers: { 'x-app': 'nova', 'x-client': 'android', 'x-app-build': '40' } });

// ═══ 1. Ruxsat ═══
{
  check('1) mehmon — 401', (await A('summary', null)).status, 401);
  check('1) oddiy foydalanuvchi — 401', (await A('summary', cookie.user)).status, 401);
  check('1) content_manager — 403', (await A('summary', contentCookie)).status, 403);
  check('1) manager — 200', (await A('summary')).status, 200);
  check('1) POST — 405', (await call('/api/admin/apple/summary', { method: 'POST', cookie: cookie.admin, json: {} })).status, 405);
}

// ═══ 2. Holat ═══
{
  const s = (await A('summary')).body;
  check('2) bayroqlar', [s.flags.iapEnabled, s.flags.boostEnabled, s.flags.allowSandboxAll, s.flags.sandboxUserCount], [true, true, false, 1]);
  checkTrue('2) manager — sandbox ID ro‘yxati yo‘q', !('sandboxUserIds' in s.flags));
  const sup = (await A('summary', cookie.admin)).body;
  check('2) super_admin — sandbox ID + kod', sup.flags.sandboxUserIds, [{ userId: 2, code: 'OTH222' }]);
  check('2) bundle va mahsulotlar', [s.bundleId, s.products.premium.length, s.products.boost.map((b) => b.days)], ['uz.nfcstore.nova', 2, [1, 3, 6]]);
  check('2) obunalar: Production/Sandbox faol', [s.counts.subscriptions.production.active, s.counts.subscriptions.sandbox.active], [1, 1]);
  check('2) Sandbox 7 kunda tugaydi', s.counts.subscriptions.sandbox.expiring7d, 1);
  check('2) kreditlar', s.counts.credits.production, { unused: 1, used: 0, revoked: 0 });
  check('2) boost 30 kun', s.counts.boostTx30d.production['uz.nfcstore.nova.boost.3d'], { slot: 1 });
  check('2) muammolar', [s.problems.unknownUser7d, s.problems.staleProcessing, s.problems.staleBoostClaims, s.problems.signatureFailures], [2, 1, 1, 1]);
  checkTrue('2) oxirgi imzo xatosi vaqti', !!s.problems.lastSignatureFailureAt);
  check('2) attention', s.attention, 4);
  check('2) ilova', [s.app.totals.ios?.total, s.app.totals.android?.total], [1, 1]);
  checkTrue('2) build ro‘yxati', s.app.builds.some((b) => b.platform === 'ios' && b.build === 42));
  checkTrue('2) shaxsiy ma’lumot yo‘q', !leaks(sup));
}

// ═══ 3. Ro'yxatlar ═══
{
  const subs = (await A('subscriptions')).body;
  check('3) obunalar soni', subs.items.length, 2);
  const s1 = subs.items.find((x) => x.userId === 1);
  check('3) manager — maskalangan', [s1.originalTransactionId, s1.code, s1.state], ['OTX1', 'VIP001', 'active']);
  const sup = (await A('subscriptions?env=Sandbox', cookie.admin)).body;
  check('3) env filtri + super_admin to‘liq', sup.items.map((x) => [x.userId, x.originalTransactionId, x.environment]), [[2, 'OTX2', 'Sandbox']]);
  check('3) q = foydalanuvchi ID', (await A('subscriptions?q=1')).body.items.map((x) => x.userId), [1]);
  check('3) q = NFC kod', (await A('subscriptions?q=oth222')).body.items.map((x) => x.userId), [2]);
  const tx = (await A('transactions?kind=premium', cookie.admin)).body;
  const z = tx.items.find((x) => x.transactionId === 'TXZ0000009');
  check('3) user_id 0 qaytarilgan qator', z && [z.userId, z.state], [0, 'revoked']);
  const t1 = tx.items.find((x) => x.transactionId === 'TXA0000001');
  check('3) narx va valyuta daftarda', t1 && [t1.price, t1.currency, t1.state], [49990, 'USD', 'granted']);
  check('3) manager — tranzaksiya maskasi', (await A('transactions?kind=premium&state=granted&env=Production')).body.items.map((x) => x.transactionId), ['…000001']);
  const bt = (await A('transactions?kind=boost', cookie.admin)).body.items;
  check('3) boost holatlari', bt.map((x) => [x.transactionId, x.state]).sort(), [['BOOST00001', 'slot'], ['BOOST00002', 'credit'], ['STALE0001', 'claimed']]);
  check('3) boost narxi', bt.find((x) => x.transactionId === 'BOOST00001').price, 2990);
  check('3) userId filtri', (await A('transactions?kind=boost&userId=1&state=credit', cookie.admin)).body.items.map((x) => x.transactionId), ['BOOST00002']);
  const n = (await A('notifications?result=unknown_user')).body.items;
  check('3) bildirishnoma filtri', n.length, 2);
  check('3) kreditlar', (await A('credits?state=unused')).body.items.map((x) => [x.userId, x.days, x.state]), [[1, 1, 'unused']]);
  checkTrue('3) ro‘yxatlarda shaxsiy ma’lumot yo‘q', !leaks(subs) && !leaks(tx) && !leaks(n));
  // Keyset sahifalash: 60 ta obuna.
  const ins = sqlite.prepare(`INSERT INTO iap_apple_subscriptions (original_transaction_id, user_id, product_id, environment, expires_at, created_at, updated_at) VALUES (?, 1, 'uz.nfcstore.nova.premium.monthly', 'Production', ?, ?, ?)`);
  for (let i = 0; i < 60; i++) ins.run(`P${String(i).padStart(3, '0')}`, new Date(NOW - DAY).toISOString(), new Date(NOW - i * 1000).toISOString(), new Date(NOW - 10 * DAY - i * 1000).toISOString());
  const p1 = (await A('subscriptions?state=expired')).body;
  const p2 = (await A(`subscriptions?state=expired&cursor=${encodeURIComponent(p1.nextCursor)}`)).body;
  check('3) sahifa 1: 50 + hasMore', [p1.items.length, p1.hasMore], [50, true]);
  check('3) sahifa 2: qolgan 10, takrorsiz', [p2.items.length, p2.hasMore, new Set([...p1.items, ...p2.items].map((x) => x.originalTransactionId)).size], [10, false, 60]);
  check('3) buzuq kursor — 1-sahifa', (await A('subscriptions?state=expired&cursor=%%%')).body.items.length, 50);
}

// ═══ 4. Kartochka va overview ═══
{
  const d = (await call('/api/admin/users/1/detail', { cookie: cookie.manager })).body;
  check('4) kartochkada apple', [d.apple?.hasToken, d.apple?.subscriptions.length >= 1, d.apple?.boostTx.length, d.apple?.credits.length], [true, true, 3, 1]);
  checkTrue('4) kartochka apple — token/JWS yo‘q', !/eyJ|appAccountToken/i.test(JSON.stringify(d.apple)));
  check('4) overview appleAttention', (await call('/api/admin/overview', { cookie: cookie.manager })).body.badges.appleAttention, 4);
}

// ═══ 5. Premium olib qo'yish — faol Apple obunasi ═══
{
  const r = await call('/api/admin/users/1/premium', { method: 'POST', cookie: cookie.admin, json: { action: 'revoke', note: 'test' } });
  check('5) faol Apple obunasi — 409', [r.status, r.body.error, r.body.apple?.productId], [409, 'apple_subscription_active', 'uz.nfcstore.nova.premium.monthly']);
  const f = await call('/api/admin/users/1/premium', { method: 'POST', cookie: cookie.admin, json: { action: 'revoke', note: 'test', force: true } });
  check('5) force — olib tashlandi', [f.status, f.body.revoked], [200, true]);
  checkTrue('5) jurnalda force', /force/.test(sqlite.prepare(`SELECT details FROM admin_activity_log WHERE action = 'user_premium_revoke' ORDER BY id DESC LIMIT 1`).get().details));
  // Apple obunasi bo'lmagan foydalanuvchi — avvalgidek.
  sqlite.prepare(`UPDATE users SET premium_expires_at = ? WHERE id = 3`).run(new Date(NOW + 5 * DAY).toISOString());
}

// ═══ 6. Apple slotini to'xtatish + kredit qayta berish ═══
{
  const rows = (await call('/api/admin/featured', { cookie: cookie.admin })).body.slots;
  const apple = rows.find((x) => x.source === 'apple' && x.status === 'active');
  checkTrue('6) Apple sloti ro‘yxatda', !!apple);
  check('6) content_manager — 403', (await call(`/api/admin/featured/${apple.id}/stop`, { method: 'POST', cookie: contentCookie, json: { reason: 'x', reissueCredit: true } })).status, 403);
  const r = await call(`/api/admin/featured/${apple.id}/stop`, { method: 'POST', cookie: cookie.manager, json: { reason: 'qoida buzilishi', reissueCredit: true } });
  check('6) to‘xtatildi + kredit', [r.status, r.body.ok, typeof r.body.creditId], [200, true, 'number']);
  const c = sqlite.prepare(`SELECT user_id, days, transaction_id, environment FROM iap_apple_boost_credits WHERE id = ?`).get(r.body.creditId);
  check('6) kredit: egasi, kunlar, sintetik kalit', [c.user_id, c.days, c.transaction_id, c.environment], [1, 3, `admin:${apple.id}:BOOST00001`, 'admin']);
  check('6) foydalanuvchi kreditlari ro‘yxatida', (await call('/api/iap/apple/boost-credits', { cookie: cookie.user })).body.credits.some((x) => x.creditId === r.body.creditId), true);
  // Allaqachon to'xtagan slot — 409, ikkinchi kredit yo'q.
  const again = await call(`/api/admin/featured/${apple.id}/stop`, { method: 'POST', cookie: cookie.manager, json: { reason: 'yana', reissueCredit: true } });
  check('6) qayta to‘xtatish — 409, kredit yo‘q', [again.status, sqlite.prepare(`SELECT COUNT(*) AS n FROM iap_apple_boost_credits WHERE transaction_id LIKE 'admin:%'`).get().n], [409, 1]);
  // Qayta berilgan kredit SLOTGA yoqildi (ko'rik F5) — keyin asl tranzaksiya REFUND.
  sqlite.prepare(`INSERT INTO posts (id, code, user_id, caption, created_at) VALUES (502, 'VIP001', 1, 'p2', '2026-01-01 00:00:00')`).run();
  resetLimits();
  const red = await call('/api/iap/apple/boost-redeem', { method: 'POST', cookie: cookie.user, json: { creditId: r.body.creditId, targetKind: 'post', targetId: 502 } });
  check('6) admin krediti yoqildi — slot faol, kalit admin:…', [red.status, red.body.boost,
    sqlite.prepare(`SELECT apple_transaction_id FROM featured_slots WHERE id = ?`).get(red.body.slot?.id)?.apple_transaction_id], [200, 'active', `admin:${apple.id}:BOOST00001`]);
  await notify('REFUND', { ...B1, revocationDate: NOW }, 'u-b1-ref');
  check('6) asl REFUND — admin kreditidan yoqilgan slot ham to‘xtadi', sqlite.prepare(`SELECT status, stopped_reason FROM featured_slots WHERE id = ?`).get(red.body.slot.id),
    { status: 'stopped', stopped_reason: 'apple_refund' });
  checkTrue('6) asl REFUND — qayta berilgan kredit bekor', !!sqlite.prepare(`SELECT revoked_at FROM iap_apple_boost_credits WHERE id = ?`).get(r.body.creditId).revoked_at);
  // Tranzaksiyasi allaqachon qaytarilgan faol slot — to'xtaydi, lekin kredit YO'Q.
  sqlite.prepare(`INSERT INTO iap_apple_boost_transactions (transaction_id, user_id, product_id, days, environment, state, revoked_at, created_at)
    VALUES ('BOOSTREV01', 1, 'uz.nfcstore.nova.boost.1d', 1, 'Production', 'revoked', ?, ?)`).run(new Date(NOW).toISOString(), new Date(NOW).toISOString());
  const rs = sqlite.prepare(`INSERT INTO featured_slots (user_id, target_kind, target_id, code, days, price, status, created_at, source, apple_transaction_id)
    VALUES (1, 'post', 501, 'VIP001', 1, 0, 'active', ?, 'apple', 'BOOSTREV01')`).run(new Date(NOW).toISOString());
  const rv = await call(`/api/admin/featured/${Number(rs.lastInsertRowid)}/stop`, { method: 'POST', cookie: cookie.manager, json: { reason: 'x', reissueCredit: true } });
  check('6) qaytarilgan tranzaksiya — to‘xtadi, kredit yo‘q', [rv.status, rv.body.creditId, rv.body.reason,
    sqlite.prepare(`SELECT COUNT(*) AS n FROM iap_apple_boost_credits WHERE transaction_id LIKE '%BOOSTREV01'`).get().n], [200, null, 'refunded', 0]);
}

__setTrustedRootForTests(null);
done('Admin — Apple / iOS');
