/**
 * Effective feature access — ported 1:1 from src/lib/access.js (web app).
 * See android/docs/01-AUDIT.md §1.5: the Worker does NOT yet enforce this
 * server-side for record PUTs, so the Android client must render these gates
 * honestly (gray out, don't silently fail) even though the server currently
 * trusts the owner.
 */
import type { TierKey } from './codeTiers';
import { tierForCode } from './pricing';

export const ACCESS_LEVELS: TierKey[] = ['free', 'silver', 'gold', 'premium', 'exclusive'];
export const ACCESS_RANK: Record<TierKey, number> = { free: 0, silver: 1, gold: 2, premium: 3, exclusive: 4 };

export interface AccessCard {
  code?: string;
  tierOverride?: TierKey | null;
  isGift?: boolean;
}
export interface AccessOwner {
  isPremium?: boolean;
}

export function idTier(card?: AccessCard | null): TierKey {
  if (!card) return 'free';
  const ov = card.tierOverride;
  if (ov && ACCESS_RANK[ov] != null) return ov;
  if (card.isGift) return 'exclusive';
  return tierForCode(card.code || '');
}

export function effectiveAccess(card?: AccessCard | null, owner?: AccessOwner | null): TierKey {
  const a = ACCESS_RANK[idTier(card)] ?? 0;
  const premiumFloor = owner?.isPremium ? ACCESS_RANK.premium : 0;
  return ACCESS_LEVELS[Math.max(a, premiumFloor)];
}

export function hasAccess(current: TierKey, required: TierKey): boolean {
  return (ACCESS_RANK[current] ?? 0) >= (ACCESS_RANK[required] ?? 99);
}

export type Feature =
  | 'post' | 'music' | 'innerBackground' | 'advancedColors' | 'animatedBackground'
  | 'premiumThemes' | 'glassContent' | 'linkStyle' | 'video' | 'physicalCardDesigner'
  | 'profileCardCustom' | 'leadCapture' | 'advancedAnalytics' | 'fileCatalog'
  | 'restaurantMenu' | 'productCatalog' | 'serviceCatalog' | 'location';

export const FEATURE_MIN: Record<Feature, TierKey> = {
  post: 'silver',
  music: 'premium',
  innerBackground: 'gold',
  advancedColors: 'gold',
  animatedBackground: 'premium',
  premiumThemes: 'premium',
  glassContent: 'premium',
  linkStyle: 'gold',
  video: 'premium',
  physicalCardDesigner: 'silver',
  profileCardCustom: 'gold',
  leadCapture: 'gold',
  advancedAnalytics: 'gold',
  fileCatalog: 'gold',
  restaurantMenu: 'silver',
  productCatalog: 'silver',
  serviceCatalog: 'silver',
  location: 'gold',
};

export function featureAllowed(feature: Feature, currentAccess: TierKey): boolean {
  const min = FEATURE_MIN[feature];
  return min ? hasAccess(currentAccess, min) : true;
}

export const POST_LIMIT: Record<TierKey, number> = { free: 0, silver: 5, gold: 30, premium: 60, exclusive: 999 };
export function postLimitFor(currentAccess: TierKey): number {
  return POST_LIMIT[currentAccess] ?? 0;
}

interface CatalogLimit { cat: number; item: number; images: boolean }
const CATALOG_LIMITS: Record<TierKey, CatalogLimit> = {
  free: { cat: 0, item: 0, images: false },
  silver: { cat: 1, item: 15, images: false },
  gold: { cat: 8, item: 100, images: true },
  premium: { cat: 20, item: 300, images: true },
  exclusive: { cat: 999, item: 9999, images: true },
};
export const MENU_LIMITS = CATALOG_LIMITS;
export const PRODUCT_LIMITS = CATALOG_LIMITS;
export const SERVICE_LIMITS = CATALOG_LIMITS;
export function menuLimitsFor(currentAccess: TierKey) { return CATALOG_LIMITS[currentAccess] || CATALOG_LIMITS.free; }
export function productLimitsFor(currentAccess: TierKey) { return CATALOG_LIMITS[currentAccess] || CATALOG_LIMITS.free; }
export function serviceLimitsFor(currentAccess: TierKey) { return CATALOG_LIMITS[currentAccess] || CATALOG_LIMITS.free; }

export const PRICE_TYPES = ['fixed', 'from', 'negotiable'] as const;

export const FILE_LIMIT: Record<TierKey, number> = { free: 0, silver: 0, gold: 5, premium: 15, exclusive: 999 };
export function fileLimitFor(currentAccess: TierKey) { return FILE_LIMIT[currentAccess] ?? 0; }

/**
 * Company System v2 module assignment — one company = one catalog module,
 * chosen automatically by category (never user-picked). Ported from
 * `businessModule()` in access.js; see android/docs/02-API_MAP.md §2.5.
 */
export type CompanyModule = 'menu' | 'products' | 'services';
export function businessModule(profileType: string, categorySlug?: string | null): CompanyModule | null {
  if (profileType !== 'business') return null;
  const s = String(categorySlug || '');
  if (s === 'food' || s.startsWith('food-')) return 'menu';
  if (s === 'retail' || s.startsWith('retail-')) return 'products';
  return 'services';
}
