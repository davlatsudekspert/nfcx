// hosting/api/reels.js — REELS "SIZ UCHUN" (Instagram kabi tartib, 2026-10).
//
// ═══ NIMA UCHUN BOR ═══
//
// Ilovadagi Reels tabi reels'ni `/api/feed` ning 1-sahifasidan olardi:
// hammaga BIR XIL tartib (eng yangisi tepada), ko'rilgan reels qayta-qayta
// chiqadi, sahifalash yo'q. Bu modul — alohida, SARALANGAN va sahifalanadigan
// lenta. `/api/feed` ga TEGILMAYDI.
//
// ═══ SO'ROVLAR ═══
//
//   GET  /api/reels?limit=10&cursor=<shaffof satr>   (kirish ixtiyoriy)
//        -> { items: [post], nextCursor: string|null, hasMore: bool }
//        `items` — `/api/feed` kadrlari bilan AYNAN bir shakl
//        (`shapeFeedRows` + `liked`), reklama qo'shimcha `featured: true`.
//        `limit` 1..20 (standart 10).
//   GET  /api/showcase/ads?video=1&limit=4 — Asosiy ekran reklama kartochkasi:
//        faqat admin joylari (1–4), slot tartibida, kursorsiz.
//   GET  /api/showcase?limit=10&cursor=…  — KO'RGAZMA (2026-10): xuddi shu
//        tartib, faqat videosiz `showcase=1` yoki rasmli reel kadrlar;
//        javob { items, hasMore, cursor, nextCursor }.
//   POST /api/reels/hide  { kind: 'post'|'company_post', id }  (kirish shart)
//        -> { ok: true }  — "Qiziq emas": shu reels bu odamga boshqa chiqmaydi.
//        Idempotent. Kirmagan — 401, yomon nishon — 422 `bad_target`.
//
// ═══ NIMA REELS HISOBLANADI ═══
//
// Shaxsiy va kompaniya POSTI, videosi bor YOKI rasmli reel belgisi bor
// (`post_extras.reel = 1`, api/music.js). Istoriya — hech qachon. Ko'rinish
// qoidalari lentaning O'ZIDAN (`FEED_UNION_SQL`): yashirin profil, o'chirilgan
// egasi, faol bo'lmagan/namuna kompaniya, rejadagi post bu yerga tushmaydi.
// Bloklangan muallif va "qiziq emas" deyilgan reels chiqarib tashlanadi.
//
// ═══ BALL (formula) ═══
//
//   ageHours   = (snapshot − created_at) / 1 soat
//   freshness  = 0.5 ^ (ageHours / FRESH_HALF_LIFE_H)            (36 soatda yarmi)
//   engagement = ln(1 + likes + 2·comments + 3·saves + 0.05·views)
//   score      = freshness · (1 + ENGAGEMENT_WEIGHT · engagement)
//   × FOLLOW_BOOST (1.8)  — tomoshabin muallifga obuna (`follows` karta
//                           EGASI bo'yicha yoki `company_follows`);
//   × SEEN_PENALTY (0.12) — tomoshabin allaqachon ko'rgan (`content_views`);
//   × OWN_PENALTY  (0.35) — o'zining reels'i;
//   × (1 + jitter), jitter ∈ [0, JITTER_MAX) — hash(tomoshabin + kun + nishon):
//     bir kunda barqaror, odamdan odamga farq qiladi (tenglar aralashadi).
//   `views` — qamrov (necha kishi ko'rgan, `content_views`), chunki u
//   vaqt bo'yicha kesiladi (pastga qarang); jami `SUM(hits)` kunlik qator.
//
// ═══ XILMA-XILLIK ═══
//
// Tartib ochko'z (greedy) yig'iladi: bir muallif ikki qo'shni o'rinda
// turmaydi va istalgan `w` ta ketma-ket oddiy kadrda bir muallifdan
// AUTHOR_MAX_PER_PAGE (2) tadan ko'p emas (`w` — zanjirning 1-sahifasidagi
// `limit`). Sirpanuvchi oyna: sahifa chegarasi qayerda bo'lmasin, bitta
// sahifada 2 tadan oshmaydi. Shart bajarib bo'lmasa (mualliflar tugadi) —
// avval faqat "qo'shni emas", keyin shartsiz: hech narsa yo'qolmaydi.
//
// ═══ REKLAMA ═══
//
// Faol pullik nishonlar (`featured.js activeTargets`), reels bo'lsa va
// hamma filtrdan o'tsa, har sahifaning 4 va 9-o'rniga (0 dan) qo'yiladi:
// 0-o'rinda hech qachon, sahifada 2 tagacha, zanjirda har biri BIR marta.
// Zanjir boshidagi faol nishonlar (`x`) oddiy tartibdan BUTUNLAY chiqariladi —
// keyingi sahifada reklama bo'lib chiqqan post oldin oddiy kadr bo'lib
// takrorlanmasin.
//
// KO'RGAZMA REKLAMASI (2026-10, api/showcase-ads.js) — faqat `/api/showcase`:
// admin tanlagan 4 tagacha joy AYNAN shu qoidada (o'rinlar, sahifa chegarasi,
// `x`/`a` kursorda). Joylar navbatda OLDIN (slot tartibida), keyin featured.
// Joydagi post VIDEO bo'lishi mumkin — `SHOWCASE_SQL` ning yagona istisnosi,
// faqat shu yo'l bilan; oddiy videoli kadr Ko'rgazmaga baribir tushmaydi.
// Lenta qisqa bo'lib oddiy kadrlar 4-o'ringacha yetmasa, reklama oxirgi
// oddiy kadrdan keyin turadi (sahifa chegarasi o'sha-o'sha; bo'sh sahifada
// yoki 0-o'rinda — hech qachon). Javobda `featured: true, ad: true, adSlot`.
// VIDEO reklama faqat `?video=1` so'rovida (yangi ilova); eski ilovaga — yo'q.
//
// ═══ BARQAROR SAHIFALASH ═══
//
// Birinchi so'rov "surat" vaqtini (`s`) oladi. Kursor — base64url JSON:
//   { v:1, s: surat ms, o: oddiy tartibdagi o'rin, k: oxirgi 3 kadr kaliti,
//     w: xilma-xillik oynasi, a: berilgan reklamalar, x: oddiydan chiqarilganlar }
// Keyingi sahifalar tartibni QAYTA hisoblaydi, lekin faqat surat vaqtigacha
// yaratilgan reels, ko'rishlar, layk/izoh/saqlash, obuna va "qiziq emas"
// bilan — sahifalar siljimaydi, takror ham, tushib qolish ham yo'q. Suratdan
// keyingi "qiziq emas" tartibni o'zgartirmaydi, faqat javobdan olib tashlanadi.
// `k` — o'rin langari: oldingi kadr(lar) o'chirilsa ham davom joyi topiladi
// (uchalasi ham yo'qolsa — `o`).
// Buzuq/eskirgan kursor — kursorsiz so'rov (hech qachon 500 emas).
//
// ═══ TEZLIK ═══
//
// 3 ta ketma-ket to'lqin: (1) sessiya + nomzodlar (eng yangi POOL_SIZE reels)
// + faol reklamalar; (2) nomzodlar bo'yicha sanoqlar, ko'rilganlar, obunalar,
// "qiziq emas", bloklar va reklama qatorlari — parallel; (3) faqat qaytadigan
// sahifa uchun `shapeFeedRows` va `liked`. IN ro'yxatlar parametr bilan,
// D1 ning 100 parametr chegarasi uchun bo'laklarga bo'linadi.
//
// `reel_hidden` — `CREATE TABLE IF NOT EXISTS`; hisob o'chirilganda
// (account-purge.js) tozalanadi.

import { seedShowcaseSamples } from './showcase-samples.js';
import { seedShowcaseAds, moveShowcasePromoVideos, enabledSlots, slotMatchesRow } from './showcase-ads.js';
import { blockedByUser } from './moderation.js';
import { activeTargets } from './featured.js';
import { ensureExtras } from './music.js';
import { contentViewerKey } from './comments.js';

// ── Ball konstantalari ──────────────────────────────────────────────
export const FRESH_HALF_LIFE_H = 36;
export const W_LIKE = 1;
export const W_COMMENT = 2;
export const W_SAVE = 3;
export const W_VIEW = 0.05;
export const ENGAGEMENT_WEIGHT = 0.6;
export const FOLLOW_BOOST = 1.8;
export const SEEN_PENALTY = 0.12;
export const OWN_PENALTY = 0.35;
export const JITTER_MAX = 0.05;

// ── Sahifa va nomzodlar ─────────────────────────────────────────────
export const POOL_SIZE = 300;
export const LIMIT_DEFAULT = 10;
export const LIMIT_MAX = 20;
export const AD_POSITIONS = [4, 9];
export const MAX_ADS_PER_PAGE = 2;
export const AUTHOR_MAX_PER_PAGE = 2;
const MAX_AD_KEYS = 16;
const ANCHOR_KEYS = 3;
const CURSOR_MAX_AGE_MS = 7 * 86_400_000;
const CURSOR_MAX_LEN = 2048;
// D1: bitta so'rovga 100 tagacha parametr — qo'shimcha 3-4 ta uchun joy.
const CHUNK = 80;
const HIDE_LIMIT = 120;
const HIDE_WINDOW_MS = 10 * 60_000;

const HIDE_KINDS = ['post', 'company_post'];
const KEY_RE = /^(post|company_post):[1-9][0-9]{0,11}$/;

// Vaqt formatlari jadvalga qarab har xil ("YYYY-MM-DD HH:MM:SS", ISO "T...Z",
// "...+00") — hammasi bir shaklga keltirib satr bo'yicha solishtiriladi
// (comments.js `sec()` bilan bir xil usul, faqat oddiy SQLite).
const NORM = (col) => `substr(replace(${col}, 'T', ' '), 1, 19)`;
const normTs = (v) => String(v || '').replace('T', ' ').slice(0, 19);
const tsMs = (v) => {
  const s = normTs(v);
  const ms = Date.parse(`${s.replace(' ', 'T')}Z`);
  return Number.isFinite(ms) ? ms : NaN;
};
const secStr = (ms) => new Date(ms).toISOString().slice(0, 19).replace('T', ' ');

const inList = (n) => Array(n).fill('?').join(',');
function chunks(arr, size = CHUNK) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
const rowsOf = (p) => p.then((r) => r?.results || []).catch(() => []);

// FNV-1a (32 bit) — barqaror, tez, kriptografik emas (kerak ham emas).
function hash32(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}
const jitterOf = (viewerKey, day, key) => (hash32(`${viewerKey}|${day}|${key}`) / 4294967296) * JITTER_MAX;

/// Ball — yuqoridagi formula. `sig`: { ageHours, likes, comments, saves,
/// views, followed, seen, own, jitter }.
export function reelScore(sig) {
  const freshness = Math.pow(0.5, Math.max(0, sig.ageHours) / FRESH_HALF_LIFE_H);
  const engagement = Math.log(1 + W_LIKE * sig.likes + W_COMMENT * sig.comments
    + W_SAVE * sig.saves + W_VIEW * sig.views);
  let score = freshness * (1 + ENGAGEMENT_WEIGHT * engagement);
  if (sig.followed) score *= FOLLOW_BOOST;
  if (sig.seen) score *= SEEN_PENALTY;
  if (sig.own) score *= OWN_PENALTY;
  return score * (1 + (sig.jitter || 0));
}

// ── Sxema ───────────────────────────────────────────────────────────
let schemaReady = null;
export function ensureSchema(env) {
  schemaReady ||= env.DB.prepare(`CREATE TABLE IF NOT EXISTS reel_hidden (
      user_id INTEGER NOT NULL,
      target_kind TEXT NOT NULL,
      target_id INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (user_id, target_kind, target_id)
    )`).run().catch((e) => { schemaReady = null; throw e; });
  return schemaReady;
}

// ── Kursor ──────────────────────────────────────────────────────────
function b64urlEncode(str) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(s) {
  const b = s.replace(/-/g, '+').replace(/_/g, '/');
  return atob(b + '='.repeat((4 - (b.length % 4)) % 4));
}
export const encodeCursor = (c) => b64urlEncode(JSON.stringify(c));

/// Kursorni o'qiydi va TEKSHIRADI. Har qanday xato → `null` (kursorsiz).
export function decodeCursor(raw, nowMs = Date.now()) {
  if (!raw || typeof raw !== 'string' || raw.length > CURSOR_MAX_LEN || !/^[A-Za-z0-9_-]+$/.test(raw)) return null;
  let c;
  try { c = JSON.parse(b64urlDecode(raw)); } catch { return null; }
  if (!c || typeof c !== 'object' || Array.isArray(c) || c.v !== 1) return null;
  const keys = (v) => Array.isArray(v) && v.length <= MAX_AD_KEYS * 2 && v.every((k) => typeof k === 'string' && KEY_RE.test(k));
  if (!Number.isInteger(c.s) || c.s > nowMs + 5000 || c.s < nowMs - CURSOR_MAX_AGE_MS) return null;
  if (!Number.isInteger(c.o) || c.o < 0 || c.o > POOL_SIZE) return null;
  if (!Number.isInteger(c.w) || c.w < 1 || c.w > LIMIT_MAX) return null;
  if (!keys(c.k) || c.k.length > ANCHOR_KEYS || !keys(c.a) || !keys(c.x)) return null;
  return { s: c.s, o: c.o, w: c.w, k: c.k, a: c.a, x: c.x };
}

// ── Xilma-xillik ────────────────────────────────────────────────────
/// `items` ball bo'yicha saralangan. Sirpanuvchi oyna `w`: bir muallif
/// qo'shni emas va oynada AUTHOR_MAX_PER_PAGE tadan oshmaydi.
export function diversify(items, w) {
  const rest = items.slice();
  const out = [];
  const okWindow = (author) => {
    let n = 0;
    for (let i = Math.max(0, out.length - (w - 1)); i < out.length; i++) if (out[i].author === author) n++;
    return n < AUTHOR_MAX_PER_PAGE;
  };
  while (rest.length) {
    const prev = out.length ? out[out.length - 1].author : null;
    let idx = rest.findIndex((it) => it.author !== prev && okWindow(it.author));
    if (idx < 0) idx = rest.findIndex((it) => it.author !== prev);
    if (idx < 0) idx = 0;
    out.push(rest.splice(idx, 1)[0]);
  }
  return out;
}

const REEL_SQL = (a) => `(COALESCE(${a}.video_url, '') <> '' OR EXISTS (SELECT 1 FROM post_extras e
      WHERE e.post_kind = (CASE WHEN ${a}.author_kind = 'company' THEN 'company_post' ELSE 'post' END)
        AND e.post_id = ${a}.id AND e.reel = 1))`;

// KO'RGAZMA (2026-10, api/showcase.js): videosiz post, `showcase = 1` YOKI
// rasmli reel (`reel = 1`). GET /api/showcase — shu modul, AYNAN Reels
// tartibi, kursori, reklamasi va "qiziq emas" (`reel_hidden`) bilan.
const SHOWCASE_SQL = (a) => `(COALESCE(${a}.video_url, '') = '' AND EXISTS (SELECT 1 FROM post_extras e
      WHERE e.post_kind = (CASE WHEN ${a}.author_kind = 'company' THEN 'company_post' ELSE 'post' END)
        AND e.post_id = ${a}.id AND (e.showcase = 1 OR e.reel = 1)))`;

const isMissingTable = (e) => /no such table/i.test(String(e?.message || e));

// ── GET /api/reels ──────────────────────────────────────────────────
async function listReels(request, env, url, H, mode = 'reels', { adsOnly = false } = {}) {
  const FILTER_SQL = mode === 'showcase' ? SHOWCASE_SQL : REEL_SQL;
  const nowMs = Date.now();
  const rawLimit = url.searchParams.get('limit');
  const parsed = rawLimit == null || rawLimit === '' ? NaN : Math.floor(Number(rawLimit));
  const limit = Number.isFinite(parsed) ? Math.min(LIMIT_MAX, Math.max(1, parsed)) : LIMIT_DEFAULT;
  const cur = decodeCursor(url.searchParams.get('cursor'), nowMs);
  // Surat: joriy soniyadan OLDINGI soniya — `posts.created_at` soniya
  // aniqligida, shu soniyada keyin yaratilgan post ham chegaradan tashqarida.
  const snapMs = cur ? cur.s : Math.floor(nowMs / 1000) * 1000 - 1000;
  const snap = secStr(snapMs);
  const day = snap.slice(0, 10);
  const nowIso = new Date(nowMs).toISOString();

  // Sxemalar bir marta (isolate); 1-to'lqinni KUTTIRMAYDI. Nomzod so'rovi
  // jadval yo'qligidan yiqilsa — kutib, bir marta qayta urinadi.
  const schemas = Promise.all([ensureSchema(env), ensureExtras(env)]).catch(() => {});
  // Kalitlar (api/flags.js): `videosHidden` — videoli kadrlar UNIONning
  // o'zida chiqarib tashlanadi (reklama ham shu so'rovdan).
  const unionSql = H.feedUnionSqlFor ? H.feedUnionSqlFor(H.peekFlags(env) || await H.getFlags(env)) : H.feedUnionSql;
  const poolSql = `SELECT f.* FROM (${unionSql}) f
     WHERE f.kind = 'post' AND ${FILTER_SQL('f')} AND ${NORM('f.created_at')} <= ?
     ORDER BY ${NORM('f.created_at')} DESC, f.author_kind DESC, f.id DESC
     LIMIT ${POOL_SIZE}`;
  const poolQuery = () => env.DB.prepare(poolSql).bind(0, 0, nowIso, 0, nowIso, snap).all();

  // ── 1-TO'LQIN ──
  const [user, poolRes, active, slots] = await Promise.all([
    H.getCurrentUser(request, env).catch(() => null),
    poolQuery().catch(async (e) => {
      if (!isMissingTable(e)) throw e;
      await schemas;
      return poolQuery();
    }),
    activeTargets(env, H.nowTs()).catch(() => []),
    mode === 'showcase' ? enabledSlots(env) : [],
  ]);
  const viewerId = user ? Number(user.id) : 0;
  const viewerKey = await contentViewerKey(H, request, user);
  const pool = poolRes?.results || [];

  const keyOf = (r) => `${H.commentTargetKind(r)}:${Number(r.id)}`;
  const authorOf = (r) => `${String(r.author_kind)}:${String(r.code || '').toUpperCase()}`;

  // Reklama nomzodlari: zanjir boshida faol bo'lganlar (`x`), hozir ham faol.
  // Ko'rgazma reklama joylari (slot tartibida) — featured'dan OLDIN.
  const slotByKey = new Map();
  for (const sl of slots || []) if (KEY_RE.test(sl.key) && !slotByKey.has(sl.key)) slotByKey.set(sl.key, sl);
  const featuredKeys = (active || [])
    .filter((t) => t.kind === 'post' || t.kind === 'company_post')
    .map((t) => `${t.kind}:${Number(t.id)}`)
    .filter((k) => KEY_RE.test(k));
  const activeKeys = [...slotByKey.keys(), ...featuredKeys];
  const xKeys = cur ? cur.x : [...new Set(activeKeys)].slice(0, MAX_AD_KEYS);
  const served = new Set(cur ? cur.a : []);
  const activeSet = new Set(activeKeys);
  const adCand = xKeys.filter((k) => activeSet.has(k) && !served.has(k));
  const slotCand = adCand.filter((k) => slotByKey.has(k));
  const featCand = adCand.filter((k) => !slotByKey.has(k));

  // ── 2-TO'LQIN ──
  const pIds = pool.filter((r) => String(r.author_kind) !== 'company').map((r) => Number(r.id));
  const cIds = pool.filter((r) => String(r.author_kind) === 'company').map((r) => Number(r.id));
  const byKind = [['post', pIds], ['company_post', cIds]];
  const viewsQ = [];
  const commentsQ = [];
  const likesQ = [];
  const savesQ = [];
  for (const [kind, ids] of byKind) {
    for (const part of chunks(ids)) {
      viewsQ.push(rowsOf(env.DB.prepare(
        `SELECT target_kind AS k, target_id AS id, COUNT(*) AS n,
                MAX(CASE WHEN viewer = ? THEN 1 ELSE 0 END) AS seen
           FROM content_views
          WHERE target_kind = ? AND target_id IN (${inList(part.length)}) AND ${NORM('created_at')} <= ?
          GROUP BY target_kind, target_id`
      ).bind(viewerKey, kind, ...part, snap).all()));
      // Izoh: tirik, suratgacha; shaxsiy postda postdan OLDINGI izoh
      // (qayta ishlatilgan raqam) sanalmaydi — comments.js `freshPostSql`.
      commentsQ.push(rowsOf(env.DB.prepare(
        `SELECT cc.target_kind AS k, cc.target_id AS id, COUNT(*) AS n
           FROM content_comments cc
          WHERE cc.target_kind = ? AND cc.target_id IN (${inList(part.length)})
            AND cc.deleted_at IS NULL AND ${NORM('cc.created_at')} <= ?
            AND NOT EXISTS (SELECT 1 FROM posts rp WHERE cc.target_kind = 'post' AND rp.id = cc.target_id
                              AND ${NORM('rp.created_at')} > ${NORM('cc.created_at')})
          GROUP BY cc.target_kind, cc.target_id`
      ).bind(kind, ...part, snap).all()));
      likesQ.push(rowsOf(kind === 'post'
        ? env.DB.prepare(
          `SELECT 'post' AS k, post_id AS id, COUNT(*) AS n FROM post_likes
            WHERE post_id IN (${inList(part.length)}) AND ${NORM('created_at')} <= ? GROUP BY post_id`
        ).bind(...part, snap).all()
        : env.DB.prepare(
          `SELECT 'company_post' AS k, target_id AS id, COUNT(*) AS n FROM content_likes
            WHERE target_kind = 'company_post' AND target_id IN (${inList(part.length)})
              AND ${NORM('created_at')} <= ? GROUP BY target_id`
        ).bind(...part, snap).all()));
    }
    // Saqlash: `kind=post|company_post` (ref = raqam) va eski `kind=reel`
    // (ref = `p:<id>` / `c:<id>`) — ikkalasi ham sanaladi.
    for (const part of chunks(ids, Math.floor(CHUNK / 2))) {
      const pre = kind === 'company_post' ? 'c:' : 'p:';
      savesQ.push(rowsOf(env.DB.prepare(
        `SELECT kind, ref, COUNT(*) AS n FROM user_saves
          WHERE ((kind = ? AND ref IN (${inList(part.length)})) OR (kind = 'reel' AND ref IN (${inList(part.length)})))
            AND ${NORM('created_at')} <= ?
          GROUP BY kind, ref`
      ).bind(kind, ...part.map(String), ...part.map((id) => `${pre}${id}`), snap).all()));
    }
  }
  const socialQ = viewerId ? rowsOf(env.DB.prepare(
    `SELECT 'f' AS t, 'card' AS k, c.code AS code FROM cards c JOIN follows fl ON fl.followee_id = c.user_id
      WHERE fl.follower_id = ? AND ${NORM('fl.created_at')} <= ?
     UNION ALL
     SELECT 'f', 'company', cf.company_id FROM company_follows cf WHERE cf.user_id = ? AND ${NORM('cf.created_at')} <= ?
     UNION ALL
     SELECT 'o', 'card', code FROM cards WHERE user_id = ?
     UNION ALL
     SELECT 'o', 'company', company_id FROM companies WHERE owner_user_id = ? OR owner_user_id = ?`
  ).bind(viewerId, snap, viewerId, snap, viewerId, String(viewerId), Number(viewerId)).all()) : Promise.resolve([]);
  const hidesQ = viewerId ? rowsOf(env.DB.prepare(
    `SELECT target_kind, target_id, created_at FROM reel_hidden WHERE user_id = ? ORDER BY created_at DESC LIMIT 2000`
  ).bind(viewerId).all()) : Promise.resolve([]);
  const blocksQ = viewerId ? blockedByUser(env, viewerId).catch(() => []) : Promise.resolve([]);
  // Reklama qatorlari — lenta UNIONidan (maxfiylik, o'chirilgan, rejadagi,
  // tekshiruv kutayotgan, `videosHidden`). Featured — `FILTER_SQL` bilan;
  // Ko'rgazma joyi — usiz (video ruxsat), lekin faqat `slotCand` kalitlari.
  const keyPairs = (keys) => keys.flatMap((k) => {
    const [kind, id] = k.split(':');
    return [kind === 'company_post' ? 'company' : 'card', Number(id)];
  });
  const keyOr = (keys) => keys.map(() => '(f.author_kind = ? AND f.id = ?)').join(' OR ');
  const adWhere = [
    ...(featCand.length ? [`(${FILTER_SQL('f')} AND (${keyOr(featCand)}))`] : []),
    ...(slotCand.length ? [`(${keyOr(slotCand)})`] : []),
  ];
  const adsQ = adCand.length ? rowsOf(env.DB.prepare(
    `SELECT f.* FROM (${unionSql}) f
      WHERE f.kind = 'post' AND (${adWhere.join(' OR ')})`
  ).bind(0, 0, nowIso, 0, nowIso, ...keyPairs(featCand), ...keyPairs(slotCand)).all()) : Promise.resolve([]);

  const [viewsR, commentsR, likesR, savesR, socialR, hidesR, blocksR, adsR] = await Promise.all([
    Promise.all(viewsQ), Promise.all(commentsQ), Promise.all(likesQ), Promise.all(savesQ),
    socialQ, hidesQ, blocksQ, adsQ,
  ]);

  const views = new Map();
  const seen = new Set();
  for (const r of viewsR.flat()) {
    const k = `${r.k}:${Number(r.id)}`;
    views.set(k, Number(r.n) || 0);
    if (Number(r.seen) === 1) seen.add(k);
  }
  const countMap = (rows) => new Map(rows.flat().map((r) => [`${r.k}:${Number(r.id)}`, Number(r.n) || 0]));
  const comments = countMap(commentsR);
  const likes = countMap(likesR);
  const saves = new Map();
  for (const r of savesR.flat()) {
    const ref = String(r.ref);
    let k = null;
    if (r.kind === 'reel') k = ref.startsWith('c:') ? `company_post:${ref.slice(2)}` : `post:${ref.slice(2)}`;
    else k = `${r.kind}:${ref}`;
    saves.set(k, (saves.get(k) || 0) + (Number(r.n) || 0));
  }
  const followed = new Set();
  const own = new Set();
  for (const r of socialR) {
    (r.t === 'f' ? followed : own).add(`${r.k}:${String(r.code || '').toUpperCase()}`);
  }
  const blocked = new Set((blocksR || [])
    .map((b) => `${b.kind === 'company' ? 'company' : 'card'}:${String(b.id).toUpperCase()}`));
  // "Qiziq emas": qator kaliti -> vaqti. Post raqami qayta ishlatiladi
  // (posts.id AUTOINCREMENT emas), shuning uchun postdan OLDIN qo'yilgan
  // belgi YANGI postga tegishli emas.
  const hides = new Map(hidesR.map((h) => [`${h.target_kind}:${Number(h.target_id)}`, normTs(h.created_at)]));
  const hiddenFor = (r, beforeSnap) => {
    const at = hides.get(keyOf(r));
    if (!at || at < normTs(r.created_at)) return false;
    return beforeSnap ? at <= snap : true;
  };

  // ── TARTIB ──
  const xSet = new Set(xKeys);
  const ranked = [];
  for (const r of pool) {
    const key = keyOf(r);
    const author = authorOf(r);
    if (xSet.has(key) || blocked.has(author) || hiddenFor(r, true)) continue;
    const created = tsMs(r.created_at);
    const score = reelScore({
      ageHours: Number.isFinite(created) ? (snapMs - created) / 3_600_000 : 1e6,
      likes: likes.get(key) || 0,
      comments: comments.get(key) || 0,
      saves: saves.get(key) || 0,
      views: views.get(key) || 0,
      followed: followed.has(author),
      seen: seen.has(key),
      own: own.has(author),
      jitter: jitterOf(viewerKey, day, key),
    });
    ranked.push({ key, author, score, row: r });
  }
  ranked.sort((a, b) => (b.score - a.score) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  const w = cur ? cur.w : limit;
  const ordered = diversify(ranked, w);

  // ── SAHIFA ──
  let start = cur ? Math.min(cur.o, ordered.length) : 0;
  if (cur && cur.k.length) {
    const anchors = new Set(cur.k);
    let last = -1;
    ordered.forEach((it, i) => { if (anchors.has(it.key)) last = i; });
    if (last >= 0) start = last + 1;
  }
  // Navbat: avval Ko'rgazma joylari (slot tartibida), keyin featured (jitter).
  // Joydagi post raqami boshqa postga o'tgan bo'lsa (`slotMatchesRow`) — chiqmaydi.
  const adRank = (a) => (a.slot ? a.slot.slot : 100);
  // Ko'rgazmada VIDEO reklama faqat `?video=1` yuborgan ilovaga: eski ilova
  // (iOS 329, Android 315) videoni o'ynata olmaydi — mp4 rasm o'rnida singan
  // kadr bo'lib chiqardi. Rasmli reklama hammaga.
  const videoAdsOk = mode !== 'showcase' || url.searchParams.get('video') === '1';
  const adQueue = adsR
    .filter((r) => adCand.includes(keyOf(r)) && !blocked.has(authorOf(r)) && !hiddenFor(r, false))
    .filter((r) => videoAdsOk || !String(r.video_url || '').trim())
    .map((r) => ({ key: keyOf(r), row: r, slot: slotCand.includes(keyOf(r)) ? slotByKey.get(keyOf(r)) : null }))
    .filter((a) => !a.slot || slotMatchesRow(a.slot, a.row))
    .sort((a, b) => (adRank(a) - adRank(b))
      || (jitterOf(viewerKey, day, b.key) - jitterOf(viewerKey, day, a.key)) || (a.key < b.key ? -1 : 1));
  const page = [];
  let adsOnPage = 0;
  let oi = start;
  // Asosiy ekran kartochkasi (`/api/showcase/ads`): FAQAT admin joylari
  // (slot tartibida), oddiy kadr va featured yo'q, sahifalash yo'q.
  if (adsOnly) {
    for (const a of adQueue) if (a.slot && page.length < limit) page.push({ ...a, ad: true });
    oi = ordered.length;
  }
  while (!adsOnly && page.length < limit) {
    const pos = page.length;
    if (AD_POSITIONS.includes(pos) && adQueue.length && adsOnPage < MAX_ADS_PER_PAGE) {
      page.push({ ...adQueue.shift(), ad: true });
      adsOnPage++;
      continue;
    }
    if (oi >= ordered.length) {
      // Ko'rgazma: oddiy kadr tugadi, sahifada kamida bitta oddiy kadr bor —
      // qolgan reklama oxiriga (sahifa chegarasi o'sha-o'sha).
      if (mode === 'showcase' && pos > adsOnPage && adQueue.length && adsOnPage < MAX_ADS_PER_PAGE) {
        page.push({ ...adQueue.shift(), ad: true });
        adsOnPage++;
        continue;
      }
      break;
    }
    const it = ordered[oi++];
    // Suratdan keyingi "qiziq emas" — tartibda turadi, javobda yo'q.
    if (hiddenFor(it.row, false)) continue;
    page.push(it);
  }
  const hasMore = ordered.slice(oi).some((it) => !hiddenFor(it.row, false));

  // ── 3-TO'LQIN — faqat shu sahifa ──
  const rows = page.map((p) => p.row);
  const [shaped, likedKeys] = await Promise.all([
    rows.length ? H.shapeFeedRows(env, rows, viewerId) : [],
    viewerId && rows.length ? H.feedViewerLikedKeys(env, rows, viewerId) : null,
  ]);
  const items = page.map((p, i) => {
    const lk = likedKeys && H.feedLikedKey(p.row);
    const base = lk ? { ...shaped[i], liked: likedKeys.has(lk) } : shaped[i];
    if (!p.ad) return base;
    return p.slot ? { ...base, featured: true, ad: true, adSlot: p.slot.slot } : { ...base, featured: true };
  });

  const nextCursor = hasMore ? encodeCursor({
    v: 1,
    s: snapMs,
    o: oi,
    k: ordered.slice(Math.max(0, oi - ANCHOR_KEYS), oi).map((it) => it.key),
    w,
    a: [...served, ...page.filter((p) => p.ad).map((p) => p.key)],
    x: xKeys,
  }) : null;
  // Ko'rgazma javobida `cursor` ham (shartnoma §4) — `nextCursor` bilan bir xil.
  return H.json(mode === 'showcase' ? { items, hasMore, cursor: nextCursor, nextCursor } : { items, nextCursor, hasMore });
}

// ── POST /api/reels/hide ────────────────────────────────────────────
async function hideReel(request, env, H) {
  const user = await H.getCurrentUser(request, env);
  if (!user) return H.json({ error: 'unauthorized' }, 401);
  const body = await request.json().catch(() => null);
  const kind = body && typeof body === 'object' ? String(body.kind || '') : '';
  const id = body && typeof body === 'object' ? Number(body.id) : NaN;
  if (!HIDE_KINDS.includes(kind) || !Number.isInteger(id) || id <= 0 || id > 999_999_999_999) {
    return H.json({ error: 'bad_target' }, 422);
  }
  if (await H.rateLimitD1(env, `reelhide:u:${user.id}`, HIDE_LIMIT, HIDE_WINDOW_MS)) {
    return H.json({ error: 'too_many_requests' }, 429);
  }
  await ensureSchema(env);
  await env.DB.prepare(
    `INSERT OR IGNORE INTO reel_hidden (user_id, target_kind, target_id, created_at) VALUES (?, ?, ?, ?)`
  ).bind(user.id, kind, id, H.nowTs()).run();
  return H.json({ ok: true });
}

export async function handle(request, env, url, H) {
  const path = url.pathname;
  if (path === '/api/reels') {
    if (request.method !== 'GET') return H.json({ error: 'method_not_allowed' }, 405);
    // KALIT `reelsHidden` (api/flags.js): Reels lentasi bo'sh. Yangi ilova
    // tabni o'zi yashiradi; eski ilova bo'sh lentani ko'radi.
    if (H.getFlags && (H.peekFlags(env) || await H.getFlags(env)).reelsHidden) {
      return H.json({ items: [], nextCursor: null, hasMore: false, hidden: true });
    }
    return listReels(request, env, url, H);
  }
  if (path === '/api/showcase') {
    if (request.method !== 'GET') return H.json({ error: 'method_not_allowed' }, 405);
    // NFCSTORE'ning o'z namunalari — bir marta (api/showcase-samples.js).
    // Xato lentani buzmaydi.
    await seedShowcaseSamples(env).catch((e) => console.error('showcase_samples', String(e?.message || e).slice(0, 160)));
    // NFCSTORE promo reklamalari (BOY777, LOL707) — bir marta (api/showcase-ads.js).
    await seedShowcaseAds(env).catch((e) => console.error('showcase_ads', String(e?.message || e).slice(0, 160)));
    // Promo mp4 — iPhone uchun Range qo'llaydigan /uploads ga (bir marta).
    await moveShowcasePromoVideos(env).catch((e) => console.error('showcase_promo_move', String(e?.message || e).slice(0, 160)));
    return listReels(request, env, url, H, 'showcase');
  }
  // Asosiy ekrandagi reklama kartochkasi — Ko'rgazma joylari (1–4), xuddi
  // shu filtrlar (blok, "qiziq emas", pending, video faqat `?video=1`).
  if (path === '/api/showcase/ads') {
    if (request.method !== 'GET') return H.json({ error: 'method_not_allowed' }, 405);
    await seedShowcaseAds(env).catch((e) => console.error('showcase_ads', String(e?.message || e).slice(0, 160)));
    await moveShowcasePromoVideos(env).catch((e) => console.error('showcase_promo_move', String(e?.message || e).slice(0, 160)));
    const res = await listReels(request, env, url, H, 'showcase', { adsOnly: true });
    // Kursor kerak emas — bir martalik ro'yxat; qisqa keshsiz.
    return res;
  }
  if (path === '/api/reels/hide') {
    if (request.method !== 'POST') return H.json({ error: 'method_not_allowed' }, 405);
    return hideReel(request, env, H);
  }
  return null;
}
