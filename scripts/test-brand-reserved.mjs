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
import { BRAND_RESERVED, isBrandReserved, normalizeBrand } from '../src/lib/brandReserved.js';
import { makeEnv, seedBasic, req, makeChecker } from './lib/d1-harness.mjs';

const { check, checkTrue, done } = makeChecker();
const { env } = makeEnv();
await seedBasic(env);

// ── 1) Paritet: ikkala ro'yxat aynan bir xil ──────────────────────────
{
  const src = readFileSync(new URL('../hosting/worker.js', import.meta.url), 'utf8');
  const from = src.indexOf('const BRAND_RESERVED_D1 = [');
  const list = src.slice(from, src.indexOf('];', from) + 2);
  // eslint-disable-next-line no-eval
  const workerList = eval(list.replace('const BRAND_RESERVED_D1 =', '') + ';');
  check('1) ikkala ro\'yxatda bir xil son', workerList.length, BRAND_RESERVED.length);
  check('1b) ro\'yxatlar AYNAN bir xil', workerList.join('|'), BRAND_RESERVED.join('|'));
  checkTrue('1c) hamma yozuv normallashtirilgan holda (faqat A-Z)',
    BRAND_RESERVED.every((v) => v === normalizeBrand(v)));
  checkTrue('1d) takror yozuv yo\'q', new Set(BRAND_RESERVED).size === BRAND_RESERVED.length);
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

// ── 2f) ATAYLAB himoyalangan ODDIY SO'ZLAR ────────────────────────────
// Bular kundalik so'z ham, brend ham. Egasi ataylab ro'yxatga qo'shgan.
// Test buni YOZIB QO'YADI — kelajakda "nega MANGO bloklangan?" degan
// savol chiqsa, javob shu yerda: bu xato emas, qaror.
{
  for (const v of ['MANGO', 'POLO', 'OPERA', 'TOTAL', 'HONOR', 'MARS', 'ALEXA', 'META', 'HUGO']) {
    check(`2f) "${v}" ataylab himoyalangan`, isBrandReserved(v), true);
  }
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
}

done();
