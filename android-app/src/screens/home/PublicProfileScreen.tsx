import React from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { HomeStackParamList } from '../../navigation/types';
import { StubScreen } from '../shared/StubScreen';

type Props = NativeStackScreenProps<HomeStackParamList, 'PublicProfile'>;

/**
 * The NFC Profile View — brief's "most premium" screen (§10) and the deep
 * link target for nfcstore.uz/:code. Real implementation (circular gold-ring
 * avatar, music player, vertical contact buttons, sticky "KONTAKTNI SAQLASH")
 * lands in Phase 9.
 */
export function PublicProfileScreen({ route, navigation }: Props) {
  return (
    <StubScreen
      screenName={`Profil — ${route.params.code}`}
      phase="Phase 9 — Personal Profile"
      onBack={navigation.canGoBack() ? navigation.goBack : undefined}
    />
  );
}
