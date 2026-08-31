// ─────────────────────────────────────────────────────────────────────────
// EFFECTIVE FEATURE ACCESS — markaziy entitlement mantiq.
//
// IKKI ALOHIDA TUSHUNCHA (aralashtirmang):
//   1) NFC ID TIER   — kodning naqshi (yoki admin `tier_override`, yoki
//                      sovg'a) → free / silver / gold / premium / exclusive.
//   2) PROFILE PREMIUM — user.is_premium (bir martalik to'lov). NFC ID
//                      kodini/tarifini O'ZGARTIRMAYDI, lekin feature
//                      access'ni kamida "premium" darajasiga ko'taradi.
//
// EFFECTIVE ACCESS = max(idTier, profilePremium ? 'premium' : 'free').
// Exclusive har doim exclusive (max qoidasi buni qamrab oladi).
//
// Bu modul FRONTEND ham, BACKEND ham (server/index.js `../src/lib/...`)
// ishlatishi uchun toza (React'siz, DOM'siz). O'zgarishlar bir joyda.
// ─────────────────────────────────────────────────────────────────────────
import { tierForCode } from './pricing.js';

export const ACCESS_LEVELS = ['free', 'silver', 'gold', 'premium', 'exclusive'];
export const ACCESS_RANK = { free: 0, silver: 1, gold: 2, premium: 3, exclusive: 4 };

// NFC ID ning "xom" darajasi — sovg'a / admin override / kod naqshi.
export function idTier(card) {
  if (!card) return 'free';
  const ov = card.tierOverride || card.tier_override;
  if (ov && ACCESS_RANK[ov] != null) return ov;
  if (card.isGift) return 'exclusive';
  return tierForCode(card.code || '');
}

// Effective access — spec bo'yicha.
//   card:  { code, tierOverride?, isGift? }
//   owner: { isPremium? }  (public profil uchun record.isPremium ni uzating)
export function effectiveAccess(card, owner) {
  const a = ACCESS_RANK[idTier(card)] ?? 0;
  const premiumFloor = owner && owner.isPremium ? ACCESS_RANK.premium : 0;
  return ACCESS_LEVELS[Math.max(a, premiumFloor)];
}

// `current` darajasi `required` dan past emasmi.
export function hasAccess(current, required) {
  return (ACCESS_RANK[current] ?? 0) >= (ACCESS_RANK[required] ?? 99);
}

// ── Feature → talab qilinadigan minimal daraja ──────────────────────────
// Keyinchalik admin config'dan (admin_settings) keladi; hozircha default.
// Kalitlar frontend va backend'da bir xil ishlatiladi.
export const FEATURE_MIN = {
  post:                 'silver',
  music:                'premium',
  innerBackground:      'gold',      // profil ICHKI foni (rasm/rang)
  advancedColors:       'gold',
  animatedBackground:   'premium',
  premiumThemes:        'premium',
  glassContent:         'premium',
  linkStyle:            'gold',       // transparent / glass havola tugmalari
  video:                'premium',
  physicalCardDesigner: 'silver',
  profileCardCustom:    'gold',      // profil kartasi rang/fon/pozitsiya
  leadCapture:          'gold',
  advancedAnalytics:    'gold',
  fileCatalog:          'gold',
  restaurantMenu:       'silver',
  productCatalog:       'silver',
  serviceCatalog:       'silver',
  location:             'gold',      // manzil/koordinatalar — "Lokatsiyani ochish" (Faz 19)
};

// ── Tarif bo'yicha post limiti ─────────────────────────────────────────
// Keyinchalik admin config. Mavjud postlar HECH QACHON o'chirilmaydi —
// limit faqat YANGI post qo'shishga ta'sir qiladi (grandfathering).
export const POST_LIMIT = { free: 0, silver: 5, gold: 30, premium: 60, exclusive: 999 };

// ── Restoran menyusi limiti (Band 3.3) ─────────────────────────────────
// { cat: kategoriyalar soni, item: taomlar soni, images: rasm ruxsati }.
// Free — menyu yopiq. Mavjud yozuvlar hech qachon o'chirilmaydi — limit
// faqat YANGI qo'shishga ta'sir qiladi (grandfathering).
export const MENU_LIMITS = {
  free:      { cat: 0,   item: 0,    images: false },
  silver:    { cat: 1,   item: 15,   images: false },
  gold:      { cat: 8,   item: 100,  images: true },
  premium:   { cat: 20,  item: 300,  images: true },
  exclusive: { cat: 999, item: 9999, images: true },
};

export function featureAllowed(feature, currentAccess) {
  const min = FEATURE_MIN[feature];
  return min ? hasAccess(currentAccess, min) : true;
}

export function postLimitFor(currentAccess) {
  return POST_LIMIT[currentAccess] ?? 0;
}

export function menuLimitsFor(currentAccess) {
  return MENU_LIMITS[currentAccess] || MENU_LIMITS.free;
}

// ── Biznes moduli xaritasi (Business Workspace — Architecture Correction) ──
// Har bir biznes profil FAQAT BITTA katalog moduliga ega: soha shu modulni
// aniqlaydi (foydalanuvchi o'zi tanlamaydi — 1:1 xarita):
//   food / food-*     → 'menu'      (Restoran menyusi)
//   retail / retail-* → 'products'  (Mahsulotlar katalogi)
//   boshqa har qanday soha (yoki soha tanlanmagan) → 'services' (Xizmatlar)
// Shaxsiy/expert profillar uchun har doim null — bu modullar FAQAT
// profile_type === 'business' uchun. Backend HAM shu funksiyadan
// foydalanadi (frontendda yashirish yetarli emas — server ham tekshiradi).
export function businessModule(profileType, categorySlug) {
  if (profileType !== 'business') return null;
  const s = String(categorySlug || '');
  if (s === 'food' || s.startsWith('food-')) return 'menu';
  if (s === 'retail' || s.startsWith('retail-')) return 'products';
  return 'services';
}

// Menyu moduli faqat ovqatlanish sohasidagi BIZNES profillar uchun ochiladi
// (spec §51/§52: Restaurant / Cafe / Fast Food → MENU).
export function menuEligible(profileType, categorySlug) {
  return businessModule(profileType, categorySlug) === 'menu';
}

// ── Mahsulotlar katalogi limiti (Company System — Products) ───────────
// Menu bilan bir xil naqsh — savdo/do'kon sohasidagi biznes profillar uchun.
export const PRODUCT_LIMITS = {
  free:      { cat: 0,   item: 0,    images: false },
  silver:    { cat: 1,   item: 15,   images: false },
  gold:      { cat: 8,   item: 100,  images: true },
  premium:   { cat: 20,  item: 300,  images: true },
  exclusive: { cat: 999, item: 9999, images: true },
};

export function productLimitsFor(currentAccess) {
  return PRODUCT_LIMITS[currentAccess] || PRODUCT_LIMITS.free;
}

// Mahsulot katalogi faqat savdo/do'kon sohasidagi biznes profillar uchun.
export function productEligible(profileType, categorySlug) {
  return businessModule(profileType, categorySlug) === 'products';
}

// ── Xizmatlar katalogi limiti (Business Workspace — universal Catalog Engine) ──
// Menu/Products bilan bir xil naqsh — restoran/do'kon bo'lmagan boshqa
// barcha biznes yo'nalishlari (qurilish, IT, go'zallik, ta'lim va h.k.)
// uchun. Qo'shimcha: narx turi (FIXED/FROM/NEGOTIABLE).
export const SERVICE_LIMITS = {
  free:      { cat: 0,   item: 0,    images: false },
  silver:    { cat: 1,   item: 15,   images: false },
  gold:      { cat: 8,   item: 100,  images: true },
  premium:   { cat: 20,  item: 300,  images: true },
  exclusive: { cat: 999, item: 9999, images: true },
};

export function serviceLimitsFor(currentAccess) {
  return SERVICE_LIMITS[currentAccess] || SERVICE_LIMITS.free;
}

// Xizmatlar katalogi — restoran/do'kon bo'lmagan barcha biznes sohalari.
export function serviceEligible(profileType, categorySlug) {
  return businessModule(profileType, categorySlug) === 'services';
}

export const PRICE_TYPES = ['fixed', 'from', 'negotiable'];

// ── Fayl / PDF / katalog limiti (Band 3.4) ─────────────────────────────
// Gold+ — spec §58. Mavjud fayllar hech qachon o'chirilmaydi.
export const FILE_LIMIT = { free: 0, silver: 0, gold: 5, premium: 15, exclusive: 999 };

export function fileLimitFor(currentAccess) {
  return FILE_LIMIT[currentAccess] ?? 0;
}

// ── Jamoa (Team) limiti — biznes profillar uchun (PHASE 5) ─────────────
export const TEAM_LIMIT = { free: 3, silver: 8, gold: 25, premium: 60, exclusive: 999 };

export function teamLimitFor(currentAccess) {
  return TEAM_LIMIT[currentAccess] ?? 0;
}

// ── Video limiti (Band 4.1 / PHASE 4) ─────────────────────────────────
// Faqat Premium/Exclusive (spec §56). 9:16, MP4. count/mb/sec — spec dastlabki taklifi.
export const VIDEO_LIMITS = {
  free:      { count: 0, mb: 0,  sec: 0 },
  silver:    { count: 0, mb: 0,  sec: 0 },
  gold:      { count: 0, mb: 0,  sec: 0 },
  premium:   { count: 1, mb: 30, sec: 30 },
  exclusive: { count: 5, mb: 50, sec: 60 },
};

export function videoLimitsFor(currentAccess) {
  return VIDEO_LIMITS[currentAccess] || VIDEO_LIMITS.free;
}

// ── Galereya limiti (Business Workspace) — biznes profillar uchun ─────
// Team bilan bir xil naqsh: kategoriyasiz oddiy ro'yxat, limit tarifga qarab.
export const GALLERY_LIMIT = { free: 0, silver: 6, gold: 20, premium: 40, exclusive: 999 };

export function galleryLimitFor(currentAccess) {
  return GALLERY_LIMIT[currentAccess] ?? 0;
}
