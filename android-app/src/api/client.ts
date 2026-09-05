/**
 * Core API client — cookie-session aware fetch wrapper.
 *
 * See android/docs/02-API_MAP.md and 03-ARCHITECTURE.md §3.3: the backend
 * authenticates with an HttpOnly `nfc_session` cookie, not a bearer token.
 * On Android, React Native's networking stack (OkHttp) shares a cookie
 * store with `android.webkit.CookieManager` by default, so a plain `fetch`
 * generally does persist Set-Cookie across requests and app restarts — but
 * this is a platform default we are *depending on*, not one the API gives
 * us an explicit contract for. `src/native/cookies.ts` gives us an explicit,
 * inspectable read/clear path so login-state detection and logout don't
 * silently rely on that default alone. If device testing (Phase 5) finds
 * the default insufficient on some OEM build, the fallback is a custom
 * OkHttp CookieJar native module — flagged in the architecture doc as the
 * project's top technical risk.
 */
import { API_ORIGIN } from '../native/cookies';
import { errorCopy } from './types';

export class ApiError extends Error {
  code: string;
  status: number;
  feature?: string;
  limit?: number;

  constructor(code: string, status: number, extra?: { feature?: string; limit?: number }) {
    super(errorCopy(code));
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.feature = extra?.feature;
    this.limit = extra?.limit;
  }
}

type JsonBody = Record<string, unknown> | unknown[];

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD';
  body?: JsonBody;
  /** Raw (non-JSON) body — used only by the card-video upload endpoint,
   * which the Worker expects as raw bytes, not a JSON dataUrl. */
  rawBody?: ArrayBuffer | Blob;
  rawContentType?: string;
  /** De-dupe key for double-submit protection (brief §7 "Double-click
   * protection va duplicate request prevention"). Defaults to `METHOD path`
   * — pass an explicit key (e.g. including an idempotency token) for calls
   * where the same path is legitimately fired twice in quick succession
   * with different intent. */
  dedupeKey?: string;
  signal?: AbortSignal;
}

// In-flight request de-dupe map — a double-tap on a purchase/bid/follow
// button reuses the same in-flight promise instead of firing a second
// network request.
const inFlight = new Map<string, Promise<unknown>>();

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? 'GET';
  const isMutating = method !== 'GET' && method !== 'HEAD';
  const key = options.dedupeKey ?? `${method} ${path}`;

  if (isMutating && inFlight.has(key)) {
    return inFlight.get(key) as Promise<T>;
  }

  const exec = (async (): Promise<T> => {
    const headers: Record<string, string> = {};
    let bodyInit: BodyInit | undefined;

    if (options.rawBody != null) {
      headers['Content-Type'] = options.rawContentType ?? 'application/octet-stream';
      bodyInit = options.rawBody;
    } else if (options.body != null) {
      headers['Content-Type'] = 'application/json';
      bodyInit = JSON.stringify(options.body);
    }

    let res: Response;
    try {
      res = await fetch(`${API_ORIGIN}${path}`, {
        method,
        headers,
        body: bodyInit,
        credentials: 'include',
        signal: options.signal,
      });
    } catch {
      throw new ApiError('network_error', 0);
    }

    const contentType = res.headers.get('content-type') || '';
    const data = contentType.includes('application/json') ? await res.json().catch(() => null) : null;

    if (!res.ok) {
      const code = (data && (data as { error?: string }).error) || `http_${res.status}`;
      throw new ApiError(code, res.status, {
        feature: (data as { feature?: string } | null)?.feature,
        limit: (data as { limit?: number } | null)?.limit,
      });
    }

    return data as T;
  })();

  if (isMutating) {
    inFlight.set(key, exec);
    // `.finally()` adopts `exec`'s rejection into a new, unobserved promise
    // — swallow it here (the real caller still gets the original `exec`
    // rejection via the `return exec` below) so a failed mutation never
    // surfaces as an unhandled promise rejection.
    exec.finally(() => inFlight.delete(key)).catch(() => {});
  }

  return exec;
}

export const api = {
  get: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: JsonBody, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'POST', body }),
  put: <T>(path: string, body?: JsonBody, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'PUT', body }),
  patch: <T>(path: string, body?: JsonBody, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'DELETE' }),
  postRaw: <T>(path: string, rawBody: ArrayBuffer | Blob, contentType: string) =>
    request<T>(path, { method: 'POST', rawBody, rawContentType: contentType }),
};
