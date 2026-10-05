// hosting/api/scheduled-posts.js — REJALASHTIRILGAN POSTLAR (2026-10).
//
// ═══ NIMA UCHUN BOR ═══
//
// Biznes egasi postni oldindan tayyorlab, "ertaga 09:00 da chiqsin"
// deb qo'ya olishi kerak (Instagram'dagi "Schedule"). Post DARHOL
// yoziladi (rasm yuklangan, matn tayyor), lekin `publish_at` kelguncha
// uni EGASIDAN BOSHQA HECH KIM ko'rmaydi: lenta, profil, kompaniya
// sahifasi, sanoqlar, izoh/layk/ko'rish, ko'tarish (featured),
// /post/:id sahifasi — hammasi.
//
// ═══ QOIDA BITTA JOYDA ═══
//
// "Post jonlimi" sharti shu fayldagi `postLiveSql` / `companyPostLiveSql`
// dan olinadi. Har so'rovda o'zicha yozilsa, qaysidir biri unutilib,
// rejadagi post vaqtidan oldin ommaga chiqib ketardi (egasi uchun bu
// "sir" bo'lishi mumkin: aksiya e'loni, yangi mahsulot).
//
// ═══ VAQT FORMATI ═══
//
// `publish_at` jadvalning o'z `created_at` formatida saqlanadi — lenta
// `COALESCE(publish_at, created_at)` bo'yicha saralaydi va formatlar bir
// xil bo'lsa satr solishtiruvi to'g'ri ishlaydi:
//   posts          — `CURRENT_TIMESTAMP` shakli: "YYYY-MM-DD HH:MM:SS"
//   company_posts  — ISO: "YYYY-MM-DDTHH:MM:SS.sssZ"
// "Hozir" SQL ichida olinadi (`datetime('now')`), bind emas: shunda
// mavjud so'rovlarning `?` tartibi o'zgarmaydi (lenta UNIONi ikki joyda
// ishlatiladi) va D1 ham, sqld ham bir xil hisoblaydi.
//
// Ustunlar (`publish_at`, `media_json`) `ADD COLUMN` bilan qo'shiladi —
// worker.js `ensurePostSocialColumnsD1`. Eski qatorlarda NULL = "darhol
// chiqqan", ya'ni mavjud postlarga hech narsa o'zgarmaydi.

export const PUBLISH_MAX_DAYS = 30;
const DAY_MS = 86_400_000;

const POSTS_NOW_SQL = `datetime('now')`;
const COMPANY_POSTS_NOW_SQL = `strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`;

/// Shaxsiy post jonli (yoki rejasiz) — `a` — `posts` jadvali taxallusi.
export const postLiveSql = (a) => `(${a}.publish_at IS NULL OR ${a}.publish_at <= ${POSTS_NOW_SQL})`;
/// Kompaniya posti jonli — `a` — `company_posts` taxallusi.
export const companyPostLiveSql = (a) => `(${a}.publish_at IS NULL OR ${a}.publish_at <= ${COMPANY_POSTS_NOW_SQL})`;
/// Tur bo'yicha (izoh/layk turlari: 'post' | 'company_post').
export const liveSqlFor = (kind, a) => (kind === 'company_post' ? companyPostLiveSql(a) : postLiveSql(a));

/// Lentada va ro'yxatlarda ko'rinadigan vaqt — reja bo'lsa o'sha vaqt:
/// post jonlanganda "yangi" bo'lib chiqadi, yaratilgan kunida emas.
export const effectiveTimeSql = (a) => `COALESCE(${a}.publish_at, ${a}.created_at)`;

/// `posts` formatidagi vaqt ("YYYY-MM-DD HH:MM:SS").
export const postsTs = (ms) => new Date(ms).toISOString().slice(0, 19).replace('T', ' ');
/// `company_posts` formatidagi vaqt (ISO).
export const companyPostsTs = (ms) => new Date(ms).toISOString();

/// So'rovdagi `publishAt` ni tekshiradi.
///   yo'q / null / ''           → { ok: true, ms: null }  (darhol chiqadi)
///   yaroqsiz                   → { ok: false, error: 'bad_publish_at' }
///   o'tgan yoki hozirgi vaqt   → { ok: false, error: 'publish_at_past' }
///   30 kundan uzoq             → { ok: false, error: 'publish_at_too_far' }
/// Qabul qilinadi: ISO satr (vaqt mintaqasi bilan) yoki ms (son).
export function parsePublishAt(value, nowMs = Date.now()) {
  if (value === undefined || value === null || value === '') return { ok: true, ms: null };
  let ms = NaN;
  if (typeof value === 'number') ms = value;
  else if (typeof value === 'string' && value.length <= 40) ms = Date.parse(value.trim());
  if (!Number.isFinite(ms)) return { ok: false, error: 'bad_publish_at' };
  // Soniyadan kichik qismi tashlanadi — `posts` formatida saqlanmaydi,
  // ikki jadval bir xil vaqtni ko'rsatsin.
  ms = Math.floor(ms / 1000) * 1000;
  if (ms <= nowMs) return { ok: false, error: 'publish_at_past' };
  if (ms > nowMs + PUBLISH_MAX_DAYS * DAY_MS) return { ok: false, error: 'publish_at_too_far', maxDays: PUBLISH_MAX_DAYS };
  return { ok: true, ms };
}

/// Bazadagi `publish_at` → ms, faqat KELAJAKDA bo'lsa (ya'ni hali
/// rejada). Jonlangan yoki rejasiz post uchun null.
export function scheduledForMs(publishAt, nowMs = Date.now()) {
  if (!publishAt) return null;
  let s = String(publishAt).trim();
  if (/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(s)) s = `${s.replace(' ', 'T')}Z`;
  const ms = Date.parse(s);
  return Number.isFinite(ms) && ms > nowMs ? ms : null;
}
