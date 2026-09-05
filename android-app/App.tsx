import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './src/state/queryClient';
import { PremiumToastProvider } from './src/design-system/components/PremiumToast';
import { RootNavigator } from './src/navigation/RootNavigator';
import { color } from './src/design-system/tokens';

export default function App() {
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
