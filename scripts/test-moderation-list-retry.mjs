// ADMIN RO'YXATIDA TEZ QAYTA TEKSHIRUV (2026-10, api/moderation-retry.js
// `retryOnAdminList`, moderation.js GET /api/admin/reports):
//   * admin ro'yxatni ochganda ≤3 ta tekshirilmagan fayl qayta tekshiriladi
//     (kutilayotgan kontentga bog'langani birinchi) — ruxsat bo'lsa ochiladi;
//   * 10 daqiqada bir martadan ko'p emas (isolate + admin_settings belgisi);
//   * umumiy vaqt chegarasi bor; filtr o'chiq — ishlamaydi; xato ro'yxatni buzmaydi.
//   node scripts/test-moderation-list-retry.mjs   (UZ_ADAPTER_TEST=1 bilan ham)
import { setupSocial, cookie, makeChecker } from './lib/social-fixture.mjs';
import { retryOnAdminList, __resetListRetry, LIST_RETRY_LIMIT } from '../hosting/api/moderation-retry.js';

const { check, checkTrue, done } = makeChecker();
const { env, sqlite, call, worker } = await setupSocial({ GEMINI_API_KEY: 'test-key' });

const realFetch = globalThis.fetch;
let gemini = 'down'; // 'down' | 'hang' | 'throw' | verdict obyekti
let geminiCalls = 0;
globalThis.fetch = async (input, init = {}) => {
  const u = String(input?.url || input);
  if (u.includes('generativelanguage.googleapis.com')) {
    geminiCalls++;
    if (gemini === 'down') return new Response('down', { status: 500 });
    if (gemini === 'throw') throw new Error('network');
    if (gemini === 'hang') return new Promise((resolve) => setTimeout(() => resolve(new Response('late', { status: 500 })), 1500));
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(gemini) }] } }] }));
  }
  if (u.startsWith('https://api.telegram.org/')) return new Response('{"ok":true}');
  return realFetch(input, init);
};

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48, 0x44, 0x52, ...new Array(64).fill(1)]);
const up = async () => (await call('/api/upload-media', { method: 'POST', cookie: cookie.user, headers: { 'content-type': 'image/png' }, body: PNG })).body.url;
const openUnchecked = () => sqlite.prepare(`SELECT COUNT(*) AS n FROM content_reports WHERE reason = 'unchecked' AND status = 'new'`).get().n;
const list = () => call('/api/admin/reports?status=new', { cookie: cookie.admin });
const marker = () => sqlite.prepare(`SELECT value FROM admin_settings WHERE key = 'moderation_retry_list_at'`).get()?.value || null;
const ageMarker = () => sqlite.prepare(`UPDATE admin_settings SET value = ? WHERE key = 'moderation_retry_list_at'`)
  .run(new Date(Date.now() - 11 * 60_000).toISOString());

// ═══ 0. Gemini ishlamaydi — 5 ta fayl navbatda, bittasi postda (pending) ═══
const files = [];
for (let i = 0; i < 5; i++) files.push(await up());
check('0) 5 unchecked queued', openUnchecked(), 5);
// Oxirgi fayl postda — navbatda birinchi bo'lishi kerak.
const p = await call('/api/records/VIP001/posts', { method: 'POST', cookie: cookie.user, json: { agreed: true, imageUrl: files[4] } });
check('0) post pending', [p.status, p.body?.pending], [201, true]);
const postId = p.body.id;
const visible = async () => ((await call('/api/records/VIP001/posts', { cookie: cookie.other })).body?.posts || []).some((x) => x.id === postId);
check('0) hidden from others', await visible(), false);

// ═══ 1. Admin ro'yxatni ochadi — 3 ta qayta tekshiriladi ═══
gemini = { allowed: true, category: 'none' };
geminiCalls = 0;
let r = await list();
check('1) list ok', r.status, 200);
check('1) at most 3 rechecked', geminiCalls, LIST_RETRY_LIMIT);
check('1) 3 approved, 2 left', openUnchecked(), 2);
check('1) pending post approved first', await visible(), true);
checkTrue('1) marker stored', !!marker());
checkTrue('1) list shows remaining unchecked', (r.body?.reports || []).filter((x) => x.reason === 'unchecked').length === 2);

// ═══ 2. 10 daqiqa ichida — qayta ishlamaydi ═══
geminiCalls = 0;
r = await list();
check('2) second list ok, no recheck', [r.status, geminiCalls, openUnchecked()], [200, 0, 2]);
__resetListRetry(); // yangi isolate — baza belgisi ushlaydi
r = await list();
check('2) new isolate: db marker still limits', [r.status, geminiCalls], [200, 0]);

// ═══ 3. 10 daqiqadan keyin — qolganlari ═══
ageMarker();
__resetListRetry();
r = await list();
check('3) after 10 min: remaining 2 rechecked', [r.status, geminiCalls, openUnchecked()], [200, 2, 0]);

// ═══ 4. Xato va vaqt chegarasi — ro'yxat buzilmaydi ═══
gemini = 'down';
for (let i = 0; i < 2; i++) await up();
check('4) 2 new unchecked', openUnchecked(), 2);
gemini = 'throw';
ageMarker();
__resetListRetry();
geminiCalls = 0;
r = await list();
check('4) gemini throws: list still 200', r.status, 200);
check('4) items stay queued', [geminiCalls > 0, openUnchecked()], [true, 2]);

gemini = 'hang';
ageMarker();
__resetListRetry();
const H = { nowTs: () => new Date().toISOString().replace('T', ' ').replace('Z', '+00') };
const t0 = Date.now();
const res = await retryOnAdminList(env, H, { budgetMs: 150 });
const took = Date.now() - t0;
check('4) budget: returns on time', [res.ran, res.timedOut], [true, true]);
checkTrue(`4) budget respected (${took} ms)`, took < 1000);
await new Promise((resolve) => setTimeout(resolve, 1700)); // osilgan so'rov tugasin

// Filtr o'chiq — umuman ishlamaydi.
ageMarker();
__resetListRetry();
geminiCalls = 0;
const offEnv = { ...env, GEMINI_API_KEY: '' };
const { req } = await import('./lib/d1-harness.mjs');
const offRes = await worker.fetch(req('/api/admin/reports?status=new', { cookie: cookie.admin }), offEnv);
check('4) moderation off: list ok, no gemini', [offRes.status, geminiCalls], [200, 0]);
check('4) moderation off: direct call skipped', (await retryOnAdminList(offEnv, H)).reason, 'off');

// Admin emas — 401, qayta tekshiruv ham yo'q.
ageMarker();
__resetListRetry();
geminiCalls = 0;
r = await call('/api/admin/reports', { cookie: cookie.user });
check('4) non-admin: 401, no recheck', [r.status, geminiCalls], [401, 0]);

globalThis.fetch = realFetch;
done();
