// hosting/api/legal-requests.js — "HUQUQIY SO'ROV": BITTA ODAM HAQIDA HAMMASI.
//
// ═══ NIMA UCHUN BOR ═══
//
// Egasining talabi (2026-10): sud yoki huquqni muhofaza qiluvchi organdan
// "shu odam joylagan noqonuniy rasm/video" bo'yicha so'rov kelsa, o'sha
// odam haqidagi HAMMA narsani bir joyda tez topib, topshirish kerak.
// "Dalil arxivi" (content-archive.js) faqat O'CHIRILGAN kontentni
// ko'rsatadi; bu modul esa HOZIR TURGAN va O'CHIRILGAN kontentni bitta
// vaqt chizig'iga yig'adi.
//
// ═══ YO'LLAR (hammasi faqat admin; super_admin va manager) ═══
//
//   GET  /api/admin/legal/subject?q=<telefon|email|NFC ID|Business ID|#id>
//          &kind=post|reel|story|comment|card_video|card_file&source=live|archive
//          &cursor=&limit=
//        -> { subject, items, nextCursor }   (eng yangisi birinchi)
//   POST /api/admin/legal/hold { userId, hold: true|false, note }
//        -> hold=true da `note` majburiy ("Sud so'rovi №…"). Belgi mavjud
//           `account_legal_holds` jadvaliga yoziladi — hisob purge'i
//           (account-purge.js, blocker `legal_hold`) va dalil arxivi
//           muddati (EVIDENCE_RETENTION) u bilan ALLAQACHON to'xtaydi.
//           Olib tashlash (hold=false) — faqat super_admin.
//   GET  /api/admin/legal/export?userId=&format=json
//        -> to'liq dosye: { subject, items (≤ 5000), generatedAt, generatedBy }.
//           ZIP (media fayllari bilan) brauzerda yig'iladi — server faylni
//           o'zi qayta yubormaydi.
//
// Har bir chaqiruv admin jurnaliga yoziladi (kim, nima qidirdi). Email va
// telefon jurnalga OCHIQ yozilmaydi — turi va xeshi (content-archive.js
// bilan bir xil qoida); kod, ID va topilgan user# — ochiq.
//
// Faqat O'QIYDI (hold'dan tashqari). Media manzillari — bazadagi o'sha
// `/uploads/...` manzillar; R2 fayllariga tegilmaydi.

import { ensureArchiveTable } from './content-archive.js';
import { ensureSchema as ensureCommentsSchema } from './comments.js';
import { ensurePurgeSchema } from './account-purge.js';

export const LEGAL_KINDS = ['post', 'reel', 'story', 'comment', 'card_video', 'card_file'];
// "Istoriya" filtri Aktual (highlight) nusxalarini ham oladi.
const KIND_GROUP = { story: ['story', 'highlight'] };
const PAGE = 50;
const PAGE_MAX = 200;
export const EXPORT_MAX = 5000;

const SEC = (c) => `substr(replace(COALESCE(${c}, ''), 'T', ' '), 1, 19)`;

function safeId(v) {
  const n = Number(v);
  return Number.isSafeInteger(n) && n > 0 ? n : 0;
}

async function tableInfo(env) {
  const t = await env.DB.prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`).all();
  const tables = new Set((t?.results || []).map((r) => String(r.name)));
  const cols = new Set();
  for (const [tb, c] of [['posts', 'media_json'], ['company_posts', 'media_json'], ['content_archive', 'media_json'],
    ['content_comments', 'deleted_at'], ['users', 'signup_source'], ['users', 'purged_at'], ['users', 'deletion_source']]) {
    if (!tables.has(tb)) continue;
    const info = await env.DB.prepare(`PRAGMA table_info(${tb})`).all().catch(() => null);
    if ((info?.results || []).some((r) => String(r.name) === c)) cols.add(`${tb}.${c}`);
  }
  return { tables, cols };
}

// ── KIMNI QIDIRYAPMIZ ─────────────────────────────────────────────────
// Tartib: email → "#123"/"id:123" → NFC ID → Business ID → telefon →
// faqat raqam (foydalanuvchi raqami) → egalik tarixi (kod qayta sotilgan
// yoki bo'shatilgan bo'lsa — oxirgi egasi).
export async function resolveSubject(env, H, rawQ, info) {
  const q = String(rawQ || '').trim().slice(0, 120);
  if (!q) return null;
  const has = (t) => info.tables.has(t);
  const one = (sql, ...b) => env.DB.prepare(sql).bind(...b).first().catch(() => null);
  if (q.includes('@')) {
    const r = await one(`SELECT id FROM users WHERE LOWER(email) = LOWER(?) ORDER BY id DESC LIMIT 1`, q);
    if (r) return { userId: Number(r.id), matchedBy: 'email' };
    if (has('evidence_identity')) {
      const i = await one(`SELECT user_id FROM evidence_identity WHERE LOWER(email) = LOWER(?) ORDER BY user_id DESC LIMIT 1`, q);
      if (i) return { userId: Number(i.user_id), matchedBy: 'email' };
    }
    return null;
  }
  const idm = q.match(/^(?:#|id:)\s*(\d{1,12})$/i);
  if (idm) {
    const r = await one(`SELECT id FROM users WHERE id = ?`, Number(idm[1]));
    return r ? { userId: Number(r.id), matchedBy: 'user_id' } : null;
  }
  const card = await one(`SELECT user_id FROM cards WHERE UPPER(code) = UPPER(?) AND user_id IS NOT NULL LIMIT 1`, q);
  if (card) return { userId: Number(card.user_id), matchedBy: 'nfc_id' };
  if (has('companies')) {
    const co = await one(`SELECT owner_user_id FROM companies WHERE UPPER(company_id) = UPPER(?) LIMIT 1`, q);
    if (co && safeId(co.owner_user_id)) return { userId: Number(co.owner_user_id), matchedBy: 'business_id' };
  }
  const digits = q.replace(/[\s\-().]/g, '');
  if (/^\+?\d{9,15}$/.test(digits)) {
    const norm = (H.normalizePhoneD1 && H.normalizePhoneD1(q)) || '';
    const variants = [...new Set([norm, digits, digits.startsWith('+') ? digits.slice(1) : `+${digits}`].filter(Boolean))];
    const ph = variants.map(() => '?').join(',');
    const r = await env.DB.prepare(
      `SELECT id FROM users WHERE phone IN (${ph}) ORDER BY (deleted_at IS NULL) DESC, id DESC`
    ).bind(...variants).all().catch(() => null);
    const ids = (r?.results || []).map((x) => Number(x.id));
    if (ids.length) return { userId: ids[0], matchedBy: 'phone', candidates: ids.slice(0, 10) };
    if (has('evidence_identity')) {
      const i = await env.DB.prepare(`SELECT user_id FROM evidence_identity WHERE phone IN (${ph}) ORDER BY user_id DESC LIMIT 1`)
        .bind(...variants).first().catch(() => null);
      if (i) return { userId: Number(i.user_id), matchedBy: 'phone' };
    }
  }
  if (/^\d{1,12}$/.test(q)) {
    const r = await one(`SELECT id FROM users WHERE id = ?`, Number(q));
    if (r) return { userId: Number(r.id), matchedBy: 'user_id' };
  }
  if (has('evidence_owner_history')) {
    const h = await one(`SELECT user_id, owner_kind FROM evidence_owner_history WHERE UPPER(owner_id) = UPPER(?)
      ORDER BY released_at DESC LIMIT 1`, q);
    if (h && safeId(h.user_id)) return { userId: Number(h.user_id), matchedBy: h.owner_kind === 'company' ? 'business_id_history' : 'nfc_id_history' };
  }
  return null;
}

// ── PROFIL XULOSASI ───────────────────────────────────────────────────
export async function subjectSummary(env, H, userId, info) {
  const id = safeId(userId);
  if (!id) return null;
  const pick = (c) => (info.cols.has(`users.${c}`) ? c : `NULL AS ${c}`);
  const u = await env.DB.prepare(
    `SELECT id, email, phone, created_at, is_test, deleted_at, suspended_until, suspend_reason, banned_until,
            ${pick('signup_source')}, ${pick('purged_at')}, ${pick('deletion_source')}
       FROM users WHERE id = ?`
  ).bind(id).first();
  if (!u) return null;
  const all = async (sql, ...b) => ((await env.DB.prepare(sql).bind(...b).all().catch(() => null))?.results || []);
  const [cards, companies, former, identity, hold] = await Promise.all([
    all(`SELECT code, name, profile_type, created_at FROM cards WHERE user_id = ? ORDER BY ts ASC`, id),
    info.tables.has('companies')
      ? all(`SELECT company_id, display_name, status, created_at FROM companies WHERE CAST(owner_user_id AS TEXT) = ? ORDER BY created_at ASC`, String(id))
      : [],
    info.tables.has('evidence_owner_history')
      ? all(`SELECT owner_kind, owner_id, released_at FROM evidence_owner_history WHERE user_id = ? ORDER BY released_at DESC LIMIT 100`, String(id))
      : [],
    info.tables.has('evidence_identity')
      ? env.DB.prepare(`SELECT email, phone FROM evidence_identity WHERE user_id = ?`).bind(id).first().catch(() => null)
      : null,
    info.tables.has('account_legal_holds')
      ? env.DB.prepare(`SELECT note, set_by, set_at FROM account_legal_holds WHERE user_id = ?`).bind(id).first().catch(() => null)
      : null,
  ]);
  // Purge qilingan (tombstone) hisob: jonli qatorda email/telefon yo'q —
  // purge paytida dalil uchun olingan nusxa ko'rsatiladi (faqat admin).
  const purged = !!u.purged_at || /@deleted\.invalid$/i.test(String(u.email || ''));
  return {
    userId: Number(u.id),
    email: purged ? String(identity?.email || '') : String(u.email || ''),
    phone: purged ? String(identity?.phone || '') : String(u.phone || ''),
    createdAt: u.created_at || null,
    signupSource: u.signup_source || 'web',
    isTest: !!u.is_test,
    status: {
      deletedAt: u.deleted_at || null,
      purgedAt: u.purged_at || null,
      purged,
      deletionSource: u.deletion_source || null,
      suspendedUntil: u.suspended_until || null,
      suspendReason: u.suspend_reason || null,
      bannedUntil: u.banned_until || null,
    },
    cards: cards.map((c) => ({ code: String(c.code), name: c.name || '', type: c.profile_type || 'personal', createdAt: c.created_at || null })),
    companies: companies.map((c) => ({ id: String(c.company_id), name: c.display_name || '', status: c.status || '', createdAt: c.created_at || null })),
    formerIds: former.map((f) => ({ kind: f.owner_kind === 'company' ? 'company' : 'card', id: String(f.owner_id), releasedAt: f.released_at || null })),
    legalHold: hold ? { note: String(hold.note || ''), by: String(hold.set_by || ''), at: hold.set_at || null } : null,
  };
}

// ── VAQT CHIZIG'I: HOZIR TURGAN + O'CHIRILGAN ─────────────────────────
// Har qism bir xil ustunlarni beradi. `uid` — manba + jadval + raqam
// (kursor uchun barqaror va yagona). Foydalanuvchi raqami SQL ga SON
// sifatida yoziladi (`safeId`) — bind soni cheklovi (D1: 100) uchun;
// foydalanuvchi kiritgan matn bu yerga tushmaydi.
function timelineSql(info, uid) {
  const U = safeId(uid);
  if (!U) throw new Error('legal_bad_user_id');
  const has = (t) => info.tables.has(t);
  const myCards = `(SELECT code FROM cards WHERE user_id = ${U})`;
  const myCompanies = has('companies') ? `(SELECT company_id FROM companies WHERE CAST(owner_user_id AS TEXT) = '${U}')` : `(SELECT NULL WHERE 0)`;
  const postKind = (alias) => `CASE WHEN COALESCE(${alias}.video_url, '') <> '' THEN 'reel' ELSE 'post' END`;
  const row = ({ source, tag, kind, id, ownerKind, ownerCode, body, image, video, file, media = 'NULL', created, deleted = 'NULL',
    byUser = '0', byAdmin = `''`, reason = `''`, targetKind = `''`, targetId = '0', expires = 'NULL', from }) => `
    SELECT '${source}' AS source, ${kind} AS kind, ${id} AS id, ${ownerKind} AS owner_kind, CAST(${ownerCode} AS TEXT) AS owner_code,
           ${body} AS body, ${image} AS image_url, ${video} AS video_url, ${file} AS file_url, ${media} AS media_json,
           ${created} AS created_at, ${deleted} AS deleted_at, ${byUser} AS deleted_by_user_id, ${byAdmin} AS deleted_by_admin,
           ${reason} AS reason, ${targetKind} AS target_kind, ${targetId} AS target_id, ${expires} AS expires_at,
           ${SEC(`COALESCE(${created}, ${deleted})`)} AS sort_ts,
           '${source === 'live' ? 'l' : 'a'}:${tag}:' || printf('%012d', ${id}) AS uid
      ${from}`;
  const parts = [];
  if (has('posts')) {
    parts.push(row({
      source: 'live', tag: 'p', kind: postKind('p'), id: 'p.id', ownerKind: `'card'`, ownerCode: 'p.code',
      body: `COALESCE(p.caption, '')`, image: 'p.image_url', video: 'p.video_url', file: 'NULL',
      media: info.cols.has('posts.media_json') ? 'p.media_json' : 'NULL', created: 'p.created_at',
      from: `FROM posts p WHERE p.user_id = ${U} OR p.code IN ${myCards}`,
    }));
  }
  if (has('company_posts')) {
    parts.push(row({
      source: 'live', tag: 'cp', kind: postKind('cp'), id: 'cp.id', ownerKind: `'company'`, ownerCode: 'cp.company_id',
      body: `COALESCE(cp.caption, '')`, image: 'cp.image_url', video: 'cp.video_url', file: 'NULL',
      media: info.cols.has('company_posts.media_json') ? 'cp.media_json' : 'NULL', created: 'cp.created_at',
      from: `FROM company_posts cp WHERE cp.company_id IN ${myCompanies}`,
    }));
  }
  if (has('stories')) {
    // Muddati o'tgan, lekin hali o'chirilmagan istoriya ham — `expires_at` bilan.
    parts.push(row({
      source: 'live', tag: 's', kind: `'story'`, id: 's.id', ownerKind: 's.owner_kind', ownerCode: 's.owner_id',
      body: `COALESCE(s.caption, '')`, image: 's.image_url', video: 's.video_url', file: 'NULL', created: 's.created_at',
      expires: 's.expires_at',
      from: `FROM stories s WHERE s.user_id = ${U}
        OR (s.owner_kind = 'card' AND s.owner_id IN ${myCards})
        OR (s.owner_kind = 'company' AND s.owner_id IN ${myCompanies})`,
    }));
  }
  if (has('story_highlight_items') && has('story_highlights')) {
    parts.push(row({
      source: 'live', tag: 'h', kind: `'highlight'`, id: 'hi.id', ownerKind: 'h.owner_kind', ownerCode: 'h.owner_id',
      body: `COALESCE(hi.caption, h.title, '')`, image: 'hi.image_url', video: 'hi.video_url', file: 'NULL',
      created: 'COALESCE(hi.story_created_at, hi.created_at)',
      from: `FROM story_highlight_items hi JOIN story_highlights h ON h.id = hi.highlight_id
        WHERE h.user_id = ${U} OR (h.owner_kind = 'card' AND h.owner_id IN ${myCards})
          OR (h.owner_kind = 'company' AND h.owner_id IN ${myCompanies})`,
    }));
  }
  if (has('card_videos')) {
    parts.push(row({
      source: 'live', tag: 'v', kind: `'card_video'`, id: 'v.id', ownerKind: `'card'`, ownerCode: 'v.code',
      body: `COALESCE(v.title, '')`, image: 'v.thumb_url', video: 'v.video_url', file: 'NULL', created: 'v.created_at',
      from: `FROM card_videos v WHERE v.code IN ${myCards}`,
    }));
  }
  if (has('card_files')) {
    parts.push(row({
      source: 'live', tag: 'f', kind: `'card_file'`, id: 'f.id', ownerKind: `'card'`, ownerCode: 'f.code',
      body: `COALESCE(f.title, '')`, image: 'NULL', video: 'NULL', file: 'f.file_url', created: 'f.created_at',
      from: `FROM card_files f WHERE f.code IN ${myCards}`,
    }));
  }
  if (has('content_comments')) {
    // O'chirilgan (soft-delete) izoh — arxiv qismida; bu yerda faqat tiriklari.
    parts.push(row({
      source: 'live', tag: 'c', kind: `'comment'`, id: 'c.id', ownerKind: `''`, ownerCode: 'c.author_code',
      body: 'c.body', image: 'NULL', video: 'NULL', file: 'NULL', created: 'c.created_at',
      targetKind: 'c.target_kind', targetId: 'c.target_id',
      from: `FROM content_comments c WHERE c.user_id = ${U}${info.cols.has('content_comments.deleted_at') ? ' AND c.deleted_at IS NULL' : ''}`,
    }));
  }
  if (has('content_archive')) {
    parts.push(row({
      source: 'archive', tag: 'a', id: 'a.id',
      kind: `CASE WHEN a.kind IN ('post','company_post') THEN ${postKind('a')}
                  WHEN a.kind IN ('highlight','highlight_item') THEN 'highlight' ELSE a.kind END`,
      ownerKind: 'a.owner_kind', ownerCode: 'a.owner_id', body: 'a.body', image: 'a.image_url', video: 'a.video_url',
      file: 'a.file_url', media: info.cols.has('content_archive.media_json') ? 'a.media_json' : 'NULL',
      created: 'a.created_at', deleted: 'a.deleted_at', byUser: 'a.deleted_by_user_id', byAdmin: 'a.deleted_by_admin',
      reason: 'a.reason', targetId: 'a.content_id',
      from: `FROM content_archive a WHERE a.user_id = '${U}'`,
    }));
  }
  if (has('content_comment_archive')) {
    parts.push(row({
      source: 'archive', tag: 'c', kind: `'comment'`, id: 'ca.id', ownerKind: `''`, ownerCode: 'ca.author_code',
      body: 'ca.body', image: 'NULL', video: 'NULL', file: 'NULL', created: 'ca.created_at', deleted: 'ca.deleted_at',
      byUser: 'ca.deleted_by_user_id', byAdmin: 'ca.deleted_by_admin', reason: 'ca.reason',
      targetKind: 'ca.target_kind', targetId: 'ca.target_id',
      from: `FROM content_comment_archive ca WHERE ca.user_id = ${U}`,
    }));
  }
  return parts.length ? parts.join('\n UNION ALL \n') : `SELECT NULL AS uid WHERE 0`;
}

const encCursor = (r) => btoa(JSON.stringify({ t: r.sort_ts, u: r.uid })).replace(/=+$/, '');
function decCursor(v) {
  try {
    const o = JSON.parse(atob(String(v || '')));
    return o && typeof o.t === 'string' && typeof o.u === 'string' ? o : null;
  } catch { return null; }
}

function mediaList(v) {
  if (!v) return [];
  try {
    const arr = JSON.parse(v);
    return Array.isArray(arr) ? arr.map((m) => String(m?.url || '')).filter(Boolean) : [];
  } catch { return []; }
}

function shapeItem(H, r) {
  const ms = (v) => {
    if (!v) return null;
    const d = H.parseDbDate(v);
    return d && !Number.isNaN(d.getTime()) ? d.getTime() : null;
  };
  const archived = r.source === 'archive';
  const extra = mediaList(r.media_json).filter((u) => u !== r.image_url && u !== r.video_url);
  return {
    source: archived ? 'archive' : 'live',
    kind: String(r.kind || ''),
    id: Number(r.id) || 0,
    uid: String(r.uid || ''),
    ownerKind: String(r.owner_kind || ''),
    ownerCode: String(r.owner_code || '').toUpperCase(),
    text: String(r.body || ''),
    imageUrl: r.image_url || '',
    videoUrl: r.video_url || '',
    fileUrl: r.file_url || '',
    // Karusel: qo'shimcha rasmlar (birinchisi `imageUrl` da).
    mediaUrls: extra,
    createdAt: ms(r.created_at),
    expiresAt: ms(r.expires_at),
    deletedAt: archived ? ms(r.deleted_at) : null,
    deletedBy: !archived ? null
      : r.deleted_by_admin ? { admin: String(r.deleted_by_admin) }
        : Number(r.deleted_by_user_id) ? { userId: Number(r.deleted_by_user_id) } : { system: true },
    reason: archived ? String(r.reason || '') : '',
    // Izoh: qaysi kontentga yozilgan. Arxivdagi post/istoriya: asl raqami.
    target: r.kind === 'comment'
      ? { kind: String(r.target_kind || ''), id: Number(r.target_id) || 0 }
      : (archived ? { contentId: Number(r.target_id) || 0 } : null),
  };
}

async function timeline(env, H, info, userId, { kind, source, cursor, limit }) {
  const conds = [];
  const binds = [];
  if (kind) {
    const list = KIND_GROUP[kind] || [kind];
    conds.push(`e.kind IN (${list.map(() => '?').join(',')})`);
    binds.push(...list);
  }
  if (source === 'live' || source === 'archive') { conds.push('e.source = ?'); binds.push(source); }
  if (cursor) {
    conds.push('(e.sort_ts < ? OR (e.sort_ts = ? AND e.uid < ?))');
    binds.push(cursor.t, cursor.t, cursor.u);
  }
  const rows = await env.DB.prepare(
    `SELECT e.* FROM (${timelineSql(info, userId)}) e
      ${conds.length ? `WHERE ${conds.join(' AND ')}` : ''}
      ORDER BY e.sort_ts DESC, e.uid DESC LIMIT ?`
  ).bind(...binds, limit + 1).all();
  const list = rows?.results || [];
  const page = list.slice(0, limit);
  return {
    items: page.map((r) => shapeItem(H, r)),
    nextCursor: list.length > limit && page.length ? encCursor(page[page.length - 1]) : null,
  };
}

// Jurnal uchun qidiruv: email/telefon — xesh, qolgani ochiq.
async function maskedQuery(H, q) {
  const kind = /@/.test(q) ? 'email' : /^\+?[\d\s\-().]{9,20}$/.test(q) ? 'phone' : 'id';
  return kind === 'id' ? q.slice(0, 60) : `${kind}:${String(await H.sha256Hex(q.toLowerCase())).slice(0, 12)}`;
}

export async function handle(request, env, url, H) {
  const path = url.pathname;
  if (!path.startsWith('/api/admin/legal/')) return null;
  const routes = ['/api/admin/legal/subject', '/api/admin/legal/hold', '/api/admin/legal/export'];
  if (!routes.includes(path)) return H.json({ error: 'not_found' }, 404);
  const admin = await H.requireAdmin(request, env);
  if (!admin) return H.json({ error: 'unauthorized' }, 401);
  // Dalil arxividan ham qattiqroq: kontent menejeri bu yerga KIRMAYDI —
  // odamning to'liq dosyesi (email, telefon, barcha kontent).
  if (!H.roleAtLeast(admin, 'manager')) return H.json({ error: 'forbidden' }, 403);
  const adminLabel = `admin#${Number(admin.adminId) || 0}:${String(admin.role || '')}`.slice(0, 64);
  const ip = H.reqIp ? H.reqIp(request) : '';
  const log = (action, details) => H.logAdminActivity?.(env, { action, details: String(details).slice(0, 500), ip })?.catch?.(() => {});

  await Promise.all([
    ensureArchiveTable(env).catch(() => {}),
    ensureCommentsSchema(env).catch(() => {}),
    ensurePurgeSchema(env).catch(() => {}),
  ]);
  const info = await tableInfo(env);

  if (path === '/api/admin/legal/hold') {
    if (request.method !== 'POST') return H.json({ error: 'method_not_allowed' }, 405);
    const body = await request.json().catch(() => ({}));
    const id = safeId(body?.userId);
    if (!id) return H.json({ error: 'bad_request' }, 422);
    const exists = await env.DB.prepare(`SELECT id FROM users WHERE id = ?`).bind(id).first();
    if (!exists) return H.json({ error: 'not_found' }, 404);
    if (!info.tables.has('account_legal_holds')) return H.json({ error: 'schema_unavailable' }, 503);
    if (body?.hold === false) {
      // Belgini olish purge'ga yo'l ochadi — faqat super_admin.
      if (admin.role !== 'super_admin') return H.json({ error: 'forbidden' }, 403);
      await env.DB.prepare(`DELETE FROM account_legal_holds WHERE user_id = ?`).bind(id).run();
      await log('legal_unhold', `${adminLabel} user#${id}`);
      return H.json({ ok: true, hold: null });
    }
    const note = String(body?.note || '').trim().slice(0, 300);
    if (!note) return H.json({ error: 'note_required' }, 422);
    const at = H.nowTs();
    await env.DB.prepare(
      `INSERT INTO account_legal_holds (user_id, note, set_by, set_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET note = excluded.note, set_by = excluded.set_by, set_at = excluded.set_at`
    ).bind(id, note, adminLabel, at).run();
    await log('legal_hold', `${adminLabel} user#${id} — ${note}`);
    return H.json({ ok: true, hold: { note, by: adminLabel, at } });
  }

  if (request.method !== 'GET') return H.json({ error: 'method_not_allowed' }, 405);

  if (path === '/api/admin/legal/export') {
    const id = safeId(url.searchParams.get('userId'));
    if (!id) return H.json({ error: 'bad_request' }, 422);
    const format = String(url.searchParams.get('format') || 'json');
    if (format !== 'json') return H.json({ error: 'bad_format' }, 422);
    const subject = await subjectSummary(env, H, id, info);
    if (!subject) return H.json({ error: 'not_found' }, 404);
    const items = [];
    let cursor = null;
    let truncated = false;
    // Sahifalab yig'iladi (bitta ulkan so'rov emas), jami ≤ EXPORT_MAX.
    for (;;) {
      const page = await timeline(env, H, info, id, { cursor, limit: PAGE_MAX });
      items.push(...page.items);
      if (!page.nextCursor) break;
      if (items.length >= EXPORT_MAX) { truncated = true; break; }
      cursor = decCursor(page.nextCursor);
    }
    await log('legal_export', `${adminLabel} user#${id} items=${Math.min(items.length, EXPORT_MAX)}`);
    return H.json({
      format: 'nfcstore-legal-dossier/1',
      generatedAt: new Date().toISOString(),
      generatedBy: { adminId: Number(admin.adminId) || 0, role: String(admin.role || '') },
      subject,
      items: items.slice(0, EXPORT_MAX),
      total: Math.min(items.length, EXPORT_MAX),
      truncated,
    });
  }

  // GET /api/admin/legal/subject
  const q = String(url.searchParams.get('q') || '').trim().slice(0, 120);
  if (!q) return H.json({ error: 'q_required' }, 422);
  const kind = LEGAL_KINDS.includes(url.searchParams.get('kind')) ? url.searchParams.get('kind') : '';
  const source = ['live', 'archive'].includes(url.searchParams.get('source')) ? url.searchParams.get('source') : '';
  const limit = Math.min(PAGE_MAX, Math.max(1, Number(url.searchParams.get('limit')) || PAGE));
  const rawCursor = url.searchParams.get('cursor');
  const cursor = rawCursor ? decCursor(rawCursor) : null;
  if (rawCursor && !cursor) return H.json({ error: 'bad_cursor' }, 422);
  const hit = await resolveSubject(env, H, q, info);
  const shown = await maskedQuery(H, q);
  if (!hit) {
    await log('legal_subject_view', `${adminLabel} q=${shown} -> topilmadi`);
    return H.json({ error: 'not_found' }, 404);
  }
  const subject = await subjectSummary(env, H, hit.userId, info);
  if (!subject) {
    await log('legal_subject_view', `${adminLabel} q=${shown} -> topilmadi`);
    return H.json({ error: 'not_found' }, 404);
  }
  const page = await timeline(env, H, info, hit.userId, { kind, source, cursor, limit });
  await log('legal_subject_view', `${adminLabel} q=${shown} -> user#${hit.userId}${cursor ? ' (keyingi sahifa)' : ''}`);
  return H.json({
    subject: { ...subject, matchedBy: hit.matchedBy, ...(hit.candidates && hit.candidates.length > 1 ? { candidates: hit.candidates } : {}) },
    items: page.items,
    nextCursor: page.nextCursor,
  });
}
