import React, { useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type BottomSheet from '@gorhom/bottom-sheet';
import type { AuctionStackParamList } from '../../navigation/types';
import { ScreenWithHeader } from '../shared/ScreenWithHeader';
import { PremiumTab } from '../../design-system/components/PremiumTab';
import { PremiumQueryState } from '../../design-system/components/PremiumQueryState';
import { PremiumCard } from '../../design-system/components/PremiumCard';
import { PremiumButton } from '../../design-system/components/PremiumButton';
import { PremiumBadge, TierBadge } from '../../design-system/components/PremiumBadge';
import { useToast } from '../../design-system/components/PremiumToast';
import { AuctionListCard } from '../../composites/AuctionListCard';
import { AuctionDemandCard } from '../../composites/AuctionDemandCard';
import { AuctionCountdown } from '../../composites/AuctionCountdown';
import { AuctionHowItWorks } from './AuctionHowItWorks';
import { AuctionRequestSheet } from './AuctionRequestSheet';
import { InfoBanner, MetricTile, PaymentsClosedNotice } from './AuctionUi';
import { apiErrorMessage, summarizeAuctions } from './auctionModel';
import { recoverSession } from './sessionRecovery';
import { useActiveAuctions, useEndedAuctions, useWonPendingAuctions } from '../../hooks/useAuctions';
import { useAuctionDemand, useVoteAuctionDemand } from '../../hooks/useAuctionDemand';
import { useAuthStore } from '../../state/authStore';
import { usePaymentsEnabledStore } from '../../state/paymentsEnabledStore';
import { formatCount, formatDateTime, formatSom, toFiniteNumber } from '../../lib/format';
import { tierForCode } from '../../lib/pricing';
import { useT } from '../../i18n';
import { color, space, type as typeTokens } from '../../design-system/tokens';

type Props = NativeStackScreenProps<AuctionStackParamList, 'AuctionList'>;
type Navigation = Props['navigation'];
type TabKey = 'live' | 'soon' | 'ended' | 'mine';

/** 24h — a payment deadline inside a day turns the countdown red. */
const PAYMENT_URGENT_MS = 24 * 60 * 60 * 1000;

/**
 * The auction section's front door.
 *
 * Four tabs, each backed by a real endpoint: live auctions, the demand board
 * (the API's only notion of "upcoming"), the sold archive, and the user's own
 * won/pending auctions. Every tab renders the same five states through
 * `PremiumQueryState`, and every tab keeps real explanatory content on screen
 * when the list itself is thin — no fabricated listings, no dead space.
 */
export function AuctionListScreen({ navigation }: Props) {
  const t = useT();
  const [tab, setTab] = useState<TabKey>('live');

  const tabs = [
    { key: 'live', label: t('auction.live') },
    { key: 'soon', label: t('auction.soon') },
    { key: 'ended', label: t('auction.ended') },
    { key: 'mine', label: t('auction.mine') },
  ];

  return (
    <ScreenWithHeader title={t('auction.title')} scroll={false}>
      <PremiumTab items={tabs} activeKey={tab} onChange={(key) => setTab(key as TabKey)} />
      <View style={styles.body}>
        {tab === 'live' && (
          <LiveTab navigation={navigation} onSeeDemand={() => setTab('soon')} onSeeMine={() => setTab('mine')} />
        )}
        {tab === 'soon' && <DemandTab navigation={navigation} />}
        {tab === 'ended' && <EndedTab navigation={navigation} />}
        {tab === 'mine' && <MineTab navigation={navigation} onSeeLive={() => setTab('live')} />}
      </View>
    </ScreenWithHeader>
  );
}

/* ------------------------------------------------------------------ *
 * Shared state scaffold
 * ------------------------------------------------------------------ */

interface StateFallbackProps {
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  isEmpty: boolean;
  onRetry: () => void;
  emptyIcon: React.ComponentProps<typeof PremiumQueryState>['emptyIcon'];
  emptyTitle: string;
  emptyDescription?: string;
  emptyCtaLabel?: string;
  onPressEmptyCta?: () => void;
  /** Real content kept on screen underneath the state (explainer, notices) so
   * an empty or failed tab is never a blank rectangle. */
  aside?: React.ReactNode;
}

/** Loading / error / offline / session-expired / empty — all via the shared
 * `PremiumQueryState`, never re-implemented per tab. */
function StateFallback({ aside, ...state }: StateFallbackProps) {
  return (
    <ScrollView contentContainerStyle={styles.stateScroll} showsVerticalScrollIndicator={false}>
      <PremiumQueryState
        isLoading={state.isLoading}
        isError={state.isError}
        error={state.error}
        isEmpty={state.isEmpty}
        onRetry={state.onRetry}
        onUnauthorized={recoverSession}
        emptyIcon={state.emptyIcon}
        emptyTitle={state.emptyTitle}
        emptyDescription={state.emptyDescription}
        emptyCtaLabel={state.emptyCtaLabel}
        onPressEmptyCta={state.onPressEmptyCta}
        skeletonRows={3}
        skeletonHeight={132}
      />
      {aside}
    </ScrollView>
  );
}

/* ------------------------------------------------------------------ *
 * Jonli
 * ------------------------------------------------------------------ */

function LiveTab({
  navigation,
  onSeeDemand,
  onSeeMine,
}: {
  navigation: Navigation;
  onSeeDemand: () => void;
  onSeeMine: () => void;
}) {
  const auctions = useActiveAuctions();
  const demand = useAuctionDemand();
  const won = useWonPendingAuctions();
  const paymentsOff = usePaymentsEnabledStore((s) => s.status === 'disabled');
  const viewerId = useAuthStore((s) => s.user?.id ?? null);

  const rows = auctions.data ?? [];
  const summary = summarizeAuctions(rows);
  const threshold = toFiniteNumber(demand.data?.threshold);
  const wonCount = won.data?.length ?? 0;

  const explainer = <AuctionHowItWorks threshold={threshold} paymentsOff={paymentsOff} />;

  if (auctions.isLoading || auctions.isError || rows.length === 0) {
    return (
      <StateFallback
        isLoading={auctions.isLoading}
        isError={auctions.isError}
        error={auctions.error}
        isEmpty={rows.length === 0}
        onRetry={() => void auctions.refetch()}
        emptyIcon="trending-up"
        emptyTitle="Hozircha faol auksion yo'q"
        emptyDescription="Yangi auksionlar talab taxtasidan chiqadi — ovoz bering yoki o'zingiz ID so'rang."
        emptyCtaLabel="Talab taxtasi"
        onPressEmptyCta={onSeeDemand}
        aside={
          <>
            {paymentsOff && <PaymentsClosedNotice />}
            {explainer}
          </>
        }
      />
    );
  }

  const header = (
    <View style={styles.headerBlock}>
      {wonCount > 0 && (
        <InfoBanner
          icon="award"
          tone="gold"
          title={`${formatCount(wonCount)} ta yutuq to'lov kutmoqda`}
          description="G'olib bo'lgan auksionlaringiz to'lov muddati bilan 'Meniki' bo'limida turibdi."
          style={styles.headerBannerFirst}
        >
          <PremiumButton label="Ko'rish" variant="ghost" onPress={onSeeMine} style={styles.bannerAction} />
        </InfoBanner>
      )}

      <View style={styles.metricsRow}>
        <MetricTile label="Jonli" value={formatCount(summary.count)} tone="live" />
        <MetricTile label="Eng yuqori narx" value={formatSom(summary.highestPrice)} tone="gold" />
        <MetricTile label="Eng yaqin tugash">
          <AuctionCountdown endsAt={summary.soonestEndsAt} style={styles.tileCountdown} />
        </MetricTile>
      </View>

      {paymentsOff && <PaymentsClosedNotice />}
    </View>
  );

  return (
    <FlashList
      data={rows}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={styles.listContent}
      ListHeaderComponent={header}
      ListFooterComponent={explainer}
      refreshing={auctions.isRefetching}
      onRefresh={() => void auctions.refetch()}
      renderItem={({ item, index }) => (
        <AuctionListCard
          auction={item}
          index={index}
          viewerId={viewerId}
          onPress={() => navigation.navigate('AuctionDetail', { auctionId: item.id })}
        />
      )}
    />
  );
}

/* ------------------------------------------------------------------ *
 * Yaqinda (talab taxtasi)
 * ------------------------------------------------------------------ */

/**
 * android/docs/02-API_MAP.md §2.4: there is no "scheduled/upcoming auction"
 * concept in the live API. The real, backend-backed equivalent is the demand
 * board — users voting an ID toward auction — so that is what this tab shows,
 * plus the genuine `POST /api/auction-requests` entry point.
 */
function DemandTab({ navigation }: { navigation: Navigation }) {
  const demand = useAuctionDemand();
  const vote = useVoteAuctionDemand();
  const paymentsOff = usePaymentsEnabledStore((s) => s.status === 'disabled');
  const toast = useToast();
  const sheetRef = useRef<BottomSheet>(null);

  const rows = (demand.data?.demand ?? []).filter((row) => row.status !== 'hidden');
  const threshold = toFiniteNumber(demand.data?.threshold);

  const onVote = (demandId: number) => {
    vote.mutate(demandId, {
      onSuccess: (result) => toast.show(result.voted ? 'Ovozingiz qabul qilindi.' : 'Ovoz allaqachon berilgan.', 'success'),
      onError: (error) => toast.show(apiErrorMessage(error), 'warning'),
    });
  };

  const requestCta = (
    <PremiumButton
      label="ID ni auksionga so'rash"
      variant="ghost"
      onPress={() => sheetRef.current?.expand()}
      style={styles.bannerAction}
    />
  );

  const intro = (
    <InfoBanner
      icon="users"
      tone="gold"
      title="Talab taxtasi"
      description={
        threshold != null && threshold > 0
          ? `Ovozlar ${formatCount(threshold)} taga yetganda ID auksionga chiqariladi. Ovoz bering yoki o'zingiz ID so'rang.`
          : "Ovozlar belgilangan chegaraga yetganda ID auksionga chiqariladi. Ovoz bering yoki o'zingiz ID so'rang."
      }
      style={styles.headerBannerFirst}
    >
      {requestCta}
    </InfoBanner>
  );

  const sheet = <AuctionRequestSheet ref={sheetRef} onSignIn={recoverSession} />;

  if (demand.isLoading || demand.isError || rows.length === 0) {
    return (
      <View style={styles.tabRoot}>
        <StateFallback
          isLoading={demand.isLoading}
          isError={demand.isError}
          error={demand.error}
          isEmpty={rows.length === 0}
          onRetry={() => void demand.refetch()}
          emptyIcon="users"
          emptyTitle="Talab taxtasi hozircha bo'sh"
          emptyDescription="Auksionga chiqishini istagan ID ni so'rang — ovoz yig'ilishi shundan boshlanadi."
          emptyCtaLabel="ID so'rash"
          onPressEmptyCta={() => sheetRef.current?.expand()}
          aside={<AuctionHowItWorks threshold={threshold} paymentsOff={paymentsOff} />}
        />
        {sheet}
      </View>
    );
  }

  return (
    <View style={styles.tabRoot}>
      <FlashList
        data={rows}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={<View style={styles.headerBlock}>{intro}</View>}
        ListFooterComponent={<AuctionHowItWorks threshold={threshold} paymentsOff={paymentsOff} />}
        refreshing={demand.isRefetching}
        onRefresh={() => void demand.refetch()}
        renderItem={({ item, index }) => (
          <AuctionDemandCard
            demand={item}
            threshold={threshold}
            index={index}
            voting={vote.isPending && vote.variables === item.id}
            onVote={() => onVote(item.id)}
            onOpenAuction={(auctionId) => navigation.navigate('AuctionDetail', { auctionId })}
          />
        )}
      />
      {sheet}
    </View>
  );
}

/* ------------------------------------------------------------------ *
 * Tugagan
 * ------------------------------------------------------------------ */

function EndedTab({ navigation }: { navigation: Navigation }) {
  const auctions = useEndedAuctions();
  const viewerId = useAuthStore((s) => s.user?.id ?? null);
  const rows = auctions.data ?? [];

  const archiveNote = (
    <InfoBanner
      icon="archive"
      title="Arxiv"
      description="Bu ro'yxatda yakunlangan auksionlar ko'rinadi. Yakuniy narx — g'olib bo'lgan taklif summasi."
    />
  );

  if (auctions.isLoading || auctions.isError || rows.length === 0) {
    return (
      <StateFallback
        isLoading={auctions.isLoading}
        isError={auctions.isError}
        error={auctions.error}
        isEmpty={rows.length === 0}
        onRetry={() => void auctions.refetch()}
        emptyIcon="flag"
        emptyTitle="Tugagan auksion yo'q"
        emptyDescription="Birinchi auksion yakunlangach, natijalar shu yerda saqlanadi."
        aside={archiveNote}
      />
    );
  }

  return (
    <FlashList
      data={rows}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={styles.listContent}
      ListHeaderComponent={
        <View style={styles.headerBlock}>
          <View style={styles.metricsRow}>
            <MetricTile label="Yakunlangan" value={formatCount(rows.length)} />
            <MetricTile label="Eng yuqori yakuniy narx" value={formatSom(summarizeAuctions(rows).highestPrice)} tone="gold" />
          </View>
        </View>
      }
      ListFooterComponent={archiveNote}
      refreshing={auctions.isRefetching}
      onRefresh={() => void auctions.refetch()}
      renderItem={({ item, index }) => (
        <AuctionListCard
          auction={item}
          index={index}
          viewerId={viewerId}
          onPress={() => navigation.navigate('AuctionDetail', { auctionId: item.id })}
        />
      )}
    />
  );
}

/* ------------------------------------------------------------------ *
 * Meniki
 * ------------------------------------------------------------------ */

/**
 * There is no "my bid history across all auctions" endpoint anywhere in the
 * API (Phase 1 audit). The one real, user-scoped source is
 * `GET /api/auctions/won/pending` — auctions won and still owing payment —
 * so that is what this tab shows, with the payment deadline it returns.
 */
function MineTab({ navigation, onSeeLive }: { navigation: Navigation; onSeeLive: () => void }) {
  const won = useWonPendingAuctions();
  const paymentsOff = usePaymentsEnabledStore((s) => s.status === 'disabled');
  const rows = won.data ?? [];

  const deadlineNote = (
    <InfoBanner
      icon="clock"
      title="To'lov muddati"
      description="G'olib bo'lgan ID belgilangan muddatgacha to'lov kutadi. Muddat o'tsa, ID qayta auksionga chiqishi mumkin."
    />
  );

  const aside = (
    <>
      {paymentsOff && <PaymentsClosedNotice />}
      {deadlineNote}
    </>
  );

  if (won.isLoading || won.isError || rows.length === 0) {
    return (
      <StateFallback
        isLoading={won.isLoading}
        isError={won.isError}
        error={won.error}
        isEmpty={rows.length === 0}
        onRetry={() => void won.refetch()}
        emptyIcon="award"
        emptyTitle="Hozircha yutgan auksioningiz yo'q"
        emptyDescription="G'olib bo'lgan va to'lov kutayotgan auksionlar shu yerda ko'rinadi."
        emptyCtaLabel="Jonli auksionlar"
        onPressEmptyCta={onSeeLive}
        aside={aside}
      />
    );
  }

  return (
    <FlashList
      data={rows}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={styles.listContent}
      ListHeaderComponent={
        <View style={styles.headerBlock}>
          {paymentsOff && <PaymentsClosedNotice style={styles.headerBannerFirst} />}
        </View>
      }
      ListFooterComponent={deadlineNote}
      refreshing={won.isRefetching}
      onRefresh={() => void won.refetch()}
      renderItem={({ item, index }) => (
        <WonAuctionCard
          code={item.code}
          currentPrice={item.currentPrice}
          paymentDeadline={item.paymentDeadline}
          index={index}
          onPay={() => navigation.navigate('AuctionPayment', { auctionId: item.id })}
          onOpen={() => navigation.navigate('AuctionDetail', { auctionId: item.id })}
        />
      )}
    />
  );
}

function WonAuctionCard({
  code,
  currentPrice,
  paymentDeadline,
  index,
  onPay,
  onOpen,
}: {
  code: string;
  currentPrice: number;
  paymentDeadline: string;
  index: number;
  onPay: () => void;
  onOpen: () => void;
}) {
  return (
    <PremiumCard index={index} variant="featured" style={styles.wonCard}>
      <View style={styles.wonTop}>
        <View style={styles.wonIdentity}>
          <Text style={styles.wonCode} numberOfLines={1}>
            #{code}
          </Text>
          <TierBadge tier={tierForCode(code)} />
        </View>
        <PremiumBadge label="To'lov kutilmoqda" tone="warning" />
      </View>

      <View style={styles.metricsRow}>
        <MetricTile label="Yakuniy narx" value={formatSom(currentPrice)} tone="gold" />
        <MetricTile label="Muddat tugashiga">
          <AuctionCountdown endsAt={paymentDeadline} urgentUnderMs={PAYMENT_URGENT_MS} style={styles.tileCountdown} />
        </MetricTile>
      </View>

      <Text style={styles.wonDeadline}>To'lov muddati: {formatDateTime(paymentDeadline)}</Text>

      <PremiumButton label="To'lash" onPress={onPay} style={styles.wonPrimary} />
      <PremiumButton label="Auksionni ko'rish" variant="ghost" onPress={onOpen} style={styles.wonSecondary} />
    </PremiumCard>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, marginTop: space.md },
  tabRoot: { flex: 1 },
  listContent: { paddingBottom: space.xxl },
  stateScroll: { paddingBottom: space.xxl, flexGrow: 1 },
  headerBlock: { marginBottom: space.lg },
  headerBannerFirst: { marginTop: 0, marginBottom: space.md },
  metricsRow: { flexDirection: 'row', gap: space.sm },
  tileCountdown: { fontSize: 15 },
  bannerAction: { marginTop: space.sm },

  wonCard: { marginBottom: space.md },
  wonTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm, marginBottom: space.lg },
  wonIdentity: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexShrink: 1 },
  wonCode: { ...typeTokens.mono, color: color.textPrimary, fontSize: 18, flexShrink: 1 },
  wonDeadline: { ...typeTokens.caption, color: color.textSecondary, marginTop: space.md },
  wonPrimary: { marginTop: space.lg },
  wonSecondary: { marginTop: space.sm },
});
