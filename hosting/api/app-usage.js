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
// ma'lumot turi qo'shilmasin): faqat hisob, vaqt va platforma.
// Kirmagan (mehmon) ochilishlar sanalmaydi.
//
// ═══ ADMIN ═══
//
//   GET /api/admin/app-users?q=&sort=recent|new|opens&page=&limit=
//     -> { stats: { total, today, week, month }, items, hasMore }
//     `q` — istalgan so'z: email, telefon, NFC ID, profil ismi, kompaniya.
//     `filter` — premium | today | week.

let ready;
async function ensureTable(env) {
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
    ]).catch((e) => { ready = null; throw e; });
  }
  await ready;
}

export const isNovaApp = (request) =>
  String(request?.headers?.get?.('x-app') || '').toLowerCase() === 'nova';

/// `/api/auth/me` dan chaqiriladi. Xato bo'lsa jim — kirish buzilmasin.
export async function recordAppOpen(env, request, userId) {
  if (!isNovaApp(request) || !userId) return;
  try {
    await ensureTable(env);
    const now = new Date().toISOString();
    const platform = String(request.headers.get('x-client') || '').toLowerCase().slice(0, 16);
    await env.DB.prepare(
      `INSERT INTO app_users (user_id, platform, first_seen, last_seen, opens) VALUES (?, ?, ?, ?, 1)
       ON CONFLICT(user_id) DO UPDATE SET last_seen = excluded.last_seen,
         platform = excluded.platform, opens = app_users.opens + 1`
    ).bind(Number(userId), platform, now, now).run();
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

export async function handle(request, env, url, H) {
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
    `SELECT a.user_id, a.platform, a.first_seen, a.last_seen, a.opens,
            u.email, u.phone, u.created_at, u.deleted_at, u.is_premium
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
