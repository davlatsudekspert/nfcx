import React from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CompanyStackParamList } from '../../navigation/types';
import { StubScreen } from '../shared/StubScreen';

type Props = NativeStackScreenProps<CompanyStackParamList, 'CompanyCreate1'>;

/** Real live-availability wizard (GET /api/companies/check) lands in Phase 10. */
export function CompanyCreateStep1Screen({ navigation }: Props) {
  return <StubScreen screenName="Kompaniya — 1/5 ID" phase="Phase 10 — Company" onBack={navigation.goBack} />;
}
