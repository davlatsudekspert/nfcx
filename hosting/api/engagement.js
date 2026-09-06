// hosting/api/engagement.js — CONTRACT.md ga qarang. Route topilmasa null qaytaradi.
//
// Tashrifchi hodisalari / statistika / lead capture / yangilik like-view
// (server/index.js Express + server/db.js porti, D1):
//   POST   /api/records/:code/event      (public) { type, ref? | meta? } → { ok }
//          whitelist: CARD_EVENT_TYPES (profile_view EMAS — u /view orqali);
//          rate-limit: bir tashrifchi (H.newsVisitorHash) bir kodga 10 daqiqada ≤ 30 hodisa → 429
//   GET    /api/records/:code/analytics  (ega)    ?days= → cardEventStats shakli
//          (Gold+ / Premium: advanced:true + byDay/byRef; aks holda bazaviy)
//   POST   /api/records/:code/lead       (public) → 201 { ok } | 403 lead_disabled | 429
//          limitlar: tashrifchi 3/daqiqa, 20/soat; kod uchun kuniga Gold+ 100, Silver 5, Free yopiq
//   GET    /api/records/:code/leads      (ega)    → { leads }
//   DELETE /api/records/:code/leads/:id  (ega)    → { ok }
//   POST   /api/news/:id/view            (public) → { ok, views }   (mavjud bo'lmasa 404)
//   POST   /api/news/:id/like            (public) → { liked, count, likes } (toggle, visitor hash)
//
// Tarif minimumlari src/lib/access.js FEATURE_MIN bilan BIR XIL bo'lishi shart
// (leadCapture: gold, advancedAnalytics: gold). Import emas — nusxa (deploy'da
// hosting/* faqat fayl-nusxalanadi, ../../src yo'li artifaktda yo'q).

const RANK = { free: 0, silver: 1, gold: 2, premium: 3, exclusive: 4 };
const hasAccess = (access, min) => (RANK[access] ?? 0) >= (RANK[min] ?? 99);
const FEATURE_MIN = { leadCapture: 'gold', advancedAnalytics: 'gold' };

// server/db.js CARD_EVENT_TYPES bilan bir xil.
export const CARD_EVENT_TYPES = [
  'profile_view', 'phone_click', 'telegram_click', 'whatsapp_click',
  'instagram_click', 'website_click', 'email_click', 'link_click',
  'contact_save', 'lead', 'menu_view', 'products_view', 'services_view',
];

const EVENT_WINDOW_MS = 10 * 60_000;
const EVENT_MAX_PER_WINDOW = 30;
const LEAD_MAX_PER_MIN = 3;
const LEAD_MAX_PER_HOUR = 20;
const DAY_MS = 24 * 60 * 60_000;

// H.nowTs() formatida ("YYYY-MM-DD HH:MM:SS.mmm+00") o'tmishdagi vaqt —
// created_at ustunlari bilan leksikografik taqqoslash uchun.
const tsAgo = (ms) => new Date(Date.now() - ms).toISOString().replace('T', ' ').replace('Z', '+00');

async function readJson(request) {
  const b = await request.json().catch(() => null);
  return b && typeof b === 'object' && !Array.isArray(b) ? b : {};
}

async function countRows(env, sql, ...args) {
  const r = await env.DB.prepare(sql).bind(...args).first();
  return Number(r?.n) || 0;
}

async function logCardEvent(env, H, code, eventType, { ref, visitorHash } = {}) {
  if (!CARD_EVENT_TYPES.includes(eventType)) return false;
  await env.DB.prepare(`INSERT INTO card_events (code, event_type, ref, visitor_hash, created_at) VALUES (?, ?, ?, ?, ?)`)
    .bind(code, eventType, ref ? String(ref).slice(0, 120) : null, visitorHash || null, H.nowTs()).run();
  return true;
}

// server/db.js cardEventStats — SQLite varianti.
async function cardEventStats(env, code, days = 30) {
  const d = Math.max(1, Math.min(365, Math.round(Number(days) || 30)));
  const since = tsAgo(d * DAY_MS);
  const [byType, byDay, byRef, uniq, total] = await Promise.all([
    env.DB.prepare(`SELECT event_type, COUNT(*) AS n FROM card_events WHERE code = ? AND created_at >= ? GROUP BY event_type`).bind(code, since).all(),
    env.DB.prepare(
      `SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS n FROM card_events
        WHERE code = ? AND event_type = 'profile_view' AND created_at >= ? GROUP BY day ORDER BY day`
    ).bind(code, since).all(),
    env.DB.prepare(
      `SELECT ref, COUNT(*) AS n FROM card_events
        WHERE code = ? AND ref IS NOT NULL AND event_type <> 'profile_view' AND created_at >= ?
        GROUP BY ref ORDER BY n DESC, ref LIMIT 20`
    ).bind(code, since).all(),
    env.DB.prepare(
      `SELECT COUNT(DISTINCT visitor_hash) AS n FROM card_events
        WHERE code = ? AND event_type = 'profile_view' AND visitor_hash IS NOT NULL AND created_at >= ?`
    ).bind(code, since).first(),
    env.DB.prepare(`SELECT COUNT(*) AS n FROM card_events WHERE code = ? AND event_type = 'profile_view' AND created_at >= ?`).bind(code, since).first(),
  ]);
  return {
    days: d,
    totalViews: Number(total?.n) || 0,
    uniqueVisitors: Number(uniq?.n) || 0,
    byType: Object.fromEntries((byType.results || []).map((r) => [r.event_type, Number(r.n) || 0])),
    byDay: (byDay.results || []).map((r) => ({ day: r.day, n: Number(r.n) || 0 })),
    byRef: (byRef.results || []).map((r) => ({ ref: r.ref, n: Number(r.n) || 0 })),
  };
}

const leadRow = (r) => ({
  id: Number(r.id), name: r.name, phone: r.phone ?? null, telegram: r.telegram ?? null, whatsapp: r.whatsapp ?? null,
  email: r.email ?? null, company: r.company ?? null, note: r.note ?? null, createdAt: r.createdAt,
});

async function ownerOnly(request, env, H, code) {
  const user = await H.getCurrentUser(request, env);
  if (!user) return { res: H.json({ error: 'unauthorized' }, 401) };
  if ((await H.getRecordOwner(env, code)) !== user.id) return { res: H.json({ error: 'forbidden' }, 403) };
  return { user };
}

// ---------- Analytics (Band 3.1) ----------

async function postEvent(request, env, H, code) {
  const body = await readJson(request);
  const type = String(body.type || '');
  if (!CARD_EVENT_TYPES.includes(type) || type === 'profile_view') return H.json({ error: 'bad_event' }, 422);
  const rec = await H.getRecord(env, code);
  if (!rec) return H.json({ error: 'not_found' }, 404);
  const visitorHash = await H.newsVisitorHash(request);
  const recent = await countRows(env,
    `SELECT COUNT(*) AS n FROM card_events WHERE code = ? AND visitor_hash = ? AND created_at >= ?`,
    code, visitorHash, tsAgo(EVENT_WINDOW_MS));
  if (recent >= EVENT_MAX_PER_WINDOW) return H.json({ error: 'rate_limited' }, 429);
  let ref = H.cleanStr(body.ref, 120);
  if (!ref && body.meta != null) {
    ref = typeof body.meta === 'string' ? H.cleanStr(body.meta, 120) : H.cleanStr(JSON.stringify(body.meta), 120);
  }
  await logCardEvent(env, H, code, type, { ref: ref || null, visitorHash });
  return H.json({ ok: true });
}

async function getAnalytics(request, env, H, url, code) {
  const own = await ownerOnly(request, env, H, code);
  if (own.res) return own.res;
  const rec = await H.getRecord(env, code);
  if (!rec) return H.json({ error: 'not_found' }, 404);
  const access = H.effectiveAccessD1(rec);
  const advanced = hasAccess(access, FEATURE_MIN.advancedAnalytics);
  const days = advanced ? Math.max(1, Math.min(365, Number(url.searchParams.get('days')) || 30)) : 30;
  const stats = await cardEventStats(env, code, days);
  if (!advanced) {
    // Bazaviy: faqat jami ko'rish + unique tashrifchi + hodisa turlari sanog'i.
    return H.json({ advanced: false, days: stats.days, totalViews: stats.totalViews, uniqueVisitors: stats.uniqueVisitors, byType: stats.byType, legacyViews: rec.views });
  }
  return H.json({ advanced: true, ...stats, legacyViews: rec.views });
}

// ---------- Lead Capture (Band 3.2) ----------

async function postLead(request, env, H, code) {
  const b = await readJson(request);
  // Honeypot — botlar to'ldiradigan ko'rinmas maydon.
  if (H.cleanStr(b.website_url, 200)) return H.json({ ok: true });
  const rec = await H.getRecord(env, code);
  if (!rec) return H.json({ error: 'not_found' }, 404);
  if (!rec.leadCapture) return H.json({ error: 'lead_disabled' }, 403);

  // Gold+ / Premium — to'liq; Silver — kuniga 5; Free — yopiq.
  const access = H.effectiveAccessD1(rec);
  let dailyCap = 0;
  if (hasAccess(access, FEATURE_MIN.leadCapture)) dailyCap = 100;
  else if (hasAccess(access, 'silver')) dailyCap = 5;
  if (dailyCap === 0) return H.json({ error: 'lead_disabled' }, 403);

  // Tashrifchi limiti (legacy leadLimiterMin/Hour o'rniga D1): 3/daqiqa, 20/soat.
  const visitorHash = await H.newsVisitorHash(request);
  const perMin = await countRows(env, `SELECT COUNT(*) AS n FROM card_leads WHERE visitor_hash = ? AND created_at >= ?`, visitorHash, tsAgo(60_000));
  if (perMin >= LEAD_MAX_PER_MIN) return H.json({ error: 'rate_limited' }, 429);
  const perHour = await countRows(env, `SELECT COUNT(*) AS n FROM card_leads WHERE visitor_hash = ? AND created_at >= ?`, visitorHash, tsAgo(60 * 60_000));
  if (perHour >= LEAD_MAX_PER_HOUR) return H.json({ error: 'rate_limited' }, 429);

  const today = await countRows(env, `SELECT COUNT(*) AS n FROM card_leads WHERE code = ? AND created_at >= ?`, code, tsAgo(DAY_MS));
  if (today >= dailyCap) return H.json({ error: 'lead_limit_reached' }, 429);

  const name = H.cleanStr(b.name, 80);
  const lead = {
    name,
    phone: H.cleanStr(b.phone, 40),
    telegram: H.cleanStr(b.telegram, 60).replace(/^@/, ''),
    whatsapp: H.cleanStr(b.whatsapp, 40),
    email: H.cleanStr(b.email, 120),
    company: H.cleanStr(b.company, 100),
    note: H.cleanStr(b.note, 500),
  };
  if (!name) return H.json({ error: 'name_required' }, 422);
  if (!lead.phone && !lead.telegram && !lead.whatsapp && !lead.email) return H.json({ error: 'contact_required' }, 422);
  await env.DB.prepare(
    `INSERT INTO card_leads (code, name, phone, telegram, whatsapp, email, company, note, visitor_hash, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(code, lead.name, lead.phone || null, lead.telegram || null, lead.whatsapp || null, lead.email || null,
    lead.company || null, lead.note || null, visitorHash, H.nowTs()).run();
  await logCardEvent(env, H, code, 'lead', { visitorHash }).catch(() => {});
  return H.json({ ok: true }, 201);
}

async function listLeads(request, env, H, code) {
  const own = await ownerOnly(request, env, H, code);
  if (own.res) return own.res;
  const { results } = await env.DB.prepare(
    `SELECT id, name, phone, telegram, whatsapp, email, company, note, created_at AS createdAt
       FROM card_leads WHERE code = ? ORDER BY created_at DESC, id DESC LIMIT 200`
  ).bind(code).all();
  return H.json({ leads: (results || []).map(leadRow) });
}

async function deleteLead(request, env, H, code, id) {
  const own = await ownerOnly(request, env, H, code);
  if (own.res) return own.res;
  await env.DB.prepare(`DELETE FROM card_leads WHERE code = ? AND id = ?`).bind(code, id).run();
  return H.json({ ok: true });
}

// ---------- Yangiliklar: ko'rish / like ----------

async function newsView(env, H, id) {
  const r = await env.DB.prepare(`UPDATE news SET views = views + 1 WHERE id = ? RETURNING views`).bind(id).first();
  if (!r) return H.json({ error: 'not_found' }, 404);
  return H.json({ ok: true, views: Number(r.views) || 0 });
}

// server/db.js toggleNewsLike — { liked, count } (+ `likes` alias).
async function newsLike(request, env, H, id) {
  const exists = await env.DB.prepare(`SELECT id FROM news WHERE id = ?`).bind(id).first();
  if (!exists) return H.json({ error: 'not_found' }, 404);
  const vh = await H.newsVisitorHash(request);
  const del = await env.DB.prepare(`DELETE FROM news_likes WHERE news_id = ? AND visitor_hash = ?`).bind(id, vh).run();
  const liked = !(del?.meta?.changes > 0);
  if (liked) {
    await env.DB.prepare(`INSERT OR IGNORE INTO news_likes (news_id, visitor_hash, created_at) VALUES (?, ?, ?)`).bind(id, vh, H.nowTs()).run();
  }
  const count = await countRows(env, `SELECT COUNT(*) AS n FROM news_likes WHERE news_id = ?`, id);
  return H.json({ liked, count, likes: count });
}

export async function handle(request, env, url, H) {
  const path = url.pathname;

  const nm = path.match(/^\/api\/news\/([^/]+)\/(view|like)$/);
  if (nm && request.method === 'POST') {
    const id = Number(nm[1]);
    if (!Number.isInteger(id) || id <= 0) return H.json({ error: 'bad_id' }, 400);
    return nm[2] === 'view' ? newsView(env, H, id) : newsLike(request, env, H, id);
  }

  const m = path.match(/^\/api\/records\/([^/]+)\/(event|analytics|lead|leads)(?:\/(\d+))?$/);
  if (!m) return null;
  let code;
  try { code = decodeURIComponent(m[1]).toUpperCase(); } catch { return H.json({ error: 'bad_code' }, 400); }
  const kind = m[2];
  const id = m[3] != null ? Number(m[3]) : null;
  const method = request.method;

  if (kind === 'event' && id == null && method === 'POST') {
    if (!H.validCode(code)) return H.json({ error: 'bad_code' }, 400);
    return postEvent(request, env, H, code);
  }
  if (kind === 'analytics' && id == null && method === 'GET') {
    if (!H.validCode(code)) return H.json({ error: 'bad_code' }, 400);
    return getAnalytics(request, env, H, url, code);
  }
  if (kind === 'lead' && id == null && method === 'POST') {
    if (!H.validCode(code)) return H.json({ error: 'bad_code' }, 400);
    return postLead(request, env, H, code);
  }
  if (kind === 'leads' && id == null && method === 'GET') {
    if (!H.validCode(code)) return H.json({ error: 'bad_code' }, 400);
    return listLeads(request, env, H, code);
  }
  if (kind === 'leads' && id != null && method === 'DELETE') {
    if (!H.validCode(code)) return H.json({ error: 'bad_code' }, 400);
    return deleteLead(request, env, H, code, id);
  }
  return null;
}
