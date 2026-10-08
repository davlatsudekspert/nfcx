// hosting/api/highlights.js — "AKTUAL" (Instagram Highlights), 2026-10.
//
// ═══ NIMA UCHUN BOR ═══
//
// Istoriya 24 soatdan keyin yo'qoladi. Biznes esa "Menyu", "Aksiyalar",
// "Manzil" kabi istoriyalarini profilida DOIMIY ko'rsatmoqchi. Egasi
// istoriyalarini nomli to'plamga (Aktual) yig'adi, to'plam profil
// tepasida dumaloq belgi bo'lib turadi.
//
// ═══ ISTORIYA O'CHSA HAM AKTUAL QOLADI ═══
//
// Istoriya qatori muddati o'tgach o'chiriladi (worker.js `addStoryD1`),
// uning fayli esa `purgeStoryMediaD1` bilan R2 dan o'chirilishi mumkin.
// Shuning uchun Aktual istoriyaga ISHORA qilmaydi — qo'shilgan paytdagi
// NUSXASINI saqlaydi (`story_highlight_items`: rasm/video manzili, matn,
// sana). Fayl tozalovchilari shu jadvalga qaraydi va bu yerda ishlatilgan
// faylni O'CHIRMAYDI:
//   * worker.js `purgeStoryMediaD1` → `highlightUsesUrl()`;
//   * account-purge.js `liveUseSql` (dalil arxivi muddati o'tgach navbatdagi
//     fayllar) — shu jadvallar ham "jonli ishlatilmoqda" ro'yxatida.
// Egasi istoriyani O'ZI o'chirsa ham Aktualdagi nusxa qoladi — uni
// Aktualdan alohida olib tashlaydi (`DELETE …/items/:itemId`).
//
// ═══ KIMGA KO'RINADI ═══
//
// Istoriya yo'llari bilan bir xil qoida: egasi o'chirilgan profil —
// bo'sh; faol bo'lmagan kompaniya — faqat egasiga; tomoshabin o'sha
// profilni bloklagan bo'lsa — bo'sh (lentadagi blok qoidasi).
//
// ═══ MARSHRUTLAR ═══
//
//   GET    /api/highlights?code=KOD | ?companyId=ID   (ommaviy)
//          → { highlights: [Highlight], canEdit }
//   POST   /api/highlights  { code | companyId, title, coverUrl?, storyIds? }  (egasi)
//          → 201 { highlight }
//   PATCH  /api/highlights/:id  { title?, coverUrl? }  (egasi) → { highlight }
//   DELETE /api/highlights/:id  (egasi) → { ok: true }
//   POST   /api/highlights/:id/items  { storyKind: 'story'|'company_story', storyId }  (egasi)
//          → 201 { item, highlight }
//   DELETE /api/highlights/:id/items/:itemId  (egasi) → { ok: true, highlight }
//
//   ADMIN (manager+, sabab MAJBURIY) — moderatsiya Aktualni chetlab o'tmasin:
//   DELETE /api/admin/highlights/:id                 { reason } → { ok } | { ok, alreadyGone }
//   DELETE /api/admin/highlights/:id/items/:itemId   { reason } → { ok } | { ok, alreadyGone }
//   Ikkalasi ham avval dalil arxiviga nusxa yozadi (`highlight`,
//   `highlight_item`), `highlight` shikoyatlarini yopadi va jurnalga yozadi.
//   Admin istoriyani o'chirganda (moderation.js) undan olingan Aktual
//   nusxalari ham o'chadi.
//
//   Highlight = { id, ownerKind: 'card'|'company', ownerId, title, coverUrl,
//                 itemCount, items: [Item], createdAt, updatedAt }
//   Item      = { id, storyId, imageUrl, videoUrl, caption, createdAt, addedAt }
//
// Jadvallar `CREATE TABLE IF NOT EXISTS` — worker.js `ensureCoreSchema`
// ichida (karta va hisob o'chirish batch'lari ularga yozadi).

import { blockedByUser } from './moderation.js';
import { IMAGE_PATH_RE } from './carousel.js';
import { archiveStmt } from './content-archive.js';

export const TITLE_MAX = 24;
export const MAX_HIGHLIGHTS = 50;
export const MAX_ITEMS = 100;

let ready = null;
export function ensureSchema(env) {
  ready ||= env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS story_highlights (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_kind TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      user_id INTEGER,
      title TEXT NOT NULL,
      cover_url TEXT,
      sort INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_story_highlights_owner ON story_highlights(owner_kind, owner_id)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS story_highlight_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      highlight_id INTEGER NOT NULL,
      story_id INTEGER NOT NULL,
      image_url TEXT,
      video_url TEXT,
      caption TEXT,
      story_created_at TEXT,
      created_at TEXT NOT NULL,
      UNIQUE (highlight_id, story_id)
    )`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_story_highlight_items ON story_highlight_items(highlight_id, id)`),
    // Fayl tozalovchilari manzil bo'yicha qidiradi (`highlightUsesUrl`).
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_story_highlight_items_image ON story_highlight_items(image_url)`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_story_highlight_items_video ON story_highlight_items(video_url)`),
  ]).catch((e) => { ready = null; throw e; });
  return ready;
}

/// Fayl Aktualda ishlatilmoqdami. Xato bo'lsa — `true` ("o'chirma"):
/// noto'g'ri o'chirilgan faylni qaytarib bo'lmaydi.
export async function highlightUsesUrl(env, url) {
  if (!url) return false;
  try {
    const row = await env.DB.prepare(
      `SELECT 1 AS x FROM story_highlight_items WHERE image_url = ? OR video_url = ?
       UNION ALL SELECT 1 AS x FROM story_highlights WHERE cover_url = ? LIMIT 1`
    ).bind(url, url, url).first();
    return !!row;
  } catch {
    return true;
  }
}

const APOS = /[‘’ʻʼ`´′]/g;
function ownerFromQuery(src) {
  const code = String(src?.code ?? '').trim();
  const company = String(src?.companyId ?? '').trim();
  if (code && company) return null;
  if (code) return /^[A-Za-z0-9]{1,32}$/.test(code) ? { kind: 'card', id: code.toUpperCase() } : null;
  if (company) {
    const id = company.replace(APOS, "'").toUpperCase();
    return /^[A-Z']{3,40}$/.test(id) ? { kind: 'company', id } : null;
  }
  return null;
}

const storyKindFor = (ownerKind) => (ownerKind === 'company' ? 'company_story' : 'story');

/// Egasi haqida: { exists, userId, active, deleted }. `active` — kompaniya
/// uchun `status = 'active'`, karta uchun doim true.
async function ownerInfo(env, owner) {
  const row = owner.kind === 'card'
    ? await env.DB.prepare(
      `SELECT CAST(c.user_id AS TEXT) AS uid, 'active' AS status,
              EXISTS (SELECT 1 FROM users u WHERE u.id = c.user_id AND u.deleted_at IS NOT NULL) AS deleted
         FROM cards c WHERE c.code = ?`
    ).bind(owner.id).first()
    : await env.DB.prepare(
      `SELECT CAST(co.owner_user_id AS TEXT) AS uid, co.status AS status,
              EXISTS (SELECT 1 FROM users u WHERE CAST(u.id AS TEXT) = CAST(co.owner_user_id AS TEXT)
                       AND u.deleted_at IS NOT NULL) AS deleted
         FROM companies co WHERE co.company_id = ?`
    ).bind(owner.id).first();
  if (!row) return { exists: false };
  return { exists: true, userId: row.uid == null ? '' : String(row.uid), active: String(row.status) === 'active', deleted: !!Number(row.deleted) };
}

function cleanTitle(v) {
  const t = String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!t) return { ok: false, error: 'title_required' };
  if (Array.from(t).length > TITLE_MAX) return { ok: false, error: 'title_too_long', max: TITLE_MAX };
  return { ok: true, title: t };
}

function itemOut(r, H) {
  const ms = (v) => {
    const d = v ? H.parseDbDate(v) : null;
    return d && !Number.isNaN(d.getTime()) ? d.getTime() : null;
  };
  return {
    id: Number(r.item_id ?? r.id),
    storyId: Number(r.story_id),
    imageUrl: r.image_url || '',
    videoUrl: r.video_url || '',
    caption: r.caption || '',
    createdAt: ms(r.story_created_at),
    addedAt: ms(r.item_created_at ?? r.created_at),
  };
}

function highlightOut(h, items, H) {
  const ms = (v) => {
    const d = v ? H.parseDbDate(v) : null;
    return d && !Number.isNaN(d.getTime()) ? d.getTime() : null;
  };
  const first = items.find((i) => i.imageUrl);
  // MUQOVA FAQAT SHU AKTUALDAGI RASM (S2): yozishda tekshiriladi, o'qishda
  // ham — element olib tashlangan (yoki admin o'chirgan) bo'lsa eski
  // muqova ko'rinmaydi, birinchi rasmga qaytadi.
  const coverOk = h.cover_url && items.some((i) => i.imageUrl === h.cover_url);
  return {
    id: Number(h.id),
    ownerKind: String(h.owner_kind),
    ownerId: String(h.owner_id),
    title: h.title,
    // Muqova tanlanmagan bo'lsa — birinchi rasm (ilova bo'sh doira chizmasin).
    coverUrl: coverOk ? h.cover_url : (first ? first.imageUrl : ''),
    itemCount: items.length,
    items,
    createdAt: ms(h.created_at),
    updatedAt: ms(h.updated_at),
  };
}

async function loadOne(env, H, id) {
  const rows = await env.DB.prepare(
    `SELECT h.*, i.id AS item_id, i.story_id, i.image_url, i.video_url, i.caption,
            i.story_created_at, i.created_at AS item_created_at
       FROM story_highlights h LEFT JOIN story_highlight_items i ON i.highlight_id = h.id
      WHERE h.id = ? ORDER BY i.id ASC`
  ).bind(id).all();
  const list = rows.results || [];
  if (!list.length) return null;
  const items = list.filter((r) => r.item_id != null).map((r) => itemOut(r, H));
  return highlightOut(list[0], items, H);
}

/// Aktual + uning egasi (kim tahrirlay oladi). Egasi bo'lmasa `forbidden`.
async function ownedHighlight(env, user, id) {
  const h = await env.DB.prepare(
    `SELECT h.*,
            CASE h.owner_kind
              WHEN 'card' THEN (SELECT CAST(c.user_id AS TEXT) FROM cards c WHERE c.code = h.owner_id)
              ELSE (SELECT CAST(co.owner_user_id AS TEXT) FROM companies co WHERE co.company_id = h.owner_id)
            END AS owner_uid
       FROM story_highlights h WHERE h.id = ?`
  ).bind(id).first();
  if (!h) return { status: 404, error: 'not_found' };
  if (String(h.owner_uid ?? '') !== String(user.id)) return { status: 403, error: 'forbidden' };
  return { h };
}

/// Muqova endi hech bir elementning rasmi bo'lmasa — tozalanadi.
function dropStaleCoverStmt(env, hid, nowTs) {
  return env.DB.prepare(
    `UPDATE story_highlights SET updated_at = ?,
            cover_url = CASE WHEN cover_url IN (SELECT image_url FROM story_highlight_items
                                                 WHERE highlight_id = ? AND image_url IS NOT NULL)
                             THEN cover_url ELSE NULL END
      WHERE id = ?`
  ).bind(nowTs, hid, hid);
}

/// Istoriya nusxasini Aktualga qo'shish statement'i (tekshiruvlardan keyin).
function insertItemStmt(env, highlightId, story, nowTs) {
  return env.DB.prepare(
    `INSERT OR IGNORE INTO story_highlight_items
       (highlight_id, story_id, image_url, video_url, caption, story_created_at, created_at)
     VALUES (?,?,?,?,?,?,?)`
  ).bind(highlightId, Number(story.id), story.image_url || null, story.video_url || null,
    story.caption || null, story.created_at || null, nowTs);
}

async function adminDelete(request, env, H, hid, itemId) {
  if (request.method !== 'DELETE') return H.json({ error: 'method_not_allowed' }, 405);
  const admin = await H.requireAdmin(request, env);
  if (!admin) return H.json({ error: 'unauthorized' }, 401);
  if (!H.roleAtLeast(admin, 'manager')) return H.json({ error: 'forbidden' }, 403);
  const body = await request.json().catch(() => null) || {};
  // SABAB MAJBURIY — odamning kontenti olib tashlanyapti (featured
  // to'xtatish bilan bir xil qoida).
  const reason = String(body.reason ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 200);
  if (!reason) return H.json({ error: 'reason_required' }, 422);
  await ensureSchema(env);
  const adminLabel = `admin#${Number(admin.adminId) || 0}:${String(admin.role || '')}`.slice(0, 64);
  const by = { admin: adminLabel, reason: reason.slice(0, 40) };
  const now = H.nowTs();
  let changed;
  if (itemId) {
    const res = await env.DB.batch([
      archiveStmt(env, 'highlight_item', 'id = ? AND highlight_id = ?', [itemId, hid], by),
      env.DB.prepare(`DELETE FROM story_highlight_items WHERE id = ? AND highlight_id = ?`).bind(itemId, hid),
      dropStaleCoverStmt(env, hid, now),
    ]);
    changed = Number(res?.[1]?.meta?.changes || 0);
  } else {
    // Avval to'plam va uning elementlari arxivga, keyin elementlar, OXIRIDA to'plam.
    const res = await env.DB.batch([
      archiveStmt(env, 'highlight', 'id = ?', [hid], by),
      archiveStmt(env, 'highlight_item', 'highlight_id = ?', [hid], by),
      env.DB.prepare(`DELETE FROM story_highlight_items WHERE highlight_id = ?`).bind(hid),
      env.DB.prepare(`DELETE FROM story_highlights WHERE id = ?`).bind(hid),
    ]);
    changed = Number(res?.[res.length - 1]?.meta?.changes || 0);
    await env.DB.prepare(
      `UPDATE content_reports SET status = 'resolved', resolved_at = ?, resolved_by = ?
        WHERE target_kind = 'highlight' AND target_id = ? AND status <> 'resolved'`
    ).bind(now, adminLabel, String(hid)).run().catch(() => {});
  }
  await H.logAdminActivity?.(env, {
    action: itemId ? 'highlight_item_delete' : 'highlight_delete',
    details: `highlight#${hid}${itemId ? ` item#${itemId}` : ''} ${adminLabel}: ${reason}${changed ? '' : ' (allaqachon yo‘q)'}`,
    ip: H.reqIp?.(request),
  })?.catch?.(() => {});
  return H.json(changed ? { ok: true } : { ok: true, alreadyGone: true });
}

export async function handle(request, env, url, H) {
  const path = url.pathname;
  const adm = path.match(/^\/api\/admin\/highlights\/(\d{1,12})(?:\/items\/(\d{1,12}))?$/);
  if (adm) return adminDelete(request, env, H, Number(adm[1]), adm[2] ? Number(adm[2]) : 0);
  if (path !== '/api/highlights' && !path.startsWith('/api/highlights/')) return null;
  const method = request.method;
  await ensureSchema(env);
  const readJson = async () => {
    const b = await request.json().catch(() => null);
    return b && typeof b === 'object' && !Array.isArray(b) ? b : {};
  };

  // ── OMMAVIY RO'YXAT ─────────────────────────────────────────────
  if (path === '/api/highlights' && method === 'GET') {
    const owner = ownerFromQuery({ code: url.searchParams.get('code'), companyId: url.searchParams.get('companyId') });
    if (!owner) return H.json({ error: 'bad_owner' }, 422);
    // Egasi, sessiya va to'plamlar BIR to'lqinda; blok ro'yxati — faqat
    // kirgan odam uchun, ikkinchisida.
    const viewerP = H.getCurrentUser(request, env).catch(() => null);
    const [info, viewer, rows] = await Promise.all([
      ownerInfo(env, owner),
      viewerP,
      env.DB.prepare(
        `SELECT h.*, i.id AS item_id, i.story_id, i.image_url, i.video_url, i.caption,
                i.story_created_at, i.created_at AS item_created_at
           FROM story_highlights h LEFT JOIN story_highlight_items i ON i.highlight_id = h.id
                -- Tekshirilmagan medialisi (pending, api/content-guard.js)
                -- istoriya nusxasi admin tasdig'igacha ko'rinmaydi.
                AND NOT EXISTS (SELECT 1 FROM content_pending cpd WHERE cpd.kind = 'story' AND cpd.id = i.story_id)
          WHERE h.owner_kind = ? AND h.owner_id = ?
          ORDER BY h.sort ASC, h.id DESC, i.id ASC`
      ).bind(owner.kind, owner.id).all(),
    ]);
    if (!info.exists || info.deleted) return H.json({ highlights: [], canEdit: false });
    const isOwner = !!(viewer && info.userId && info.userId === String(viewer.id));
    if (!info.active && !isOwner) return H.json({ highlights: [], canEdit: false });
    if (viewer && !isOwner) {
      const blocks = await blockedByUser(env, viewer.id).catch(() => []);
      const kind = owner.kind === 'company' ? 'company' : 'record';
      if (blocks.some((b) => b.kind === kind && String(b.id).toUpperCase() === owner.id)) {
        return H.json({ highlights: [], canEdit: false });
      }
    }
    const byId = new Map();
    for (const r of rows.results || []) {
      if (!byId.has(Number(r.id))) byId.set(Number(r.id), { h: r, items: [] });
      if (r.item_id != null) byId.get(Number(r.id)).items.push(itemOut(r, H));
    }
    return H.json({
      highlights: [...byId.values()].map(({ h, items }) => highlightOut(h, items, H)),
      canEdit: isOwner,
    });
  }

  // Qolgan hamma amal — faqat egasi.
  const user = await H.getCurrentUser(request, env).catch(() => null);
  if (!user) return H.json({ error: 'unauthorized' }, 401);
  if (user.bannedUntil) return H.json({ error: 'banned' }, 403);

  // ── YARATISH ────────────────────────────────────────────────────
  if (path === '/api/highlights' && method === 'POST') {
    const body = await readJson();
    const owner = ownerFromQuery(body);
    if (!owner) return H.json({ error: 'bad_owner' }, 422);
    const t = cleanTitle(body.title);
    if (!t.ok) return H.json({ error: t.error, ...(t.max ? { max: t.max } : {}) }, 422);
    const cover = body.coverUrl ? String(body.coverUrl).trim() : '';
    if (cover && !IMAGE_PATH_RE.test(cover)) return H.json({ error: 'bad_cover' }, 422);
    const storyIds = Array.isArray(body.storyIds)
      ? [...new Set(body.storyIds.map(Number).filter((n) => Number.isInteger(n) && n > 0))]
      : [];
    if (storyIds.length > MAX_ITEMS) return H.json({ error: 'too_many_items', limit: MAX_ITEMS }, 422);

    const [info, cnt] = await Promise.all([
      ownerInfo(env, owner),
      env.DB.prepare(`SELECT COUNT(*) AS n FROM story_highlights WHERE owner_kind = ? AND owner_id = ?`)
        .bind(owner.kind, owner.id).first(),
    ]);
    if (!info.exists || info.deleted) return H.json({ error: 'not_found' }, 404);
    if (info.userId !== String(user.id)) return H.json({ error: 'forbidden' }, 403);
    if (Number(cnt?.n || 0) >= MAX_HIGHLIGHTS) return H.json({ error: 'limit_reached', limit: MAX_HIGHLIGHTS }, 409);

    // Boshlang'ich istoriyalar — faqat SHU egasiniki (begona istoriya
    // nusxasini o'z profiliga olib bo'lmasin).
    let stories = [];
    if (storyIds.length) {
      const r = await env.DB.prepare(
        `SELECT id, image_url, video_url, caption, created_at FROM stories
          WHERE owner_kind = ? AND owner_id = ? AND id IN (${storyIds.map(() => '?').join(',')})`
      ).bind(owner.kind, owner.id, ...storyIds).all();
      stories = r.results || [];
      if (stories.length !== storyIds.length) return H.json({ error: 'story_not_found' }, 404);
      stories.sort((a, b) => storyIds.indexOf(Number(a.id)) - storyIds.indexOf(Number(b.id)));
    }
    // Muqova — faqat shu Aktualga qo'shilayotgan istoriyalardan birining
    // rasmi (istalgan `/uploads/` fayli emas: begona yoki o'chirilgan
    // kontentni muqova qilib chiqarib bo'lmasin).
    if (cover && !stories.some((st) => st.image_url === cover)) return H.json({ error: 'bad_cover' }, 422);
    const now = H.nowTs();
    const row = await env.DB.prepare(
      `INSERT INTO story_highlights (owner_kind, owner_id, user_id, title, cover_url, sort, created_at, updated_at)
       VALUES (?,?,?,?,?,0,?,?) RETURNING id`
    ).bind(owner.kind, owner.id, user.id, t.title, cover || null, now, now).first();
    const id = Number(row?.id);
    if (stories.length) await env.DB.batch(stories.map((s) => insertItemStmt(env, id, s, now)));
    return H.json({ highlight: await loadOne(env, H, id) }, 201);
  }

  const one = path.match(/^\/api\/highlights\/(\d{1,12})$/);
  const items = path.match(/^\/api\/highlights\/(\d{1,12})\/items$/);
  const oneItem = path.match(/^\/api\/highlights\/(\d{1,12})\/items\/(\d{1,12})$/);
  const hid = Number((one || items || oneItem || [])[1]);
  if (!hid) return H.json({ error: 'not_found' }, 404);
  const owned = await ownedHighlight(env, user, hid);
  if (owned.error) return H.json({ error: owned.error }, owned.status);

  // ── NOMI / MUQOVASI ─────────────────────────────────────────────
  if (one && method === 'PATCH') {
    const body = await readJson();
    const set = [];
    const args = [];
    if ('title' in body) {
      const t = cleanTitle(body.title);
      if (!t.ok) return H.json({ error: t.error, ...(t.max ? { max: t.max } : {}) }, 422);
      set.push('title = ?'); args.push(t.title);
    }
    if ('coverUrl' in body) {
      const cover = body.coverUrl ? String(body.coverUrl).trim() : '';
      if (cover && !IMAGE_PATH_RE.test(cover)) return H.json({ error: 'bad_cover' }, 422);
      if (cover) {
        const own = await env.DB.prepare(
          `SELECT 1 AS x FROM story_highlight_items WHERE highlight_id = ? AND image_url = ? LIMIT 1`
        ).bind(hid, cover).first();
        if (!own) return H.json({ error: 'bad_cover' }, 422);
      }
      set.push('cover_url = ?'); args.push(cover || null);
    }
    if (!set.length) return H.json({ error: 'nothing_to_update' }, 422);
    set.push('updated_at = ?'); args.push(H.nowTs());
    await env.DB.prepare(`UPDATE story_highlights SET ${set.join(', ')} WHERE id = ?`).bind(...args, hid).run();
    return H.json({ highlight: await loadOne(env, H, hid) });
  }

  // ── O'CHIRISH ───────────────────────────────────────────────────
  if (one && method === 'DELETE') {
    await env.DB.batch([
      env.DB.prepare(`DELETE FROM story_highlight_items WHERE highlight_id = ?`).bind(hid),
      env.DB.prepare(`DELETE FROM story_highlights WHERE id = ?`).bind(hid),
    ]);
    return H.json({ ok: true });
  }

  // ── ISTORIYA QO'SHISH ───────────────────────────────────────────
  if (items && method === 'POST') {
    const body = await readJson();
    const storyKind = String(body.storyKind || '');
    const storyId = Number(body.storyId);
    if (!['story', 'company_story'].includes(storyKind)) return H.json({ error: 'bad_kind' }, 422);
    if (!Number.isInteger(storyId) || storyId <= 0) return H.json({ error: 'bad_story' }, 422);
    // Istoriya turi Aktual egasiga mos bo'lishi shart: kompaniya Aktualiga
    // shaxsiy istoriya (yoki aksincha) qo'shilmaydi.
    if (storyKind !== storyKindFor(owned.h.owner_kind)) return H.json({ error: 'bad_kind' }, 422);
    const [story, cnt] = await Promise.all([
      env.DB.prepare(
        `SELECT id, image_url, video_url, caption, created_at FROM stories
          WHERE id = ? AND owner_kind = ? AND owner_id = ?`
      ).bind(storyId, owned.h.owner_kind, owned.h.owner_id).first(),
      env.DB.prepare(`SELECT COUNT(*) AS n FROM story_highlight_items WHERE highlight_id = ?`).bind(hid).first(),
    ]);
    if (!story) return H.json({ error: 'story_not_found' }, 404);
    if (Number(cnt?.n || 0) >= MAX_ITEMS) return H.json({ error: 'limit_reached', limit: MAX_ITEMS }, 409);
    const now = H.nowTs();
    const [ins] = await env.DB.batch([
      insertItemStmt(env, hid, story, now),
      env.DB.prepare(`UPDATE story_highlights SET updated_at = ? WHERE id = ?`).bind(now, hid),
    ]);
    if (!Number(ins?.meta?.changes || 0)) return H.json({ error: 'already_added' }, 409);
    const row = await env.DB.prepare(
      `SELECT * FROM story_highlight_items WHERE highlight_id = ? AND story_id = ?`
    ).bind(hid, storyId).first();
    return H.json({ item: itemOut(row, H), highlight: await loadOne(env, H, hid) }, 201);
  }

  // ── ISTORIYANI AKTUALDAN OLIB TASHLASH ─────────────────────────
  if (oneItem && method === 'DELETE') {
    const res = await env.DB.prepare(`DELETE FROM story_highlight_items WHERE id = ? AND highlight_id = ?`)
      .bind(Number(oneItem[2]), hid).run();
    if (!Number(res?.meta?.changes || 0)) return H.json({ error: 'not_found' }, 404);
    await dropStaleCoverStmt(env, hid, H.nowTs()).run();
    return H.json({ ok: true, highlight: await loadOne(env, H, hid) });
  }

  return H.json({ error: 'method_not_allowed' }, 405);
}
