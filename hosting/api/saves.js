// hosting/api/saves.js — SAQLANGANLAR (Reels va katalog sevimlilari).
//
// ═══ NIMA UCHUN BOR ═══
//
// Ilgari ilova saqlangan Reels va katalog sevimlilarini faqat TELEFON
// xotirasida saqlardi: telefon almashsa yoki ilova qayta o'rnatilsa
// hammasi yo'qolardi. Egasining talabi (2026-09): hisobga bog'lansin.
//
// ═══ SO'ROVLAR (kirish talab qilinadi) ═══
//
//   GET  /api/saves?kind=reel|listing
//        -> { items: [{ kind, ref, createdAt }] }  (yangisi oldin)
//   POST /api/saves  { kind, ref, saved: true|false }
//        -> { kind, ref, saved }
//
// `ref` — ilovadagi kalit: Reels uchun `p:<postId>` yoki `c:<postId>`
// (kompaniya posti), katalog uchun `<BusinessID>/<itemId>`. Server
// faqat shaklini tekshiradi — mazmunini EMAS: o'chirilgan post
// saqlanganlar ro'yxatida qolsa, ilova uni shunchaki ko'rsatmaydi.
//
// Jadval `CREATE TABLE IF NOT EXISTS` bilan yaratiladi — mavjud
// ma'lumotga tegilmaydi. Har tur bo'yicha 1000 tagacha.

export const SAVE_KINDS = ['reel', 'listing'];
const MAX_PER_KIND = 1000;
const REF_RE = /^[A-Za-z0-9'_:/.-]{1,120}$/;

let ready;
async function ensureTable(env) {
  if (!ready) {
    ready = env.DB.batch([
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS user_saves (
        user_id INTEGER NOT NULL,
        kind TEXT NOT NULL,
        ref TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (user_id, kind, ref)
      )`),
      env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_user_saves_recent ON user_saves(user_id, kind, created_at DESC)`),
    ]).catch((e) => { ready = null; throw e; });
  }
  await ready;
}

export async function handle(request, env, url, H) {
  if (url.pathname !== '/api/saves') return null;
  if (request.method !== 'GET' && request.method !== 'POST') {
    return H.json({ error: 'method_not_allowed' }, 405);
  }
  const user = await H.getCurrentUser(request, env);
  if (!user) return H.json({ error: 'unauthorized' }, 401);
  await ensureTable(env);

  if (request.method === 'GET') {
    const kind = String(url.searchParams.get('kind') || '');
    if (!SAVE_KINDS.includes(kind)) return H.json({ error: 'bad_kind' }, 422);
    const rows = await env.DB.prepare(
      `SELECT kind, ref, created_at FROM user_saves WHERE user_id = ? AND kind = ?
        ORDER BY created_at DESC LIMIT ${MAX_PER_KIND}`
    ).bind(user.id, kind).all();
    return H.json({
      items: (rows.results || []).map((r) => ({ kind: r.kind, ref: r.ref, createdAt: r.created_at })),
    });
  }

  const body = await request.json().catch(() => ({}));
  const kind = String(body?.kind || '');
  const ref = String(body?.ref || '').trim();
  if (!SAVE_KINDS.includes(kind)) return H.json({ error: 'bad_kind' }, 422);
  if (!REF_RE.test(ref)) return H.json({ error: 'bad_ref' }, 422);
  const saved = body?.saved !== false;

  if (!saved) {
    await env.DB.prepare(`DELETE FROM user_saves WHERE user_id = ? AND kind = ? AND ref = ?`)
      .bind(user.id, kind, ref).run();
    return H.json({ kind, ref, saved: false });
  }
  const cnt = await env.DB.prepare(`SELECT COUNT(*) AS n FROM user_saves WHERE user_id = ? AND kind = ?`)
    .bind(user.id, kind).first();
  if (Number(cnt?.n || 0) >= MAX_PER_KIND) {
    const exists = await env.DB.prepare(`SELECT 1 AS x FROM user_saves WHERE user_id = ? AND kind = ? AND ref = ?`)
      .bind(user.id, kind, ref).first();
    if (!exists) return H.json({ error: 'limit_reached', limit: MAX_PER_KIND }, 409);
  }
  await env.DB.prepare(`INSERT OR IGNORE INTO user_saves (user_id, kind, ref, created_at) VALUES (?,?,?,?)`)
    .bind(user.id, kind, ref, new Date().toISOString()).run();
  return H.json({ kind, ref, saved: true });
}
