import React from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CompanyStackParamList } from '../../navigation/types';
import { StubScreen } from '../shared/StubScreen';

type Props = NativeStackScreenProps<CompanyStackParamList, 'CompanyCreate4'>;

export function CompanyCreateStep4Screen({ navigation }: Props) {
  return <StubScreen screenName="Kompaniya — 4/5 Ko'rib chiqish" phase="Phase 10 — Company" onBack={navigation.goBack} />;
}
