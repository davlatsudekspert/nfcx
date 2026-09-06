import type { Order } from '../../api/types';

/**
 * `web_orders.status` as the Worker actually returns it
 * (android/docs/02-API_MAP.md §2.3). Anything outside this set is rendered
 * as an honest "noma'lum" rather than echoed raw or silently treated as
 * success — a purchase screen must never imply a payment landed when the
 * backend said something we don't understand.
 */
export type OrderStatus = 'pending' | 'paid' | 'cancelled' | 'expired' | 'unknown';

export function orderStatus(order?: Pick<Order, 'status'> | null): OrderStatus {
  const raw = typeof order?.status === 'string' ? order.status.toLowerCase() : '';
  if (raw === 'pending' || raw === 'paid' || raw === 'cancelled' || raw === 'expired') return raw;
  return 'unknown';
}

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "To'lov kutilmoqda",
  paid: "To'landi",
  cancelled: 'Bekor qilingan',
  expired: 'Muddati tugagan',
  unknown: "Holat noma'lum",
};

export const ORDER_STATUS_TONE: Record<OrderStatus, 'warning' | 'success' | 'neutral'> = {
  pending: 'warning',
  paid: 'success',
  cancelled: 'neutral',
  expired: 'neutral',
  unknown: 'neutral',
};

/** Copy that explains what the user should do next — no dead-end screens. */
export const ORDER_STATUS_HINT: Record<OrderStatus, string> = {
  pending: "Buyurtma band qilindi. To'lov tasdiqlangach ID sizga biriktiriladi.",
  paid: 'ID sizga biriktirildi.',
  cancelled: 'Bu buyurtma bekor qilingan. ID yana bo‘sh bo‘lishi mumkin.',
  expired: "To'lov muddati o'tib ketgan. ID yana bo'sh bo'lishi mumkin.",
  unknown: 'Buyurtma holatini hozircha aniqlab bo‘lmadi. Birozdan so‘ng qayta tekshiring.',
};
