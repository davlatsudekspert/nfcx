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
import fs from 'fs/promises';
import path from 'path';
import { generateSecret as totpGenerateSecret, generateURI as totpGenerateURI, verify as totpVerify } from 'otplib';
import { UPLOAD_DIR } from './paths.js';
import { isBlockedCode } from '../src/lib/pricing.js';
import { MENU_LIMITS, PRODUCT_LIMITS } from '../src/lib/access.js';
import { hashPassword, verifyPassword } from './auth.js';
import { sendTelegramOtp } from './bot.js';
import {
  isDbReady, adminListUsers, adminAdjustBalance, adminListOrders, adminListWalletTopups,
  adminListAuctions, adminCancelAuction, adminListPhysicalCards, adminSetPhysicalCardStatus, adminSetPhysicalCardActive,
  adminStats, closeAuctionBidding, createAuction, getActiveAuctionByCode, getRecord,
  getPlatformWallet, adminRevenueBreakdown, adminCommissionTimeSeries, adminSignupsTimeSeries,
  adminCardsTimeSeries, markAuctionPayoutPaid, adminListPendingPayouts, adminClearPendingPayout,
  adminExportStats,
  listAuctionRequests, approveAuctionRequest, rejectAuctionRequest, finalizePaidWebOrder, finalizePaidBotOrder,
  findPendingAuctionPaymentOrderByAuction,
  adminListManualAdjustments, setUserTestFlag,
  adminSuspendUser, adminUnsuspendUser, adminDeleteUser,
  logAdminLoginEvent, listAdminLoginHistory,
  logAdminActivity, listAdminActivityLog,
  getAdminSetting, setAdminSetting, listAdminIpWhitelist, addAdminIpWhitelist, removeAdminIpWhitelist,
  adminListSupportMessages, adminReplySupportMessage,
  getAdminByPhone, getAdminById, listAdmins, createAdmin, removeAdmin,
  setAdminTotpSecret, enableAdminTotp, disableAdminTotp, getAdminTotpSecret,
  createNfcGift, listNfcGifts,
  adminListReferrals,
  listNews, adminCreateNews, adminUpdateNews, adminDeleteNews,
  listCategories, adminCreateCategory, adminUpdateCategory, adminDeleteCategory,
  adminSetCardVerified, adminListVerifiedCards, adminSetCardViews,
  adminCompanyStats, adminListCompanies, adminGetCompany, adminSetCompanyDirectoryHidden, setCardTierOverride,
  listCompanyActivityLog,
  getLimitsOverride, setLimitsOverride, getPhysicalNfcTiers, setPhysicalNfcTiers,
  getDeliveryDays, setDeliveryDays,
  adminListAuctionDemand, adminAddAuctionDemand, adminUpdateAuctionDemand, adminDeleteAuctionDemand, getAuctionDemandByCode,
  FINANCE_EXPENSE_CATEGORIES, FINANCE_DOC_TYPES,
  financeGetRates, financeSetRate, financeComputePeriod, financeDailyBreakdown,
  financeMonthlyReconciliation, financeSetBankActual, financeListTransactions,
  financeListExpenses, financeAddExpense, financeDeleteExpense,
  financeListDocs, financeAddDoc, financeDeleteDoc,
  normalizeCompanyIdV2, adminListCompaniesV2, setCompanyStatusV2,
  listCompanyIdRulesV2, upsertCompanyIdRuleV2,
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

// Rasm yuklash (yangiliklar uchun) — UPLOAD_DIR paths.js'dan (index.js
// ham xuddi shu papkani ishlatadi).
const IMAGE_DATA_RE = /^data:(image\/(png|jpeg|jpg|webp|gif));base64,(.+)$/;

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
    console.error('[admin] TOTP sozlanmagan va ADMIN_CHAT_ID yo\u2019q — kirish xavfsiz tarzda bloklandi.');
    logAdminLoginEvent('two_factor_unavailable', req.ip, req.headers['user-agent']).catch(() => {});
    return res.status(503).json({ error: 'two_factor_unavailable' });
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const tempToken = newTempToken();
  pending2fa.set(tempToken, { adminId: admin.id, method: 'telegram', code, expiresAt: Date.now() + PENDING_2FA_TTL_MS });
  try {
    await sendTelegramOtp(adminChatId, code, 'admin_login');
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
// chiqarish, BUTUNLAY o'chirish (hard-delete — qator va barcha bog'liq
// ma'lumot bazadan o'chiriladi, email qayta ishlatish uchun bo'shaydi). ---
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
  logAdminActivity({ action: 'user_deleted', details: `Foydalanuvchi #${id} BUTUNLAY o'chirildi (hard-delete — email bo'shatildi)`, ip: req.ip }).catch(() => {});
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
  const minStep = req.body?.minStep ? Math.round(Number(req.body.minStep)) : 25000;

  if (!/^[A-Z0-9]{3,16}$/.test(code) || isBlockedCode(code)) return res.status(422).json({ error: 'bad_code' });
  if (!startPrice || startPrice < 10_000) return res.status(422).json({ error: 'bad_input' });
  if (buyNowPrice && buyNowPrice <= startPrice) return res.status(422).json({ error: 'buy_now_too_low' });
  if (minStep < 1_000) return res.status(422).json({ error: 'bad_input' });

  try {
    if (await getRecord(code)) return res.status(409).json({ error: 'code_taken' });
    if (await getActiveAuctionByCode(code)) return res.status(409).json({ error: 'already_in_auction' });
    const auction = await createAuction({ code, startPrice, buyNowPrice, hours, minStep });
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

// Tasdiqlash — so'rovni "Talab" board'iga qo'shadi (DEMAND_ACTIVE). Auksion
// faqat 20 kishi qiziqib (AUCTION_READY), admin alohida "Auksionni boshlash"
// bosganda ochiladi. Bu yerda AKTIV AUKSION YARATILMAYDI.
adminRouter.post('/auction-requests/:id/approve', async (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  try {
    const approved = await approveAuctionRequest(Number(req.params.id));
    if (!approved) return res.status(404).json({ error: 'not_found' });
    if (await getRecord(approved.code)) return res.status(409).json({ error: 'code_taken' });
    const row = (await adminAddAuctionDemand({ code: approved.code }))
      || (await getAuctionDemandByCode(approved.code));
    logAdminActivity({ action: 'auction_demand_added', details: approved.code, ip: req.ip }).catch(() => {});
    res.status(201).json(row);
  } catch (err) {
    console.error('[admin] approveAuctionRequest:', err.message);
    res.status(503).json({ error: 'db_unavailable' });
  }
});

// ---------- Auksion "Talab" board ----------

adminRouter.get('/auction-demand', async (req, res) => {
  if (!isDbReady()) return res.json({ demand: [] });
  res.json({ demand: await adminListAuctionDemand() });
});

adminRouter.post('/auction-demand', async (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  const code = String(req.body?.code || '').toUpperCase().trim();
  if (!/^[A-Z0-9]{3,16}$/.test(code) || isBlockedCode(code)) return res.status(422).json({ error: 'bad_code' });
  try {
    if (await getRecord(code)) return res.status(409).json({ error: 'code_taken' });
    const row = await adminAddAuctionDemand({
      code,
      startPrice: req.body?.startPrice,
      minStep: req.body?.minStep,
    });
    if (!row) return res.status(409).json({ error: 'already_exists' });
    logAdminActivity({ action: 'auction_demand_added', details: code, ip: req.ip }).catch(() => {});
    res.status(201).json(row);
  } catch (err) {
    console.error('[admin] addAuctionDemand:', err.message);
    res.status(503).json({ error: 'db_unavailable' });
  }
});

adminRouter.patch('/auction-demand/:id', async (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  const row = await adminUpdateAuctionDemand(Number(req.params.id), {
    status: req.body?.status,
    startPrice: req.body?.startPrice,
    minStep: req.body?.minStep,
  });
  if (!row) return res.status(404).json({ error: 'not_found' });
  res.json(row);
});

adminRouter.delete('/auction-demand/:id', async (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  const ok = await adminDeleteAuctionDemand(Number(req.params.id));
  if (!ok) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true });
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

// G'olib "To'lash" bosgan, lekin to'lov webhook kelmagan (yoki qo'lda
// Payme/karta orqali to'lagan) holatlar uchun — admin to'lovni QO'LDA
// tasdiqlaydi: kutilayotgan auction_payment buyurtmasi finalize qilinadi
// (auksion 'sold' bo'ladi, karta g'olibga o'tadi).
adminRouter.post('/auctions/:id/confirm-payment', async (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  const id = Number(req.params.id);
  const order = await findPendingAuctionPaymentOrderByAuction(id);
  if (!order) return res.status(409).json({ error: 'no_pending_payment' });
  const result = await finalizePaidWebOrder(order.id);
  if (!result || result.ok === false) return res.status(409).json({ error: 'confirm_failed' });
  logAdminActivity({ action: 'auction_payment_confirmed', details: `Auksion #${id} to'lovi qo'lda tasdiqlandi (buyurtma #${order.id})`, ip: req.ip }).catch(() => {});
  res.json({ ok: true });
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

// Statistikani .xlsx (Excel) qilib yuklab olish — Bugun/7 kun/30 kun/
// Shu oy/Custom oralig'iga mos.
adminRouter.get('/export-stats', requireAdmin, async (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  let days = 30;
  const opts = {};
  const range = String(req.query.range || '30d');
  const now = new Date();
  if (range === 'today') { opts.fromIso = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString(); days = 1; }
  else if (range === '7d') days = 7;
  else if (range === '30d') days = 30;
  else if (range === 'month') { opts.fromIso = new Date(now.getFullYear(), now.getMonth(), 1).toISOString(); days = now.getDate(); }
  else if (range === 'custom') {
    const from = String(req.query.from || '');
    const to = String(req.query.to || '');
    if (/^\d{4}-\d{2}-\d{2}$/.test(from)) opts.fromIso = new Date(from + 'T00:00:00').toISOString();
    if (/^\d{4}-\d{2}-\d{2}$/.test(to)) opts.toIso = new Date(to + 'T23:59:59.999').toISOString();
    if (!opts.fromIso) days = Math.max(1, Math.min(730, Number(req.query.days) || 30));
  }

  const { rows, summary } = await adminExportStats(days, opts);
  const XLSX = await import('xlsx');
  const header = ['Sana', 'Yangi ro\u2019yxatdan o\u2019tganlar', 'Yangi NFC ID (sotilgan)', 'Yangi Premium', 'Buyurtmalar', 'To\u2019lovlar', 'Tushum (so\u2019m)', 'Auksion (yaratilgan)', 'Auksion (sotilgan)'];
  const data = [header, ...rows.map((r) => [r.date, r.newUsers, r.newCards, r.newPremium, r.orders, r.payments, r.revenue, r.auctionsCreated, r.auctionsSold])];
  data.push([]);
  data.push(['JAMI', summary.newUsers, summary.newCards, summary.newPremium, summary.orders, summary.payments, summary.revenue, summary.auctionsCreated, summary.auctionsSold]);
  data.push([]);
  data.push(['\u2014 JAMLAMA \u2014']);
  data.push(['Oraliq', `${summary.from} \u2026 ${summary.to}`]);
  data.push(['Jami foydalanuvchilar (davr oxiriga)', summary.totalUsers]);
  data.push(['Jami Premium foydalanuvchilar', summary.totalPremium]);
  data.push(['Auksionlar \u2014 yaratilgan (davr)', summary.auctionsCreated]);
  data.push(['Auksionlar \u2014 sotilgan (davr)', summary.auctionsSold]);
  data.push(['Auksionlar \u2014 hozir faol', summary.activeAuctions]);
  data.push(['Jami to\u2019lovlar (davr)', summary.payments]);
  data.push(['Jami tushum (davr, so\u2019m)', summary.revenue]);
  data.push([]);
  data.push(['Trafik manbasi (Telegram / Instagram / Google)', 'kuzatuv tizimi hali ulanmagan']);

  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [{ wch: 34 }, ...header.slice(1).map(() => ({ wch: 20 }))];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Statistika');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  logAdminActivity({ action: 'stats_exported', details: `Oraliq: ${range}`, ip: req.ip }).catch(() => {});
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="nfcstore_statistika_${range}.xlsx"`);
  res.send(buf);
});

// Qo'lda kiritilgan balans tuzatishlari — daromad grafigidan ATAYLAB
// ajratilgan, faqat audit uchun.
adminRouter.get('/manual-adjustments', async (req, res) => {
  if (!isDbReady()) return res.json({ adjustments: [] });
  res.json({ adjustments: await adminListManualAdjustments() });
});

// Promokodlar — har bir promokod bilan kim kirgani (referral tarixi).
adminRouter.get('/referrals', async (req, res) => {
  if (!isDbReady()) return res.json({ referrals: [] });
  res.json({ referrals: await adminListReferrals() });
});


// ═══════════════════════════════════════════════════════════════════
// "GIFT NFC ID" — YANGI, IZOLYATSIYALANGAN admin bo'limi.
// ═══════════════════════════════════════════════════════════════════
adminRouter.get('/nfc-gifts', requireAdmin, async (req, res) => {
  if (!isDbReady()) return res.json({ gifts: [] });
  res.json({ gifts: await listNfcGifts() });
});

adminRouter.post('/nfc-gifts', requireAdmin, async (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  const code = String(req.body?.code || '').trim().toUpperCase();
  const recipientName = String(req.body?.recipientName || '').slice(0, 100).trim();
  const note = String(req.body?.note || '').slice(0, 300).trim();
  if (!/^[A-Z0-9]{3,16}$/.test(code) || isBlockedCode(code)) return res.status(422).json({ error: 'bad_code' });
  // Sovg'a qiymati \u2014 ixtiyoriy, admin so'z ("sovg'a") o'rniga aniq summa
  // yozib qo'yishi mumkin (konvert/hisobot uchun ko'rinadigan qiymat).
  let value = null;
  if (req.body?.value != null && req.body.value !== '') {
    const n = Math.round(Number(req.body.value));
    if (!Number.isFinite(n) || n < 0 || n > 1_000_000_000) return res.status(422).json({ error: 'bad_value' });
    value = n;
  }

  const result = await createNfcGift(code, recipientName, note, value);
  if (result.error) return res.status(409).json(result);
  logAdminActivity({ action: 'nfc_gift_created', details: `${code} \u2192 ${recipientName || 'nomsiz'}${value ? ` (${value} so'm)` : ''}`, newValue: result.gift.activationCode, ip: req.ip }).catch(() => {});
  res.status(201).json(result.gift);
});


// \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
// YANGILIKLAR \u2014 faqat admin joylaydi/tahrirlaydi/o'chiradi.
// \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
function cleanNewsImage(v) {
  const u = String(v || '').slice(0, 500).trim();
  if (!u) return '';
  if (/^https?:\/\//i.test(u) || u.startsWith('/uploads/')) return u;
  return '';
}

adminRouter.get('/news', async (req, res) => {
  if (!isDbReady()) return res.json({ news: [] });
  res.json({ news: await listNews({ includeUnpublished: true }) });
});

// Yangilik rasmi — fayldan yuklash (base64 dataURL -> /uploads/...).
adminRouter.post('/upload', async (req, res) => {
  const m = IMAGE_DATA_RE.exec(String(req.body?.dataUrl || ''));
  if (!m) return res.status(422).json({ error: 'bad_image' });
  const buf = Buffer.from(m[3], 'base64');
  if (!buf.length) return res.status(422).json({ error: 'bad_image' });
  if (buf.length > 10 * 1024 * 1024) return res.status(413).json({ error: 'too_large' });
  try {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    const ext = m[2] === 'jpeg' || m[2] === 'jpg' ? 'jpg' : m[2];
    const name = `news_${crypto.randomBytes(10).toString('hex')}.${ext}`;
    await fs.writeFile(path.join(UPLOAD_DIR, name), buf);
    res.json({ url: `/uploads/${name}` });
  } catch (err) {
    console.error('[admin] upload:', err.message);
    res.status(500).json({ error: 'upload_failed' });
  }
});

function newsFieldsFromBody(body, { partial } = {}) {
  const str = (v, max) => String(v ?? '').slice(0, max);
  const f = {};
  const set = (key, val) => { if (!partial || body[key] != null) f[key] = val; };
  set('title', str(body.title, 200).trim());
  set('body', str(body.body, 8000));
  set('titleRu', str(body.titleRu, 200).trim());
  set('titleEn', str(body.titleEn, 200).trim());
  set('bodyRu', str(body.bodyRu, 8000));
  set('bodyEn', str(body.bodyEn, 8000));
  if (!partial || body.imageUrl != null) f.imageUrl = cleanNewsImage(body.imageUrl);
  if (!partial || body.published != null) f.published = body.published !== false;
  return f;
}

adminRouter.post('/news', async (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  const f = newsFieldsFromBody(req.body || {});
  if (!f.title) return res.status(422).json({ error: 'title_required' });
  const row = await adminCreateNews(f);
  logAdminActivity({ action: 'news_created', details: f.title, ip: req.ip }).catch(() => {});
  res.status(201).json(row);
});

adminRouter.put('/news/:id', async (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  const f = newsFieldsFromBody(req.body || {}, { partial: true });
  const row = await adminUpdateNews(Number(req.params.id), f);
  if (!row) return res.status(404).json({ error: 'not_found' });
  logAdminActivity({ action: 'news_updated', details: `#${req.params.id}`, ip: req.ip }).catch(() => {});
  res.json(row);
});

adminRouter.delete('/news/:id', async (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  await adminDeleteNews(Number(req.params.id));
  logAdminActivity({ action: 'news_deleted', details: `#${req.params.id}`, ip: req.ip }).catch(() => {});
  res.json({ ok: true });
});

// ---------- Kategoriyalar (faoliyat sohalari taksonomiyasi) ----------
const cleanSlug = (v) => String(v || '').toLowerCase().trim().replace(/[^a-z0-9-]/g, '').slice(0, 60);

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

adminRouter.get('/categories', async (req, res) => {
  if (!isDbReady()) return res.json({ categories: [] });
  res.json({ categories: await listCategories({ includeDisabled: true }) });
});

adminRouter.post('/categories', async (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  const slug = cleanSlug(req.body?.slug);
  const f = categoryFieldsFromBody(req.body || {});
  if (!slug) return res.status(422).json({ error: 'slug_required' });
  if (!f.nameUz) return res.status(422).json({ error: 'name_required' });
  const existing = await listCategories({ includeDisabled: true });
  if (existing.some((c) => c.slug === slug)) return res.status(409).json({ error: 'slug_exists' });
  try {
    const row = await adminCreateCategory({ ...f, slug });
    logAdminActivity({ action: 'category_created', details: `${slug} — ${f.nameUz}`, ip: req.ip }).catch(() => {});
    res.status(201).json(row);
  } catch (err) {
    console.error('[admin] category create:', err.message);
    res.status(500).json({ error: 'create_failed' });
  }
});

adminRouter.put('/categories/:id', async (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  const f = categoryFieldsFromBody(req.body || {}, { partial: true });
  const row = await adminUpdateCategory(Number(req.params.id), f);
  if (!row) return res.status(404).json({ error: 'not_found' });
  logAdminActivity({ action: 'category_updated', details: `#${req.params.id}`, ip: req.ip }).catch(() => {});
  res.json(row);
});

adminRouter.delete('/categories/:id', async (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  await adminDeleteCategory(Number(req.params.id));
  logAdminActivity({ action: 'category_deleted', details: `#${req.params.id}`, ip: req.ip }).catch(() => {});
  res.json({ ok: true });
});

// ---------- Profil tasdiqlash (PHASE 5) ----------

adminRouter.get('/verified-cards', async (req, res) => {
  if (!isDbReady()) return res.json({ cards: [] });
  res.json({ cards: await adminListVerifiedCards() });
});

adminRouter.get('/records/:code', async (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  const rec = await getRecord(String(req.params.code || '').toUpperCase());
  if (!rec) return res.status(404).json({ error: 'not_found' });
  res.json({ code: rec.code, name: rec.name, role: rec.role, verified: !!rec.verified, profileType: rec.profileType, views: rec.views });
});

adminRouter.post('/records/:code/verify', async (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  const code = String(req.params.code || '').toUpperCase();
  const verified = req.body?.verified !== false;
  const row = await adminSetCardVerified(code, verified);
  if (!row) return res.status(404).json({ error: 'not_found' });
  logAdminActivity({ action: verified ? 'card_verified' : 'card_unverified', details: code, ip: req.ip }).catch(() => {});
  res.json(row);
});

adminRouter.post('/records/:code/views', async (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  const code = String(req.params.code || '').toUpperCase();
  const views = Number(req.body?.views);
  if (!Number.isFinite(views) || views < 0) return res.status(422).json({ error: 'bad_views' });
  const row = await adminSetCardViews(code, views);
  if (!row) return res.status(404).json({ error: 'not_found' });
  logAdminActivity({ action: 'card_views_set', details: `${code} → ${row.views}`, ip: req.ip }).catch(() => {});
  res.json(row);
});

// ═══════════════════════════════════════════════════════════════════
// KOMPANIYALAR (Company System — Admin Panel Faz 20–23). "Company" =
// profile_type = 'business' bo'lgan cards yozuvi — alohida jadval yo'q.
// Tarif — mavjud NFC ID tier_override tizimi (alohida obuna emas).
// ═══════════════════════════════════════════════════════════════════

const COMPANY_TIERS = new Set(['silver', 'gold', 'premium', 'exclusive']);
const COMPANY_V2_STATUSES = new Set(['draft','pending_review','approved','payment_pending','paid','active','rejected','suspended']);

// Mustaqil Company Account v2 arizalari. Quyidagi eski /companies
// endpointlari profile_type='business' legacy yozuvlari uchun qoldiriladi.
adminRouter.get('/company-requests', async (req,res) => {
  if (!isDbReady()) return res.json({ companies:[],counts:[] });
  const status = COMPANY_V2_STATUSES.has(req.query.status) ? req.query.status : null;
  res.json(await adminListCompaniesV2(status));
});

adminRouter.patch('/company-requests/:companyId/status', async (req,res) => {
  if (!isDbReady()) return res.status(503).json({ error:'db_unavailable' });
  const id = normalizeCompanyIdV2(req.params.companyId);
  const status = String(req.body?.status || '');
  const note = String(req.body?.note || '').trim().slice(0,500);
  if (!id || !COMPANY_V2_STATUSES.has(status)) return res.status(422).json({ error:'bad_status' });
  if (status === 'rejected' && !note) return res.status(422).json({ error:'note_required' });
  const company = await setCompanyStatusV2(id,status,`admin:${req.adminId}`,note);
  if (!company) return res.status(404).json({ error:'not_found' });
  logAdminActivity({ action:`company_v2_${status}`,details:id,newValue:status,ip:req.ip }).catch(()=>{});
  res.json({ company });
});

adminRouter.get('/company-id-rules', async (_req,res) => {
  if (!isDbReady()) return res.json({ rules:[] });
  res.json({ rules:await listCompanyIdRulesV2() });
});

adminRouter.put('/company-id-rules', async (req,res) => {
  if (!isDbReady()) return res.status(503).json({ error:'db_unavailable' });
  const id = normalizeCompanyIdV2(req.body?.companyId);
  const rule = ['reserved','off_sale','blocked','exclusive','allow'].includes(req.body?.rule) ? req.body.rule : 'reserved';
  const tierOverride = COMPANY_TIERS.has(req.body?.tierOverride) ? req.body.tierOverride : null;
  const priceOverride = req.body?.priceOverride === '' || req.body?.priceOverride == null ? null : Math.max(0,Math.round(Number(req.body.priceOverride)||0));
  if (!id) return res.status(422).json({ error:'bad_company_id' });
  await upsertCompanyIdRuleV2({ companyId:id,rule,tierOverride,priceOverride,note:String(req.body?.note||'').slice(0,500),updatedBy:`admin:${req.adminId}` });
  res.json({ ok:true });
});

adminRouter.get('/companies/stats', async (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  res.json(await adminCompanyStats());
});

adminRouter.get('/companies', async (req, res) => {
  if (!isDbReady()) return res.json({ companies: [] });
  res.json({ companies: await adminListCompanies() });
});

adminRouter.get('/companies/:code', async (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  const code = String(req.params.code || '').toUpperCase();
  const row = await adminGetCompany(code);
  if (!row) return res.status(404).json({ error: 'not_found' });
  res.json(row);
});

// Ommaviy katalog/qidiruvdan yashirish yoki qaytarish ("suspend"/"activate").
// Ma'lumot o'chirilmaydi — to'g'ridan-to'g'ri havola ishlayveradi.
adminRouter.post('/companies/:code/status', async (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  const code = String(req.params.code || '').toUpperCase();
  const hidden = req.body?.hidden === true;
  const row = await adminSetCompanyDirectoryHidden(code, hidden);
  if (!row) return res.status(404).json({ error: 'not_found' });
  logAdminActivity({ action: hidden ? 'company_suspended' : 'company_activated', details: code, ip: req.ip }).catch(() => {});
  res.json(row);
});

// Tarifni qo'lda belgilash (kod naqshidan qat'i nazar) — mavjud
// tier_override mexanizmi. null/'' — avtomatik (kod naqshiga qaytadi).
adminRouter.post('/companies/:code/tier', async (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  const code = String(req.params.code || '').toUpperCase();
  const raw = req.body?.tier;
  const tier = raw ? String(raw).toLowerCase() : null;
  if (tier && !COMPANY_TIERS.has(tier)) return res.status(422).json({ error: 'bad_tier' });
  const rec = await getRecord(code);
  if (!rec || rec.profileType !== 'business') return res.status(404).json({ error: 'not_found' });
  await setCardTierOverride(code, tier);
  logAdminActivity({ action: 'company_tier_set', details: code, newValue: tier || 'auto', ip: req.ip }).catch(() => {});
  res.json({ code, tierOverride: tier });
});

// ── Tariflar va narxlar (Faz 4 / 24 / 25 / 26) ──────────────────────
// Menyu/Mahsulotlar FREE-PRO limitlari, jismoniy NFC (ko'p dona) narx
// pog'onalari va yetkazib berish muddati — barchasi admin_settings'da
// saqlanadi, kod ichiga hard-code qilinmagan. Standart qiymatlar
// server/db.js'da (MENU_LIMITS/PRODUCT_LIMITS — src/lib/access.js;
// DEFAULT_PHYSICAL_NFC_TIERS/DEFAULT_DELIVERY_DAYS — server/db.js).

const LIMIT_TIERS = ['free', 'silver', 'gold', 'premium', 'exclusive'];

function mergeLimits(defaults, override) {
  const out = {};
  for (const tier of LIMIT_TIERS) {
    const d = defaults[tier];
    const o = (override && override[tier]) || {};
    out[tier] = {
      cat: Number.isFinite(Number(o.cat)) && Number(o.cat) >= 0 ? Number(o.cat) : d.cat,
      item: Number.isFinite(Number(o.item)) && Number(o.item) >= 0 ? Number(o.item) : d.item,
      images: typeof o.images === 'boolean' ? o.images : d.images,
      isCustom: Object.prototype.hasOwnProperty.call(override || {}, tier),
    };
  }
  return out;
}

// Kompaniyalar bo'yicha admin amallari jurnali (Faz 28) — Security
// tabidagi to'liq jurnaldan filtrlangan qism, admin (super bo'lmasa ham)
// ko'ra oladi, chunki Kompaniyalar bo'limining o'zi ham shunday.
adminRouter.get('/companies/activity-log', async (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  res.json({ log: await listCompanyActivityLog() });
});

adminRouter.get('/company-settings', async (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  const [menuOverride, productOverride, tiers, delivery] = await Promise.all([
    getLimitsOverride('menu'),
    getLimitsOverride('product'),
    getPhysicalNfcTiers(),
    getDeliveryDays(),
  ]);
  res.json({
    menuLimits: mergeLimits(MENU_LIMITS, menuOverride),
    productLimits: mergeLimits(PRODUCT_LIMITS, productOverride),
    physicalNfcTiers: tiers,
    delivery,
  });
});

// body: { kind: 'menu'|'product', tier: 'free'|..., cat, item, images }
adminRouter.post('/company-settings/limits', async (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  const kind = req.body?.kind === 'product' ? 'product' : (req.body?.kind === 'menu' ? 'menu' : null);
  const tier = String(req.body?.tier || '');
  if (!kind || !LIMIT_TIERS.includes(tier)) return res.status(422).json({ error: 'bad_input' });
  const cat = Math.max(0, Math.min(100000, Math.round(Number(req.body?.cat))));
  const item = Math.max(0, Math.min(1000000, Math.round(Number(req.body?.item))));
  const images = req.body?.images !== false;
  if (!Number.isFinite(cat) || !Number.isFinite(item)) return res.status(422).json({ error: 'bad_input' });
  const map = await getLimitsOverride(kind);
  const before = map[tier] || null;
  map[tier] = { cat, item, images };
  await setLimitsOverride(kind, map);
  logAdminActivity({
    action: 'company_limits_changed',
    details: `${kind}/${tier}`,
    oldValue: before ? JSON.stringify(before) : 'default',
    newValue: JSON.stringify(map[tier]),
    ip: req.ip,
  }).catch(() => {});
  res.json({ kind, tier, limits: map[tier] });
});

// Bitta tierni standart qiymatga qaytarish.
adminRouter.delete('/company-settings/limits/:kind/:tier', async (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  const kind = req.params.kind === 'product' ? 'product' : (req.params.kind === 'menu' ? 'menu' : null);
  const tier = req.params.tier;
  if (!kind || !LIMIT_TIERS.includes(tier)) return res.status(422).json({ error: 'bad_input' });
  const map = await getLimitsOverride(kind);
  delete map[tier];
  await setLimitsOverride(kind, map);
  logAdminActivity({ action: 'company_limits_reset', details: `${kind}/${tier}`, ip: req.ip }).catch(() => {});
  res.json({ ok: true });
});

// Jismoniy NFC (ko'p dona) narx pog'onalari — [{ minQty, maxQty|null, pricePerUnit }].
adminRouter.post('/company-settings/physical-pricing', async (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  const raw = req.body?.tiers;
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 20) return res.status(422).json({ error: 'bad_input' });
  const tiers = [];
  for (const t of raw) {
    const minQty = Math.round(Number(t?.minQty));
    const maxQtyRaw = t?.maxQty;
    const maxQty = maxQtyRaw === null || maxQtyRaw === '' || maxQtyRaw == null ? null : Math.round(Number(maxQtyRaw));
    const pricePerUnit = Math.round(Number(t?.pricePerUnit));
    if (!Number.isFinite(minQty) || minQty < 1) return res.status(422).json({ error: 'bad_tier' });
    if (maxQty !== null && (!Number.isFinite(maxQty) || maxQty < minQty)) return res.status(422).json({ error: 'bad_tier' });
    if (!Number.isFinite(pricePerUnit) || pricePerUnit < 0 || pricePerUnit > 100_000_000) return res.status(422).json({ error: 'bad_tier' });
    tiers.push({ minQty, maxQty, pricePerUnit });
  }
  await setPhysicalNfcTiers(tiers);
  logAdminActivity({ action: 'physical_nfc_pricing_changed', newValue: JSON.stringify(tiers), ip: req.ip }).catch(() => {});
  res.json({ tiers });
});

adminRouter.post('/company-settings/delivery', async (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  const minDays = Math.round(Number(req.body?.minDays));
  const maxDays = Math.round(Number(req.body?.maxDays));
  if (!Number.isFinite(minDays) || !Number.isFinite(maxDays) || minDays < 0 || maxDays < minDays || maxDays > 90) {
    return res.status(422).json({ error: 'bad_input' });
  }
  const delivery = { minDays, maxDays };
  await setDeliveryDays(delivery);
  logAdminActivity({ action: 'delivery_days_changed', newValue: JSON.stringify(delivery), ip: req.ip }).catch(() => {});
  res.json(delivery);
});

// ═══════════════════════════════════════════════════════════════════
// MOLIYA / BUXGALTERIYA — faqat Super Admin. Bu bo'lim mavjud to'lov
// mantig'iga TEGMAYDI, faqat web_orders/bot_orders'dan O'QIYDI +
// finance_* jadvallarni boshqaradi.
// ═══════════════════════════════════════════════════════════════════

// ?range=today|7d|30d|month|prev_month|custom&from=YYYY-MM-DD&to=YYYY-MM-DD
function financeRange(req) {
  const now = new Date();
  const y = now.getUTCFullYear();
  const mo = now.getUTCMonth();
  const range = String(req.query.range || '30d');
  let fromIso;
  let toIso = now.toISOString();
  if (range === 'today') {
    fromIso = new Date(Date.UTC(y, mo, now.getUTCDate())).toISOString();
  } else if (range === '7d') {
    fromIso = new Date(Date.now() - 7 * 864e5).toISOString();
  } else if (range === 'month') {
    fromIso = new Date(Date.UTC(y, mo, 1)).toISOString();
  } else if (range === 'prev_month') {
    fromIso = new Date(Date.UTC(y, mo - 1, 1)).toISOString();
    toIso = new Date(Date.UTC(y, mo, 1)).toISOString();
  } else if (range === 'custom') {
    const f = String(req.query.from || '');
    const t = String(req.query.to || '');
    if (/^\d{4}-\d{2}-\d{2}$/.test(f)) fromIso = new Date(f + 'T00:00:00.000Z').toISOString();
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) toIso = new Date(t + 'T23:59:59.999Z').toISOString();
    if (!fromIso) fromIso = new Date(Date.now() - 30 * 864e5).toISOString();
  } else {
    fromIso = new Date(Date.now() - 30 * 864e5).toISOString();
  }
  return { fromIso, toIso, range };
}

adminRouter.get('/finance/overview', requireSuperAdmin, async (req, res) => {
  if (!isDbReady()) return res.json({ overview: null });
  const { fromIso, toIso, range } = financeRange(req);
  const [overview, daily] = await Promise.all([
    financeComputePeriod(fromIso, toIso),
    financeDailyBreakdown(fromIso, toIso),
  ]);
  res.json({ overview, daily, range });
});

adminRouter.get('/finance/transactions', requireSuperAdmin, async (req, res) => {
  if (!isDbReady()) return res.json({ items: [], total: 0 });
  const { fromIso, toIso } = financeRange(req);
  const data = await financeListTransactions({
    fromIso, toIso,
    type: String(req.query.type || ''),
    status: String(req.query.status || ''),
    q: String(req.query.q || '').trim().slice(0, 60),
    page: Number(req.query.page) || 1,
    limit: Number(req.query.limit) || 50,
  });
  res.json(data);
});

adminRouter.get('/finance/rates', requireSuperAdmin, async (req, res) => {
  if (!isDbReady()) return res.json({ current: {}, history: {} });
  res.json(await financeGetRates());
});

adminRouter.post('/finance/rates', requireSuperAdmin, async (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  const { scope, params, effectiveFrom, note } = req.body || {};
  const before = await financeGetRates();
  const result = await financeSetRate({ scope, params, effectiveFrom, note });
  if (result.error) return res.status(422).json({ error: result.error });
  logAdminActivity({
    action: 'finance_rate_changed',
    details: `${scope} → ${effectiveFrom || 'bugun'}`,
    oldValue: JSON.stringify(before.current?.[scope]?.params || {}),
    newValue: JSON.stringify(result.rate.params || {}),
    ip: req.ip,
  }).catch(() => {});
  res.json(result);
});

adminRouter.get('/finance/reconciliation', requireSuperAdmin, async (req, res) => {
  if (!isDbReady()) return res.json({ months: [] });
  const year = Number(req.query.year) || new Date().getFullYear();
  res.json({ year, months: await financeMonthlyReconciliation(year) });
});

adminRouter.post('/finance/bank-actual', requireSuperAdmin, async (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  const { period, actualAmount, note } = req.body || {};
  const result = await financeSetBankActual({ period, actualAmount, note });
  if (result.error) return res.status(422).json({ error: result.error });
  logAdminActivity({ action: 'finance_bank_actual_set', details: `${period} → ${Math.round(Number(actualAmount) || 0)}`, ip: req.ip }).catch(() => {});
  res.json(result);
});

adminRouter.get('/finance/expenses', requireSuperAdmin, async (req, res) => {
  if (!isDbReady()) return res.json({ expenses: [], categories: FINANCE_EXPENSE_CATEGORIES });
  res.json({ expenses: await financeListExpenses(), categories: FINANCE_EXPENSE_CATEGORIES });
});

adminRouter.post('/finance/expenses', requireSuperAdmin, async (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  const result = await financeAddExpense(req.body || {});
  if (result.error) return res.status(422).json({ error: result.error });
  logAdminActivity({ action: 'finance_expense_added', details: `${result.expense.title} — ${result.expense.amount}`, ip: req.ip }).catch(() => {});
  res.json(result);
});

adminRouter.delete('/finance/expenses/:id', requireSuperAdmin, async (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  res.json(await financeDeleteExpense(req.params.id));
});

adminRouter.get('/finance/documents', requireSuperAdmin, async (req, res) => {
  if (!isDbReady()) return res.json({ documents: [], types: FINANCE_DOC_TYPES });
  res.json({ documents: await financeListDocs(), types: FINANCE_DOC_TYPES });
});

adminRouter.post('/finance/documents', requireSuperAdmin, async (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  let url = String(req.body?.url || '').trim();
  // Ixtiyoriy: fayl base64 dataURL sifatida kelsa — /uploads ga saqlaymiz.
  const dataUrl = String(req.body?.dataUrl || '');
  const m = /^data:(application\/pdf|text\/csv|image\/(png|jpeg|jpg|webp)|application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet|application\/vnd\.ms-excel);base64,(.+)$/.exec(dataUrl);
  if (m) {
    const buf = Buffer.from(m[m.length - 1], 'base64');
    if (buf.length > 15 * 1024 * 1024) return res.status(413).json({ error: 'too_large' });
    const extMap = { 'application/pdf': 'pdf', 'text/csv': 'csv', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/webp': 'webp', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx', 'application/vnd.ms-excel': 'xls' };
    const ext = extMap[m[1]] || 'bin';
    try {
      await fs.mkdir(UPLOAD_DIR, { recursive: true });
      const name = `fin_${crypto.randomBytes(10).toString('hex')}.${ext}`;
      await fs.writeFile(path.join(UPLOAD_DIR, name), buf);
      url = `/uploads/${name}`;
    } catch (err) {
      console.error('[admin] finance doc upload:', err.message);
      return res.status(500).json({ error: 'upload_failed' });
    }
  }
  const result = await financeAddDoc({ name: req.body?.name, docType: req.body?.docType, period: req.body?.period, url });
  if (result.error) return res.status(422).json({ error: result.error });
  logAdminActivity({ action: 'finance_document_added', details: result.doc.name, ip: req.ip }).catch(() => {});
  res.json(result);
});

adminRouter.delete('/finance/documents/:id', requireSuperAdmin, async (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  res.json(await financeDeleteDoc(req.params.id));
});

// Buxgalter uchun paket — bitta ko'p varaqli XLSX (jamlama + tranzaksiyalar +
// solishtirish). Alohida zip kutubxonasi shart emas.
adminRouter.get('/finance/report', requireSuperAdmin, async (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'db_unavailable' });
  const { fromIso, toIso, range } = financeRange(req);
  const [ov, daily, tx] = await Promise.all([
    financeComputePeriod(fromIso, toIso),
    financeDailyBreakdown(fromIso, toIso),
    financeListTransactions({ fromIso, toIso, limit: 200, page: 1 }),
  ]);
  const year = new Date(toIso).getFullYear();
  const recon = await financeMonthlyReconciliation(year);

  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();

  const summary = [
    ['MOLIYA HISOBOTI (ichki / dastlabki)', ''],
    ['Oraliq', `${ov.fromIso.slice(0, 10)} … ${ov.toIso.slice(0, 10)}`],
    [],
    ['Jami savdo (gross)', ov.grossSales],
    ['Refund', ov.refunds],
    ['Payme komissiyasi', ov.paymeFee],
    [`Payme rejimi`, ov.paymeMode === 'settlement_deducted' ? 'Settlementdan ushlanadi' : 'Alohida'],
    ['Payme’dan kutilgan tushum (expected)', ov.expectedBankSettlement],
    ['Bankka real tushgan (actual)', ov.actualBankSettlement == null ? 'kiritilmagan' : ov.actualBankSettlement],
    ['Solishtirish farqi', ov.reconciliationDifference == null ? '—' : ov.reconciliationDifference],
    [],
    ['Soliq bazasi', ov.taxBase],
    [`Aylanma solig‘i (${ov.turnoverPct}%)`, ov.turnoverTax],
    ['Ijtimoiy soliq', ov.socialTax],
    ['Bank xizmat haqi', ov.bankFees],
    ['Boshqa xarajatlar', ov.manualExpenses],
    [],
    ['SOF PUL OQIMI', ov.netCashFlow],
    [],
    ['To‘lov turi bo‘yicha:', ''],
    ...ov.byType.map((r) => [r.kind, r.total]),
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(summary);
  ws1['!cols'] = [{ wch: 40 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, ws1, 'Jamlama');

  const txHeader = ['Sana', 'Manba', 'Tur', 'Kod', 'Summa', 'Holat', 'Payme txn', 'Foydalanuvchi'];
  const txRows = tx.items.map((r) => [
    new Date(r.createdAt).toISOString().slice(0, 10), r.source, r.kind, r.code,
    r.amount, r.status, r.paymeTxnId || '', r.userEmail || '',
  ]);
  const ws2 = XLSX.utils.aoa_to_sheet([txHeader, ...txRows]);
  ws2['!cols'] = [{ wch: 12 }, { wch: 8 }, { wch: 16 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 26 }, { wch: 26 }];
  XLSX.utils.book_append_sheet(wb, ws2, 'Tranzaksiyalar');

  const dHeader = ['Kun', 'Buyurtma', 'Gross', 'Payme fee', 'Expected'];
  const ws3 = XLSX.utils.aoa_to_sheet([dHeader, ...daily.map((d) => [d.day, d.orders, d.gross, d.paymeFee, d.expected])]);
  ws3['!cols'] = [{ wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, ws3, 'Kunlik');

  const rHeader = ['Oy', 'Buyurtma', 'Gross', 'Payme fee', 'Expected', 'Actual', 'Farq', 'Holat'];
  const ws4 = XLSX.utils.aoa_to_sheet([rHeader, ...recon.map((m) => [
    m.period, m.orders, m.gross, m.paymeFee, m.expected, m.actual == null ? '' : m.actual, m.diff == null ? '' : m.diff, m.status,
  ])]);
  ws4['!cols'] = [{ wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, ws4, `Solishtirish ${year}`);

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  logAdminActivity({ action: 'finance_report_exported', details: `Oraliq: ${range}`, ip: req.ip }).catch(() => {});
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="nfcstore_moliya_${range}.xlsx"`);
  res.send(buf);
});
