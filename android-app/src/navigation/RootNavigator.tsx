import React from 'react';
import { NavigationContainer, DarkTheme, type Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootStackParamList } from './types';
import { AuthNavigator } from './AuthNavigator';
import { MainTabs } from './MainTabs';
import { linking } from './linking';
import { useAuthStore } from '../state/authStore';
import { color } from '../design-system/tokens';

const Stack = createNativeStackNavigator<RootStackParamList>();

const navTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: color.bg,
    card: color.bg,
    text: color.textPrimary,
    border: color.border,
    primary: color.gold,
  },
};

/**
 * Phase 4 note: auth-gated routing (`status === 'authenticated'` vs
 * `'guest'`) is wired here, but `useAuthStore`'s bootstrap call
 * (`GET /api/auth/me`) is only invoked starting Phase 5 — until then
 * `status` stays `'unknown'` and this renders the Auth flow's Splash stub.
 */
export function RootNavigator() {
  const status = useAuthStore((s) => s.status);

  return (
    <NavigationContainer theme={navTheme} linking={linking}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {status === 'authenticated' ? (
          <Stack.Screen name="MainTabs" component={MainTabs} />
        ) : (
          <Stack.Screen name="AuthFlow" component={AuthNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
