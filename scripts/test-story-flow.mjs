// STORY OQIMI — YARATISHDAN KO'RINISHGACHA
//
// Egasining xabari: "ba'zi profillarda 3-4 ta story qo'ysam, bittasi
// ko'rinadi, qolganlari yo'q".
//
// Frontend ayblanmadi: 4 ta story bilan haqiqiy brauzerda sinaldi va
// halqa, ko'ruvchi (4 ta chiziqcha) va lenta (4 ta katak) to'g'ri
// chizildi. Demak savol backendda: story SAQLANDIMI va GET uni QAYTA
// BERADIMI?
//
// Bu test aynan shu yo'lni HAQIQIY worker va haqiqiy SQLite ustida
// yuradi — manba matnini o'qib emas, so'rov yuborib. Har bir xato
// kodi ham tekshiriladi, chunki ular foydalanuvchiga ko'rsatiladigan
// xabarni belgilaydi.
//
//   node scripts/test-story-flow.mjs
import worker from '../hosting/worker.js';
import { makeEnv, seedBasic, cookie, req, makeChecker } from './lib/d1-harness.mjs';

const { check, checkTrue, done } = makeChecker();
const { env } = makeEnv();
await seedBasic(env);

const call = async (path, init) => {
  const r = await worker.fetch(req(path, init), env);
  return { status: r.status, body: await r.json().catch(() => null) };
};

// VIP001 — user#1 niki (seedBasic).
//
// TARIF USTUNDAN EMAS, KODDAN kelib chiqadi (`personalIdTierD1`):
// faqat harflardan iborat kod va "VIP" kabi maxsus prefikslar yuqori
// daraja beradi, 8 xonali raqamli kod esa bepul. Shuning uchun bu
// yerda hech narsa yangilanmaydi — kodning o'zi yetarli.

const img = (n) => ({ imageUrl: `/uploads/s${n}.jpg`, agreed: true });
const post = (code, json, ck = cookie.user) =>
  call(`/api/records/${code}/stories`, { method: 'POST', json, headers: { cookie: ck } });
const list = (code) => call(`/api/records/${code}/stories`);

// ── 1) BITTA STORY YARATISH ──────────────────────────────────────────
{
  const r = await post('VIP001', img(1));
  check('1) story yaratildi (201)', r.status, 201);
  checkTrue('1) javobda id bor', Number(r.body?.id) > 0);
  checkTrue('1) javobda rasm bor', r.body?.imageUrl === '/uploads/s1.jpg');
  checkTrue('1) expiresAt berilgan', !!r.body?.expiresAt);
  // 24 soatlik muddat
  const ttlH = (new Date(r.body.expiresAt) - new Date(r.body.createdAt)) / 3600000;
  checkTrue('1) muddat 24 soat', Math.abs(ttlH - 24) < 0.1, `${ttlH.toFixed(2)} soat`);
}

// ── 2) DARHOL GET ORQALI KO'RINADI ───────────────────────────────────
{
  const r = await list('VIP001');
  check('2) GET 200', r.status, 200);
  check('2) ro‘yxatda 1 ta', r.body?.stories?.length, 1);
}

// ── 3) KETMA-KET YANA UCHTA — EGASINING HOLATI ───────────────────────
// Aynan shikoyatdagi ssenariy: 3-4 ta qo'yiladi.
{
  const codes = [];
  for (let i = 2; i <= 4; i += 1) {
    const r = await post('VIP001', img(i));
    codes.push(r.status);
  }
  check('3) uchtasi ham 201', codes.join(','), '201,201,201');

  const r = await list('VIP001');
  check('3) GET da TO‘RTTASI ham bor', r.body?.stories?.length, 4);

  // Har biri o'z rasmi bilan, tartibda (eskidan yangiga).
  const urls = (r.body.stories || []).map((s) => s.imageUrl);
  check('3) rasmlar tartibda va to‘liq', urls.join(','),
    '/uploads/s1.jpg,/uploads/s2.jpg,/uploads/s3.jpg,/uploads/s4.jpg');
  // id lar takrorlanmasin (bitta qator ustiga yozilmagan).
  const ids = new Set((r.body.stories || []).map((s) => s.id));
  check('3) to‘rtta HAR XIL id', ids.size, 4);
}

// ── 4) MUDDATI O'TGAN STORY ──────────────────────────────────────────
// Ro'yxatda ko'rinmasligi VA chegaraga kirmasligi kerak.
{
  const past = new Date(Date.now() - 60_000).toISOString();
  for (let i = 0; i < 3; i += 1) {
    await env.DB.prepare(
      `INSERT INTO stories (owner_kind, owner_id, user_id, image_url, caption, created_at, expires_at)
       VALUES ('card', 'VIP001', 1, '/uploads/old.jpg', 'eski', ?, ?)`,
    ).bind(past, past).run();
  }
  const r = await list('VIP001');
  check('4) muddati o‘tganlar ro‘yxatda YO‘Q', r.body?.stories?.length, 4);
  checkTrue('4) eski rasm chiqmaydi',
    !(r.body.stories || []).some((s) => s.imageUrl === '/uploads/old.jpg'));
}

// ── 5) O'NTA CHEGARA ─────────────────────────────────────────────────
// Yuqorida 4 ta faol + 3 ta muddati o'tgan bor. Muddati o'tganlar
// HISOBGA KIRMASLIGI kerak, ya'ni yana 6 ta qo'shilishi shart.
{
  const got = [];
  for (let i = 5; i <= 10; i += 1) got.push((await post('VIP001', img(i))).status);
  check('5) 5..10 — oltitasi ham 201 (eskilar chegaraga kirmadi)',
    got.join(','), '201,201,201,201,201,201');

  const r = await list('VIP001');
  check('5) endi 10 ta faol', r.body?.stories?.length, 10);

  const over = await post('VIP001', img(11));
  check('5) 11-chisi rad etildi', over.status, 409);
  check('5) sabab limit_reached', over.body?.error, 'limit_reached');
  check('5) chegara son bilan aytiladi', over.body?.limit, 10);
}

// ── 6) O'CHIRGANDAN KEYIN YANA QO'SHILADI ────────────────────────────
{
  const before = await list('VIP001');
  const victim = before.body.stories[0].id;
  const del = await call(`/api/stories/${victim}`, { method: 'DELETE', headers: { cookie: cookie.user } });
  checkTrue('6) story o‘chirildi', del.status === 200 || del.status === 204, `status ${del.status}`);

  const again = await post('VIP001', img(12));
  check('6) joy bo‘shagach yangisi qo‘shildi', again.status, 201);
  const r = await list('VIP001');
  check('6) yana 10 ta', r.body?.stories?.length, 10);
}

// ── 7) XATO HOLATLARI ────────────────────────────────────────────────
// Har bir kod foydalanuvchiga BOSHQA xabar ko'rsatadi, shuning uchun
// ularni aralashtirib yuborish mumkin emas.
{
  const noRules = await post('VIP001', { imageUrl: '/uploads/x.jpg' });
  check('7) rozilik yo‘q -> 422', noRules.status, 422);
  check('7) sabab rules_not_accepted', noRules.body?.error, 'rules_not_accepted');

  const noImg = await post('VIP001', { agreed: true });
  check('7) rasm yo‘q -> 422', noImg.status, 422);
  check('7) sabab bad_image', noImg.body?.error, 'bad_image');

  const anon = await call('/api/records/VIP001/stories', { method: 'POST', json: img(1) });
  check('7) tizimga kirmagan -> 401', anon.status, 401);

  const foreign = await post('VIP001', img(1), cookie.other);
  check('7) begona profilga -> 403', foreign.status, 403);
  check('7) sabab not_owner', foreign.body?.error, 'not_owner');
}

// ── 8) TARIF ─────────────────────────────────────────────────────────
// Story — Gold/Premium/Ekskluziv uchun. Bepul tarifda yopiq bo'lishi
// va buni AYTIB berishi kerak (odam nega ishlamayotganini bilsin).
{
  // 8 xonali raqamli kod — bepul daraja (`c.length !== 6` -> 'free').
  await env.DB.prepare(
    `INSERT INTO cards (code, name, price, ts, user_id, profile_type) VALUES ('12345678', 'Bepul', 0, 1000, 1, 'personal')`,
  ).run();
  const r = await post('12345678', img(1));
  check('8) bepul tarifda yopiq -> 403', r.status, 403);
  check('8) sabab feature_locked', r.body?.error, 'feature_locked');
  check('8) qaysi imkoniyat ekani aytiladi', r.body?.feature, 'story');
}

// ── 9) BOSHQA PROFIL ARALASHMAYDI ────────────────────────────────────
// VIP001 da 10 ta bor; OTH222 (user#2) mustaqil bo'lishi kerak.
{
  // Faqat harflardan iborat kod -> ekskluziv daraja (LETTER_CODE_RE).
  await env.DB.prepare(
    `INSERT INTO cards (code, name, price, ts, user_id, profile_type) VALUES ('OTHERONE', 'Ikkinchi', 0, 1000, 2, 'personal')`,
  ).run();
  const r = await post('OTHERONE', img(1), cookie.other);
  check('9) boshqa profilga qo‘shildi', r.status, 201);
  const a = await list('OTHERONE');
  const b = await list('VIP001');
  check('9) OTHERONE da 1 ta', a.body?.stories?.length, 1);
  check('9) VIP001 hamon 10 ta', b.body?.stories?.length, 10);
}

// ── 10) FOYDALANUVCHIGA KO'RSATILADIGAN XABARLAR ─────────────────────
// Server kodi — mashina uchun; odam o'zbekcha jumla ko'rishi kerak.
// Yuklagichdagi moslik jadvali HAR BIR kodni qoplashi shart, aks holda
// odam "Yuklab bo'lmadi" degan umumiy matnni ko'radi va nimani
// tuzatishni bilmaydi.
{
  const up = await import('node:fs').then((fs) =>
    fs.readFileSync(new URL('../src/components/StoryUploader.jsx', import.meta.url), 'utf8'));
  // Kalit obyektda `kod: 'matn'` ko'rinishida bo'lsa ham, tirnoq bilan
  // yozilgan bo'lsa ham topiladi — tekshiruv YOZUV USLUBIGA emas,
  // moslikning O'ZIGA qaraydi.
  const CODES = ['feature_locked', 'limit_reached', 'bad_image', 'rules_not_accepted',
    'too_large', 'bad_file', 'not_owner', 'unauthorized', 'not_found'];
  const texts = new Set();
  for (const code of CODES) {
    const m = new RegExp(`(?:^|[^\\w'"])'?${code}'?\\s*:\\s*'([^']+)'`, 'm').exec(up);
    checkTrue(`10) "${code}" uchun alohida xabar bor`, !!m, m ? '' : 'moslik topilmadi');
    if (m) texts.add(m[1]);
  }
  // Xabarlar BIR-BIRIDAN FARQ QILSIN: ikkita kod bitta jumlaga
  // tushsa, odam qaysi muammo ekanini ajrata olmaydi.
  check('10) har bir kodning matni o‘ziniki', texts.size, CODES.length);
  checkTrue('10) umumiy "Yuklab bo‘lmadi" faqat zaxira sifatida qoldi',
    up.includes("|| 'Yuklab bo‘lmadi.'"));
}

done('Story oqimi');
