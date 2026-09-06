import { parseNfcPayload } from '../native/nfcPayload';

describe('parseNfcPayload — production tag URL format', () => {
  it('reads code + chip token from a real physical-card URL', () => {
    expect(parseNfcPayload('https://nfcstore.uz/AAA100?t=abc123XYZ')).toEqual({
      raw: 'https://nfcstore.uz/AAA100?t=abc123XYZ',
      code: 'AAA100',
      chipToken: 'abc123XYZ',
    });
  });

  it('reads a plain profile URL (no chip token) — lower-case codes normalize', () => {
    expect(parseNfcPayload('https://nfcstore.uz/vip001')).toEqual({
      raw: 'https://nfcstore.uz/vip001',
      code: 'VIP001',
      chipToken: null,
    });
  });

  it('reads the app deep-link scheme', () => {
    expect(parseNfcPayload('nfcstore://profile/AAA100').code).toBe('AAA100');
  });

  it('never mistakes an app route for a profile code', () => {
    expect(parseNfcPayload('https://nfcstore.uz/company/ELITE').code).toBeNull();
    expect(parseNfcPayload('https://nfcstore.uz/auksion/42').code).toBeNull();
  });

  it('treats a bare legacy token as a chip token', () => {
    expect(parseNfcPayload('  tok_9f2b71ae  ')).toEqual({
      raw: 'tok_9f2b71ae',
      code: null,
      chipToken: 'tok_9f2b71ae',
    });
  });

  it('returns nothing actionable for junk, rather than guessing', () => {
    expect(parseNfcPayload('hello world')).toEqual({ raw: 'hello world', code: null, chipToken: null });
    expect(parseNfcPayload(undefined)).toEqual({ raw: '', code: null, chipToken: null });
    expect(parseNfcPayload(null)).toEqual({ raw: '', code: null, chipToken: null });
  });
});
