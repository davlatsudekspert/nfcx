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
import { generateSecret as totpGenerateSecret, generateURI as totpGenerateURI, verify as totpVerify } from 'otplib';
import { hashPassword, verifyPassword } from './auth.js';
import { sendTelegramOtp } from './bot.js';
import {
  isDbReady, adminListUsers, adminAdjustBalance, adminListOrders, adminListWalletTopups,
  adminListAuctions, adminCancelAuction, adminListPhysicalCards, adminSetPhysicalCardStatus, adminSetPhysicalCardActive,
  adminStats, closeAuctionBidding, createAuction, getActiveAuctionByCode, getRecord,
  getPlatformWallet, adminRevenueBreakdown, adminCommissionTimeSeries, adminSignupsTimeSeries,
  adminCardsTimeSeries, markAuctionPayoutPaid, adminListPendingPayouts, adminClearPendingPayout,
  listAuctionRequests, approveAuctionRequest, rejectAuctionRequest, finalizePaidWebOrder, finalizePaidBotOrder,
  adminListManualAdjustments, setUserTestFlag,
  adminSuspendUser, adminUnsuspendUser, adminDeleteUser,
  logAdminLoginEvent, listAdminLoginHistory,
  logAdminActivity, listAdminActivityLog,
  getAdminSetting, setAdminSetting, listAdminIpWhitelist, addAdminIpWhitelist, removeAdminIpWhitelist,
  adminListSupportMessages, adminReplySupportMessage,
  getAdminByPhone, getAdminById, listAdmins, createAdmin, removeAdmin,
  setAdminTotpSecret, enableAdminTotp, disableAdminTotp, getAdminTotpSecret,
} from './db.js';

// Oddiy in-memory rate-limiter (login endpointini brute-force'dan himoya
// qilish uchun) — index.js'dagi bilan bir xil andoza, bu yerga alohida
// nusxalandi, chunki admin.js mustaqil modul.
const loginHits = new Map();
function adminLoginLimiter(req, res, next) {
  const key = req.ip || '?';
  const now = Date.now();
  const windowMs = 30 * 60_000; // xavfsizlik talabi: 3 urinish/30 daqiqa
  const max = 3;
  const arr = (loginHits.get(key) || []).filter((t) => now - t < windowMs);
  if (arr.length >= max) {
    logAdminLoginEvent('rate_limited', req.ip, req.headers['user-agent']).catch(() => {});
    return res.status(429).json({ error: 'too_many_requests' });
  }
  arr.push(now);
  loginHits.set(key, arr);
  next();
}

const AUCTION_COMMISSION_PCT = Number(process.env.AUCTION_COMMISSION_PCT || 5);

// Xotiradagi sessiya jadvali — admin biror marta bittasi, doim shu process
// ichida ishlaydi; Railway qayta ishga tushsa qayta kirish kifoya.
const adminSessions = new Map(); // token -> { absExp, lastActivity } (ms)
const ADMIN_TTL_MS = 24 * 60 * 60 * 1000;
// Xavfsizlik talabi: 10-15 daqiqa faoliyatsizlikdan keyin sessiya
// avtomatik tugaydi — token hali "umuman" amal qilsa ham.
const ADMIN_IDLE_MS = 12 * 60 * 1000;

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

// IP Whitelist — yoqilgan bo'lsa, faqat ro'yxatdagi IP'lardan kirishga
// ruxsat. XAVFSIZ TIKLASH: agar admin o'z (masalan dinamik) IP'sidan
// bloklanib qolsa, Railway'da ADMIN_IP_WHITELIST_BYPASS=true qo'yib,
// vaqtincha kirib, ro'yxatni yangilab, keyin o'chirib qo'yadi.
async function checkIpWhitelist(req, res, next) {
  if (process.env.ADMIN_IP_WHITELIST_BYPASS === 'true') return next();
  if (!isDbReady()) return next();
  try {
    const enabled = (await getAdminSetting('ip_whitelist_enabled')) === 'true';
    if (!enabled) return next();
    const list = await listAdminIpWhitelist();
    if (list.length === 0) return next(); // ro'yxat bo'sh bo'lsa hali cheklamaymiz
    if (!list.some((r) => r.ip === req.ip)) {
      logAdminLoginEvent('ip_blocked', req.ip, req.headers['user-agent']).catch(() => {});
      return res.status(403).json({ error: 'ip_not_whitelisted' });
    }
    next();
  } catch {
    next(); // xatolik bo'lsa adminni butunlay qulflab qo'ymaymiz
  }
}

function requireAdmin(req, res, next) {
  const token = tokenFromReq(req);
  const entry = token && adminSessions.get(token);
  if (!entry) return res.status(401).json({ error: 'unauthorized' });
  const now = Date.now();
  if (now > entry.absExp) {
    adminSessions.delete(token);
    return res.status(401).json({ error: 'unauthorized' });
  }
  if (now - entry.lastActivity > ADMIN_IDLE_MS) {
    adminSessions.delete(token);
    logAdminLoginEvent('idle_timeout', req.ip, req.headers['user-agent']).catch(() => {});
    return res.status(401).json({ error: 'idle_timeout' });
  }
  // Har bir muvaffaqiyatli so'rov "faollik"ni yangilaydi.
  entry.lastActivity = now;
  req.adminId = entry.adminId;
  req.adminRole = entry.role;
  checkIpWhitelist(req, res, next);
}

// Faqat Super Admin kira oladigan bo'limlar uchun (Security, Adminlar).
function requireSuperAdmin(req, res, next) {
  requireAdmin(req, res, () => {
    if (req.adminRole !== 'super_admin') return res.status(403).json({ error: 'forbidden' });
    next();
  });
}

// ---------- 2FA (ikki bosqichli tasdiqlash) ----------
// 1-bosqich: telefon+parol to'g'ri bo'lsa, Telegram'ga (ADMIN_CHAT_ID)
// bir martalik kod yuboriladi va VAQTINCHA token qaytariladi.
// 2-bosqich: shu token + kod bilan haqiqiy admin sessiyasi ochiladi.
const pending2fa = new Map(); // tempToken -> { code, expiresAt }
const PENDING_2FA_TTL_MS = 5 * 60_000;

function newTempToken() {
  return crypto.randomBytes(24).toString('hex');
}

export const adminRouter = express.Router();

adminRouter.post('/login', checkIpWhitelist, adminLoginLimiter, async (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  const phone = String(req.body?.phone || '').trim();
  const password = String(req.body?.password || '');
  const admin = await getAdminByPhone(phone);
  const passOk = admin && password.length > 0 && verifyPassword(password, admin.passwordHash);
  if (!admin || !passOk) {
    logAdminLoginEvent('bad_password', req.ip, req.headers['user-agent']).catch(() => {});
    return res.status(401).json({ error: 'bad_credentials' });
  }

  // ASOSIY 2FA: TOTP (Authenticator app) — agar admin allaqachon sozlagan bo'lsa.
  if (admin.totpEnabled && admin.totpSecret) {
    const tempToken = newTempToken();
    pending2fa.set(tempToken, { adminId: admin.id, method: 'totp', expiresAt: Date.now() + PENDING_2FA_TTL_MS });
    return res.json({ ok: true, twoFactor: true, method: 'totp', tempToken });
  }

  // Hali TOTP sozlanmagan bo'lsa — zaxira sifatida Telegram OTP.
  const adminChatId = process.env.ADMIN_CHAT_ID || '';
  if (!adminChatId) {
    console.warn('[admin] DIQQAT: TOTP sozlanmagan VA ADMIN_CHAT_ID yo\u2019q — 2FA ishlamayapti!');
    const token = newAdminToken();
    adminSessions.set(token, { absExp: Date.now() + ADMIN_TTL_MS, lastActivity: Date.now(), adminId: admin.id, role: admin.role });
    setAdminCookie(res, token, req.headers['x-forwarded-proto'] === 'https' || req.secure);
    return res.json({ ok: true, twoFactor: false });
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const tempToken = newTempToken();
  pending2fa.set(tempToken, { adminId: admin.id, method: 'telegram', code, expiresAt: Date.now() + PENDING_2FA_TTL_MS });
  try {
    await sendTelegramOtp(adminChatId, code);
  } catch (err) {
    console.error('[admin] 2FA kod yuborilmadi:', err.message);
    return res.status(503).json({ error: 'tg_send_failed' });
  }
  res.json({ ok: true, twoFactor: true, method: 'telegram', tempToken });
});

adminRouter.post('/verify-2fa', checkIpWhitelist, adminLoginLimiter, async (req, res) => {
  const tempToken = String(req.body?.tempToken || '');
  const code = String(req.body?.code || '').trim();
  const entry = pending2fa.get(tempToken);
  if (!entry || entry.expiresAt < Date.now()) {
    pending2fa.delete(tempToken);
    return res.status(401).json({ error: 'expired' });
  }

  let ok = false;
  if (entry.method === 'totp') {
    const secret = await getAdminTotpSecret(entry.adminId);
    if (secret) {
      const result = await totpVerify({ secret, token: code });
      ok = !!(result && result.valid);
    }
  } else {
    ok = entry.code === code;
  }
  if (!ok) {
    logAdminLoginEvent('bad_2fa', req.ip, req.headers['user-agent']).catch(() => {});
    return res.status(401).json({ error: 'bad_code' });
  }
  pending2fa.delete(tempToken);

  const admin = await getAdminById(entry.adminId);
  const token = newAdminToken();
  adminSessions.set(token, { absExp: Date.now() + ADMIN_TTL_MS, lastActivity: Date.now(), adminId: admin.id, role: admin.role });
  setAdminCookie(res, token, req.headers['x-forwarded-proto'] === 'https' || req.secure);
  logAdminLoginEvent('login_ok', req.ip, req.headers['user-agent']).catch(() => {});
  res.json({ ok: true });
});

adminRouter.post('/logout', (req, res) => {
  const token = tokenFromReq(req);
  logAdminLoginEvent('logout', req.ip, req.headers['user-agent']).catch(() => {});
  if (token) adminSessions.delete(token);
  clearAdminCookie(res, req.headers['x-forwarded-proto'] === 'https' || req.secure);
  res.json({ ok: true });
});

adminRouter.get('/me', (req, res) => {
  const token = tokenFromReq(req);
  const entry = token && adminSessions.get(token);
  const authenticated = !!(entry && entry.absExp >= Date.now() && Date.now() - entry.lastActivity <= ADMIN_IDLE_MS);
  res.json({ authenticated, role: authenticated ? entry.role : null });
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

// Bu akkaunt admin/sinov ekanini belgilash-belgilamaslik — belgilangan
// akkauntlar "Foydalanuvchilar", "Jami savdo" kabi asosiy statistikaga
// kirmaydi (lekin jadvalda ko'rinishda davom etadi).
adminRouter.post('/users/:id/set-test', async (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  await setUserTestFlag(Number(req.params.id), req.body?.isTest !== false);
  res.json({ ok: true });
});

// --- Foydalanuvchini moderatsiya qilish: vaqtincha bloklash, blokdan
// chiqarish, butunlay o'chirish (soft-delete — ma'lumot saqlanadi). ---
adminRouter.post('/users/:id/suspend', async (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  const days = Math.max(1, Math.min(3650, Math.round(Number(req.body?.days) || 7)));
  const reason = String(req.body?.reason || '').slice(0, 200).trim();
  if (!reason) return res.status(422).json({ error: 'reason_required' });
  const id = Number(req.params.id);
  await adminSuspendUser(id, days, reason);
  logAdminActivity({ action: 'user_suspended', details: `Foydalanuvchi #${id} — ${days} kunga`, newValue: reason, ip: req.ip }).catch(() => {});
  res.json({ ok: true });
});

adminRouter.post('/users/:id/unsuspend', async (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  const id = Number(req.params.id);
  await adminUnsuspendUser(id);
  logAdminActivity({ action: 'user_unsuspended', details: `Foydalanuvchi #${id}`, ip: req.ip }).catch(() => {});
  res.json({ ok: true });
});

adminRouter.post('/users/:id/delete', async (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  const id = Number(req.params.id);
  await adminDeleteUser(id);
  logAdminActivity({ action: 'user_deleted', details: `Foydalanuvchi #${id} o'chirildi (soft-delete)`, ip: req.ip }).catch(() => {});
  res.json({ ok: true });
});

adminRouter.post('/users/:id/adjust-balance', async (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  const id = Number(req.params.id);
  const amount = Math.round(Number(req.body?.amount));
  const note = String(req.body?.note || '').slice(0, 300);
  if (!id || !amount) return res.status(422).json({ error: 'bad_input' });
  const result = await adminAdjustBalance(id, amount, note);
  if (!result) return res.status(404).json({ error: 'not_found' });
  logAdminActivity({ action: 'balance_adjusted', details: `Foydalanuvchi #${id}`, newValue: `${amount > 0 ? '+' : ''}${amount} so'm (${note})`, ip: req.ip }).catch(() => {});
  res.json(result);
});

adminRouter.get('/orders', async (req, res) => {
  if (!isDbReady()) return res.json({ orders: [] });
  res.json({ orders: await adminListOrders() });
});

// To'lov qandaydir sababga ko'ra (masalan Payme webhook kelmay qolsa)
// avtomatik tasdiqlanmagan bo'lsa, admin qo'lda tasdiqlaydi — bu web_orders
// yozuvini "to'landi" deb belgilaydi va tegishli natijani (karta yaratish,
// auksionni yakunlash va h.k.) ishga tushiradi.
adminRouter.post('/orders/:id/confirm-payment', async (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  const result = await finalizePaidWebOrder(Number(req.params.id));
  if (result.alreadyProcessed) return res.status(409).json({ error: 'already_processed' });
  res.json(result);
});

// Xuddi shu, lekin Telegram BOT orqali kelgan buyurtmalar uchun (masalan
// foydalanuvchi chekni skrinshot qilib yuborgan, admin ko'zi bilan
// tekshirib "to'landi" deb belgilaydi).
adminRouter.post('/bot-orders/:id/confirm-payment', async (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  const result = await finalizePaidBotOrder(Number(req.params.id));
  if (result.alreadyProcessed) return res.status(409).json({ error: 'already_processed' });
  res.json(result);
});

adminRouter.get('/topups', async (req, res) => {
  if (!isDbReady()) return res.json({ topups: [] });
  res.json({ topups: await adminListWalletTopups() });
});

adminRouter.get('/auctions', async (req, res) => {
  if (!isDbReady()) return res.json({ auctions: [] });
  res.json({ auctions: await adminListAuctions() });
});

// Auksion yaratishning YAGONA yo'li — faqat admin, faqat hali hech kimga
// tegishli bo'lmagan (band qilinmagan) YANGI kodlar uchun.
const ADMIN_AUCTION_MAX_HOURS = 72;
adminRouter.post('/auctions', async (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  const code = String(req.body?.code || '').toUpperCase().trim();
  const startPrice = Math.round(Number(req.body?.startPrice));
  const buyNowPrice = req.body?.buyNowPrice ? Math.round(Number(req.body.buyNowPrice)) : null;
  const hours = Math.min(ADMIN_AUCTION_MAX_HOURS, Math.max(1, Math.round(Number(req.body?.hours) || 24)));

  if (!/^[A-Z0-9]{3,16}$/.test(code)) return res.status(422).json({ error: 'bad_code' });
  if (!startPrice || startPrice < 10_000) return res.status(422).json({ error: 'bad_input' });
  if (buyNowPrice && buyNowPrice <= startPrice) return res.status(422).json({ error: 'buy_now_too_low' });

  try {
    if (await getRecord(code)) return res.status(409).json({ error: 'code_taken' });
    if (await getActiveAuctionByCode(code)) return res.status(409).json({ error: 'already_in_auction' });
    const auction = await createAuction({ code, startPrice, buyNowPrice, hours });
    logAdminActivity({ action: 'auction_created', details: `Kod: ${code}`, newValue: `Boshlang'ich: ${startPrice} so'm, ${hours} soat`, ip: req.ip }).catch(() => {});
    res.status(201).json(auction);
  } catch (err) {
    console.error('[admin] createAuction:', err.message);
    res.status(503).json({ error: 'db_unavailable' });
  }
});

// --- Foydalanuvchilardan kelgan "noyob nomni auksionga qo'ying" so'rovlari ---

// --- Foydalanuvchilardan kelgan adminga murojaatlar ---

// Security → Login History.
adminRouter.get('/login-history', requireSuperAdmin, async (req, res) => {
  if (!isDbReady()) return res.json({ history: [] });
  res.json({ history: await listAdminLoginHistory() });
});

// Security → Activity Log — oddiy admin buni O'CHIRA OLMAYDI (DELETE
// endpoint yo'q, faqat o'qish).
adminRouter.get('/activity-log', requireSuperAdmin, async (req, res) => {
  if (!isDbReady()) return res.json({ log: [] });
  res.json({ log: await listAdminActivityLog() });
});

// --- IP Whitelist boshqaruvi ---
adminRouter.get('/ip-whitelist', requireSuperAdmin, async (req, res) => {
  if (!isDbReady()) return res.json({ enabled: false, ips: [], yourIp: req.ip });
  const enabled = (await getAdminSetting('ip_whitelist_enabled')) === 'true';
  res.json({ enabled, ips: await listAdminIpWhitelist(), yourIp: req.ip });
});

adminRouter.post('/ip-whitelist/toggle', requireSuperAdmin, async (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  const enabled = req.body?.enabled === true;
  if (enabled) {
    const list = await listAdminIpWhitelist();
    if (list.length === 0) return res.status(422).json({ error: 'no_ips' });
  }
  await setAdminSetting('ip_whitelist_enabled', enabled ? 'true' : 'false');
  logAdminActivity({ action: enabled ? 'ip_whitelist_enabled' : 'ip_whitelist_disabled', ip: req.ip }).catch(() => {});
  res.json({ ok: true });
});

adminRouter.post('/ip-whitelist/add', requireSuperAdmin, async (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  const ip = String(req.body?.ip || '').trim();
  const label = String(req.body?.label || '').slice(0, 60).trim();
  if (!ip) return res.status(422).json({ error: 'ip_required' });
  const result = await addAdminIpWhitelist(ip, label);
  if (result.error) return res.status(409).json(result);
  logAdminActivity({ action: 'ip_whitelist_added', newValue: `${ip} (${label})`, ip: req.ip }).catch(() => {});
  res.status(201).json({ ok: true });
});

adminRouter.post('/ip-whitelist/:id/remove', requireSuperAdmin, async (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  await removeAdminIpWhitelist(Number(req.params.id));
  logAdminActivity({ action: 'ip_whitelist_removed', details: `ID: ${req.params.id}`, ip: req.ip }).catch(() => {});
  res.json({ ok: true });
});

// --- TOTP (Authenticator app) 2FA ro'yxatdan o'tkazish ---
// 1) /2fa/totp/setup — yangi maxfiy kalit yaratadi, otpauth:// havolasini
//    qaytaradi (frontend shundan QR-kod chizadi).
// 2) /2fa/totp/confirm — foydalanuvchi authenticator ilovadan ko'rgan
//    6 xonali kodni tasdiqlagach, TOTP haqiqatan YOQILADI.
adminRouter.post('/2fa/totp/setup', requireAdmin, async (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  const admin = await getAdminById(req.adminId);
  const secret = totpGenerateSecret();
  await setAdminTotpSecret(req.adminId, secret);
  const otpauth = totpGenerateURI({ secret, label: admin.phone, issuer: 'NFCSTORE Admin' });
  res.json({ secret, otpauth });
});

adminRouter.post('/2fa/totp/confirm', requireAdmin, async (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  const code = String(req.body?.code || '').trim();
  const secret = await getAdminTotpSecret(req.adminId);
  if (!secret) return res.status(422).json({ error: 'not_set_up' });
  const result = await totpVerify({ secret, token: code });
  if (!result?.valid) return res.status(401).json({ error: 'bad_code' });
  await enableAdminTotp(req.adminId);
  logAdminActivity({ action: 'totp_enabled', ip: req.ip }).catch(() => {});
  res.json({ ok: true });
});

adminRouter.post('/2fa/totp/disable', requireAdmin, async (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  await disableAdminTotp(req.adminId);
  logAdminActivity({ action: 'totp_disabled', ip: req.ip }).catch(() => {});
  res.json({ ok: true });
});

// --- Adminlar boshqaruvi (faqat Super Admin) ---
adminRouter.get('/admins', requireSuperAdmin, async (req, res) => {
  if (!isDbReady()) return res.json({ admins: [] });
  res.json({ admins: await listAdmins() });
});

adminRouter.post('/admins', requireSuperAdmin, async (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  const phone = String(req.body?.phone || '').trim();
  const password = String(req.body?.password || '');
  const name = String(req.body?.name || '').slice(0, 60).trim();
  const role = ['super_admin', 'manager', 'content_manager'].includes(req.body?.role) ? req.body.role : 'manager';
  if (!phone || password.length < 6) return res.status(422).json({ error: 'bad_input' });
  const created = await createAdmin({ phone, passwordHash: hashPassword(password), name, role });
  if (!created) return res.status(409).json({ error: 'phone_taken' });
  logAdminActivity({ action: 'admin_created', details: `${phone} (${role})`, ip: req.ip }).catch(() => {});
  res.status(201).json({ ok: true });
});

adminRouter.post('/admins/:id/remove', requireSuperAdmin, async (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  const id = Number(req.params.id);
  if (id === req.adminId) return res.status(400).json({ error: 'cannot_remove_self' });
  await removeAdmin(id);
  logAdminActivity({ action: 'admin_removed', details: `ID: ${id}`, ip: req.ip }).catch(() => {});
  res.json({ ok: true });
});

adminRouter.get('/me-full', requireAdmin, async (req, res) => {
  const admin = await getAdminById(req.adminId);
  res.json({ admin });
});

adminRouter.get('/support-messages', async (req, res) => {
  if (!isDbReady()) return res.json({ messages: [] });
  res.json({ messages: await adminListSupportMessages(req.query.status || null) });
});

adminRouter.post('/support-messages/:id/reply', async (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  const reply = String(req.body?.reply || '').slice(0, 1000).trim();
  if (!reply) return res.status(422).json({ error: 'reply_required' });
  const updated = await adminReplySupportMessage(Number(req.params.id), reply);
  if (!updated) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true });
});

adminRouter.get('/auction-requests', async (req, res) => {
  if (!isDbReady()) return res.json({ requests: [] });
  res.json({ requests: await listAuctionRequests('pending') });
});

adminRouter.post('/auction-requests/:id/reject', async (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  const ok = await rejectAuctionRequest(Number(req.params.id));
  if (!ok) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true });
});

// Tasdiqlash — bir vaqtning o'zida haqiqiy auksionni ham yaratadi
// (admin narx/muddatni shu yerda belgilaydi).
adminRouter.post('/auction-requests/:id/approve', async (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  const startPrice = Math.round(Number(req.body?.startPrice));
  const buyNowPrice = req.body?.buyNowPrice ? Math.round(Number(req.body.buyNowPrice)) : null;
  const hours = Math.min(ADMIN_AUCTION_MAX_HOURS, Math.max(1, Math.round(Number(req.body?.hours) || 24)));
  if (!startPrice || startPrice < 10_000) return res.status(422).json({ error: 'bad_input' });

  try {
    const approved = await approveAuctionRequest(Number(req.params.id));
    if (!approved) return res.status(404).json({ error: 'not_found' });
    if (await getRecord(approved.code)) return res.status(409).json({ error: 'code_taken' });
    if (await getActiveAuctionByCode(approved.code)) return res.status(409).json({ error: 'already_in_auction' });
    const auction = await createAuction({ code: approved.code, startPrice, buyNowPrice, hours });
    res.status(201).json(auction);
  } catch (err) {
    console.error('[admin] approveAuctionRequest:', err.message);
    res.status(503).json({ error: 'db_unavailable' });
  }
});

adminRouter.post('/auctions/:id/cancel', async (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  const id = Number(req.params.id);
  const ok = await adminCancelAuction(id, req.body?.note);
  if (!ok) return res.status(409).json({ error: 'cannot_cancel' });
  res.json({ ok: true });
});

// Muddatidan oldin majburan bidlashni yopish (masalan sotuvchi so'ragan
// holatda) — g'olib bo'lsa 24 soatlik to'lov muddati boshlanadi, pul
// harakatlanmaydi (e-wallet yo'q).
adminRouter.post('/auctions/:id/force-settle', async (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  const id = Number(req.params.id);
  const result = await closeAuctionBidding(id);
  if (!result) return res.status(409).json({ error: 'cannot_settle' });
  res.json(result);
});

// Sotuvchiga auksion daromadini (95%) qo'lda to'lagach shu bosiladi.
adminRouter.post('/auctions/:id/mark-payout-paid', async (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  const id = Number(req.params.id);
  const result = await markAuctionPayoutPaid(id);
  if (!result) return res.status(409).json({ error: 'cannot_mark_paid' });
  res.json({ ok: true });
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

// NFC kartani bloklash — chip_token (ko'rinmas havola: nfcstore.uz/vip001?t=...)
// endi profilni ochmay qo'yadi.
adminRouter.post('/physical-cards/:id/active', async (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  const id = Number(req.params.id);
  const active = req.body?.active !== false;
  const updated = await adminSetPhysicalCardActive(id, active);
  if (!updated) return res.status(404).json({ error: 'not_found' });
  logAdminActivity({ action: active ? 'nfc_card_unblocked' : 'nfc_card_blocked', details: `Kod: ${updated.linkedCode || id}`, ip: req.ip }).catch(() => {});
  res.json(updated);
});

// --- To'lanishi kerak bo'lgan pullar (auksion sotuvchilari, premium egalari) ---
// Endi "premium so'rovi tasdiqlash" kerak emas — Premium status to'lov
// webhook orqali AVTOMATIK faollashadi (real Payme to'lovi tasdiqlangach).
// Admin faqat pending_payout'larni (odamlarga to'lash kerak bo'lgan real
// pulni) ko'radi va qo'lda to'laganidan keyin shu yerda "tozalaydi".

adminRouter.get('/pending-payouts', async (req, res) => {
  if (!isDbReady()) return res.json({ payouts: [] });
  res.json({ payouts: await adminListPendingPayouts() });
});

adminRouter.post('/pending-payouts/:userId/clear', async (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  const amount = Math.round(Number(req.body?.amount));
  if (!amount || amount <= 0) return res.status(422).json({ error: 'bad_amount' });
  const result = await adminClearPendingPayout(Number(req.params.userId), amount);
  if (!result) return res.status(409).json({ error: 'amount_exceeds_pending' });
  res.json(result);
});

// --- Auksion sotuvchi to'lovlari (alohida, chunki har bir auksionga bog'liq) ---

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

// Qo'lda kiritilgan balans tuzatishlari — daromad grafigidan ATAYLAB
// ajratilgan, faqat audit uchun.
adminRouter.get('/manual-adjustments', async (req, res) => {
  if (!isDbReady()) return res.json({ adjustments: [] });
  res.json({ adjustments: await adminListManualAdjustments() });
});

