import { api } from './client';
import type { NfcRecord, PurchaseResponse } from './types';

export const recordsApi = {
  list: () => api.get<NfcRecord[]>('/api/records'),

  search: (q: string) => api.get<{ records: NfcRecord[] }>(`/api/records/search?q=${encodeURIComponent(q)}`),

  get: (code: string) => api.get<NfcRecord>(`/api/records/${encodeURIComponent(code)}`),

  update: (code: string, patch: Partial<NfcRecord>) =>
    api.put<NfcRecord>(`/api/records/${encodeURIComponent(code)}`, patch as Record<string, unknown>),

  /**
   * The purchase/reserve entrypoint (android/docs/02-API_MAP.md §2.2). The
   * server computes the real price — `src/lib/pricing.ts`'s quote is a
   * preview only. Response is 202 `{pending, orderId, code, price, payLink}`
   * when payments are enabled, or a real 503 `payments_disabled` today.
   * `dedupeKey` pins this to the code so a double-tap can never create two
   * orders for the same ID.
   */
  purchase: (code: string, profile: Record<string, unknown>) =>
    api.post<PurchaseResponse>(`/api/records/${encodeURIComponent(code)}`, profile, {
      dedupeKey: `purchase:${code}`,
    }),

  /**
   * 🔴 Not in the confirmed-live route list in android/docs/02-API_MAP.md
   * (only present in the legacy `server/index.js`) — kept as a best-effort,
   * swallowed-error fire-and-forget call (matches the web app's own
   * fire-and-forget pattern) so a 404/503 here never surfaces to the user
   * or blocks the profile view from rendering.
   */
  addView: (code: string, ref?: 'nfc' | 'qr' | 'link') =>
    api
      .post<{ ok: true }>(`/api/records/${encodeURIComponent(code)}/view`, ref ? { ref } : undefined)
      .catch(() => undefined),
};
