// BEPUL SINOV: ADMIN FILTRI, "TUGAYAPTI" ESLATMASI VA AKSIYA MUDDATI.
//   node scripts/test-trial-reminders.mjs
//   UZ_ADAPTER_TEST=1 node scripts/test-trial-reminders.mjs
//
// Tekshiriladi:
//   1) `/api/admin/users?plan=premium|trial|trial_expired|free` — serverda,
//      faqat ruxsat etilgan qiymatlar; `trialUntil` maydoni;
//   2) kunlik cron (`scheduled`) sinovi 3 kun ichida tugaydigan, Premium'siz,
//      o'chirilmagan odamga BITTA `trial_ending` yaratadi: Premium, tugagan,
//      uzoq va o'chirilganlarga — yo'q; ikkinchi ishga tushishda takror yo'q;
//      muddat o'zgarsa (yangi sana) — yangi eslatma;
//   3) `/api/notifications` dagi shakl: type, targetType 'trial',
//      targetId 'YYYY-MM-DD' (Toshkent sanasi), aktyor yo'q;
//   4) aksiya: 2026-12-31 23:59:59 Toshkent (18:59:59Z) gacha 90 kun, keyin 30.
// Production'ga HECH QACHON tegmaydi.
import worker, { ensureCoreSchema, trialDaysForD1, trialEndsAtD1, TRIAL_DAYS_LAUNCH, TRIAL_DAYS_DEFAULT, LAUNCH_PROMO_UNTIL } from '../hosting/worker.js';
import { runTrialEndingReminders } from '../hosting/api/notifications.js';
import { makeEnv, seedBasic, req, cookie, makeChecker } from './lib/d1-harness.mjs';

const { check, checkTrue, done } = makeChecker();
const { env, sqlite } = makeEnv();
await ensureCoreSchema(env);
await seedBasic(env);

const DAY = 86_400_000;
const now = Date.now();
const iso = (ms) => new Date(ms).toISOString();
const call = async (path, init = {}) => {
  const res = await worker.fetch(req(path, init), env);
  return { status: res.status, body: await res.json().catch(() => null) };
};
// Toshkent sanasi (UTC+5) — server ham shunday yozadi.
const tashkentDate = (ms) => new Date(ms + 5 * 3600_000).toISOString().slice(0, 10);

const add = sqlite.prepare(`INSERT INTO users (id, email, password_hash, phone, is_premium, premium_expires_at, trial_expires_at, deleted_at)
  VALUES (?, ?, 'x', NULL, ?, ?, ?, ?)`);
add.run(3, 'ending@x.uz', 0, null, iso(now + 2 * DAY), null);           // eslatma OLADI
add.run(4, 'paid@x.uz', 0, iso(now + 20 * DAY), iso(now + 2 * DAY), null); // Premium — yo'q
add.run(5, 'expired@x.uz', 0, null, iso(now - DAY), null);              // tugagan — yo'q
add.run(6, 'far@x.uz', 0, null, iso(now + 10 * DAY), null);             // uzoq — yo'q
add.run(7, 'lifetime@x.uz', 1, null, iso(now + DAY), null);             // muddatsiz Premium — yo'q
add.run(8, 'gone@x.uz', 0, null, iso(now + DAY), '2026-10-01 00:00:00'); // o'chirilgan — yo'q
add.run(9, 'oldpaid@x.uz', 0, iso(now - 5 * DAY), iso(now - 40 * DAY), null); // Premium tugagan, sinov ham
// user#1, #2 — sinov maydoni NULL (eski hisob, "Oddiy").
sqlite.prepare(`INSERT INTO sessions (token, user_id, expires_at) VALUES ('t3', 3, '2999-01-01T00:00:00.000Z')`).run();

// ═══ 1. Admin filtri ═══
{
  const ids = async (plan) => {
    const r = await call(`/api/admin/users?limit=100${plan ? `&plan=${plan}` : ''}`, { cookie: cookie.admin });
    return { status: r.status, ids: (r.body?.users || []).map((u) => u.id).sort((a, b) => a - b), body: r.body };
  };
  check('1) premium', (await ids('premium')).ids, [4, 7]);
  check('1) bepul sinovda', (await ids('trial')).ids, [3, 6, 8]);
  check('1) sinov tugagan', (await ids('trial_expired')).ids, [5, 9]);
  check('1) oddiy (premium ham, faol sinov ham yo‘q)', (await ids('free')).ids, [1, 2, 5, 9]);
  check('1) noto‘g‘ri qiymat — e’tiborsiz (hammasi)', (await ids('DROP TABLE')).ids, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const all = (await ids('')).body;
  check('1) javobda plan', [all.plan, (await ids('trial')).body.plan], ['', 'trial']);
  const u3 = all.users.find((u) => u.id === 3);
  check('1) trialUntil va trial', [u3.trialUntil, u3.trial], [iso(now + 2 * DAY), true]);
  check('1) eski hisob — trialUntil null', all.users.find((u) => u.id === 1).trialUntil, null);
  check('1) qidiruv + filtr birga', (await call('/api/admin/users?q=far@&plan=trial', { cookie: cookie.admin })).body.users.map((u) => u.id), [6]);
  check('1) cookie‘siz — 401', (await call('/api/admin/users?plan=trial')).status, 401);
}

// ═══ 2. Kunlik cron ═══
{
  const jobs = [];
  await worker.scheduled({ cron: '30 21 * * *', scheduledTime: now }, env, { waitUntil: (p) => jobs.push(p) });
  await Promise.all(jobs);
  const rows = () => sqlite.prepare(`SELECT recipient_user_id AS u, actor_user_id AS a, target_type AS tt, target_id AS ti
    FROM notifications WHERE kind = 'trial_ending' ORDER BY recipient_user_id, id`).all();
  check('2) faqat user#3 — bitta', rows().map((r) => [r.u, r.a, r.tt, r.ti]), [[3, null, 'trial', tashkentDate(now + 2 * DAY)]]);
  const again = await runTrialEndingReminders(env, { now });
  check('2) ikkinchi marta — takror yo‘q', [again.created, rows().length], [0, 1]);
  // Muddat o'zgardi (masalan uzaytirildi) — yangi sana, yangi eslatma.
  sqlite.prepare(`UPDATE users SET trial_expires_at = ? WHERE id = 3`).run(iso(now + DAY));
  const moved = await runTrialEndingReminders(env, { now });
  check('2) yangi sana — yangi eslatma', [moved.created, rows().length], [1, 2]);
  // Chegara: LIMIT
  sqlite.prepare(`UPDATE users SET trial_expires_at = ? WHERE id = 6`).run(iso(now + DAY));
  sqlite.prepare(`UPDATE users SET premium_expires_at = NULL, trial_expires_at = ? WHERE id = 4`).run(iso(now + DAY));
  check('2) limit=1 — bir ishga tushishda ko‘pi bilan 1', (await runTrialEndingReminders(env, { now, limit: 1 })).created, 1);
  check('2) qolgani keyingi safar', (await runTrialEndingReminders(env, { now })).created, 1);
  // Xato otmaydi (jadval yo'q baza).
  const broken = await runTrialEndingReminders({ DB: { prepare() { throw new Error('boom'); } } }, { now });
  check('2) xato yutiladi', broken, { created: 0, error: true });
}

// ═══ 3. Bildirishnomalar ro'yxati ═══
{
  const r = await call('/api/notifications', { cookie: 'nfc_session=t3' });
  const items = (r.body?.items || []).filter((i) => i.type === 'trial_ending');
  check('3) ikkita trial_ending', items.length, 2);
  const it = items[items.length - 1];
  check('3) shakl', [it.type, it.title, it.actorCode, it.targetType, /^\d{4}-\d{2}-\d{2}$/.test(it.targetId), it.read],
    ['trial_ending', '', '', 'trial', true, false]);
  checkTrue('3) o‘qilmaganlar sanog‘ida', r.body.unreadCount >= 2);
}

// ═══ 4. Aksiya muddati ═══
{
  const cut = Date.parse(LAUNCH_PROMO_UNTIL);
  check('4) chegara Toshkent 23:59:59', LAUNCH_PROMO_UNTIL, '2026-12-31T18:59:59Z');
  check('4) chegaragacha 90, keyin 30', [trialDaysForD1(new Date(cut)), trialDaysForD1(new Date(cut + 1000)), trialDaysForD1(new Date('2026-10-06T00:00:00Z'))],
    [TRIAL_DAYS_LAUNCH, TRIAL_DAYS_DEFAULT, 90]);
  check('4) qiymatlar', [TRIAL_DAYS_LAUNCH, TRIAL_DAYS_DEFAULT], [90, 30]);
  const d = (from) => (Date.parse(trialEndsAtD1(new Date(from))) - from) / DAY;
  check('4) trialEndsAtD1 — yaratilish sanasiga qarab', [d(cut - DAY), d(cut + DAY)], [90, 30]);
  // Ro'yxatdan o'tish (auth.js) shu funksiyadan foydalanadi.
  const reg = await call('/api/auth/register', { method: 'POST', json: { email: 'new-trial@x.uz', phone: '+998935550011', password: 'secret123', tosAccepted: true } });
  checkTrue(`4) ro‘yxatdan o‘tdi (${reg.status})`, reg.status === 200 || reg.status === 201);
  const row = sqlite.prepare(`SELECT trial_expires_at FROM users WHERE email = 'new-trial@x.uz'`).get();
  const days = (Date.parse(row?.trial_expires_at) - Date.now()) / DAY;
  const want = Date.now() <= cut ? 90 : 30;
  checkTrue(`4) yangi hisob sinovi ~${want} kun (${days.toFixed(2)})`, Math.abs(days - want) < 0.1);
}

done('Bepul sinov: filtr, eslatma, aksiya');
