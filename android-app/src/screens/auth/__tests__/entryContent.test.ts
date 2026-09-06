import {
  ENTRY_BENEFITS,
  ENTRY_STEPS,
  ENTRY_TIERS,
} from '../entryContent';
import {
  SUPPORT_PHONE_DISPLAY,
  SUPPORT_PHONE_URL,
  SUPPORT_TELEGRAM_HANDLE,
  SUPPORT_TELEGRAM_URL,
} from '../supportContacts';
import { TIER_LABEL, TIER_PRICE } from '../../../lib/pricing';
import { formatSom } from '../../../lib/format';

/** Nothing on the entry screen may ever render an empty or broken string —
 * this is the guard that keeps `NaN`/`undefined` out of the storefront. */
const isCleanText = (s: string) =>
  typeof s === 'string' &&
  s.trim().length > 0 &&
  !/NaN|undefined|null|\[object Object\]/.test(s);

describe('entry screen content', () => {
  it('renders 3-5 benefits, all with clean copy', () => {
    expect(ENTRY_BENEFITS.length).toBeGreaterThanOrEqual(3);
    expect(ENTRY_BENEFITS.length).toBeLessThanOrEqual(5);
    for (const b of ENTRY_BENEFITS) {
      expect(isCleanText(b.title)).toBe(true);
      expect(isCleanText(b.text)).toBe(true);
      expect(isCleanText(b.icon)).toBe(true);
    }
  });

  it('describes the flow in exactly three numbered steps', () => {
    expect(ENTRY_STEPS).toHaveLength(3);
    expect(ENTRY_STEPS.map((s) => s.n)).toEqual(['01', '02', '03']);
    for (const s of ENTRY_STEPS) {
      expect(isCleanText(s.title)).toBe(true);
      expect(isCleanText(s.text)).toBe(true);
    }
  });

  it('covers every tier, most exclusive first', () => {
    expect(ENTRY_TIERS.map((t) => t.key)).toEqual([
      'exclusive',
      'premium',
      'gold',
      'silver',
      'free',
    ]);
  });

  it('takes labels and prices from the shared pricing table, never hardcoded', () => {
    for (const t of ENTRY_TIERS) {
      expect(t.label).toBe(TIER_LABEL[t.key]);
      const price = TIER_PRICE[t.key];
      if (price == null) {
        // Exclusive has no fixed price: auction-only, stated in words rather
        // than pushed through a number formatter.
        expect(t.priceText).toBe('Auksionda');
      } else {
        expect(t.priceText).toBe(formatSom(price));
      }
      expect(isCleanText(t.priceText)).toBe(true);
      expect(isCleanText(t.hint)).toBe(true);
      expect(t.sampleCode).toMatch(/^[A-Z]{3}[0-9]{3}$/);
    }
  });

  it('marks only the exclusive tier as auction-only', () => {
    const auctionOnly = ENTRY_TIERS.filter((t) => TIER_PRICE[t.key] == null);
    expect(auctionOnly.map((t) => t.key)).toEqual(['exclusive']);
  });
});

describe('support contacts', () => {
  it('uses the channels published on the website, in openable form', () => {
    expect(SUPPORT_TELEGRAM_HANDLE).toBe('@nfcstore_admin');
    expect(SUPPORT_TELEGRAM_URL).toBe('https://t.me/nfcstore_admin');
    expect(SUPPORT_PHONE_DISPLAY).toBe('+998 50 090 82 77');
    expect(SUPPORT_PHONE_URL).toBe('tel:+998500908277');
    // The dialable URL and the human-readable number must be the same number.
    expect(SUPPORT_PHONE_URL.replace('tel:', '')).toBe(SUPPORT_PHONE_DISPLAY.replace(/\s/g, ''));
  });
});
