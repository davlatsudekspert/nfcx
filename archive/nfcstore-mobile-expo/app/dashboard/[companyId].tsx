import { useLocalSearchParams } from 'expo-router';

import { DashboardScreen } from '@/features/dashboard/DashboardScreen';

export default function DashboardRoute() {
  const { companyId } = useLocalSearchParams<{ companyId: string }>();
  return <DashboardScreen companyId={companyId ?? ''} />;
}
