// hosting/api/comments.js — CONTRACT.md ga qarang. Route topilmasa null qaytaradi.
//
// IZOHLAR. Lentada va Reels'da yoqtirish bor edi, javob yozish esa
// yo'q: odam ko'rgan narsasiga faqat yurak qo'yishi mumkin edi.
// Biznes uchun bu ayniqsa og'ir — "narxi qancha?" degan savolni
// yozadigan joy yo'q, ya'ni har bir savol yo'qolgan mijoz.
//
// BITTA JADVAL, TO'RT XIL KONTENT. Lenta to'rt manbadan yig'iladi
// (shaxsiy post, kompaniya posti, shaxsiy istorya, kompaniya
// istoryasi), shuning uchun izoh jadvali ham `target_kind` +
// `target_id` juftligi bilan ishlaydi. Har biriga alohida jadval
// ochish — to'rt marta bir xil kod degani.
//
// Marshrutlar:
//   GET    /api/comments/:kind/:id       (ixtiyoriy auth) ?page=&limit= → { comments, hasMore, total }
//   POST   /api/comments/:kind/:id       (auth) { body } → 201 { comment, total }
//   DELETE /api/comments/:id             (auth: muallif YOKI kontent egasi) → { ok, total }
//
// :kind — post | company_post | story | company_story
//
// O'CHIRISH HUQUQI IKKI TOMONLAMA: izohni yozgan odam ham,
// kontentning EGASI ham o'chira oladi. Egasisiz — o'z posti ostidagi
// haqoratni olib tashlay olmaydi; muallifsiz — o'z so'zini qaytarib
// ololmaydi.

import { createNotification } from './notifications.js';

const KINDS = ['post', 'company_post', 'story', 'company_story'];

// Izoh uzunligi. Instagram'da 2200 — bu yerda 1000 yetarli va
// bitta izoh ekranni butunlay egallab ketmaydi.
const MAX_LEN = 1000;

// Spamga qarshi: bir odam bir daqiqada nechta izoh yoza oladi.
const MAX_PER_MIN = 10;
const MIN_MS = 60_000;

const PAGE_MAX = 50;

let schemaReady = null;

// Jadval KERAK BO'LGANDA yaratiladi — moderation.js bilan bir xil
// yondashuv (worker'da alohida migratsiya bosqichi yo'q).
async function ensureSchema(env) {
  if (!schemaReady) {
    schemaReady = env.DB.batch([
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS "content_comments" (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        target_kind TEXT NOT NULL,
        target_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        author_code TEXT NOT NULL DEFAULT '',
        body TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`),
      // Asosiy so'rov: "shu kontentning izohlari, yangisi yuqorida".
      env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_comments_target ON content_comments(target_kind, target_id, created_at DESC)`),
      // "Mening izohlarim" va o'chirish tekshiruvi uchun.
      env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_comments_user ON content_comments(user_id)`),
      // Reels'dagi kompaniya post/story like'lari. Shaxsiy kontentning
      // eski like jadvallariga tegmaydi; tur + id juftligi bilan
      // kompaniya post va story ID'lari to'qnashmaydi.
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS "content_likes" (
        target_kind TEXT NOT NULL,
        target_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (target_kind, target_id, user_id)
      )`),
      env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_content_likes_target
        ON content_likes(target_kind, target_id)`),
    ]).catch(() => {});
  }
  await schemaReady;
}

async function readJson(request) {
  const b = await request.json().catch(() => null);
  return b && typeof b === 'object' && !Array.isArray(b) ? b : {};
}

/// Izoh matni. Ko'p qatorli bo'lishi mumkin, lekin ketma-ket
/// uchtadan ortiq bo'sh qator — ekranni cho'zish uchun ishlatiladigan
/// eski hiyla — ikkitaga qisqartiriladi.
function cleanBody(v) {
  return String(v ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MAX_LEN);
}

/// Kontent BOR-YO'QLIGI va EGASI. Yo'q kontentga izoh yozib
/// bo'lmaydi (aks holda jadval "yetim" yozuvlar bilan to'lardi), va
/// o'chirish huquqini tekshirish uchun ham egasi kerak.
///
/// Qaytadi: `{ ok, ownerUserId, ownerCode }` yoki `{ ok: false }`.
async function targetOwner(env, kind, id) {
  if (kind === 'post') {
    const row = await env.DB.prepare(
      `SELECT p.code AS code, c.user_id AS user_id FROM posts p JOIN cards c ON c.code = p.code WHERE p.id = ?`
    ).bind(id).first();
    return row ? { ok: true, ownerUserId: Number(row.user_id) || 0, ownerCode: String(row.code || '') } : { ok: false };
  }
  if (kind === 'story') {
    const row = await env.DB.prepare(
      `SELECT s.owner_id AS code, c.user_id AS user_id FROM stories s JOIN cards c ON c.code = s.owner_id
        WHERE s.id = ? AND s.owner_kind = 'card'`
    ).bind(id).first();
    return row ? { ok: true, ownerUserId: Number(row.user_id) || 0, ownerCode: String(row.code || '') } : { ok: false };
  }
  if (kind === 'company_post') {
    const row = await env.DB.prepare(
      `SELECT cp.company_id AS code, co.owner_user_id AS user_id
         FROM company_posts cp JOIN companies co ON co.company_id = cp.company_id WHERE cp.id = ?`
    ).bind(id).first();
    return row ? { ok: true, ownerUserId: Number(row.user_id) || 0, ownerCode: String(row.code || '') } : { ok: false };
  }
  if (kind === 'company_story') {
    const row = await env.DB.prepare(
      `SELECT s.owner_id AS code, co.owner_user_id AS user_id
         FROM stories s JOIN companies co ON co.company_id = s.owner_id
        WHERE s.id = ? AND s.owner_kind = 'company'`
    ).bind(id).first();
    return row ? { ok: true, ownerUserId: Number(row.user_id) || 0, ownerCode: String(row.code || '') } : { ok: false };
  }
  return { ok: false };
}

/// Izoh muallifining KO'RSATILADIGAN nomi. Odamning asosiy kartasi
/// (`is_primary`) — ismi va rasmi shu yerdan olinadi. Kartasi
/// bo'lmasa (hali sotib olmagan foydalanuvchi) — e-pochtaning
/// birinchi qismi, chunki izoh muallifsiz turmasligi kerak.
async function authorOf(env, userId) {
  const card = await env.DB.prepare(
    `SELECT code, name, avatar_url FROM cards
      WHERE user_id = ? AND COALESCE(status,'approved') <> 'deleted'
      ORDER BY is_primary DESC, ts ASC LIMIT 1`
  ).bind(userId).first().catch(() => null);
  if (card) {
    return {
      code: String(card.code || '').toUpperCase(),
      name: String(card.name || card.code || ''),
      avatarUrl: card.avatar_url || '',
    };
  }
  const u = await env.DB.prepare(`SELECT email FROM users WHERE id = ?`).bind(userId).first().catch(() => null);
  const email = String(u?.email || '');
  return { code: '', name: email ? email.split('@')[0] : 'NFCSTORE', avatarUrl: '' };
}

const rowToComment = (r, viewerId) => ({
  id: Number(r.id),
  targetKind: String(r.target_kind),
  targetId: Number(r.target_id),
  code: String(r.author_code || '').toUpperCase(),
  name: String(r.name || r.author_code || ''),
  avatarUrl: r.avatar_url || '',
  body: String(r.body || ''),
  createdAt: Date.parse(String(r.created_at).replace(' ', 'T')) || Date.now(),
  // Ilova "o'chirish" tugmasini shu bayroqqa qarab ko'rsatadi —
  // huquqni BARIBIR server tekshiradi, bu faqat ko'rinish uchun.
  mine: !!viewerId && Number(r.user_id) === Number(viewerId),
});

async function countFor(env, kind, id) {
  const r = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM content_comments WHERE target_kind = ? AND target_id = ?`
  ).bind(kind, id).first();
  return Number(r?.n) || 0;
}

/// Bir nechta kontent uchun izohlar soni — LENTA uchun.
///
/// Lentada har bir kadr ostida "izohlar: 12" turishi kerak. Har bir
/// kadrga alohida so'rov — 15 ta so'rov degani; shuning uchun
/// worker lentani yig'ib bo'lgach BITTA marta shu yerga murojaat
/// qiladi.
export async function countsFor(env, targets) {
  if (!targets.length) return new Map();
  await ensureSchema(env);
  const out = new Map();
  // SQLite parametrlari soni cheklangan, lenta sahifasi esa ≤30 —
  // shuning uchun bitta so'rov yetadi.
  const where = targets.map(() => '(target_kind = ? AND target_id = ?)').join(' OR ');
  const args = targets.flatMap((t) => [t.kind, t.id]);
  const rows = await env.DB.prepare(
    `SELECT target_kind, target_id, COUNT(*) AS n FROM content_comments
      WHERE ${where} GROUP BY target_kind, target_id`
  ).bind(...args).all().catch(() => null);
  for (const r of rows?.results || []) out.set(`${r.target_kind}:${Number(r.target_id)}`, Number(r.n) || 0);
  return out;
}

/// Kontent layklari — lenta/profil uchun guruhlab.
export async function likesFor(env, targets, viewerId = 0) {
  const out = new Map();
  if (!targets.length) return out;
  await ensureSchema(env);
  const where = targets.map(() => '(target_kind = ? AND target_id = ?)').join(' OR ');
  const args = targets.flatMap((t) => [t.kind, t.id]);
  const rows = await env.DB.prepare(
    `SELECT target_kind, target_id, COUNT(*) AS n,
            MAX(CASE WHEN user_id = ? THEN 1 ELSE 0 END) AS liked
       FROM content_likes
      WHERE ${where}
      GROUP BY target_kind, target_id`
  ).bind(Number(viewerId) || 0, ...args).all().catch(() => null);
  for (const r of rows?.results || []) {
    out.set(`${r.target_kind}:${Number(r.target_id)}`, {
      count: Number(r.n) || 0,
      liked: !!r.liked,
    });
  }
  return out;
}

export async function deleteLikesFor(env, kind, id) {
  await ensureSchema(env);
  await env.DB.prepare(
    `DELETE FROM content_likes WHERE target_kind = ? AND target_id = ?`
  ).bind(kind, id).run();
}

export async function handle(request, env, url, H) {
  const path = url.pathname;

  // ── KONTENT LIKE ────────────────────────────────────────────────
  // GET/POST /api/content-likes/:kind/:id
  //
  // Bu yo'l ayniqsa kompaniya post/storylari uchun kerak: ularning
  // ID'lari shaxsiy post jadvalidagi ID bilan bir xil bo'lishi mumkin,
  // shuning uchun /api/posts/:id/like ga yuborish noto'g'ri kontentni
  // yoqtirib qo'yishi mumkin edi.
  const likeMatch = path.match(/^\/api\/content-likes\/([a-z_]+)\/(\d+)$/);
  if (likeMatch && (request.method === 'GET' || request.method === 'POST')) {
    const kind = likeMatch[1];
    const id = Number(likeMatch[2]);
    if (!KINDS.includes(kind)) return H.json({ error: 'bad_kind' }, 422);
    await ensureSchema(env);

    const target = await targetOwner(env, kind, id);
    if (!target.ok) return H.json({ error: 'not_found' }, 404);

    const user = await H.getCurrentUser(request, env).catch(() => null);
    const count = async () => {
      const row = await env.DB.prepare(
        `SELECT COUNT(*) AS n FROM content_likes WHERE target_kind = ? AND target_id = ?`
      ).bind(kind, id).first();
      return Number(row?.n) || 0;
    };

    if (request.method === 'GET') {
      let liked = false;
      if (user) {
        const mine = await env.DB.prepare(
          `SELECT 1 AS x FROM content_likes WHERE target_kind = ? AND target_id = ? AND user_id = ?`
        ).bind(kind, id, user.id).first();
        liked = !!mine;
      }
      return H.json({ liked, count: await count() });
    }

    if (!user) return H.json({ error: 'unauthorized' }, 401);
    if (await H.rateLimitD1(env, `like:u:${user.id}`, 120, 60_000)) {
      return H.json({ error: 'too_many_requests' }, 429);
    }

    const existing = await env.DB.prepare(
      `SELECT 1 AS x FROM content_likes WHERE target_kind = ? AND target_id = ? AND user_id = ?`
    ).bind(kind, id, user.id).first();

    if (existing) {
      await env.DB.prepare(
        `DELETE FROM content_likes WHERE target_kind = ? AND target_id = ? AND user_id = ?`
      ).bind(kind, id, user.id).run();
      return H.json({ liked: false, count: await count() });
    }

    await env.DB.prepare(
      `INSERT OR IGNORE INTO content_likes (target_kind, target_id, user_id, created_at)
       VALUES (?, ?, ?, ?)`
    ).bind(kind, id, user.id, H.nowTs()).run();
    return H.json({ liked: true, count: await count() });
  }

  // ── RO'YXAT ─────────────────────────────────────────────────────
  const listMatch = path.match(/^\/api\/comments\/([a-z_]+)\/(\d+)$/);
  if (listMatch && request.method === 'GET') {
    const kind = listMatch[1];
    const id = Number(listMatch[2]);
    if (!KINDS.includes(kind)) return H.json({ error: 'bad_kind' }, 422);
    await ensureSchema(env);

    const target = await targetOwner(env, kind, id);
    if (!target.ok) return H.json({ error: 'not_found' }, 404);

    const user = await H.getCurrentUser(request, env).catch(() => null);
    const viewerId = user ? user.id : 0;
    const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
    const limit = Math.min(PAGE_MAX, Math.max(1, Number(url.searchParams.get('limit')) || 20));

    // `limit + 1` — keyingi sahifa bor-yo'qligini bitta so'rov bilan
    // bilish uchun (lenta bilan bir xil usul).
    //
    // MUALLIF NOMI JOIN ORQALI: izoh yozilgandan keyin odam ismini
    // o'zgartirsa, eski izohlarda ESKI ism qolib ketmasin.
    const rows = await env.DB.prepare(
      `SELECT cc.*, c.name AS name, c.avatar_url AS avatar_url
         FROM content_comments cc
         LEFT JOIN cards c ON c.code = cc.author_code
        WHERE cc.target_kind = ? AND cc.target_id = ?
        ORDER BY cc.created_at DESC, cc.id DESC
        LIMIT ? OFFSET ?`
    ).bind(kind, id, limit + 1, (page - 1) * limit).all();

    const all = rows.results || [];
    return H.json({
      comments: all.slice(0, limit).map((r) => rowToComment(r, viewerId)),
      hasMore: all.length > limit,
      total: await countFor(env, kind, id),
    });
  }

  // ── YOZISH ──────────────────────────────────────────────────────
  if (listMatch && request.method === 'POST') {
    const kind = listMatch[1];
    const id = Number(listMatch[2]);
    if (!KINDS.includes(kind)) return H.json({ error: 'bad_kind' }, 422);
    await ensureSchema(env);

    // KIRISH SHART. Shikoyatdan farqli o'laroq, izoh ommaga
    // KO'RINADI va ostida ism turadi — ya'ni javobgar odam bo'lishi
    // kerak. Anonim izoh spamning ochiq eshigi.
    const user = await H.getCurrentUser(request, env).catch(() => null);
    if (!user) return H.json({ error: 'unauthorized' }, 401);

    // Bloklangan (banned) foydalanuvchi yoza olmaydi — u boshqa
    // joyda ham yoza olmaydi, izoh istisno bo'lmasligi kerak.
    if (user.bannedUntil && Date.parse(String(user.bannedUntil).replace(' ', 'T')) > Date.now()) {
      return H.json({ error: 'banned' }, 403);
    }

    // IZOH — FAQAT PREMIUM OBUNACHILARGA (egasining qarori).
    //
    // NIMA UCHUN SERVERDA, ILOVADA EMAS: ilovada maydonni yashirish
    // — bu faqat KO'RINISH. So'rovni qo'lda yuborgan odam baribir
    // izoh yozardi. Qoida shu yerda turmasa, u qoida emas.
    //
    // O'QISH OCHIQ QOLADI: izohlarni hamma ko'radi. Cheklov faqat
    // YOZISHDA — aks holda lentada gap ketayotgani bilinmay qolardi
    // va Premium olishning ma'nosi ham ko'rinmasdi.
    if (!user.isPremium) return H.json({ error: 'premium_required' }, 403);

    const target = await targetOwner(env, kind, id);
    if (!target.ok) return H.json({ error: 'not_found' }, 404);

    if (await H.rateLimitD1(env, `cmt:u:${user.id}`, MAX_PER_MIN, MIN_MS)) {
      return H.json({ error: 'too_many_requests' }, 429);
    }

    const body = cleanBody((await readJson(request)).body);
    if (!body) return H.json({ error: 'empty' }, 422);

    const author = await authorOf(env, user.id);
    const now = H.nowTs();
    const ins = await env.DB.prepare(
      `INSERT INTO content_comments (target_kind, target_id, user_id, author_code, body, created_at)
       VALUES (?,?,?,?,?,?) RETURNING id`
    ).bind(kind, id, user.id, author.code, body, now).first();

    // Bildirishnoma — izoh YOZILGANDAN keyin, javobdan oldin.
    //
    // `targetType: 'comment'` va `targetId` AYNAN izoh ID'si:
    // shuning uchun ikkita alohida izoh ikkita bildirishnoma
    // beradi (to'g'ri), takroriy so'rov esa yangi izoh yaratmagani
    // uchun takroriy xabar ham bermaydi.
    //
    // Xatosi yutiladi: bildirishnoma yozilmagani uchun odamning
    // izohi yo'qolib ketishi mumkin emas.
    await createNotification(env, {
      recipientUserId: target.ownerUserId,
      actorUserId: user.id,
      kind: 'comment',
      targetType: 'comment',
      targetId: Number(ins?.id) || 0,
      targetCode: target.ownerCode || '',
      now,
    });

    return H.json({
      comment: {
        id: Number(ins?.id) || 0,
        targetKind: kind,
        targetId: id,
        code: author.code,
        name: author.name,
        avatarUrl: author.avatarUrl,
        body,
        createdAt: Date.parse(String(now).replace(' ', 'T')) || Date.now(),
        mine: true,
      },
      total: await countFor(env, kind, id),
    }, 201);
  }

  // ── O'CHIRISH ───────────────────────────────────────────────────
  const delMatch = path.match(/^\/api\/comments\/(\d+)$/);
  if (delMatch && request.method === 'DELETE') {
    await ensureSchema(env);
    const user = await H.getCurrentUser(request, env).catch(() => null);
    if (!user) return H.json({ error: 'unauthorized' }, 401);

    const row = await env.DB.prepare(`SELECT * FROM content_comments WHERE id = ?`).bind(Number(delMatch[1])).first();
    if (!row) return H.json({ error: 'not_found' }, 404);

    const target = await targetOwner(env, String(row.target_kind), Number(row.target_id));
    const isAuthor = Number(row.user_id) === Number(user.id);
    const isOwner = target.ok && Number(target.ownerUserId) === Number(user.id);
    if (!isAuthor && !isOwner) return H.json({ error: 'forbidden' }, 403);

    await env.DB.prepare(`DELETE FROM content_comments WHERE id = ?`).bind(Number(row.id)).run();
    return H.json({ ok: true, total: await countFor(env, String(row.target_kind), Number(row.target_id)) });
  }

  return null;
}
