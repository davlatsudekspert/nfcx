import React, { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type BottomSheet from '@gorhom/bottom-sheet';
import type { AuctionStackParamList } from '../../navigation/types';
import { ScreenWithHeader } from '../shared/ScreenWithHeader';
import { PremiumButton } from '../../design-system/components/PremiumButton';
import { PremiumCard } from '../../design-system/components/PremiumCard';
import { PremiumBadge } from '../../design-system/components/PremiumBadge';
import { PremiumSheet } from '../../design-system/components/PremiumSheet';
import { PremiumInput } from '../../design-system/components/PremiumInput';
import { PremiumLoadingSkeleton } from '../../design-system/components/PremiumLoadingSkeleton';
import { AuctionCountdown } from '../../composites/AuctionCountdown';
import { auctionsApi } from '../../api/auctions';
import { ApiError } from '../../api/client';
import { usePaymentsEnabledStore } from '../../state/paymentsEnabledStore';
import { formatSom, timeAgo } from '../../lib/format';
import { haptics } from '../../native/haptics';
import { color, space, type as typeTokens } from '../../design-system/tokens';

type Props = NativeStackScreenProps<AuctionStackParamList, 'AuctionDetail'>;

/**
 * Polls GET /api/auctions/:id every 4s while the auction is active
 * (android/docs/03-ARCHITECTURE.md §3.4) — there is no WebSocket/SSE
 * anywhere in this backend. The countdown itself ticks locally against the
 * server-provided `endsAt` between polls.
 */
export function AuctionDetailScreen({ route, navigation }: Props) {
  const { auctionId } = route.params;
  const paymentsStatus = usePaymentsEnabledStore((s) => s.status);
  const sheetRef = useRef<BottomSheet>(null);
  const [bidAmount, setBidAmount] = useState('');
  const [bidError, setBidError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const detail = useQuery({
    queryKey: ['auctions', auctionId],
    queryFn: () => auctionsApi.get(auctionId),
    refetchInterval: (query) => (query.state.data?.auction.status === 'active' ? 4000 : false),
  });

  const bid = useMutation({
    mutationFn: (amount: number) => auctionsApi.bid(auctionId, amount, `${auctionId}-${Date.now()}`),
    onSuccess: () => {
      haptics.success();
      sheetRef.current?.close();
      queryClient.invalidateQueries({ queryKey: ['auctions', auctionId] });
    },
    onError: (e) => setBidError(e instanceof ApiError ? e.message : 'Xizmat vaqtincha mavjud emas.'),
  });

  if (detail.isLoading || !detail.data) {
    return (
      <ScreenWithHeader title="Auksion" onBack={navigation.goBack}>
        <PremiumLoadingSkeleton height={180} />
      </ScreenWithHeader>
    );
  }

  const { auction, bids } = detail.data;
  const isActive = auction.status === 'active';
  const minBid = auction.currentPrice + (auction.minIncrement || 10000);
  const paymentsOff = paymentsStatus === 'disabled';

  const openBidSheet = () => {
    setBidAmount(String(minBid));
    setBidError(null);
    sheetRef.current?.expand();
  };

  const onSubmitBid = () => {
    const amount = Number(bidAmount);
    if (!Number.isFinite(amount) || amount < minBid) {
      setBidError(`Taklif kamida ${formatSom(minBid)} bo'lishi kerak.`);
      return;
    }
    haptics.medium();
    bid.mutate(amount);
  };

  return (
    <ScreenWithHeader title={`#${auction.code}`} onBack={navigation.goBack}>
      <View style={styles.headerRow}>
        <Text style={styles.code}>#{auction.code}</Text>
        {isActive && <PremiumBadge label="LIVE" tone="live" pulse />}
      </View>

      {isActive && <AuctionCountdown endsAt={auction.endsAt} style={styles.countdown} />}

      <PremiumCard style={styles.priceCard}>
        <Text style={styles.priceLabel}>Joriy narx</Text>
        <Text style={styles.price}>{formatSom(auction.currentPrice)}</Text>
        <Text style={styles.participants}>{bids.length} taklif</Text>
      </PremiumCard>

      {paymentsOff && (
        <View style={styles.banner}>
          <PremiumBadge label="To'lovlar yopiq" tone="warning" />
          <Text style={styles.bannerText}>Auksionda taklif berish to'lov tizimi yoqilgach faollashadi.</Text>
        </View>
      )}

      {isActive && <PremiumButton label="Taklif berish" onPress={openBidSheet} disabled={paymentsOff} style={styles.bidButton} />}

      <Text style={styles.sectionTitle}>Takliflar tarixi</Text>
      {bids.length === 0 ? (
        <Text style={styles.emptyBids}>Hali takliflar yo'q.</Text>
      ) : (
        <FlashList
          data={bids}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <View style={styles.bidRow}>
              <Text style={styles.bidderCode}>{item.bidderCode ? `#${item.bidderCode}` : 'Anonim'}</Text>
              <Text style={styles.bidAmount}>{formatSom(item.amount)}</Text>
              <Text style={styles.bidTime}>{timeAgo(new Date(item.createdAt).getTime())}</Text>
            </View>
          )}
        />
      )}

      <PremiumSheet ref={sheetRef} title="Taklif berish">
        <Text style={styles.sheetHint}>Minimal taklif: {formatSom(minBid)}</Text>
        <PremiumInput
          label="Taklif summasi"
          value={bidAmount}
          onChangeText={setBidAmount}
          keyboardType="number-pad"
          error={bidError}
        />
        <PremiumButton label="Tasdiqlash" onPress={onSubmitBid} loading={bid.isPending} />
      </PremiumSheet>
    </ScreenWithHeader>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  code: { ...typeTokens.display, color: color.textPrimary },
  countdown: { marginTop: space.xs, fontSize: 18 },
  priceCard: { marginTop: space.lg },
  priceLabel: { ...typeTokens.caption, color: color.textSecondary },
  price: { ...typeTokens.h1, color: color.gold, marginTop: 2 },
  participants: { ...typeTokens.caption, color: color.textTertiary, marginTop: space.xs },
  banner: { backgroundColor: color.surface, borderRadius: 14, padding: space.md, marginTop: space.lg, gap: space.xs },
  bannerText: { ...typeTokens.caption, color: color.textSecondary },
  bidButton: { marginTop: space.lg },
  sectionTitle: { ...typeTokens.h2, color: color.textPrimary, marginTop: space.xl, marginBottom: space.sm },
  emptyBids: { ...typeTokens.body, color: color.textTertiary },
  bidRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: space.sm, borderBottomWidth: 1, borderBottomColor: color.border },
  bidderCode: { ...typeTokens.mono, color: color.textPrimary },
  bidAmount: { ...typeTokens.body, color: color.gold },
  bidTime: { ...typeTokens.caption, color: color.textTertiary },
  sheetHint: { ...typeTokens.caption, color: color.textSecondary, marginBottom: space.sm },
});
