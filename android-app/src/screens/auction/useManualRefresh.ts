import { useCallback, useState } from 'react';

/**
 * Pull-to-refresh state that reflects *the user's* refresh only.
 *
 * The auction lists poll in the background (20s on the list, 4s on a live
 * detail screen), and react-query's `isRefetching` is true during those polls
 * too — binding it to `refreshing` would flash the spinner every few seconds
 * on an idle screen. This tracks the explicit gesture instead.
 */
export function useManualRefresh(refetch: () => Promise<unknown>): {
  refreshing: boolean;
  onRefresh: () => void;
} {
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void Promise.resolve(refetch())
      .catch(() => {
        // The query's own error state renders the failure; the spinner just
        // needs to stop.
      })
      .finally(() => setRefreshing(false));
  }, [refetch]);

  return { refreshing, onRefresh };
}
