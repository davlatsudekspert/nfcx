import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { auctionsApi } from '../api/auctions';
import { isAuctionLive, newIdempotencyKey } from '../screens/auction/auctionModel';

/**
 * Every auction query key in one place, so a bid/vote/payment can invalidate
 * exactly what it changed (and `auctionKeys.all` can invalidate the section).
 */
export const auctionKeys = {
  all: ['auctions'] as const,
  active: ['auctions', 'active'] as const,
  sold: ['auctions', 'sold'] as const,
  preview: ['auctions', 'preview'] as const,
  detail: (id: number) => ['auctions', 'detail', id] as const,
  wonPending: ['auctions', 'won-pending'] as const,
};

/** How often the list tabs re-poll. There is no WebSocket/SSE anywhere in
 * this backend (android/docs/03-ARCHITECTURE.md §3.4), so "live" is polling —
 * kept slow on the list (the countdown itself ticks locally) and fast only on
 * the detail screen the user is actually looking at. */
const LIST_POLL_MS = 20_000;
const DETAIL_POLL_MS = 4_000;

/** GET /api/auctions — android/docs/02-API_MAP.md §2.4. Home just wants a
 * one-shot snapshot for its preview cards. */
export function useAuctionsPreview() {
  return useQuery({
    queryKey: auctionKeys.preview,
    queryFn: () => auctionsApi.list(false),
    select: (data) => (data.auctions ?? []).slice(0, 3),
  });
}

/** The "Jonli" tab. `auctions` is the live set; anything the backend leaves
 * out of it simply isn't shown — no client-side invention. */
export function useActiveAuctions() {
  return useQuery({
    queryKey: auctionKeys.active,
    queryFn: () => auctionsApi.list(false),
    select: (data) => data.auctions ?? [],
    refetchInterval: LIST_POLL_MS,
  });
}

/** The "Tugagan" tab — `?withSold=1` adds the `sold` array to the same
 * endpoint; it is the only source of finished auctions in the API. */
export function useEndedAuctions() {
  return useQuery({
    queryKey: auctionKeys.sold,
    queryFn: () => auctionsApi.list(true),
    select: (data) => data.sold ?? [],
  });
}

/**
 * GET /api/auctions/:id → `{ auction, bids }`. Polls only while the auction
 * is genuinely still running (status *and* deadline), so a finished auction
 * stops costing requests and battery.
 */
export function useAuctionDetail(auctionId: number) {
  return useQuery({
    queryKey: auctionKeys.detail(auctionId),
    queryFn: () => auctionsApi.get(auctionId),
    enabled: Number.isFinite(auctionId),
    refetchInterval: (query) => (isAuctionLive(query.state.data?.auction) ? DETAIL_POLL_MS : false),
  });
}

/**
 * GET /api/auctions/won/pending — auctions this user won that still owe
 * payment. This is also the only "my auctions" data the API exposes: there is
 * no endpoint for a user's bid history across auctions (confirmed in the
 * Phase 1 audit), which is why the "Meniki" tab shows won/pending only.
 */
export function useWonPendingAuctions() {
  return useQuery({
    queryKey: auctionKeys.wonPending,
    queryFn: () => auctionsApi.wonPending(),
    select: (data) => data.auctions ?? [],
  });
}

/**
 * POST /api/auctions/:id/bid with a **fresh idempotency key per attempt**
 * (a retry after a real failure must not be swallowed by the client's
 * in-flight de-dupe, while a double-tap of the same attempt must be).
 *
 * This endpoint answers `503 payments_disabled` in production today; the
 * caller renders that as an explicit disabled state — see
 * `isPaymentsDisabledError` in src/screens/auction/auctionModel.ts.
 */
export function usePlaceBid(auctionId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (amount: number) => auctionsApi.bid(auctionId, amount, newIdempotencyKey(auctionId)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: auctionKeys.detail(auctionId) });
      queryClient.invalidateQueries({ queryKey: auctionKeys.active });
      queryClient.invalidateQueries({ queryKey: auctionKeys.preview });
    },
  });
}

/** POST /api/auctions/:id/pay — same honest-503 contract as `bid`. */
export function useAuctionPayment(auctionId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { name: string; phone: string }) => auctionsApi.pay(auctionId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: auctionKeys.all });
    },
  });
}

/** POST /api/auction-requests — ask the team to put a specific ID up for
 * auction. A real endpoint, wired from the demand board. */
export function useRequestAuction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { code: string; note?: string }) => auctionsApi.requestAuction(input.code, input.note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auction-demand'] });
    },
  });
}
