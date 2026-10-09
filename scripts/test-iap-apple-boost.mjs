// "KO'TARISH" iOS'DA — APPLE IAP CONSUMABLE (hosting/api/iap-apple-boost.js).
//   node scripts/test-iap-apple-boost.mjs
//   UZ_ADAPTER_TEST=1 node scripts/test-iap-apple-boost.mjs   (sqld adapteri)
//
// Haqiqiy worker.fetch + xotiradagi baza (scripts/lib/social-fixture.mjs);
// JWS soxta zanjir bilan (scripts/lib/apple-fake-chain.mjs).
// Tekshiriladi: config; intent (ushlab turish) — POST /api/featured bilan bir
// xil xatolar, joy egallaydi, qayta bosish o'sha intent; intent → xarid →
// faol slot; idempotent; bir vaqtdagi ikki verify; kunlar/mahsulot mos emas;
// begona intent 403; ushlab turish tugagan → yangidan yoki KREDIT; sold out →
// kredit → redeem; intentsiz → kredit; REFUND slotni to'xtatadi / kreditni
// bekor qiladi / noma'lum tranzaksiya qayta qabul qilinmaydi;
// CONSUMPTION_REQUEST; sandbox, Family Sharing, tur; admin ro'yxatida manba.
// Production'ga HECH QACHON tegmaydi.
import { setupSocial, cookie, makeChecker } from './lib/social-fixture.mjs';
import { makeChain, signJws } from './lib/apple-fake-chain.mjs';
import { __setTrustedRootForTests } from '../hosting/api/iap-apple.js';

const { check, checkTrue, done } = makeChecker();
const { env, sqlite, call, resetLimits } = await setupSocial({
  PAYMENTS_ENABLED: 'true',
  PAYME_MERCHANT_ID: 'test_merchant_local_only',
  PAYME_KEY: 'test_payme_key_local_only',
});
const chain = makeChain();
__setTrustedRootForTests(chain.rootB64);
// Sotuv ochiq (1000 foydalanuvchi sharti test-featured-sales.mjs da).
sqlite.prepare(`INSERT INTO admin_settings (key, value) VALUES ('featured_sales_open', 'open'), ('featured_sales_opened_at', ?)`)
  .run(new Date(Date.now() - 3 * 86400000).toISOString());
const DAY = 86_400_000;
const NOW = Date.now();
const dbTs = (ms) => new Date(ms).toISOString().replace('T', ' ').replace('Z', '+00');
const P1 = 'uz.nfcstore.nova.boost.1d';
const P3 = 'uz.nfcstore.nova.boost.3d';
const P6 = 'uz.nfcstore.nova.boost.6d';

// user#1 postlari 101..110 (VIP001), user#2 posti 201 (OTH222).
for (let i = 101; i <= 110; i++) sqlite.prepare(`INSERT INTO posts (id, code, user_id, caption, created_at) VALUES (?, 'VIP001', 1, 'p', '2026-01-01 00:00:00')`).run(i);
sqlite.prepare(`INSERT INTO posts (id, code, user_id, caption, created_at) VALUES (201, 'OTH222', 2, 'b', '2026-01-01 00:00:00')`).run();

let seq = 5000;
const tx = (o = {}) => ({
  transactionId: String(++seq), originalTransactionId: undefined, bundleId: 'uz.nfcstore.nova', productId: P1,
  type: 'Consumable', purchaseDate: NOW, environment: 'Production', signedDate: NOW, inAppOwnershipType: 'PURCHASED', ...o,
});
const withOtid = (t) => ({ ...t, originalTransactionId: t.originalTransactionId ?? t.transactionId });
const verify = (t, intentId, who = cookie.user) => call('/api/iap/apple/verify', {
  method: 'POST', cookie: who, json: { signedTransaction: signJws(withOtid(t), chain), ...(intentId !== undefined ? { intentId } : {}) },
});
// Yangi ushlab turish soatiga 6 ta (rate limit) — chegara alohida (10-bo'lim)
// tekshiriladi, qolgan joylarda har chaqiruvdan oldin hisoblagich tozalanadi.
const intent = (json, who = cookie.user, { keepLimits = false } = {}) => {
  if (!keepLimits) resetLimits();
  return call('/api/iap/apple/boost-intent', { method: 'POST', cookie: who, json });
};
let nseq = 0;
const notify = (type, t) => call('/api/iap/apple/notifications', { method: 'POST', json: { signedPayload: signJws({
  notificationType: type, notificationUUID: `bn-${++nseq}`, signedDate: NOW,
  data: { bundleId: 'uz.nfcstore.nova', environment: 'Production', signedTransactionInfo: signJws(withOtid(t), chain) },
}, chain) } });
const slot = (id) => sqlite.prepare(`SELECT * FROM featured_slots WHERE id = ?`).get(id);
const capacity = async () => (await call('/api/featured/packages')).body.capacity;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Boshqa foydalanuvchining faol slotlari bilan joyni to'ldirish (sig'im 8).
const fill = (n) => { for (let i = 0; i < n; i++) sqlite.prepare(`INSERT INTO featured_slots (user_id, target_kind, target_id, code, days, price, status, starts_at, ends_at, created_at)
  VALUES (99, 'post', ?, 'X', 1, 1, 'active', ?, ?, ?)`).run(9000 + i, dbTs(NOW - 1000), dbTs(NOW + DAY), dbTs(NOW)); };
const unfill = () => sqlite.prepare(`DELETE FROM featured_slots WHERE user_id = 99`).run();
// user#1 ning slotlarini bo'shatish (I1 dan tashqari — u 7-bo'limda REFUND bilan to'xtatiladi).
let keepId = 0;
const clearUser1 = () => sqlite.prepare(`UPDATE featured_slots SET status = 'stopped' WHERE user_id = 1 AND status IN ('active', 'pending') AND id != ?`).run(keepId);

// ═══ 1. Config ═══
{
  delete env.IAP_APPLE_ENABLED;
  const c0 = (await call('/api/iap/apple/config')).body;
  check('1) bayroq o‘chiq — boostEnabled:false', [c0.enabled, c0.boostEnabled], [false, false]);
  check('1) boostProducts', c0.boostProducts, [{ productId: P1, days: 1 }, { productId: P3, days: 3 }, { productId: P6, days: 6 }]);
  check('1) eski maydonlar o‘zgarmadi', c0.products, ['uz.nfcstore.nova.premium.monthly', 'uz.nfcstore.nova.premium.yearly']);
  check('1) boostSalesOpen + son + chegara', [c0.boostSalesOpen, typeof c0.usersCount, c0.openAt], [true, 'number', 1000]);
  env.IAP_APPLE_ENABLED = '1';
  check('1) bayroq + to‘lovlar — boostEnabled:true', (await call('/api/iap/apple/config')).body.boostEnabled, true);
  env.PAYMENTS_ENABLED = 'false';
  check('1) FEATURED sotuvi o‘chiq — boostEnabled:false', (await call('/api/iap/apple/config')).body.boostEnabled, false);
  check('1) intent — 503 payments_disabled', (await intent({ targetKind: 'post', targetId: 101, days: 1 })).body, { error: 'payments_disabled' });
  env.PAYMENTS_ENABLED = 'true';
}

// ═══ 2. Intent ═══
let I1;
{
  check('2) mehmon — 401', (await intent({ targetKind: 'post', targetId: 101, days: 1 }, null)).status, 401);
  env.IAP_APPLE_ENABLED = '0';
  check('2) bayroq o‘chiq — 503 iap_disabled', (await intent({ targetKind: 'post', targetId: 101, days: 1 })).body, { error: 'iap_disabled' });
  env.IAP_APPLE_ENABLED = '1';
  check('2) GET — 405', (await call('/api/iap/apple/boost-intent', { cookie: cookie.user })).status, 405);
  check('2) bad_kind', (await intent({ targetKind: 'story', targetId: 101, days: 1 })).body, { error: 'bad_kind' });
  check('2) bad_target', (await intent({ targetKind: 'post', targetId: -1, days: 1 })).body, { error: 'bad_target' });
  check('2) iOS’da yo‘q kun — bad_package', (await intent({ targetKind: 'post', targetId: 101, days: 2 })).body, { error: 'bad_package' });
  check('2) yo‘q post — 404', (await intent({ targetKind: 'post', targetId: 999, days: 1 })).status, 404);
  check('2) begona post — 403 forbidden', (await intent({ targetKind: 'post', targetId: 201, days: 1 })).body, { error: 'forbidden' });
  const r = await intent({ targetKind: 'post', targetId: 101, days: 1 });
  I1 = r.body.intentId;
  keepId = I1;
  check('2) 201 shakli', [r.status, Object.keys(r.body).sort(), r.body.productId, r.body.days], [201, ['days', 'holdUntil', 'intentId', 'productId'], P1, 1]);
  checkTrue('2) holdUntil ≈ hozir + 20 daqiqa', Math.abs(r.body.holdUntil - (Date.now() + 20 * 60_000)) < 5000);
  const s = slot(I1);
  check('2) slot: pending, apple, narx 0', [s.status, s.source, s.price, s.order_id, s.starts_at], ['pending', 'apple', 0, 0, null]);
  // Ko'rik F2: ushlab turish SAYT sig'imiga ta'sir qilmaydi.
  check('2) sayt sig‘imi ushlab turishni sanamaydi', (await capacity()).active, 0);
  const same = await intent({ targetKind: 'post', targetId: 101, days: 1 });
  check('2) qayta bosish (o‘sha post, o‘sha kun) — o‘sha intent, muddat uzaymaydi', [same.body.intentId, same.body.holdUntil], [I1, r.body.holdUntil]);
  // Ko'rik F1: kunlar o'zgarsa — eski bekor, yangi intent (days hech qachon o'zgartirilmaydi).
  const other = await intent({ targetKind: 'post', targetId: 101, days: 3 });
  check('2) boshqa kun — yangi intent, eskisi bekor', [other.status, other.body.intentId !== I1, other.body.productId, slot(I1).status, slot(I1).days], [201, true, P3, 'cancelled', 1]);
  // Sayt (Payme) orqali o'sha post — Apple ushlab turishi TO'SMAYDI (ko'rik F2).
  const web = await call('/api/featured', { method: 'POST', cookie: cookie.user, json: { targetKind: 'post', targetId: 101, days: 1 } });
  check('2) sayt orqali o‘sha post — to‘silmaydi (201)', web.status, 201);
  await call(`/api/featured/${web.body.slot.id}/cancel`, { method: 'POST', cookie: cookie.user });
  const fresh = await intent({ targetKind: 'post', targetId: 101, days: 1 });
  I1 = fresh.body.intentId;
  keepId = I1;
  check('2) yana 1 kun — yangi intent, oldingisi bekor', [slot(other.body.intentId).status, slot(I1).status], ['cancelled', 'pending']);
}

// ═══ 3. Xarid → faol slot; idempotent ═══
const T1 = tx({ productId: P1 });
let active1;
{
  // Ko'rik F1: begona intent — xato EMAS, e'tiborsiz: user#2 da ushlab turish yo'q → kredit.
  const fr = await verify(tx({ productId: P1 }), I1, cookie.other);
  check('3) begona intent — kredit (pul yo‘qolmaydi)', [fr.status, fr.body.boost, fr.body.days], [200, 'credited', 1]);
  check('3) begona intent — user#1 ushlab turishi joyida', slot(I1).status, 'pending');
  const t0 = Date.now();
  const r = await verify(T1, I1);
  active1 = r.body;
  check('3) faol', [r.status, r.body.boost, r.body.slot?.id], [200, 'active', I1]);
  checkTrue('3) boshlanish hozir, tugash +1 kun', Math.abs(r.body.slot.startsAt - t0) < 5000 && r.body.slot.endsAt - r.body.slot.startsAt === DAY);
  const s = slot(I1);
  check('3) bazada: active, apple, tranzaksiya', [s.status, s.source, s.apple_transaction_id], ['active', 'apple', T1.transactionId]);
  check('3) lentada', (await call('/api/featured')).body.slots.map((x) => x.id), [I1]);
  const again = await verify(T1, I1);
  check('3) idempotent — xuddi o‘sha javob', again.body, active1);
  check('3) idempotent — intentsiz ham o‘sha', (await verify(T1)).body, active1);
  check('3) bitta slot, bitta daftar qatori', [sqlite.prepare(`SELECT COUNT(*) AS n FROM featured_slots WHERE apple_transaction_id = ?`).get(T1.transactionId).n,
    sqlite.prepare(`SELECT COUNT(*) AS n FROM iap_apple_boost_transactions WHERE transaction_id = ?`).get(T1.transactionId).n], [1, 1]);
  check('3) boshqa foydalanuvchi o‘sha tranzaksiya — 409', (await verify(T1, undefined, cookie.other)).body, { error: 'already_linked' });
}

// ═══ 4. Bir vaqtdagi ikki verify ═══
{
  const I2 = (await intent({ targetKind: 'post', targetId: 102, days: 3 })).body.intentId;
  const T2 = tx({ productId: P3 });
  const realDB = env.DB;
  env.DB = new Proxy(realDB, { get(t, k) {
    if (k === 'prepare') return (sql) => {
      const wrap = (st) => new Proxy(st, { get(o, m) {
        if (m === 'bind') return (...a) => wrap(o.bind(...a));
        if (m === 'first' || m === 'run' || m === 'all') return async (...a) => { await sleep(4); return o[m](...a); };
        const v = o[m]; return typeof v === 'function' ? v.bind(o) : v;
      } });
      return wrap(t.prepare(sql));
    };
    const v = t[k]; return typeof v === 'function' ? v.bind(t) : v;
  } });
  const [a, b] = await Promise.all([verify(T2, I2), verify(T2, I2)]);
  env.DB = realDB;
  check('4) ikkalasi 200 va bir xil', [a.status, b.status, JSON.stringify(a.body) === JSON.stringify(b.body), a.body.boost], [200, 200, true, 'active']);
  check('4) bitta slot, kredit yo‘q', [sqlite.prepare(`SELECT COUNT(*) AS n FROM featured_slots WHERE apple_transaction_id = ?`).get(T2.transactionId).n,
    sqlite.prepare(`SELECT COUNT(*) AS n FROM iap_apple_boost_credits WHERE transaction_id = ?`).get(T2.transactionId).n], [1, 0]);
}

// ═══ 5. Ushlab turish tugagan ═══
{
  const I3 = (await intent({ targetKind: 'post', targetId: 103, days: 1 })).body.intentId;
  sqlite.prepare(`UPDATE featured_slots SET ends_at = ? WHERE id = ?`).run(dbTs(Date.now() - 1000), I3);
  check('5) tugagan ushlab turish joy egallamaydi', (await capacity()).active, 2);
  const T3 = tx({ productId: P1 });
  const r = await verify(T3, I3);
  checkTrue('5) joy bor — yangi faol slot (o‘sha post)', r.body.boost === 'active' && r.body.slot.id !== I3 && slot(r.body.slot.id).target_id === 103);
  check('5) eski ushlab turish bekor', slot(I3).status, 'cancelled');
}

// ═══ 6. Foydalanuvchi chegarasi (3) va sold out → KREDIT → redeem ═══
let creditId;
{
  check('6) 3 ta faol bor — 4-intent too_many_active', (await intent({ targetKind: 'post', targetId: 105, days: 1 })).body, { error: 'too_many_active', max: 3 });
  clearUser1();
  // Supurish: GET /api/featured muddati o'tgan ushlab turishni bekor qiladi.
  const I4 = (await intent({ targetKind: 'post', targetId: 104, days: 1 })).body.intentId;
  sqlite.prepare(`UPDATE featured_slots SET ends_at = ? WHERE id = ?`).run(dbTs(Date.now() - 1000), I4);
  await call('/api/featured');
  check('6) supurish — muddati o‘tgan ushlab turish cancelled', slot(I4).status, 'cancelled');
  const I5 = (await intent({ targetKind: 'post', targetId: 105, days: 6 })).body.intentId;
  sqlite.prepare(`UPDATE featured_slots SET ends_at = ? WHERE id = ?`).run(dbTs(Date.now() - 1000), I5);
  fill(8);
  check('6) to‘la — intent sold_out', (await intent({ targetKind: 'post', targetId: 106, days: 1 })).body.error, 'sold_out');
  const T5 = tx({ productId: P6 });
  const r = await verify(T5, I5);
  creditId = r.body.creditId;
  check('6) joy yo‘q — kredit', [r.status, r.body.boost, r.body.days, typeof creditId], [200, 'credited', 6, 'number']);
  check('6) idempotent — o‘sha kredit', (await verify(T5, I5)).body, r.body);
  const list = (await call('/api/iap/apple/boost-credits', { cookie: cookie.user })).body;
  check('6) kreditlar ro‘yxati', list.credits.map((c) => [c.creditId, c.days, c.productId]), [[creditId, 6, P6]]);
  check('6) mehmon — 401', (await call('/api/iap/apple/boost-credits')).status, 401);
  const redeem = (json, who = cookie.user) => call('/api/iap/apple/boost-redeem', { method: 'POST', cookie: who, json });
  check('6) redeem to‘la — sold_out', (await redeem({ creditId, targetKind: 'post', targetId: 105 })).body.error, 'sold_out');
  unfill();
  check('6) begona kredit — 404', (await redeem({ creditId, targetKind: 'post', targetId: 201 }, cookie.other)).body, { error: 'credit_not_found' });
  check('6) begona post — forbidden', (await redeem({ creditId, targetKind: 'post', targetId: 201 })).body, { error: 'forbidden' });
  const ok = await redeem({ creditId, targetKind: 'post', targetId: 105 });
  check('6) redeem — faol', [ok.status, ok.body.boost], [200, 'active']);
  checkTrue('6) redeem — 6 kun', ok.body.slot.endsAt - ok.body.slot.startsAt === 6 * DAY);
  check('6) redeem sloti apple + tranzaksiya', [slot(ok.body.slot.id).source, slot(ok.body.slot.id).apple_transaction_id], ['apple', T5.transactionId]);
  check('6) qayta redeem — credit_used', (await redeem({ creditId, targetKind: 'post', targetId: 106 })).body, { error: 'credit_used' });
  check('6) ro‘yxat bo‘sh', (await call('/api/iap/apple/boost-credits', { cookie: cookie.user })).body.credits, []);
  // intentsiz (ilova qayta ochilganda tugallanmagan tranzaksiya) — kredit.
  const r2 = await verify(tx({ productId: P3 }));
  check('6) intentsiz — kredit', [r2.body.boost, r2.body.days], ['credited', 3]);
  creditId = r2.body.creditId;
}

// ═══ 7. REFUND / REVOKE / CONSUMPTION_REQUEST ═══
{
  env.IAP_APPLE_ENABLED = '0'; // bildirishnomalar bayroqsiz ham
  const r = await notify('REFUND', { ...T1, revocationDate: NOW });
  check('7) REFUND faol slot — to‘xtatildi', [r.status, r.body.result, slot(I1).status, slot(I1).stopped_reason], [200, 'slot_stopped', 'stopped', 'apple_refund']);
  check('7) lentada yo‘q', (await call('/api/featured')).body.slots.some((x) => x.id === I1), false);
  env.IAP_APPLE_ENABLED = '1';
  check('7) qaytarilgan tranzaksiya qayta — revoked', (await verify(T1, I1)).body, { boost: 'revoked' });
  // Ishlatilmagan kredit.
  const credTx = sqlite.prepare(`SELECT transaction_id FROM iap_apple_boost_credits WHERE id = ?`).get(creditId).transaction_id;
  const rc = await notify('REVOKE', tx({ transactionId: credTx, productId: P3, revocationDate: NOW }));
  check('7) REVOKE kredit — bekor', rc.body.result, 'credit_revoked');
  check('7) ro‘yxatda yo‘q', (await call('/api/iap/apple/boost-credits', { cookie: cookie.user })).body.credits, []);
  check('7) redeem — credit_revoked', (await call('/api/iap/apple/boost-redeem', { method: 'POST', cookie: cookie.user, json: { creditId, targetKind: 'post', targetId: 107 } })).body, { error: 'credit_revoked' });
  // Noma'lum tranzaksiya REFUND'i — keyin eski JWS qabul qilinmaydi.
  const TU = tx({ productId: P1 });
  check('7) noma’lum REFUND — not_granted', (await notify('REFUND', { ...TU, revocationDate: NOW })).body.result, 'not_granted');
  const I6 = (await intent({ targetKind: 'post', targetId: 108, days: 1 })).body.intentId;
  check('7) eski JWS — revoked, slot yonmadi', [(await verify(TU, I6)).body.boost, slot(I6).status], ['revoked', 'pending']);
  check('7) CONSUMPTION_REQUEST — 200 ack', (await notify('CONSUMPTION_REQUEST', tx({ productId: P1 }))).body, { ok: true, result: 'consumption_ack' });
  // verify'ga revocationDate bilan kelgan tranzaksiya.
  check('7) verify revocationDate bilan — revoked', (await verify(tx({ productId: P1, revocationDate: NOW }), I6)).body, { boost: 'revoked' });
}

// ═══ 8. Sandbox, Family Sharing, tur, chegaralar ═══
{
  resetLimits();
  const I7 = (await intent({ targetKind: 'post', targetId: 109, days: 1 })).body.intentId;
  check('8) Sandbox — 422', (await verify(tx({ environment: 'Sandbox' }), I7)).body, { error: 'sandbox_not_allowed' });
  check('8) FAMILY_SHARED — 422', (await verify(tx({ inAppOwnershipType: 'FAMILY_SHARED' }), I7)).body, { error: 'family_shared_not_supported' });
  check('8) boost mahsuloti, obuna turi — wrong_type', (await verify(tx({ type: 'Auto-Renewable Subscription' }), I7)).body, { error: 'wrong_type' });
  check('8) buzuq intentId — 400', (await verify(tx(), 'abc')).body, { error: 'bad_request' });
  check('8) slot hali pending', slot(I7).status, 'pending');
  env.IAP_APPLE_SANDBOX_USER_IDS = '1';
  check('8) Sandbox ro‘yxatda — faol', (await verify(tx({ environment: 'Sandbox' }), I7)).body.boost, 'active');
  delete env.IAP_APPLE_SANDBOX_USER_IDS;
  const big = JSON.stringify({ targetKind: 'post', targetId: 110, days: 1, pad: 'x'.repeat(130 * 1024) });
  check('8) katta tana — 413', (await call('/api/iap/apple/boost-intent', { method: 'POST', cookie: cookie.user, body: big, headers: { 'content-type': 'application/json' } })).status, 413);
}

// ═══ 9. Admin ro'yxati: manba ═══
{
  // Sayt (Payme) slotlari va admin qo'lda bergan slot.
  clearUser1();
  const web = await call('/api/featured', { method: 'POST', cookie: cookie.user, json: { targetKind: 'post', targetId: 110, days: 1 } });
  check('9) sayt yo‘li o‘zgarmagan — 201 + payLinks', [web.status, !!web.body.payLinks, web.body.slot.status], [201, true, 'pending']);
  const adm = await call('/api/admin/featured', { method: 'POST', cookie: cookie.admin, json: { targetKind: 'post', targetId: 201, days: 2, note: 'hamkorlik' } });
  check('9) admin qo‘lda — 201', adm.status, 201);
  const rows = (await call('/api/admin/featured', { cookie: cookie.admin })).body.slots;
  const by = (id) => rows.find((x) => x.id === id);
  check('9) apple sloti', [by(I1).source, by(I1).appleTransactionId], ['apple', T1.transactionId]);
  check('9) sayt sloti', [by(web.body.slot.id).source, by(web.body.slot.id).appleTransactionId], ['web', null]);
  check('9) admin sloti', by(adm.body.slot.id).source, 'admin');
  // Admin to'xtatish yo'li o'zgarmagan.
  check('9) admin stop', (await call(`/api/admin/featured/${adm.body.slot.id}/stop`, { method: 'POST', cookie: cookie.admin, json: { reason: 'test' } })).body, { ok: true });
  check('9) admin stop — sabab', slot(adm.body.slot.id).stopped_reason, 'admin#1: test');
}

// ═══ 10. Ko'rik tuzatishlari (F1, F2, F4, F5, F6) ═══
{
  env.IAP_APPLE_ENABLED = '1';
  clearUser1();
  sqlite.prepare(`UPDATE featured_slots SET status = 'stopped' WHERE id = ?`).run(I1);
  // F1: kunlar mos emas — to'langan kunlar bilan yoqiladi.
  const h1 = (await intent({ targetKind: 'post', targetId: 105, days: 1 })).body.intentId;
  const m = await verify(tx({ productId: P3 }), h1);
  check('10) F1 kunlar mos emas — to‘langan 3 kun bilan faol', [m.body.boost, m.body.slot.id, slot(h1).days, m.body.slot.endsAt - m.body.slot.startsAt], ['active', h1, 3, 3 * DAY]);
  // F1: intentsiz, lekin O'Z amal qilayotgan ushlab turishi bor — o'sha yonadi.
  const h2 = (await intent({ targetKind: 'post', targetId: 106, days: 1 })).body.intentId;
  const n = await verify(tx({ productId: P1 }));
  check('10) F1 intentsiz — o‘z ushlab turishi yonadi', [n.body.boost, n.body.slot?.id], ['active', h2]);
  // F2: bir odam — bitta amal qilayotgan ushlab turish.
  clearUser1();
  const a = (await intent({ targetKind: 'post', targetId: 107, days: 1 })).body.intentId;
  const b = (await intent({ targetKind: 'post', targetId: 108, days: 1 })).body.intentId;
  check('10) F2 ikkinchi intent — birinchisi bekor', [slot(a).status, slot(b).status], ['cancelled', 'pending']);
  check('10) F2 amal qilayotgan ushlab turish bitta', sqlite.prepare(`SELECT COUNT(*) AS n FROM featured_slots WHERE user_id = 1 AND status = 'pending' AND source = 'apple' AND ends_at > ?`).get(dbTs(Date.now())).n, 1);
  // F2: yangi ushlab turish soatiga 6 ta.
  resetLimits();
  const codes = [];
  for (let i = 0; i < 7; i++) codes.push((await intent({ targetKind: 'post', targetId: 101 + (i % 2), days: i % 2 ? 3 : 1 }, cookie.user, { keepLimits: true })).status);
  check('10) F2 7-chi yangi intent — 429', codes, [201, 201, 201, 201, 201, 201, 429]);
  // F2: ushlab turish sayt sig'imini to'smaydi; to'liq bo'lsa Apple — kredit.
  clearUser1();
  resetLimits();
  const act = () => sqlite.prepare(`SELECT COUNT(*) AS n FROM featured_slots WHERE status = 'active' AND ends_at > ?`).get(dbTs(Date.now())).n;
  fill(7 - act());
  const hold = (await intent({ targetKind: 'post', targetId: 109, days: 1 })).body.intentId;
  check('10) F2 Apple uchun to‘la (7 faol + ushlab turish)', (await intent({ targetKind: 'post', targetId: 201, days: 1 }, cookie.other)).body.error, 'sold_out');
  const webOther = await call('/api/featured', { method: 'POST', cookie: cookie.other, json: { targetKind: 'post', targetId: 201, days: 1 } });
  check('10) F2 sayt — ushlab turish to‘smaydi (201)', webOther.status, 201);
  fill(1);
  const full = await verify(tx({ productId: P1 }), hold);
  check('10) F2 to‘langan, joy yo‘q — kredit, ushlab turish bekor', [full.body.boost, slot(hold).status], ['credited', 'cancelled']);
  unfill();
  // F4: redeem paytida REFUND kelsa — slot darhol to'xtatiladi.
  clearUser1();
  const cTx = tx({ productId: P1 });
  const cr = (await verify(cTx)).body;
  check('10) F4 tayyorlov — kredit', cr.boost, 'credited');
  const realDB = env.DB;
  env.DB = new Proxy(realDB, { get(t, k) {
    if (k === 'prepare') return (sql) => {
      const wrap = (st) => new Proxy(st, { get(o, mm) {
        if (mm === 'bind') return (...args) => wrap(o.bind(...args));
        if (mm === 'first' && /INSERT INTO featured_slots/.test(sql)) return async (...args) => {
          const out = await o.first(...args);
          sqlite.prepare(`UPDATE iap_apple_boost_credits SET revoked_at = ? WHERE id = ?`).run(new Date().toISOString(), cr.creditId);
          return out;
        };
        const v = o[mm]; return typeof v === 'function' ? v.bind(o) : v;
      } });
      return wrap(t.prepare(sql));
    };
    const v = t[k]; return typeof v === 'function' ? v.bind(t) : v;
  } });
  const rd = await call('/api/iap/apple/boost-redeem', { method: 'POST', cookie: cookie.user, json: { creditId: cr.creditId, targetKind: 'post', targetId: 110 } });
  env.DB = realDB;
  const rs = sqlite.prepare(`SELECT status, stopped_reason FROM featured_slots WHERE apple_transaction_id = ?`).get(cTx.transactionId);
  check('10) F4 redeem + parallel REFUND — 409, slot to‘xtatildi', [rd.status, rd.body.error, rs.status, rs.stopped_reason], [409, 'credit_revoked', 'stopped', 'apple_refund']);
  // F5: bitta tranzaksiya — bitta slot (UNIQUE indeks).
  checkTrue('10) F5 UNIQUE indeks bor', !!sqlite.prepare(`SELECT 1 FROM sqlite_master WHERE name = 'idx_featured_apple_tx_unique'`).get());
  let dupErr = '';
  try { sqlite.prepare(`INSERT INTO featured_slots (user_id, target_kind, target_id, code, days, price, status, apple_transaction_id, created_at) VALUES (1, 'post', 1, '', 1, 0, 'stopped', ?, ?)`).run(cTx.transactionId, dbTs(Date.now())); }
  catch (e) { dupErr = String(e.message); }
  checkTrue('10) F5 takror apple_transaction_id — rad', /UNIQUE/.test(dupErr));
  // F6: REFUND_REVERSED — slot qolgan muddati bilan qayta yonadi.
  clearUser1();
  const hr = (await intent({ targetKind: 'post', targetId: 107, days: 6 })).body.intentId;
  const rTx = tx({ productId: P6 });
  check('10) F6 tayyorlov — faol', (await verify(rTx, hr)).body.boost, 'active');
  env.IAP_APPLE_ENABLED = '0';
  check('10) F6 REFUND — to‘xtatildi', (await notify('REFUND', { ...rTx, revocationDate: NOW })).body.result, 'slot_stopped');
  check('10) F6 REFUND_REVERSED — tiklandi', (await notify('REFUND_REVERSED', rTx)).body.result, 'slot_restored');
  const rr = slot(hr);
  checkTrue('10) F6 slot faol, ≈ 6 kun qoldi', rr.status === 'active' && rr.stopped_reason === null && Math.abs(Date.parse(rr.ends_at.replace(' ', 'T').replace('+00', 'Z')) - (Date.now() + 6 * DAY)) < 10_000);
  env.IAP_APPLE_ENABLED = '1';
  const vr = await verify(rTx, hr);
  check('10) F6 verify — holat bilan', [vr.body.boost, vr.body.slot.status], ['active', 'active']);
  // Kredit: REFUND → bekor, REFUND_REVERSED → qaytdi.
  const kTx = tx({ productId: P3 });
  const kc = (await verify(kTx)).body;
  check('10) F6 tayyorlov — kredit', kc.boost, 'credited');
  check('10) F6 kredit REFUND', (await notify('REFUND', { ...kTx, revocationDate: NOW })).body.result, 'credit_revoked');
  check('10) F6 kredit REFUND_REVERSED', (await notify('REFUND_REVERSED', kTx)).body.result, 'credit_restored');
  checkTrue('10) F6 kredit ro‘yxatda', (await call('/api/iap/apple/boost-credits', { cookie: cookie.user })).body.credits.some((c) => c.creditId === kc.creditId));
  // Noma'lum tranzaksiya REFUND → REVERSED → verify ishlaydi.
  const uTx = tx({ productId: P1 });
  await notify('REFUND', { ...uTx, revocationDate: NOW });
  await notify('REFUND_REVERSED', uTx);
  check('10) F6 noma’lum REFUND bekor qilingach — verify kredit', (await verify(uTx)).body.boost, 'credited');
  // Holat: muddati o'tgan slot — slot.status 'expired'.
  sqlite.prepare(`UPDATE featured_slots SET ends_at = ? WHERE id = ?`).run(dbTs(Date.now() - 1000), hr);
  await call('/api/featured');
  check('10) F6 tugagan slot — status expired', (await verify(rTx, hr)).body.slot.status, 'expired');
}

__setTrustedRootForTests(null);
done('Apple IAP — Ko‘tarish');
