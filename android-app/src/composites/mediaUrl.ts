import { API_ORIGIN } from '../native/cookies';

/**
 * Resolves whatever the backend stored in an image/media field into something
 * React Native's `<Image>` can actually load.
 *
 * `POST /api/upload` returns a root-relative path (`/uploads/<file>`,
 * android/docs/02-API_MAP.md §2.8). On the web that resolves against the
 * page origin; on Android there is no origin, so a bare `/uploads/...` URI
 * silently renders nothing. Anything that isn't an absolute http(s)/data/
 * file URI or a root-relative upload path returns `undefined`, so the caller
 * falls back to its placeholder instead of showing a broken image box.
 */
export function resolveMediaUrl(value?: string | null): string | undefined {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return undefined;
  if (/^(https?:|data:|file:|content:)/i.test(raw)) return raw;
  if (raw.startsWith('/')) return `${API_ORIGIN}${raw}`;
  return undefined;
}

/**
 * Makes a user-entered website/link openable. The Worker's `recSafeUrl`
 * already rejects non-http(s) schemes on save, but older rows (and the
 * `extraLinks` array) can still hold a bare `example.com`, which
 * `Linking.openURL` cannot handle. Returns null when there is nothing
 * openable, so the caller can skip rendering a dead button.
 */
export function resolveExternalUrl(value?: string | null): string | null {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (/^(mailto:|tel:)/i.test(raw)) return raw;
  if (/^[\w-]+(\.[\w-]+)+/.test(raw)) return `https://${raw}`;
  return null;
}

/** Short, human display form of a link (`https://x.com/a?b=1` → `x.com/a`). */
export function displayUrl(value?: string | null): string {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return '';
  return raw
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\?.*$/, '')
    .replace(/\/$/, '');
}
