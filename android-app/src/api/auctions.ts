import { api } from './client';
import type { Auction, AuctionDemand, Bid } from './types';

export const auctionsApi = {
  list: (withSold = false) =>
    api.get<{ auctions: Auction[]; sold?: Auction[] }>(`/api/auctions${withSold ? '?withSold=1' : ''}`),

  demand: () => api.get<{ demand: AuctionDemand[]; threshold: number }>('/api/auction-demand'),

  vote: (demandId: number) =>
    api.post<{ ok: true; voted: boolean; code: string; status: string; interestCount: number; becameReady: boolean }>(
      `/api/auction-demand/${demandId}/vote`,
      undefined,
      { dedupeKey: `vote:${demandId}` },
    ),

  requestAuction: (code: string, note?: string) =>
    api.post<{ ok: true; id: number }>('/api/auction-requests', { code, note }),

  get: (id: number) => api.get<{ auction: Auction; bids: Bid[] }>(`/api/auctions/${id}`),

  /**
   * Always a real `503 payments_disabled` today (android/docs/02-API_MAP.md
   * §2.4) — the bid sheet must render that as a disabled/pending state, not
   * an error toast. `idempotencyKey` mirrors the web app's own
   * double-submit guard (`crypto.randomUUID()` per attempt).
   */
  bid: (auctionId: number, amount: number, idempotencyKey: string) =>
    api.post<{ ok: true }>(`/api/auctions/${auctionId}/bid`, { amount, idempotencyKey }, {
      dedupeKey: `bid:${auctionId}:${idempotencyKey}`,
    }),

  pay: (auctionId: number, payload: { name: string; phone: string }) =>
    api.post<{ ok: true }>(`/api/auctions/${auctionId}/pay`, payload, { dedupeKey: `pay:${auctionId}` }),

  wonPending: () =>
    api.get<{ auctions: Array<{ id: number; code: string; currentPrice: number; paymentDeadline: string }> }>(
      '/api/auctions/won/pending',
    ),
};
