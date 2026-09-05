import React from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '../../navigation/types';
import { StubScreen } from '../shared/StubScreen';

type Props = NativeStackScreenProps<ProfileStackParamList, 'Settings'>;

/** Real logout wiring (POST /api/auth/logout) lands in Phase 5; sub-sections (NFC/Til/Xavfsizlik) across Phases 9/11. */
export function SettingsScreen({ navigation }: Props) {
  return <StubScreen screenName="Sozlamalar" phase="Phase 5/9/11" onBack={navigation.canGoBack() ? navigation.goBack : undefined} />;
}
