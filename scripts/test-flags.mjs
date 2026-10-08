// KALITLAR (feature flags, hosting/api/flags.js) — standart O'CHIQ,
// env override, admin toggle (audit bilan), 60 s kesh, ochiq /api/app/config.
//   node scripts/test-flags.mjs
import worker from '../hosting/worker.js';
import { getFlags, __resetFlagsCache } from '../hosting/api/flags.js';
import { makeEnv, seedBasic, cookie, req, makeChecker } from './lib/d1-harness.mjs';

const { check, checkTrue, done } = makeChecker();
const { env } = makeEnv();
await seedBasic(env);
const j = async (e, path, init) => {
  const r = await worker.fetch(req(path, init), e, { waitUntil() {} });
  return { status: r.status, body: await r.json().catch(() => null), headers: r.headers };
};
const OFF = { reelsHidden: false, videoUploadsBlocked: false, videosHidden: false };

// 1. Standart — hammasi o'chiq, showcase doim true, no-store.
let r = await j(env, '/api/app/config');
check('1) config 200', r.status, 200);
check('1) default flags off + showcase', r.body?.flags, { ...OFF, showcase: true });
check('1) no-store', r.headers.get('cache-control'), 'no-store');

// 2. Env override — admin_settings dan ustun.
r = await j({ ...env, FLAG_REELS_HIDDEN: 'true', FLAG_VIDEOS_HIDDEN: '1' }, '/api/app/config');
check('2) env override on', [r.body?.flags?.reelsHidden, r.body?.flags?.videosHidden, r.body?.flags?.videoUploadsBlocked], [true, true, false]);

// 3. Admin GET/PUT — auth shart.
check('3) anon admin flags -> 401', (await j(env, '/api/admin/flags')).status, 401);
check('3) user cookie -> 401', (await j(env, '/api/admin/flags', { cookie: cookie.user })).status, 401);
r = await j(env, '/api/admin/flags', { cookie: cookie.admin });
check('3) admin GET', [r.status, r.body?.flags], [200, OFF]);
r = await j(env, '/api/admin/flags', { method: 'PUT', cookie: cookie.admin, json: { videoUploadsBlocked: true } });
check('3) admin PUT ok', [r.status, r.body?.flags?.videoUploadsBlocked], [200, true]);
r = await j(env, '/api/app/config');
check('3) config reflects toggle immediately (same isolate)', r.body?.flags?.videoUploadsBlocked, true);
const row = await env.DB.prepare(`SELECT value FROM admin_settings WHERE key = 'flag_video_uploads_blocked'`).first();
check('3) stored in admin_settings', row?.value, '1');
const audit = await env.DB.prepare(`SELECT action, details FROM admin_activity_log WHERE action = 'flags_update'`).first();
check('3) audit entry', audit?.details, 'videoUploadsBlocked=1');
check('3) bad value -> 422', (await j(env, '/api/admin/flags', { method: 'PUT', cookie: cookie.admin, json: { videosHidden: 'yes' } })).status, 422);
check('3) empty -> 422', (await j(env, '/api/admin/flags', { method: 'PUT', cookie: cookie.admin, json: {} })).status, 422);

// 4. Env "0" admin qiymatini bekor qiladi.
r = await j({ ...env, FLAG_VIDEO_UPLOADS_BLOCKED: '0' }, '/api/app/config');
check('4) env 0 overrides admin 1', r.body?.flags?.videoUploadsBlocked, false);
r = await j({ ...env, FLAG_VIDEO_UPLOADS_BLOCKED: 'false' }, '/api/admin/flags', { cookie: cookie.admin });
check('4) sources show env', r.body?.sources?.videoUploadsBlocked, 'env');

// 5. Kesh — boshqa yo'l bilan bazaga yozilgan qiymat 60 s ichida ko'rinmaydi.
await env.DB.prepare(`UPDATE admin_settings SET value = '0' WHERE key = 'flag_video_uploads_blocked'`).run();
check('5) cached value within TTL', (await getFlags(env)).videoUploadsBlocked, true);
__resetFlagsCache();
check('5) fresh read after cache reset', (await getFlags(env)).videoUploadsBlocked, false);

// 6. Baza xatosi — hammasi o'chiq, xato tashlamaydi.
__resetFlagsCache();
const broken = { DB: { prepare() { throw new Error('db down'); } } };
check('6) db error -> all off', await getFlags(broken), OFF);
check('6) db error + env override', (await getFlags({ ...broken, FLAG_REELS_HIDDEN: '1' })).reelsHidden, true);

// 7. Manager toggle qila oladi.
r = await j(env, '/api/admin/flags', { method: 'PUT', cookie: cookie.manager, json: { reelsHidden: false } });
checkTrue('7) manager PUT ok', r.status === 200);

done();
