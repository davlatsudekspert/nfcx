import React from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CompanyStackParamList } from '../../navigation/types';
import { StubScreen } from '../shared/StubScreen';

type Props = NativeStackScreenProps<CompanyStackParamList, 'CatalogList'>;

/** Real single-module catalog CRUD (auto-selected by businessModule()) lands in Phase 10. */
export function CatalogListScreen({ navigation }: Props) {
  return <StubScreen screenName="Katalog" phase="Phase 10 — Company" onBack={navigation.goBack} />;
}
