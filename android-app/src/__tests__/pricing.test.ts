import { tierForCode, priceForCode, getPersonalPurchaseQuote, TIER_PRICE } from '../lib/pricing';

describe('pricing.ts (ported from src/lib/pricing.js)', () => {
  it('classifies triple-repeat letters+digits as exclusive', () => {
    expect(tierForCode('AAA777')).toBe('exclusive');
  });

  it('classifies an exclusive word regardless of digits', () => {
    expect(tierForCode('VIP123')).toBe('exclusive');
  });

  it('classifies digits "000" as premium', () => {
    expect(tierForCode('XYZ000')).toBe('premium');
  });

  it('classifies a premium word with a super digit as premium', () => {
    expect(tierForCode('BMW007')).toBe('premium');
  });

  it('classifies a premium word with a plain digit as gold', () => {
    expect(tierForCode('BMW412')).toBe('gold');
  });

  it('classifies a mirror digit as silver', () => {
    expect(tierForCode('LOL101')).toBe('silver');
  });

  it('falls back to free ("Bronza") for a plain code', () => {
    expect(tierForCode('QWE482')).toBe('free');
  });

  it('honors a manual code-tier override over pattern logic', () => {
    // BEK001 is in the AUCTION_CODES override list — would otherwise be
    // "premium" or "gold" by pattern alone.
    expect(tierForCode('BEK001')).toBe('exclusive');
  });

  it('never returns a purchasable quote for an exclusive code', () => {
    const quote = getPersonalPurchaseQuote('AAA777');
    expect(quote.purchasable).toBe(false);
    if (!quote.purchasable) expect(quote.reason).toBe('exclusive_auction_only');
  });

  it('returns a real, non-zero amount for every purchasable tier', () => {
    const quote = getPersonalPurchaseQuote('QWE482'); // free/Bronza
    expect(quote.purchasable).toBe(true);
    if (quote.purchasable) {
      expect(quote.amount).toBe(TIER_PRICE.free);
      expect(quote.amount).toBeGreaterThan(0);
    }
  });

  it('rejects the 8-digit auto-free ID format from purchase', () => {
    const quote = getPersonalPurchaseQuote('12345678');
    expect(quote.purchasable).toBe(false);
  });

  it('priceForCode matches TIER_PRICE for the classified tier', () => {
    const { total, tier } = priceForCode('BMW412');
    expect(tier).toBe('gold');
    expect(total).toBe(TIER_PRICE.gold);
  });
});
