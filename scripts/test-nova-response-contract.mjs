// ILOVA O'QIYDIGAN KALIT SERVER JAVOBIDA BORMI.
//
//   node scripts/test-nova-response-contract.mjs
//
// ## NIMA UCHUN BU QO'RIQCHI BOR
//
// `test-nova-api-parity.mjs` endpoint MAVJUDLIGINI tekshiradi:
// so'rov 404 bermasa — yashil. Lekin qurilmada topilgan xato
// aynan shu darvozadan o'tib ketgan edi:
//
//   * ilova `/api/follow-list/:code?type=following` yuborardi,
//     server esa `?dir=` ni o'qiydi — javob 200, lekin NOTO'G'RI
//     yo'nalish (obunachilar, obunalar emas);
//   * server `{list: [...]}` qaytaradi, ilova esa
//     `j['items'] ?? j['users']` ni o'qirdi — javob 200, lekin
//     ro'yxat DOIM bo'sh.
//
// Ikkala holatda ham HTTP darajasida hammasi joyida. Shuning
// uchun bu qo'riqchi boshqa narsani tekshiradi: ilova O'QIYDIGAN
// kalit haqiqiy javobda BORMI va yuboradigan query nomini server
// HAQIQATDAN o'qiydimi.
//
// ## DRIFTDAN HIMOYA
//
// Jadvaldagi har bir qator Dart manbasidagi AYNIQ satrga
// bog'langan. Dart o'zgarsa — qator topilmaydi va qo'riqchi
// yiqiladi, ya'ni jadval jimgina eskirmaydi.

import { readFileSync } from 'node:fs';
import worker from '../hosting/worker.js';
import { makeEnv, seedBasic, req, cookie, makeChecker } from './lib/d1-harness.mjs';

const APP = 'mobile_nova/lib';
const WORKER = readFileSync('hosting/worker.js', 'utf8');
const read = (p) => readFileSync(`${APP}/${p}`, 'utf8');

// Har bir qator: ilova qanday so'rov yuboradi va javobdan nimani
// o'qiydi. `dart` — manbadagi AYNIQ parcha (drift qo'riqchisi).
const CONTRACTS = [
  {
    name: 'follow-list — obunalar',
    file: 'features/profile/profile_repository.dart',
    dart: "query: {'dir': dir}",
    path: (c) => `/api/follow-list/${c}?dir=following`,
    reads: ['list'],
    // Server shu nomni O'QIYDIMI.
    queryReadBy: "searchParams.get('dir')",
  },
  {
    name: 'follow-list — obunachilar',
    file: 'features/profile/profile_repository.dart',
    dart: "parseList(j['list'], NfcId.fromJson)",
    path: (c) => `/api/follow-list/${c}?dir=followers`,
    reads: ['list'],
  },
  {
    name: 'follow-stats — sonlar va isFollowing',
    file: 'features/profile/profile_repository.dart',
    dart: "j['isFollowing'] == true",
    path: (c) => `/api/follow-stats/${c}`,
    reads: ['followers', 'following', 'isFollowing'],
  },
  {
    name: 'bildirishnomalar',
    file: 'data/repositories/activity_repository.dart',
    dart: "res.map(NotificationPage.fromJson)",
    path: () => '/api/notifications',
    reads: ['items', 'unreadCount'],
  },
];

const { env } = makeEnv();
await seedBasic(env);
const { check, checkTrue, done } = makeChecker();

const call = async (p, c = cookie.user) => {
  const r = await worker.fetch(req(p, { cookie: c }), env, { waitUntil() {} });
  return { status: r.status, body: await r.json().catch(() => null) };
};

// A (user#1, VIP001) -> B (user#2, OTH222).
await worker.fetch(req('/api/follow/OTH222', { method: 'POST', cookie: cookie.user }), env, { waitUntil() {} });

for (const c of CONTRACTS) {
  // 1. Manba hali ham shu shaklda yozilganmi.
  if (c.dart) {
    let src = '';
    try { src = read(c.file); } catch { src = ''; }
    checkTrue(`${c.name}: manbada "${c.dart}"`, src.includes(c.dart));
  }

  // 2. Server yuborilgan query nomini haqiqatan o'qiydimi.
  if (c.queryReadBy) {
    checkTrue(`${c.name}: worker "${c.queryReadBy}" ni o'qiydi`,
      WORKER.includes(c.queryReadBy));
  }

  // 3. Ilova o'qiydigan kalit javobda bormi.
  const res = await call(c.path('VIP001'));
  checkTrue(`${c.name}: javob 2xx`, res.status >= 200 && res.status < 300);
  for (const k of c.reads) {
    checkTrue(`${c.name}: javobda "${k}" kaliti bor`,
      res.body != null && Object.prototype.hasOwnProperty.call(res.body, k));
  }
}

// ── YO'NALISH HAQIQATAN FARQ QILADIMI ────────────────────────
//
// Bu eng muhim tekshiruv: `dir` e'tiborsiz qolsa, ikkala so'rov
// ham BIR XIL javob berardi va yuqoridagi kalit tekshiruvi buni
// sezmasdi.
const following = await call('/api/follow-list/VIP001?dir=following');
const followers = await call('/api/follow-list/OTH222?dir=followers');
check('A ning obunasi = B', (following.body?.list || []).map((e) => e.code), ['OTH222']);
check('B ning obunachisi = A', (followers.body?.list || []).map((e) => e.code), ['VIP001']);

// Noto'g'ri nom bilan yuborilsa server uni E'TIBORSIZ qoldiradi
// va standart yo'nalishni (`followers`) beradi — ya'ni ilova
// `?type=` yuborsa xato JIM bo'ladi. Shuni yozib qo'yamiz.
const wrong = await call('/api/follow-list/VIP001?type=following');
check('noto\'g\'ri query nomi jimgina boshqa natija beradi',
  (wrong.body?.list || []).map((e) => e.code), []);

// ── SONLAR ───────────────────────────────────────────────────
const statsB = await call('/api/follow-stats/OTH222');
check('B da 1 obunachi', statsB.body?.followers, 1);
check('A uchun isFollowing = true', statsB.body?.isFollowing, true);

// ── BILDIRISHNOMA ────────────────────────────────────────────
const notif = await call('/api/notifications', cookie.other);
const first = (notif.body?.items || [])[0];
check('B da follow bildirishnomasi bor', first?.type, 'follow');
check('bildirishnoma aktori A', first?.actorCode, 'VIP001');
check('o\'qilmagan', first?.read, false);

// O'ZIGA BILDIRISHNOMA YO'Q.
const mine = await call('/api/notifications', cookie.user);
check('A ga o\'z harakati uchun bildirishnoma kelmaydi',
  (mine.body?.items || []).filter((n) => n.type === 'follow').length, 0);

// TAKROR OBUNA TAKROR BILDIRISHNOMA YARATMAYDI.
await worker.fetch(req('/api/follow/OTH222', { method: 'POST', cookie: cookie.user }), env, { waitUntil() {} });
const again = await call('/api/notifications', cookie.other);
check('takroriy follow yangi bildirishnoma yaratmaydi',
  (again.body?.items || []).filter((n) => n.type === 'follow').length, 1);

// ── UNFOLLOW SONNI KAMAYTIRADI ───────────────────────────────
await worker.fetch(req('/api/unfollow/OTH222', { method: 'POST', cookie: cookie.user }), env, { waitUntil() {} });
const afterUn = await call('/api/follow-stats/OTH222');
check('unfollow dan keyin 0 obunachi', afterUn.body?.followers, 0);
check('unfollow dan keyin isFollowing = false', afterUn.body?.isFollowing, false);

done();
