import {
  IBMPlexMono_400Regular,
  IBMPlexMono_500Medium,
  IBMPlexMono_600SemiBold,
} from '@expo-google-fonts/ibm-plex-mono';
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import { useActiveIdStore } from '@/store/activeIdStore';
import { useAuthStore } from '@/store/authStore';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';

SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // 401 da qayta urinish ma'nosiz — sessiya tugagan, login kerak.
      retry: (attempt, error) =>
        !(error instanceof ApiError && error.isUnauthorized) && attempt < 2,
    },
  },
});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
    IBMPlexMono_600SemiBold,
  });

  const restoreAuth = useAuthStore((s) => s.restore);
  const restoreActiveId = useActiveIdStore((s) => s.restore);

  useEffect(() => {
    restoreAuth();
    restoreActiveId();
  }, [restoreAuth, restoreActiveId]);

  // Shrift yuklanmasa ham ilova ochiladi (tizim shrifti bilan) —
  // splash ekranida abadiy qolib ketmasin.
  const ready = fontsLoaded || !!fontError;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <Shell ready={ready} />
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Tema ichida turadigan qobiq: fon rangi temadan olinadi, shuning uchun
 * bu ThemeProvider'ning BOLASI bo'lishi kerak.
 */
function Shell({ ready }: { ready: boolean }) {
  const { theme, ready: themeReady } = useTheme();

  useEffect(() => {
    if (ready && themeReady) SplashScreen.hideAsync().catch(() => {});
  }, [ready, themeReady]);

  if (!ready || !themeReady) {
    return <View style={{ flex: 1, backgroundColor: theme.bg }} />;
  }

  return (
    <>
      {/* Har bir tema QORONG'U asos saqlaydi (spetsifikatsiya 8-bo'lim),
          shuning uchun status bar doim yorug' matnli. */}
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.bg },
          // Ekran o'tishlari silliq (spetsifikatsiya 7-bo'lim:
          // "never an abrupt cut").
          animation: 'fade',
          animationDuration: 220,
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="post/[id]"
          options={{ presentation: 'fullScreenModal', animation: 'fade' }}
        />
      </Stack>
    </>
  );
}
