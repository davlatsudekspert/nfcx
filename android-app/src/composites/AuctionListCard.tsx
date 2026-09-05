import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PremiumCard } from '../design-system/components/PremiumCard';
import { PremiumBadge } from '../design-system/components/PremiumBadge';
import { AuctionCountdown } from './AuctionCountdown';
import { formatSom } from '../lib/format';
import { haptics } from '../native/haptics';
import type { Auction } from '../api/types';
import { color, space, type as typeTokens } from '../design-system/tokens';

export interface AuctionListCardProps {
  auction: Auction;
  onPress: () => void;
  index?: number;
}

/**
 * Full-width auction row for the list tabs. The mockup shows a live
 * participant count per card — omitted here on purpose: `GET /api/auctions`
 * (the list endpoint) does not return a bid/participant count, only
 * `GET /api/auctions/:id` (the detail endpoint) does, via its `bids` array
 * — showing a fabricated number here would misinform the user rather than
 * showing an honest UI (android/docs/02-API_MAP.md §2.4).
 */
export function AuctionListCard({ auction, onPress, index }: AuctionListCardProps) {
  const ended = auction.status !== 'active';

  return (
    <Pressable
      onPress={() => {
        haptics.selection();
        onPress();
      }}
    >
      <PremiumCard index={index} style={styles.card} featured={auction.status === 'active'}>
        <View style={styles.topRow}>
          <Text style={styles.code}>#{auction.code}</Text>
          {auction.status === 'active' && <PremiumBadge label="LIVE" tone="live" pulse />}
          {auction.status === 'sold' && <PremiumBadge label="Tugagan" tone="neutral" />}
        </View>
        <View style={styles.bottomRow}>
          <View>
            <Text style={styles.priceLabel}>{ended ? 'Yakuniy narx' : 'Joriy narx'}</Text>
            <Text style={styles.price}>{formatSom(auction.currentPrice)}</Text>
          </View>
          {!ended && <AuctionCountdown endsAt={auction.endsAt} />}
        </View>
      </PremiumCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: space.md },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  code: { ...typeTokens.mono, color: color.textPrimary, fontSize: 18 },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: space.md },
  priceLabel: { ...typeTokens.caption, color: color.textSecondary },
  price: { ...typeTokens.h2, color: color.gold, marginTop: 2 },
});
