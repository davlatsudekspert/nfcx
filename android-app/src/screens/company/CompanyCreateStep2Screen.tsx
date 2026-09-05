import React from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CompanyStackParamList } from '../../navigation/types';
import { StubScreen } from '../shared/StubScreen';

type Props = NativeStackScreenProps<CompanyStackParamList, 'CompanyCreate2'>;

export function CompanyCreateStep2Screen({ navigation }: Props) {
  return <StubScreen screenName="Kompaniya — 2/5 Ma'lumot" phase="Phase 10 — Company" onBack={navigation.goBack} />;
}
