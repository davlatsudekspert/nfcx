// hosting/api/media.js — CONTRACT.md ga qarang. Route topilmasa null qaytaradi.
//
// Karta media bo'limlari (server/index.js Express + server/db.js porti, D1/R2):
//   GET    /api/records/:code/files            (public)  → { files }
//   GET    /api/records/:code/files/manage     (ega)     → { files, limit, count, allowed }
//   POST   /api/records/:code/files            (ega)     { title, dataUrl: data:application/pdf;base64,... } → 201 row
//   PUT    /api/records/:code/files/:id        (ega)     { title?, sort? } → row
//   DELETE /api/records/:code/files/:id        (ega)     → { ok }
//   GET    /api/records/:code/team             (public)  → { team }
//   GET    /api/records/:code/team/manage      (ega)     → { team, limit, count, eligible }
//   POST   /api/records/:code/team             (ega, biznes) → 201 row
//   PUT    /api/records/:code/team/:id         (ega, biznes) → row
//   DELETE /api/records/:code/team/:id         (ega)     → { ok }
//   GET    /api/records/:code/gallery          (public)  → { gallery }
//   GET    /api/records/:code/gallery/manage   (ega)     → { gallery, limit, count, eligible }
//   POST   /api/records/:code/gallery          (ega, biznes) → 201 row
//   PUT    /api/records/:code/gallery/:id      (ega, biznes) → row
//   DELETE /api/records/:code/gallery/:id      (ega, biznes) → { ok }
//   GET    /api/records/:code/videos           (public)  → { videos }
//   POST   /api/records/:code/video?title=&thumb=   (ega, raw MP4 body) → 201 row
//   PUT    /api/records/:code/videos/:id  |  PUT    /api/videos/:id   (ega) → row
//   DELETE /api/records/:code/videos/:id  |  DELETE /api/videos/:id   (ega) → { ok }
//
// Limitlar src/lib/access.js bilan BIR XIL bo'lishi shart (FILE_LIMIT,
// TEAM_LIMIT, GALLERY_LIMIT, VIDEO_LIMITS, FEATURE_MIN). Import EMAS, nusxa:
// hosting/* deploy'da faqat fayl-nusxalanadi (scripts/prepare-sites-build.mjs),
// `../../src/lib/access.js` nisbiy yo'li artifaktda mavjud bo'lmaydi
// (worker.js'dagi pricing bloki izohiga qarang). access.js o'zgarsa — bu
// jadvallarni ham qo'lda yangilang.

const RANK = { free: 0, silver: 1, gold: 2, premium: 3, exclusive: 4 };
const hasAccess = (access, min) => (RANK[access] ?? 0) >= (RANK[min] ?? 99);
const FILE_LIMIT = { free: 0, silver: 0, gold: 5, premium: 15, exclusive: 999 };
const TEAM_LIMIT = { free: 3, silver: 8, gold: 25, premium: 60, exclusive: 999 };
const GALLERY_LIMIT = { free: 0, silver: 6, gold: 20, premium: 40, exclusive: 999 };
// Hajm chegarasi butun saytda bir xil — 100 MB (egasining talabi).
// Tarif endi faqat video SONINI va uzunligini belgilaydi.
const VIDEO_MAX_MB = 100;
const VIDEO_LIMITS = {
  free: { count: 0, mb: 0, sec: 0 },
  silver: { count: 0, mb: 0, sec: 0 },
  gold: { count: 0, mb: 0, sec: 0 },
  premium: { count: 1, mb: VIDEO_MAX_MB, sec: 30 },
  exclusive: { count: 5, mb: VIDEO_MAX_MB, sec: 60 },
};
const FEATURE_MIN = { fileCatalog: 'gold', video: 'premium' };

const UPLOAD_CACHE_CONTROL = 'public, max-age=31536000, immutable';
const PDF_RE = /^data:(application\/pdf);base64,([A-Za-z0-9+/=]+)$/;
const PDF_MAX_BYTES = 100 * 1024 * 1024;

const FILE_COLS = 'id, title, file_url AS fileUrl, size_bytes AS sizeBytes, sort, created_at AS createdAt';
const TEAM_COLS = 'id, name, position, photo_url AS photoUrl, member_code AS memberCode, sort';
const GALLERY_COLS = 'id, image_url AS imageUrl, caption, sort';
const VIDEO_COLS = 'id, video_url AS videoUrl, thumb_url AS thumbUrl, title, size_bytes AS sizeBytes, sort, created_at AS createdAt';

const numOrNull = (v) => (v == null ? null : Number(v));
const fileRow = (r) => (r ? { id: Number(r.id), title: r.title, fileUrl: r.fileUrl, sizeBytes: numOrNull(r.sizeBytes), sort: Number(r.sort) || 0, createdAt: r.createdAt } : null);
const teamRow = (r) => (r ? { id: Number(r.id), name: r.name, position: r.position ?? null, photoUrl: r.photoUrl ?? null, memberCode: r.memberCode ?? null, sort: Number(r.sort) || 0, ...('memberName' in r ? { memberName: r.memberName ?? null } : {}) } : null);
const galleryRow = (r) => (r ? { id: Number(r.id), imageUrl: r.imageUrl, caption: r.caption ?? null, sort: Number(r.sort) || 0 } : null);
const videoRow = (r) => (r ? { id: Number(r.id), videoUrl: r.videoUrl, thumbUrl: r.thumbUrl ?? null, title: r.title ?? null, sizeBytes: numOrNull(r.sizeBytes), sort: Number(r.sort) || 0, createdAt: r.createdAt } : null);

function randomHex(byteLen = 12) {
  const bytes = new Uint8Array(byteLen);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function base64ToBytes(b64) {
  try {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

// worker.js putUploadR2 bilan bir xil kalit sxemasi/metadata (uploads/<name>).
async function putR2(env, filename, bytes, contentType, actor) {
  if (!env.UPLOADS) throw new Error('r2_unavailable');
  await env.UPLOADS.put(`uploads/${filename}`, bytes, {
    httpMetadata: { contentType, cacheControl: UPLOAD_CACHE_CONTROL },
    customMetadata: { uploadedAt: new Date().toISOString(), actor: String(actor || '').slice(0, 120) },
  });
  return `/uploads/${filename}`;
}

// Faqat SHU modul yaratgan fayllar o'chiriladi (file_*.pdf / video_*.mp4) —
// boshqa /uploads/ obyektlariga (avatar, thumbnail) tegilmaydi.
async function deleteOwnUpload(env, urlPath, re) {
  if (!env.UPLOADS || typeof urlPath !== 'string' || !urlPath.startsWith('/uploads/')) return;
  const name = urlPath.slice('/uploads/'.length);
  if (!re.test(name)) return;
  try { await env.UPLOADS.delete(`uploads/${name}`); } catch { /* jim */ }
}

async function readJson(request) {
  const b = await request.json().catch(() => null);
  return b && typeof b === 'object' && !Array.isArray(b) ? b : {};
}

async function count(env, table, code) {
  const r = await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE code = ?`).bind(code).first();
  return Number(r?.n) || 0;
}

// Ega konteksti: 401 → 403 → record. `res` bo'lsa — darhol qaytariladi.
async function ownerCtx(request, env, H, code) {
  const user = await H.getCurrentUser(request, env);
  if (!user) return { res: H.json({ error: 'unauthorized' }, 401) };
  if ((await H.getRecordOwner(env, code)) !== user.id) return { res: H.json({ error: 'forbidden' }, 403) };
  const rec = await H.getRecord(env, code);
  if (!rec) return { res: H.json({ error: 'not_found' }, 404) };
  return { user, rec, access: H.effectiveAccessD1(rec) };
}

// Team/Gallery: faqat biznes profil + tarif limiti > 0 (mutate uchun).
async function businessCtx(request, env, H, code, limits, feature, { mutate = false } = {}) {
  const ctx = await ownerCtx(request, env, H, code);
  if (ctx.res) return ctx;
  const eligible = ctx.rec.profileType === 'business';
  const limit = limits[ctx.access] ?? 0;
  if (mutate && !eligible) return { res: H.json({ error: 'not_business' }, 403) };
  if (mutate && limit <= 0) return { res: H.json({ error: 'feature_locked', feature }, 403) };
  return { ...ctx, eligible, limit };
}

const listFiles = async (env, code) => ((await env.DB.prepare(`SELECT ${FILE_COLS} FROM card_files WHERE code = ? ORDER BY sort, id`).bind(code).all()).results || []).map(fileRow);
const listTeam = async (env, code) => ((await env.DB.prepare(
  `SELECT t.id, t.name, t.position, t.photo_url AS photoUrl, t.member_code AS memberCode, t.sort, c.name AS memberName
     FROM card_team t LEFT JOIN cards c ON c.code = t.member_code
    WHERE t.code = ? ORDER BY t.sort, t.id`
).bind(code).all()).results || []).map(teamRow);
const listGallery = async (env, code) => ((await env.DB.prepare(`SELECT ${GALLERY_COLS} FROM card_gallery WHERE code = ? ORDER BY sort, id`).bind(code).all()).results || []).map(galleryRow);
const listVideos = async (env, code) => ((await env.DB.prepare(`SELECT ${VIDEO_COLS} FROM card_videos WHERE code = ? ORDER BY sort, id`).bind(code).all()).results || []).map(videoRow);

// ---------- Fayl / PDF / katalog (Band 3.4) ----------

async function handleFiles(request, env, H, code, sub) {
  const m = request.method;
  if (sub === null && m === 'GET') return H.json({ files: await listFiles(env, code) });

  if (sub === 'manage' && m === 'GET') {
    const ctx = await ownerCtx(request, env, H, code);
    if (ctx.res) return ctx.res;
    const limit = FILE_LIMIT[ctx.access] ?? 0;
    return H.json({ files: await listFiles(env, code), limit, count: await count(env, 'card_files', code), allowed: hasAccess(ctx.access, FEATURE_MIN.fileCatalog) });
  }

  if (sub === null && m === 'POST') {
    const ctx = await ownerCtx(request, env, H, code);
    if (ctx.res) return ctx.res;
    if (!hasAccess(ctx.access, FEATURE_MIN.fileCatalog)) return H.json({ error: 'feature_locked', feature: 'fileCatalog' }, 403);
    const limit = FILE_LIMIT[ctx.access] ?? 0;
    if ((await count(env, 'card_files', code)) >= limit) return H.json({ error: 'limit_reached', limit }, 429);
    const body = await readJson(request);
    const title = H.cleanStr(body.title, 80) || 'Hujjat';

    // ── YANGI YO'L: fayl allaqachon /api/upload-file orqali OQIM bilan
    //    yuklangan va bu yerga faqat HAVOLASI keladi. Aynan shu tufayli
    //    hujjat 100 MB gacha bo'lishi mumkin: base64 yo'lida 100 MB
    //    fayl 133 MB satrga aylanib, Worker xotirasiga sig'masdi.
    if (body.fileUrl) {
      const fileUrl = H.uploadOrSafeUrl(body.fileUrl);
      if (!fileUrl.startsWith('/uploads/') || !fileUrl.endsWith('.pdf')) return H.json({ error: 'bad_file' }, 422);
      const size = Number(body.sizeBytes) > 0 ? Math.round(Number(body.sizeBytes)) : null;
      const row = await env.DB.prepare(
        `INSERT INTO card_files (code, title, file_url, size_bytes, sort, created_at) VALUES (?, ?, ?, ?, 0, ?) RETURNING ${FILE_COLS}`
      ).bind(code, title, fileUrl, size, H.nowTs()).first();
      return H.json(fileRow(row), 201);
    }

    // ── ESKI YO'L (base64) — keshda qolgan eski mijozlar uchun. ──────
    const pm = PDF_RE.exec(String(body.dataUrl || ''));
    if (!pm) return H.json({ error: 'bad_file' }, 422);
    const bytes = base64ToBytes(pm[2]);
    if (!bytes?.length) return H.json({ error: 'bad_file' }, 422);
    if (bytes.length > PDF_MAX_BYTES) return H.json({ error: 'too_large' }, 413);
    // PDF sehrli baytlari (%PDF-).
    if (String.fromCharCode(...bytes.slice(0, 5)) !== '%PDF-') return H.json({ error: 'bad_file' }, 422);
    const fileUrl = await putR2(env, `file_${randomHex(12)}.pdf`, bytes, 'application/pdf', `user:${ctx.user.id}`);
    const row = await env.DB.prepare(
      `INSERT INTO card_files (code, title, file_url, size_bytes, sort, created_at) VALUES (?, ?, ?, ?, 0, ?) RETURNING ${FILE_COLS}`
    ).bind(code, title, fileUrl, bytes.length, H.nowTs()).first();
    return H.json(fileRow(row), 201);
  }

  const id = /^\d+$/.test(sub || '') ? Number(sub) : null;
  if (id == null) return null;

  if (m === 'PUT') {
    const ctx = await ownerCtx(request, env, H, code);
    if (ctx.res) return ctx.res;
    const body = await readJson(request);
    const title = 'title' in body ? H.cleanStr(body.title, 80) : null;
    const sort = 'sort' in body ? (Number(body.sort) || 0) : null;
    const row = await env.DB.prepare(
      `UPDATE card_files SET title = COALESCE(?, title), sort = COALESCE(?, sort) WHERE code = ? AND id = ? RETURNING ${FILE_COLS}`
    ).bind(title, sort, code, id).first();
    if (!row) return H.json({ error: 'not_found' }, 404);
    return H.json(fileRow(row));
  }

  if (m === 'DELETE') {
    const ctx = await ownerCtx(request, env, H, code);
    if (ctx.res) return ctx.res;
    const row = await env.DB.prepare(`DELETE FROM card_files WHERE code = ? AND id = ? RETURNING file_url AS fileUrl`).bind(code, id).first();
    if (row?.fileUrl) await deleteOwnUpload(env, row.fileUrl, /^file_[a-f0-9]+\.pdf$/);
    return H.json({ ok: true });
  }
  return null;
}

// ---------- Jamoa / Team (PHASE 5) ----------

function teamFields(H, b) {
  const f = {};
  if ('name' in b) f.name = H.cleanStr(b.name, 80);
  if ('position' in b) f.position = H.cleanStr(b.position, 80);
  if ('photoUrl' in b) f.photoUrl = H.uploadOrSafeUrl(b.photoUrl);
  if ('sort' in b) f.sort = Number(b.sort) || 0;
  if ('memberCode' in b) {
    const c = String(b.memberCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    f.memberCode = c && H.validCode(c) ? c : null;
  }
  return f;
}

async function handleTeam(request, env, H, code, sub) {
  const m = request.method;
  if (sub === null && m === 'GET') return H.json({ team: await listTeam(env, code) });

  if (sub === 'manage' && m === 'GET') {
    const ctx = await businessCtx(request, env, H, code, TEAM_LIMIT, 'team');
    if (ctx.res) return ctx.res;
    return H.json({ team: await listTeam(env, code), limit: ctx.limit, count: await count(env, 'card_team', code), eligible: ctx.eligible });
  }

  if (sub === null && m === 'POST') {
    const ctx = await businessCtx(request, env, H, code, TEAM_LIMIT, 'team', { mutate: true });
    if (ctx.res) return ctx.res;
    const f = teamFields(H, await readJson(request));
    if (!f.name) return H.json({ error: 'name_required' }, 422);
    if ((await count(env, 'card_team', code)) >= ctx.limit) return H.json({ error: 'limit_reached', limit: ctx.limit }, 429);
    const row = await env.DB.prepare(
      `INSERT INTO card_team (code, name, position, photo_url, member_code, sort, created_at) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING ${TEAM_COLS}`
    ).bind(code, f.name, f.position || null, f.photoUrl || null, f.memberCode || null, f.sort || 0, H.nowTs()).first();
    return H.json(teamRow(row), 201);
  }

  const id = /^\d+$/.test(sub || '') ? Number(sub) : null;
  if (id == null) return null;

  if (m === 'PUT') {
    const ctx = await businessCtx(request, env, H, code, TEAM_LIMIT, 'team', { mutate: true });
    if (ctx.res) return ctx.res;
    const f = teamFields(H, await readJson(request));
    if ('name' in f && !f.name) return H.json({ error: 'name_required' }, 422);
    const col = { name: 'name', position: 'position', photoUrl: 'photo_url', memberCode: 'member_code', sort: 'sort' };
    const sets = []; const vals = [];
    for (const [k, c] of Object.entries(col)) {
      if (k in f) { sets.push(`${c} = ?`); vals.push(k === 'sort' ? f[k] : (f[k] || null)); }
    }
    if (!sets.length) return H.json({ error: 'not_found' }, 404);
    const row = await env.DB.prepare(
      `UPDATE card_team SET ${sets.join(', ')} WHERE code = ? AND id = ? RETURNING ${TEAM_COLS}`
    ).bind(...vals, code, id).first();
    if (!row) return H.json({ error: 'not_found' }, 404);
    return H.json(teamRow(row));
  }

  if (m === 'DELETE') {
    const ctx = await ownerCtx(request, env, H, code);
    if (ctx.res) return ctx.res;
    await env.DB.prepare(`DELETE FROM card_team WHERE code = ? AND id = ?`).bind(code, id).run();
    return H.json({ ok: true });
  }
  return null;
}

// ---------- Galereya (Business Workspace) ----------

async function handleGallery(request, env, H, code, sub) {
  const m = request.method;
  if (sub === null && m === 'GET') return H.json({ gallery: await listGallery(env, code) });

  if (sub === 'manage' && m === 'GET') {
    const ctx = await businessCtx(request, env, H, code, GALLERY_LIMIT, 'gallery');
    if (ctx.res) return ctx.res;
    return H.json({ gallery: await listGallery(env, code), limit: ctx.limit, count: await count(env, 'card_gallery', code), eligible: ctx.eligible });
  }

  if (sub === null && m === 'POST') {
    const ctx = await businessCtx(request, env, H, code, GALLERY_LIMIT, 'gallery', { mutate: true });
    if (ctx.res) return ctx.res;
    const body = await readJson(request);
    const imageUrl = H.uploadOrSafeUrl(body.imageUrl);
    if (!imageUrl) return H.json({ error: 'image_required' }, 422);
    if ((await count(env, 'card_gallery', code)) >= ctx.limit) return H.json({ error: 'limit_reached', limit: ctx.limit }, 429);
    const row = await env.DB.prepare(
      `INSERT INTO card_gallery (code, image_url, caption, sort, created_at) VALUES (?, ?, ?, ?, ?) RETURNING ${GALLERY_COLS}`
    ).bind(code, imageUrl, H.cleanStr(body.caption, 140) || null, Number(body.sort) || 0, H.nowTs()).first();
    return H.json(galleryRow(row), 201);
  }

  const id = /^\d+$/.test(sub || '') ? Number(sub) : null;
  if (id == null) return null;

  if (m === 'PUT') {
    const ctx = await businessCtx(request, env, H, code, GALLERY_LIMIT, 'gallery', { mutate: true });
    if (ctx.res) return ctx.res;
    const body = await readJson(request);
    const sets = []; const vals = [];
    if ('caption' in body) { sets.push('caption = ?'); vals.push(H.cleanStr(body.caption, 140) || null); }
    if ('sort' in body) { sets.push('sort = ?'); vals.push(Number(body.sort) || 0); }
    if (!sets.length) return H.json({ error: 'not_found' }, 404);
    const row = await env.DB.prepare(
      `UPDATE card_gallery SET ${sets.join(', ')} WHERE code = ? AND id = ? RETURNING ${GALLERY_COLS}`
    ).bind(...vals, code, id).first();
    if (!row) return H.json({ error: 'not_found' }, 404);
    return H.json(galleryRow(row));
  }

  if (m === 'DELETE') {
    const ctx = await businessCtx(request, env, H, code, GALLERY_LIMIT, 'gallery', { mutate: true });
    if (ctx.res) return ctx.res;
    await env.DB.prepare(`DELETE FROM card_gallery WHERE code = ? AND id = ?`).bind(code, id).run();
    return H.json({ ok: true });
  }
  return null;
}

// ---------- Video (PHASE 4) ----------

async function updateVideo(request, env, H, code, id) {
  const ctx = await ownerCtx(request, env, H, code);
  if (ctx.res) return ctx.res;
  const b = await readJson(request);
  const title = 'title' in b ? H.cleanStr(b.title, 80) : null;
  const thumbUrl = 'thumbUrl' in b ? H.uploadOrSafeUrl(b.thumbUrl) : null;
  const sort = 'sort' in b ? (Number(b.sort) || 0) : null;
  const row = await env.DB.prepare(
    `UPDATE card_videos SET title = COALESCE(?, title), thumb_url = COALESCE(?, thumb_url), sort = COALESCE(?, sort)
      WHERE code = ? AND id = ? RETURNING ${VIDEO_COLS}`
  ).bind(title, thumbUrl, sort, code, id).first();
  if (!row) return H.json({ error: 'not_found' }, 404);
  return H.json(videoRow(row));
}

async function deleteVideo(request, env, H, code, id) {
  const ctx = await ownerCtx(request, env, H, code);
  if (ctx.res) return ctx.res;
  const row = await env.DB.prepare(`DELETE FROM card_videos WHERE code = ? AND id = ? RETURNING video_url AS videoUrl`).bind(code, id).first();
  // Faqat video fayli o'chiriladi (thumbnail kichik JPEG — /api/upload orqali, tegilmaydi).
  if (row?.videoUrl) await deleteOwnUpload(env, row.videoUrl, /^video_[a-f0-9]+\.mp4$/);
  return H.json({ ok: true });
}

async function handleVideos(request, env, H, url, code, kind, sub) {
  const m = request.method;
  if (kind === 'videos' && sub === null && m === 'GET') return H.json({ videos: await listVideos(env, code) });

  // POST /api/records/:code/video — raw MP4 body (base64 emas), title/thumb query'da.
  if (kind === 'video' && sub === null && m === 'POST') {
    const ctx = await ownerCtx(request, env, H, code);
    if (ctx.res) return ctx.res;
    if (!hasAccess(ctx.access, FEATURE_MIN.video)) return H.json({ error: 'feature_locked', feature: 'video' }, 403);
    const lim = VIDEO_LIMITS[ctx.access] || VIDEO_LIMITS.free;
    if ((await count(env, 'card_videos', code)) >= lim.count) return H.json({ error: 'limit_reached', limit: lim.count }, 429);
    const thumbParam = H.uploadOrSafeUrl(url.searchParams.get('thumb') || '');
    const titleParam = H.cleanStr(url.searchParams.get('title') || '', 80);

    // ── YANGI YO'L: video allaqachon /api/upload-file orqali OQIM bilan
    //    yuklangan, bu yerga faqat HAVOLASI keladi. 100 MB video
    //    `arrayBuffer()` bilan o'qilsa Worker izolyatining 128 MB
    //    xotirasiga urilardi.
    const urlParam = H.uploadOrSafeUrl(url.searchParams.get('url') || '');
    if (urlParam) {
      if (!urlParam.startsWith('/uploads/') || !/\.(mp4|webm)$/.test(urlParam)) return H.json({ error: 'bad_file' }, 422);
      const size = Number(url.searchParams.get('size')) > 0 ? Math.round(Number(url.searchParams.get('size'))) : null;
      if (size && size > VIDEO_MAX_MB * 1024 * 1024) return H.json({ error: 'too_large', limit: VIDEO_MAX_MB }, 413);
      const saved = await env.DB.prepare(
        `INSERT INTO card_videos (code, video_url, thumb_url, title, size_bytes, sort, created_at) VALUES (?, ?, ?, ?, ?, 0, ?) RETURNING ${VIDEO_COLS}`
      ).bind(code, urlParam, thumbParam || null, titleParam || null, size, H.nowTs()).first();
      return H.json(videoRow(saved), 201);
    }

    // ── ESKI YO'L: xom tana (eski mijozlar uchun). ──────────────────
    const bytes = new Uint8Array(await request.arrayBuffer());
    if (!bytes.length) return H.json({ error: 'bad_file' }, 422);
    if (bytes.length > lim.mb * 1024 * 1024) return H.json({ error: 'too_large', limit: lim.mb }, 413);
    // MP4 tekshiruvi: dastlabki 40 baytda 'ftyp' box'i bo'lishi kerak.
    if (!String.fromCharCode(...bytes.slice(0, 40)).includes('ftyp')) return H.json({ error: 'bad_file' }, 422);
    const thumbUrl = thumbParam;
    const title = titleParam;
    const videoUrl = await putR2(env, `video_${randomHex(12)}.mp4`, bytes, 'video/mp4', `user:${ctx.user.id}`);
    const row = await env.DB.prepare(
      `INSERT INTO card_videos (code, video_url, thumb_url, title, size_bytes, sort, created_at) VALUES (?, ?, ?, ?, ?, 0, ?) RETURNING ${VIDEO_COLS}`
    ).bind(code, videoUrl, thumbUrl || null, title || null, bytes.length, H.nowTs()).first();
    return H.json(videoRow(row), 201);
  }

  if (kind !== 'videos') return null;
  const id = /^\d+$/.test(sub || '') ? Number(sub) : null;
  if (id == null) return null;
  if (m === 'PUT') return updateVideo(request, env, H, code, id);
  if (m === 'DELETE') return deleteVideo(request, env, H, code, id);
  return null;
}

export async function handle(request, env, url, H) {
  const path = url.pathname;

  // PUT/DELETE /api/videos/:id — kod video yozuvidan aniqlanadi.
  const vm = path.match(/^\/api\/videos\/(\d+)$/);
  if (vm && (request.method === 'PUT' || request.method === 'DELETE')) {
    const id = Number(vm[1]);
    const user = await H.getCurrentUser(request, env);
    if (!user) return H.json({ error: 'unauthorized' }, 401);
    const row = await env.DB.prepare(`SELECT code FROM card_videos WHERE id = ?`).bind(id).first();
    if (!row) return H.json({ error: 'not_found' }, 404);
    return request.method === 'PUT' ? updateVideo(request, env, H, row.code, id) : deleteVideo(request, env, H, row.code, id);
  }

  const m = path.match(/^\/api\/records\/([^/]+)\/(files|team|gallery|videos|video)(?:\/([^/]+))?$/);
  if (!m) return null;
  let code;
  try { code = decodeURIComponent(m[1]).toUpperCase(); } catch { return H.json({ error: 'bad_code' }, 400); }
  if (!H.validCode(code)) return H.json({ error: 'bad_code' }, 400);
  const kind = m[2];
  const sub = m[3] ?? null;

  if (kind === 'files') return handleFiles(request, env, H, code, sub);
  if (kind === 'team') return handleTeam(request, env, H, code, sub);
  if (kind === 'gallery') return handleGallery(request, env, H, code, sub);
  return handleVideos(request, env, H, url, code, kind, sub);
}
