// hosting/api/app-usage.js — ILOVANI KIM ISHLATYAPTI (admin uchun).
//
// ═══ NIMA UCHUN BOR ═══
//
// Egasining savoli (2026-09): "ilovani nechta odam ishlatyapti va
// ularning profillari ro'yxati bo'ladimi?" Sayt va ilova bitta
// hisoblar bazasida, shuning uchun "ilova foydalanuvchisi" alohida
// ajratilmas edi.
//
// ═══ QANDAY ANIQLANADI ═══
//
// Ilova (mobile_nova) har so'rovda `x-app: nova` sarlavhasini
// yuboradi va har ochilishda (hamda kirgandan keyin) `/api/auth/me`
// ni chaqiradi. O'sha paytda kirgan foydalanuvchi `app_users` ga
// yoziladi: birinchi va oxirgi ochilish, necha marta ochilgan,
// platforma. Ilovaning o'zini o'zgartirish shart emas — allaqachon
// o'rnatilgan versiyalar ham sanaladi.
//
// Qurilma identifikatori YIG'ILMAYDI (Play "Data safety" ga yangi
// ma'lumot turi qo'shilmasin): faqat hisob, vaqt, platforma va ilova
// BUILD raqami. Kirmagan (mehmon) ochilishlar sanalmaydi.
//
// BUILD RAQAMI (2026-09): yangi ilova `x-app-build: <raqam>` yuboradi —
// admin kim eski versiyada qolganini ko'radi (`app_build` ustuni,
// ADD COLUMN bilan qo'shiladi). Sarlavhasiz eski versiyalar ham avvalgidek
// sanaladi; ularda raqam bo'sh (oxirgi ma'lum raqam o'chirilmaydi).
//
// ═══ ADMIN ═══
//
//   GET /api/admin/app-users?q=&sort=recent|new|opens&page=&limit=
//     -> { stats: { total, today, week, month }, items, hasMore }
//     har yozuvda `platform`, `appBuild`, `registeredAt` ham bor.
//     `q` — istalgan so'z: email, telefon, NFC ID, profil ismi, kompaniya.
//     `filter` — premium | today | week.

let ready;
export async function ensureTable(env) {
  if (!ready) {
    ready = env.DB.batch([
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS "app_users" (
        user_id INTEGER PRIMARY KEY NOT NULL,
        platform TEXT NOT NULL DEFAULT '',
        first_seen TEXT NOT NULL,
        last_seen TEXT NOT NULL,
        opens INTEGER NOT NULL DEFAULT 0
      )`),
      env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_app_users_last ON app_users(last_seen DESC)`),
    ])
      // Build raqami ustuni — batch'dan TASHQARIDA: ustun allaqachon
      // bo'lsa ALTER xato beradi va bu normal holat (jim o'tadi).
      .then(() => env.DB.prepare(`ALTER TABLE app_users ADD COLUMN app_build INTEGER`).run().catch(() => {}))
      .catch((e) => { ready = null; throw e; });
  }
  await ready;
}

export const isNovaApp = (request) =>
  String(request?.headers?.get?.('x-app') || '').toLowerCase() === 'nova';

/// `x-app-build` — faqat musbat butun son (9 xonagacha), aks holda `null`.
export function appBuildOf(request) {
  const raw = String(request?.headers?.get?.('x-app-build') || '').trim();
  if (!/^\d{1,9}$/.test(raw)) return null;
  const n = Number(raw);
  return n > 0 ? n : null;
}

/// `/api/auth/me` dan chaqiriladi. Xato bo'lsa jim — kirish buzilmasin.
export async function recordAppOpen(env, request, userId) {
  if (!isNovaApp(request) || !userId) return;
  try {
    await ensureTable(env);
    const now = new Date().toISOString();
    const platform = String(request.headers.get('x-client') || '').toLowerCase().slice(0, 16);
    const build = appBuildOf(request);
    try {
      await env.DB.prepare(
        `INSERT INTO app_users (user_id, platform, first_seen, last_seen, opens, app_build) VALUES (?, ?, ?, ?, 1, ?)
         ON CONFLICT(user_id) DO UPDATE SET last_seen = excluded.last_seen,
           platform = excluded.platform, opens = app_users.opens + 1,
           app_build = COALESCE(excluded.app_build, app_users.app_build)`
      ).bind(Number(userId), platform, now, now, build).run();
    } catch {
      // `app_build` ustuni qo'shilmay qolgan bo'lsa ham ochilish
      // SANALSIN — avvalgi (build'siz) yozuv.
      await env.DB.prepare(
        `INSERT INTO app_users (user_id, platform, first_seen, last_seen, opens) VALUES (?, ?, ?, ?, 1)
         ON CONFLICT(user_id) DO UPDATE SET last_seen = excluded.last_seen,
           platform = excluded.platform, opens = app_users.opens + 1`
      ).bind(Number(userId), platform, now, now).run();
    }
  } catch (error) {
    console.error('recordAppOpen', error?.message);
  }
}

const PAGE_MAX = 100;
const SORTS = {
  recent: 'a.last_seen DESC',
  new: 'a.first_seen DESC',
  opens: 'a.opens DESC, a.last_seen DESC',
};

// ── GOOGLE PLAY TEKSHIRUVCHISI HISOBI (2026-09-23) ──────────────────
//
// Play Console "Доступ к приложению" bo'limi ilovaga kirish uchun login
// va parol so'raydi. Egasining SHAXSIY hisobini berish xavfli (haqiqiy
// profillar, Premium, Google xodimlari parolni ko'radi), oddiy ro'yxatdan
// o'tish esa email KODINI so'raydi — tekshiruvchi uning pochtasini ocha
// olmaydi.
//
// Shu sababli admin bir tugma bilan ALOHIDA, oldindan tasdiqlangan hisob
// yaratadi. Parol SERVERDA tasodifiy yaratiladi va FAQAT shu javobda bir
// marta ko'rsatiladi: kodda, logda va faoliyat jurnalida yo'q. Qayta
// bosilsa — yangi parol, eski sessiyalar yopiladi (eski parol ishlamaydi).
export const REVIEW_EMAIL = 'review@nfcstore.uz';
const REVIEW_NAME = 'Google Review';
const REVIEW_PREMIUM_DAYS = 120;

function randomPassword() {
  // Chalkash belgilarsiz (0/O, 1/l/I) — Play Console'ga qo'lda yoziladi.
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const bytes = new Uint8Array(14);
  crypto.getRandomValues(bytes);
  const s = [...bytes].map((b) => abc[b % abc.length]).join('');
  return `${s.slice(0, 5)}-${s.slice(5, 10)}-${s.slice(10)}`;
}

async function reviewAccount(request, env, H) {
  const admin = await H.requireAdmin(request, env);
  if (!admin) return H.json({ error: 'unauthorized' }, 401);
  if (admin.role && admin.role !== 'super_admin') return H.json({ error: 'forbidden' }, 403);

  const password = randomPassword();
  const hash = await H.hashPassword(password);
  const now = new Date();
  const premiumUntil = new Date(now.getTime() + REVIEW_PREMIUM_DAYS * 86_400_000).toISOString();

  let user = await env.DB.prepare(`SELECT id FROM users WHERE email = ?`).bind(REVIEW_EMAIL).first();
  let created = false;
  if (!user) {
    user = await env.DB.prepare(
      `INSERT INTO users (email, password_hash, phone, bot_ack, tos_accepted, created_at)
       VALUES (?, ?, NULL, 0, 1, ?) ON CONFLICT (email) DO NOTHING RETURNING id`
    ).bind(REVIEW_EMAIL, hash, H.nowTs()).first();
    if (!user) user = await env.DB.prepare(`SELECT id FROM users WHERE email = ?`).bind(REVIEW_EMAIL).first();
    created = true;
  }
  if (!user) return H.json({ error: 'create_failed' }, 500);
  const id = Number(user.id);

  // Parol yangilanadi, hisob faollashtiriladi, eski sessiyalar yopiladi.
  await env.DB.batch([
    env.DB.prepare(`UPDATE users SET password_hash = ?, deleted_at = NULL WHERE id = ?`).bind(hash, id),
    env.DB.prepare(`DELETE FROM sessions WHERE user_id = ?`).bind(id),
  ]);
  // Premium — tekshiruvchi HAMMA imkoniyatni ko'rsin (izoh ham). Ustun
  // bo'lmasa (juda eski baza) — jim o'tadi, kirish baribir ishlaydi.
  await env.DB.prepare(`UPDATE users SET premium_expires_at = ? WHERE id = ?`)
    .bind(premiumUntil, id).run().catch(() => {});

  // Bitta shaxsiy NFC ID — ilova bo'sh ochilmasin.
  const card = await env.DB.prepare(`SELECT code FROM cards WHERE user_id = ? LIMIT 1`).bind(id).first();
  let code = card?.code || '';
  if (!code) {
    const { createFreeAutoId } = await import('./auth.js');
    await createFreeAutoId(env, id, REVIEW_NAME);
    code = (await env.DB.prepare(`SELECT code FROM cards WHERE user_id = ? LIMIT 1`).bind(id).first())?.code || '';
  }

  // Jurnal — PAROLSIZ.
  H.logAdminActivity?.(env, {
    action: 'review_account',
    details: `Google tekshiruvchisi hisobi ${created ? 'yaratildi' : 'paroli yangilandi'}: ${REVIEW_EMAIL}`,
    ip: H.reqIp?.(request),
  })?.catch?.(() => {});

  return H.json({ ok: true, created, email: REVIEW_EMAIL, password, code, premiumUntil });
}

export async function handle(request, env, url, H) {
  if (url.pathname === '/api/admin/review-account' && request.method === 'POST') {
    return reviewAccount(request, env, H);
  }
  if (url.pathname !== '/api/admin/app-users') return null;
  if (request.method !== 'GET') return H.json({ error: 'method_not_allowed' }, 405);
  const admin = await H.requireAdmin(request, env);
  if (!admin) return H.json({ error: 'unauthorized' }, 401);
  await ensureTable(env);

  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
  const limit = Math.min(PAGE_MAX, Math.max(1, Number(url.searchParams.get('limit')) || 50));
  const order = SORTS[url.searchParams.get('sort')] || SORTS.recent;
  const q = String(url.searchParams.get('q') || '').trim().slice(0, 120);

  const since = (days) => new Date(Date.now() - days * 86_400_000).toISOString();
  const stats = await env.DB.prepare(
    `SELECT COUNT(*) AS total,
            SUM(CASE WHEN last_seen >= ? THEN 1 ELSE 0 END) AS today,
            SUM(CASE WHEN last_seen >= ? THEN 1 ELSE 0 END) AS week,
            SUM(CASE WHEN last_seen >= ? THEN 1 ELSE 0 END) AS month
       FROM app_users`
  ).bind(since(1), since(7), since(30)).first();

  const conds = [];
  const binds = [];
  // QIDIRUV — ISTALGAN SO'Z BO'YICHA (egasi, 2026-09-23: "so'zni yozsa
  // ham qidirsin"). Ilgari faqat TO'LIQ email/telefon/NFC ID mos kelardi.
  // Endi qismi ham: email, telefon, foydalanuvchi raqami, NFC ID kodi va
  // profil ISMI, kompaniya nomi va identifikatori. Katta-kichik harf
  // farqi yo'q. `%`/`_` foydalanuvchi matnidan olib tashlanadi.
  const clean = q.toLowerCase().replace(/[%_]/g, '');
  if (q && !clean) conds.push('0');
  else if (q) {
    const like = `%${clean}%`;
    conds.push(`(CAST(a.user_id AS TEXT) = ? OR LOWER(COALESCE(u.email,'')) LIKE ?
      OR COALESCE(u.phone,'') LIKE ?
      OR a.user_id IN (SELECT c.user_id FROM cards c
                        WHERE LOWER(c.code) LIKE ? OR LOWER(COALESCE(c.name,'')) LIKE ?)
      OR CAST(a.user_id AS TEXT) IN (SELECT co.owner_user_id FROM companies co
                        WHERE LOWER(COALESCE(co.display_name,'')) LIKE ? OR LOWER(co.company_id) LIKE ?))`);
    binds.push(q, like, like, like, like, like, like);
  }
  // FILTR: `premium` — faqat Premium; `today`/`week` — shu davrda ochganlar.
  const filter = url.searchParams.get('filter') || '';
  if (filter === 'premium') {
    conds.push('(u.is_premium = 1 OR (u.premium_expires_at IS NOT NULL AND u.premium_expires_at > ?))');
    binds.push(new Date().toISOString());
  }
  if (filter === 'today') { conds.push('a.last_seen >= ?'); binds.push(since(1)); }
  if (filter === 'week') { conds.push('a.last_seen >= ?'); binds.push(since(7)); }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const rows = await env.DB.prepare(
    // `a.*` — `app_build` ustuni hali qo'shilmagan bazada ham so'rov yiqilmasin.
    `SELECT a.*, u.email, u.phone, u.created_at, u.deleted_at, u.is_premium
       FROM app_users a LEFT JOIN users u ON u.id = a.user_id
       ${where}
      ORDER BY ${order} LIMIT ? OFFSET ?`
  ).bind(...binds, limit + 1, (page - 1) * limit).all();
  const all = rows?.results || [];
  const pageRows = all.slice(0, limit);

  // Profillar va bizneslar — bitta so'rovda, sahifadagi odamlar uchun.
  const ids = pageRows.map((r) => Number(r.user_id));
  const profiles = new Map();
  const companies = new Map();
  if (ids.length) {
    const marks = ids.map(() => '?').join(',');
    const cards = await env.DB.prepare(
      `SELECT user_id, code, name, profile_type FROM cards WHERE user_id IN (${marks}) ORDER BY is_primary DESC, ts DESC`
    ).bind(...ids).all().catch(() => null);
    for (const c of cards?.results || []) {
      const k = Number(c.user_id);
      if (!profiles.has(k)) profiles.set(k, []);
      profiles.get(k).push({ code: String(c.code), name: c.name || '', type: c.profile_type || 'personal' });
    }
    const cos = await env.DB.prepare(
      `SELECT owner_user_id, company_id, display_name FROM companies WHERE owner_user_id IN (${marks})`
    ).bind(...ids.map(String)).all().catch(() => null);
    for (const c of cos?.results || []) {
      const k = Number(c.owner_user_id);
      if (!companies.has(k)) companies.set(k, []);
      companies.get(k).push({ id: String(c.company_id), name: c.display_name || '' });
    }
  }

  return H.json({
    stats: {
      total: Number(stats?.total || 0),
      today: Number(stats?.today || 0),
      week: Number(stats?.week || 0),
      month: Number(stats?.month || 0),
    },
    items: pageRows.map((r) => ({
      userId: Number(r.user_id),
      email: r.email || '',
      phone: r.phone || '',
      premium: !!r.is_premium,
      deleted: !!r.deleted_at,
      platform: r.platform || '',
      appBuild: r.app_build == null ? null : Number(r.app_build),
      firstSeen: r.first_seen,
      lastSeen: r.last_seen,
      opens: Number(r.opens || 0),
      registeredAt: r.created_at || null,
      profiles: profiles.get(Number(r.user_id)) || [],
      companies: companies.get(Number(r.user_id)) || [],
    })),
    hasMore: all.length > limit,
  });
}
