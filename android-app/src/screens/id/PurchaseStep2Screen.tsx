import React from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { IdStackParamList } from '../../navigation/types';
import { StubScreen } from '../shared/StubScreen';

type Props = NativeStackScreenProps<IdStackParamList, 'PurchaseStep2'>;

export function PurchaseStep2Screen({ navigation }: Props) {
  return <StubScreen screenName="Xarid — 2/3 Tasdiqlash" phase="Phase 7 — ID Purchase" onBack={navigation.goBack} />;
}
