import React, { useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type BottomSheet from '@gorhom/bottom-sheet';
import type { AuctionStackParamList } from '../../navigation/types';
import { ScreenWithHeader } from '../shared/ScreenWithHeader';
import { PremiumCard } from '../../design-system/components/PremiumCard';
import { PremiumBadge, TierBadge } from '../../design-system/components/PremiumBadge';
import { PremiumButton } from '../../design-system/components/PremiumButton';
import { PremiumQueryState } from '../../design-system/components/PremiumQueryState';
import { useToast } from '../../design-system/components/PremiumToast';
import { AuctionCountdown } from '../../composites/AuctionCountdown';
import { AuctionBidSheet } from './AuctionBidSheet';
import { AuctionBidRow } from './AuctionBidRow';
import { InfoBanner, MetaChip, MetricTile, PaymentsClosedNotice, SectionLabel } from './AuctionUi';
import { recoverSession } from './sessionRecovery';
import {
  apiErrorMessage,
  auctionCurrentPrice,
  auctionMinIncrement,
  auctionStartPrice,
  auctionStatusLabel,
  isAuctionLive,
  isPaymentsDisabledError,
  isUnauthorizedError,
  minNextBid,
  myHighestBid,
  sameUserId,
  sortBidsTopFirst,
  topBidId,
  validateBidInput,
  viewerState,
  type ViewerState,
} from './auctionModel';
import { useAuctionDetail, usePlaceBid } from '../../hooks/useAuctions';
import { useAuthStore } from '../../state/authStore';
import { usePaymentsEnabledStore } from '../../state/paymentsEnabledStore';
import { formatCount, formatDateTime, formatSom } from '../../lib/format';
import { tierForCode } from '../../lib/pricing';
import { haptics } from '../../native/haptics';
import type { Auction, Bid } from '../../api/types';
import { color, space, type as typeTokens } from '../../design-system/tokens';

type Props = NativeStackScreenProps<AuctionStackParamList, 'AuctionDetail'>;

const PAYMENT_URGENT_MS = 24 * 60 * 60 * 1000;

/**
 * One auction, in full.
 *
 * Polls `GET /api/auctions/:id` every 4s while the auction is genuinely live
 * (android/docs/03-ARCHITECTURE.md §3.4 — this backend has no WebSocket/SSE);
 * the countdown ticks locally against the server's `endsAt` between polls.
 *
 * Bidding goes through `POST /api/auctions/:id/bid` with a fresh idempotency
 * key per attempt. That endpoint answers `503 payments_disabled` in
 * production today, which is rendered as an explicit closed state — never as
 * a fake success and never as a repeating error toast.
 */
export function AuctionDetailScreen({ route, navigation }: Props) {
  const { auctionId } = route.params;
  const detail = useAuctionDetail(auctionId);
  const placeBid = usePlaceBid(auctionId);
  const toast = useToast();
  const viewerId = useAuthStore((s) => s.user?.id ?? null);
  const paymentsStatus = usePaymentsEnabledStore((s) => s.status);

  const sheetRef = useRef<BottomSheet>(null);
  const [amount, setAmount] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const auction = detail.data?.auction ?? null;
  const bids = useMemo(() => sortBidsTopFirst(detail.data?.bids), [detail.data?.bids]);

  const live = isAuctionLive(auction);
  const status = auctionStatusLabel(auction);
  const nextMinBid = minNextBid(auction);
  const state = viewerState(auction, bids, viewerId);
  const myBid = myHighestBid(bids, viewerId);
  const leadingBidId = topBidId(bids);

  const paymentsBlocked = paymentsStatus === 'disabled' || isPaymentsDisabledError(placeBid.error);
  const sessionExpired = isUnauthorizedError(placeBid.error);
  const serverError =
    placeBid.isError && !paymentsBlocked && !sessionExpired ? apiErrorMessage(placeBid.error) : null;

  const openBidSheet = () => {
    placeBid.reset();
    setFormError(null);
    setAmount(nextMinBid != null ? String(nextMinBid) : '');
    sheetRef.current?.expand();
  };

  const submitBid = () => {
    const validation = validateBidInput(amount, nextMinBid);
    if (!validation.ok) {
      setFormError(validation.message);
      return;
    }
    setFormError(null);
    haptics.medium();
    placeBid.mutate(validation.amount, {
      onSuccess: () => {
        haptics.success();
        sheetRef.current?.close();
        setAmount('');
        toast.show('Taklifingiz qabul qilindi.', 'success');
      },
      onError: (error) => {
        if (isPaymentsDisabledError(error)) {
          // Keep the app-wide flag honest, so every other payment CTA
          // reflects the same closed state immediately.
          void usePaymentsEnabledStore.getState().refresh();
          haptics.warning();
          return;
        }
        haptics.error();
      },
    });
  };

  const goToPayment = () => navigation.navigate('AuctionPayment', { auctionId });

  if (detail.isLoading || detail.isError || !auction) {
    return (
      <ScreenWithHeader title="Auksion" onBack={navigation.goBack} scroll={false}>
        <ScrollView contentContainerStyle={styles.stateScroll} showsVerticalScrollIndicator={false}>
          <PremiumQueryState
            isLoading={detail.isLoading}
            isError={detail.isError}
            error={detail.error}
            isEmpty={!detail.isLoading && !detail.isError && !auction}
            onRetry={() => void detail.refetch()}
            onUnauthorized={recoverSession}
            emptyIcon="search"
            emptyTitle="Auksion topilmadi"
            emptyDescription="Bu auksion o'chirilgan yoki mavjud emas."
            emptyCtaLabel="Orqaga"
            onPressEmptyCta={navigation.goBack}
            skeletonRows={3}
            skeletonHeight={140}
          />
        </ScrollView>
      </ScreenWithHeader>
    );
  }

  const header = (
    <View>
      <PremiumCard variant={live ? 'featured' : 'default'} animate={false} style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={styles.identity}>
            <Text style={styles.code} numberOfLines={1}>
              #{auction.code}
            </Text>
            <TierBadge tier={tierForCode(auction.code)} />
          </View>
          <PremiumBadge label={status.label} tone={status.tone} pulse={status.tone === 'live'} />
        </View>

        <Text style={styles.overline}>{live ? 'JORIY NARX' : 'YAKUNIY NARX'}</Text>
        <Text style={styles.price} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
          {formatSom(auctionCurrentPrice(auction))}
        </Text>

        <View style={styles.heroChips}>
          <MetaChip icon="users" label={`${formatCount(bids.length)} taklif`} />
          {state === 'leading' && <MetaChip icon="award" tone="success" label="Siz yetakchisiz" />}
          {state === 'outbid' && <MetaChip icon="trending-up" tone="warning" label="Ortda qoldingiz" />}
        </View>

        <View style={styles.heroTimeRow}>
          <Text style={styles.overline}>{live ? 'TUGASHIGA' : 'TUGAGAN VAQT'}</Text>
          {live ? (
            <AuctionCountdown endsAt={auction.endsAt} style={styles.heroCountdown} />
          ) : (
            <Text style={styles.heroEndedAt}>{formatDateTime(auction.endsAt)}</Text>
          )}
        </View>
      </PremiumCard>

      <View style={styles.metricsRow}>
        <MetricTile label="Boshlang'ich" value={formatSom(auctionStartPrice(auction))} />
        <MetricTile label="Minimal qadam" value={formatSom(auctionMinIncrement(auction))} />
        <MetricTile
          label={live ? 'Keyingi taklif' : 'Oxirgi qadam'}
          value={formatSom(nextMinBid)}
          tone={live ? 'gold' : 'neutral'}
        />
      </View>

      <ViewerStateBanner
        state={state}
        auction={auction}
        myBid={myBid}
        bidCount={bids.length}
        onPay={goToPayment}
      />

      {paymentsBlocked && (
        <PaymentsClosedNotice
          description={
            live
              ? "Taklif berish to'lov tizimi yoqilgach faollashadi. Auksion va narxlar real vaqtda yangilanib turadi."
              : undefined
          }
        />
      )}

      {!!serverError && <InfoBanner icon="alert-circle" tone="danger" title="Taklif yuborilmadi" description={serverError} />}

      {sessionExpired && (
        <InfoBanner icon="log-in" tone="danger" title="Sessiya tugadi" description="Taklif berish uchun qaytadan kiring.">
          <PremiumButton label="Kirish" variant="ghost" onPress={recoverSession} style={styles.bannerAction} />
        </InfoBanner>
      )}

      {live && (
        <PremiumButton
          label="Taklif berish"
          onPress={openBidSheet}
          disabled={paymentsBlocked || nextMinBid == null || sessionExpired}
          style={styles.primaryCta}
        />
      )}

      {(state === 'won' || state === 'awaiting_payment') && (
        <PremiumButton label="To'lovga o'tish" onPress={goToPayment} style={styles.primaryCta} />
      )}

      <SectionLabel title="Takliflar tarixi" trailing={bids.length ? `${formatCount(bids.length)} ta` : undefined} />

      {bids.length === 0 && (
        <PremiumCard variant="sunken" animate={false} style={styles.emptyBids}>
          <Text style={styles.emptyBidsTitle}>Hali taklif berilmagan</Text>
          <Text style={styles.emptyBidsText}>
            {live
              ? "Birinchi taklif joriy narxdan kamida bitta qadamga yuqori bo'lishi kerak."
              : 'Bu auksionda taklif qayd etilmagan.'}
          </Text>
        </PremiumCard>
      )}
    </View>
  );

  return (
    <ScreenWithHeader title={`#${auction.code}`} onBack={navigation.goBack} scroll={false}>
      <View style={styles.listWrapper}>
        {/* The bid history is the screen's single scrollable list — the hero,
            metrics and CTA ride in `ListHeaderComponent` rather than being
            siblings inside a ScrollView, which would defeat virtualization. */}
        <FlashList
          data={bids}
          keyExtractor={(item) => String(item.id)}
          ListHeaderComponent={header}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={BidSeparator}
          refreshing={detail.isRefetching}
          onRefresh={() => void detail.refetch()}
          renderItem={({ item, index }: { item: Bid; index: number }) => (
            <AuctionBidRow
              bid={item}
              rank={index + 1}
              isTop={item.id === leadingBidId}
              isMine={sameUserId(item.userId, viewerId)}
            />
          )}
        />
      </View>

      <AuctionBidSheet
        ref={sheetRef}
        auction={auction}
        minBid={nextMinBid}
        amount={amount}
        onChangeAmount={(value) => {
          setAmount(value);
          if (formError) setFormError(null);
        }}
        onSubmit={submitBid}
        submitting={placeBid.isPending}
        errorMessage={formError ?? serverError}
        paymentsClosed={paymentsBlocked}
        sessionExpired={sessionExpired}
        onSignIn={recoverSession}
      />
    </ScreenWithHeader>
  );
}

function BidSeparator() {
  return <View style={styles.separator} />;
}

function ViewerStateBanner({
  state,
  auction,
  myBid,
  bidCount,
  onPay,
}: {
  state: ViewerState;
  auction: Auction;
  myBid: number | null;
  bidCount: number;
  onPay: () => void;
}) {
  if (state === 'leading') {
    return (
      <InfoBanner
        icon="award"
        tone="success"
        title="Siz yetakchisiz"
        description={`Sizning taklifingiz: ${formatSom(myBid)}. Taymer tugaguncha yangi takliflarni kuzatib turing.`}
      />
    );
  }

  if (state === 'outbid') {
    return (
      <InfoBanner
        icon="trending-up"
        tone="warning"
        title="Taklifingiz ortda qoldi"
        description={`Sizning eng yuqori taklifingiz: ${formatSom(myBid)}. Yetakchi bo'lish uchun narxni oshiring.`}
      />
    );
  }

  if (state === 'awaiting_payment' || state === 'won') {
    return (
      <InfoBanner
        icon="award"
        tone="gold"
        title="Siz yutdingiz"
        description={
          auction.paymentDeadline
            ? `To'lov muddati: ${formatDateTime(auction.paymentDeadline)}.`
            : "To'lov bo'limida yakuniy summani ko'rasiz."
        }
      >
        {!!auction.paymentDeadline && (
          <View style={styles.deadlineRow}>
            <Text style={styles.deadlineLabel}>Muddat tugashiga</Text>
            <AuctionCountdown
              endsAt={auction.paymentDeadline}
              urgentUnderMs={PAYMENT_URGENT_MS}
              style={styles.deadlineCountdown}
            />
          </View>
        )}
        <PremiumButton label="To'lovga o'tish" variant="ghost" onPress={onPay} style={styles.bannerAction} />
      </InfoBanner>
    );
  }

  if (state === 'lost') {
    return (
      <InfoBanner
        icon="flag"
        title="Auksion yakunlandi"
        description={`G'olib boshqa ishtirokchi bo'ldi. Sizning eng yuqori taklifingiz: ${formatSom(myBid)}.`}
      />
    );
  }

  if (state === 'ended') {
    return (
      <InfoBanner
        icon="flag"
        title="Auksion yakunlandi"
        description={`${formatDateTime(auction.endsAt)} da yakunlandi. Jami ${formatCount(bidCount)} ta taklif qayd etilgan.`}
      />
    );
  }

  return null;
}

const styles = StyleSheet.create({
  listWrapper: { flex: 1 },
  listContent: { paddingBottom: space.xxl },
  stateScroll: { flexGrow: 1, paddingBottom: space.xxl },

  hero: { marginTop: space.sm },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  identity: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexShrink: 1 },
  code: { ...typeTokens.monoLarge, color: color.textPrimary, flexShrink: 1 },
  overline: { ...typeTokens.overline, color: color.textTertiary },
  price: { ...typeTokens.display, color: color.gold, marginTop: 2 },
  heroChips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md },
  heroTimeRow: {
    marginTop: space.lg,
    paddingTop: space.md,
    borderTopWidth: 1,
    borderTopColor: color.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  heroCountdown: { fontSize: 20 },
  heroEndedAt: { ...typeTokens.bodyStrong, color: color.textSecondary },

  metricsRow: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  bannerAction: { marginTop: space.sm },
  deadlineRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.xs },
  deadlineLabel: { ...typeTokens.caption, color: color.textSecondary },
  deadlineCountdown: { fontSize: 15 },
  primaryCta: { marginTop: space.lg },

  emptyBids: { marginTop: space.xs },
  emptyBidsTitle: { ...typeTokens.bodyStrong, color: color.textPrimary },
  emptyBidsText: { ...typeTokens.caption, color: color.textSecondary, marginTop: space.xs, lineHeight: 18 },
  separator: { height: space.sm },
});
