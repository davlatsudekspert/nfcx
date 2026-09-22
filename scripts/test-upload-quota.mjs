// KUNLIK YUKLASH KVOTASI va MUDDATI O'TGAN ISTORYA FAYLLARI (2026-09).
//
// NIMA UCHUN BU TEST BOR.
//
// Har bir faylning o'z chegarasi bor edi, lekin yuklashlar SONIGA
// hech qanday chek yo'q edi. Bitta odam 100 MB lik videoni ketma-ket
// yuborib R2 dagi butun joyni to'ldirib qo'yishi mumkin edi.
//
// Ikkinchi teshik: istorya 24 soatdan keyin bazadan o'chardi, lekin
// uning FAYLI R2 da abadiy qolardi. Buni hech kim sezmaydi — xarajat
// jim o'sadi.
//
// Bu testning vazifasi ikkalasini ham qaytib ochilmasligini kafolatlash
// va — muhimi — kvota NOTO'G'RI joyda ishlamasligini tekshirish:
// admin to'silmasligi, boshqa odamning hisobi aralashib ketmasligi,
// va tozalash BEGONA faylni o'chirib yubormasligi.
//
//   node scripts/test-upload-quota.mjs
import worker from '../hosting/worker.js';
import { makeEnv, seedBasic, cookie, req, makeChecker } from './lib/d1-harness.mjs';

const { check, checkTrue, done } = makeChecker();
const { env } = makeEnv();
await seedBasic(env);

const MB = 1024 * 1024;
const QUOTA_MB = 300;

const jpeg = (n = 64) => { const b = new Uint8Array(n); b.set([0xff, 0xd8, 0xff, 0xe0], 0); return b; };

// Oqimli yuklash — haqiqiy `/api/upload-media` yo'li.
const upload = async (bytes, { cookie: c = cookie.user, len } = {}) => {
  const r = await worker.fetch(new Request('https://nfcstore.uz/api/upload-media', {
    method: 'POST',
    headers: {
      cookie: c.replace(/^[^=]+=/, (m) => m), 'content-type': 'image/jpeg',
      'content-length': String(len ?? bytes.length), 'cf-connecting-ip': '198.51.100.70',
    },
    body: bytes,
  }), env);
  return { status: r.status, body: await r.json().catch(() => null) };
};

const quotaRow = async (key) => env.DB.prepare(`SELECT bytes, day FROM upload_quota WHERE key = ?`).bind(key).first();
const today = () => new Date().toISOString().slice(0, 10);

// seedBasic da user#1 — `actor` shu ko'rinishda yasaladi (worker.js).
const ACTOR_USER = 'user:1';
const ACTOR_OTHER = 'user:2';

// ── 1) ODDIY YUKLASH HISOBGA OLINADI ─────────────────────────────────
const first = await upload(jpeg(1000));
check('1) oddiy yuklash o‘tdi', first.status, 200);
const row1 = await quotaRow(ACTOR_USER);
check('1) kvota qatori yozildi', [Number(row1?.bytes), row1?.day], [1000, today()]);

const second = await upload(jpeg(500));
check('2) ikkinchi yuklash o‘tdi', second.status, 200);
check('2) hajm QO‘SHILDI, almashtirilmadi', Number((await quotaRow(ACTOR_USER))?.bytes), 1500);

// ── 3) CHEGARAGA YETGANDA TO'XTAYDI ──────────────────────────────────
// 300 MB ni haqiqatan yuklash testni daqiqalab cho'zardi. Shuning uchun
// hisob to'g'ridan-to'g'ri chegaraga yaqin qo'yiladi — kod uchun farqi
// yo'q, u faqat qiymatni o'qiydi.
await env.DB.prepare(`UPDATE upload_quota SET bytes = ? WHERE key = ?`)
  .bind(QUOTA_MB * MB - 100, ACTOR_USER).run();
const over = await upload(jpeg(500));
check('3) chegaradan oshgan yuklash rad etildi',
  [over.status, over.body?.error], [429, 'quota_exceeded']);
check('3) javob chegarani MB da aytadi', over.body?.quotaMb, QUOTA_MB);
checkTrue('3) javob ishlatilgan hajmni ham aytadi', Number(over.body?.usedMb) >= QUOTA_MB - 1);

// ── 4) BOSHQA ODAM TA'SIRLANMAYDI ────────────────────────────────────
// Kvota — SHAXSIY. Bitta odamning chegarani to'ldirgani boshqalarning
// ilovasini ishdan chiqarsa, bu himoya emas, balki bitta odam butun
// xizmatni to'xtatadigan teshik bo'lardi.
const otherUp = await upload(jpeg(700), { cookie: cookie.other });
check('4) boshqa foydalanuvchi bemalol yukladi', otherUp.status, 200);
check('4) uning hisobi alohida', Number((await quotaRow(ACTOR_OTHER))?.bytes), 700);

// ── 5) ADMIN KVOTAGA TUSHMAYDI ───────────────────────────────────────
// Admin yangilik rasmi va moliya hujjatini yuklaydi — bu kundalik ish
// va u allaqachon admin sessiyasi bilan himoyalangan.
const adminUp = await worker.fetch(new Request('https://nfcstore.uz/api/admin/upload-file', {
  method: 'POST',
  headers: { cookie: 'nfc_admin_session=admin-token', 'content-type': 'image/jpeg', 'content-length': '900', 'cf-connecting-ip': '198.51.100.71' },
  body: jpeg(900),
}), env);
check('5) admin yukladi', adminUp.status, 200);
checkTrue('5) admin uchun kvota qatori yaratilmadi',
  !(await env.DB.prepare(`SELECT 1 FROM upload_quota WHERE key LIKE 'admin:%'`).first()));

// ── 6) YANGI KUN — HISOB NOLDAN ──────────────────────────────────────
await env.DB.prepare(`UPDATE upload_quota SET day = '2000-01-01' WHERE key = ?`).bind(ACTOR_USER).run();
const nextDay = await upload(jpeg(400));
check('6) yangi kunda yuklash yana ochildi', nextDay.status, 200);
const row6 = await quotaRow(ACTOR_USER);
check('6) hisob noldan boshlandi', [Number(row6?.bytes), row6?.day], [400, today()]);

// ── 7) ESKI base64 YO'LI HAM SHU KVOTADA ─────────────────────────────
// Aks holda chegara shunchaki boshqa endpoint orqali aylanib o'tilardi.
const dataUrl = `data:image/png;base64,${Buffer.from(
  Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...new Array(56).fill(7)]),
).toString('base64')}`;
await env.DB.prepare(`UPDATE upload_quota SET bytes = ? WHERE key = ?`)
  .bind(QUOTA_MB * MB - 10, ACTOR_USER).run();
const b64 = await worker.fetch(req('/api/upload', { method: 'POST', cookie: cookie.user, json: { dataUrl } }), env);
const b64Body = await b64.json().catch(() => null);
check('7) base64 yo‘li ham to‘xtatildi', [b64.status, b64Body?.error], [429, 'quota_exceeded']);

// ── 8) MUDDATI O'TGAN ISTORYA FAYLI R2 DAN O'CHADI ───────────────────
// Kvotani bo'shatamiz, aks holda quyidagi yuklashlar to'xtaydi.
await env.DB.prepare(`DELETE FROM upload_quota`).run();

const put = async (name, bytes = jpeg(32)) => { await env.UPLOADS.put(`uploads/${name}`, bytes); return `/uploads/${name}`; };
const exists = async (name) => !!(await env.UPLOADS.head(`uploads/${name}`));

const staleName = 'story_aaaaaaaaaaaa.jpg';
const staleUrl = await put(staleName);
await env.DB.prepare(
  `INSERT INTO stories (owner_kind, owner_id, user_id, image_url, created_at, expires_at)
   VALUES ('card', 'VIP001', 1, ?, '2020-01-01T00:00:00.000Z', '2020-01-02T00:00:00.000Z')`,
).bind(staleUrl).run();

// Yangi istorya qo'shilishi tozalashni ishga tushiradi.
const freshUrl = await put('story_bbbbbbbbbbbb.jpg');
const add = await worker.fetch(req('/api/records/VIP001/stories', {
  method: 'POST', cookie: cookie.user, json: { imageUrl: freshUrl, agreed: true },
}), env);
checkTrue('8) yangi istorya qo‘shildi', [200, 201].includes(add.status));
checkTrue('8) muddati o‘tgan istorya FAYLI R2 dan o‘chdi', !(await exists(staleName)));
checkTrue('8) yangi istorya fayli JOYIDA', await exists('story_bbbbbbbbbbbb.jpg'));

// ── 9) POSTDA ISHLATILAYOTGAN FAYL O'CHIRILMAYDI ─────────────────────
// Eng xavfli xato aynan shu bo'lardi: odam istoryadagi rasmni postga
// ham qo'ygan bo'lsa, tozalash uning POSTINI buzib qo'yardi. Buni
// qaytarib bo'lmaydi.
const sharedName = 'story_cccccccccccc.jpg';
const sharedUrl = await put(sharedName);
await env.DB.prepare(
  `INSERT INTO stories (owner_kind, owner_id, user_id, image_url, created_at, expires_at)
   VALUES ('card', 'VIP001', 1, ?, '2020-01-01T00:00:00.000Z', '2020-01-02T00:00:00.000Z')`,
).bind(sharedUrl).run();
await env.DB.prepare(`INSERT INTO posts (id, code, user_id, image_url, created_at) VALUES (9001, 'VIP001', 1, ?, '2020-01-01T00:00:00.000Z')`)
  .bind(sharedUrl).run();

await worker.fetch(req('/api/records/VIP001/stories', {
  method: 'POST', cookie: cookie.user, json: { imageUrl: await put('story_dddddddddddd.jpg'), agreed: true },
}), env);
checkTrue('9) postda ishlatilayotgan fayl SAQLANDI', await exists(sharedName));

// ── 10) ISTORYA BO'LMAGAN FAYLGA TEGILMAYDI ──────────────────────────
// Avatar va muqova boshqa prefiks bilan yuklanadi. Agar tozalash
// naqshi kengayib ketsa, u odamlarning avatarini o'chira boshlardi.
const avatarName = 'file_eeeeeeeeeeee.jpg';
const avatarUrl = await put(avatarName);
await env.DB.prepare(
  `INSERT INTO stories (owner_kind, owner_id, user_id, image_url, created_at, expires_at)
   VALUES ('card', 'VIP001', 1, ?, '2020-01-01T00:00:00.000Z', '2020-01-02T00:00:00.000Z')`,
).bind(avatarUrl).run();
await worker.fetch(req('/api/records/VIP001/stories', {
  method: 'POST', cookie: cookie.user, json: { imageUrl: await put('story_ffffffffffff.jpg'), agreed: true },
}), env);
checkTrue('10) istorya prefiksi bo‘lmagan fayl saqlandi', await exists(avatarName));

done();
