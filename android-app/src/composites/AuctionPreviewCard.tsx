import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PremiumCard } from '../design-system/components/PremiumCard';
import { PremiumBadge } from '../design-system/components/PremiumBadge';
import { AuctionCountdown } from './AuctionCountdown';
import { formatSom } from '../lib/format';
import type { Auction } from '../api/types';
import { color, space, type as typeTokens } from '../design-system/tokens';

export interface AuctionPreviewCardProps {
  auction: Auction;
  onPress: () => void;
  index?: number;
}

export function AuctionPreviewCard({ auction, onPress, index }: AuctionPreviewCardProps) {
  return (
    <Pressable onPress={onPress}>
      <PremiumCard index={index} style={styles.card}>
        <View style={styles.topRow}>
          <Text style={styles.code}>#{auction.code}</Text>
          {auction.status === 'active' && <PremiumBadge label="LIVE" tone="live" pulse />}
        </View>
        <Text style={styles.priceLabel}>Joriy narx</Text>
        <Text style={styles.price}>{formatSom(auction.currentPrice)}</Text>
        <View style={styles.bottomRow}>
          <AuctionCountdown endsAt={auction.endsAt} />
        </View>
      </PremiumCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { width: 220, marginRight: space.md },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  code: { ...typeTokens.mono, color: color.textPrimary },
  priceLabel: { ...typeTokens.caption, color: color.textSecondary, marginTop: space.sm },
  price: { ...typeTokens.h2, color: color.gold, marginTop: 2 },
  bottomRow: { marginTop: space.sm },
});
