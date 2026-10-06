// ADMIN AUDIT (2026-10) — serverda sahifalash/filtrlar, niqoblash, ruxsatlar.
//   node scripts/test-admin-audit.mjs
//   UZ_ADAPTER_TEST=1 node scripts/test-admin-audit.mjs   (sqld adapteri)
//
// Tekshiriladi:
//   * /api/admin/users — holat filtri serverda (premium/flagged/blocked/deleted),
//     `limit` + `hasMore`, content_manager uchun email/telefon niqoblangan;
//   * /api/admin/premium-users — `limit` + `hasMore`, Apple obunasi belgisi/soni;
//   * /api/admin/activity-log — `q`, `limit` + `hasMore`, faqat super_admin;
//   * /api/admin/physical-cards — `chipToken` YO'Q (faqat `tokenTail`), niqoblash, `hasMore`;
//   * /api/admin/featured — `limit` + `hasMore`;
//   * /api/admin/app-users — sanoqda test/ichki/o'chirilgan yo'q; Premium belgisi filtr bilan bir xil;
//   * /api/admin/review-account — `userId` qaytadi;
//   * UI (manba matni): ruxsatsiz boshqaruvlar yashirilgan, shikoyatdan company_story/highlight
//     o'chiriladi, window.confirm/prompt/alert yo'q, overview so'rovi bo'lim almashganda qaytarilmaydi.
// Production'ga HECH QACHON tegmaydi.
import { readFileSync } from 'node:fs';
import { setupSocial, cookie, makeChecker } from './lib/social-fixture.mjs';
import { sha256Hex } from './lib/d1-harness.mjs';

const { check, checkTrue, done } = makeChecker();
const { sqlite, call } = await setupSocial();
sqlite.prepare(`INSERT INTO admin_sessions (token, admin_id, role, abs_exp, last_activity) VALUES (?, 3, 'content_manager', '2999-01-01T00:00:00.000Z', ?)`)
  .run(sha256Hex('content-token'), new Date().toISOString());
const content = 'nfc_admin_session=content-token';
const DAY = 86_400_000;
const NOW = Date.now();
const iso = (ms) => new Date(ms).toISOString();

// Qo'shimcha foydalanuvchilar: 3..62 (60 ta) — har xil holatda.
const ins = sqlite.prepare(`INSERT INTO users (id, email, password_hash, phone, created_at, is_test, is_internal, suspended_until, deleted_at) VALUES (?, ?, 'x', ?, ?, ?, ?, ?, ?)`);
for (let i = 3; i <= 62; i++) {
  ins.run(i, `u${i}@test.local`, `+9989000${String(i).padStart(5, '0')}`, iso(NOW - i * 60_000),
    i % 10 === 0 ? 1 : 0, i === 11 ? 1 : 0, i % 7 === 0 ? iso(NOW + DAY) : null, i % 13 === 0 ? iso(NOW - DAY) : null);
}
await call('/api/admin/users?limit=20', { cookie: cookie.admin }); // trial ustunlari (ensureCoreSchema)
sqlite.prepare(`UPDATE users SET premium_expires_at = ? WHERE id IN (5, 6, 7)`).run(iso(NOW + 10 * DAY));

const users = (qs, who = cookie.admin) => call(`/api/admin/users?${qs}`, { cookie: who });

// ═══ 1. Foydalanuvchilar ═══
{
  const p = (await users('limit=20')).body;
  check('1) limit 20 + hasMore', [p.users.length, p.hasMore], [20, true]);
  const all = (await users('limit=500')).body;
  check('1) hammasi sig‘sa — hasMore:false', all.hasMore, false);
  const ids = async (st) => (await users(`limit=500&status=${st}`)).body.users.map((u) => u.id).sort((a, b) => a - b);
  check('1) status=premium', await ids('premium'), [5, 6, 7]);
  const flagged = await ids('flagged');
  checkTrue('1) status=flagged — faqat test/ichki', flagged.length > 0 && flagged.every((id) => id % 10 === 0 || id === 11));
  const blocked = await ids('blocked');
  checkTrue('1) status=blocked — faqat bloklangan va o‘chirilmagan', blocked.length > 0 && blocked.every((id) => id % 7 === 0 && id % 13 !== 0));
  const deleted = await ids('deleted');
  check('1) status=deleted', deleted, [13, 26, 39, 52]);
  check('1) noma’lum status — hammasi', (await users('limit=500&status=xyz')).body.users.length, all.users.length);
  const cm = (await users('limit=500', content)).body.users.find((u) => u.id === 5);
  check('1) content_manager — email/telefon niqoblangan', [cm.email, cm.phone], ['u***@test.local', '***0005']);
  const mgr = (await users('limit=500', cookie.manager)).body.users.find((u) => u.id === 5);
  check('1) manager — ochiq', mgr.email, 'u5@test.local');
}

// ═══ 2. Premium obunachilar ═══
{
  sqlite.prepare(`UPDATE users SET premium_expires_at = ? WHERE id BETWEEN 20 AND 40`).run(iso(NOW + 5 * DAY));
  const p = (await call('/api/admin/premium-users?filter=active&limit=10', { cookie: cookie.admin })).body;
  check('2) limit 10 + hasMore', [p.users.length, p.hasMore], [10, true]);
  check('2) Apple sanog‘i (jadval yo‘q — 0)', p.apple, { active: 0, sandbox: 0 });
  checkTrue('2) har qatorda apple maydoni', p.users.every((u) => 'apple' in u));
}

// ═══ 3. Amallar jurnali ═══
{
  const log = sqlite.prepare(`INSERT INTO admin_activity_log (action, details, created_at) VALUES (?, ?, ?)`);
  for (let i = 0; i < 30; i++) log.run(i % 2 ? 'user_suspended' : 'featured_pricing_set', `tafsilot ${i}`, iso(NOW - i * 1000));
  check('3) manager — 403', (await call('/api/admin/activity-log', { cookie: cookie.manager })).status, 403);
  const p = (await call('/api/admin/activity-log?limit=10', { cookie: cookie.admin })).body;
  check('3) limit + hasMore', [p.log.length, p.hasMore], [10, true]);
  const q = (await call('/api/admin/activity-log?limit=100&q=pricing', { cookie: cookie.admin })).body.log;
  checkTrue('3) q — faqat mos amallar', q.length >= 15 && q.every((r) => r.action === 'featured_pricing_set'));
}

// ═══ 4. Jismoniy kartalar ═══
{
  const pc = sqlite.prepare(`INSERT INTO physical_cards (chip_token, linked_code, owner_user_id, shipping_name, shipping_phone, status) VALUES (?, 'VIP001', 1, 'Ism', '+998901234567', 'pending')`);
  for (let i = 0; i < 5; i++) pc.run(`SECRETTOKEN${i}AB`);
  const r = (await call('/api/admin/physical-cards?limit=3', { cookie: cookie.admin })).body;
  check('4) limit + hasMore', [r.cards.length, r.hasMore], [3, true]);
  checkTrue('4) chipToken yo‘q, faqat tokenTail', r.cards.every((c) => !('chipToken' in c) && /^[A-Z0-9]{4}$/.test(c.tokenTail)));
  checkTrue('4) to‘liq token javobda yo‘q', !JSON.stringify(r).includes('SECRETTOKEN'));
  const cm = (await call('/api/admin/physical-cards', { cookie: content })).body.cards[0];
  check('4) content_manager — niqoblangan', [cm.ownerEmail, cm.shippingPhone], ['u***@test.local', '***4567']);
}

// ═══ 5. FEATURED ro'yxati ═══
{
  await call('/api/featured/packages'); // featured_slots jadvali
  const fs = sqlite.prepare(`INSERT INTO featured_slots (user_id, target_kind, target_id, code, days, price, status, created_at) VALUES (1, 'post', ?, 'VIP001', 1, 1000, 'cancelled', ?)`);
  for (let i = 0; i < 7; i++) fs.run(100 + i, iso(NOW - i * 1000));
  const r = (await call('/api/admin/featured?state=cancelled&limit=5', { cookie: cookie.admin })).body;
  check('5) limit + hasMore + cancelled filtri', [r.slots.length, r.hasMore, r.slots.every((s) => s.status === 'cancelled')], [5, true, true]);
}

// ═══ 6. Ilova foydalanuvchilari ═══
{
  const me = (ck, build) => call('/api/auth/me', { cookie: ck, headers: { 'x-app': 'nova', 'x-client': 'ios', 'x-app-build': build } });
  await me(cookie.user, '10');
  await me(cookie.other, '11');
  sqlite.prepare(`UPDATE users SET is_test = 1 WHERE id = 2`).run();
  sqlite.prepare(`UPDATE users SET premium_expires_at = ? WHERE id = 1`).run(iso(NOW + DAY));
  const r = (await call('/api/admin/app-users', { cookie: cookie.admin })).body;
  check('6) sanoqda test hisob yo‘q', r.stats.total, 1);
  check('6) Premium belgisi = filtr ifodasi', r.items.find((x) => x.userId === 1)?.premium, true);
  const f = (await call('/api/admin/app-users?filter=premium', { cookie: cookie.admin })).body.items.map((x) => x.userId);
  check('6) premium filtri', f, [1]);
  sqlite.prepare(`UPDATE users SET is_test = 0 WHERE id = 2`).run();
}

// ═══ 7. Tekshiruvchi hisobi — userId ═══
{
  const r = await call('/api/admin/review-account', { method: 'POST', cookie: cookie.admin });
  checkTrue('7) review-account userId', r.status === 200 && Number.isInteger(r.body.userId) && r.body.userId > 0);
  check('7) manager — 403', (await call('/api/admin/review-account', { method: 'POST', cookie: cookie.manager })).status, 403);
}

// ═══ 9. content_manager — shaxsiy ma'lumot hamma joyda niqoblangan (ko'rik F4) ═══
{
  const fullEmail = /u\d+@test\.local|user@test\.local|other@test\.local/;
  const fullPhone = /\+998\d{9}/;
  const leaks = (body) => fullEmail.test(JSON.stringify(body)) || fullPhone.test(JSON.stringify(body));
  // Qidiruv: email/telefon bo'yicha — yo'q; NFC ID bo'yicha — bor.
  check('9) users q=email — content_manager topolmaydi', (await users('limit=500&q=u5@test', content)).body.users.length, 0);
  check('9) users q=telefon — content_manager topolmaydi', (await users('limit=500&q=900000005', content)).body.users.length, 0);
  checkTrue('9) users q=email — manager topadi', (await users('limit=500&q=u5@test', cookie.manager)).body.users.some((u) => u.id === 5));
  checkTrue('9) users q=NFC ID — content_manager topadi', (await users('limit=500&q=vip001', content)).body.users.some((u) => u.id === 1));
  // Foydalanuvchi kartochkasi.
  const d = (await call('/api/admin/users/5/detail', { cookie: content })).body;
  check('9) detail — niqoblangan, apple yo‘q', [d.user.email, d.user.phone, d.apple], ['u***@test.local', '***0005', null]);
  check('9) detail — manager ochiq', (await call('/api/admin/users/5/detail', { cookie: cookie.manager })).body.user.email, 'u5@test.local');
  // Premium obunachilar.
  const pu = (await call('/api/admin/premium-users?filter=all&limit=500', { cookie: content })).body;
  checkTrue(`9) premium-users — sizib chiqmaydi (${pu.users.length})`, pu.users.length > 0 && !leaks(pu));
  check('9) premium-users q=email — content_manager topolmaydi', (await call('/api/admin/premium-users?filter=all&q=u20@', { cookie: content })).body.users.length, 0);
  checkTrue('9) premium-users — manager ochiq', (await call('/api/admin/premium-users?filter=all&limit=500', { cookie: cookie.manager })).body.users.some((u) => u.email === 'u20@test.local'));
  // Bosh sahifa (yangi ro'yxatdan o'tganlar / to'lovlar).
  const ov = (await call('/api/admin/overview', { cookie: content })).body;
  checkTrue(`9) overview — signups bor, email niqoblangan`, (ov.recent?.signups || []).length > 0 && !leaks(ov.recent));
  // Takliflar.
  sqlite.prepare(`INSERT INTO referral_uses (referrer_id, referred_id, created_at) VALUES (1, 5, ?)`).run(iso(NOW));
  const rf = (await call('/api/admin/referrals', { cookie: content })).body.referrals;
  check('9) /api/admin/referrals — niqoblangan', rf.map((r) => [r.referrerEmail, r.referredEmail])[0], ['u***@test.local', 'u***@test.local']);
  check('9) /api/admin/referrals — manager ochiq', (await call('/api/admin/referrals', { cookie: cookie.manager })).body.referrals[0].referredEmail, 'u5@test.local');
  // Ilova foydalanuvchilari.
  const au = (await call('/api/admin/app-users', { cookie: content })).body;
  checkTrue(`9) app-users — niqoblangan (${au.items.length})`, au.items.length > 0 && !leaks(au.items));
  check('9) app-users q=email — content_manager topolmaydi', (await call('/api/admin/app-users?q=user@test', { cookie: content })).body.items.length, 0);
  checkTrue('9) app-users q=email — manager topadi', (await call('/api/admin/app-users?q=user@test', { cookie: cookie.manager })).body.items.length > 0);
  // Jismoniy kartalar: ism va manzil ham.
  sqlite.prepare(`UPDATE physical_cards SET shipping_address = 'Toshkent, Chilonzor 5'`).run();
  const pc = (await call('/api/admin/physical-cards', { cookie: content })).body.cards[0];
  check('9) physical-cards — ism/manzil niqoblangan', [pc.shippingName, pc.shippingAddress], ['I***', 'T***']);
  const pm = (await call('/api/admin/physical-cards', { cookie: cookie.manager })).body.cards[0];
  check('9) physical-cards — manager ochiq', [pm.shippingName, pm.shippingAddress], ['Ism', 'Toshkent, Chilonzor 5']);
}

// ═══ 8. UI (manba matni) ═══
{
  const admin = readFileSync(new URL('../src/pages/AdminPage.jsx', import.meta.url), 'utf8');
  const nova = readFileSync(new URL('../src/components/admin/NovaTab.jsx', import.meta.url), 'utf8');
  checkTrue('8) shikoyat: company_story va highlight o‘chiriladi', /REPORT_DELETABLE = \['post', 'story', 'company_post', 'company_story', 'comment', 'highlight'(, 'media')?\]/.test(admin)
    && /adminApi\(`\/highlights\/\$\{encodeURIComponent\(r\.targetId\)\}`/.test(admin));
  checkTrue('8) Namuna bizneslar va Apple — managerOnly', /index: 26, label: 'Namuna bizneslar'[^}]*managerOnly: true/.test(admin) && /index: 27, label: 'Apple \/ iOS'[^}]*managerOnly: true/.test(admin));
  checkTrue('8) nav filtri managerOnly ni hisobga oladi', /!n\.managerOnly \|\| isManager/.test(admin));
  checkTrue('8) o‘chirish navbati va tekshiruvchi hisobi — faqat super', /key !== 'deletions' \|\| isSuper/.test(nova) && /isSuper && <ReviewAccountCard/.test(nova) && /isSuper && <DeletionsSection/.test(nova));
  checkTrue('8) sotuv rejimi va narxlar — super; qo‘lda ko‘tarish — manager', /isSuper && <SalesControl/.test(nova) && /isSuper && <PricingEditor/.test(nova) && /isManager && <GrantForm/.test(nova));
  checkTrue('8) window.confirm/prompt/alert yo‘q (NovaTab)', !/window\.(confirm|prompt|alert)\(/.test(nova));
  checkTrue('8) AdminPage’da bare confirm( yo‘q', !/[^.\w]confirm\(t\(/.test(admin));
  checkTrue('8) overview so‘rovi bo‘lim almashganda qaytarilmaydi', /clearInterval\(id\); \};\n\s*\/\/[^\n]*\n\s*\}, \[\]\);/.test(admin));
  checkTrue('8) yorug‘ rejim: white/* va text-red-400 yo‘q', !/white\/|text-red-400/.test(admin) && !/text-red-400/.test(nova));
}

done('Admin audit');
