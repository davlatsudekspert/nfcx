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
  listForSale, setForSale, transferCard, updateCardStatus,
  getBotOrder, setBotOrderStatus,
} from './db.js';
import {
  hashPassword, verifyPassword, newSessionToken,
  sessionCookie, clearedSessionCookie, sessionTokenFromReq,
} from './auth.js';
import fs from 'fs/promises';
import crypto from 'crypto';
import { startBot, notifyOrderPaidAuto } from './bot.js';
import { paynetEnabled, paynetLink, verifyPaynetAuth, parsePaynetCallback } from './paynet.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;
const STD_CODE_RE = /^[A-Z]{3}[0-9]{3}$/;      // standart: AAA000
const LETTER_CODE_RE = /^[A-Z]{3,12}$/;         // premium: faqat harflar — ALI, UZBEKISTAN
const RESERVED_CODES = new Set([
  'LOGIN', 'REGISTER', 'ACCOUNT', 'API', 'ADMIN', 'STATIC', 'UPLOADS',
]);

function validCode(code) {
  return STD_CODE_RE.test(code) || LETTER_CODE_RE.test(code);
}

// Faqat harflardan iborat premium vizitka (nfcstore.uz/ali)?
function isLetterCode(code) {
  return LETTER_CODE_RE.test(code);
}

const THEME_WHITELIST = ['classic', 'midnight', 'emerald', 'royal', 'sunset'];

const app = express();
app.disable('x-powered-by');
// Railway reverse-proxy orqali: haqiqiy IP/protokolni olamiz.
app.set('trust proxy', 1);
app.use(express.json({ limit: '100kb' }));

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
  return {
    record: {
      name,
      role: cleanStr(body.role, 100),
      avatarUrl,
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
      if (cb.status === 'paid') {
        // To'lov paytida kodni boshqa birov olib ulgurmaganini tekshiramiz.
        const existing = await getRecord(order.code);
        if (existing) {
          await setWebOrderStatus(order.id, 'failed_code_taken');
          console.error(`[paynet] web#${order.id} (${order.code}) to'landi, lekin kod band edi — qo'lda qaytarish (refund) kerak!`);
        } else {
          const created = await createRecord({ ...order.payload, code: order.code, price: order.price });
          if (created) {
            await attachCardToUser(order.code, order.userId);
          }
          await setWebOrderStatus(order.id, 'paid');
          console.log(`[paynet] web#${order.id} (${order.code}) to'landi va foydalanuvchi #${order.userId}ga biriktirildi.`);
        }
      } else if (cb.status === 'cancelled') {
        await setWebOrderStatus(order.id, 'cancelled');
        console.log(`[paynet] web#${order.id} bekor qilindi.`);
      }
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

  try {
    const existing = await getUserByEmail(email);
    if (existing) return res.status(409).json({ error: 'email_taken' });
    const user = await createUser(email, hashPassword(password));
    if (!user) return res.status(409).json({ error: 'email_taken' });
    const token = newSessionToken();
    await createSession(token, user.id, SESSION_TTL_MS);
    console.log(`[auth] Yangi akkaunt: ${email}`);
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

  try {
    // Narxni server o'zi hisoblaydi (client narxiga ishonmaymiz):
    // joriy bazaviy narx = f(band qilingan vizitkalar soni).
    // Faqat harflardan iborat premium vizitka — oddiy vizitkadan 3 barobar qimmat.
    const sold = await countRecords();
    const price = isLetterCode(code)
      ? priceFor('AAA', '000', sold).base * 3
      : priceForCode(code, sold).total;

    // Kod bandligini tekshirish (pending statusli ham hisoblanadi)
    const existing = await getRecord(code);
    if (existing) return res.status(409).json({ error: 'already_taken' });

    // Karta 'pending' holatida yaratiladi, user_id bilan bog'lanadi
    // Admin (bot orqali) to'lovni tasdiqlagach status='active' bo'ladi
    const created = await createRecord({ ...record, code, price, status: 'pending' });
    if (!created) return res.status(409).json({ error: 'already_taken' });
    await attachCardToUser(code, user.id);

    console.log(`[api] Band qilindi (kutilmoqda): ${code} — ${created.name} (${price} so'm)`);
    res.status(201).json({ ...created, pending: true, message: 'Karta yaratildi, to\'lov tasdiqlanishi kutilmoqda. Chek rasmini @nfcsalebot ga yuboring.' });
  } catch (err) {
    console.error('[api] createRecord:', err.message);
    res.status(503).json({ error: 'db_unavailable' });
  }
});

// Sayt buyurtmasi holatini tekshirish (karta statusi) — frontend
// buyurtma yaratilgach shu endpointni pollaydi.
app.get('/api/orders/:code', async (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  const code = String(req.params.code || '').toUpperCase();
  if (!validCode(code)) return res.status(400).json({ error: 'bad_code' });
  try {
    const card = await getRecord(code);
    if (!card || card.user_id !== user.id) return res.status(404).json({ error: 'not_found' });
    res.json({ code: card.code, status: card.status, price: card.price, name: card.name });
  } catch (err) {
    console.error('[api] getOrder:', err.message);
    res.status(503).json({ error: 'db_unavailable' });
  }
});

// Foydalanuvchining barcha kutilayotgan kartalari (pending status)
app.get('/api/orders', async (req, res) => {
  if (!isDbReady()) return res.json({ orders: [] });
  const user = await currentUser(req);
  if (!user) return res.json({ orders: [] });
  try {
    const cards = await listRecordsByUser(user.id);
    const pending = cards.filter(c => c.status === 'pending' || c.status === 'rejected');
    res.json({ orders: pending.map(c => ({ code: c.code, status: c.status, price: c.price, name: c.name })) });
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

app.post('/api/upload', express.json({ limit: '1mb' }), async (req, res) => {
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
