import React from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { IdStackParamList } from '../../navigation/types';
import { StubScreen } from '../shared/StubScreen';

type Props = NativeStackScreenProps<IdStackParamList, 'PurchaseStep3'>;

/** Real payment-state UI (reads GET /api/settings/payments-enabled honestly) lands in Phase 7. */
export function PurchaseStep3Screen({ navigation }: Props) {
  return <StubScreen screenName="Xarid — 3/3 To'lov" phase="Phase 7 — ID Purchase" onBack={navigation.goBack} />;
}
