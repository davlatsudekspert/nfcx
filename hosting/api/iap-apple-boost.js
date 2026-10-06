// hosting/api/iap-apple-boost.js — "KO'TARISH" (FEATURED) iOS'DA: APPLE IAP CONSUMABLE.
//
// ═══ NIMA UCHUN BOR ═══
//
// Egasi (2026-10-06) iOS ilovada post ko'tarishni (FEATURED slotlari,
// api/featured.js) sotishni tasdiqladi. App Store qoidasi: raqamli
// xizmat iOS'da faqat Apple In-App Purchase orqali. Sayt va Android'dagi
// Payme/Click yo'li O'ZGARMAYDI.
//
// PARALLEL TIZIM YO'Q: tekshiruvlar (`checkPromoTarget` — egalik, rejadagi
// post, takror, foydalanuvchi va umumiy sig'im), sig'im (`capacityOf`),
// to'xtatish (`stopSlot`) va slot shakli — api/featured.js dan.
//
// ═══ OQIM ═══
//
//   1. POST /api/iap/apple/boost-intent {targetKind, targetId, days}
//      → slot `pending` + `source='apple'`, `ends_at` = ushlab turish
//      tugashi (20 daqiqa). Ushlab turish joy egallaydi; tugasa — o'zi
//      bo'shaydi. → 201 {intentId, productId, days, holdUntil}
//   2. Ilova StoreKit 2 bilan sotib oladi (consumable) va
//      POST /api/iap/apple/verify {signedTransaction, intentId} yuboradi
//      → slot DARHOL yonadi (hozir → hozir + kunlar), xuddi to'langan
//      sayt buyurtmasi kabi → {boost:'active', slot:{id, startsAt, endsAt}}.
//   3. Ushlab turish tugagan/bekor bo'lgan va joy ham yo'q bo'lsa (yoki
//      intentId yo'q — masalan ilova qayta ochilganda tugallanmagan
//      tranzaksiya) — PUL YO'QOLMAYDI: KREDIT yoziladi
//      → {boost:'credited', creditId, days}; keyin
//      POST /api/iap/apple/boost-redeem {creditId, targetKind, targetId}.
//
// ═══ XAVFSIZLIK ═══
//
//   * `transactionId` → natija BIR MARTA: daftar qatori (INSERT OR IGNORE)
//     — da'vo; faqat da'vogar slot yoqadi yoki kredit yozadi. Natija
//     tranzaksiya raqami bilan ham bog'lanadi (`featured_slots.
//     apple_transaction_id`, `iap_apple_boost_credits.transaction_id`
//     UNIQUE) — qayta ishlash hech qachon ikkinchi slot/kredit bermaydi.
//   * REFUND/REVOKE: shu tranzaksiyadan yongan slot to'xtatiladi
//     (`stopSlot`, sabab `apple_refund`), ishlatilmagan kredit bekor
//     qilinadi; noma'lum tranzaksiya ham daftarga `revoked` — eski JWS
//     qayta qabul qilinmaydi.
//   * Sandbox, Family Sharing, tana chegarasi, rate limit — premium
//     verify bilan bir xil (api/iap-apple.js).
//
// ═══ JADVALLAR (faqat CREATE TABLE IF NOT EXISTS / ADD COLUMN) ═══
//
//   iap_apple_boost_transactions (transaction_id PK — daftar)
//   iap_apple_boost_credits      (id, user_id, days, transaction_id UNIQUE, ...)
//   featured_slots + `source`, `apple_transaction_id` (ADD COLUMN)

import {
  ensureSchema as ensureFeaturedSchema, checkPromoTarget, stopSlot,
  PROMO_KINDS, DAY_MS, slotOut,
} from './featured.js';

export const BOOST_PRODUCTS = [
  { productId: 'uz.nfcstore.nova.boost.1d', days: 1 },
  { productId: 'uz.nfcstore.nova.boost.3d', days: 3 },
  { productId: 'uz.nfcstore.nova.boost.6d', days: 6 },
];
const DAYS_BY_PRODUCT = new Map(BOOST_PRODUCTS.map((p) => [p.productId, p.days]));
const PRODUCT_BY_DAYS = new Map(BOOST_PRODUCTS.map((p) => [p.days, p.productId]));
export const boostDaysOf = (productId) => DAYS_BY_PRODUCT.get(productId) || 0;

export const HOLD_MS = 20 * 60_000;
const CLAIM_STALE_MS = 60_000;
const INTENT_RATE_LIMIT = 30;
const INTENT_RATE_WINDOW_MS = 10 * 60_000;

// featured_slots sanalari H.nowTs() shaklida ('YYYY-MM-DD HH:MM:SS.mmm+00').
const dbTs = (ms) => new Date(ms).toISOString().replace('T', ' ').replace('Z', '+00');
const changed = (res) => Number(res?.meta?.changes || 0) > 0;

const ready = {};
export function ensureBoostSchema(env) {
  const key = env.UZ_STORE_ACTIVE ? 'uz' : 'd1';
  return (ready[key] ||= (async () => {
    await ensureFeaturedSchema(env);
    // Ustun bor bo'lsa ALTER xato beradi — jim o'tkaziladi.
    await env.DB.prepare(`ALTER TABLE featured_slots ADD COLUMN source TEXT`).run().catch(() => {});
    await env.DB.prepare(`ALTER TABLE featured_slots ADD COLUMN apple_transaction_id TEXT`).run().catch(() => {});
    await env.DB.batch([
      env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_featured_apple_tx ON featured_slots(apple_transaction_id)`),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS iap_apple_boost_transactions (
        transaction_id TEXT PRIMARY KEY NOT NULL,
        user_id INTEGER NOT NULL,
        product_id TEXT,
        days INTEGER,
        environment TEXT,
        intent_id INTEGER,
        state TEXT NOT NULL,
        slot_id INTEGER,
        credit_id INTEGER,
        revoked_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT
      )`),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS iap_apple_boost_credits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        days INTEGER NOT NULL,
        product_id TEXT,
        environment TEXT,
        transaction_id TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL,
        used_at TEXT,
        used_slot_id INTEGER,
        revoked_at TEXT
      )`),
      env.DB.prepare(`CREATE INDEX IF NOT EXISTS iap_apple_boost_credits_user_idx ON iap_apple_boost_credits(user_id)`),
    ]);
  })().catch((e) => { delete ready[key]; throw e; }));
}

const slotBrief = (row, H) => {
  const s = slotOut(row, H);
  return { id: s.id, startsAt: s.startsAt, endsAt: s.endsAt };
};

// Kontent turi va raqami — POST /api/featured bilan bir xil xatolar.
function parseTarget(body) {
  const kind = String(body?.targetKind || '');
  const targetId = Number(body?.targetId);
  if (!PROMO_KINDS.includes(kind)) return { error: [{ error: 'bad_kind' }, 422] };
  if (!Number.isInteger(targetId) || targetId <= 0) return { error: [{ error: 'bad_target' }, 422] };
  return { kind, targetId };
}

// Darhol faol Apple sloti (kredit yoki muddati o'tgan ushlab turish o'rniga).
async function insertActiveSlot(env, H, { userId, kind, targetId, code, days, txid }) {
  const startMs = Date.now();
  return env.DB.prepare(
    `INSERT INTO featured_slots
       (user_id, target_kind, target_id, code, days, price, order_id, status, starts_at, ends_at, source, apple_transaction_id, created_at)
     VALUES (?,?,?,?,?, 0, 0, 'active', ?, ?, 'apple', ?, ?) RETURNING *`
  ).bind(userId, kind, targetId, code || '', days, dbTs(startMs), dbTs(startMs + days * DAY_MS), txid, H.nowTs()).first();
}

// ═══ 1. INTENT (ushlab turish) ═══
export async function handleIntent(env, H, user, body) {
  if (user.bannedUntil) return [{ error: 'banned' }, 403];
  if (!H.paymentsEnabledD1(env)) return [{ error: 'payments_disabled' }, 503];
  if (await H.rateLimitD1(env, `iap_apple_intent:${user.id}`, INTENT_RATE_LIMIT, INTENT_RATE_WINDOW_MS)) {
    return [{ error: 'too_many_requests' }, 429];
  }
  const t = parseTarget(body);
  if (t.error) return t.error;
  // Faqat iOS mahsulotlari bor kunlar (1/3/6) — admin narx jadvalida
  // boshqa kunlar bo'lsa ham, ular iOS'da sotilmaydi.
  const days = Math.round(Number(body?.days));
  const productId = PRODUCT_BY_DAYS.get(days);
  if (!productId) return [{ error: 'bad_package' }, 422];
  await ensureBoostSchema(env);

  const now = Date.now();
  const holdUntil = now + HOLD_MS;
  // O'sha odam o'sha kontent uchun amal qilayotgan ushlab turishi bo'lsa
  // (Apple oynasini yopib, qayta bosdi) — o'shani yangilaymiz, aks holda
  // u 20 daqiqa `already_featured` olardi.
  const own = await env.DB.prepare(
    `SELECT id FROM featured_slots WHERE user_id = ? AND target_kind = ? AND target_id = ?
       AND status = 'pending' AND source = 'apple' AND ends_at > ?`
  ).bind(user.id, t.kind, t.targetId, H.nowTs()).first();
  if (own) {
    await env.DB.prepare(`UPDATE featured_slots SET days = ?, ends_at = ? WHERE id = ? AND status = 'pending'`)
      .bind(days, dbTs(holdUntil), Number(own.id)).run();
    return [{ intentId: Number(own.id), productId, days, holdUntil }, 201];
  }
  const checked = await checkPromoTarget(env, H, user.id, t.kind, t.targetId);
  if (checked.error) return checked.error;
  const row = await env.DB.prepare(
    `INSERT INTO featured_slots
       (user_id, target_kind, target_id, code, days, price, order_id, status, ends_at, source, created_at)
     VALUES (?,?,?,?,?, 0, 0, 'pending', ?, 'apple', ?) RETURNING id`
  ).bind(user.id, t.kind, t.targetId, checked.target.ownerCode || '', days, dbTs(holdUntil), H.nowTs()).first();
  const intentId = Number(row?.id) || 0;
  if (!intentId) return [{ error: 'slot_failed' }, 503];
  return [{ intentId, productId, days, holdUntil }, 201];
}

// ═══ 2. VERIFY (consumable) ═══

async function ledgerRow(env, txid) {
  return env.DB.prepare(`SELECT * FROM iap_apple_boost_transactions WHERE transaction_id = ?`).bind(txid).first();
}

// Tranzaksiyaning natijasi (slot yoki kredit) — ledger'dan qat'i nazar,
// tranzaksiya raqami bo'yicha. Qayta ishlash ikkinchi marta bermasin.
async function outcomeByTx(env, txid) {
  const slot = await env.DB.prepare(`SELECT id FROM featured_slots WHERE apple_transaction_id = ? ORDER BY id LIMIT 1`).bind(txid).first();
  if (slot) return { slotId: Number(slot.id) };
  const credit = await env.DB.prepare(`SELECT id FROM iap_apple_boost_credits WHERE transaction_id = ?`).bind(txid).first();
  if (credit) return { creditId: Number(credit.id) };
  return null;
}

async function respondFromLedger(env, H, row) {
  if (row.revoked_at) return [{ boost: 'revoked' }, 200];
  if (row.slot_id) {
    const slot = await env.DB.prepare(`SELECT * FROM featured_slots WHERE id = ?`).bind(Number(row.slot_id)).first();
    if (slot) return [{ boost: 'active', slot: slotBrief(slot, H) }, 200];
  }
  if (row.credit_id) {
    const c = await env.DB.prepare(`SELECT id, days FROM iap_apple_boost_credits WHERE id = ?`).bind(Number(row.credit_id)).first();
    if (c) return [{ boost: 'credited', creditId: Number(c.id), days: Number(c.days) }, 200];
  }
  return [{ error: 'in_progress' }, 409];
}

// Slot yoki kredit — DA'VO QILGAN so'rovgina chaqiradi.
async function fulfil(env, H, user, tx, intent) {
  const done = await outcomeByTx(env, tx.transactionId);
  if (done) return done;
  const nowTs = H.nowTs();
  if (intent) {
    // a) Amal qilayotgan ushlab turish — joy allaqachon egallangan: yoqamiz.
    const startMs = Date.now();
    const res = await env.DB.prepare(
      `UPDATE featured_slots SET status = 'active', starts_at = ?, ends_at = ?, apple_transaction_id = ?
        WHERE id = ? AND user_id = ? AND status = 'pending' AND source = 'apple' AND ends_at > ?`
    ).bind(dbTs(startMs), dbTs(startMs + tx.days * DAY_MS), tx.transactionId, Number(intent.id), user.id, nowTs).run();
    if (changed(res)) return { slotId: Number(intent.id) };
    // b) Ushlab turish tugagan/bekor — joy bo'lsa, o'sha kontent uchun yangidan.
    await env.DB.prepare(`UPDATE featured_slots SET status = 'cancelled' WHERE id = ? AND status = 'pending' AND source = 'apple'`)
      .bind(Number(intent.id)).run();
    const checked = await checkPromoTarget(env, H, user.id, String(intent.target_kind), Number(intent.target_id));
    if (!checked.error) {
      const row = await insertActiveSlot(env, H, {
        userId: user.id, kind: String(intent.target_kind), targetId: Number(intent.target_id),
        code: checked.target.ownerCode, days: tx.days, txid: tx.transactionId,
      });
      if (row?.id) return { slotId: Number(row.id) };
    }
  }
  // c) KREDIT — to'langan tranzaksiya hech qachon yo'qolmaydi.
  await env.DB.prepare(`INSERT OR IGNORE INTO iap_apple_boost_credits
      (user_id, days, product_id, environment, transaction_id, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .bind(user.id, tx.days, tx.productId, tx.environment, tx.transactionId, new Date().toISOString()).run();
  const c = await env.DB.prepare(`SELECT id FROM iap_apple_boost_credits WHERE transaction_id = ?`).bind(tx.transactionId).first();
  return { creditId: Number(c.id) };
}

// Slot to'xtatiladi / kredit bekor qilinadi — tranzaksiya raqami bo'yicha.
async function undoByTx(env, txid) {
  let outcome = 'not_granted';
  const slots = await env.DB.prepare(`SELECT id FROM featured_slots WHERE apple_transaction_id = ?`).bind(txid).all();
  for (const s of slots?.results || []) {
    if (await stopSlot(env, Number(s.id), 'apple_refund')) outcome = 'slot_stopped';
  }
  const cr = await env.DB.prepare(`UPDATE iap_apple_boost_credits SET revoked_at = ?
      WHERE transaction_id = ? AND revoked_at IS NULL AND used_at IS NULL`).bind(new Date().toISOString(), txid).run();
  if (changed(cr) && outcome === 'not_granted') outcome = 'credit_revoked';
  // Ishlatilgan kredit: uning sloti yuqorida (apple_transaction_id) to'xtatildi; kreditni ham belgilaymiz.
  await env.DB.prepare(`UPDATE iap_apple_boost_credits SET revoked_at = ? WHERE transaction_id = ? AND revoked_at IS NULL`)
    .bind(new Date().toISOString(), txid).run();
  return outcome;
}

// ═══ QAYTARISH (REFUND/REVOKE) ═══
// Noma'lum tranzaksiya ham daftarga `revoked` (user_id 0) — eski JWS bilan
// keyin yoqib bo'lmasin.
export async function revokeBoost(env, tx, userId = 0) {
  await ensureBoostSchema(env);
  const nowIso = new Date().toISOString();
  await env.DB.prepare(`INSERT OR IGNORE INTO iap_apple_boost_transactions
      (transaction_id, user_id, product_id, days, environment, state, revoked_at, created_at) VALUES (?, ?, ?, ?, ?, 'revoked', ?, ?)`)
    .bind(tx.transactionId, userId || 0, tx.productId, tx.days, tx.environment, nowIso, nowIso).run();
  await env.DB.prepare(`UPDATE iap_apple_boost_transactions SET revoked_at = COALESCE(revoked_at, ?), updated_at = ? WHERE transaction_id = ?`)
    .bind(nowIso, nowIso, tx.transactionId).run();
  return undoByTx(env, tx.transactionId);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function verifyBoost(env, H, user, tx, body) {
  await ensureBoostSchema(env);
  const rawIntent = body?.intentId;
  const intentId = rawIntent === undefined || rawIntent === null || rawIntent === '' ? null : Number(rawIntent);
  if (intentId !== null && (!Number.isInteger(intentId) || intentId <= 0)) return [{ error: 'bad_request' }, 400];
  if (tx.revocationDate) { await revokeBoost(env, tx, user.id); return [{ boost: 'revoked' }, 200]; }

  // Takror / bir vaqtdagi so'rov: natija tayyor bo'lsa — o'sha javob.
  const settled = async (row) => {
    if (Number(row.user_id) && Number(row.user_id) !== Number(user.id) && !row.revoked_at) return [{ error: 'already_linked' }, 409];
    if (row.revoked_at || row.state === 'done') return respondFromLedger(env, H, row);
    return null;
  };
  let row = await ledgerRow(env, tx.transactionId);
  if (row) { const r = await settled(row); if (r) return r; }

  // Intent: boshqa odamniki — 403, kunlar mos emas — 422 (tranzaksiya
  // ISHLATILMAYDI: ilova to'g'ri intent bilan yoki intentsiz qayta yuboradi).
  let intent = null;
  if (intentId !== null) {
    const s = await env.DB.prepare(`SELECT * FROM featured_slots WHERE id = ?`).bind(intentId).first();
    if (s && s.source === 'apple') {
      if (Number(s.user_id) !== Number(user.id)) return [{ error: 'intent_forbidden' }, 403];
      if (Number(s.days) !== tx.days) return [{ error: 'days_mismatch' }, 422];
      intent = s;
    }
  }

  // DA'VO: daftar qatorini qo'shgan so'rovgina slot/kredit beradi.
  const claimAt = new Date().toISOString();
  let tookOver = false;
  const ins = await env.DB.prepare(`INSERT OR IGNORE INTO iap_apple_boost_transactions
      (transaction_id, user_id, product_id, days, environment, intent_id, state, created_at) VALUES (?, ?, ?, ?, ?, ?, 'claimed', ?)`)
    .bind(tx.transactionId, user.id, tx.productId, tx.days, tx.environment, intent ? Number(intent.id) : null, claimAt).run();
  if (!changed(ins)) {
    // Boshqa so'rov ishlayapti — qisqa kutamiz.
    for (let i = 0; i < 12; i++) {
      row = await ledgerRow(env, tx.transactionId);
      const r = row && await settled(row);
      if (r) return r;
      if (row && row.state === 'claimed' && !(Date.now() - Date.parse(row.created_at) < CLAIM_STALE_MS)) break;
      await sleep(150);
    }
    if (!row || row.state !== 'claimed' || Date.now() - Date.parse(row.created_at) < CLAIM_STALE_MS) return [{ error: 'in_progress' }, 409];
    const take = await env.DB.prepare(`UPDATE iap_apple_boost_transactions SET created_at = ?, user_id = ?
        WHERE transaction_id = ? AND state = 'claimed' AND created_at = ?`).bind(claimAt, user.id, tx.transactionId, row.created_at).run();
    if (!changed(take)) return [{ error: 'in_progress' }, 409];
    tookOver = true;
  }

  let out;
  try {
    out = await fulfil(env, H, user, tx, intent);
    await env.DB.prepare(`UPDATE iap_apple_boost_transactions SET state = 'done', slot_id = ?, credit_id = ?, updated_at = ?
        WHERE transaction_id = ? AND created_at = ?`)
      .bind(out.slotId ?? null, out.creditId ?? null, new Date().toISOString(), tx.transactionId, claimAt).run();
  } catch (e) {
    // Natija tranzaksiya raqami bilan bog'langan — da'voni bo'shatish xavfsiz:
    // qayta urinish `outcomeByTx` orqali o'sha slot/kreditni topadi.
    if (!tookOver) {
      await env.DB.prepare(`DELETE FROM iap_apple_boost_transactions WHERE transaction_id = ? AND state = 'claimed' AND created_at = ?`)
        .bind(tx.transactionId, claimAt).run().catch(() => {});
    }
    throw e;
  }
  // Ishlash paytida REFUND kelgan bo'lsa — natijani darhol bekor qilamiz.
  row = await ledgerRow(env, tx.transactionId);
  if (row?.revoked_at) { await undoByTx(env, tx.transactionId); return [{ boost: 'revoked' }, 200]; }
  return respondFromLedger(env, H, row);
}

// ═══ 3. KREDITLAR ═══
export async function listCredits(env, user) {
  await ensureBoostSchema(env);
  const rows = await env.DB.prepare(`SELECT id, days, product_id, created_at FROM iap_apple_boost_credits
      WHERE user_id = ? AND used_at IS NULL AND revoked_at IS NULL ORDER BY id`).bind(user.id).all();
  return [{
    credits: (rows?.results || []).map((r) => ({
      creditId: Number(r.id), days: Number(r.days), productId: String(r.product_id || ''), createdAt: Date.parse(r.created_at) || null,
    })),
  }, 200];
}

export async function redeemCredit(env, H, user, body) {
  if (user.bannedUntil) return [{ error: 'banned' }, 403];
  const creditId = Number(body?.creditId);
  if (!Number.isInteger(creditId) || creditId <= 0) return [{ error: 'bad_request' }, 400];
  const t = parseTarget(body);
  if (t.error) return t.error;
  await ensureBoostSchema(env);
  const credit = await env.DB.prepare(`SELECT * FROM iap_apple_boost_credits WHERE id = ? AND user_id = ?`).bind(creditId, user.id).first();
  if (!credit) return [{ error: 'credit_not_found' }, 404];
  if (credit.revoked_at) return [{ error: 'credit_revoked' }, 409];
  if (credit.used_at) return [{ error: 'credit_used' }, 409];
  const checked = await checkPromoTarget(env, H, user.id, t.kind, t.targetId);
  if (checked.error) return checked.error;
  // Kreditni da'vo qilamiz — ikki parallel so'rovdan faqat bittasi.
  const nowIso = new Date().toISOString();
  const claim = await env.DB.prepare(`UPDATE iap_apple_boost_credits SET used_at = ?
      WHERE id = ? AND user_id = ? AND used_at IS NULL AND revoked_at IS NULL`).bind(nowIso, creditId, user.id).run();
  if (!changed(claim)) return [{ error: 'credit_used' }, 409];
  let row;
  try {
    row = await insertActiveSlot(env, H, {
      userId: user.id, kind: t.kind, targetId: t.targetId, code: checked.target.ownerCode,
      days: Number(credit.days), txid: String(credit.transaction_id),
    });
    if (!row?.id) throw new Error('slot_failed');
  } catch (e) {
    await env.DB.prepare(`UPDATE iap_apple_boost_credits SET used_at = NULL WHERE id = ? AND used_at = ?`).bind(creditId, nowIso).run().catch(() => {});
    throw e;
  }
  await env.DB.prepare(`UPDATE iap_apple_boost_credits SET used_slot_id = ? WHERE id = ?`).bind(Number(row.id), creditId).run();
  return [{ boost: 'active', slot: slotBrief(row, H) }, 200];
}
