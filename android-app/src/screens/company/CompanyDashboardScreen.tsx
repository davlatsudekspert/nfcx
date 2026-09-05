import React from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CompanyStackParamList } from '../../navigation/types';
import { StubScreen } from '../shared/StubScreen';

type Props = NativeStackScreenProps<CompanyStackParamList, 'CompanyDashboard'>;

/** Real status-machine rendering (draft/pending_review/approved/payment_pending/active/rejected) lands in Phase 10. */
export function CompanyDashboardScreen({ route, navigation }: Props) {
  return (
    <StubScreen
      screenName={`Boshqaruv — ${route.params.companyId}`}
      phase="Phase 10 — Company"
      onBack={navigation.canGoBack() ? navigation.goBack : undefined}
    />
  );
}
