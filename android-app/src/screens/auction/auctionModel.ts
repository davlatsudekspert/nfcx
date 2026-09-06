/**
 * Pure auction logic — no React, no navigation, no side effects.
 *
 * Everything the auction screens need to answer "what is the state of this
 * auction for *this* user, and what is a legal next bid" lives here so the
 * screens stay presentational and every number/timestamp goes through the
 * defensive helpers in src/lib/format.ts (a malformed `endsAt` or a missing
 * `currentPrice` can never reach the UI as `NaN`/`undefined`).
 *
 * Field names come from src/api/types.ts, which mirrors the live Worker
 * (android/docs/02-API_MAP.md §2.4). Nothing here invents data.
 */
import { ApiError } from '../../api/client';
import type { Auction, Bid } from '../../api/types';
import { countdownState, formatSom, parseTimestampMs, toFiniteNumber } from '../../lib/format';

/** Used only when the backend omits `minIncrement` on an auction row — the
 * same fallback the web app applies. The server remains the authority: a bid
 * it rejects is surfaced verbatim (in Uzbek copy) rather than second-guessed. */
export const DEFAULT_MIN_INCREMENT = 10000;

/** Guard against a fat-fingered 20-digit amount before it ever leaves the app. */
const MAX_BID = 100_000_000_000;

export function auctionCurrentPrice(auction: Pick<Auction, 'currentPrice'> | null | undefined): number | null {
  if (!auction) return null;
  const n = toFiniteNumber(auction.currentPrice);
  return n != null && n >= 0 ? n : null;
}

export function auctionStartPrice(auction: Pick<Auction, 'startPrice'> | null | undefined): number | null {
  if (!auction) return null;
  const n = toFiniteNumber(auction.startPrice);
  return n != null && n >= 0 ? n : null;
}

export function auctionMinIncrement(auction: Pick<Auction, 'minIncrement'> | null | undefined): number {
  const n = toFiniteNumber(auction?.minIncrement);
  return n != null && n > 0 ? n : DEFAULT_MIN_INCREMENT;
}

/** The smallest bid the server will accept, or null when the current price
 * itself is unknown (in which case the bid CTA stays disabled). */
export function minNextBid(auction: Auction | null | undefined): number | null {
  const current = auctionCurrentPrice(auction);
  if (current == null) return null;
  return current + auctionMinIncrement(auction);
}

/** User ids arrive as `number` from some endpoints and `string` from others
 * (src/api/types.ts `User.id: number | string`), so identity is compared on
 * the normalized string form — never with `===` on the raw values. */
export function sameUserId(a: unknown, b: unknown): boolean {
  if (a == null || b == null) return false;
  const left = String(a).trim();
  const right = String(b).trim();
  if (!left || !right) return false;
  return left === right;
}

export function isAuctionLive(auction: Auction | null | undefined, nowMs: number = Date.now()): boolean {
  if (!auction) return false;
  if (auction.status !== 'active') return false;
  return countdownState(auction.endsAt, nowMs).kind !== 'ended';
}

export type AuctionStatusTone = 'live' | 'success' | 'warning' | 'neutral';

/** Uzbek label + badge tone for any status string the backend may send —
 * an unknown status degrades to a neutral "Holat noma'lum", never to the raw
 * backend token. */
export function auctionStatusLabel(
  auction: Auction | null | undefined,
  nowMs: number = Date.now(),
): { label: string; tone: AuctionStatusTone } {
  if (!auction) return { label: "Holat noma'lum", tone: 'neutral' };
  if (auction.status === 'active') {
    return countdownState(auction.endsAt, nowMs).kind === 'ended'
      ? { label: 'Yakunlandi', tone: 'neutral' }
      : { label: 'LIVE', tone: 'live' };
  }
  if (auction.status === 'awaiting_payment') return { label: "To'lov kutilmoqda", tone: 'warning' };
  if (auction.status === 'sold') return { label: 'Sotildi', tone: 'success' };
  return { label: 'Yakunlandi', tone: 'neutral' };
}

export type ViewerState =
  /** Auction is running and this user holds the highest bid. */
  | 'leading'
  /** Auction is running, this user has bid, someone else is on top. */
  | 'outbid'
  /** Auction is running and this user has not bid yet (or is a guest). */
  | 'watching'
  /** Finished, this user won and payment is still owed. */
  | 'awaiting_payment'
  /** Finished, this user won. */
  | 'won'
  /** Finished, this user bid but someone else won. */
  | 'lost'
  /** Finished, this user was not a participant. */
  | 'ended';

export function viewerState(
  auction: Auction | null | undefined,
  bids: Bid[] | undefined,
  userId: unknown,
  nowMs: number = Date.now(),
): ViewerState {
  const live = isAuctionLive(auction, nowMs);
  const isHighest = sameUserId(auction?.highestBidderId, userId);
  const hasBid = (bids ?? []).some((b) => sameUserId(b.userId, userId));

  if (live) {
    if (isHighest) return 'leading';
    return hasBid ? 'outbid' : 'watching';
  }
  if (isHighest) return auction?.status === 'awaiting_payment' ? 'awaiting_payment' : 'won';
  return hasBid ? 'lost' : 'ended';
}

/** This user's own highest bid, or null when they have not bid. */
export function myHighestBid(bids: Bid[] | undefined, userId: unknown): number | null {
  let best: number | null = null;
  for (const bid of bids ?? []) {
    if (!sameUserId(bid.userId, userId)) continue;
    const amount = toFiniteNumber(bid.amount);
    if (amount == null) continue;
    if (best == null || amount > best) best = amount;
  }
  return best;
}

/** Highest bid first (ties broken by id, so the order is stable across
 * polls). An unparseable `amount` sinks to the bottom rather than scrambling
 * the list. The API does not promise an order, so the screen imposes one. */
export function sortBidsTopFirst(bids: Bid[] | undefined): Bid[] {
  const rows = [...(bids ?? [])];
  rows.sort((a, b) => {
    const amountA = toFiniteNumber(a.amount) ?? -1;
    const amountB = toFiniteNumber(b.amount) ?? -1;
    if (amountA !== amountB) return amountB - amountA;
    return (toFiniteNumber(b.id) ?? 0) - (toFiniteNumber(a.id) ?? 0);
  });
  return rows;
}

/** Id of the leading bid (highest amount), or null for an empty history. */
export function topBidId(bids: Bid[] | undefined): number | null {
  let top: Bid | null = null;
  for (const bid of bids ?? []) {
    const amount = toFiniteNumber(bid.amount);
    if (amount == null) continue;
    if (!top || amount > (toFiniteNumber(top.amount) ?? -1)) top = bid;
  }
  return top ? top.id : null;
}

export type BidValidation = { ok: true; amount: number } | { ok: false; message: string };

/** Validates the raw text of the bid input against `currentPrice + minIncrement`.
 * Accepts spaced input ("1 200 000") because that is what `formatSom` renders. */
export function validateBidInput(raw: string, minBid: number | null): BidValidation {
  const digits = String(raw ?? '').replace(/[^0-9]/g, '');
  if (!digits) return { ok: false, message: 'Taklif summasini kiriting.' };
  const amount = Number(digits);
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, message: "Summa noto'g'ri." };
  if (amount > MAX_BID) return { ok: false, message: 'Summa juda katta.' };
  if (minBid == null) {
    return { ok: false, message: "Joriy narx noma'lum. Sahifani yangilang." };
  }
  if (amount < minBid) {
    return { ok: false, message: `Taklif kamida ${formatSom(minBid)} bo'lishi kerak.` };
  }
  return { ok: true, amount };
}

/** Digits-only, so the input can never hold a value `Number()` would turn
 * into `NaN`. */
export function sanitizeAmountInput(raw: string): string {
  return String(raw ?? '').replace(/[^0-9]/g, '').slice(0, 12);
}

/**
 * `POST /api/auctions/:id/bid` and `/pay` answer `503 payments_disabled`
 * today (android/docs/02-API_MAP.md §2.4). That is a product state, not a
 * failure: the screens render it as an explicit "to'lovlar yopiq" panel.
 */
export function isPaymentsDisabledError(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  if (error.code === 'payments_disabled' || error.code === 'payments_backend_pending') return true;
  // A bare 503 from these two endpoints is the same condition surfaced
  // without a machine-readable body.
  return error.status === 503 && error.code === 'http_503';
}

export function isUnauthorizedError(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 401 || error.code === 'unauthorized');
}

/** One user-facing sentence for any thrown value. `ApiError.message` is
 * already Uzbek copy (src/api/types.ts ERROR_COPY); raw technical strings,
 * stack traces and `[object Object]` never reach the screen. */
export function apiErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 0 || error.code === 'network_error') {
      return "Internet aloqasi yo'q. Ulanishni tekshiring.";
    }
    return error.message;
  }
  return 'Xizmat vaqtincha mavjud emas.';
}

/** Fresh per attempt — mirrors the web app's `crypto.randomUUID()` double-submit
 * guard without depending on `crypto` being present in Hermes. */
export function newIdempotencyKey(auctionId: number): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `a${auctionId}-${Date.now().toString(36)}-${rand}`;
}

export interface AuctionsSummary {
  count: number;
  highestPrice: number | null;
  /** The `endsAt` of the auction finishing first — fed straight back into
   * `AuctionCountdown`, which owns its own parsing/guarding. */
  soonestEndsAt: string | null;
}

/** Header numbers for the list tabs — derived from the rows already on screen,
 * never fetched separately and never guessed. */
export function summarizeAuctions(rows: Auction[] | undefined): AuctionsSummary {
  let highestPrice: number | null = null;
  let soonestEndsAt: string | null = null;
  let soonestMs: number | null = null;

  for (const row of rows ?? []) {
    const price = auctionCurrentPrice(row);
    if (price != null && (highestPrice == null || price > highestPrice)) highestPrice = price;

    const ms = parseTimestampMs(row.endsAt);
    if (ms != null && (soonestMs == null || ms < soonestMs)) {
      soonestMs = ms;
      soonestEndsAt = row.endsAt;
    }
  }

  return { count: rows?.length ?? 0, highestPrice, soonestEndsAt };
}

/** Progress of a demand-board entry toward its auction threshold, clamped to
 * 0…1 so a bad `interestCount`/`threshold` can never blow out the bar. */
export function demandProgress(interestCount: unknown, threshold: unknown): number {
  const votes = toFiniteNumber(interestCount) ?? 0;
  const target = toFiniteNumber(threshold);
  if (target == null || target <= 0) return 0;
  return Math.max(0, Math.min(1, votes / target));
}
