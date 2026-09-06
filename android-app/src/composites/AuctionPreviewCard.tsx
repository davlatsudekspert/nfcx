import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { PremiumCard } from '../design-system/components/PremiumCard';
import { PremiumBadge, TierBadge } from '../design-system/components/PremiumBadge';
import { AuctionCountdown } from './AuctionCountdown';
import { auctionCurrentPrice, auctionStatusLabel, isAuctionLive } from '../screens/auction/auctionModel';
import { formatDateTime, formatSom } from '../lib/format';
import { tierForCode } from '../lib/pricing';
import { haptics } from '../native/haptics';
import type { Auction } from '../api/types';
import { color, space, type as typeTokens } from '../design-system/tokens';

export interface AuctionPreviewCardProps {
  auction: Auction;
  onPress: () => void;
  index?: number;
}

/** Compact carousel card (Home dashboard). Same facts as the full list row,
 * minus the meta chips — one glance: which ID, what tier, how much, how long. */
export function AuctionPreviewCard({ auction, onPress, index }: AuctionPreviewCardProps) {
  const live = isAuctionLive(auction);
  const status = auctionStatusLabel(auction);

  return (
    <Pressable
      onPress={() => {
        haptics.selection();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={`${auction.code} auksioni`}
      style={({ pressed }) => [pressed && styles.pressed]}
    >
      <PremiumCard index={index} variant={live ? 'featured' : 'default'} style={styles.card}>
        <View style={styles.topRow}>
          <Text style={styles.code} numberOfLines={1}>
            #{auction.code}
          </Text>
          <PremiumBadge label={status.label} tone={status.tone} pulse={status.tone === 'live'} />
        </View>

        <View style={styles.tierRow}>
          <TierBadge tier={tierForCode(auction.code)} />
        </View>

        <Text style={styles.overline}>{live ? 'JORIY NARX' : 'YAKUNIY NARX'}</Text>
        <Text style={styles.price} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
          {formatSom(auctionCurrentPrice(auction))}
        </Text>

        <View style={styles.footer}>
          <Feather name="clock" size={12} color={live ? color.gold : color.textTertiary} />
          {live ? (
            <AuctionCountdown endsAt={auction.endsAt} style={styles.countdown} />
          ) : (
            <Text style={styles.endedAt} numberOfLines={1}>
              {formatDateTime(auction.endsAt)}
            </Text>
          )}
        </View>
      </PremiumCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { width: 232, marginRight: space.md },
  pressed: { opacity: 0.85 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  code: { ...typeTokens.mono, color: color.textPrimary, fontSize: 16, flexShrink: 1 },
  tierRow: { flexDirection: 'row', marginTop: space.sm },
  overline: { ...typeTokens.overline, color: color.textTertiary, marginTop: space.md },
  price: { ...typeTokens.h2, color: color.gold, marginTop: 2 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: space.xs, marginTop: space.md },
  countdown: { fontSize: 14 },
  endedAt: { ...typeTokens.caption, color: color.textSecondary },
});
