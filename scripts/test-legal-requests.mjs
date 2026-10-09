// "HUQUQIY SO'ROV" — hosting/api/legal-requests.js.
//   node scripts/test-legal-requests.mjs           (D1 kabi)
//   UZ_ADAPTER_TEST=1 node scripts/test-legal-requests.mjs   (sqld/Garage adapteri)
//
// Haqiqiy worker.fetch + xotiradagi baza (scripts/lib/social-fixture.mjs).
// Tekshiriladi:
//   * odam telefon, email, NFC ID, Business ID va #raqam bo'yicha topiladi;
//   * vaqt chizig'ida HOZIR TURGAN (post, Reels, kompaniya posti, muddati
//     o'tgan istoriya, profil videosi/fayli, izoh) va O'CHIRILGAN (API orqali
//     o'chirilgan post va izoh — arxivdan) kontent bor; begona kontent yo'q;
//   * kursorli sahifalash: takrorsiz, bo'shliqsiz, eng yangisi birinchi;
//   * ruxsat: cookie'siz va oddiy foydalanuvchi 401, content_manager 403;
//   * legal hold: izohsiz 422, purge to'siladi (`legal_hold`), olib
//     tashlash faqat super_admin; kartochkada ko'rinadi;
//   * eksport JSON shakli; har chaqiruv admin jurnalida (email/telefon ochiq emas).
// Production'ga HECH QACHON tegmaydi.
import { setupSocial, cookie, makeChecker } from './lib/social-fixture.mjs';
import { sha256Hex } from './lib/d1-harness.mjs';
import { purgeDeletedUser, runAccountPurge } from '../hosting/api/account-purge.js';

const { check, checkTrue, done } = makeChecker();
const { env, sqlite, call, resetLimits } = await setupSocial();
const H = { sha256Hex: async (t) => sha256Hex(t) };

// content_manager sessiyasi — bu bo'limga kira olmasligi kerak.
sqlite.prepare(`INSERT INTO admin_sessions (token, admin_id, role, abs_exp, last_activity) VALUES (?, 3, 'content_manager', '2999-01-01T00:00:00.000Z', ?)`)
  .run(sha256Hex('content-token'), new Date().toISOString());
const contentCookie = 'nfc_admin_session=content-token';

const DAY = 86_400_000;
const iso = (ms) => new Date(ms).toISOString();
const now = Date.now();

// ── Kontent: user#1 (VIP001, BIZ777, ACMEUZ) ─────────────────────────
sqlite.prepare(`INSERT INTO posts (id, code, user_id, image_url, caption, created_at) VALUES (101, 'VIP001', 1, '/uploads/p101.jpg', 'Oddiy post', '2026-09-01 10:00:00')`).run();
sqlite.prepare(`INSERT INTO posts (id, code, user_id, video_url, caption, created_at) VALUES (102, 'VIP001', 1, '/uploads/r102.mp4', 'Reels video', '2026-09-02 10:00:00')`).run();
sqlite.prepare(`INSERT INTO posts (id, code, user_id, image_url, caption, created_at) VALUES (103, 'BIZ777', 1, '/uploads/p103.jpg', 'Keyin o‘chiriladi', '2026-09-03 10:00:00')`).run();
sqlite.prepare(`INSERT INTO company_posts (id, company_id, image_url, caption, created_at) VALUES (301, 'ACMEUZ', '/uploads/c301.jpg', 'Kompaniya posti', ?)`).run(iso(now - 5 * DAY));
// Muddati o'tgan, lekin hali o'chirilmagan istoriya.
sqlite.prepare(`INSERT INTO stories (id, owner_kind, owner_id, user_id, image_url, caption, created_at, expires_at) VALUES (401, 'card', 'VIP001', 1, '/uploads/s401.jpg', 'eski istoriya', ?, ?)`)
  .run(iso(now - 3 * DAY), iso(now - 2 * DAY));
sqlite.prepare(`INSERT INTO card_videos (id, code, video_url, thumb_url, title, created_at) VALUES (501, 'VIP001', '/uploads/v501.mp4', '/uploads/v501.jpg', 'Profil videosi', '2026-08-01 09:00:00')`).run();
sqlite.prepare(`INSERT INTO card_files (id, code, title, file_url, created_at) VALUES (601, 'VIP001', 'Narxlar.pdf', '/uploads/f601.pdf', '2026-08-02 09:00:00')`).run();
// Begona (user#2) kontenti — user#1 ning dosyesiga TUSHMASLIGI kerak.
sqlite.prepare(`INSERT INTO posts (id, code, user_id, image_url, caption, created_at) VALUES (199, 'OTH222', 2, '/uploads/p199.jpg', 'Begona post', '2026-09-05 10:00:00')`).run();

// Izohlar API orqali: user#1 ikkita (biri keyin o'chiriladi), user#2 bitta.
const c1 = await call('/api/comments/post/199', { method: 'POST', cookie: cookie.user, json: { body: 'Birinchi izohim' } });
resetLimits();
const c2 = await call('/api/comments/post/199', { method: 'POST', cookie: cookie.user, json: { body: 'O‘chiriladigan izoh' } });
resetLimits();
const c3 = await call('/api/comments/post/101', { method: 'POST', cookie: cookie.other, json: { body: 'Begona izoh' } });
check('0) izohlar yozildi', [c1.status, c2.status, c3.status], [201, 201, 201]);
const c2id = c2.body?.comment?.id ?? c2.body?.id;
check('0) izoh o‘chirildi (arxivga)', (await call(`/api/comments/${c2id}`, { method: 'DELETE', cookie: cookie.user })).status, 200);
check('0) post API orqali o‘chirildi (arxivga)', (await call('/api/posts/103', { method: 'DELETE', cookie: cookie.user })).status, 200);

const S = (q, extra = '', who = cookie.admin) => call(`/api/admin/legal/subject?q=${encodeURIComponent(q)}${extra}`, { cookie: who });

// ═══ 1. Ruxsat ═══
check('1) cookie‘siz — 401', (await S('VIP001', '', null)).status, 401);
check('1) oddiy foydalanuvchi — 401', (await S('VIP001', '', cookie.user)).status, 401);
check('1) content_manager — 403', (await S('VIP001', '', contentCookie)).status, 403);
check('1) content_manager eksport — 403', (await call('/api/admin/legal/export?userId=1&format=json', { cookie: contentCookie })).status, 403);
check('1) content_manager hold — 403', (await call('/api/admin/legal/hold', { method: 'POST', cookie: contentCookie, json: { userId: 1, hold: true, note: 'x' } })).status, 403);
check('1) manager — 200', (await S('VIP001', '', cookie.manager)).status, 200);
check('1) q bo‘sh — 422', (await call('/api/admin/legal/subject', { cookie: cookie.admin })).status, 422);

// ═══ 2. Topish ═══
for (const [q, by] of [['+998901111111', 'phone'], ['998901111111', 'phone'], ['90 111 11 11', 'phone'], ['USER@test.local', 'email'],
  ['vip001', 'nfc_id'], ['ACMEUZ', 'business_id'], ['#1', 'user_id']]) {
  const r = await S(q);
  check(`2) "${q}" → user#1 (${by})`, [r.status, r.body?.subject?.userId, r.body?.subject?.matchedBy], [200, 1, by]);
}
check('2) user#2 Business ID bo‘yicha', (await S('OTHERCO')).body?.subject?.userId, 2);
check('2) topilmadi — 404', (await S('NOPE999')).status, 404);
{
  const s = (await S('VIP001')).body.subject;
  check('2) profil: email, telefon, ID lar, biznes', [s.email, s.phone, s.cards.map((c) => c.code).sort(), s.companies.map((c) => c.id)],
    ['user@test.local', '+998901111111', ['BIZ777', 'VIP001'], ['ACMEUZ']]);
  check('2) holat va hold', [s.status.deletedAt, s.legalHold], [null, null]);
}

// ═══ 3. Vaqt chizig'i ═══
const all = (await S('VIP001', '&limit=200')).body.items;
const key = (i) => `${i.source}:${i.kind}:${i.id}`;
const keys = all.map(key);
for (const k of ['live:post:101', 'live:reel:102', 'live:post:301', 'live:story:401', 'live:card_video:501', 'live:card_file:601']) {
  checkTrue(`3) bor: ${k}`, keys.includes(k));
}
checkTrue('3) tirik izoh bor', all.some((i) => i.source === 'live' && i.kind === 'comment' && i.text === 'Birinchi izohim'));
const archPost = all.find((i) => i.source === 'archive' && i.kind === 'post' && i.target?.contentId === 103);
check('3) o‘chirilgan post arxivdan', archPost && [archPost.text, archPost.imageUrl, archPost.ownerCode, archPost.deletedBy, !!archPost.deletedAt],
  ['Keyin o‘chiriladi', '/uploads/p103.jpg', 'BIZ777', { userId: 1 }, true]);
checkTrue('3) o‘chirilgan post tirik ro‘yxatda yo‘q', !keys.includes('live:post:103'));
const archCmt = all.find((i) => i.source === 'archive' && i.kind === 'comment');
check('3) o‘chirilgan izoh arxivdan', archCmt && [archCmt.text, archCmt.target?.kind, archCmt.target?.id], ['O‘chiriladigan izoh', 'post', 199]);
checkTrue('3) o‘chirilgan izoh tirik ro‘yxatda yo‘q', !all.some((i) => i.source === 'live' && i.text === 'O‘chiriladigan izoh'));
checkTrue('3) begona kontent yo‘q', !all.some((i) => i.text === 'Begona post' || i.text === 'Begona izoh'));
const story = all.find((i) => i.kind === 'story');
checkTrue('3) istoriya muddati o‘tgan (expiresAt o‘tmishda)', story && story.expiresAt < Date.now());
const rv = all.find((i) => i.kind === 'card_video');
check('3) profil videosi: video + muqova', rv && [rv.videoUrl, rv.imageUrl], ['/uploads/v501.mp4', '/uploads/v501.jpg']);
check('3) maydonlar shakli', Object.keys(all[0]).sort(),
  ['createdAt', 'deletedAt', 'deletedBy', 'expiresAt', 'fileUrl', 'id', 'imageUrl', 'kind', 'mediaUrls', 'ownerCode', 'ownerKind', 'reason', 'source', 'target', 'text', 'uid', 'videoUrl'].sort());
// Saralash soniya aniqligida (bazadagi sana shakllari aralash).
const secOf = (i) => Math.floor((i.createdAt || 0) / 1000);
checkTrue('3) eng yangisi birinchi', all.every((x, i) => i === 0 || secOf(all[i - 1]) >= secOf(x)));
check('3) jami soni', all.length, 9);

// Filtrlar
check('3) kind=reel', (await S('VIP001', '&kind=reel')).body.items.map(key), ['live:reel:102']);
checkTrue('3) source=archive — faqat arxiv', (await S('VIP001', '&source=archive')).body.items.every((i) => i.source === 'archive'));
check('3) source=archive soni', (await S('VIP001', '&source=archive')).body.items.length, 2);
check('3) kind=comment', (await S('VIP001', '&kind=comment')).body.items.length, 2);
check('3) noto‘g‘ri kind e’tiborsiz', (await S('VIP001', '&kind=DROP')).body.items.length, 9);

// ═══ 4. Sahifalash ═══
{
  const seen = [];
  let cursor = '';
  let pages = 0;
  for (;;) {
    const r = await S('VIP001', `&limit=2${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
    seen.push(...r.body.items.map((i) => i.uid));
    pages++;
    if (!r.body.nextCursor || pages > 20) break;
    cursor = r.body.nextCursor;
  }
  check('4) sahifalar: hammasi, takrorsiz', [seen.length, new Set(seen).size, pages], [9, 9, 5]);
  check('4) tartib bir xil', seen, all.map((i) => i.uid));
  check('4) buzuq kursor — 422', (await S('VIP001', '&cursor=%%%')).status, 422);
}

// ═══ 5. Legal hold ═══
const hold = (json, who = cookie.admin) => call('/api/admin/legal/hold', { method: 'POST', cookie: who, json });
check('5) izohsiz — 422', (await hold({ userId: 2, hold: true, note: '  ' })).status, 422);
check('5) yo‘q foydalanuvchi — 404', (await hold({ userId: 999, hold: true, note: 'x' })).status, 404);
check('5) manager hold qo‘ydi', (await hold({ userId: 2, hold: true, note: 'Sud so‘rovi №12' }, cookie.manager)).status, 200);
check('5) subject’da ko‘rinadi', (await S('OTHERCO')).body.subject.legalHold?.note, 'Sud so‘rovi №12');
check('5) kartochkada ko‘rinadi', (await call('/api/admin/users/2/detail', { cookie: cookie.admin })).body?.legalHold?.note, 'Sud so‘rovi №12');
check('5) manager olib tashlay olmaydi — 403', (await hold({ userId: 2, hold: false }, cookie.manager)).status, 403);

// Hisob 40 kun oldin o'chirilgan (o'zi so'ragan) — purge muddati o'tgan.
const delAt = new Date(now - 40 * DAY).toISOString().replace('T', ' ').replace('Z', '+00');
sqlite.prepare(`UPDATE users SET deleted_at = ? WHERE id = 2`).run(delAt);
await call('/api/admin/account-deletions?state=all', { cookie: cookie.admin }); // purge ustunlari
sqlite.prepare(`UPDATE users SET deletion_source = 'self' WHERE id = 2`).run();
{
  const r = await purgeDeletedUser(env, H, 2, { mode: 'on', now });
  check('5) held hisob purge’i to‘sildi', [r.status, (r.blockers || []).includes('legal_hold')], ['blocked', true]);
  const run = await runAccountPurge(env, H, { mode: 'on', now });
  check('5) cron ham tegmaydi', [run.purged, !!sqlite.prepare(`SELECT purged_at FROM users WHERE id = 2`).get().purged_at], [0, false]);
  checkTrue('5) ma’lumot joyida (post 199)', !!sqlite.prepare(`SELECT 1 FROM posts WHERE id = 199`).get());
}
check('5) super_admin olib tashladi', (await hold({ userId: 2, hold: false })).status, 200);
{
  const r = await purgeDeletedUser(env, H, 2, { mode: 'dry-run', now });
  checkTrue('5) holdsiz — legal_hold to‘sig‘i yo‘q', !(r.blockers || []).includes('legal_hold'));
}

// ═══ 6. Eksport ═══
{
  const r = await call('/api/admin/legal/export?userId=1&format=json', { cookie: cookie.admin });
  check('6) eksport 200', r.status, 200);
  check('6) shakli', Object.keys(r.body).sort(), ['format', 'generatedAt', 'generatedBy', 'items', 'subject', 'total', 'truncated']);
  check('6) hammasi va kim yaratgan', [r.body.total, r.body.items.length, r.body.truncated, r.body.generatedBy.adminId, r.body.subject.userId],
    [9, 9, false, 1, 1]);
  check('6) noto‘g‘ri format — 422', (await call('/api/admin/legal/export?userId=1&format=csv', { cookie: cookie.admin })).status, 422);
  check('6) yo‘q foydalanuvchi — 404', (await call('/api/admin/legal/export?userId=999', { cookie: cookie.admin })).status, 404);
}

// ═══ 7. Jurnal ═══
{
  const rows = sqlite.prepare(`SELECT action, details FROM admin_activity_log WHERE action LIKE 'legal_%'`).all();
  const by = (a) => rows.filter((r) => r.action === a);
  checkTrue('7) ko‘rishlar jurnalda', by('legal_subject_view').length >= 10);
  checkTrue('7) hold/unhold/eksport jurnalda', by('legal_hold').length === 1 && by('legal_unhold').length === 1 && by('legal_export').length >= 1);
  checkTrue('7) qidiruv va admin yozilgan', by('legal_subject_view').some((r) => /admin#1:super_admin q=VIP001 -> user#1/.test(r.details)));
  checkTrue('7) email/telefon ochiq yozilmagan', !rows.some((r) => /user@test\.local|998901111111/i.test(r.details)));
  checkTrue('7) telefon xesh bilan', by('legal_subject_view').some((r) => /q=phone:[0-9a-f]{12}/.test(r.details)));
}

done('Huquqiy so‘rov');
