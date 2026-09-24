// hosting/api/app-admin.js — ILOVAGA TEGISHLI MA'LUMOT ADMIN UCHUN.
//
// ═══ NIMA UCHUN BOR ═══
//
// Egasining talabi (2026-09): admin "NFCSTORE ILOVASI" bo'limida
// ilovaga tegishli HAMMA narsa ko'rinsin. Ma'lumot bazada allaqachon
// bor edi, lekin uni o'qiydigan joy yo'q edi:
//
//   * AVTO-FILTR — image-moderation.js bloklagan rasmlar jurnali
//     (`content_scan_blocks`) faqat YOZILARDI, hech kim o'qimasdi;
//   * KONTENT — ilovadagi post, Reels, istoriya va biznes postlarini
//     admin faqat shikoyat kelgandagina ko'rardi;
//   * BUYURTMALAR — biznes katalogidan kelgan buyurtmalarni faqat
//     o'sha biznes egasi ko'rardi.
//
// ═══ YO'LLAR (faqat admin, `H.requireAdmin`) ═══
//
//   GET /api/admin/content-blocks?category=&q=&page=&limit=
//       -> { stats:{ total, today, last7d, byCategory }, items, hasMore }
//   GET /api/admin/app-content?kind=post|reel|story|company_post&q=&page=&limit=
//       -> { stats:{ posts, reels, stories, companyPosts }, items, hasMore }
//       Reels — videoli post (shaxsiy yoki biznes). Istoriya — faqat
//       hali ko'rinib turganlari (24 soat ichidagi).
//       O'chirish ALOHIDA yo'l emas: mavjud
//       `DELETE /api/admin/content/:deleteKind/:id` (moderation.js) —
//       u avval dalil arxiviga nusxa yozadi.
//   GET /api/admin/company-orders?q=&status=&page=&limit=
//       -> { stats:{ total, new, last7d }, items, hasMore }
//
// FAQAT O'QIYDI. Jadval yaratmaydi va hech narsani o'zgartirmaydi;
// jadval hali yo'q bo'lsa — bo'sh ro'yxat va nol statistika.

import { countsFor, likesFor } from './comments.js';

const PAGE_MAX = 100;

// Avto-filtr kategoriyalari — statistika HAR DOIM shu kalitlar bilan
// qaytadi (nol bo'lsa ham), aks holda admin panelidagi kartochka
// "yo'q" va "nol" ni ajrata olmasdi. Jurnalda boshqa kategoriya
// uchrasa, u ham qo'shiladi.
export const BLOCK_CATEGORY_KEYS = ['sexual', 'violence', 'extremism', 'political', 'drugs', 'hate'];

export const ORDER_STATUSES = ['new', 'done', 'cancelled'];

function paging(url, def = 50) {
  const page = Math.max(1, Math.floor(Number(url.searchParams.get('page')) || 1));
  const limit = Math.min(PAGE_MAX, Math.max(1, Math.floor(Number(url.searchParams.get('limit')) || def)));
  // `offset` — "Yana yuklash" ro'yxatdagi HAQIQIY sonni yuboradi: admin
  // o'rtada element o'chirsa, sahifa raqami bo'yicha keyingi sahifa bitta
  // elementni o'tkazib yuborardi.
  const rawOff = url.searchParams.get('offset');
  const offset = rawOff != null && rawOff !== ''
    ? Math.max(0, Math.floor(Number(rawOff) || 0))
    : (page - 1) * limit;
  return { page, limit, offset };
}

// Qidiruv so'zi — app-usage.js dagi qoida: kichik harf, `%`/`_`
// foydalanuvchi matnidan olib tashlanadi (aks holda "%" hammani
// qaytarardi). Faqat shu belgilardan iborat so'z — hech narsa topmaydi.
function searchTerm(url) {
  const q = String(url.searchParams.get('q') || '').trim().slice(0, 120);
  const clean = q.toLowerCase().replace(/[%_]/g, '');
  return { q, like: clean ? `%${clean}%` : null, nothing: !!q && !clean };
}

const ms = (H, v) => {
  const d = v ? H.parseDbDate(v) : null;
  return d && !Number.isNaN(d.getTime()) ? d.getTime() : null;
};
const sinceIso = (days) => new Date(Date.now() - days * 86_400_000).toISOString();

async function existingTables(env, names) {
  const marks = names.map(() => '?').join(',');
  const rows = await env.DB.prepare(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name IN (${marks})`
  ).bind(...names).all().catch(() => null);
  return new Set((rows?.results || []).map((r) => String(r.name)));
}

// Foydalanuvchilar va ularning asosiy NFC ID si — sahifadagilar uchun
// BITTA so'rovda (qator boshiga so'rov emas).
async function peopleById(env, ids) {
  const out = new Map();
  const list = [...new Set(ids.map(Number).filter((n) => Number.isInteger(n) && n > 0))];
  if (!list.length) return out;
  const marks = list.map(() => '?').join(',');
  const users = await env.DB.prepare(
    `SELECT id, email, phone, deleted_at FROM users WHERE id IN (${marks})`
  ).bind(...list).all().catch(() => null);
  for (const u of users?.results || []) {
    out.set(Number(u.id), {
      userId: Number(u.id), email: u.email || '', phone: u.phone || '',
      deleted: !!u.deleted_at, code: '', name: '',
    });
  }
  const cards = await env.DB.prepare(
    `SELECT user_id, code, name FROM cards WHERE user_id IN (${marks}) ORDER BY is_primary DESC, ts DESC`
  ).bind(...list).all().catch(() => null);
  for (const c of cards?.results || []) {
    const p = out.get(Number(c.user_id));
    if (p && !p.code) { p.code = String(c.code || ''); p.name = c.name || ''; }
  }
  return out;
}

// ── AVTO-FILTR JURNALI ────────────────────────────────────────────────
// `actor` — `user:<id>` yoki `admin:<rol>` (worker.js `uploadApi`).
async function contentBlocks(env, url, H) {
  const { page, limit, offset } = paging(url);
  const category = String(url.searchParams.get('category') || '').trim().toLowerCase().slice(0, 32);
  const { like, nothing } = searchTerm(url);

  const byCategory = Object.fromEntries(BLOCK_CATEGORY_KEYS.map((k) => [k, 0]));
  const stats = { total: 0, today: 0, last7d: 0, byCategory };
  const empty = () => H.json({ stats, items: [], hasMore: false });

  // Jadvalni yozuvchi (logBlockedUpload) birinchi blokda yaratadi —
  // unga qadar bu yerda bo'sh ro'yxat, xato emas.
  if (!(await existingTables(env, ['content_scan_blocks'])).has('content_scan_blocks')) return empty();
  await env.DB.prepare(
    `CREATE INDEX IF NOT EXISTS idx_content_scan_blocks_time ON content_scan_blocks(created_at DESC)`
  ).run().catch(() => {});

  const totals = await env.DB.prepare(
    `SELECT COUNT(*) AS total,
            SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) AS today,
            SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) AS last7d
       FROM content_scan_blocks`
  ).bind(sinceIso(1), sinceIso(7)).first();
  stats.total = Number(totals?.total || 0);
  stats.today = Number(totals?.today || 0);
  stats.last7d = Number(totals?.last7d || 0);
  const cats = await env.DB.prepare(
    `SELECT category, COUNT(*) AS n FROM content_scan_blocks GROUP BY category`
  ).all();
  for (const r of cats?.results || []) {
    const k = String(r.category || '').toLowerCase() || 'other';
    byCategory[k] = (byCategory[k] || 0) + Number(r.n || 0);
  }

  if (nothing) return H.json({ stats, items: [], hasMore: false });
  const conds = [];
  const binds = [];
  if (category) { conds.push('LOWER(b.category) = ?'); binds.push(category); }
  if (like) {
    conds.push(`(LOWER(b.actor) LIKE ? OR LOWER(COALESCE(b.source,'')) LIKE ?
      OR LOWER(COALESCE(u.email,'')) LIKE ? OR COALESCE(u.phone,'') LIKE ?)`);
    binds.push(like, like, like, like);
  }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const rows = await env.DB.prepare(
    `SELECT b.id, b.actor, b.category, b.source, b.created_at, u.id AS user_id
       FROM content_scan_blocks b
       LEFT JOIN users u ON b.actor LIKE 'user:%' AND u.id = CAST(substr(b.actor, 6) AS INTEGER)
       ${where}
      ORDER BY b.created_at DESC, b.id DESC LIMIT ? OFFSET ?`
  ).bind(...binds, limit + 1, offset).all();
  const all = rows?.results || [];
  const pageRows = all.slice(0, limit);
  const people = await peopleById(env, pageRows.map((r) => r.user_id));

  return H.json({
    stats,
    items: pageRows.map((r) => {
      const actor = String(r.actor || '');
      return {
        id: Number(r.id),
        actor,
        actorKind: actor.startsWith('admin:') ? 'admin' : actor.startsWith('user:') ? 'user' : '',
        user: people.get(Number(r.user_id)) || null,
        category: String(r.category || ''),
        source: String(r.source || ''),
        createdAt: ms(H, r.created_at),
      };
    }),
    hasMore: all.length > limit,
  });
}

// ── ILOVA KONTENTI ────────────────────────────────────────────────────
// Uch manba, bitta ro'yxat: shaxsiy post (`posts`), biznes posti
// (`company_posts`), istoriya (`stories`, shaxsiy va biznes). Ustunlar
// LENTA bilan bir xil (worker.js `FEED_UNION_SQL`), lekin maxfiylik
// filtri YO'Q: admin katalogdan yashiringan profilning kontentini ham
// ko'rishi kerak — moderatsiya aynan shuni talab qiladi.
const APP_CONTENT_KINDS = ['post', 'reel', 'story', 'company_post'];

function contentBranches(kind, have, now) {
  const all = !APP_CONTENT_KINDS.includes(kind);
  const branches = [];
  const binds = [];
  // HAR SHOX O'Z TAXALLUSLARI BILAN: UNION ustun nomlarini BIRINCHI
  // shoxdan oladi, filtr esa istalgan shoxni birinchi qilib qo'yishi
  // mumkin (masalan, faqat istoriya).
  const video = (col) => `COALESCE(${col}, '') <> ''`;
  const noVideo = (col) => `COALESCE(${col}, '') = ''`;

  if (all || kind === 'post' || kind === 'reel') {
    const cond = all ? '1 = 1' : kind === 'reel' ? video('p.video_url') : noVideo('p.video_url');
    branches.push(`SELECT 'post' AS src, p.id AS id, CAST(p.code AS TEXT) AS owner_id, 'card' AS author_kind,
        c.name AS name, CAST(COALESCE(p.user_id, c.user_id) AS TEXT) AS user_id,
        p.image_url AS image_url, p.video_url AS video_url, p.caption AS caption,
        p.created_at AS created_at, NULL AS expires_at,
        (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id) AS like_count, 0 AS view_count
      FROM posts p LEFT JOIN cards c ON c.code = p.code
     WHERE ${cond}`);
  }
  if (have.has('company_posts') && (all || kind === 'company_post' || kind === 'reel')) {
    const cond = kind === 'reel' ? video('cp.video_url') : '1 = 1';
    branches.push(`SELECT 'company_post' AS src, cp.id AS id, CAST(cp.company_id AS TEXT) AS owner_id,
        'company' AS author_kind, co.display_name AS name, CAST(co.owner_user_id AS TEXT) AS user_id,
        cp.image_url AS image_url, cp.video_url AS video_url, cp.caption AS caption,
        cp.created_at AS created_at, NULL AS expires_at, 0 AS like_count, 0 AS view_count
      FROM company_posts cp LEFT JOIN companies co ON co.company_id = cp.company_id
     WHERE ${cond}`);
  }
  if (have.has('stories') && (all || kind === 'story')) {
    branches.push(`SELECT 'story' AS src, s.id AS id, CAST(s.owner_id AS TEXT) AS owner_id,
        s.owner_kind AS author_kind, COALESCE(c.name, co.display_name) AS name,
        CAST(COALESCE(s.user_id, c.user_id, co.owner_user_id) AS TEXT) AS user_id,
        s.image_url AS image_url, s.video_url AS video_url, s.caption AS caption,
        s.created_at AS created_at, s.expires_at AS expires_at,
        ${have.has('story_likes') ? '(SELECT COUNT(*) FROM story_likes sl WHERE sl.story_id = s.id)' : '0'} AS like_count,
        ${have.has('story_views') ? '(SELECT COUNT(*) FROM story_views sv WHERE sv.story_id = s.id)' : '0'} AS view_count
      FROM stories s
      LEFT JOIN cards c ON s.owner_kind = 'card' AND c.code = s.owner_id
      LEFT JOIN companies co ON s.owner_kind = 'company' AND co.company_id = s.owner_id
     WHERE s.expires_at > ?`);
    binds.push(now);
  }
  return { branches, binds };
}

async function countOf(env, sql, ...binds) {
  const r = await env.DB.prepare(sql).bind(...binds).first().catch(() => null);
  return Number(r?.n || 0);
}

async function appContent(env, url, H) {
  const { page, limit, offset } = paging(url, 30);
  const kind = String(url.searchParams.get('kind') || '').trim().toLowerCase();
  const { q, like, nothing } = searchTerm(url);
  const now = new Date().toISOString();
  const have = await existingTables(env, ['company_posts', 'stories', 'story_likes', 'story_views']);

  const stats = {
    posts: await countOf(env, `SELECT COUNT(*) AS n FROM posts WHERE COALESCE(video_url, '') = ''`),
    reels: await countOf(env, `SELECT COUNT(*) AS n FROM posts WHERE COALESCE(video_url, '') <> ''`)
      + (have.has('company_posts')
        ? await countOf(env, `SELECT COUNT(*) AS n FROM company_posts WHERE COALESCE(video_url, '') <> ''`)
        : 0),
    stories: have.has('stories') ? await countOf(env, `SELECT COUNT(*) AS n FROM stories WHERE expires_at > ?`, now) : 0,
    companyPosts: have.has('company_posts') ? await countOf(env, `SELECT COUNT(*) AS n FROM company_posts`) : 0,
  };

  const { branches, binds } = contentBranches(kind, have, now);
  if (nothing || !branches.length) return H.json({ stats, items: [], hasMore: false });

  // Qidiruv: matn, NFC ID / Business ID, profil yoki biznes nomi,
  // muallifning email/telefoni, yoki kontent raqamining o'zi.
  const conds = [];
  const qBinds = [];
  if (like) {
    conds.push(`(LOWER(COALESCE(x.caption,'')) LIKE ? OR LOWER(x.owner_id) LIKE ?
      OR LOWER(COALESCE(x.name,'')) LIKE ? OR CAST(x.id AS TEXT) = ?
      OR x.user_id IN (SELECT CAST(u.id AS TEXT) FROM users u
                        WHERE LOWER(COALESCE(u.email,'')) LIKE ? OR COALESCE(u.phone,'') LIKE ?))`);
    qBinds.push(like, like, like, q, like, like);
  }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  // Sana ikki xil shaklda saqlanadi ("2026-09-01 10:00:00" va ISO
  // "2026-09-01T10:00:00Z") — `T` bo'shliqqa almashtirilib saralanadi,
  // aks holda bir kun ichida shakllar aralashib ketardi.
  const rows = await env.DB.prepare(
    `SELECT * FROM (${branches.join('\n UNION ALL \n')}) x
     ${where}
     ORDER BY REPLACE(x.created_at, 'T', ' ') DESC, x.id DESC
     LIMIT ? OFFSET ?`
  ).bind(...binds, ...qBinds, limit + 1, offset).all();
  const all = rows?.results || [];
  const pageRows = all.slice(0, limit);

  const people = await peopleById(env, pageRows.map((r) => r.user_id));
  const commentKind = (r) => (String(r.src) === 'story'
    ? (String(r.author_kind) === 'company' ? 'company_story' : 'story')
    : String(r.src));
  const comments = await countsFor(env, pageRows.map((r) => ({ kind: commentKind(r), id: Number(r.id) })))
    .catch(() => new Map());
  const companyLikes = await likesFor(env, pageRows
    .filter((r) => String(r.src) === 'company_post')
    .map((r) => ({ kind: 'company_post', id: Number(r.id) }))).catch(() => new Map());

  return H.json({
    stats,
    items: pageRows.map((r) => {
      const src = String(r.src);
      const isVideo = !!String(r.video_url || '');
      const caption = String(r.caption || '');
      const likes = src === 'company_post'
        ? (companyLikes.get(`company_post:${Number(r.id)}`)?.count || 0)
        : Number(r.like_count || 0);
      return {
        id: Number(r.id),
        // Ko'rinadigan tur: videoli post — Reels.
        kind: src === 'story' ? 'story' : isVideo ? 'reel' : src,
        source: src,
        // `DELETE /api/admin/content/:deleteKind/:id` uchun.
        deleteKind: src,
        isVideo,
        author: {
          kind: String(r.author_kind) === 'company' ? 'company' : 'card',
          id: String(r.owner_id || ''),
          name: r.name || '',
          user: people.get(Number(r.user_id)) || null,
        },
        imageUrl: r.image_url || '',
        videoUrl: r.video_url || '',
        text: caption.length > 300 ? `${caption.slice(0, 300)}…` : caption,
        likes,
        comments: comments.get(`${commentKind(r)}:${Number(r.id)}`) || 0,
        views: src === 'story' ? Number(r.view_count || 0) : null,
        createdAt: ms(H, r.created_at),
        expiresAt: r.expires_at ? ms(H, r.expires_at) : null,
      };
    }),
    hasMore: all.length > limit,
  });
}

// ── BIZNES KATALOGI BUYURTMALARI ──────────────────────────────────────
// Jadval worker.js `ensureCompanyExtrasSchema` da; egasi o'z buyurtmasini
// `GET /api/companies/:id/orders` bilan ko'radi. Bu yerda — hammasi.
async function companyOrders(env, url, H) {
  const { page, limit, offset } = paging(url);
  const status = String(url.searchParams.get('status') || '').trim().toLowerCase();
  const { like, nothing } = searchTerm(url);
  const stats = { total: 0, new: 0, last7d: 0 };

  const have = await existingTables(env, ['company_orders', 'companies']);
  if (!have.has('company_orders')) return H.json({ stats, items: [], hasMore: false });

  const totals = await env.DB.prepare(
    `SELECT COUNT(*) AS total,
            SUM(CASE WHEN COALESCE(status, 'new') = 'new' THEN 1 ELSE 0 END) AS fresh,
            SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) AS last7d
       FROM company_orders`
  ).bind(sinceIso(7)).first();
  stats.total = Number(totals?.total || 0);
  stats.new = Number(totals?.fresh || 0);
  stats.last7d = Number(totals?.last7d || 0);
  if (nothing) return H.json({ stats, items: [], hasMore: false });

  const withCompany = have.has('companies');
  const conds = [];
  const binds = [];
  if (ORDER_STATUSES.includes(status)) { conds.push(`COALESCE(o.status, 'new') = ?`); binds.push(status); }
  if (like) {
    conds.push(`(LOWER(o.company_id) LIKE ? OR LOWER(COALESCE(o.item_name,'')) LIKE ?
      OR LOWER(COALESCE(o.customer_name,'')) LIKE ? OR COALESCE(o.customer_phone,'') LIKE ?
      ${withCompany ? `OR LOWER(COALESCE(co.display_name,'')) LIKE ?` : ''})`);
    binds.push(like, like, like, like);
    if (withCompany) binds.push(like);
  }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const rows = await env.DB.prepare(
    `SELECT o.*, ${withCompany ? 'co.display_name AS company_name, co.owner_user_id AS owner_user_id' : `'' AS company_name, NULL AS owner_user_id`}
       FROM company_orders o
       ${withCompany ? 'LEFT JOIN companies co ON co.company_id = o.company_id' : ''}
       ${where}
      ORDER BY o.created_at DESC, o.id DESC LIMIT ? OFFSET ?`
  ).bind(...binds, limit + 1, offset).all();
  const all = rows?.results || [];
  const pageRows = all.slice(0, limit);
  const owners = await peopleById(env, pageRows.map((r) => r.owner_user_id));

  return H.json({
    stats,
    items: pageRows.map((r) => ({
      id: Number(r.id),
      company: {
        id: String(r.company_id || ''),
        name: r.company_name || '',
        owner: owners.get(Number(r.owner_user_id)) || null,
      },
      itemId: r.item_id || '',
      itemName: r.item_name || '',
      qty: Number(r.qty || 1),
      price: Number(r.price || 0),
      customerName: r.customer_name || '',
      customerPhone: r.customer_phone || '',
      note: r.note || '',
      status: r.status || 'new',
      createdAt: ms(H, r.created_at),
    })),
    hasMore: all.length > limit,
  });
}

const ROUTES = {
  '/api/admin/content-blocks': contentBlocks,
  '/api/admin/app-content': appContent,
  '/api/admin/company-orders': companyOrders,
};

export async function handle(request, env, url, H) {
  const route = ROUTES[url.pathname];
  if (!route) return null;
  if (request.method !== 'GET') return H.json({ error: 'method_not_allowed' }, 405);
  const admin = await H.requireAdmin(request, env);
  if (!admin) return H.json({ error: 'unauthorized' }, 401);
  return route(env, url, H);
}
