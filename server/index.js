import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { priceFor, priceForCode } from '../src/lib/pricing.js';
import {
  initDb, isDbReady,
  listRecords, getRecord, createRecord, countRecords, incrementViews,
  createUser, getUserByEmail, updateUserPassword, createSession, getSessionUser, deleteSession,
  attachCardToUser, listRecordsByUser, updateRecord, getRecordOwner,
  listForSale, setForSale, transferCard,
  getBotOrder, setBotOrderStatus,
  createWebOrder, getWebOrder, activeWebOrderByCode, listWebOrdersByUser,
  finalizePaidWebOrder, cancelPendingWebOrder,
  createAuction, getActiveAuctionByCode, getAuction, listActiveAuctions, listExpiredActiveAuctions,
  listBidsByAuction, placeBid, closeAuctionBidding, expireUnpaidAuctions,
  setAuctionSellerPayme, markAuctionPayoutPaid,
  isPhoneBotVerified,
  createPhysicalCard, resolvePhysicalCard,
  requestPremium, getOwnerByCode,
  followUserFree, unfollowUser, getFollowStats,
  listUserPayments, getPendingPayout,
  getOrCreateConversation, listConversations, isConversationParticipant, listMessages,
  sendMessage, markConversationRead, totalUnreadCount,
} from './db.js';
import {
  hashPassword, verifyPassword, newSessionToken,
  sessionCookie, clearedSessionCookie, sessionTokenFromReq,
} from './auth.js';
import fs from 'fs/promises';
import crypto from 'crypto';
import { startBot, notifyOrderPaidAuto } from './bot.js';
import { paynetEnabled, paynetLink, verifyPaynetAuth, parsePaynetCallback } from './paynet.js';
import { paymeEnabled, paymeCheckoutLink, verifyPaymeAuth, handlePaymeRequest } from './payme.js';
import { adminRouter } from './admin.js';

const AUCTION_COMMISSION_PCT = Number(process.env.AUCTION_COMMISSION_PCT || 5);
const AUCTION_MAX_HOURS = 72;
const PHYSICAL_CARD_FEE = 200_000;  // Jismoniy karta narxi
const PREMIUM_UPGRADE_FEE = 5_000;  // Premium profil bo'lish narxi
// Diqqat: obuna (follow) bepul — quyidagi ikkita o'zgaruvchi endi
// ishlatilmaydi, lekin kelajakda kerak bo'lib qolsa deb saqlab qo'yildi.
// const PREMIUM_FOLLOW_FEE = 500;
// const PREMIUM_FOLLOW_COMMISSION_PCT = Number(process.env.PREMIUM_FOLLOW_COMMISSION_PCT || 5);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;
const STD_CODE_RE = /^[A-Z]{3}[0-9]{3}$/;      // standart: AAA000
const LETTER_CODE_RE = /^[A-Z]{3,12}$/;         // premium: faqat harflar — ALI, UZBEKISTAN
const RESERVED_CODES = new Set([
  'LOGIN', 'REGISTER', 'ACCOUNT', 'API', 'ADMIN', 'STATIC', 'UPLOADS', 'AUKSION', 'XABARLAR', 'TOLOVLAR',
]);

function validCode(code) {
  return STD_CODE_RE.test(code) || LETTER_CODE_RE.test(code);
}

// Faqat harflardan iborat premium vizitka (nfcstore.uz/ali)?
function isLetterCode(code) {
  return LETTER_CODE_RE.test(code);
}

const THEME_WHITELIST = ['classic', 'midnight', 'emerald', 'royal', 'sunset', 'gold'];

const app = express();
app.disable('x-powered-by');
// Railway reverse-proxy orqali: haqiqiy IP/protokolni olamiz.
app.set('trust proxy', 1);
// Diqqat: bu global limit BARCHA so'rovlarga tegishli va marshrut ichidagi
// alohida express.json({limit}) chaqiruvlaridan OLDIN ishlaydi — shuning
// uchun eng katta ehtiyoj (musiqa fayli, ~8MB) ga mos qilib shu yerda
// belgilanishi kerak, aks holda pastdagi marshrutlarning o'z limiti
// hech qachon qo'llanilmaydi (so'rov bundan oldinroq rad etiladi).
app.use(express.json({ limit: '12mb' }));
app.use('/api/admin', adminRouter);

// Oddiy xavfsizlik headerlari.
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

function isSecureReq(req) {
  return req.secure || req.headers['x-forwarded-proto'] === 'https';
}

// ---------- Rate limit (brute-force himoyasi, in-memory) ----------

function rateLimit({ windowMs, max, keyFn }) {
  const hits = new Map();
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, arr] of hits) {
      const fresh = arr.filter((t) => now - t < windowMs);
      if (fresh.length) hits.set(key, fresh); else hits.delete(key);
    }
  }, Math.min(windowMs, 60_000));
  timer.unref();
  return (req, res, next) => {
    if (!isDbReady()) return next();
    const key = keyFn ? keyFn(req) : req.ip || '?';
    const now = Date.now();
    const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
    if (arr.length >= max) {
      return res.status(429).json({ error: 'too_many_requests' });
    }
    arr.push(now);
    hits.set(key, arr);
    next();
  };
}

const authLimiter = rateLimit({ windowMs: 60_000, max: 20 });
const loginLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 10,
  keyFn: (req) => `${req.ip}:${String((req.body || {}).email || '').toLowerCase()}`,
});

function cleanStr(v, max) {
  if (typeof v !== 'string') return '';
  return v.trim().slice(0, max);
}

function safeUrl(v) {
  const s = cleanStr(v, 500);
  if (!s) return '';
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:' ? s : '';
  } catch {
    return '';
  }
}

function validateBody(body) {
  const name = cleanStr(body.name, 80);
  if (!name) return { error: "Ism bo'sh bo'lishi mumkin emas." };
  let hashtags = [];
  if (Array.isArray(body.hashtags)) {
    hashtags = body.hashtags
      .map((h) => cleanStr(h, 30).replace(/^#/, ''))
      .filter(Boolean)
      .slice(0, 20);
  }
  // Xohlagancha qo'shimcha havola (label + url), max 20 ta.
  let extraLinks = [];
  if (Array.isArray(body.extraLinks)) {
    extraLinks = body.extraLinks
      .map((l) => ({ label: cleanStr(l && l.label, 40), url: safeUrl(l && l.url) }))
      .filter((l) => l.url)
      .slice(0, 20);
  }
  // Xohlagancha to'lov karta raqami (label + number), max 10 ta.
  let cardNumbers = [];
  if (Array.isArray(body.cardNumbers)) {
    cardNumbers = body.cardNumbers
      .map((c) => ({
        label: cleanStr(c && c.label, 30),
        number: cleanStr(c && c.number, 34).replace(/\s+/g, ' '),
      }))
      .filter((c) => c.number)
      .slice(0, 10);
  }
  const theme = THEME_WHITELIST.includes(body.theme) ? body.theme : 'classic';
  // Avatar: tashqi havola yoki /uploads/... (serverga yuklangan rasm).
  let avatarUrl = safeUrl(body.avatarUrl);
  if (!avatarUrl && typeof body.avatarUrl === 'string' && body.avatarUrl.startsWith('/uploads/')) {
    avatarUrl = cleanStr(body.avatarUrl, 300).replace(/[^\w\-./]/g, '');
  }
  // Fon rasmi: xuddi avatar kabi — tashqi havola yoki /uploads/...
  let bgUrl = safeUrl(body.bgUrl);
  if (!bgUrl && typeof body.bgUrl === 'string' && body.bgUrl.startsWith('/uploads/')) {
    bgUrl = cleanStr(body.bgUrl, 300).replace(/[^\w\-./]/g, '');
  }
  // Diagonal naqshli fon — foydalanuvchi o'chirib qo'yishi mumkin
  // (standart holatda yoqilgan, eski ko'rinishni buzmaslik uchun).
  const bgPattern = body.bgPattern === false ? false : true;
  // Foydalanuvchi tanlagan istalgan aksent rang (#rrggbb) — faqat qat'iy
  // hex formatidagi qiymatlarga ruxsat beramiz (XSS/CSS-injection'dan himoya).
  const accentColor = /^#[0-9a-fA-F]{6}$/.test(String(body.accentColor || '').trim())
    ? String(body.accentColor).trim()
    : '';
  // Fon rangi — profil foni uchun alohida (aksent rangdan mustaqil).
  const bgColor = /^#[0-9a-fA-F]{6}$/.test(String(body.bgColor || '').trim())
    ? String(body.bgColor).trim()
    : '';
  // Fon qimirlab turadigan animatsiyami — standart holatda yoqilgan.
  const bgAnimated = body.bgAnimated === false ? false : true;
  // Profil musiqasi — tashqi havola YOKI serverga yuklangan /uploads/...
  // fayli (xuddi avatar/fon rasmi kabi).
  let musicUrl = safeUrl(body.musicUrl);
  if (!musicUrl && typeof body.musicUrl === 'string' && body.musicUrl.startsWith('/uploads/')) {
    musicUrl = cleanStr(body.musicUrl, 300).replace(/[^\w\-./]/g, '');
  }
  return {
    record: {
      name,
      role: cleanStr(body.role, 100),
      avatarUrl,
      bgUrl,
      bgPattern,
      accentColor,
      bgColor,
      bgAnimated,
      musicUrl,
      tg: cleanStr(body.tg, 40).replace(/^@/, ''),
      phone: cleanStr(body.phone, 24),
      email: cleanStr(body.email, 120),
      linkedin: cleanStr(body.linkedin, 200),
      instagram: cleanStr(body.instagram, 40).replace(/^@/, ''),
      about: cleanStr(body.about, 600),
      facebook: cleanStr(body.facebook, 60).replace(/^@/, ''),
      twitter: cleanStr(body.twitter, 60).replace(/^@/, ''),
      website: safeUrl(body.website),
      cardNumber: cleanStr(body.cardNumber, 34).replace(/\s+/g, ' '),
      extraLinks,
      cardNumbers,
      theme,
      hashtags,
    },
  };
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true, db: isDbReady() });
});

// Jismoniy karta tap qilinganda: chip ichiga yozilgan token (?t=...) shu
// yerdan tekshiriladi. Frontend ProfilePage bu javobni ko'rib, agar
// active=false bo'lsa "karta faol emas" xabarini ko'rsatadi, aks holda
// oddiy profil sifatida davom etadi (parametrni URL'dan olib tashlaydi).
app.get('/api/tap/:chipToken', async (req, res) => {
  if (!isDbReady()) return res.json({ active: true }); // baza yo'q — bloklamaymiz
  const card = await resolvePhysicalCard(req.params.chipToken);
  if (!card) return res.json({ active: true }); // noma'lum token — jim o'tkazib yuboramiz
  res.json({ active: card.active, linkedCode: card.linkedCode });
});

// ---------- Premium profil ----------

app.post('/api/premium/request', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  if (!paymeEnabled()) return res.status(503).json({ error: 'payme_disabled' });
  try {
    const result = await requestPremium(user.id, PREMIUM_UPGRADE_FEE);
    if (result.error) return res.status(409).json(result);
    const payLink = paymeCheckoutLink(result.orderId, PREMIUM_UPGRADE_FEE);
    res.status(201).json({ orderId: result.orderId, amount: PREMIUM_UPGRADE_FEE, payLink });
  } catch (err) {
    console.error('[api] requestPremium:', err.message);
    res.status(503).json({ error: 'db_unavailable' });
  }
});

// ---------- Obuna (follow) ----------

app.post('/api/follow/:code', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  const code = String(req.params.code || '').toUpperCase();
  try {
    const ownerId = await getOwnerByCode(code);
    if (!ownerId) return res.status(404).json({ error: 'NOT_FOUND' });

    // Obuna endi har doim bepul — premium yoki oddiy profil farqsiz.
    const result = await followUserFree(user.id, ownerId);
    if (result.error) return res.status(409).json(result);
    res.json(result);
  } catch (err) {
    console.error('[api] followUser:', err.message);
    res.status(503).json({ error: 'db_unavailable' });
  }
});

app.post('/api/unfollow/:code', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  const code = String(req.params.code || '').toUpperCase();
  const ownerId = await getOwnerByCode(code);
  if (!ownerId) return res.status(404).json({ error: 'NOT_FOUND' });
  // Diqqat: to'langan obuna puli qaytarilmaydi — bu bir martalik xizmat
  // haqi sifatida ko'riladi (xuddi auksion komissiyasi kabi).
  await unfollowUser(user.id, ownerId);
  res.json({ ok: true });
});

app.get('/api/follow-stats/:code', async (req, res) => {
  if (!isDbReady()) return res.json({ followers: 0, following: 0, isFollowing: false });
  const code = String(req.params.code || '').toUpperCase();
  const ownerId = await getOwnerByCode(code);
  if (!ownerId) return res.json({ followers: 0, following: 0, isFollowing: false });
  const user = await currentUser(req);
  res.json(await getFollowStats(ownerId, user?.id));
});

// To'lov holatini tekshirish uchun umumiy endpoint (premium, follow,
// auksion to'lovlari — hammasi shu orqali "kutilmoqda -> to'landi"
// holatini frontend'ga bildiradi).
app.get('/api/payments/:orderId', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  const order = await getWebOrder(Number(req.params.orderId));
  if (!order || order.userId !== user.id) return res.status(404).json({ error: 'not_found' });
  res.json({ id: order.id, kind: order.kind, status: order.status, price: order.price });
});

// To'lovlar tarixi — foydalanuvchining barcha real to'lovlari (vizitka,
// jismoniy karta, auksion, premium, obuna) bitta ro'yxatda.
app.get('/api/payments', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  if (!isDbReady()) return res.json({ payments: [], pendingPayout: 0 });
  const [payments, pendingPayout] = await Promise.all([
    listUserPayments(user.id),
    getPendingPayout(user.id),
  ]);
  res.json({ payments, pendingPayout });
});

// ---------- Xabarlar (Direct Messages) ----------
//
// XAVFSIZLIK: har bir endpoint currentUser(req) orqali session'dan userId
// oladi va faqat SHU userId qatnashgan suhbatlarni ko'rsatadi — client
// hech qachon "boshqa odam sifatida" so'ray olmaydi, chunki userId
// clientdan emas, cookie orqali tasdiqlangan sessiyadan olinadi.

app.get('/api/conversations', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  if (!isDbReady()) return res.json({ conversations: [] });
  res.json({ conversations: await listConversations(user.id) });
});

app.get('/api/conversations/unread-count', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.json({ count: 0 });
  if (!isDbReady()) return res.json({ count: 0 });
  res.json({ count: await totalUnreadCount(user.id) });
});

// Kod (profil) orqali suhbat boshlash/ochish — frontend userId'ni
// bilmasligi ham mumkin, faqat profil kodini biladi.
app.post('/api/conversations/with/:code', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  const code = String(req.params.code || '').toUpperCase();
  const ownerId = await getOwnerByCode(code);
  if (!ownerId) return res.status(404).json({ error: 'NOT_FOUND' });
  if (ownerId === user.id) return res.status(400).json({ error: 'CANNOT_MESSAGE_SELF' });
  const conversationId = await getOrCreateConversation(user.id, ownerId);
  res.json({ conversationId });
});

app.get('/api/conversations/:id/messages', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  if (!isDbReady()) return res.json({ messages: [] });
  const id = Number(req.params.id);
  // MUHIM: shu suhbatning ishtirokchisi ekanligini tekshirmasdan HECH
  // qachon xabarlarni qaytarmaymiz — bu maxfiylikni ta'minlaydigan
  // yagona to'siq (RLS o'rniga API darajasidagi tekshiruv).
  if (!(await isConversationParticipant(id, user.id))) {
    return res.status(403).json({ error: 'forbidden' });
  }
  const before = req.query.before ? new Date(req.query.before) : null;
  const messages = await listMessages(id, { before, limit: 50 });
  await markConversationRead(id, user.id);
  res.json({ messages });
});

app.post('/api/conversations/:id/messages', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  const id = Number(req.params.id);
  if (!(await isConversationParticipant(id, user.id))) {
    return res.status(403).json({ error: 'forbidden' });
  }
  const body = cleanStr(req.body?.body, 2000);
  if (!body) return res.status(422).json({ error: 'empty_message' });
  const message = await sendMessage(id, user.id, body);
  res.status(201).json(message);
});

// ---------- Paynet webhook (avtomatik to'lov tasdiqlash) ----------
// Kabinetda Callback URL: https://<domen>/api/pay/paynet/webhook
app.post('/api/pay/paynet/webhook', async (req, res) => {
  try {
    if (!paynetEnabled()) {
      return res.status(503).json({ error_code: -1, message: 'paynet disabled' });
    }
    if (!verifyPaynetAuth(req)) {
      return res.status(401).json({ error_code: -1, message: 'unauthorized' });
    }

    const cb = parsePaynetCallback(req.body);
    if (!cb.orderId) {
      // Buyurtma bizda yo'q — baribir 200 qaytaramiz, Paynet qayta-qayta yubormasin.
      return res.json({ error_code: 0 });
    }

    if (cb.orderKind === 'web') {
      const order = await getWebOrder(cb.orderId);
      if (!order || order.status !== 'pending') {
        return res.json({ error_code: 0 }); // allaqachon ishlangan (idempotent)
      }

      if (cb.status === 'cancelled') {
        await cancelPendingWebOrder(order.id);
        console.log(`[paynet] web#${order.id} (${order.kind}) bekor qilindi.`);
        return res.json({ error_code: 0 });
      }
      if (cb.status !== 'paid') return res.json({ error_code: 0 });

      // Buyurtma turiga (kind) qarab to'g'ri mantiq — Payme webhook bilan
      // BIR XIL umumiy funksiya orqali (server/db.js: finalizePaidWebOrder).
      const result = await finalizePaidWebOrder(order.id);
      console.log(`[paynet] web#${order.id} (${order.kind}) natijasi:`, result);
      return res.json({ error_code: 0 });
    }

    const order = await getBotOrder(cb.orderId);
    if (!order || order.status !== 'pending') {
      return res.json({ error_code: 0 }); // allaqachon ishlangan (idempotent)
    }

    if (cb.status === 'paid') {
      await setBotOrderStatus(order.id, 'paid');
      // Sayt bilan sinxron: kodni band qilamiz ("Band" holati).
      if (!(await getRecord(order.code))) {
        await createRecord({ code: order.code, name: 'TELEGRAM MIJOZ', price: order.price });
      }
      notifyOrderPaidAuto(order).catch(() => {});
      console.log(`[paynet] #${order.id} (${order.code}) avtomatik band qilindi.`);
    } else if (cb.status === 'cancelled') {
      await setBotOrderStatus(order.id, 'cancelled');
      console.log(`[paynet] #${order.id} bekor qilindi.`);
    }

    return res.json({ error_code: 0 });
  } catch (err) {
    console.error('[paynet] webhook xatosi:', err.message);
    return res.status(500).json({ error_code: -1, message: 'internal' });
  }
});

// ---------- Payme webhook (hamyonni to'ldirish) ----------
// Kabinetda Callback URL: https://<domen>/api/pay/payme
app.post('/api/pay/payme', async (req, res) => {
  if (!paymeEnabled()) {
    return res.json({ jsonrpc: '2.0', id: req.body?.id ?? null, error: { code: -32601, message: 'payme disabled' } });
  }
  if (!verifyPaymeAuth(req)) {
    return res.status(200).json({ jsonrpc: '2.0', id: req.body?.id ?? null, error: { code: -32504, message: 'Ruxsat yo\u2019q' } });
  }
  const result = await handlePaymeRequest(req.body);
  res.json(result);
});

// ---------- Hamyon: OLIB TASHLANDI (E-WALLET: YO'Q qarori bo'yicha) ----------
// To'lov provayderi: PAYME (asosiy). Paynet webhook route hozircha kodda
// qoldi (yuqorida) — hech qayerdan yangi buyurtma yaratilmaydi, shuning
// uchun amalda ishlatilmaydi, lekin xavfsiz qoldiriladi.

// ---------- Auksion ----------

// Auksionni bergan vaqtda muddati o'tgan auksionlarni yakunlaydi
// (alohida cron server bo'lmagani uchun — har so'rovda "dangasa" tekshirish).
// E-wallet yo'q: bu yerda pul harakatlanmaydi, faqat holat o'zgaradi.
async function settleExpiredAuctions() {
  if (!isDbReady()) return;
  try {
    const expired = await listExpiredActiveAuctions();
    for (const a of expired) {
      const result = await closeAuctionBidding(a.id);
      if (result?.awaitingPayment) {
        console.log(`[auction] #${a.id} (${a.code}) taklif yakunlandi — g'olib 24 soat ichida to'lashi kerak.`);
      } else if (result?.expired) {
        console.log(`[auction] #${a.id} (${a.code}) taklifsiz tugadi.`);
      }
    }
    // 24 soatlik to'lov muddati o'tib, hali to'lanmagan auksionlar.
    const unpaid = await expireUnpaidAuctions();
    for (const a of unpaid) {
      console.log(`[auction] #${a.id} (${a.code}) to'lov muddati o'tdi — g'olib to'lamadi.`);
    }
  } catch (err) {
    console.error('[auction] settle xatosi:', err.message);
  }
}

app.get('/api/auctions', async (req, res) => {
  if (!isDbReady()) return res.json({ auctions: [] });
  await settleExpiredAuctions();
  res.json({ auctions: await listActiveAuctions() });
});

app.get('/api/auctions/:id', async (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  await settleExpiredAuctions();
  const id = Number(req.params.id);
  const auction = await getAuction(id);
  if (!auction) return res.status(404).json({ error: 'not_found' });
  const bids = await listBidsByAuction(id);
  res.json({ auction, bids });
});

// Kartani auksionga qo'yish (faqat egasi qo'ya oladi).
app.post('/api/auctions', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });

  const code = String(req.body?.code || '').toUpperCase();
  const startPrice = Math.round(Number(req.body?.startPrice));
  const buyNowPrice = req.body?.buyNowPrice ? Math.round(Number(req.body.buyNowPrice)) : null;
  const hours = Math.min(AUCTION_MAX_HOURS, Math.max(1, Math.round(Number(req.body?.hours) || 24)));
  // Sotuvchi g'alaba puliini shu raqamga (Payme/karta) olishni xohlaydi —
  // e-wallet yo'q, shuning uchun admin qo'lda shu raqamga o'tkazadi.
  const sellerPaymeNumber = cleanStr(req.body?.sellerPaymeNumber, 30);

  if (!code || !startPrice || startPrice < 10_000) return res.status(422).json({ error: 'bad_input' });
  if (buyNowPrice && buyNowPrice <= startPrice) return res.status(422).json({ error: 'buy_now_too_low' });
  if (!sellerPaymeNumber) return res.status(422).json({ error: 'seller_payme_required' });

  try {
    const ownerId = await getRecordOwner(code);
    if (ownerId !== user.id) return res.status(403).json({ error: 'not_owner' });
    if (await getActiveAuctionByCode(code)) return res.status(409).json({ error: 'already_in_auction' });

    const auction = await createAuction({ code, sellerId: user.id, startPrice, buyNowPrice, hours });
    await setAuctionSellerPayme(auction.id, sellerPaymeNumber);
    res.status(201).json(auction);
  } catch (err) {
    console.error('[api] createAuction:', err.message);
    res.status(503).json({ error: 'db_unavailable' });
  }
});

// Narx taklif qilish.
app.post('/api/auctions/:id/bid', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });

  const id = Number(req.params.id);
  const amount = Math.round(Number(req.body?.amount));
  const idempotencyKey = typeof req.body?.idempotencyKey === 'string' ? req.body.idempotencyKey.slice(0, 100) : null;
  if (!id || !amount) return res.status(422).json({ error: 'BAD_INPUT' });

  try {
    const result = await placeBid({ auctionId: id, userId: user.id, amount, idempotencyKey });
    if (result.error) return res.status(409).json(result);
    res.json(result);
  } catch (err) {
    console.error('[api] placeBid:', err.message);
    res.status(503).json({ error: 'SYSTEM' });
  }
});

// G'olib real to'lovni boshlaydi — auksion "awaiting_payment" holatida,
// faqat g'olibning o'zi to'lay oladi, muddat o'tmagan bo'lishi kerak.
app.post('/api/auctions/:id/pay', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  if (!paymeEnabled()) return res.status(503).json({ error: 'payme_disabled' });

  const id = Number(req.params.id);
  const auction = await getAuction(id);
  if (!auction) return res.status(404).json({ error: 'not_found' });
  if (auction.status !== 'awaiting_payment') return res.status(409).json({ error: 'AUCTION_NOT_AWAITING_PAYMENT' });
  if (auction.highestBidderId !== user.id) return res.status(403).json({ error: 'NOT_WINNER' });
  if (new Date(auction.paymentDeadline) <= new Date()) return res.status(409).json({ error: 'PAYMENT_DEADLINE_PASSED' });

  // Auksion to'lovi ham web_orders orqali o'tadi — kind='auction_payment'
  // orqali webhook buni ajratib oladi (endi code'ga hiyla yozilmaydi).
  const order = await createWebOrder({
    userId: user.id, code: auction.code, kind: 'auction_payment', price: Number(auction.currentPrice),
    payload: { auctionId: auction.id },
  });
  const payLink = paymeCheckoutLink(order.id, Number(auction.currentPrice));
  res.status(202).json({ orderId: order.id, amount: Number(auction.currentPrice), payLink });
});

// ---------- Auth ----------

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 kun
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

async function currentUser(req) {
  if (!isDbReady()) return null;
  const token = sessionTokenFromReq(req);
  if (!token) return null;
  try {
    return await getSessionUser(token);
  } catch {
    return null;
  }
}

function validateAuthBody(body) {
  const email = cleanStr(body.email, 120).toLowerCase();
  const password = typeof body.password === 'string' ? body.password : '';
  if (!EMAIL_RE.test(email)) return { error: 'Email formati noto\u2019g\u2019ri.' };
  if (password.length < 6) return { error: 'Parol kamida 6 belgidan iborat bo\u2019lishi kerak.' };
  return { email, password };
}

const PHONE_RE = /^\+?\d{9,15}$/;

// Ro'yxatdan o'tishga xos qo'shimcha tekshiruv: telefon raqami va
// "botga yozdim" tasdig'i — ikkalasi ham majburiy.
function validateRegisterExtra(body) {
  const phone = cleanStr(body.phone, 20).replace(/[\s\-()]/g, '');
  const botAck = body.botAck === true;
  if (!PHONE_RE.test(phone)) return { error: 'Telefon raqamini to\u2019g\u2019ri kiriting (masalan +998901234567).' };
  if (!botAck) return { error: 'Avval Telegram botimizga yozib, tasdiqlash katagini belgilang.' };
  return { phone, botAck };
}

// Admin akkauntni avtomatik yaratish/sinxronlash (Railway Variables:
// ADMIN_EMAIL, ADMIN_PASSWORD). Akkaunt bo'lmasa — yaratadi; paroli
// env'dagiga mos kelmasa — yangilaydi.
async function ensureAdminUser() {
  const email = cleanStr(process.env.ADMIN_EMAIL || '', 120).toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';
  if (!email || !password) return;
  if (!EMAIL_RE.test(email) || password.length < 6) {
    console.warn('[auth] ADMIN_EMAIL/ADMIN_PASSWORD noto\u2019g\u2019ri — admin yaratilmadi.');
    return;
  }
  try {
    const existing = await getUserByEmail(email);
    const hash = hashPassword(password);
    if (!existing) {
      await createUser(email, hash);
      console.log(`[auth] Admin akkaunt avtomatik yaratildi: ${email}`);
    } else if (!verifyPassword(password, existing.passwordHash)) {
      await updateUserPassword(existing.id, hash);
      console.log(`[auth] Admin paroli env bilan sinxronlandi: ${email}`);
    }
  } catch (err) {
    console.error('[auth] ensureAdminUser:', err.message);
  }
}

app.post('/api/auth/register', authLimiter, async (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  const { email, password, error } = validateAuthBody(req.body || {});
  if (error) return res.status(422).json({ error });
  const extra = validateRegisterExtra(req.body || {});
  if (extra.error) return res.status(422).json({ error: extra.error });

  try {
    // Haqiqiy tekshiruv: telefon raqami botga "Kontaktni ulashish" orqali
    // yuborilgan bo'lishi shart (bot_verifications jadvali) — checkbox
    // o'zi hech narsani isbotlamaydi, faqat bu tekshiruv isbotlaydi.
    const verified = await isPhoneBotVerified(extra.phone);
    if (!verified) {
      return res.status(422).json({ error: 'phone_not_verified' });
    }

    const existing = await getUserByEmail(email);
    if (existing) return res.status(409).json({ error: 'email_taken' });
    const user = await createUser(email, hashPassword(password), { phone: extra.phone, botAck: extra.botAck });
    if (!user) return res.status(409).json({ error: 'email_taken' });
    const token = newSessionToken();
    await createSession(token, user.id, SESSION_TTL_MS);
    console.log(`[auth] Yangi akkaunt: ${email} (${extra.phone})`);
    res.setHeader('Set-Cookie', sessionCookie(token, isSecureReq(req)));
    res.status(201).json({ user });
  } catch (err) {
    console.error('[auth] register:', err.message);
    res.status(503).json({ error: 'db_unavailable' });
  }
});

app.post('/api/auth/login', loginLimiter, async (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  const { email, password, error } = validateAuthBody(req.body || {});
  if (error) return res.status(422).json({ error });

  try {
    const user = await getUserByEmail(email);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ error: 'bad_credentials' });
    }
    const token = newSessionToken();
    await createSession(token, user.id, SESSION_TTL_MS);
    res.setHeader('Set-Cookie', sessionCookie(token, isSecureReq(req)));
    res.json({ user: { id: user.id, email: user.email } });
  } catch (err) {
    console.error('[auth] login:', err.message);
    res.status(503).json({ error: 'db_unavailable' });
  }
});

app.post('/api/auth/logout', async (req, res) => {
  const token = sessionTokenFromReq(req);
  if (token && isDbReady()) {
    try { await deleteSession(token); } catch { /* ignore */ }
  }
  res.setHeader('Set-Cookie', clearedSessionCookie(isSecureReq(req)));
  res.json({ ok: true });
});

app.get('/api/auth/me', async (req, res) => {
  if (!isDbReady()) return res.json({ user: null, cards: [] });
  try {
    const user = await currentUser(req);
    if (!user) return res.json({ user: null, cards: [] });
    const cards = await listRecordsByUser(user.id);
    res.json({ user, cards });
  } catch (err) {
    console.error('[auth] me:', err.message);
    res.json({ user: null, cards: [] });
  }
});

app.get('/api/records', async (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  try {
    res.json(await listRecords());
  } catch (err) {
    console.error('[api] listRecords:', err.message);
    res.status(503).json({ error: 'db_unavailable' });
  }
});

app.get('/api/records/:code', async (req, res) => {
  const code = String(req.params.code || '').toUpperCase();
  if (!validCode(code)) return res.status(400).json({ error: 'bad_code' });
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  try {
    const rec = await getRecord(code);
    if (!rec) return res.status(404).json({ error: 'not_found' });
    res.json(rec);
  } catch (err) {
    console.error('[api] getRecord:', err.message);
    res.status(503).json({ error: 'db_unavailable' });
  }
});

app.post('/api/records/:code', async (req, res) => {
  const code = String(req.params.code || '').toUpperCase();
  if (!validCode(code)) return res.status(400).json({ error: 'bad_code' });
  if (RESERVED_CODES.has(code)) return res.status(400).json({ error: 'reserved' });
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });

  // MUHIM: akkauntsiz band qilishga ruxsat berilmaydi — aks holda karta
  // bazada "egasiz" (user_id = NULL) qolib ketadi va hech kimning
  // kabinetida ko'rinmaydi (VIP001 bilan yuz bergan holat).
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ error: 'unauthorized' });

  const { record, error } = validateBody(req.body || {});
  if (error) return res.status(422).json({ error });

  // Ixtiyoriy jismoniy karta qo'shimchasi — qat'iy, serverda hisoblanadigan narx.
  const wantsPhysicalCard = req.body?.physicalCard === true;
  let shipping = null;
  if (wantsPhysicalCard) {
    const shippingName = cleanStr(req.body?.shippingName, 100);
    const shippingPhone = cleanStr(req.body?.shippingPhone, 20);
    const shippingAddress = cleanStr(req.body?.shippingAddress, 300);
    if (!shippingName || !shippingPhone || !shippingAddress) {
      return res.status(422).json({ error: 'shipping_required' });
    }
    shipping = { shippingName, shippingPhone, shippingAddress };
  }

  try {
    // Narxni server o'zi hisoblaydi (client narxiga ishonmaymiz):
    // joriy bazaviy narx = f(band qilingan vizitkalar soni).
    // Faqat harflardan iborat premium vizitka — oddiy vizitkadan 3 barobar qimmat.
    const sold = await countRecords();
    const basePrice = isLetterCode(code)
      ? priceFor('AAA', '000', sold).base * 3
      : priceForCode(code, sold).total;
    const price = basePrice + (wantsPhysicalCard ? PHYSICAL_CARD_FEE : 0);

    if (await getRecord(code)) return res.status(409).json({ error: 'already_taken' });

    // Narx 0 bo'lsa (Oddiy/Free daraja, jismoniy karta ham tanlanmagan) —
    // to'lov umuman kerak emas, darhol band qilamiz. Paynet yoqilgan yoki
    // yo'qligidan qat'i nazar shu yo'l ishlaydi.
    if (price === 0) {
      const created = await createRecord({ ...record, code, price: 0 });
      if (!created) return res.status(409).json({ error: 'already_taken' });
      await attachCardToUser(code, user.id);
      console.log(`[api] Tekin band qilindi (Oddiy daraja): ${code} — ${created.name}`);
      return res.status(201).json(created);
    }

    // Payme ulanmagan bo'lsa (masalan lokal dev muhitida) — eskicha,
    // to'lovsiz, darhol band qilamiz, aks holda test qilib bo'lmaydi.
    if (!paymeEnabled()) {
      const created = await createRecord({ ...record, code, price });
      if (!created) return res.status(409).json({ error: 'already_taken' });
      await attachCardToUser(code, user.id);
      if (wantsPhysicalCard) {
        await createPhysicalCard({ linkedCode: code, ownerUserId: user.id, ...shipping });
      }
      console.log(`[api] (payme o'chiq — dev rejim) Band qilindi: ${code} — ${created.name} (${price} so'm)`);
      return res.status(201).json(created);
    }

    // Real rejim: karta darhol YARATILMAYDI. Avval to'lov kutilayotgan
    // buyurtma yaratiladi, to'lov Payme webhook orqali tasdiqlangach
    // karta yaratiladi va shu foydalanuvchiga biriktiriladi.
    const existingOrder = await activeWebOrderByCode(code);
    if (existingOrder) return res.status(409).json({ error: 'reserved_pending_payment' });

    const order = await createWebOrder({
      userId: user.id, code, price,
      payload: { ...record, physicalCard: wantsPhysicalCard, ...shipping },
    });
    const payLink = paymeCheckoutLink(order.id, price);
    console.log(`[api] To'lov kutilmoqda: ${code} — buyurtma #${order.id} (${price} so'm${wantsPhysicalCard ? ', jismoniy karta bilan' : ''})`);
    res.status(202).json({ pending: true, orderId: order.id, code, price, payLink });
  } catch (err) {
    console.error('[api] createRecord:', err.message);
    res.status(503).json({ error: 'db_unavailable' });
  }
});

// Sayt buyurtmasi holatini tekshirish (to'lov tasdiqlanganmi?) — frontend
// buyurtma yaratilgach shu endpointni pollaydi.
app.get('/api/orders/:id', async (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'bad_id' });
  try {
    const order = await getWebOrder(id);
    if (!order || order.userId !== user.id) return res.status(404).json({ error: 'not_found' });
    res.json({ id: order.id, code: order.code, status: order.status, price: order.price });
  } catch (err) {
    console.error('[api] getOrder:', err.message);
    res.status(503).json({ error: 'db_unavailable' });
  }
});

// Foydalanuvchining barcha sayt buyurtmalari (kutilayotgan/muvaffaqiyatsiz
// bo'lganlarini "Mening profilim" sahifasida ko'rsatish uchun).
app.get('/api/orders', async (req, res) => {
  if (!isDbReady()) return res.json({ orders: [] });
  const user = await currentUser(req);
  if (!user) return res.json({ orders: [] });
  try {
    res.json({ orders: await listWebOrdersByUser(user.id) });
  } catch (err) {
    console.error('[api] listOrders:', err.message);
    res.json({ orders: [] });
  }
});

app.put('/api/records/:code', async (req, res) => {
  const code = String(req.params.code || '').toUpperCase();
  if (!validCode(code)) return res.status(400).json({ error: 'bad_code' });
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });

  const user = await currentUser(req);
  if (!user) return res.status(401).json({ error: 'unauthorized' });

  try {
    const owner = await getRecordOwner(code);
    if (!owner) return res.status(404).json({ error: 'not_found' });
    if (owner !== user.id) return res.status(403).json({ error: 'forbidden' });

    const { record } = validateBody(req.body || {});
    const updated = await updateRecord(code, record);
    if (!updated) return res.status(404).json({ error: 'not_found' });
    res.json(updated);
  } catch (err) {
    console.error('[api] updateRecord:', err.message);
    res.status(503).json({ error: 'db_unavailable' });
  }
});

// ---------- Sotuv (vizitkani qayta sotish) ----------

// Sotuvga qo'yish / sotuvdan olish. Narx avtomatik: oddiy vizitkaning
// joriy narxidan 3 barobar qimmat.
app.post('/api/records/:code/sale', async (req, res) => {
  const code = String(req.params.code || '').toUpperCase();
  if (!validCode(code)) return res.status(400).json({ error: 'bad_code' });
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });

  const user = await currentUser(req);
  if (!user) return res.status(401).json({ error: 'unauthorized' });

  try {
    const owner = await getRecordOwner(code);
    if (!owner) return res.status(404).json({ error: 'not_found' });
    if (owner !== user.id) return res.status(403).json({ error: 'forbidden' });

    const list = !!(req.body && req.body.list);
    let salePrice = null;
    if (list) {
      const sold = await countRecords();
      salePrice = priceFor('AAA', '000', sold).base * 3;
    }
    const updated = await setForSale(code, list, salePrice);
    console.log(`[api] Sotuv ${list ? 'ochildi' : 'yopildi'}: ${code}${list ? ` — ${salePrice} so'm` : ''}`);
    res.json(updated);
  } catch (err) {
    console.error('[api] sale:', err.message);
    res.status(503).json({ error: 'db_unavailable' });
  }
});

// Sotib olish: vizitka egasi almashtiriladi (real to'lov tizimi alohida).
app.post('/api/records/:code/buy', async (req, res) => {
  const code = String(req.params.code || '').toUpperCase();
  if (!validCode(code)) return res.status(400).json({ error: 'bad_code' });
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });

  const buyer = await currentUser(req);
  if (!buyer) return res.status(401).json({ error: 'unauthorized' });

  try {
    const owner = await getRecordOwner(code);
    if (!owner) return res.status(404).json({ error: 'not_found' });
    if (owner === buyer.id) return res.status(400).json({ error: 'own_card' });
    const bought = await transferCard(code, owner, buyer.id);
    if (!bought) return res.status(409).json({ error: 'not_for_sale' });
    console.log(`[api] Sotib olindi: ${code} — ${buyer.email} (${bought.salePrice ?? bought.price} so'mlik listing)`);
    res.json(bought);
  } catch (err) {
    console.error('[api] buy:', err.message);
    res.status(503).json({ error: 'db_unavailable' });
  }
});

app.post('/api/records/:code/view', async (req, res) => {
  const code = String(req.params.code || '').toUpperCase();
  if (!validCode(code)) return res.status(400).json({ error: 'bad_code' });
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  try {
    const views = await incrementViews(code);
    if (views === null) return res.status(404).json({ error: 'not_found' });
    res.json({ views });
  } catch (err) {
    console.error('[api] incrementViews:', err.message);
    res.status(503).json({ error: 'db_unavailable' });
  }
});

// Sotuvdagi vizitkalar ro'yxati.
app.get('/api/sales', async (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  try {
    res.json(await listForSale());
  } catch (err) {
    console.error('[api] sales:', err.message);
    res.status(503).json({ error: 'db_unavailable' });
  }
});

// ---------- Rasm yuklash ----------

const UPLOAD_DIR = path.join(__dirname, 'uploads');
const IMAGE_RE = /^data:(image\/(png|jpeg|jpg|webp|gif));base64,(.+)$/;

app.post('/api/upload', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ error: 'unauthorized' });

  const raw = String((req.body || {}).dataUrl || '');
  const m = IMAGE_RE.exec(raw);
  if (!m) return res.status(422).json({ error: 'bad_image' });
  const buf = Buffer.from(m[3], 'base64');
  if (!buf.length) return res.status(422).json({ error: 'bad_image' });
  if (buf.length > 700 * 1024) return res.status(413).json({ error: 'too_large' });

  try {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    const ext = m[2] === 'jpeg' || m[2] === 'jpg' ? 'jpg' : m[2];
    const name = `${crypto.randomBytes(10).toString('hex')}.${ext}`;
    await fs.writeFile(path.join(UPLOAD_DIR, name), buf);
    res.json({ url: `/uploads/${name}` });
  } catch (err) {
    console.error('[api] upload:', err.message);
    res.status(500).json({ error: 'upload_failed' });
  }
});

app.use('/uploads', express.static(UPLOAD_DIR));

// ---------- Musiqa yuklash ----------

const AUDIO_RE = /^data:(audio\/(mpeg|mp3|mp4|ogg|wav|webm|x-m4a|m4a));base64,(.+)$/;

app.post('/api/upload-audio', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ error: 'unauthorized' });

  const raw = String((req.body || {}).dataUrl || '');
  const m = AUDIO_RE.exec(raw);
  if (!m) return res.status(422).json({ error: 'bad_audio' });
  const buf = Buffer.from(m[3], 'base64');
  if (!buf.length) return res.status(422).json({ error: 'bad_audio' });
  // ~8 MB — profil musiqasi uchun yetarli (o'rtacha 3-4 daqiqalik mp3).
  if (buf.length > 8 * 1024 * 1024) return res.status(413).json({ error: 'too_large' });

  try {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    const extMap = { mpeg: 'mp3', mp3: 'mp3', mp4: 'm4a', 'x-m4a': 'm4a', m4a: 'm4a', ogg: 'ogg', wav: 'wav', webm: 'webm' };
    const ext = extMap[m[2]] || 'mp3';
    const name = `${crypto.randomBytes(10).toString('hex')}.${ext}`;
    await fs.writeFile(path.join(UPLOAD_DIR, name), buf);
    res.json({ url: `/uploads/${name}` });
  } catch (err) {
    console.error('[api] upload-audio:', err.message);
    res.status(500).json({ error: 'upload_failed' });
  }
});

app.use((err, req, res, next) => {
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'bad_json' });
  }
  next(err);
});

const distDir = path.join(__dirname, '..', 'dist');
app.use(express.static(distDir));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(distDir, 'index.html'));
});

initDb()
  .then(() => ensureAdminUser())
  .catch((err) => console.error('[db] Ulanish xatosi:', err.message))
  .finally(() => {
    app.listen(PORT, () => {
      console.log(`[server] NFCSTORE server ${PORT}-portda ishga tushdi. DB: ${isDbReady() ? 'ulangan' : 'ulanmagan (fallback rejim)'}`);
      startBot();
    });
  });
