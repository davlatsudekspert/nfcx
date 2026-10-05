// "AKTUAL" — istoriyalarni doimiy to'plamga saqlash (hosting/api/highlights.js).
//
// Tekshiriladi: egasi profil yoki kompaniya uchun Aktual yaratadi, nomini
// va muqovasini o'zgartiradi, istoriya qo'shadi/olib tashlaydi, o'chiradi;
// begona hech birini qila olmaydi; istoriya muddati o'tib o'chsa (va fayl
// tozalovchisi ishlasa) Aktualdagi nusxa va FAYL qoladi; egasi o'chirilgan,
// faol bo'lmagan kompaniya va bloklangan profil Aktuali ko'rinmaydi; karta
// o'chirilganda Aktual ham ketadi (kod qayta sotilsa begona ko'rmasin).
//
//   node scripts/test-highlights.mjs
import { setupSocial, cookie, makeChecker } from './lib/social-fixture.mjs';
import { sha256Hex } from './lib/d1-harness.mjs';

const { check, checkTrue, done } = makeChecker();
const { env, sqlite, call, resetLimits } = await setupSocial();

const story = async (path, img, ck = cookie.user) => {
  const r = await call(path, { method: 'POST', cookie: ck, json: { agreed: true, imageUrl: img, caption: `cap ${img}` } });
  return r.body?.id ?? r.body?.story?.id;
};
const putR2 = (url) => env.UPLOADS.put(url.replace(/^\//, ''), new Uint8Array([1, 2, 3]));
const r2Has = (url) => env.UPLOADS._store.has(url.replace(/^\//, ''));

const IMG1 = '/uploads/story_aaaaaaaaaaaaaaaaaaaaaaaa.jpg';
const IMG2 = '/uploads/story_bbbbbbbbbbbbbbbbbbbbbbbb.jpg';
const IMG3 = '/uploads/story_cccccccccccccccccccccccc.jpg';
for (const u of [IMG1, IMG2, IMG3]) await putR2(u);
const s1 = await story('/api/records/VIP001/stories', IMG1);
const s2 = await story('/api/records/VIP001/stories', IMG2);
const sOther = await story('/api/records/OTH222/stories', '/uploads/story_dddddddddddddddddddddddd.jpg', cookie.other);
const sCo = await story('/api/companies/ACMEUZ/stories', IMG3);
checkTrue('0) istoriyalar yaratildi', s1 && s2 && sOther && sCo);

// ── 1) Yaratish ────────────────────────────────────────────────────
let r = await call('/api/highlights', { method: 'POST', cookie: cookie.user, json: { code: 'vip001', title: '  Menyu  ', storyIds: [s2, s1] } });
check('1) 201', r.status, 201);
const h = r.body.highlight;
check('1) shakl', [h.ownerKind, h.ownerId, h.title, h.itemCount, h.items.map((i) => i.storyId)], ['card', 'VIP001', 'Menyu', 2, [s2, s1]]);
check('1) muqova yo‘q — birinchi rasm', h.coverUrl, IMG2);
checkTrue('1) element: nusxa maydonlari', ['id', 'storyId', 'imageUrl', 'videoUrl', 'caption', 'createdAt', 'addedAt'].every((k) => k in h.items[0]));
check('1) element matni nusxalandi', h.items[0].caption, `cap ${IMG2}`);
for (const [label, json, status, err] of [
  ['nomsiz', { code: 'VIP001', title: '  ' }, 422, 'title_required'],
  ['25 belgi', { code: 'VIP001', title: 'x'.repeat(25) }, 422, 'title_too_long'],
  ['egasiz', { title: 'A' }, 422, 'bad_owner'],
  ['ikkala ega', { code: 'VIP001', companyId: 'ACMEUZ', title: 'A' }, 422, 'bad_owner'],
  ['begona profil', { code: 'OTH222', title: 'A' }, 403, 'forbidden'],
  ['yo‘q profil', { code: 'NOPE99', title: 'A' }, 404, 'not_found'],
  ['tashqi muqova', { code: 'VIP001', title: 'A', coverUrl: 'https://evil.example/a.jpg' }, 422, 'bad_cover'],
  ['begona istoriya', { code: 'VIP001', title: 'A', storyIds: [sOther] }, 404, 'story_not_found'],
]) {
  r = await call('/api/highlights', { method: 'POST', cookie: cookie.user, json });
  check(`1) ${label}: ${status} ${err}`, [r.status, r.body?.error], [status, err]);
}
check('1) 24 belgi (emoji bitta belgi) — mumkin', (await call('/api/highlights', { method: 'POST', cookie: cookie.user, json: { code: 'VIP001', title: '🍕'.repeat(24) } })).status, 201);
r = await call('/api/highlights', { method: 'POST', json: { code: 'VIP001', title: 'A' } });
check('1) kirmagan: 401', r.status, 401);
// MUQOVA (S2): faqat shu Aktualdagi istoriya rasmi — istalgan /uploads/ fayli emas.
r = await call('/api/highlights', { method: 'POST', cookie: cookie.user, json: { companyId: 'acmeuz', title: 'Aksiya', coverUrl: IMG3 } });
check('1) muqova Aktual elementi emas (bo‘sh Aktual): 422 bad_cover', [r.status, r.body.error], [422, 'bad_cover']);
r = await call('/api/highlights', { method: 'POST', cookie: cookie.user, json: { code: 'VIP001', title: 'A', coverUrl: IMG3, storyIds: [s1] } });
check('1) muqova — boshqa egasining (kompaniya) rasmi: 422', [r.status, r.body.error], [422, 'bad_cover']);
r = await call('/api/highlights', { method: 'POST', cookie: cookie.user, json: { code: 'VIP001', title: 'A', coverUrl: '/uploads/ixtiyoriy123.jpg', storyIds: [s1] } });
check('1) muqova — ixtiyoriy /uploads fayli: 422', [r.status, r.body.error], [422, 'bad_cover']);
r = await call('/api/highlights', { method: 'POST', cookie: cookie.user, json: { companyId: 'acmeuz', title: 'Aksiya', coverUrl: IMG3, storyIds: [sCo] } });
check('1) kompaniya Aktuali, muqova o‘z elementidan: 201', [r.status, r.body.highlight.ownerKind, r.body.highlight.ownerId, r.body.highlight.coverUrl, r.body.highlight.itemCount], [201, 'company', 'ACMEUZ', IMG3, 1]);
const hc = r.body.highlight.id;
r = await call('/api/highlights', { method: 'POST', cookie: cookie.other, json: { companyId: 'ACMEUZ', title: 'X' } });
check('1) begona kompaniya: 403', r.status, 403);

// ── 2) Istoriya qo'shish / olib tashlash ───────────────────────────
r = await call(`/api/highlights/${hc}/items`, { method: 'POST', cookie: cookie.user, json: { storyKind: 'company_story', storyId: sCo } });
check('2) takror: 409 already_added', [r.status, r.body.error], [409, 'already_added']);
r = await call(`/api/highlights/${hc}/items`, { method: 'POST', cookie: cookie.user, json: { storyKind: 'story', storyId: s1 } });
check('2) turi mos emas (shaxsiy istoriya kompaniyaga): 422', [r.status, r.body.error], [422, 'bad_kind']);
r = await call(`/api/highlights/${h.id}/items`, { method: 'POST', cookie: cookie.user, json: { storyKind: 'story', storyId: sOther } });
check('2) begona istoriya: 404', [r.status, r.body.error], [404, 'story_not_found']);
r = await call(`/api/highlights/${h.id}/items`, { method: 'POST', cookie: cookie.other, json: { storyKind: 'story', storyId: sOther } });
check('2) begona Aktualga qo‘sha olmaydi: 403', r.status, 403);
r = await call(`/api/highlights/${h.id}/items`, { method: 'POST', cookie: cookie.user, json: { storyKind: 'story', storyId: 'x' } });
check('2) yaroqsiz ID: 422', r.status, 422);
const itemId = h.items[0].id;
r = await call(`/api/highlights/${h.id}/items/${itemId}`, { method: 'DELETE', cookie: cookie.other });
check('2) begona olib tashlay olmaydi: 403', r.status, 403);
r = await call(`/api/highlights/${h.id}/items/${itemId}`, { method: 'DELETE', cookie: cookie.user });
check('2) olib tashlandi', [r.status, r.body.highlight.itemCount], [200, 1]);
r = await call(`/api/highlights/${h.id}/items/${itemId}`, { method: 'DELETE', cookie: cookie.user });
check('2) ikkinchi marta: 404', r.status, 404);
r = await call(`/api/highlights/${h.id}/items`, { method: 'POST', cookie: cookie.user, json: { storyKind: 'story', storyId: s2 } });
check('2) qayta qo‘shish mumkin', r.status, 201);

// ── 3) Nom / muqova ────────────────────────────────────────────────
r = await call(`/api/highlights/${h.id}`, { method: 'PATCH', cookie: cookie.user, json: { title: 'Yangi', coverUrl: IMG1 } });
check('3) PATCH', [r.status, r.body.highlight.title, r.body.highlight.coverUrl], [200, 'Yangi', IMG1]);
r = await call(`/api/highlights/${h.id}`, { method: 'PATCH', cookie: cookie.user, json: { coverUrl: null } });
check('3) muqova olib tashlandi — birinchi rasm', r.body.highlight.coverUrl, IMG1);
r = await call(`/api/highlights/${h.id}`, { method: 'PATCH', cookie: cookie.user, json: { coverUrl: IMG3 } });
check('3) muqova — boshqa Aktualdagi rasm: 422', [r.status, r.body.error], [422, 'bad_cover']);
r = await call(`/api/highlights/${h.id}`, { method: 'PATCH', cookie: cookie.user, json: { coverUrl: '/uploads/ixtiyoriy123.jpg' } });
check('3) muqova — ixtiyoriy /uploads: 422', [r.status, r.body.error], [422, 'bad_cover']);
r = await call(`/api/highlights/${h.id}`, { method: 'PATCH', cookie: cookie.user, json: { coverUrl: IMG2 } });
check('3) muqova — o‘z elementi: 200', [r.status, r.body.highlight.coverUrl], [200, IMG2]);
{
  const it2 = r.body.highlight.items.find((i) => i.imageUrl === IMG2);
  r = await call(`/api/highlights/${h.id}/items/${it2.id}`, { method: 'DELETE', cookie: cookie.user });
  check('3) muqova elementi olib tashlandi — muqova birinchi rasmga qaytadi', r.body.highlight.coverUrl, IMG1);
  check('3) bazada muqova tozalandi', sqlite.prepare(`SELECT cover_url FROM story_highlights WHERE id = ?`).get(h.id).cover_url, null);
  r = await call(`/api/highlights/${h.id}/items`, { method: 'POST', cookie: cookie.user, json: { storyKind: 'story', storyId: s2 } });
  check('3) element qaytarildi', r.status, 201);
  sqlite.prepare(`UPDATE story_highlights SET cover_url = '/uploads/buzilgan999.jpg' WHERE id = ?`).run(h.id);
  r = await call('/api/highlights?code=VIP001');
  check('3) bazadagi begona muqova javobga chiqmaydi', r.body.highlights.find((x) => x.id === h.id).coverUrl, IMG1);
  sqlite.prepare(`UPDATE story_highlights SET cover_url = NULL WHERE id = ?`).run(h.id);
}
r = await call(`/api/highlights/${h.id}`, { method: 'PATCH', cookie: cookie.user, json: {} });
check('3) bo‘sh: 422', r.status, 422);
r = await call(`/api/highlights/${h.id}`, { method: 'PATCH', cookie: cookie.user, json: { title: 'x'.repeat(30) } });
check('3) uzun nom: 422', r.body.error, 'title_too_long');
r = await call(`/api/highlights/${h.id}`, { method: 'PATCH', cookie: cookie.other, json: { title: 'Buzildi' } });
check('3) begona: 403', r.status, 403);
r = await call('/api/highlights/999999', { method: 'PATCH', cookie: cookie.user, json: { title: 'A' } });
check('3) yo‘q: 404', r.status, 404);

// ── 4) Ommaviy ro'yxat ─────────────────────────────────────────────
r = await call('/api/highlights?code=VIP001');
check('4) mehmon ko‘radi', [r.status, r.body.canEdit, r.body.highlights.length], [200, false, 2]);
r = await call('/api/highlights?code=VIP001', { cookie: cookie.user });
check('4) egasiga canEdit', r.body.canEdit, true);
r = await call('/api/highlights?companyId=ACMEUZ');
check('4) kompaniya Aktuali', r.body.highlights.map((x) => x.title), ['Aksiya']);
r = await call('/api/highlights');
check('4) egasiz so‘rov: 422', r.status, 422);
r = await call('/api/highlights?code=NOPE99');
check('4) yo‘q profil: bo‘sh', r.body, { highlights: [], canEdit: false });

// ── 5) Istoriya muddati o'tdi — Aktual va FAYL qoladi ──────────────
// Dalil arxivi ham faylni saqlab qoladi — tekshiruv aynan Aktual
// istisnosini ko'rsatishi uchun shu bo'limda arxiv yozuvlari darhol
// o'chiriladi (trigger), Aktualga kirmagan uchinchi fayl esa o'chishi kerak.
const IMG4 = '/uploads/story_ffffffffffffffffffffffff.jpg';
await putR2(IMG4);
const s4 = await story('/api/records/VIP001/stories', IMG4);
sqlite.exec(`CREATE TRIGGER t_no_archive AFTER INSERT ON content_archive BEGIN DELETE FROM content_archive WHERE id = NEW.id; END`);
sqlite.prepare(`UPDATE stories SET expires_at = '2000-01-01T00:00:00.000Z' WHERE id IN (?, ?, ?)`).run(s1, s2, s4);
resetLimits();
// Yangi istoriya qo'shilganda eskilari o'chadi va fayli tozalanadi (`addStoryD1`).
const s3 = await story('/api/records/VIP001/stories', '/uploads/story_eeeeeeeeeeeeeeeeeeeeeeee.jpg');
checkTrue('5) yangi istoriya qo‘shildi', s3);
check('5) muddati o‘tgan istoriyalar o‘chirildi', sqlite.prepare(`SELECT COUNT(*) AS n FROM stories WHERE id IN (?, ?)`).get(s1, s2).n, 0);
r = await call('/api/highlights?code=VIP001');
const kept = r.body.highlights.find((x) => x.id === h.id);
check('5) Aktual elementlari joyida', kept.items.map((i) => i.imageUrl).sort(), [IMG1, IMG2].sort());
check('5) Aktualdagi fayllar R2 da QOLDI', [r2Has(IMG1), r2Has(IMG2)], [true, true]);
check('5) Aktualga kirmagan muddati o‘tgan istoriya fayli o‘chdi', r2Has(IMG4), false);
sqlite.exec(`DROP TRIGGER t_no_archive`);
// Egasi istoriyani O'ZI o'chirsa ham nusxa qoladi.
r = await call(`/api/stories/${sCo}`, { method: 'DELETE', cookie: cookie.user });
check('5) kompaniya istoriyasi o‘chirildi', r.status, 200);
r = await call('/api/highlights?companyId=ACMEUZ');
check('5) kompaniya Aktualida nusxa qoldi', r.body.highlights[0].itemCount, 1);

// ── 6) Ko'rinish qoidalari ─────────────────────────────────────────
await call('/api/blocks', { method: 'POST', cookie: cookie.other, json: { kind: 'record', id: 'VIP001' } });
r = await call('/api/highlights?code=VIP001', { cookie: cookie.other });
check('6) bloklagan odamga bo‘sh', r.body.highlights, []);
sqlite.prepare(`UPDATE companies SET status = 'suspended' WHERE company_id = 'ACMEUZ'`).run();
r = await call('/api/highlights?companyId=ACMEUZ');
check('6) faol bo‘lmagan kompaniya — mehmonga bo‘sh', r.body.highlights, []);
r = await call('/api/highlights?companyId=ACMEUZ', { cookie: cookie.user });
check('6) faol bo‘lmagan kompaniya — egasiga ko‘rinadi', r.body.highlights.length, 1);
sqlite.prepare(`UPDATE companies SET status = 'active' WHERE company_id = 'ACMEUZ'`).run();
sqlite.prepare(`UPDATE users SET deleted_at = '2026-10-01 00:00:00' WHERE id = 1`).run();
r = await call('/api/highlights?code=VIP001');
check('6) egasi o‘chirilgan — bo‘sh', r.body.highlights, []);
sqlite.prepare(`UPDATE users SET deleted_at = NULL WHERE id = 1`).run();

// ── 7) O'chirish ───────────────────────────────────────────────────
r = await call(`/api/highlights/${hc}`, { method: 'DELETE', cookie: cookie.other });
check('7) begona o‘chira olmaydi', r.status, 403);
r = await call(`/api/highlights/${hc}`, { method: 'DELETE', cookie: cookie.user });
check('7) egasi o‘chirdi', r.status, 200);
check('7) elementlar ham ketdi', sqlite.prepare(`SELECT COUNT(*) AS n FROM story_highlight_items WHERE highlight_id = ?`).get(hc).n, 0);
r = await call(`/api/highlights/${hc}`, { method: 'DELETE', cookie: cookie.user });
check('7) qayta: 404', r.status, 404);

// ── 9) ADMIN MODERATSIYASI Aktualni chetlab o'tmaydi (B2) ──────────
{
  // content_manager sessiyasi — manager+ talab qilinadi.
  sqlite.prepare(`INSERT INTO admin_sessions (token, admin_id, role, abs_exp, last_activity) VALUES (?, 3, 'content_manager', '2999-01-01T00:00:00.000Z', ?)`)
    .run(sha256Hex('cm-token'), new Date().toISOString());
  const cm = 'nfc_admin_session=cm-token';
  resetLimits();
  const IMG5 = '/uploads/story_555555555555555555555555.jpg';
  const IMG6 = '/uploads/story_666666666666666666666666.jpg';
  const sB = await story('/api/records/OTH222/stories', IMG5, cookie.other);
  const sB2 = await story('/api/records/OTH222/stories', IMG6, cookie.other);
  let r = await call('/api/highlights', { method: 'POST', cookie: cookie.other, json: { code: 'OTH222', title: 'B to‘plami', storyIds: [sB, sB2], coverUrl: IMG5 } });
  check('9) B Aktuali yaratildi', [r.status, r.body.highlight.itemCount], [201, 2]);
  const hB = r.body.highlight.id;

  // Shikoyat — `highlight` turi.
  r = await call('/api/reports', { method: 'POST', cookie: cookie.user, json: { targetKind: 'highlight', targetId: String(hB), reason: 'spam' } });
  check('9) Aktualga shikoyat: 201', r.status, 201);
  r = await call('/api/admin/reports', { cookie: cookie.admin });
  const rep = (r.body.reports || []).find((x) => x.targetKind === 'highlight' && String(x.targetId) === String(hB));
  check('9) admin ko‘rinishida Aktual sarlavhasi va muallifi', [rep?.preview?.text, rep?.preview?.missing, rep?.author?.code], ['B to‘plami', false, 'OTH222']);

  // Admin ISTORIYANI o'chirsa — Aktualdagi nusxasi ham ketadi, arxivga tushadi.
  r = await call(`/api/admin/content/story/${sB}`, { method: 'DELETE', cookie: cookie.admin, json: { reason: 'spam' } });
  check('9) admin istoriyani o‘chirdi', r.status, 200);
  r = await call('/api/highlights?code=OTH222');
  const hb = r.body.highlights.find((x) => x.id === hB);
  check('9) Aktualdan o‘sha istoriya nusxasi ketdi', hb.items.map((i) => i.storyId), [sB2]);
  check('9) muqova (o‘chirilgan rasm) ko‘rinmaydi', hb.coverUrl, IMG6);
  const arch = sqlite.prepare(`SELECT owner_kind, owner_id, image_url, deleted_by_admin FROM content_archive WHERE kind = 'highlight_item' ORDER BY id DESC`).get();
  check('9) Aktual nusxasi dalil arxivida', [arch?.owner_kind, arch?.owner_id, arch?.image_url, String(arch?.deleted_by_admin || '').startsWith('admin#')], ['card', 'OTH222', IMG5, true]);

  // company_story yo'li ham ishlaydi.
  const sCo2 = await story('/api/companies/ACMEUZ/stories', '/uploads/story_777777777777777777777777.jpg');
  r = await call('/api/highlights', { method: 'POST', cookie: cookie.user, json: { companyId: 'ACMEUZ', title: 'Biz', storyIds: [sCo2] } });
  const hCo = r.body.highlight.id;
  r = await call(`/api/admin/content/company_story/${sCo2}`, { method: 'DELETE', cookie: cookie.admin, json: { reason: 'spam' } });
  check('9) /api/admin/content/company_story/:id ishlaydi', r.status, 200);
  check('9) kompaniya Aktualidan ham ketdi', sqlite.prepare(`SELECT COUNT(*) AS n FROM story_highlight_items WHERE highlight_id = ?`).get(hCo).n, 0);

  // Bitta elementni olib tashlash.
  const itemB2 = sqlite.prepare(`SELECT id FROM story_highlight_items WHERE highlight_id = ? AND story_id = ?`).get(hB, sB2).id;
  const delItem = (ck, json) => call(`/api/admin/highlights/${hB}/items/${itemB2}`, { method: 'DELETE', cookie: ck, json });
  check('9) element: kirmagan foydalanuvchi — 401', (await delItem(cookie.user, { reason: 'x' })).status, 401);
  check('9) element: content_manager — 403', (await delItem(cm, { reason: 'x' })).status, 403);
  check('9) element: sababsiz — 422', (await delItem(cookie.manager, {})).body?.error, 'reason_required');
  r = await delItem(cookie.manager, { reason: 'qoidabuzarlik' });
  check('9) element: manager sabab bilan — ok', r.body, { ok: true });
  check('9) element bazadan ketdi', sqlite.prepare(`SELECT COUNT(*) AS n FROM story_highlight_items WHERE id = ?`).get(itemB2).n, 0);
  check('9) element arxivda', sqlite.prepare(`SELECT COUNT(*) AS n FROM content_archive WHERE kind = 'highlight_item' AND content_id = ?`).get(itemB2).n, 1);
  check('9) qayta: alreadyGone', (await delItem(cookie.manager, { reason: 'x' })).body, { ok: true, alreadyGone: true });
  check('9) GET: 405', (await call(`/api/admin/highlights/${hB}`, { cookie: cookie.admin })).status, 405);

  // Butun Aktualni olib tashlash.
  r = await call(`/api/highlights/${hB}/items`, { method: 'POST', cookie: cookie.other, json: { storyKind: 'story', storyId: await story('/api/records/OTH222/stories', IMG6, cookie.other) } });
  check('9) yana element qo‘shildi', r.status, 201);
  r = await call(`/api/admin/highlights/${hB}`, { method: 'DELETE', cookie: cookie.manager, json: {} });
  check('9) butun Aktual: sababsiz 422', r.status, 422);
  r = await call(`/api/admin/highlights/${hB}`, { method: 'DELETE', cookie: cookie.manager, json: { reason: 'qoidabuzarlik' } });
  check('9) butun Aktual: ok', r.body, { ok: true });
  check('9) Aktual va elementlari ketdi', [
    sqlite.prepare(`SELECT COUNT(*) AS n FROM story_highlights WHERE id = ?`).get(hB).n,
    sqlite.prepare(`SELECT COUNT(*) AS n FROM story_highlight_items WHERE highlight_id = ?`).get(hB).n,
  ], [0, 0]);
  check('9) arxivda Aktualning o‘zi (sarlavha)', sqlite.prepare(`SELECT body FROM content_archive WHERE kind = 'highlight' AND content_id = ?`).get(hB)?.body, 'B to‘plami');
  check('9) shikoyat yopildi', sqlite.prepare(`SELECT status FROM content_reports WHERE target_kind = 'highlight' AND target_id = ?`).get(String(hB))?.status, 'resolved');
  r = await call('/api/highlights?code=OTH222');
  checkTrue('9) ommaga ko‘rinmaydi', !r.body.highlights.some((x) => x.id === hB));
}

// ── 8) Karta o'chirilganda Aktual ham ketadi ───────────────────────
r = await call('/api/account/records/VIP001', { method: 'DELETE', cookie: cookie.user });
if (r.status === 404) r = await call('/api/records/VIP001', { method: 'DELETE', cookie: cookie.user });
checkTrue(`8) karta o‘chirildi (${r.status})`, r.status === 200);
check('8) VIP001 Aktuallari ketdi', sqlite.prepare(`SELECT COUNT(*) AS n FROM story_highlights WHERE owner_kind = 'card' AND owner_id = 'VIP001'`).get().n, 0);
check('8) elementlari ham', sqlite.prepare(`SELECT COUNT(*) AS n FROM story_highlight_items WHERE highlight_id = ?`).get(h.id).n, 0);

done();
