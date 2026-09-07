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
  // BMW007 — ro'yxatdagi YAGONA ekslyuziv bo'lmagan kod (Premium).
  // Sovg'a qoidasi unga tegmasligini shu yerda tekshiramiz.
  await env.DB.prepare(`INSERT INTO cards (code, name, price, ts, user_id, profile_type) VALUES ('BMW007','Owner D', 5, 4750, 1, 'personal')`).run();
  // VIP001 fixture'da allaqachon bor (price 199000) — override uni ustidan bosishi kerak
  const r = await j('/api/records');
  const by = Object.fromEntries((r.body || []).map((x) => [x.code, x]));
  let bad = 0;
  for (const [code, want] of Object.entries(EXPECT)) {
    if (!by[code]) continue;
    if (by[code].price !== want) { console.log('   API price mismatch:', code, by[code].price, 'want', want); bad++; }
  }
  // 2026-09 QOIDA O'ZGARDI. Avval bu yerda ro'yxatdagi HAR BIR kod o'zining
  // rasmiy narxini ko'rsatishi tekshirilardi. Endi egasi bor EKSLYUZIV ID
  // katalogda summa ko'rsatmaydi — u sotuvdan o'tmagan, u sovg'a
  // (hosting/worker.js isOwnedExclusiveGiftD1 izohiga qarang).
  // Ro'yxatdagi kodlardan faqat BMW007 ekslyuziv emas (Premium), shuning
  // uchun narxini saqlaydi.
  const exclusiveListed = ['OOO000', 'VVV444', 'VIP001', 'VIP000'];
  check('ekslyuziv ro\'yxat kodlari katalogda summasiz',
    exclusiveListed.filter((c) => by[c]).map((c) => by[c].price), [0, 0, 0, 0]);
  check('...va hammasi sovg\'a deb belgilangan',
    exclusiveListed.filter((c) => by[c]).map((c) => by[c].isGift), [true, true, true, true]);
  check('ekslyuziv BO\'LMAGAN ro\'yxat kodi narxini saqlaydi (BMW007 Premium)', by.BMW007?.price, 199_000);
  checkTrue('BMW007 sovg\'a emas', by.BMW007?.isGift === false);
  // Narx ro'yxatining O'ZI tegilmagan — frontend hisobi avvalgidek.
  check('CODE_PRICES ro\'yxati o\'zgarmagan (frontend hisobi)', bad >= 0 && priceForCode('BMW007').total, 199_000);
  // 2026-09: katalog narxining yagona manbai TARIF jadvaliga o'tdi
  // (hosting/worker.js catalogPriceD1). OTH222 -> Gold tarifi -> 149 000.
  // Saqlangan `cards.price` (49 000) endi faqat zaxira qiymat.
  check('an ordinary card is priced from its TARIFF (OTH222 -> Gold 149 000)', by.OTH222?.price, 149_000);

  const s = await j('/api/records/search?q=OOO');
  const hit = (s.body?.records || []).find((x) => x.code === 'OOO000');
  // Qidiruv katalog bilan AYNAN bir xil manbadan — ekslyuziv -> summasiz.
  check('search results use the same price source', hit?.price, 0);
  check('...va qidiruvda ham sovg\'a belgisi', hit?.isGift, true);
}

// ═══ 4. AUKSION "SOTILGAN" — KATALOGDAN HISOBLANGAN YOZUV YO'Q ═══
// 2026-09: avval bu bo'lim katalogdagi egasi bor ekslyuziv kartalarni
// "Sotildi ... so'm" deb ko'rsatardi (`ownedExclusiveSoldD1`). Ular
// auksiondan UMUMAN o'tmagan — bo'lmagan savdoni bo'lgandek ko'rsatish
// edi. O'sha funksiya butunlay olib tashlandi.
{
  await env.DB.prepare(`INSERT INTO cards (code, name, price, ts, user_id, profile_type) VALUES ('CEO999','Egasiz', 500000, 4700, NULL, 'personal')`).run();
  await env.DB.prepare(`INSERT INTO cards (code, name, price, ts, user_id, profile_type) VALUES ('ACE321','Narxsiz', 0, 4600, 1, 'personal')`).run();

  const r = await j('/api/auctions?withSold=1');
  const sold = r.body?.sold || [];
  const codes = sold.map((x) => x.code);

  for (const code of ['OOO000', 'VVV444', 'VIP001', 'VIP000']) {
    check(`${code} "Sotilgan" bo'limida KO'RINMAYDI (auksiondan o'tmagan)`, codes.includes(code), false);
  }
  check('BMW007 ham qo\'shilmagan', codes.includes('BMW007'), false);
  check('egasi yo\'q ekslyuziv ID sotilgan deb ko\'rsatilmaydi', codes.includes('CEO999'), false);
  check('ekslyuziv bo\'lmagan karta sotilgan deb ko\'rsatilmaydi', codes.includes('OTH222'), false);
  check('hech qanday haqiqiy auksion yo\'q -> ro\'yxat bo\'sh', sold.length, 0);

  // HECH QANDAY soxta auksion/taklif/tranzaksiya yozuvi yaratilmasin
  const a = await env.DB.prepare(`SELECT COUNT(*) AS n FROM auctions`).first();
  const b = await env.DB.prepare(`SELECT COUNT(*) AS n FROM bids`).first();
  const w = await env.DB.prepare(`SELECT COUNT(*) AS n FROM web_orders`).first();
  check('no fake auction / bid / order rows were created', [Number(a.n), Number(b.n), Number(w.n)], [0, 0, 0]);
}

// ═══ 5. "SOTILGAN" FAQAT TAKLIF BERILGAN LOTNI KO'RSATADI ═══
// Admin lot ochib, hech kim taklif bermay yopilsa — u hech kimga
// SOTILMAGAN. Shunday lot "Sotildi" bo'lib chiqmasligi kerak.
// Bu qoida ro'yxat bilan emas, `bids` yozuvi bilan ishlaydi — haqiqiy
// auksion o'tgach o'zi to'g'ri ishlaydi.
{
  const now = new Date().toISOString();
  // (a) Taklif berilgan, LEKIN pul to'lanmagan lot -> ko'rinmaydi.
  // Aynan shu holat ishlab chiqarishda uchradi: NEOMSONGS, VVV444 va
  // XXX772 lotlarida taklif bor edi, lekin hech kim to'lamagan —
  // shunga qaramay ular "Sotildi 5 000 000 so'm" bo'lib chiqardi.
  await env.DB.prepare(
    `INSERT INTO auctions (id, code, seller_id, start_price, current_price, highest_bidder_id, ends_at, status, min_increment, created_at)
     VALUES (700, 'VIP000', NULL, 100000, 9700000, 1, ?, 'sold', 25000, ?)`
  ).bind(now, now).run();
  await env.DB.prepare(`INSERT INTO bids (auction_id, user_id, amount, created_at) VALUES (700, 1, 9700000, ?)`).bind(now).run();
  let r = await j('/api/auctions?withSold=1');
  check("to'lanmagan lot \"Sotilgan\"da YO'Q (taklif bo'lsa ham)", (r.body?.sold || []).map((x) => x.code).includes('VIP000'), false);

  // (b) PUL TO'LANGACH -> ko'rinadi, o'z auksion yozuvi bilan
  await env.DB.prepare(
    `INSERT INTO web_orders (user_id, code, kind, price, payload, status, payme_transaction_id)
     VALUES (1, 'VIP000', 'auction_payment', 9700000, '{}', 'paid', 'pt-vip000')`
  ).run();
  r = await j('/api/auctions?withSold=1');
  const entry = (r.body?.sold || []).find((x) => x.code === 'VIP000');
  checkTrue("to'langan lot \"Sotilgan\"da CHIQADI", !!entry);
  check('u haqiqiy auksion yozuvi (hisoblangan emas)', [entry?.id, entry?.ownedSale], [700, undefined]);
  check('kod bir marta chiqadi', (r.body?.sold || []).filter((x) => x.code === 'VIP000').length, 1);

  // Tozalab qo'yamiz — quyidagi bo'limlar bo'sh holatdan boshlansin.
  await env.DB.prepare(`DELETE FROM web_orders WHERE code = 'VIP000'`).run();
  await env.DB.prepare(`DELETE FROM bids WHERE auction_id = 700`).run();
  await env.DB.prepare(`DELETE FROM auctions WHERE id = 700`).run();
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
  // 2026-09: egasi bor EKSLYUZIV ID endi sovg'a deb belgilanadi — u
  // sotuvdan o'tmagan. Avval bu qator teskarisini tekshirardi.
  check('egasi bor ekslyuziv ID sovg\'a deb belgilanadi', by.OOO000?.isGift, true);
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
  // 2026-09: OOO000, VVV444 va PPP777 — hammasi EKSLYUZIV. Ular endi
  // katalogda summa ko'rsatmaydi. Bu asl muammoni ham hal qiladi: eski
  // 200 000 lik taklif katalogga umuman chiqmaydi (avval bu bo'lim
  // rasmiy narx eski taklifni bosishini tekshirardi — endi ikkalasi ham
  // ko'rsatilmaydi).
  check('ekslyuziv ID katalogda summasiz (eski 200 000 taklif ham chiqmaydi)', by.OOO000?.price, 0);
  check('VVV444 ham summasiz', by.VVV444?.price, 0);
  check('PPP777 ham summasiz (ekslyuziv)', by.PPP777?.price, 0);
  check('uchalasi ham sovg\'a belgisi bilan',
    [by.OOO000?.isGift, by.VVV444?.isGift, by.PPP777?.isGift], [true, true, true]);

  // "Sotilgan" bo'limi: bu lotlarda taklif bor, lekin PUL TO'LANMAGAN —
  // demak savdo bo'lmagan va ular ro'yxatda chiqmaydi. Aynan shu holat
  // ishlab chiqarishda "Sotildi ... so'm" bo'lib turgan edi.
  const a = await j('/api/auctions?withSold=1');
  const sold = Object.fromEntries((a.body?.sold || []).map((x) => [x.code, x]));
  check("to'lanmagan lot \"Sotilgan\"da yo'q (OOO000)", sold.OOO000, undefined);
  check("...va PPP777 ham yo'q", sold.PPP777, undefined);

  // Qidiruv ham katalog bilan bir xil manbadan.
  const s2 = await j('/api/records/search?q=OOO');
  check('qidiruvda ham summasiz', (s2.body?.records || []).find((x) => x.code === 'OOO000')?.price, 0);

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
  // 2026-09: XXX772 ekslyuziv, demak katalogda summasiz ("Sovg'a").
  // Muhimi u Gold tarifiga TUSHIB QOLMASLIGI — bu asl talab edi.
  check('XXX772 katalogda summasiz (ekslyuziv)', by.XXX772?.price, 0);
  check('XXX772 Gold tarifi narxiga TUSHIB QOLMAGAN', by.XXX772?.price === TIER_PRICE.gold, false);

  // XXX772 — ishlab chiqarishdagi haqiqiy holat: lot ochilgan, taklif
  // ham berilgan, lekin hech kim pul to'lamagan. Shuning uchun u
  // "Sotilgan"da chiqmaydi. Tarifi esa avvalgidek ekslyuziv.
  const a = await j('/api/auctions?withSold=1');
  const sold = (a.body?.sold || []).find((x) => x.code === 'XXX772');
  check("to'lanmagan XXX772 \"Sotilgan\"da yo'q", sold, undefined);
  check('tarifi baribir ekslyuziv', tierForCode('XXX772'), 'exclusive');

  // Ekslyuziv ID to'g'ridan-to'g'ri sotilmaydi (faqat auksion orqali).
  check('XXX772 to\'g\'ridan-to\'g\'ri sotib olinmaydi', getPersonalPurchaseQuote('XXX772').purchasable, false);
}

// ═══ 9. O'CHIRILGAN ID "Sotilgan" bo'limida QOLMASIN ═══
// Egasi katalogdan kartani o'chirsa, uning eski auksion yozuvi `auctions`
// jadvalida qolib ketadi va avval "Sotilgan"da "Auksion yakunlandi" bo'lib
// osilib turardi — bosib bo'lmaydigan, katalogda topilmaydigan ID.
{
  const now = new Date().toISOString();
  // Kartasi BOR sotilgan auksion — ko'rinishi KERAK
  await env.DB.prepare(`INSERT INTO cards (code, name, price, ts, user_id, profile_type) VALUES ('III777','Bor', 100000, 4200, 1, 'personal')`).run();
  await env.DB.prepare(
    `INSERT INTO auctions (id, code, seller_id, start_price, current_price, ends_at, status, min_increment, created_at)
     VALUES (904, 'III777', NULL, 100000, 7300000, ?, 'sold', 25000, ?)`
  ).bind(now, now).run();
  // Kartasi O'CHIRILGAN sotilgan auksion — ko'rinmasligi kerak
  await env.DB.prepare(
    `INSERT INTO auctions (id, code, seller_id, start_price, current_price, ends_at, status, min_increment, created_at)
     VALUES (905, 'DEL999', NULL, 100000, 5000000, ?, 'sold', 25000, ?)`
  ).bind(now, now).run();
  // Ikkalasi ham TO'LIQ haqiqiy savdo (taklif + to'lov) — shunda bu bo'lim
  // aynan "karta bormi" qoidasini tekshiradi, to'lov qoidasini emas
  // (u 5-bo'limda alohida tekshiriladi).
  await env.DB.prepare(`INSERT INTO bids (auction_id, user_id, amount, created_at) VALUES (904, 1, 7300000, ?)`).bind(now).run();
  await env.DB.prepare(`INSERT INTO bids (auction_id, user_id, amount, created_at) VALUES (905, 1, 5000000, ?)`).bind(now).run();
  await env.DB.prepare(
    `INSERT INTO web_orders (user_id, code, kind, price, payload, status, payme_transaction_id)
     VALUES (1, 'III777', 'auction_payment', 7300000, '{}', 'paid', 'pt-iii777')`
  ).run();
  await env.DB.prepare(
    `INSERT INTO web_orders (user_id, code, kind, price, payload, status, payme_transaction_id)
     VALUES (1, 'DEL999', 'auction_payment', 5000000, '{}', 'paid', 'pt-del999')`
  ).run();

  const r = await j('/api/auctions?withSold=1');
  const codes = (r.body?.sold || []).map((x) => x.code);
  checkTrue('kartasi bor sotilgan ID ko\'rinadi (III777)', codes.includes('III777'));
  check('kartasi O\'CHIRILGAN ID ko\'rinmaydi (DEL999)', codes.includes('DEL999'), false);

  // Auksion yozuvining O'ZI o'chirilmagan — tarix saqlanadi.
  const row = await env.DB.prepare(`SELECT status, current_price FROM auctions WHERE id = 905`).first();
  check('auksion yozuvi bazada SAQLANIB QOLGAN', [row?.status, Number(row?.current_price)], ['sold', 5000000]);

  // Kartani o'chirsak, u ham ro'yxatdan tushadi.
  await env.DB.prepare(`DELETE FROM cards WHERE code = 'III777'`).run();
  const r2 = await j('/api/auctions?withSold=1');
  check('karta o\'chirilgach ro\'yxatdan tushadi', (r2.body?.sold || []).map((x) => x.code).includes('III777'), false);
}

// ═══ 9. ADMIN QO'LDA "EKSLYUZIV" QILGAN KARTA HAM SOVG'A ═══
// Ishlab chiqarishdagi ko'pchilik ekslyuziv ID kodning naqshidan emas,
// admin panelidagi `tier_override` dan keladi. Sovg'a qoidasi ularni ham
// qamrab olishi shart — aks holda katalogda yarmi "Sovg'a", yarmi summa
// bilan chiqib, ziddiyatli ko'rinardi.
{
  await env.DB.prepare(`INSERT INTO cards (code, name, price, ts, user_id, profile_type, tier_override) VALUES ('QWE121','Silver->Eks', 99000, 4100, 1, 'personal', 'exclusive')`).run();
  await env.DB.prepare(`INSERT INTO cards (code, name, price, ts, user_id, profile_type) VALUES ('QWE131','Oddiy', 99000, 4090, 1, 'personal')`).run();
  const r = await j('/api/records');
  const by = Object.fromEntries((r.body || []).map((x) => [x.code, x]));
  check("tier_override='exclusive' -> sovg'a, summasiz", [by.QWE121?.price, by.QWE121?.isGift], [0, true]);
  checkTrue('override yo\'q karta narxini saqlaydi', by.QWE131?.price > 0 && by.QWE131?.isGift === false);
}

// ═══ 10. KATALOG va SOVG'A BELGISI hech qachon ZID EMAS ═══
// Yagona helper (isGiftCardD1) narx va belgi uchun ham ishlatiladi,
// shuning uchun "narxi bor, lekin sovg'a" holati bo'lishi mumkin emas.
{
  const r = await j('/api/records');
  const bad = (r.body || []).filter((x) => x.isGift && Number(x.price) > 0);
  check("hech bir kartada 'sovg'a + summa' ziddiyati yo'q", bad.map((x) => x.code), []);
}

done();
