import { useQuery } from '@tanstack/react-query';
import { auctionsApi } from '../api/auctions';

/** GET /api/auctions — android/docs/02-API_MAP.md §2.4. Auction list screens
 * poll this on a shorter interval themselves (Phase 8); Home just wants a
 * one-shot snapshot for its preview cards. */
export function useAuctionsPreview() {
  return useQuery({
    queryKey: ['auctions', 'preview'],
    queryFn: () => auctionsApi.list(false),
    select: (data) => data.auctions.slice(0, 3),
  });
}
