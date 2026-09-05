import React from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '../../navigation/types';
import { StubScreen } from '../shared/StubScreen';

type Props = NativeStackScreenProps<ProfileStackParamList, 'Notifications'>;

/**
 * No push backend exists (android/docs/01-AUDIT.md §1.6 item 4) — real
 * implementation is a client-side aggregation of gift-offers/support-replies/
 * won-pending-auctions, exactly mirroring the web app's own pattern, landing
 * in Phase 9 alongside the rest of Personal Profile's social surface.
 */
export function NotificationsScreen({ navigation }: Props) {
  return <StubScreen screenName="Bildirishnomalar" phase="Phase 9 — Personal Profile" onBack={navigation.canGoBack() ? navigation.goBack : undefined} />;
}
