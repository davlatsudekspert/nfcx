import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Auction } from '../../../api/types';
import { useActiveAuctions, useAuctionsPreview, useEndedAuctions } from '../../../hooks/useAuctions';
import { summarizeAuctions } from '../auctionModel';

jest.mock('../../../api/auctions', () => ({
  auctionsApi: { list: jest.fn() },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { auctionsApi } = require('../../../api/auctions') as { auctionsApi: { list: jest.Mock } };

function row(id: number, status: Auction['status']): Auction {
  return {
    id,
    code: `SOLD${id}`,
    status,
    currentPrice: 100_000 * id,
    startPrice: 50_000,
    minIncrement: 10_000,
    endsAt: new Date(Date.now() - id * 3_600_000).toISOString(),
  };
}

/** The Worker returns up to 200 `auctions` and up to 40 `sold` rows on one
 * call (hosting/worker.js `GET /api/auctions?withSold=1`). */
const SOLD = [1, 2, 3, 4, 5, 6, 7].map((id) => row(id, 'sold'));
const ACTIVE = [11, 12, 13, 14, 15].map((id) => row(id, 'active'));

/** Minimal `renderHook` on react-test-renderer (the testing-library build in
 * node_modules lacks its `test-renderer` peer). */
function renderHook<T>(hook: () => T): { current: () => T; unmount: () => void } {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
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
  auctionsApi.list.mockReset();
  auctionsApi.list.mockImplementation((withSold: boolean) =>
    Promise.resolve(withSold ? { auctions: ACTIVE, sold: SOLD } : { auctions: ACTIVE }),
  );
});

describe('Tugagan tab data path', () => {
  it('hands every sold row to the list — the same rows the "Yakunlangan" tile counts', async () => {
    const hook = renderHook(() => useEndedAuctions());
    await waitFor(() => expect(hook.current().isSuccess).toBe(true));

    const rows = hook.current().data ?? [];
    expect(rows).toHaveLength(7);
    expect(rows.map((r) => r.id)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    // The metric tile and the list are fed from one array, so they cannot disagree.
    expect(summarizeAuctions(rows).count).toBe(rows.length);
    expect(auctionsApi.list).toHaveBeenCalledWith(true);
    hook.unmount();
  });

  it('gives the archive an empty list, not a crash, when the server omits `sold`', async () => {
    auctionsApi.list.mockResolvedValueOnce({ auctions: ACTIVE });
    const hook = renderHook(() => useEndedAuctions());
    await waitFor(() => expect(hook.current().isSuccess).toBe(true));
    expect(hook.current().data).toEqual([]);
    hook.unmount();
  });
});

describe('Jonli tab data path', () => {
  it('hands every active row to the list', async () => {
    const hook = renderHook(() => useActiveAuctions());
    await waitFor(() => expect(hook.current().isSuccess).toBe(true));
    expect(hook.current().data).toHaveLength(5);
    expect(auctionsApi.list).toHaveBeenCalledWith(false);
    hook.unmount();
  });
});

describe('Home preview', () => {
  it('is the only place a limit is applied (three cards)', async () => {
    const hook = renderHook(() => useAuctionsPreview());
    await waitFor(() => expect(hook.current().isSuccess).toBe(true));
    expect(hook.current().data).toHaveLength(3);
    hook.unmount();
  });
});
