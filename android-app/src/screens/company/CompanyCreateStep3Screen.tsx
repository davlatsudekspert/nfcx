import React from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CompanyStackParamList } from '../../navigation/types';
import { StubScreen } from '../shared/StubScreen';

type Props = NativeStackScreenProps<CompanyStackParamList, 'CompanyCreate3'>;

export function CompanyCreateStep3Screen({ navigation }: Props) {
  return <StubScreen screenName="Kompaniya — 3/5 Logo/Muqova" phase="Phase 10 — Company" onBack={navigation.goBack} />;
}
