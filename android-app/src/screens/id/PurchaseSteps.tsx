import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { color, radius, space, type as typeTokens, font } from '../../design-system/tokens';

export interface PurchaseStepsProps {
  /** 1-based. */
  current: 1 | 2 | 3;
}

const LABELS = ['Ma’lumot', 'Tasdiqlash', "To'lov"];

/**
 * The three-step purchase progress bar, shared by every step so the user
 * always knows where they are and how much is left — one component, so the
 * steps can never drift out of sync between screens.
 */
export function PurchaseSteps({ current }: PurchaseStepsProps) {
  return (
    <View style={styles.wrapper} accessibilityRole="progressbar" accessibilityLabel={`${current} / 3 qadam`}>
      {LABELS.map((label, i) => {
        const step = i + 1;
        const done = step < current;
        const active = step === current;
        return (
          <View key={label} style={styles.step}>
            <View style={[styles.bar, (done || active) && styles.barActive]} />
            <Text style={[styles.label, active && styles.labelActive, done && styles.labelDone]} numberOfLines={1}>
              {step}. {label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flexDirection: 'row', gap: space.sm, marginBottom: space.lg },
  step: { flex: 1, gap: space.xs },
  bar: { height: 3, borderRadius: radius.pill, backgroundColor: color.surfaceHigh },
  barActive: { backgroundColor: color.gold },
  label: { ...typeTokens.caption, color: color.textTertiary },
  labelActive: { color: color.gold, fontFamily: font.sansBold },
  labelDone: { color: color.textSecondary },
});
