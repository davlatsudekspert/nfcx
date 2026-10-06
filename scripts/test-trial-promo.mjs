// AKSIYA: MAVJUD SINOVLARNI 90 KUNGA UZAYTIRISH (api/trial-promo.js).
//
// Tekshiriladi: faol 30 kunlik sinov 90 kunga uzayadi; 90 kun ichida
// ro'yxatdan o'tgan, sinovi tugagan hisobga sinov qayta ochiladi; 90 kundan
// eskisi, eski (sinovsiz, NULL) hisob, o'chirilgan hisob tegilmaydi; sinov
// HECH QACHON qisqarmaydi; Premium ustunlari o'zgarmaydi; ikkala sana shakli
// ('YYYY-MM-DD HH:MM:SS' va ISO) tushuniladi; kompaniyalar ham; BIR MARTA.
//
//   node scripts/test-trial-promo.mjs
//   UZ_ADAPTER_TEST=1 node scripts/test-trial-promo.mjs
import { setupSocial, makeChecker } from './lib/social-fixture.mjs';
import { applyLaunchTrialExtension, LAUNCH_TRIAL_MIGRATION } from '../hosting/api/trial-promo.js';

const { check, checkTrue, done } = makeChecker();
// Haqiqiy sxema: foydalanuvchi va kompaniya jadvallari worker yaratganidek.
const { env, addCompany } = await setupSocial();

const DAY = 86400000;
const NOW = new Date('2026-10-06T03:00:00.000Z');
const iso = (ms) => new Date(ms).toISOString();
const sqlTs = (ms) => new Date(ms).toISOString().slice(0, 19).replace('T', ' ');
const run = (sql, ...b) => env.DB.prepare(sql).bind(...b).run();
const one = (sql, ...b) => env.DB.prepare(sql).bind(...b).first();

for (const col of ['trial_expires_at', 'premium_expires_at', 'deleted_at']) {
  await run(`ALTER TABLE users ADD COLUMN ${col} TEXT`).catch(() => {});
}
await run(`ALTER TABLE companies ADD COLUMN trial_expires_at TEXT`).catch(() => {});

const t0 = NOW.getTime();
const addUser = async (id, createdAt, trial, extra = {}) => {
  await run(`INSERT INTO users (id, email, password_hash, phone, created_at, trial_expires_at, premium_expires_at, deleted_at)
             VALUES (?, ?, 'x', ?, ?, ?, ?, ?)`,
  id, `u${id}@t.local`, `+99890000${String(id).padStart(4, '0')}`, createdAt, trial, extra.premium ?? null, extra.deleted ?? null);
};
// 10: 7 kun oldin (SQL shakli), sinov faol (30 kun) -> created+90
await addUser(10, sqlTs(t0 - 7 * DAY), iso(t0 + 23 * DAY));
// 11: 40 kun oldin (ISO), 30 kunlik sinovi tugagan -> qayta ochiladi
await addUser(11, iso(t0 - 40 * DAY), iso(t0 - 10 * DAY));
// 12: 120 kun oldin — 90 kun o'tgan -> tegilmaydi
await addUser(12, iso(t0 - 120 * DAY), iso(t0 - 90 * DAY));
// 13: eski hisob — sinov NULL -> tegilmaydi
await addUser(13, iso(t0 - 5 * DAY), null);
// 14: o'chirilgan -> tegilmaydi
await addUser(14, iso(t0 - 5 * DAY), iso(t0 + 25 * DAY), { deleted: iso(t0 - DAY) });
// 15: sinovi allaqachon created+90 dan UZOQ (qo'lda) -> qisqarmaydi
await addUser(15, iso(t0 - 5 * DAY), iso(t0 + 200 * DAY));
// 16: Premium bor — sinov uzayadi, Premium o'zgarmaydi
await addUser(16, iso(t0 - 3 * DAY), iso(t0 + 27 * DAY), { premium: iso(t0 + 60 * DAY) });

addCompany('CO1', 10); addCompany('CO2', 12); addCompany('CO3', 13);
// Fixture'dagi ACMEUZ / OTHERCO — sinovsiz (NULL), tegilmasligi kerak.
await run(`UPDATE companies SET created_at = ?, trial_expires_at = ? WHERE company_id = 'CO1'`, sqlTs(t0 - 7 * DAY), iso(t0 + 23 * DAY));
await run(`UPDATE companies SET created_at = ?, trial_expires_at = ? WHERE company_id = 'CO2'`, iso(t0 - 120 * DAY), iso(t0 - 90 * DAY));
await run(`UPDATE companies SET created_at = ?, trial_expires_at = NULL WHERE company_id = 'CO3'`, iso(t0 - 5 * DAY));

const trialOf = async (id) => (await one(`SELECT trial_expires_at AS t FROM users WHERE id = ?`, id))?.t ?? null;
const before = {};
for (const id of [12, 13, 14, 15]) before[id] = await trialOf(id);
const prem16 = (await one(`SELECT premium_expires_at AS p FROM users WHERE id = 16`)).p;

const r1 = await applyLaunchTrialExtension(env, { now: NOW });
check('1) bajarildi', r1.applied, true);
check('1) hisoblar soni (10, 11, 16)', r1.users, 3);
check('1) kompaniyalar soni (CO1)', r1.companies, 1);

const near = (a, b) => Math.abs(Date.parse(a) - b) < 2000;
checkTrue('2) faol sinov created+90 ga uzaydi (SQL sana shakli)', near(await trialOf(10), t0 - 7 * DAY + 90 * DAY));
checkTrue('2) tugagan sinov 90 kun ichida — qayta ochildi', near(await trialOf(11), t0 - 40 * DAY + 90 * DAY));
check('2) 90 kundan eski — tegilmadi', await trialOf(12), before[12]);
check('2) eski hisob (NULL) — tegilmadi', await trialOf(13), before[13]);
check('2) o‘chirilgan — tegilmadi', await trialOf(14), before[14]);
check('2) uzunroq sinov — qisqarmadi', await trialOf(15), before[15]);
checkTrue('2) Premium hisob: sinov uzaydi', near(await trialOf(16), t0 - 3 * DAY + 90 * DAY));
check('2) Premium muddati o‘zgarmadi', (await one(`SELECT premium_expires_at AS p FROM users WHERE id = 16`)).p, prem16);
checkTrue('2) yangi qiymat ISO shaklida', /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(await trialOf(10)));

const co = async (id) => (await one(`SELECT trial_expires_at AS t FROM companies WHERE company_id = ?`, id))?.t ?? null;
checkTrue('3) kompaniya sinovi uzaydi', near(await co('CO1'), t0 - 7 * DAY + 90 * DAY));
checkTrue('3) eski kompaniya (90+) tegilmadi', near(await co('CO2'), t0 - 90 * DAY));
check('3) sinovsiz kompaniya tegilmadi', await co('CO3'), null);

// BIR MARTA: ikkinchi chaqiruv hech narsa qilmaydi (keyin qo'shilgan hisob ham).
await addUser(17, iso(t0 - 2 * DAY), iso(t0 + 28 * DAY));
const r2 = await applyLaunchTrialExtension(env, { now: NOW });
check('4) ikkinchi marta — bajarilmaydi', r2.applied, false);
checkTrue('4) keyingi hisob tegilmadi', near(await trialOf(17), t0 + 28 * DAY));
const flag = await one(`SELECT name, detail FROM app_migrations WHERE name = ?`, LAUNCH_TRIAL_MIGRATION);
check('4) belgi va sonlar yozildi', [flag?.name, JSON.parse(flag?.detail || '{}')], [LAUNCH_TRIAL_MIGRATION, { users: 3, companies: 1 }]);

done();
