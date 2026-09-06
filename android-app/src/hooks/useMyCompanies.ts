import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { companiesApi } from '../api/companies';
import { useAuthStore } from '../state/authStore';
import type { Company } from '../api/types';

/**
 * One key factory for every company query, so a write anywhere in the
 * Company section can invalidate exactly what it changed — and so the
 * dashboard, the catalogue editor and the public page all read the *same*
 * cache entry for the same company instead of three divergent copies.
 */
export const companyKeys = {
  all: ['companies'] as const,
  mine: ['companies', 'mine'] as const,
  detail: (companyId: string) => ['companies', companyId] as const,
  check: (companyId: string) => ['companies', 'check', companyId] as const,
};

/** GET /api/companies/mine — android/docs/02-API_MAP.md §2.5. Disabled while
 * logged out (the endpoint itself 401s, no point firing it). */
export function useMyCompanies() {
  const status = useAuthStore((s) => s.status);
  return useQuery({
    queryKey: companyKeys.mine,
    queryFn: () => companiesApi.mine(),
    select: (data) => data.companies,
    enabled: status === 'authenticated',
  });
}

/** GET /api/companies/:id — the single source for dashboard, catalogue and
 * public page. `select` unwraps the envelope so screens never juggle
 * `data.company.company`. */
export function useCompany(companyId: string) {
  return useQuery({
    queryKey: companyKeys.detail(companyId),
    queryFn: () => companiesApi.get(companyId),
    select: (data): Company | undefined => data?.company,
  });
}

/**
 * Invalidates one company *and* the owner's list — every mutation in the
 * section (update, submit, payment, catalogue writes) changes both, and
 * forgetting the list is what makes a status chip go stale after an edit.
 */
export function useInvalidateCompany(companyId: string) {
  const queryClient = useQueryClient();
  return useCallback(() => {
    queryClient.invalidateQueries({ queryKey: companyKeys.detail(companyId) });
    queryClient.invalidateQueries({ queryKey: companyKeys.mine });
  }, [queryClient, companyId]);
}
