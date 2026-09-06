import { buildInboxItems } from '../screens/profile/notificationInbox';
import { uz } from '../i18n/strings';
import type { StringKey } from '../i18n';
import { profileText, type ProfileCopyKey } from '../screens/profile/profileCopy';

const t = (key: StringKey) => uz[key];
const c = (key: ProfileCopyKey) => profileText(key, 'uz');

describe('buildInboxItems — real sources only, no unsafe display values', () => {
  it('returns nothing when every source is empty (no fabricated notifications)', () => {
    expect(buildInboxItems({ gifts: [], wonAuctions: [], orders: [] }, t, c)).toEqual([]);
  });

  it('builds a gift row from a real gift offer', () => {
    const [item] = buildInboxItems(
      {
        gifts: [{ id: 7, code: 'AAA100', createdAt: '2026-01-01T10:00:00Z', fromEmail: 'a@b.uz' }],
        wonAuctions: [],
        orders: [],
      },
      t,
      c,
    );
    expect(item.id).toBe('gift-7');
    expect(item.category).toBe('gift');
    expect(item.icon).toBe('gift');
    expect(item.body).toContain('AAA100');
    expect(item.body).toContain('a@b.uz');
  });

  it('never renders NaN/undefined/null for malformed backend values', () => {
    const items = buildInboxItems(
      {
        gifts: [{ id: 1, code: '', createdAt: 'not-a-date' } as never],
        wonAuctions: [{ id: 2, code: 'BBB200', currentPrice: Number.NaN, paymentDeadline: '' }],
        orders: [{ id: 3, code: 'CCC300', price: undefined as never, status: 'pending' }],
      },
      t,
      c,
    );
    expect(items).toHaveLength(3);
    for (const item of items) {
      expect(item.title).toBeTruthy();
      expect(item.body).not.toMatch(/NaN|undefined|null|\[object Object\]/);
    }
  });

  it('drops long-finished orders but keeps pending ones forever', () => {
    const nowMs = Date.parse('2026-06-01T00:00:00Z');
    const items = buildInboxItems(
      {
        gifts: [],
        wonAuctions: [],
        orders: [
          { id: 10, code: 'OLD100', price: 1000, status: 'paid', createdAt: '2025-01-01T00:00:00Z' },
          { id: 11, code: 'PEN100', price: 1000, status: 'pending', createdAt: '2025-01-01T00:00:00Z' },
        ],
        nowMs,
      },
      t,
      c,
    );
    expect(items.map((i) => i.id)).toEqual(['order-11']);
  });

  it('sorts newest first and keeps actionable won auctions on top', () => {
    const items = buildInboxItems(
      {
        gifts: [{ id: 1, code: 'AAA100', createdAt: '2026-01-01T00:00:00Z' }],
        wonAuctions: [{ id: 5, code: 'BBB200', currentPrice: 500000, paymentDeadline: '2026-02-01T00:00:00Z' }],
        orders: [{ id: 9, code: 'CCC300', price: 100, status: 'pending', createdAt: '2026-03-01T00:00:00Z' }],
      },
      t,
      c,
    );
    expect(items.map((i) => i.id)).toEqual(['auction-5', 'order-9', 'gift-1']);
  });
});
