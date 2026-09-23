// ILOVA FOYDALANUVCHILARI — hosting/api/app-usage.js.
//   node scripts/test-app-usage.mjs
//
// Haqiqiy worker.fetch + in-memory D1 (scripts/lib/d1-harness.mjs).
// Ilova har ochilishda `/api/auth/me` ni `x-app: nova` bilan chaqiradi —
// shu sanaladi. Saytdan kirish va mehmon sanalmaydi.
import worker from '../hosting/worker.js';
import { makeEnv, seedBasic, cookie, req, makeChecker } from './lib/d1-harness.mjs';

const { check, checkTrue, done } = makeChecker();
const { env, sqlite } = makeEnv();
await seedBasic(env);

const call = async (pathname, init = {}) => {
  const res = await worker.fetch(req(pathname, init), env);
  return { status: res.status, body: await res.json().catch(() => null) };
};
const APP = { 'x-app': 'nova', 'x-client': 'android' };
const count = () => sqlite.prepare(`SELECT COUNT(*) AS n FROM app_users`).get()?.n ?? 0;

// ═══ 1. Kim sanaladi ═══
await call('/api/auth/me', { cookie: cookie.user }); // sayt — sanalmaydi
await call('/api/auth/me', { headers: APP });        // mehmon — sanalmaydi
check('1) sayt va mehmon sanalmadi', await call('/api/admin/app-users', { cookie: cookie.admin }).then((r) => r.body.stats.total), 0);

check('1) ilovadan /me ishlaydi', (await call('/api/auth/me', { cookie: cookie.user, headers: APP })).status, 200);
await call('/api/auth/me', { cookie: cookie.user, headers: APP });
await call('/api/auth/me', { cookie: cookie.other, headers: APP });
check('1) ikki odam sanaldi', count(), 2);
const u1 = sqlite.prepare(`SELECT opens, platform FROM app_users WHERE user_id = 1`).get();
check('1) ochilishlar soni va platforma', [u1.opens, u1.platform], [2, 'android']);

// ═══ 2. Admin ro'yxati ═══
check('2) mehmon kira olmaydi', (await call('/api/admin/app-users')).status, 401);
check('2) oddiy foydalanuvchi kira olmaydi', (await call('/api/admin/app-users', { cookie: cookie.user })).status, 401);
sqlite.prepare(`UPDATE app_users SET last_seen = ? WHERE user_id = 2`).run(new Date(Date.now() - 10 * 86_400_000).toISOString());
const r = await call('/api/admin/app-users', { cookie: cookie.admin });
check('2) statistika: jami, bugun, 7 kun, 30 kun', r.body.stats, { total: 2, today: 1, week: 1, month: 2 });
const me = r.body.items.find((i) => i.userId === 1);
check('2) email, telefon, ochilishlar', [me.email, me.phone, me.opens], ['user@test.local', '+998901111111', 2]);
check('2) profillari (NFC ID)', me.profiles.map((p) => p.code).sort(), ['BIZ777', 'VIP001']);
check('2) oxirgi ochilgan — birinchi', r.body.items.map((i) => i.userId), [1, 2]);

// ═══ 3. Qidiruv ═══
check('3) NFC ID bo‘yicha', (await call('/api/admin/app-users?q=oth222', { cookie: cookie.admin })).body.items.map((i) => i.userId), [2]);
check('3) email bo‘yicha', (await call('/api/admin/app-users?q=USER@test.local', { cookie: cookie.admin })).body.items.map((i) => i.userId), [1]);
check('3) topilmasa bo‘sh', (await call('/api/admin/app-users?q=yoq', { cookie: cookie.admin })).body.items, []);
checkTrue('3) statistika qidiruvdan qat’i nazar umumiy', (await call('/api/admin/app-users?q=yoq', { cookie: cookie.admin })).body.stats.total === 2);

// ===== 4) QISMAN VA ISM BO'YICHA QIDIRUV (egasi, 2026-09-23) =====
const ids = async (q) => (await call(`/api/admin/app-users?${q}`, { cookie: cookie.admin })).body.items.map((i) => i.userId);
check('4) email qismi', await ids('q=other'), [2]);
check('4) profil ismi (katta-kichik harfsiz)', await ids('q=muham'), [1]);
check('4) ikki so\'zli ism qismi', await ids('q=elite%20qur'), [1]);
check('4) telefon qismi', await ids('q=2222222'), [2]);
check('4) % belgisi hammani qaytarmaydi', await ids('q=%25'), []);
await env.DB.prepare(`UPDATE users SET is_premium = 1 WHERE id = 2`).run();
check('4) filtr: faqat Premium', await ids('filter=premium'), [2]);

done();
