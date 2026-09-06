import React, { forwardRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type BottomSheet from '@gorhom/bottom-sheet';
import { PremiumSheet } from '../../design-system/components/PremiumSheet';
import { PremiumInput } from '../../design-system/components/PremiumInput';
import { PremiumButton } from '../../design-system/components/PremiumButton';
import { InfoBanner, MetricTile, PaymentsClosedNotice } from './AuctionUi';
import { auctionCurrentPrice, auctionMinIncrement, sanitizeAmountInput } from './auctionModel';
import { formatSom } from '../../lib/format';
import type { Auction } from '../../api/types';
import { color, radius, space, type as typeTokens } from '../../design-system/tokens';

export interface AuctionBidSheetProps {
  auction: Auction | null;
  /** `currentPrice + minIncrement`, or null when the current price is unknown. */
  minBid: number | null;
  amount: string;
  onChangeAmount: (value: string) => void;
  onSubmit: () => void;
  submitting?: boolean;
  /** Validation or server error, already mapped to Uzbek copy. */
  errorMessage?: string | null;
  /** The backend answered `503 payments_disabled` (or the global flag is off):
   * the CTA is replaced by an honest notice instead of a retry loop. */
  paymentsClosed?: boolean;
  /** The bid attempt came back 401 — offer a real way out. */
  sessionExpired?: boolean;
  onSignIn?: () => void;
  onDismiss?: () => void;
}

/**
 * The bid sheet. Amount validation happens locally against
 * `currentPrice + minIncrement` before anything is sent, and the server's
 * answer — including the honest `payments_disabled` state — is rendered
 * inline here, never as a toast storm.
 */
export const AuctionBidSheet = forwardRef<BottomSheet, AuctionBidSheetProps>(function AuctionBidSheet(
  {
    auction,
    minBid,
    amount,
    onChangeAmount,
    onSubmit,
    submitting = false,
    errorMessage,
    paymentsClosed = false,
    sessionExpired = false,
    onSignIn,
    onDismiss,
  },
  ref,
) {
  const increment = auctionMinIncrement(auction);
  const currentPrice = auctionCurrentPrice(auction);
  const digits = sanitizeAmountInput(amount);
  const parsed = digits ? Number(digits) : null;

  const quickSteps = minBid == null ? [] : [0, 1, 4].map((n) => minBid + n * increment);

  return (
    <PremiumSheet ref={ref} title="Taklif berish" snapPoints={['62%', '88%']} onDismiss={onDismiss}>
      <View style={styles.metrics}>
        <MetricTile label="Joriy narx" value={formatSom(currentPrice)} />
        <MetricTile label="Minimal taklif" value={formatSom(minBid)} tone="gold" />
      </View>

      {quickSteps.length > 0 && (
        <View style={styles.quickRow}>
          {quickSteps.map((value, i) => (
            <Pressable
              key={value}
              onPress={() => onChangeAmount(String(value))}
              accessibilityRole="button"
              accessibilityLabel={`${formatSom(value)} taklif qilish`}
              style={({ pressed }) => [styles.quickChip, parsed === value && styles.quickChipActive, pressed && styles.quickChipPressed]}
            >
              <Text style={[styles.quickLabel, parsed === value && styles.quickLabelActive]} numberOfLines={1}>
                {i === 0 ? 'Minimal' : `+${i === 1 ? 1 : 4} qadam`}
              </Text>
              <Text style={[styles.quickValue, parsed === value && styles.quickLabelActive]} numberOfLines={1}>
                {formatSom(value)}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      <PremiumInput
        label="Taklif summasi"
        value={amount}
        onChangeText={(text) => onChangeAmount(sanitizeAmountInput(text))}
        keyboardType="number-pad"
        placeholder={minBid != null ? String(minBid) : '0'}
        error={errorMessage}
        editable={!paymentsClosed && !submitting}
      />

      {parsed != null && !errorMessage && (
        <Text style={styles.preview} numberOfLines={1}>
          {formatSom(parsed)}
        </Text>
      )}

      {sessionExpired && (
        <InfoBanner
          icon="log-in"
          tone="danger"
          title="Sessiya tugadi"
          description="Taklif berish uchun qaytadan kiring."
        >
          {!!onSignIn && <PremiumButton label="Kirish" variant="ghost" onPress={onSignIn} style={styles.bannerAction} />}
        </InfoBanner>
      )}

      {paymentsClosed ? (
        <PaymentsClosedNotice description="Taklif serverda qabul qilinmadi: to'lov tizimi yoqilgunga qadar auksionda taklif berish yopiq." />
      ) : (
        <PremiumButton
          label="Tasdiqlash"
          onPress={onSubmit}
          loading={submitting}
          disabled={minBid == null || sessionExpired}
          style={styles.submit}
        />
      )}

      <Text style={styles.footnote}>
        Taklif serverda tekshiriladi. Qabul qilinsa, joriy narx darhol yangilanadi.
      </Text>
    </PremiumSheet>
  );
});

const styles = StyleSheet.create({
  metrics: { flexDirection: 'row', gap: space.sm },
  quickRow: { flexDirection: 'row', gap: space.sm },
  quickChip: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surfaceSunken,
    paddingHorizontal: space.sm,
    paddingVertical: space.sm,
    gap: 2,
  },
  quickChipActive: { borderColor: color.borderGoldStrong, backgroundColor: color.goldWash },
  quickChipPressed: { opacity: 0.8 },
  quickLabel: { ...typeTokens.overline, color: color.textTertiary },
  quickLabelActive: { color: color.gold },
  quickValue: { ...typeTokens.caption, color: color.textPrimary, fontWeight: '700' },
  preview: { ...typeTokens.bodyStrong, color: color.gold, marginTop: -space.sm },
  bannerAction: { marginTop: space.sm },
  submit: { marginTop: space.xs },
  footnote: { ...typeTokens.caption, color: color.textTertiary, lineHeight: 17 },
});
