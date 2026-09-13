import { Tabs } from 'expo-router/js-tabs';

import { BottomNav, type TabBarSlice } from '@/components/nav/BottomNav';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Pastki navigatsiya — Home / Discover / NFC / Profile.
 *
 * `design_handoff_nfcstore_app` spetsifikatsiyasi bo'yicha yangilandi:
 * Auction tab YO'Q (saytdan olib tashlangan). Activity tab HAM YO'Q —
 * repository auditida likes/follows/views/order-updates/payment-status'ni
 * bitta oqimga jamlaydigan haqiqiy backend endpoint topilmadi
 * (`/api/notifications` yoki shunga o'xshash yo'q), shuning uchun
 * spetsifikatsiyaning o'z qoidasiga ko'ra 4-tab variant qo'llanadi.
 * Company ENDI TAB EMAS: biznesni boshqarish — identity almashtirish,
 * Profile Switcher orqali (`SwitcherSheet`); Dashboard `/companies`
 * ro'yxati va Business profildan ochiladi.
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
      <Tabs.Screen name="discover" options={{ title: 'Discover' }} />
      <Tabs.Screen name="nfc" options={{ title: 'NFC' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
