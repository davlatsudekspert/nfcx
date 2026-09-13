// ADMIN TRAFIK HISOBOTI — /api/admin/traffic.
//
// Egasining so'rovi: "saytga nechta odam kirdi, nechta profil ochildi,
// qayerdan kirdi".
//
// Bu test uchta narsani qo'riqlaydi:
//
//   1) NOYOB TASHRIFCHI kunlik raqamlarni qo'shib hisoblanMAYDI. Bir
//      odam uch kun kirsa — u bitta odam, uchta emas. Bu eng oson
//      qilinadigan xato va raqamni bir necha barobar shishirib
//      yuboradi.
//
//   2) SINOV va ICHKI akkauntlarning profillari hisobga KIRMAYDI —
//      egasining qoidasi: "o'zimiz qilgan ishlar statistikaga
//      kirmasin".
//
//   3) Bo'sh kunlar NOL bilan to'ldiriladi. Aks holda grafikda kunlar
//      o'tkazib yuborilib, egri chiziq yolg'on ko'rinish beradi.
//
//   node scripts/test-admin-traffic.mjs
import worker, { ensureCoreSchema } from '../hosting/worker.js';
import { makeEnv, seedBasic, req, cookie, makeChecker } from './lib/d1-harness.mjs';

const { check, checkTrue, done } = makeChecker();
const { env, sqlite } = makeEnv({});
await ensureCoreSchema(env);
await seedBasic(env);

const dayAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
const stamp = (n) => `${dayAgo(n)} 12:00:00.000+00`;

// user#1 — oddiy, user#2 — SINOV deb belgilanadi.
sqlite.prepare(`UPDATE users SET is_test = 1 WHERE id = 2`).run();

const ev = sqlite.prepare(
  `INSERT INTO card_events (code, event_type, ref, visitor_hash, created_at) VALUES (?, 'profile_view', ?, ?, ?)`);

// VIP001 (user#1): bitta odam UCH KUN kirdi + boshqa ikki odam.
ev.run('VIP001', 'nfc', 'aaa', stamp(0));
ev.run('VIP001', 'nfc', 'aaa', stamp(1));
ev.run('VIP001', 'nfc', 'aaa', stamp(2));
ev.run('VIP001', 'qr', 'bbb', stamp(0));
ev.run('VIP001', null, 'ccc', stamp(0));      // manba noma'lum -> 'direct'
// BIZ777 (user#1) — bitta ochilish
ev.run('BIZ777', 'link', 'ddd', stamp(1));
// OTH222 — SINOV foydalanuvchiniki, HISOBGA KIRMASLIGI kerak
ev.run('OTH222', 'nfc', 'zzz', stamp(0));
ev.run('OTH222', 'nfc', 'yyy', stamp(0));

// Kompaniya profili ko'rishlari (alohida jadval, oldindan yig'ilgan).
// Kompaniyalar EGASIGA bog'lanadi — "Sinov" belgisi ularga ham
// tegishli bo'lishi kerak.
const addCo = sqlite.prepare(
  `INSERT INTO companies (company_id, owner_user_id, display_name, tier, price, status, created_at, updated_at)
   VALUES (?,?,?,'free',0,'active',datetime('now'),datetime('now'))`);
addCo.run('NFCSTORE', '1', 'NFCSTORE');
addCo.run('SINOVCO', '2', 'Sinov kompaniya');
sqlite.prepare(`INSERT INTO company_stats (company_id, day, kind, ref, hits) VALUES (?,?,'view','',?)`)
  .run('NFCSTORE', dayAgo(0), 7);
// user#2 SINOV — bu kompaniyaning ko'rishlari HISOBGA KIRMASLIGI kerak.
sqlite.prepare(`INSERT INTO company_stats (company_id, day, kind, ref, hits) VALUES (?,?,'view','',?)`)
  .run('SINOVCO', dayAgo(0), 99);

const res = await worker.fetch(req('/api/admin/traffic?days=30', { cookie: cookie.admin }), env);
check('200 qaytadi', res.status, 200);
const d = await res.json();

// ── 1) Noyob tashrifchi: aaa,bbb,ccc,ddd = 4 (aaa uch marta kirgan) ──
check('noyob tashrifchi = 4 (kunlar qo‘shilmaydi)', d.totals.visitors, 4);
// Kunlik raqamlarni qo'shsak 6 chiqadi — aynan shu xato bo'lmasin.
const naive = d.series.reduce((n, r) => n + r.visitors, 0);
checkTrue('kunlik yig‘indi noyob sondan KATTA (xato isboti)', naive > d.totals.visitors);

// ── 2) Sinov akkaunt chiqarib tashlandi ──────────────────────────────
// VIP001: 5 ta, BIZ777: 1 ta = 6. OTH222 ning 2 tasi KIRMAYDI.
check('shaxsiy ochilishlar = 6 (sinov chiqarildi)', d.totals.personalOpens, 6);
check('kompaniya ochilishlari = 7', d.totals.companyOpens, 7);
check('jami ochilish = 13', d.totals.opens, 13);
checkTrue('sinov profili ro‘yxatda yo‘q', !d.topProfiles.some((p) => p.code === 'OTH222'));

// ── 3) Manbalar ──────────────────────────────────────────────────────
const src = Object.fromEntries(d.sources.map((r) => [r.src, r.opens]));
check('manba: nfc = 3', src.nfc, 3);
check('manba: qr = 1', src.qr, 1);
check('manba: link = 1', src.link, 1);
check('manba: noma‘lum -> direct = 1', src.direct, 1);

// ── 4) Qator to'liq va bo'sh kunlar nol ──────────────────────────────
check('30 kunning hammasi bor', d.series.length, 30);
check('oxirgi kun bugun', d.series[29].day, dayAgo(0));
checkTrue('bo‘sh kunlar nol bilan to‘ldirilgan', d.series.filter((r) => r.opens === 0).length > 0);
// Bugun: VIP001 dan 3 ta + kompaniyadan 7 ta = 10
check('bugungi ochilish = 10', d.series[29].opens, 10);

// ── 5) Eng ko'p ochilgan profillar ───────────────────────────────────
check('birinchi o‘rin VIP001', d.topProfiles[0].code, 'VIP001');
check('VIP001 ochilishi = 5', d.topProfiles[0].opens, 5);
check('VIP001 noyob tashrifchi = 3', d.topProfiles[0].visitors, 3);
check('kompaniyalar ro‘yxati', d.topCompanies[0], { code: 'NFCSTORE', opens: 7 });
// ENG MUHIMI: sinov egasining kompaniyasi ro'yxatda ham, sanoqda ham
// bo'lmasin. Bu filtr `owner_user_id` MATN bo'lgani uchun CAST talab
// qiladi — CAST tushib qolsa u JIM ishlamay qoladi (hamma kompaniya
// o'tib ketadi), shuning uchun alohida tekshiriladi.
checkTrue('sinov kompaniyasi ro‘yxatda yo‘q', !d.topCompanies.some((c) => c.code === 'SINOVCO'));

// ── 6) SINOVNI QAYTARIB KO'RSATISH (?includeTest=1) ──────────────────
// Sinov yozuvlari O'CHIRILMAGAN — faqat yashirilgan. Shuni isbotlaymiz:
// belgi yoqilganda ular joyidan chiqib kelishi kerak.
const withTest = await (await worker.fetch(
  req('/api/admin/traffic?days=30&includeTest=1', { cookie: cookie.admin }), env)).json();
check('sinov bilan: shaxsiy ochilishlar = 8', withTest.totals.personalOpens, 8);
check('sinov bilan: kompaniya ochilishlari = 106', withTest.totals.companyOpens, 106);
checkTrue('sinov profili qaytdi', withTest.topProfiles.some((p) => p.code === 'OTH222'));
checkTrue('sinov kompaniyasi qaytdi', withTest.topCompanies.some((c) => c.code === 'SINOVCO'));
check('belgi javobda ham bor', withTest.includeTest, true);

// ── 7) BOSHLANISH SANASI — tarixni o'chirmasdan "toza boshlash" ──────
// Egasining talabi: admin bo'limini toza boshlash kerak bo'lsa,
// DELETE emas — chegara sanasi. Bazadagi yozuvlar joyida qolishi
// SHART (mijozning o'z 90 kunlik statistikasi shundan oziqlanadi).
const rowsBefore = sqlite.prepare(`SELECT COUNT(*) AS n FROM card_events`).get().n;

const setRes = await worker.fetch(req('/api/admin/traffic/start-day', {
  method: 'POST', cookie: cookie.admin, json: { startDay: dayAgo(1) },
}), env);
check('sana saqlandi', setRes.status, 200);
check('javobda sana bor', (await setRes.json()).startDay, dayAgo(1));

const cut = await (await worker.fetch(req('/api/admin/traffic?days=30', { cookie: cookie.admin }), env)).json();
check('qator faqat 2 kun', cut.series.length, 2);
check('birinchi kun — chegara sanasi', cut.series[0].day, dayAgo(1));
// Chegaradan oldingi kun (stamp(2)) endi hisobga kirmaydi:
// VIP001 dan 5 ta edi, biri 2 kun oldin — 4 qoladi. BIZ777 (1 kun
// oldin) qoladi. Jami 5.
check('shaxsiy ochilishlar = 5', cut.totals.personalOpens, 5);
check('noyob tashrifchi = 4', cut.totals.visitors, 4);
check('javobda boshlanish sanasi', cut.startDay, dayAgo(1));

// ENG MUHIMI: BAZA TEGILMAGAN.
check('card_events qatorlari o‘chmagan', sqlite.prepare(`SELECT COUNT(*) AS n FROM card_events`).get().n, rowsBefore);

// Sanani bo'shatish — butun tarix qaytadi.
await worker.fetch(req('/api/admin/traffic/start-day', {
  method: 'POST', cookie: cookie.admin, json: { startDay: '' },
}), env);
const back = await (await worker.fetch(req('/api/admin/traffic?days=30', { cookie: cookie.admin }), env)).json();
check('tarix qaytdi: 30 kun', back.series.length, 30);
check('tarix qaytdi: ochilishlar = 6', back.totals.personalOpens, 6);
check('chegara bo‘sh', back.startDay, '');

// Buzuq sana qabul qilinmaydi — aks holda butun bo'lim bo'shab qolardi.
const bad = await worker.fetch(req('/api/admin/traffic/start-day', {
  method: 'POST', cookie: cookie.admin, json: { startDay: 'kecha' },
}), env);
check('buzuq sana rad etiladi', bad.status, 422);

// ── 8) Faqat admin uchun ─────────────────────────────────────────────
const anon = await worker.fetch(req('/api/admin/traffic'), env);
checkTrue('adminsiz ochilmaydi', anon.status === 401 || anon.status === 403);
const anonSet = await worker.fetch(req('/api/admin/traffic/start-day', {
  method: 'POST', json: { startDay: dayAgo(1) },
}), env);
checkTrue('adminsiz sana qo‘yib bo‘lmaydi', anonSet.status === 401 || anonSet.status === 403);

done();
