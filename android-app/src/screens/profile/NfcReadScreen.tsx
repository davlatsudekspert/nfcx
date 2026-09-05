import React from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '../../navigation/types';
import { StubScreen } from '../shared/StubScreen';

type Props = NativeStackScreenProps<ProfileStackParamList, 'NfcRead'>;

/** Real foreground-dispatch NFC read (src/native/nfc.ts) lands in Phase 11. */
export function NfcReadScreen({ navigation }: Props) {
  return <StubScreen screenName="NFC o'qish" phase="Phase 11 — Native integrations" onBack={navigation.goBack} />;
}
