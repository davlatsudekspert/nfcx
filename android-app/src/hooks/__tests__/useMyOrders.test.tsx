import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Order } from '../../api/types';
import { orderKeys, useMyOrders } from '../useMyOrders';

let focusCallback: (() => void | (() => void)) | null = null;
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb: () => void | (() => void)) => {
    focusCallback = cb;
  },
}));

jest.mock('../../api/orders', () => ({
  ordersApi: { list: jest.fn() },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { ordersApi } = require('../../api/orders') as { ordersApi: { list: jest.Mock } };

const HOUR = 60 * 60 * 1000;
const recent = new Date(Date.now() - HOUR).toISOString();
const stale = new Date(Date.now() - 30 * HOUR).toISOString();

/** What `GET /api/orders` returns for the reported account. */
const FROM_API: Order[] = [
  { id: 1, code: 'TST001', kind: 'card_purchase', price: 50_000, status: 'cancelled', createdAt: recent },
  { id: 77, code: 'TST077', kind: 'card_purchase', price: 50_000, status: 'cancelled', createdAt: recent },
  { id: 75, code: 'TST075', kind: 'card_purchase', price: 50_000, status: 'cancelled', createdAt: recent },
  { id: 80, code: 'TST080', kind: 'card_purchase', price: 50_000, status: 'pending', createdAt: recent },
  { id: 81, code: 'TST081', kind: 'card_purchase', price: 50_000, status: 'pending', createdAt: stale },
  { id: 82, code: 'TST082', kind: 'card_purchase', price: 50_000, status: 'paid', createdAt: recent },
  { id: 83, code: 'TST083', kind: 'card_purchase', price: 50_000, status: 'failed_code_taken', createdAt: recent },
  { id: 90, code: 'AUC001', kind: 'auction_payment', price: 900_000, status: 'pending', createdAt: recent },
];

let client: QueryClient;

/** Minimal `renderHook` on react-test-renderer (the testing-library build in
 * node_modules lacks its `test-renderer` peer). */
function renderHook<T>(hook: () => T): { current: () => T; unmount: () => void } {
  let latest: T | undefined;
  function Probe() {
    latest = hook();
    return null;
  }
  let renderer: ReactTestRenderer | undefined;
  act(() => {
    renderer = create(
      <QueryClientProvider client={client}>
        <Probe />
      </QueryClientProvider>,
    );
  });
  return {
    current: () => latest as T,
    unmount: () => {
      act(() => renderer?.unmount());
      // No cache GC timer left behind to keep Jest alive after the run.
      client.clear();
    },
  };
}

async function waitFor(assertion: () => void, timeoutMs = 2_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      assertion();
      return;
    } catch (error) {
      if (Date.now() > deadline) throw error;
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
    }
  }
}

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  focusCallback = null;
  ordersApi.list.mockReset();
  ordersApi.list.mockResolvedValue({ orders: FROM_API });
});

describe('useMyOrders', () => {
  it('counts as "Kutilayotgan" only what the user can still pay for', async () => {
    const hook = renderHook(() => useMyOrders());
    await waitFor(() => expect(hook.current().query.isSuccess).toBe(true));

    expect(hook.current().pendingOrders.map((o) => o.code)).toEqual(['TST080']);
    // Cancelled on the web, paid, failed, older than the server's 24h
    // deadline, or an auction payment: none of them are pending here.
    for (const code of ['TST001', 'TST077', 'TST075', 'TST081', 'TST082', 'TST083', 'AUC001']) {
      expect(hook.current().pendingOrders.some((o) => o.code === code)).toBe(false);
    }
    hook.unmount();
  });

  it('keeps the full ID-purchase history (all statuses) but not auction payments', async () => {
    const hook = renderHook(() => useMyOrders());
    await waitFor(() => expect(hook.current().query.isSuccess).toBe(true));

    expect(hook.current().orders.map((o) => o.code)).toEqual([
      'TST001', 'TST077', 'TST075', 'TST080', 'TST081', 'TST082', 'TST083',
    ]);
    hook.unmount();
  });

  it('returns empty arrays, never undefined, before and without data', async () => {
    ordersApi.list.mockResolvedValue({ orders: undefined });
    const hook = renderHook(() => useMyOrders());
    expect(hook.current().orders).toEqual([]);
    expect(hook.current().pendingOrders).toEqual([]);
    await waitFor(() => expect(hook.current().query.isSuccess).toBe(true));
    expect(hook.current().pendingOrders).toEqual([]);
    hook.unmount();
  });

  it('re-checks the server when a screen regains focus with stale data', async () => {
    const hook = renderHook(() => useMyOrders());
    await waitFor(() => expect(hook.current().query.isSuccess).toBe(true));
    expect(ordersApi.list).toHaveBeenCalledTimes(1);
    expect(focusCallback).not.toBeNull();

    // Fresh data → a focus is a no-op (no double fetch right after mount).
    act(() => {
      focusCallback?.();
    });
    expect(ordersApi.list).toHaveBeenCalledTimes(1);

    // The web cancels TST080; the cached copy is now older than staleTime.
    ordersApi.list.mockResolvedValue({
      orders: FROM_API.map((o) => (o.code === 'TST080' ? { ...o, status: 'cancelled' } : o)),
    });
    const cached = client.getQueryCache().find({ queryKey: orderKeys.mine });
    if (cached) cached.state.dataUpdatedAt = Date.now() - 60_000;

    act(() => {
      focusCallback?.();
    });
    await waitFor(() => expect(ordersApi.list).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(hook.current().pendingOrders).toEqual([]));
    hook.unmount();
  });
});
