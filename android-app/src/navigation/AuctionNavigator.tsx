import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { AuctionStackParamList } from './types';
import { AuctionListScreen } from '../screens/auction/AuctionListScreen';
import { AuctionDetailScreen } from '../screens/auction/AuctionDetailScreen';
import { AuctionPaymentScreen } from '../screens/auction/AuctionPaymentScreen';
import { color } from '../design-system/tokens';

const Stack = createNativeStackNavigator<AuctionStackParamList>();

/** Auction stack. The screens draw their own `PremiumHeader`, so the native
 * header stays off; `contentStyle` paints the app's near-black floor behind
 * the push transition so a slide never flashes white. */
export function AuctionNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: color.bg },
      }}
    >
      <Stack.Screen name="AuctionList" component={AuctionListScreen} />
      <Stack.Screen name="AuctionDetail" component={AuctionDetailScreen} />
      <Stack.Screen name="AuctionPayment" component={AuctionPaymentScreen} />
    </Stack.Navigator>
  );
}
