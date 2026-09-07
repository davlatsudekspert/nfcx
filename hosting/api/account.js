import { cardContentCleanupStmts } from './card-cleanup.js';
// hosting/api/account.js — CONTRACT.md ga qarang. Route topilmasa null qaytaradi.
//
// server/index.js (Express) dagi quyidagi yo'llarning D1 porti — javob
// shakllari frontend (src/lib/db.js) bog'langan legacy bilan BIR XIL:
//   POST /api/settings/request-password-code | change-password
//   POST /api/settings/request-phone-change-code | confirm-phone-change
//   POST/GET /api/support
//   POST /api/premium/request
//   GET  /api/payments, GET /api/payments/:orderId
//   POST /api/records/:code/set-primary, DELETE /api/records/:code
//   POST /api/records/:code/gift, POST /api/records/:code/order-physical-card
//   GET  /api/gifts/public
//   GET  /api/nfc-gifts/:code, POST /api/nfc-gifts/:code/{verify,activate}
// DIQQAT: src/ dan import qilinmaydi — scripts/prepare-sites-build.mjs faqat
// hosting/ ni dist/server/ ga ko'chiradi, shuning uchun '../../src/...' yo'li
// deploy bundle'da topilmaydi. Qiymat src/lib/pricing.js PROFILE_PREMIUM_FEE
// bilan BIR XIL bo'lishi shart (scripts/test-account.mjs shuni tekshiradi).
const PROFILE_PREMIUM_FEE = 20000;

const PHONE_RE = /^\+?\d{9,15}$/;                 // server/index.js PHONE_RE
const PHYSICAL_CARD_FEE = 200_000;               // server/index.js PHYSICAL_CARD_FEE
const OTP_TTL_MS = 10 * 60 * 1000;               // kod 10 daqiqa amal qiladi
const OTP_RATE_WINDOW_MS = 10 * 60 * 1000;       // 10 daqiqada ko'pi bilan 3 ta kod
const OTP_RATE_MAX = 3;
const SUPPORT_RATE_WINDOW_MS = 60 * 1000;        // legacy supportLimiter: 5/min
const SUPPORT_RATE_MAX = 5;
const ACCESS_RANK = { free: 0, silver: 1, gold: 2, premium: 3, exclusive: 4 }; // src/lib/access.js
const PHYSICAL_CARD_DESIGNER_MIN = 'silver';     // src/lib/access.js FEATURE_MIN.physicalCardDesigner

// server/bot.js OTP_MESSAGES bilan bir xil matnlar
const OTP_MESSAGES = {
  password_reset: (code) => `\u{1F510} Parolni o'zgartirish kodi: <b>${code}</b>\n\nBu kodni hech kimga bermang. 10 daqiqa ichida amal qiladi.`,
  phone_change: (code) => `\u{1F4F1} Telefon raqamini tasdiqlash kodi: <b>${code}</b>\n\nBu kodni hech kimga bermang. 10 daqiqa ichida amal qiladi.`,
};

// nowTs() bilan bir xil formatda (lexikografik solishtirish to'g'ri ishlaydi)
const tsFromMs = (ms) => new Date(ms).toISOString().replace('T', ' ').replace('Z', '+00');
const sixDigitCode = () => String(100000 + Math.floor(Math.random() * 900000));
const normPhone = (v, H) => H.cleanStr(v, 20).replace(/[\s\-()]/g, '');

async function readJson(request) {
  try { return (await request.json()) || {}; } catch { return {}; }
}

export async function handle(request, env, url, H) {
  const path = url.pathname;
  const method = request.method;

  // ---------- Sozlamalar: Telegram OTP orqali parol o'zgartirish ----------
  if (path === '/api/settings/request-password-code' && method === 'POST') {
    const user = await H.getCurrentUser(request, env);
    if (!user) return H.json({ error: 'unauthorized' }, 401);
    const info = await env.DB.prepare(
      `SELECT u.phone, bv.tg_user_id AS tgUserId FROM users u
       LEFT JOIN bot_verifications bv ON bv.phone = u.phone WHERE u.id = ?`
    ).bind(user.id).first();
    if (!info || !info.phone) return H.json({ error: 'no_phone' }, 422);
    if (!info.tgUserId) return H.json({ error: 'tg_not_linked' }, 422);

    const recent = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM password_reset_codes WHERE user_id = ? AND created_at > ?`
    ).bind(user.id, tsFromMs(Date.now() - OTP_RATE_WINDOW_MS)).first();
    if (Number(recent?.n || 0) >= OTP_RATE_MAX) return H.json({ error: 'too_many_requests' }, 429);

    const code = sixDigitCode();
    await env.DB.prepare(
      `INSERT INTO password_reset_codes (user_id, code, expires_at, used, created_at) VALUES (?, ?, ?, 0, ?)`
    ).bind(user.id, code, tsFromMs(Date.now() + OTP_TTL_MS), H.nowTs()).run();
    const sent = await H.sendTelegramTo(env, info.tgUserId, OTP_MESSAGES.password_reset(code));
    if (!sent) return H.json({ error: 'tg_send_failed' }, 503);
    return H.json({ ok: true });
  }

  if (path === '/api/settings/change-password' && method === 'POST') {
    const user = await H.getCurrentUser(request, env);
    if (!user) return H.json({ error: 'unauthorized' }, 401);
    const body = await readJson(request);
    const code = H.cleanStr(body.code, 6);
    const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';
    if (!code) return H.json({ error: 'code_required' }, 422);
    if (newPassword.length < 6) return H.json({ error: 'weak_password' }, 422);

    const consumed = await env.DB.prepare(
      `UPDATE password_reset_codes SET used = 1 WHERE id = (
         SELECT id FROM password_reset_codes
         WHERE user_id = ? AND code = ? AND used = 0 AND expires_at > ?
         ORDER BY created_at DESC LIMIT 1
       ) RETURNING id`
    ).bind(user.id, code, H.nowTs()).first();
    if (!consumed) return H.json({ error: 'bad_code' }, 422);

    await env.DB.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`)
      .bind(await H.hashPassword(newPassword), user.id).run();
    return H.json({ ok: true });
  }

  // ---------- Sozlamalar: Telegram OTP orqali telefon raqamini o'zgartirish ----------
  if (path === '/api/settings/request-phone-change-code' && method === 'POST') {
    const user = await H.getCurrentUser(request, env);
    if (!user) return H.json({ error: 'unauthorized' }, 401);
    const body = await readJson(request);
    const phone = normPhone(body.newPhone, H);
    if (!PHONE_RE.test(phone)) return H.json({ error: 'bad_phone' }, 422);

    const bv = await env.DB.prepare(
      `SELECT tg_user_id AS tgUserId FROM bot_verifications WHERE phone = ? ORDER BY id DESC LIMIT 1`
    ).bind(phone).first();
    if (!bv?.tgUserId) return H.json({ error: 'phone_not_verified' }, 422);

    const recent = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM phone_otp_codes WHERE phone = ? AND purpose = 'phone_change' AND created_at > ?`
    ).bind(phone, tsFromMs(Date.now() - OTP_RATE_WINDOW_MS)).first();
    if (Number(recent?.n || 0) >= OTP_RATE_MAX) return H.json({ error: 'too_many_requests' }, 429);

    const code = sixDigitCode();
    await env.DB.prepare(
      `INSERT INTO phone_otp_codes (phone, code, purpose, expires_at, used, created_at) VALUES (?, ?, 'phone_change', ?, 0, ?)`
    ).bind(phone, code, tsFromMs(Date.now() + OTP_TTL_MS), H.nowTs()).run();
    const sent = await H.sendTelegramTo(env, bv.tgUserId, OTP_MESSAGES.phone_change(code));
    if (!sent) return H.json({ error: 'tg_send_failed' }, 503);
    return H.json({ ok: true });
  }

  if (path === '/api/settings/confirm-phone-change' && method === 'POST') {
    const user = await H.getCurrentUser(request, env);
    if (!user) return H.json({ error: 'unauthorized' }, 401);
    const body = await readJson(request);
    const phone = normPhone(body.newPhone, H);
    const code = H.cleanStr(body.code, 6);
    if (!PHONE_RE.test(phone)) return H.json({ error: 'bad_phone' }, 422);
    if (!code) return H.json({ error: 'code_required' }, 422);

    const consumed = await env.DB.prepare(
      `UPDATE phone_otp_codes SET used = 1 WHERE id = (
         SELECT id FROM phone_otp_codes
         WHERE phone = ? AND code = ? AND purpose = 'phone_change' AND used = 0 AND expires_at > ?
         ORDER BY created_at DESC LIMIT 1
       ) RETURNING id`
    ).bind(phone, code, H.nowTs()).first();
    if (!consumed) return H.json({ error: 'bad_code' }, 422);

    await env.DB.prepare(`UPDATE users SET phone = ? WHERE id = ?`).bind(phone, user.id).run();
    return H.json({ ok: true, phone });
  }

  // ---------- Adminga murojaat ----------
  if (path === '/api/support' && method === 'POST') {
    const user = await H.getCurrentUser(request, env);
    if (!user) return H.json({ error: 'unauthorized' }, 401);
    const body = await readJson(request);
    const message = H.cleanStr(body.message, 1000);
    if (!message) return H.json({ error: 'message_required' }, 422);

    const recent = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM support_messages WHERE user_id = ? AND created_at > ?`
    ).bind(user.id, tsFromMs(Date.now() - SUPPORT_RATE_WINDOW_MS)).first();
    if (Number(recent?.n || 0) >= SUPPORT_RATE_MAX) return H.json({ error: 'too_many_requests' }, 429);

    const row = await env.DB.prepare(
      `INSERT INTO support_messages (user_id, message, status, created_at) VALUES (?, ?, 'pending', ?)
       RETURNING id, created_at AS createdAt`
    ).bind(user.id, message, H.nowTs()).first();
    // server/bot.js notifyAdminSupportMessage — xato bo'lsa javobga ta'sir qilmaydi
    H.sendTelegramMessage(env, `✉️ <b>Yangi murojaat</b>\n${user.email}\n\n${message}`).catch(() => {});
    return H.json({ id: row.id, createdAt: row.createdAt }, 201);
  }

  if (path === '/api/support' && method === 'GET') {
    const user = await H.getCurrentUser(request, env);
    if (!user) return H.json({ messages: [] });
    const rows = await env.DB.prepare(
      `SELECT id, message, reply, status, created_at AS createdAt, replied_at AS repliedAt
       FROM support_messages WHERE user_id = ? ORDER BY created_at DESC LIMIT 30`
    ).bind(user.id).all();
    return H.json({ messages: rows.results || [] });
  }

  // ---------- Premium profil (Payme buyurtmasi) ----------
  if (path === '/api/premium/request' && method === 'POST') {
    const user = await H.getCurrentUser(request, env);
    if (!user) return H.json({ error: 'unauthorized' }, 401);
    if (!H.paymentsEnabledD1(env)) return H.json({ error: 'payments_disabled' }, 503);

    const u = await env.DB.prepare(`SELECT is_premium AS isPremium FROM users WHERE id = ?`).bind(user.id).first();
    if (!u) return H.json({ error: 'NOT_FOUND' }, 409);
    if (u.isPremium) return H.json({ error: 'ALREADY_PREMIUM' }, 409);
    // Legacy requestPremium: kutilayotgan tekshiruv FOYDALANUVCHI bo'yicha
    // (code='PREMIUM' hamma uchun umumiy — createPendingWebOrderD1'ning
    // faqat code bo'yicha dedup'i bu yerda boshqa userlarni bloklab qo'yardi).
    const pending = await env.DB.prepare(
      `SELECT id FROM web_orders WHERE user_id = ? AND kind = 'premium_upgrade' AND status = 'pending' LIMIT 1`
    ).bind(user.id).first();
    if (pending) return H.json({ error: 'ALREADY_PENDING' }, 409);

    const order = await env.DB.prepare(
      `INSERT INTO web_orders (user_id, code, kind, price, payload, status, created_at)
       VALUES (?, 'PREMIUM', 'premium_upgrade', ?, '{}', 'pending', ?) RETURNING id`
    ).bind(user.id, PROFILE_PREMIUM_FEE, H.nowTs()).first();
    const payLink = H.paymeCheckoutLinkD1(env, order.id, PROFILE_PREMIUM_FEE);
    return H.json({ orderId: order.id, amount: PROFILE_PREMIUM_FEE, payLink }, 201);
  }

  // ---------- To'lovlar ----------
  const paymentMatch = path.match(/^\/api\/payments\/(\d+)$/);
  if (paymentMatch && method === 'GET') {
    const user = await H.getCurrentUser(request, env);
    if (!user) return H.json({ error: 'unauthorized' }, 401);
    const order = await H.getWebOrderD1(env, Number(paymentMatch[1]));
    if (!order || String(order.userId) !== String(user.id)) return H.json({ error: 'not_found' }, 404);
    return H.json({ id: order.id, kind: order.kind, status: order.status, price: order.price });
  }

  if (path === '/api/payments' && method === 'GET') {
    const user = await H.getCurrentUser(request, env);
    if (!user) return H.json({ error: 'unauthorized' }, 401);
    const rows = await env.DB.prepare(
      `SELECT id, kind, code, price, status, created_at AS createdAt
       FROM web_orders WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 50`
    ).bind(user.id).all();
    const payout = await env.DB.prepare(`SELECT pending_payout AS pendingPayout FROM users WHERE id = ?`).bind(user.id).first();
    const payments = (rows.results || []).map((r) => ({
      id: r.id, kind: r.kind, code: r.code, price: Number(r.price), status: r.status, createdAt: r.createdAt,
    }));
    return H.json({ payments, pendingPayout: payout ? Number(payout.pendingPayout || 0) : 0 });
  }

  // ---------- Public "Sovg'alar" devori ----------
  if (path === '/api/gifts/public' && method === 'GET') {
    const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
    const limit = Math.min(24, Math.max(1, Number(url.searchParams.get('limit')) || 12));
    const setting = await env.DB.prepare(`SELECT value FROM admin_settings WHERE key = 'public_gifts_cutoff'`).first();
    const cutoff = setting?.value || '2099-01-01';
    const offset = (page - 1) * limit;
    // Postgres LATERAL join o'rniga korrelyatsiyalangan sub-so'rovlar
    // (qabul qiluvchining asosiy/eng eski kartasi). from_user_id HECH QACHON
    // tanlanmaydi (privacy).
    const rows = await env.DB.prepare(
      `SELECT g.code, g.decided_at AS date,
              (SELECT name FROM cards WHERE user_id = g.to_user_id ORDER BY is_primary DESC, ts ASC LIMIT 1) AS recipientName,
              (SELECT code FROM cards WHERE user_id = g.to_user_id ORDER BY is_primary DESC, ts ASC LIMIT 1) AS recipientCode,
              COALESCE((SELECT hidden_from_directory FROM cards WHERE user_id = g.to_user_id ORDER BY is_primary DESC, ts ASC LIMIT 1), 1) AS hidden
       FROM gift_offers g
       WHERE g.status = 'accepted' AND g.decided_at >= ?
       ORDER BY g.decided_at DESC LIMIT ? OFFSET ?`
    ).bind(cutoff, limit + 1, offset).all();
    const all = rows.results || [];
    const gifts = all.slice(0, limit).map((r) => {
      const publicRecipient = !r.hidden && r.recipientName;
      return {
        code: r.code,
        recipientName: publicRecipient ? r.recipientName : null,
        recipientCode: publicRecipient ? r.recipientCode : null,
        date: r.date,
      };
    });
    return H.json({ gifts, hasMore: all.length > limit });
  }

  // ---------- Karta amallari (egasi) ----------
  const cardAction = path.match(/^\/api\/records\/([A-Za-z0-9]+)\/(set-primary|order-physical-card|gift)$/);
  if (cardAction && method === 'POST') {
    const code = cardAction[1].toUpperCase();
    const action = cardAction[2];

    if (action === 'set-primary') {
      const user = await H.getCurrentUser(request, env);
      if (!user) return H.json({ error: 'unauthorized' }, 401);
      const owner = await H.getRecordOwner(env, code);
      if (owner == null || String(owner) !== String(user.id)) return H.json({ error: 'forbidden' }, 403);
      await env.DB.batch([
        env.DB.prepare(`UPDATE cards SET is_primary = 0 WHERE user_id = ?`).bind(user.id),
        env.DB.prepare(`UPDATE cards SET is_primary = 1 WHERE code = ? AND user_id = ?`).bind(code, user.id),
      ]);
      return H.json({ ok: true });
    }

    if (action === 'order-physical-card') {
      // Tartib legacy bilan bir xil: payments o'chiq -> 503, keyin auth.
      if (!H.paymentsEnabledD1(env)) return H.json({ error: 'payments_disabled' }, 503);
      const user = await H.getCurrentUser(request, env);
      if (!user) return H.json({ error: 'unauthorized' }, 401);
      const owner = await H.getRecordOwner(env, code);
      if (owner == null || String(owner) !== String(user.id)) return H.json({ error: 'forbidden' }, 403);

      // featureAllowed('physicalCardDesigner', cardAccess(code, user)) — min 'silver'
      const rec = await H.getRecord(env, code);
      const access = rec ? H.effectiveAccessD1({ ...rec, isPremium: !!(rec.isPremium || user.isPremium) }) : 'free';
      if ((ACCESS_RANK[access] ?? 0) < ACCESS_RANK[PHYSICAL_CARD_DESIGNER_MIN]) {
        return H.json({ error: 'feature_locked', feature: 'physicalCardDesigner' }, 403);
      }

      const body = await readJson(request);
      const shippingName = H.cleanStr(body.shippingName, 100);
      const shippingPhone = H.cleanStr(body.shippingPhone, 30);
      const shippingAddress = H.cleanStr(body.shippingAddress, 300);
      if (!shippingName || !shippingPhone || !shippingAddress) return H.json({ error: 'shipping_required' }, 422);

      // ─── BOSMA MAKET ─────────────────────────────────────────────────
      // 2026-09. Avval buyurtma bilan FAQAT yetkazib berish ma'lumotlari
      // kelardi — dizayn foydalanuvchining brauzerida qolib ketardi va
      // admin nima chop etishni bilmasdi. Endi mijoz "buyurtma berish"
      // ni bosganda old va orqa tomon 600 DPI PNG sifatida yuklanadi va
      // havolalari shu yerda saqlanadi.
      //
      // FAQAT O'ZIMIZNING FAYL: mijoz istalgan tashqi manzilni yubora
      // olmasin — admin paneli uni ochadi, ya'ni bu SSRF/fishing yo'li
      // bo'lardi. Shuning uchun havola aynan `/uploads/cardprint_...png`
      // shaklida bo'lishi shart (bu faylni /api/upload-card-print
      // yaratadi va u ham faqat PNG qabul qiladi).
      const printUrl = (value) => {
        const url = H.cleanStr(value, 300);
        return /^\/uploads\/cardprint_[0-9a-f]{24}\.png$/.test(url) ? url : '';
      };
      const designFrontUrl = printUrl(body.designFrontUrl);
      const designBackUrl = printUrl(body.designBackUrl);

      const order = await env.DB.prepare(
        `INSERT INTO web_orders (user_id, code, kind, price, payload, status, created_at)
         VALUES (?, ?, 'physical_card_order', ?, ?, 'pending', ?) RETURNING id`
      ).bind(user.id, code, PHYSICAL_CARD_FEE, JSON.stringify({
        shippingName, shippingPhone, shippingAddress,
        designFrontUrl, designBackUrl,
        // Bosmaxona uchun aniq o'lcham — maket qanday chiqarilgani
        // buyurtmaning o'zida yozib qolsin, keyinchalik format o'zgarsa
        // eski buyurtmalar qaysi o'lchamda ekani ma'lum bo'ladi.
        printSpec: designFrontUrl ? 'CR80 85.6x54mm · 600 DPI · 2022x1276 PNG' : '',
      }), H.nowTs()).first();
      const payLink = H.paymeCheckoutLinkD1(env, order.id, PHYSICAL_CARD_FEE);
      return H.json({ orderId: order.id, amount: PHYSICAL_CARD_FEE, payLink }, 202);
    }

    if (action === 'gift') {
      const user = await H.getCurrentUser(request, env);
      if (!user) return H.json({ error: 'unauthorized' }, 401);
      const body = await readJson(request);
      const toCode = String(body.toCode || '').toUpperCase().trim();
      if (!toCode) return H.json({ error: 'to_code_required' }, 422);

      // server/db.js createGiftOffer — xato kalitlari frontend GIFT_ERRORS bilan bir xil
      const owner = await H.getRecordOwner(env, code);
      if (owner == null || String(owner) !== String(user.id)) return H.json({ error: 'NOT_OWNER' }, 403);
      const card = await env.DB.prepare(`SELECT giftable FROM cards WHERE code = ?`).bind(code).first();
      if (card && !card.giftable) return H.json({ error: 'NOT_GIFTABLE' }, 409);
      const toUserId = await H.getRecordOwner(env, toCode);
      if (toUserId == null) return H.json({ error: 'RECIPIENT_NOT_FOUND' }, 409);
      if (String(toUserId) === String(user.id)) return H.json({ error: 'CANNOT_GIFT_SELF' }, 409);
      const pending = await env.DB.prepare(`SELECT id FROM gift_offers WHERE code = ? AND status = 'pending' LIMIT 1`).bind(code).first();
      if (pending) return H.json({ error: 'ALREADY_PENDING' }, 409);

      const row = await env.DB.prepare(
        `INSERT INTO gift_offers (code, from_user_id, to_user_id, status, created_at) VALUES (?, ?, ?, 'pending', ?) RETURNING id`
      ).bind(code, user.id, toUserId, H.nowTs()).first();
      return H.json({ ok: true, id: row.id }, 201);
    }
  }

  // Foydalanuvchi O'Z NFC ID'sini butunlay o'chiradi (server/db.js deleteOwnCard).
  const deleteMatch = path.match(/^\/api\/records\/([A-Za-z0-9]+)$/);
  if (deleteMatch && method === 'DELETE') {
    const code = deleteMatch[1].toUpperCase();
    if (!H.validCode(code)) return H.json({ error: 'bad_code' }, 400);
    const user = await H.getCurrentUser(request, env);
    if (!user) return H.json({ error: 'unauthorized' }, 401);
    const card = await env.DB.prepare(`SELECT code, user_id AS userId, is_primary AS isPrimary FROM cards WHERE code = ?`).bind(code).first();
    if (!card) return H.json({ error: 'not_found' }, 404);
    if (String(card.userId) !== String(user.id)) return H.json({ error: 'forbidden' }, 403);
    const mine = await env.DB.prepare(`SELECT COUNT(*) AS n FROM cards WHERE user_id = ?`).bind(user.id).first();
    if (Number(mine?.n || 0) <= 1) return H.json({ error: 'last_card' }, 409);

    const now = H.nowTs();
    const stmts = [
      env.DB.prepare(`DELETE FROM post_likes WHERE post_id IN (SELECT id FROM posts WHERE code = ?)`).bind(code),
      env.DB.prepare(`DELETE FROM posts WHERE code = ?`).bind(code),
      env.DB.prepare(`DELETE FROM menu_items WHERE code = ?`).bind(code),
      env.DB.prepare(`DELETE FROM menu_categories WHERE code = ?`).bind(code),
      env.DB.prepare(`DELETE FROM products WHERE code = ?`).bind(code),
      env.DB.prepare(`DELETE FROM product_categories WHERE code = ?`).bind(code),
      env.DB.prepare(`DELETE FROM services WHERE code = ?`).bind(code),
      env.DB.prepare(`DELETE FROM service_categories WHERE code = ?`).bind(code),
      env.DB.prepare(`DELETE FROM card_gallery WHERE code = ?`).bind(code),
      env.DB.prepare(`DELETE FROM card_files WHERE code = ?`).bind(code),
      env.DB.prepare(`DELETE FROM card_videos WHERE code = ?`).bind(code),
      env.DB.prepare(`DELETE FROM card_team WHERE code = ?`).bind(code),
      env.DB.prepare(`DELETE FROM card_leads WHERE code = ?`).bind(code),
      env.DB.prepare(`DELETE FROM card_events WHERE code = ?`).bind(code),
      env.DB.prepare(`DELETE FROM card_likes WHERE code = ?`).bind(code),
      env.DB.prepare(`UPDATE gift_offers SET status = 'cancelled', decided_at = ? WHERE code = ? AND status = 'pending'`).bind(now, code),
      env.DB.prepare(`UPDATE physical_cards SET linked_code = NULL WHERE linked_code = ?`).bind(code),
      env.DB.prepare(`DELETE FROM cards WHERE code = ? AND user_id = ?`).bind(code, user.id),
    ];
    if (card.isPrimary) {
      stmts.push(env.DB.prepare(
        `UPDATE cards SET is_primary = 1 WHERE code = (SELECT code FROM cards WHERE user_id = ? ORDER BY ts ASC LIMIT 1)`
      ).bind(user.id));
    }
    await env.DB.batch(stmts);
    return H.json({ ok: true, freeId: /^[0-9]{8}$/.test(code) });
  }

  // ---------- "GIFT NFC ID" — aktivatsiya oqimi ----------
  const nfcGiftMatch = path.match(/^\/api\/nfc-gifts\/([A-Za-z0-9]+)(?:\/(verify|activate))?$/);
  if (nfcGiftMatch) {
    const code = nfcGiftMatch[1].toUpperCase();
    const step = nfcGiftMatch[2] || '';

    if (!step && method === 'GET') {
      const gift = await env.DB.prepare(
        `SELECT code, recipient_name AS recipientName FROM nfc_gifts WHERE code = ? AND status = 'reserved'`
      ).bind(code).first();
      return H.json({ gift: gift ? { code: gift.code, recipientName: gift.recipientName } : null });
    }

    const verifyActivation = async (activationCode) => {
      const row = await env.DB.prepare(
        `SELECT id FROM nfc_gifts WHERE code = ? AND activation_code = ? AND status = 'reserved'`
      ).bind(code, activationCode.trim().toUpperCase()).first();
      return row ? row.id : null;
    };

    if (step === 'verify' && method === 'POST') {
      const body = await readJson(request);
      const activationCode = String(body.activationCode || '');
      if (!activationCode.trim()) return H.json({ error: 'code_required' }, 422);
      if (!(await verifyActivation(activationCode))) return H.json({ error: 'bad_code' }, 401);
      return H.json({ ok: true });
    }

    if (step === 'activate' && method === 'POST') {
      const body = await readJson(request);
      const activationCode = String(body.activationCode || '');
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');
      const name = H.cleanStr(body.name, 80);
      const username = H.cleanStr(body.username, 40);
      const phone = H.cleanStr(body.phone, 30);
      const avatarUrl = H.uploadOrSafeUrl(body.avatarUrl);
      const bio = H.cleanStr(body.bio, 500);
      const instagram = H.cleanStr(body.instagram, 60).replace(/^@/, '');
      const telegram = H.cleanStr(body.telegram, 60).replace(/^@/, '');
      const youtube = H.safeUrl(body.youtube);
      const tiktok = H.safeUrl(body.tiktok);

      if (!activationCode.trim()) return H.json({ error: 'code_required' }, 422);
      if (!email || !email.includes('@')) return H.json({ error: 'bad_email' }, 422);
      if (password.length < 6) return H.json({ error: 'weak_password' }, 422);
      if (!name) return H.json({ error: 'name_required' }, 422);

      // 0) Aktivatsiya kodi AVVAL — noto'g'ri bo'lsa hech narsa yaratilmaydi.
      const giftId = await verifyActivation(activationCode);
      if (!giftId) return H.json({ error: 'bad_code' }, 401);

      // 1) Foydalanuvchi: mavjud (yarim tugagan urinish) yoki yangi.
      let user = await env.DB.prepare(
        `SELECT id, password_hash AS passwordHash, deleted_at AS deletedAt FROM users WHERE email = ?`
      ).bind(email).first();
      if (user && user.deletedAt) {
        // server/db.js adminDeleteUser tartibi
        // Kontent ham tozalanadi — aks holda kodlar bo'shab, keyin boshqa
        // odamga o'tganda eski postlar/menyu o'sha profilda chiqib qolardi
        // (hosting/api/card-cleanup.js izohiga qarang).
        await env.DB.batch([
          ...cardContentCleanupStmts(env, `SELECT code FROM cards WHERE user_id = ?`, [user.id], H.nowTs()),
          env.DB.prepare(`DELETE FROM physical_cards WHERE owner_user_id = ?`).bind(user.id),
          env.DB.prepare(`DELETE FROM cards WHERE user_id = ?`).bind(user.id),
          env.DB.prepare(`UPDATE auctions SET highest_bidder_id = NULL WHERE highest_bidder_id = ?`).bind(user.id),
          env.DB.prepare(`DELETE FROM users WHERE id = ?`).bind(user.id),
        ]);
        user = null;
      }
      if (user) {
        if (!(await H.verifyPassword(password, user.passwordHash))) return H.json({ error: 'email_taken' }, 409);
      } else {
        const created = await env.DB.prepare(
          `INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?) ON CONFLICT (email) DO NOTHING RETURNING id`
        ).bind(email, await H.hashPassword(password), H.nowTs()).first();
        if (!created) return H.json({ error: 'email_taken' }, 409);
        user = { id: created.id };
        await assignPromoCode(env, user.id);
      }

      // 2) Karta (server/db.js createRecord — ON CONFLICT DO NOTHING).
      const extraLinks = [];
      if (youtube) extraLinks.push({ label: 'YouTube', url: youtube });
      if (tiktok) extraLinks.push({ label: 'TikTok', url: tiktok });
      const ins = await env.DB.prepare(
        `INSERT INTO cards (code, name, role, avatar_url, bg_url, bg_pattern, accent_color, bg_color, bg_animated, music_url,
           tg, phone, email, linkedin, instagram, about, facebook, twitter, website, card_number,
           extra_links, card_numbers, theme, hashtags, price, ts, user_id, source)
         VALUES (?, ?, '', ?, '', 1, NULL, NULL, 1, '[]', ?, ?, '', '', ?, ?, '', '', '', '', ?, '[]', 'classic', '[]', 0, ?, ?, 'gift_activation')
         ON CONFLICT (code) DO NOTHING RETURNING code`
      ).bind(code, username ? `${name} (@${username})` : name, avatarUrl, telegram, phone, instagram, bio,
        JSON.stringify(extraLinks), Date.now(), user.id).first();
      if (!ins) {
        // Karta allaqachon mavjud: BOSHQA odamniki bo'lsa — 409, bizniki/egasiz bo'lsa davom.
        const owner = await H.getRecordOwner(env, code);
        if (owner != null && String(owner) !== String(user.id)) return H.json({ error: 'code_taken' }, 409);
        await env.DB.prepare(`UPDATE cards SET user_id = ? WHERE code = ? AND user_id IS NULL`).bind(user.id, code).run();
      }
      await env.DB.batch([
        env.DB.prepare(`UPDATE cards SET is_primary = 0 WHERE user_id = ?`).bind(user.id),
        env.DB.prepare(`UPDATE cards SET is_primary = 1 WHERE code = ? AND user_id = ?`).bind(code, user.id),
      ]);

      // 3) Sovg'ani "activated" qilish (server/db.js activateNfcGift).
      const taken = await env.DB.prepare(`SELECT user_id AS userId FROM cards WHERE code = ?`).bind(code).first();
      if (taken && taken.userId != null && String(taken.userId) !== String(user.id)) return H.json({ error: 'code_taken' }, 409);
      const activated = await env.DB.prepare(
        `UPDATE nfc_gifts SET status = 'activated', activated_at = ?, activated_by_user_id = ?
         WHERE id = ? AND status = 'reserved' RETURNING id`
      ).bind(H.nowTs(), user.id, giftId).first();
      if (!activated) return H.json({ error: 'bad_code' }, 409);

      // Admin sovg'a qilgan NFC ID'lar har doim "Ekslyuziv".
      await env.DB.prepare(`UPDATE cards SET tier_override = 'exclusive' WHERE code = ?`).bind(code).run().catch(() => {});

      const session = await H.createUserSession(env, user.id, request);
      await H.logAdminActivity(env, { action: 'nfc_gift_activated', details: `${code} — ${email}`, ip: H.reqIp(request) });
      return H.jsonWithCookie({ ok: true, code }, 201, session.cookie);
    }
  }

  return null;
}

// server/db.js assignPromoCode — 6 belgili noyob promokod (8 urinish).
async function assignPromoCode(env, userId) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let i = 0; i < 8; i++) {
    let s = '';
    for (let j = 0; j < 6; j++) s += chars[Math.floor(Math.random() * chars.length)];
    try {
      const row = await env.DB.prepare(
        `UPDATE users SET promo_code = ? WHERE id = ? AND promo_code IS NULL RETURNING promo_code`
      ).bind(s, userId).first();
      if (row) return row.promo_code;
    } catch { /* UNIQUE to'qnashuv — qayta urinamiz */ }
  }
  return null;
}
