import React, { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import {
  PlayfairDisplay_500Medium,
  PlayfairDisplay_600SemiBold,
  PlayfairDisplay_700Bold,
} from '@expo-google-fonts/playfair-display';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './src/state/queryClient';
import { PremiumToastProvider } from './src/design-system/components/PremiumToast';
import { RootNavigator } from './src/navigation/RootNavigator';
import { useAuthStore } from './src/state/authStore';
import { usePaymentsEnabledStore } from './src/state/paymentsEnabledStore';
import { useLocaleStore } from './src/i18n';
import { color } from './src/design-system/tokens';

// Keep the native splash up until the brand fonts are ready, so the first
// frame is already set in Playfair/Inter instead of flashing the system face.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    PlayfairDisplay_500Medium,
    PlayfairDisplay_600SemiBold,
    PlayfairDisplay_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const fontsReady = fontsLoaded || !!fontError;

  useEffect(() => {
    if (fontsReady) SplashScreen.hideAsync().catch(() => {});
  }, [fontsReady]);

  useEffect(() => {
    // Session bootstrap (GET /api/auth/me) and the payments-enabled flag are
    // both fetched once here — the single startup entrypoint — and again on
    // every foreground, per android/docs/03-ARCHITECTURE.md §3.3. Screens
    // read the resulting store state; they never fetch these themselves.
    useAuthStore.getState().bootstrap();
    usePaymentsEnabledStore.getState().refresh();
    // Restores the saved UZ/RU/EN choice before the first screen paints.
    useLocaleStore.getState().hydrate();

    const onAppStateChange = (next: AppStateStatus) => {
      if (next === 'active') {
        useAuthStore.getState().refresh().catch(() => {});
        usePaymentsEnabledStore.getState().refresh();
      }
    };
    const sub = AppState.addEventListener('change', onAppStateChange);
    return () => sub.remove();
  }, []);

  // A font failure never blocks the app: Android falls back to the system
  // face and everything still renders.
  if (!fontsReady) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: color.bg }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <BottomSheetModalProvider>
            <PremiumToastProvider>
              <StatusBar style="light" />
              <RootNavigator />
            </PremiumToastProvider>
          </BottomSheetModalProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
