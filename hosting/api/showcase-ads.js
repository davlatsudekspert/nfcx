// hosting/api/showcase-ads.js — KO'RGAZMA REKLAMASI (2026-10).
//
// ═══ NIMA ═══
//
// Egasining qarori (2026-10-09): Ko'rgazma lentasida admin tanlagan 4 tagacha
// REKLAMA JOYI. Reklama VIDEO post ham bo'lishi mumkin — oddiy foydalanuvchi
// Ko'rgazmaga video qo'ya olmaydi (api/showcase.js `showcase_images_only`),
// videoli kadr Ko'rgazmaga FAQAT shu jadval orqali, admin tanlovi bilan kiradi.
//
// ═══ SAQLASH ═══
//
//   showcase_ads(slot 1..4 PRIMARY KEY, post_kind 'post'|'company_post',
//                post_id, enabled, updated_at, updated_by, post_created_at)
//
// 4 tadan ortiq bo'lishi MUMKIN EMAS — `slot` CHECK (1..4) va PRIMARY KEY.
// `post_created_at` — postning lentadagi vaqti (o'rnatilgan paytda). Shaxsiy
// post raqami qayta ishlatiladi (`posts.id` AUTOINCREMENT emas): post
// o'chirilib, raqami BOSHQA odamning yangi postiga berilsa, vaqt mos kelmaydi
// va reklama ko'rsatilmaydi (begona post reklama bo'lib chiqib ketmasin).
//
// ═══ MARSHRUTLAR (admin) ═══
//
//   GET    /api/admin/showcase-ads        (admin)    → { slots: [4 ta joy] }
//   PUT    /api/admin/showcase-ads/:slot  (manager+) { postKind, postId, enabled? }
//   DELETE /api/admin/showcase-ads/:slot  (manager+)
//
// Har o'zgarish `admin_activity_log` ga (`showcase_ad_set` / `showcase_ad_remove`).
//
// ═══ LENTA ═══
//
// api/reels.js (`mode === 'showcase'`): yoqilgan joylar featured reklama bilan
// BIR xil qoidada — 4 va 9-o'rin, sahifada 2 tagacha, zanjirda bir marta,
// oddiy tartibdan chiqariladi. Ko'rinish qoidalari lenta UNIONining o'zidan
// (o'chirilgan, rejadagi, tekshiruv kutayotgan, yashirin profil, `videosHidden`).
//
// ═══ BOSHLANG'ICH REKLAMA (bir marta) ═══
//
// `seedShowcaseAds` — NFCSTORE'ning o'z promo reels'lari (BOY777, LOL707)
// NFCSTOREUZ kompaniya posti sifatida yaratiladi va 1-2 joyga qo'yiladi.
// showcase-samples.js bilan AYNAN bir qoida: `app_migrations` dagi
// `showcase_ads_v1` belgisi, kompaniya faol bo'lmasa hech narsa yozilmaydi,
// egasi postni o'chirsa qaytib yaratilmaydi. Videolar saytning statik
// fayllari: `public/promo/*` (Worker assets, /uploads EMAS).

import { savePostExtras } from './music.js';
import { cleanShowcaseLink } from './showcase.js';

export const SLOT_COUNT = 4;
export const AD_KINDS = ['post', 'company_post'];
export const SHOWCASE_ADS_MIGRATION = 'showcase_ads_v1';
export const ADS_COMPANY = 'NFCSTOREUZ';

export const PROMO_ADS = [
  {
    slot: 1,
    videoUrl: '/promo/nfcstore-boy777.mp4',
    imageUrl: '/promo/nfcstore-boy777.jpg',
    caption: "Telefonga tekkizing — profilingiz ochiladi. BOY777 kabi premium NFC ID'ni o'zingizga oling.\n\n"
      + '📲 Ilova: nfcstore.uz/ilova-yuklash\n🌐 nfcstore.uz',
    title: 'BOY777 — premium NFC ID',
    linkUrl: 'https://www.instagram.com/reel/Ddy4e1cjVY9/',
    musicId: 28, // Silk Road Fire
  },
  {
    slot: 2,
    videoUrl: '/promo/nfcstore-lol707.mp4',
    imageUrl: '/promo/nfcstore-lol707.jpg',
    caption: "Telefoningizni tekkizing — profilingiz ochiladi ✨ LOL707 kabi chiroyli NFC ID'ni o'zingizga oling.\n\n"
      + '📲 Ilova: nfcstore.uz/ilova-yuklash\n🌐 nfcstore.uz',
    title: 'LOL707 — chiroyli NFC ID',
    linkUrl: 'https://www.instagram.com/reel/Ddtu3-Njf5i/',
    musicId: 2, // Yurak
  },
];

const normTs = (v) => String(v || '').replace('T', ' ').slice(0, 19);

// ── Sxema ───────────────────────────────────────────────────────────
// Kesh — baza obyekti bo'yicha (testlarda har env o'z bazasi bilan). UZ
// bazasi adapteri isolate ichida bitta — umumiy kalit (content-guard.js kabi).
const UZ_KEY = {};
const keyOf = (env) => (env?.UZ_STORE_ACTIVE ? UZ_KEY : (env?.DB || UZ_KEY));
let schema = new WeakMap();
export function ensureSchema(env) {
  const k = keyOf(env);
  let p = schema.get(k);
  if (!p) {
    p = env.DB.prepare(`CREATE TABLE IF NOT EXISTS showcase_ads (
        slot INTEGER PRIMARY KEY CHECK (slot BETWEEN 1 AND 4),
        post_kind TEXT NOT NULL CHECK (post_kind IN ('post', 'company_post')),
        post_id INTEGER NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        updated_at TEXT,
        updated_by TEXT,
        post_created_at TEXT
      )`).run().catch((e) => { schema.delete(k); throw e; });
    schema.set(k, p);
  }
  return p;
}
export function __resetShowcaseAdsCaches() { schema = new WeakMap(); seeded = new WeakMap(); moved = new WeakMap(); movedRetry = new WeakMap(); }

/// Lenta uchun: yoqilgan joylar, slot tartibida. Jadval yo'q / xato — [].
/// → [{ slot, key: 'kind:id', kind, id, createdAt }]
export async function enabledSlots(env) {
  try {
    const r = await env.DB.prepare(
      `SELECT slot, post_kind, post_id, post_created_at FROM showcase_ads WHERE enabled = 1 ORDER BY slot`
    ).all();
    return (r?.results || [])
      .filter((x) => AD_KINDS.includes(String(x.post_kind)) && Number(x.post_id) > 0)
      .map((x) => ({
        slot: Number(x.slot),
        kind: String(x.post_kind),
        id: Number(x.post_id),
        key: `${x.post_kind}:${Number(x.post_id)}`,
        createdAt: x.post_created_at ? normTs(x.post_created_at) : '',
      }));
  } catch {
    return [];
  }
}

/// Joydagi post hali o'sha postmi (raqam qayta ishlatilmaganmi).
export const slotMatchesRow = (slot, row) => !slot.createdAt || slot.createdAt === normTs(row?.created_at);

// ── Admin ───────────────────────────────────────────────────────────

// Xom jadvaldan (lentadan EMAS) — admin o'chirilgan/yashiringan postni ham
// ko'rsin. Shaxsiy/kompaniya postining umumiy shakli.
async function rawPost(env, kind, id) {
  const sql = kind === 'company_post'
    ? `SELECT cp.id, cp.company_id AS code, 'company' AS author_kind, co.display_name AS name,
              cp.image_url, cp.video_url, cp.caption, cp.created_at
         FROM company_posts cp LEFT JOIN companies co ON co.company_id = cp.company_id WHERE cp.id = ?`
    : `SELECT p.id, p.code, 'card' AS author_kind, c.name AS name,
              p.image_url, p.video_url, p.caption, p.created_at
         FROM posts p LEFT JOIN cards c ON c.code = p.code WHERE p.id = ?`;
  try { return await env.DB.prepare(sql).bind(id).first(); } catch { return null; }
}

// Lenta UNIONidan (kalitlarsiz): tirik, ko'rinadigan, tekshiruv kutmayotgan.
async function livePost(env, H, kind, id) {
  try {
    return await env.DB.prepare(
      `SELECT f.* FROM (${H.feedUnionSql}) f WHERE f.kind = 'post' AND f.author_kind = ? AND f.id = ?`
    ).bind(0, 0, H.nowTs(), 0, H.nowTs(), kind === 'company_post' ? 'company' : 'card', id).first();
  } catch {
    return null;
  }
}

async function titleOf(env, kind, id) {
  try {
    const r = await env.DB.prepare(`SELECT title FROM post_extras WHERE post_kind = ? AND post_id = ?`).bind(kind, id).first();
    return r?.title ? String(r.title) : null;
  } catch { return null; }
}

async function slotJson(env, H, row) {
  const kind = String(row.post_kind);
  const id = Number(row.post_id);
  const [raw, live, title] = await Promise.all([rawPost(env, kind, id), livePost(env, H, kind, id), titleOf(env, kind, id)]);
  const fp = row.post_created_at ? normTs(row.post_created_at) : '';
  // Raqam boshqa postga o'tgan bo'lsa — "yo'q" (eski post o'chirilgan).
  const liveMatch = !!live && (!fp || normTs(live.created_at) === fp);
  const exists = !!raw && (!fp || liveMatch || normTs(raw.created_at) === fp);
  return {
    slot: Number(row.slot),
    postKind: kind,
    postId: id,
    enabled: Number(row.enabled) === 1,
    updatedAt: row.updated_at || null,
    updatedBy: row.updated_by || null,
    post: {
      exists,
      live: liveMatch,
      authorKind: raw ? String(raw.author_kind) : null,
      code: raw ? String(raw.code || '').toUpperCase() : null,
      name: raw ? String(raw.name || raw.code || '') : null,
      caption: raw ? String(raw.caption || '').slice(0, 200) : '',
      title,
      imageUrl: raw?.image_url || '',
      videoUrl: raw?.video_url || '',
    },
  };
}

async function listSlots(env, H) {
  await ensureSchema(env);
  const r = await env.DB.prepare(`SELECT * FROM showcase_ads ORDER BY slot`).all();
  const rows = new Map((r?.results || []).map((x) => [Number(x.slot), x]));
  const out = [];
  for (let s = 1; s <= SLOT_COUNT; s += 1) {
    const row = rows.get(s);
    out.push(row ? await slotJson(env, H, row) : { slot: s, postKind: null, postId: null, enabled: false, updatedAt: null, updatedBy: null, post: null });
  }
  return out;
}

const adminTag = (admin) => `admin#${Number(admin?.adminId) || 0}:${String(admin?.role || '')}`.slice(0, 60);

export async function handle(request, env, url, H) {
  const path = url.pathname;
  if (path !== '/api/admin/showcase-ads' && !path.startsWith('/api/admin/showcase-ads/')) return null;
  const admin = await H.requireAdmin(request, env);
  if (!admin) return H.json({ error: 'unauthorized' }, 401);
  const noStore = { 'cache-control': 'no-store' };

  if (path === '/api/admin/showcase-ads') {
    if (request.method !== 'GET') return H.json({ error: 'method_not_allowed' }, 405);
    return H.json({ slots: await listSlots(env, H), max: SLOT_COUNT }, 200, noStore);
  }

  const m = /^\/api\/admin\/showcase-ads\/([0-9]{1,2})$/.exec(path);
  const slot = m ? Number(m[1]) : NaN;
  if (!Number.isInteger(slot) || slot < 1 || slot > SLOT_COUNT) return H.json({ error: 'bad_slot', max: SLOT_COUNT }, 422);
  if (request.method !== 'PUT' && request.method !== 'DELETE') return H.json({ error: 'method_not_allowed' }, 405);
  if (!H.roleAtLeast(admin, 'manager')) return H.json({ error: 'forbidden' }, 403);
  await ensureSchema(env);
  const before = await env.DB.prepare(`SELECT * FROM showcase_ads WHERE slot = ?`).bind(slot).first();

  if (request.method === 'DELETE') {
    await env.DB.prepare(`DELETE FROM showcase_ads WHERE slot = ?`).bind(slot).run();
    if (before) {
      await H.logAdminActivity?.(env, {
        action: 'showcase_ad_remove',
        details: `slot=${slot} ${before.post_kind}:${Number(before.post_id)}`,
        oldValue: JSON.stringify({ postKind: before.post_kind, postId: Number(before.post_id), enabled: Number(before.enabled) === 1 }),
        newValue: null,
        ip: H.reqIp?.(request),
      });
    }
    return H.json({ ok: true, slots: await listSlots(env, H) }, 200, noStore);
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) return H.json({ error: 'bad_request' }, 422);
  const postKind = String(body.postKind ?? before?.post_kind ?? '');
  const rawId = body.postId ?? before?.post_id;
  const postId = typeof rawId === 'number' ? rawId : (/^\d{1,12}$/.test(String(rawId ?? '').trim()) ? Number(rawId) : NaN);
  if (!AD_KINDS.includes(postKind)) return H.json({ error: 'bad_post_kind' }, 422);
  if (!Number.isSafeInteger(postId) || postId <= 0 || postId > 999_999_999_999) return H.json({ error: 'bad_post_id' }, 422);
  if (body.enabled !== undefined && typeof body.enabled !== 'boolean') return H.json({ error: 'bad_enabled' }, 422);
  const enabled = body.enabled === undefined ? (before ? Number(before.enabled) === 1 : true) : body.enabled;

  const samePost = before && String(before.post_kind) === postKind && Number(before.post_id) === postId;
  let createdAt = samePost ? before.post_created_at : null;
  // Post almashsa (yoki yangi joy) — mavjud va TIRIK bo'lishi shart.
  // Faqat yoqish/o'chirish — tekshiruvsiz (o'chirish doim mumkin).
  if (!samePost || enabled) {
    const raw = await rawPost(env, postKind, postId);
    if (!raw) return H.json({ error: 'post_not_found' }, 404);
    const live = await livePost(env, H, postKind, postId);
    if (!live) return H.json({ error: 'post_not_live' }, 422);
    if (samePost && createdAt && normTs(live.created_at) !== normTs(createdAt)) {
      // Raqam boshqa postga o'tgan — joyni yangi post bilan qayta o'rnatish kerak.
      return H.json({ error: 'post_changed' }, 409);
    }
    createdAt = normTs(live.created_at);
  }
  const dup = await env.DB.prepare(`SELECT slot FROM showcase_ads WHERE post_kind = ? AND post_id = ? AND slot <> ?`)
    .bind(postKind, postId, slot).first();
  if (dup) return H.json({ error: 'already_in_slot', slot: Number(dup.slot) }, 409);

  await env.DB.prepare(
    `INSERT INTO showcase_ads (slot, post_kind, post_id, enabled, updated_at, updated_by, post_created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(slot) DO UPDATE SET post_kind = excluded.post_kind, post_id = excluded.post_id,
       enabled = excluded.enabled, updated_at = excluded.updated_at, updated_by = excluded.updated_by,
       post_created_at = excluded.post_created_at`
  ).bind(slot, postKind, postId, enabled ? 1 : 0, new Date().toISOString(), adminTag(admin), createdAt || null).run();
  await H.logAdminActivity?.(env, {
    action: 'showcase_ad_set',
    details: `slot=${slot} ${postKind}:${postId} enabled=${enabled ? 1 : 0}`,
    oldValue: before ? JSON.stringify({ postKind: before.post_kind, postId: Number(before.post_id), enabled: Number(before.enabled) === 1 }) : null,
    newValue: JSON.stringify({ postKind, postId, enabled }),
    ip: H.reqIp?.(request),
  });
  return H.json({ ok: true, slots: await listSlots(env, H) }, 200, noStore);
}

// ── Boshlang'ich reklama (BIR MARTA) ────────────────────────────────

let seeded = new WeakMap();

/// → { applied: false, reason? } | { applied: true, created, slots }
export async function seedShowcaseAds(env, { now = new Date() } = {}) {
  if (!env?.DB) return { applied: false, reason: 'no_db' };
  const k = keyOf(env);
  if (seeded.get(k)) return { applied: false, reason: 'cached' };
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS "app_migrations" (
    name TEXT PRIMARY KEY NOT NULL, applied_at TEXT NOT NULL, detail TEXT
  )`).run();
  const seen = await env.DB.prepare(`SELECT 1 AS x FROM app_migrations WHERE name = ?`)
    .bind(SHOWCASE_ADS_MIGRATION).first();
  if (seen) { seeded.set(k, true); return { applied: false }; }

  // Kompaniya yo'q/faol emas — hech narsa yozmaymiz (keyin qayta).
  const company = await env.DB.prepare(`SELECT company_id FROM companies WHERE company_id = ? AND status = 'active'`)
    .bind(ADS_COMPANY).first().catch(() => null);
  if (!company) return { applied: false, reason: 'no_company' };
  await ensureSchema(env);

  const nowIso = now.toISOString();
  const flag = await env.DB.prepare(`INSERT OR IGNORE INTO app_migrations (name, applied_at) VALUES (?, ?)`)
    .bind(SHOWCASE_ADS_MIGRATION, nowIso).run();
  seeded.set(k, true);
  if (!Number(flag?.meta?.changes || 0)) return { applied: false };

  const created = [];
  const slots = [];
  try {
    for (let i = PROMO_ADS.length - 1; i >= 0; i -= 1) {
      const a = PROMO_ADS[i];
      // Biroz o'tmishda: 1-reklama eng yangi.
      const ts = new Date(now.getTime() - (i + 2) * 60_000).toISOString();
      const row = await env.DB.prepare(
        `INSERT INTO company_posts (company_id, image_url, video_url, caption, created_at)
         VALUES (?, ?, ?, ?, ?) RETURNING id, created_at`
      ).bind(ADS_COMPANY, a.imageUrl, a.videoUrl, a.caption, ts).first();
      const id = Number(row.id);
      created.push(id);
      let musicId = null;
      try {
        const t = await env.DB.prepare(`SELECT id FROM music_tracks WHERE id = ? AND enabled = 1`).bind(a.musicId).first();
        musicId = t ? Number(t.id) : null;
      } catch { musicId = null; }
      await savePostExtras(env, 'company_post', id, {
        musicId, musicStart: 0, reel: false, track: null,
        showcase: { title: a.title, priceUzs: null, linkUrl: cleanShowcaseLink(a.linkUrl), catalogItemId: null, imageSeconds: null },
      });
      // Joy band bo'lsa (admin allaqachon qo'ygan) — tegmaymiz, keyingi bo'sh joy.
      const taken = new Set(((await env.DB.prepare(`SELECT slot FROM showcase_ads`).all())?.results || []).map((x) => Number(x.slot)));
      let slot = a.slot;
      if (taken.has(slot)) slot = [1, 2, 3, 4].find((s) => !taken.has(s)) || 0;
      if (slot) {
        await env.DB.prepare(
          `INSERT OR IGNORE INTO showcase_ads (slot, post_kind, post_id, enabled, updated_at, updated_by, post_created_at)
           VALUES (?, 'company_post', ?, 1, ?, 'seed:showcase_ads_v1', ?)`
        ).bind(slot, id, nowIso, normTs(row.created_at || ts)).run();
        slots.push(slot);
      }
    }
  } catch (e) {
    // Yarim yozilgan holatda belgi turadi — qayta yozib dublikat qilmaymiz.
    await env.DB.prepare(`UPDATE app_migrations SET detail = ? WHERE name = ?`)
      .bind(`error: ${String(e?.message || e).slice(0, 160)}; created=${created.join(',')}`, SHOWCASE_ADS_MIGRATION)
      .run().catch(() => {});
    return { applied: true, created, slots, error: true };
  }
  await env.DB.prepare(`UPDATE app_migrations SET detail = ? WHERE name = ?`)
    .bind(`created=${created.join(',')}; slots=${slots.join(',')}`, SHOWCASE_ADS_MIGRATION).run().catch(() => {});
  return { applied: true, created, slots };
}

// ═══ PROMO VIDEOLAR /uploads GA (bir marta, 2026-10) ═══
//
// iPhone pleyeri (AVPlayer) videoni FAQAT `Range` (206) bilan o'ynatadi.
// Saytning statik fayllari (`/promo/*.mp4`, Worker assets) `Range`ni
// qo'llamaydi — to'liq 200 qaytaradi va iPhone'da video ochilmaydi.
// `/uploads/*` esa Range/206 + chegara keshi bilan xizmat qiladi (Reels
// videolari shu yo'ldan). Shuning uchun: promo mp4 assets'dan bir marta
// omborga (`uploads/promo_*.mp4`) ko'chiriladi va NFCSTOREUZ'ning aynan
// shu `/promo/...mp4` manzilli postlari yangi manzilga o'tkaziladi.
// Poster rasm (`/promo/*.jpg`) joyida qoladi — rasmga Range kerak emas.
// Assets/ombor ishlamasa belgi qo'yilmaydi: 10 daqiqadan keyin qayta.
export const PROMO_VIDEO_MIGRATION = 'showcase_ads_v2_uploads';
export const promoUploadName = (videoUrl) => `promo_${String(videoUrl).split('/').pop().replace(/^nfcstore-/, '')}`;
const PROMO_RETRY_MS = 10 * 60_000;
let moved = new WeakMap();
let movedRetry = new WeakMap();

/// → { applied: false, reason? } | { applied: true, moved: [{ from, to, posts }] }
export async function moveShowcasePromoVideos(env, { now = new Date(), origin = 'https://nfcstore.uz' } = {}) {
  if (!env?.DB || !env.UPLOADS || !env.ASSETS) return { applied: false, reason: 'no_bindings' };
  const k = keyOf(env);
  if (moved.get(k)) return { applied: false, reason: 'cached' };
  if ((movedRetry.get(k) || 0) > now.getTime()) return { applied: false, reason: 'retry_later' };
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS "app_migrations" (
    name TEXT PRIMARY KEY NOT NULL, applied_at TEXT NOT NULL, detail TEXT
  )`).run();
  const seen = await env.DB.prepare(`SELECT 1 AS x FROM app_migrations WHERE name = ?`)
    .bind(PROMO_VIDEO_MIGRATION).first();
  if (seen) { moved.set(k, true); return { applied: false }; }
  // Promo postlar hali yaratilmagan bo'lsa — kutamiz (v1 avval).
  const v1 = await env.DB.prepare(`SELECT 1 AS x FROM app_migrations WHERE name = ?`)
    .bind(SHOWCASE_ADS_MIGRATION).first();
  if (!v1) return { applied: false, reason: 'no_v1' };

  const later = (reason) => { movedRetry.set(k, now.getTime() + PROMO_RETRY_MS); return { applied: false, reason }; };
  const out = [];
  for (const a of PROMO_ADS) {
    const name = promoUploadName(a.videoUrl);
    const key = `uploads/${name}`;
    let exists = null;
    try { exists = await env.UPLOADS.head(key); } catch { exists = null; }
    if (!exists) {
      let res;
      try { res = await env.ASSETS.fetch(new Request(origin + a.videoUrl)); } catch { return later('asset_fetch'); }
      const ct = String(res.headers.get('content-type') || '');
      if (!res.ok || !/^video\/mp4/i.test(ct)) return later(`asset_${res.status}`);
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (bytes.length < 1024) return later('asset_small');
      try {
        await env.UPLOADS.put(key, bytes, {
          httpMetadata: { contentType: 'video/mp4', cacheControl: 'public, max-age=31536000, immutable' },
          customMetadata: { uploadedAt: now.toISOString(), actor: `seed:${PROMO_VIDEO_MIGRATION}` },
        });
      } catch { return later('upload_put'); }
    }
    const to = `/uploads/${name}`;
    const r = await env.DB.prepare(`UPDATE company_posts SET video_url = ? WHERE company_id = ? AND video_url = ?`)
      .bind(to, ADS_COMPANY, a.videoUrl).run();
    out.push({ from: a.videoUrl, to, posts: Number(r?.meta?.changes || 0) });
  }
  await env.DB.prepare(`INSERT OR IGNORE INTO app_migrations (name, applied_at, detail) VALUES (?, ?, ?)`)
    .bind(PROMO_VIDEO_MIGRATION, now.toISOString(), out.map((m) => `${m.to}:${m.posts}`).join(',')).run();
  moved.set(k, true);
  return { applied: true, moved: out };
}
