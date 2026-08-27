// NFCSTORE Telegram bot — MVP (reja: /start, /katalog, /sotib_olish,
// /mening_buyurtmalarim, admin tasdiqlash). Tashqi kutubxonasiz: faqat
// Node 18+ global fetch orqali Telegram Bot API (long polling).
//
// Kerakli env'lar:
//   TELEGRAM_BOT_TOKEN  — BotFather bergan token
//   ADMIN_CHAT_ID       — adminning Telegram raqamli ID'si (tasdiqlash uchun)
//   STORE_CARD          — to'lov kartasi (masalan 8600 1234 5678 9012)
//   ADMIN_CONTACT       — admin username (masalan @nfcstore_admin)
//
// Paynet avtomatik to'lov (ixtiyoriy, server/paynet.js):
//   PAYNET_MERCHANT_ID / PAYNET_WEBHOOK_LOGIN / PAYNET_WEBHOOK_PASSWORD

import {
  getRecord, createRecord, countRecords, listRecords,
  createBotOrder, getBotOrder, setBotOrderStatus,
  listBotOrdersByUser, latestPendingBotOrder, activeBotOrderByCode,
  listPendingBotOrders, countPaidBotOrders, listActiveBotOrderCodes,
  saveBotVerification,
} from './db.js';
import { priceForCode } from '../src/lib/pricing.js';
import { PREMIUM_GROUPS } from '../src/lib/premiumNames.js';
import { fmt } from '../src/lib/format.js';
import { paynetEnabled, paynetLink } from './paynet.js';

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || '';
const ADMIN_CONTACT = process.env.ADMIN_CONTACT || '@nfcstore_admin';
const STORE_CARD = process.env.STORE_CARD || '';

const STD_CODE_RE = /^[A-Z]{3}[0-9]{3}$/;
const API = `https://api.telegram.org/bot${TOKEN}`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function isAdmin(tgId) {
  return String(ADMIN_CHAT_ID) && String(tgId) === String(ADMIN_CHAT_ID);
}

async function call(method, payload, timeoutMs = 35000) {
  try {
    const res = await fetch(`${API}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const data = await res.json().catch(() => null);
    if (!data || !data.ok) {
      console.error(`[bot] ${method}:`, data ? data.description : 'javob yo\u2019q');
      return null;
    }
    return data.result;
  } catch (err) {
    if (!/timeout|abort/i.test(err.message)) console.error(`[bot] ${method}:`, err.message);
    return null;
  }
}

const sendMessage = (chatId, text, extra = {}) =>
  call('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', ...extra });

async function sendPhoto(chatId, fileId, caption, extra = {}) {
  return call('sendPhoto', { chat_id: chatId, photo: fileId, caption, parse_mode: 'HTML', ...extra });
}

// ---------- Klaviaturalar ----------

const MAIN_KB = {
  keyboard: [
    [{ text: '\u{1F4C2} Katalog' }, { text: '\u{1F6D2} Sotib olish' }],
    [{ text: '\u{1F4E6} Buyurtmalarim' }, { text: '\u260E\uFE0F Admin' }],
    [{ text: '\u{1F4C7} Kontaktni ulashish (ro\u2019yxatdan o\u2019tish uchun)', request_contact: true }],
  ],
  resize_keyboard: true,
};

function orderButtons(orderId) {
  return {
    inline_keyboard: [[
      { text: '\u2705 Tasdiqlash', callback_data: `pay:${orderId}` },
      { text: '\u274C Rad etish', callback_data: `rej:${orderId}` },
    ]],
  };
}

// ---------- Matnlar ----------

async function welcomeText() {
  const sold = await countPaidBotOrders();
  return [
    `\u{1F44B} <b>NFCSTORE</b> botiga xush kelibsiz!`,
    '',
    "Bu yerda nfcstore.uz raqamli tashrif qog'ozi kodlarini sotib olasiz.",
    `\u{1F4CA} Ochiq statistika: <b>${sold}</b> ta muvaffaqiyatli savdo qilingan.`,
    '',
    '<b>Saytda ro\u2019yxatdan o\u2019tishdan oldin:</b>',
    '\u{1F4C7} Pastdagi <b>"Kontaktni ulashish"</b> tugmasini bosing \u2014 shu orqali ism va telefon raqamingiz tasdiqlanadi. Bu jismoniy NFC kartangizni to\u2019g\u2019ri manzilga yetkazib berishimiz uchun kerak.',
    '',
    '<b>Qanday ishlaydi:</b>',
    '1\uFE0F\u20E3 <code>/katalog</code> \u2014 bo\u2019sh kodlarni ko\u2019rasiz',
    '2\uFE0F\u20E3 <code>/sotib_olish VIP777</code> \u2014 buyurtma berishingiz',
    '3\uFE0F\u20E3 Kartaga pul ko\u2019chirib, screenshot yuborasiz',
    `4\uFE0F\u20E3 Admin tasdiqlaydi \u2014 kod sizniki! \u{1F389}`,
    '',
    `\u260E\uFE0F Savollar bo\u2019lsa: ${ADMIN_CONTACT}`,
  ].join('\n');
}

async function catalogText() {
  const records = await listRecords();
  const taken = new Set(records.map((r) => r.code));
  for (const code of await listActiveBotOrderCodes()) taken.add(code);
  const lines = ['\u{1F4C2} <b>Katalog \u2014 chiroyli nomlar</b>', ''];
  for (const group of PREMIUM_GROUPS) {
    lines.push(`<b>${group.label}</b>`);
    for (const code of group.codes) {
      const info = priceForCode(code);
      const priceText = info.tier === 'exclusive' ? "Faqat auksion" : `${fmt(info.total)} so\u2019m`;
      lines.push(`${taken.has(code) ? '\u274C' : '\u2705'} <code>${code}</code> \u2014 ${priceText}`);
    }
    lines.push('');
  }
  lines.push('Sotib olish uchun: <code>/sotib_olish KOD</code>');
  return lines.join('\n');
}

// ---------- Handlerlar ----------

async function startPurchase(chatId, from, rawCode) {
  const code = String(rawCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!STD_CODE_RE.test(code)) {
    return sendMessage(chatId, '\u26D4 Format noto\u2019g\u2019ri. Masalan: <code>/sotib_olish VIP777</code>');
  }

  if (await getRecord(code)) {
    return sendMessage(chatId, `\u274C <code>${code}</code> allaqachon band qilingan.`);
  }
  if (await activeBotOrderByCode(code)) {
    return sendMessage(chatId, `\u23F3 <code>${code}</code> bo\u2019yicha to\u2019lov kutilmoqda. Keyinroq urinib ko\u2019ring.`);
  }
  if (priceForCode(code).tier === 'exclusive') {
    return sendMessage(chatId, `\u{1F48E} <code>${code}</code> \u2014 EKSLYUZIV kod, faqat saytdagi auksion orqali sotiladi. nfcstore.uz saytida "Auksion" bo\u2019limiga o\u2019ting.`);
  }

  const price = priceForCode(code).total;
  const order = await createBotOrder({
    tgUserId: from.id,
    tgUsername: from.username || null,
    tgName: [from.first_name, from.last_name].filter(Boolean).join(' ') || null,
    code,
    price,
  });
  if (!order) return sendMessage(chatId, '\u26A0\uFE0F Xatolik, qayta urinib ko\u2019ring.');

  const lines = [
    `\u{1F6D2} <b>Buyurtma #${order.id}</b> qabul qilindi`,
    '',
    `Kod: <code>${code}</code>`,
    `Narx: <b>${fmt(price)} so\u2019m</b>`,
    '',
    STORE_CARD
      ? `<b>To\u2019lov uchun karta:</b>\n<code>${STORE_CARD}</code>`
      : '\u26A0\uFE0F Karta ma\u2019lumoti sozlanmagan \u2014 admin bilan bog\u2019laning.',
    '',
    '\u{1F4F8} To\u2019lov qilgach, <b>screenshotni shu chatga yuboring</b>.',
    'Admin tasdiqlagach kod sizning bo\u2019ladi!',
  ];
  await sendMessage(chatId, lines.join('\n'), { reply_markup: MAIN_KB });

  // Paynet ulangan bo'lsa: onlayn to'lov tugmasi — webhook o'zi tasdiqlaydi.
  const payUrl = paynetEnabled() ? paynetLink(order.id, price) : '';
  if (payUrl) {
    await sendMessage(
      chatId,
      '\u{1F4B3} Yoki <b>Paynet</b> orqali to\u2019lang \u2014 kod <b>avtomatik</b> band qilinadi:',
      {
        reply_markup: {
          inline_keyboard: [[{ text: `\u2705 To\u2019lash \u2014 ${fmt(price)} so\u2019m`, url: payUrl }]],
        },
      }
    );
  }
  return undefined;
}

async function handleScreenshot(msg) {
  const chatId = msg.chat.id;
  const order = await latestPendingBotOrder(msg.from.id);
  if (!order) {
    return sendMessage(
      chatId,
      '\u{1F914} Avval buyurtma bering: <code>/sotib_olish VIP777</code>',
      { reply_markup: MAIN_KB }
    );
  }
  const photos = msg.photo || [];
  const best = photos[photos.length - 1];
  if (!best) return;

  await setBotOrderStatus(order.id, 'pending', best.file_id);

  await sendMessage(chatId, [
    `\u2705 Screenshot <b>#${order.id}</b> buyurtmaga biriktirildi.`,
    'Admin tez orada tekshiradi \u23F3',
    '',
    `\u{1F4CB} Kod: <code>${order.code}</code> \u2014 ${fmt(order.price)} so\u2019m`,
  ].join('\n'));

  if (!isAdmin(msg.chat.id)) {
    const who = msg.from.username ? '@' + msg.from.username : (msg.from.first_name || '');
    await sendPhoto(
      ADMIN_CHAT_ID || msg.chat.id,
      best.file_id,
      [
        `\u{1F195} <b>Yangi to\u2019lov screenshoti</b>`,
        `Buyurtma: <b>#${order.id}</b>`,
        `Kod: <code>${order.code}</code> \u2014 ${fmt(order.price)} so\u2019m`,
        `Mijoz: ${who} (<code>${msg.from.id}</code>)`,
      ].join('\n'),
      { reply_markup: orderButtons(order.id) }
    );
  }
}

async function myOrders(chatId, tgUserId) {
  const orders = await listBotOrdersByUser(tgUserId);
  if (!orders.length) {
    return sendMessage(chatId, 'Hozircha buyurtmalaringiz yo\u2019q. \nKatalogdan boshlang: <code>/katalog</code>', { reply_markup: MAIN_KB });
  }
  const icon = { pending: '\u23F3', paid: '\u2705', rejected: '\u274C', cancelled: '\u{1F6AB}' };
  const lines = ['\u{1F4E6} <b>Buyurtmalarim</b>', ''];
  for (const o of orders) {
    lines.push(`${icon[o.status] || '\u2022'} <b>#${o.id}</b> \u2014 <code>${o.code}</code> (${fmt(o.price)} so\u2019m)`);
  }
  return sendMessage(chatId, lines.join('\n'), { reply_markup: MAIN_KB });
}

async function adminListPending(chatId) {
  const orders = await listPendingBotOrders();
  if (!orders.length) return sendMessage(chatId, 'Pending buyurtma yo\u2019q.');
  for (const o of orders) {
    const who = o.tgUsername ? '@' + o.tgUsername : (o.tgName || o.tgUserId);
    const text = [
      `\u23F3 <b>#${o.id}</b> \u2014 <code>${o.code}</code> (${fmt(o.price)} so\u2019m)`,
      `Mijoz: ${who} (<code>${o.tgUserId}</code>)`,
      `Screenshot: ${o.screenshotFileId ? 'bor' : 'yo\u2019q'}`,
    ].join('\n');
    await sendMessage(chatId, text);
  }
}

async function handleCallback(cb) {
  const data = cb.data || '';
  const [, action, idStr] = data.match(/^([a-z]+):(\d+)$/) || [];
  if (!action) return;
  const orderId = Number(idStr);
  if (!isAdmin(cb.from.id)) {
    return call('answerCallbackQuery', { callback_query_id: cb.id, text: 'Faqat admin uchun.' });
  }
  const order = await getBotOrder(orderId);
  if (!order || order.status !== 'pending') {
    return call('answerCallbackQuery', { callback_query_id: cb.id, text: 'Buyurtma topilmadi/yopilgan.' });
  }

  if (action === 'pay') {
    await setBotOrderStatus(orderId, 'paid');
    // Sayt bilan sinxron: kodni band qilib qo'yamiz (saytda "Band" chiqadi).
    if (!(await getRecord(order.code))) {
      await createRecord({ code: order.code, name: 'TELEGRAM MIJOZ', price: order.price });
    }
    await sendMessage(order.tgUserId, [
      `\u{1F389} <b>To\u2019lovingiz tasdiqlandi!</b>`,
      '',
      `Kod: <code>${order.code}</code> endi sizniki.`,
      'Profil sozlash: https://nfcstore.uz/register yoki admin bilan bog\u2019laning.',
    ].join('\n'));
    await call('answerCallbackQuery', { callback_query_id: cb.id, text: 'Tasdiqlandi \u2705' });
    return call('editMessageReplyMarkup', { chat_id: cb.message.chat.id, message_id: cb.message.message_id });
  }

  if (action === 'rej') {
    await setBotOrderStatus(orderId, 'rejected');
    await sendMessage(order.tgUserId, [
      `\u274C <b>#${orderId}</b> buyurtma rad etildi.`,
      'Sababini bilish uchun admin bilan bog\u2019laning: ' + ADMIN_CONTACT,
    ].join('\n'));
    await call('answerCallbackQuery', { callback_query_id: cb.id, text: 'Rad etildi' });
    return call('editMessageReplyMarkup', { chat_id: cb.message.chat.id, message_id: cb.message.message_id });
  }
}

// Paynet webhook'i to'lovni tasdiqlaganda mijozga va adminga xabar.
// index.js tomonidan chaqiriladi (fire-and-forget).
export async function notifyOrderPaidAuto(order) {
  try {
    await sendMessage(order.tgUserId, [
      `\u{1F389} <b>To\u2019lov qabul qilindi!</b>`,
      '',
      `Kod: <code>${order.code}</code> endi sizniki.`,
      `Buyurtma: <b>#${order.id}</b> \u2014 ${fmt(order.price)} so\u2019m`,
      '',
      'Profil sozlash: https://nfcstore.uz/register yoki admin bilan bog\u2019laning.',
    ].join('\n'));
  } catch (err) {
    console.error('[bot] Mijozga avto-xabar yuborilmadi:', err.message);
  }
  try {
    if (!isAdmin(order.tgUserId)) {
      const who = order.tgUsername ? '@' + order.tgUsername : (order.tgName || order.tgUserId);
      await sendMessage(
        ADMIN_CHAT_ID || order.tgUserId,
        `\u{1F916} Paynet orqali <b>#${order.id}</b> AVTOMATIK tasdiqlandi\nKod: <code>${order.code}</code>\nMijoz: ${who}`
      );
    }
  } catch {}
}

async function handleMessage(msg) {
  const chatId = msg.chat.id;
  const from = msg.from || {};
  const text = String(msg.text || '').trim();

  if (msg.photo && !text.startsWith('/')) return handleScreenshot(msg);

  // Foydalanuvchi "Kontaktni ulashish" tugmasini bosdi — telefon raqami va
  // ismi shu yerdan KELADI (Telegram tomonidan tasdiqlangan, soxta bo'lishi
  // mumkin emas). Buni bot_verifications'ga yozamiz — saytda ro'yxatdan
  // o'tishda shu jadval bilan tekshiriladi.
  if (msg.contact) {
    // Faqat o'zining kontaktini ulashishi kerak (boshqa birovnikini emas).
    if (msg.contact.user_id && msg.contact.user_id !== from.id) {
      return sendMessage(chatId, "\u26A0\uFE0F Iltimos, o'zingizning kontaktingizni ulashing.", { reply_markup: MAIN_KB });
    }
    let phone = String(msg.contact.phone_number || '').replace(/[\s\-()]/g, '');
    if (phone && !phone.startsWith('+')) phone = '+' + phone;
    const name = [msg.contact.first_name, msg.contact.last_name].filter(Boolean).join(' ') || from.username || String(from.id);
    try {
      await saveBotVerification({ phone, tgUserId: from.id, tgName: name });
      return sendMessage(
        chatId,
        `\u2705 Rahmat, <b>${name}</b>! Kontaktingiz tasdiqlandi.\n\nEndi saytda ro'yxatdan o'tishda aynan shu telefon raqamni (<code>${phone}</code>) kiriting — tizim avtomatik tasdiqlaydi.`,
        { reply_markup: MAIN_KB }
      );
    } catch (err) {
      console.error('[bot] saveBotVerification:', err.message);
      return sendMessage(chatId, "Xatolik yuz berdi, birozdan keyin qayta urinib ko'ring.", { reply_markup: MAIN_KB });
    }
  }

  const lower = text.toLowerCase();
  if (lower.startsWith('/start')) {
    return sendMessage(chatId, await welcomeText(), { reply_markup: MAIN_KB });
  }
  if (lower.startsWith('/katalog') || lower.includes('katalog')) {
    return sendMessage(chatId, await catalogText(), { reply_markup: MAIN_KB });
  }
  if (lower.startsWith('/mening_buyurtmalarim') || lower.includes('buyurtmalarim')) {
    return myOrders(chatId, from.id);
  }
  if (lower.startsWith('/admin') || lower.includes('admin')) {
    return sendMessage(chatId, `\u260E\uFE0F Admin bilan bog\u2019lanish: ${ADMIN_CONTACT}`, { reply_markup: MAIN_KB });
  }
  if (isAdmin(from.id) && lower.startsWith('/buyurtmalar')) {
    return adminListPending(chatId);
  }

  // /sotib_olish VIP77 yoki shunchaki "VIP77" yozilsa ham ishlaydi.
  let arg = null;
  if (lower.startsWith('/sotib_olish')) {
    arg = text.split(/\s+/)[1] || null;
  } else if (/^[a-z0-9]{6,7}$/i.test(text.replace(/\s/g, ''))) {
    arg = text;
  }
  if (arg) return startPurchase(chatId, from, arg);

  return sendMessage(chatId, await welcomeText(), { reply_markup: MAIN_KB });
}

// ---------- Long polling ----------

let offset = 0;
let running = false;

export function startBot() {
  if (!TOKEN) {
    console.warn('[bot] TELEGRAM_BOT_TOKEN kiritilmagan \u2014 bot o\u2019chirilgan.');
    return;
  }
  if (running) return;
  running = true;
  console.log('[bot] Long polling boshlandi.');
  poll();
}

async function poll() {
  for (;;) {
    try {
      const res = await fetch(`${API}/getUpdates?timeout=30&offset=${offset}`, {
        signal: AbortSignal.timeout(40000),
      });
      const data = await res.json().catch(() => null);
      if (!data || !data.ok) {
        console.error('[bot] getUpdates:', data ? data.description : 'javob yo\u2019q');
        await sleep(3000);
        continue;
      }
      for (const update of data.result || []) {
        offset = update.update_id + 1;
        try {
          if (update.callback_query) await handleCallback(update.callback_query);
          else if (update.message) await handleMessage(update.message);
        } catch (err) {
          console.error('[bot] update:', err.message);
        }
      }
    } catch (err) {
      if (!/timeout|abort/i.test(err.message)) console.error('[bot] polling:', err.message);
      await sleep(3000);
    }
  }
}
