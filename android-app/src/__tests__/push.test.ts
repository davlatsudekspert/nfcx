import { mapPayloadToDisplay } from '../native/push';

describe('push.ts mapPayloadToDisplay — notification render path (no real push needed)', () => {
  it('maps an auction payload to the trending-up icon', () => {
    expect(mapPayloadToDisplay({ category: 'auction', title: 'Auksion', body: "G'olib bo'ldingiz" })).toEqual({
      title: 'Auksion',
      body: "G'olib bo'ldingiz",
      icon: 'trending-up',
    });
  });

  it('maps every known category to a distinct real icon', () => {
    const categories = ['auction', 'payment', 'company', 'profile', 'system'] as const;
    const icons = categories.map((category) => mapPayloadToDisplay({ category, title: 't', body: 'b' }).icon);
    expect(new Set(icons).size).toBe(categories.length);
  });
});
