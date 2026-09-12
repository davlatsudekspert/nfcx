import { Tabs } from 'expo-router/js-tabs';

import { BottomNav, type TabBarSlice } from '@/components/nav/BottomNav';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Pastki navigatsiya — Home / Katalog / Company / Profile.
 * Auction tab YO'Q: u saytdan olib tashlangan, ilovada ham bo'lmasligi
 * kerak (spetsifikatsiya 1-bo'lim).
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
      <Tabs.Screen name="katalog" options={{ title: 'Katalog' }} />
      <Tabs.Screen name="company" options={{ title: 'Company' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
