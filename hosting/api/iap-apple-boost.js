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
  ensureSchema as ensureFeaturedSchema, checkPromoTarget, stopSlot, salesGate,
  PROMO_KINDS, DAY_MS, slotOut, MAX_ACTIVE_TOTAL,
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
// Yangi ushlab turish yaratish: soatiga ko'pi bilan 6 ta (ko'rik F2 —
// joylarni ushlab turib boshqalarga xalal berishga qarshi). Mavjudini
// qayta so'rash sanalmaydi.
const INTENT_RATE_LIMIT = 6;
const INTENT_RATE_WINDOW_MS = 60 * 60_000;

// featured_slots sanalari H.nowTs() shaklida ('YYYY-MM-DD HH:MM:SS.mmm+00').
const dbTs = (ms) => new Date(ms).toISOString().replace('T', ' ').replace('Z', '+00');
const changed = (res) => Number(res?.meta?.changes || 0) > 0;
// 'YYYY-MM-DD HH:MM:SS.mmm+00' / ISO → ms (hammasi UTC).
const tsMs = (v) => {
  if (!v) return NaN;
  let x = String(v).trim().replace(' ', 'T');
  if (/\+00$/.test(x)) x = x.replace(/\+00$/, 'Z'); else if (!/(Z|[+-]\d{2}:?\d{2})$/i.test(x)) x += 'Z';
  return Date.parse(x);
};

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
      // Bitta Apple tranzaksiyasi — ko'pi bilan bitta slot (ko'rik F5).
      env.DB.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_featured_apple_tx_unique
        ON featured_slots(apple_transaction_id) WHERE apple_transaction_id IS NOT NULL`),
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
  const t = parseTarget(body);
  if (t.error) return t.error;
  // Faqat iOS mahsulotlari bor kunlar (1/3/6) — admin narx jadvalida
  // boshqa kunlar bo'lsa ham, ular iOS'da sotilmaydi.
  const days = Math.round(Number(body?.days));
  const productId = PRODUCT_BY_DAYS.get(days);
  if (!productId) return [{ error: 'bad_package' }, 422];
  await ensureBoostSchema(env);
  // Sotuv ochiqmi (1000 foydalanuvchi / 48 soatlik ustuvor oyna) — sayt bilan bir xil shart.
  const gate = await salesGate(env, H, user.id);
  if (gate) return gate;

  const now = Date.now();
  const holdUntil = now + HOLD_MS;
  // BIR ODAM — BITTA AMAL QILAYOTGAN USHLAB TURISH (ko'rik F2).
  //   * o'sha post + o'sha kunlar (Apple oynasini yopib, qayta bosdi) —
  //     o'sha intent QAYTADI, muddati UZAYTIRILMAYDI (created_at + 20 daqiqa);
  //   * boshqa post yoki boshqa kunlar — eskisi bekor, yangisi yaratiladi
  //     (`days` hech qachon o'zgartirilmaydi — ko'rik F1).
  const own = await env.DB.prepare(
    `SELECT id, target_kind, target_id, days, ends_at FROM featured_slots
      WHERE user_id = ? AND status = 'pending' AND source = 'apple' AND ends_at > ?`
  ).bind(user.id, H.nowTs()).all();
  const live = own?.results || [];
  const same = live.find((r) => String(r.target_kind) === t.kind && Number(r.target_id) === t.targetId && Number(r.days) === days);
  if (same) {
    return [{ intentId: Number(same.id), productId, days, holdUntil: tsMs(same.ends_at) || holdUntil }, 201];
  }
  if (await H.rateLimitD1(env, `iap_apple_intent:${user.id}`, INTENT_RATE_LIMIT, INTENT_RATE_WINDOW_MS)) {
    return [{ error: 'too_many_requests' }, 429];
  }
  for (const r of live) {
    await env.DB.prepare(`UPDATE featured_slots SET status = 'cancelled' WHERE id = ? AND status = 'pending'`).bind(Number(r.id)).run();
  }
  const checked = await checkPromoTarget(env, H, user.id, t.kind, t.targetId, { apple: true });
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
    // Slotning HOZIRGI holati ham (active | expired | stopped) — ko'rik F6.
    if (slot) return [{ boost: 'active', slot: { ...slotBrief(slot, H), status: String(slot.status || '') } }, 200];
  }
  if (row.credit_id) {
    const c = await env.DB.prepare(`SELECT id, days FROM iap_apple_boost_credits WHERE id = ?`).bind(Number(row.credit_id)).first();
    if (c) return [{ boost: 'credited', creditId: Number(c.id), days: Number(c.days) }, 200];
  }
  return [{ error: 'in_progress' }, 409];
}

const isUnique = (e) => /UNIQUE|constraint/i.test(String(e?.message || e));

// Slot yoki kredit — DA'VO QILGAN so'rovgina chaqiradi. Natija DOIM slot
// yoki kredit (ko'rik F1): pul olingan tranzaksiya hech qachon rad etilmaydi.
async function fulfil(env, H, user, tx, intent) {
  const done = await outcomeByTx(env, tx.transactionId);
  if (done) return done;
  const nowTs = H.nowTs();
  if (intent) {
    // a) Amal qilayotgan ushlab turish. Sayt (Payme/Click) joylarni
    // ushlab turishni sanamaydi — shuning uchun yoqishdan oldin umumiy
    // sig'im va shu postning boshqa faol sloti tekshiriladi; joy bo'lmasa — kredit.
    const [cap, other] = await Promise.all([
      env.DB.prepare(`SELECT COUNT(*) AS n FROM featured_slots WHERE status = 'active' AND ends_at > ?`).bind(nowTs).first(),
      env.DB.prepare(`SELECT id FROM featured_slots WHERE target_kind = ? AND target_id = ? AND status = 'active' AND id != ?`)
        .bind(String(intent.target_kind), Number(intent.target_id), Number(intent.id)).first(),
    ]);
    const room = (Number(cap?.n) || 0) < MAX_ACTIVE_TOTAL && !other;
    if (room) {
      const startMs = Date.now();
      try {
        // Kunlar — TO'LANGAN mahsulotdan (tx.days), intentdagi emas.
        const res = await env.DB.prepare(
          `UPDATE featured_slots SET status = 'active', days = ?, starts_at = ?, ends_at = ?, apple_transaction_id = ?
            WHERE id = ? AND user_id = ? AND status = 'pending' AND source = 'apple' AND ends_at > ?`
        ).bind(tx.days, dbTs(startMs), dbTs(startMs + tx.days * DAY_MS), tx.transactionId, Number(intent.id), user.id, nowTs).run();
        if (changed(res)) return { slotId: Number(intent.id) };
      } catch (e) {
        if (isUnique(e)) { const o = await outcomeByTx(env, tx.transactionId); if (o) return o; }
        throw e;
      }
      // b) Ushlab turish tugagan/bekor — joy bo'lsa, o'sha kontent uchun yangidan.
      await env.DB.prepare(`UPDATE featured_slots SET status = 'cancelled' WHERE id = ? AND status = 'pending' AND source = 'apple'`)
        .bind(Number(intent.id)).run();
      const checked = await checkPromoTarget(env, H, user.id, String(intent.target_kind), Number(intent.target_id), { apple: true });
      if (!checked.error) {
        try {
          const row = await insertActiveSlot(env, H, {
            userId: user.id, kind: String(intent.target_kind), targetId: Number(intent.target_id),
            code: checked.target.ownerCode, days: tx.days, txid: tx.transactionId,
          });
          if (row?.id) return { slotId: Number(row.id) };
        } catch (e) {
          if (isUnique(e)) { const o = await outcomeByTx(env, tx.transactionId); if (o) return o; }
          throw e;
        }
      }
    } else {
      // Joy yo'q — ushlab turish bo'shatiladi, xarid kreditga.
      await env.DB.prepare(`UPDATE featured_slots SET status = 'cancelled' WHERE id = ? AND status = 'pending' AND source = 'apple'`)
        .bind(Number(intent.id)).run();
    }
  }
  // c) KREDIT — to'langan tranzaksiya hech qachon yo'qolmaydi. Yozishdan
  // oldin yana bir bor: shu tranzaksiyaga slot paydo bo'lmaganmi (ko'rik F5).
  const again = await outcomeByTx(env, tx.transactionId);
  if (again) return again;
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

  // INTENT — hech qachon xato EMAS (ko'rik F1): pul olingan. Begona yoki
  // yaroqsiz intent e'tiborsiz qoldiriladi; o'rniga odamning O'Z amal
  // qilayotgan ushlab turishi (bo'lsa) olinadi; kunlar mos kelmasa ham
  // to'langan kunlar (tx.days) bilan yoqiladi; aks holda — kredit.
  let intent = null;
  if (intentId !== null) {
    const s = await env.DB.prepare(`SELECT * FROM featured_slots WHERE id = ?`).bind(intentId).first();
    if (s && s.source === 'apple' && Number(s.user_id) === Number(user.id)) intent = s;
  }
  if (!intent) {
    intent = await env.DB.prepare(
      `SELECT * FROM featured_slots WHERE user_id = ? AND status = 'pending' AND source = 'apple' AND ends_at > ?
        ORDER BY id DESC LIMIT 1`
    ).bind(user.id, H.nowTs()).first() || null;
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

// ═══ REFUND_REVERSED — TIKLASH (ko'rik F6) ═══
// Pul qaytarish bekor qilindi: refund paytida to'xtatilgan slot qolgan
// muddati bilan qayta yonadi (hozir + qolgan vaqt); bekor qilingan
// ishlatilmagan kredit qaytadi; daftardan `revoked_at` olinadi (noma'lum
// tranzaksiyaning `revoked` qatori o'chiriladi — keyin verify ishlaydi).
export async function restoreBoost(env, tx) {
  await ensureBoostSchema(env);
  const row = await ledgerRow(env, tx.transactionId);
  if (!row?.revoked_at) return 'nothing';
  const refundMs = Date.parse(row.revoked_at);
  let outcome = 'nothing';
  const slots = await env.DB.prepare(
    `SELECT * FROM featured_slots WHERE apple_transaction_id = ? AND status = 'stopped' AND stopped_reason = 'apple_refund'`
  ).bind(tx.transactionId).all();
  for (const sl of slots?.results || []) {
    const endMs = tsMs(sl.ends_at);
    const remaining = Number.isFinite(endMs) && Number.isFinite(refundMs) ? endMs - refundMs : 0;
    if (remaining > 0) {
      await env.DB.prepare(`UPDATE featured_slots SET status = 'active', ends_at = ?, stopped_reason = NULL WHERE id = ? AND status = 'stopped'`)
        .bind(dbTs(Date.now() + remaining), Number(sl.id)).run();
      outcome = 'slot_restored';
    }
  }
  const cr = await env.DB.prepare(`UPDATE iap_apple_boost_credits SET revoked_at = NULL
      WHERE transaction_id = ? AND used_at IS NULL AND revoked_at IS NOT NULL`).bind(tx.transactionId).run();
  if (changed(cr) && outcome === 'nothing') outcome = 'credit_restored';
  if (row.state === 'revoked') {
    await env.DB.prepare(`DELETE FROM iap_apple_boost_transactions WHERE transaction_id = ? AND state = 'revoked'`).bind(tx.transactionId).run();
  } else {
    await env.DB.prepare(`UPDATE iap_apple_boost_transactions SET revoked_at = NULL, updated_at = ? WHERE transaction_id = ?`)
      .bind(new Date().toISOString(), tx.transactionId).run();
  }
  return outcome;
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
  const checked = await checkPromoTarget(env, H, user.id, t.kind, t.targetId, { apple: true });
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
  // Shu orada REFUND kelgan bo'lsa — slot darhol to'xtatiladi (ko'rik F4).
  const after = await env.DB.prepare(`SELECT revoked_at FROM iap_apple_boost_credits WHERE id = ?`).bind(creditId).first();
  if (after?.revoked_at) {
    await stopSlot(env, Number(row.id), 'apple_refund');
    return [{ error: 'credit_revoked' }, 409];
  }
  return [{ boost: 'active', slot: slotBrief(row, H) }, 200];
}
