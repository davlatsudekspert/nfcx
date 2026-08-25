// Admin panel — ODDIY foydalanuvchi tizimidan butunlay ALOHIDA autentifikatsiya.
// Login: telefon raqami + parol (email emas), chunki bu alohida imtiyozli
// kirish, oddiy foydalanuvchi akkaunti emas.
//
// XAVFSIZLIK: login/parolni HECH QACHON kodga yozmang. Railway Variables'ga
// qo'shing:
//   ADMIN_PANEL_PHONE=+998901234567
//   ADMIN_PANEL_PASSWORD=...
// (pastroqda .env.example'da izoh bor)

import express from 'express';
import crypto from 'crypto';
import { hashPassword, verifyPassword } from './auth.js';
import {
  isDbReady, adminListUsers, adminAdjustBalance, adminListOrders, adminListWalletTopups,
  adminListAuctions, adminCancelAuction, adminListPhysicalCards, adminSetPhysicalCardStatus,
  adminStats, settleAuction, listPremiumRequests, approvePremiumRequest, rejectPremiumRequest,
  getPlatformWallet, adminRevenueBreakdown, adminCommissionTimeSeries, adminSignupsTimeSeries,
  adminCardsTimeSeries,
} from './db.js';

// Oddiy in-memory rate-limiter (login endpointini brute-force'dan himoya
// qilish uchun) — index.js'dagi bilan bir xil andoza, bu yerga alohida
// nusxalandi, chunki admin.js mustaqil modul.
const loginHits = new Map();
function adminLoginLimiter(req, res, next) {
  const key = req.ip || '?';
  const now = Date.now();
  const windowMs = 15 * 60_000;
  const max = 8;
  const arr = (loginHits.get(key) || []).filter((t) => now - t < windowMs);
  if (arr.length >= max) return res.status(429).json({ error: 'too_many_requests' });
  arr.push(now);
  loginHits.set(key, arr);
  next();
}

const ADMIN_PHONE = (process.env.ADMIN_PANEL_PHONE || '').trim();
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PANEL_PASSWORD
  ? hashPassword(process.env.ADMIN_PANEL_PASSWORD)
  : '';
const AUCTION_COMMISSION_PCT = Number(process.env.AUCTION_COMMISSION_PCT || 5);

// Xotiradagi sessiya jadvali — admin biror marta bittasi, doim shu process
// ichida ishlaydi; Railway qayta ishga tushsa qayta kirish kifoya.
const adminSessions = new Map(); // token -> expiresAt (ms)
const ADMIN_TTL_MS = 24 * 60 * 60 * 1000;

function newAdminToken() {
  return crypto.randomBytes(32).toString('hex');
}

function adminCookieName() {
  return 'nfc_admin_session';
}

function setAdminCookie(res, token, secure) {
  const maxAge = Math.floor(ADMIN_TTL_MS / 1000);
  res.setHeader('Set-Cookie', `${adminCookieName()}=${token}; Path=/; HttpOnly; SameSite=Strict${secure ? '; Secure' : ''}; Max-Age=${maxAge}`);
}

function clearAdminCookie(res, secure) {
  res.setHeader('Set-Cookie', `${adminCookieName()}=; Path=/; HttpOnly; SameSite=Strict${secure ? '; Secure' : ''}; Max-Age=0`);
}

function tokenFromReq(req) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > -1 && part.slice(0, i).trim() === adminCookieName()) {
      return decodeURIComponent(part.slice(i + 1).trim());
    }
  }
  return null;
}

function requireAdmin(req, res, next) {
  const token = tokenFromReq(req);
  const exp = token && adminSessions.get(token);
  if (!exp || exp < Date.now()) return res.status(401).json({ error: 'unauthorized' });
  next();
}

export const adminRouter = express.Router();

adminRouter.post('/login', adminLoginLimiter, (req, res) => {
  if (!ADMIN_PHONE || !ADMIN_PASSWORD_HASH) {
    return res.status(503).json({ error: 'admin_not_configured' });
  }
  const phone = String(req.body?.phone || '').trim();
  const password = String(req.body?.password || '');
  const phoneOk = phone.length > 0 && phone === ADMIN_PHONE;
  const passOk = password.length > 0 && verifyPassword(password, ADMIN_PASSWORD_HASH);
  if (!phoneOk || !passOk) return res.status(401).json({ error: 'bad_credentials' });

  const token = newAdminToken();
  adminSessions.set(token, Date.now() + ADMIN_TTL_MS);
  setAdminCookie(res, token, req.headers['x-forwarded-proto'] === 'https' || req.secure);
  res.json({ ok: true });
});

adminRouter.post('/logout', (req, res) => {
  const token = tokenFromReq(req);
  if (token) adminSessions.delete(token);
  clearAdminCookie(res, req.headers['x-forwarded-proto'] === 'https' || req.secure);
  res.json({ ok: true });
});

adminRouter.get('/me', (req, res) => {
  const token = tokenFromReq(req);
  const exp = token && adminSessions.get(token);
  res.json({ authenticated: !!(exp && exp >= Date.now()) });
});

// --- Quyidagi barcha yo'llar login talab qiladi ---
adminRouter.use(requireAdmin);

adminRouter.get('/stats', async (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  res.json(await adminStats());
});

adminRouter.get('/users', async (req, res) => {
  if (!isDbReady()) return res.json({ users: [] });
  res.json({ users: await adminListUsers() });
});

adminRouter.post('/users/:id/adjust-balance', async (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  const id = Number(req.params.id);
  const amount = Math.round(Number(req.body?.amount));
  const note = String(req.body?.note || '').slice(0, 300);
  if (!id || !amount) return res.status(422).json({ error: 'bad_input' });
  const result = await adminAdjustBalance(id, amount, note);
  if (!result) return res.status(404).json({ error: 'not_found' });
  res.json(result);
});

adminRouter.get('/orders', async (req, res) => {
  if (!isDbReady()) return res.json({ orders: [] });
  res.json({ orders: await adminListOrders() });
});

adminRouter.get('/topups', async (req, res) => {
  if (!isDbReady()) return res.json({ topups: [] });
  res.json({ topups: await adminListWalletTopups() });
});

adminRouter.get('/auctions', async (req, res) => {
  if (!isDbReady()) return res.json({ auctions: [] });
  res.json({ auctions: await adminListAuctions() });
});

adminRouter.post('/auctions/:id/cancel', async (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  const id = Number(req.params.id);
  const ok = await adminCancelAuction(id, req.body?.note);
  if (!ok) return res.status(409).json({ error: 'cannot_cancel' });
  res.json({ ok: true });
});

// Muddatidan oldin majburan yakunlash (masalan sotuvchi so'ragan holatda).
adminRouter.post('/auctions/:id/force-settle', async (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  const id = Number(req.params.id);
  const result = await settleAuction(id, AUCTION_COMMISSION_PCT);
  if (!result) return res.status(409).json({ error: 'cannot_settle' });
  res.json(result);
});

adminRouter.get('/physical-cards', async (req, res) => {
  if (!isDbReady()) return res.json({ cards: [] });
  res.json({ cards: await adminListPhysicalCards() });
});

adminRouter.post('/physical-cards/:id/status', async (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  const id = Number(req.params.id);
  const status = String(req.body?.status || '');
  if (!['pending', 'printing', 'shipped', 'delivered'].includes(status)) {
    return res.status(422).json({ error: 'bad_status' });
  }
  const updated = await adminSetPhysicalCardStatus(id, status);
  if (!updated) return res.status(404).json({ error: 'not_found' });
  res.json(updated);
});

// --- Premium profil so'rovlari ---

adminRouter.get('/premium-requests', async (req, res) => {
  if (!isDbReady()) return res.json({ requests: [] });
  res.json({ requests: await listPremiumRequests('pending') });
});

adminRouter.post('/premium-requests/:id/approve', async (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  const result = await approvePremiumRequest(Number(req.params.id));
  if (!result) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true });
});

adminRouter.post('/premium-requests/:id/reject', async (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  const result = await rejectPremiumRequest(Number(req.params.id));
  if (!result) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true });
});

// --- Platforma hamyoni va statistika (diagrammalar) ---

adminRouter.get('/platform-wallet', async (req, res) => {
  if (!isDbReady()) return res.json({ balance: 0 });
  res.json({ balance: await getPlatformWallet() });
});

adminRouter.get('/analytics', async (req, res) => {
  if (!isDbReady()) {
    return res.json({ breakdown: [], commissionSeries: [], signupsSeries: [], cardsSeries: [] });
  }
  const [breakdown, commissionSeries, signupsSeries, cardsSeries] = await Promise.all([
    adminRevenueBreakdown(),
    adminCommissionTimeSeries(30),
    adminSignupsTimeSeries(30),
    adminCardsTimeSeries(30),
  ]);
  res.json({ breakdown, commissionSeries, signupsSeries, cardsSeries });
});
