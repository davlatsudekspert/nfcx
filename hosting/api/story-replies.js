// hosting/api/story-replies.js — ISTORIYAGA JAVOB VA KIM KO'RDI (2026-10).
//
// ═══ NIMA UCHUN BOR ═══
//
// Istoriya ko'rgan odam "javob yozish" yoki bitta emoji yuborishi kerak
// (Instagram'dagi kabi) — biznes uchun bu mijozdan kelgan birinchi
// savol. Egasi esa istoriyasini KIM ko'rganini bilishi kerak: hozir u
// faqat sonni ko'radi (`viewCount`).
//
// ═══ MARSHRUTLAR ═══
//
//   POST /api/stories/:kind/:id/reply   { text } | { emoji } | ikkalasi   (kirgan odam)
//        :kind = story | company_story
//        → 201 { reply }
//        400-lar: 422 empty | too_long | bad_emoji; 403 banned | blocked;
//                 409 own_story; 404 not_found (yo'q, muddati o'tgan, egasi
//                 o'chirilgan, faol bo'lmagan kompaniya); 429 too_many_requests
//   GET  /api/stories/:kind/:id/viewers?page=&limit=   (FAQAT egasi)
//        → { count, guestCount, likeCount, replyCount,
//            viewers: [{ code, name, avatarUrl, viewedAt, liked }], hasMore }
//   GET  /api/my/story-replies?page=&limit=&storyKind=&storyId=   (egasi)
//        → { items: [Reply], hasMore }
//
//   Reply = { id, storyKind, storyId, ownerKind, ownerId, text, emoji,
//             createdAt, from: { code, name, avatarUrl },
//             story: { imageUrl, videoUrl, expiresAt, active } | null }
//
// ═══ QOIDALAR ═══
//
//   * Ko'rishlar MANBAI — mavjud `story_views` (istoriya ochilganda
//     `POST /api/stories/:id/view` yozadi; `u<id>` — kirgan odam,
//     `g<hash>` — mehmon). Mehmonlar SANALADI, lekin ro'yxatda
//     ko'rsatilmaydi: ularning ismi yo'q, xesh esa hech narsa demaydi.
//     (`content_views` faqat post/Reels uchun — istoriya u yerga
//     yozilmaydi.)
//   * Javob faqat FAOL istoriyaga. O'z istoriyasiga javob yozilmaydi.
//   * BLOK: egasi javob beruvchining profilini (yoki kompaniyasini)
//     bloklagan bo'lsa — yoki javob beruvchi egasini bloklagan bo'lsa —
//     javob yozilmaydi (`user_blocks`, eski `blocked_users` ham).
//   * Spamga qarshi: bir odam 10 daqiqada 30 tagacha javob (`rateLimitD1`).
//   * Javob egasining qutisida istoriya o'chib ketgandan keyin ham qoladi
//     (istoriya ko'rinishi `story: null` bo'ladi).
//   * Hisob butunlay o'chirilganda (account-purge.js) odamning YOZGAN va
//     OLGAN javoblari o'chadi.

import { ensureSchema as ensureModerationSchema } from './moderation.js';

const KINDS = { story: 'card', company_story: 'company' };
export const REPLY_MAX = 500;
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 10 * 60_000;

let ready = null;
export function ensureSchema(env) {
  ready ||= env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS story_replies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      story_id INTEGER NOT NULL,
      story_kind TEXT NOT NULL,
      owner_kind TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      recipient_user_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      body TEXT NOT NULL DEFAULT '',
      emoji TEXT,
      created_at TEXT NOT NULL
    )`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_story_replies_recipient ON story_replies(recipient_user_id, id DESC)`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_story_replies_story ON story_replies(story_id)`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_story_replies_user ON story_replies(user_id)`),
  ]).catch((e) => { ready = null; throw e; });
  return ready;
}

/// Istoriya va uning egasi. `owner_uid` — egasi foydalanuvchi ID'si (matn).
const STORY_SQL = `SELECT x.*,
       EXISTS (SELECT 1 FROM users u WHERE CAST(u.id AS TEXT) = x.owner_uid AND u.deleted_at IS NOT NULL) AS owner_deleted
  FROM (
    SELECT s.id, s.owner_kind, s.owner_id, s.expires_at, s.image_url, s.video_url,
           CASE s.owner_kind
             WHEN 'card' THEN (SELECT CAST(c.user_id AS TEXT) FROM cards c WHERE c.code = s.owner_id)
             ELSE (SELECT CAST(co.owner_user_id AS TEXT) FROM companies co WHERE co.company_id = s.owner_id)
           END AS owner_uid,
           CASE s.owner_kind
             WHEN 'card' THEN 'active'
             ELSE (SELECT co.status FROM companies co WHERE co.company_id = s.owner_id)
           END AS owner_status
      FROM stories s WHERE s.id = ? AND s.owner_kind = ?
  ) x`;

/// Javob beruvchini (yoki u egani) bloklash bormi.
async function blockedBetween(env, meId, ownerUid, ownerKind, ownerId) {
  await ensureModerationSchema(env).catch(() => {});
  const me = String(meId);
  const r = await env.DB.prepare(
    `SELECT
       EXISTS (SELECT 1 FROM user_blocks b WHERE CAST(b.user_id AS TEXT) = ? AND (
                 (b.target_kind = 'record' AND UPPER(b.target_id) IN (SELECT UPPER(code) FROM cards WHERE CAST(user_id AS TEXT) = ?))
              OR (b.target_kind = 'company' AND UPPER(b.target_id) IN
                    (SELECT UPPER(company_id) FROM companies WHERE CAST(owner_user_id AS TEXT) = ?)))) AS owner_blocked_me,
       EXISTS (SELECT 1 FROM user_blocks b WHERE CAST(b.user_id AS TEXT) = ?
                 AND b.target_kind = ? AND UPPER(b.target_id) = UPPER(?)) AS i_blocked_owner`
  ).bind(String(ownerUid), me, me, me, ownerKind === 'company' ? 'company' : 'record', String(ownerId)).first();
  if (Number(r?.owner_blocked_me) || Number(r?.i_blocked_owner)) return true;
  // Eski (foydalanuvchidan foydalanuvchiga) bloklar jadvali — bo'lmasa jim.
  const legacy = await env.DB.prepare(
    `SELECT 1 AS x FROM blocked_users
      WHERE (CAST(blocker_id AS TEXT) = ? AND CAST(blocked_id AS TEXT) = ?)
         OR (CAST(blocker_id AS TEXT) = ? AND CAST(blocked_id AS TEXT) = ?) LIMIT 1`
  ).bind(String(ownerUid), me, me, String(ownerUid)).first().catch(() => null);
  return !!legacy;
}

function cleanText(v) {
  return String(v ?? '').replace(/\r\n/g, '\n').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').replace(/\n{3,}/g, '\n\n').trim();
}

/// Bitta emoji (yoki bayroq / ZWJ ketma-ketligi). Harf va raqam — yo'q.
function cleanEmoji(v) {
  const e = String(v ?? '').trim();
  if (!e) return { ok: true, emoji: null };
  if (Array.from(e).length > 16) return { ok: false };
  if (!/^[\p{Extended_Pictographic}\p{Emoji_Component}‍️]+$/u.test(e)) return { ok: false };
  if (!/[\p{Extended_Pictographic}\p{Regional_Indicator}]/u.test(e)) return { ok: false };
  return { ok: true, emoji: e };
}

const ms = (H, v) => {
  const d = v ? H.parseDbDate(v) : null;
  return d && !Number.isNaN(d.getTime()) ? d.getTime() : null;
};

// Foydalanuvchining "yuzi" — asosiy (yoki birinchi) NFC kartasi.
const FACE_JOIN = (userCol) => `LEFT JOIN cards fc ON fc.code = (
    SELECT c2.code FROM cards c2 WHERE c2.user_id = ${userCol} ORDER BY c2.is_primary DESC, c2.ts ASC LIMIT 1)`;

function replyOut(r, H, nowIso) {
  const storyKind = String(r.story_kind);
  return {
    id: Number(r.id),
    storyKind,
    storyId: Number(r.story_id),
    ownerKind: String(r.owner_kind),
    ownerId: String(r.owner_id),
    text: r.body || '',
    emoji: r.emoji || null,
    createdAt: ms(H, r.created_at),
    from: { code: r.from_code || null, name: r.from_name || '', avatarUrl: r.from_avatar || '' },
    story: r.s_id == null ? null : {
      imageUrl: r.s_image || '',
      videoUrl: r.s_video || '',
      expiresAt: r.s_expires || null,
      active: String(r.s_expires || '') > nowIso,
    },
  };
}

/// Egasining faol istoriyalaridagi javoblar soni (worker.js
/// `listStoriesD1` PARALLEL chaqiradi). Tomoshabin egasi bo'lmasa —
/// so'rov bo'sh qaytadi va natija `null` (begonaga son chiqmaydi).
export async function ownerReplyCounts(env, ownerKind, ownerId, viewerUserId, nowIso) {
  const rows = await env.DB.prepare(
    `SELECT s.id AS story_id, (SELECT COUNT(*) FROM story_replies r WHERE r.story_id = s.id) AS n
       FROM stories s
      WHERE s.owner_kind = ? AND s.owner_id = ? AND s.expires_at > ?
        AND ((s.owner_kind = 'card' AND EXISTS (SELECT 1 FROM cards c WHERE c.code = s.owner_id AND CAST(c.user_id AS TEXT) = ?))
          OR (s.owner_kind = 'company' AND EXISTS (SELECT 1 FROM companies co
                WHERE co.company_id = s.owner_id AND CAST(co.owner_user_id AS TEXT) = ?)))`
  ).bind(ownerKind, ownerId, nowIso, String(viewerUserId), String(viewerUserId)).all();
  const list = rows.results || [];
  if (!list.length) return null;
  return new Map(list.map((r) => [Number(r.story_id), Number(r.n) || 0]));
}

const pageArgs = (url, def = 30, max = 100) => {
  const page = Math.max(1, Math.floor(Number(url.searchParams.get('page')) || 1));
  const limit = Math.min(max, Math.max(1, Math.floor(Number(url.searchParams.get('limit')) || def)));
  return { page, limit, offset: (page - 1) * limit };
};

export async function handle(request, env, url, H) {
  const path = url.pathname;
  const m = path.match(/^\/api\/stories\/(story|company_story)\/(\d{1,12})\/(reply|viewers)$/);
  const mine = path === '/api/my/story-replies';
  if (!m && !mine) return null;
  await ensureSchema(env);
  const user = await H.getCurrentUser(request, env).catch(() => null);
  if (!user) return H.json({ error: 'unauthorized' }, 401);
  const nowIso = new Date().toISOString();

  // ── MENGA KELGAN JAVOBLAR ──────────────────────────────────────
  if (mine) {
    if (request.method !== 'GET') return H.json({ error: 'method_not_allowed' }, 405);
    const { limit, offset } = pageArgs(url);
    const where = ['r.recipient_user_id = ?', 'NOT EXISTS (SELECT 1 FROM users du WHERE du.id = r.user_id AND du.deleted_at IS NOT NULL)'];
    const args = [user.id];
    const sk = url.searchParams.get('storyKind');
    const sid = Number(url.searchParams.get('storyId'));
    if (sk || url.searchParams.get('storyId')) {
      if (!KINDS[sk] || !Number.isInteger(sid) || sid <= 0) return H.json({ error: 'bad_story' }, 422);
      where.push('r.story_kind = ? AND r.story_id = ?');
      args.push(sk, sid);
    }
    const rows = await env.DB.prepare(
      `SELECT r.*, fc.code AS from_code, fc.name AS from_name, fc.avatar_url AS from_avatar,
              s.id AS s_id, s.image_url AS s_image, s.video_url AS s_video, s.expires_at AS s_expires
         FROM story_replies r
         ${FACE_JOIN('r.user_id')}
         LEFT JOIN stories s ON s.id = r.story_id AND s.owner_kind = r.owner_kind AND s.owner_id = r.owner_id
        WHERE ${where.join(' AND ')}
        ORDER BY r.id DESC LIMIT ? OFFSET ?`
    ).bind(...args, limit + 1, offset).all();
    const list = rows.results || [];
    return H.json({ items: list.slice(0, limit).map((r) => replyOut(r, H, nowIso)), hasMore: list.length > limit });
  }

  const storyKind = m[1];
  const ownerKind = KINDS[storyKind];
  const storyId = Number(m[2]);
  const story = await env.DB.prepare(STORY_SQL).bind(storyId, ownerKind).first();
  // Egasi o'chirilgan yoki faol bo'lmagan kompaniyaning istoriyasi
  // ommaviy yo'llarda ko'rinmaydi — bu yerda ham "yo'q".
  const isOwner = !!story && String(story.owner_uid ?? '') === String(user.id);

  // ── KIM KO'RDI (faqat egasi) ───────────────────────────────────
  if (m[3] === 'viewers') {
    if (request.method !== 'GET') return H.json({ error: 'method_not_allowed' }, 405);
    if (!story) return H.json({ error: 'not_found' }, 404);
    if (!isOwner) return H.json({ error: 'forbidden' }, 403);
    const { limit, offset } = pageArgs(url, 50, 100);
    // Ro'yxat va sanoqlar BIR to'lqinda.
    const [rows, stats] = await Promise.all([
      env.DB.prepare(
        `SELECT sv.created_at AS viewed_at, u.id AS uid, fc.code AS code, fc.name AS name, fc.avatar_url AS avatar,
                EXISTS (SELECT 1 FROM story_likes sl WHERE sl.story_id = sv.story_id AND sl.user_id = u.id) AS liked
           FROM story_views sv
           JOIN users u ON u.id = CAST(substr(sv.viewer, 2) AS INTEGER)
           ${FACE_JOIN('u.id')}
          WHERE sv.story_id = ? AND sv.viewer LIKE 'u%' AND u.deleted_at IS NULL
          ORDER BY sv.created_at DESC LIMIT ? OFFSET ?`
      ).bind(storyId, limit + 1, offset).all(),
      env.DB.prepare(
        `SELECT (SELECT COUNT(*) FROM story_views WHERE story_id = ?) AS total,
                (SELECT COUNT(*) FROM story_views WHERE story_id = ? AND viewer NOT LIKE 'u%') AS guests,
                (SELECT COUNT(*) FROM story_likes WHERE story_id = ?) AS likes,
                (SELECT COUNT(*) FROM story_replies WHERE story_id = ?) AS replies`
      ).bind(storyId, storyId, storyId, storyId).first(),
    ]);
    const list = rows.results || [];
    return H.json({
      count: Number(stats?.total) || 0,
      guestCount: Number(stats?.guests) || 0,
      likeCount: Number(stats?.likes) || 0,
      replyCount: Number(stats?.replies) || 0,
      viewers: list.slice(0, limit).map((r) => ({
        code: r.code || null,
        name: r.name || '',
        avatarUrl: r.avatar || '',
        viewedAt: ms(H, r.viewed_at),
        liked: !!Number(r.liked),
      })),
      hasMore: list.length > limit,
    });
  }

  // ── JAVOB YOZISH ────────────────────────────────────────────────
  if (request.method !== 'POST') return H.json({ error: 'method_not_allowed' }, 405);
  if (user.bannedUntil) return H.json({ error: 'banned' }, 403);
  if (!story || Number(story.owner_deleted) || String(story.owner_status) !== 'active'
    || !(String(story.expires_at || '') > nowIso) || !story.owner_uid) {
    return H.json({ error: 'not_found' }, 404);
  }
  if (isOwner) return H.json({ error: 'own_story' }, 409);
  const body = await request.json().catch(() => ({})) || {};
  const text = cleanText(body.text);
  const em = cleanEmoji(body.emoji);
  if (!em.ok) return H.json({ error: 'bad_emoji' }, 422);
  if (!text && !em.emoji) return H.json({ error: 'empty' }, 422);
  if (Array.from(text).length > REPLY_MAX) return H.json({ error: 'too_long', max: REPLY_MAX }, 422);
  if (await blockedBetween(env, user.id, story.owner_uid, ownerKind, story.owner_id)) {
    return H.json({ error: 'blocked' }, 403);
  }
  if (await H.rateLimitD1(env, `sreply:u:${user.id}`, RATE_LIMIT, RATE_WINDOW_MS)) {
    return H.json({ error: 'too_many_requests' }, 429);
  }
  const now = H.nowTs();
  const ins = await env.DB.prepare(
    `INSERT INTO story_replies (story_id, story_kind, owner_kind, owner_id, recipient_user_id, user_id, body, emoji, created_at)
     VALUES (?,?,?,?,?,?,?,?,?) RETURNING id`
  ).bind(storyId, storyKind, ownerKind, String(story.owner_id), Number(story.owner_uid), user.id, text, em.emoji, now).first();
  return H.json({
    reply: {
      id: Number(ins?.id) || 0, storyKind, storyId, ownerKind, ownerId: String(story.owner_id),
      text, emoji: em.emoji, createdAt: ms(H, now) || Date.now(),
    },
  }, 201);
}
