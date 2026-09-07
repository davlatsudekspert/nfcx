// To'lov tizimlari: Payme + Click (2026-09).
//   node scripts/test-payment-providers.mjs
//
// QAMROV:
//   1. /api/settings/payments-enabled har bir tizim holatini alohida
//      qaytaradi va MAXFIY qiymatlarni oshkor qilmaydi.
//   2. "Sotilgan" mezoni PROVAYDERDAN MUSTAQIL — Click orqali sotilgan
//      ID ham ro'yxatda ko'rinadi. Bu eng muhim tekshiruv: mezon faqat
//      `payme_transaction_id` ga bog'langan bo'lsa, Click ulangan kuni
//      sotuvlar jimgina ko'rinmay qolardi.
import worker, { paymeCheckoutLinkD1 } from '../hosting/worker.js';
import { makeEnv, seedBasic, req, makeChecker } from './lib/d1-harness.mjs';

const { env } = makeEnv();
await seedBasic(env);
const { check, checkTrue, done } = makeChecker();
const j = async (pathname, e = env) => {
  const r = await worker.fetch(req(pathname), e);
  let body = null; try { body = await r.json(); } catch { body = null; }
  return { status: r.status, body };
};

// ═══ 1. Provayder holatlari ═══
{
  // (a) hech narsa yoqilmagan
  const off = await j('/api/settings/payments-enabled');
  check('kalitlarsiz — hammasi o\'chiq',
    [off.body?.enabled, off.body?.providers?.payme?.enabled, off.body?.providers?.click?.enabled],
    [false, false, false]);

  // (b) faqat Payme
  const e1 = { ...env, PAYMENTS_ENABLED: 'true', PAYME_MERCHANT_ID: 'm', PAYME_KEY: 'k' };
  const only = await j('/api/settings/payments-enabled', e1);
  check('faqat Payme yoqilgan',
    [only.body?.providers?.payme?.enabled, only.body?.providers?.click?.enabled], [true, false]);
  check('umumiy `enabled` — bittasi yetarli', only.body?.enabled, true);

  // (c) faqat Click
  const e2 = { ...env, PAYMENTS_ENABLED: 'true', CLICK_SERVICE_ID: 's', CLICK_SECRET_KEY: 'sk' };
  const clk = await j('/api/settings/payments-enabled', e2);
  check('faqat Click yoqilgan',
    [clk.body?.providers?.payme?.enabled, clk.body?.providers?.click?.enabled], [false, true]);
  check('Click yolg\'iz bo\'lsa ham to\'lov ochiq', clk.body?.enabled, true);

  // (d) umumiy bayroq o'chiq bo'lsa — kalitlar bo'lsa ham yopiq
  const e3 = { ...env, PAYMENTS_ENABLED: 'false', PAYME_MERCHANT_ID: 'm', PAYME_KEY: 'k', CLICK_SERVICE_ID: 's', CLICK_SECRET_KEY: 'sk' };
  const shut = await j('/api/settings/payments-enabled', e3);
  check('umumiy bayroq o\'chiq — hammasi yopiq',
    [shut.body?.enabled, shut.body?.providers?.payme?.enabled, shut.body?.providers?.click?.enabled],
    [false, false, false]);

  // MAXFIYLIK: javobda kalitlarning o'zi BO'LMASLIGI shart.
  const raw = JSON.stringify(clk.body);
  checkTrue('javobda maxfiy kalitlar yo\'q', !/sk|secret|CLICK_SECRET/i.test(raw));
}

// ═══ 2. CLICK orqali sotilgan ID "Sotilgan"da ko'rinadi ═══
{
  const now = new Date().toISOString();
  await env.DB.prepare(`INSERT INTO cards (code,name,price,ts,user_id,profile_type,tier_override)
    VALUES ('CLK777','G''olib',3000000,?,1,'personal','exclusive')`).bind(Date.now()).run();
  await env.DB.prepare(`INSERT INTO auctions (id,code,seller_id,start_price,current_price,highest_bidder_id,ends_at,status,min_increment,created_at)
    VALUES (600,'CLK777',NULL,100000,3000000,1,?,'sold',25000,?)`).bind(now, now).run();
  await env.DB.prepare(`INSERT INTO bids (auction_id,user_id,amount,created_at) VALUES (600,1,3000000,?)`).bind(now).run();

  // (a) to'lov yo'q -> ko'rinmaydi
  let r = await j('/api/auctions?withSold=1');
  check('to\'lovsiz — ko\'rinmaydi', (r.body?.sold || []).some((x) => x.code === 'CLK777'), false);

  // (b) CLICK to'lovi bor -> KO'RINADI (payme_transaction_id BO'SH!)
  await env.DB.prepare(`INSERT INTO web_orders (user_id,code,kind,price,payload,status,click_transaction_id)
    VALUES (1,'CLK777','auction_payment',3000000,'{}','paid','click-tx-1')`).run();
  r = await j('/api/auctions?withSold=1');
  const row = (r.body?.sold || []).find((x) => x.code === 'CLK777');
  checkTrue('Click orqali sotilgan ID "Sotilgan"da CHIQADI', !!row);
  check('narxi to\'g\'ri', row?.currentPrice, 3000000);

  // (c) katalogda ham "Sovg'a" emas, HAQIQIY narx
  const cat = await j('/api/records');
  const card = (cat.body || []).find((x) => x.code === 'CLK777');
  check('katalogda sovg\'a deb belgilanmaydi', card?.isGift, false);
  check('katalogda yakuniy narx', card?.price, 3000000);
}

// ═══ 3. SUMMA BIRLIGI — eng xavfli joy ═══
// Payme summani TIYINDA (x100), Click esa SO'MDA kutadi. Bu yerda
// adashish mijozdan 100 BAROBAR ko'p yoki kam yechilishiga olib keladi.
// Checkout havolasidagi summa shu sababli aniq qulflanadi.
{
  const e = { PAYME_MERCHANT_ID: 'M1', PAYME_CHECKOUT_DOMAIN: 'checkout.paycom.uz' };
  const decode = (link) => Buffer.from(link.split('/').pop(), 'base64').toString();

  check("149 000 so'm -> 14 900 000 tiyin", decode(paymeCheckoutLinkD1(e, 7, 149000)), 'm=M1;ac.order_id=7;a=14900000');
  check("20 000 so'm -> 2 000 000 tiyin", decode(paymeCheckoutLinkD1(e, 7, 20000)), 'm=M1;ac.order_id=7;a=2000000');
  check("8 700 000 so'm -> 870 000 000 tiyin", decode(paymeCheckoutLinkD1(e, 7, 8700000)), 'm=M1;ac.order_id=7;a=870000000');

  // Teskari xatolar: summa 100 barobar kichik yoki katta bo'lib qolmasin.
  const d = decode(paymeCheckoutLinkD1(e, 7, 149000));
  checkTrue('summa so\'mda qolib ketmagan (a=149000 EMAS)', !/;a=149000$/.test(d));
  checkTrue('summa ikki marta ko\'paytirilmagan (a=1490000000 EMAS)', !/;a=1490000000$/.test(d));

  // Kasrli so'm butun tiyinga yaxlitlanadi (kasr tiyin bo'lmaydi).
  check('kasrli summa yaxlitlanadi', decode(paymeCheckoutLinkD1(e, 7, 149000.4)), 'm=M1;ac.order_id=7;a=14900040');

  // Merchant ID yo'q bo'lsa havola YARATILMAYDI (bo'sh satr) — noto'g'ri
  // havola bilan mijozni Payme ga yubormaslik uchun.
  check('merchant ID siz havola yaratilmaydi', paymeCheckoutLinkD1({}, 7, 149000), '');
}

done();
