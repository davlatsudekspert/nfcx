// Jismoniy karta buyurtmasi + bosma maket (2026-09).
//
// Avval buyurtma bilan FAQAT manzil ketardi va admin nima chop etishni
// bilmasdi. Endi maket (old/orqa, 600 DPI PNG) yuklanadi va buyurtmaga
// biriktiriladi. Bu test uchta narsani qo'riqlaydi:
//
//   1. /api/upload-card-print faqat PNG va faqat tizimga kirgan
//      foydalanuvchidan qabul qiladi;
//   2. buyurtmaga FAQAT o'zimizning `/uploads/cardprint_*.png` havolasi
//      yoziladi — mijoz tashqi manzil yubora olmasin (admin paneli uni
//      ochadi, ya'ni bu SSRF/fishing yo'li bo'lardi);
//   3. admin buyurtmalar ro'yxatida maket va manzil ko'rinadi, boshqa
//      turdagi buyurtmalarda esa bu maydonlar umuman chiqmaydi.
//
//   node scripts/test-card-print-order.mjs
import worker from '../hosting/worker.js';
import { makeEnv, seedBasic, cookie, req, makeChecker } from './lib/d1-harness.mjs';

const { check, checkTrue, done } = makeChecker();
const { env } = makeEnv();
await seedBasic(env);

env.PAYMENTS_ENABLED = 'true';
env.PAYME_MERCHANT_ID = '6a9a5ff90a7dc281fc7e03e2';
env.PAYME_KEY = 'test_key_local_only';

const call = async (pathname, init) => {
  const res = await worker.fetch(req(pathname, init), env);
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
};

// Eng kichik yaroqli PNG (1x1) — sehrli baytlari haqiqiy.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
const NOT_PNG = Buffer.from('GIF89a hech qanday png emas');

const upload = (bytes, init = {}) => call('/api/upload-card-print', {
  method: 'POST', body: bytes, headers: { 'content-type': 'image/png' }, ...init,
});

// ── 1) Yuklash endpointi ───────────────────────────────────────────────
{
  check('1) sessiyasiz yuklash -> 401', (await upload(PNG)).status, 401);

  const ok = await upload(PNG, { cookie: cookie.user });
  check('1b) PNG qabul qilinadi', ok.status, 200);
  checkTrue('1c) havola /uploads/cardprint_<24 hex>.png shaklida',
    /^\/uploads\/cardprint_[0-9a-f]{24}\.png$/.test(ok.body?.url || ''));
  checkTrue('1d) R2 ga image/png sifatida yozildi',
    env.UPLOADS._store.get(String(ok.body.url).slice(1))?.httpMetadata.contentType === 'image/png');

  // Tur MIJOZ AYTGANIGA emas, sehrli baytlarga qarab aniqlanadi:
  // content-type: image/png deb yuborilgan GIF ham rad etiladi.
  const bad = await upload(NOT_PNG, { cookie: cookie.user });
  check('1e) PNG bo\'lmagan fayl rad etiladi', bad.status, 422);

  const big = await upload(Buffer.alloc(9 * 1024 * 1024, 1), { cookie: cookie.user });
  check('1f) 8 MB dan katta fayl rad etiladi', big.status, 413);

  // BAYTMA-BAYT BUTUNLIK. Maket bir necha megabayt bo'ladi; yo'lda bir
  // bayt o'zgarsa yoki fayl kesilsa, PNG umuman ochilmaydi va bosmaxona
  // uni qaytaradi. Shuning uchun katta, "haqiqiy" hajmdagi faylni
  // yuklab, R2'ga TUSHGAN baytlarni asl nusxa bilan solishtiramiz.
  const bigPng = Buffer.concat([
    PNG.subarray(0, 8),                       // PNG imzosi
    Buffer.alloc(1_500_000, 0),               // "og'ir" tana
    PNG.subarray(8),
  ]);
  const stored = await upload(bigPng, { cookie: cookie.user });
  check('1g) 1.5 MB maket qabul qilinadi', stored.status, 200);
  const saved = env.UPLOADS._store.get(String(stored.body.url).slice(1));
  const savedBytes = Buffer.from(saved?.bytes || new Uint8Array());
  check('1h) saqlangan hajm asl nusxaga teng', savedBytes.length, bigPng.length);
  checkTrue('1i) saqlangan baytlar AYNAN bir xil', savedBytes.equals(bigPng));
}

// ── 2) Buyurtmaga faqat O'ZIMIZNING havola yoziladi ────────────────────
// Kartani sotib olingan holatga keltiramiz (jismoniy karta dizayni
// silver va undan yuqori tarifda ochiladi).
await env.DB.prepare(`UPDATE cards SET tier_override = 'gold' WHERE code = 'VIP001'`).run();

const orderWith = async (design) => call('/api/records/VIP001/order-physical-card', {
  method: 'POST', cookie: cookie.user,
  json: { shippingName: 'Aziz', shippingPhone: '+998901112233', shippingAddress: 'Toshkent, 1-uy', ...design },
});
const payloadOf = async (orderId) => {
  const row = await env.DB.prepare(`SELECT payload FROM web_orders WHERE id = ?`).bind(orderId).first();
  return JSON.parse(row.payload);
};

let goodFront = '';
let goodBack = '';
{
  goodFront = (await upload(PNG, { cookie: cookie.user })).body.url;
  goodBack = (await upload(PNG, { cookie: cookie.user })).body.url;

  const r = await orderWith({ designFrontUrl: goodFront, designBackUrl: goodBack });
  check('2) buyurtma yaratildi', r.status, 202);
  const p = await payloadOf(r.body.orderId);
  check('2b) old tomon saqlandi', p.designFrontUrl, goodFront);
  check('2c) orqa tomon saqlandi', p.designBackUrl, goodBack);
  check('2d) bosma o\'lchami yozib qo\'yildi', p.printSpec, 'CR80 85.6x54mm · 600 DPI · 2022x1276 PNG');
  check('2e) manzil ham joyida', [p.shippingName, p.shippingPhone], ['Aziz', '+998901112233']);
}

// ── 2f) Yetkazib berish xizmati — faqat ro'yxatdagilardan ──────────────
// Erkin matn qabul qilinsa, admin har xil yozuvlarni ("bts", "BTS
// ekspress", "<script>") saralashga majbur bo'lardi.
{
  await env.DB.prepare(`UPDATE web_orders SET status = 'cancelled' WHERE status = 'pending'`).run();
  const good = await orderWith({ shippingCarrier: 'BTS Express' });
  check('2f) ro\'yxatdagi xizmat saqlanadi', (await payloadOf(good.body.orderId)).shippingCarrier, 'BTS Express');

  for (const bad of ['bts', 'Boshqa xizmat', '<script>alert(1)</script>', '']) {
    await env.DB.prepare(`UPDATE web_orders SET status = 'cancelled' WHERE status = 'pending'`).run();
    const r = await orderWith({ shippingCarrier: bad });
    check(`2g) ro'yxatda yo'q xizmat rad etiladi: ${JSON.stringify(bad).slice(0, 24)}`,
      (await payloadOf(r.body.orderId)).shippingCarrier, '');
  }
}

// Xavfsizlik: tashqi va aldamchi havolalarning HECH BIRI saqlanmaydi.
{
  const EVIL = [
    'https://evil.example/x.png',
    '//evil.example/x.png',
    '/uploads/../../etc/passwd',
    '/uploads/cardprint_zzz.png',
    'javascript:alert(1)',
    'data:image/png;base64,AAAA',
    goodFront + '?x=1',
    goodFront.toUpperCase(),
  ];
  for (const url of EVIL) {
    // Har safar yangi buyurtma: oldingisi "pending" bo'lib turmasin.
    await env.DB.prepare(`UPDATE web_orders SET status = 'cancelled' WHERE status = 'pending'`).run();
    const r = await orderWith({ designFrontUrl: url, designBackUrl: url });
    const p = await payloadOf(r.body.orderId);
    check(`3) rad etilgan havola: ${url.slice(0, 34)}`, [p.designFrontUrl, p.designBackUrl], ['', '']);
  }
}

// ── 3b) SONI — narx SERVERDA hisoblanadi ───────────────────────────────
// Mijoz yuborgan summaga ishonilsa, 1 so'mga 50 ta karta buyurtma qilish
// mumkin bo'lardi. Shu sabab `amount` faqat serverdan keladi.
{
  const FEE = 200000;
  for (const [n, expected] of [[1, FEE], [3, FEE * 3], [50, FEE * 50]]) {
    await env.DB.prepare(`UPDATE web_orders SET status = 'cancelled' WHERE status = 'pending'`).run();
    const r = await orderWith({ quantity: n });
    check(`3b) ${n} ta -> ${expected} so'm`, [r.body.amount, r.body.quantity], [expected, n]);
    check(`3b) ${n} ta payload'da saqlandi`, (await payloadOf(r.body.orderId)).quantity, n);
  }

  // Chegaradan tashqari va yaroqsiz qiymatlar — buyurtma UMUMAN
  // yaratilmaydi (422), jim tuzatilib qo'yilmaydi.
  for (const bad of [0, -1, 51, 1000, 2.5, 'ko\'p', null]) {
    await env.DB.prepare(`UPDATE web_orders SET status = 'cancelled' WHERE status = 'pending'`).run();
    const r = await orderWith({ quantity: bad });
    // `null` -> `?? 1` bo'yicha 1 ta deb qabul qilinadi (eski mijozlar
    // uchun moslik), qolganlari rad etiladi.
    if (bad === null) check('3b) quantity null -> 1 ta', r.body.quantity, 1);
    else check(`3b) yaroqsiz soni rad etiladi: ${JSON.stringify(bad)}`, r.status, 422);
  }
}

// ── 4) Admin ro'yxati ──────────────────────────────────────────────────
{
  await env.DB.prepare(`UPDATE web_orders SET status = 'cancelled' WHERE status = 'pending'`).run();
  const created = await orderWith({ designFrontUrl: goodFront, designBackUrl: goodBack });

  const r = await call('/api/admin/orders', { cookie: cookie.admin });
  check('4) admin ro\'yxati ochildi', r.status, 200);
  const row = (r.body.orders || []).find((o) => o.id === created.body.orderId);
  checkTrue('4b) buyurtma ro\'yxatda bor', !!row);
  check('4c) turi ko\'rsatilgan', row.kind, 'physical_card_order');
  check('4d) maket havolalari uzatildi', [row.designFrontUrl, row.designBackUrl], [goodFront, goodBack]);
  check('4e) manzil uzatildi', row.shippingName, 'Aziz');

  // Boshqa turdagi buyurtmalarda bu maydonlar UMUMAN bo'lmasligi kerak —
  // kerak bo'lmagan ma'lumot javobga tushmasin.
  const other = (r.body.orders || []).find((o) => o.kind && o.kind !== 'physical_card_order');
  if (other) {
    check('4f) boshqa turdagi buyurtmada maket maydonlari yo\'q',
      [('designFrontUrl' in other), ('shippingAddress' in other)], [false, false]);
  } else {
    check('4f) boshqa turdagi buyurtma yo\'q (o\'tkazildi)', true, true);
  }
}

done();
