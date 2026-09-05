import React from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuctionStackParamList } from '../../navigation/types';
import { StubScreen } from '../shared/StubScreen';

type Props = NativeStackScreenProps<AuctionStackParamList, 'AuctionPayment'>;

export function AuctionPaymentScreen({ navigation }: Props) {
  return <StubScreen screenName="Auksion to'lovi" phase="Phase 8 — Auction" onBack={navigation.goBack} />;
}
