import React from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CompanyStackParamList } from '../../navigation/types';
import { StubScreen } from '../shared/StubScreen';

type Props = NativeStackScreenProps<CompanyStackParamList, 'PublicCompany'>;

/** Deep link target for nfcstore.uz/company/:id and /c/:id. Real implementation in Phase 10. */
export function PublicCompanyScreen({ route, navigation }: Props) {
  return (
    <StubScreen
      screenName={`Kompaniya — ${route.params.companyId}`}
      phase="Phase 10 — Company"
      onBack={navigation.canGoBack() ? navigation.goBack : undefined}
    />
  );
}
