// PROMOKOD MUKOFOTI: HAR FAOL DO'ST UCHUN +30 KUN PREMIUM — hosting/api/referrals.js.
//   node scripts/test-referral-rewards.mjs
//   UZ_ADAPTER_TEST=1 node scripts/test-referral-rewards.mjs   (sqld adapteri)
//
// KECHIKTIRILGAN MODEL (ko'rik F1/F2, 2026-10-06) tekshiriladi:
//   * ro'yxatda faqat 'pending' yozuv (10% chegirma avvalgidek, darhol);
//   * `REFERRAL_REWARD_ENABLED` o'chiq — hech narsa berilmaydi, yozuvlar to'planadi;
//   * 7 kun + faollik (avatar / post / istorya / ilovada 2 xil kun) — cron yoki /me beradi;
//   * normallangan email (gmail nuqta/+teg) takrori va taklif qiluvchining o'z emaili — rad;
//   * o'sha telefon, o'chirilgan do'st/taklif qiluvchi, muddatsiz Premium — rad; ban — kutadi;
//   * 60 kunda faollik yo'q — 'expired';
//   * atomar yillik chegara (24) parallel ishlovda ham oshmaydi; 365 kundan eskilari sanalmaydi;
//   * muddat yozilmasa — 'granting' qoladi va cron keyin yakunlaydi (ikki marta berilmaydi);
//   * /i/:code (cookie + 302), AASA'da /i/* YO'Q (F3);
//   * ro'yxatdan keyin nfc_ref cookie o'chiriladi; `promoCleared` — cookie qo'llanmaydi (F8);
//   * `referral_reward` ilovada yashirin, saytda — do'stning ochiq ismi, standart (email) nom — bo'sh (F7);
//   * /api/referrals/summary va admin reytingi faqat berilganlarni sanaydi.
// Production'ga HECH QACHON tegmaydi.
import { readFileSync } from 'node:fs';
import worker from '../hosting/worker.js';
import { makeEnv, seedBasic, req, cookie, makeChecker, sha256Hex } from './lib/d1-harness.mjs';
import {
  REFERRAL_REWARD_MAX_PER_YEAR, normalizeEmail, processReferralRewards, recordPendingReward,
  __resetReferralThrottleForTests,
} from '../hosting/api/referrals.js';
import { ensureTable as ensureAppUsers } from '../hosting/api/app-usage.js';

const { check, checkTrue, done } = makeChecker();
const { env, sqlite } = makeEnv({}, { atomicBatch: true }); // email xizmati o'chiq — tasdiq Telegram token orqali
await seedBasic(env);
await ensureAppUsers(env);
const DAY = 86_400_000;
sqlite.prepare(`UPDATE users SET promo_code = 'ABC234' WHERE id = 1`).run();
sqlite.prepare(`UPDATE users SET promo_code = 'XYZ789' WHERE id = 2`).run();
const H = { nowTs: () => new Date().toISOString(), isPlaceholderEmailD1: (e) => String(e || '').endsWith('@nfcstore.local') };

let ipN = 1;
const call = async (path, init = {}) => {
  const res = await worker.fetch(req(path, { ip: `198.51.100.${ipN++ % 250}`, ...init }), env);
  const text = await res.text();
  let body = null; try { body = JSON.parse(text); } catch { body = text; }
  return { status: res.status, body, headers: res.headers };
};
// Tasdiqlangan ro'yxat: Telegram orqali bog'langan telefon tokeni.
let phoneN = 4440000;
async function register({ promoCode, verified = true, phone, email, cookieHeader, promoCleared } = {}) {
  const ph = phone || `+99890${++phoneN}`;
  const body = { password: 'parol123', phone: ph, tosAccepted: true, ...(promoCode !== undefined ? { promoCode } : {}) };
  if (email) body.email = email;
  if (promoCleared !== undefined) body.promoCleared = promoCleared;
  if (verified) {
    const token = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');
    sqlite.prepare(`INSERT INTO tg_link_tokens (token, status, phone, tg_user_id, expires_at, created_at) VALUES (?, 'linked', ?, 77, ?, ?)`)
      .run(sha256Hex(token), ph, Date.now() + 600_000, Date.now());
    body.linkToken = token;
  }
  const r = await call('/api/auth/register', { method: 'POST', json: body, ...(cookieHeader ? { cookie: cookieHeader } : {}) });
  const setCookies = typeof r.headers.getSetCookie === 'function' ? r.headers.getSetCookie() : [r.headers.get('set-cookie') || ''];
  const sess = setCookies.map((c) => c.split(';')[0]).find((c) => c.startsWith('nfc_session=')) || '';
  return { ...r, id: r.body?.user?.id, session: sess, setCookies };
}
const user = (id) => sqlite.prepare(`SELECT premium_expires_at AS p, pending_discount_pct AS d, trial_expires_at AS t FROM users WHERE id = ?`).get(id);
const rr = (friendId) => sqlite.prepare(`SELECT * FROM referral_rewards WHERE referred_id = ?`).get(friendId);
const near = (iso, ms, tol = 10_000) => Number.isFinite(Date.parse(iso)) && Math.abs(Date.parse(iso) - ms) <= tol;
const later = (days) => Date.now() + days * DAY;
const avatar = (id) => sqlite.prepare(`UPDATE cards SET avatar_url = 'https://cdn.example/a.jpg' WHERE user_id = ?`).run(id);
const runCron = async () => {
  let p = null;
  await worker.scheduled({}, env, { waitUntil: (x) => { p = x; } });
  await p;
};
const backdate = (friendId, days) => {
  const ts = new Date(Date.now() - days * DAY).toISOString();
  sqlite.prepare(`UPDATE users SET created_at = ? WHERE id = ?`).run(ts.replace('T', ' ').replace('Z', '+00'), friendId);
  sqlite.prepare(`UPDATE referral_rewards SET created_at = ? WHERE referred_id = ?`).run(ts, friendId);
};

// ═══ 0. Email normallash ═══
{
  check('0) gmail: nuqta, +teg, katta harf, googlemail', normalizeEmail('J.o.h.n+promo@GoogleMail.com'), 'john@gmail.com');
  check('0) boshqa domen: faqat +teg', normalizeEmail('a.b+c@Mail.ru'), 'a.b@mail.ru');
  check('0) bo‘sh/buzuq — null', [normalizeEmail(''), normalizeEmail('nope'), normalizeEmail('+x@gmail.com')], [null, null, null]);
}

// ═══ 1. Ro'yxat: faqat 'pending', chegirma darhol, cookie o'chiriladi ═══
let f1;
{
  sqlite.prepare(`UPDATE users SET trial_expires_at = NULL, premium_expires_at = NULL WHERE id = 1`).run();
  f1 = await register({ promoCode: 'abc234', email: 'jo.hn@gmail.com', cookieHeader: 'nfc_ref=XYZ789' });
  check('1) ro‘yxat 201', f1.status, 201);
  check('1) 10% chegirma darhol (forma kodi ustun)', user(1).d, 10);
  check('1) Premium HALI YO‘Q', user(1).p, null);
  const row = rr(f1.id);
  check('1) daftar: pending, normallangan email, telefon tasdiqlangan',
    [row.referrer_id, row.status, row.days, row.granted_until, row.friend_email_norm, row.friend_phone_verified], [1, 'pending', 30, null, 'john@gmail.com', 1]);
  const n = (await call('/api/notifications', { cookie: cookie.user })).body.items.find((x) => x.type === 'referral_reward');
  checkTrue('1) bildirishnoma hali yo‘q', !n);
  checkTrue(`1) nfc_ref cookie o‘chirildi (${f1.setCookies.join(' | ')})`, f1.setCookies.some((c) => /^nfc_ref=; Path=\/; Max-Age=0; SameSite=Lax; HttpOnly; Secure/.test(c)));
  checkTrue('1) sessiya cookie ham bor', !!f1.session);
  const plain = await register({ promoCode: 'ABC234' });
  checkTrue('1) cookie yuborilmagan — o‘chirish sarlavhasi yo‘q', !plain.setCookies.some((c) => c.startsWith('nfc_ref=')));
  sqlite.prepare(`DELETE FROM referral_rewards WHERE referred_id = ?`).run(plain.id);
}

// ═══ 2. O'chirgich o'chiq — hech narsa berilmaydi ═══
{
  avatar(f1.id);
  backdate(f1.id, 8);
  const r = await processReferralRewards(env, H, { now: Date.now() });
  check('2) o‘chiq: disabled, yozuv pending, Premium yo‘q', [r.disabled, rr(f1.id).status, user(1).p], [true, 'pending', null]);
  await runCron();
  check('2) cron ham bermaydi', [rr(f1.id).status, user(1).p], ['pending', null]);
  const t = await register({ promoCode: 'ABC234', verified: true });
  check('2) o‘chiq bo‘lsa ham yozuvlar to‘planadi', rr(t.id)?.status, 'pending');
  sqlite.prepare(`DELETE FROM referral_rewards WHERE referred_id = ?`).run(t.id);
}
env.REFERRAL_REWARD_ENABLED = '1';

// ═══ 3. 7 kun va faollik ═══
{
  const young = await register({ promoCode: 'ABC234', email: 'young@mail.ru' });
  avatar(young.id);
  await processReferralRewards(env, H, { now: Date.now() + 6 * DAY });
  check('3) 6 kunlik — kutadi', rr(young.id).status, 'pending');
  const lazy = await register({ promoCode: 'ABC234', email: 'lazy@mail.ru' });
  await processReferralRewards(env, H, { now: later(8) });
  check('3) 8 kunlik, faolliksiz — kutadi', rr(lazy.id).status, 'pending');
  // Ilovada bitta kun — yetmaydi; ikki xil kun — yetadi.
  const d0 = new Date(Date.now()).toISOString();
  sqlite.prepare(`INSERT INTO app_users (user_id, platform, first_seen, last_seen, opens) VALUES (?, 'ios', ?, ?, 3)`).run(lazy.id, d0, d0);
  await processReferralRewards(env, H, { now: later(8) });
  check('3) ilovada bitta kun — kutadi', rr(lazy.id).status, 'pending');
  sqlite.prepare(`UPDATE app_users SET first_seen = ? WHERE user_id = ?`).run(new Date(Date.now() - 2 * DAY).toISOString(), lazy.id);
  const before = Date.now();
  const r = await processReferralRewards(env, H, { now: later(8) });
  checkTrue(`3) ilovada 2 xil kun — berildi (${JSON.stringify(r)})`, rr(lazy.id).status === 'granted');
  // f1 (avatar) va young (avatar) ham 8 kun o'tib berildi — jami 3 ta.
  check('3) f1 va young ham (avatar)', [rr(f1.id).status, rr(young.id).status], ['granted', 'granted']);
  // f1 (8 kunga eskirtirilgan) 6-kun ishlovida berildi: 6 + 30; keyin ikkitasi ustiga.
  checkTrue(`3) Premium = (6 kun keyin) + 3×30 kun (${user(1).p})`, near(user(1).p, before + 6 * DAY + 90 * DAY, 60_000));
  const again = await processReferralRewards(env, H, { now: later(9) });
  check('3) qayta ishlov — ikki marta berilmaydi', [again.granted, near(user(1).p, before + 96 * DAY, 60_000)], [0, true]);
  // Post va istorya.
  const poster = await register({ promoCode: 'XYZ789', email: 'poster@mail.ru' });
  sqlite.prepare(`INSERT INTO posts (code, user_id, caption) VALUES ('PP1', ?, 'salom')`).run(poster.id);
  const story = await register({ promoCode: 'XYZ789', email: 'story@mail.ru' });
  sqlite.prepare(`INSERT INTO stories (owner_kind, owner_id, user_id, created_at, expires_at) VALUES ('user', ?, ?, ?, ?)`)
    .run(String(story.id), story.id, new Date().toISOString(), new Date(Date.now() + DAY).toISOString());
  await processReferralRewards(env, H, { now: later(8) });
  check('3) post / istorya — berildi', [rr(poster.id).status, rr(story.id).status], ['granted', 'granted']);
  const n = (await call('/api/notifications', { cookie: cookie.user })).body.items.filter((x) => x.type === 'referral_reward');
  check('3) bildirishnomalar: 3 ta, nishon 30', [n.length, n[0]?.targetType, n[0]?.targetId], [3, 'referral', '30']);
}

// ═══ 4. Sinov paytida — mukofot sinovdan KEYIN ═══
{
  const trialEnd = Date.now() + 60 * DAY;
  sqlite.prepare(`UPDATE users SET premium_expires_at = NULL, trial_expires_at = ? WHERE id = 2`).run(new Date(trialEnd).toISOString());
  const f = await register({ promoCode: 'XYZ789', email: 'trial@mail.ru' });
  avatar(f.id);
  await processReferralRewards(env, H, { now: later(8) });
  checkTrue(`4) sinov tugashi + 30 kun (${user(2).p})`, near(user(2).p, trialEnd + 30 * DAY, 5000));
}

// ═══ 5. Rad etish va kutish holatlari ═══
{
  // Tasdiqlanmagan ro'yxat — yozuv umuman yo'q (chegirma bor).
  const d = user(1).d;
  const nv = await register({ promoCode: 'ABC234', verified: false });
  check('5) tasdiqlanmagan — 201, chegirma bor, yozuv yo‘q', [nv.status, user(1).d, rr(nv.id) ?? null], [201, d + 10, null]);
  // Email takrori: jo.hn@gmail.com allaqachon berilgan; john+2@gmail.com — o'sha quti.
  const dup = await register({ promoCode: 'ABC234', email: 'john+2@gmail.com' });
  avatar(dup.id);
  await processReferralRewards(env, H, { now: later(8) });
  check('5) gmail takrori — rejected duplicate_email', [rr(dup.id).status, rr(dup.id).reason], ['rejected', 'duplicate_email']);
  // Taklif qiluvchining o'z emaili (+teg bilan).
  const own = await register({ promoCode: 'ABC234', email: 'user+alt@test.local' });
  avatar(own.id);
  await processReferralRewards(env, H, { now: later(8) });
  check('5) o‘z emaili — rejected duplicate_email', [rr(own.id).status, rr(own.id).reason], ['rejected', 'duplicate_email']);
  // Ikki kutilayotgan do'st bir xil qutidan — ERTAROG'I yutadi.
  const a = await register({ promoCode: 'XYZ789', email: 'twin.box@gmail.com' });
  const b = await register({ promoCode: 'XYZ789', email: 'twinbox+b@gmail.com' });
  avatar(a.id); avatar(b.id);
  await processReferralRewards(env, H, { now: later(8) });
  check('5) bir quti, ikki do‘st — birinchisi berildi, ikkinchisi rad', [rr(a.id).status, rr(b.id).status, rr(b.id).reason], ['granted', 'rejected', 'duplicate_email']);
  // O'sha telefon (ustunda UNIQUE yo'q — eski bazadagi takror).
  sqlite.prepare(`INSERT INTO users (id, email, password_hash, phone, created_at) VALUES (50, 'same@t.local', 'x', '+998901111111', ?)`).run(new Date().toISOString());
  sqlite.prepare(`INSERT INTO cards (code, name, price, ts, user_id, avatar_url) VALUES ('SAM050', 'Same', 0, 1, 50, 'https://x/a.jpg')`).run();
  check('5) recordPendingReward: o‘zi — self', (await recordPendingReward(env, H, 1, 1, { verified: true })).reason, 'self');
  check('5) recordPendingReward: tasdiqsiz — not_verified', (await recordPendingReward(env, H, 1, 50, {})).reason, 'not_verified');
  check('5) recordPendingReward: yozildi', (await recordPendingReward(env, H, 1, 50, { verified: true, phoneVerified: true })).recorded, true);
  check('5) recordPendingReward: bir do‘st — bir yozuv', (await recordPendingReward(env, H, 1, 50, { verified: true })).reason, 'already');
  await processReferralRewards(env, H, { now: later(8) });
  check('5) o‘sha telefon — rejected same_phone', [rr(50).status, rr(50).reason], ['rejected', 'same_phone']);
  // O'chirilgan do'st.
  const gone = await register({ promoCode: 'XYZ789', email: 'gone@mail.ru' });
  avatar(gone.id);
  sqlite.prepare(`UPDATE users SET deleted_at = ? WHERE id = ?`).run(new Date().toISOString(), gone.id);
  await processReferralRewards(env, H, { now: later(8) });
  check('5) o‘chirilgan do‘st — rejected', [rr(gone.id).status, rr(gone.id).reason], ['rejected', 'referred_deleted']);
  // Ban — kutadi (ochilsa beriladi).
  const banned = await register({ promoCode: 'XYZ789', email: 'banned@mail.ru' });
  avatar(banned.id);
  sqlite.prepare(`UPDATE users SET banned_until = ? WHERE id = ?`).run(new Date(later(30)).toISOString(), banned.id);
  await processReferralRewards(env, H, { now: later(8) });
  check('5) ban — kutadi', rr(banned.id).status, 'pending');
  sqlite.prepare(`UPDATE users SET banned_until = NULL WHERE id = ?`).run(banned.id);
  await processReferralRewards(env, H, { now: later(8) });
  check('5) ban ochildi — berildi', rr(banned.id).status, 'granted');
  // Muddatsiz Premium.
  sqlite.prepare(`INSERT INTO users (id, email, password_hash, phone, promo_code, is_premium) VALUES (61, 'life@t.local', 'x', '+998906100000', 'LIFE61', 1)`).run();
  const lf = await register({ promoCode: 'LIFE61', email: 'lf@mail.ru' });
  avatar(lf.id);
  await processReferralRewards(env, H, { now: later(8) });
  check('5) muddatsiz Premium — rejected lifetime, muddat yo‘q', [rr(lf.id).status, rr(lf.id).reason, user(61).p], ['rejected', 'lifetime', null]);
  // O'chirilgan taklif qiluvchi — kod ishlamaydi (yozuv yo'q).
  sqlite.prepare(`INSERT INTO users (id, email, password_hash, phone, promo_code, deleted_at) VALUES (60, 'del@t.local', 'x', '+998906000000', 'DELREF', ?)`).run(new Date().toISOString());
  const rd = await register({ promoCode: 'DELREF' });
  check('5) o‘chirilgan taklif qiluvchi — yozuv yo‘q', [rd.status, rr(rd.id) ?? null], [201, null]);
  // Yozuv ochilgandan KEYIN o'chirilgan taklif qiluvchi — rad.
  sqlite.prepare(`INSERT INTO users (id, email, password_hash, phone, promo_code) VALUES (620, 'del2@t.local', 'x', '+998906200000', 'DEL62R')`).run();
  const rd2 = await register({ promoCode: 'DEL62R', email: 'del2f@mail.ru' });
  avatar(rd2.id);
  sqlite.prepare(`UPDATE users SET deleted_at = ? WHERE id = 620`).run(new Date().toISOString());
  await processReferralRewards(env, H, { now: later(8) });
  check('5) keyin o‘chirilgan taklif qiluvchi — rejected', [rr(rd2.id).status, rr(rd2.id).reason, user(620).p], ['rejected', 'referrer_deleted', null]);
}

// ═══ 6. 60 kunda eskirish (cron) ═══
{
  const old = await register({ promoCode: 'XYZ789', email: 'old61@mail.ru' });
  backdate(old.id, 61);
  const fresh = await register({ promoCode: 'XYZ789', email: 'fresh@mail.ru' });
  await runCron();
  check('6) 61 kunlik faolliksiz — expired; yangisi — pending', [rr(old.id).status, rr(old.id).reason, rr(fresh.id).status], ['expired', 'no_activity', 'pending']);
  avatar(old.id);
  await runCron();
  check('6) expired qaytmaydi', rr(old.id).status, 'expired');
  // Cron haqiqiy vaqt bilan: 8 kunlik + avatar — beriladi.
  backdate(fresh.id, 8); avatar(fresh.id);
  await runCron();
  check('6) cron 8 kunlik faolni beradi', rr(fresh.id).status, 'granted');
}

// ═══ 7. /api/auth/me — do'st ochganda (soatiga bir marta) ═══
{
  const f = await register({ promoCode: 'XYZ789', email: 'opener@mail.ru' });
  backdate(f.id, 8);
  __resetReferralThrottleForTests();
  const p0 = user(2).p;
  await call('/api/auth/me', { cookie: f.session });
  check('7) faolliksiz — /me bermaydi', [rr(f.id).status, user(2).p], ['pending', p0]);
  avatar(f.id);
  await call('/api/auth/me', { cookie: f.session });
  check('7) bir soat ichida qayta /me — tekshirilmaydi', rr(f.id).status, 'pending');
  __resetReferralThrottleForTests();
  await call('/api/auth/me', { cookie: f.session });
  check('7) keyingi /me — berildi', rr(f.id).status, 'granted');
  checkTrue('7) taklif qiluvchiga +30 kun', Date.parse(user(2).p) - Date.parse(p0) >= 30 * DAY - 1000);
}

// ═══ 8. Atomar yillik chegara ═══
{
  sqlite.prepare(`INSERT INTO users (id, email, password_hash, phone, promo_code) VALUES (70, 'cap@t.local', 'x', '+998907000000', 'CAPREF')`).run();
  const nowIso = new Date().toISOString();
  for (let i = 0; i < REFERRAL_REWARD_MAX_PER_YEAR - 1; i++) {
    sqlite.prepare(`INSERT INTO referral_rewards (referrer_id, referred_id, days, created_at, granted_until, status, claimed_at, granted_at)
      VALUES (70, ?, 30, ?, ?, 'granted', ?, ?)`).run(90000 + i, nowIso, nowIso, nowIso, nowIso);
  }
  const fs = [];
  for (let i = 0; i < 3; i++) { const f = await register({ promoCode: 'CAPREF', email: `cap${i}@mail.ru` }); avatar(f.id); fs.push(f.id); }
  // Ikki parallel ishlov — chegara baribir oshmaydi.
  await Promise.all([processReferralRewards(env, H, { now: later(8) }), processReferralRewards(env, H, { now: later(8) })]);
  const cnt = sqlite.prepare(`SELECT COUNT(*) AS n FROM referral_rewards WHERE referrer_id = 70 AND status IN ('granting','granted')`).get().n;
  check('8) parallel: jami 24 (23 + 1)', cnt, REFERRAL_REWARD_MAX_PER_YEAR);
  check('8) qolganlari pending (cap)', fs.map((id) => rr(id).status).sort(), ['granted', 'pending', 'pending']);
  check('8) sabab — cap', fs.map((id) => rr(id).reason).filter(Boolean), ['cap', 'cap']);
  checkTrue('8) bitta +30 kun', near(user(70).p, later(8) + 30 * DAY, 60_000));
  // 365 kundan eskilari sanalmaydi.
  sqlite.prepare(`UPDATE referral_rewards SET claimed_at = ? WHERE referrer_id = 70 AND referred_id >= 90000`).run(new Date(Date.now() - 400 * DAY).toISOString());
  await processReferralRewards(env, H, { now: later(8) });
  check('8) eskilari — chegara ochildi', fs.map((id) => rr(id).status), ['granted', 'granted', 'granted']);
}

// ═══ 9. Yozilmay qolgan muddat — 'granting', cron keyin yakunlaydi ═══
{
  sqlite.prepare(`INSERT INTO users (id, email, password_hash, phone, promo_code) VALUES (80, 'retry@t.local', 'x', '+998908000000', 'RETRY8')`).run();
  const f = await register({ promoCode: 'RETRY8', email: 'retry-friend@mail.ru' });
  avatar(f.id);
  const orig = env.DB.batch.bind(env.DB);
  env.DB.batch = async () => { throw new Error('sinov: baza band'); };
  await processReferralRewards(env, H, { now: later(8) });
  env.DB.batch = orig;
  check('9) muddat yozilmadi — granting, Premium yo‘q, da‘vo o‘chirilmadi', [rr(f.id).status, user(80).p], ['granting', null]);
  // Boshqa jarayon muddatni o'zgartirdi (CAS) — qayta o'qib to'g'ri ustiga qo'shadi.
  const ext = new Date(later(40)).toISOString();
  sqlite.prepare(`UPDATE users SET premium_expires_at = ? WHERE id = 80`).run(ext);
  await processReferralRewards(env, H, { now: later(8) });
  checkTrue(`9) cron yakunladi: granted, mavjud muddat ustiga (${user(80).p})`, rr(f.id).status === 'granted' && near(user(80).p, Date.parse(ext) + 30 * DAY, 1000));
  await processReferralRewards(env, H, { now: later(8) });
  checkTrue('9) qayta — ikki marta emas', near(user(80).p, Date.parse(ext) + 30 * DAY, 1000));
}

// ═══ 10. /i/:code, cookie va AASA ═══
{
  const r = await call('/i/abc234');
  check('10) to‘g‘ri kod — 302 /register?ref=', [r.status, r.headers.get('location')], [302, '/register?ref=ABC234']);
  const sc = r.headers.get('set-cookie') || '';
  checkTrue(`10) cookie nfc_ref, 30 kun, Lax (${sc})`, /^nfc_ref=ABC234; Path=\/; Max-Age=2592000; SameSite=Lax/.test(sc) && /Secure/.test(sc));
  const bad = await call('/i/NOPE99');
  check('10) noma’lum kod — 302 /, cookie yo‘q', [bad.status, bad.headers.get('location'), bad.headers.get('set-cookie')], [302, '/', null]);
  check('10) buzuq kod — /', (await call('/i/%3Cx%3E')).headers.get('location'), '/');
  // Cookie'dagi kod — forma bo'sh bo'lsa ishlaydi.
  sqlite.prepare(`UPDATE users SET pending_discount_pct = 0 WHERE id = 2`).run();
  const d0 = user(2).d;
  const rc = await register({ cookieHeader: 'nfc_ref=XYZ789' });
  check('10) cookie bilan ro‘yxat — taklif yozildi', [rc.status, user(2).d, !!sqlite.prepare(`SELECT 1 FROM referral_uses WHERE referrer_id = 2 AND referred_id = ?`).get(rc.id)], [201, d0 + 10, true]);
  checkTrue('10) cookie bilan ro‘yxat — nfc_ref o‘chirildi', rc.setCookies.some((c) => /^nfc_ref=; .*Max-Age=0/.test(c)));
  // Odam oldindan to'ldirilgan kodni o'chirdi — cookie qo'llanmaydi (F8).
  const cleared = await register({ promoCode: '', promoCleared: true, cookieHeader: 'nfc_ref=XYZ789' });
  check('10) promoCleared — taklif yo‘q, chegirma o‘zgarmadi', [cleared.status, user(2).d, !!sqlite.prepare(`SELECT 1 FROM referral_uses WHERE referred_id = ?`).get(cleared.id)], [201, d0 + 10, false]);
  checkTrue('10) promoCleared — cookie baribir o‘chiriladi', cleared.setCookies.some((c) => /^nfc_ref=; .*Max-Age=0/.test(c)));
  // Forma: oldindan to'ldirilgan kod o'chirilsa `promoCleared: true` yuboriladi.
  const authSrc = readFileSync(new URL('../src/pages/AuthPage.jsx', import.meta.url), 'utf8');
  checkTrue('10) AuthPage: promoPrefilled && bo‘sh kod → promoCleared', /promoPrefilled && !promoCode\.trim\(\) \? \{ promoCleared: true \}/.test(authSrc));
  const notifSrc = readFileSync(new URL('../src/pages/NotificationsPage.jsx', import.meta.url), 'utf8');
  checkTrue('10) Sayt: referral_reward sarlavhasi bo‘sh bo‘lsa "Do\'stingiz"', notifSrc.includes(`n.type === 'referral_reward' ? t("Do'stingiz")`));
  // AASA: /i/* YO'Q (F3) — chiqarilgan ilova bu yo'lni bilmaydi.
  const aasa = await (await worker.fetch(req('/.well-known/apple-app-site-association'), env)).json();
  const comps = aasa.applinks.details[0].components.map((c) => c['/']);
  check('10) AASA: /i/* yo‘q, qolganlari joyida', comps, ['/post/*', '/u/*', '/c/*', '/story/*', '/nfc/*']);
}

// ═══ 11. Bildirishnoma: ilovada yashirin, saytda ochiq ism (F7) ═══
{
  const web = (await call('/api/notifications', { cookie: cookie.user })).body;
  const mine = web.items.filter((x) => x.type === 'referral_reward');
  checkTrue(`11) saytda bor (${mine.length})`, mine.length >= 3);
  // f1 kartasi nomi — emailning '@' oldidagi qismi ('jo.hn') → sarlavha bo'sh.
  const f1Card = sqlite.prepare(`SELECT code, name FROM cards WHERE user_id = ?`).get(f1.id);
  const f1n = mine.find((x) => x.actorCode === f1Card.code);
  check(`11) standart (email) nom — sarlavha bo‘sh (karta: ${f1Card.name})`, f1n && f1n.title, '');
  sqlite.prepare(`UPDATE cards SET name = 'Jasur' WHERE user_id = ?`).run(f1.id);
  const again = (await call('/api/notifications', { cookie: cookie.user })).body.items.find((x) => x.actorCode === f1Card.code);
  check('11) ism qo‘yilgan — ochiq ism', again && again.title, 'Jasur');
  checkTrue('11) email/telefon yo‘q', !JSON.stringify(mine).includes('@') && !JSON.stringify(mine).includes('+998'));
  const unreadWeb = web.unreadCount;
  const app = (await call('/api/notifications', { cookie: cookie.user, headers: { 'x-app': 'nova' } })).body;
  check('11) ilovada referral_reward yo‘q', app.items.filter((x) => x.type === 'referral_reward').length, 0);
  check('11) ilovada o‘qilmaganlar soni ham kamroq', unreadWeb - app.unreadCount >= mine.filter((x) => !x.read).length, true);
  const mob = (await call('/api/notifications', { cookie: cookie.user, headers: { 'x-client': 'ios' } })).body;
  check('11) X-Client: ios — ham yashirin', mob.items.filter((x) => x.type === 'referral_reward').length, 0);
}

// ═══ 12. Xulosa va admin reytingi — faqat berilganlar ═══
{
  check('12) mehmon — 401', (await call('/api/referrals/summary')).status, 401);
  const s = (await call('/api/referrals/summary', { cookie: cookie.other })).body;
  const invited = sqlite.prepare(`SELECT COUNT(*) AS n FROM referral_uses WHERE referrer_id = 2`).get().n;
  const days = sqlite.prepare(`SELECT SUM(days) AS d FROM referral_rewards WHERE referrer_id = 2 AND status = 'granted'`).get().d;
  const pend = sqlite.prepare(`SELECT COUNT(*) AS n FROM referral_rewards WHERE referrer_id = 2 AND status IN ('pending','granting')`).get().n;
  checkTrue(`12) kutilayotganlar bor (${pend})`, pend >= 1);
  check('12) shakli', s, { code: 'XYZ789', link: 'https://nfcstore.uz/i/XYZ789', invited, rewardedDays: days, pendingRewards: pend, nextRewardDays: 30 });
  check('12) eski /api/referrals o‘zgarmagan', Object.keys((await call('/api/referrals', { cookie: cookie.user })).body), ['referrals']);
  check('12) oddiy foydalanuvchi — reyting 401', (await call('/api/admin/referrals/leaderboard', { cookie: cookie.user })).status, 401);
  sqlite.prepare(`INSERT INTO users (id, email, password_hash, phone) VALUES (9999, 'old@t.local', 'x', '+998909999990')`).run();
  sqlite.prepare(`INSERT INTO referral_uses (referrer_id, referred_id, created_at) VALUES (2, 9999, ?)`).run(new Date(Date.now() - 40 * DAY).toISOString().replace('T', ' ').slice(0, 19));
  const lb = (await call('/api/admin/referrals/leaderboard', { cookie: cookie.admin })).body;
  const all1 = lb.allTime.find((x) => x.userId === 1);
  check('12) hammasi: user#1 — faqat berilgan kunlar', all1 && [all1.code, all1.name, all1.count, all1.rewardedDays], ['ABC234', 'Muhammad',
    sqlite.prepare(`SELECT COUNT(*) AS n FROM referral_uses WHERE referrer_id = 1`).get().n,
    sqlite.prepare(`SELECT SUM(days) AS d FROM referral_rewards WHERE referrer_id = 1 AND status = 'granted'`).get().d]);
  checkTrue('12) tartib: count kamayishi, rank 1..', lb.allTime.every((x, i) => x.rank === i + 1 && (i === 0 || lb.allTime[i - 1].count >= x.count)));
  const a2 = lb.allTime.find((x) => x.userId === 2), l2 = lb.last30.find((x) => x.userId === 2);
  check('12) 30 kun: eski taklif kirmaydi', l2.count, a2.count - 1);
  checkTrue('12) email/telefon yo‘q', !JSON.stringify(lb).includes('@') && !JSON.stringify(lb).includes('+998'));
}

done('Promokod mukofoti');
