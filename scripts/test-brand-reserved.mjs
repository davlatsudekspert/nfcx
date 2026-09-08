// Brend uchun himoyalangan nomlar (2026-09).
//
// Ro'yxat IKKI joyda yozilgan (Worker modullari `src/` dan import qila
// olmaydi): src/lib/brandReserved.js va hosting/worker.js. Ular ajralib
// ketsa, forma bir narsani ko'rsatib server boshqasini qilardi — bu eng
// yomon turdagi xato, chunki hech kim sezmaydi. Shuning uchun paritet shu
// yerda qo'riqlanadi.
//
// Ikkinchi vazifasi — YOLG'ON IJOBIY natijalarni ushlash. Taqqoslash
// "ichida bor" emas, AYNAN tenglik: aks holda BON -> BONU ni, ANOR ->
// ANORA ni bloklab qo'yardi (ikkalasi ham keng tarqalgan ism).
//
//   node scripts/test-brand-reserved.mjs
import { readFileSync } from 'node:fs';
import worker from '../hosting/worker.js';
import { BRAND_RESERVED, BLOCKED_NAMES, CRYPTO_RESERVED, GLOBAL_AUCTION_RESERVED,
  isBrandReserved, reservedStatus, normalizeBrand } from '../src/lib/brandReserved.js';
import { makeEnv, seedBasic, req, makeChecker } from './lib/d1-harness.mjs';

const { check, checkTrue, done } = makeChecker();
const { env } = makeEnv();
await seedBasic(env);

// ── 1) Paritet: ikkala ro'yxat aynan bir xil ──────────────────────────
{
  const src = readFileSync(new URL('../hosting/worker.js', import.meta.url), 'utf8');
  const grab = (name) => {
    const from = src.indexOf(`const ${name}_D1 = [`);
    const list = src.slice(from, src.indexOf('];', from) + 2);
    // eslint-disable-next-line no-eval
    return eval(list.replace(`const ${name}_D1 =`, '') + ';');
  };
  const PAIRS = [
    ['BLOCKED_NAMES', BLOCKED_NAMES], ['BRAND_RESERVED', BRAND_RESERVED],
    ['CRYPTO_RESERVED', CRYPTO_RESERVED], ['GLOBAL_AUCTION_RESERVED', GLOBAL_AUCTION_RESERVED],
  ];
  const all = [];
  for (const [name, list] of PAIRS) {
    check(`1) ${name}: server nusxasi AYNAN bir xil`, grab(name).join('|'), list.join('|'));
    checkTrue(`1b) ${name}: hamma yozuv normallashtirilgan`, list.every((v) => v === normalizeBrand(v)));
    checkTrue(`1c) ${name}: 3 harfdan qisqa yozuv yo'q`, list.every((v) => v.length >= 3));
    all.push(...list);
  }
  // Bir nom IKKI guruhda bo'lmasligi shart — aks holda qaysi xabar
  // chiqishi ro'yxat tartibiga bog'lanib qolardi.
  check('1d) guruhlar orasida takror yo\'q', all.length - new Set(all).size, 0);
}

// ── 2) Yozilish variantlari bitta brend deb tanilishi ─────────────────
// Bo'shliq, chiziq va katta-kichik harf hisobga olinmaydi.
{
  for (const v of ['UZUM MARKET', 'uzum-market', 'UzumMarket', 'U Z U M M A R K E T', 'uzum_market']) {
    checkTrue(`2) "${v}" -> himoyalangan`, isBrandReserved(v));
  }
  for (const v of ['ANOR BANK', 'anorbank', 'Anor-Bank']) {
    checkTrue(`2b) "${v}" -> himoyalangan`, isBrandReserved(v));
  }
  check('2c) "OQTEPA LAVASH" bitta brend', isBrandReserved('OQTEPA LAVASH'), true);
  check('2d) "IPAK YULI" bitta brend', isBrandReserved('IPAK YULI'), true);

  // Xorijiy brendlarning ko'p so'zli yozilishlari
  for (const [v, label] of [
    ['MERCEDES-BENZ', 'Mercedes'], ['Mercedes Benz', 'Mercedes'],
    ['COCA-COLA', 'Coca-Cola'], ['coca cola', 'Coca-Cola'],
    ['LAND ROVER', 'Land Rover'], ['RANGE ROVER', 'Range Rover'],
    ['Louis Vuitton', 'Louis Vuitton'], ['TURKISH AIRLINES', 'Turkish Airlines'],
    ['New Balance', 'New Balance'], ['Manchester City', 'Man City'],
    ['Hugo Boss', 'Hugo Boss'], ['Burger King', 'Burger King'],
  ]) {
    checkTrue(`2e) "${v}" -> ${label}`, isBrandReserved(v));
  }
}

// ── 2f) ODDIY SO'Z HAM, BREND HAM bo'lgan nomlar ──────────────────────
// Bular kundalik so'z ham, brend ham (MANGO — meva va kiyim brendi,
// ALEXA — ayol ismi va Amazon xizmati). Egasi ularni ataylab BREND
// guruhidan AUKSION guruhiga ko'chirdi: ular tovar belgisi sifatida
// himoyalanmaydi, aksincha qimmatli umumiy nom sifatida auksionga
// chiqariladi.
//
// Test buni YOZIB QO'YADI — kelajakda "nega MANGO sotilmayapti?" degan
// savol chiqsa, javob shu yerda: bu xato emas, qaror.
{
  for (const v of ['MANGO', 'POLO', 'OPERA', 'TOTAL', 'HONOR', 'MARS', 'ALEXA', 'META', 'HUGO', 'IDEA']) {
    check(`2f) "${v}" -> auksion guruhida`, reservedStatus(v), 'auction');
  }
  checkTrue('2f) ...ya\'ni brend guruhida EMAS', !isBrandReserved('MANGO') && !isBrandReserved('ALEXA'));
}

// ── 3) YOLG'ON IJOBIY BO'LMASIN — eng muhim tekshiruv ─────────────────
// Aynan tenglik ishlatilgani uchun brend nomi BOSHIDA turgan oddiy
// ismlar bloklanmaydi. Bu qoida buzilsa, haqiqiy mijozlar jimgina
// yo'qotiladi va buni hech kim sezmaydi.
{
  const innocent = ['BONU', 'ANORA', 'ALI', 'NUR', 'GULNORA', 'IDEAL', 'HUMOYUN',
    'KIARA', 'EVOSIYA', 'BARAKAT', 'OSONBEK', 'CLICKER', 'ARTELIYA',
    // Xorijiy ro'yxat qo'shilgach paydo bo'lishi mumkin bo'lgan xavflar
    'MANGOSTON', 'POLOTNO', 'MARSEL', 'HUGOBEK', 'ALEXANDRA', 'OPERATOR',
    'TOTALLIK', 'HONORIY', 'METALL', 'FORDOB', 'VISAM', 'IKEALIK'];
  for (const v of innocent) check(`3) "${v}" ochiq qolishi shart`, isBrandReserved(v), false);
}

// ── 3b) TO'RT GURUH TO'G'RI AJRATILGAN ────────────────────────────────
{
  const cases = [
    ['UZUM', 'brand'], ['APPLE', 'brand'], ['COCA-COLA', 'brand'],
    ['BANK', 'auction'], ['GOLD', 'auction'], ['CHAT', 'auction'],
    ['MANGO', 'auction'], ['META', 'auction'], ['ALEXA', 'auction'],
    ['USDT', 'crypto'], ['NFT', 'crypto'], ['METAVERSE', 'crypto'],
    ['POKER', 'blocked'], ['CASINO', 'blocked'], ['FONBET', 'blocked'],
    ['ALI', ''], ['BONU', ''], ['GULNORA', ''],
  ];
  for (const [v, want] of cases) check(`3b) "${v}" -> ${want || 'ochiq'}`, reservedStatus(v), want);
}

// ── 3c) RAQAM QOIDASI: himoya faqat SOF NOMGA ─────────────────────────
// Egasining qarori (2026-09): "BMW" band bo'lsin (keyinchalik auksionga
// qo'yiladi), lekin "BMW112", "BMW007" kabi raqamli NFC ID'lar oddiy
// tartibda sotilaversin. Shu sabab ichida bitta raqam bo'lsa ham nom
// band hisoblanmaydi.
//
// Chetlab o'tish xavfi yo'q: kompaniya ID'sida raqam umuman ishlatilmaydi
// (companyId() faqat harflarni qabul qiladi) — quyida 4i) shuni ham
// serverda tekshiradi.
{
  for (const name of ['BMW', 'UZUM', 'USDT', 'POKER', 'VIP', 'BANK']) {
    checkTrue(`3c) sof "${name}" band`, reservedStatus(name) !== '');
  }
  for (const code of ['BMW112', 'BMW007', 'UZUM1', 'USDT9', 'POKER1', 'VIP555', 'BANK01']) {
    check(`3c) raqamli "${code}" ochiq`, reservedStatus(code), '');
  }
  // Bo'shliq/tire bilan yozilgan variant HAMON band — raqam qoidasi
  // faqat raqamga tegishli, boshqa ajratgichlarga emas.
  check('3c) "B M W" hamon band', reservedStatus('B M W'), 'brand');
  check('3c) "COCA COLA" hamon band', reservedStatus('COCA COLA'), 'brand');
}

// ── 4) Server: brend nomi SOTILMAYDI ──────────────────────────────────
{
  const j = async (p) => {
    const r = await worker.fetch(req(p), env);
    return { status: r.status, body: await r.json().catch(() => null) };
  };
  const uzum = await j('/api/companies/check?id=UZUM');
  check('4) Company ID: UZUM sotuvda emas', uzum.body?.available, false);
  check('4b) ...va sababi aniq ko\'rsatilgan', uzum.body?.brandReserved, true);
  check('4c) ...matni "band" emas', uzum.body?.reason, 'Bu nom brend uchun himoyalangan');

  const free = await j('/api/companies/check?id=GOYAX');
  check('4d) oddiy nom ochiq qolgan', free.body?.available, true);
  check('4e) ...va brend bayrog\'i yo\'q', free.body?.brandReserved, false);

  // Har bir guruh serverdan O'Z sababi bilan qaytadi — interfeys shunga
  // qarab boshqa-boshqa matn va tugma ko'rsatadi.
  for (const [id, status] of [['BANK', 'auction'], ['USDT', 'crypto'], ['POKER', 'blocked']]) {
    const r = await j(`/api/companies/check?id=${id}`);
    check(`4f) ${id} -> ${status}`, [r.body?.available, r.body?.reserved], [false, status]);
  }
  const bank = await j('/api/companies/check?id=BANK');
  check('4g) auksion nomida boshlang\'ich narx qaytadi', bank.body?.auctionStartPrice, 2000000);
  const poker = await j('/api/companies/check?id=POKER');
  check('4h) taqiqlangan nomda narx yo\'q', poker.body?.auctionStartPrice, null);

  // Raqam qoidasini chetlab o'tishga urinish: kompaniya ID'sida raqam
  // umuman qabul qilinmaydi, ya'ni "BMW1" deb yozib brend nomini olib
  // bo'lmaydi (raqam qoidasi faqat shaxsiy NFC ID'ga tegishli).
  const bmw1 = await j('/api/companies/check?id=BMW1');
  check('4i) raqamli kompaniya ID qabul qilinmaydi', bmw1.body?.available, false);
}

done();
