import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuctionStackParamList } from '../../navigation/types';
import { ScreenWithHeader } from '../shared/ScreenWithHeader';
import { PremiumTab } from '../../design-system/components/PremiumTab';
import { PremiumEmptyState } from '../../design-system/components/PremiumEmptyState';
import { PremiumCard } from '../../design-system/components/PremiumCard';
import { PremiumButton } from '../../design-system/components/PremiumButton';
import { PremiumBadge } from '../../design-system/components/PremiumBadge';
import { AuctionListCard } from '../../composites/AuctionListCard';
import { auctionsApi } from '../../api/auctions';
import { useAuctionDemand, useVoteAuctionDemand } from '../../hooks/useAuctionDemand';
import { formatSom } from '../../lib/format';
import { color, space, type as typeTokens } from '../../design-system/tokens';

type Props = NativeStackScreenProps<AuctionStackParamList, 'AuctionList'>;
type TabKey = 'live' | 'soon' | 'ended' | 'mine';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'live', label: 'Jonli' },
  { key: 'soon', label: 'Yaqinda' },
  { key: 'ended', label: 'Tugagan' },
  { key: 'mine', label: 'Meniki' },
];

export function AuctionListScreen({ navigation }: Props) {
  const [tab, setTab] = useState<TabKey>('live');

  return (
    <ScreenWithHeader title="Auksion" scroll={false}>
      <PremiumTab items={TABS} activeKey={tab} onChange={(k) => setTab(k as TabKey)} />
      <View style={styles.body}>
        {tab === 'live' && <LiveTab navigation={navigation} />}
        {tab === 'soon' && <SoonTab />}
        {tab === 'ended' && <EndedTab navigation={navigation} />}
        {tab === 'mine' && <MineTab navigation={navigation} />}
      </View>
    </ScreenWithHeader>
  );
}

function LiveTab({ navigation }: { navigation: Props['navigation'] }) {
  const auctions = useQuery({ queryKey: ['auctions', 'active'], queryFn: () => auctionsApi.list(false) });
  if (auctions.isLoading) return <LoadingList />;
  const rows = auctions.data?.auctions ?? [];
  if (!rows.length) return <PremiumEmptyState icon="trending-up" title="Hozircha faol auksion yo'q" />;
  return (
    <FlashList
      data={rows}
      keyExtractor={(item) => String(item.id)}
      renderItem={({ item, index }) => (
        <AuctionListCard auction={item} index={index} onPress={() => navigation.navigate('AuctionDetail', { auctionId: item.id })} />
      )}
    />
  );
}

function EndedTab({ navigation }: { navigation: Props['navigation'] }) {
  const auctions = useQuery({ queryKey: ['auctions', 'sold'], queryFn: () => auctionsApi.list(true) });
  if (auctions.isLoading) return <LoadingList />;
  const rows = auctions.data?.sold ?? [];
  if (!rows.length) return <PremiumEmptyState icon="flag" title="Tugagan auksion yo'q" />;
  return (
    <FlashList
      data={rows}
      keyExtractor={(item) => String(item.id)}
      renderItem={({ item, index }) => (
        <AuctionListCard auction={item} index={index} onPress={() => navigation.navigate('AuctionDetail', { auctionId: item.id })} />
      )}
    />
  );
}

/**
 * android/docs/02-API_MAP.md §2.4: there is no distinct "scheduled/upcoming
 * auction" concept in the live API — the closest real one is the demand
 * board (users voting an ID toward auction). Shown here instead of a
 * fabricated "coming soon auctions" list.
 */
function SoonTab() {
  const demand = useAuctionDemand();
  const vote = useVoteAuctionDemand();
  if (demand.isLoading) return <LoadingList />;
  const rows = demand.data?.demand ?? [];
  const threshold = demand.data?.threshold ?? 20;
  if (!rows.length) return <PremiumEmptyState icon="clock" title="Hozircha ovoz yig'ilmoqda ID yo'q" />;
  return (
    <FlashList
      data={rows}
      keyExtractor={(item) => String(item.id)}
      renderItem={({ item, index }) => (
        <PremiumCard index={index} style={styles.demandCard}>
          <View style={styles.topRow}>
            <Text style={styles.code}>#{item.code}</Text>
            {item.status === 'ready' && <PremiumBadge label="Tayyor" tone="success" />}
          </View>
          <Text style={styles.demandCaption}>
            {item.interestCount}/{threshold} ovoz
          </Text>
          <PremiumButton
            label={item.voted ? 'Ovoz berdingiz' : 'Ovoz berish'}
            variant="ghost"
            disabled={item.voted || vote.isPending}
            loading={vote.isPending}
            onPress={() => vote.mutate(item.id)}
            style={styles.demandButton}
          />
        </PremiumCard>
      )}
    />
  );
}

/**
 * "Men qatnashgan" — there is no "my bid history across all auctions"
 * endpoint anywhere in the API (confirmed during the Phase 1 audit). The
 * closest real, honest data is GET /api/auctions/won/pending (auctions the
 * user has won and still owes for) — shown here rather than fabricating a
 * broader participation list the backend can't actually provide.
 */
function MineTab({ navigation }: { navigation: Props['navigation'] }) {
  const won = useQuery({ queryKey: ['auctions', 'won-pending'], queryFn: () => auctionsApi.wonPending() });
  if (won.isLoading) return <LoadingList />;
  const rows = won.data?.auctions ?? [];
  if (!rows.length) {
    return (
      <PremiumEmptyState
        icon="award"
        title="Hozircha yutgan auksioningiz yo'q"
        description="G'olib bo'lgan va to'lov kutayotgan auksionlar shu yerda ko'rinadi."
      />
    );
  }
  return (
    <FlashList
      data={rows}
      keyExtractor={(item) => String(item.id)}
      renderItem={({ item, index }) => (
        <PremiumCard index={index} style={styles.demandCard}>
          <Text style={styles.code}>#{item.code}</Text>
          <Text style={styles.demandCaption}>{formatSom(item.currentPrice)}</Text>
          <PremiumButton
            label="To'lash"
            onPress={() => navigation.navigate('AuctionPayment', { auctionId: item.id })}
            style={styles.demandButton}
          />
        </PremiumCard>
      )}
    />
  );
}

function LoadingList() {
  return (
    <View style={{ gap: space.md }}>
      <PremiumCard loading style={{ height: 96 }} />
      <PremiumCard loading style={{ height: 96 }} />
      <PremiumCard loading style={{ height: 96 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, padding: space.lg },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  code: { ...typeTokens.mono, color: color.textPrimary, fontSize: 18 },
  demandCard: { marginBottom: space.md },
  demandCaption: { ...typeTokens.caption, color: color.textSecondary, marginTop: space.xs },
  demandButton: { marginTop: space.sm },
});
