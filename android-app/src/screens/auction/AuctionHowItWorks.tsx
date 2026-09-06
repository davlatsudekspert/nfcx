import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumCard } from '../../design-system/components/PremiumCard';
import { formatCount } from '../../lib/format';
import { color, radius, space, type as typeTokens } from '../../design-system/tokens';

export interface AuctionHowItWorksProps {
  /** Vote threshold from `GET /api/auction-demand`. When it hasn't loaded (or
   * the backend omits it) the copy stays deliberately non-numeric instead of
   * printing an invented number. */
  threshold?: number | null;
  /** Payments are known to be off — the last step says so plainly. */
  paymentsOff?: boolean;
}

/**
 * The explainer that carries the auction tabs when there is little or no
 * data. Every sentence describes a rule the backend actually implements
 * (demand voting → threshold → live auction → winner pays before a deadline);
 * nothing here is filler or a fake listing.
 */
export function AuctionHowItWorks({ threshold, paymentsOff = false }: AuctionHowItWorksProps) {
  const thresholdText =
    typeof threshold === 'number' && Number.isFinite(threshold) && threshold > 0
      ? `Ovozlar soni ${formatCount(threshold)} taga yetganda ID auksionga chiqadi.`
      : 'Ovozlar belgilangan chegaraga yetganda ID auksionga chiqadi.';

  const steps: { title: string; text: string }[] = [
    { title: 'Talab yig‘iladi', text: `Foydalanuvchilar o'zi xohlagan ID uchun ovoz beradi. ${thresholdText}` },
    {
      title: 'Jonli savdo',
      text: "Har bir yangi taklif joriy narxdan kamida minimal qadamga yuqori bo'ladi. Taymer tugagach eng yuqori taklif g'olib bo'ladi.",
    },
    {
      title: "To'lov",
      text: paymentsOff
        ? "G'olib belgilangan muddatda to'laydi va ID unga o'tadi. Hozircha to'lovlar yopiq, shuning uchun taklif berish vaqtincha ishlamaydi."
        : "G'olib belgilangan muddat ichida to'laydi va ID uning hisobiga o'tadi.",
    },
  ];

  return (
    <PremiumCard variant="sunken" animate={false} style={styles.card}>
      <Text style={styles.title}>Auksion qanday ishlaydi</Text>
      <View style={styles.steps}>
        {steps.map((step, i) => (
          <View key={step.title} style={styles.step}>
            <View style={styles.bullet}>
              <Text style={styles.bulletText}>{i + 1}</Text>
            </View>
            <View style={styles.stepBody}>
              <Text style={styles.stepTitle}>{step.title}</Text>
              <Text style={styles.stepText}>{step.text}</Text>
            </View>
          </View>
        ))}
      </View>
    </PremiumCard>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: space.lg },
  title: { ...typeTokens.h3, color: color.textPrimary },
  steps: { marginTop: space.md, gap: space.md },
  step: { flexDirection: 'row', gap: space.md },
  bullet: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.borderGold,
    backgroundColor: color.goldMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bulletText: { ...typeTokens.caption, color: color.gold, fontWeight: '700' },
  stepBody: { flex: 1, gap: 2 },
  stepTitle: { ...typeTokens.bodyStrong, color: color.textPrimary },
  stepText: { ...typeTokens.caption, color: color.textSecondary, lineHeight: 18 },
});
