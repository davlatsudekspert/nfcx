import { Tabs } from 'expo-router/js-tabs';

import { BottomNav, type TabBarSlice } from '@/components/nav/BottomNav';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Pastki navigatsiya — Home / Qidiruv / NFC / Company / Profile.
 *
 * NFC MARKAZDA: u ilovaning asosiy vazifasi. Xabar almashish tabi
 * ATAYLAB yo'q — NFCSTORE da ichki messaging tizimi mavjud emas
 * (backendda ham faqat o'qilmagan xabarlar hisoblagichi bor).
 * Auction tabi ham yo'q: u saytdan olib tashlangan.
 *
 * Standart tabBar butunlay almashtirilgan: maketdagi gradient ikonka,
 * yorug'lik va siljiydigan indikatorni standart komponent bera olmaydi.
 */
export default function TabsLayout() {
  const { theme } = useTheme();

  return (
    <Tabs
      tabBar={(props) => <BottomNav {...(props as unknown as TabBarSlice)} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: theme.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="katalog" options={{ title: 'Qidiruv' }} />
      <Tabs.Screen name="nfc" options={{ title: 'NFC' }} />
      <Tabs.Screen name="company" options={{ title: 'Company' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
