import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumCard } from '../design-system/components/PremiumCard';
import { PremiumBadge, TierBadge } from '../design-system/components/PremiumBadge';
import { AuctionCountdown } from './AuctionCountdown';
import { MetaChip, TactilePressable } from '../screens/auction/AuctionUi';
import {
  auctionCurrentPrice,
  auctionMinIncrement,
  auctionStartPrice,
  auctionStatusLabel,
  isAuctionLive,
  sameUserId,
} from '../screens/auction/auctionModel';
import { formatDateTime, formatSom } from '../lib/format';
import { tierForCode } from '../lib/pricing';
import type { Auction } from '../api/types';
import { color, depth, radius, space, type as typeTokens } from '../design-system/tokens';

export interface AuctionListCardProps {
  auction: Auction;
  onPress: () => void;
  index?: number;
  /** Logged-in user id — only used to mark "siz yetakchisiz" when the list
   * row actually carries `highestBidderId`. Never fabricated. */
  viewerId?: number | string | null;
}

/**
 * Full-width auction row.
 *
 * Everything on it comes from the row the list endpoint returned: code, tier
 * (computed locally by `tierForCode`, exactly as the web app does), status,
 * current price, deadline, and — only when the backend sends them —
 * `startPrice` / `minIncrement` / `highestBidderId`.
 *
 * `GET /api/auctions` does **not** return a bid/participant count (only
 * `GET /api/auctions/:id` does, via its `bids` array), so no count is shown
 * here: an invented number would misinform rather than impress
 * (android/docs/02-API_MAP.md §2.4).
 */
export function AuctionListCard({ auction, onPress, index, viewerId }: AuctionListCardProps) {
  const live = isAuctionLive(auction);
  const status = auctionStatusLabel(auction);
  const price = auctionCurrentPrice(auction);
  const startPrice = auctionStartPrice(auction);
  const leading = sameUserId(auction.highestBidderId, viewerId);
  const hasIncrement = auction.minIncrement != null;

  return (
    <TactilePressable
      onPress={onPress}
      accessibilityLabel={`${auction.code} auksioni, ${formatSom(price)}`}
      cornerRadius={radius.lg}
      style={styles.wrap}
    >
      <PremiumCard index={index} variant={live ? 'featured' : 'default'} style={live ? styles.cardLive : styles.card}>
        <View style={styles.topRow}>
          <View style={styles.identity}>
            <Text style={styles.code} numberOfLines={1}>
              #{auction.code}
            </Text>
            <TierBadge tier={tierForCode(auction.code)} />
          </View>
          <PremiumBadge label={status.label} tone={status.tone} pulse={status.tone === 'live'} />
        </View>

        <View style={styles.mainRow}>
          <View style={styles.priceBlock}>
            <Text style={styles.overline}>{live ? 'JORIY NARX' : 'YAKUNIY NARX'}</Text>
            <Text style={styles.price} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
              {formatSom(price)}
            </Text>
          </View>
          <View style={styles.timeBlock}>
            <Text style={[styles.overline, styles.alignRight]}>{live ? 'TUGASHIGA' : 'TUGADI'}</Text>
            {live ? (
              <AuctionCountdown endsAt={auction.endsAt} style={styles.countdown} />
            ) : (
              <Text style={styles.endedAt} numberOfLines={1}>
                {formatDateTime(auction.endsAt)}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.chipRow}>
          {leading && <MetaChip icon="award" tone="success" label={live ? 'Siz yetakchisiz' : 'Siz yutdingiz'} />}
          {startPrice != null && <MetaChip icon="flag" label={`Boshlang'ich ${formatSom(startPrice)}`} />}
          {hasIncrement && <MetaChip icon="chevrons-up" label={`Qadam ${formatSom(auctionMinIncrement(auction))}`} />}
        </View>
      </PremiumCard>
    </TactilePressable>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: space.md },
  card: { ...depth.card },
  cardLive: { ...depth.cardHero },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  identity: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexShrink: 1 },
  code: { ...typeTokens.monoLarge, fontSize: 20, lineHeight: 26, color: color.textPrimary, flexShrink: 1 },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: space.md,
    marginTop: space.lg,
  },
  priceBlock: { flexShrink: 1 },
  timeBlock: { alignItems: 'flex-end' },
  overline: { ...typeTokens.overline, color: color.textTertiary },
  alignRight: { textAlign: 'right' },
  price: { ...typeTokens.stat, fontSize: 24, lineHeight: 30, color: color.gold, marginTop: 2 },
  countdown: { ...typeTokens.stat, fontSize: 18, lineHeight: 24, marginTop: 2 },
  endedAt: { ...typeTokens.caption, color: color.textSecondary, marginTop: 4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md },
});
