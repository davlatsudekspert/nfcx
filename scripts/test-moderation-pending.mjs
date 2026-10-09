// MODERATSIYA QATTIQLASHTIRISH (2026-10, api/content-guard.js):
//   * tekshirilmagan fayl bilan chop etilgan post/istoriya — PENDING: faqat
//     egasiga (`pending: true`), lenta/profil/post sahifasi/featured da yo'q;
//     admin "Tasdiqlash" (PATCH resolved) ochadi;
//   * navbatga yozib bo'lmasa — 503 moderation_unavailable, fayl o'chiriladi;
//   * filtr o'chiq — baribir navbatga + admin Telegram (chastota cheklangan);
//   * consent_log, yuklashda ban, deleted_uploads (404), media arxivi,
//     text_flag (bloklamaydi), cron qayta tekshiruvi.
//   node scripts/test-moderation-pending.mjs
import { setupSocial, cookie, makeChecker } from './lib/social-fixture.mjs';
import { retryUncheckedMedia } from '../hosting/api/moderation-retry.js';

const { check, checkTrue, done } = makeChecker();
const { env, sqlite, call, resetLimits, worker } = await setupSocial({ TELEGRAM_BOT_TOKEN: 'tg-test', ADMIN_CHAT_ID: '42' });

const realFetch = globalThis.fetch;
const tg = [];
let gemini = null; // null — xizmat ishlamaydi; aks holda javob JSON
globalThis.fetch = async (input, init = {}) => {
  const u = String(input?.url || input);
  if (u.startsWith('https://api.telegram.org/')) { tg.push(JSON.parse(init.body).text); return new Response('{"ok":true}'); }
  if (u.includes('generativelanguage.googleapis.com')) {
    if (!gemini) return new Response('down', { status: 500 });
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(gemini) }] } }] }));
  }
  return realFetch(input, init);
};

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48, 0x44, 0x52, ...new Array(64).fill(1)]);
const up = (ck = cookie.user, e = null) => (e
  ? worker.fetch(new Request('https://nfcstore.uz/api/upload-media', { method: 'POST', headers: { cookie: ck, 'content-type': 'image/png', 'cf-connecting-ip': '203.0.113.9' }, body: PNG }), e)
    .then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }))
  : call('/api/upload-media', { method: 'POST', cookie: ck, headers: { 'content-type': 'image/png' }, body: PNG }));
const reports = () => sqlite.prepare(`SELECT * FROM content_reports ORDER BY id`).all();

// ═══ 1. Filtr o'chiq: navbat + Telegram (bir marta) ═══
let r = await up();
check('1) upload ok while moderation off', r.status, 200);
const img1 = r.body.url;
check('1) queued as unchecked', reports().filter((x) => x.target_id === img1).map((x) => [x.reason, x.status, x.reporter_ip]), [['unchecked', 'new', 'system']]);
checkTrue('1) telegram: moderation off alert', tg.some((t) => /moderatsiya ishlamayapti/i.test(t)));
checkTrue('1) telegram: unchecked alert with count', tg.some((t) => /navbatda: 1 ta/.test(t)));
const tgCount = tg.length;
r = await up();
const img2 = r.body.url;
check('1) second upload: no new telegram (rate limited)', tg.length, tgCount);
checkTrue('1) markers stored', !!sqlite.prepare(`SELECT value FROM admin_settings WHERE key = 'alert_unchecked_at'`).get()
  && !!sqlite.prepare(`SELECT value FROM admin_settings WHERE key = 'alert_moderation_off_at'`).get());

// ═══ 2. Pending post + consent ═══
r = await call('/api/records/VIP001/posts', { method: 'POST', cookie: cookie.user, json: { agreed: true, imageUrl: img1, caption: 'yangi' } });
check('2) post created pending', [r.status, r.body?.pending], [201, true]);
const pendPost = r.body.id;
const consent = sqlite.prepare(`SELECT user_id, kind, rules_version, source FROM consent_log`).all().map((x) => ({ ...x }));
check('2) consent_log row', consent, [{ user_id: 1, kind: 'content_rules', rules_version: '2026-10', source: 'web' }]);
r = await call('/api/records/VIP001/posts', { method: 'POST', cookie: cookie.user, headers: { 'x-app': 'nova' },
  json: { agreed: true, imageUrl: '/uploads/clean1.jpg', rulesVersion: '2026-11<b>!x', caption: 'toza' } });
check('2) clean post not pending', [r.status, r.body?.pending], [201, false]);
const cleanPost = r.body.id;
check('2) consent sanitized + app source', { ...sqlite.prepare(`SELECT rules_version, source FROM consent_log WHERE rules_version <> '2026-10'`).get() }, { rules_version: '2026-11bx', source: 'app' });
await call('/api/records/VIP001/posts', { method: 'POST', cookie: cookie.user, json: { agreed: true, imageUrl: '/uploads/clean2.jpg' } });
check('2) consent deduped per version', sqlite.prepare(`SELECT COUNT(*) AS n FROM consent_log`).get().n, 2);

const listIds = async (ck) => ((await call('/api/records/VIP001/posts', { cookie: ck })).body?.posts || []);
let other = await listIds(cookie.other);
checkTrue('2) other: pending post hidden', !other.some((p) => p.id === pendPost) && other.some((p) => p.id === cleanPost));
let owner = await listIds(cookie.user);
check('2) owner sees pending:true', owner.find((p) => p.id === pendPost)?.pending, true);
r = await call('/api/feed', { cookie: cookie.other });
checkTrue('2) feed hides pending', !(r.body?.feed || []).some((p) => p.kind === 'post' && p.id === pendPost));
r = await call(`/post/${pendPost}`);
check('2) post page 404', r.status, 404);
r = await call('/api/admin/featured', { method: 'POST', cookie: cookie.admin, json: { targetKind: 'post', targetId: pendPost, days: 1, note: 'x' } });
check('2) featured refuses pending', [r.status, r.body?.error], [409, 'content_pending']);

// Istoriya va kompaniya posti
r = await call('/api/records/VIP001/stories', { method: 'POST', cookie: cookie.user, json: { agreed: true, imageUrl: img2 } });
check('2) story pending', [r.status, r.body?.pending], [201, true]);
const pendStory = r.body.id;
r = await call('/api/records/VIP001/stories', { cookie: cookie.other });
checkTrue('2) other: story hidden', !(r.body?.stories || []).some((s) => s.id === pendStory));
r = await call('/api/records/VIP001/stories', { cookie: cookie.user });
check('2) owner: story pending', (r.body?.stories || []).find((s) => s.id === pendStory)?.pending, true);
r = await call('/api/companies/ACMEUZ/posts', { method: 'POST', cookie: cookie.user, json: { agreed: true, showcase: true, mediaUrls: ['/uploads/ok.jpg', img2], title: 'T' } });
check('2) company showcase pending (carousel file)', [r.status, r.body?.post?.pending], [201, true]);
const pendCo = r.body.post.id;
r = await call('/api/companies/ACMEUZ/posts', { cookie: cookie.other });
checkTrue('2) other: company post hidden', !(r.body?.posts || []).some((p) => p.id === pendCo));
r = await call('/api/companies/ACMEUZ/posts', { cookie: cookie.user });
check('2) owner: company post pending', (r.body?.posts || []).find((p) => p.id === pendCo)?.pending, true);
resetLimits();

// ═══ 3. Admin tasdiqlaydi ═══
r = await call('/api/admin/reports?status=new', { cookie: cookie.admin });
const rep1 = (r.body?.reports || []).find((x) => x.mediaUrl === img1);
check('3) report linked to pending post', [rep1?.targetKind, rep1?.targetId], ['post', String(pendPost)]);
const rep2 = (r.body?.reports || []).find((x) => x.mediaUrl === img2);
checkTrue('3) img2 linked to content', !!rep2 && rep2.targetKind !== 'media');
r = await call(`/api/admin/reports/${rep1.id}`, { method: 'PATCH', cookie: cookie.admin, json: { status: 'resolved' } });
check('3) approve ok', r.status, 200);
other = await listIds(cookie.other);
checkTrue('3) post visible after approve', other.some((p) => p.id === pendPost && p.pending === false));
r = await call(`/post/${pendPost}`);
check('3) post page 200', r.status, 200);
await call(`/api/admin/reports/${rep2.id}`, { method: 'PATCH', cookie: cookie.admin, json: { status: 'rejected' } });
r = await call('/api/companies/ACMEUZ/posts', { cookie: cookie.other });
checkTrue('3) company post visible after approve', (r.body?.posts || []).some((p) => p.id === pendCo));
r = await call('/api/records/VIP001/stories', { cookie: cookie.other });
checkTrue('3) story visible after approve', (r.body?.stories || []).some((s) => s.id === pendStory));

// ═══ 4. Navbatga yozib bo'lmasa — 503, fayl o'chiriladi ═══
const failing = {
  ...env,
  DB: {
    ...env.DB,
    prepare: (sql) => (/INSERT INTO content_reports/.test(sql)
      ? { bind() { return this; }, async run() { throw new Error('db down'); }, async first() { throw new Error('db down'); }, async all() { throw new Error('db down'); } }
      : env.DB.prepare(sql)),
  },
};
const before = [...env.UPLOADS._store.keys()].length;
r = await up(cookie.user, failing);
check('4) upload-media -> 503', [r.status, r.body?.error], [503, 'moderation_unavailable']);
checkTrue('4) uz message', /Tekshiruv vaqtincha/.test(r.body?.message || ''));
check('4) object removed', [...env.UPLOADS._store.keys()].length, before);
const b64 = `data:image/png;base64,${Buffer.from(PNG).toString('base64')}`;
const r2 = await worker.fetch(new Request('https://nfcstore.uz/api/upload', { method: 'POST',
  headers: { cookie: cookie.user, 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.9' }, body: JSON.stringify({ dataUrl: b64 }) }), failing);
check('4) base64 upload -> 503', r2.status, 503);
check('4) base64 object removed', [...env.UPLOADS._store.keys()].length, before);
resetLimits();

// ═══ 5. Yuklashda ban ═══
sqlite.prepare(`UPDATE users SET banned_until = '2999-01-01 00:00:00' WHERE id = 2`).run();
r = await up(cookie.other);
check('5) banned user upload -> 403', [r.status, r.body?.error], [403, 'banned']);
sqlite.prepare(`UPDATE users SET banned_until = NULL WHERE id = 2`).run();
r = await up(cookie.other);
check('5) unbanned ok', r.status, 200);

// ═══ 6. deleted_uploads — o'chirilgan fayl 404 ═══
r = await up();
const delImg = r.body.url;
const shared = (await up()).body.url;
r = await call('/api/records/VIP001/posts', { method: 'POST', cookie: cookie.user, json: { agreed: true, imageUrl: delImg } });
const delPost = r.body.id;
const sp1 = (await call('/api/records/VIP001/posts', { method: 'POST', cookie: cookie.user, json: { agreed: true, imageUrl: shared } })).body.id;
await call('/api/records/VIP001/posts', { method: 'POST', cookie: cookie.user, json: { agreed: true, imageUrl: shared } });
check('6) served before delete', (await call(delImg)).status, 200);
check('6) owner delete', (await call(`/api/posts/${delPost}`, { method: 'DELETE', cookie: cookie.user })).status, 200);
check('6) deleted file -> 404', (await call(delImg)).status, 404);
checkTrue('6) file kept in storage (evidence)', env.UPLOADS._store.has(delImg.slice(1)));
check('6) admin can still view (no-store)', [(await call(delImg, { cookie: cookie.admin })).status, (await call(delImg, { cookie: cookie.admin })).headers.get('cache-control')], [200, 'private, no-store']);
await call(`/api/posts/${sp1}`, { method: 'DELETE', cookie: cookie.user });
check('6) file still used elsewhere -> served', (await call(shared)).status, 200);
r = await call(`/api/admin/content/post/${pendPost}`, { method: 'DELETE', cookie: cookie.admin });
check('6) admin delete ok', r.status, 200);
check('6) admin-deleted file -> 404', (await call(img1)).status, 404);
checkTrue('6) denylist rows', sqlite.prepare(`SELECT COUNT(*) AS n FROM deleted_uploads`).get().n >= 2);
resetLimits();

// ═══ 7. /api/admin/content/media — arxiv, keyin o'chirish ═══
const lone = (await up()).body.url;
r = await call('/api/admin/content/media', { method: 'DELETE', cookie: cookie.admin, json: { url: lone } });
check('7) media delete ok', r.status, 200);
const am = sqlite.prepare(`SELECT kind, image_url, user_id, deleted_by_admin FROM content_archive WHERE kind = 'media'`).get();
check('7) archived before delete', [am?.kind, am?.image_url, am?.user_id, String(am?.deleted_by_admin || '').startsWith('admin#')], ['media', lone, '1', true]);
checkTrue('7) file removed', !env.UPLOADS._store.has(lone.slice(1)));
check('7) -> 404', (await call(lone)).status, 404);

// ═══ 8. text_flag — bloklamaydi, navbatga ═══
r = await call('/api/records/VIP001/posts', { method: 'POST', cookie: cookie.user, json: { agreed: true, imageUrl: '/uploads/t1.jpg', caption: 'Sen jalab ekansan' } });
check('8) profane caption still published', r.status, 201);
const flagged = r.body.id;
let tf = sqlite.prepare(`SELECT target_kind, target_id, reporter_ip, reason, status FROM content_reports WHERE reason = 'text_flag'`).all().map((x) => ({ ...x }));
check('8) text_flag report', tf, [{ target_kind: 'post', target_id: String(flagged), reporter_ip: 'system', reason: 'text_flag', status: 'new' }]);
await call('/api/records/VIP001/posts', { method: 'POST', cookie: cookie.user, json: { agreed: true, imageUrl: '/uploads/t2.jpg', caption: 'Ajoyib mahsulot, sikl bo‘yicha' } });
check('8) clean text not flagged', sqlite.prepare(`SELECT COUNT(*) AS n FROM content_reports WHERE reason = 'text_flag'`).get().n, 1);
r = await call(`/api/comments/post/${cleanPost}`, { method: 'POST', cookie: cookie.other, json: { body: 'what the fuck' } });
check('8) comment published', r.status, 201);
tf = sqlite.prepare(`SELECT target_kind FROM content_reports WHERE reason = 'text_flag' ORDER BY id`).all().map((x) => x.target_kind);
check('8) comment flagged', tf, ['post', 'comment']);
r = await call('/api/admin/reports?status=new', { cookie: cookie.admin });
checkTrue('8) admin sees text_flag', (r.body?.reports || []).some((x) => x.reason === 'text_flag'));
resetLimits();

// ═══ 9. Cron qayta tekshiruvi ═══
const H = { nowTs: () => new Date().toISOString().replace('T', ' ').replace('Z', '+00') };
const off = await retryUncheckedMedia(env, H);
check('9) moderation off -> skipped', off.skipped, true);
const genv = { ...env, GEMINI_API_KEY: 'test-key' };
const okImg = (await up()).body.url;
const badImg = (await up()).body.url;
const okPost = (await call('/api/records/VIP001/posts', { method: 'POST', cookie: cookie.user, json: { agreed: true, imageUrl: okImg } })).body;
const badPost = (await call('/api/records/VIP001/posts', { method: 'POST', cookie: cookie.user, json: { agreed: true, imageUrl: badImg } })).body;
check('9) both pending', [okPost.pending, badPost.pending], [true, true]);
// Qolgan eski navbatni yopamiz — faqat shu ikkitasi qolsin.
sqlite.prepare(`UPDATE content_reports SET status = 'resolved' WHERE target_kind = 'media' AND target_id NOT IN (?, ?)`).run(okImg, badImg);
gemini = null;
let st = await retryUncheckedMedia(genv, H);
check('9) gemini down -> still pending', [st.checked, st.still, st.approved, st.blocked], [2, 2, 0, 0]);
gemini = { allowed: true, category: 'none' };
sqlite.prepare(`UPDATE content_reports SET created_at = '2000-01-01 00:00:00+00' WHERE target_id = ?`).run(okImg);
st = await retryUncheckedMedia(genv, H, { limit: 1 });
check('9) allowed -> approved', st.approved, 1);
check('9) report resolved by system', sqlite.prepare(`SELECT status, resolved_by FROM content_reports WHERE target_id = ?`).get(okImg).resolved_by, 'system:recheck');
checkTrue('9) ok post now visible', (await listIds(cookie.other)).some((p) => p.id === okPost.id));
gemini = { allowed: false, category: 'sexual' };
st = await retryUncheckedMedia(genv, H);
check('9) blocked -> deleted', st.blocked, 1);
check('9) bad post gone', sqlite.prepare(`SELECT COUNT(*) AS n FROM posts WHERE id = ?`).get(badPost.id).n, 0);
check('9) archived with reason', sqlite.prepare(`SELECT reason, deleted_by_admin FROM content_archive WHERE kind = 'post' AND content_id = ? ORDER BY id DESC`).get(badPost.id)?.reason, 'auto_sexual');
checkTrue('9) scan block logged', sqlite.prepare(`SELECT COUNT(*) AS n FROM content_scan_blocks WHERE source = 'recheck'`).get().n === 1);
check('9) bad file -> 404', (await call(badImg)).status, 404);

globalThis.fetch = realFetch;
done();
