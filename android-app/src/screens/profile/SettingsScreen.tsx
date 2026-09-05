import React, { useState } from 'react';
import { View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '../../navigation/types';
import { ScreenWithHeader } from '../shared/ScreenWithHeader';
import { PremiumListRow } from '../../design-system/components/PremiumListRow';
import { PremiumModal } from '../../design-system/components/PremiumModal';
import { PremiumButton } from '../../design-system/components/PremiumButton';
import { useAuthStore } from '../../state/authStore';
import { space } from '../../design-system/tokens';

type Props = NativeStackScreenProps<ProfileStackParamList, 'Settings'>;

/**
 * Real logout wiring (POST /api/auth/logout via authStore.logout — Phase 5).
 * Sub-sections (Profil ma'lumotlari → Phase 9, NFC o'qish → Phase 11,
 * Xavfsizlik/Til/Yordam → later polish passes) stay as navigable rows to
 * their real destinations where those exist today, and are otherwise
 * disabled rather than dead-ending, so the row inventory from the mockup
 * (screen 13) is honestly represented at every phase.
 */
export function SettingsScreen({ navigation }: Props) {
  const logout = useAuthStore((s) => s.logout);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const onConfirmLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      // No explicit navigation needed — RootNavigator swaps to the Auth
      // flow automatically once authStore.status becomes 'guest'.
    } finally {
      setLoggingOut(false);
      setConfirmVisible(false);
    }
  };

  return (
    <ScreenWithHeader title="Sozlamalar" onBack={navigation.canGoBack() ? navigation.goBack : undefined}>
      <View style={{ gap: space.xs }}>
        <PremiumListRow icon="user" label="Profil ma'lumotlari" onPress={() => navigation.navigate('ProfileEdit')} />
        <PremiumListRow icon="shield" label="Xavfsizlik" showChevron={false} />
        <PremiumListRow icon="globe" label="Til" value="O'zbekcha" showChevron={false} />
        <PremiumListRow icon="bell" label="Bildirishnomalar" onPress={() => navigation.navigate('Notifications')} />
        <PremiumListRow icon="radio" label="NFC o'qish" onPress={() => navigation.navigate('NfcRead')} />
        <PremiumListRow icon="help-circle" label="Yordam" showChevron={false} />
        <PremiumListRow icon="info" label="Ilova haqida" value="v1.0.0" showChevron={false} />
        <PremiumListRow icon="log-out" label="Chiqish" destructive onPress={() => setConfirmVisible(true)} />
      </View>

      <PremiumModal visible={confirmVisible} title="Chiqishni tasdiqlang" onRequestClose={() => setConfirmVisible(false)}>
        <View style={{ gap: space.sm }}>
          <PremiumButton label="Ha, chiqish" variant="danger" onPress={onConfirmLogout} loading={loggingOut} />
          <PremiumButton label="Bekor qilish" variant="ghost" onPress={() => setConfirmVisible(false)} disabled={loggingOut} />
        </View>
      </PremiumModal>
    </ScreenWithHeader>
  );
}
