import { api } from './client';

export interface Category {
  id: number;
  slug: string;
  parentSlug: string | null;
  nameUz: string;
  nameRu: string;
  nameEn: string;
  sort: number;
  enabled: boolean;
}

export interface NewsItem {
  id: number;
  title: string;
  body: string;
  imageUrl?: string;
  createdAt: string;
  likeCount: number;
}

/**
 * No notifications endpoint exists.
 *
 * `hosting/worker.js` has no notifications route, the D1 schema has no
 * notifications table (android/docs/02-API_MAP.md §2.9), and the web app's own
 * NotificationsPage aggregates gift-offers / won-pending-auctions client-side
 * for exactly that reason. The user-facing `GET /api/support` the web also
 * calls is **not ported** to the Worker (only `/api/admin/support-messages`
 * exists). Nothing is stubbed here to paper over that — the mobile inbox
 * (src/screens/profile/notificationInbox.ts) aggregates the same real
 * endpoints, and the gap is reported as a backend blocker.
 */
export const contentApi = {
  categories: () => api.get<{ categories: Category[] }>('/api/categories'),

  news: () => api.get<{ news: NewsItem[]; liked: number[] }>('/api/news'),

  /** Physical-card NFC tap validity check — android/docs/02-API_MAP.md §2.7. */
  tap: (chipToken: string) =>
    api.get<{ active: boolean; linkedCode: string | null }>(`/api/tap/${encodeURIComponent(chipToken)}`),

  physicalNfcPricing: () =>
    api.get<{
      tiers: Array<{ minQty: number; maxQty: number | null; pricePerUnit: number }>;
      delivery: { minDays: number; maxDays: number };
    }>('/api/settings/physical-nfc-pricing'),

  /**
   * Single source of truth for whether payment CTAs are live. Poll at app
   * start and on foreground; never hard-code a value — see
   * android/docs/02-API_MAP.md §2.7 and 03-ARCHITECTURE.md §3.3.
   */
  paymentsEnabled: () => api.get<{ enabled: boolean }>('/api/settings/payments-enabled'),
};
