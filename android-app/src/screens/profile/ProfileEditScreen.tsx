import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { ProfileStackParamList, MainTabParamList } from '../../navigation/types';
import { PremiumHeader } from '../../design-system/components/PremiumHeader';
import { PremiumEmptyState } from '../../design-system/components/PremiumEmptyState';
import { NfcIdCard } from '../../composites/NfcIdCard';
import { useAuthStore } from '../../state/authStore';
import { useT } from '../../i18n';
import { color, space, type as typeTokens } from '../../design-system/tokens';

type Props = NativeStackScreenProps<ProfileStackParamList, 'ProfileEdit'>;

/**
 * "Profil ma'lumotlari" entry point (linked from Settings).
 *
 * Profile editing itself now lives in `IdOwnerWorkspaceScreen`, which is
 * always scoped to one explicit `code`. This screen only decides *which* ID
 * that should be:
 *
 * - exactly one owned ID, or one marked `isPrimary` → open it directly;
 * - several with no primary → ask, instead of silently picking `cards[0]`
 *   (the old behaviour, which quietly edited the wrong card for every
 *   multi-ID owner);
 * - none → an honest empty state pointing at the ID tab.
 */
export function ProfileEditScreen({ navigation }: Props) {
  const t = useT();
  const cards = useAuthStore((s) => s.cards);
  const tabNavigation = navigation.getParent<BottomTabNavigationProp<MainTabParamList>>();

  const primary = cards.find((c) => c.isPrimary === true);
  const target = primary ?? (cards.length === 1 ? cards[0] : undefined);

  useEffect(() => {
    if (target) navigation.replace('IdOwnerWorkspace', { code: target.code });
  }, [target, navigation]);

  // A frame may render before `replace` commits — show nothing jarring.
  if (target) {
    return <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']} />;
  }

  if (!cards.length) {
    return (
      <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
        <PremiumHeader title={t('owner.workspace')} onBack={navigation.canGoBack() ? navigation.goBack : undefined} />
        <PremiumEmptyState
          icon="hash"
          title={t('home.emptyIds')}
          description={t('home.emptyIdsHint')}
          ctaLabel={t('home.chooseId')}
          onPressCta={() => tabNavigation?.navigate('IdTab', { screen: 'IdSearch' })}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <PremiumHeader title={t('owner.workspace')} onBack={navigation.canGoBack() ? navigation.goBack : undefined} />
      <View style={styles.body}>
        <Text style={styles.prompt}>Qaysi ID profilini tahrirlaysiz?</Text>
        <View style={styles.list}>
          {cards.map((card, i) => (
            <NfcIdCard
              key={card.code}
              code={card.code}
              name={card.name}
              state="owned"
              layout="row"
              index={i}
              isPrimary={card.isPrimary === true}
              profileType={card.profileType}
              views={card.views}
              verified={card.verified === true}
              onPress={() => navigation.replace('IdOwnerWorkspace', { code: card.code })}
            />
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.bg },
  body: { padding: space.lg, gap: space.md },
  prompt: { ...typeTokens.body, color: color.textSecondary },
  list: { gap: space.md },
});
