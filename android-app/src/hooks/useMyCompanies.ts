import { useQuery } from '@tanstack/react-query';
import { companiesApi } from '../api/companies';
import { useAuthStore } from '../state/authStore';

/** GET /api/companies/mine — android/docs/02-API_MAP.md §2.5. Disabled while
 * logged out (the endpoint itself 401s, no point firing it). */
export function useMyCompanies() {
  const status = useAuthStore((s) => s.status);
  return useQuery({
    queryKey: ['companies', 'mine'],
    queryFn: () => companiesApi.mine(),
    select: (data) => data.companies,
    enabled: status === 'authenticated',
  });
}
