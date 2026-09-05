import { api } from './client';
import type { FollowStats, GiftOffer } from './types';

export const socialApi = {
  follow: (code: string) =>
    api.post<{ ok: true; paid: false }>(`/api/follow/${encodeURIComponent(code)}`, undefined, {
      dedupeKey: `follow:${code}`,
    }),
  unfollow: (code: string) =>
    api.post<{ ok: true }>(`/api/unfollow/${encodeURIComponent(code)}`, undefined, {
      dedupeKey: `unfollow:${code}`,
    }),
  stats: (code: string) => api.get<FollowStats>(`/api/follow-stats/${encodeURIComponent(code)}`),
  list: (code: string, dir: 'followers' | 'following') =>
    api.get<{ list: Array<{ code: string; name: string; avatarUrl: string; verified: boolean }> }>(
      `/api/follow-list/${encodeURIComponent(code)}?dir=${dir}`,
    ),

  giftOffers: () => api.get<{ incoming: GiftOffer[]; outgoing: GiftOffer[] }>('/api/gift-offers'),
  giftAction: (id: number, action: 'accept' | 'reject' | 'cancel') =>
    api.post<{ ok: true; code?: string }>(`/api/gift-offers/${id}/${action}`, undefined, {
      dedupeKey: `gift:${id}:${action}`,
    }),

  referrals: () =>
    api.get<{ referrals: Array<{ id: number; createdAt: string; referredEmail: string }> }>('/api/referrals'),

  unreadCount: () => api.get<{ count: number }>('/api/conversations/unread-count'),
};
