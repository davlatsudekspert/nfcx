import { formatSom, formatCountdown } from '../lib/format';

describe('format.ts', () => {
  it('formats a som amount with thousands separators and the currency suffix', () => {
    expect(formatSom(199000)).toBe("199 000 so'm");
  });

  it('formats a countdown against a fixed "now" as HH:MM:SS', () => {
    const now = new Date('2026-09-05T00:00:00.000Z').getTime();
    const endsAt = new Date('2026-09-05T01:02:03.000Z').toISOString();
    expect(formatCountdown(endsAt, now)).toBe('01:02:03');
  });

  it('clamps a past endsAt to 00:00:00 rather than a negative countdown', () => {
    const now = new Date('2026-09-05T02:00:00.000Z').getTime();
    const endsAt = new Date('2026-09-05T01:00:00.000Z').toISOString();
    expect(formatCountdown(endsAt, now)).toBe('00:00:00');
  });
});
