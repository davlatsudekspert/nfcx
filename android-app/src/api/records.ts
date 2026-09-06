import { api } from './client';
import type { NfcRecord, PurchaseResponse } from './types';

/**
 * `extraLinks` as the Worker actually stores and returns it: a JSON array of
 * `{label, url}` (hosting/worker.js `validateRecordBody` / `rowToRecord`),
 * NOT the `Record<string,string>` shape declared on `NfcRecord`. Anything
 * read off the wire therefore goes through `normalizeExtraLinks` first.
 */
export interface RecordExtraLink {
  label: string;
  url: string;
}

/**
 * The full owner-visible record. `GET /api/records/:code` returns every
 * column in `RECORD_COLUMNS` — considerably more than the catalog-safe
 * `NfcRecord` subset declared in `./types`. Those extra fields matter here
 * for one specific reason:
 *
 * ⚠️ `PUT /api/records/:code` is a FULL REPLACE, not a patch. The Worker runs
 * the body through `validateRecordBody`, which always emits every profile
 * column (defaulting the missing ones to empty), and `updateRecord` then
 * writes all of them. Sending a partial body therefore silently WIPES every
 * field left out. Callers must round-trip the loaded record and override only
 * what the user edited — see `buildRecordUpdateBody`.
 */
export interface FullNfcRecord extends Omit<NfcRecord, 'extraLinks'> {
  /** Unknown on purpose — normalize with `normalizeExtraLinks` before use. */
  extraLinks?: unknown;
  about?: string;
  instagram?: string;
  linkedin?: string;
  facebook?: string;
  twitter?: string;
  address?: string;
  latitude?: number | null;
  longitude?: number | null;
  hiddenFromDirectory?: boolean;
  leadCapture?: boolean;
  bgPattern?: boolean;
  bgAnimated?: boolean;
  accentColor?: string;
  bgColor?: string;
  linkStyle?: string;
  linksTransparent?: boolean;
  /** Always stripped in transit by the Worker — see `buildRecordUpdateBody`. */
  cardNumber?: string;
  cardNumbers?: Array<{ label: string; number: string }>;
  giftable?: boolean;
  forSale?: boolean;
  salePrice?: number | null;
}

/** The body `PUT /api/records/:code` accepts, with `extraLinks` in its real
 * array shape. Fields absent from this type are not persisted by the Worker
 * (notably `whatsapp`, `isPrimary` and `views` — there is no column/route for
 * the first two on update, and `views` is server-owned). */
export type RecordUpdateBody = Omit<Partial<FullNfcRecord>, 'extraLinks'> & {
  extraLinks?: RecordExtraLink[];
};

/** Accepts either wire shape (array of `{label,url}`, or the legacy
 * `{label: url}` object) and always returns a clean, renderable array — a
 * malformed value can never reach the UI as `[object Object]`. */
export function normalizeExtraLinks(value: unknown): RecordExtraLink[] {
  const out: RecordExtraLink[] = [];
  if (Array.isArray(value)) {
    for (const item of value) {
      if (!item || typeof item !== 'object') continue;
      const link = item as { label?: unknown; url?: unknown };
      const url = typeof link.url === 'string' ? link.url.trim() : '';
      if (!url) continue;
      const label = typeof link.label === 'string' ? link.label.trim() : '';
      out.push({ label, url });
    }
  } else if (value && typeof value === 'object') {
    for (const [label, url] of Object.entries(value as Record<string, unknown>)) {
      if (typeof url !== 'string' || !url.trim()) continue;
      out.push({ label: String(label), url: url.trim() });
    }
  }
  return out.slice(0, 20);
}

/** Every column `validateRecordBody` rewrites on a PUT. Listing them here is
 * what makes the round-trip in `buildRecordUpdateBody` auditable. */
const REPLACED_FIELDS = [
  'name', 'role', 'avatarUrl', 'bgUrl', 'bgPattern', 'accentColor', 'bgColor', 'bgAnimated',
  'linksTransparent', 'linkStyle', 'musicUrl', 'tg', 'phone', 'email', 'linkedin', 'instagram',
  'about', 'facebook', 'twitter', 'website', 'theme', 'hidePhone',
  'profileType', 'city', 'categorySlug', 'address', 'latitude', 'longitude',
  'hiddenFromDirectory', 'leadCapture',
] as const;

/**
 * Builds a safe full-replace PUT body: everything the server currently holds,
 * with the user's edits applied on top. Without this, editing (say) only the
 * name would blank the phone, role, socials and hashtags.
 *
 * ⚠️ Known backend limitation, not a client bug: `cardNumber`/`cardNumbers`
 * are unconditionally stripped from every GET response, so they cannot be
 * round-tripped and any save clears them. They are deliberately NOT sent here
 * (sending an empty value would be identical in effect but would look
 * intentional). Fixing this needs a partial-update route or an owner-only
 * read — see the BLOCKER note in the phase report.
 */
export function buildRecordUpdateBody(
  current: FullNfcRecord | null | undefined,
  edits: RecordUpdateBody,
): RecordUpdateBody {
  const base: Record<string, unknown> = {};
  if (current) {
    for (const key of REPLACED_FIELDS) {
      const value = (current as Record<string, unknown>)[key];
      if (value !== undefined) base[key] = value;
    }
    base.hashtags = Array.isArray(current.hashtags) ? current.hashtags : [];
    base.extraLinks = normalizeExtraLinks(current.extraLinks);
  }
  return { ...(base as RecordUpdateBody), ...edits };
}

export const recordsApi = {
  list: () => api.get<NfcRecord[]>('/api/records'),

  search: (q: string) => api.get<{ records: NfcRecord[] }>(`/api/records/search?q=${encodeURIComponent(q)}`),

  get: (code: string) => api.get<FullNfcRecord>(`/api/records/${encodeURIComponent(code)}`),

  /** Full-replace update — always build the body with `buildRecordUpdateBody`. */
  update: (code: string, body: RecordUpdateBody) =>
    api.put<FullNfcRecord>(`/api/records/${encodeURIComponent(code)}`, body as Record<string, unknown>),

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
