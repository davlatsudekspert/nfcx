/**
 * Shared API types — field names copied verbatim from android/docs/02-API_MAP.md,
 * which was itself read directly from `hosting/worker.js`. Keep this file in
 * sync with that document, not with assumptions.
 */
import type { TierKey } from '../lib/codeTiers';

export interface User {
  id: number | string;
  email: string;
  phone?: string | null;
  isPremium?: boolean;
  bannedUntil?: string | null;
  strikeCount?: number;
  promoCode?: string | null;
  pendingDiscountPct?: number | null;
  suspendedUntil?: string | null;
  deletedAt?: string | null;
}

export interface NfcRecord {
  code: string;
  name: string;
  role?: string;
  avatarUrl?: string;
  bgUrl?: string;
  phone?: string;
  email?: string;
  tg?: string;
  whatsapp?: string;
  website?: string;
  hashtags?: string[];
  theme?: string;
  price?: number;
  ts?: number;
  views?: number;
  profileType?: 'personal' | 'expert' | 'business';
  city?: string;
  categorySlug?: string;
  verified?: boolean;
  tierOverride?: TierKey | null;
  extraLinks?: Record<string, string>;
  cardDesign?: unknown;
  hidePhone?: boolean;
  isPrimary?: boolean;
  musicUrl?: string;
}

export interface Order {
  id: number;
  code: string;
  kind?: string;
  price: number;
  status: 'pending' | 'paid' | 'cancelled' | 'expired' | string;
  createdAt?: string;
}

export interface PurchaseResponse {
  pending: true;
  orderId: number;
  code: string;
  price: number;
  payLink: string | null;
}

export interface Auction {
  id: number;
  code: string;
  status: 'active' | 'sold' | 'awaiting_payment' | string;
  currentPrice: number;
  startPrice?: number;
  minIncrement?: number;
  endsAt: string;
  highestBidderId?: number | string | null;
  paymentDeadline?: string | null;
}

export interface Bid {
  id: number;
  auctionId: number;
  userId: number | string;
  amount: number;
  released: boolean;
  createdAt: string;
  bidderCode: string | null;
}

export interface AuctionDemand {
  id: number;
  code: string;
  status: 'collecting' | 'ready' | 'auction_live' | 'hidden';
  interestCount: number;
  auctionId: number | null;
  createdAt: string;
  voted?: boolean;
  auctionCurrentPrice?: number | null;
  auctionEndsAt?: string | null;
  auctionStatus?: string | null;
  threshold?: number;
}

export type CompanyStatus =
  | 'draft' | 'pending_review' | 'approved' | 'payment_pending' | 'active' | 'rejected';

export interface Company {
  companyId: string;
  ownerUserId: string;
  displayName: string;
  category: string;
  subcategory?: string;
  city: string;
  address?: string;
  description: string;
  phone: string;
  telegram?: string;
  whatsapp?: string;
  website?: string;
  logoUrl?: string;
  coverUrl?: string;
  gallery?: string[];
  tier: TierKey;
  price: number;
  status: CompanyStatus;
  items?: CompanyCatalogItem[];
}

export interface CompanyCatalogItem {
  id: string;
  companyId: string;
  name: string;
  category?: string;
  description?: string;
  price: number;
  promotionPrice?: number | null;
  imageUrl?: string;
  available: boolean;
  sortOrder?: number;
}

export interface FollowStats {
  followers: number;
  following: number;
  isFollowing: boolean;
}

export interface GiftOffer {
  id: number;
  code: string;
  createdAt: string;
  fromEmail?: string;
  toEmail?: string;
}

/** Every real error `error` string the Worker returns, mapped to Uzbek copy —
 * see android/docs/02-API_MAP.md §2.10. Anything not in this map falls back
 * to a generic retry banner; raw technical strings never reach the user. */
export const ERROR_COPY: Record<string, string> = {
  bad_credentials: "Email yoki parol noto'g'ri.",
  unauthorized: 'Davom etish uchun tizimga kiring.',
  account_suspended: 'Hisobingiz vaqtincha to‘xtatilgan.',
  account_deleted: 'Bu hisob o‘chirilgan.',
  already_taken: 'Bu ID hozir band.',
  reserved_pending_payment: 'Bu ID hozir band (to‘lov kutilmoqda).',
  code_taken: 'Bu ID hozir band.',
  company_id_taken: 'Bu Company ID band.',
  company_id_reserved: 'Bu Company ID zaxirada.',
  not_purchasable: 'Bu ID sotib olinmaydi.',
  exclusive_auction_only: "Bu ID faqat auksion orqali sotiladi.",
  too_many_requests: 'Juda ko‘p urinish. Biroz kuting.',
  physical_card_not_supported_yet: 'Bu funksiya hali mavjud emas.',
  payments_disabled: 'To‘lovlar hozircha yopiq.',
  payments_backend_pending: 'To‘lovlar hozircha yopiq.',
  api_upstream_unavailable: 'Xizmat vaqtincha mavjud emas.',
  d1_unavailable: 'Xizmat vaqtincha mavjud emas.',
  core_api_unavailable: 'Xizmat vaqtincha mavjud emas.',
  not_found: 'Topilmadi.',
  forbidden: 'Bu amalga ruxsatingiz yo‘q.',
  ALREADY_FOLLOWING: 'Siz allaqachon obuna bo‘lgansiz.',
  ALREADY_PENDING: 'So‘rov allaqachon yuborilgan.',
  CANNOT_FOLLOW_SELF: 'O‘zingizga obuna bo‘lolmaysiz.',
};

export function errorCopy(code?: string | null): string {
  if (!code) return 'Xatolik yuz berdi.';
  return ERROR_COPY[code] || 'Xizmat vaqtincha mavjud emas.';
}
