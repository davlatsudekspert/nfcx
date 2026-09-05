import { api } from './client';
import type { Company } from './types';

export interface CompanyAvailability {
  available: boolean;
  reserved?: boolean;
  rule?: string | null;
  tier: string;
  price: number;
}

export const companiesApi = {
  check: (companyId: string) =>
    api.get<CompanyAvailability>(`/api/companies/check?id=${encodeURIComponent(companyId)}`),

  mine: () => api.get<{ companies: Company[] }>('/api/companies/mine'),

  create: (payload: {
    companyId: string;
    displayName: string;
    city: string;
    phone: string;
    description: string;
    category: string;
    subcategory?: string;
    sourceCardCode?: string;
    address?: string;
    telegram?: string;
    whatsapp?: string;
    website?: string;
    logoUrl?: string;
    coverUrl?: string;
  }) => api.post<{ company: Company }>('/api/companies', payload),

  get: (companyId: string) => api.get<{ company: Company }>(`/api/companies/${companyId}`),

  update: (companyId: string, patch: Partial<Company>) =>
    api.patch<{ company: Company }>(`/api/companies/${companyId}`, patch as Record<string, unknown>),

  submit: (companyId: string) =>
    api.post<{ company: Company }>(`/api/companies/${companyId}/submit`, undefined, {
      dedupeKey: `company-submit:${companyId}`,
    }),

  /** Always `503 payments_backend_pending` today — see android/docs/02-API_MAP.md §2.5. */
  beginPayment: (companyId: string) =>
    api.post<{ error: string; message: string }>(`/api/companies/${companyId}/payment`),

  addCatalogItem: (companyId: string, item: {
    name: string; price: number; promotionPrice?: number | null;
    category?: string; description?: string; imageUrl?: string; available?: boolean;
  }) => api.post<{ company: Company }>(`/api/companies/${companyId}/catalog`, item),

  updateCatalogItem: (companyId: string, itemId: string, patch: Record<string, unknown>) =>
    api.patch<{ company: Company }>(`/api/companies/${companyId}/catalog/${itemId}`, patch),

  deleteCatalogItem: (companyId: string, itemId: string) =>
    api.delete<{ company: Company }>(`/api/companies/${companyId}/catalog/${itemId}`),

  search: (q: string) =>
    api.get<{ results: Array<Pick<Company, 'companyId' | 'displayName'> & { city: string; avatarUrl?: string; verified?: boolean }> }>(
      `/api/companies/search?q=${encodeURIComponent(q)}`,
    ),
};

/**
 * Company ID tier/price by ID length — ported from src/lib/company.js (web
 * app), a *separate* table from the personal-ID pricing in src/lib/pricing.ts.
 * See android/docs/02-API_MAP.md §2.5. Preview only — `companiesApi.check()`
 * is the real-time authority.
 */
export function companyTierForId(id: string): { tier: 'exclusive' | 'premium' | 'gold' | 'silver'; price: number } {
  const len = String(id || '').length;
  if (len === 3) return { tier: 'exclusive', price: 990000 };
  if (len <= 5) return { tier: 'premium', price: 749000 };
  if (len <= 7) return { tier: 'gold', price: 549000 };
  return { tier: 'silver', price: 349000 };
}
