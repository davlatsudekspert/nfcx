import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { AuctionStackParamList } from './types';
import { AuctionListScreen } from '../screens/auction/AuctionListScreen';
import { AuctionDetailScreen } from '../screens/auction/AuctionDetailScreen';
import { AuctionPaymentScreen } from '../screens/auction/AuctionPaymentScreen';

const Stack = createNativeStackNavigator<AuctionStackParamList>();

export function AuctionNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AuctionList" component={AuctionListScreen} />
      <Stack.Screen name="AuctionDetail" component={AuctionDetailScreen} />
      <Stack.Screen name="AuctionPayment" component={AuctionPaymentScreen} />
    </Stack.Navigator>
  );
}
