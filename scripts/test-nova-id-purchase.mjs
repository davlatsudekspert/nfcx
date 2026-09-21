// SHAXSIY NFC ID XARIDI — ILOVA ISHLATADIGAN SHARTNOMA.
//
// ═══ NIMA UCHUN BU FAYL BOR ═══
//
// Ilovadagi ID qidirish / katalog / checkout SAYTNING O'Z
// endpointlaridan foydalanadi. Ya'ni ilova uchun alohida katalog,
// alohida narx jadvali yoki alohida to'lov backendi YO'Q. Bu test
// aynan shuni qo'riqlaydi: agar kimdir kelajakda ilova uchun
// "qulayroq" parallel yo'l ochsa yoki narxni klientdan qabul
// qiladigan qilsa — shu yerda yiqiladi.
//
// Eng muhim qoida: NARXNI SERVER HISOBLAYDI. Klient yuborgan summa
// hech qachon e'tiborga olinmaydi va soxta "to'landi" holati
// yaratib bo'lmaydi.
//
//   node scripts/test-nova-id-purchase.mjs

import worker, { ensureCoreSchema, PERSONAL_TIER_PRICE } from '../hosting/worker.js';
import { makeEnv, seedBasic, req, cookie, makeChecker } from './lib/d1-harness.mjs';

const { check, checkTrue, done } = makeChecker();

const { env } = makeEnv({
  PAYMENTS_ENABLED: 'true',
  PAYME_MERCHANT_ID: 'test-merchant',
  PAYME_KEY: 'test-key',
  // Click ham yoqilgan: 9-bo'lim qaytish manzilini tekshiradi.
  CLICK_SERVICE_ID: 'test-service',
  CLICK_SECRET_KEY: 'test-click-secret',
  CLICK_MERCHANT_ID: 'test-click-merchant',
  CLICK_RETURN_URL: 'https://nfcstore.uz/tolovlar',
});
await ensureCoreSchema(env);
await seedBasic(env);

const get = (path, init = {}) => worker.fetch(req(path, init), env);
const post = (path, json, init = {}) =>
  worker.fetch(req(path, { method: 'POST', json, ...init }), env);

// ===== 1) NARX JADVALI — ILOVA UCHUN YAGONA MANBA =====
{
  const res = await get('/api/settings/id-pricing');
  const body = await res.json();
  check('1) id-pricing 200', res.status, 200);

  const byTier = Object.fromEntries((body.tiers || []).map((t) => [t.tier, t.price]));
  // Jadval XUDDI xarid oqimidagi konstantadan kelishi SHART. Nusxa
  // ko'chirilgan bo'lsa, biri o'zgarib ikkinchisi eskirib qolardi va
  // katalogdagi summa to'lanadigan summadan farq qilardi.
  check('1) narxlar PERSONAL_TIER_PRICE dan', byTier, {
    free: PERSONAL_TIER_PRICE.free,
    silver: PERSONAL_TIER_PRICE.silver,
    gold: PERSONAL_TIER_PRICE.gold,
    premium: PERSONAL_TIER_PRICE.premium,
    exclusive: PERSONAL_TIER_PRICE.exclusive,
  });
  check('1) valyuta', body.currency, 'UZS');
  checkTrue('1) ekslyuziv "dan boshlanadi" deb belgilangan',
    (body.tiers || []).some((t) => t.tier === 'exclusive' && t.from === true));
}

// ===== 2) KOD HOLATI — HECH NARSANI BAND QILMAYDI =====
let freeQuote = null;
{
  // Bo'sh kod: sotib olsa bo'ladi.
  let res = await get('/api/records/QWE321/quote');
  freeQuote = await res.json();
  check('2) bo‘sh kod 200', res.status, 200);
  check('2) egasi yo‘q', [freeQuote.taken, freeQuote.purchasable], [false, true]);
  checkTrue('2) summa bor', Number(freeQuote.amount) > 0);

  // Egasi bor kod: sotib bo'lmaydi.
  res = await get('/api/records/VIP001/quote');
  const taken = await res.json();
  check('2) band kod -> taken', [taken.taken, taken.purchasable, taken.reason],
    [true, false, 'already_taken']);

  // MUHIM: narx so'rash BAND QILMASLIGI kerak. Ilgari narxni
  // bilishning yagona yo'li buyurtma yaratish edi va "narxini
  // ko'ray" degan odam kodni 24 soatga band qilib ketardi.
  const rows = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM web_orders WHERE code = 'QWE321'`).first();
  check('2) quote buyurtma YARATMAYDI', Number(rows.n), 0);
}

// ===== 3) SESSIYASIZ SOTIB OLIB BO'LMAYDI =====
{
  const res = await post('/api/records/QWE321', { name: 'Test' });
  check('3) sessiyasiz -> 401', res.status, 401);
}

// ===== 4) NARXNI SERVER HISOBLAYDI =====
let orderId = null;
{
  // Klient ataylab kulgili narx yuboradi.
  const res = await post('/api/records/QWE321',
    { name: 'Test', price: 1, amount: 1, total: 1 }, { cookie: cookie.user });
  const body = await res.json();
  check('4) buyurtma yaratildi -> 202', res.status, 202);
  check('4) narx KLIENTDAN OLINMADI', body.price, freeQuote.amount);
  checkTrue('4) orderId bor', Number.isInteger(body.orderId));
  checkTrue('4) to‘lov havolasi bor', typeof body.payLink === 'string' && body.payLink.length > 0);
  orderId = body.orderId;

  const row = await env.DB.prepare(
    `SELECT price, status FROM web_orders WHERE id = ?`).bind(orderId).first();
  check('4) bazada ham server narxi', [Number(row.price), row.status],
    [freeQuote.amount, 'pending']);
}

// ===== 5) BITTA KOD — BITTA BAND QILISH =====
{
  // Boshqa odam o'sha kodni ololmaydi: bu FAQAT interfeys tugmasini
  // o'chirish bilan emas, BAZA darajasida kafolatlanadi.
  const res = await post('/api/records/QWE321', { name: 'Ikkinchi' }, { cookie: cookie.other });
  check('5) parallel xarid -> 409', res.status, 409);
  check('5) sababi aniq', (await res.json()).error, 'reserved_pending_payment');

  const rows = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM web_orders WHERE code = 'QWE321' AND status = 'pending'`).first();
  check('5) baribir bitta pending', Number(rows.n), 1);

  // Band qilingan kod endi katalogda "sotib olib bo'lmaydi".
  const q = await (await get('/api/records/QWE321/quote')).json();
  check('5) quote band deb ko‘rsatadi', [q.purchasable, q.reason],
    [false, 'reserved_pending_payment']);
}

// ===== 6) TO'LANMAGUNCHA ID BERILMAYDI =====
{
  const card = await env.DB.prepare(`SELECT code FROM cards WHERE code = 'QWE321'`).first();
  check('6) to‘lovsiz karta YARATILMAGAN', card ?? null, null);

  // Buyurtma holati — ilova shu yo'ldan qayta tekshiradi.
  const res = await get(`/api/orders/${orderId}`, { cookie: cookie.user });
  const body = await res.json();
  check('6) holat pending', [res.status, body.status, body.code], [200, 'pending', 'QWE321']);

  // BEGONA BUYURTMA KO'RINMAYDI.
  const foreign = await get(`/api/orders/${orderId}`, { cookie: cookie.other });
  check('6) begona buyurtma -> 404', foreign.status, 404);
}

// ===== 7) SOTIB OLINMAYDIGAN KODLAR =====
{
  // 8 xonali avtomatik-bepul ID shakli — ro'yxatdan o'tishda
  // beriladi, sotilmaydi.
  const res = await get('/api/records/12345678/quote');
  const body = await res.json();
  check('7) avtomatik-bepul shakl sotilmaydi', body.purchasable, false);

  const buy = await post('/api/records/12345678', { name: 'X' }, { cookie: cookie.user });
  checkTrue('7) xarid ham rad etiladi', buy.status === 409 || buy.status === 400);
}

// ===== 8) TO'LOVLAR TARIXI SERVERDAN =====
{
  const res = await get('/api/orders', { cookie: cookie.user });
  const body = await res.json();
  const mine = (body.orders || []).find((o) => o.id === orderId);
  checkTrue('8) buyurtma tarixda bor', !!mine);
  check('8) tarixda kod va narx', [mine.code, Number(mine.price)],
    ['QWE321', freeQuote.amount]);
  check('8) kutilayotganiga to‘lov havolasi', typeof mine.payLink, 'string');
}

// ===== 9) CLICK — QAYTISH MANZILI HAVOLAGA TUSHADI =====
//
// 2026-09-15 dagi Worker ko'chishida `CLICK_RETURN_URL` yo'qolgan
// edi va Click'da to'lovni tugatgan odam saytga umuman qaytmasdi.
// Kod uni `return_url` sifatida qo'shadi, lekin FAQAT qiymat
// mavjud bo'lsa — ya'ni yo'qolishi JIM bo'lardi.
{
  const res = await get('/api/orders', { cookie: cookie.user });
  const order = ((await res.json()).orders || []).find((o) => o.id === orderId);
  const click = order?.payLinks?.click || '';
  checkTrue('9) Click havolasi bor', click.startsWith('https://my.click.uz/'));

  const u = new URL(click);
  check('9) qaytish manzili havolada', u.searchParams.get('return_url'),
    'https://nfcstore.uz/tolovlar');
  // Summa va buyurtma raqami ham havolada — ikkalasi SERVERDAN.
  check('9) summa va buyurtma havolada',
    [u.searchParams.get('amount'), u.searchParams.get('transaction_param')],
    [String(freeQuote.amount), String(orderId)]);

  // Qiymat olib tashlansa havola baribir quriladi, lekin
  // `return_url` YO'QOLADI — aynan shu jim uzilish.
  const saved = env.CLICK_RETURN_URL;
  delete env.CLICK_RETURN_URL;
  const res2 = await get('/api/orders', { cookie: cookie.user });
  const order2 = ((await res2.json()).orders || []).find((o) => o.id === orderId);
  const click2 = new URL(order2.payLinks.click);
  check('9) sozlama yo\u2018q -> qaytish manzili yo\u2018q',
    click2.searchParams.get('return_url'), null);
  env.CLICK_RETURN_URL = saved;
}

done();
