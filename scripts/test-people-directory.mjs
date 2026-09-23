// ILOVADAGI "ODAMLAR": YANGI RO'YXATDAN O'TGANLAR HAM KO'RINADI.
//
// Egasi (2026-09-23): "yangi ro'yxatdan o'tganlar bu yerda ko'rinmaydimi,
// masalan anvarbek... profil egasi". Ilova "Odamlar"ni saytdagi
// SOTILADIGAN ID katalogidan (`/api/records`) olardi, u esa avtomatik
// 8 xonali ID'larni ataylab yashiradi. Endi alohida `/api/people`.
//
// Chegaralar:
//   * katalog (`/api/records`) O'ZGARMADI — avtomatik ID u yerda yo'q;
//   * `/api/people` — egasi bor profillar, avtomatik ID ham;
//   * egasiz (sotuvdagi) ID va o'zini yashirgan profil — yo'q;
//   * qidiruv kod, ism va email qismi bo'yicha; sahifalash.
//
//   node scripts/test-people-directory.mjs

import worker from '../hosting/worker.js';
import { makeEnv, seedBasic, req, makeChecker } from './lib/d1-harness.mjs';

const { env } = makeEnv();
await seedBasic(env);
const { check, checkTrue, done } = makeChecker();

const call = async (path) => {
  const res = await worker.fetch(req(path), env);
  return { status: res.status, body: await res.json().catch(() => null) };
};

// Sxemani yaratish uchun birinchi so'rov.
await call('/api/records');
await env.DB.prepare(
  `INSERT INTO cards (code, name, price, ts, user_id, profile_type, source)
   VALUES ('62852493', 'Anvarbek', 0, 5000, 2, 'personal', 'registration_auto')`
).run();
await env.DB.prepare(
  `INSERT INTO cards (code, name, price, ts, user_id, profile_type) VALUES ('SALE01', 'Sotuvda', 99000, 4000, NULL, 'personal')`
).run();
await env.DB.prepare(
  `INSERT INTO cards (code, name, price, ts, user_id, profile_type, hidden_from_directory)
   VALUES ('HID001', 'Yashirin', 0, 4500, 1, 'personal', 1)`
).run();

const catalog = (await call('/api/records')).body;
const codes = (list) => list.map((x) => x.code);
check('1) sotuv katalogida avtomatik ID yo\'q (o\'zgarmadi)', codes(catalog).includes('62852493'), false);

let r = await call('/api/people');
check('2) /api/people 200', r.status, 200);
const people = codes(r.body.records);
check('2) yangi ro\'yxatdan o\'tgan ko\'rinadi', people.includes('62852493'), true);
check('2) eng yangisi birinchi', people[0], '62852493');
check('2) egasiz (sotuvdagi) ID yo\'q', people.includes('SALE01'), false);
check('2) o\'zini yashirgan profil yo\'q', people.includes('HID001'), false);
checkTrue('2) sonlar bor', ['followers', 'following', 'posts'].every((k) => k in r.body.records[0]));

check('3) qidiruv: kod qismi', codes((await call('/api/people/search?q=6285')).body.records), ['62852493']);
check('3) qidiruv: ism (harfsiz)', codes((await call('/api/people/search?q=ANVAR')).body.records), ['62852493']);
check('3) qidiruv: egasining emaili', codes((await call('/api/people/search?q=other@test')).body.records).sort(), ['62852493', 'OTH222']);
check('3) qisqa so\'rov bo\'sh', (await call('/api/people/search?q=a')).body.records, []);
check('3) yashirin profil qidiruvda ham yo\'q', codes((await call('/api/people/search?q=yashirin')).body.records), []);

r = await call('/api/people?limit=1');
check('4) sahifa: 1 ta va yana bor', [r.body.records.length, r.body.hasMore], [1, true]);
r = await call('/api/people?limit=1&offset=1');
checkTrue('4) keyingi sahifa boshqa', r.body.records[0].code !== '62852493');

done();
