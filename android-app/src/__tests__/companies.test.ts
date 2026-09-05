import { companyTierForId } from '../api/companies';

describe('companyTierForId (ported from src/lib/company.js)', () => {
  it('classifies a 3-letter ID as exclusive at 990,000', () => {
    expect(companyTierForId('ABC')).toEqual({ tier: 'exclusive', price: 990000 });
  });

  it('classifies a 4-5 letter ID as premium at 749,000', () => {
    expect(companyTierForId('ABCD')).toEqual({ tier: 'premium', price: 749000 });
    expect(companyTierForId('ABCDE')).toEqual({ tier: 'premium', price: 749000 });
  });

  it('classifies a 6-7 letter ID as gold at 549,000', () => {
    expect(companyTierForId('ABCDEF')).toEqual({ tier: 'gold', price: 549000 });
    expect(companyTierForId('ABCDEFG')).toEqual({ tier: 'gold', price: 549000 });
  });

  it('classifies an 8-15 letter ID as silver at 349,000', () => {
    expect(companyTierForId('NFCSTOREUZ')).toEqual({ tier: 'silver', price: 349000 });
  });
});
