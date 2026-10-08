// hosting/api/content-guard.js — MODERATSIYA QO'RIQCHISI (2026-10).
//
// Bu modul faqat "g'isht"larni beradi — marshrut yo'q. worker.js, moderation.js,
// image-moderation.js va featured.js shu yerdan foydalanadi (bu modul ularning
// hech biridan import QILMAYDI — aylanma bog'liqlik bo'lmasin).
//
//   * PENDING — avtomatik tekshirilmagan (`content_reports` reason='unchecked',
//     status='new') media bilan chop etilgan post/istoriya `content_pending`
//     ga yoziladi va EGASIDAN boshqa hech kimga ko'rinmaydi. Admin
//     "Tasdiqlash" (yoki cron qayta tekshiruvi) qatorni o'chiradi.
//     Bitta kontentda bir nechta fayl bo'lishi mumkin (karusel) — har fayl
//     alohida qator; kontent HAMMA qatori o'chgandagina ochiladi.
//   * DELETED_UPLOADS — o'chirilgan kontent fayllari ro'yxati: `/uploads/*`
//     ularni CHEGARA KESHIDAN OLDIN 404 qiladi (rasm 1 yil `immutable`
//     keshlanadi — busiz o'chirilgan rasm havola orqali ochilaverardi).
//   * CONSENT_LOG — "qoidalarga roziman" (agreed:true) dalili: kim, qaysi
//     qoidalar versiyasi, qayerdan (ilova/sayt), qachon. IP YOZILMAYDI.
//   * TEXT_FLAG — juda aniq so'kinish/haqorat ro'yxati: BLOKLAMAYDI, faqat
//     admin "Shikoyatlar" navbatiga `reporter_ip='system'`, reason='text_flag'.
//   * Admin Telegram ogohlantirishlari (chastotasi cheklangan).
//
// Jadvallar `CREATE TABLE IF NOT EXISTS` — mavjud ma'lumotga tegilmaydi.

export const RULES_VERSION = '2026-10';
export const MODERATION_UNAVAILABLE = {
  error: 'moderation_unavailable',
  message: "Tekshiruv vaqtincha ishlamayapti. Birozdan keyin qayta urinib ko'ring.",
};

// Kesh kaliti — baza obyekti (testlarda har env o'z bazasi bilan). UZ bazasi
// adapteri isolate ichida bitta — umumiy kalit.
const UZ_KEY = {};
const keyOf = (env) => (env?.UZ_STORE_ACTIVE ? UZ_KEY : (env?.DB || UZ_KEY));
const nowTs = () => new Date().toISOString().replace('T', ' ').replace('Z', '+00');
const inList = (n) => Array(n).fill('?').join(',');

// `content_reports` — moderation.js bilan AYNAN bir DDL (u shu konstantani
// ishlatadi). Navbatga yozuvchi joylar jadvalni o'zi yaratadi: jadval yo'qligi
// sababli "tekshirilmagan" fayl jim o'tib ketmasin.
export const REPORTS_TABLE_SQL = `CREATE TABLE IF NOT EXISTS "content_reports" (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        target_kind TEXT NOT NULL,
        target_id TEXT NOT NULL,
        owner_code TEXT NOT NULL DEFAULT '',
        reporter_id INTEGER,
        reporter_ip TEXT NOT NULL DEFAULT '',
        reason TEXT NOT NULL,
        note TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'new',
        created_at TEXT NOT NULL,
        resolved_at TEXT,
        resolved_by TEXT NOT NULL DEFAULT ''
      )`;
let reportsReady = new WeakMap();
export function ensureReportsTable(env) {
  const k = keyOf(env);
  let p = reportsReady.get(k);
  if (!p) {
    p = env.DB.prepare(REPORTS_TABLE_SQL).run().catch((e) => { reportsReady.delete(k); throw e; });
    reportsReady.set(k, p);
  }
  return p;
}

let schema = new WeakMap();
export function ensureGuardSchema(env) {
  const k = keyOf(env);
  let p = schema.get(k);
  if (!p) {
    p = env.DB.batch([
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS content_pending (
        kind TEXT NOT NULL,
        id INTEGER NOT NULL,
        url TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (kind, id, url)
      )`),
      env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_content_pending_url ON content_pending(url)`),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS deleted_uploads (
        url TEXT PRIMARY KEY NOT NULL,
        deleted_at TEXT NOT NULL
      )`),
      env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_deleted_uploads_time ON deleted_uploads(deleted_at)`),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS consent_log (
        id INTEGER PRIMARY KEY,
        user_id INTEGER NOT NULL,
        kind TEXT NOT NULL,
        rules_version TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        UNIQUE (user_id, kind, rules_version)
      )`),
    ]).catch((e) => { schema.delete(k); throw e; });
    schema.set(k, p);
  }
  return p;
}
export function __resetGuardCaches() {
  schema = new WeakMap();
  reportsReady = new WeakMap();
  denyCache = new WeakMap();
  alertMem.clear();
}

// ═══ PENDING ═════════════════════════════════════════════════════════

// `kind`: 'post' | 'company_post' | 'story' (istoriya id'si shaxsiy va
// kompaniya uchun yagona). `idExpr` — SQL ifodasi (masalan `p.id`).
export const pendingSql = (kind, idExpr) =>
  `EXISTS (SELECT 1 FROM content_pending cpd WHERE cpd.kind = '${kind}' AND cpd.id = ${idExpr})`;

const UPLOAD_URL_RE = /^\/uploads\/[A-Za-z0-9][A-Za-z0-9._-]{0,200}$/;

/// Kontentdagi o'zimizning fayllar (rasm, video, karusel).
export function uploadUrlsOf({ imageUrl, videoUrl, mediaJson } = {}) {
  const out = new Set();
  for (const u of [imageUrl, videoUrl]) if (u && UPLOAD_URL_RE.test(String(u))) out.add(String(u));
  if (mediaJson) {
    try {
      const list = typeof mediaJson === 'string' ? JSON.parse(mediaJson) : mediaJson;
      if (Array.isArray(list)) {
        for (const m of list) {
          const u = String(m?.url || '');
          if (UPLOAD_URL_RE.test(u)) out.add(u);
        }
      }
    } catch { /* buzuq JSON — faqat asosiy maydonlar */ }
  }
  return [...out].slice(0, 20);
}

/// Chop etilgan kontent tekshirilmagan faylga tayanadimi — tayansa
/// `content_pending` ga yoziladi. Post raqami qayta ishlatiladi, shuning
/// uchun shu (kind,id) ning eski qatorlari avval o'chadi. → pending bool.
export async function markPendingIfUnchecked(env, kind, id, urls) {
  const list = [...new Set((urls || []).filter((u) => UPLOAD_URL_RE.test(String(u))))].slice(0, 20);
  try {
    await ensureGuardSchema(env);
    const stmts = [env.DB.prepare(`DELETE FROM content_pending WHERE kind = ? AND id = ?`).bind(kind, Number(id))];
    if (list.length) {
      stmts.push(env.DB.prepare(
        `INSERT OR IGNORE INTO content_pending (kind, id, url, created_at)
         SELECT ?, ?, r.target_id, ? FROM content_reports r
          WHERE r.target_kind = 'media' AND r.reason = 'unchecked' AND r.status = 'new'
            AND r.target_id IN (${inList(list.length)})`
      ).bind(kind, Number(id), new Date().toISOString(), ...list));
    }
    await env.DB.batch(stmts);
    if (!list.length) return false;
    const row = await env.DB.prepare(`SELECT 1 AS x FROM content_pending WHERE kind = ? AND id = ? LIMIT 1`)
      .bind(kind, Number(id)).first();
    return !!row;
  } catch {
    return false;
  }
}

/// Admin fayl "toza" dedi (yoki qayta tekshiruv o'tkazdi) — shu faylga
/// bog'langan kutishlar ochiladi.
export async function clearPendingUrl(env, url) {
  try {
    await ensureGuardSchema(env);
    await env.DB.prepare(`DELETE FROM content_pending WHERE url = ?`).bind(String(url)).run();
  } catch { /* jadval yo'q — kutish ham yo'q */ }
}

export function pendingDeleteStmt(env, kind, id) {
  return env.DB.prepare(`DELETE FROM content_pending WHERE kind = ? AND id = ?`).bind(kind, Number(id));
}

/// Kontent kutishdami (featured, post sahifasi).
export async function isPending(env, kind, id) {
  try {
    const row = await env.DB.prepare(`SELECT 1 AS x FROM content_pending WHERE kind = ? AND id = ? LIMIT 1`)
      .bind(kind, Number(id)).first();
    return !!row;
  } catch { return false; }
}

// ═══ BEGONA FAYL (foreign_media) ═════════════════════════════════════
//
// Post/istoriya/kompaniya posti/istoriyasi/ko'rgazma istalgan mavjud
// `/uploads/...` faylini qabul qilardi — boshqa odam yuklagan rasmni ham
// (masalan, tekshiruvdan o'tmagan yoki egasi o'chirmoqchi bo'lgan fayl).
// Yuklashda R2 obyektiga `customMetadata.actor` yoziladi (`user:<id|email>`
// yoki `admin:<rol>`, worker.js uploadApi). Chop etishda HAR YANGI fayl
// uchun bitta HEAD (parallel):
//   * `admin:*` yoki o'zining `user:<id>` / `user:<email>` — ruxsat;
//   * metama'lumot/actor yo'q yoki HEAD xatosi — ruxsat (eski fayllar);
//   * boshqa `user:*` — faqat egasining O'Z mavjud kontentida ishlatilgan
//     bo'lsa ruxsat, aks holda 403 `foreign_media`.
export const FOREIGN_MEDIA = {
  error: 'foreign_media',
  message: "Bu faylni ishlatib bo'lmaydi. O'zingiz yuklagan rasm yoki videoni tanlang.",
};
// Bitta kontentdagi fayllar soni karusel chegarasidan (10) oshmaydi.
export const FOREIGN_CHECK_MAX = 10;

function actorIsMine(actor, user) {
  const a = String(actor || '').trim();
  if (!a || a.startsWith('admin:')) return true;
  if (user?.id != null && a === `user:${user.id}`) return true;
  const email = String(user?.email || '').trim().toLowerCase();
  return !!email && a.toLowerCase() === `user:${email}`;
}

// Fayl egasining O'Z mavjud kontentida turibdimi (post, kompaniya posti,
// istoriya, Aktual). Jadval yo'q — o'tkazib yuboriladi; boshqa xato — "yo'q".
async function usedInOwnContent(env, userId, url) {
  const uid = String(userId);
  const checks = [
    [`SELECT 1 AS x FROM posts p WHERE (CAST(p.user_id AS TEXT) = ? OR p.code IN (SELECT c.code FROM cards c WHERE CAST(c.user_id AS TEXT) = ?))
        AND (p.image_url = ? OR p.video_url = ? OR instr(COALESCE(p.media_json, ''), ?) > 0) LIMIT 1`, [uid, uid, url, url, url]],
    [`SELECT 1 AS x FROM company_posts cp JOIN companies co ON co.company_id = cp.company_id
       WHERE CAST(co.owner_user_id AS TEXT) = ?
         AND (cp.image_url = ? OR cp.video_url = ? OR instr(COALESCE(cp.media_json, ''), ?) > 0) LIMIT 1`, [uid, url, url, url]],
    [`SELECT 1 AS x FROM stories s
       WHERE (s.image_url = ? OR s.video_url = ?)
         AND ((s.owner_kind = 'card' AND EXISTS (SELECT 1 FROM cards c WHERE c.code = s.owner_id AND CAST(c.user_id AS TEXT) = ?))
           OR (s.owner_kind = 'company' AND EXISTS (SELECT 1 FROM companies co WHERE co.company_id = s.owner_id AND CAST(co.owner_user_id AS TEXT) = ?)))
       LIMIT 1`, [url, url, uid, uid]],
    [`SELECT 1 AS x FROM story_highlight_items i JOIN story_highlights h ON h.id = i.highlight_id
       WHERE CAST(h.user_id AS TEXT) = ? AND (i.image_url = ? OR i.video_url = ?) LIMIT 1`, [uid, url, url]],
  ];
  for (const [sql, binds] of checks) {
    try {
      if (await env.DB.prepare(sql).bind(...binds).first()) return true;
    } catch { /* jadval yo'q yoki xato — keyingisi */ }
  }
  return false;
}

/// Begona (boshqa foydalanuvchi yuklagan) fayllar ro'yxati — bo'sh bo'lsa
/// ruxsat. Hech qachon tashlamaydi.
export async function foreignMediaUrls(env, user, urls) {
  try {
    const list = [...new Set((urls || []).map(String).filter((u) => UPLOAD_URL_RE.test(u)))].slice(0, FOREIGN_CHECK_MAX);
    if (!list.length || !user || typeof env?.UPLOADS?.head !== 'function') return [];
    const actors = await Promise.all(list.map((u) => Promise.resolve()
      .then(() => env.UPLOADS.head(u.slice(1)))
      .then((obj) => obj?.customMetadata?.actor || '', () => '')));
    const suspect = list.filter((_, i) => !actorIsMine(actors[i], user));
    if (!suspect.length) return [];
    const used = await Promise.all(suspect.map((u) => usedInOwnContent(env, user.id, u)));
    return suspect.filter((_, i) => !used[i]);
  } catch {
    return [];
  }
}

// ═══ ROZILIK DALILI ══════════════════════════════════════════════════

export function rulesVersionOf(body) {
  const v = String(body?.rulesVersion ?? '').replace(/[^A-Za-z0-9._-]/g, '').slice(0, 20);
  return v || RULES_VERSION;
}

/// `agreed:true` bilan muvaffaqiyatli chop etishda — bir foydalanuvchi va
/// versiya uchun bitta qator (INSERT OR IGNORE). Xatosi yutiladi.
export async function logConsent(env, request, userId, body) {
  if (!userId || !(body?.agreed === true || body?.agreed === 'true')) return;
  try {
    await ensureGuardSchema(env);
    const source = request?.headers?.get?.('x-app') === 'nova' ? 'app' : 'web';
    await env.DB.prepare(
      `INSERT OR IGNORE INTO consent_log (user_id, kind, rules_version, source, created_at) VALUES (?, 'content_rules', ?, ?, ?)`
    ).bind(Number(userId), rulesVersionOf(body), source, new Date().toISOString()).run();
  } catch { /* dalil yozilmasa ham chop etish bekor qilinmaydi */ }
}

// ═══ MATNDAGI SO'KINISH (BLOKLAMAYDI) ════════════════════════════════
//
// Ro'yxat ATAYLAB qisqa va aniq: oddiy so'zlarning ichida uchramaydigan
// ildizlar, so'z BOSHIDAN (oldida harf/raqam bo'lmasligi shart — kirill
// harflari bilan ham ishlaydi, `\b` esa faqat lotin uchun). Shubhali va
// ko'p ma'noli so'zlar (masalan "amin", "sik" yolg'iz) yo'q.
const STEMS = [
  // o'zbekcha (lotin)
  'jalab', 'qanjiq', 'dalbayob', 'sik(?:aman|ib|ay|dim|ish|tir)',
  // o'zbekcha (kirill)
  'жалаб', 'қанжиқ', 'канжик', 'далбаёб', 'сик(?:аман|иб|ай|дим|иш|тир)',
  // ruscha
  'хуй', 'хуя', 'хуе[влнс]', 'пизд', 'еба[нлт]', 'ебу[чт]', 'бля[дт]', 'мудак', 'пид[оа]р', 'гандон', 'залуп', 'шлюх', 'долбое?б',
  // inglizcha
  'fuck', 'motherfuck', 'cunts?(?![\\p{L}])', 'nigg(?:ers?|as?)(?![\\p{L}])', 'faggot',
];
const PROFANITY_RE = new RegExp(`(?<![\\p{L}\\p{N}_])(?:${STEMS.join('|')})`, 'iu');

/// Mos kelgan so'z (yoki `null`).
export function textFlagMatch(text) {
  const s = String(text || '').toLowerCase().replace(/ё/g, 'е');
  if (!s) return null;
  const m = PROFANITY_RE.exec(s);
  return m ? m[0] : null;
}

const TEXT_FLAG_PER_OWNER_DAY = 20;

/// Matnda so'kinish bo'lsa — admin navbatiga (`text_flag`). Bir nishon
/// bir marta; bitta egadan sutkada 20 tadan ko'p emas. Hech qachon xato
/// tashlamaydi. → navbatga yozildimi.
export async function flagText(env, { kind, id, text, ownerCode = '' }) {
  const hit = textFlagMatch(text);
  if (!hit || !kind || id == null || id === '') return false;
  try {
    await ensureReportsTable(env);
    const now = nowTs();
    const dayAgo = new Date(Date.now() - 86_400_000).toISOString().replace('T', ' ').replace('Z', '+00');
    const owner = String(ownerCode || '').toUpperCase().slice(0, 40);
    const res = await env.DB.prepare(
      `INSERT INTO content_reports
         (target_kind, target_id, owner_code, reporter_id, reporter_ip, reason, note, status, created_at)
       SELECT ?, ?, ?, NULL, 'system', 'text_flag', ?, 'new', ?
        WHERE NOT EXISTS (SELECT 1 FROM content_reports WHERE target_kind = ? AND target_id = ? AND reason = 'text_flag')
          AND (SELECT COUNT(*) FROM content_reports WHERE reason = 'text_flag' AND owner_code = ? AND created_at > ?) < ?`
    ).bind(kind, String(id), owner, `Avtomatik: matnda "${hit}"`.slice(0, 200), now,
      kind, String(id), owner, dayAgo, TEXT_FLAG_PER_OWNER_DAY).run();
    return Number(res?.meta?.changes || 0) > 0;
  } catch {
    return false;
  }
}

// ═══ O'CHIRILGAN FAYLLAR (deleted_uploads) ═══════════════════════════

const DENY_TTL_MS = 60_000;
let denyCache = new WeakMap();

function denyState(env) {
  const k = keyOf(env);
  let st = denyCache.get(k);
  if (!st) { st = { set: new Set(), last: '', at: 0 }; denyCache.set(k, st); }
  return st;
}

/// Bu fayl o'chirilgan kontentnikimi. Isolate keshi 60 s da bir marta
/// FAQAT yangi qatorlar bilan to'ldiriladi (butun jadval qayta o'qilmaydi).
/// Baza xatosi — "yo'q" (fayl avvalgidek beriladi).
export async function uploadDenied(env, pathname) {
  const st = denyState(env);
  const now = Date.now();
  if (now - st.at > DENY_TTL_MS) {
    st.at = now;
    try {
      const rows = await env.DB.prepare(
        `SELECT url, deleted_at FROM deleted_uploads WHERE deleted_at >= ? ORDER BY deleted_at LIMIT 20000`
      ).bind(st.last).all();
      for (const r of rows?.results || []) {
        st.set.add(String(r.url));
        if (String(r.deleted_at) > st.last) st.last = String(r.deleted_at);
      }
    } catch { /* jadval hali yo'q — bo'sh */ }
  }
  return st.set.has(String(pathname));
}

// Fayl hali boshqa joyda ishlatilmoqdami (egasining o'chirishida bitta fayl
// boshqa post/istoriya/Aktualda turgan bo'lishi mumkin). Xato — "ha".
async function urlStillUsed(env, url) {
  const checks = [
    [`SELECT 1 AS x FROM posts WHERE image_url = ? OR video_url = ? OR instr(COALESCE(media_json, ''), ?) > 0 LIMIT 1`, 3],
    [`SELECT 1 AS x FROM company_posts WHERE image_url = ? OR video_url = ? OR instr(COALESCE(media_json, ''), ?) > 0 LIMIT 1`, 3],
    [`SELECT 1 AS x FROM stories WHERE image_url = ? OR video_url = ? LIMIT 1`, 2],
    [`SELECT 1 AS x FROM story_highlight_items WHERE image_url = ? OR video_url = ? LIMIT 1`, 2],
    [`SELECT 1 AS x FROM story_highlights WHERE cover_url = ? LIMIT 1`, 1],
  ];
  for (const [sql, n] of checks) {
    try {
      if (await env.DB.prepare(sql).bind(...Array(n).fill(url)).first()) return true;
    } catch (e) {
      if (/no such table/i.test(String(e?.message || e))) continue;
      return true;
    }
  }
  return false;
}

export function edgeKeysFor(url, origins) {
  return origins.map((o) => `${o}${url}`);
}

async function purgeEdge(env, url) {
  if (typeof caches === 'undefined' || !caches.default) return;
  const origins = [...new Set([env?.PUBLIC_ORIGIN, 'https://nfcstore.uz', 'https://www.nfcstore.uz'].filter(Boolean))];
  for (const k of edgeKeysFor(url, origins)) {
    await caches.default.delete(new Request(k, { method: 'GET' })).catch(() => {});
  }
}

/// O'chirilgan kontent fayllarini ro'yxatga yozadi. `onlyUnreferenced` —
/// egasining o'chirishi: fayl boshqa joyda ishlatilsa yozilmaydi. Admin
/// o'chirishida — shartsiz. Fayllarning O'ZI o'chirilmaydi.
export async function denyUploads(env, urls, { onlyUnreferenced = false } = {}) {
  const list = [...new Set((urls || []).map(String).filter((u) => UPLOAD_URL_RE.test(u)))].slice(0, 40);
  if (!list.length) return 0;
  let n = 0;
  try {
    await ensureGuardSchema(env);
    const at = new Date().toISOString();
    const st = denyState(env);
    for (const u of list) {
      if (onlyUnreferenced && await urlStillUsed(env, u)) continue;
      await env.DB.prepare(`INSERT OR IGNORE INTO deleted_uploads (url, deleted_at) VALUES (?, ?)`).bind(u, at).run();
      st.set.add(u);
      n++;
      await purgeEdge(env, u);
    }
  } catch (e) {
    console.error('denyUploads', String(e?.message || e).slice(0, 120));
  }
  return n;
}

/// Kontent qatoridagi fayllar (o'chirishdan OLDIN o'qiladi). Xato — [].
export async function contentUrls(env, table, where, binds) {
  const withMedia = table === 'posts' || table === 'company_posts';
  const sqls = withMedia
    ? [`SELECT image_url, video_url, media_json FROM ${table} WHERE ${where}`, `SELECT image_url, video_url FROM ${table} WHERE ${where}`]
    : [`SELECT image_url, video_url FROM ${table} WHERE ${where}`];
  for (const sql of sqls) {
    try {
      const rows = await env.DB.prepare(sql).bind(...binds).all();
      return (rows?.results || []).flatMap((r) => uploadUrlsOf({ imageUrl: r.image_url, videoUrl: r.video_url, mediaJson: r.media_json }));
    } catch { /* keyingi variant */ }
  }
  return [];
}

// ═══ ADMIN TELEGRAM OGOHLANTIRISHLARI ════════════════════════════════

let notifier = null;
/// worker.js modul yuklanganda beradi (`sendTelegramMessage`).
export function setAdminNotifier(fn) { notifier = typeof fn === 'function' ? fn : null; }

const alertMem = new Map();

// `key` — admin_settings kaliti (oxirgi xabar vaqti). Avval isolate
// xotirasi, keyin baza belgisi — ikkalasi ham oraliqni ushlaydi.
async function alertOnce(env, key, intervalMs, makeText) {
  const now = Date.now();
  const mem = alertMem.get(key) || 0;
  if (now - mem < intervalMs) return false;
  alertMem.set(key, now);
  try {
    const row = await env.DB.prepare(`SELECT value FROM admin_settings WHERE key = ?`).bind(key).first();
    const last = Date.parse(String(row?.value || ''));
    if (Number.isFinite(last) && now - last < intervalMs) { alertMem.set(key, last); return false; }
    await env.DB.prepare(
      `INSERT INTO admin_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    ).bind(key, new Date(now).toISOString()).run();
  } catch { /* belgi yozilmasa ham isolate oralig'i ishlaydi */ }
  const text = await makeText();
  if (notifier && text) await Promise.resolve(notifier(env, text)).catch(() => {});
  return true;
}

export const UNCHECKED_ALERT_MS = 30 * 60_000;
export const MODERATION_OFF_ALERT_MS = 6 * 60 * 60_000;

export function alertUncheckedQueued(env) {
  return alertOnce(env, 'alert_unchecked_at', UNCHECKED_ALERT_MS, async () => {
    let n = 0;
    try {
      const r = await env.DB.prepare(
        `SELECT COUNT(*) AS n FROM content_reports WHERE target_kind = 'media' AND reason = 'unchecked' AND status = 'new'`
      ).first();
      n = Number(r?.n) || 0;
    } catch { /* son noma'lum */ }
    return `Tekshirilmagan yuklamalar navbatda: ${n} ta.\nAdmin → Shikoyatlar ("Avtomatik tekshirilmagan").`;
  }).catch(() => false);
}

export function alertModerationOff(env) {
  return alertOnce(env, 'alert_moderation_off_at', MODERATION_OFF_ALERT_MS,
    async () => "Avtomatik moderatsiya ishlamayapti (GEMINI_API_KEY yo'q yoki MODERATION_OFF=1). Yangi rasm/videolar admin tasdig'igacha yashirin turadi.")
    .catch(() => false);
}

// ═══ KUNLIK CRON XULOSASI (worker.js `scheduled`) ════════════════════
//
// Filtr o'chiq (kalit yo'q yoki MODERATION_OFF=1) bo'lsa — `alertModerationOff`
// (yuklash bo'lmagan kunlarda ham admin bilsin). Navbatda tekshirilmagan
// fayl yoki yashirin (pending) kontent bo'lsa — kuniga BITTA xulosa
// ("Tekshiruv kutilmoqda: N ta"), `admin_settings.alert_daily_review_at`
// belgisi bilan cheklangan. Hech qachon tashlamaydi.
export const DAILY_REVIEW_ALERT_MS = 20 * 60 * 60_000;

export async function openReviewCounts(env) {
  const out = { unchecked: 0, pending: 0 };
  try {
    const r = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM content_reports WHERE target_kind = 'media' AND reason = 'unchecked' AND status = 'new'`
    ).first();
    out.unchecked = Number(r?.n) || 0;
  } catch { /* jadval yo'q */ }
  try {
    const r = await env.DB.prepare(`SELECT COUNT(*) AS n FROM (SELECT DISTINCT kind, id FROM content_pending)`).first();
    out.pending = Number(r?.n) || 0;
  } catch { /* jadval yo'q */ }
  return out;
}

export async function cronModerationAlerts(env, { moderationOn = true } = {}) {
  const out = { moderationOffAlert: false, digest: false, unchecked: 0, pending: 0 };
  try {
    if (!moderationOn) out.moderationOffAlert = await alertModerationOff(env);
    Object.assign(out, await openReviewCounts(env));
    const n = Math.max(out.unchecked, out.pending);
    if (n > 0) {
      out.digest = await alertOnce(env, 'alert_daily_review_at', DAILY_REVIEW_ALERT_MS, async () =>
        `Tekshiruv kutilmoqda: ${n} ta.\n`
        + `Tekshirilmagan fayllar: ${out.unchecked} ta; yashirin kontent: ${out.pending} ta.\n`
        + `Admin → Shikoyatlar ("Avtomatik tekshirilmagan").`).catch(() => false);
    }
  } catch { /* xulosa yuborilmasa ham cron davom etadi */ }
  return out;
}
