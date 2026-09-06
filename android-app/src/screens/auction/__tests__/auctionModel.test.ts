import { ApiError } from '../../../api/client';
import type { Auction, Bid } from '../../../api/types';
import {
  DEFAULT_MIN_INCREMENT,
  auctionMinIncrement,
  auctionStatusLabel,
  demandProgress,
  isAuctionLive,
  isPaymentsDisabledError,
  minNextBid,
  myHighestBid,
  newIdempotencyKey,
  sameUserId,
  sortBidsTopFirst,
  summarizeAuctions,
  topBidId,
  validateBidInput,
  viewerState,
} from '../auctionModel';

const FUTURE = new Date(Date.now() + 60 * 60 * 1000).toISOString();
const PAST = new Date(Date.now() - 60 * 60 * 1000).toISOString();

function auction(partial: Partial<Auction> = {}): Auction {
  return {
    id: 1,
    code: 'AAA001',
    status: 'active',
    currentPrice: 1_000_000,
    endsAt: FUTURE,
    ...partial,
  };
}

function bid(partial: Partial<Bid> = {}): Bid {
  return {
    id: 1,
    auctionId: 1,
    userId: 7,
    amount: 1_000_000,
    released: false,
    createdAt: PAST,
    bidderCode: 'AAA001',
    ...partial,
  };
}

describe('auctionModel — money', () => {
  it('falls back to the default increment when the backend omits one', () => {
    expect(auctionMinIncrement(auction({ minIncrement: undefined }))).toBe(DEFAULT_MIN_INCREMENT);
    expect(auctionMinIncrement(auction({ minIncrement: 0 }))).toBe(DEFAULT_MIN_INCREMENT);
    expect(auctionMinIncrement(auction({ minIncrement: 50_000 }))).toBe(50_000);
  });

  it('computes the minimum next bid, and refuses to guess one without a price', () => {
    expect(minNextBid(auction({ currentPrice: 1_000_000, minIncrement: 25_000 }))).toBe(1_025_000);
    expect(minNextBid(auction({ currentPrice: Number.NaN }))).toBeNull();
    expect(minNextBid(null)).toBeNull();
  });
});

describe('auctionModel — bid validation', () => {
  it('accepts a spaced amount at or above the minimum', () => {
    expect(validateBidInput('1 200 000', 1_100_000)).toEqual({ ok: true, amount: 1_200_000 });
  });

  it('rejects an amount below the minimum with readable copy', () => {
    const result = validateBidInput('900000', 1_100_000);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.message).toContain("1 100 000 so'm");
  });

  it('never lets an unparseable amount through as NaN', () => {
    for (const raw of ['', '   ', 'abc', '-', '--']) {
      const result = validateBidInput(raw, 1_000);
      expect(result.ok).toBe(false);
      expect(result.ok === false && result.message).not.toMatch(/NaN|undefined/);
    }
  });

  it('refuses to validate when the current price itself is unknown', () => {
    expect(validateBidInput('5000', null).ok).toBe(false);
  });
});

describe('auctionModel — auction state', () => {
  it('treats a past deadline as not live even while the status still says active', () => {
    expect(isAuctionLive(auction({ endsAt: PAST }))).toBe(false);
    expect(isAuctionLive(auction())).toBe(true);
  });

  it('never leaks a raw backend status token into the badge', () => {
    expect(auctionStatusLabel(auction({ status: 'something_new' })).label).toBe('Yakunlandi');
    expect(auctionStatusLabel(auction()).tone).toBe('live');
    expect(auctionStatusLabel(null).label).not.toMatch(/undefined/);
  });

  it('compares user ids across the number/string forms the API mixes', () => {
    expect(sameUserId(7, '7')).toBe(true);
    expect(sameUserId(null, null)).toBe(false);
    expect(sameUserId('', '')).toBe(false);
  });

  it('derives the viewer state from highestBidderId and the bid history', () => {
    const live = auction({ highestBidderId: 7 });
    expect(viewerState(live, [bid({ userId: 7 })], 7)).toBe('leading');
    expect(viewerState(live, [bid({ userId: 9 })], 9)).toBe('outbid');
    expect(viewerState(live, [], 9)).toBe('watching');

    const finished = auction({ status: 'sold', endsAt: PAST, highestBidderId: 7 });
    expect(viewerState(finished, [bid({ userId: 7 })], 7)).toBe('won');
    expect(viewerState(finished, [bid({ userId: 9 })], 9)).toBe('lost');
    expect(viewerState(finished, [], 3)).toBe('ended');
    expect(viewerState(auction({ status: 'awaiting_payment', endsAt: PAST, highestBidderId: 7 }), [], 7)).toBe(
      'awaiting_payment',
    );
  });

  it('orders the history highest-first and finds the leading bid', () => {
    const rows = [bid({ id: 1, amount: 100 }), bid({ id: 2, amount: 300 }), bid({ id: 3, amount: 200 })];
    expect(sortBidsTopFirst(rows).map((b) => b.id)).toEqual([2, 3, 1]);
    expect(topBidId(rows)).toBe(2);
    expect(topBidId([])).toBeNull();
  });

  it('reports the viewer\'s own highest bid, ignoring malformed amounts', () => {
    const rows = [bid({ userId: 7, amount: 100 }), bid({ userId: 7, amount: Number.NaN }), bid({ userId: 9, amount: 900 })];
    expect(myHighestBid(rows, 7)).toBe(100);
    expect(myHighestBid(rows, 42)).toBeNull();
  });
});

describe('auctionModel — summaries and errors', () => {
  it('summarizes a list without tripping over a malformed endsAt', () => {
    const summary = summarizeAuctions([
      auction({ id: 1, currentPrice: 500, endsAt: 'not-a-date' }),
      auction({ id: 2, currentPrice: 900, endsAt: FUTURE }),
    ]);
    expect(summary).toEqual({ count: 2, highestPrice: 900, soonestEndsAt: FUTURE });
    expect(summarizeAuctions([])).toEqual({ count: 0, highestPrice: null, soonestEndsAt: null });
  });

  it('clamps demand progress to 0…1 for any input', () => {
    expect(demandProgress(10, 20)).toBe(0.5);
    expect(demandProgress(40, 20)).toBe(1);
    expect(demandProgress(5, 0)).toBe(0);
    expect(demandProgress('x', null)).toBe(0);
  });

  it('recognizes the real payments_disabled response, and only that', () => {
    expect(isPaymentsDisabledError(new ApiError('payments_disabled', 503))).toBe(true);
    expect(isPaymentsDisabledError(new ApiError('http_503', 503))).toBe(true);
    expect(isPaymentsDisabledError(new ApiError('d1_unavailable', 503))).toBe(false);
    expect(isPaymentsDisabledError(new ApiError('unauthorized', 401))).toBe(false);
    expect(isPaymentsDisabledError(new Error('boom'))).toBe(false);
  });

  it('issues a different idempotency key per attempt', () => {
    expect(newIdempotencyKey(5)).not.toBe(newIdempotencyKey(5));
  });
});
