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
//   GET    /api/admin/comments           (admin) ?state=&q=&page=&limit= → { comments, hasMore, total }
//   DELETE /api/admin/comments/:id       (admin) { reason } → { ok }
//   POST   /api/admin/comments/:id/restore (admin) → { ok }
//   GET    /api/admin/comments/archive   (admin) ?page=&limit= → { items, hasMore }
//
// :kind — post | company_post | story | company_story
//
// O'CHIRISH HUQUQI IKKI TOMONLAMA: izohni yozgan odam ham,
// kontentning EGASI ham o'chira oladi. Egasisiz — o'z posti ostidagi
// haqoratni olib tashlay olmaydi; muallifsiz — o'z so'zini qaytarib
// ololmaydi.
//
// ── O'CHIRISH YO'Q QILISH EMAS ──────────────────────────────────
//
// Izoh o'chirilganda qator JADVALDAN OLIB TASHLANMAYDI: unga
// `deleted_at` qo'yiladi va u ommadan yo'qoladi. Buning USTIGA
// to'liq nusxasi `content_comment_archive` ga yoziladi.
//
// NIMA UCHUN. Haqorat yoki tahdid yozgan odam uni o'zi o'chirib
// yuborishi mumkin — va shundan keyin "men bunday yozmadim" deyishi
// mumkin. Qator DELETE qilingan bo'lsa, bizda javob yo'q: shikoyat
// qilgan odamning so'zi bilan haqorat qilganning so'zi teng bo'lib
// qoladi. Arxiv aynan shu holat uchun: kim, kimga, qachon, nima
// yozgan va uni kim o'chirgan.
//
// Arxiv MODERATSIYA UCHUN, ko'rgazma uchun emas: unga faqat admin
// kira oladi va u ommaviy hech bir javobda chiqmaydi.
//
// TIKLASH (`restore`) live qatordagi `deleted_at` ni tozalaydi,
// LEKIN arxiv yozuvini o'chirmaydi — unga `restored_at` qo'yiladi.
// Aks holda "o'chirildi, keyin tiklandi" degan voqea izsiz
// yo'qolardi.

import { createNotification } from './notifications.js';

export const KINDS = ['post', 'company_post', 'story', 'company_story'];

/// LIKE QO'YISA BO'LADIGAN TURLAR.
///
/// `KINDS` dan farq qiladi: izohning O'ZIGA ham like qo'yiladi,
/// lekin izohga izoh yozib bo'lmaydi. Ikkalasini bitta ro'yxatda
/// saqlash `POST /api/comments/comment/5` kabi ma'nosiz yo'lni
/// ochib qo'yardi.
export const LIKE_KINDS = [...KINDS, 'comment'];

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
export async function ensureSchema(env) {
  if (!schemaReady) {
    // ESKI BAZADA JADVAL ALLAQACHON BOR.
    //
    // `CREATE TABLE IF NOT EXISTS` mavjud jadvalga yangi ustun
    // QO'SHMAYDI — u shunchaki hech narsa qilmaydi. Shuning uchun
    // `parent_id` alohida `ALTER TABLE` bilan qo'shiladi.
    //
    // Xatosi ataylab yutiladi: ustun allaqachon bo'lsa SQLite
    // "duplicate column name" beradi va bu NORMAL holat. Boshqa
    // hech narsa o'chirilmaydi, o'zgartirilmaydi — faqat qo'shiladi.
    await env.DB.prepare(
      `ALTER TABLE content_comments ADD COLUMN parent_id INTEGER`
    ).run().catch(() => {});
    schemaReady = env.DB.batch([
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS "content_comments" (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        target_kind TEXT NOT NULL,
        target_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        author_code TEXT NOT NULL DEFAULT '',
        body TEXT NOT NULL,
        created_at TEXT NOT NULL,
        -- JAVOB BO'LSA — OTA IZOH ID'si. Bir qavat: javobga javob
        -- yozib bo'lmaydi (pastda tekshiriladi). Instagram ham
        -- shunday: ikki qavatdan chuquri o'qilmay qoladi.
        parent_id INTEGER
      )`),
      // Asosiy so'rov: "shu kontentning izohlari, yangisi yuqorida".
      env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_comments_target ON content_comments(target_kind, target_id, created_at DESC)`),
      // Javoblarni ota izoh bo'yicha yig'ish uchun.
      env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_comments_parent ON content_comments(parent_id)`),
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

      // DALIL ARXIVI. O'chirilgan izohning to'liq nusxasi.
      //
      // Bu jadval `content_comments` ga BOG'LANMAGAN (foreign key
      // yo'q): post yoki kompaniya butunlay o'chirilganda izohlar
      // ham tozalanadi, arxiv esa QOLISHI kerak — aks holda eng
      // og'ir holatlarda (egasi postni o'chirib, izlarni yashirsa)
      // dalil ham birga ketardi.
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS "content_comment_archive" (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        comment_id INTEGER NOT NULL,
        target_kind TEXT NOT NULL,
        target_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        author_code TEXT NOT NULL DEFAULT '',
        body TEXT NOT NULL,
        created_at TEXT NOT NULL,
        deleted_at TEXT NOT NULL,
        deleted_by_user_id INTEGER NOT NULL DEFAULT 0,
        deleted_by_admin TEXT NOT NULL DEFAULT '',
        reason TEXT NOT NULL DEFAULT '',
        restored_at TEXT
      )`),
      env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_cmt_archive_time
        ON content_comment_archive(deleted_at DESC)`),
      env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_cmt_archive_comment
        ON content_comment_archive(comment_id)`),
    ]).catch(() => {});

    // QO'SHIMCHA USTUNLAR — `batch()` DA EMAS, ATAYLAB.
    //
    // `batch()` atomik: allaqachon mavjud ustun uchun chiqqan
    // bitta "duplicate column name" xatosi BUTUN to'plamni
    // yiqitardi — ya'ni production'da birinchi deploydan keyin
    // izohlar umuman ishlamay qolardi. `worker.js` dagi
    // `ensureAdminAuthTables` ham aynan shu sababli `Promise.all`
    // ishlatadi.
    //
    // `CREATE TABLE IF NOT EXISTS` bu ustunlarni QO'SHA OLMAYDI:
    // jadval production'da allaqachon bor, ya'ni u buyruq oddiy
    // no-op bo'ladi.
    schemaReady = schemaReady.then(() => Promise.all([
      `ALTER TABLE content_comments ADD COLUMN deleted_at TEXT`,
      `ALTER TABLE content_comments ADD COLUMN deleted_by_user_id INTEGER`,
      `ALTER TABLE content_comments ADD COLUMN deleted_reason TEXT`,
    ].map((stmt) => env.DB.prepare(stmt).run().catch(() => {}))))
      // Indeks ustun paydo bo'lgandan KEYIN — aks holda u
      // "no such column" bilan yiqilardi.
      .then(() => env.DB.prepare(
        `CREATE INDEX IF NOT EXISTS idx_comments_deleted
           ON content_comments(deleted_at)`
      ).run().catch(() => {}));
  }
  await schemaReady;
}

/// TIRIK IZOH sharti.
///
/// Bitta joyda turadi: ro'yxat, sanoq va lenta sanog'i uchun ayni
/// shart ishlatiladi. Uch joyda uchta nusxa bo'lsa, biri
/// yangilanmay qolib, o'chirilgan izoh "izohlar: 12" sanog'ida
/// ko'rinib turardi.
const ALIVE = `deleted_at IS NULL`;

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
/// KONTENT EGASI — to'rt turdagi kontent uchun bitta javob.
///
/// EKSPORT QILINGAN, chunki `featured.js` ham AYNAN shu savolni
/// beradi: "bu postni ko'targan odam uning egasimi?". Nusxa
/// olinsa, yangi kontent turi qo'shilganda biri yangilanmay
/// qolardi va begona kontentni pullik slotga qo'yish mumkin
/// bo'lardi.
export async function targetOwner(env, kind, id) {
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
  // IZOHNING O'ZI — like qo'yish uchun. O'chirilgan izoh topilmaydi,
  // ya'ni unga like ham qo'yib bo'lmaydi.
  if (kind === 'comment') {
    const row = await env.DB.prepare(
      `SELECT user_id, author_code FROM content_comments WHERE id = ? AND ${ALIVE}`
    ).bind(id).first();
    return row
      ? { ok: true, ownerUserId: Number(row.user_id) || 0, ownerCode: String(row.author_code || '') }
      : { ok: false };
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

/// D1 SANASINI MILLISEKUNDGA — `parseDbDate` orqali.
///
/// NIMA UCHUN `Date.parse` EMAS. D1 ga yozilgan sana
/// `2026-09-21 02:46:37.595+00` ko'rinishida: bo'shliq bilan va
/// offset MINUTSIZ. `Date.parse` bunday satr uchun NaN qaytaradi
/// (ES spetsifikatsiyasi `+HH:mm` talab qiladi).
///
/// Avval bu yerda `Date.parse(String(v).replace(' ', 'T'))`
/// turardi va u HAR DOIM NaN berardi. Orqasida `|| Date.now()`
/// bo'lgani uchun xato ko'rinmasdi: har bir izoh "hozir yozilgan"
/// deb qaytardi. Ya'ni ilovada HAMMA izohning vaqti noto'g'ri
/// edi va buni sezish qiyin — yangi izoh yozilganda natija
/// to'g'ri ko'rinardi.
///
/// `worker.js` dagi `parseDbDate` aynan shu format uchun yozilgan
/// va u YAGONA manba — bu yerda nusxasi yaratilmaydi.
const tsMs = (H, v) => {
  const d = H.parseDbDate(v);
  return d && !Number.isNaN(d.getTime()) ? d.getTime() : 0;
};

const rowToComment = (r, viewerId, H) => ({
  id: Number(r.id),
  targetKind: String(r.target_kind),
  targetId: Number(r.target_id),
  code: String(r.author_code || '').toUpperCase(),
  name: String(r.name || r.author_code || ''),
  avatarUrl: r.avatar_url || '',
  body: String(r.body || ''),
  // `|| Date.now()` saqlanib qoldi: sana HAQIQATAN buzuq bo'lsa
  // (eski, qo'lda kiritilgan ma'lumot) ilova 1970-yilni
  // ko'rsatmasin. Endi u deyarli hech qachon ishlamaydi.
  createdAt: tsMs(H, r.created_at) || Date.now(),
  // Ilova "o'chirish" tugmasini shu bayroqqa qarab ko'rsatadi —
  // huquqni BARIBIR server tekshiradi, bu faqat ko'rinish uchun.
  mine: !!viewerId && Number(r.user_id) === Number(viewerId),
  // Javob bo'lsa — ota izoh ID'si, aks holda 0.
  parentId: Number(r.parent_id) || 0,
  // Izohga qo'yilgan like'lar. `likes` har doim qaytadi (0 bo'lsa
  // ham), `liked` esa faqat ko'rayotgan odam uchun.
  likes: Number(r.likes) || 0,
  liked: !!r.liked,
});

async function countFor(env, kind, id) {
  const r = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM content_comments
      WHERE target_kind = ? AND target_id = ? AND ${ALIVE}`
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
      WHERE (${where}) AND ${ALIVE} GROUP BY target_kind, target_id`
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

// ── KONTENT O'CHIRILGANDA — UNING IZOH VA LAYKLARI HAM ────────────
//
// `posts.id` — `INTEGER PRIMARY KEY` (AUTOINCREMENT EMAS): eng oxirgi
// post o'chirilsa, keyingi yangi post AYNAN o'sha raqamni oladi. Izoh
// va layklar postga FK bilan bog'lanmagan — ya'ni o'chirilgan postning
// izohlari va layklari BOSHQA odamning yangi postiga "yopishib"
// qolardi (egasi 2026-09 da E2E test izohini o'z postida ko'rdi).
// Endi o'chirish batch'iga shu statement'lar qo'shiladi: izohlar
// arxivga nusxa bilan yumshoq o'chiriladi, layklar ketadi.
//
// `idsSql` — o'chirilayotgan kontent raqamlarini beradigan SELECT
// (yoki `?`), `binds` — unga. Chaqiruvchi avval `ensureSchema(env)`
// ni kutadi: jadval yo'q bo'lsa butun batch yiqiladi.
const tsNow = () => new Date().toISOString().replace('T', ' ').replace('Z', '+00');

export function retireTargetStmts(env, kind, idsSql, binds, { reason = 'target_deleted', byUserId = 0, byAdmin = '' } = {}) {
  const now = tsNow();
  return [
    env.DB.prepare(
      `INSERT INTO content_comment_archive
         (comment_id, target_kind, target_id, user_id, author_code, body,
          created_at, deleted_at, deleted_by_user_id, deleted_by_admin, reason)
       SELECT id, target_kind, target_id, user_id, author_code, body, created_at, ?, ?, ?, ?
         FROM content_comments
        WHERE target_kind = ? AND target_id IN (${idsSql}) AND ${ALIVE}`
    ).bind(now, Number(byUserId) || 0, String(byAdmin || ''), reason, kind, ...binds),
    env.DB.prepare(
      `UPDATE content_comments SET deleted_at = ?, deleted_by_user_id = ?, deleted_reason = ?
        WHERE target_kind = ? AND target_id IN (${idsSql}) AND ${ALIVE}`
    ).bind(now, Number(byUserId) || 0, reason, kind, ...binds),
    env.DB.prepare(
      `DELETE FROM content_likes WHERE target_kind = ? AND target_id IN (${idsSql})`
    ).bind(kind, ...binds),
  ];
}

export async function deleteLikesFor(env, kind, id) {
  await ensureSchema(env);
  await env.DB.prepare(
    `DELETE FROM content_likes WHERE target_kind = ? AND target_id = ?`
  ).bind(kind, id).run();
}

export async function handle(request, env, url, H) {
  const path = url.pathname;
  const method = request.method;

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
    if (!LIKE_KINDS.includes(kind)) return H.json({ error: 'bad_kind' }, 422);
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
    // TARTIB: MAVZU BO'YICHA, JAVOB OTASI BILAN BIRGA.
    //
    // Oddiy "yangisi yuqorida" tartibida javob otasidan ajralib,
    // sahifa chegarasida otasisiz qolib ketishi mumkin edi — ilova
    // uni qayerga qo'yishni bilmasdi.
    //
    // `COALESCE(parent_id, id)` — javob uchun otasining ID'si,
    // oddiy izoh uchun o'zining ID'si. Shu bo'yicha kamayish
    // tartibida saralaymiz: mavzular yangisidan eskisiga, har
    // mavzu ichida esa ota birinchi, javoblar ketma-ket.
    const rows = await env.DB.prepare(
      `SELECT cc.*, c.name AS name, c.avatar_url AS avatar_url
         FROM content_comments cc
         LEFT JOIN cards c ON c.code = cc.author_code
        WHERE cc.target_kind = ? AND cc.target_id = ? AND cc.${ALIVE}
        ORDER BY COALESCE(cc.parent_id, cc.id) DESC, cc.id ASC
        LIMIT ? OFFSET ?`
    ).bind(kind, id, limit + 1, (page - 1) * limit).all();

    const all = rows.results || [];
    const page_ = all.slice(0, limit);

    // IZOH LIKE'LARI — BITTA SO'ROVDA.
    //
    // Har izoh uchun alohida so'rov yuborilsa, yigirmata izohli
    // postda yigirmata qo'shimcha so'rov bo'lardi.
    if (page_.length) {
      const ids = page_.map((r) => Number(r.id));
      const marks = ids.map(() => '?').join(',');
      const counts = await env.DB.prepare(
        `SELECT target_id, COUNT(*) AS n,
                MAX(CASE WHEN user_id = ? THEN 1 ELSE 0 END) AS liked
           FROM content_likes
          WHERE target_kind = 'comment' AND target_id IN (${marks})
          GROUP BY target_id`
      ).bind(viewerId || 0, ...ids).all();
      const byId = new Map(
        (counts.results || []).map((r) => [Number(r.target_id), r]),
      );
      for (const r of page_) {
        const hit = byId.get(Number(r.id));
        r.likes = hit ? Number(hit.n) : 0;
        r.liked = hit ? !!hit.liked : false;
      }
    }

    return H.json({
      comments: page_.map((r) => rowToComment(r, viewerId, H)),
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
    //
    // TEKSHIRUV FAQAT ROSTLIK — muddatni QAYTA hisoblamaymiz.
    //
    // `getCurrentUser` buni allaqachon `parseDbDate` bilan
    // hisoblaydi va muddati o'tgan ban uchun `bannedUntil` ni
    // `null` qiladi. Bu yerda ikkinchi marta `Date.parse` bilan
    // solishtirilardi — va u NaN qaytarardi, chunki D1 sanasi
    // `...+00` bilan tugaydi (`parseDbDate` aynan shu uchun
    // yozilgan). `NaN > Date.now()` esa DOIM `false`, ya'ni
    // BLOKLANGAN ODAM IZOH YOZAVERARDI. Auksionlarda
    // (`worker.js` 6814, 6842) shart to'g'ri — faqat rostlik
    // tekshiriladi. Endi bu yerda ham shunday.
    if (user.bannedUntil) return H.json({ error: 'banned' }, 403);

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

    const payload = await readJson(request);
    const body = cleanBody(payload.body);
    if (!body) return H.json({ error: 'empty' }, 422);

    // JAVOB — BIR QAVAT.
    //
    // Ota izoh AYNAN shu kontentga tegishli bo'lishi va o'zi javob
    // BO'LMASLIGI shart. Ikkinchi shart bo'lmasa, javobga javob
    // yozilib zanjir cho'zilardi va ilovada u o'qilmay qolardi.
    //
    // Begona kontentning izohiga javob yozib bo'lmaydi: `parent`
    // so'rovi `target_kind`/`target_id` bilan cheklangan. Ya'ni
    // qo'lda yuborilgan so'rov ham izohni boshqa post ostiga
    // ko'chira olmaydi.
    let parentId = Number(payload.parentId) || 0;
    if (parentId) {
      const parent = await env.DB.prepare(
        `SELECT id, user_id, parent_id FROM content_comments
          WHERE id = ? AND target_kind = ? AND target_id = ? AND ${ALIVE}`
      ).bind(parentId, kind, id).first();
      if (!parent) return H.json({ error: 'parent_not_found' }, 404);
      if (Number(parent.parent_id) > 0) {
        return H.json({ error: 'nested_reply_not_allowed' }, 422);
      }
      parentId = Number(parent.id);
    }

    const author = await authorOf(env, user.id);
    const now = H.nowTs();
    const ins = await env.DB.prepare(
      `INSERT INTO content_comments (target_kind, target_id, user_id, author_code, body, created_at, parent_id)
       VALUES (?,?,?,?,?,?,?) RETURNING id`
    ).bind(kind, id, user.id, author.code, body, now, parentId || null).first();

    // Bildirishnoma — izoh YOZILGANDAN keyin, javobdan oldin.
    //
    // `targetType: 'comment'` va `targetId` AYNAN izoh ID'si:
    // shuning uchun ikkita alohida izoh ikkita bildirishnoma
    // beradi (to'g'ri), takroriy so'rov esa yangi izoh yaratmagani
    // uchun takroriy xabar ham bermaydi.
    //
    // Xatosi yutiladi: bildirishnoma yozilmagani uchun odamning
    // izohi yo'qolib ketishi mumkin emas.
    // JAVOB BO'LSA — XABAR OTA IZOH MUALLIFIGA.
    //
    // Aks holda javob kontent egasiga ketardi va o'ziga savol
    // berilgan odam bu haqda umuman bilmasdi. Kontent egasi ham,
    // ota izoh muallifi ham bitta odam bo'lsa — bitta xabar.
    let recipient = target.ownerUserId;
    if (parentId) {
      const pa = await env.DB.prepare(
        `SELECT user_id FROM content_comments WHERE id = ?`
      ).bind(parentId).first();
      if (pa) recipient = Number(pa.user_id) || recipient;
    }
    await createNotification(env, {
      recipientUserId: recipient,
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
        parentId,
        likes: 0,
        liked: false,
        createdAt: tsMs(H, now) || Date.now(),
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

    // Allaqachon o'chirilgan bo'lsa — hech narsa qilinmaydi va
    // arxivga IKKINCHI nusxa yozilmaydi. Takroriy so'rov (tarmoq
    // uzilib, ilova qayta yuborsa) xato emas.
    if (row.deleted_at) {
      return H.json({ ok: true, total: await countFor(env, String(row.target_kind), Number(row.target_id)) });
    }

    await softDelete(env, H, row, {
      byUserId: user.id,
      // Odamning o'z izohini o'chirishi moderatsiya emas —
      // sababi so'ralmaydi va yozilmaydi.
      reason: isAuthor ? 'author' : 'owner',
    });
    return H.json({ ok: true, total: await countFor(env, String(row.target_kind), Number(row.target_id)) });
  }

  // ═════════════════════════════════════════════════════════════════
  // ADMIN MODERATSIYASI
  //
  // Auth `marketplace.js` dagi bilan AYNAN bir xil: `requireAdmin`.
  // Yangi auth yo'li ochilmaydi — bitta tizim, bitta tekshiruv.
  // ═════════════════════════════════════════════════════════════════
  if (path.startsWith('/api/admin/comments')) {
    const admin = await H.requireAdmin(request, env);
    if (!admin) return H.json({ error: 'unauthorized' }, 401);
    await ensureSchema(env);

    // KIM O'CHIRGANI — izlanadigan, LEKIN maxfiy emas.
    //
    // `getCurrentAdmin` `{adminId, role, token}` qaytaradi.
    // `token` — SESSIYA KALITI va u hech qayerga, ayniqsa
    // arxivga, yozilmaydi: arxiv admin panelida ochiq ko'rinadi.
    // Yozib qo'yiladigan narsa — admin raqami va roli, ular
    // `admins` jadvaliga ulanadi va shaxsni aniqlashga yetadi.
    const adminLabel = `admin#${Number(admin.adminId) || 0}:${String(admin.role || '')}`
      .slice(0, 64);

    // ── DALIL ARXIVI ──────────────────────────────────────────────
    // `/:id` namunasidan OLDIN: "archive" raqam emas, lekin
    // ro'yxat marshrutining o'zidan keyin turgani aniqroq.
    if (path === '/api/admin/comments/archive' && method === 'GET') {
      const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
      const limit = Math.min(PAGE_MAX, Math.max(1, Number(url.searchParams.get('limit')) || 30));
      const rows = await env.DB.prepare(
        `SELECT * FROM content_comment_archive
          ORDER BY deleted_at DESC, id DESC LIMIT ? OFFSET ?`
      ).bind(limit + 1, (page - 1) * limit).all().catch(() => null);
      const all = rows?.results || [];
      return H.json({
        items: all.slice(0, limit).map((r) => ({
          id: Number(r.id),
          commentId: Number(r.comment_id),
          targetKind: String(r.target_kind),
          targetId: Number(r.target_id),
          userId: Number(r.user_id),
          authorCode: String(r.author_code || '').toUpperCase(),
          body: String(r.body || ''),
          createdAt: tsMs(H, r.created_at),
          deletedAt: tsMs(H, r.deleted_at),
          deletedByUserId: Number(r.deleted_by_user_id) || 0,
          deletedByAdmin: String(r.deleted_by_admin || ''),
          reason: String(r.reason || ''),
          restoredAt: r.restored_at ? tsMs(H, r.restored_at) : null,
        })),
        hasMore: all.length > limit,
      });
    }

    // ── RO'YXAT ───────────────────────────────────────────────────
    if (path === '/api/admin/comments' && method === 'GET') {
      const state = String(url.searchParams.get('state') || 'live');
      const q = String(url.searchParams.get('q') || '').trim().slice(0, 80);
      const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
      const limit = Math.min(PAGE_MAX, Math.max(1, Number(url.searchParams.get('limit')) || 30));

      const conds = [];
      const args = [];
      if (state === 'live') conds.push(`cc.${ALIVE}`);
      else if (state === 'deleted') conds.push(`cc.deleted_at IS NOT NULL`);
      // `all` — shart qo'shilmaydi.

      if (q) {
        // Matn VA muallif kodi bo'yicha. `LIKE` SQLite'da katta-kichik
        // harfni ASCII uchun farqlamaydi — kod har doim ASCII.
        conds.push(`(cc.body LIKE ? OR cc.author_code LIKE ?)`);
        args.push(`%${q}%`, `%${q.toUpperCase()}%`);
      }

      const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
      const rows = await env.DB.prepare(
        `SELECT cc.*, c.name AS name, c.avatar_url AS avatar_url
           FROM content_comments cc
           LEFT JOIN cards c ON c.code = cc.author_code
           ${where}
          ORDER BY cc.created_at DESC, cc.id DESC
          LIMIT ? OFFSET ?`
      ).bind(...args, limit + 1, (page - 1) * limit).all().catch(() => null);

      const all = rows?.results || [];
      const totalRow = await env.DB.prepare(
        `SELECT COUNT(*) AS n FROM content_comments cc ${where}`
      ).bind(...args).first().catch(() => null);

      return H.json({
        comments: all.slice(0, limit).map((r) => ({
          ...rowToComment(r, 0, H),
          userId: Number(r.user_id),
          deletedAt: r.deleted_at ? tsMs(H, r.deleted_at) : null,
          deletedReason: String(r.deleted_reason || ''),
        })),
        hasMore: all.length > limit,
        total: Number(totalRow?.n) || 0,
      });
    }

    const adminIdMatch = path.match(/^\/api\/admin\/comments\/(\d+)$/);
    if (adminIdMatch && method === 'DELETE') {
      const row = await env.DB.prepare(
        `SELECT * FROM content_comments WHERE id = ?`
      ).bind(Number(adminIdMatch[1])).first().catch(() => null);
      if (!row) return H.json({ error: 'not_found' }, 404);
      if (row.deleted_at) return H.json({ ok: true, already: true });

      // SABAB MAJBURIY. Moderator qarorining sababsiz qolishi —
      // keyin uni tekshirib bo'lmasligi degani.
      const body = await readJson(request);
      const reason = H.shortText(body.reason || '', 200).trim();
      if (!reason) return H.json({ error: 'reason_required' }, 422);

      await softDelete(env, H, row, {
        byUserId: 0,
        byAdmin: adminLabel,
        reason,
      });
      return H.json({ ok: true });
    }

    const restoreMatch = path.match(/^\/api\/admin\/comments\/(\d+)\/restore$/);
    if (restoreMatch && method === 'POST') {
      const id = Number(restoreMatch[1]);
      const row = await env.DB.prepare(
        `SELECT * FROM content_comments WHERE id = ?`
      ).bind(id).first().catch(() => null);
      if (!row) return H.json({ error: 'not_found' }, 404);

      await env.DB.prepare(
        `UPDATE content_comments
            SET deleted_at = NULL, deleted_by_user_id = NULL, deleted_reason = NULL
          WHERE id = ?`
      ).bind(id).run().catch(() => {});

      // Arxiv yozuvi O'CHIRILMAYDI — voqea qoladi, ustiga
      // "tiklandi" belgisi qo'yiladi.
      await env.DB.prepare(
        `UPDATE content_comment_archive SET restored_at = ?
          WHERE comment_id = ? AND restored_at IS NULL`
      ).bind(H.nowTs(), id).run().catch(() => {});

      return H.json({ ok: true });
    }

    return H.json({ error: 'not_found', path }, 404);
  }

  return null;
}

/// IZOHNI O'CHIRISH — jadvaldan emas, ko'rinishdan.
///
/// Ikki yozuv, shu tartibda:
///   1. ARXIV — to'liq nusxa. BIRINCHI, chunki u dalil: live
///      qatorni yangilash muvaffaqiyatli bo'lib, arxiv yozilmay
///      qolsa, dalil butunlay yo'qolardi.
///   2. LIVE qator — `deleted_at` qo'yiladi.
///
/// Arxiv xatosi YUTILMAYDI: u bu funksiyaning butun maqsadi.
/// Aksincha — arxiv yozilmasa o'chirish ham bajarilmaydi.
async function softDelete(env, H, row, { byUserId = 0, byAdmin = '', reason = '' }) {
  const now = H.nowTs();
  await env.DB.prepare(
    `INSERT INTO content_comment_archive
       (comment_id, target_kind, target_id, user_id, author_code, body,
        created_at, deleted_at, deleted_by_user_id, deleted_by_admin, reason)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(
    Number(row.id),
    String(row.target_kind),
    Number(row.target_id),
    Number(row.user_id),
    String(row.author_code || ''),
    String(row.body || ''),
    String(row.created_at || now),
    now,
    Number(byUserId) || 0,
    byAdmin,
    reason,
  ).run();

  await env.DB.prepare(
    `UPDATE content_comments
        SET deleted_at = ?, deleted_by_user_id = ?, deleted_reason = ?
      WHERE id = ?`
  ).bind(now, Number(byUserId) || 0, reason, Number(row.id)).run();
}
