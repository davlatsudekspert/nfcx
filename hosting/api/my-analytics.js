// hosting/api/my-analytics.js — CONTRACT.md ga qarang. Route topilmasa null qaytaradi.
//
// ILOVADAGI "ANALITIKA" (Sozlamalar → Analitika).
//
//   GET /api/my/analytics?days=30   (auth) →
//     { days,
//       profile: { views, uniqueVisitors, clicks, totalViews },
//       followers,
//       content: { posts, views, likes, comments },
//       byDay: [{ day, views }],            // kontent ko'rishlari
//       top:   [{ kind, id, code, imageUrl, videoUrl, caption,
//                 createdAt, views, likes, comments }] }
//
// Hammasi foydalanuvchining O'Z kartalari va O'Z kompaniyalari
// bo'yicha — begona raqam hech qachon qaytmaydi. Manbalar mavjud
// jadvallarning o'zi: `card_events` (profil ko'rishlari va
// tugmalar — engagement.js), `content_views` (comments.js),
// `post_likes` / `content_likes`, `content_comments`. Ikkinchi
// hisoblagich ochilmagan: sayt va ilova bir xil raqamni ko'radi.
//
// NFC TEGIZISHLAR bu yerda YO'Q: server ularni alohida sanamaydi
// (tegizish oddiy profil ko'rishi bo'lib keladi). Bo'lmagan raqamni
// ko'rsatgandan ko'ra, "profil ko'rishlari" ichida qoldirgan to'g'ri.

import { ensureSchema as ensureCommentsSchema } from './comments.js';

const DAY_MS = 24 * 60 * 60_000;
const TOP_N = 10;
const tsAgo = (ms) => new Date(Date.now() - ms).toISOString().replace('T', ' ').replace('Z', '+00');

// Foydalanuvchining kontenti — `content_views`/`content_likes`/
// `content_comments` dagi (target_kind, target_id) juftligi uchun.
// `?` lar: [userId, userId].
const MY_TARGETS = `(
  (target_kind = 'post' AND target_id IN (
     SELECT id FROM posts WHERE code IN (SELECT code FROM cards WHERE user_id = ?)))
  OR (target_kind = 'company_post' AND target_id IN (
     SELECT id FROM company_posts WHERE company_id IN (SELECT company_id FROM companies WHERE owner_user_id = ?)))
)`;

export async function handle(request, env, url, H) {
  if (url.pathname !== '/api/my/analytics' || request.method !== 'GET') return null;
  const user = await H.getCurrentUser(request, env);
  if (!user) return H.json({ error: 'unauthorized' }, 401);
  await ensureCommentsSchema(env);

  const days = Math.max(1, Math.min(90, Math.round(Number(url.searchParams.get('days')) || 30)));
  const since = tsAgo(days * DAY_MS);
  const uid = user.id;
  const myCodes = `SELECT code FROM cards WHERE user_id = ?`;

  // Layklar: shaxsiy post — post_likes, kompaniya posti — content_likes.
  const [events, uniq, legacy, followers, posts, views, comments, byDay] = await Promise.all([
    env.DB.prepare(
      `SELECT event_type, COUNT(*) AS n FROM card_events
        WHERE code IN (${myCodes}) AND created_at >= ? GROUP BY event_type`
    ).bind(uid, since).all(),
    env.DB.prepare(
      `SELECT COUNT(DISTINCT visitor_hash) AS n FROM card_events
        WHERE code IN (${myCodes}) AND event_type = 'profile_view' AND visitor_hash IS NOT NULL AND created_at >= ?`
    ).bind(uid, since).first(),
    env.DB.prepare(`SELECT COALESCE(SUM(views), 0) AS n FROM cards WHERE user_id = ?`).bind(uid).first(),
    env.DB.prepare(
      `SELECT COUNT(*) AS n FROM follows fw
        WHERE fw.followee_id = ?
          AND EXISTS (SELECT 1 FROM users vu WHERE vu.id = fw.follower_id AND vu.deleted_at IS NULL)`
    ).bind(uid).first(),
    env.DB.prepare(
      `SELECT 'post' AS kind, p.id, p.code, p.image_url, p.video_url, p.caption, p.created_at,
              (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id) AS likes
         FROM posts p WHERE p.code IN (${myCodes})
       UNION ALL
       SELECT 'company_post', cp.id, cp.company_id, cp.image_url, cp.video_url, cp.caption, cp.created_at,
              (SELECT COUNT(*) FROM content_likes cl WHERE cl.target_kind = 'company_post' AND cl.target_id = cp.id)
         FROM company_posts cp
        WHERE cp.company_id IN (SELECT company_id FROM companies WHERE owner_user_id = ?)`
    ).bind(uid, uid).all(),
    env.DB.prepare(
      `SELECT target_kind, target_id, COUNT(*) AS n FROM content_views
        WHERE ${MY_TARGETS} GROUP BY target_kind, target_id`
    ).bind(uid, uid).all(),
    env.DB.prepare(
      `SELECT target_kind, target_id, COUNT(*) AS n FROM content_comments
        WHERE ${MY_TARGETS} AND deleted_at IS NULL GROUP BY target_kind, target_id`
    ).bind(uid, uid).all(),
    env.DB.prepare(
      `SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS n FROM content_views
        WHERE ${MY_TARGETS} AND created_at >= ? GROUP BY day ORDER BY day`
    ).bind(uid, uid, since).all(),
  ]);

  const byType = Object.fromEntries((events.results || []).map((r) => [r.event_type, Number(r.n) || 0]));
  const profileViews = byType.profile_view || 0;
  const clicks = Object.entries(byType)
    .filter(([k]) => k !== 'profile_view')
    .reduce((a, [, n]) => a + n, 0);

  const key = (kind, id) => `${kind}:${Number(id)}`;
  const viewMap = new Map((views.results || []).map((r) => [key(r.target_kind, r.target_id), Number(r.n) || 0]));
  const cmtMap = new Map((comments.results || []).map((r) => [key(r.target_kind, r.target_id), Number(r.n) || 0]));

  const items = (posts.results || []).map((r) => ({
    kind: String(r.kind),
    id: Number(r.id),
    code: String(r.code || '').toUpperCase(),
    imageUrl: r.image_url || '',
    videoUrl: r.video_url || '',
    caption: r.caption || '',
    createdAt: r.created_at,
    views: viewMap.get(key(r.kind, r.id)) || 0,
    likes: Number(r.likes) || 0,
    comments: cmtMap.get(key(r.kind, r.id)) || 0,
  }));
  const sum = (f) => items.reduce((a, o) => a + o[f], 0);
  const top = [...items]
    .sort((a, b) => (b.views - a.views) || (b.likes - a.likes) || (b.id - a.id))
    .slice(0, TOP_N);

  return H.json({
    days,
    profile: {
      views: profileViews,
      uniqueVisitors: Number(uniq?.n) || 0,
      clicks,
      totalViews: Number(legacy?.n) || 0,
    },
    followers: Number(followers?.n) || 0,
    content: { posts: items.length, views: sum('views'), likes: sum('likes'), comments: sum('comments') },
    byDay: (byDay.results || []).map((r) => ({ day: r.day, views: Number(r.n) || 0 })),
    top,
  });
}
