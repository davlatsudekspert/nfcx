import React from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CompanyStackParamList } from '../../navigation/types';
import { StubScreen } from '../shared/StubScreen';

type Props = NativeStackScreenProps<CompanyStackParamList, 'CompanyCreate5'>;

/** Real POST /api/companies submit lands in Phase 10. */
export function CompanyCreateStep5Screen({ navigation }: Props) {
  return <StubScreen screenName="Kompaniya — 5/5 Yuborish" phase="Phase 10 — Company" onBack={navigation.goBack} />;
}
