import React from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { IdStackParamList } from '../../navigation/types';
import { StubScreen } from '../shared/StubScreen';

type Props = NativeStackScreenProps<IdStackParamList, 'PurchaseStep1'>;

export function PurchaseStep1Screen({ navigation }: Props) {
  return <StubScreen screenName="Xarid — 1/3 ID tanlash" phase="Phase 7 — ID Purchase" onBack={navigation.goBack} />;
}
