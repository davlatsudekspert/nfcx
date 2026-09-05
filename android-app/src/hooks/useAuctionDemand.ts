import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { auctionsApi } from '../api/auctions';

/**
 * "Yaqinda" (upcoming) tab data source — android/docs/02-API_MAP.md §2.4.
 * There is no distinct "scheduled/upcoming auction" status anywhere in the
 * live API; the closest real concept is the demand board (IDs users have
 * voted to send to auction, `status: collecting|ready`) — mapped here
 * rather than inventing a fake "upcoming auctions" list.
 */
export function useAuctionDemand() {
  return useQuery({
    queryKey: ['auction-demand'],
    queryFn: () => auctionsApi.demand(),
  });
}

export function useVoteAuctionDemand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (demandId: number) => auctionsApi.vote(demandId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['auction-demand'] }),
  });
}
