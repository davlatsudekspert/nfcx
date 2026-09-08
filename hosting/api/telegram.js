// hosting/api/telegram.js — Telegram bot webhook'i (long polling o'rniga) va
// bot nomi endpoint'i. CONTRACT.md ga qarang. Route topilmasa null qaytaradi.
//
//   POST /api/telegram/webhook  — Telegram'dan Update; header
//                                 x-telegram-bot-api-secret-token === env.TELEGRAM_WEBHOOK_SECRET
//                                 → doim 200 {ok:true} (Telegram qayta yubormasin)
//                                 | 401 {error:'unauthorized'} | 503 {error:'telegram_webhook_not_configured'}
//   GET  /api/telegram/bot      — {username: env.TELEGRAM_BOT_USERNAME || null}
//
// Bot faqat bitta ish qiladi: "Kontaktni ulashish" orqali telefon raqamini
// tasdiqlab bot_verifications'ga yozadi (saytda ro'yxatdan o'tish shu jadval
// bilan tekshiriladi — server/bot.js dagi handleMessage porti).

const CONTACT_KB = {
  keyboard: [[{ text: '📇 Kontaktni ulashish (ro’yxatdan o’tish uchun)', request_contact: true }]],
  resize_keyboard: true,
};

const WELCOME_TEXT = [
  '👋 <b>NFCSTORE</b> botiga xush kelibsiz!',
  '',
  '📇 Pastdagi <b>"Kontaktni ulashish"</b> tugmasini bosing — shu orqali ism va telefon raqamingiz tasdiqlanadi. Bu jismoniy NFC kartangizni to’g’ri manzilga yetkazib berishimiz uchun kerak.',
  '',
  '🔒 <b>Biz sizdan hech qachon kod so’ramaymiz.</b> Kim bo’lishidan qat’i nazar, Telegramga kelgan kodni hech kimga bermang.',
].join('\n');

// Saytdan kelgan bir martalik token bilan kirganda ko'rsatiladigan matn.
// Bu yerda odam saytga HECH NARSA ko'chirmasligini alohida aytamiz —
// aynan shu qo'rquv oldingi oqimda odamlarni to'xtatib turardi.
const LINK_TEXT = [
  '👋 <b>NFCSTORE</b> — raqamni tasdiqlash.',
  '',
  '📇 Pastdagi <b>"Kontaktni ulashish"</b> tugmasini bosing — tamom. Sayt o’zi davom etadi.',
  '',
  '🔒 <b>Sizdan kod so’ralmaydi</b> va saytga hech narsa ko’chirmaysiz.',
].join('\n');

// Telegram'ga javob — reply_markup kerak bo'lgani uchun H.sendTelegramTo emas,
// to'g'ridan-to'g'ri sendMessage. Xato bo'lsa jim (webhook baribir 200 qaytaradi).
async function reply(env, chatId, text, extra = {}) {
  if (!env.TELEGRAM_BOT_TOKEN || !chatId) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', ...extra }),
    });
    const data = await res.json().catch(() => null);
    return !!data?.ok;
  } catch { return false; }
}

// Telefon: legacy kabi bo'sh joy/chiziq/qavs olib tashlanadi, "+" bilan.
function normContactPhone(v) {
  let phone = String(v || '').replace(/[\s\-()]/g, '');
  if (phone && !phone.startsWith('+')) phone = '+' + phone;
  return /^\+\d{9,15}$/.test(phone) ? phone : '';
}

// bot_verifications: raqam UNIQUE — qayta ulashsa tg_user_id/tg_name yangilanadi.
async function upsertBotVerification(env, H, { phone, tgUserId, tgName }) {
  await env.DB.prepare(
    `INSERT INTO bot_verifications (phone, tg_user_id, tg_name, created_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (phone) DO UPDATE SET tg_user_id = excluded.tg_user_id, tg_name = excluded.tg_name, created_at = excluded.created_at`
  ).bind(phone, tgUserId, tgName || null, H.nowTs()).run();
}

// ---------- saytdan kelgan bir martalik token ----------
//
// Token bazada XESH holida yotadi. Bot uni shu odamga biriktiradi
// (`status` hali 'pending'), raqam esa "Kontaktni ulashish" bosilganda
// yoziladi va status 'linked' bo'ladi. Faqat shundan keyin sayt davom
// etadi.
async function claimLinkToken(env, H, token, tgUserId) {
  const res = await env.DB.prepare(
    `UPDATE tg_link_tokens SET tg_user_id = ? WHERE token = ? AND status = 'pending' AND expires_at > ?`
  ).bind(tgUserId, await H.sha256Hex(String(token).toLowerCase()), Date.now()).run().catch(() => null);
  return !!res?.meta?.changes;
}

// Shu odamning eng so'nggi kutayotgan tokenini tasdiqlaydi. Raqam
// TELEGRAM tomonidan tasdiqlangan kontaktdan olinadi — ya'ni saytga
// boshqa birovning raqamini yozib bo'lmaydi.
async function confirmPendingLink(env, tgUserId, phone, name) {
  const res = await env.DB.prepare(
    `UPDATE tg_link_tokens SET status = 'linked', phone = ?, tg_name = ?
      WHERE token = (SELECT token FROM tg_link_tokens
                      WHERE tg_user_id = ? AND status = 'pending' AND expires_at > ?
                      ORDER BY created_at DESC LIMIT 1)`
  ).bind(phone, name || null, tgUserId, Date.now()).run().catch(() => null);
  return !!res?.meta?.changes;
}

async function handleMessage(env, H, msg) {
  const chatId = msg?.chat?.id;
  const from = msg?.from || {};
  if (!chatId) return;

  // Foydalanuvchi "Kontaktni ulashish" tugmasini bosdi — raqam Telegram
  // tomonidan tasdiqlangan. Faqat O'ZINING kontakti qabul qilinadi.
  if (msg.contact) {
    if (!msg.contact.user_id || msg.contact.user_id !== from.id) {
      return reply(env, chatId, "⚠️ Iltimos, o'zingizning kontaktingizni ulashing.", { reply_markup: CONTACT_KB });
    }
    const phone = normContactPhone(msg.contact.phone_number);
    if (!phone) return reply(env, chatId, "⚠️ Telefon raqami o'qilmadi, qayta urinib ko'ring.", { reply_markup: CONTACT_KB });
    const name = [msg.contact.first_name, msg.contact.last_name].filter(Boolean).join(' ') || from.username || String(from.id);
    try {
      await upsertBotVerification(env, H, { phone, tgUserId: from.id, tgName: name });
    } catch (err) {
      console.error('[telegram] bot_verifications upsert', err);
      return reply(env, chatId, "Xatolik yuz berdi, birozdan keyin qayta urinib ko'ring.", { reply_markup: CONTACT_KB });
    }
    // Odam saytdagi havola orqali kelgan bo'lsa, o'sha kutayotgan token
    // shu yerda TASDIQLANADI va sayt o'zi davom etadi. Odam saytga
    // hech narsa ko'chirmaydi.
    const linked = await confirmPendingLink(env, from.id, phone, name);
    if (linked) {
      return reply(env, chatId,
        `✅ Raqam tasdiqlandi ✅\n\nRahmat, <b>${name}</b>! Endi saytga qayting — ro'yxatdan o'tish o'zi davom etadi.`,
        { reply_markup: { remove_keyboard: true } });
    }
    return reply(env, chatId,
      `✅ Raqam tasdiqlandi ✅\n\nRahmat, <b>${name}</b>! Endi saytda shu raqam (<code>${phone}</code>) bilan davom eting.`,
      { reply_markup: { remove_keyboard: true } });
  }

  const raw = String(msg.text || '').trim();
  const startMatch = /^\/start(?:@\S+)?(?:\s+([0-9a-fA-F]{32}))?$/.exec(raw);
  if (startMatch) {
    // Token bo'lsa — uni shu odamga biriktiramiz. Raqam hali yo'q:
    // u "Kontaktni ulashish" bosilganda keladi.
    if (startMatch[1] && await claimLinkToken(env, H, startMatch[1], from.id)) {
      return reply(env, chatId, LINK_TEXT, { reply_markup: CONTACT_KB });
    }
    return reply(env, chatId, WELCOME_TEXT, { reply_markup: CONTACT_KB });
  }
  // Boshqa har qanday matn — yana yo'riqnoma (bot faqat raqam tasdiqlaydi).
  return reply(env, chatId, WELCOME_TEXT, { reply_markup: CONTACT_KB });
}

async function webhook(request, env, H) {
  if (!env.TELEGRAM_WEBHOOK_SECRET) return H.json({ error: 'telegram_webhook_not_configured' }, 503);
  if (request.headers.get('x-telegram-bot-api-secret-token') !== env.TELEGRAM_WEBHOOK_SECRET) {
    return H.json({ error: 'unauthorized' }, 401);
  }
  const update = await request.json().catch(() => null);
  const msg = update?.message;
  if (msg) {
    try { await handleMessage(env, H, msg); }
    catch (err) { console.error('[telegram] webhook', err); }
  }
  // Telegram 2xx kutadi — aks holda Update'ni qayta-qayta yuboradi.
  return H.json({ ok: true });
}

export async function handle(request, env, url, H) {
  if (url.pathname === '/api/telegram/webhook' && request.method === 'POST') return webhook(request, env, H);
  if (url.pathname === '/api/telegram/bot' && request.method === 'GET') {
    return H.json({ username: env.TELEGRAM_BOT_USERNAME || null });
  }
  return null;
}
