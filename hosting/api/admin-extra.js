import { PENDING_ORDER_TTL_MS } from './order-window.js';
// hosting/api/admin-extra.js — CONTRACT.md ga qarang. Route topilmasa null qaytaradi.
//
// server/admin.js (Express) dagi quyidagi admin route'larning D1 porti.
// Javob shakllari legacy bilan BIR XIL (src/pages/AdminPage.jsx shunga bog'langan):
//   Kategoriyalar   GET/POST /api/admin/categories, PUT/DELETE /api/admin/categories/:id
//   Tasdiqlash      POST /api/admin/records/:code/verify, POST /api/admin/records/:code/views
//   Foydalanuvchi   POST /api/admin/users/:id/delete                     (super_admin)
//   Sovg'a NFC ID   POST /api/admin/nfc-gifts                            (super_admin | manager)
//   Buyurtmalar     POST /api/admin/orders/:id/confirm-payment           (super_admin)
//                   POST /api/admin/bot-orders/:id/confirm-payment       (super_admin)
//   Eksport         GET  /api/admin/export-stats?range=...  → CSV (legacy XLSX edi)
//   Kompaniyalar    POST /api/admin/companies/:code/status, POST /api/admin/companies/:code/tier
//                   POST /api/admin/company-settings/limits              (super_admin)
//                   DELETE /api/admin/company-settings/limits/:kind/:tier (super_admin)
//                   POST /api/admin/company-settings/physical-pricing    (super_admin)
//                   POST /api/admin/company-settings/delivery            (super_admin)
//
// Auth: H.requireAdmin (sessiya + IP whitelist) → 401 {error:'unauthorized'};
// rol yetarli bo'lmasa 403 {error:'forbidden'} (worker.js adminCoreApi bilan bir xil).

const CATEGORY_SELECT = `id, slug, parent_slug AS parentSlug, name_uz AS nameUz, name_ru AS nameRu,
  name_en AS nameEn, sort, enabled`;
const COMPANY_TIERS = new Set(['silver', 'gold', 'premium', 'exclusive']);
const LIMIT_TIERS = ['free', 'silver', 'gold', 'premium', 'exclusive'];
// worker.js isBlockedCode bilan bir xil (GOD* prefiksli kodlar sotilmaydi/sovg'a qilinmaydi).
const isBlockedCode = (code) => String(code || '').toUpperCase().startsWith('GOD');
const cleanSlug = (v) => String(v || '').toLowerCase().trim().replace(/[^a-z0-9-]/g, '').slice(0, 60);

function categoryRow(r) {
  if (!r) return null;
  return {
    id: Number(r.id), slug: r.slug, parentSlug: r.parentSlug ?? null,
    nameUz: r.nameUz ?? '', nameRu: r.nameRu ?? '', nameEn: r.nameEn ?? '',
    sort: Number(r.sort || 0), enabled: !!r.enabled,
  };
}

// server/admin.js categoryFieldsFromBody bilan bir xil.
function categoryFieldsFromBody(body, { partial } = {}) {
  const str = (v, max) => String(v ?? '').slice(0, max).trim();
  const f = {};
  const set = (key, val) => { if (!partial || body[key] != null) f[key] = val; };
  set('nameUz', str(body.nameUz, 120));
  set('nameRu', str(body.nameRu, 120));
  set('nameEn', str(body.nameEn, 120));
  set('parentSlug', cleanSlug(body.parentSlug) || null);
  if (!partial || body.sort != null) f.sort = Math.max(0, Math.min(9999, Math.round(Number(body.sort) || 0)));
  if (!partial || body.enabled != null) f.enabled = body.enabled !== false;
  return f;
}

// server/db.js generateActivationCode — Worker'da crypto.getRandomValues bilan.
function generateActivationCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const buf = new Uint8Array(8);
  crypto.getRandomValues(buf);
  const seg = (off) => Array.from(buf.slice(off, off + 4), (b) => chars[b % chars.length]).join('');
  return `NFC-${seg(0)}-${seg(4)}`;
}

// ---------- admin_settings (server/db.js getAdminSetting/setAdminSetting) ----------
async function getSetting(env, key) {
  const row = await env.DB.prepare(`SELECT value FROM admin_settings WHERE key = ?`).bind(key).first();
  return row?.value ?? null;
}
async function setSetting(env, key, value) {
  await env.DB.prepare(`INSERT INTO admin_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`)
    .bind(key, value).run();
}
async function getLimitsOverride(env, kind) {
  try { const raw = await getSetting(env, `${kind}_limits`); const v = raw ? JSON.parse(raw) : {}; return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; }
  catch { return {}; }
}

function botOrderRow(r) {
  if (!r) return null;
  return {
    id: Number(r.id), tgUserId: r.tg_user_id, tgUsername: r.tg_username || null, tgName: r.tg_name || null,
    code: r.code, price: Number(r.price), status: r.status, screenshotFileId: r.screenshot_file_id || null,
    createdAt: r.created_at,
  };
}

function csvEscape(v) {
  const s = v == null ? '' : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// server/db.js adminExportStats — D1/SQLite varianti. Kunlik qatorlar + jamlama.
async function exportStats(env, days, opts) {
  const to = opts.toIso ? new Date(opts.toIso) : new Date();
  const from = opts.fromIso ? new Date(opts.fromIso) : new Date(Date.now() - days * 86400000);
  const fromIso = from.toISOString();
  const toIso = to.toISOString();
  const byCreated = (sql) => env.DB.prepare(sql).bind(fromIso, toIso).all().then((r) => r.results || []);
  const DAY = `substr(created_at, 1, 10)`;
  // SQLite datetime() soniyagacha kesadi — yuqori chegara inklyuziv (<=), aks holda
  // shu soniyada yaratilgan yozuvlar tushib qoladi.
  const WIN = `datetime(created_at) >= datetime(?) AND datetime(created_at) <= datetime(?)`;
  const [signups, cards, premiums, orders, payments, revenue, auctionsCreated, auctionsSold] = await Promise.all([
    byCreated(`SELECT ${DAY} AS day, COUNT(*) AS n FROM users WHERE ${WIN} AND is_test = 0 GROUP BY 1`),
    env.DB.prepare(`SELECT strftime('%Y-%m-%d', ts / 1000, 'unixepoch') AS day, COUNT(*) AS n FROM cards WHERE ts >= ? AND ts < ? AND price > 0 GROUP BY 1`)
      .bind(from.getTime(), to.getTime()).all().then((r) => r.results || []),
    byCreated(`SELECT ${DAY} AS day, COUNT(*) AS n FROM transactions WHERE kind = 'premium_upgrade' AND ${WIN} GROUP BY 1`),
    byCreated(`SELECT ${DAY} AS day, COUNT(*) AS n FROM web_orders WHERE ${WIN} GROUP BY 1`),
    byCreated(`SELECT ${DAY} AS day, COUNT(*) AS n FROM web_orders WHERE status = 'paid' AND ${WIN} GROUP BY 1`),
    byCreated(`SELECT ${DAY} AS day, COALESCE(SUM(amount), 0) AS n FROM transactions WHERE kind = 'platform_commission' AND ${WIN} GROUP BY 1`),
    byCreated(`SELECT ${DAY} AS day, COUNT(*) AS n FROM auctions WHERE ${WIN} GROUP BY 1`),
    byCreated(`SELECT ${DAY} AS day, COUNT(*) AS n FROM auctions WHERE status = 'sold' AND ${WIN} GROUP BY 1`),
  ]);
  const byDay = {};
  const put = (arr, key) => arr.forEach((r) => {
    byDay[r.day] = byDay[r.day] || { date: r.day, newUsers: 0, newCards: 0, newPremium: 0, orders: 0, payments: 0, revenue: 0, auctionsCreated: 0, auctionsSold: 0 };
    byDay[r.day][key] = Number(r.n);
  });
  put(signups, 'newUsers'); put(cards, 'newCards'); put(premiums, 'newPremium'); put(orders, 'orders');
  put(payments, 'payments'); put(revenue, 'revenue'); put(auctionsCreated, 'auctionsCreated'); put(auctionsSold, 'auctionsSold');
  const rows = Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date));
  const sum = (k) => rows.reduce((s, r) => s + (r[k] || 0), 0);
  const [tu, tp, ta] = await Promise.all([
    env.DB.prepare(`SELECT COUNT(*) AS n FROM users WHERE is_test = 0 AND datetime(created_at) <= datetime(?)`).bind(toIso).first(),
    env.DB.prepare(`SELECT COUNT(*) AS n FROM users WHERE is_test = 0 AND is_premium = 1`).first(),
    env.DB.prepare(`SELECT COUNT(*) AS n FROM auctions WHERE status = 'active'`).first(),
  ]);
  const summary = {
    from: fromIso.slice(0, 10), to: toIso.slice(0, 10),
    totalUsers: Number(tu?.n || 0), totalPremium: Number(tp?.n || 0), activeAuctions: Number(ta?.n || 0),
    auctionsCreated: sum('auctionsCreated'), auctionsSold: sum('auctionsSold'), revenue: sum('revenue'),
    payments: sum('payments'), orders: sum('orders'), newUsers: sum('newUsers'), newCards: sum('newCards'), newPremium: sum('newPremium'),
  };
  return { rows, summary };
}


export async function handle(request, env, url, H) {
  const path = url.pathname;
  if (!path.startsWith('/api/admin/')) return null;
  const method = request.method;

  // Faqat shu modul biladigan yo'llar — boshqalar uchun auth'ga ham tegmaymiz (null).
  const catId = path.match(/^\/api\/admin\/categories\/(\d+)$/);
  const recVerify = path.match(/^\/api\/admin\/records\/([A-Za-z0-9]+)\/verify$/);
  const recViews = path.match(/^\/api\/admin\/records\/([A-Za-z0-9]+)\/views$/);
  const userDelete = path.match(/^\/api\/admin\/users\/(\d+)\/delete$/);
  const webConfirm = path.match(/^\/api\/admin\/orders\/(\d+)\/confirm-payment$/);
  const webCancel = path.match(/^\/api\/admin\/orders\/(\d+)\/cancel$/);
  const botConfirm = path.match(/^\/api\/admin\/bot-orders\/(\d+)\/confirm-payment$/);
  const companyStatus = path.match(/^\/api\/admin\/companies\/([A-Za-z0-9]+)\/status$/);
  const companyTier = path.match(/^\/api\/admin\/companies\/([A-Za-z0-9]+)\/tier$/);
  const limitsDelete = path.match(/^\/api\/admin\/company-settings\/limits\/([a-z]+)\/([a-z]+)$/);
  const paymeTest = path === '/api/admin/payme-test-order';
  const known = path === '/api/admin/categories' || catId || recVerify || recViews || userDelete
    || (path === '/api/admin/nfc-gifts' && method === 'POST') || webConfirm || webCancel || botConfirm
    || path === '/api/admin/export-stats' || companyStatus || companyTier
    || path === '/api/admin/company-settings/limits' || limitsDelete
    || path === '/api/admin/company-settings/physical-pricing' || path === '/api/admin/company-settings/delivery'
    || paymeTest;
  if (!known) return null;

  const admin = await H.requireAdmin(request, env);
  if (!admin) return H.json({ error: 'unauthorized' }, 401);
  const ip = H.reqIp(request);
  const isSuper = admin.role === 'super_admin';
  const forbidden = () => H.json({ error: 'forbidden' }, 403);
  const readBody = () => request.json().catch(() => ({}));

  // ---------- Kategoriyalar (server/admin.js /categories) ----------
  if (path === '/api/admin/categories' && method === 'GET') {
    const rows = await env.DB.prepare(`SELECT ${CATEGORY_SELECT} FROM categories ORDER BY sort, name_uz`).all();
    return H.json({ categories: (rows.results || []).map(categoryRow) });
  }
  if (path === '/api/admin/categories' && method === 'POST') {
    const body = await readBody();
    const slug = cleanSlug(body.slug);
    const f = categoryFieldsFromBody(body);
    if (!slug) return H.json({ error: 'slug_required' }, 422);
    if (!f.nameUz) return H.json({ error: 'name_required' }, 422);
    const exists = await env.DB.prepare(`SELECT 1 AS x FROM categories WHERE slug = ?`).bind(slug).first();
    if (exists) return H.json({ error: 'slug_exists' }, 409);
    const row = await env.DB.prepare(`INSERT INTO categories (slug, parent_slug, name_uz, name_ru, name_en, sort, enabled, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING ${CATEGORY_SELECT}`)
      .bind(slug, f.parentSlug, f.nameUz, f.nameRu || '', f.nameEn || '', f.sort || 0, f.enabled !== false ? 1 : 0, H.nowTs()).first();
    await H.logAdminActivity(env, { action: 'category_created', details: `${slug} — ${f.nameUz}`, ip });
    return H.json(categoryRow(row), 201);
  }
  if (catId && method === 'PUT') {
    const id = Number(catId[1]);
    const body = await readBody();
    const f = categoryFieldsFromBody(body, { partial: true });
    // Legacy: COALESCE — yuborilmagan maydonlar o'zgarmaydi.
    const row = await env.DB.prepare(`UPDATE categories SET
        name_uz = COALESCE(?, name_uz), name_ru = COALESCE(?, name_ru), name_en = COALESCE(?, name_en),
        sort = COALESCE(?, sort), enabled = COALESCE(?, enabled), parent_slug = COALESCE(?, parent_slug)
      WHERE id = ? RETURNING ${CATEGORY_SELECT}`)
      .bind(f.nameUz ?? null, f.nameRu ?? null, f.nameEn ?? null, f.sort ?? null,
        f.enabled == null ? null : (f.enabled ? 1 : 0), f.parentSlug ?? null, id).first();
    if (!row) return H.json({ error: 'not_found' }, 404);
    await H.logAdminActivity(env, { action: 'category_updated', details: `#${id}`, ip });
    return H.json(categoryRow(row));
  }
  if (catId && method === 'DELETE') {
    const id = Number(catId[1]);
    const cat = await env.DB.prepare(`SELECT slug FROM categories WHERE id = ?`).bind(id).first();
    if (!cat) return H.json({ error: 'not_found' }, 404);
    // Legacy (Postgres) tekshirmasdan o'chirar edi; kartalar hali shu slug'ga
    // bog'langan bo'lsa direktoriya "yo'q kategoriya"ga ishora qilib qoladi — rad etamiz.
    const used = await env.DB.prepare(`SELECT COUNT(*) AS n FROM cards WHERE category_slug = ?`).bind(cat.slug).first();
    if (Number(used?.n || 0) > 0) return H.json({ error: 'category_in_use', count: Number(used.n) }, 409);
    await env.DB.prepare(`DELETE FROM categories WHERE id = ?`).bind(id).run();
    await H.logAdminActivity(env, { action: 'category_deleted', details: `#${id}`, ip });
    return H.json({ ok: true });
  }

  // ---------- Profil tasdiqlash / ko'rishlar (server/admin.js /records/:code/*) ----------
  if (recVerify && method === 'POST') {
    const code = recVerify[1].toUpperCase();
    const body = await readBody();
    const verified = body.verified !== false;
    const row = await env.DB.prepare(`UPDATE cards SET verified = ? WHERE code = ? RETURNING code, name, verified`)
      .bind(verified ? 1 : 0, code).first();
    if (!row) return H.json({ error: 'not_found' }, 404);
    await H.logAdminActivity(env, { action: verified ? 'card_verified' : 'card_unverified', details: code, ip });
    return H.json({ code: row.code, name: row.name, verified: !!row.verified });
  }
  if (recViews && method === 'POST') {
    const code = recViews[1].toUpperCase();
    const body = await readBody();
    const views = Number(body.views);
    if (!Number.isFinite(views) || views < 0) return H.json({ error: 'bad_views' }, 422);
    const n = Math.max(0, Math.min(100_000_000, Math.round(views)));
    const row = await env.DB.prepare(`UPDATE cards SET views = ? WHERE code = ? RETURNING code, name, views`).bind(n, code).first();
    if (!row) return H.json({ error: 'not_found' }, 404);
    await H.logAdminActivity(env, { action: 'card_views_set', details: `${code} → ${Number(row.views)}`, ip });
    return H.json({ code: row.code, name: row.name, views: Number(row.views) });
  }

  // ---------- Foydalanuvchini o'chirish (soft-delete + sessiyalar) — super_admin ----------
  if (userDelete && method === 'POST') {
    if (!isSuper) return forbidden();
    const id = Number(userDelete[1]);
    const user = await env.DB.prepare(`SELECT id, email, deleted_at FROM users WHERE id = ?`).bind(id).first();
    if (!user) return H.json({ error: 'not_found' }, 404);
    // Legacy adminDeleteUser (server/db.js) hard-delete qilar edi; D1'da
    // yozuvlar saqlanib qoladi (deleted_at) — getCurrentUser deleted_at'li
    // foydalanuvchini tanimaydi, sessiyalar esa darhol yo'q qilinadi.
    await env.DB.prepare(`UPDATE users SET deleted_at = COALESCE(deleted_at, ?) WHERE id = ?`).bind(H.nowTs(), id).run();
    await env.DB.prepare(`DELETE FROM sessions WHERE user_id = ?`).bind(id).run();
    await H.logAdminActivity(env, { action: 'user_deleted', details: `Foydalanuvchi #${id} o'chirildi (soft-delete, sessiyalar yopildi)`, oldValue: user.email, ip });
    return H.json({ ok: true });
  }

  // ---------- Sovg'a NFC ID yaratish (server/admin.js POST /nfc-gifts) — super_admin | manager ----------
  if (path === '/api/admin/nfc-gifts' && method === 'POST') {
    if (!['super_admin', 'manager'].includes(admin.role)) return forbidden();
    const body = await readBody();
    const code = String(body.code || '').trim().toUpperCase();
    const recipientName = String(body.recipientName || '').slice(0, 100).trim();
    const note = String(body.note || '').slice(0, 300).trim();
    if (!/^[A-Z0-9]{3,16}$/.test(code) || isBlockedCode(code)) return H.json({ error: 'bad_code' }, 422);
    let value = null;
    if (body.value != null && body.value !== '') {
      const n = Math.round(Number(body.value));
      if (!Number.isFinite(n) || n < 0 || n > 1_000_000_000) return H.json({ error: 'bad_value' }, 422);
      value = n;
    }
    // server/db.js createNfcGift
    if (await env.DB.prepare(`SELECT 1 AS x FROM cards WHERE code = ?`).bind(code).first()) return H.json({ error: 'CODE_TAKEN' }, 409);
    if (await env.DB.prepare(`SELECT 1 AS x FROM nfc_gifts WHERE code = ? AND status = 'reserved'`).bind(code).first()) return H.json({ error: 'ALREADY_RESERVED' }, 409);
    for (let i = 0; i < 8; i++) {
      const activationCode = generateActivationCode();
      // UNIQUE(activation_code) to'qnashuvi juda kam — qayta uramiz; UNIQUE(code)
      // to'qnashuvi (eski 'activated' sovg'a bor) → legacy Postgres'da ham xato edi.
      const row = await env.DB.prepare(`INSERT INTO nfc_gifts (code, recipient_name, note, value, activation_code, status, created_at)
        VALUES (?, ?, ?, ?, ?, 'reserved', ?) ON CONFLICT(activation_code) DO NOTHING RETURNING id, code, activation_code AS activationCode`)
        .bind(code, recipientName || null, note || null, value, activationCode, H.nowTs()).first().catch((err) => {
          if (/UNIQUE|constraint/i.test(String(err?.message))) return 'code_conflict';
          throw err;
        });
      if (row === 'code_conflict') return H.json({ error: 'ALREADY_RESERVED' }, 409);
      if (row) {
        await H.logAdminActivity(env, { action: 'nfc_gift_created', details: `${code} → ${recipientName || 'nomsiz'}${value ? ` (${value} so'm)` : ''}`, newValue: row.activationCode, ip });
        return H.json({ id: Number(row.id), code: row.code, activationCode: row.activationCode }, 201);
      }
    }
    return H.json({ error: 'GENERATION_FAILED' }, 409);
  }

  // ---------- Qo'lda to'lov tasdiqlash — super_admin ----------
  if (webConfirm && method === 'POST') {
    if (!isSuper) return forbidden();
    const id = Number(webConfirm[1]);
    const before = await H.getWebOrderD1(env, id);
    // worker.js finalizePaidWebOrderD1: {alreadyProcessed} | {ok:true,created,resumed?,alreadyPaid?}
    // | {ok:false, reason:'code_taken'|'unsupported_order_kind'} — legacy kabi 409 faqat alreadyProcessed uchun.
    const result = await H.finalizePaidWebOrderD1(env, id);
    if (result.alreadyProcessed) return H.json({ error: 'already_processed' }, 409);
    if (!result.alreadyPaid) { // idempotent qayta-chaqiruv hech narsani o'zgartirmaydi — log yozilmaydi
      await H.logAdminActivity(env, {
        action: 'payment_confirmed_manually', details: `web_orders #${id} (${before?.kind || '?'}, ${before?.code || '?'})`,
        oldValue: before?.status || null, newValue: result.ok ? 'paid' : `failed:${result.reason}`, ip,
      });
    }
    return H.json(result);
  }
  // ---------- Kutilayotgan buyurtmani BEKOR QILISH — super_admin ----------
  //
  // NIMA UCHUN KERAK: `createPendingWebOrderD1()` bitta kod uchun ikkinchi
  // kutilayotgan buyurtma yaratishga RUXSAT BERMAYDI:
  //   WHERE NOT EXISTS (SELECT 1 FROM web_orders WHERE code = ? AND status='pending')
  // Ya'ni kimdir to'lovni boshlab, yarim yo'lda tashlab ketsa, o'sha kodni
  // BOSHQA HECH KIM sotib ololmaydi — va uni bekor qilishning biror yo'li
  // butun saytda yo'q edi. Kod abadiy bloklanib qolardi.
  //
  // XAVFSIZLIK: faol Payme tranzaksiyasi bor buyurtmaga TEGILMAYDI.
  // Aks holda mijoz to'lovni yakunlaganda `finalizePaidWebOrderD1()`
  // buyurtmani 'pending' emas deb ko'rib, `alreadyProcessed` qaytaradi —
  // pul o'tadi, karta berilmaydi. Shuning uchun `payme_transaction_id`
  // qo'yilgan buyurtma faqat Payme tranzaksiyasining amal qilish muddati
  // (24 soat) o'tgandan keyin bekor qilinadi; undan oldin Payme'ning O'Z
  // CancelTransaction oqimi ishlashi kerak.
  // ═══ PAYME SERTIFIKATSIYA SINOVI — 1 so'mlik buyurtma ═══
  // To'lov tizimini ulashda Payme kichik summali HAQIQIY to'lov o'tkazib
  // tekshirishni so'raydi. Saytdagi eng arzon mahsulot 49 000 so'm, ya'ni
  // bunday buyurtma yaratishning yo'li yo'q edi.
  //
  // XAVFSIZLIK: bu buyurtma HECH NARSA BERMAYDI (worker.js
  // finalizePaidWebOrderD1 -> kind='payme_test' izohiga qarang) — karta
  // yaratmaydi, biriktirmaydi, premium yoqmaydi. Shuning uchun undan
  // "arzon xarid" qilib bo'lmaydi. Qo'shimcha cheklovlar:
  //   * faqat super_admin;
  //   * summa 1..10 000 so'm oralig'ida (sinov uchun yetarli, undan
  //     ortig'iga ehtiyoj yo'q).
  if (paymeTest && method === 'POST') {
    if (!isSuper) return forbidden();
    const body = await request.json().catch(() => ({}));
    const som = Math.round(Number(body?.amount ?? 1));
    if (!Number.isFinite(som) || som < 1 || som > 10000) {
      return H.json({ error: 'bad_amount', hint: '1..10000 so\'m' }, 422);
    }
    // MUHIM: `web_orders.user_id` -> `users(id)` ga FOREIGN KEY bilan
    // bog'langan, adminlar esa ALOHIDA jadvalda. Admin ID sini qo'ysak
    // FK cheklovi buzilardi. Shu sababli mavjud haqiqiy foydalanuvchi
    // olinadi (odatda sayt egasining hisobi).
    const owner = await env.DB.prepare(`SELECT id FROM users ORDER BY id LIMIT 1`).first();
    if (!owner) return H.json({ error: 'no_user' }, 409);
    const order = await H.createWebOrderD1(env, {
      userId: Number(owner.id),
      code: 'PAYMETEST',
      kind: 'payme_test',
      price: som,
      payload: { note: 'Payme sertifikatsiya sinovi — hech narsa bermaydi' },
    });
    if (!order) return H.json({ error: 'create_failed' }, 500);
    await H.logAdminActivity(env, {
      action: 'payme_test_order',
      details: `Buyurtma #${order.id} — ${som} so'm`,
      ip: H.reqIp(request),
    });
    return H.json({
      orderId: order.id,
      amount: som,
      payLink: H.paymeCheckoutLinkD1(env, order.id, som),
    }, 201);
  }

  if (webCancel && method === 'POST') {
    if (!isSuper) return forbidden();
    const id = Number(webCancel[1]);
    const before = await H.getWebOrderD1(env, id);
    if (!before) return H.json({ error: 'not_found' }, 404);
    if (before.status !== 'pending') return H.json({ error: 'not_pending', status: before.status }, 409);
    if (before.paymeTransactionId) {
      const createdMs = Date.parse(before.createdAt || '') || 0;
      if (!createdMs || Date.now() - createdMs < PENDING_ORDER_TTL_MS) {
        return H.json({ error: 'payme_active' }, 409);
      }
    }
    // Shartli UPDATE — ayni paytda to'lov o'tib ketgan bo'lsa tegmaydi.
    // cancel_time COALESCE bilan: Payme allaqachon qo'ygan bo'lsa
    // o'zgartirilmaydi. `cancel_reason` ATAYLAB tegilmaydi — u Payme
    // protokolining kodi, uni o'zimiz o'ylab topmaymiz.
    const row = await env.DB.prepare(
      `UPDATE web_orders SET status = 'cancelled', cancel_time = COALESCE(cancel_time, ?)
        WHERE id = ? AND status = 'pending' RETURNING id, code, status`
    ).bind(H.nowTs(), id).first();
    if (!row) return H.json({ error: 'not_pending' }, 409);
    await H.logAdminActivity(env, {
      action: 'order_cancelled', details: `web_orders #${id} (${before.code}) — kod qayta sotuvga chiqdi`,
      oldValue: 'pending', newValue: 'cancelled', ip,
    });
    return H.json({ ok: true, id: Number(row.id), code: row.code, status: row.status });
  }

  if (botConfirm && method === 'POST') {
    if (!isSuper) return forbidden();
    const id = Number(botConfirm[1]);
    const order = await env.DB.prepare(`SELECT * FROM bot_orders WHERE id = ?`).bind(id).first();
    if (!order || order.status !== 'pending') return H.json({ error: 'already_processed' }, 409);
    // server/db.js finalizePaidBotOrder: status → paid; karta bo'lmasa "TELEGRAM MIJOZ" nomi bilan yaratiladi.
    const updated = await env.DB.prepare(`UPDATE bot_orders SET status = 'paid' WHERE id = ? AND status = 'pending' RETURNING *`).bind(id).first();
    if (!updated) return H.json({ error: 'already_processed' }, 409);
    if (!(await H.getRecord(env, order.code))) {
      await H.createRecordD1(env, { code: order.code, name: 'TELEGRAM MIJOZ', price: Number(order.price), source: 'admin_order' });
      if (order.user_id) await H.attachCardToUserD1(env, order.code, order.user_id);
    }
    await H.logAdminActivity(env, { action: 'payment_confirmed_manually', details: `bot_orders #${id} (${order.code})`, oldValue: 'pending', newValue: 'paid', ip });
    return H.json({ ok: true, order: botOrderRow(updated) });
  }

  // ---------- Statistika eksporti (legacy XLSX → CSV) ----------
  if (path === '/api/admin/export-stats' && method === 'GET') {
    let days = 30;
    const opts = {};
    const range = String(url.searchParams.get('range') || '30d');
    const now = new Date();
    if (range === 'today') { opts.fromIso = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString(); days = 1; }
    else if (range === '7d') days = 7;
    else if (range === '30d') days = 30;
    else if (range === 'month') { opts.fromIso = new Date(now.getFullYear(), now.getMonth(), 1).toISOString(); days = now.getDate(); }
    else if (range === 'all') { opts.fromIso = new Date(0).toISOString(); }
    else if (range === 'custom') {
      const from = String(url.searchParams.get('from') || '');
      const to = String(url.searchParams.get('to') || '');
      if (/^\d{4}-\d{2}-\d{2}$/.test(from)) opts.fromIso = new Date(from + 'T00:00:00').toISOString();
      if (/^\d{4}-\d{2}-\d{2}$/.test(to)) opts.toIso = new Date(to + 'T23:59:59.999').toISOString();
      if (!opts.fromIso) days = Math.max(1, Math.min(730, Number(url.searchParams.get('days')) || 30));
    }
    const { rows, summary } = await exportStats(env, days, opts);
    const header = ['Sana', 'Yangi ro’yxatdan o’tganlar', 'Yangi NFC ID (sotilgan)', 'Yangi Premium', 'Buyurtmalar', 'To’lovlar', 'Tushum (so’m)', 'Auksion (yaratilgan)', 'Auksion (sotilgan)'];
    const data = [header, ...rows.map((r) => [r.date, r.newUsers, r.newCards, r.newPremium, r.orders, r.payments, r.revenue, r.auctionsCreated, r.auctionsSold])];
    data.push([]);
    data.push(['JAMI', summary.newUsers, summary.newCards, summary.newPremium, summary.orders, summary.payments, summary.revenue, summary.auctionsCreated, summary.auctionsSold]);
    data.push([]);
    data.push(['— JAMLAMA —']);
    data.push(['Oraliq', `${summary.from} … ${summary.to}`]);
    data.push(['Jami foydalanuvchilar (davr oxiriga)', summary.totalUsers]);
    data.push(['Jami Premium foydalanuvchilar', summary.totalPremium]);
    data.push(['Auksionlar — yaratilgan (davr)', summary.auctionsCreated]);
    data.push(['Auksionlar — sotilgan (davr)', summary.auctionsSold]);
    data.push(['Auksionlar — hozir faol', summary.activeAuctions]);
    data.push(['Jami to’lovlar (davr)', summary.payments]);
    data.push(['Jami tushum (davr, so’m)', summary.revenue]);
    data.push([]);
    data.push(['Trafik manbasi (Telegram / Instagram / Google)', 'kuzatuv tizimi hali ulanmagan']);
    // BOM — Excel UTF-8 ni to'g'ri ochishi uchun.
    const csv = '\uFEFF' + data.map((r) => r.map(csvEscape).join(',')).join('\r\n') + '\r\n';
    await H.logAdminActivity(env, { action: 'stats_exported', details: `Oraliq: ${range}`, ip });
    return new Response(csv, {
      status: 200,
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="nfcstore_statistika_${range}.csv"`,
        'cache-control': 'no-store',
      },
    });
  }

  // ---------- Kompaniyalar (business profil = cards.profile_type='business') ----------
  if (companyStatus && method === 'POST') {
    const code = companyStatus[1].toUpperCase();
    const body = await readBody();
    // Frontend {hidden:boolean} yuboradi; {status:'suspended'|'active'} ham qabul qilinadi.
    const hidden = body.hidden === true || body.status === 'suspended';
    const row = await env.DB.prepare(`UPDATE cards SET hidden_from_directory = ? WHERE code = ? AND profile_type = 'business'
      RETURNING code, name, hidden_from_directory AS hiddenFromDirectory`).bind(hidden ? 1 : 0, code).first();
    if (!row) return H.json({ error: 'not_found' }, 404);
    await H.logAdminActivity(env, { action: hidden ? 'company_suspended' : 'company_activated', details: code, ip });
    return H.json({ code: row.code, name: row.name, hiddenFromDirectory: !!row.hiddenFromDirectory });
  }
  if (companyTier && method === 'POST') {
    const code = companyTier[1].toUpperCase();
    const body = await readBody();
    const tier = body.tier ? String(body.tier).toLowerCase() : null;
    if (tier && !COMPANY_TIERS.has(tier)) return H.json({ error: 'bad_tier' }, 422);
    const row = await env.DB.prepare(`UPDATE cards SET tier_override = ? WHERE code = ? AND profile_type = 'business' RETURNING code`)
      .bind(tier, code).first();
    if (!row) return H.json({ error: 'not_found' }, 404);
    await H.logAdminActivity(env, { action: 'company_tier_set', details: code, newValue: tier || 'auto', ip });
    return H.json({ code, tierOverride: tier });
  }

  // ---------- Kompaniya sozlamalari (admin_settings) — super_admin ----------
  if (path === '/api/admin/company-settings/limits' && method === 'POST') {
    if (!isSuper) return forbidden();
    const body = await readBody();
    const kind = body.kind === 'product' ? 'product' : (body.kind === 'menu' ? 'menu' : null);
    const tier = String(body.tier || '');
    if (!kind || !LIMIT_TIERS.includes(tier)) return H.json({ error: 'bad_input' }, 422);
    // Frontend tekis {cat,item,images} yuboradi; {limits:{cat,item,images}} ham qabul qilinadi.
    const src = body.limits && typeof body.limits === 'object' ? body.limits : body;
    const cat = Math.max(0, Math.min(100000, Math.round(Number(src.cat))));
    const item = Math.max(0, Math.min(1000000, Math.round(Number(src.item))));
    const images = src.images !== false;
    if (!Number.isFinite(cat) || !Number.isFinite(item)) return H.json({ error: 'bad_input' }, 422);
    const map = await getLimitsOverride(env, kind);
    const before = map[tier] || null;
    map[tier] = { cat, item, images };
    await setSetting(env, `${kind}_limits`, JSON.stringify(map));
    await H.logAdminActivity(env, { action: 'company_limits_changed', details: `${kind}/${tier}`, oldValue: before ? JSON.stringify(before) : 'default', newValue: JSON.stringify(map[tier]), ip });
    return H.json({ kind, tier, limits: map[tier] });
  }
  if (limitsDelete && method === 'DELETE') {
    if (!isSuper) return forbidden();
    const kind = limitsDelete[1] === 'product' ? 'product' : (limitsDelete[1] === 'menu' ? 'menu' : null);
    const tier = limitsDelete[2];
    if (!kind || !LIMIT_TIERS.includes(tier)) return H.json({ error: 'bad_input' }, 422);
    const map = await getLimitsOverride(env, kind);
    delete map[tier];
    await setSetting(env, `${kind}_limits`, JSON.stringify(map));
    await H.logAdminActivity(env, { action: 'company_limits_reset', details: `${kind}/${tier}`, ip });
    return H.json({ ok: true });
  }
  if (path === '/api/admin/company-settings/physical-pricing' && method === 'POST') {
    if (!isSuper) return forbidden();
    const body = await readBody();
    const raw = body.tiers;
    if (!Array.isArray(raw) || raw.length === 0 || raw.length > 20) return H.json({ error: 'bad_input' }, 422);
    const tiers = [];
    for (const t of raw) {
      const minQty = Math.round(Number(t?.minQty));
      const maxQtyRaw = t?.maxQty;
      const maxQty = maxQtyRaw === null || maxQtyRaw === '' || maxQtyRaw == null ? null : Math.round(Number(maxQtyRaw));
      const pricePerUnit = Math.round(Number(t?.pricePerUnit));
      if (!Number.isFinite(minQty) || minQty < 1) return H.json({ error: 'bad_tier' }, 422);
      if (maxQty !== null && (!Number.isFinite(maxQty) || maxQty < minQty)) return H.json({ error: 'bad_tier' }, 422);
      if (!Number.isFinite(pricePerUnit) || pricePerUnit < 0 || pricePerUnit > 100_000_000) return H.json({ error: 'bad_tier' }, 422);
      tiers.push({ minQty, maxQty, pricePerUnit });
    }
    await setSetting(env, 'physical_nfc_pricing', JSON.stringify(tiers));
    await H.logAdminActivity(env, { action: 'physical_nfc_pricing_changed', newValue: JSON.stringify(tiers), ip });
    return H.json({ tiers });
  }
  if (path === '/api/admin/company-settings/delivery' && method === 'POST') {
    if (!isSuper) return forbidden();
    const body = await readBody();
    const minDays = Math.round(Number(body.minDays));
    const maxDays = Math.round(Number(body.maxDays));
    if (!Number.isFinite(minDays) || !Number.isFinite(maxDays) || minDays < 0 || maxDays < minDays || maxDays > 90) {
      return H.json({ error: 'bad_input' }, 422);
    }
    const delivery = { minDays, maxDays };
    await setSetting(env, 'delivery_days', JSON.stringify(delivery));
    await H.logAdminActivity(env, { action: 'delivery_days_changed', newValue: JSON.stringify(delivery), ip });
    return H.json(delivery);
  }

  return null;
}
