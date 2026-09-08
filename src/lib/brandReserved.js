// ═══════════════════════════════════════════════════════════════════════
// BREND UCHUN HIMOYALANGAN NOMLAR (2026-09)
//
// Bu ro'yxatdagi nomlar NFC ID yoki Company ID sifatida ochilmaydi va
// sotilmaydi. Sabab huquqiy: tovar belgisi egasining nomdan foydalanish
// huquqi qonun bilan himoyalangan (O'zbekiston Respublikasining
// "Tovar belgilari, xizmat ko'rsatish belgilari va tovar kelib chiqqan
// joy nomlari to'g'risida"gi qonuni). Begona odamga `nfcstore.uz/uzum`
// ni sotib qo'yish bizni ham, xaridorni ham javobgarlikka qo'yadi.
//
// "Band qilingan" EMAS, "brend uchun himoyalangan" deb ko'rsatiladi:
// birinchisi "tugab qolgan" degan taassurot beradi, ikkinchisi qoida
// borligini aytadi va brendning rasmiy vakiliga murojaat yo'lini ochadi.
//
// ─────────────────────────────────────────────────────────────────────
// TAQQOSLASH QOIDASI — AYNAN TENGLIK, "ichida bor" EMAS.
//
// Avval nom normallashtiriladi: katta harfga o'tkaziladi va HARFDAN
// boshqa hamma narsa olib tashlanadi (bo'shliq, chiziq, apostrof,
// raqam). Shundan keyin ro'yxat bilan AYNAN solishtiriladi.
//
//   "UZUM MARKET" / "uzum-market" / "UzumMarket"  ->  UZUMMARKET  ✓
//
// "Ichida bor" qoidasi ATAYLAB ishlatilmaydi — u begunoh nomlarni
// bloklab qo'yardi:
//   BON  -> BONU  (keng tarqalgan ayol ismi)
//   ANOR -> ANORA
// Aynan tenglikda bunday yolg'on ijobiy natija bo'lmaydi.
//
// ─────────────────────────────────────────────────────────────────────
// DIQQAT: ro'yxat va mantiq hosting/worker.js ichidagi
// `BRAND_RESERVED_D1` / `isBrandReservedD1()` bilan AYNAN bir xil
// bo'lishi shart (Worker modullari `src/` dan import qila olmaydi).
// scripts/test-brand-reserved.mjs ikkalasini solishtirib turadi.
// ═══════════════════════════════════════════════════════════════════════

// Normallashtirilgan (faqat A–Z) ko'rinishda saqlanadi.
export const BRAND_RESERVED = [
  // ── IT, to'lov va internet xizmatlari ──
  'UZUM', 'UZUMMARKET', 'UZUMBANK', 'UZUMNASIYA', 'UZUMTEZKOR',
  'PAYME', 'CLICK', 'PAYNET', 'OSON', 'ALIF', 'ALIFNASIYA',
  'HUMANS', 'ZOOD', 'ZOODMALL', 'ASAXIY', 'OLCHA',
  'MYUZCARD', 'UZCARD', 'HUMO',
  // ── Banklar ──
  'ANOR', 'ANORBANK', 'KAPITALBANK', 'HAMKORBANK',
  'IPAKYULI', 'IPAKYULIBANK', 'TBC', 'TBCBANK',
  'SQB', 'SANOATQURILISHBANK', 'NBU', 'ALOQABANK', 'AGROBANK',
  'ASAKABANK', 'IPOTEKABANK', 'INFINBANK', 'TRASTBANK', 'DAVRBANK',
  'OCTOBANK', 'TENGEBANK', 'ZIRAATBANK', 'POYTAXTBANK', 'GARANTBANK',
  'ORIENTFINANS', 'OFB',
  // ── Telekommunikatsiya ──
  'UZTELECOM', 'UZMOBILE', 'UCELL', 'BEELINE', 'MOBIUZ', 'PERFECTUM',
  'EVO', 'TPS', 'SARKOR', 'EASTTELECOM',
  // ── Savdo va texnika ──
  'KORZINKA', 'HAVAS', 'MAKRO', 'MAGNUM', 'BARAKA', 'TEXNOMART',
  'MEDIAPARK', 'IDEA', 'GOODZONE', 'ELMAKON', 'ARTEL', 'AKFA',
  'IMZO', 'AVALON', 'SHIVAKI', 'ROISON',
  // ── Restoran va oziq-ovqat ──
  'EVOS', 'OQTEPA', 'OQTEPALAVASH', 'BELLISSIMO', 'MAXWAY',
  'LESAILES', 'FEEDUP', 'SAFIA', 'CRAFERS', 'BON', 'YAPONAMAMA',
  'BASRIBABA', 'CHOPAR', 'DODOPIZZA', 'KFC',
  // ── Transport va avtomobil ──
  'UZAUTO', 'UZAUTOMOTORS', 'CHEVROLET', 'BYD', 'ADM', 'KIA',
  'CHERY', 'HAVAL', 'MYTAXI', 'YANDEXGO',
  'UZBEKISTANAIRWAYS', 'UZRAILWAYS',
  // ── Qurilish va ko'chmas mulk ──
  'MURADBUILDINGS', 'GOLDENHOUSE', 'NRG', 'DREAMCITY', 'AKAYCITY',
  'XONSAROY', 'BIGROUP',
  // ── Ta'lim va media ──
  'NAJOTTALIM', 'PDP', 'MOHIRDEV', 'REGISTAN', 'CAMBRIDGE',
  'INTERNATION', 'MARSIT', 'THOMPSON', 'KUNUZ', 'DARYOUZ',
  'GAZETAUZ', 'SEVIMLI', 'ZORTV', 'MILLIYTV', 'OLX',
  // ── Yetkazib berish va logistika ──
  'BTS', 'BTSEXPRESS', 'FARGO', 'EMU', 'UZPOST',
];

const RESERVED_SET = new Set(BRAND_RESERVED);

// Bo'shliq, chiziq, apostrof, raqam — hammasi olib tashlanadi.
// `EXPRESS24` -> `EXPRESS`, `UZUM-MARKET` -> `UZUMMARKET`.
export function normalizeBrand(value) {
  return String(value || '').normalize('NFKC').toUpperCase().replace(/[^A-Z]/g, '');
}

export function isBrandReserved(value) {
  const v = normalizeBrand(value);
  return !!v && RESERVED_SET.has(v);
}
