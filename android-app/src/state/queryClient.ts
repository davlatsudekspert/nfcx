import { QueryClient } from '@tanstack/react-query';
import { ApiError } from '../api/client';

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
      refetchOnWindowFocus: false, // N/A on native, but explicit for clarity
    },
    mutations: {
      retry: false, // mutations are never auto-retried — double-submit protection lives in api/client.ts instead
    },
  },
});
