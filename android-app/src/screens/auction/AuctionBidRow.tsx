import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MetaChip } from './AuctionUi';
import { formatDateTime, formatSom, safeText, timeAgo } from '../../lib/format';
import type { Bid } from '../../api/types';
import { color, radius, space, type as typeTokens, font } from '../../design-system/tokens';

export interface AuctionBidRowProps {
  bid: Bid;
  /** Leading bid (highest amount) — gets the gold rank marker. */
  isTop?: boolean;
  /** Placed by the logged-in user. */
  isMine?: boolean;
  rank: number;
}

/**
 * One line of bid history. `bidderCode` is the only bidder identity the API
 * exposes (`GET /api/auctions/:id`), and it is nullable — an anonymous bid
 * renders as "Anonim", never as `null`.
 */
export function AuctionBidRow({ bid, isTop = false, isMine = false, rank }: AuctionBidRowProps) {
  const bidder = bid.bidderCode ? `#${safeText(bid.bidderCode)}` : 'Anonim';
  const relative = timeAgo(bid.createdAt);

  return (
    <View style={[styles.row, isTop && styles.rowTop, isMine && !isTop && styles.rowMine]}>
      <View style={[styles.rank, isTop && styles.rankTop]}>
        <Text style={[styles.rankText, isTop && styles.rankTextTop]}>{rank}</Text>
      </View>

      <View style={styles.body}>
        <View style={styles.identityRow}>
          <Text style={styles.bidder} numberOfLines={1}>
            {bidder}
          </Text>
          {isMine && <MetaChip label="Siz" tone="gold" />}
        </View>
        <Text style={styles.time} numberOfLines={1}>
          {formatDateTime(bid.createdAt)}
          {relative ? ` · ${relative}` : ''}
        </Text>
      </View>

      <Text style={[styles.amount, isTop && styles.amountTop]} numberOfLines={1}>
        {formatSom(bid.amount)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: color.surfaceSunken,
  },
  rowTop: { borderColor: color.borderGold, backgroundColor: color.goldWash },
  rowMine: { borderColor: color.borderStrong },
  rank: {
    width: 26,
    height: 26,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.surfaceHigh,
  },
  rankTop: { backgroundColor: color.goldMuted },
  rankText: { ...typeTokens.caption, color: color.textTertiary, fontFamily: font.sansBold },
  rankTextTop: { color: color.gold },
  body: { flex: 1, gap: 2 },
  identityRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  bidder: { ...typeTokens.mono, color: color.textPrimary, flexShrink: 1 },
  time: { ...typeTokens.caption, color: color.textTertiary },
  amount: { ...typeTokens.bodyStrong, color: color.textSecondary },
  amountTop: { ...typeTokens.bodyStrong, color: color.gold },
});
