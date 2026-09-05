/**
 * api/client.ts — verifies the error-mapping contract (android/docs/02-API_MAP.md
 * §2.10) and the double-submit de-duplication guard (brief §7) against a
 * mocked globalThis.fetch, without touching the real network.
 */
import { api, ApiError } from '../api/client';

describe('api/client.ts', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  function mockFetchOnce(status: number, body: unknown) {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      headers: { get: () => 'application/json' },
      json: async () => body,
    }) as unknown as typeof fetch;
  }

  it('resolves with the parsed body on a 2xx response', async () => {
    mockFetchOnce(200, { ok: true, value: 42 });
    const result = await api.get<{ ok: boolean; value: number }>('/api/test-ok');
    expect(result).toEqual({ ok: true, value: 42 });
  });

  it('throws an ApiError carrying the server error code on a non-2xx response', async () => {
    mockFetchOnce(409, { error: 'already_taken' });
    await expect(api.post('/api/test-conflict')).rejects.toMatchObject({
      code: 'already_taken',
      status: 409,
    });
  });

  it('maps a known error code to real Uzbek copy, matching android/docs/02-API_MAP.md §2.10', async () => {
    mockFetchOnce(503, { error: 'payments_disabled' });
    try {
      await api.post('/api/test-payments');
      throw new Error('expected rejection');
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).message).toBe('To‘lovlar hozircha yopiq.');
    }
  });

  it('de-dupes two concurrent mutating calls with the same dedupeKey into one network request', async () => {
    let callCount = 0;
    globalThis.fetch = jest.fn().mockImplementation(async () => {
      callCount += 1;
      return {
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: async () => ({ ok: true }),
      };
    }) as unknown as typeof fetch;

    const [a, b] = await Promise.all([
      api.post('/api/records/AAA000', undefined, { dedupeKey: 'purchase:AAA000' }),
      api.post('/api/records/AAA000', undefined, { dedupeKey: 'purchase:AAA000' }),
    ]);

    expect(a).toEqual(b);
    expect(callCount).toBe(1); // the double-tap protection, proven, not just claimed
  });
});
