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
//   GET  /api/featured/packages          → { packages, enabled }
//   GET  /api/featured                   → { slots }   (ommaviy, lenta uchun)
//   GET  /api/featured/mine              (auth) → { slots }
//   POST /api/featured                   (auth) { targetKind, targetId, days }
//                                        → 201 { slot, orderId, price, payLinks }
//   POST /api/featured/:id/cancel        (auth) → { ok }
//
//   GET  /api/admin/featured             (admin) ?state= → { slots }
//   POST /api/admin/featured/:id/stop    (admin) { reason } → { ok }

import { KINDS, targetOwner } from './comments.js';

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
const MAX_ACTIVE_PER_USER = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

let schemaReady = null;

async function ensureSchema(env) {
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
async function packagesOf(env) {
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

const slotOut = (r, H) => {
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

/// MUDDATI O'TGAN SLOTLARNI BELGILASH.
///
/// Alohida cron YO'Q (Worker'da u qo'shimcha infratuzilma degani).
/// O'rniga har bir o'qishda muddati o'tganlar belgilanadi. Lenta
/// so'rovining O'ZI ham `ends_at > now` bo'yicha filtrlaydi —
/// ya'ni bu yozuv kechikkan taqdirda ham mijozga eskirgan slot
/// KO'RINMAYDI. Belgilash faqat hisobot va admin ro'yxati uchun.
async function sweepExpired(env, H) {
  await env.DB.prepare(
    `UPDATE featured_slots SET status = 'expired'
      WHERE status = 'active' AND ends_at IS NOT NULL AND ends_at <= ?`
  ).bind(H.nowTs()).run().catch(() => {});
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
  await ensureSchema(env);
  const rows = await env.DB.prepare(
    `SELECT target_kind, target_id FROM featured_slots
      WHERE status = 'active' AND ends_at > ?
      ORDER BY starts_at DESC, id DESC LIMIT 10`
  ).bind(nowTs).all().catch(() => null);
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
    return H.json({
      packages: await packagesOf(env),
      // To'lovlar butunlay o'chirilgan bo'lsa, ilova tugmani
      // ko'rsatmaydi — bosilgach 503 chiqishidan ko'ra yaxshiroq.
      enabled: H.paymentsEnabledD1(env),
    });
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
    return H.json({ slots: (rows?.results || []).map((r) => slotOut(r, H)) });
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
    if (!KINDS.includes(kind)) return H.json({ error: 'bad_kind' }, 422);
    if (!Number.isInteger(targetId) || targetId <= 0) return H.json({ error: 'bad_target' }, 422);

    // NARX SERVERDA. Mijoz faqat kunlar sonini tanlaydi; yuborgan
    // narxi (agar yuborsa) BUTUNLAY e'tiborsiz qoldiriladi.
    const packages = await packagesOf(env);
    const pack = packages.find((p) => p.days === Math.round(Number(body.days)));
    if (!pack) return H.json({ error: 'bad_package' }, 422);

    // EGALIK — SERVERDA. Aks holda istalgan odam begona postni
    // ko'tarib, uni bosh sahifaga chiqarardi.
    const target = await targetOwner(env, kind, targetId);
    if (!target.ok) return H.json({ error: 'not_found' }, 404);
    if (Number(target.ownerUserId) !== Number(user.id)) {
      return H.json({ error: 'forbidden' }, 403);
    }

    // Bitta kontent uchun ikkita kutilayotgan buyurtma bo'lmasin —
    // odam ikki marta bosib, ikki marta to'lab qo'ymasin.
    const dup = await env.DB.prepare(
      `SELECT id FROM featured_slots
        WHERE target_kind = ? AND target_id = ? AND status IN ('pending','active')`
    ).bind(kind, targetId).first().catch(() => null);
    if (dup) return H.json({ error: 'already_featured', slotId: Number(dup.id) }, 409);

    const activeRow = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM featured_slots WHERE user_id = ? AND status = 'active'`
    ).bind(user.id).first().catch(() => null);
    if ((Number(activeRow?.n) || 0) >= MAX_ACTIVE_PER_USER) {
      return H.json({ error: 'too_many_active', max: MAX_ACTIVE_PER_USER }, 409);
    }

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
        })),
      });
    }

    const stopMatch = path.match(/^\/api\/admin\/featured\/(\d+)\/stop$/);
    if (stopMatch && method === 'POST') {
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

      await env.DB.prepare(
        `UPDATE featured_slots SET status = 'stopped', stopped_reason = ? WHERE id = ?`
      ).bind(`admin#${Number(admin.adminId) || 0}: ${reason}`, Number(row.id)).run();
      return H.json({ ok: true });
    }

    return H.json({ error: 'not_found', path }, 404);
  }

  return null;
}
