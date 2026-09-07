import type { Order } from '../../../api/types';
import {
  ORDER_STATUS_LABEL,
  PENDING_ORDER_TTL_MS,
  isIdPurchaseOrder,
  isPayableOrder,
  orderStatus,
} from '../orderStatus';

const NOW = Date.parse('2026-09-07T12:00:00Z');
const iso = (msAgo: number) => new Date(NOW - msAgo).toISOString();

function order(partial: Partial<Order> = {}): Order {
  return { id: 1, code: 'TST001', kind: 'card_purchase', price: 50_000, status: 'pending', createdAt: iso(60_000), ...partial };
}

describe('orderStatus', () => {
  it('passes the raw server statuses through', () => {
    expect(orderStatus(order({ status: 'pending' }), NOW)).toBe('pending');
    expect(orderStatus(order({ status: 'paid' }), NOW)).toBe('paid');
    expect(orderStatus(order({ status: 'cancelled' }), NOW)).toBe('cancelled');
    expect(orderStatus(order({ status: 'expired' }), NOW)).toBe('expired');
  });

  it('maps every failed_* status to failed and anything else to unknown', () => {
    expect(orderStatus(order({ status: 'failed_code_taken' }), NOW)).toBe('failed');
    expect(orderStatus(order({ status: 'failed_other' }), NOW)).toBe('failed');
    expect(orderStatus(order({ status: 'something_new' }), NOW)).toBe('unknown');
    expect(orderStatus(null)).toBe('unknown');
    expect(orderStatus({ status: undefined as unknown as string })).toBe('unknown');
  });

  it("mirrors the Worker's 24h reservation deadline for pending rows", () => {
    expect(orderStatus(order({ createdAt: iso(PENDING_ORDER_TTL_MS - 1_000) }), NOW)).toBe('pending');
    expect(orderStatus(order({ createdAt: iso(PENDING_ORDER_TTL_MS) }), NOW)).toBe('expired');
    expect(orderStatus(order({ createdAt: iso(3 * PENDING_ORDER_TTL_MS) }), NOW)).toBe('expired');
  });

  it("keeps the server's word when no createdAt is exposed (GET /api/orders/:id)", () => {
    expect(orderStatus({ status: 'pending' }, NOW)).toBe('pending');
    expect(orderStatus(order({ createdAt: 'not a date' }), NOW)).toBe('pending');
  });

  it('never renders a raw backend token as a label', () => {
    for (const status of ['pending', 'paid', 'cancelled', 'expired', 'failed_code_taken', 'weird'] as const) {
      const label = ORDER_STATUS_LABEL[orderStatus(order({ status }), NOW)];
      expect(label).toBeTruthy();
      expect(label).not.toBe(status);
    }
    expect(ORDER_STATUS_LABEL[orderStatus(order({ status: 'cancelled' }), NOW)]).toBe('Bekor qilindi');
  });
});

describe('isPayableOrder — the single "Kutilayotgan" rule', () => {
  it('accepts only a fresh pending ID purchase', () => {
    expect(isPayableOrder(order(), NOW)).toBe(true);
    expect(isPayableOrder(order({ kind: undefined }), NOW)).toBe(true);
  });

  it('rejects every status the website shows as not pending', () => {
    expect(isPayableOrder(order({ status: 'cancelled' }), NOW)).toBe(false);
    expect(isPayableOrder(order({ status: 'paid' }), NOW)).toBe(false);
    expect(isPayableOrder(order({ status: 'expired' }), NOW)).toBe(false);
    expect(isPayableOrder(order({ status: 'failed_code_taken' }), NOW)).toBe(false);
    expect(isPayableOrder(order({ status: 'unexpected' }), NOW)).toBe(false);
  });

  it('rejects a pending row the server would refuse to honour (older than 24h)', () => {
    expect(isPayableOrder(order({ createdAt: iso(PENDING_ORDER_TTL_MS + 1) }), NOW)).toBe(false);
  });

  it('keeps auction payments out of the ID lists, like the website', () => {
    expect(isPayableOrder(order({ kind: 'auction_payment' }), NOW)).toBe(false);
    expect(isIdPurchaseOrder(order({ kind: 'auction_payment' }))).toBe(false);
    expect(isIdPurchaseOrder(order({ status: 'cancelled' }))).toBe(true);
    expect(isIdPurchaseOrder(null)).toBe(false);
  });

  it('reproduces the reported case: TST001 / TST077 / TST075 cancelled on the web', () => {
    const fromApi: Order[] = [
      order({ id: 1, code: 'TST001', status: 'cancelled' }),
      order({ id: 77, code: 'TST077', status: 'cancelled' }),
      order({ id: 75, code: 'TST075', status: 'cancelled' }),
      order({ id: 80, code: 'TST080', status: 'pending' }),
    ];
    const pending = fromApi.filter((o) => isPayableOrder(o, NOW));
    expect(pending.map((o) => o.code)).toEqual(['TST080']);
    expect(pending).toHaveLength(1);
  });
});
