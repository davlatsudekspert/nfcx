import type { Order } from '../../api/types';
import { parseTimestampMs } from '../../lib/format';

/**
 * `web_orders.status` as the Worker actually returns it
 * (android/docs/02-API_MAP.md §2.3; hosting/worker.js `ordersApi`):
 * `pending | paid | cancelled | failed_code_taken | …`. Anything outside this
 * set is rendered as an honest "noma'lum" rather than echoed raw or silently
 * treated as success — a purchase screen must never imply a payment landed
 * when the backend said something we don't understand.
 */
export type OrderStatus = 'pending' | 'paid' | 'cancelled' | 'expired' | 'failed' | 'unknown';

/**
 * The server's own reservation deadline — `PENDING_ORDER_TTL_MS` in
 * hosting/worker.js. A `pending` row older than this is dead: the Worker
 * flips it to `cancelled` the next time anyone touches that code
 * (`activeWebOrderByCodeD1`), but `GET /api/orders` returns the raw row
 * until then, so the client mirrors the rule instead of showing a
 * "To'lov kutilmoqda" the server would refuse to honour.
 */
export const PENDING_ORDER_TTL_MS = 24 * 60 * 60 * 1000;

/** `web_orders.kind` for an auction winner's payment — surfaced in the
 * Auksion → Meniki tab, never in the ID-purchase lists (the web's
 * Buyurtmalarim applies the same exclusion). */
const AUCTION_PAYMENT_KIND = 'auction_payment';

export function orderStatus(
  order?: Pick<Order, 'status'> & Partial<Pick<Order, 'createdAt'>> | null,
  nowMs: number = Date.now(),
): OrderStatus {
  const raw = typeof order?.status === 'string' ? order.status.toLowerCase() : '';
  if (raw === 'pending') {
    // `GET /api/orders/:id` omits `createdAt`; with no timestamp the server's
    // word stands and the screen keeps polling it.
    const createdMs = parseTimestampMs(order?.createdAt);
    if (createdMs != null && nowMs - createdMs >= PENDING_ORDER_TTL_MS) return 'expired';
    return 'pending';
  }
  if (raw === 'paid' || raw === 'cancelled' || raw === 'expired') return raw;
  if (raw.startsWith('failed')) return 'failed';
  return 'unknown';
}

/**
 * The single definition of "Kutilayotgan buyurtma": an ID purchase the user
 * can still pay for. `cancelled`, `expired`, `failed_*`, `paid` and auction
 * payments are never payable here. Every pending list and pending count in
 * the app goes through this — no per-screen re-implementation.
 */
export function isPayableOrder(order: Order | null | undefined, nowMs: number = Date.now()): boolean {
  if (!order) return false;
  if (order.kind === AUCTION_PAYMENT_KIND) return false;
  return orderStatus(order, nowMs) === 'pending';
}

/** Orders that belong in an ID-purchase history list: everything the user
 * placed for an ID, whatever became of it. Auction payments are excluded for
 * the same reason as above. */
export function isIdPurchaseOrder(order: Order | null | undefined): boolean {
  return !!order && order.kind !== AUCTION_PAYMENT_KIND;
}

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "To'lov kutilmoqda",
  paid: "To'landi",
  cancelled: 'Bekor qilindi',
  expired: 'Muddati tugagan',
  failed: "Kod band bo'lib qoldi — pul qaytariladi",
  unknown: "Holat noma'lum",
};

export const ORDER_STATUS_TONE: Record<OrderStatus, 'warning' | 'success' | 'neutral'> = {
  pending: 'warning',
  paid: 'success',
  cancelled: 'neutral',
  expired: 'neutral',
  failed: 'warning',
  unknown: 'neutral',
};

/** Copy that explains what the user should do next — no dead-end screens. */
export const ORDER_STATUS_HINT: Record<OrderStatus, string> = {
  pending: "Buyurtma band qilindi. To'lov tasdiqlangach ID sizga biriktiriladi.",
  paid: 'ID sizga biriktirildi.',
  cancelled: 'Bu buyurtma bekor qilingan. ID yana bo‘sh bo‘lishi mumkin.',
  expired: "To'lov muddati o'tib ketgan. ID yana bo'sh bo'lishi mumkin.",
  failed: "To'lov o'tguncha bu kod boshqa foydalanuvchiga biriktirildi. Pul to'liq qaytariladi.",
  unknown: 'Buyurtma holatini hozircha aniqlab bo‘lmadi. Birozdan so‘ng qayta tekshiring.',
};
