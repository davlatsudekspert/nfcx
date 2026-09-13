import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';

import { BottomNav, type TabBarSlice } from '@/components/nav/BottomNav';
import { useAuthStore } from '@/store/authStore';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Pastki navigatsiya — Home / Discover / NFC / Profile / Settings.
 *
 * `design_handoff_nfcstore_app` spetsifikatsiyasi bo'yicha yangilandi:
 * Auction tab YO'Q (saytdan olib tashlangan). Activity tab HAM YO'Q —
 * repository auditida likes/follows/views/order-updates/payment-status'ni
 * bitta oqimga jamlaydigan haqiqiy backend endpoint topilmadi
 * (`/api/notifications` yoki shunga o'xshash yo'q), shuning uchun
 * spetsifikatsiyaning o'z qoidasiga ko'ra asl 4-tab variant qo'llangan
 * edi. Settings — foydalanuvchi ANIQ so'ragan 5-tab (ilgari sozlamalar
 * faqat Profildagi varaqdan ochilardi; endi PIN kod kabi sozlamalarga
 * pastki navigatsiyadan ham to'g'ridan-to'g'ri kirish mumkin).
 * Company ENDI TAB EMAS: biznesni boshqarish — identity almashtirish,
 * Profile Switcher orqali (`SwitcherSheet`); Dashboard `/companies`
 * ro'yxati va Business profildan ochiladi.
 *
 * Standart tabBar butunlay almashtirilgan: maketdagi gradient ikonka,
 * yorug'lik va siljiydigan indikatorni standart komponent bera olmaydi.
 */
export default function TabsLayout() {
  const { theme } = useTheme();
  const restored = useAuthStore((s) => s.restored);
  const hasToken = useAuthStore((s) => s.hasToken);

  // Entry/Auth GATE — audit topilmasi: ilovada login/register ekrani
  // umuman yo'q edi, `login()`/`register()` (src/api/client.ts) esa hech
  // qayerdan chaqirilmagan edi. `restored` — `authStore.restore()`
  // tugaguncha hech narsaga yo'naltirmaymiz (aks holda haqiqiy tokenli
  // foydalanuvchi bir lahza Login ekraniga uchib ketardi). `hasToken`dan
  // (`user`dan EMAS) qaraymiz: login/register muvaffaqiyatidan keyin
  // `user` hali `/auth/me` orqali aniqlanmagan (`undefined`) bo'ladi —
  // agar shu yerda `user === null` tekshirilsa, muvaffaqiyatli
  // kirishning o'zi darhol Login'ga qaytarib yuborardi.
  if (restored && !hasToken) {
    return <Redirect href="/login" />;
  }

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
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}
