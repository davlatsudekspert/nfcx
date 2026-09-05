import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ProfileStackParamList, MainTabParamList } from '../../navigation/types';
import { ScreenWithHeader } from '../shared/ScreenWithHeader';
import { PremiumCard } from '../../design-system/components/PremiumCard';
import { PremiumButton } from '../../design-system/components/PremiumButton';
import { PremiumEmptyState } from '../../design-system/components/PremiumEmptyState';
import { PremiumLoadingSkeleton } from '../../design-system/components/PremiumLoadingSkeleton';
import { socialApi } from '../../api/social';
import { auctionsApi } from '../../api/auctions';
import { formatSom, timeAgo } from '../../lib/format';
import { color, space, type as typeTokens } from '../../design-system/tokens';

type Props = NativeStackScreenProps<ProfileStackParamList, 'Notifications'>;

/**
 * No push-notification backend exists anywhere in this repo (android/docs/
 * 01-AUDIT.md §1.6 item 4) — this mirrors the web app's own pattern: a
 * client-side aggregation of real, confirmed read endpoints
 * (gift-offers, won-pending-auctions), not a fake notification feed.
 * Support-message replies (present on the web) are omitted — no confirmed
 * live user-facing endpoint for them exists in `hosting/worker.js`.
 */
export function NotificationsScreen({ navigation }: Props) {
  const tabNavigation = navigation.getParent<BottomTabNavigationProp<MainTabParamList>>();
  const queryClient = useQueryClient();
  const gifts = useQuery({ queryKey: ['gift-offers'], queryFn: () => socialApi.giftOffers() });
  const won = useQuery({ queryKey: ['auctions', 'won-pending'], queryFn: () => auctionsApi.wonPending() });

  const giftAction = useMutation({
    mutationFn: ({ id, action }: { id: number; action: 'accept' | 'reject' }) => socialApi.giftAction(id, action),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['gift-offers'] }),
  });

  const loading = gifts.isLoading || won.isLoading;
  const incoming = gifts.data?.incoming ?? [];
  const wonPending = won.data?.auctions ?? [];
  const total = incoming.length + wonPending.length;

  return (
    <ScreenWithHeader title={`Bildirishnomalar${total ? ` (${total})` : ''}`} onBack={navigation.canGoBack() ? navigation.goBack : undefined}>
      {loading && (
        <View style={{ gap: space.md }}>
          <PremiumLoadingSkeleton height={72} />
          <PremiumLoadingSkeleton height={72} />
        </View>
      )}

      {!loading && total === 0 && <PremiumEmptyState icon="bell-off" title="Hozircha bildirishnomangiz yo'q." />}

      {incoming.map((g) => (
        <PremiumCard key={`gift-${g.id}`} style={styles.card}>
          <Text style={styles.text}>
            🎁 <Text style={styles.code}>#{g.code}</Text> — {g.fromEmail} sizga sovg'a qilmoqchi
          </Text>
          <View style={styles.actionsRow}>
            <PremiumButton label="Qabul qilish" fullWidth={false} onPress={() => giftAction.mutate({ id: g.id, action: 'accept' })} style={styles.actionButton} />
            <PremiumButton label="Rad etish" variant="ghost" fullWidth={false} onPress={() => giftAction.mutate({ id: g.id, action: 'reject' })} style={styles.actionButton} />
          </View>
        </PremiumCard>
      ))}

      {wonPending.map((a) => (
        <PremiumCard key={`auction-${a.id}`} style={styles.card}>
          <Text style={styles.text}>
            🏆 <Text style={styles.code}>#{a.code}</Text> auksionida g'olib bo'ldingiz — {formatSom(a.currentPrice)}
          </Text>
          <Text style={styles.caption}>To'lov muddati: {timeAgo(new Date(a.paymentDeadline).getTime())}</Text>
          <PremiumButton
            label="To'lash"
            fullWidth={false}
            onPress={() => tabNavigation?.navigate('AuctionTab', { screen: 'AuctionPayment', params: { auctionId: a.id } })}
            style={styles.actionButton}
          />
        </PremiumCard>
      ))}
    </ScreenWithHeader>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: space.md },
  text: { ...typeTokens.body, color: color.textPrimary },
  code: { ...typeTokens.mono, color: color.gold },
  caption: { ...typeTokens.caption, color: color.textSecondary, marginTop: space.xs },
  actionsRow: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
  actionButton: { paddingHorizontal: space.md },
});
