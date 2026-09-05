import React from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuctionStackParamList } from '../../navigation/types';
import { StubScreen } from '../shared/StubScreen';

type Props = NativeStackScreenProps<AuctionStackParamList, 'AuctionDetail'>;

/** Real polling countdown + bid-confirm sheet lands in Phase 8. */
export function AuctionDetailScreen({ route, navigation }: Props) {
  return (
    <StubScreen
      screenName={`Auksion #${route.params.auctionId}`}
      phase="Phase 8 — Auction"
      onBack={navigation.goBack}
    />
  );
}
