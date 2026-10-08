// hosting/api/flags.js — KALITLAR (feature flags), 2026-10.
//
// ═══ NIMA UCHUN BOR ═══
//
// Egasi Reels/video bo'limini vaqtincha yopishi, video yuklashni to'xtatishi
// yoki mavjud videolarni yashirishi kerak bo'lishi mumkin (do'kon talabi,
// moderatsiya yuki). Bu kod o'zgartirmasdan va deploysiz, admin panelidan
// (yoki favqulodda — Worker o'zgaruvchisi bilan) qilinadi.
//
// ═══ QOIDALAR (API shartnomasi §1) ═══
//
//   * Hammasi STANDART O'CHIQ. Deploy qilinganda productionda hech narsa
//     o'zgarmaydi.
//   * Manba tartibi: avval env (`FLAG_REELS_HIDDEN`, `FLAG_VIDEO_UPLOADS_BLOCKED`,
//     `FLAG_VIDEOS_HIDDEN`: "1"/"true" — yoq, "0"/"false" — o'chir), bo'lmasa
//     `admin_settings` (`flag_reels_hidden`, ... = "1"/"0").
//   * `admin_settings` qiymati isolate ichida ~60 s keshlanadi. Baza xatosi —
//     hammasi o'chiq (env override baribir ishlaydi).
//
// Marshrutlar:
//   GET /api/app/config          (ochiq, no-store) → { flags: { reelsHidden, videoUploadsBlocked, videosHidden, showcase: true } }
//   GET /api/admin/flags         (admin)   → { flags, sources }
//   PUT /api/admin/flags         (manager+) { reelsHidden?, videoUploadsBlocked?, videosHidden? } → { ok, flags }

export const FLAG_DEFS = {
  reelsHidden: { env: 'FLAG_REELS_HIDDEN', key: 'flag_reels_hidden' },
  videoUploadsBlocked: { env: 'FLAG_VIDEO_UPLOADS_BLOCKED', key: 'flag_video_uploads_blocked' },
  videosHidden: { env: 'FLAG_VIDEOS_HIDDEN', key: 'flag_videos_hidden' },
};
const NAMES = Object.keys(FLAG_DEFS);
export const FLAGS_TTL_MS = 60_000;

export const VIDEO_UPLOADS_DISABLED = {
  error: 'video_uploads_disabled',
  message: "Video yuklash vaqtincha o'chirilgan. Rasm yuklashingiz mumkin.",
};

// Kesh — baza obyekti bo'yicha (testlarda har env o'z bazasi bilan).
// O'zbekiston bazasi adapteri isolate ichida bitta — umumiy kalit.
const UZ_KEY = {};
let cache = new WeakMap();
const cacheKey = (env) => (env?.UZ_STORE_ACTIVE ? UZ_KEY : (env?.DB || UZ_KEY));

export function __resetFlagsCache() { cache = new WeakMap(); }

function parseBool(v) {
  const s = String(v ?? '').trim().toLowerCase();
  if (s === '1' || s === 'true') return true;
  if (s === '0' || s === 'false') return false;
  return null;
}

async function dbFlags(env, now = Date.now()) {
  const key = cacheKey(env);
  const hit = cache.get(key);
  if (hit && now - hit.at < FLAGS_TTL_MS) return hit.flags;
  const flags = { reelsHidden: false, videoUploadsBlocked: false, videosHidden: false };
  try {
    const rows = await env.DB.prepare(
      `SELECT key, value FROM admin_settings WHERE key IN (${NAMES.map(() => '?').join(',')})`
    ).bind(...NAMES.map((n) => FLAG_DEFS[n].key)).all();
    for (const r of rows?.results || []) {
      const name = NAMES.find((n) => FLAG_DEFS[n].key === r.key);
      if (name) flags[name] = parseBool(r.value) === true;
    }
  } catch {
    // Jadval yo'q / tarmoq xatosi — hammasi o'chiq (xavfsiz standart).
  }
  cache.set(key, { at: now, flags });
  return flags;
}

/// Joriy kalitlar. Hech qachon xato tashlamaydi.
export async function getFlags(env) {
  const base = await dbFlags(env);
  const out = { ...base };
  for (const n of NAMES) {
    const ov = parseBool(env?.[FLAG_DEFS[n].env]);
    if (ov !== null) out[n] = ov;
  }
  return out;
}

function envSources(env) {
  const src = {};
  for (const n of NAMES) src[n] = parseBool(env?.[FLAG_DEFS[n].env]) !== null ? 'env' : 'admin';
  return src;
}

export async function handle(request, env, url, H) {
  const path = url.pathname;
  if (path === '/api/app/config') {
    if (request.method !== 'GET' && request.method !== 'HEAD') return H.json({ error: 'method_not_allowed' }, 405);
    const flags = await getFlags(env);
    return H.json({ flags: { ...flags, showcase: true } }, 200, { 'cache-control': 'no-store' });
  }
  if (path !== '/api/admin/flags') return null;
  const admin = await H.requireAdmin(request, env);
  if (!admin) return H.json({ error: 'unauthorized' }, 401);
  if (request.method === 'GET') {
    return H.json({ flags: await getFlags(env), sources: envSources(env) }, 200, { 'cache-control': 'no-store' });
  }
  if (request.method !== 'PUT') return H.json({ error: 'method_not_allowed' }, 405);
  if (!H.roleAtLeast(admin, 'manager')) return H.json({ error: 'forbidden' }, 403);
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) return H.json({ error: 'bad_request' }, 422);
  const before = await dbFlags(env, Infinity);
  const changes = [];
  for (const n of NAMES) {
    if (!(n in body)) continue;
    if (typeof body[n] !== 'boolean') return H.json({ error: 'bad_value', flag: n }, 422);
    changes.push([n, body[n]]);
  }
  if (!changes.length) return H.json({ error: 'nothing_to_change' }, 422);
  await env.DB.batch(changes.map(([n, v]) => env.DB.prepare(
    `INSERT INTO admin_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).bind(FLAG_DEFS[n].key, v ? '1' : '0')));
  cache.delete(cacheKey(env));
  const after = await getFlags(env);
  await H.logAdminActivity?.(env, {
    action: 'flags_update',
    details: changes.map(([n, v]) => `${n}=${v ? 1 : 0}`).join(', '),
    oldValue: JSON.stringify(Object.fromEntries(changes.map(([n]) => [n, !!before[n]]))),
    newValue: JSON.stringify(Object.fromEntries(changes)),
    ip: H.reqIp?.(request),
  });
  return H.json({ ok: true, flags: after, sources: envSources(env) });
}
