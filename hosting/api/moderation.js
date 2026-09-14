// hosting/api/moderation.js — CONTRACT.md ga qarang. Route topilmasa null qaytaradi.
//
// SHIKOYAT VA BLOKLASH. Platformada foydalanuvchi joylagan kontent
// bor (post, istorya, profil), lekin uni SHIKOYAT QILISH yo'li
// umuman yo'q edi — na ilovada, na saytda. Bu ikki sababdan muammo:
//
//   1. Odam nomaqbul kontentni ko'rsa, qo'lidan hech narsa
//      kelmasdi. Bizga esa u haqda xabar yetib kelmasdi: kontent
//      shikoyatsiz turaverardi.
//   2. Google Play foydalanuvchi kontenti (UGC) bor ilovalardan
//      ilova ICHIDA shikoyat qilish, foydalanuvchini bloklash va
//      moderatsiya tartibini TALAB qiladi. Busiz ilova rad
//      etiladi.
//
// Marshrutlar:
//   POST   /api/reports              (ixtiyoriy auth) { targetKind, targetId, reason, note? } → 201 { ok }
//   GET    /api/blocks               (auth) → { blocks }
//   POST   /api/blocks               (auth) { kind, id } → { ok }
//   DELETE /api/blocks/:kind/:id     (auth) → { ok }
//   GET    /api/admin/reports        (admin) ?status=&limit= → { reports }
//   PATCH  /api/admin/reports/:id    (admin) { status } → { ok, report }

// Shikoyat sabablari. Ro'yxat YOPIQ: erkin matn sabab bo'lsa,
// adminda saralash imkonsiz bo'lardi va bir xil muammo o'nta xil
// nom bilan kelardi. Izoh uchun alohida `note` maydoni bor.
//
// Ro'yxat saytdagi kontent qoidalari matni bilan bir xil narsalarni
// nomlaydi (`src/components/ContentRulesGate.jsx`): odam qoidada
// o'qigan narsani shikoyatda ham topishi kerak.
export const REPORT_REASONS = [
  'porn',        // pornografik yoki jinsiy xarakterdagi
  'religious',   // diniy targ'ibot yoki ekstremistik mazmun
  'political',   // siyosiy targ'ibot
  'violence',    // zo'ravonlik yoki shafqatsizlik
  'insult',      // haqorat, so'kinish, kamsitish
  'spam',        // spam yoki aldov
  'illegal',     // qonunga zid boshqa material
  'copyright',   // mualliflik huquqi
  'other',
];

// Nimaga shikoyat qilish mumkin.
const REPORT_TARGETS = ['post', 'story', 'company_post', 'record', 'company'];

// Nimani bloklash mumkin: PROFIL (shaxsiy yoki kompaniya).
// Alohida postni bloklash emas — odam odatda muallifdan qutulmoqchi
// bo'ladi, bitta postdan emas.
const BLOCK_KINDS = ['record', 'company'];

const REPORT_STATUSES = ['new', 'reviewing', 'resolved', 'rejected'];

// Bir odam bir sutkada nechta shikoyat yubora oladi. Chegarasiz
// bo'lsa, bitta odam raqobatchisining profilini yuzta shikoyat
// bilan ko'mib tashlashi mumkin edi.
const REPORT_MAX_PER_DAY = 20;
const DAY_MS = 24 * 60 * 60_000;

let schemaReady = null;

// Jadvallar KERAK BO'LGANDA yaratiladi — worker'ning boshqa
// bo'limlari kabi. Migratsiya skripti yo'q va bo'lishi ham shart
// emas: `IF NOT EXISTS` ikkinchi chaqiruvda hech narsa qilmaydi.
async function ensureSchema(env) {
  if (!schemaReady) {
    schemaReady = env.DB.batch([
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS "content_reports" (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        target_kind TEXT NOT NULL,
        target_id TEXT NOT NULL,
        owner_code TEXT NOT NULL DEFAULT '',
        reporter_id INTEGER,
        reporter_ip TEXT NOT NULL DEFAULT '',
        reason TEXT NOT NULL,
        note TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'new',
        created_at TEXT NOT NULL,
        resolved_at TEXT,
        resolved_by TEXT NOT NULL DEFAULT ''
      )`),
      // Adminning asosiy ko'rinishi — "yangi shikoyatlar, yangisi
      // yuqorida". Indeks aynan shu so'rov uchun.
      env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_reports_status ON content_reports(status, created_at DESC)`),
      env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_reports_target ON content_reports(target_kind, target_id)`),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS "user_blocks" (
        user_id INTEGER NOT NULL,
        target_kind TEXT NOT NULL,
        target_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (user_id, target_kind, target_id)
      )`),
    ]).catch(() => {});
  }
  await schemaReady;
}

async function readJson(request) {
  const b = await request.json().catch(() => null);
  return b && typeof b === 'object' && !Array.isArray(b) ? b : {};
}

const str = (v, max) => String(v ?? '').trim().slice(0, max);

/// Bitta odam bloklagan profillar — LENTANI FILTRLASH uchun.
///
/// Worker'ning lenta so'rovi shu ro'yxatni oladi va bloklangan
/// mualliflarni tashlab ketadi. Bloklash faqat ro'yxatga yozilib,
/// hech qayerda ishlatilmasa — tugma ishlayotgandek ko'rinib,
/// aslida hech narsa qilmasdi.
export async function blockedByUser(env, userId) {
  if (!userId) return [];
  await ensureSchema(env);
  const rows = await env.DB.prepare(
    `SELECT target_kind, target_id FROM user_blocks WHERE user_id = ?`
  ).bind(userId).all().catch(() => null);
  return (rows?.results || []).map((r) => ({ kind: r.target_kind, id: String(r.target_id) }));
}

export async function handle(request, env, url, H) {
  const path = url.pathname;

  // ── SHIKOYAT ───────────────────────────────────────────────────
  if (path === '/api/reports' && request.method === 'POST') {
    await ensureSchema(env);
    const user = await H.getCurrentUser(request, env).catch(() => null);
    const ip = H.reqIp(request);

    // KIRISH SHART EMAS. Profil sahifalari ochiq: shikoyat qilmoqchi
    // bo'lgan odam ro'yxatdan o'tgan bo'lishi shart emas va uni
    // majburlash shikoyatlar sonini nolga tushirardi. Suiiste'molga
    // qarshi — IP bo'yicha chegara.
    const key = user ? `rep:u:${user.id}` : `rep:ip:${ip}`;
    if (await H.rateLimitD1(env, key, REPORT_MAX_PER_DAY, DAY_MS)) {
      return H.json({ error: 'too_many_requests' }, 429);
    }

    const body = await readJson(request);
    const targetKind = str(body.targetKind, 20);
    const targetId = str(body.targetId, 60);
    const reason = str(body.reason, 20);
    if (!REPORT_TARGETS.includes(targetKind)) return H.json({ error: 'bad_target' }, 422);
    if (!targetId) return H.json({ error: 'bad_target' }, 422);
    if (!REPORT_REASONS.includes(reason)) return H.json({ error: 'bad_reason' }, 422);

    await env.DB.prepare(
      `INSERT INTO content_reports
         (target_kind, target_id, owner_code, reporter_id, reporter_ip, reason, note, status, created_at)
       VALUES (?,?,?,?,?,?,?,'new',?)`
    ).bind(
      targetKind, targetId, str(body.ownerCode, 40).toUpperCase(),
      user ? user.id : null, ip, reason, str(body.note, 600), H.nowTs(),
    ).run();

    // Adminni DARHOL xabardor qilamiz. Shikoyat navbatda yotib,
    // hech kim qaramasa — mexanizm bor bo'lsa ham ishlamaydi.
    // Xatosi yutiladi: Telegram tushsa ham shikoyat YOZILGAN.
    H.sendTelegramMessage?.(
      env,
      `Yangi shikoyat: ${targetKind} #${targetId}\nSabab: ${reason}`,
    )?.catch?.(() => {});

    return H.json({ ok: true }, 201);
  }

  // ── BLOKLASH ───────────────────────────────────────────────────
  if (path === '/api/blocks' && request.method === 'GET') {
    const user = await H.getCurrentUser(request, env).catch(() => null);
    if (!user) return H.json({ error: 'unauthorized' }, 401);
    return H.json({ blocks: await blockedByUser(env, user.id) });
  }

  if (path === '/api/blocks' && request.method === 'POST') {
    await ensureSchema(env);
    const user = await H.getCurrentUser(request, env).catch(() => null);
    if (!user) return H.json({ error: 'unauthorized' }, 401);
    const body = await readJson(request);
    const kind = str(body.kind, 20);
    const id = str(body.id, 60).toUpperCase();
    if (!BLOCK_KINDS.includes(kind) || !id) return H.json({ error: 'bad_target' }, 422);
    await env.DB.prepare(
      `INSERT OR IGNORE INTO user_blocks (user_id, target_kind, target_id, created_at) VALUES (?,?,?,?)`
    ).bind(user.id, kind, id, H.nowTs()).run();
    return H.json({ ok: true });
  }

  const unblock = path.match(/^\/api\/blocks\/([a-z_]+)\/([A-Za-z0-9_-]{1,60})$/);
  if (unblock && request.method === 'DELETE') {
    await ensureSchema(env);
    const user = await H.getCurrentUser(request, env).catch(() => null);
    if (!user) return H.json({ error: 'unauthorized' }, 401);
    await env.DB.prepare(
      `DELETE FROM user_blocks WHERE user_id = ? AND target_kind = ? AND target_id = ?`
    ).bind(user.id, unblock[1], unblock[2].toUpperCase()).run();
    return H.json({ ok: true });
  }

  // ── ADMIN: shikoyatlar navbati ─────────────────────────────────
  if (path === '/api/admin/reports' && request.method === 'GET') {
    const admin = await H.requireAdmin(request, env);
    if (!admin) return H.json({ error: 'unauthorized' }, 401);
    await ensureSchema(env);
    const status = url.searchParams.get('status') || '';
    const limit = Math.min(Number(url.searchParams.get('limit') || 100) || 100, 300);
    const rows = status && REPORT_STATUSES.includes(status)
      ? await env.DB.prepare(
        `SELECT * FROM content_reports WHERE status = ? ORDER BY created_at DESC LIMIT ?`
      ).bind(status, limit).all()
      : await env.DB.prepare(
        `SELECT * FROM content_reports ORDER BY created_at DESC LIMIT ?`
      ).bind(limit).all();
    return H.json({ reports: (rows.results || []).map(reportRowToJson) });
  }

  const one = path.match(/^\/api\/admin\/reports\/(\d+)$/);
  if (one && request.method === 'PATCH') {
    const admin = await H.requireAdmin(request, env);
    if (!admin) return H.json({ error: 'unauthorized' }, 401);
    await ensureSchema(env);
    const body = await readJson(request);
    const status = str(body.status, 20);
    if (!REPORT_STATUSES.includes(status)) return H.json({ error: 'bad_status' }, 422);
    const done = status === 'resolved' || status === 'rejected';
    const row = await env.DB.prepare(
      `UPDATE content_reports SET status = ?, resolved_at = ?, resolved_by = ?
        WHERE id = ? RETURNING *`
    ).bind(status, done ? H.nowTs() : null, done ? String(admin.username || admin.id || '') : '', Number(one[1]))
      .first();
    if (!row) return H.json({ error: 'not_found' }, 404);
    H.logAdminActivity?.(env, admin, 'report_status', `#${one[1]} → ${status}`)?.catch?.(() => {});
    return H.json({ ok: true, report: reportRowToJson(row) });
  }

  return null;
}

function reportRowToJson(r) {
  return {
    id: Number(r.id),
    targetKind: r.target_kind,
    targetId: String(r.target_id),
    ownerCode: r.owner_code || '',
    reporterId: r.reporter_id == null ? null : Number(r.reporter_id),
    reason: r.reason,
    note: r.note || '',
    status: r.status,
    createdAt: r.created_at,
    resolvedAt: r.resolved_at || null,
    resolvedBy: r.resolved_by || '',
  };
}
