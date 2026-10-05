// hosting/api/saves.js — SAQLANGANLAR (Reels, katalog sevimlilari, postlar
// va nomli to'plamlar).
//
// ═══ NIMA UCHUN BOR ═══
//
// Ilgari ilova saqlangan Reels va katalog sevimlilarini faqat TELEFON
// xotirasida saqlardi: telefon almashsa yoki ilova qayta o'rnatilsa
// hammasi yo'qolardi. Egasining talabi (2026-09): hisobga bog'lansin.
//
// 2026-10: oddiy POST va BIZNES POSTI ham saqlanadi (Instagram'dagi
// "Saqlash" belgisi), saqlanganlar esa NOMLI TO'PLAMLARGA ("Sovg'a
// g'oyalari", "Restoranlar") ajratiladi.
//
// ═══ SO'ROVLAR (kirish talab qilinadi) ═══
//
//   GET  /api/saves?kind=reel|listing|post|company_post[&collectionId=N|none]
//        -> { items: [{ kind, ref, createdAt, collectionId, post? }] }  (yangisi oldin)
//        `kind=post|company_post` bo'lsa har yozuvga `post` qo'shiladi —
//        lenta (`/api/feed`) bilan AYNAN bir shakl; ko'rinmay qolgan post
//        (o'chirilgan, yashirilgan, rejadagi) uchun `post: null`.
//        Bitta so'rovda 30 tagacha post to'ldiriladi (`limit`, `page`).
//   POST /api/saves  { kind, ref, saved: true|false, collectionId? }
//        -> { kind, ref, saved, collectionId }
//        `post` / `company_post` uchun `ref` — post raqami ("123").
//
//   GET    /api/saves/collections  -> { collections: [{ id, name, count, createdAt }], unassigned }
//   POST   /api/saves/collections  { name } -> 201 { collection }
//   PATCH  /api/saves/collections/:id  { name } -> { collection }
//   DELETE /api/saves/collections/:id  -> { ok, unassigned }  — SAQLANGANLAR
//          O'CHMAYDI, faqat to'plamdan chiqadi (`collection_id = NULL`).
//   POST   /api/saves/move  { kind, ref, collectionId: N|null } -> { kind, ref, collectionId }
//
// `ref` — ilovadagi kalit: Reels uchun `p:<postId>` yoki `c:<postId>`
// (kompaniya posti), katalog uchun `<BusinessID>/<itemId>`. Server
// faqat shaklini tekshiradi — mazmunini EMAS: o'chirilgan post
// saqlanganlar ro'yxatida qolsa, ilova uni shunchaki ko'rsatmaydi.
//
// Jadvallar `CREATE TABLE IF NOT EXISTS`, ustun `ADD COLUMN` (himoyalangan)
// bilan — mavjud ma'lumotga tegilmaydi. Har tur bo'yicha 1000 tagacha,
// 100 tagacha to'plam. Hisob o'chirilganda (account-purge.js) ikkala
// jadval ham tozalanadi.

export const SAVE_KINDS = ['reel', 'listing', 'post', 'company_post'];
const POST_KINDS = ['post', 'company_post'];
const MAX_PER_KIND = 1000;
export const MAX_COLLECTIONS = 100;
export const COLLECTION_NAME_MAX = 40;
const POSTS_PAGE_MAX = 30;
const REF_RE = /^[A-Za-z0-9'_:/.-]{1,120}$/;
const POST_REF_RE = /^[1-9][0-9]{0,11}$/;

// Xotiradagi belgi bazaga bog'lanadi: sinovda har `makeEnv` yangi baza.
const readyByDb = new WeakMap();
export async function ensureTable(env) {
  if (!readyByDb.has(env.DB)) {
    const job = (async () => {
      await env.DB.batch([
        env.DB.prepare(`CREATE TABLE IF NOT EXISTS user_saves (
          user_id INTEGER NOT NULL,
          kind TEXT NOT NULL,
          ref TEXT NOT NULL,
          created_at TEXT NOT NULL,
          PRIMARY KEY (user_id, kind, ref)
        )`),
        env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_user_saves_recent ON user_saves(user_id, kind, created_at DESC)`),
        env.DB.prepare(`CREATE TABLE IF NOT EXISTS save_collections (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          name TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT
        )`),
        env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_save_collections_user ON save_collections(user_id, id)`),
      ]);
      // Ustun bor bo'lsa ALTER xato beradi — jim o'tkaziladi. Batch'dan
      // TASHQARIDA: batch atomik, bitta xato jadvallarni ham yiqitardi.
      await env.DB.prepare(`ALTER TABLE user_saves ADD COLUMN collection_id INTEGER`).run().catch(() => {});
    })();
    readyByDb.set(env.DB, job);
    job.catch(() => readyByDb.delete(env.DB));
  }
  await readyByDb.get(env.DB);
}

function cleanName(v) {
  const t = String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!t) return { ok: false, error: 'name_required' };
  if (Array.from(t).length > COLLECTION_NAME_MAX) return { ok: false, error: 'name_too_long', max: COLLECTION_NAME_MAX };
  return { ok: true, name: t };
}

const refOk = (kind, ref) => (POST_KINDS.includes(kind) ? POST_REF_RE.test(ref) : REF_RE.test(ref));

const msOf = (H, v) => {
  const d = v ? H.parseDbDate(v) : null;
  return d && !Number.isNaN(d.getTime()) ? d.getTime() : null;
};

function collectionOut(r, H) {
  return {
    id: Number(r.id),
    name: r.name,
    count: Number(r.n || 0),
    createdAt: msOf(H, r.created_at),
  };
}

/// To'plam shu foydalanuvchinikimi. `null`/`undefined` — "to'plamsiz".
async function resolveCollection(env, userId, raw) {
  if (raw === undefined) return { ok: true, id: undefined };
  if (raw === null || raw === '' || raw === 0) return { ok: true, id: null };
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) return { ok: false, status: 422, error: 'bad_collection' };
  const row = await env.DB.prepare(`SELECT id FROM save_collections WHERE id = ? AND user_id = ?`).bind(id, userId).first();
  if (!row) return { ok: false, status: 404, error: 'collection_not_found' };
  return { ok: true, id };
}

async function collectionWithCount(env, userId, id) {
  return env.DB.prepare(
    `SELECT c.*, (SELECT COUNT(*) FROM user_saves s WHERE s.user_id = c.user_id AND s.collection_id = c.id) AS n
       FROM save_collections c WHERE c.id = ? AND c.user_id = ?`
  ).bind(id, userId).first();
}

export async function handle(request, env, url, H) {
  const path = url.pathname;
  if (path !== '/api/saves' && !path.startsWith('/api/saves/')) return null;
  const user = await H.getCurrentUser(request, env);
  if (!user) return H.json({ error: 'unauthorized' }, 401);
  await ensureTable(env);
  const method = request.method;
  const readJson = async () => {
    const b = await request.json().catch(() => null);
    return b && typeof b === 'object' && !Array.isArray(b) ? b : {};
  };

  // ── TO'PLAMLAR ──────────────────────────────────────────────────
  if (path === '/api/saves/collections') {
    if (method === 'GET') {
      const [rows, un] = await Promise.all([
        env.DB.prepare(
          `SELECT c.*, (SELECT COUNT(*) FROM user_saves s WHERE s.user_id = c.user_id AND s.collection_id = c.id) AS n
             FROM save_collections c WHERE c.user_id = ? ORDER BY c.id ASC LIMIT ${MAX_COLLECTIONS}`
        ).bind(user.id).all(),
        env.DB.prepare(`SELECT COUNT(*) AS n FROM user_saves WHERE user_id = ? AND collection_id IS NULL`).bind(user.id).first(),
      ]);
      return H.json({
        collections: (rows.results || []).map((r) => collectionOut(r, H)),
        unassigned: Number(un?.n || 0),
      });
    }
    if (method === 'POST') {
      const body = await readJson();
      const n = cleanName(body.name);
      if (!n.ok) return H.json({ error: n.error, ...(n.max ? { max: n.max } : {}) }, 422);
      const cnt = await env.DB.prepare(`SELECT COUNT(*) AS n FROM save_collections WHERE user_id = ?`).bind(user.id).first();
      if (Number(cnt?.n || 0) >= MAX_COLLECTIONS) return H.json({ error: 'limit_reached', limit: MAX_COLLECTIONS }, 409);
      const now = H.nowTs();
      const row = await env.DB.prepare(
        `INSERT INTO save_collections (user_id, name, created_at, updated_at) VALUES (?,?,?,?) RETURNING *`
      ).bind(user.id, n.name, now, now).first();
      return H.json({ collection: collectionOut({ ...row, n: 0 }, H) }, 201);
    }
    return H.json({ error: 'method_not_allowed' }, 405);
  }

  const colMatch = path.match(/^\/api\/saves\/collections\/(\d{1,12})$/);
  if (colMatch) {
    const id = Number(colMatch[1]);
    const own = await env.DB.prepare(`SELECT id FROM save_collections WHERE id = ? AND user_id = ?`).bind(id, user.id).first();
    // Begona to'plam "yo'q" — borligini ham oshkor qilmaymiz.
    if (!own) return H.json({ error: 'not_found' }, 404);
    if (method === 'PATCH') {
      const body = await readJson();
      const n = cleanName(body.name);
      if (!n.ok) return H.json({ error: n.error, ...(n.max ? { max: n.max } : {}) }, 422);
      await env.DB.prepare(`UPDATE save_collections SET name = ?, updated_at = ? WHERE id = ? AND user_id = ?`)
        .bind(n.name, H.nowTs(), id, user.id).run();
      return H.json({ collection: collectionOut(await collectionWithCount(env, user.id, id), H) });
    }
    if (method === 'DELETE') {
      // SAQLANGANLAR O'CHIRILMAYDI — faqat to'plamdan chiqadi.
      const [un] = await env.DB.batch([
        env.DB.prepare(`UPDATE user_saves SET collection_id = NULL WHERE user_id = ? AND collection_id = ?`).bind(user.id, id),
        env.DB.prepare(`DELETE FROM save_collections WHERE id = ? AND user_id = ?`).bind(id, user.id),
      ]);
      return H.json({ ok: true, unassigned: Number(un?.meta?.changes || 0) });
    }
    return H.json({ error: 'method_not_allowed' }, 405);
  }

  // ── TO'PLAMGA KO'CHIRISH ────────────────────────────────────────
  if (path === '/api/saves/move') {
    if (method !== 'POST') return H.json({ error: 'method_not_allowed' }, 405);
    const body = await readJson();
    const kind = String(body.kind || '');
    const ref = String(body.ref || '').trim();
    if (!SAVE_KINDS.includes(kind)) return H.json({ error: 'bad_kind' }, 422);
    if (!refOk(kind, ref)) return H.json({ error: 'bad_ref' }, 422);
    if (!('collectionId' in body)) return H.json({ error: 'bad_collection' }, 422);
    const col = await resolveCollection(env, user.id, body.collectionId);
    if (!col.ok) return H.json({ error: col.error }, col.status);
    const res = await env.DB.prepare(`UPDATE user_saves SET collection_id = ? WHERE user_id = ? AND kind = ? AND ref = ?`)
      .bind(col.id, user.id, kind, ref).run();
    if (!Number(res?.meta?.changes || 0)) return H.json({ error: 'not_found' }, 404);
    return H.json({ kind, ref, collectionId: col.id });
  }

  if (path !== '/api/saves') return H.json({ error: 'not_found' }, 404);
  if (method !== 'GET' && method !== 'POST') {
    return H.json({ error: 'method_not_allowed' }, 405);
  }

  if (method === 'GET') {
    const kind = String(url.searchParams.get('kind') || '');
    if (!SAVE_KINDS.includes(kind)) return H.json({ error: 'bad_kind' }, 422);
    const where = ['user_id = ?', 'kind = ?'];
    const args = [user.id, kind];
    const colParam = url.searchParams.get('collectionId');
    if (colParam === 'none') where.push('collection_id IS NULL');
    else if (colParam) {
      const cid = Number(colParam);
      if (!Number.isInteger(cid) || cid <= 0) return H.json({ error: 'bad_collection' }, 422);
      where.push('collection_id = ?');
      args.push(cid);
    }
    const isPost = POST_KINDS.includes(kind);
    // Post turlarida sahifalash: har sahifada 30 tagacha post to'liq
    // shaklda to'ldiriladi. Eski turlar (reel/listing) — avvalgidek
    // hammasi bitta javobda.
    const page = Math.max(1, Math.floor(Number(url.searchParams.get('page')) || 1));
    const limit = isPost
      ? Math.min(POSTS_PAGE_MAX, Math.max(1, Math.floor(Number(url.searchParams.get('limit')) || POSTS_PAGE_MAX)))
      : MAX_PER_KIND;
    const rows = await env.DB.prepare(
      `SELECT kind, ref, created_at, collection_id FROM user_saves WHERE ${where.join(' AND ')}
        ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).bind(...args, isPost ? limit + 1 : limit, isPost ? (page - 1) * limit : 0).all();
    const all = rows.results || [];
    const list = isPost ? all.slice(0, limit) : all;
    const items = list.map((r) => ({
      kind: r.kind, ref: r.ref, createdAt: r.created_at,
      collectionId: r.collection_id == null ? null : Number(r.collection_id),
    }));
    if (!isPost) return H.json({ items });
    // Post kartalari lentaning O'ZI orqali (worker.js `postsByKeysD1`):
    // maxfiylik va REJADAGI post shartlari ikkinchi nusxada unutilmasin.
    const posts = items.length && H.postsByKeys
      ? await H.postsByKeys(env, items.map((i) => ({ kind, id: Number(i.ref) })), user.id).catch(() => new Map())
      : new Map();
    for (const it of items) it.post = posts.get(`${kind}:${Number(it.ref)}`) || null;
    return H.json({ items, hasMore: all.length > limit });
  }

  const body = await readJson();
  const kind = String(body?.kind || '');
  const ref = String(body?.ref || '').trim();
  if (!SAVE_KINDS.includes(kind)) return H.json({ error: 'bad_kind' }, 422);
  if (!refOk(kind, ref)) return H.json({ error: 'bad_ref' }, 422);
  const saved = body?.saved !== false;

  if (!saved) {
    await env.DB.prepare(`DELETE FROM user_saves WHERE user_id = ? AND kind = ? AND ref = ?`)
      .bind(user.id, kind, ref).run();
    return H.json({ kind, ref, saved: false });
  }
  const col = await resolveCollection(env, user.id, body.collectionId);
  if (!col.ok) return H.json({ error: col.error }, col.status);
  const cnt = await env.DB.prepare(`SELECT COUNT(*) AS n FROM user_saves WHERE user_id = ? AND kind = ?`)
    .bind(user.id, kind).first();
  if (Number(cnt?.n || 0) >= MAX_PER_KIND) {
    const exists = await env.DB.prepare(`SELECT 1 AS x FROM user_saves WHERE user_id = ? AND kind = ? AND ref = ?`)
      .bind(user.id, kind, ref).first();
    if (!exists) return H.json({ error: 'limit_reached', limit: MAX_PER_KIND }, 409);
  }
  await env.DB.prepare(`INSERT OR IGNORE INTO user_saves (user_id, kind, ref, created_at, collection_id) VALUES (?,?,?,?,?)`)
    .bind(user.id, kind, ref, new Date().toISOString(), col.id ?? null).run();
  // Allaqachon saqlangan bo'lsa va to'plam aniq berilgan bo'lsa — ko'chiriladi.
  if (col.id !== undefined) {
    await env.DB.prepare(`UPDATE user_saves SET collection_id = ? WHERE user_id = ? AND kind = ? AND ref = ?`)
      .bind(col.id, user.id, kind, ref).run();
  }
  const row = await env.DB.prepare(`SELECT collection_id FROM user_saves WHERE user_id = ? AND kind = ? AND ref = ?`)
    .bind(user.id, kind, ref).first();
  return H.json({ kind, ref, saved: true, collectionId: row?.collection_id == null ? null : Number(row.collection_id) });
}
