// hosting/api/account-purge.js — HISOBNI HAQIQIY (QAYTARILMAS) O'CHIRISH.
//
// ═══ NIMA UCHUN BOR ═══
//
// `DELETE /api/account` hisobni faqat YASHIRADI (`users.deleted_at`):
// email, telefon, profil, postlar va fayllar bazada qolardi. Google Play
// buni o'chirish emas, "deaktivatsiya" deb hisoblaydi. Reja va har bir
// jadval bo'yicha qaror: ACCOUNT_DELETION_PLAN.md.
//
// Egasining qarorlari (2026-09-25): 30 kunlik o'ylash muddati; pullik
// NFC ID va Business ID uchun pul qaytarilmaydi, ular 90 kundan keyin
// qayta beriladi; to'lov yozuvlari ism, telefon va manzilsiz saqlanadi.
//
// ═══ QANDAY ISHLAYDI ═══
//
//   So'rov → darhol yashirish (avvalgidek) → 30 kun → PURGE (shu modul):
//   * shaxsiy ma'lumot, profil va kontent O'CHIRILADI;
//   * moliyaviy qatorlar QOLADI, ulardagi ism/telefon/manzil tozalanadi;
//   * dalil arxivi (U1) tegilmaydi, unga faqat yangi nusxa qo'shiladi;
//   * `users` qatori HECH QACHON o'chirilmaydi — "tombstone" bo'lib
//     qoladi (email → `deleted-<id>@deleted.invalid`, parol va telefon
//     yo'q). Shunda sxemadagi `ON DELETE CASCADE` ishga tushmaydi
//     (to'lov yozuvlari yo'qolmaydi), `id` esa qayta berilmaydi.
//
// Bitta foydalanuvchining purge'i BITTA atomik `env.DB.batch` — yarim
// o'chirilgan hisob qolmaydi. Batch'ning birinchi statement'i
// `account_deletion_log` ga UNIQUE yozuv: ikkinchi urinish butun
// batch'ni rollback qiladi (idempotentlik).
//
// ═══ XAVFSIZLIK KALITLARI (wrangler.jsonc `vars`) ═══
//
//   ACCOUNT_PURGE_MODE = off | dry-run | on   (standart: off)
//     off     — hech narsa qilinmaydi;
//     dry-run — faqat sonlar hisoblanadi va logga yoziladi, baza O'ZGARMAYDI;
//     on      — haqiqiy purge.
//   ACCOUNT_PURGE_R2 = off | on   — fayllarni R2 dan o'chirish (alohida).
//   PURGE_SUPPORT_MESSAGES, PURGE_COMPANY_ORDERS, PURGE_CONVERSATIONS,
//   SCRUB_ADMIN_LOG = off | on    — egasi javob bermagan savollar
//     (rejaning 9-bo'limi). Javob kelguncha standart qaror: SAQLASH.
//
// Loglarga faqat SONLAR yoziladi: email, telefon va id yozilmaydi.

import { archiveStmt, ensureArchiveTable } from './content-archive.js';
import { retireTargetStmts, ensureSchema as ensureCommentsSchema } from './comments.js';
import { cardContentCleanupStmts, CARD_CONTENT_TABLES } from './card-cleanup.js';

export const PURGE_GRACE_DAYS = 30;
export const ID_QUARANTINE_DAYS = 90;
export const PURGE_MODES = ['off', 'dry-run', 'on'];
export const PURGE_FLAGS = ['PURGE_SUPPORT_MESSAGES', 'PURGE_COMPANY_ORDERS', 'PURGE_CONVERSATIONS', 'SCRUB_ADMIN_LOG'];
const DAY_MS = 86_400_000;
// Payme/Click hali to'lashi mumkin bo'lgan yangi buyurtma shu muddatda blocker.
const PENDING_ORDER_MS = DAY_MS;
// Bloklangan hisob qayta shu muddatdan keyin tekshiriladi.
const RETRY_MS = DAY_MS;

export function purgeMode(env) {
  const m = String(env?.ACCOUNT_PURGE_MODE ?? 'off').trim().toLowerCase();
  return PURGE_MODES.includes(m) ? m : 'off';
}
const flagOn = (env, k) => String(env?.[k] ?? 'off').trim().toLowerCase() === 'on';

// `H.nowTs()` bilan bir xil shakl ("YYYY-MM-DD HH:MM:SS.sss+00").
export const tsAt = (ms) => new Date(ms).toISOString().replace('T', ' ').replace('Z', '+00');
// Bazadagi sana formatlari aralash (`…+00`, `CURRENT_TIMESTAMP`, ISO).
// `datetime()` `+00` ni tanimaydi, shuning uchun solishtirish birinchi
// 19 belgi bo'yicha (comments.js dagi `sec()` naqshi).
const SEC = (c) => `substr(replace(${c}, 'T', ' '), 1, 19)`;
const secAt = (ms) => tsAt(ms).slice(0, 19);

export function parseTs(v) {
  if (v === null || v === undefined || v === '') return null;
  let s = String(v).trim().replace(' ', 'T');
  if (/\+00$/.test(s)) s = s.replace(/\+00$/, 'Z');
  else if (!/(Z|[+-]\d\d:?\d\d)$/.test(s)) s += 'Z';
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

/// Hisob qachon butunlay o'chiriladi (ms). `deleted_at` bo'lmasa null.
export function purgeAfterMs(deletedAt) {
  const t = parseTs(deletedAt);
  return t === null ? null : t + PURGE_GRACE_DAYS * DAY_MS;
}

// Foydalanuvchi id'si SQL ichiga SON sifatida yoziladi (bind emas): bitta
// so'rovdagi bind soni D1 da 100 bilan cheklangan, purge esa bitta
// batch'da ~80 statement. Id bazadan olinadi va shu yerda tekshiriladi —
// foydalanuvchi kiritgan matn bu yerga hech qachon tushmaydi.
function safeId(v) {
  const n = Number(v);
  if (!Number.isSafeInteger(n) || n <= 0) throw new Error('purge_bad_user_id');
  return n;
}

// ── SXEMA (faqat qo'shish) ─────────────────────────────────────────────

const USER_COLS = ['purged_at', 'deletion_source', 'purge_reviewed_at', 'purge_next_attempt_at', 'purge_blocked_reason'];

const TABLES_SQL = [
  `CREATE TABLE IF NOT EXISTS "account_deletion_log" (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_ref TEXT NOT NULL UNIQUE,
    requested_at TEXT, purged_at TEXT NOT NULL, source TEXT, counts_json TEXT)`,
  `CREATE TABLE IF NOT EXISTS "purge_media_queue" (
    url TEXT PRIMARY KEY, queued_at TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS "account_legal_holds" (
    user_id INTEGER PRIMARY KEY, note TEXT NOT NULL, set_by TEXT NOT NULL, set_at TEXT NOT NULL)`,
  // U1: purge qilingan muallifning email va telefoni — faqat dalil
  // arxivida yozuvi yoki unga qarshi shikoyat bo'lsa (pastda).
  `CREATE TABLE IF NOT EXISTS "evidence_identity" (
    user_id INTEGER PRIMARY KEY, email TEXT, phone TEXT, captured_at TEXT NOT NULL)`,
  // Kod va Business ID kimniki bo'lgani. Ikki vazifasi bor: dalil
  // arxivida eski egani ko'rsatish va 90 kunlik karantin.
  `CREATE TABLE IF NOT EXISTS "evidence_owner_history" (
    owner_kind TEXT NOT NULL, owner_id TEXT NOT NULL, user_id TEXT NOT NULL, released_at TEXT NOT NULL,
    PRIMARY KEY (owner_kind, owner_id, user_id, released_at))`,
  `CREATE INDEX IF NOT EXISTS idx_owner_history_owner ON evidence_owner_history(owner_kind, owner_id, released_at)`,
];

// Xotiradagi "tayyor" belgisi bazaga bog'lanadi (WeakMap): sinovda har
// bir `makeEnv` yangi baza, production'da esa bitta.
const schemaJobs = new WeakMap();

/// Purge ustunlari va jadvallari. Hech narsa o'chirmaydi, o'zgartirmaydi.
/// `true` — hamma ustun haqiqatan bor.
export async function ensurePurgeSchema(env) {
  const key = env.DB;
  if (!schemaJobs.has(key)) {
    const job = (async () => {
      for (const c of USER_COLS) {
        await env.DB.prepare(`ALTER TABLE users ADD COLUMN ${c} TEXT`).run().catch(() => {});
      }
      await env.DB.batch(TABLES_SQL.map((sql) => env.DB.prepare(sql)));
      const info = await env.DB.prepare(`PRAGMA table_info(users)`).all();
      const have = new Set((info?.results || []).map((r) => String(r.name)));
      return USER_COLS.every((c) => have.has(c));
    })();
    schemaJobs.set(key, job);
    job.then((ok) => { if (!ok) schemaJobs.delete(key); }, () => schemaJobs.delete(key));
  }
  return schemaJobs.get(key);
}

// Kech (lazy) qo'shiladigan ustunlar — bor-yo'qligi PRAGMA bilan o'qiladi.
const OPTIONAL_COLS = [
  ['physical_cards', 'linked_company_id'], ['physical_cards', 'marketplace_batch_id'],
  ['cards', 'company_id'], ['users', 'signup_source'],
  ['content_comments', 'deleted_at'], ['content_comments', 'deleted_reason'],
  ['companies', 'gallery_json'], ['companies', 'music_json'],
  ['company_catalog_items', 'images_json'],
];

// Purge'siz ishlay olmaydigan jadvallar. Biri yo'q bo'lsa foydalanuvchi
// `schema` sababi bilan o'tkazib yuboriladi — hech narsa o'chirilmaydi.
const REQUIRED_TABLES = [
  'users', 'cards', 'sessions', 'account_deletion_log', 'purge_media_queue',
  'evidence_identity', 'evidence_owner_history', 'content_archive',
  'content_comments', 'content_comment_archive', 'content_likes',
  'posts', 'post_likes', 'stories', 'story_likes', 'story_views',
  'gift_offers', 'physical_cards', ...CARD_CONTENT_TABLES,
];

/// Bazada qaysi jadval va ustunlar borligi + kalitlar. Bitta ishga
/// tushishda bir marta o'qiladi.
export async function loadPurgeConfig(env) {
  // Izoh va arxiv jadvallari (va izohdagi `deleted_at`) — purge'dan oldin.
  await ensureArchiveTable(env).catch(() => {});
  await ensureCommentsSchema(env).catch(() => {});
  const t = await env.DB.prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`).all();
  const tables = new Set((t?.results || []).map((r) => String(r.name)));
  const cols = new Set();
  const byTable = new Map();
  for (const [tb, c] of OPTIONAL_COLS) {
    if (!byTable.has(tb)) byTable.set(tb, []);
    byTable.get(tb).push(c);
  }
  for (const [tb, list] of byTable) {
    if (!tables.has(tb)) continue;
    const info = await env.DB.prepare(`PRAGMA table_info(${tb})`).all().catch(() => null);
    const have = new Set((info?.results || []).map((r) => String(r.name)));
    for (const c of list) if (have.has(c)) cols.add(`${tb}.${c}`);
  }
  const flags = Object.fromEntries(PURGE_FLAGS.map((k) => [k, flagOn(env, k)]));
  const missing = REQUIRED_TABLES.filter((x) => !tables.has(x));
  if (!cols.has('content_comments.deleted_at')) missing.push('content_comments.deleted_at');
  return { tables, cols, flags, missing };
}

// ── BLOCKER'LAR ────────────────────────────────────────────────────────

const FINAL_PHYSICAL_STATUSES = `'delivered'`;

/// Purge'ni kechiktiradigan sabablar (bo'sh massiv — to'siq yo'q).
/// Hammasi BITTA so'rov: D1 bitta chaqiruvdagi so'rovlar sonini cheklaydi.
export async function purgeBlockers(env, userId, cfg, now = Date.now()) {
  const id = safeId(userId);
  const has = (tb) => cfg.tables.has(tb);
  const mkt = cfg.cols.has('physical_cards.marketplace_batch_id') ? ' AND marketplace_batch_id IS NULL' : '';
  const parts = [
    `(SELECT COALESCE(balance, 0) + COALESCE(held_balance, 0) + COALESCE(pending_payout, 0) FROM users WHERE id = ${id}) AS balance`,
    has('account_legal_holds') ? `EXISTS (SELECT 1 FROM account_legal_holds WHERE user_id = ${id}) AS legal_hold` : '0 AS legal_hold',
    has('web_orders')
      ? `EXISTS (SELECT 1 FROM web_orders WHERE user_id = ${id} AND status = 'pending' AND ${SEC('created_at')} > ?) AS pending_order`
      : '0 AS pending_order',
    has('bot_orders') ? `EXISTS (SELECT 1 FROM bot_orders WHERE user_id = ${id} AND status = 'pending') AS bot_order` : '0 AS bot_order',
    has('auctions')
      ? `EXISTS (SELECT 1 FROM auctions WHERE (seller_id = ${id} OR highest_bidder_id = ${id}) AND status IN ('active','awaiting_payment')) AS auction`
      : '0 AS auction',
    // Sotuvchiga hali to'lanmagan auksion puli — biz qarzdormiz.
    has('auctions')
      ? `EXISTS (SELECT 1 FROM auctions WHERE seller_id = ${id} AND seller_payout_status = 'pending') AS payout`
      : '0 AS payout',
    // Faqat buyurtma qilingan va hali yetkazilmagan jismoniy karta.
    // Marketplace qurilmalari (manzilsiz) bloklamaydi.
    has('physical_cards')
      ? `EXISTS (SELECT 1 FROM physical_cards WHERE owner_user_id = ${id} AND shipping_name IS NOT NULL${mkt}
           AND COALESCE(status, '') NOT IN (${FINAL_PHYSICAL_STATUSES})) AS physical_card`
      : '0 AS physical_card',
  ];
  const binds = has('web_orders') ? [secAt(now - PENDING_ORDER_MS)] : [];
  const r = await env.DB.prepare(`SELECT ${parts.join(', ')}`).bind(...binds).first();
  const out = [];
  if (Number(r?.balance) > 0) out.push('balance');
  for (const k of ['legal_hold', 'pending_order', 'bot_order', 'auction', 'payout', 'physical_card']) {
    if (Number(r?.[k])) out.push(k);
  }
  return out;
}

// ── MEDIA ─────────────────────────────────────────────────────────────

// JSON ustun (massiv yoki eski bitta URL): noto'g'ri JSON batch'ni yiqitmaydi.
const jsonVals = (tb, colName, where) =>
  `SELECT j.value AS url FROM ${tb} x, json_each(CASE WHEN json_valid(x.${colName}) THEN x.${colName} ELSE json_array(x.${colName}) END) j
    WHERE j.type = 'text' AND ${where}`;

/// Foydalanuvchining barcha fayl manzillari (UNION). Faqat mavjud
/// jadval va ustunlardan quriladi.
function mediaUnionSql(id, cfg) {
  const has = (tb) => cfg.tables.has(tb);
  const col = (tb, c) => cfg.cols.has(`${tb}.${c}`);
  const CODES = `SELECT code FROM cards WHERE user_id = ${id}`;
  const COS = `SELECT company_id FROM companies WHERE CAST(owner_user_id AS TEXT) = '${id}'`;
  const q = [
    `SELECT avatar_url AS url FROM cards WHERE user_id = ${id}`,
    `SELECT bg_url FROM cards WHERE user_id = ${id}`,
    jsonVals('cards', 'music_url', `x.user_id = ${id}`),
  ];
  const byCode = [
    ['card_gallery', ['image_url']], ['card_team', ['photo_url']],
    ['menu_items', ['image_url']], ['products', ['image_url']], ['services', ['image_url']],
    ['card_videos', ['video_url', 'thumb_url']], ['card_files', ['file_url']],
    ['posts', ['image_url', 'video_url']],
  ];
  for (const [tb, cs] of byCode) {
    if (!has(tb)) continue;
    for (const c of cs) q.push(`SELECT ${c} FROM ${tb} WHERE code IN (${CODES})`);
  }
  if (has('stories')) {
    const own = has('companies')
      ? `(owner_kind = 'card' AND owner_id IN (${CODES})) OR (owner_kind = 'company' AND owner_id IN (${COS}))`
      : `owner_kind = 'card' AND owner_id IN (${CODES})`;
    q.push(`SELECT image_url FROM stories WHERE ${own}`, `SELECT video_url FROM stories WHERE ${own}`);
  }
  if (has('companies')) {
    const mine = `CAST(owner_user_id AS TEXT) = '${id}'`;
    q.push(`SELECT logo_url FROM companies WHERE ${mine}`, `SELECT cover_url FROM companies WHERE ${mine}`);
    if (col('companies', 'gallery_json')) q.push(jsonVals('companies', 'gallery_json', `CAST(x.owner_user_id AS TEXT) = '${id}'`));
    if (col('companies', 'music_json')) q.push(jsonVals('companies', 'music_json', `CAST(x.owner_user_id AS TEXT) = '${id}'`));
    if (has('company_posts')) {
      q.push(`SELECT image_url FROM company_posts WHERE company_id IN (${COS})`, `SELECT video_url FROM company_posts WHERE company_id IN (${COS})`);
    }
    if (has('company_catalog_items')) {
      q.push(`SELECT image_url FROM company_catalog_items WHERE company_id IN (${COS})`);
      if (col('company_catalog_items', 'images_json')) q.push(jsonVals('company_catalog_items', 'images_json', `x.company_id IN (${COS})`));
    }
  }
  // Bosma maket fayllari (jismoniy karta buyurtmasi).
  if (has('web_orders')) {
    for (const k of ['designFrontUrl', 'designBackUrl']) {
      q.push(`SELECT json_extract(payload, '$.${k}') FROM web_orders WHERE user_id = ${id} AND json_valid(payload)`);
    }
  }
  return q.join('\n UNION ALL ');
}

const MEDIA_FILTER = `url IS NOT NULL AND url <> '' AND url LIKE '%/uploads/%'`;

// ── SONLAR (dry-run va jurnal) ────────────────────────────────────────

/// Purge nimani qamrashini sanaydi — BITTA so'rov. Purge statement'lari
/// bilan bir xil shartlar (kod, kompaniya, foydalanuvchi id'si).
export async function purgeCounts(env, userId, cfg) {
  const id = safeId(userId);
  const has = (tb) => cfg.tables.has(tb);
  const CODES = `SELECT code FROM cards WHERE user_id = ${id}`;
  const COS = `SELECT company_id FROM companies WHERE CAST(owner_user_id AS TEXT) = '${id}'`;
  const c = [];
  const add = (key, tb, sql) => { c.push(has(tb) ? `(${sql}) AS ${key}` : `0 AS ${key}`); };
  add('cards', 'cards', `SELECT COUNT(*) FROM cards WHERE user_id = ${id}`);
  add('companies', 'companies', `SELECT COUNT(*) FROM companies WHERE CAST(owner_user_id AS TEXT) = '${id}'`);
  add('posts', 'posts', `SELECT COUNT(*) FROM posts WHERE code IN (${CODES})`);
  add('stories', 'stories', has('companies')
    ? `SELECT COUNT(*) FROM stories WHERE (owner_kind = 'card' AND owner_id IN (${CODES})) OR (owner_kind = 'company' AND owner_id IN (${COS}))`
    : `SELECT COUNT(*) FROM stories WHERE owner_kind = 'card' AND owner_id IN (${CODES})`);
  add('companyPosts', has('companies') ? 'company_posts' : '__none__', `SELECT COUNT(*) FROM company_posts WHERE company_id IN (${COS})`);
  add('comments', 'content_comments', `SELECT COUNT(*) FROM content_comments WHERE user_id = ${id}`);
  const likeParts = [
    has('content_likes') && `(SELECT COUNT(*) FROM content_likes WHERE user_id = ${id})`,
    has('post_likes') && `(SELECT COUNT(*) FROM post_likes WHERE user_id = ${id})`,
    has('card_likes') && `(SELECT COUNT(*) FROM card_likes WHERE user_id = ${id})`,
    has('story_likes') && `(SELECT COUNT(*) FROM story_likes WHERE user_id = ${id})`,
  ].filter(Boolean);
  c.push(likeParts.length ? `(${likeParts.join(' + ')}) AS likes` : '0 AS likes');
  add('follows', 'follows', `SELECT COUNT(*) FROM follows WHERE follower_id = ${id} OR followee_id = ${id}`);
  add('notifications', 'notifications', `SELECT COUNT(*) FROM notifications WHERE recipient_user_id = ${id} OR actor_user_id = ${id}`);
  add('saves', 'user_saves', `SELECT COUNT(*) FROM user_saves WHERE user_id = ${id}`);
  add('messages', 'messages', `SELECT COUNT(*) FROM messages WHERE sender_id = ${id}`);
  const contentParts = CARD_CONTENT_TABLES.filter((tb) => tb !== 'posts' && has(tb))
    .map((tb) => `(SELECT COUNT(*) FROM ${tb} WHERE code IN (${CODES}))`);
  c.push(contentParts.length ? `(${contentParts.join(' + ')}) AS cardContent` : '0 AS cardContent');
  c.push(`(SELECT COUNT(DISTINCT url) FROM (${mediaUnionSql(id, cfg)}) WHERE ${MEDIA_FILTER}) AS media`);
  const r = await env.DB.prepare(`SELECT ${c.join(',\n ')}`).first();
  const out = {};
  for (const [k, v] of Object.entries(r || {})) out[k] = Number(v) || 0;
  return out;
}

// ── PURGE BATCH ───────────────────────────────────────────────────────

/// Bitta foydalanuvchining purge statement'lari, TARTIB MUHIM:
/// dalil va arxiv — o'chirishdan OLDIN; kartalar — kontentidan KEYIN;
/// tombstone — eng oxirida. `DELETE FROM users` HECH QACHON yo'q.
///
/// u: { id, email, phone, deleted_at, deletion_source, emailHash, phoneHash }
export function purgeStmts(env, u, now, ref, cfg, counts = {}) {
  const id = safeId(u.id);
  const idT = `'${id}'`;
  const CODES = `SELECT code FROM cards WHERE user_id = ${id}`;
  const COS = `SELECT company_id FROM companies WHERE CAST(owner_user_id AS TEXT) = ${idT}`;
  const has = (...tbs) => tbs.every((tb) => cfg.tables.has(tb));
  const col = (tb, c) => cfg.cols.has(`${tb}.${c}`);
  const flag = (k) => !!cfg.flags?.[k];
  const co = has('companies');
  const out = [];
  const add = (tbs, sql, ...binds) => { if (has(...tbs)) out.push(env.DB.prepare(sql).bind(...binds)); };
  const addAll = (tbs, stmts) => { if (has(...tbs)) out.push(...stmts); };
  const by = { userId: 0, admin: 'system', reason: 'account_purge' };
  const retire = { reason: 'account_purge', byAdmin: 'system' };

  // 0) IDEMPOTENTLIK QULFI. Ikkinchi urinishda UNIQUE xatosi — butun batch rollback.
  add(['account_deletion_log'],
    `INSERT INTO account_deletion_log (user_ref, requested_at, purged_at, source, counts_json) VALUES (?, ?, ?, ?, ?)`,
    ref, u.deleted_at || null, now, String(u.deletion_source || 'unknown').slice(0, 20), JSON.stringify(counts));

  // 1) R2 NAVBATI — fayl manzillari qatorlar o'chirilishidan OLDIN yig'iladi.
  //    Fayllar batch commit bo'lgandan keyin alohida bosqichda o'chiriladi.
  add(['purge_media_queue'],
    `INSERT OR IGNORE INTO purge_media_queue (url, queued_at, attempts)
     SELECT DISTINCT url, ?, 0 FROM (${mediaUnionSql(id, cfg)}) WHERE ${MEDIA_FILTER}`, now);

  // 2) DALIL: kod va kompaniya kimniki bo'lgani (arxiv ko'rinishi va 90
  //    kunlik karantin uchun), keyin arxiv nusxalari.
  add(['evidence_owner_history'],
    `INSERT OR IGNORE INTO evidence_owner_history (owner_kind, owner_id, user_id, released_at)
     SELECT 'card', UPPER(code), ${idT}, ? FROM cards WHERE user_id = ${id}`
    + (co ? ` UNION ALL SELECT 'company', company_id, ${idT}, ? FROM companies WHERE CAST(owner_user_id AS TEXT) = ${idT}` : ''),
    ...(co ? [now, now] : [now]));
  if (co) {
    addAll(['stories'], retireTargetStmts(env, 'company_story',
      `SELECT id FROM stories WHERE owner_kind = 'company' AND owner_id IN (${COS})`, [], retire));
    if (has('company_posts')) {
      out.push(archiveStmt(env, 'company_post', `company_id IN (${COS})`, [], by, now));
      out.push(...retireTargetStmts(env, 'company_post', `SELECT id FROM company_posts WHERE company_id IN (${COS})`, [], retire));
    }
    addAll(['stories'], [archiveStmt(env, 'story', `owner_kind = 'company' AND owner_id IN (${COS})`, [], by, now)]);
  }
  // O'zi yozgan izohlar: arxivga nusxa, keyin jonli jadvalda matn qolmaydi.
  // Javoblar (`parent_id`) buzilmaydi — qator joyida, faqat bo'sh.
  add(['content_comments', 'content_comment_archive'],
    `INSERT INTO content_comment_archive (comment_id, target_kind, target_id, user_id, author_code, body,
       created_at, deleted_at, deleted_by_user_id, deleted_by_admin, reason)
     SELECT id, target_kind, target_id, user_id, author_code, body, created_at, ?, 0, 'system', 'account_purge'
       FROM content_comments WHERE user_id = ${id} AND deleted_at IS NULL`, now);
  add(['content_comments'],
    `UPDATE content_comments SET deleted_at = COALESCE(deleted_at, ?), deleted_reason = 'account_purge',
       body = '', author_code = '' WHERE user_id = ${id}`, now);

  // 3) KARTA KONTENTI — faqat U ning HOZIRGI kartalari (CODES) bo'yicha.
  //    `posts.user_id` bo'yicha EMAS: sovg'a qilingan kartadagi postlar
  //    endi yangi egasiniki.
  add(['card_team'], `UPDATE card_team SET member_code = NULL WHERE member_code IN (${CODES}) AND code NOT IN (${CODES})`);
  for (const tb of ['catalog_item_reactions', 'catalog_item_views', 'catalog_promotions']) {
    add([tb], `DELETE FROM ${tb} WHERE code IN (${CODES})`);
  }
  out.push(...cardContentCleanupStmts(env, CODES, [], now, by));
  add(['gift_offers'],
    `UPDATE gift_offers SET status = 'cancelled', decided_at = ?
      WHERE status = 'pending' AND (from_user_id = ${id} OR to_user_id = ${id})`, now);

  // 4) KOMPANIYALAR (Business ID).
  if (co) {
    add(['story_likes', 'stories'], `DELETE FROM story_likes WHERE story_id IN (SELECT id FROM stories WHERE owner_kind = 'company' AND owner_id IN (${COS}))`);
    add(['story_views', 'stories'], `DELETE FROM story_views WHERE story_id IN (SELECT id FROM stories WHERE owner_kind = 'company' AND owner_id IN (${COS}))`);
    add(['stories'], `DELETE FROM stories WHERE owner_kind = 'company' AND owner_id IN (${COS})`);
    const companyTables = ['company_posts', 'company_stats', 'company_follows', 'company_catalog_items'];
    // Biznes mijozlarining buyurtmalari (ism, telefon) — egasi javob bermaguncha saqlanadi.
    if (flag('PURGE_COMPANY_ORDERS')) companyTables.push('company_orders');
    for (const tb of companyTables) add([tb], `DELETE FROM ${tb} WHERE company_id IN (${COS})`);
    if (col('physical_cards', 'linked_company_id')) {
      add(['physical_cards'], `UPDATE physical_cards SET linked_company_id = NULL WHERE linked_company_id IN (${COS})`);
    }
    if (col('cards', 'company_id')) add(['cards'], `UPDATE cards SET company_id = NULL WHERE company_id IN (${COS})`);
    add(['companies'], `DELETE FROM companies WHERE CAST(owner_user_id AS TEXT) = ${idT}`);
  }

  // 5) FOYDALANUVCHI ID'SI BO'YICHA. Tombstone tufayli CASCADE yo'q —
  //    har biri aniq yoziladi.
  add(['content_likes'], `DELETE FROM content_likes WHERE user_id = ${id}`);
  add(['post_likes'], `DELETE FROM post_likes WHERE user_id = ${id}`);
  add(['card_likes'], `DELETE FROM card_likes WHERE user_id = ${id}`);
  add(['story_likes'], `DELETE FROM story_likes WHERE user_id = ${id}`);
  add(['story_views'], `DELETE FROM story_views WHERE viewer = 'u${id}'`);
  add(['follows'], `DELETE FROM follows WHERE follower_id = ${id} OR followee_id = ${id}`);
  add(['company_follows'], `DELETE FROM company_follows WHERE user_id = ${id}`);
  add(['user_saves'], `DELETE FROM user_saves WHERE user_id = ${id}`);
  add(['notifications'], `DELETE FROM notifications WHERE recipient_user_id = ${id} OR actor_user_id = ${id}`);
  // U ning bloklari va U ning kodi/kompaniyasiga qo'yilgan bloklar: kod
  // qayta sotilsa, blok yangi egaga o'tmasin.
  add(['user_blocks'],
    `DELETE FROM user_blocks WHERE user_id = ${id}
       OR (target_kind = 'record' AND UPPER(target_id) IN (SELECT UPPER(code) FROM cards WHERE user_id = ${id}))`
    + (co ? ` OR (target_kind = 'company' AND target_id IN (${COS}))` : ''));
  add(['blocked_users'], `DELETE FROM blocked_users WHERE blocker_id = ${id} OR blocked_id = ${id}`);
  add(['messages'], `DELETE FROM messages WHERE sender_id = ${id}`);
  if (flag('PURGE_CONVERSATIONS')) {
    add(['messages', 'conversations'], `DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE user_a_id = ${id} OR user_b_id = ${id})`);
    add(['conversations'], `DELETE FROM conversations WHERE user_a_id = ${id} OR user_b_id = ${id}`);
  }
  add(['auction_demand_votes'], `DELETE FROM auction_demand_votes WHERE user_id = ${id}`);
  add(['auction_requests'], `DELETE FROM auction_requests WHERE user_id = ${id}`);
  add(['app_users'], `DELETE FROM app_users WHERE user_id = ${id}`);
  if (flag('PURGE_SUPPORT_MESSAGES')) add(['support_messages'], `DELETE FROM support_messages WHERE user_id = ${id}`);
  add(['content_reports'], `UPDATE content_reports SET reporter_ip = '' WHERE reporter_id = ${id}`);
  add(['sessions'], `DELETE FROM sessions WHERE user_id = ${id}`);
  add(['password_reset_codes'], `DELETE FROM password_reset_codes WHERE user_id = ${id}`);
  add(['email_reset_tokens'], `DELETE FROM email_reset_tokens WHERE user_id = ${id}`);
  add(['upload_quota'], `DELETE FROM upload_quota WHERE key = 'user:${id}'`);
  // Tezlik cheklovi kalitlarida email yoki telefon turadi (eski xom va yangi xesh shakli).
  const rlKeys = [];
  for (const v of [u.email, u.phone, u.emailHash, u.phoneHash]) {
    if (v) rlKeys.push(`login:acct:${v}`);
  }
  for (const v of [u.email, u.emailHash]) {
    if (v) rlKeys.push(`emailreset:to:${v}`);
  }
  if (rlKeys.length) add(['rate_limits'], `DELETE FROM rate_limits WHERE key IN (${rlKeys.map(() => '?').join(', ')})`, ...rlKeys);
  if (u.email) add(['email_otp_codes'], `DELETE FROM email_otp_codes WHERE email = ?`, String(u.email).toLowerCase());
  if (u.phone) {
    // Raqam boshqa TIRIK hisobda bo'lsa uning kirishi buzilmaydi.
    const phoneFree = `NOT EXISTS (SELECT 1 FROM users o WHERE o.phone = ? AND o.id <> ${id} AND o.deleted_at IS NULL)`;
    // Telegram yozishmalari — bot_verifications O'CHIRILISHIDAN OLDIN.
    if (has('bot_messages')) {
      const tgFree = `NOT EXISTS (
          SELECT 1 FROM bot_verifications bv JOIN users o ON o.phone = bv.phone
           WHERE CAST(bv.tg_user_id AS TEXT) = bot_messages.tg_user_id AND o.id <> ${id} AND o.deleted_at IS NULL
          UNION ALL
          SELECT 1 FROM bot_orders bo JOIN users o ON o.id = bo.user_id
           WHERE CAST(bo.tg_user_id AS TEXT) = bot_messages.tg_user_id AND o.id <> ${id} AND o.deleted_at IS NULL)`;
      add(['bot_messages', 'bot_verifications', 'bot_orders'],
        `DELETE FROM bot_messages WHERE tg_user_id IN (
           SELECT CAST(tg_user_id AS TEXT) FROM bot_verifications WHERE phone = ?
           UNION SELECT CAST(tg_user_id AS TEXT) FROM bot_orders WHERE user_id = ${id}) AND ${tgFree}`, u.phone);
    }
    add(['phone_otp_codes'], `DELETE FROM phone_otp_codes WHERE phone = ? AND ${phoneFree}`, u.phone, u.phone);
    add(['tg_link_tokens'], `DELETE FROM tg_link_tokens WHERE phone = ? AND ${phoneFree}`, u.phone, u.phone);
    add(['bot_verifications'], `DELETE FROM bot_verifications WHERE phone = ? AND ${phoneFree}`, u.phone, u.phone);
  }
  if (flag('SCRUB_ADMIN_LOG') && has('admin_activity_log')) {
    for (const v of [u.email, u.phone]) {
      if (!v) continue;
      for (const c of ['details', 'old_value', 'new_value']) {
        out.push(env.DB.prepare(`UPDATE admin_activity_log SET ${c} = replace(${c}, ?, '#${id}') WHERE instr(${c}, ?) > 0`).bind(v, v));
      }
    }
  }

  // 6) MOLIYAVIY QATORLAR QOLADI — ism, telefon, manzil va maketlar tozalanadi.
  add(['web_orders'],
    `UPDATE web_orders SET status = 'cancelled' WHERE user_id = ${id} AND status = 'pending'
       AND ${SEC('created_at')} <= ?`, secAt(parseTs(now) - PENDING_ORDER_MS));
  add(['web_orders'],
    `UPDATE web_orders SET payload = CASE
       WHEN payload IS NULL OR NOT json_valid(payload) THEN '{"purged":1}'
       WHEN kind = 'physical_card_order' THEN json_object('purged', 1,
            'quantity', json_extract(payload, '$.quantity'), 'finish', json_extract(payload, '$.finish'),
            'printSpec', json_extract(payload, '$.printSpec'), 'shippingCarrier', json_extract(payload, '$.shippingCarrier'))
       WHEN kind = 'featured_slot' THEN json_object('purged', 1,
            'slotId', json_extract(payload, '$.slotId'), 'targetKind', json_extract(payload, '$.targetKind'),
            'targetId', json_extract(payload, '$.targetId'), 'days', json_extract(payload, '$.days'))
       WHEN kind = 'premium_upgrade' THEN payload
       ELSE json_object('purged', 1, 'quantity', json_extract(payload, '$.quantity'),
                        'auctionId', json_extract(payload, '$.auctionId'))
     END WHERE user_id = ${id}`);
  add(['bot_orders'], `UPDATE bot_orders SET tg_username = NULL, tg_name = NULL, record_data = NULL WHERE user_id = ${id}`);
  add(['physical_cards'],
    `UPDATE physical_cards SET shipping_name = NULL, shipping_phone = NULL, shipping_address = NULL WHERE owner_user_id = ${id}`);
  // U ning o'z kodi yoki kompaniyasiga ulangan qurilmalar (yuqorida uzildi)
  // o'chadi. Boshqa odamning jonli kartasiga ulangani faol qoladi.
  add(['physical_cards'],
    `UPDATE physical_cards SET active = 0 WHERE owner_user_id = ${id} AND linked_code IS NULL`
    + (col('physical_cards', 'linked_company_id') ? ' AND linked_company_id IS NULL' : ''));
  add(['auctions'],
    `UPDATE auctions SET seller_payme_number = NULL WHERE seller_id = ${id} AND COALESCE(seller_payout_status, 'none') IN ('paid', 'none')`);
  add(['featured_slots'],
    `UPDATE featured_slots SET status = 'stopped', stopped_reason = 'account_deleted' WHERE user_id = ${id} AND status = 'active'`);
  add(['featured_slots'], `UPDATE featured_slots SET status = 'cancelled' WHERE user_id = ${id} AND status = 'pending'`);
  add(['nfc_gifts'], `UPDATE nfc_gifts SET recipient_name = NULL WHERE activated_by_user_id = ${id}`);

  // 7) KARTALAR — kontenti allaqachon tozalangan.
  add(['cards'], `DELETE FROM cards WHERE user_id = ${id}`);

  // 8) DALIL IDENTIFIKATORI (U1) — tombstone'dan OLDIN. Faqat arxivda U
  //    muallif bo'lgan yozuv yoki U ga qarshi shikoyat bo'lsa. Arxiv yozuvi
  //    hisob ochilishidan OLDIN bo'lsa — u boshqa (eski) hisobniki (id
  //    ilgari qayta ishlatilgan), shuning uchun hisobga olinmaydi.
  const conds = [
    `EXISTS (SELECT 1 FROM content_archive a WHERE a.user_id = ${idT} AND ${SEC('a.created_at')} >= ${SEC('u.created_at')})`,
    `EXISTS (SELECT 1 FROM content_comment_archive c WHERE c.user_id = ${id} AND ${SEC('c.created_at')} >= ${SEC('u.created_at')})`,
  ];
  if (has('user_reports')) conds.push(`EXISTS (SELECT 1 FROM user_reports r WHERE r.reported_id = ${id})`);
  if (has('content_reports')) {
    conds.push(`EXISTS (SELECT 1 FROM content_reports cr WHERE cr.resolved_at IS NULL
       AND (UPPER(COALESCE(cr.owner_code, '')) IN (SELECT UPPER(owner_id) FROM evidence_owner_history WHERE user_id = ${idT})
         OR UPPER(CAST(cr.target_id AS TEXT)) IN (SELECT UPPER(owner_id) FROM evidence_owner_history WHERE user_id = ${idT})))`);
  }
  add(['evidence_identity'],
    `INSERT OR IGNORE INTO evidence_identity (user_id, email, phone, captured_at)
     SELECT u.id, u.email, u.phone, ? FROM users u WHERE u.id = ${id} AND (${conds.join('\n OR ')})`, now);

  // 9) TOMBSTONE. `DELETE FROM users` HECH QACHON bajarilmaydi.
  add(['users'],
    `UPDATE users SET email = 'deleted-' || id || '@deleted.invalid', password_hash = '!',
       phone = NULL, promo_code = NULL, suspend_reason = NULL,`
    + (col('users', 'signup_source') ? ' signup_source = NULL,' : '')
    + ` purged_at = ?, purge_blocked_reason = NULL, purge_next_attempt_at = NULL
     WHERE id = ${id} AND purged_at IS NULL`, now);
  return out;
}

async function userRef(H, id) {
  return H.sha256Hex(`acct-purge:${id}`);
}

async function loadUser(env, id) {
  return env.DB.prepare(
    `SELECT id, email, phone, created_at, deleted_at, deletion_source, purged_at, purge_reviewed_at
       FROM users WHERE id = ?`
  ).bind(safeId(id)).first();
}

/// BITTA foydalanuvchini purge qiladi.
///   mode: 'dry-run' — faqat sonlar; 'on' — haqiqiy purge.
///   Blocker bo'lsa hech narsa o'chirilmaydi.
/// Natija: { status: 'purged'|'dry-run'|'blocked'|'skipped'|'already', blockers?, counts? }
export async function purgeDeletedUser(env, H, userId, { mode = 'dry-run', cfg = null, now = Date.now() } = {}) {
  if (!(await ensurePurgeSchema(env))) return { status: 'skipped', reason: 'schema' };
  const u = await loadUser(env, userId);
  if (!u || !u.deleted_at) return { status: 'skipped', reason: 'not_deleted' };
  if (u.purged_at) return { status: 'already' };
  const conf = cfg || await loadPurgeConfig(env);
  if (conf.missing.length) return { status: 'skipped', reason: 'schema' };
  const blockers = await purgeBlockers(env, u.id, conf, now);
  if (blockers.length) return { status: 'blocked', blockers };
  const counts = await purgeCounts(env, u.id, conf);
  if (mode !== 'on') return { status: 'dry-run', counts };
  const nowT = tsAt(now);
  const lower = (v) => (v ? String(v).trim().toLowerCase() : '');
  const user = {
    ...u,
    emailHash: u.email ? await H.sha256Hex(lower(u.email)) : '',
    phoneHash: u.phone ? await H.sha256Hex(String(u.phone)) : '',
  };
  try {
    await env.DB.batch(purgeStmts(env, user, nowT, await userRef(H, u.id), conf, counts));
  } catch (e) {
    // Idempotentlik qulfi: boshqa urinish allaqachon bajargan.
    if (/UNIQUE constraint failed: account_deletion_log/i.test(String(e?.message || ''))) return { status: 'already' };
    throw e;
  }
  return { status: 'purged', counts };
}

/// Cron: 30 kunlik muddati tugagan hisoblarni purge qiladi (yoki dry-run).
/// Bloklangan hisob tanlovdan vaqtincha chiqariladi — navbatni to'xtatmaydi.
export async function runAccountPurge(env, H, { mode = purgeMode(env), limit = 3, now = Date.now() } = {}) {
  const res = { mode, candidates: 0, purged: 0, wouldPurge: 0, blocked: {}, skipped: 0, errors: 0, totals: {} };
  if (mode === 'off') return res;
  if (!(await ensurePurgeSchema(env))) { res.skipped = -1; return res; }
  const cfg = await loadPurgeConfig(env);
  const max = Math.max(1, Math.min(50, Number(limit) || 3));
  const rows = await env.DB.prepare(
    `SELECT id FROM users
      WHERE deleted_at IS NOT NULL AND purged_at IS NULL
        AND ${SEC('deleted_at')} <= ?
        AND (purge_next_attempt_at IS NULL OR ${SEC('purge_next_attempt_at')} <= ?)
        AND (COALESCE(deletion_source, '') IN ('self', 'email') OR purge_reviewed_at IS NOT NULL)
        AND id NOT IN (SELECT user_id FROM account_legal_holds)
      ORDER BY ${SEC('deleted_at')} ASC, id ASC LIMIT ?`
  ).bind(secAt(now - PURGE_GRACE_DAYS * DAY_MS), secAt(now), max + 20).all();
  const ids = (rows?.results || []).map((r) => Number(r.id));
  res.candidates = ids.length;
  for (const id of ids) {
    if (res.purged + res.wouldPurge >= max) break;
    let r;
    try {
      r = await purgeDeletedUser(env, H, id, { mode, cfg, now });
    } catch (e) {
      res.errors++;
      console.error('account_purge_user', String(e?.message || e).slice(0, 160));
      continue;
    }
    if (r.status === 'blocked') {
      for (const b of r.blockers) res.blocked[b] = (res.blocked[b] || 0) + 1;
      // dry-run bazaga YOZMAYDI; 'on' da keyingi urinish vaqti yoziladi.
      if (mode === 'on') {
        await env.DB.prepare(
          `UPDATE users SET purge_blocked_reason = ?, purge_next_attempt_at = ? WHERE id = ? AND purged_at IS NULL`
        ).bind(r.blockers.join(','), tsAt(now + RETRY_MS), id).run();
      }
      continue;
    }
    if (r.status === 'purged') res.purged++;
    else if (r.status === 'dry-run') res.wouldPurge++;
    else if (r.status === 'skipped') res.skipped++;
    for (const [k, v] of Object.entries(r.counts || {})) res.totals[k] = (res.totals[k] || 0) + v;
  }
  return res;
}

// ── R2: FAYLLARNI O'CHIRISH ───────────────────────────────────────────

const OWN_HOSTS = new Set(['nfcstore.uz', 'www.nfcstore.uz']);
// base64 yo'li prefikssiz `uploads/<20hex>.<ext>`, prefiksli yo'l `<prefix>_<24hex>`.
const KEY_RE = /^uploads\/(?:[a-z]+_)?[0-9a-f]{20,}\.[a-z0-9]+$/;
// Admin fayllari (yangiliklar, moliya) avtomatik o'chirilmaydi.
const ADMIN_PREFIX_RE = /^uploads\/(?:news|fin)_/;

/// URL → R2 kaliti. Tashqi, eski (formatga mos kelmaydigan) yoki admin
/// fayllari uchun null — ular qo'lda ko'rib chiqiladi.
export function uploadKeyFor(url) {
  const s = String(url || '').trim();
  let path = '';
  if (s.startsWith('/uploads/')) path = s;
  else {
    try {
      const u = new URL(s);
      if (!OWN_HOSTS.has(u.hostname)) return null;
      path = u.pathname;
    } catch { return null; }
  }
  let key;
  try { key = decodeURIComponent(path).replace(/^\//, ''); } catch { return null; }
  if (!KEY_RE.test(key) || ADMIN_PREFIX_RE.test(key)) return null;
  return key;
}

// Jonli qatorlarda ishlatilayotgan fayllar (boshqa odam ham o'sha faylni
// ishlatayotgan bo'lishi mumkin) — BITTA so'rovda, partiya bo'yicha.
function liveUseSql(cfg, marks) {
  const has = (tb) => cfg.tables.has(tb);
  const col = (tb, c) => cfg.cols.has(`${tb}.${c}`);
  const plain = [
    ['cards', ['avatar_url', 'bg_url']], ['card_gallery', ['image_url']], ['card_team', ['photo_url']],
    ['menu_items', ['image_url']], ['products', ['image_url']], ['services', ['image_url']],
    ['card_videos', ['video_url', 'thumb_url']], ['card_files', ['file_url']],
    ['posts', ['image_url', 'video_url']], ['stories', ['image_url', 'video_url']],
    ['companies', ['logo_url', 'cover_url']], ['company_posts', ['image_url', 'video_url']],
    ['company_catalog_items', ['image_url']], ['news', ['image_url']],
  ];
  const q = [];
  for (const [tb, cs] of plain) {
    if (!has(tb)) continue;
    for (const c of cs) q.push(`SELECT ${c} AS url FROM ${tb} WHERE ${c} IN (${marks})`);
  }
  const js = (tb, c) => `SELECT j.value AS url FROM ${tb} x, json_each(CASE WHEN json_valid(x.${c}) THEN x.${c} ELSE json_array(x.${c}) END) j WHERE j.type = 'text' AND j.value IN (${marks})`;
  if (has('cards')) q.push(js('cards', 'music_url'));
  if (col('companies', 'gallery_json')) q.push(js('companies', 'gallery_json'));
  if (col('companies', 'music_json')) q.push(js('companies', 'music_json'));
  if (col('company_catalog_items', 'images_json')) q.push(js('company_catalog_items', 'images_json'));
  return q;
}

/// Navbatdagi fayllarni R2 dan o'chiradi. Bitta ishga tushishda `limit`
/// (≤ 50) ta URL. Arxivda bor yoki jonli qatorda ishlatilayotgan fayl
/// QOLADI. Xato bo'lsa URL navbatda qoladi (`attempts + 1`).
export async function drainPurgeMediaQueue(env, { limit = 50 } = {}) {
  const out = { deleted: 0, keptArchived: 0, keptReferenced: 0, legacy: 0, errors: 0 };
  if (!env.UPLOADS) return out;
  if (!(await ensurePurgeSchema(env))) return out;
  const cfg = await loadPurgeConfig(env);
  const n = Math.max(1, Math.min(50, Number(limit) || 50));
  const rows = await env.DB.prepare(
    `SELECT url FROM purge_media_queue ORDER BY attempts ASC, queued_at ASC LIMIT ?`
  ).bind(n).all();
  const urls = (rows?.results || []).map((r) => String(r.url));
  if (!urls.length) return out;
  const drop = async (list) => {
    if (!list.length) return;
    await env.DB.prepare(`DELETE FROM purge_media_queue WHERE url IN (${list.map(() => '?').join(', ')})`).bind(...list).run();
  };
  const legacy = urls.filter((u) => !uploadKeyFor(u));
  out.legacy = legacy.length;
  await drop(legacy);
  const cand = urls.filter((u) => uploadKeyFor(u));
  if (!cand.length) return out;
  const marks = cand.map(() => '?').join(', ');
  const archived = new Set();
  const arch = await env.DB.prepare(
    `SELECT image_url, video_url, file_url FROM content_archive
      WHERE image_url IN (${marks}) OR video_url IN (${marks}) OR file_url IN (${marks})`
  ).bind(...cand, ...cand, ...cand).all().catch(() => null);
  if (!arch) { out.errors = cand.length; return out; }   // arxivni o'qib bo'lmadi — o'chirmaymiz
  for (const r of arch.results || []) for (const v of [r.image_url, r.video_url, r.file_url]) if (v) archived.add(String(v));
  const live = new Set();
  for (const sql of liveUseSql(cfg, marks)) {
    const r = await env.DB.prepare(sql).bind(...cand).all().catch(() => null);
    if (!r) { out.errors = cand.length; return out; }
    for (const x of r.results || []) if (x.url) live.add(String(x.url));
  }
  const keep = [];
  const del = [];
  for (const u of cand) {
    if (archived.has(u)) { out.keptArchived++; keep.push(u); }
    else if (live.has(u)) { out.keptReferenced++; keep.push(u); }
    else del.push(u);
  }
  await drop(keep);
  if (del.length) {
    try {
      await env.UPLOADS.delete(del.map(uploadKeyFor));
      out.deleted = del.length;
      await drop(del);
    } catch (e) {
      out.errors += del.length;
      await env.DB.prepare(
        `UPDATE purge_media_queue SET attempts = attempts + 1 WHERE url IN (${del.map(() => '?').join(', ')})`
      ).bind(...del).run().catch(() => {});
    }
  }
  return out;
}

// ── CRON ─────────────────────────────────────────────────────────────

/// `scheduled` handler'i chaqiradi. Loglarga faqat sonlar yoziladi.
export async function runScheduledPurge(env, H, { now = Date.now() } = {}) {
  const mode = purgeMode(env);
  if (mode === 'off') return { mode };
  const res = await runAccountPurge(env, H, { mode, limit: Number(env.PURGE_MAX_USERS) || 3, now });
  if (mode === 'on' && String(env.ACCOUNT_PURGE_R2 || 'off').trim().toLowerCase() === 'on') {
    res.r2 = await drainPurgeMediaQueue(env, { limit: 50 });
  }
  console.log(JSON.stringify({ evt: 'account_purge', ...res }));
  return res;
}

// ── 90 KUNLIK KARANTIN ────────────────────────────────────────────────

/// Egasining qarori: o'chirilgan hisobning NFC ID va Business ID'lari 90
/// kun hech kimga berilmaydi (eski NFC karta va havolalar begona odamning
/// profilini ochmasin). Karantin tugagach kod yana sotuvga chiqadi.
///
/// Business ID uchun qo'shimcha: biznes mijozlarining buyurtmalari
/// (`company_orders`) saqlanib turgan bo'lsa, u ham band — aks holda
/// yangi egasi eski mijozlarning ism va telefonlarini ko'rardi.
///
/// kind: 'card' | 'company'. `true` — hozir berib bo'lmaydi.
export async function idQuarantined(env, kind, id, now = Date.now()) {
  const v = String(id || '').trim();
  if (!v) return false;
  const since = secAt(now - ID_QUARANTINE_DAYS * DAY_MS);
  try {
    const row = await env.DB.prepare(
      `SELECT 1 AS x FROM evidence_owner_history
        WHERE owner_kind = ? AND UPPER(owner_id) = UPPER(?) AND ${SEC('released_at')} > ? LIMIT 1`
    ).bind(kind, v, since).first();
    if (row) return true;
  } catch {
    // Jadval hali yo'q — hech narsa purge qilinmagan.
  }
  if (kind === 'company') {
    try {
      const o = await env.DB.prepare(
        `SELECT 1 AS x FROM company_orders o
          WHERE UPPER(o.company_id) = UPPER(?)
            AND NOT EXISTS (SELECT 1 FROM companies c WHERE UPPER(c.company_id) = UPPER(?)) LIMIT 1`
      ).bind(v, v).first();
      if (o) return true;
    } catch { /* jadval yo'q */ }
  }
  return false;
}

/// SQL qism: `<ifoda>` dagi kod karantinda EMAS (ro'yxat va qidiruv
/// so'rovlari uchun). Jadval yo'q bo'lsa ishlatmang — `quarantineReady()`.
export function notQuarantinedSql(kind, expr, now = Date.now()) {
  const since = secAt(now - ID_QUARANTINE_DAYS * DAY_MS);
  return `NOT EXISTS (SELECT 1 FROM evidence_owner_history qh
    WHERE qh.owner_kind = '${kind === 'company' ? 'company' : 'card'}' AND UPPER(qh.owner_id) = UPPER(${expr})
      AND ${SEC('qh.released_at')} > '${since}')`;
}

// ── ADMIN: "O'CHIRISH NAVBATI" ────────────────────────────────────────
//
//   GET    /api/admin/account-deletions?state=waiting|due|blocked|held|unreviewed|purged&page=
//   POST   /api/admin/account-deletions/:id/restore     — faqat purge'dan oldin
//   POST   /api/admin/account-deletions/:id/review      — admin/eski so'rovni navbatga qo'yish
//   POST   /api/admin/account-deletions/:id/hold {note} / DELETE …/hold
//   POST   /api/admin/account-deletions/:id/purge {dryRun:true}
//          {dryRun:false, confirm:"PURGE #<id>"} — 30 kun tugagan hisobni cron'ni
//          kutmasdan purge qilish (faqat ACCOUNT_PURGE_MODE=on)
//
// Hammasi faqat super_admin. Har bir amal jurnalga `#id` bilan yoziladi.

const STATES = ['all', 'waiting', 'due', 'blocked', 'held', 'unreviewed', 'purged'];

export async function handleAdmin(request, env, url, H) {
  const path = url.pathname;
  if (!path.startsWith('/api/admin/account-deletions')) return null;
  const admin = await H.requireAdmin(request, env);
  if (!admin) return H.json({ error: 'unauthorized' }, 401);
  if (admin.role !== 'super_admin') return H.json({ error: 'forbidden' }, 403);
  if (!(await ensurePurgeSchema(env))) return H.json({ error: 'schema_unavailable' }, 503);
  const ip = H.reqIp ? H.reqIp(request) : '';
  const method = request.method;
  const now = Date.now();
  const log = (action, details) => H.logAdminActivity?.(env, { action, details, ip })?.catch?.(() => {});

  if (path === '/api/admin/account-deletions') {
    if (method !== 'GET') return H.json({ error: 'method_not_allowed' }, 405);
    const state = STATES.includes(url.searchParams.get('state')) ? url.searchParams.get('state') : 'all';
    const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
    const limit = 50;
    const graceCut = secAt(now - PURGE_GRACE_DAYS * DAY_MS);
    const held = `u.id IN (SELECT user_id FROM account_legal_holds)`;
    // COALESCE: manbasi NULL (eski so'rov) bo'lsa ifoda NULL emas, FALSE bo'lsin.
    const eligible = `(COALESCE(u.deletion_source, '') IN ('self','email') OR u.purge_reviewed_at IS NOT NULL)`;
    const where = {
      all: `u.deleted_at IS NOT NULL`,
      waiting: `u.deleted_at IS NOT NULL AND u.purged_at IS NULL AND ${SEC('u.deleted_at')} > '${graceCut}'`,
      due: `u.deleted_at IS NOT NULL AND u.purged_at IS NULL AND ${SEC('u.deleted_at')} <= '${graceCut}' AND ${eligible} AND NOT ${held} AND u.purge_blocked_reason IS NULL`,
      blocked: `u.purged_at IS NULL AND u.purge_blocked_reason IS NOT NULL`,
      held: `u.purged_at IS NULL AND ${held}`,
      unreviewed: `u.deleted_at IS NOT NULL AND u.purged_at IS NULL AND NOT ${eligible}`,
      purged: `u.purged_at IS NOT NULL`,
    }[state];
    const rows = await env.DB.prepare(
      `SELECT u.id, u.email, u.deleted_at, u.deletion_source, u.purge_reviewed_at, u.purge_blocked_reason,
              u.purge_next_attempt_at, u.purged_at, h.note AS hold_note, h.set_at AS hold_at
         FROM users u LEFT JOIN account_legal_holds h ON h.user_id = u.id
        WHERE ${where}
        ORDER BY ${SEC('u.deleted_at')} ASC, u.id ASC LIMIT ? OFFSET ?`
    ).bind(limit + 1, (page - 1) * limit).all();
    const list = (rows?.results || []);
    const ms = (v) => parseTs(v);
    return H.json({
      mode: purgeMode(env),
      r2: String(env.ACCOUNT_PURGE_R2 || 'off'),
      graceDays: PURGE_GRACE_DAYS,
      items: list.slice(0, limit).map((r) => {
        const purgeAfter = purgeAfterMs(r.deleted_at);
        return {
          id: Number(r.id),
          // Purge'dan keyin email yo'q (tombstone) — faqat raqam.
          email: r.purged_at ? '' : String(r.email || ''),
          requestedAt: ms(r.deleted_at),
          purgeAfter,
          source: r.deletion_source || null,
          reviewed: !!r.purge_reviewed_at,
          blockedReason: r.purge_blocked_reason || null,
          nextAttemptAt: ms(r.purge_next_attempt_at),
          // Grace tugaganidan 14 kun o'tib hamon bloklangan — qo'lda hal qilish kerak.
          overdue: !!(r.purge_blocked_reason && purgeAfter && now - purgeAfter > 14 * DAY_MS),
          hold: r.hold_note != null ? { note: String(r.hold_note), at: ms(r.hold_at) } : null,
          purgedAt: ms(r.purged_at),
        };
      }),
      hasMore: list.length > limit,
    });
  }

  const m = path.match(/^\/api\/admin\/account-deletions\/(\d+)\/(restore|review|hold|purge)$/);
  if (!m) return H.json({ error: 'not_found' }, 404);
  const id = Number(m[1]);
  const action = m[2];
  const u = await loadUser(env, id).catch(() => null);
  if (!u || !u.deleted_at) return H.json({ error: 'not_found' }, 404);
  if (u.purged_at && action !== 'hold') return H.json({ error: 'already_purged' }, 409);

  if (action === 'restore' && method === 'POST') {
    const r = await env.DB.prepare(
      `UPDATE users SET deleted_at = NULL, deletion_source = NULL, purge_reviewed_at = NULL,
         purge_blocked_reason = NULL, purge_next_attempt_at = NULL
       WHERE id = ? AND purged_at IS NULL RETURNING id`
    ).bind(id).first();
    if (!r) return H.json({ error: 'already_purged' }, 409);
    await log('account_deletion_restored', `#${id}`);
    return H.json({ ok: true });
  }
  if (action === 'review' && method === 'POST') {
    await env.DB.prepare(`UPDATE users SET purge_reviewed_at = COALESCE(purge_reviewed_at, ?) WHERE id = ?`).bind(tsAt(now), id).run();
    await log('account_deletion_reviewed', `#${id}`);
    return H.json({ ok: true });
  }
  if (action === 'hold' && method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const note = String(body?.note || '').trim().slice(0, 300);
    if (!note) return H.json({ error: 'note_required' }, 422);
    await env.DB.prepare(
      `INSERT INTO account_legal_holds (user_id, note, set_by, set_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET note = excluded.note, set_by = excluded.set_by, set_at = excluded.set_at`
    ).bind(id, note, `admin#${Number(admin.adminId) || 0}`, tsAt(now)).run();
    await log('account_deletion_hold', `#${id}`);
    return H.json({ ok: true });
  }
  if (action === 'hold' && method === 'DELETE') {
    await env.DB.prepare(`DELETE FROM account_legal_holds WHERE user_id = ?`).bind(id).run();
    await log('account_deletion_unhold', `#${id}`);
    return H.json({ ok: true });
  }
  if (action === 'purge' && method === 'POST') {
    const body = await request.json().catch(() => ({}));
    if (body?.dryRun !== false) {
      const r = await purgeDeletedUser(env, H, id, { mode: 'dry-run', now });
      return H.json({ ok: true, dryRun: true, ...r });
    }
    // Qaytarilmas: faqat purge yoqilgan bo'lsa, aniq tasdiq bilan va
    // 30 kunlik muddat TUGAGANDAN keyin (egasining qarori — muddat hech
    // kim uchun qisqartirilmaydi). Bu tugma cron'ni kutmasdan xuddi shu
    // ishni bitta hisob uchun qiladi.
    if (purgeMode(env) !== 'on') return H.json({ error: 'purge_disabled' }, 409);
    if (String(body?.confirm || '') !== `PURGE #${id}`) return H.json({ error: 'confirm_required' }, 422);
    const after = purgeAfterMs(u.deleted_at);
    if (after === null || after > now) return H.json({ error: 'grace_not_over', purgeAfter: after }, 409);
    const held = await env.DB.prepare(`SELECT 1 AS x FROM account_legal_holds WHERE user_id = ?`).bind(id).first();
    if (held) return H.json({ error: 'legal_hold' }, 409);
    const r = await purgeDeletedUser(env, H, id, { mode: 'on', now });
    if (r.status === 'purged') await log('account_purged_manual', `#${id}`);
    return H.json({ ok: r.status === 'purged', ...r }, r.status === 'purged' ? 200 : 409);
  }
  return H.json({ error: 'method_not_allowed' }, 405);
}

// `hosting/worker.js` API_MODULES naqshi: har modul `handle()` eksport qiladi.
export const handle = handleAdmin;
