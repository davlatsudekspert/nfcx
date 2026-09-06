// Katalog ID manbasi va narxlari — maqsadli test.
//   node scripts/test-catalog-source-prices.mjs
//
// Qamrov:
//   1. Registratsiyada avtomatik yaratilgan ID katalog API / ro'yxat /
//      qidiruv / sanoqda CHIQMAYDI, lekin kabinet va public profil ishlaydi.
//   2. Silver 99 000, Bronza 49 000, Gold 149 000, Premium 199 000 —
//      yagona markaziy tarif jadvalidan (frontend TIER_PRICE bilan solishtiriladi).
//   3. Auksion yakuniy (g'olib) narxi FAQAT haqiqiy sotilgan auksion ID uchun.
//   4. Faollashtirilgan admin sovg'asi hali ham "Sovg'a" (isGift) bo'lib qoladi.
import worker from '../hosting/worker.js';
import { TIER_PRICE, tierForCode } from '../src/lib/pricing.js';
import { makeEnv, seedBasic, cookie, req, makeChecker } from './lib/d1-harness.mjs';

const { env } = makeEnv();
await seedBasic(env);
const { check, checkTrue, done } = makeChecker();

const j = async (pathname, init) => {
  const r = await worker.fetch(req(pathname, init), env);
  let body = null; try { body = await r.json(); } catch { body = null; }
  return { status: r.status, body };
};
const card = (code, opts = {}) => env.DB.prepare(
  `INSERT INTO cards (code, name, price, ts, user_id, profile_type, source) VALUES (?, ?, ?, ?, ?, 'personal', ?)`
).bind(code, opts.name || code, opts.price ?? 0, opts.ts ?? 2000, opts.userId ?? 1, opts.source ?? null).run();
const catalog = async () => (await j('/api/records')).body;
const byCode = (rows, code) => (rows || []).find((r) => r.code === code) || null;

// ═══════════════════════════════════════════════════════════════════════
// 1. REGISTRATSIYADAGI AVTOMATIK ID KATALOGDA KO'RINMAYDI
// ═══════════════════════════════════════════════════════════════════════
{
  // (a) yangi oqim — manba belgisi bilan
  await card('12345678', { name: 'Avto ID (yangi)', source: 'registration_auto' });
  // (b) eski qator — manba belgisi YO'Q (migratsiyagacha yaratilgan)
  await card('87654321', { name: 'Avto ID (eski)', source: null });

  const rows = await catalog();
  const before = rows.length;
  check('avtomatik ID (source=registration_auto) katalog ro\'yxatida YO\'Q', byCode(rows, '12345678'), null);
  check('eski avtomatik ID (source IS NULL, 8 xonali) ham ro\'yxatda YO\'Q', byCode(rows, '87654321'), null);
  checkTrue('katalogda boshqa kartalar bor (filtr hammasini o\'chirib yubormadi)', before > 0);

  // Umumiy sanoq / pagination aynan shu javobdan hisoblanadi.
  check('katalog sanog\'iga avtomatik ID qo\'shilmagan', rows.filter((r) => /^[0-9]{8}$/.test(r.code)).length, 0);

  // Qidiruv
  const s1 = await j('/api/records/search?q=12345678');
  check('qidiruvda avtomatik ID topilmaydi (kod bo\'yicha)', s1.body?.records?.length, 0);
  const s2 = await j('/api/records/search?q=Avto');
  check('qidiruvda avtomatik ID topilmaydi (ism bo\'yicha)', (s2.body?.records || []).map((r) => r.code), []);

  // Egasi uchun HECH NARSA o'zgarmaydi
  const me = await j('/api/auth/me', { cookie: cookie.user });
  checkTrue('egasining kabinetida avtomatik ID bor', (me.body?.cards || []).some((c) => c.code === '12345678'));
  const pub = await j('/api/records/12345678');
  check('avtomatik ID ning public profili ishlaydi', [pub.status, pub.body?.code], [200, '12345678']);
  const pub2 = await j('/api/records/87654321');
  check('eski avtomatik ID ning public profili ham ishlaydi', pub2.status, 200);
}

// ═══════════════════════════════════════════════════════════════════════
// 1b. XAVFSIZLIK KLAPANI — sotuv izi bor 8 xonali kod YASHIRILMAYDI
// ═══════════════════════════════════════════════════════════════════════
{
  await card('11112222', { name: 'Sotilgan 8 xonali', source: null });
  await env.DB.prepare(
    `INSERT INTO nfc_gifts (code, activation_code, status, created_at) VALUES ('11112222', 'ACT-11112222', 'activated', '2026-01-01T00:00:00Z')`
  ).run();
  const rows = await catalog();
  checkTrue('sovg\'a yozuvi bor 8 xonali kod katalogda QOLADI', !!byCode(rows, '11112222'));
  check('...va u "Sovg\'a" deb belgilangan', byCode(rows, '11112222')?.isGift, true);
}

// ═══════════════════════════════════════════════════════════════════════
// 2. TARIF NARXLARI — YAGONA MANBA
// ═══════════════════════════════════════════════════════════════════════
{
  // Backend va frontend tarif jadvali bir xilligini avval tasdiqlaymiz.
  check('frontend TIER_PRICE: Silver 99 000', TIER_PRICE.silver, 99000);
  check('frontend TIER_PRICE: Bronza 49 000', TIER_PRICE.free, 49000);
  check('frontend TIER_PRICE: Gold 149 000', TIER_PRICE.gold, 149000);
  check('frontend TIER_PRICE: Premium 199 000', TIER_PRICE.premium, 199000);

  // Bazadagi saqlangan narxlar ATAYLAB noto'g'ri — katalog ularni emas,
  // tarif narxini ko'rsatishi kerak.
  await card('QWE121', { name: 'Silver ID', price: 1, ts: 3001 });   // silver
  await card('QWE123', { name: 'Bronza ID', price: 7, ts: 3002 });   // free (Bronza)
  await card('SSS123', { name: 'Gold ID', price: 0, ts: 3003 });     // gold
  await card('BMW007', { name: 'Premium ID', price: 5, ts: 3004 });  // premium

  check('test kodlarining darajalari kutilganidek',
    ['QWE121', 'QWE123', 'SSS123', 'BMW007'].map(tierForCode), ['silver', 'free', 'gold', 'premium']);

  const rows = await catalog();
  check('Silver ID katalogda 99 000 so\'m', byCode(rows, 'QWE121')?.price, 99000);
  check('Bronza ID katalogda 49 000 so\'m', byCode(rows, 'QWE123')?.price, 49000);
  check('ODDIY Gold ID o\'zining rasmiy Gold narxida (149 000)', byCode(rows, 'SSS123')?.price, 149000);
  check('ODDIY Premium ID 199 000 so\'m', byCode(rows, 'BMW007')?.price, 199000);

  // Qidiruv ham AYNAN shu narxlarni beradi.
  const s = await j('/api/records/search?q=QWE121');
  check('qidiruvda ham Silver 99 000', byCode(s.body?.records, 'QWE121')?.price, 99000);
}

// ═══════════════════════════════════════════════════════════════════════
// 3. AUKSION YAKUNIY (G'OLIB) NARXI
// ═══════════════════════════════════════════════════════════════════════
{
  // G'olib — user#2. Karta unga biriktirilgan.
  await card('ZXC454', { name: 'Auksionda sotilgan', price: 1, ts: 4001, userId: 2 }); // tarifi: silver
  await env.DB.prepare(
    `INSERT INTO auctions (id, code, seller_id, start_price, current_price, highest_bidder_id, ends_at, status)
     VALUES (901, 'ZXC454', 1, 500000, 7600000, 2, '2026-01-01T00:00:00Z', 'sold')`
  ).run();
  await env.DB.prepare(`INSERT INTO bids (auction_id, user_id, amount) VALUES (901, 2, 4000000)`).run();
  await env.DB.prepare(`INSERT INTO bids (auction_id, user_id, amount) VALUES (901, 2, 7600000)`).run();

  const rows = await catalog();
  check('haqiqiy sotilgan auksion ID katalogda YAKUNIY yutuq narxida (7 600 000)',
    byCode(rows, 'ZXC454')?.price, 7600000);
  checkTrue('...ya\'ni tarif narxi (99 000) EMAS', byCode(rows, 'ZXC454')?.price !== TIER_PRICE.silver);

  // Auksionda umuman qatnashmagan, AYNAN shu tarifdagi boshqa ID.
  check('auksionda qatnashmagan Silver ID ga final narx qo\'llanmadi',
    byCode(rows, 'QWE121')?.price, 99000);
}
{
  // Shartlardan BITTASI yetishmasa — final narx QO'LLANMAYDI.
  // (a) auksion hali 'active'
  await card('PLM159', { name: 'Faol auksion', price: 1, ts: 4002, userId: 2 }); // free
  await env.DB.prepare(
    `INSERT INTO auctions (id, code, seller_id, start_price, current_price, highest_bidder_id, ends_at, status)
     VALUES (902, 'PLM159', 1, 100000, 3000000, 2, '2999-01-01T00:00:00Z', 'active')`
  ).run();
  await env.DB.prepare(`INSERT INTO bids (auction_id, user_id, amount) VALUES (902, 2, 3000000)`).run();

  // (b) sotilgan, LEKIN taklif (bid) yozuvi yo'q
  await card('TRE246', { name: 'Bidsiz auksion', price: 1, ts: 4003, userId: 2 }); // free
  await env.DB.prepare(
    `INSERT INTO auctions (id, code, seller_id, start_price, current_price, highest_bidder_id, ends_at, status)
     VALUES (903, 'TRE246', 1, 100000, 5000000, 2, '2026-01-01T00:00:00Z', 'sold')`
  ).run();

  // (c) sotilgan + bid bor, LEKIN karta g'olibga BIRIKTIRILMAGAN
  await card('MNB234', { name: 'Biriktirilmagan', price: 1, ts: 4004, userId: 1 }); // free, egasi user#1
  await env.DB.prepare(
    `INSERT INTO auctions (id, code, seller_id, start_price, current_price, highest_bidder_id, ends_at, status)
     VALUES (904, 'MNB234', 1, 100000, 6000000, 2, '2026-01-01T00:00:00Z', 'sold')`
  ).run();
  await env.DB.prepare(`INSERT INTO bids (auction_id, user_id, amount) VALUES (904, 2, 6000000)`).run();

  const rows = await catalog();
  check('FAOL auksiondagi ID ga final narx qo\'llanmaydi (tarif narxi)', byCode(rows, 'PLM159')?.price, 49000);
  check('taklif yozuvi YO\'Q auksion -> final narx qo\'llanmaydi', byCode(rows, 'TRE246')?.price, 49000);
  check('karta g\'olibga biriktirilmagan -> final narx qo\'llanmaydi', byCode(rows, 'MNB234')?.price, 49000);
}

// ═══════════════════════════════════════════════════════════════════════
// 4. SOVG'A — REGRESSIYA
// ═══════════════════════════════════════════════════════════════════════
{
  await card('XYZ131', { name: 'Sovg\'a karta', price: 0, ts: 5001 }); // silver tarif
  await env.DB.prepare(
    `INSERT INTO nfc_gifts (code, activation_code, status, created_at) VALUES ('XYZ131', 'ACT-XYZ131', 'activated', '2026-01-01T00:00:00Z')`
  ).run();
  const rows = await catalog();
  check('faollashtirilgan admin sovg\'asi hali ham isGift', byCode(rows, 'XYZ131')?.isGift, true);
  check('sovg\'a bo\'lmagan karta isGift emas', byCode(rows, 'QWE121')?.isGift, false);
  // Katalog kartasida faqat ism — `· username` qo'shimchasi yo'q (CatalogPage.jsx).
  check('katalog kartasi ismni o\'zgartirmaydi', byCode(rows, 'QWE121')?.name, 'Silver ID');
}

// ═══════════════════════════════════════════════════════════════════════
// 5. PER-CODE RASMIY NARX — REGRESSIYA (oldingi vazifa)
// ═══════════════════════════════════════════════════════════════════════
{
  const r = await j('/api/records/VIP001');
  check('VIP001 (ekslyuziv) rasmiy narxi saqlanib qoldi', r.body?.price, 7600000);
}

done();
