import { effectiveAccess, featureAllowed, businessModule } from '../lib/access';

describe('access.ts (ported from src/lib/access.js)', () => {
  it('floors effective access to premium when the owner has profile premium', () => {
    const card = { code: 'QWE482' }; // "free"/Bronza by pattern
    const access = effectiveAccess(card, { isPremium: true });
    expect(access).toBe('premium');
  });

  it('never lowers exclusive-tier access even without profile premium', () => {
    const card = { code: 'AAA777' }; // exclusive by pattern
    expect(effectiveAccess(card, { isPremium: false })).toBe('exclusive');
  });

  it('gates the music feature behind premium access', () => {
    expect(featureAllowed('music', 'gold')).toBe(false);
    expect(featureAllowed('music', 'premium')).toBe(true);
  });

  it('gates post behind silver access', () => {
    expect(featureAllowed('post', 'free')).toBe(false);
    expect(featureAllowed('post', 'silver')).toBe(true);
  });

  it('assigns exactly one catalog module per business category, never user-chosen', () => {
    expect(businessModule('business', 'food')).toBe('menu');
    expect(businessModule('business', 'food-fastfood')).toBe('menu');
    expect(businessModule('business', 'retail')).toBe('products');
    expect(businessModule('business', 'construction')).toBe('services');
    expect(businessModule('personal', 'food')).toBeNull();
  });
});
