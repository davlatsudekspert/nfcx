// hosting/api/featured.js — NFCSTORE FEATURED: pullik ko'tarilgan slotlar.
//
// NIMA UCHUN BOR. Ilovaning bosh sahifasida yuqorida ikkita namuna
// karta turardi — ular qo'lda yozilgan demo edi. Biznes esa o'z
// postini pul evaziga o'sha joyga qo'ya olishi kerak: bu ilovaning
// birinchi haqiqiy daromad yo'li.
//
// ── PARALLEL TIZIM YARATILMAYDI ──────────────────────────────────
//
// To'lov UCHUN YANGI HECH NARSA YOZILMADI. Sayt allaqachon
// `web_orders` jadvali + Payme/Click orqali pul oladi, va
// `finalizePaidWebOrderD1()` — to'langan buyurtmani bajaradigan
// YAGONA nuqta. FEATURED shu yerga `kind = 'featured_slot'`
// tarmog'i bo'lib qo'shiladi, xuddi `premium_upgrade` va
// `physical_card_order` kabi.
//
// Shuning oqibati eng muhim: SLOT FAQAT HAQIQIY TO'LOVDAN KEYIN
// YONADI. Mijozning so'rovi hech qachon slotni faollashtirmaydi —
// u faqat "kutilmoqda" holatidagi buyurtma ochadi. Faollashtirish
// Payme/Click callback'i tasdiqlagandan keyin, serverda bo'ladi.
//
// ── NARX SERVERDA ────────────────────────────────────────────────
//
// Mijoz narxni YUBORMAYDI, faqat KUNLAR SONINI tanlaydi. Narx shu
// yerda hisoblanadi. Aks holda so'rovni qo'lda yuborgan odam
// 6 kunlik slotni 1 so'mga olardi.
//
// Marshrutlar:
//   GET  /api/featured/packages          → { packages, enabled, capacity }
//   GET  /api/featured                   → { slots }   (ommaviy, lenta uchun)
//   GET  /api/featured/mine              (auth) → { slots[+stats{reach,views}] }
//   POST /api/featured                   (auth) { targetKind, targetId, days }
//                                        → 201 { slot, orderId, price, payLinks }
//   POST /api/featured/:id/cancel        (auth) → { ok }
//
//   GET  /api/admin/featured             (admin) ?state= → { slots }
//   POST /api/admin/featured             (manager+) { targetKind, targetId, days, note }
//                                        → 201 { slot }  (qo'lda, to'lovsiz)
//   POST /api/admin/featured/pricing     (super_admin) { packages:[{days,price}] }
//   POST /api/admin/featured/:id/stop    (admin) { reason } → { ok }
//
// iOS (2026-10): xuddi shu slotlar Apple In-App Purchase (consumable)
// bilan ham sotiladi — `api/iap-apple-boost.js`. U bu yerdagi
// tekshiruvlarni (`checkPromoTarget`), sig'imni (`capacityOf`) va
// to'xtatishni (`stopSlot`) QAYTA ISHLATADI — ikkinchi nusxa yo'q.
// Apple "ushlab turish"i: `status = 'pending'`, `source = 'apple'`,
// `ends_at` = ushlab turish tugashi (20 daqiqa). Sayt (Payme/Click)
// kutilayotgan slotida `ends_at` BO'SH. Ushlab turish faqat boshqa
// APPLE intentlariga joy egallaydi; sayt uchun sig'im, chegara va takror
// tekshiruvi avvalgidek (`checkPromoTarget(..., { apple })`, ko'rik F2).

import { targetOwner } from './comments.js';
import { ensureSchema as ensureNotifications } from './notifications.js';

// ═══ SOTUV 1000 FOYDALANUVCHIDA OCHILADI (egasi, 2026-10-06) ═══
//
// Platformada 1000 ta foydalanuvchi bo'lguncha ko'tarishni hech kim
// SOTIB OLA OLMAYDI (sayt Payme/Click ham, iOS Apple ham): auditoriya
// kichik paytda pul olish — "ko'rsatmay pul olish" bo'lardi. O'rniga
// biznes BEPUL NAVBATGA yoziladi (`featured_waitlist`) va ochilganda
// birinchi bo'lib oladi.
//
//   * Rejim — `admin_settings.featured_sales_open`: 'auto' (standart) |
//     'open' | 'closed' (super_admin, POST /api/admin/featured/sales).
//   * 'auto': o'chirilmagan foydalanuvchilar soni ≥ FEATURED_OPEN_AT_USERS
//     bo'lsa ochiladi. Birinchi ochilish payti `featured_sales_opened_at`
//     ga yoziladi va keyin soni kamaysa ham QAYTA YOPILMAYDI.
//   * Ochilgandan keyin 48 soat — USTUVOR OYNA: faqat navbatdagilar
//     sotib oladi, boshqalar 409 `priority_window` (+ `endsAt`).
//   * Ochilganda navbatdagilarga bitta ilova ichidagi bildirishnoma
//     (`featured_open`, aktyorsiz) — `notified_at` bilan bir marta;
//     birinchi so'rovda yoki kunlik cron'da (`featuredSalesTick`).
//   * Admin qo'lda ko'tarishi (POST /api/admin/featured) — doim ishlaydi.
//   * Foydalanuvchilar soni isolate'da 5 daqiqa keshlanadi.
// Tekshiruv xatolari (egalik, takror, sig'im) sotuv yopiq bo'lsa ham
// avvalgidek qaytadi — shart faqat slot YARATILISHIDAN oldin.
export const FEATURED_OPEN_AT_USERS = 1000;
export const PRIORITY_WINDOW_MS = 48 * 60 * 60 * 1000;
const USERS_COUNT_TTL_MS = 5 * 60 * 1000;
const SALES_MODES = ['auto', 'open', 'closed'];
const usersCountCache = {};
export function __resetFeaturedSalesCache() { for (const k of Object.keys(usersCountCache)) delete usersCountCache[k]; }

async function usersCountOf(env, now) {
  const key = env.UZ_STORE_ACTIVE ? 'uz' : 'd1';
  const c = usersCountCache[key];
  if (c && now - c.at < USERS_COUNT_TTL_MS) return c.n;
  const row = await env.DB.prepare(`SELECT COUNT(*) AS n FROM users WHERE deleted_at IS NULL`).first().catch(() => null);
  const n = Number(row?.n) || 0;
  usersCountCache[key] = { at: now, n };
  return n;
}

async function ensureWaitlistSchema(env) {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS featured_waitlist (
    user_id INTEGER PRIMARY KEY NOT NULL,
    target_kind TEXT,
    target_id INTEGER,
    created_at TEXT NOT NULL,
    notified_at TEXT
  )`).run();
}

/// NAVBATDAGILARGA "SOTUV OCHILDI" — bir marta (`notified_at`).
/// Aktyor NULL: takror `NOT EXISTS` bilan to'siladi (notifications.js
/// `runTrialEndingReminders` izohi). Ochilgandan KEYIN yozilganlar
/// (`created_at > openedAt`) xabar olmaydi — ular buni allaqachon biladi.
export async function notifyWaitlist(env, H, openedAtIso) {
  await ensureWaitlistSchema(env);
  await ensureNotifications(env);
  const now = H.nowTs();
  const res = await env.DB.prepare(
    `INSERT INTO notifications (recipient_user_id, actor_user_id, kind, target_type, target_id, target_code, created_at)
     SELECT w.user_id, NULL, 'featured_open', 'featured', '', '', ?
       FROM featured_waitlist w JOIN users u ON u.id = w.user_id
      WHERE w.notified_at IS NULL AND u.deleted_at IS NULL AND w.created_at <= ?
        AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.recipient_user_id = w.user_id AND n.kind = 'featured_open')`
  ).bind(now, openedAtIso).run();
  await env.DB.prepare(
    `UPDATE featured_waitlist SET notified_at = ?
      WHERE notified_at IS NULL AND (created_at > ? OR EXISTS (SELECT 1 FROM notifications n
        WHERE n.recipient_user_id = featured_waitlist.user_id AND n.kind = 'featured_open'))`
  ).bind(new Date().toISOString(), openedAtIso).run();
  return Number(res?.meta?.changes || 0);
}

/// SOTUV HOLATI: { open, mode, usersCount, openAt, openedAt, priorityUntil }.
/// Birinchi ochilishni (auto yoki admin 'open') shu yerda qayd qiladi va
/// navbatdagilarga xabar yuboradi.
export async function salesState(env, H, { now = Date.now() } = {}) {
  const rows = await env.DB.prepare(
    `SELECT key, value FROM admin_settings WHERE key IN ('featured_sales_open', 'featured_sales_opened_at')`
  ).all().catch(() => null);
  const map = new Map((rows?.results || []).map((r) => [String(r.key), r.value]));
  const rawMode = String(map.get('featured_sales_open') || 'auto');
  const mode = SALES_MODES.includes(rawMode) ? rawMode : 'auto';
  let openedAt = map.get('featured_sales_opened_at') || null;
  const usersCount = await usersCountOf(env, now);
  let open = false;
  if (mode === 'open') open = true;
  else if (mode === 'auto') open = !!openedAt || usersCount >= FEATURED_OPEN_AT_USERS;
  if (open && !openedAt) {
    const iso = new Date(now).toISOString();
    const ins = await env.DB.prepare(
      `INSERT OR IGNORE INTO admin_settings (key, value) VALUES ('featured_sales_opened_at', ?)`
    ).bind(iso).run();
    if (Number(ins?.meta?.changes || 0) > 0) {
      openedAt = iso;
      await notifyWaitlist(env, H, iso).catch((e) => console.error('featured_open notify', e?.message));
    } else {
      const r = await env.DB.prepare(`SELECT value FROM admin_settings WHERE key = 'featured_sales_opened_at'`).first().catch(() => null);
      openedAt = r?.value || iso;
    }
  }
  const openedMs = openedAt ? Date.parse(openedAt) : NaN;
  const priorityUntil = open && Number.isFinite(openedMs) && now < openedMs + PRIORITY_WINDOW_MS ? openedMs + PRIORITY_WINDOW_MS : null;
  return { open, mode, usersCount, openAt: FEATURED_OPEN_AT_USERS, openedAt, priorityUntil };
}

// `beforeIso` berilsa — faqat shu paytgacha (ochilishgacha) yozilganlar.
// Ochilish paytida yoki keyin yozilgan odam ustuvorlik OLMAYDI (ko'rik F3).
async function onWaitlist(env, userId, beforeIso = null) {
  if (!userId) return false;
  const row = await env.DB.prepare(
    `SELECT 1 AS x FROM featured_waitlist WHERE user_id = ?${beforeIso ? ' AND created_at <= ?' : ''}`
  ).bind(...(beforeIso ? [userId, beforeIso] : [userId])).first().catch(() => null);
  return !!row;
}

/// SOTIB OLISH MUMKINMI — sayt va Apple yo'li uchun bitta shart.
/// `null` — mumkin; aks holda `[body, status]`.
export async function salesGate(env, H, userId) {
  const st = await salesState(env, H);
  if (!st.open) return [{ error: 'sales_not_open', usersCount: st.usersCount, openAt: st.openAt }, 409];
  if (st.priorityUntil) {
    await ensureWaitlistSchema(env);
    if (!(await onWaitlist(env, userId, st.openedAt))) return [{ error: 'priority_window', endsAt: st.priorityUntil }, 409];
  }
  return null;
}

/// KUNLIK CRON (worker.js `scheduled`): ochilishni aniqlaydi va xabar
/// olmagan navbatdagilarga yuboradi. Xatoni o'zi yutadi.
export async function featuredSalesTick(env, H) {
  try {
    const st = await salesState(env, H);
    if (!st.open || !st.openedAt) return { open: st.open, notified: 0 };
    return { open: true, notified: await notifyWaitlist(env, H, st.openedAt) };
  } catch (e) {
    console.error('featured_sales_tick', String(e?.message || e).slice(0, 160));
    return { error: true };
  }
}

/// STANDART NARXLAR — so'mda.
///
/// Admin ularni `admin_settings` dagi `featured_pricing` kaliti
/// bilan almashtira oladi (jismoniy karta narxi bilan AYNAN bir
/// xil naqsh). Bu yerdagi qiymatlar — sozlama bo'lmaganda.
const DEFAULT_PACKAGES = [
  { days: 1, price: 29000 },
  { days: 3, price: 69000 },
  { days: 6, price: 119000 },
];

/// Bir foydalanuvchi bir vaqtda nechta FAOL slot ushlab tura oladi.
///
/// Cheklovsiz bo'lsa, bitta odam butun bosh sahifani sotib olib,
/// lenta boshqa hech kimga ko'rinmay qolardi.
export const MAX_ACTIVE_PER_USER = 3;

/// LENTADAGI JAMI JOYLAR (egasi, 2026-10-05: "u yerga nechta sig'adi").
///
/// Ilgari sotuv cheklanmagan, lenta esa faqat 10 ta eng yangisini
/// ko'rsatardi: 11-biznes pul to'lab, umuman ko'rinmay qolardi.
/// Endi faol reklamalar soni shu bilan cheklanadi, lentada ular
/// almashib (rotatsiya) ko'rsatiladi — har bir ochilishda
/// `FEED_AD_SLOTS` tasi, oddiy postlar orasida (worker.js `feedApi`).
/// 8 ta joy / 4 ta o'rin → har bir reklama lenta ochilishlarining
/// kamida yarmida chiqadi. Band bo'lsa, xaridor qachon bo'shashini
/// ko'radi (`sold_out` + `nextFreeAt`).
export const MAX_ACTIVE_TOTAL = 8;

/// Faqat POSTLAR ko'tariladi (oddiy va biznes). Istoriyalar lentada
/// chiqmaydi — ularni sotish "pul olib, ko'rsatmaslik" bo'lardi.
export const PROMO_KINDS = ['post', 'company_post'];

export const DAY_MS = 24 * 60 * 60 * 1000;

/// APPLE USHLAB TURISHI FAQAT BOSHQA APPLE INTENTLARIGA TA'SIR QILADI
/// (ko'rik F2): sayt (Payme/Click) uchun sig'im, foydalanuvchi chegarasi
/// va takror tekshiruvi AYNAN avvalgidek — faqat faol slotlar va sayt
/// kutilayotgan slotlari (`ends_at` bo'sh). Apple intenti esa amal
/// qilayotgan ushlab turishlarni (`pending` + `ends_at > hozir`) ham sanaydi.
/// To'langan Apple xaridi uchun joy qolmagan bo'lsa — KREDIT.
const HOLDS_SEAT_SQL = `(status = 'active' OR (status = 'pending' AND ends_at > ?))`;
const BLOCKS_TARGET_SQL = `(status = 'active' OR (status = 'pending' AND (ends_at IS NULL OR ends_at > ?)))`;
const WEB_BLOCKS_TARGET_SQL = `(status = 'active' OR (status = 'pending' AND ends_at IS NULL))`;

let schemaReady = null;

export async function ensureSchema(env) {
  if (!schemaReady) {
    schemaReady = env.DB.batch([
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS "featured_slots" (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        target_kind TEXT NOT NULL,
        target_id INTEGER NOT NULL,
        code TEXT NOT NULL DEFAULT '',
        days INTEGER NOT NULL,
        price INTEGER NOT NULL,
        order_id INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'pending',
        starts_at TEXT,
        ends_at TEXT,
        stopped_reason TEXT,
        created_at TEXT NOT NULL
      )`),
      // Lenta so'rovi: "hozir faol slotlar". Eng tez-tez ishlatiladi.
      env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_featured_active
        ON featured_slots(status, ends_at)`),
      env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_featured_user
        ON featured_slots(user_id, created_at DESC)`),
      // To'lov tasdiqlanganda buyurtma bo'yicha slot topiladi.
      env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_featured_order
        ON featured_slots(order_id)`),
    ]).catch(() => {});
  }
  await schemaReady;
}

/// NARXLAR JADVALI — admin sozlamasi bilan.
///
/// Buzuq sozlama standartni YIQITMAYDI: noto'g'ri JSON yoki
/// mantiqsiz qiymat kelsa, standart qaytadi. Aks holda bitta
/// xato tahrir butun sotuvni to'xtatardi.
export async function packagesOf(env) {
  const row = await env.DB.prepare(
    `SELECT value FROM admin_settings WHERE key = 'featured_pricing'`
  ).first().catch(() => null);
  if (!row?.value) return DEFAULT_PACKAGES;
  try {
    const parsed = JSON.parse(row.value);
    if (!Array.isArray(parsed) || !parsed.length) return DEFAULT_PACKAGES;
    const clean = parsed
      .map((p) => ({ days: Math.round(Number(p.days)), price: Math.round(Number(p.price)) }))
      .filter((p) => Number.isFinite(p.days) && p.days > 0 && p.days <= 30
        && Number.isFinite(p.price) && p.price > 0);
    return clean.length ? clean : DEFAULT_PACKAGES;
  } catch {
    return DEFAULT_PACKAGES;
  }
}

export const slotOut = (r, H) => {
  const ms = (v) => {
    const d = H.parseDbDate(v);
    return d && !Number.isNaN(d.getTime()) ? d.getTime() : null;
  };
  return {
    id: Number(r.id),
    targetKind: String(r.target_kind),
    targetId: Number(r.target_id),
    code: String(r.code || '').toUpperCase(),
    days: Number(r.days) || 0,
    price: Number(r.price) || 0,
    status: String(r.status || ''),
    startsAt: ms(r.starts_at),
    endsAt: ms(r.ends_at),
    createdAt: ms(r.created_at),
  };
};

/// BO'SH JOYLAR: { max, active, nextFreeAt } — nextFreeAt eng yaqin
/// tugaydigan faol reklama vaqti (ms), joy bo'sh bo'lsa null.
/// `includeHolds` — faqat Apple intenti uchun: amal qilayotgan ushlab
/// turishlar ham sanaladi. Sayt uchun (standart) — avvalgidek, faqat faol.
export async function capacityOf(env, H, { includeHolds = false } = {}) {
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS n, MIN(ends_at) AS next FROM featured_slots
      WHERE ${includeHolds ? `status IN ('active', 'pending')` : `status = 'active'`} AND ends_at > ?`
  ).bind(H.nowTs()).first().catch(() => null);
  const active = Number(row?.n) || 0;
  const d = row?.next ? H.parseDbDate(row.next) : null;
  return {
    max: MAX_ACTIVE_TOTAL,
    active,
    nextFreeAt: active >= MAX_ACTIVE_TOTAL && d && !Number.isNaN(d.getTime()) ? d.getTime() : null,
  };
}

/// REKLAMA NATIJASI — egasi pulining samarasini ko'radi.
///
/// Instagram'da natija alohida "reklama kabineti"da; bizda shu
/// sahifaning o'zida. Ikki son, ikkalasi mavjud ko'rish jadvallaridan
/// (yangi hisoblagich YO'Q, ilova hech narsa qo'shimcha yubormaydi):
///   reach — ko'tarilgan davrda postni BIRINCHI MARTA ko'rgan odamlar
///           (`content_views.created_at` — birinchi ko'rish vaqti);
///   views — shu kunlardagi jami ko'rishlar (`content_view_hits`,
///           kun aniqligida: boshlanish kunining ertalabki ko'rishlari
///           ham kiradi — sahifada "taxminan" deyilmaydi, chunki farq
///           kichik va faqat birinchi kunga tegishli).
/// So'rovlar parallel (UZ adapterida bitta to'lqinga yig'iladi); slotlar
/// soni 50 dan oshmaydi.
async function slotStats(env, H, rows) {
  const out = new Map();
  const started = rows.filter((r) => r.starts_at && ['active', 'expired', 'stopped'].includes(String(r.status)));
  if (!started.length) return out;
  const now = H.nowTs();
  const stmts = [];
  for (const r of started) {
    const end = r.ends_at && String(r.ends_at) < now ? String(r.ends_at) : now;
    stmts.push(env.DB.prepare(
      `SELECT
         (SELECT COUNT(*) FROM content_views
           WHERE target_kind = ? AND target_id = ? AND created_at >= ? AND created_at < ?) AS reach,
         (SELECT COALESCE(SUM(hits), 0) FROM content_view_hits
           WHERE target_kind = ? AND target_id = ? AND day >= ? AND day <= ?) AS views`
    ).bind(String(r.target_kind), Number(r.target_id), String(r.starts_at), end,
      String(r.target_kind), Number(r.target_id), String(r.starts_at).slice(0, 10), end.slice(0, 10)));
  }
  const res = await Promise.all(stmts.map((st) => st.first().catch(() => null)));
  started.forEach((r, i) => {
    const row = res[i] || {};
    out.set(Number(r.id), { reach: Number(row.reach) || 0, views: Number(row.views) || 0 });
  });
  return out;
}

/// MUDDATI O'TGAN SLOTLARNI BELGILASH.
///
/// Alohida cron YO'Q (Worker'da u qo'shimcha infratuzilma degani).
/// O'rniga har bir o'qishda muddati o'tganlar belgilanadi. Lenta
/// so'rovining O'ZI ham `ends_at > now` bo'yicha filtrlaydi —
/// ya'ni bu yozuv kechikkan taqdirda ham mijozga eskirgan slot
/// KO'RINMAYDI. Belgilash faqat hisobot va admin ro'yxati uchun.
///
/// Muddati o'tgan Apple ushlab turishi (`pending` + `ends_at`) shu
/// so'rovning o'zida `cancelled` bo'ladi (sayt kutilayotgan slotida
/// `ends_at` bo'sh — unga tegmaydi).
export async function sweepExpired(env, H) {
  await env.DB.prepare(
    `UPDATE featured_slots SET status = CASE WHEN status = 'active' THEN 'expired' ELSE 'cancelled' END
      WHERE status IN ('active', 'pending') AND ends_at IS NOT NULL AND ends_at <= ?`
  ).bind(H.nowTs()).run().catch(() => {});
}

/// KO'TARISH MUMKINMI — sayt (POST /api/featured) va Apple
/// (api/iap-apple-boost.js) uchun BITTA tekshiruv, aynan shu tartibda:
/// not_found → forbidden → post_scheduled → already_featured →
/// too_many_active → sold_out. Qaytaradi: `{ target }` yoki
/// `{ error: [body, status] }`.
export async function checkPromoTarget(env, H, userId, kind, targetId, { apple = false } = {}) {
  // EGALIK — SERVERDA. Aks holda istalgan odam begona postni
  // ko'tarib, uni bosh sahifaga chiqarardi.
  const target = await targetOwner(env, kind, targetId);
  if (!target.ok) return { error: [{ error: 'not_found' }, 404] };
  if (Number(target.ownerUserId) !== Number(userId)) {
    return { error: [{ error: 'forbidden' }, 403] };
  }
  // REJADAGI POST (api/scheduled-posts.js) ko'tarilmaydi: lenta uni
  // vaqti kelguncha baribir ko'rsatmaydi — pul olinib, kunlar bekorga
  // o'tib ketardi.
  if (target.scheduled) return { error: [{ error: 'post_scheduled' }, 409] };

  // Bitta kontent uchun ikkita kutilayotgan buyurtma bo'lmasin —
  // odam ikki marta bosib, ikki marta to'lab qo'ymasin.
  const now = H.nowTs();
  const dup = await env.DB.prepare(
    `SELECT id FROM featured_slots
      WHERE target_kind = ? AND target_id = ? AND ${apple ? BLOCKS_TARGET_SQL : WEB_BLOCKS_TARGET_SQL}`
  ).bind(...(apple ? [kind, targetId, now] : [kind, targetId])).first().catch(() => null);
  if (dup) return { error: [{ error: 'already_featured', slotId: Number(dup.id) }, 409] };

  const activeRow = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM featured_slots WHERE user_id = ? AND ${apple ? HOLDS_SEAT_SQL : `status = 'active'`}`
  ).bind(...(apple ? [userId, now] : [userId])).first().catch(() => null);
  if ((Number(activeRow?.n) || 0) >= MAX_ACTIVE_PER_USER) {
    return { error: [{ error: 'too_many_active', max: MAX_ACTIVE_PER_USER }, 409] };
  }
  const cap = await capacityOf(env, H, { includeHolds: apple });
  if (cap.active >= cap.max) return { error: [{ error: 'sold_out', ...cap }, 409] };
  return { target };
}

/// SLOTNI TO'XTATISH — admin "stop" va Apple REFUND/REVOKE uchun bitta yo'l.
/// Faqat kutilayotgan yoki faol slot; qaytaradi: to'xtatildimi.
export async function stopSlot(env, slotId, reason) {
  const res = await env.DB.prepare(
    `UPDATE featured_slots SET status = 'stopped', stopped_reason = ?
      WHERE id = ? AND status IN ('pending', 'active')`
  ).bind(String(reason), Number(slotId)).run();
  return Number(res?.meta?.changes || 0) > 0;
}

/// HOZIR KO'TARILGAN KONTENT — lenta uchun.
///
/// `worker.js` dagi `feedApi` shu ro'yxatni oladi va kontentni
/// O'ZINING UNIONIDAN chiqaradi. Bu yerda kontentga tegilmaydi:
/// aks holda maxfiylik va bloklash shartlarining IKKINCHI nusxasi
/// paydo bo'lardi — va u eskirib, pul to'langan e'lon yashiringan
/// profilni ochib qo'yishi mumkin edi.
///
/// `ends_at > now` sharti — muddati o'tganni belgilash kechiksa
/// ham eskirgan slot chiqmasligi uchun.
export async function activeTargets(env, nowTs) {
  // Sxema va SELECT bitta to'lqinda (moderation.js `blockedByUser` izohi).
  const ready = ensureSchema(env);
  const rows = await env.DB.prepare(
    `SELECT target_kind, target_id FROM featured_slots
      WHERE status = 'active' AND ends_at > ?
      ORDER BY starts_at DESC, id DESC LIMIT ${MAX_ACTIVE_TOTAL * 2}`
  ).bind(nowTs).all().catch(() => null);
  await ready;
  return (rows?.results || []).map((r) => ({
    kind: String(r.target_kind),
    id: Number(r.target_id),
  }));
}

/// TO'LANGAN BUYURTMA SLOTNI YOQADI.
///
/// `worker.js` dagi `finalizePaidWebOrderD1()` shu yerga keladi.
/// Boshqa hech bir yo'l slotni `active` qila olmaydi — mijozning
/// so'rovi ham, admin paneli ham.
///
/// IDEMPOTENT: Payme takroriy `PerformTransaction` yuborishi
/// mumkin. Allaqachon faol slot ikkinchi marta uzaytirilmaydi.
export async function activateFromOrder(env, H, order) {
  await ensureSchema(env);
  const slot = await env.DB.prepare(
    `SELECT * FROM featured_slots WHERE order_id = ?`
  ).bind(Number(order.id)).first().catch(() => null);
  if (!slot) return { ok: false, reason: 'slot_not_found' };
  if (String(slot.status) === 'active') return { ok: true, alreadyActive: true };
  if (String(slot.status) !== 'pending') return { ok: false, reason: 'slot_not_pending' };

  const startMs = Date.now();
  const endMs = startMs + Math.max(1, Number(slot.days) || 1) * DAY_MS;
  const iso = (ms) => new Date(ms).toISOString().replace('T', ' ').replace('Z', '+00');

  await env.DB.prepare(
    `UPDATE featured_slots SET status = 'active', starts_at = ?, ends_at = ? WHERE id = ?`
  ).bind(iso(startMs), iso(endMs), Number(slot.id)).run();
  return { ok: true };
}

export async function handle(request, env, url, H) {
  const path = url.pathname;
  const method = request.method;
  if (!path.startsWith('/api/featured') && !path.startsWith('/api/admin/featured')) return null;

  await ensureSchema(env);
  const readJson = async () => (await request.json().catch(() => ({}))) || {};

  // ── NARXLAR ──────────────────────────────────────────────────────
  if (path === '/api/featured/packages' && method === 'GET') {
    const user = await H.getCurrentUser(request, env).catch(() => null);
    const [packages, capacity, sales] = await Promise.all([packagesOf(env), capacityOf(env, H), salesState(env, H)]);
    let waitlisted = false;
    let priority = false;
    if (user) {
      await ensureWaitlistSchema(env);
      waitlisted = await onWaitlist(env, user.id);
      // Ustuvor oynada sotib olishi mumkinmi (ochilishgacha yozilgan).
      priority = !!sales.priorityUntil && await onWaitlist(env, user.id, sales.openedAt);
    }
    return H.json({
      packages,
      capacity,
      // To'lovlar butunlay o'chirilgan bo'lsa, ilova tugmani
      // ko'rsatmaydi — bosilgach 503 chiqishidan ko'ra yaxshiroq.
      enabled: H.paymentsEnabledD1(env),
      // Sotuv 1000 foydalanuvchida ochiladi (yuqoridagi izoh).
      salesOpen: sales.open,
      usersCount: sales.usersCount,
      openAt: sales.openAt,
      priorityUntil: sales.priorityUntil,
      waitlisted,
      priority,
    });
  }

  // ── BEPUL NAVBAT ─────────────────────────────────────────────────
  if (path === '/api/featured/waitlist' && (method === 'POST' || method === 'DELETE')) {
    const user = await H.getCurrentUser(request, env).catch(() => null);
    if (!user) return H.json({ error: 'unauthorized' }, 401);
    await ensureWaitlistSchema(env);
    if (method === 'DELETE') {
      await env.DB.prepare(`DELETE FROM featured_waitlist WHERE user_id = ?`).bind(user.id).run();
      return H.json({ waitlisted: false });
    }
    const body = await readJson();
    const kind = PROMO_KINDS.includes(String(body.targetKind || '')) ? String(body.targetKind) : null;
    const tid = Number(body.targetId);
    const targetId = kind && Number.isInteger(tid) && tid > 0 ? tid : null;
    const sales = await salesState(env, H);
    const nowIso = new Date().toISOString();
    // Ochilgandan keyin yozilgan — xabar kerak emas (u buni allaqachon biladi).
    await env.DB.prepare(
      `INSERT OR IGNORE INTO featured_waitlist (user_id, target_kind, target_id, created_at, notified_at) VALUES (?, ?, ?, ?, ?)`
    ).bind(user.id, kind, targetId, nowIso, sales.open ? nowIso : null).run();
    if (kind && targetId) {
      await env.DB.prepare(`UPDATE featured_waitlist SET target_kind = ?, target_id = ? WHERE user_id = ?`)
        .bind(kind, targetId, user.id).run();
    }
    return H.json({ waitlisted: true, salesOpen: sales.open });
  }

  // ── OMMAVIY: HOZIR KO'TARILGAN SLOTLAR ───────────────────────────
  if (path === '/api/featured' && method === 'GET') {
    await sweepExpired(env, H);
    const limit = Math.min(10, Math.max(1, Number(url.searchParams.get('limit')) || 5));
    // `ends_at > now` — belgilash kechiksa ham eskirgan slot
    // chiqmasligi uchun.
    const rows = await env.DB.prepare(
      `SELECT * FROM featured_slots
        WHERE status = 'active' AND ends_at > ?
        ORDER BY starts_at DESC, id DESC LIMIT ?`
    ).bind(H.nowTs(), limit).all().catch(() => null);
    return H.json({ slots: (rows?.results || []).map((r) => slotOut(r, H)) });
  }

  // ── MENING SLOTLARIM ─────────────────────────────────────────────
  if (path === '/api/featured/mine' && method === 'GET') {
    const user = await H.getCurrentUser(request, env).catch(() => null);
    if (!user) return H.json({ error: 'unauthorized' }, 401);
    await sweepExpired(env, H);
    const rows = await env.DB.prepare(
      `SELECT * FROM featured_slots WHERE user_id = ?
        ORDER BY created_at DESC, id DESC LIMIT 50`
    ).bind(user.id).all().catch(() => null);
    const list = rows?.results || [];
    const stats = await slotStats(env, H, list);
    return H.json({ slots: list.map((r) => ({ ...slotOut(r, H), stats: stats.get(Number(r.id)) || null })) });
  }

  // ── SLOT SOTIB OLISH ─────────────────────────────────────────────
  if (path === '/api/featured' && method === 'POST') {
    const user = await H.getCurrentUser(request, env).catch(() => null);
    if (!user) return H.json({ error: 'unauthorized' }, 401);
    if (user.bannedUntil) return H.json({ error: 'banned' }, 403);
    if (!H.paymentsEnabledD1(env)) return H.json({ error: 'payments_disabled' }, 503);

    const body = await readJson();
    const kind = String(body.targetKind || '');
    const targetId = Number(body.targetId);
    if (!PROMO_KINDS.includes(kind)) return H.json({ error: 'bad_kind' }, 422);
    if (!Number.isInteger(targetId) || targetId <= 0) return H.json({ error: 'bad_target' }, 422);

    // NARX SERVERDA. Mijoz faqat kunlar sonini tanlaydi; yuborgan
    // narxi (agar yuborsa) BUTUNLAY e'tiborsiz qoldiriladi.
    const packages = await packagesOf(env);
    const pack = packages.find((p) => p.days === Math.round(Number(body.days)));
    if (!pack) return H.json({ error: 'bad_package' }, 422);

    // Egalik, rejadagi post, takror, foydalanuvchi va umumiy sig'im —
    // `checkPromoTarget` (Apple yo'li ham aynan shuni ishlatadi).
    const checked = await checkPromoTarget(env, H, user.id, kind, targetId);
    if (checked.error) return H.json(...checked.error);
    const { target } = checked;
    // SOTUV OCHIQMI (1000 foydalanuvchi / ustuvor oyna) — slot yaratishdan oldin.
    const gate = await salesGate(env, H, user.id);
    if (gate) return H.json(...gate);

    const now = H.nowTs();
    const slot = await env.DB.prepare(
      `INSERT INTO featured_slots
         (user_id, target_kind, target_id, code, days, price, status, created_at)
       VALUES (?,?,?,?,?,?, 'pending', ?) RETURNING id`
    ).bind(user.id, kind, targetId, target.ownerCode || '', pack.days, pack.price, now).first();

    const slotId = Number(slot?.id) || 0;
    if (!slotId) return H.json({ error: 'slot_failed' }, 503);

    // BUYURTMA — mavjud `web_orders` tizimida.
    //
    // `createPendingWebOrderD1` ISHLATILMAYDI: u bitta `code` uchun
    // faqat bitta kutilayotgan buyurtmaga ruxsat beradi — bu NFC
    // kodini band qilish uchun to'g'ri, lekin bu yerda noto'g'ri
    // bo'lardi: odam bitta kartadan ikkita boshqa postni ko'tara
    // olishi kerak. Takrorlanishdan yuqoridagi `dup` tekshiruvi
    // himoya qiladi.
    const order = await H.createWebOrderD1(env, {
      userId: user.id,
      code: target.ownerCode || '',
      price: pack.price,
      kind: 'featured_slot',
      payload: { slotId, targetKind: kind, targetId, days: pack.days },
    });

    if (!order?.id) {
      // Buyurtma ochilmadi — slot ham qolmasin, aks holda odam
      // "kutilmoqda" yozuvini ko'rib, to'lay olmay yuraverardi.
      await env.DB.prepare(`DELETE FROM featured_slots WHERE id = ?`).bind(slotId).run().catch(() => {});
      return H.json({ error: 'order_failed' }, 503);
    }

    await env.DB.prepare(`UPDATE featured_slots SET order_id = ? WHERE id = ?`)
      .bind(Number(order.id), slotId).run();

    const row = await env.DB.prepare(`SELECT * FROM featured_slots WHERE id = ?`).bind(slotId).first();
    return H.json({
      slot: slotOut(row, H),
      orderId: Number(order.id),
      price: pack.price,
      // Havolada maxfiy narsa yo'q: merchant ID har bir checkout
      // manzilida ochiq turadi (`ordersApi` dagi izohga qarang).
      payLinks: H.checkoutLinksD1(env, Number(order.id), pack.price),
    }, 201);
  }

  // ── KUTILAYOTGAN SLOTNI BEKOR QILISH ─────────────────────────────
  const cancelMatch = path.match(/^\/api\/featured\/(\d+)\/cancel$/);
  if (cancelMatch && method === 'POST') {
    const user = await H.getCurrentUser(request, env).catch(() => null);
    if (!user) return H.json({ error: 'unauthorized' }, 401);
    const row = await env.DB.prepare(`SELECT * FROM featured_slots WHERE id = ?`)
      .bind(Number(cancelMatch[1])).first().catch(() => null);
    if (!row) return H.json({ error: 'not_found' }, 404);
    if (Number(row.user_id) !== Number(user.id)) return H.json({ error: 'forbidden' }, 403);
    // FAOL slot bekor qilinmaydi: pul olingan va e'lon ko'rsatilgan.
    // Pulni qaytarish — moliyaviy qaror, u admin qo'lida.
    if (String(row.status) !== 'pending') return H.json({ error: 'not_pending' }, 409);

    await env.DB.prepare(`UPDATE featured_slots SET status = 'cancelled' WHERE id = ?`)
      .bind(Number(row.id)).run();
    await env.DB.prepare(`UPDATE web_orders SET status = 'cancelled' WHERE id = ? AND status = 'pending'`)
      .bind(Number(row.order_id)).run().catch(() => {});
    return H.json({ ok: true });
  }

  // ── ADMIN ────────────────────────────────────────────────────────
  if (path.startsWith('/api/admin/featured')) {
    const admin = await H.requireAdmin(request, env);
    if (!admin) return H.json({ error: 'unauthorized' }, 401);
    await sweepExpired(env, H);

    if (path === '/api/admin/featured' && method === 'GET') {
      const state = String(url.searchParams.get('state') || 'all');
      const where = ['pending', 'active', 'expired', 'cancelled', 'stopped'].includes(state)
        ? `WHERE status = ?` : '';
      const args = where ? [state] : [];
      const rows = await env.DB.prepare(
        `SELECT * FROM featured_slots ${where} ORDER BY created_at DESC, id DESC LIMIT 200`
      ).bind(...args).all().catch(() => null);
      return H.json({
        slots: (rows?.results || []).map((r) => ({
          ...slotOut(r, H),
          userId: Number(r.user_id),
          orderId: Number(r.order_id) || 0,
          stoppedReason: String(r.stopped_reason || ''),
          note: String(r.note || ''),
          // Qayerdan: 'apple' (iOS In-App Purchase), 'web' (Payme/Click
          // buyurtmasi), 'admin' (qo'lda, buyurtmasiz). `source` ustuni
          // faqat Apple slotlarida to'ldiriladi (api/iap-apple-boost.js).
          source: r.source === 'apple' ? 'apple' : (Number(r.order_id) ? 'web' : 'admin'),
          appleTransactionId: r.apple_transaction_id ? String(r.apple_transaction_id) : null,
        })),
      });
    }

    // NARXLARNI O'ZGARTIRISH (egasi, 2026-10-05: "keyin summani
    // oshirsa bo'ladimi"). Ilova yangilanishi KERAK EMAS: narx har
    // safar serverdan o'qiladi. Faqat super_admin — bu moliyaviy
    // qaror. Allaqachon ochilgan buyurtmalar eski narxida qoladi
    // (narx slot va buyurtmaga yozilgan).
    if (path === '/api/admin/featured/pricing' && method === 'POST') {
      if (!H.roleAtLeast(admin, 'super_admin')) return H.json({ error: 'forbidden' }, 403);
      const body = await readJson();
      const list = Array.isArray(body.packages) ? body.packages : [];
      const clean = list.map((p) => ({ days: Math.round(Number(p?.days)), price: Math.round(Number(p?.price)) }));
      const ok = clean.length >= 1 && clean.length <= 6
        && clean.every((p) => Number.isInteger(p.days) && p.days >= 1 && p.days <= 30
          && Number.isInteger(p.price) && p.price >= 1000 && p.price <= 50000000)
        && new Set(clean.map((p) => p.days)).size === clean.length;
      if (!ok) return H.json({ error: 'bad_packages' }, 422);
      clean.sort((a, b) => a.days - b.days);
      await env.DB.prepare(
        `INSERT INTO admin_settings (key, value) VALUES ('featured_pricing', ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value`
      ).bind(JSON.stringify(clean)).run();
      await H.logAdminActivity(env, {
        action: 'featured_pricing_set',
        details: clean.map((p) => `${p.days}k=${p.price}`).join(', '),
        ip: H.reqIp(request),
      }).catch(() => {});
      return H.json({ packages: clean });
    }

    // QO'LDA KO'TARISH — biznes bilan to'g'ridan-to'g'ri kelishuv
    // (naqd, o'tkazma, hamkorlik). Manager+ va IZOH MAJBURIY: bu yo'l
    // to'lovni chetlab o'tadi, shuning uchun kim, nega bergani yoziladi.
    // Narx 0 va buyurtma yo'q — moliya hisobotiga soxta tushum
    // tushmaydi. Egalik, takror va muddat cheklovlari pullik yo'l bilan
    // bir xil.
    if (path === '/api/admin/featured' && method === 'POST') {
      if (!H.roleAtLeast(admin, 'manager')) return H.json({ error: 'forbidden' }, 403);
      const body = await readJson();
      const kind = String(body.targetKind || '');
      const targetId = Number(body.targetId);
      const days = Math.round(Number(body.days));
      const note = H.shortText(body.note || '', 200).trim();
      if (!PROMO_KINDS.includes(kind)) return H.json({ error: 'bad_kind' }, 422);
      if (!Number.isInteger(targetId) || targetId <= 0) return H.json({ error: 'bad_target' }, 422);
      if (!Number.isInteger(days) || days < 1 || days > 30) return H.json({ error: 'bad_days' }, 422);
      if (!note) return H.json({ error: 'note_required' }, 422);

      const target = await targetOwner(env, kind, targetId);
      if (!target.ok) return H.json({ error: 'not_found' }, 404);
      if (target.scheduled) return H.json({ error: 'post_scheduled' }, 409);
      const dup = await env.DB.prepare(
        `SELECT id FROM featured_slots
          WHERE target_kind = ? AND target_id = ? AND ${WEB_BLOCKS_TARGET_SQL}`
      ).bind(kind, targetId).first().catch(() => null);
      if (dup) return H.json({ error: 'already_featured', slotId: Number(dup.id) }, 409);
      // Qo'lda berilgan ham joy egallaydi — pul to'lagan biznesning
      // ulushi kamaymasin.
      const cap = await capacityOf(env, H);
      if (cap.active >= cap.max) return H.json({ error: 'sold_out', ...cap }, 409);

      // Izoh ustuni faqat shu kam ishlatiladigan yo'lda qo'shiladi —
      // lenta va /mine so'rovlariga qo'shimcha to'lqin tushmasin.
      // Ustun bor bo'lsa ALTER xato beradi va jim o'tkaziladi.
      await env.DB.prepare(`ALTER TABLE featured_slots ADD COLUMN note TEXT`).run().catch(() => {});
      const startMs = Date.now();
      const iso = (ms) => new Date(ms).toISOString().replace('T', ' ').replace('Z', '+00');
      const row = await env.DB.prepare(
        `INSERT INTO featured_slots
           (user_id, target_kind, target_id, code, days, price, status, starts_at, ends_at, note, created_at)
         VALUES (?,?,?,?,?, 0, 'active', ?, ?, ?, ?) RETURNING *`
      ).bind(Number(target.ownerUserId) || 0, kind, targetId, target.ownerCode || '', days,
        iso(startMs), iso(startMs + days * DAY_MS), `admin#${Number(admin.adminId) || 0}: ${note}`, H.nowTs()).first();
      return H.json({ slot: slotOut(row, H) }, 201);
    }

    // NAVBAT VA SOTUV REJIMI.
    if (path === '/api/admin/featured/waitlist' && method === 'GET') {
      // Faqat manager+ (kontent rollari emas) — ko'rik F7.
      if (!H.roleAtLeast(admin, 'manager')) return H.json({ error: 'forbidden' }, 403);
      await ensureWaitlistSchema(env);
      const [sales, list, counts] = await Promise.all([
        salesState(env, H),
        env.DB.prepare(
          `SELECT w.user_id, w.target_kind, w.target_id, w.created_at, w.notified_at,
                  (SELECT code FROM cards c WHERE c.user_id = w.user_id ORDER BY is_primary DESC, ts ASC LIMIT 1) AS code,
                  (SELECT name FROM cards c WHERE c.user_id = w.user_id ORDER BY is_primary DESC, ts ASC LIMIT 1) AS name
             FROM featured_waitlist w ORDER BY w.created_at ASC LIMIT 500`
        ).all(),
        env.DB.prepare(`SELECT COUNT(*) AS total, COUNT(notified_at) AS notified FROM featured_waitlist`).first(),
      ]);
      return H.json({
        sales: { mode: sales.mode, open: sales.open, usersCount: sales.usersCount, openAt: sales.openAt,
          openedAt: sales.openedAt, priorityUntil: sales.priorityUntil },
        counts: { total: Number(counts?.total) || 0, notified: Number(counts?.notified) || 0 },
        items: (list?.results || []).map((r) => ({
          userId: Number(r.user_id), code: String(r.code || ''), name: String(r.name || ''),
          targetKind: r.target_kind || null, targetId: r.target_id != null ? Number(r.target_id) : null,
          createdAt: String(r.created_at || ''), notifiedAt: r.notified_at || null,
        })),
      });
    }
    if (path === '/api/admin/featured/sales' && method === 'POST') {
      if (!H.roleAtLeast(admin, 'super_admin')) return H.json({ error: 'forbidden' }, 403);
      const body = await readJson();
      const mode = String(body.mode || '');
      if (!SALES_MODES.includes(mode)) return H.json({ error: 'bad_mode' }, 422);
      const prev = await env.DB.prepare(`SELECT value FROM admin_settings WHERE key = 'featured_sales_open'`).first().catch(() => null);
      await env.DB.prepare(
        `INSERT INTO admin_settings (key, value) VALUES ('featured_sales_open', ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value`
      ).bind(mode).run();
      await H.logAdminActivity(env, {
        action: 'featured_sales_mode', details: `mode=${mode}`,
        oldValue: String(prev?.value || 'auto'), newValue: mode, ip: H.reqIp(request),
      }).catch(() => {});
      const sales = await salesState(env, H);
      return H.json({ sales: { mode: sales.mode, open: sales.open, usersCount: sales.usersCount, openAt: sales.openAt,
        openedAt: sales.openedAt, priorityUntil: sales.priorityUntil } });
    }

    const stopMatch = path.match(/^\/api\/admin\/featured\/(\d+)\/stop$/);
    if (stopMatch && method === 'POST') {
      // Pullik e'lonni to'xtatish — manager+.
      if (!H.roleAtLeast(admin, 'manager')) return H.json({ error: 'forbidden' }, 403);
      const body = await readJson();
      // SABAB MAJBURIY — odamning puliga olingan e'lon to'xtatilyapti.
      const reason = H.shortText(body.reason || '', 200).trim();
      if (!reason) return H.json({ error: 'reason_required' }, 422);

      const row = await env.DB.prepare(`SELECT * FROM featured_slots WHERE id = ?`)
        .bind(Number(stopMatch[1])).first().catch(() => null);
      if (!row) return H.json({ error: 'not_found' }, 404);
      if (!['pending', 'active'].includes(String(row.status))) {
        return H.json({ error: 'not_stoppable' }, 409);
      }

      await stopSlot(env, Number(row.id), `admin#${Number(admin.adminId) || 0}: ${reason}`);
      // APPLE SLOTI (admin audit): manager+ xohlasa, xaridorga yangi
      // KO'TARISH KREDITI beriladi (to'liq kunlar) — pul Apple'da qoldi,
      // xizmat esa to'xtatildi. Kreditning tranzaksiya kaliti sintetik:
      // `admin:<slot>:<apple tx>` (asl tranzaksiya REFUND'i unga tegmaydi).
      if (body.reissueCredit === true && row.source === 'apple' && row.apple_transaction_id && String(row.status) === 'active') {
        const key = `admin:${Number(row.id)}:${String(row.apple_transaction_id)}`;
        await env.DB.prepare(`INSERT OR IGNORE INTO iap_apple_boost_credits
            (user_id, days, product_id, environment, transaction_id, created_at) VALUES (?, ?, NULL, 'admin', ?, ?)`)
          .bind(Number(row.user_id), Number(row.days) || 1, key, new Date().toISOString()).run();
        const c = await env.DB.prepare(`SELECT id FROM iap_apple_boost_credits WHERE transaction_id = ?`).bind(key).first();
        await H.logAdminActivity(env, {
          action: 'featured_apple_credit_reissue',
          details: `slot#${Number(row.id)} → kredit#${Number(c?.id) || 0} (${Number(row.days) || 1} kun) · user#${Number(row.user_id)}`,
          ip: H.reqIp(request),
        }).catch(() => {});
        return H.json({ ok: true, creditId: Number(c?.id) || null });
      }
      return H.json({ ok: true });
    }

    return H.json({ error: 'not_found', path }, 404);
  }

  return null;
}
