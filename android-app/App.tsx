import React, { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './src/state/queryClient';
import { PremiumToastProvider } from './src/design-system/components/PremiumToast';
import { RootNavigator } from './src/navigation/RootNavigator';
import { useAuthStore } from './src/state/authStore';
import { usePaymentsEnabledStore } from './src/state/paymentsEnabledStore';
import { color } from './src/design-system/tokens';

export default function App() {
  useEffect(() => {
    // Session bootstrap (GET /api/auth/me) and the payments-enabled flag are
    // both fetched once here — the single startup entrypoint — and again on
    // every foreground, per android/docs/03-ARCHITECTURE.md §3.3. Screens
    // read the resulting store state; they never fetch these themselves.
    useAuthStore.getState().bootstrap();
    usePaymentsEnabledStore.getState().refresh();

    const onAppStateChange = (next: AppStateStatus) => {
      if (next === 'active') {
        useAuthStore.getState().refresh().catch(() => {});
        usePaymentsEnabledStore.getState().refresh();
      }
    };
    const sub = AppState.addEventListener('change', onAppStateChange);
    return () => sub.remove();
  }, []);

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
