// Per-code narx (source of truth) + auksion "Sotilgan" bo'limi testi.
//   node scripts/test-code-prices-and-sold.mjs
import worker from '../hosting/worker.js';
import { codePriceOverride, CODE_PRICES } from '../src/lib/codePrices.js';
import { priceForCode, TIER_PRICE, tierForCode, getPersonalPurchaseQuote } from '../src/lib/pricing.js';
import { makeEnv, seedBasic, req, makeChecker } from './lib/d1-harness.mjs';

const { env } = makeEnv();
await seedBasic(env);
const { check, checkTrue, done } = makeChecker();
const j = async (pathname, init) => {
  const r = await worker.fetch(req(pathname, init), env);
  let body = null; try { body = await r.json(); } catch { body = null; }
  return { status: r.status, body };
};

// ═══ 1. BESHTA ANIQ ID — narx va BIRLIK (so'm, tiyin emas) ═══
const EXPECT = { OOO000: 8_700_000, VVV444: 2_900_000, BMW007: 199_000, VIP001: 7_600_000, VIP000: 9_700_000 };
{
  for (const [code, want] of Object.entries(EXPECT)) {
    check(`${code} -> ${want.toLocaleString('uz-UZ')} so'm`, priceForCode(code).total, want);
  }
  // Birlik nazorati: qiymatlar so'mda. 8 700 000 tasodifan 87 000 yoki
  // 870 000 000 bo'lib qolmasin.
  check('OOO000 is 8.7M so‘m, not 87 000 and not 870 000 000', [
    priceForCode('OOO000').total === 87_000,
    priceForCode('OOO000').total === 870_000_000,
    priceForCode('OOO000').total === 8_700_000,
  ], [false, false, true]);
  // Katta-kichik harf farqi yo'q, kanonik ko'rinish saqlanadi
  check('lookup is case-insensitive', [codePriceOverride('ooo000'), codePriceOverride('Vip001')], [8_700_000, 7_600_000]);
  checkTrue('canonical keys stay uppercase', Object.keys(CODE_PRICES).every((k) => k === k.toUpperCase()));
  // OOO000 — birinchi uchtasi lotincha "O" harfi (raqam nol emas)
  check('OOO000 starts with three latin letter O', 'OOO000'.slice(0, 3), 'OOO');
  checkTrue('OOO000 key exists exactly (not 000000)', Object.prototype.hasOwnProperty.call(CODE_PRICES, 'OOO000'));
}

// ═══ 2. UMUMIY TARIF NARXLARI ═══
{
  check('Premium tariff = 199 000', TIER_PRICE.premium, 199_000);
  check('Silver tariff = 99 000', TIER_PRICE.silver, 99_000);
  check('Bronze tariff = 49 000', TIER_PRICE.free, 49_000);
  check('Gold tariff UNCHANGED = 149 000', TIER_PRICE.gold, 149_000);
  // Ro'yxatda bo'lmagan kodlar tarif narxini oladi
  check('a non-listed Premium code uses the tariff', priceForCode('BMW010').total, 199_000);
  check('a non-listed Gold code keeps 149 000', priceForCode('ABZ007').total, 149_000);
  checkTrue('a non-listed code has no price override', codePriceOverride('ABZ007') === null);
}

// ═══ 3. FRONTEND va WORKER narx manbai BIR XIL ═══
{
  await env.DB.prepare(`INSERT INTO cards (code, name, price, ts, user_id, profile_type) VALUES ('OOO000','Owner A', 1, 5000, 1, 'personal')`).run();
  await env.DB.prepare(`INSERT INTO cards (code, name, price, ts, user_id, profile_type) VALUES ('VVV444','Owner B', 1, 4900, 1, 'personal')`).run();
  await env.DB.prepare(`INSERT INTO cards (code, name, price, ts, user_id, profile_type) VALUES ('VIP000','Owner C', 1, 4800, 1, 'personal')`).run();
  // VIP001 fixture'da allaqachon bor (price 199000) — override uni ustidan bosishi kerak
  const r = await j('/api/records');
  const by = Object.fromEntries((r.body || []).map((x) => [x.code, x]));
  let bad = 0;
  for (const [code, want] of Object.entries(EXPECT)) {
    if (!by[code]) continue;
    if (by[code].price !== want) { console.log('   API price mismatch:', code, by[code].price, 'want', want); bad++; }
  }
  check('catalog API serves the override price for every listed id present', bad, 0);
  check('VIP001 stored price (199 000) is overridden by the source of truth', by.VIP001?.price, 7_600_000);
  // 2026-09: katalog narxining yagona manbai TARIF jadvaliga o'tdi
  // (hosting/worker.js catalogPriceD1). OTH222 -> Gold tarifi -> 149 000.
  // Saqlangan `cards.price` (49 000) endi faqat zaxira qiymat.
  check('an ordinary card is priced from its TARIFF (OTH222 -> Gold 149 000)', by.OTH222?.price, 149_000);

  const s = await j('/api/records/search?q=OOO');
  const hit = (s.body?.records || []).find((x) => x.code === 'OOO000');
  check('search results use the same price source', hit?.price, 8_700_000);
}

// ═══ 4. AUKSION "SOTILGAN" — egasi bor ekslyuziv ID'lar ═══
{
  // Egasi YO'Q ekslyuziv karta — "Sotilgan"ga TUSHMASLIGI kerak
  await env.DB.prepare(`INSERT INTO cards (code, name, price, ts, user_id, profile_type) VALUES ('CEO999','Egasiz', 500000, 4700, NULL, 'personal')`).run();
  // Ekslyuziv, egasi bor, LEKIN narxi yo'q -> o'ylab topilmaydi
  await env.DB.prepare(`INSERT INTO cards (code, name, price, ts, user_id, profile_type) VALUES ('ACE321','Narxsiz', 0, 4600, 1, 'personal')`).run();

  const r = await j('/api/auctions?withSold=1');
  const sold = r.body?.sold || [];
  const codes = sold.map((x) => x.code);

  for (const code of ['OOO000', 'VVV444', 'VIP001', 'VIP000']) {
    checkTrue(`${code} appears in the Sold section`, codes.includes(code));
  }
  check('BMW007 (Premium) is NOT added as Exclusive-sold', codes.includes('BMW007'), false);
  check('an Exclusive id with NO owner is not shown as sold', codes.includes('CEO999'), false);
  check('an Exclusive id with no known price is not shown (no invented price)', codes.includes('ACE321'), false);
  check('a non-exclusive owned card is not shown as sold', codes.includes('OTH222'), false);
  check('no duplicate codes in the sold list', codes.length, new Set(codes).size);

  const byCode = Object.fromEntries(sold.map((x) => [x.code, x]));
  check('sold card carries the exact price', [
    byCode.OOO000?.currentPrice, byCode.VVV444?.currentPrice,
    byCode.VIP001?.currentPrice, byCode.VIP000?.currentPrice,
  ], [8_700_000, 2_900_000, 7_600_000, 9_700_000]);
  check('sold card carries the tier', byCode.OOO000?.tier, 'exclusive');
  check('sold card carries a public profile link code', byCode.VIP001?.profileCode, 'VIP001');
  checkTrue('owned sale is flagged and has no auction id', byCode.VIP001?.ownedSale === true && byCode.VIP001?.id === null);

  // HECH QANDAY soxta auksion/taklif/tranzaksiya yozuvi yaratilmasin
  const a = await env.DB.prepare(`SELECT COUNT(*) AS n FROM auctions`).first();
  const b = await env.DB.prepare(`SELECT COUNT(*) AS n FROM bids`).first();
  const w = await env.DB.prepare(`SELECT COUNT(*) AS n FROM web_orders`).first();
  check('no fake auction / bid / order rows were created', [Number(a.n), Number(b.n), Number(w.n)], [0, 0, 0]);
}

// ═══ 5. Haqiqiy auksion-sotilgan bilan takrorlanmaslik ═══
{
  await env.DB.prepare(
    `INSERT INTO auctions (id, code, seller_id, start_price, current_price, ends_at, status, min_increment, created_at)
     VALUES (700, 'VIP000', NULL, 100000, 9700000, ?, 'sold', 25000, ?)`
  ).bind(new Date().toISOString(), new Date().toISOString()).run();
  const r = await j('/api/auctions?withSold=1');
  const codes = (r.body?.sold || []).map((x) => x.code);
  check('VIP000 appears exactly once when a real sold auction exists', codes.filter((c) => c === 'VIP000').length, 1);
  const entry = (r.body?.sold || []).find((x) => x.code === 'VIP000');
  checkTrue('the REAL auction row wins over the computed one', entry.id === 700 && !entry.ownedSale);
}

// ═══ 6. Sovg'a / pullik / ekslyuziv kartalar aralashmaydi ═══
{
  await env.DB.prepare(`INSERT INTO cards (code, name, price, ts, user_id, profile_type) VALUES ('GFT100','Sovga', 0, 4500, 1, 'personal')`).run();
  await env.DB.prepare(
    `INSERT INTO nfc_gifts (code, recipient_name, note, value, activation_code, status, created_at)
     VALUES ('GFT100','Sovga','',0,'ACT777','activated', ?)`
  ).bind(new Date().toISOString()).run();
  const r = await j('/api/records');
  const by = Object.fromEntries((r.body || []).map((x) => [x.code, x]));
  check('gift card is flagged as a gift', by.GFT100?.isGift, true);
  check('a listed-price exclusive card is NOT flagged as a gift', by.OOO000?.isGift, false);
  check('an ordinary paid card is not a gift', by.OTH222?.isGift, false);
}

// ═══ 7. RASMIY NARX ESKI AUKSION NATIJASIDAN USTUN (2026-09 hotfix) ═══
// Muammo: OOO000 va VVV444 katalogda ESKI auksion g'olib taklifini
// (200 000 / 300 000) ko'rsatardi, auksionning "Sotilgan" bo'limi esa
// rasmiy narxni (8 700 000 / 2 900 000) — bitta ID, ikki xil narx.
// Endi egasining ro'yxati (CODE_PRICES) ikkala joyda ham ustun turadi.
{
  const now = new Date().toISOString();
  // Ishlab chiqarishdagi holat: auksion yozuvining narxi YANGILANGAN
  // (8 700 000), lekin ESKI g'olib taklifi (bids.amount) 200 000 bo'lib
  // qolgan — aynan shu eski taklif katalogga sizib chiqardi.
  await env.DB.prepare(
    `INSERT INTO auctions (id, code, seller_id, start_price, current_price, highest_bidder_id, ends_at, status, min_increment, created_at)
     VALUES (901, 'OOO000', NULL, 100000, 8700000, 1, ?, 'sold', 25000, ?)`
  ).bind(now, now).run();
  await env.DB.prepare(`INSERT INTO bids (id, auction_id, user_id, amount, created_at) VALUES (9001, 901, 1, 200000, ?)`).bind(now).run();

  // Ro'yxatda BO'LMAGAN kod — auksion yakuniy narxi o'z kuchida qolishi kerak.
  await env.DB.prepare(`INSERT INTO cards (code, name, price, ts, user_id, profile_type) VALUES ('PPP777','Mashrabboy', 50000, 4400, 1, 'personal')`).run();
  await env.DB.prepare(
    `INSERT INTO auctions (id, code, seller_id, start_price, current_price, highest_bidder_id, ends_at, status, min_increment, created_at)
     VALUES (902, 'PPP777', NULL, 100000, 3960000, 1, ?, 'sold', 25000, ?)`
  ).bind(now, now).run();
  await env.DB.prepare(`INSERT INTO bids (id, auction_id, user_id, amount, created_at) VALUES (9002, 902, 1, 3960000, ?)`).bind(now).run();

  const r = await j('/api/records');
  const by = Object.fromEntries((r.body || []).map((x) => [x.code, x]));
  check('OOO000 katalogda RASMIY narx (eski 200 000 taklif emas)', by.OOO000?.price, 8_700_000);
  check('VVV444 katalogda RASMIY narx', by.VVV444?.price, 2_900_000);
  check("ro'yxatda yo'q ID auksion yakuniy narxini saqlaydi (PPP777)", by.PPP777?.price, 3_960_000);

  // Katalog va auksion "Sotilgan" — AYNAN bir xil narx ko'rsatsin.
  const a = await j('/api/auctions?withSold=1');
  const sold = Object.fromEntries((a.body?.sold || []).map((x) => [x.code, x]));
  check('katalog va Sotilgan bo\'limi bir xil narx (OOO000)', by.OOO000?.price, sold.OOO000?.currentPrice);
  check('katalog va Sotilgan bo\'limi bir xil narx (VVV444)', by.VVV444?.price, sold.VVV444?.currentPrice);

  // Qidiruv ham shu yagona manbadan.
  const s2 = await j('/api/records/search?q=OOO');
  check('qidiruvda ham rasmiy narx', (s2.body?.records || []).find((x) => x.code === 'OOO000')?.price, 8_700_000);

  // Sovg'a bayrog'i narxdan MUSTAQIL — rasmiy narx uni bosib ketmasin.
  check('sovg\'a kartasi hamon sovg\'a', by.GFT100?.isGift, true);

  // Moliyaviy/auksion TARIXI tegilmagan: taklif summalari o'zgarmagan.
  const bidRow = await env.DB.prepare(`SELECT amount FROM bids WHERE id = 9001`).first();
  check('eski taklif summasi O\'ZGARTIRILMAGAN (tarix tegilmadi)', Number(bidRow.amount), 200000);
  const aucRow = await env.DB.prepare(`SELECT current_price FROM auctions WHERE id = 901`).first();
  check('auksion yozuvi O\'ZGARTIRILMAGAN', Number(aucRow.current_price), 8700000);
}

// ═══ 8. XXX772 — EKSLYUZIV, auksionda qo'yilgan narx saqlanadi ═══
// Egasining topshirig'i (2026-09): XXX772 katalogda Gold ko'rinardi.
// U ekslyuziv bo'lishi, narx esa (auksiondagi yakuniy 2 490 000)
// O'ZGARMASDAN qolishi kerak. Auksion sahifasi ham shu tarifni oladi
// (AuctionsPage: `a.tier || tierForCode(a.code)`).
{
  const now = new Date().toISOString();
  await env.DB.prepare(`INSERT INTO cards (code, name, price, ts, user_id, profile_type) VALUES ('XXX772','Ali', 2490000, 4300, 1, 'personal')`).run();
  await env.DB.prepare(
    `INSERT INTO auctions (id, code, seller_id, start_price, current_price, highest_bidder_id, ends_at, status, min_increment, created_at)
     VALUES (903, 'XXX772', NULL, 100000, 2490000, 1, ?, 'sold', 25000, ?)`
  ).bind(now, now).run();
  await env.DB.prepare(`INSERT INTO bids (id, auction_id, user_id, amount, created_at) VALUES (9003, 903, 1, 2490000, ?)`).bind(now).run();

  check('XXX772 tarifi EKSLYUZIV (Gold emas)', tierForCode('XXX772'), 'exclusive');
  const r = await j('/api/records');
  const by = Object.fromEntries((r.body || []).map((x) => [x.code, x]));
  check('XXX772 narxi O\'ZGARMAGAN (2 490 000)', by.XXX772?.price, 2_490_000);
  check('XXX772 Gold tarifi narxiga TUSHIB QOLMAGAN', by.XXX772?.price === TIER_PRICE.gold, false);

  // Auksion sahifasi tarifni kod bo'yicha hisoblaydi — u yerda ham ekslyuziv.
  const a = await j('/api/auctions?withSold=1');
  const sold = (a.body?.sold || []).find((x) => x.code === 'XXX772');
  check('auksionda ham narx bir xil', sold?.currentPrice, 2_490_000);
  check('auksionda ko\'rsatiladigan tarif ekslyuziv', sold?.tier || tierForCode('XXX772'), 'exclusive');

  // Ekslyuziv ID to'g'ridan-to'g'ri sotilmaydi (faqat auksion orqali).
  check('XXX772 to\'g\'ridan-to\'g\'ri sotib olinmaydi', getPersonalPurchaseQuote('XXX772').purchasable, false);
}

done();
