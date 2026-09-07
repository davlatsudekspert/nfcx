import { useCallback, useMemo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { ordersApi } from '../api/orders';
import type { Order } from '../api/types';
import { isIdPurchaseOrder, isPayableOrder } from '../screens/id/orderStatus';

export const orderKeys = {
  all: ['orders'] as const,
  mine: ['orders', 'mine'] as const,
  detail: (id: number) => ['orders', id] as const,
};

/**
 * The website re-reads `/api/orders` every 5s while Buyurtmalarim is open;
 * the app does not poll, so it treats the list as stale after the same
 * interval and re-checks it every time the user comes back to a screen that
 * shows it (or brings the app back to the foreground).
 */
const ORDERS_STALE_MS = 5_000;

export interface MyOrders {
  query: UseQueryResult<{ orders: Order[] }>;
  /** Every order the user placed for an ID, newest first, all statuses —
   * the history list. Auction payments are not in here. */
  orders: Order[];
  /** Only orders that are genuinely still payable (`isPayableOrder`):
   * the "Kutilayotgan buyurtmalar" list and the pending count share this. */
  pendingOrders: Order[];
}

/**
 * `GET /api/orders` for the signed-in user — the one source for the pending
 * count on Home, the pending list in "Mening ID'larim", and the order
 * history in "ID qidirish". The payable/history rules live in
 * src/screens/id/orderStatus.ts, not here and not in any screen.
 *
 * Freshness: React Query only refetches on mount by default, and the tab
 * screens stay mounted for the life of the app — so without this hook a
 * "Bekor qilindi" made on the web stayed "KUTILMOQDA" in the app until it
 * was killed. The screen-focus effect and `refetchOnWindowFocus` (wired to
 * AppState in src/state/queryClient.ts) close that gap.
 */
export function useMyOrders(): MyOrders {
  const query = useQuery({
    queryKey: orderKeys.mine,
    queryFn: () => ordersApi.list(),
    staleTime: ORDERS_STALE_MS,
    refetchOnWindowFocus: true,
  });

  // Runs on focus transitions only (its dependency never changes), reading
  // the cache state at that moment — depending on `query.isStale` instead
  // would re-run it every time the data aged and turn a focus check into a
  // poll.
  const queryClient = useQueryClient();
  useFocusEffect(
    useCallback(() => {
      const state = queryClient.getQueryState(orderKeys.mine);
      // Mount fetch already in flight, or still fresh → nothing to do.
      if (!state || state.fetchStatus === 'fetching') return;
      if (Date.now() - state.dataUpdatedAt < ORDERS_STALE_MS) return;
      void queryClient.invalidateQueries({ queryKey: orderKeys.mine });
    }, [queryClient]),
  );

  const rows = query.data?.orders;
  const orders = useMemo(() => (Array.isArray(rows) ? rows.filter(isIdPurchaseOrder) : []), [rows]);
  const pendingOrders = useMemo(() => orders.filter((order) => isPayableOrder(order)), [orders]);

  return { query, orders, pendingOrders };
}
