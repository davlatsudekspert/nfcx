import React from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { IdStackParamList } from '../../navigation/types';
import { StubScreen } from '../shared/StubScreen';

type Props = NativeStackScreenProps<IdStackParamList, 'PurchaseResult'>;

export function PurchaseResultScreen({ navigation }: Props) {
  return <StubScreen screenName="Muvaffaqiyat" phase="Phase 7 — ID Purchase" onBack={navigation.canGoBack() ? navigation.goBack : undefined} />;
}
