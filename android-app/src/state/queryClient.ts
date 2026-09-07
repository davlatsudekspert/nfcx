import { AppState, type AppStateStatus } from 'react-native';
import { QueryClient, focusManager } from '@tanstack/react-query';
import { ApiError } from '../api/client';

/**
 * React Query has no notion of "window focus" on native until it is told:
 * this maps the app coming back to the foreground onto a focus event, so any
 * query opting into `refetchOnWindowFocus` (orders, for one — a cancellation
 * made on the website must show up on the next visit) re-checks the server
 * instead of showing what the app fetched before it was backgrounded.
 */
focusManager.setEventListener((handleFocus) => {
  const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
    handleFocus(state === 'active');
  });
  return () => sub.remove();
});

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // Never retry auth/validation/business-rule errors — only real
        // transient failures (network, 503).
        if (error instanceof ApiError && ![0, 503].includes(error.status)) return false;
        return failureCount < 2;
      },
      staleTime: 15_000,
      // Off by default: the list polls and the countdowns tick on their own.
      // Queries whose truth can change elsewhere (orders) opt in per query.
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false, // mutations are never auto-retried — double-submit protection lives in api/client.ts instead
    },
  },
});
