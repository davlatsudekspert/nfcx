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
};

// ── Tarif bo'yicha post limiti ─────────────────────────────────────────
// Keyinchalik admin config. Mavjud postlar HECH QACHON o'chirilmaydi —
// limit faqat YANGI post qo'shishga ta'sir qiladi (grandfathering).
export const POST_LIMIT = { free: 0, silver: 5, gold: 30, premium: 60, exclusive: 999 };

export function featureAllowed(feature, currentAccess) {
  const min = FEATURE_MIN[feature];
  return min ? hasAccess(currentAccess, min) : true;
}

export function postLimitFor(currentAccess) {
  return POST_LIMIT[currentAccess] ?? 0;
}
