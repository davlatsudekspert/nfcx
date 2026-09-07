/**
 * Pure purchase-funnel logic — no React, no navigation, no network.
 *
 * Every branch the ID purchase screens can take is decided here so the
 * screens stay presentational and the state machine can be unit-tested
 * against the Worker's real contract (hosting/worker.js, `recordsApi` POST
 * branch and `ordersApi`):
 *
 *   GET  /api/records/:code   200 → taken · 404 → free · 0 → offline
 *   POST /api/records/:code   202 {pending, orderId, price, payLink}
 *                             401 unauthorized
 *                             400 reserved
 *                             409 not_purchasable | exclusive_auction_only
 *                             409 already_taken | reserved_pending_payment
 *                             503 payments_disabled
 *                             5xx d1_unavailable | http_5xx
 */
import { ApiError } from '../../api/client';
import type { Order } from '../../api/types';
import type { TierKey } from '../../lib/codeTiers';
import { FREE_AUTO_ID_RE, getPersonalPurchaseQuote, parseAnyCode } from '../../lib/pricing';
import { isPayableOrder } from './orderStatus';

/* ------------------------------------------------------------------ *
 * What the user typed
 * ------------------------------------------------------------------ */

export type Candidate =
  | { kind: 'empty' }
  | { kind: 'invalid' }
  | { kind: 'freeAuto'; code: string }
  | { kind: 'auctionOnly'; code: string }
  | { kind: 'notPurchasable'; code: string }
  | { kind: 'purchasable'; code: string; tier: Exclude<TierKey, 'exclusive'>; amount: number };

/** Network-free classification of the search input. The tier/price here is
 * a preview from src/lib/pricing.ts — the Worker's `personalPurchaseQuote`
 * remains the only price authority at purchase time. */
export function classifyCandidate(raw: string): Candidate {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return { kind: 'empty' };
  const parsed = parseAnyCode(trimmed);
  if (!parsed) return { kind: 'invalid' };
  const code = parsed.code;
  if (FREE_AUTO_ID_RE.test(code)) return { kind: 'freeAuto', code };
  const quote = getPersonalPurchaseQuote(code);
  if (quote.purchasable) return { kind: 'purchasable', code, tier: quote.tier, amount: quote.amount };
  if (quote.reason === 'exclusive_auction_only') return { kind: 'auctionOnly', code };
  return { kind: 'notPurchasable', code };
}

/* ------------------------------------------------------------------ *
 * Is the code free? (GET /api/records/:code)
 * ------------------------------------------------------------------ */

export type AvailabilityState = 'idle' | 'checking' | 'free' | 'taken' | 'offline' | 'failed';

export interface AvailabilityInput {
  /** The code being looked up, or null when nothing lookup-worthy is typed. */
  lookupCode: string | null;
  /** The debounced value still trails the input. */
  typing: boolean;
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
  error: unknown;
}

/**
 * `200` is the only proof a code is taken and `404` the only proof it is
 * free; every other failure is reported as exactly that, so the screen can
 * never show "Bu ID bo'sh" on a network blip.
 */
export function availabilityState(input: AvailabilityInput): AvailabilityState {
  if (!input.lookupCode) return 'idle';
  if (input.typing || input.isLoading) return 'checking';
  if (input.isSuccess) return 'taken';
  if (input.isError) {
    const status = input.error instanceof ApiError ? input.error.status : -1;
    if (status === 404) return 'free';
    if (status === 0) return 'offline';
    return 'failed';
  }
  return 'checking';
}

/* ------------------------------------------------------------------ *
 * The user's own reservation
 * ------------------------------------------------------------------ */

/**
 * A `409 reserved_pending_payment` — or a "free" lookup — may be about the
 * user's *own* live reservation (the record only exists once payment lands).
 * Sending them to "Boshqa ID qidirish" would be wrong; this finds the order
 * they should be taken back to instead.
 */
export function findOwnPendingOrder(
  orders: ReadonlyArray<Order> | null | undefined,
  code: string,
  nowMs: number = Date.now(),
): Order | null {
  const wanted = String(code ?? '').trim().toUpperCase();
  if (!wanted || !Array.isArray(orders)) return null;
  for (const order of orders) {
    if (!order || typeof order.code !== 'string') continue;
    if (order.code.trim().toUpperCase() !== wanted) continue;
    if (isPayableOrder(order, nowMs)) return order;
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * POST /api/records/:code outcomes
 * ------------------------------------------------------------------ */

export type PurchaseBlocker =
  | { kind: 'none' }
  /** 503 payments_disabled / payments_backend_pending — a product state. */
  | { kind: 'paymentsOff' }
  /** 409 already_taken / code_taken — someone owns it now. */
  | { kind: 'taken'; message: string }
  /** 409 reserved_pending_payment by another user — frees itself in ≤24h. */
  | { kind: 'reserved'; message: string }
  /** 400 reserved / 409 not_purchasable / exclusive_auction_only. */
  | { kind: 'notPurchasable'; message: string }
  /** 401 — the cookie session is gone. */
  | { kind: 'session' }
  /** Anything else, already mapped to Uzbek copy. */
  | { kind: 'error'; message: string };

const TAKEN_CODES = new Set(['already_taken', 'code_taken']);
const NOT_PURCHASABLE_CODES = new Set(['reserved', 'not_purchasable', 'exclusive_auction_only']);
const PAYMENTS_OFF_CODES = new Set(['payments_disabled', 'payments_backend_pending']);

export function purchaseBlockerFromError(error: unknown, fallbackMessage: string): PurchaseBlocker {
  if (!(error instanceof ApiError)) return { kind: 'error', message: fallbackMessage };
  if (PAYMENTS_OFF_CODES.has(error.code)) return { kind: 'paymentsOff' };
  if (error.status === 401 || error.code === 'unauthorized') return { kind: 'session' };
  if (TAKEN_CODES.has(error.code)) return { kind: 'taken', message: error.message };
  if (error.code === 'reserved_pending_payment') return { kind: 'reserved', message: error.message };
  if (NOT_PURCHASABLE_CODES.has(error.code)) return { kind: 'notPurchasable', message: error.message };
  // `message` is already Uzbek copy (ERROR_COPY) — a 5xx / offline / 422
  // never reaches the screen as a raw token.
  return { kind: 'error', message: error.message || fallbackMessage };
}

/* ------------------------------------------------------------------ *
 * May the confirm button fire?
 * ------------------------------------------------------------------ */

export interface ConfirmGate {
  purchasable: boolean;
  paymentsStatus: 'unknown' | 'enabled' | 'disabled';
  submitting: boolean;
  /** The user already holds a payable order for this code. */
  hasOwnPending: boolean;
}

/** Fail closed: an unknown payments flag, an in-flight submit or an existing
 * reservation all keep the button inert — the server would refuse anyway. */
export function canConfirmPurchase(gate: ConfirmGate): boolean {
  return gate.purchasable && gate.paymentsStatus === 'enabled' && !gate.submitting && !gate.hasOwnPending;
}

/* ------------------------------------------------------------------ *
 * Step 3 — is the Payme link still worth opening?
 * ------------------------------------------------------------------ */

/**
 * The checkout link is only offered while the order can still be paid: no
 * link at all, or a server answer other than `pending`, hides it. An order
 * that has not loaded yet (first poll in flight, offline) keeps the link —
 * the server, not the client, decides on the Payme side.
 */
export function payLinkUsable(
  payLink: string | null | undefined,
  order: Pick<Order, 'status'> | null | undefined,
  loaded: boolean,
  nowMs: number = Date.now(),
): boolean {
  if (typeof payLink !== 'string' || !/^https:\/\//i.test(payLink.trim())) return false;
  if (!loaded || !order) return true;
  return isPayableOrder({ id: 0, code: '', price: 0, ...order } as Order, nowMs);
}
