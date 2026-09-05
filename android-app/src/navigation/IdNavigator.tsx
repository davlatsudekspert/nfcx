import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { IdStackParamList } from './types';
import { IdSearchScreen } from '../screens/id/IdSearchScreen';
import { PurchaseStep1Screen } from '../screens/id/PurchaseStep1Screen';
import { PurchaseStep2Screen } from '../screens/id/PurchaseStep2Screen';
import { PurchaseStep3Screen } from '../screens/id/PurchaseStep3Screen';
import { PurchaseResultScreen } from '../screens/id/PurchaseResultScreen';

const Stack = createNativeStackNavigator<IdStackParamList>();

export function IdNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="IdSearch" component={IdSearchScreen} />
      <Stack.Screen name="PurchaseStep1" component={PurchaseStep1Screen} />
      <Stack.Screen name="PurchaseStep2" component={PurchaseStep2Screen} />
      <Stack.Screen name="PurchaseStep3" component={PurchaseStep3Screen} />
      <Stack.Screen name="PurchaseResult" component={PurchaseResultScreen} />
    </Stack.Navigator>
  );
}
