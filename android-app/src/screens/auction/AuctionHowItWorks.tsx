import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { PremiumCard } from '../../design-system/components/PremiumCard';
import { GoldMedallion, medallionNumeral } from './AuctionUi';
import { formatCount } from '../../lib/format';
import { color, depth, radius, space, type as typeTokens } from '../../design-system/tokens';

export interface AuctionHowItWorksProps {
  /** Vote threshold from `GET /api/auction-demand`. When it hasn't loaded (or
   * the backend omits it) the copy stays deliberately non-numeric instead of
   * printing an invented number. */
  threshold?: number | null;
  /** Payments are known to be off — the last step says so plainly. */
  paymentsOff?: boolean;
}

const MEDALLION = 30;
/** The connector fades in from the disc above and out into the disc below,
 * so it reads as light running along a rail, not a ruled line. */
const RAIL = ['rgba(212,175,90,0.05)', 'rgba(212,175,90,0.7)', 'rgba(240,207,122,0.9)', 'rgba(212,175,90,0.7)', 'rgba(212,175,90,0.05)'] as const;

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
    <PremiumCard variant="default" animate={false} style={styles.card}>
      <Text style={styles.overline}>QOIDALAR</Text>
      <Text style={styles.title}>Auksion qanday ishlaydi</Text>
      <View style={styles.steps}>
        {steps.map((step, i) => {
          const last = i === steps.length - 1;
          return (
            <View key={step.title} style={styles.step}>
              <View style={styles.rail}>
                <GoldMedallion size={MEDALLION}>
                  <Text style={styles.numeral}>{i + 1}</Text>
                </GoldMedallion>
                {!last && (
                  <View style={styles.lineWrap} pointerEvents="none">
                    <LinearGradient
                      colors={RAIL}
                      locations={[0, 0.2, 0.5, 0.8, 1]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 0, y: 1 }}
                      style={styles.line}
                    />
                  </View>
                )}
              </View>
              <View style={[styles.stepBody, !last && styles.stepBodySpaced]}>
                <Text style={styles.stepTitle}>{step.title}</Text>
                <Text style={styles.stepText}>{step.text}</Text>
              </View>
            </View>
          );
        })}
      </View>
    </PremiumCard>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: space.lg, ...depth.card },
  overline: { ...typeTokens.overline, color: color.gold },
  title: { ...typeTokens.h2, color: color.textPrimary, marginTop: space.xs },
  steps: { marginTop: space.lg },
  step: { flexDirection: 'row', gap: space.md, alignItems: 'stretch' },
  rail: { width: MEDALLION, alignItems: 'center' },
  numeral: { ...medallionNumeral },
  lineWrap: {
    flex: 1,
    width: 2,
    marginVertical: 3,
    borderRadius: radius.pill,
    boxShadow: '0 0 8px rgba(212,175,90,0.55)',
  },
  line: { flex: 1, borderRadius: radius.pill },
  stepBody: { flex: 1, gap: 2, paddingTop: 4 },
  stepBodySpaced: { paddingBottom: space.lg },
  stepTitle: { ...typeTokens.bodyStrong, color: color.textPrimary },
  stepText: { ...typeTokens.caption, color: color.textSecondary, lineHeight: 18 },
});
