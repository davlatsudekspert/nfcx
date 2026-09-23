// hosting/api/content-archive.js — O'CHIRILGAN KONTENTNING DALIL ARXIVI.
//
// ═══ NIMA UCHUN BOR ═══
//
// Egasining talabi (2026-09): huquqni muhofaza qiluvchi organ "shu
// odam falon kuni nima joylagan edi" deb so'rasa, javob berolishimiz
// kerak — hatto odam uni o'zi o'chirib yuborgan bo'lsa ham. Izohlar
// uchun bu allaqachon bor (`content_comment_archive`, comments.js).
// Bu modul xuddi shu qoidani POST, ISTORIYA, PROFIL VIDEOSI va
// FAYLIGA yoyadi.
//
// ═══ QANDAY ISHLAYDI ═══
//
//   * O'chirishdan OLDIN, O'SHA batch ichida `INSERT ... SELECT`
//     nusxa yozadi: kim (user_id, profil/kompaniya), qachon joylagan,
//     qachon va KIM o'chirgan (egasi / admin / muddati o'tgan), matn
//     va media manzillari. Batch atomik: arxiv yozilmasa o'chirish
//     ham bo'lmaydi — dalil jimgina yo'qolmaydi.
//   * Media FAYLLAR (R2) o'chirilmaydi: arxivdagi manzil ishlab turadi.
//   * Ommaga HECH QAYERDA chiqmaydi — faqat admin ("Dalil arxivi"):
//       GET  /api/admin/evidence?source=all|content|comment&kind=&q=&flagged=1&page=&limit=
//            -> { items, hasMore }  — izohlar arxivi ham shu ro'yxatda;
//               har yozuvda MUALLIF va PROFIL EGASI (email, telefon).
//            `q` — NFC ID / Business ID, foydalanuvchi raqami yoki email.
//       POST /api/admin/evidence/flag { source, id, flagged, note }
//            -> shubhali deb belgilash (tergov so'rovi uchun ajratib qo'yish).
//     Har bir ko'rish va belgilash admin jurnaliga yoziladi.
//
// Jadval `CREATE TABLE IF NOT EXISTS` — mavjud ma'lumotga tegilmaydi.

export const ARCHIVE_KINDS = ['post', 'company_post', 'story', 'card_video', 'card_file'];

const CARD_USER = (col) => `(SELECT c.user_id FROM cards c WHERE c.code = ${col})`;

// Har tur uchun: qaysi jadval va arxiv ustunlari qayerdan olinadi.
// `src` — o'chirilayotgan jadvalning taxallusi.
const SRC = {
  post: {
    table: 'posts', ownerKind: `'card'`, ownerId: 'src.code',
    userId: `COALESCE(src.user_id, ${CARD_USER('src.code')})`,
    image: 'src.image_url', video: 'src.video_url', file: 'NULL', body: 'src.caption',
  },
  company_post: {
    table: 'company_posts', ownerKind: `'company'`, ownerId: 'src.company_id',
    userId: '(SELECT co.owner_user_id FROM companies co WHERE co.company_id = src.company_id)',
    image: 'src.image_url', video: 'src.video_url', file: 'NULL', body: 'src.caption',
  },
  story: {
    table: 'stories', ownerKind: 'src.owner_kind', ownerId: 'src.owner_id',
    userId: 'src.user_id',
    image: 'src.image_url', video: 'src.video_url', file: 'NULL', body: 'src.caption',
  },
  card_video: {
    table: 'card_videos', ownerKind: `'card'`, ownerId: 'src.code',
    userId: CARD_USER('src.code'),
    image: 'src.thumb_url', video: 'src.video_url', file: 'NULL', body: 'src.title',
  },
  card_file: {
    table: 'card_files', ownerKind: `'card'`, ownerId: 'src.code',
    userId: CARD_USER('src.code'),
    image: 'NULL', video: 'NULL', file: 'src.file_url', body: 'src.title',
  },
};

export const ARCHIVE_TABLE_SQL = `CREATE TABLE IF NOT EXISTS "content_archive" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,
  content_id INTEGER NOT NULL,
  owner_kind TEXT NOT NULL DEFAULT '',
  owner_id TEXT NOT NULL DEFAULT '',
  user_id TEXT NOT NULL DEFAULT '',
  image_url TEXT, video_url TEXT, file_url TEXT,
  body TEXT NOT NULL DEFAULT '',
  created_at TEXT,
  deleted_at TEXT NOT NULL,
  deleted_by_user_id INTEGER NOT NULL DEFAULT 0,
  deleted_by_admin TEXT NOT NULL DEFAULT '',
  reason TEXT NOT NULL DEFAULT ''
)`;

// `H.nowTs()` bilan bir xil shakl — izohlar arxivi bilan birga saralanadi.
const nowTs = () => new Date().toISOString().replace('T', ' ').replace('Z', '+00');

let ready;
export async function ensureArchiveTable(env) {
  if (!ready) {
    ready = env.DB.batch([
      env.DB.prepare(ARCHIVE_TABLE_SQL),
      env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_content_archive_time ON content_archive(deleted_at DESC)`),
      env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_content_archive_owner ON content_archive(owner_id, deleted_at DESC)`),
      env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_content_archive_user ON content_archive(user_id, deleted_at DESC)`),
      // SHUBHALI BELGISI — ikkala arxiv uchun ham (manba + yozuv raqami).
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS "evidence_flags" (
        source TEXT NOT NULL,
        archive_id INTEGER NOT NULL,
        note TEXT NOT NULL DEFAULT '',
        flagged_by TEXT NOT NULL DEFAULT '',
        flagged_at TEXT NOT NULL,
        PRIMARY KEY (source, archive_id)
      )`),
    ]).catch((e) => { ready = null; throw e; });
  }
  await ready;
}

/// O'chirishdan OLDIN o'sha batch'ga qo'yiladigan nusxa statement'i.
///
/// `where` — DELETE dagi AYNAN o'sha shart (ustunlar taxallussiz,
/// `binds` bilan). Shunda arxivga aynan o'chiriladigan qatorlar tushadi.
///   by: { userId?, admin?, reason }  reason: owner | admin | expired | card_cleanup
export function archiveStmt(env, kind, where, binds, by = {}, now = nowTs()) {
  const s = SRC[kind];
  if (!s) throw new Error(`archive_kind:${kind}`);
  return env.DB.prepare(
    `INSERT INTO content_archive
       (kind, content_id, owner_kind, owner_id, user_id, image_url, video_url, file_url,
        body, created_at, deleted_at, deleted_by_user_id, deleted_by_admin, reason)
     SELECT ?, src.id, COALESCE(${s.ownerKind}, ''), CAST(COALESCE(${s.ownerId}, '') AS TEXT),
            CAST(COALESCE(${s.userId}, '') AS TEXT), ${s.image}, ${s.video}, ${s.file},
            COALESCE(${s.body}, ''), src.created_at, ?, ?, ?, ?
       FROM ${s.table} src
      WHERE ${where}`
  ).bind(
    kind, now,
    Number(by.userId) || 0,
    String(by.admin || '').slice(0, 64),
    String(by.reason || '').slice(0, 40),
    ...binds,
  );
}

/// Media fayl arxivda turibdimi — R2 dan o'chirishdan oldin so'raladi.
export async function urlArchived(env, url) {
  if (!url) return false;
  try {
    const row = await env.DB.prepare(
      `SELECT 1 AS x FROM content_archive WHERE image_url = ? OR video_url = ? OR file_url = ? LIMIT 1`
    ).bind(url, url, url).first();
    return !!row;
  } catch {
    // Jadval hali yo'q bo'lsa ham — ehtiyot: o'chirmaymiz.
    return true;
  }
}

const PAGE_MAX = 100;
export const EVIDENCE_SOURCES = ['content', 'comment'];

// Izoh qaysi profilga yozilgan — post o'chirilgan bo'lsa ham arxivdan topiladi.
const COMMENT_OWNER_ID = `COALESCE(
  CASE c.target_kind
    WHEN 'post' THEN (SELECT p.code FROM posts p WHERE p.id = c.target_id)
    WHEN 'company_post' THEN (SELECT cp.company_id FROM company_posts cp WHERE cp.id = c.target_id)
    ELSE (SELECT s.owner_id FROM stories s WHERE s.id = c.target_id)
  END,
  (SELECT a2.owner_id FROM content_archive a2
    WHERE a2.content_id = c.target_id
      AND a2.kind = CASE c.target_kind WHEN 'company_story' THEN 'story' ELSE c.target_kind END
    LIMIT 1),
  '')`;
const COMMENT_OWNER_KIND = `CASE WHEN c.target_kind IN ('company_post','company_story') THEN 'company' ELSE 'card' END`;

const UNION = `
  SELECT 'content' AS source, a.id, a.kind, a.content_id, a.owner_kind, a.owner_id, a.user_id,
         a.image_url, a.video_url, a.file_url, a.body, a.created_at, a.deleted_at,
         a.deleted_by_user_id, a.deleted_by_admin, a.reason,
         '' AS target_kind, 0 AS target_id, '' AS author_code
    FROM content_archive a
  UNION ALL
  SELECT 'comment' AS source, c.id, 'comment' AS kind, c.comment_id AS content_id,
         ${COMMENT_OWNER_KIND} AS owner_kind, CAST(${COMMENT_OWNER_ID} AS TEXT) AS owner_id,
         CAST(c.user_id AS TEXT) AS user_id,
         NULL AS image_url, NULL AS video_url, NULL AS file_url, c.body, c.created_at, c.deleted_at,
         c.deleted_by_user_id, c.deleted_by_admin, c.reason,
         c.target_kind, c.target_id, c.author_code
    FROM content_comment_archive c`;

const ms = (H, v) => {
  const d = v ? H.parseDbDate(v) : null;
  return d && !Number.isNaN(d.getTime()) ? d.getTime() : null;
};

async function commentArchiveExists(env) {
  const row = await env.DB.prepare(
    `SELECT 1 AS x FROM sqlite_master WHERE type = 'table' AND name = 'content_comment_archive'`
  ).first().catch(() => null);
  return !!row;
}

// Profil (NFC ID) va kompaniya egalari, foydalanuvchilar — bitta so'rovda.
async function peopleFor(env, userIds, cardCodes, companyIds) {
  const users = new Map();
  const cards = new Map();
  const companies = new Map();
  const q = async (sql, list) => {
    if (!list.length) return [];
    const r = await env.DB.prepare(sql.replace('%', list.map(() => '?').join(','))).bind(...list).all().catch(() => null);
    return r?.results || [];
  };
  for (const r of await q(`SELECT code, user_id, name FROM cards WHERE UPPER(code) IN (%)`, [...cardCodes].map((c) => c.toUpperCase()))) {
    cards.set(String(r.code).toUpperCase(), { name: r.name || '', userId: r.user_id == null ? '' : String(r.user_id) });
  }
  for (const r of await q(`SELECT company_id, owner_user_id, display_name FROM companies WHERE company_id IN (%)`, [...companyIds])) {
    companies.set(String(r.company_id), { name: r.display_name || '', userId: String(r.owner_user_id || '') });
  }
  const ids = new Set([...userIds]);
  for (const c of cards.values()) if (c.userId) ids.add(c.userId);
  for (const c of companies.values()) if (c.userId) ids.add(c.userId);
  const numeric = [...ids].filter((x) => /^\d+$/.test(x)).map(Number);
  for (const r of await q(`SELECT id, email, phone, deleted_at, banned_until FROM users WHERE id IN (%)`, numeric)) {
    users.set(String(r.id), {
      userId: String(r.id), email: r.email || '', phone: r.phone || '',
      deleted: !!r.deleted_at, bannedUntil: r.banned_until || null,
    });
  }
  return { users, cards, companies };
}

const userCard = (people, id) => (id ? people.users.get(String(id)) || { userId: String(id), email: '', phone: '', deleted: false } : null);

export async function handle(request, env, url, H) {
  const path = url.pathname;
  if (path !== '/api/admin/evidence' && path !== '/api/admin/evidence/flag') return null;
  const admin = await H.requireAdmin(request, env);
  if (!admin) return H.json({ error: 'unauthorized' }, 401);
  await ensureArchiveTable(env);
  const adminLabel = `admin#${Number(admin.adminId) || 0}:${String(admin.role || '')}`.slice(0, 64);
  const ip = H.reqIp ? H.reqIp(request) : '';

  if (path === '/api/admin/evidence/flag') {
    if (request.method !== 'POST') return H.json({ error: 'method_not_allowed' }, 405);
    const body = await request.json().catch(() => ({}));
    const source = String(body?.source || '');
    const id = Number(body?.id) || 0;
    if (!EVIDENCE_SOURCES.includes(source) || !id) return H.json({ error: 'bad_request' }, 422);
    const note = String(body?.note || '').trim().slice(0, 500);
    if (body?.flagged === false) {
      await env.DB.prepare(`DELETE FROM evidence_flags WHERE source = ? AND archive_id = ?`).bind(source, id).run();
    } else {
      await env.DB.prepare(
        `INSERT INTO evidence_flags (source, archive_id, note, flagged_by, flagged_at) VALUES (?,?,?,?,?)
         ON CONFLICT(source, archive_id) DO UPDATE SET note = excluded.note, flagged_by = excluded.flagged_by, flagged_at = excluded.flagged_at`
      ).bind(source, id, note, adminLabel, nowTs()).run();
    }
    await H.logAdminActivity?.(env, {
      action: body?.flagged === false ? 'evidence_unflag' : 'evidence_flag',
      details: `${source}#${id} ${adminLabel}${note ? ` — ${note}` : ''}`.slice(0, 500), ip,
    })?.catch?.(() => {});
    return H.json({ ok: true, flagged: body?.flagged !== false });
  }

  if (request.method !== 'GET') return H.json({ error: 'method_not_allowed' }, 405);
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
  const limit = Math.min(PAGE_MAX, Math.max(1, Number(url.searchParams.get('limit')) || 30));
  const source = String(url.searchParams.get('source') || 'all');
  const kind = String(url.searchParams.get('kind') || '');
  const q = String(url.searchParams.get('q') || '').trim().slice(0, 120);
  const flaggedOnly = url.searchParams.get('flagged') === '1';

  const withComments = await commentArchiveExists(env);
  const base = withComments
    ? UNION
    : UNION.slice(0, UNION.indexOf('UNION ALL'));

  const conds = [];
  const binds = [];
  if (EVIDENCE_SOURCES.includes(source)) { conds.push('e.source = ?'); binds.push(source); }
  if (kind && (ARCHIVE_KINDS.includes(kind) || kind === 'comment')) { conds.push('e.kind = ?'); binds.push(kind); }
  if (flaggedOnly) conds.push('f.archive_id IS NOT NULL');
  if (q) {
    // Kod, foydalanuvchi raqami yoki email — muallif ham, profil egasi ham.
    conds.push(`(UPPER(e.owner_id) = UPPER(?) OR UPPER(e.author_code) = UPPER(?) OR e.user_id = ?
      OR e.user_id IN (SELECT CAST(u.id AS TEXT) FROM users u WHERE LOWER(u.email) = LOWER(?) OR u.phone = ?))`);
    binds.push(q, q, q, q, q);
  }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const rows = await env.DB.prepare(
    `SELECT e.*, f.note AS flag_note, f.flagged_by, f.flagged_at, f.archive_id AS flag_id
       FROM (${base}) e
       LEFT JOIN evidence_flags f ON f.source = e.source AND f.archive_id = e.id
       ${where}
      ORDER BY e.deleted_at DESC, e.id DESC LIMIT ? OFFSET ?`
  ).bind(...binds, limit + 1, (page - 1) * limit).all();
  const all = (rows?.results || []).slice(0, limit + 1);
  const pageRows = all.slice(0, limit);

  const userIds = new Set();
  const cardCodes = new Set();
  const companyIds = new Set();
  for (const r of pageRows) {
    if (r.user_id) userIds.add(String(r.user_id));
    if (r.deleted_by_user_id) userIds.add(String(r.deleted_by_user_id));
    if (r.owner_id) (r.owner_kind === 'company' ? companyIds : cardCodes).add(String(r.owner_id));
  }
  const people = await peopleFor(env, userIds, cardCodes, companyIds);

  if (q) {
    await H.logAdminActivity?.(env, { action: 'evidence_search', details: `${adminLabel} q=${q}`.slice(0, 500), ip })?.catch?.(() => {});
  }

  return H.json({
    items: pageRows.map((r) => {
      const ownerKind = String(r.owner_kind || '');
      const ownerId = String(r.owner_id || '');
      const ownerRec = ownerKind === 'company' ? people.companies.get(ownerId) : people.cards.get(ownerId.toUpperCase());
      return {
        source: r.source,
        id: Number(r.id),
        kind: String(r.kind),
        contentId: Number(r.content_id) || 0,
        target: r.source === 'comment' ? { kind: String(r.target_kind || ''), id: Number(r.target_id) || 0 } : null,
        body: String(r.body || ''),
        imageUrl: r.image_url || '',
        videoUrl: r.video_url || '',
        fileUrl: r.file_url || '',
        createdAt: ms(H, r.created_at),
        deletedAt: ms(H, r.deleted_at),
        reason: String(r.reason || ''),
        deletedBy: r.deleted_by_admin
          ? { admin: String(r.deleted_by_admin) }
          : (Number(r.deleted_by_user_id) ? { user: userCard(people, r.deleted_by_user_id) } : { system: true }),
        author: { code: String(r.author_code || '').toUpperCase(), ...(userCard(people, r.user_id) || {}) },
        owner: {
          kind: ownerKind, id: ownerId, name: ownerRec?.name || '',
          user: userCard(people, ownerRec?.userId),
        },
        flag: r.flag_id != null
          ? { note: String(r.flag_note || ''), by: String(r.flagged_by || ''), at: ms(H, r.flagged_at) }
          : null,
      };
    }),
    hasMore: all.length > limit,
  });
}
