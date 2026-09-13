import { router } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { settingRows } from '@/features/profile/ProfileScreen';
import { SettingsBody } from '@/features/profile/sheets/SettingsSheet';
import { useAuthStore } from '@/store/authStore';
import { usePinLockStore } from '@/store/pinLockStore';
import { useTheme } from '@/theme/ThemeProvider';
import { sans } from '@/theme/type';

/**
 * Pastki navigatsiyaning YANGI Settings tabi (foydalanuvchi so'rovi:
 * "bottombarga settingsni ham qosh ... pin codelarni osha yerdan
 * qoyish"). Ilgari sozlamalar FAQAT Profil ekranidagi varaqdan
 * (`SettingsSheet`) ochilardi — bu YANGI, alohida yo'l, lekin bir xil
 * `settingRows()`/`SettingsBody` tarkibidan foydalanadi, shuning uchun
 * ikkala joy DOIM sinxron (bitta ro'yxatni ikki marta yozish yo'q).
 *
 * Tab bo'lgani uchun orqaga tugmasi yo'q — `ProfileScreen`ning yuqori
 * qatoriga o'xshab, faqat sarlavha bilan.
 */
export function SettingsScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const authUser = useAuthStore((s) => s.user);
  const pinSet = usePinLockStore((s) => !!s.pin);

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <View
        style={{
          paddingTop: 8 + insets.top,
          paddingHorizontal: 14,
          paddingBottom: 6,
        }}
      >
        <Text style={[sans(700, 18), { color: theme.ink }]}>Sozlamalar</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 + insets.bottom }}
      >
        <SettingsBody
          rows={settingRows({
            handle: authUser?.phone ?? authUser?.email,
            telegramLinked: authUser?.telegramLinked,
            pinSet,
            onOpenVerification: () => router.push('/settings/verification'),
            onOpenChangePassword: () => router.push('/settings/change-password'),
            onOpenPayments: () => router.push('/settings/payments'),
            onOpenPin: () => router.push('/settings/pin'),
            onSignOut: () => useAuthStore.getState().signOut(),
          })}
        />
      </ScrollView>
    </View>
  );
}
