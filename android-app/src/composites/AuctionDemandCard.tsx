import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumCard } from '../design-system/components/PremiumCard';
import { PremiumBadge, TierBadge } from '../design-system/components/PremiumBadge';
import { PremiumButton } from '../design-system/components/PremiumButton';
import { AuctionCountdown } from './AuctionCountdown';
import { MetaChip, ProgressBar } from '../screens/auction/AuctionUi';
import { demandProgress } from '../screens/auction/auctionModel';
import { formatCount, formatSom, toFiniteNumber } from '../lib/format';
import { tierForCode } from '../lib/pricing';
import type { AuctionDemand } from '../api/types';
import { color, space, type as typeTokens } from '../design-system/tokens';

export interface AuctionDemandCardProps {
  demand: AuctionDemand;
  /** Threshold from the same `GET /api/auction-demand` response. */
  threshold: number | null;
  onVote: () => void;
  voting?: boolean;
  /** Only rendered when the entry really carries an `auctionId`. */
  onOpenAuction?: (auctionId: number) => void;
  index?: number;
}

const STATUS: Record<string, { label: string; tone: 'live' | 'success' | 'warning' | 'neutral' }> = {
  collecting: { label: "Ovoz yig'ilmoqda", tone: 'neutral' },
  ready: { label: 'Tayyor', tone: 'success' },
  auction_live: { label: 'LIVE', tone: 'live' },
};

/**
 * One row of the demand board (`GET /api/auction-demand`) — the real,
 * backend-backed concept behind the "Yaqinda" tab. There is no "scheduled
 * auction" status anywhere in the API, so this board is what upcoming
 * actually means: IDs users are voting toward auction.
 */
export function AuctionDemandCard({
  demand,
  threshold,
  onVote,
  voting = false,
  onOpenAuction,
  index,
}: AuctionDemandCardProps) {
  const status = STATUS[demand.status] ?? { label: 'Talab', tone: 'neutral' as const };
  const votes = toFiniteNumber(demand.interestCount) ?? 0;
  const progress = demandProgress(demand.interestCount, threshold);
  const auctionId = typeof demand.auctionId === 'number' && Number.isFinite(demand.auctionId) ? demand.auctionId : null;
  const isLiveAuction = demand.status === 'auction_live' && auctionId != null;
  const votesLabel =
    threshold != null && threshold > 0
      ? `${formatCount(votes)} / ${formatCount(threshold)} ovoz`
      : `${formatCount(votes)} ovoz`;

  return (
    <PremiumCard index={index} variant={isLiveAuction ? 'featured' : 'default'} style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.identity}>
          <Text style={styles.code} numberOfLines={1}>
            #{demand.code}
          </Text>
          <TierBadge tier={tierForCode(demand.code)} />
        </View>
        <PremiumBadge label={status.label} tone={status.tone} pulse={status.tone === 'live'} />
      </View>

      {isLiveAuction ? (
        <View style={styles.liveBlock}>
          <View>
            <Text style={styles.overline}>JORIY NARX</Text>
            <Text style={styles.price} numberOfLines={1}>
              {formatSom(demand.auctionCurrentPrice)}
            </Text>
          </View>
          <View style={styles.timeBlock}>
            <Text style={[styles.overline, styles.alignRight]}>TUGASHIGA</Text>
            <AuctionCountdown endsAt={demand.auctionEndsAt} style={styles.countdown} />
          </View>
        </View>
      ) : (
        <View style={styles.progressBlock}>
          <View style={styles.progressHeader}>
            <Text style={styles.votes}>{votesLabel}</Text>
            <MetaChip
              icon={demand.status === 'ready' ? 'check' : 'users'}
              tone={demand.status === 'ready' ? 'success' : 'neutral'}
              label={demand.status === 'ready' ? 'Chegara bosib o‘tildi' : `${Math.round(progress * 100)}%`}
            />
          </View>
          <ProgressBar progress={progress} tone={demand.status === 'ready' ? 'success' : 'gold'} />
        </View>
      )}

      {isLiveAuction && onOpenAuction && auctionId != null ? (
        <PremiumButton label="Auksionni ochish" onPress={() => onOpenAuction(auctionId)} style={styles.action} />
      ) : (
        <PremiumButton
          label={demand.voted ? 'Ovoz berdingiz' : 'Ovoz berish'}
          variant="ghost"
          disabled={!!demand.voted || voting}
          loading={voting}
          onPress={onVote}
          style={styles.action}
        />
      )}
    </PremiumCard>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: space.md },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  identity: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexShrink: 1 },
  code: { ...typeTokens.mono, color: color.textPrimary, fontSize: 18, flexShrink: 1 },
  overline: { ...typeTokens.overline, color: color.textTertiary },
  alignRight: { textAlign: 'right' },
  price: { ...typeTokens.h2, color: color.gold, marginTop: 2 },
  liveBlock: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: space.md,
    marginTop: space.lg,
  },
  timeBlock: { alignItems: 'flex-end' },
  countdown: { fontSize: 16, marginTop: 2 },
  progressBlock: { marginTop: space.lg, gap: space.sm },
  progressHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  votes: { ...typeTokens.bodyStrong, color: color.textPrimary },
  action: { marginTop: space.lg },
});
