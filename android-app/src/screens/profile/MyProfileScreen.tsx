import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { ProfileStackParamList, MainTabParamList } from '../../navigation/types';
import { ScreenWithHeader } from '../shared/ScreenWithHeader';
import { PremiumEmptyState } from '../../design-system/components/PremiumEmptyState';
import { PremiumButton } from '../../design-system/components/PremiumButton';
import { NfcIdCard } from '../../composites/NfcIdCard';
import { ProfileView } from '../../composites/ProfileView';
import { useAuthStore } from '../../state/authStore';
import { useQuery } from '@tanstack/react-query';
import { socialApi } from '../../api/social';
import { space } from '../../design-system/tokens';

type Props = NativeStackScreenProps<ProfileStackParamList, 'MyProfile'>;

/** Own NFC Profile View — the same `ProfileView` composite the public
 * profile and the edit screen's Live Preview use, so an owner sees exactly
 * what a visitor sees (brief §9). */
export function MyProfileScreen({ navigation }: Props) {
  const cards = useAuthStore((s) => s.cards);
  const tabNavigation = navigation.getParent<BottomTabNavigationProp<MainTabParamList>>();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selected = cards[selectedIndex];
  const stats = useQuery({
    queryKey: ['follow-stats', selected?.code],
    queryFn: () => socialApi.stats(selected.code),
    enabled: !!selected,
  });

  if (!cards.length) {
    return (
      <ScreenWithHeader title="Mening ID'larim">
        <PremiumEmptyState
          icon="hash"
          title="Hali NFC ID'ingiz yo'q"
          ctaLabel="ID tanlash"
          onPressCta={() => tabNavigation?.navigate('IdTab', { screen: 'IdSearch' })}
        />
      </ScreenWithHeader>
    );
  }

  return (
    <ScreenWithHeader
      title="Mening ID'larim"
      actions={[{ icon: 'settings', accessibilityLabel: 'Sozlamalar', onPress: () => navigation.navigate('Settings') }]}
    >
      {cards.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selector}>
          {cards.map((card, i) => (
            <NfcIdCard key={card.code} code={card.code} name={card.name} state="owned" index={i} onPress={() => setSelectedIndex(i)} />
          ))}
        </ScrollView>
      )}

      <ProfileView record={selected} followStats={stats.data} />

      <View style={styles.editButtonWrap}>
        <PremiumButton label="Profilni tahrirlash" onPress={() => navigation.navigate('ProfileEdit')} />
      </View>
    </ScreenWithHeader>
  );
}

const styles = StyleSheet.create({
  selector: { marginBottom: space.md },
  editButtonWrap: { width: '100%', marginTop: space.lg },
});
