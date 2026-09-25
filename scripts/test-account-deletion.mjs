// HISOBNI BUTUNLAY O'CHIRISH (PURGE) — ACCOUNT_DELETION_PLAN.md, 6-bo'lim.
//
// Egasining qarori (2026-09-25): 30 kunlik o'ylash muddati; pullik NFC ID
// va Business ID uchun pul qaytarilmaydi, ular 90 kundan keyin qayta
// beriladi; to'lov yozuvlari ism, telefon va manzilsiz saqlanadi.
//
// Tekshiriladi:
//   T1  so'rov: `purgeAfter` (+30 kun), `deletion_source='self'`, login 403 + purgeAfter
//   T2  30 kun ichida hech narsa o'zgarmaydi; `off` rejimida ham
//   T3  dry-run: sonlar bor, baza va R2 bayt-baayt o'zgarmaydi
//   T4  purge: U ga tegishli shaxsiy ma'lumot 0; tombstone; jurnal; kalitlar "off" da saqlanganlar joyida
//   T5  moliyaviy qatorlar soni o'zgarmaydi, ulardagi ism/telefon/manzil yo'q
//   T6  dalil arxivi: eski yozuvlar bir xil, yangilari qo'shildi, evidence_identity/owner_history
//   T7  R2: arxivdagi va boshqa joyda ishlatilgan fayl qoladi; admin/tashqi tegilmaydi; bitta ishga tushishda ≤50
//   T8  idempotent va atomik (batch o'rtasida xato — hech narsa o'zgarmaydi)
//   T9  boshqa foydalanuvchilarga ta'sir yo'q
//   T10 o'chirish navbatidagi email bilan qayta ro'yxat — 409 (30 kun hech kim uchun qisqarmaydi);
//       purge'dan keyin email bo'shaydi, yangi id eskisidan katta
//   T12 blocker'lar (balans, yangi buyurtma, auksion, yetkazilmagan karta) — purge YO'Q
//   T16 sovg'a qilingan kartadagi postlar va unga ulangan qurilma saqlanadi
//   T17 bloklanganlar navbatni to'xtatmaydi
//   T18 admin o'chirgan / manbasi noma'lum — ko'rib chiqilmaguncha purge YO'Q; hold
//   T19 arxiv ko'rinishi: qayta berilgan kodda eski egasi; purge qilingan izoh tiklanmaydi
//   Q   90 kunlik karantin: quote, xarid, Business ID, bepul ID, sovg'a, auksion; 91-kuni bo'shaydi
//   A   admin "O'chirish navbati" API
//   L   loglarda email/telefon yo'q; `scheduled` handler
//   G   qamrov qo'riqchisi: foydalanuvchiga bog'liq ustuni bor HAR jadval siyosatda bor
//
// Haqiqiy `hosting/worker.js`, in-memory D1 (atomik batch), R2 mock.
// Production D1/R2 ga TEGMAYDI, tarmoqqa chiqmaydi.
//
//   node scripts/test-account-deletion.mjs
import worker from '../hosting/worker.js';
import { makeEnv, seedBasic, req, cookie, makeChecker, sha256Hex } from './lib/d1-harness.mjs';
import {
  runAccountPurge, purgeDeletedUser, drainPurgeMediaQueue, idQuarantined, ensurePurgeSchema,
  PURGE_GRACE_DAYS, ID_QUARANTINE_DAYS,
} from '../hosting/api/account-purge.js';
import { createFreeAutoId } from '../hosting/api/auth.js';
import { ensureSchema as ensureNotifications } from '../hosting/api/notifications.js';
import { ensureTable as ensureSaves } from '../hosting/api/saves.js';
import { ensureSchema as ensureModeration } from '../hosting/api/moderation.js';
import { ensureSchema as ensureFeatured } from '../hosting/api/featured.js';
import { ensureTable as ensureAppUsers } from '../hosting/api/app-usage.js';
import { ensureBotMessages } from '../hosting/api/telegram.js';
import { ensureSchema as ensureComments } from '../hosting/api/comments.js';
import { ensureArchiveTable } from '../hosting/api/content-archive.js';
import { scryptSync, randomBytes, createHash } from 'node:crypto';

const { check, checkTrue, done } = makeChecker();
const DAY = 86_400_000;
const { env, sqlite } = makeEnv({ ACCOUNT_PURGE_MODE: 'on' }, { atomicBatch: true });
await seedBasic(env);
for (const f of [ensureComments, ensureArchiveTable, ensureNotifications, ensureSaves, ensureModeration, ensureFeatured, ensureAppUsers, ensureBotMessages]) {
  await f(env);
}
await ensurePurgeSchema(env);

const H = { sha256Hex: async (t) => sha256Hex(t) };
const n = (sql, ...a) => Number(sqlite.prepare(sql).get(...a)?.n || 0);
const one = (sql, ...a) => sqlite.prepare(sql).get(...a) || null;
const run = (sql, ...a) => sqlite.prepare(sql).run(...a);
const call = async (path, init = {}) => {
  const res = await worker.fetch(req(path, init), env);
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
};
const hashPw = (pw) => {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(pw, salt, 64, { N: 16384, r: 8, p: 1 }).toString('hex')}`;
};
const hex = (c, len = 24) => c.repeat(len).slice(0, len);
const up = (name) => `/uploads/${name}`;
const putR2 = async (url) => env.UPLOADS.put(url.replace(/^\//, ''), new Uint8Array([1, 2, 3]));
const r2Has = (url) => env.UPLOADS._store.has(url.replace(/^\//, ''));
const ts = (ms) => new Date(ms).toISOString().replace('T', ' ').replace('Z', '+00');

function dbHash() {
  const h = createHash('sha256');
  for (const { name } of sqlite.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`).all()) {
    // Admin sessiyasining "oxirgi faollik" vaqti har admin so'rovida yangilanadi — bu purge emas.
    if (name === 'admin_sessions') continue;
    const rows = sqlite.prepare(`SELECT * FROM "${name}"`).all().map((r) => JSON.stringify(r)).sort();
    h.update(name + '\n' + rows.join('\n'));
  }
  return h.digest('hex');
}
const r2Hash = () => JSON.stringify([...env.UPLOADS._store.keys()].sort());

// ── Konsol ushlagichi (L): purge loglarida email/telefon bo'lmasin ──
const logged = [];
const realConsole = { log: console.log, warn: console.warn, error: console.error };
const capture = () => { for (const k of ['log', 'warn', 'error']) console[k] = (...a) => { logged.push(a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ')); }; };
const release = () => Object.assign(console, realConsole);

// =====================================================================
// SEED: U = #1 (user@test.local, +998901111111, VIP001 + BIZ777),
//        B = #2 (other@test.local, OTH222) — begona foydalanuvchi.
// =====================================================================
const U = 1, B = 2;
const EMAIL = 'user@test.local', PHONE = '+998901111111';
run(`UPDATE users SET password_hash = ?, balance = 0 WHERE id = ?`, hashPw('secret123'), U);

// Fayllar
const F = {
  avatar: up(`${hex('a', 20)}.jpg`),                 // faqat U — o'chadi
  bg: up(`bg_${hex('b')}.jpg`),                      // faqat U — o'chadi
  music1: up(`${hex('c', 20)}.mp3`),                 // JSON massiv — o'chadi
  music2: up(`${hex('d', 20)}.mp3`),
  musicOld: up(`${hex('e', 20)}.mp3`),               // eski bitta URL — o'chadi
  postImg: up(`post_${hex('f')}.jpg`),               // arxivlanadi — QOLADI
  shared: up(`gal_${hex('1')}.jpg`),                 // B ham ishlatadi — QOLADI
  news: up(`news_${hex('2')}.jpg`),                  // admin fayli — tegilmaydi
  logo: up(`logo_${hex('3')}.png`),                  // kompaniya logosi — o'chadi
  compGal: up(`${hex('4', 20)}.jpg`),                // gallery_json — o'chadi
  design: up(`cardprint_${hex('5')}.png`),           // bosma maket — o'chadi
  storyImg: up(`story_${hex('6')}.jpg`),             // arxivlanadi — QOLADI
};
for (const u of Object.values(F)) await putR2(u);

run(`UPDATE cards SET avatar_url = ?, bg_url = ?, music_url = ? WHERE code = 'VIP001'`, F.avatar, F.bg, JSON.stringify([F.music1, F.music2]));
run(`UPDATE cards SET music_url = ? WHERE code = 'BIZ777'`, F.musicOld);
run(`INSERT INTO card_gallery (code, image_url, sort) VALUES ('VIP001', ?, 0)`, F.shared);
run(`INSERT INTO card_gallery (code, image_url, sort) VALUES ('VIP001', ?, 1)`, F.news);
run(`INSERT INTO card_gallery (code, image_url, sort) VALUES ('VIP001', 'https://cdn.example.com/x.jpg', 2)`);
run(`INSERT INTO card_gallery (code, image_url, sort) VALUES ('OTH222', ?, 0)`, F.shared);      // B ham shu faylni ishlatadi
run(`INSERT INTO card_team (code, name, photo_url, member_code) VALUES ('OTH222', 'Hamkor', NULL, 'VIP001')`); // B kartasida U a'zo
run(`INSERT INTO menu_categories (id, code, name) VALUES (1, 'BIZ777', 'Taomlar')`);
run(`INSERT INTO menu_items (code, category_id, name, price) VALUES ('BIZ777', 1, 'Osh', 30000)`);
run(`INSERT INTO posts (id, code, user_id, image_url, caption) VALUES (501, 'VIP001', ?, ?, 'U posti')`, U, F.postImg);
run(`INSERT INTO posts (id, code, user_id, caption) VALUES (502, 'OTH222', ?, 'B posti')`, B);
run(`INSERT INTO stories (id, owner_kind, owner_id, user_id, image_url, caption, created_at, expires_at) VALUES (601, 'card', 'VIP001', ?, ?, 'istoriya', '2026-09-01 10:00:00+00', '2999-01-01')`, U, F.storyImg);
run(`INSERT INTO story_likes (story_id, user_id, created_at) VALUES (601, ?, 'x')`, B);
run(`INSERT INTO story_views (story_id, viewer, created_at) VALUES (601, 'u2', 'x')`);
// Izohlar: U B ning postiga; B U ning postiga; U ning allaqachon o'chirilgan izohi.
const nowT = ts(Date.now());
run(`INSERT INTO content_comments (id, target_kind, target_id, user_id, author_code, body, created_at) VALUES (701, 'post', 502, ?, 'VIP001', 'U izohi', ?)`, U, nowT);
run(`INSERT INTO content_comments (id, target_kind, target_id, user_id, author_code, body, created_at) VALUES (702, 'post', 501, ?, 'OTH222', 'B izohi', ?)`, B, nowT);
run(`INSERT INTO content_comments (id, target_kind, target_id, user_id, author_code, body, created_at, deleted_at, deleted_reason) VALUES (703, 'post', 502, ?, 'VIP001', 'eski', ?, ?, 'owner')`, U, nowT, nowT);
run(`INSERT INTO content_comments (id, target_kind, target_id, user_id, author_code, body, created_at) VALUES (704, 'story', 601, ?, 'OTH222', 'istoriyaga izoh', ?)`, B, nowT);
// Oldindan bor dalil arxivi — BAYT-BAYT o'zgarmasligi kerak (T6).
run(`INSERT INTO content_archive (kind, content_id, owner_kind, owner_id, user_id, body, created_at, deleted_at, reason) VALUES ('post', 99, 'card', 'VIP001', '1', 'eski dalil', '2026-09-02 00:00:00+00', '2026-09-03 00:00:00+00', 'owner')`);
const archiveBefore = JSON.stringify(sqlite.prepare(`SELECT * FROM content_archive ORDER BY id`).all());
// Layklar, obunalar, bildirishnomalar, saqlanganlar
run(`INSERT INTO post_likes (post_id, user_id) VALUES (502, ?)`, U);
run(`INSERT INTO content_likes (target_kind, target_id, user_id, created_at) VALUES ('post', 502, ?, 'x')`, U);
run(`INSERT INTO card_likes (code, user_id) VALUES ('OTH222', ?)`, U);
run(`INSERT INTO follows (follower_id, followee_id) VALUES (?, ?)`, U, B);
run(`INSERT INTO follows (follower_id, followee_id) VALUES (?, ?)`, B, U);
run(`INSERT INTO notifications (recipient_user_id, actor_user_id, kind, created_at) VALUES (?, ?, 'like', 'x')`, U, B);
run(`INSERT INTO notifications (recipient_user_id, actor_user_id, kind, created_at) VALUES (?, ?, 'follow', 'x')`, B, U);
run(`INSERT INTO user_saves (user_id, kind, ref, created_at) VALUES (?, 'post', '502', 'x')`, U);
run(`INSERT INTO user_blocks (user_id, target_kind, target_id, created_at) VALUES (?, 'record', 'OTH222', 'x')`, U);
run(`INSERT INTO user_blocks (user_id, target_kind, target_id, created_at) VALUES (?, 'record', 'VIP001', 'x')`, B);
run(`INSERT INTO conversations (id, user_a_id, user_b_id) VALUES (801, ?, ?)`, U, B);
run(`INSERT INTO messages (conversation_id, sender_id, body) VALUES (801, ?, 'U xabari')`, U);
run(`INSERT INTO messages (conversation_id, sender_id, body) VALUES (801, ?, 'B xabari')`, B);
run(`INSERT INTO content_reports (target_kind, target_id, owner_code, reporter_id, reporter_ip, reason, status, created_at) VALUES ('post', '502', 'OTH222', ?, '198.51.100.7', 'spam', 'open', 'x')`, U);
run(`INSERT INTO user_reports (reporter_id, reported_id, reason) VALUES (?, ?, 'firibgar')`, B, U);   // U ga qarshi shikoyat → snapshot
run(`INSERT INTO app_users (user_id, platform, first_seen, last_seen, opens) VALUES (?, 'android', 'x', 'x', 3)`, U);
run(`INSERT INTO upload_quota (key, bytes, day) VALUES ('user:1', 100, 'x')`);
run(`INSERT INTO rate_limits (key, hits, window_start) VALUES (?, 1, 0)`, 'login:acct:' + EMAIL);
run(`INSERT INTO rate_limits (key, hits, window_start) VALUES (?, 1, 0)`, 'login:acct:' + sha256Hex(EMAIL));
run(`INSERT INTO email_otp_codes (email, code, purpose, expires_at) VALUES (?, 'h', 'register', 'x')`, EMAIL);
run(`INSERT INTO phone_otp_codes (phone, code, purpose, expires_at) VALUES (?, 'h', 'register', 'x')`, PHONE);
run(`INSERT INTO bot_verifications (phone, tg_user_id, tg_name) VALUES (?, 5551, 'Ali')`, PHONE);
run(`INSERT INTO bot_messages (tg_user_id, tg_name, username, text, created_at) VALUES ('5551', 'Ali', 'ali', 'salom', 'x')`);
run(`INSERT INTO password_reset_codes (user_id, code, expires_at) VALUES (?, 'h', 'x')`, U);
run(`INSERT INTO email_reset_tokens (token, user_id, expires_at, created_at) VALUES ('t1', ?, 'x', 'x')`, U);
run(`INSERT INTO support_messages (user_id, message) VALUES (?, 'yordam kerak')`, U);       // flag off — QOLADI
// Kompaniya (Business ID)
run(`INSERT INTO companies (company_id, owner_user_id, owner_email, display_name, phone, logo_url, gallery_json, tier, price, status, created_at, updated_at)
     VALUES ('ELITEBIZ', '1', ?, 'Elite', ?, ?, ?, 'free', 0, 'active', 'x', 'x')`, EMAIL, PHONE, F.logo, JSON.stringify([F.compGal]));
run(`INSERT INTO company_posts (id, company_id, image_url, caption, created_at) VALUES (901, 'ELITEBIZ', NULL, 'biznes posti', 'x')`);
run(`INSERT INTO company_stats (company_id, day, kind, ref, hits) VALUES ('ELITEBIZ', 'x', 'view', '', 5)`);
run(`INSERT INTO company_follows (company_id, user_id, created_at) VALUES ('ELITEBIZ', ?, 'x')`, B);
run(`INSERT INTO company_orders (company_id, item_name, qty, price, customer_name, customer_phone, status, created_at) VALUES ('ELITEBIZ', 'Osh', 1, 30000, 'Mijoz', '+998905550000', 'new', 'x')`);
run(`INSERT INTO company_catalog_items (id, company_id, name, price, created_at, updated_at) VALUES ('ci1', 'ELITEBIZ', 'Tovar', 1000, 'x', 'x')`);
run(`INSERT INTO company_payments (company_id, owner_user_id, amount, status, created_at, updated_at) VALUES ('ELITEBIZ', '1', 99000, 'paid', 'x', 'x')`);
// Moliyaviy yozuvlar (B sinfi) — QOLADI, PII tozalanadi
run(`INSERT INTO transactions (user_id, amount, kind, note) VALUES (?, 50000, 'topup', 'x')`, U);
run(`INSERT INTO wallet_topups (user_id, amount, status) VALUES (?, 50000, 'paid')`, U);
run(`INSERT INTO premium_requests (user_id, amount, status) VALUES (?, 20000, 'approved')`, U);
run(`INSERT INTO web_orders (id, user_id, code, price, payload, status, kind, created_at) VALUES (1001, ?, 'VIP001', 99000, ?, 'paid', 'physical_card_order', '2026-08-01 00:00:00+00')`, U,
  JSON.stringify({ quantity: 2, finish: 'gold', printSpec: { side: 2 }, shippingCarrier: 'bts', shippingName: 'Ali Valiyev', shippingPhone: PHONE, shippingAddress: 'Toshkent', designFrontUrl: F.design, name: 'Ali' }));
run(`INSERT INTO web_orders (id, user_id, code, price, payload, status, kind, created_at) VALUES (1002, ?, 'VIP001', 50000, ?, 'paid', 'featured_slot', '2026-08-01 00:00:00+00')`, U,
  JSON.stringify({ slotId: 'home', targetKind: 'card', targetId: 'VIP001', days: 7, name: 'Ali' }));
run(`INSERT INTO web_orders (id, user_id, code, price, payload, status, kind, created_at) VALUES (1003, ?, 'ABC123', 199000, ?, 'paid', 'card_purchase', '2026-08-01 00:00:00+00')`, U,
  JSON.stringify({ name: 'Ali', phone: PHONE, about: 'men', quantity: 1 }));
run(`INSERT INTO web_orders (id, user_id, code, price, payload, status, kind, created_at) VALUES (1004, ?, 'ABC124', 199000, 'buzuq json', 'cancelled', 'card_purchase', '2026-08-01 00:00:00+00')`, U);
run(`INSERT INTO bot_orders (tg_user_id, tg_username, tg_name, code, price, status, user_id, record_data) VALUES (5551, 'ali', 'Ali', 'XYZ999', 1000, 'paid', ?, '{"name":"Ali"}')`, U);
run(`INSERT INTO physical_cards (chip_token, linked_code, owner_user_id, active, shipping_name, shipping_phone, shipping_address, status) VALUES ('chip-own', 'VIP001', ?, 1, 'Ali', ?, 'Toshkent', 'delivered')`, U, PHONE);
run(`INSERT INTO auctions (id, code, seller_id, start_price, current_price, ends_at, status, seller_payout_status, seller_payme_number) VALUES (950, 'OLD001', ?, 1000, 5000, 'x', 'ended', 'paid', '8600123412341234')`, U);
run(`INSERT INTO bids (auction_id, user_id, amount) VALUES (950, ?, 5000)`, B);
run(`INSERT INTO featured_slots (user_id, target_kind, target_id, code, days, price, status, starts_at, ends_at, created_at) VALUES (?, 'card', 'VIP001', 'VIP001', 7, 50000, 'active', 'x', '2999-01-01', 'x')`, U);
run(`INSERT INTO nfc_gifts (code, recipient_name, activation_code, status, activated_by_user_id) VALUES ('GIFT01', 'Ali Valiyev', 'ACT1', 'activated', ?)`, U);
run(`INSERT INTO referral_uses (referrer_id, referred_id) VALUES (?, ?)`, B, U);
// T16: U o'z kodini B ga sovg'a qilgan — karta endi B niki, ichidagi U postlari B ning kontenti.
run(`INSERT INTO cards (code, name, price, ts, user_id) VALUES ('GFT555', 'Sovga', 0, 1, ?)`, B);
run(`INSERT INTO posts (id, code, user_id, caption) VALUES (503, 'GFT555', ?, 'sovga oldidan yozilgan')`, U);
run(`INSERT INTO physical_cards (chip_token, linked_code, owner_user_id, active, status) VALUES ('chip-gift', 'GFT555', ?, 1, 'delivered')`, U);

const FIN = {
  transactions: `user_id = ${U}`, wallet_topups: `user_id = ${U}`, premium_requests: `user_id = ${U}`,
  web_orders: `user_id = ${U}`, bot_orders: `user_id = ${U}`, physical_cards: `owner_user_id = ${U}`,
  company_payments: `owner_user_id = '1'`, bids: `auction_id = 950`, referral_uses: `referred_id = ${U}`,
  auctions: `seller_id = ${U}`, featured_slots: `user_id = ${U}`, nfc_gifts: `activated_by_user_id = ${U}`,
};
const finCounts = () => Object.fromEntries(Object.entries(FIN).map(([t, w]) => [t, n(`SELECT COUNT(*) AS n FROM ${t} WHERE ${w}`)]));
const finBefore = finCounts();

// =====================================================================
// T1 — SO'ROV
// =====================================================================
{
  const del = await call('/api/account', { method: 'DELETE', cookie: cookie.user });
  check('T1 DELETE /api/account -> 200 ok', [del.status, del.body?.ok], [200, true]);
  const after = Date.parse(del.body?.purgeAfter);
  checkTrue('T1 purgeAfter = so‘rov + 30 kun', Math.abs(after - Date.now() - PURGE_GRACE_DAYS * DAY) < 120_000);
  const u = one(`SELECT deleted_at, deletion_source, purged_at FROM users WHERE id = ?`, U);
  check('T1 deleted_at qo‘yildi, manba self, purge hali yo‘q', [!!u.deleted_at, u.deletion_source, u.purged_at], [true, 'self', null]);
  check('T1 sessiyalar yopildi', n(`SELECT COUNT(*) AS n FROM sessions WHERE user_id = ?`, U), 0);
  const login = await call('/api/auth/login', { method: 'POST', json: { email: EMAIL, password: 'secret123' } });
  check('T1 login -> 403 account_deleted', [login.status, login.body?.error], [403, 'account_deleted']);
  checkTrue('T1 login javobida purgeAfter', Math.abs(Date.parse(login.body?.purgeAfter) - after) < 2000);
  const wrong = await call('/api/auth/login', { method: 'POST', json: { email: EMAIL, password: 'wrong-pass' } });
  check('T1 noto‘g‘ri parolda hisob holati oshkor qilinmaydi', [wrong.status, wrong.body?.purgeAfter], [401, undefined]);
  // Takroriy so'rov muddatni uzaytirmaydi (COALESCE) — admin qayta o'chirsa ham manba o'zgarmaydi.
  const first = one(`SELECT deleted_at FROM users WHERE id = ?`, U).deleted_at;
  const adm = await call(`/api/admin/users/${U}/delete`, { method: 'POST', cookie: cookie.admin });
  check('T1 admin qayta o‘chirsa: deleted_at va manba o‘zgarmaydi', [adm.status, one(`SELECT deleted_at, deletion_source FROM users WHERE id = ?`, U)], [200, { deleted_at: first, deletion_source: 'self' }]);
}
const deletedAtMs = Date.parse(one(`SELECT deleted_at FROM users WHERE id = ?`, U).deleted_at.replace(' ', 'T').replace('+00', 'Z'));

// =====================================================================
// T10 — o'chirish navbatidagi email bilan qayta ro'yxat: 409 (30 kun hech kim uchun qisqarmaydi)
// =====================================================================
{
  const r = await call('/api/auth/register', { method: 'POST', json: { email: EMAIL, phone: '+998907771234', password: 'newpass123', tosAccepted: true } });
  check('T10 purge oldidan qayta ro‘yxat -> 409 account_pending_deletion', [r.status, r.body], [409, { error: 'account_pending_deletion' }]);
  check('T10 eski hisob tegilmadi', [one(`SELECT email FROM users WHERE id = ?`, U).email, n(`SELECT COUNT(*) AS n FROM cards WHERE user_id = ?`, U)], [EMAIL, 2]);
}

// =====================================================================
// T2 — 30 KUN ICHIDA HECH NARSA O'ZGARMAYDI
// =====================================================================
{
  const h0 = dbHash(), r0 = r2Hash();
  const res = await runAccountPurge(env, H, { mode: 'on', now: deletedAtMs + 29 * DAY });
  check('T2 +29 kun: nomzod yo‘q, hech narsa purge qilinmadi', [res.candidates, res.purged], [0, 0]);
  const off = await runAccountPurge(env, H, { mode: 'off', now: deletedAtMs + 60 * DAY });
  check('T2 off rejimi: hech narsa qilinmaydi', [off.candidates, off.purged], [0, 0]);
  check('T2 baza o‘zgarmadi', dbHash(), h0);
  check('T2 R2 o‘zgarmadi', r2Hash(), r0);
}

// =====================================================================
// T3 — DRY-RUN
// =====================================================================
let dryTotals;
{
  const h0 = dbHash(), r0 = r2Hash();
  const res = await runAccountPurge(env, H, { mode: 'dry-run', now: deletedAtMs + 31 * DAY });
  dryTotals = res.totals;
  check('T3 dry-run: 1 ta hisob purge qilinardi, 0 ta purge qilindi', [res.wouldPurge, res.purged], [1, 0]);
  check('T3 dry-run sonlari', [dryTotals.cards, dryTotals.companies, dryTotals.posts, dryTotals.follows], [2, 1, 1, 2]);
  checkTrue('T3 dry-run: fayllar ham sanaldi', dryTotals.media >= 8);
  check('T3 dry-run: baza bayt-bayt o‘zgarmadi', dbHash(), h0);
  check('T3 dry-run: R2 o‘zgarmadi', r2Hash(), r0);
  const adm = await call(`/api/admin/account-deletions/${U}/purge`, { method: 'POST', cookie: cookie.admin, json: { dryRun: true } });
  check('T3 admin dry-run -> sonlar, hech narsa o‘chmaydi', [adm.status, adm.body?.status, adm.body?.counts?.cards, dbHash() === h0], [200, 'dry-run', 2, true]);
}

// =====================================================================
// T4/T5/T6 — HAQIQIY PURGE
// =====================================================================
const purgeNow = deletedAtMs + 31 * DAY;
{
  capture();
  const res = await runAccountPurge(env, H, { mode: 'on', now: purgeNow });
  release();
  check('T4 purge: 1 ta hisob', [res.purged, res.errors], [1, 0]);
  check('T4 dry-run sonlari haqiqiy purge bilan bir xil', res.totals, dryTotals);
  checkTrue('L purge loglarida email/telefon yo‘q', !logged.some((l) => l.includes(EMAIL) || l.includes(PHONE) || l.includes('Ali')));

  const zero = {
    cards: n(`SELECT COUNT(*) AS n FROM cards WHERE user_id = ?`, U),
    companies: n(`SELECT COUNT(*) AS n FROM companies WHERE owner_user_id = '1'`),
    posts: n(`SELECT COUNT(*) AS n FROM posts WHERE code IN ('VIP001','BIZ777')`),
    stories: n(`SELECT COUNT(*) AS n FROM stories WHERE owner_id IN ('VIP001','BIZ777','ELITEBIZ')`),
    storyLikes: n(`SELECT COUNT(*) AS n FROM story_likes WHERE story_id = 601`),
    storyViews: n(`SELECT COUNT(*) AS n FROM story_views WHERE story_id = 601`),
    gallery: n(`SELECT COUNT(*) AS n FROM card_gallery WHERE code = 'VIP001'`),
    menu: n(`SELECT COUNT(*) AS n FROM menu_items WHERE code = 'BIZ777'`),
    companyPosts: n(`SELECT COUNT(*) AS n FROM company_posts WHERE company_id = 'ELITEBIZ'`),
    companyStats: n(`SELECT COUNT(*) AS n FROM company_stats WHERE company_id = 'ELITEBIZ'`),
    companyFollows: n(`SELECT COUNT(*) AS n FROM company_follows WHERE company_id = 'ELITEBIZ'`),
    catalog: n(`SELECT COUNT(*) AS n FROM company_catalog_items WHERE company_id = 'ELITEBIZ'`),
    likes: n(`SELECT (SELECT COUNT(*) FROM post_likes WHERE user_id = 1) + (SELECT COUNT(*) FROM content_likes WHERE user_id = 1) + (SELECT COUNT(*) FROM card_likes WHERE user_id = 1) AS n`),
    follows: n(`SELECT COUNT(*) AS n FROM follows WHERE follower_id = 1 OR followee_id = 1`),
    notifications: n(`SELECT COUNT(*) AS n FROM notifications WHERE recipient_user_id = 1 OR actor_user_id = 1`),
    saves: n(`SELECT COUNT(*) AS n FROM user_saves WHERE user_id = 1`),
    blocks: n(`SELECT COUNT(*) AS n FROM user_blocks WHERE user_id = 1 OR target_id = 'VIP001'`),
    myMessages: n(`SELECT COUNT(*) AS n FROM messages WHERE sender_id = 1`),
    appUsers: n(`SELECT COUNT(*) AS n FROM app_users WHERE user_id = 1`),
    quota: n(`SELECT COUNT(*) AS n FROM upload_quota WHERE key = 'user:1'`),
    rateKeys: n(`SELECT COUNT(*) AS n FROM rate_limits WHERE key IN (?, ?)`, 'login:acct:' + EMAIL, 'login:acct:' + sha256Hex(EMAIL)),
    emailOtp: n(`SELECT COUNT(*) AS n FROM email_otp_codes WHERE email = ?`, EMAIL),
    phoneOtp: n(`SELECT COUNT(*) AS n FROM phone_otp_codes WHERE phone = ?`, PHONE),
    botVerif: n(`SELECT COUNT(*) AS n FROM bot_verifications WHERE phone = ?`, PHONE),
    botMsgs: n(`SELECT COUNT(*) AS n FROM bot_messages WHERE tg_user_id = '5551'`),
    resetCodes: n(`SELECT COUNT(*) AS n FROM password_reset_codes WHERE user_id = 1`),
    resetTokens: n(`SELECT COUNT(*) AS n FROM email_reset_tokens WHERE user_id = 1`),
    sessions: n(`SELECT COUNT(*) AS n FROM sessions WHERE user_id = 1`),
  };
  check('T4 U ga tegishli shaxsiy ma’lumot va kontent: hammasi 0', Object.values(zero).every((v) => v === 0) ? 'ok' : zero, 'ok');
  check('T4 B kartasidagi jamoa qatori qoldi, U kodi uzildi', one(`SELECT member_code FROM card_team WHERE code = 'OTH222'`), { member_code: null });
  const cm = one(`SELECT body, author_code, deleted_reason, deleted_at IS NOT NULL AS del FROM content_comments WHERE id = 701`);
  check('T4 U izohi: qator joyida, matni yo‘q, account_purge', cm, { body: '', author_code: '', deleted_reason: 'account_purge', del: 1 });
  check('T4 avval o‘chirilgan izoh ham bo‘shatildi', one(`SELECT body FROM content_comments WHERE id = 703`), { body: '' });
  const tomb = one(`SELECT email, password_hash, phone, promo_code, deleted_at IS NOT NULL AS del, purged_at IS NOT NULL AS purged FROM users WHERE id = ?`, U);
  check('T4 tombstone', tomb, { email: 'deleted-1@deleted.invalid', password_hash: '!', phone: null, promo_code: null, del: 1, purged: 1 });
  const logRow = sqlite.prepare(`SELECT * FROM account_deletion_log`).all();
  check('T4 jurnal: 1 qator, psevdonim user_ref', [logRow.length, logRow[0]?.user_ref], [1, sha256Hex('acct-purge:1')]);
  checkTrue('T4 jurnalda email/telefon yo‘q', !JSON.stringify(logRow).includes(EMAIL) && !JSON.stringify(logRow).includes(PHONE));
  check('T4 kalitlar off: support_messages, company_orders, B xabari va suhbat SAQLANDI',
    [n(`SELECT COUNT(*) AS n FROM support_messages WHERE user_id = 1`), n(`SELECT COUNT(*) AS n FROM company_orders WHERE company_id = 'ELITEBIZ'`),
      n(`SELECT COUNT(*) AS n FROM messages WHERE sender_id = 2`), n(`SELECT COUNT(*) AS n FROM conversations WHERE id = 801`)], [1, 1, 1, 1]);
  check('T4 shikoyatchi IP tozalandi, shikoyat qoldi', one(`SELECT reporter_ip FROM content_reports WHERE reporter_id = 1`), { reporter_ip: '' });

  // T5 — moliyaviy qatorlar
  check('T5 moliyaviy qatorlar soni o‘zgarmadi', finCounts(), finBefore);
  const p1 = JSON.parse(one(`SELECT payload FROM web_orders WHERE id = 1001`).payload);
  check('T5 physical_card_order: faqat mahsulot atributlari', p1, { purged: 1, quantity: 2, finish: 'gold', printSpec: { side: 2 }, shippingCarrier: 'bts' });
  check('T5 featured_slot: slot atributlari', JSON.parse(one(`SELECT payload FROM web_orders WHERE id = 1002`).payload), { purged: 1, slotId: 'home', targetKind: 'card', targetId: 'VIP001', days: 7 });
  check('T5 card_purchase: profil maydonlari yo‘q', JSON.parse(one(`SELECT payload FROM web_orders WHERE id = 1003`).payload), { purged: 1, quantity: 1, auctionId: null });
  check('T5 buzuq JSON payload batch’ni yiqitmadi', one(`SELECT payload FROM web_orders WHERE id = 1004`).payload, '{"purged":1}');
  check('T5 summa, kod, holat qoldi', one(`SELECT code, price, status, kind FROM web_orders WHERE id = 1003`), { code: 'ABC123', price: 199000, status: 'paid', kind: 'card_purchase' });
  check('T5 bot_orders: ism yo‘q, isbot qoldi', one(`SELECT tg_username, tg_name, record_data, tg_user_id, price FROM bot_orders WHERE user_id = 1`), { tg_username: null, tg_name: null, record_data: null, tg_user_id: 5551, price: 1000 });
  check('T5 jismoniy karta: manzil yo‘q, o‘z kodiga ulangani o‘chdi', one(`SELECT shipping_name, shipping_phone, shipping_address, active, linked_code FROM physical_cards WHERE chip_token = 'chip-own'`),
    { shipping_name: null, shipping_phone: null, shipping_address: null, active: 0, linked_code: null });
  check('T5 auksion: to‘lov raqami yo‘q (to‘lov yakunlangan)', one(`SELECT seller_payme_number, current_price FROM auctions WHERE id = 950`), { seller_payme_number: null, current_price: 5000 });
  check('T5 featured slot to‘xtatildi', one(`SELECT status, stopped_reason FROM featured_slots WHERE user_id = 1`), { status: 'stopped', stopped_reason: 'account_deleted' });
  check('T5 sovg‘a oluvchi ismi yo‘q', one(`SELECT recipient_name, code FROM nfc_gifts WHERE code = 'GIFT01'`), { recipient_name: null, code: 'GIFT01' });

  // T6 — dalil arxivi
  check('T6 oldindan bor arxiv yozuvi bayt-bayt bir xil', JSON.stringify(sqlite.prepare(`SELECT * FROM content_archive WHERE id = 1`).all()), JSON.stringify(JSON.parse(archiveBefore).filter((r) => r.id === 1)));
  const kinds = sqlite.prepare(`SELECT kind, reason FROM content_archive WHERE id > 1 ORDER BY kind`).all();
  checkTrue('T6 yangi arxiv: post, istoriya, kompaniya posti (account_purge)',
    ['post', 'story', 'company_post'].every((k) => kinds.some((r) => r.kind === k && r.reason === 'account_purge')));
  checkTrue('T6 izohlar arxivida U izohi va istoriyaga yozilgan izoh bor',
    n(`SELECT COUNT(*) AS n FROM content_comment_archive WHERE comment_id = 701 AND reason = 'account_purge'`) === 1
    && n(`SELECT COUNT(*) AS n FROM content_comment_archive WHERE comment_id = 704`) === 1);
  check('T6 evidence_identity: shikoyat bor — snapshot olindi', one(`SELECT email, phone FROM evidence_identity WHERE user_id = 1`), { email: EMAIL, phone: PHONE });
  check('T6 egalik tarixi: VIP001, BIZ777, ELITEBIZ',
    sqlite.prepare(`SELECT owner_kind || ':' || owner_id AS k FROM evidence_owner_history WHERE user_id = '1' ORDER BY k`).all().map((r) => r.k),
    ['card:BIZ777', 'card:VIP001', 'company:ELITEBIZ']);

  // T9 — boshqalarga ta'sir yo'q
  check('T9 B ning kartasi, posti, xabari, obunasi joyida',
    [n(`SELECT COUNT(*) AS n FROM cards WHERE user_id = 2`), n(`SELECT COUNT(*) AS n FROM posts WHERE id = 502`), one(`SELECT email FROM users WHERE id = 2`).email],
    [2, 1, 'other@test.local']);
  check('T9 B ning galereyasidagi (umumiy) rasm qatori joyida', n(`SELECT COUNT(*) AS n FROM card_gallery WHERE code = 'OTH222'`), 1);
  // T16 — sovg'a qilingan karta
  check('T16 sovg‘a qilingan kartadagi U posti saqlandi (endi B kontenti)', n(`SELECT COUNT(*) AS n FROM posts WHERE id = 503`), 1);
  check('T16 B kartasiga ulangan U qurilmasi faol qoldi', one(`SELECT active, linked_code FROM physical_cards WHERE chip_token = 'chip-gift'`), { active: 1, linked_code: 'GFT555' });
}

// =====================================================================
// T8 — IDEMPOTENTLIK
// =====================================================================
{
  const h0 = dbHash();
  const again = await purgeDeletedUser(env, H, U, { mode: 'on', now: purgeNow + DAY });
  check('T8 ikkinchi purge -> already, hech narsa o‘zgarmadi', [again.status, dbHash() === h0], ['already', true]);
  const run2 = await runAccountPurge(env, H, { mode: 'on', now: purgeNow + DAY });
  check('T8 cron qayta: nomzod yo‘q', run2.candidates, 0);
}

// =====================================================================
// T7 — R2
// =====================================================================
{
  const queued = sqlite.prepare(`SELECT url FROM purge_media_queue ORDER BY url`).all().map((r) => r.url);
  checkTrue('T7 navbatda U fayllari bor, tashqi URL yo‘q', queued.includes(F.avatar) && queued.includes(F.music1) && queued.includes(F.musicOld)
    && queued.includes(F.logo) && queued.includes(F.compGal) && queued.includes(F.design) && !queued.some((u) => u.startsWith('https://cdn.')));
  const res = await drainPurgeMediaQueue(env, { limit: 50 });
  check('T7 o‘chdi: avatar, fon, musiqa (JSON va eski), logo, galereya, maket',
    [F.avatar, F.bg, F.music1, F.music2, F.musicOld, F.logo, F.compGal, F.design].map(r2Has), Array(8).fill(false));
  check('T7 qoldi: arxivdagi post/istoriya rasmi, B ham ishlatadigan rasm, admin fayli',
    [F.postImg, F.storyImg, F.shared, F.news].map(r2Has), [true, true, true, true]);
  checkTrue('T7 hisobot: keptArchived, keptReferenced, legacy', res.keptArchived >= 2 && res.keptReferenced >= 1 && res.legacy >= 1 && res.errors === 0);
  check('T7 navbat bo‘shadi', n(`SELECT COUNT(*) AS n FROM purge_media_queue`), 0);
  // ≤ 50 bitta ishga tushishda
  for (let i = 0; i < 60; i++) run(`INSERT INTO purge_media_queue (url, queued_at) VALUES (?, 'x')`, up(`${(i + 1000).toString(16).padStart(20, '0')}.jpg`));
  const big = await drainPurgeMediaQueue(env, { limit: 500 });
  check('T7 bitta ishga tushishda 50 dan ortiq emas', [big.deleted, n(`SELECT COUNT(*) AS n FROM purge_media_queue`)], [50, 10]);
  run(`DELETE FROM purge_media_queue`);
}

// =====================================================================
// Q — 90 KUNLIK KARANTIN
// =====================================================================
{
  const q = await call('/api/records/VIP001/quote');
  check('Q quote: purge qilingan kod BAND ko‘rinadi', [q.status, q.body?.taken, q.body?.purchasable], [200, true, false]);
  const buy = await call('/api/records/VIP001', { method: 'POST', cookie: cookie.other, json: { name: 'Xaridor' } });
  check('Q xarid -> 409 already_taken', [buy.status, buy.body?.error], [409, 'already_taken']);
  const co = await call('/api/companies/check?id=ELITEBIZ');
  check('Q Business ID band', [co.status, co.body?.available], [200, false]);
  const gift = await call('/api/admin/nfc-gifts', { method: 'POST', cookie: cookie.admin, json: { code: 'VIP001', recipientName: 'X' } });
  check('Q sovg‘a ID yaratish -> 409 CODE_QUARANTINED', [gift.status, gift.body?.error], [409, 'CODE_QUARANTINED']);
  const auc = await call('/api/admin/auctions', { method: 'POST', cookie: cookie.admin, json: { code: 'VIP001', startPrice: 100000, hours: 24 } });
  check('Q auksionga qo‘yish -> 409 code_taken', [auc.status, auc.body?.error], [409, 'code_taken']);
  checkTrue('Q 89-kuni hali band', await idQuarantined(env, 'card', 'VIP001', purgeNow + 89 * DAY));
  checkTrue('Q 91-kuni bo‘shaydi (NFC ID)', !(await idQuarantined(env, 'card', 'vip001', purgeNow + (ID_QUARANTINE_DAYS + 1) * DAY)));
  checkTrue('Q Business ID: mijoz buyurtmalari saqlanib turgani uchun 91-kuni ham band',
    await idQuarantined(env, 'company', 'ELITEBIZ', purgeNow + (ID_QUARANTINE_DAYS + 1) * DAY));
  // Bepul ID: tasodifiy kod karantinda bo'lsa o'tkazib yuboriladi.
  run(`INSERT INTO evidence_owner_history (owner_kind, owner_id, user_id, released_at) VALUES ('card', '12345678', '77', ?)`, ts(Date.now()));
  const realRandom = Math.random;
  const seq = [(12345678 - 10_000_000) / 89_999_999, (23456789 - 10_000_000) / 89_999_999];
  Math.random = () => seq.shift() ?? realRandom();
  const code = await createFreeAutoId(env, B, 'x');
  Math.random = realRandom;
  check('Q bepul ID karantindagi kodni o‘tkazib yubordi', code, '23456789');
}

// =====================================================================
// T10 (davomi) — purge'dan keyin email bo'shaydi, id qayta berilmaydi
// =====================================================================
{
  const r = await call('/api/auth/register', { method: 'POST', json: { email: EMAIL, phone: '+998907771235', password: 'newpass123', tosAccepted: true } });
  check('T10 purge’dan keyin shu email bilan ro‘yxat -> 201', r.status, 201);
  const nu = one(`SELECT id FROM users WHERE email = ?`, EMAIL);
  checkTrue('T13 yangi id tombstone id’sidan katta (qayta berilmadi)', nu && nu.id > U);
  check('T10 eski moliyaviy yozuvlar tombstone’da qoldi', n(`SELECT COUNT(*) AS n FROM transactions WHERE user_id = ?`, U), 1);
  check('T10 yangi hisobga eski izoh/saqlangan o‘tmadi', [n(`SELECT COUNT(*) AS n FROM content_comments WHERE user_id = ?`, nu.id), n(`SELECT COUNT(*) AS n FROM user_saves WHERE user_id = ?`, nu.id)], [0, 0]);
  const biz = await call('/api/companies/ELITEBIZ');
  check('T10 o‘chirilgan biznes sahifasi ochilmaydi', biz.status, 404);
}

// =====================================================================
// T19 — ARXIV KO'RINISHI
// =====================================================================
{
  // 91 kundan keyin VIP001 boshqa odamga berildi (karantin tugagan).
  run(`INSERT INTO cards (code, name, price, ts, user_id) VALUES ('VIP001', 'Yangi egasi', 0, 1, ?)`, B);
  const r = await call('/api/admin/evidence?q=VIP001&source=content', { cookie: cookie.admin });
  const item = (r.body?.items || []).find((x) => x.kind === 'post' && x.contentId === 501);
  check('T19 qayta berilgan kod: o‘chirilgan postning egasi — ESKI egasi (#1), emaili dalil nusxasidan',
    [item?.owner?.user?.userId, item?.owner?.user?.email], ['1', EMAIL]);
  const byMail = await call(`/api/admin/evidence?q=${encodeURIComponent(EMAIL)}&source=comment`, { cookie: cookie.admin });
  checkTrue('T19 eski email bo‘yicha qidiruv evidence_identity orqali topadi', (byMail.body?.items || []).some((x) => x.contentId === 701));
  const lastLog = one(`SELECT details FROM admin_activity_log WHERE action = 'evidence_search' ORDER BY id DESC LIMIT 1`);
  checkTrue('T19 qidiruv jurnalida xom email yo‘q', lastLog && !lastLog.details.includes(EMAIL) && lastLog.details.includes('email:'));
  const restore = await call('/api/admin/comments/701/restore', { method: 'POST', cookie: cookie.admin });
  check('T19 purge qilingan izohni tiklash -> 409', [restore.status, restore.body?.error], [409, 'account_purged']);
  run(`DELETE FROM cards WHERE code = 'VIP001'`);
}

// =====================================================================
// T12/T17/T18 — BLOCKER'LAR, NAVBAT, HOLD
// =====================================================================
const old = ts(Date.now() - 40 * DAY);
function seedGone(id, source, extra = () => {}) {
  run(`INSERT INTO users (id, email, password_hash, phone, deleted_at, deletion_source) VALUES (?, ?, 'x', ?, ?, ?)`, id, `u${id}@test.local`, `+9989000${id}`, old, source);
  run(`INSERT INTO cards (code, name, price, ts, user_id) VALUES (?, 'x', 0, 1, ?)`, `Q${id}`, id);
  extra(id);
}
seedGone(31, 'self', (id) => run(`UPDATE users SET balance = 5000 WHERE id = ?`, id));                                   // balans
seedGone(32, 'self', (id) => run(`INSERT INTO web_orders (user_id, code, price, payload, status, kind, created_at) VALUES (?, 'NEW001', 1000, '{}', 'pending', 'card_purchase', ?)`, id, ts(Date.now())));
seedGone(33, 'self', (id) => run(`INSERT INTO auctions (code, seller_id, start_price, current_price, ends_at, status) VALUES ('AUC033', ?, 1, 1, 'x', 'active')`, id));
seedGone(34, 'self', (id) => run(`INSERT INTO physical_cards (chip_token, owner_user_id, shipping_name, status) VALUES ('ship34', ?, 'Ism', 'printing')`, id));
seedGone(35, 'self', (id) => run(`INSERT INTO physical_cards (chip_token, owner_user_id, status) VALUES ('mkt35', ?, 'pending')`, id)); // marketplace qurilmasi — bloklamaydi
seedGone(36, 'admin');                 // admin o'chirgan — ko'rib chiqilmaguncha kutadi
seedGone(37, null);                    // manbasi noma'lum (eski) — kutadi
seedGone(38, 'self', (id) => run(`INSERT INTO web_orders (user_id, code, price, payload, status, kind, created_at) VALUES (?, 'OLD002', 1000, '{}', 'pending', 'card_purchase', ?)`, id, old)); // eski pending — bekor qilinadi, bloklamaydi
{
  const res = await runAccountPurge(env, H, { mode: 'on', limit: 3, now: Date.now() });
  check('T12 blocker’lar: balans, yangi buyurtma, auksion, yetkazilmagan karta', res.blocked, { balance: 1, pending_order: 1, auction: 1, physical_card: 1 });
  check('T17 bloklanganlar navbatni to‘xtatmadi: 35 va 38 purge qilindi', [res.purged, !!one(`SELECT purged_at FROM users WHERE id = 35`).purged_at, !!one(`SELECT purged_at FROM users WHERE id = 38`).purged_at], [2, true, true]);
  check('T12 bloklangan hisob tegilmadi, sababi yozildi', [n(`SELECT COUNT(*) AS n FROM cards WHERE user_id = 31`), one(`SELECT purge_blocked_reason FROM users WHERE id = 31`).purge_blocked_reason], [1, 'balance']);
  check('T12 eski pending buyurtma bekor qilindi, qator qoldi', one(`SELECT status FROM web_orders WHERE user_id = 38`), { status: 'cancelled' });
  check('T18 admin o‘chirgan va manbasi noma’lum hisob purge qilinmadi', [one(`SELECT purged_at FROM users WHERE id = 36`).purged_at, one(`SELECT purged_at FROM users WHERE id = 37`).purged_at], [null, null]);
  const res2 = await runAccountPurge(env, H, { mode: 'on', limit: 3, now: Date.now() });
  check('T12 bloklanganlar ertaga qayta tekshiriladi (bugun tanlanmaydi)', [res2.candidates, res2.purged], [0, 0]);
}

// =====================================================================
// A — ADMIN "O'CHIRISH NAVBATI"
// =====================================================================
{
  const mgr = await call('/api/admin/account-deletions', { cookie: cookie.manager });
  check('A manager -> 403', mgr.status, 403);
  const list = await call('/api/admin/account-deletions?state=unreviewed', { cookie: cookie.admin });
  check('A ko‘rib chiqilmaganlar: 36 va 37', (list.body?.items || []).map((x) => x.id).sort(), [36, 37]);
  checkTrue('A ro‘yxatda purgeAfter va manba bor', list.body.items.every((x) => typeof x.purgeAfter === 'number' && 'source' in x));
  const blocked = await call('/api/admin/account-deletions?state=blocked', { cookie: cookie.admin });
  check('A bloklanganlar', (blocked.body?.items || []).map((x) => [x.id, x.blockedReason]).sort(), [[31, 'balance'], [32, 'pending_order'], [33, 'auction'], [34, 'physical_card']]);
  const purged = await call('/api/admin/account-deletions?state=purged', { cookie: cookie.admin });
  checkTrue('A purge qilinganlarda email ko‘rsatilmaydi', (purged.body?.items || []).length >= 3 && purged.body.items.every((x) => x.email === ''));

  // Hold: 36 ko'rib chiqildi, lekin hold qo'yildi — purge yo'q; hold olinsa — purge.
  check('A review', (await call('/api/admin/account-deletions/36/review', { method: 'POST', cookie: cookie.admin })).status, 200);
  check('A hold izohsiz -> 422', (await call('/api/admin/account-deletions/36/hold', { method: 'POST', cookie: cookie.admin, json: {} })).status, 422);
  check('A hold', (await call('/api/admin/account-deletions/36/hold', { method: 'POST', cookie: cookie.admin, json: { note: 'tergov' } })).status, 200);
  await runAccountPurge(env, H, { mode: 'on', now: Date.now() });
  check('T18 hold: purge qilinmadi', one(`SELECT purged_at FROM users WHERE id = 36`).purged_at, null);
  check('A hold olib tashlash', (await call('/api/admin/account-deletions/36/hold', { method: 'DELETE', cookie: cookie.admin })).status, 200);
  await runAccountPurge(env, H, { mode: 'on', now: Date.now() });
  checkTrue('T18 ko‘rib chiqilgan, hold’siz — purge qilindi', !!one(`SELECT purged_at FROM users WHERE id = 36`).purged_at);

  // Restore: purge'dan OLDIN tiklanadi.
  seedGone(39, 'self');
  run(`UPDATE users SET deleted_at = ? WHERE id = 39`, ts(Date.now() - 5 * DAY));
  const rs = await call('/api/admin/account-deletions/39/restore', { method: 'POST', cookie: cookie.admin });
  check('A restore -> hisob qaytdi', [rs.status, one(`SELECT deleted_at, deletion_source FROM users WHERE id = 39`)], [200, { deleted_at: null, deletion_source: null }]);
  check('A purge qilingan hisobni tiklab bo‘lmaydi', (await call('/api/admin/account-deletions/35/restore', { method: 'POST', cookie: cookie.admin })).status, 409);

  // Qo'lda purge: tasdiqsiz yo'q, muddat tugamagan bo'lsa yo'q, dry-run rejimida yo'q.
  seedGone(40, 'self');
  run(`UPDATE users SET deleted_at = ? WHERE id = 40`, ts(Date.now() - 5 * DAY));
  check('A qo‘lda purge tasdiqsiz -> 422', (await call('/api/admin/account-deletions/40/purge', { method: 'POST', cookie: cookie.admin, json: { dryRun: false } })).status, 422);
  const early = await call('/api/admin/account-deletions/40/purge', { method: 'POST', cookie: cookie.admin, json: { dryRun: false, confirm: 'PURGE #40' } });
  check('A 30 kun tugamagan -> 409 grace_not_over (muddat hech kim uchun qisqarmaydi)', [early.status, early.body?.error], [409, 'grace_not_over']);
  run(`UPDATE users SET deleted_at = ? WHERE id = 40`, old);
  env.ACCOUNT_PURGE_MODE = 'dry-run';
  check('A dry-run rejimida qo‘lda purge yo‘q', (await call('/api/admin/account-deletions/40/purge', { method: 'POST', cookie: cookie.admin, json: { dryRun: false, confirm: 'PURGE #40' } })).body?.error, 'purge_disabled');
  env.ACCOUNT_PURGE_MODE = 'on';
  const ok = await call('/api/admin/account-deletions/40/purge', { method: 'POST', cookie: cookie.admin, json: { dryRun: false, confirm: 'PURGE #40' } });
  check('A muddat tugagan, tasdiqli qo‘lda purge -> 200', [ok.status, ok.body?.status], [200, 'purged']);
  checkTrue('A jurnalda faqat #id', n(`SELECT COUNT(*) AS n FROM admin_activity_log WHERE action = 'account_purged_manual' AND details = '#40'`) === 1);
}

// =====================================================================
// T8 — ATOMIKLIK: batch o'rtasida xato — hech narsa o'zgarmaydi
// =====================================================================
{
  seedGone(41, 'self');
  run(`INSERT INTO posts (id, code, user_id, caption) VALUES (541, 'Q41', 41, 'post')`);
  const h0 = dbHash();
  const realBatch = env.DB.batch;
  env.DB.batch = async function (stmts) {
    const bad = env.DB.prepare(`INSERT INTO jadval_yoq (x) VALUES (1)`);
    return realBatch.call(this, [...stmts.slice(0, 20), bad, ...stmts.slice(20)]);
  };
  let threw = false;
  try { await purgeDeletedUser(env, H, 41, { mode: 'on', now: Date.now() }); } catch { threw = true; }
  env.DB.batch = realBatch;
  check('T8 xato -> butun batch rollback, baza o‘zgarmadi', [threw, dbHash() === h0], [true, true]);
  const again = await purgeDeletedUser(env, H, 41, { mode: 'on', now: Date.now() });
  check('T8 keyingi urinish muvaffaqiyatli', [again.status, n(`SELECT COUNT(*) AS n FROM posts WHERE id = 541`)], ['purged', 0]);
}

// =====================================================================
// L — `scheduled` handler: dry-run rejimida faqat sonlar, bazaga tegmaydi
// =====================================================================
{
  seedGone(42, 'self');
  env.ACCOUNT_PURGE_MODE = 'dry-run';
  const h0 = dbHash();
  const jobs = [];
  logged.length = 0;
  capture();
  await worker.scheduled({ cron: '30 21 * * *', scheduledTime: Date.now() }, env, { waitUntil: (p) => jobs.push(p) });
  await Promise.all(jobs);
  release();
  const line = logged.find((l) => l.includes('"evt":"account_purge"'));
  checkTrue('L cron logi: evt account_purge, dry-run', !!line && line.includes('"mode":"dry-run"') && line.includes('"wouldPurge":1'));
  checkTrue('L cron logida email/telefon yo‘q', !logged.some((l) => l.includes('u42@test.local') || l.includes('+998900042')));
  check('L dry-run cron bazaga tegmadi', dbHash(), h0);
  env.ACCOUNT_PURGE_MODE = 'off';
  jobs.length = 0;
  await worker.scheduled({ cron: '30 21 * * *', scheduledTime: Date.now() }, env, { waitUntil: (p) => jobs.push(p) });
  await Promise.all(jobs);
  check('L off rejimida cron hech narsa qilmaydi', dbHash(), h0);
  env.ACCOUNT_PURGE_MODE = 'on';
}

// =====================================================================
// G — QAMROV QO'RIQCHISI
// =====================================================================
// Foydalanuvchini aniqlaydigan ustuni bor HAR jadval shu ro'yxatda
// bo'lishi kerak: A — purge o'chiradi/anonimlaydi; B — moliyaviy, qoladi
// (PII tozalanadi); C — dalil arxivi; D — xavfsizlik/texnik; N — shaxsiy
// ma'lumot emas yoki egasiz. Yangi jadval qo'shilsa va bu yerda bo'lmasa
// test yiqiladi — purge'ga qo'shish yoki sababini yozish kerak.
const PURGE_POLICY = {
  users: 'tombstone', sessions: 'A', password_reset_codes: 'A', email_reset_tokens: 'A', email_otp_codes: 'A',
  phone_otp_codes: 'A', tg_link_tokens: 'A', bot_verifications: 'A', bot_messages: 'A', app_users: 'A', upload_quota: 'A',
  cards: 'A', posts: 'A', stories: 'A', story_likes: 'A', story_views: 'A', menu_items: 'A', menu_categories: 'A',
  products: 'A', product_categories: 'A', services: 'A', service_categories: 'A', card_gallery: 'A', card_files: 'A',
  card_videos: 'A', card_team: 'A', card_leads: 'A', card_events: 'A', card_likes: 'A', post_likes: 'A', content_likes: 'A',
  content_comments: 'A', follows: 'A', company_follows: 'A', user_saves: 'A', notifications: 'A', user_blocks: 'A',
  blocked_users: 'A', messages: 'A', conversations: 'A(flag)', auction_demand_votes: 'A', auction_requests: 'A',
  support_messages: 'A(flag)', companies: 'A', company_posts: 'A', company_stats: 'A', company_catalog_items: 'A', company_catalog_item_views: 'A',
  company_orders: 'A(flag)', catalog_item_reactions: 'A', catalog_item_views: 'A', catalog_promotions: 'A', gift_offers: 'B',
  transactions: 'B', wallet_topups: 'B', web_orders: 'B', bids: 'B', premium_requests: 'B', auctions: 'B', bot_orders: 'B',
  physical_cards: 'B', featured_slots: 'B', company_payments: 'B', nfc_gifts: 'B', referral_uses: 'B', marketplace_activations: 'B',
  content_archive: 'C', content_comment_archive: 'C', evidence_flags: 'C', post_likes_orphans: 'C', content_likes_orphans: 'C',
  content_scan_blocks: 'C', evidence_identity: 'C', evidence_owner_history: 'C', user_reports: 'C', content_reports: 'C',
  account_deletion_log: 'D', account_legal_holds: 'D', purge_media_queue: 'D', rate_limits: 'D', admin_activity_log: 'D',
  company_status_log: 'D', company_id_rules: 'N', auction_demand: 'N', admins: 'N', admin_sessions: 'N', admin_login_history: 'N',
  admin_2fa_pending: 'N', admin_totp_setup_pending: 'N', news_likes: 'N', finance_docs: 'N', finance_expenses: 'N',
};
const SENSITIVE = /^(user_id|owner_user_id|code|company_id|phone|email|recipient_user_id|actor_user_id|sender_id|follower_id|followee_id|reporter_id|reported_id|from_user_id|to_user_id|seller_id|highest_bidder_id|activated_by_user_id|referrer_id|referred_id|blocker_id|blocked_id|user_a_id|user_b_id|viewer|tg_user_id|member_code|owner_id|customer_phone|shipping_phone)$/;
{
  const missing = [];
  for (const { name } of sqlite.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`).all()) {
    const cols = sqlite.prepare(`PRAGMA table_info("${name}")`).all().map((c) => c.name);
    if (cols.some((c) => SENSITIVE.test(c)) && !(name in PURGE_POLICY)) missing.push(name);
  }
  check('G foydalanuvchiga bog‘liq har jadval purge siyosatida bor', missing, []);
}

done();
