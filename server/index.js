import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { priceForCode } from '../src/lib/pricing.js';
import {
  initDb, isDbReady,
  listRecords, getRecord, createRecord, countRecords, incrementViews,
  createUser, getUserByEmail, updateUserPassword, createSession, getSessionUser, deleteSession, setUserTestFlag, createFreeAutoId,
  adminDeleteUser,
  attachCardToUser, listRecordsByUser, updateRecord, getRecordOwner, setPrimaryCard,
  createGiftOffer, listGiftOffers, acceptGiftOffer, rejectGiftOffer, cancelGiftOffer,
  createSupportMessage, listMySupportMessages,
  getPendingGiftByCode, verifyGiftActivationCode, activateNfcGift, logAdminActivity,
  assignPromoCode, getUserByPromoCode, applyReferral, getPendingDiscountPct, consumeDiscount, listMyReferrals,
  getUserPhoneAndTgId, createPasswordResetCode, verifyAndConsumePasswordResetCode,
  // setForSale, transferCard, listForSale — endi ishlatilmaydi (Sotish
  // funksiyasi olib tashlandi), lekin server/db.js'da xavfsizlik uchun qoldirilgan.
  getBotOrder, setBotOrderStatus, finalizePaidBotOrder,
  createWebOrder, getWebOrder, activeWebOrderByCode, listWebOrdersByUser, getPendingAuctionPaymentOrder,
  finalizePaidWebOrder, cancelPendingWebOrder,
  createAuction, getActiveAuctionByCode, getAuction, listActiveAuctions, listExpiredActiveAuctions,
  listBidsByAuction, placeBid, closeAuctionBidding, expireUnpaidAuctions,
  setAuctionSellerPayme, markAuctionPayoutPaid,
  createAuctionRequest, listAuctionRequests, approveAuctionRequest, rejectAuctionRequest,
  listWonAuctionsAwaitingPayment,
  isPhoneBotVerified,
  createPhysicalCard, resolvePhysicalCard,
  requestPremium, getOwnerByCode,
  followUserFree, unfollowUser, getFollowStats, toggleLike, getLikeInfo,
  setCardTierOverride, listPostsByCode, createPost, deletePost, togglePostLike,
  listUserPayments, getPendingPayout,
  getOrCreateConversation, listConversations, isConversationParticipant, listMessages, getOtherParticipant,
  blockUser, unblockUser, isBlocked, reportUser,
  sendMessage, markConversationRead, totalUnreadCount,
} from './db.js';
import {
  hashPassword, verifyPassword, newSessionToken,
  sessionCookie, clearedSessionCookie, sessionTokenFromReq,
} from './auth.js';
import fs from 'fs/promises';
import crypto from 'crypto';
import { startBot, notifyOrderPaidAuto, sendTelegramOtp, notifyAdminSupportMessage, notifyAdminAuctionRequest } from './bot.js';
import { paynetEnabled, paynetLink, verifyPaynetAuth, parsePaynetCallback } from './paynet.js';
import { paymeEnabled, paymeCheckoutLink, verifyPaymeAuth, handlePaymeRequest } from './payme.js';
import { adminRouter } from './admin.js';

const AUCTION_COMMISSION_PCT = Number(process.env.AUCTION_COMMISSION_PCT || 5);
const AUCTION_MAX_HOURS = 72;
const PHYSICAL_CARD_FEE = 200_000;  // Jismoniy karta narxi
const PREMIUM_UPGRADE_FEE = 5_000;  // Premium profil bo'lish narxi
// To'lovlar production uchun alohida feature flag bilan yoqiladi. Faqat Payme
// credentiallari mavjudligi to'lov oqimini tasodifan faollashtirmasligi kerak.
const PAYMENTS_ENABLED = process.env.PAYMENTS_ENABLED === 'true';
function paymentsEnabled() {
  return PAYMENTS_ENABLED && paymeEnabled();
}
// Diqqat: obuna (follow) bepul — quyidagi ikkita o'zgaruvchi endi
// ishlatilmaydi, lekin kelajakda kerak bo'lib qolsa deb saqlab qo'yildi.
// const PREMIUM_FOLLOW_FEE = 500;
// const PREMIUM_FOLLOW_COMMISSION_PCT = Number(process.env.PREMIUM_FOLLOW_COMMISSION_PCT || 5);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;
const STD_CODE_RE = /^[A-Z]{3}[0-9]{3}$/;      // standart: AAA000
const LETTER_CODE_RE = /^[A-Z]{3,12}$/;         // premium: faqat harflar — ALI, UZBEKISTAN
const FREE_ID_RE = /^[0-9]{8}$/;                // ro'yxatdan o'tishda avtomatik beriladigan bepul ID
const RESERVED_CODES = new Set([
  'LOGIN', 'REGISTER', 'ACCOUNT', 'API', 'ADMIN', 'STATIC', 'UPLOADS', 'AUKSION', 'XABARLAR', 'TOLOVLAR',
]);

function validCode(code) {
  return STD_CODE_RE.test(code) || LETTER_CODE_RE.test(code) || FREE_ID_RE.test(code);
}

// Faqat harflardan iborat premium vizitka (nfcstore.uz/ali)?
function isLetterCode(code) {
  return LETTER_CODE_RE.test(code);
}

const THEME_WHITELIST = ['classic', 'midnight', 'emerald', 'royal', 'sunset', 'gold', 'glass'];
const CARD_FINISH_WHITELIST = ['auto', 'black', 'silver', 'graphite', 'gold', 'ink', 'tier-exclusive', 'tier-premium', 'tier-gold', 'tier-silver', 'tier-free'];

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

// Oddiy xavfsizlik headerlari.
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (isSecureReq(req)) {
    // HSTS — brauzerga "keyingi safar ham albatta HTTPS orqali kir" deydi.
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

// Admin API ham yuqoridagi umumiy xavfsizlik headerlarini olishi kerak.
app.use('/api/admin', adminRouter);

// Production'da HTTP so'rovlarni HTTPS'ga majburiy yo'naltirish.
// MUHIM: /api/health BUNDAN ISTISNO — Railway'ning ichki health-check
// so'rovlari doim oddiy HTTP orqali keladi (ularning tarmog'i ichida),
// va agar biz uni 301 bilan HTTPS'ga yo'naltirsak, Railway buni "ishlamay
// qoldi" deb hisoblab, deploy'ni "Crashed/Failed" qilib belgilaydi —
// garchi server o'zi butunlay sog'lom ishlab tursa ham.
app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production' && !isSecureReq(req) && req.method === 'GET' && req.path !== '/api/health') {
    return res.redirect(301, `https://${req.headers.host}${req.originalUrl}`);
  }
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
  windowMs: 30 * 60_000,
  max: 3, // xavfsizlik talabi: 3 marta xato urinishdan keyin 30 daqiqaga bloklash
  keyFn: (req) => `${req.ip}:${String((req.body || {}).email || '').toLowerCase()}`,
});
// Xabarlashishda spamning oldini olish — daqiqada ko'pi bilan 15 xabar.
const messageLimiter = rateLimit({ windowMs: 60_000, max: 15 });
// Spam/suiiste'moldan himoya — sovg'a taklifi, adminga murojaat va
// auksion so'rovi yuborishga chegara.
const giftLimiter = rateLimit({ windowMs: 60_000, max: 10 });
const supportLimiter = rateLimit({ windowMs: 60_000, max: 5 });
const auctionRequestLimiter = rateLimit({ windowMs: 60_000, max: 10 });

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

// Oddiy kontent moderatsiyasi — profil bio/ismida taqiqlangan so'zlar
// (haqorat, nafrat nutqi) bo'lsa rad etiladi. To'liq AI-moderatsiya emas,
// lekin eng oddiy va aniq holatlarni ushlab qoladi.
const BANNED_WORDS = [
  'проститутка', 'porno', 'porn', 'sex shop', 'xxx',
  // O'zbekcha haqoratli so'zlar shu yerga qo'shiladi (ataylab bo'sh
  // qoldirilgan — to'liq ro'yxatni admin o'zi to'ldiradi).
];
function containsBannedContent(text) {
  const lower = String(text || '').toLowerCase();
  return BANNED_WORDS.some((w) => lower.includes(w));
}

function validateBody(body) {
  const name = cleanStr(body.name, 80);
  if (!name) return { error: "Ism bo'sh bo'lishi mumkin emas." };
  if (containsBannedContent(name) || containsBannedContent(body.about)) {
    return { error: "Profilingizda taqiqlangan kontent aniqlandi. Iltimos, matnni tahrirlang." };
  }
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
  // Profil havola tugmalarini shaffof (shisha effekti) qilish — standart o'chiq.
  const linksTransparent = body.linksTransparent === true;
  // Profil kartasi (nfcstore.uz/<kod> sahifasida ko'rinadigan NFC karta)
  // dizayni — ixtiyoriy: rang/finish, ustidagi ism matni, fon rasmi.
  let cardDesign = null;
  if (body.cardDesign && typeof body.cardDesign === 'object') {
    const cd = body.cardDesign;
    const finish = CARD_FINISH_WHITELIST.includes(cd.finish) ? cd.finish : 'auto';
    const cdName = cleanStr(cd.name, 40);
    let cdBg = '';
    if (typeof cd.bgUrl === 'string' && cd.bgUrl.startsWith('/uploads/')) {
      cdBg = cleanStr(cd.bgUrl, 300).replace(/[^\w\-./]/g, '');
    }
    if (finish !== 'auto' || cdName || cdBg) {
      cardDesign = { finish, name: cdName, bgUrl: cdBg };
    }
  }
  // Profil musiqasi — tashqi havola YOKI serverga yuklangan /uploads/...
  // fayli (xuddi avatar/fon rasmi kabi).
  let musicUrl = safeUrl(body.musicUrl);
  if (!musicUrl && typeof body.musicUrl === 'string' && body.musicUrl.startsWith('/uploads/')) {
    musicUrl = cleanStr(body.musicUrl, 300).replace(/[^\w\-./]/g, '');
  }
  const record = {
      name,
      role: cleanStr(body.role, 100),
      avatarUrl,
      bgUrl,
      bgPattern,
      accentColor,
      bgColor,
      bgAnimated,
      linksTransparent,
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
      hidePhone: body.hidePhone === true,
  };
  // MUHIM: cardDesign faqat mijoz uni ATAYLAB yuborgan bo'lsa qaytariladi —
  // aks holda oddiy profil tahririda (u yuborilmaydigan) dizayn NULLga
  // tushib, o'chib ketardi.
  if ('cardDesign' in body) record.cardDesign = cardDesign;
  return { record };
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
  if (!paymentsEnabled()) return res.status(503).json({ error: 'payments_disabled' });
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

// ---------- Layk ----------
app.get('/api/records/:code/like', async (req, res) => {
  const code = String(req.params.code || '').toUpperCase();
  if (!isDbReady()) return res.json({ count: 0, liked: false });
  const user = await currentUser(req);
  res.json(await getLikeInfo(code, user?.id));
});
app.post('/api/records/:code/like', async (req, res) => {
  const code = String(req.params.code || '').toUpperCase();
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  res.json(await toggleLike(code, user.id));
});

// ---------- Profil postlari ----------
app.get('/api/records/:code/posts', async (req, res) => {
  const code = String(req.params.code || '').toUpperCase();
  if (!isDbReady()) return res.json({ posts: [] });
  const user = await currentUser(req);
  try {
    res.json({ posts: await listPostsByCode(code, user?.id) });
  } catch (err) {
    console.error('[api] listPosts:', err.message);
    res.json({ posts: [] });
  }
});

app.post('/api/records/:code/posts', async (req, res) => {
  const code = String(req.params.code || '').toUpperCase();
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  const imageUrl = String(req.body?.imageUrl || '');
  const caption = String(req.body?.caption || '').slice(0, 600);
  if (!imageUrl.startsWith('/uploads/')) return res.status(422).json({ error: 'bad_image' });
  try {
    const result = await createPost(code, user.id, { imageUrl, caption });
    if (result.error === 'NOT_OWNER') return res.status(403).json({ error: 'not_owner' });
    if (result.error === 'LIMIT_REACHED') return res.status(409).json({ error: 'limit_reached' });
    res.status(201).json(result.post);
  } catch (err) {
    console.error('[api] createPost:', err.message);
    res.status(503).json({ error: 'db_unavailable' });
  }
});

app.delete('/api/posts/:id', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  const result = await deletePost(Number(req.params.id), user.id);
  if (!result.ok) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true });
});

app.post('/api/posts/:id/like', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  const result = await togglePostLike(Number(req.params.id), user.id);
  if (result.error === 'NOT_FOUND') return res.status(404).json({ error: 'not_found' });
  res.json(result);
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
  if (await isBlocked(user.id, ownerId)) return res.status(403).json({ error: 'blocked' });
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

app.post('/api/conversations/:id/messages', messageLimiter, async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  const id = Number(req.params.id);
  if (!(await isConversationParticipant(id, user.id))) {
    return res.status(403).json({ error: 'forbidden' });
  }
  // Blok qilingan bo'lsa, xabar yuborilmasin.
  const otherId = await getOtherParticipant(id, user.id);
  if (otherId && await isBlocked(otherId, user.id)) {
    return res.status(403).json({ error: 'blocked' });
  }
  const body = cleanStr(req.body?.body, 2000);
  if (!body) return res.status(422).json({ error: 'empty_message' });
  const message = await sendMessage(id, user.id, body);
  res.status(201).json(message);
});

// ---------- Foydalanuvchini bloklash / shikoyat qilish ----------

app.post('/api/users/:id/block', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  const targetId = Number(req.params.id);
  if (targetId === user.id) return res.status(400).json({ error: 'cannot_block_self' });
  await blockUser(user.id, targetId);
  res.json({ ok: true });
});

app.post('/api/users/:id/unblock', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  await unblockUser(user.id, Number(req.params.id));
  res.json({ ok: true });
});

app.post('/api/users/:id/report', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  const targetId = Number(req.params.id);
  const reason = cleanStr(req.body?.reason, 500);
  if (!reason) return res.status(422).json({ error: 'reason_required' });
  await reportUser(user.id, targetId, reason);
  res.json({ ok: true });
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
      const result = await finalizePaidBotOrder(order.id);
      if (result.ok) {
        notifyOrderPaidAuto(order).catch(() => {});
        console.log(`[paynet] #${order.id} (${order.code}) avtomatik band qilindi.`);
      }
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
  if (!paymentsEnabled()) {
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
  if (!isDbReady() || !paymentsEnabled()) return;
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

// MUHIM: kartani auksionga qo'yish endi FAQAT admin panel orqali
// (server/admin.js: POST /api/admin/auctions) — oddiy foydalanuvchi
// auksion ocha olmaydi, faqat admin YANGI (hali hech kimga tegishli
// bo'lmagan) kodlar uchun auksion ochadi.


// Narx taklif qilish.
// Foydalanuvchi adminga "shu noyob nomni auksionga qo'ying" deb so'rov
// yuboradi (real auksion emas — faqat taklif, admin ko'rib chiqadi).
app.post('/api/auction-requests', auctionRequestLimiter, async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  const code = String(req.body?.code || '').toUpperCase().trim();
  const note = cleanStr(req.body?.note, 300);
  if (!/^[A-Z0-9]{3,16}$/.test(code)) return res.status(422).json({ error: 'bad_code' });
  try {
    if (await getRecord(code)) return res.status(409).json({ error: 'code_taken' });
    const result = await createAuctionRequest(user.id, code, note);
    if (result.error) return res.status(409).json(result);
    notifyAdminAuctionRequest(user.email, code, note).catch(() => {});
    res.status(201).json(result);
  } catch (err) {
    console.error('[api] createAuctionRequest:', err.message);
    res.status(503).json({ error: 'db_unavailable' });
  }
});

app.post('/api/auctions/:id/bid', async (req, res) => {
  const user = await currentUser(req);
  if (!paymentsEnabled()) return res.status(503).json({ error: 'payments_disabled' });
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  if (user.bannedUntil) return res.status(403).json({ error: 'BANNED', bannedUntil: user.bannedUntil });
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
  if (user.bannedUntil) return res.status(403).json({ error: 'BANNED', bannedUntil: user.bannedUntil });
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  if (!paymentsEnabled()) return res.status(503).json({ error: 'payments_disabled' });

  const id = Number(req.params.id);
  const auction = await getAuction(id);
  if (!auction) return res.status(404).json({ error: 'not_found' });
  if (auction.status !== 'awaiting_payment') return res.status(409).json({ error: 'AUCTION_NOT_AWAITING_PAYMENT' });
  if (auction.highestBidderId !== user.id) return res.status(403).json({ error: 'NOT_WINNER' });
  if (new Date(auction.paymentDeadline) <= new Date()) return res.status(409).json({ error: 'PAYMENT_DEADLINE_PASSED' });

  // Yangi kod uchun karta hali mavjud emas — g'olib to'lov bilan birga
  // profilining asosiy ma'lumotini (kamida ism) yuborishi shart, aks
  // holda to'lov tasdiqlanganda karta nima nom bilan yaratilishini
  // bilmaymiz.
  const name = cleanStr(req.body?.name, 60);
  const phone = cleanStr(req.body?.phone, 30).replace(/[\s\-()]/g, '');
  if (!name) return res.status(422).json({ error: 'name_required' });
  if (!phone) return res.status(422).json({ error: 'phone_required' });
  const profile = {
    name,
    role: cleanStr(req.body?.role, 100),
    tg: cleanStr(req.body?.tg, 40).replace(/^@/, ''),
    phone,
    email: cleanStr(req.body?.email, 100),
  };

  // Auksion to'lovi ham web_orders orqali o'tadi — kind='auction_payment'
  // orqali webhook buni ajratib oladi (endi code'ga hiyla yozilmaydi).
  // Avval bir xil auksion uchun kutilayotgan buyurtma bor-yo'qligini
  // tekshiramiz — bo'lsa, o'shani qaytaramiz (ikki marta to'lov xavfi
  // bo'lmasligi uchun).
  const existing = await getPendingAuctionPaymentOrder(auction.id, user.id);
  if (existing) {
    const payLink = paymeCheckoutLink(existing.id, Number(existing.price));
    return res.status(202).json({ orderId: existing.id, amount: Number(existing.price), payLink });
  }

  const order = await createWebOrder({
    userId: user.id, code: auction.code, kind: 'auction_payment', price: Number(auction.currentPrice),
    payload: { auctionId: auction.id, ...profile },
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
  const tosAccepted = body.tosAccepted === true;
  if (!PHONE_RE.test(phone)) return { error: 'Telefon raqamini to\u2019g\u2019ri kiriting (masalan +998901234567).' };
  if (!botAck) return { error: 'Avval Telegram botimizga yozib, tasdiqlash katagini belgilang.' };
  if (!tosAccepted) return { error: 'Davom etish uchun ommaviy oferta shartlariga rozilik bering.' };
  return { phone, botAck, tosAccepted };
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
      await createUser(email, hash, { isTest: true });
      console.log(`[auth] Admin akkaunt avtomatik yaratildi: ${email}`);
    } else {
      // Eski akkaunt bo'lsa ham (is_test hali FALSE bo'lishi mumkin edi),
      // admin har doim statistikadan chiqarilishi kerak.
      await setUserTestFlag(existing.id, true);
      if (!verifyPassword(password, existing.passwordHash)) {
        await updateUserPassword(existing.id, hash);
        console.log(`[auth] Admin paroli env bilan sinxronlandi: ${email}`);
      }
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
    if (existing) {
      if (existing.deletedAt) {
        // Bu email ilgari admin tomonidan o'chirilgan akkauntga tegishli
        // edi — eski qatorni butunlay tozalab, emailni bo'shatamiz, so'ng
        // yangi akkaunt yaratamiz. Admin ko'rishi uchun jurnalga yoziladi.
        await adminDeleteUser(existing.id);
        logAdminActivity({
          action: 'user_deleted',
          details: `O'chirilgan email qayta ro'yxatdan o'tdi: ${email} (eski #${existing.id} tozalandi)`,
          ip: req.ip,
        }).catch(() => {});
      } else {
        return res.status(409).json({ error: 'email_taken' });
      }
    }
    const user = await createUser(email, hashPassword(password), { phone: extra.phone, botAck: extra.botAck, tosAccepted: extra.tosAccepted });
    if (!user) return res.status(409).json({ error: 'email_taken' });
    // Har bir yangi foydalanuvchiga avtomatik, bepul, 8 xonali ID
    // beriladi — sovg'a qilib bo'lmaydi (u faqat shaxsiy asosiy profil).
    const freeCode = await createFreeAutoId(user.id, email.split('@')[0]);
    if (freeCode) console.log(`[auth] #${user.id}ga avtomatik ID berildi: ${freeCode}`);
    // O'ziga xos promokod beramiz.
    await assignPromoCode(user.id);
    // Agar do'stining promokodi kiritilgan bo'lsa — o'sha do'stiga 15%
    // chegirma krediti yoziladi.
    const promoInput = cleanStr(req.body?.promoCode, 12).toUpperCase();
    if (promoInput) {
      const referrerId = await getUserByPromoCode(promoInput);
      if (referrerId) await applyReferral(referrerId, user.id);
    }
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
    if (user.deletedAt) {
      return res.status(403).json({ error: 'account_deleted' });
    }
    if (user.suspendedUntil && new Date(user.suspendedUntil) > new Date()) {
      return res.status(403).json({ error: 'account_suspended', suspendedUntil: user.suspendedUntil, reason: user.suspendReason });
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

// Foydalanuvchi yutib, hali to'lamagan auksionlari — profilida
// "Buyurtmalarim" bo'limida ko'rsatish uchun.
app.get('/api/auctions/won/pending', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.json({ auctions: [] });
  if (!isDbReady()) return res.json({ auctions: [] });
  res.json({ auctions: await listWonAuctionsAwaitingPayment(user.id) });
});

app.get('/api/records', async (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  try {
    const records = await listRecords();
    // Katalogga faqat ko'rsatish/qidirish uchun zarur maydonlar chiqadi.
    // Telefon, email, to'lov karta raqamlari va boshqa profil tafsilotlari
    // hech qachon ommaviy ro'yxat payloadiga qo'shilmaydi.
    res.json(records.map((record) => ({
      code: record.code,
      name: record.name,
      role: record.role,
      avatarUrl: record.avatarUrl,
      tg: record.tg,
      hashtags: record.hashtags,
      theme: record.theme,
      price: record.price,
      ts: record.ts,
      views: record.views,
    })));
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
    // Maxfiy maydonlar faqat egasiga tegishli /api/auth/me javobida bor.
    // Public profil API to'lov karta raqamlarini hech qachon qaytarmaydi.
    const user = await currentUser(req);
    const owner = await getRecordOwner(code);
    const isOwner = !!user && owner === user.id;
    if (rec.hidePhone && !isOwner) {
      rec.phone = '';
    }
    // Bu endpoint owner ochganida ham public kontrakt bo'lib qoladi.
    // Tahrirlash uchun to'liq ma'lumot /api/auth/me orqali olinadi.
    rec.cardNumber = '';
    rec.cardNumbers = [];
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
    // Narxni server o'zi hisoblaydi (client narxiga ishonmaymiz) — endi
    // kodning naqshiga qarab qat'iy daraja narxi (dinamik o'sish yo'q).
    const basePrice = isLetterCode(code)
      ? 99_000 * 3 // faqat harflardan iborat kod — Silver darajadan 3 barobar
      : (priceForCode(code).total ?? 0); // ekslyuziv (null) bo'lsa ham bu yerga yetib kelmaydi — pastda tekshiriladi
    const tierNow = isLetterCode(code) ? 'gold' : priceForCode(code).tier;
    if (tierNow === 'exclusive') return res.status(409).json({ error: 'exclusive_auction_only' });
    let price = basePrice + (wantsPhysicalCard ? PHYSICAL_CARD_FEE : 0);

    // Do'st taklif qilish orqali olingan 15% chegirma — bandlash narxi
    // 0 dan katta bo'lsagina qo'llanadi va bir martalik ishlatiladi.
    let discountApplied = 0;
    if (price > 0) {
      const pct = await getPendingDiscountPct(user.id);
      if (pct > 0) {
        discountApplied = Math.round(price * (pct / 100));
        price = Math.max(0, price - discountApplied);
      }
    }

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

    // Pullik ID/jismoniy karta to'lovsiz yaratilmaydi. To'lov tizimi tayyor
    // bo'lmaguncha oqim xavfsiz holatda yopiq turadi.
    if (!paymentsEnabled()) {
      return res.status(503).json({ error: 'payments_disabled' });
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
    // Chegirma ishlatilgan bo'lsa, buyurtma yaratilishi bilanoq
    // "sarflangan" deb belgilanadi (to'lov bekor qilinsa ham qayta
    // tiklanmaydi — soddalik uchun shunday).
    if (discountApplied > 0) await consumeDiscount(user.id);
    const payLink = paymeCheckoutLink(order.id, price);
    console.log(`[api] To'lov kutilmoqda: ${code} — buyurtma #${order.id} (${price} so'm${wantsPhysicalCard ? ', jismoniy karta bilan' : ''}${discountApplied > 0 ? `, ${discountApplied} so'm chegirma qo'llandi` : ''})`);
    res.status(202).json({ pending: true, orderId: order.id, code, price, payLink, discountApplied });
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
// Foydalanuvchining bir nechta raqamli tashrif qog'ozi (vizitka) bo'lsa,
// ulardan bittasini "Asosiy" deb belgilash.
// ---------- Adminga murojaat ----------

app.post('/api/support', supportLimiter, async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  const message = cleanStr(req.body?.message, 1000);
  if (!message) return res.status(422).json({ error: 'message_required' });
  const result = await createSupportMessage(user.id, message);
  notifyAdminSupportMessage(user.email, message).catch(() => {});
  res.status(201).json(result);
});

app.get('/api/support', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.json({ messages: [] });
  if (!isDbReady()) return res.json({ messages: [] });
  res.json({ messages: await listMySupportMessages(user.id) });
});

// Do'stlarim ro'yxati — kimlar mening promokodim orqali ro'yxatdan o'tgan.
app.get('/api/referrals', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.json({ referrals: [] });
  if (!isDbReady()) return res.json({ referrals: [] });
  res.json({ referrals: await listMyReferrals(user.id) });
});

// ---------- Sozlamalar: Telegram OTP orqali parol o'zgartirish ----------

app.post('/api/settings/request-password-code', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });

  const info = await getUserPhoneAndTgId(user.id);
  if (!info || !info.phone) return res.status(422).json({ error: 'no_phone' });
  if (!info.tgUserId) return res.status(422).json({ error: 'tg_not_linked' });

  const code = await createPasswordResetCode(user.id);
  try {
    await sendTelegramOtp(info.tgUserId, code);
  } catch (err) {
    console.error('[api] sendTelegramOtp:', err.message);
    return res.status(503).json({ error: 'tg_send_failed' });
  }
  res.json({ ok: true });
});

app.post('/api/settings/change-password', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });

  const code = cleanStr(req.body?.code, 6);
  const newPassword = String(req.body?.newPassword || '');
  if (!code) return res.status(422).json({ error: 'code_required' });
  if (newPassword.length < 6) return res.status(422).json({ error: 'weak_password' });

  const ok = await verifyAndConsumePasswordResetCode(user.id, code);
  if (!ok) return res.status(422).json({ error: 'bad_code' });

  await updateUserPassword(user.id, hashPassword(newPassword));
  res.json({ ok: true });
});

app.post('/api/records/:code/set-primary', async (req, res) => {
  const code = String(req.params.code || '').toUpperCase();
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  const ok = await setPrimaryCard(code, user.id);
  if (!ok) return res.status(403).json({ error: 'forbidden' });
  res.json({ ok: true });
});

// Mavjud (allaqachon egasi bor) kod uchun jismoniy karta buyurtma qilish
// — 200 000 so'm, Payme orqali.
app.post('/api/records/:code/order-physical-card', async (req, res) => {
  const code = String(req.params.code || '').toUpperCase();
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  if (!paymentsEnabled()) return res.status(503).json({ error: 'payments_disabled' });
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ error: 'unauthorized' });

  const owner = await getRecordOwner(code);
  if (owner !== user.id) return res.status(403).json({ error: 'forbidden' });

  const shippingName = cleanStr(req.body?.shippingName, 100);
  const shippingPhone = cleanStr(req.body?.shippingPhone, 30);
  const shippingAddress = cleanStr(req.body?.shippingAddress, 300);
  if (!shippingName || !shippingPhone || !shippingAddress) {
    return res.status(422).json({ error: 'shipping_required' });
  }

  const order = await createWebOrder({
    userId: user.id, code, kind: 'physical_card_order', price: PHYSICAL_CARD_FEE,
    payload: { shippingName, shippingPhone, shippingAddress },
  });
  const payLink = paymeCheckoutLink(order.id, PHYSICAL_CARD_FEE);
  res.status(202).json({ orderId: order.id, amount: PHYSICAL_CARD_FEE, payLink });
});

// ---------- Sovg'a qilish (pulsiz egalik o'tkazish) ----------

app.post('/api/records/:code/gift', giftLimiter, async (req, res) => {
  const code = String(req.params.code || '').toUpperCase();
  const toCode = String(req.body?.toCode || '').toUpperCase().trim();
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  if (!toCode) return res.status(422).json({ error: 'to_code_required' });
  const result = await createGiftOffer(code, user.id, toCode);
  if (result.error) return res.status(409).json(result);
  res.status(201).json(result);
});

app.get('/api/gift-offers', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.json({ incoming: [], outgoing: [] });
  if (!isDbReady()) return res.json({ incoming: [], outgoing: [] });
  res.json(await listGiftOffers(user.id));
});

app.post('/api/gift-offers/:id/accept', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  const result = await acceptGiftOffer(Number(req.params.id), user.id);
  if (!result) return res.status(409).json({ error: 'not_found_or_taken' });
  res.json(result);
});

app.post('/api/gift-offers/:id/reject', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  const ok = await rejectGiftOffer(Number(req.params.id), user.id);
  if (!ok) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true });
});

app.post('/api/gift-offers/:id/cancel', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  const ok = await cancelGiftOffer(Number(req.params.id), user.id);
  if (!ok) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true });
});

// ---------- Sotish/sotuv funksiyasi butunlay OLIB TASHLANDI ----------
// Endi egalikni o'zgartirishning ikkita yo'li bor: "Sovg'a qilish"
// (pulsiz, ikki tomonlama rozilik) va Auksion (admin ochadi, g'olib
// real to'lov qiladi). Quyidagi uchta endpoint (sale/buy/sales) shu
// sababli olib tashlandi — server/db.js'dagi setForSale/transferCard/
// listForSale funksiyalari xavfsizlik uchun saqlab qo'yilgan (endi
// hech qayerdan chaqirilmaydi).

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

// ═══════════════════════════════════════════════════════════════════
// "GIFT NFC ID" — YANGI, TO'LIQ IZOLYATSIYALANGAN FUNKSIYA.
// Mavjud auth/register, NFC ID, Auksion, oddiy "sovg'a qilish" (gift_offers)
// tizimlariga HECH QANDAY TA'SIR QILMAYDI — faqat qo'shimcha sifatida.
// ═══════════════════════════════════════════════════════════════════
const giftActivateLimiter = rateLimit({ windowMs: 15 * 60_000, max: 10 });

// Profil sahifasi (kod bo'sh bo'lganda) shu orqali "kutilayotgan sovg'a"
// bor-yo'qligini tekshiradi. Activation kodni QAYTARMAYDI (xavfsizlik).
app.get('/api/nfc-gifts/:code', async (req, res) => {
  const code = String(req.params.code || '').toUpperCase();
  if (!isDbReady()) return res.json({ gift: null });
  const gift = await getPendingGiftByCode(code);
  res.json({ gift: gift ? { code: gift.code, recipientName: gift.recipientName } : null });
});

// 1-bosqich: aktivatsiya kodini oldindan tekshirish (hali iste'mol qilinmaydi).
app.post('/api/nfc-gifts/:code/verify', giftActivateLimiter, async (req, res) => {
  const code = String(req.params.code || '').toUpperCase();
  const activationCode = String(req.body?.activationCode || '');
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  if (!activationCode.trim()) return res.status(422).json({ error: 'code_required' });
  const ok = await verifyGiftActivationCode(code, activationCode);
  if (!ok) return res.status(401).json({ error: 'bad_code' });
  res.json({ ok: true });
});

// 2-bosqich: to'liq profil yaratish + aktivatsiya — bitta so'rovda.
app.post('/api/nfc-gifts/:code/activate', giftActivateLimiter, async (req, res) => {
  const code = String(req.params.code || '').toUpperCase();
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });

  const activationCode = String(req.body?.activationCode || '');
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const name = cleanStr(req.body?.name, 80);
  const username = cleanStr(req.body?.username, 40);
  const phone = cleanStr(req.body?.phone, 30);
  const avatarUrl = safeUrl(req.body?.avatarUrl) || (String(req.body?.avatarUrl || '').startsWith('/uploads/') ? cleanStr(req.body.avatarUrl, 300) : '');
  const bio = cleanStr(req.body?.bio, 500);
  const instagram = cleanStr(req.body?.instagram, 60).replace(/^@/, '');
  const telegram = cleanStr(req.body?.telegram, 60).replace(/^@/, '');
  const youtube = safeUrl(req.body?.youtube);
  const tiktok = safeUrl(req.body?.tiktok);

  if (!activationCode.trim()) return res.status(422).json({ error: 'code_required' });
  if (!email || !email.includes('@')) return res.status(422).json({ error: 'bad_email' });
  if (password.length < 6) return res.status(422).json({ error: 'weak_password' });
  if (!name) return res.status(422).json({ error: 'name_required' });

  try {
    // 0) Aktivatsiya kodini AVVAL tekshiramiz — noto'g'ri bo'lsa hech narsa
    //    yaratmaymiz (ilgari zombie akkaunt/karta qolib ketardi).
    if (!(await verifyGiftActivationCode(code, activationCode))) {
      return res.status(401).json({ error: 'bad_code' });
    }

    // 1) Foydalanuvchi: agar shu email bilan akkaunt bo'lsa (masalan oldingi
    //    yarim tugagan urinishdan), parol to'g'ri bo'lsa — o'shani qayta
    //    ishlatamiz, aks holda 409. Aks holda yangi akkaunt.
    let user = await getUserByEmail(email);
    if (user && user.deletedAt) {
      // Ilgari o'chirilgan email — eski qatorni tozalab, yangisini yaratamiz.
      await adminDeleteUser(user.id);
      user = null;
    }
    if (user) {
      if (!verifyPassword(password, user.passwordHash)) {
        return res.status(409).json({ error: 'email_taken' });
      }
    } else {
      user = await createUser(email, hashPassword(password), {});
      if (!user) return res.status(409).json({ error: 'email_taken' });
      await assignPromoCode(user.id);
    }

    // YouTube/TikTok uchun YANGI ustun QO'SHILMADI — mavjud "qo'shimcha
    // havolalar" (extraLinks) mexanizmi ishlatildi (database strukturasi
    // o'zgarmadi).
    const extraLinks = [];
    if (youtube) extraLinks.push({ label: 'YouTube', url: youtube });
    if (tiktok) extraLinks.push({ label: 'TikTok', url: tiktok });

    const created = await createRecord({
      code,
      name: username ? `${name} (@${username})` : name,
      role: '',
      avatarUrl,
      about: bio,
      instagram,
      tg: telegram,
      phone,
      extraLinks,
      hashtags: [],
      price: 0,
    });
    if (!created) {
      // Karta allaqachon mavjud: agar u BOSHQA odamniki bo'lsa — 409.
      // Bizniki (yarim tugagan urinish) bo'lsa — davom etamiz.
      const owner = await getRecordOwner(code);
      if (owner && owner !== user.id) return res.status(409).json({ error: 'code_taken' });
    }
    await attachCardToUser(code, user.id);
    await setPrimaryCard(code, user.id);

    const result = await activateNfcGift(code, activationCode, user.id);
    if (result.error) {
      const key = result.error === 'CODE_TAKEN' ? 'code_taken' : result.error === 'BAD_CODE' ? 'bad_code' : result.error;
      return res.status(409).json({ error: key });
    }

    // Admin sovg'a qilgan NFC ID'lar har doim "Ekslyuziv" ko'rinishi kerak
    // (kod naqshidan qat'i nazar — faqat vizual tarif).
    await setCardTierOverride(code, 'exclusive').catch(() => {});

    // Mavjud login tizimi bilan bir xil — darhol tizimga kirgan holatda.
    const token = newSessionToken();
    await createSession(token, user.id, SESSION_TTL_MS);
    res.setHeader('Set-Cookie', sessionCookie(token, isSecureReq(req)));
    logAdminActivity({ action: 'nfc_gift_activated', details: `${code} — ${email}`, ip: req.ip }).catch(() => {});
    res.status(201).json({ ok: true, code });
  } catch (err) {
    console.error('[api] nfc-gift activate:', err.message);
    res.status(503).json({ error: 'db_unavailable' });
  }
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
