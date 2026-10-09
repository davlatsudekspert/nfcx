// ADMIN PREMIUM BERADI / OLADI — POST /api/admin/users/:id/premium.
//   node scripts/test-admin-premium-grant.mjs
//
// Tekshiriladi: 1/3/6/12 oy (oy = 30 kun, to'lov bilan bir xil) —
// max(hozir, joriy muddat) ustiga; olib tashlash muddatni "hozir" qiladi;
// eski MUDDATSIZ Premium (is_premium=1) tegilmaydi (409); izoh majburiy;
// rollar (content_manager 403); har amal admin jurnalida.
// Production'ga HECH QACHON tegmaydi.
import worker, { ensureCoreSchema } from '../hosting/worker.js';
import { makeEnv, seedBasic, req, cookie, makeChecker, sha256Hex } from './lib/d1-harness.mjs';

const { check, checkTrue, done } = makeChecker();
const { env, sqlite } = makeEnv();
await ensureCoreSchema(env);
await seedBasic(env);
sqlite.prepare(`INSERT INTO admin_sessions (token, admin_id, role, abs_exp, last_activity) VALUES (?, 3, 'content_manager', '2999-01-01T00:00:00.000Z', ?)`)
  .run(sha256Hex('content-token'), new Date().toISOString());
const contentCookie = 'nfc_admin_session=content-token';

const DAY = 86_400_000;
const call = async (path, init = {}) => {
  const res = await worker.fetch(req(path, init), env);
  return { status: res.status, body: await res.json().catch(() => null) };
};
const grant = (id, json, who = cookie.admin) => call(`/api/admin/users/${id}/premium`, { method: 'POST', cookie: who, json });
const until = (id) => sqlite.prepare(`SELECT premium_expires_at AS p FROM users WHERE id = ?`).get(id).p;
const daysLeft = (id) => (Date.parse(until(id)) - Date.now()) / DAY;
const near = (a, b) => Math.abs(a - b) < 0.05;

// ── Tekshiruvlar ──
check('cookie‘siz — 401', (await call('/api/admin/users/1/premium', { method: 'POST', json: { months: 1, note: 'x' } })).status, 401);
check('content_manager — 403', (await grant(1, { months: 1, note: 'x' }, contentCookie)).status, 403);
check('izohsiz — 422', (await grant(1, { months: 1, note: ' ' })).body, { error: 'note_required' });
check('noto‘g‘ri oy — 422', (await grant(1, { months: 2, note: 'x' })).body, { error: 'bad_months' });
check('yo‘q foydalanuvchi — 404', (await grant(999, { months: 1, note: 'x' })).status, 404);

// ── Berish va uzaytirish ──
{
  const r = await grant(1, { months: 1, note: 'Hamkor, sinov uchun' }, cookie.manager);
  check('manager 1 oy berdi', [r.status, r.body.ok, r.body.revoked], [200, true, false]);
  checkTrue(`~30 kun (${daysLeft(1).toFixed(2)})`, near(daysLeft(1), 30));
  const me = await call('/api/admin/users?q=user@test', { cookie: cookie.admin });
  check('ro‘yxatda Premium', me.body.users[0].premium, true);
  await grant(1, { months: 3, note: 'Uzaytirish' });
  checkTrue(`joriy muddat USTIGA: ~120 kun (${daysLeft(1).toFixed(2)})`, near(daysLeft(1), 120));
}
{
  // Muddati o'tib ketgan — bugundan hisoblanadi.
  sqlite.prepare(`UPDATE users SET premium_expires_at = ? WHERE id = 2`).run(new Date(Date.now() - 10 * DAY).toISOString());
  await grant(2, { months: 12, note: 'Yillik' });
  checkTrue(`tugagan muddat — bugundan 360 kun (${daysLeft(2).toFixed(2)})`, near(daysLeft(2), 360));
  await grant(2, { months: 6, note: '+6' });
  checkTrue('6 oy qo‘shildi (~540)', near(daysLeft(2), 540));
}

// ── Olib tashlash ──
{
  const r = await grant(1, { action: 'revoke', note: 'Xato berilgan' });
  check('olib tashlandi', [r.status, r.body.revoked], [200, true]);
  checkTrue('muddat — hozir (o‘tmishda yoki shu soniya)', Date.parse(until(1)) <= Date.now());
  const me = await call('/api/admin/users?q=user@test', { cookie: cookie.admin });
  check('ro‘yxatda Premium yo‘q', me.body.users[0].premium, false);
  check('olishda ham izoh shart', (await grant(2, { action: 'revoke' })).status, 422);
}

// ── Muddatsiz (eski) Premium ──
{
  sqlite.prepare(`UPDATE users SET is_premium = 1, premium_expires_at = NULL WHERE id = 2`).run();
  check('muddatsizni olib bo‘lmaydi — 409', (await grant(2, { action: 'revoke', note: 'x' })).body, { error: 'lifetime_premium' });
  check('muddatsizga berish ham 409', (await grant(2, { months: 1, note: 'x' })).status, 409);
  check('muddatsiz tegilmadi', sqlite.prepare(`SELECT is_premium, premium_expires_at FROM users WHERE id = 2`).get(), { is_premium: 1, premium_expires_at: null });
}

// ── Jurnal ──
{
  const rows = sqlite.prepare(`SELECT action, details, new_value FROM admin_activity_log WHERE action LIKE 'user_premium_%' ORDER BY id`).all();
  check('jurnal: 4 berish, 1 olish', [rows.filter((r) => r.action === 'user_premium_grant').length, rows.filter((r) => r.action === 'user_premium_revoke').length], [4, 1]);
  checkTrue('jurnalda izoh va admin', rows.some((r) => /Hamkor, sinov uchun/.test(r.new_value) && /admin#2/.test(r.details)));
}

done('Admin Premium berish');
