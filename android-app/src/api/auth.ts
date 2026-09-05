import { api } from './client';
import type { NfcRecord, User } from './types';

export interface MeResponse {
  user: User | null;
  cards: NfcRecord[];
}

export const authApi = {
  /** GET /api/auth/me — always 200; app-wide "am I logged in" bootstrap call. */
  me: () => api.get<MeResponse>('/api/auth/me'),

  login: (email: string, password: string) =>
    api.post<{ user: User }>('/api/auth/login', { email, password }),

  logout: () => api.post<{ ok: true }>('/api/auth/logout'),

  /**
   * 🔴 Not confirmed ported in production (android/docs/01-AUDIT.md §1.3/§1.6).
   * Calling this today is expected to surface `api_upstream_unavailable` —
   * the Register screen must render that as a real, honest "sign-up
   * temporarily unavailable" state, not swallow it or fake success.
   */
  requestRegisterCode: (phone: string) =>
    api.post<{ ok: true }>('/api/auth/request-register-code', { phone }),

  /** 🔴 See requestRegisterCode above — same caveat applies. */
  register: (email: string, password: string, extra: Record<string, unknown> = {}) =>
    api.post<{ user: User }>('/api/auth/register', { email, password, ...extra }),
};
