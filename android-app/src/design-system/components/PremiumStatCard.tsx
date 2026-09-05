import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { color, radius, space, type as typeTokens } from '../tokens';
import { PremiumLoadingSkeleton } from './PremiumLoadingSkeleton';

export interface PremiumStatCardProps {
  label: string;
  value: number;
  formatValue?: (n: number) => string;
  trend?: number; // e.g. +12 means "+12%"
  loading?: boolean;
}

const COUNT_UP_MS = 600;

/** Compact stat tile with a simple count-up on first mount/value change. See
 * android/docs/05-DESIGN_SYSTEM.md §5.2. Uses a plain rAF-driven state tick
 * rather than a Reanimated worklet-backed native text prop — the count-up is
 * a one-shot, low-frequency UI update, not a perf-critical animation, so the
 * simpler approach avoids reanimated's more fragile native-text-prop pattern. */
export function PremiumStatCard({ label, value, formatValue, trend, loading = false }: PremiumStatCardProps) {
  const [display, setDisplay] = useState(0);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    const start = performance.now();
    const from = display;
    const to = value;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / COUNT_UP_MS);
      const eased = 1 - (1 - t) * (1 - t); // ease-out-quad
      setDisplay(Math.round(from + (to - from) * eased));
      if (t < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current != null) cancelAnimationFrame(frame.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally only re-trigger on `value`
  }, [value]);

  if (loading) {
    return (
      <View style={styles.card}>
        <PremiumLoadingSkeleton height={28} width={64} />
        <PremiumLoadingSkeleton height={12} width={80} />
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.value} numberOfLines={1}>
        {formatValue ? formatValue(display) : display}
      </Text>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
      {trend != null && (
        <Text style={[styles.trend, trend >= 0 ? styles.trendUp : styles.trendDown]}>
          {trend >= 0 ? '+' : ''}
          {trend}%
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: color.surface,
    borderRadius: radius.md,
    padding: space.md,
    minWidth: 96,
    borderWidth: 1,
    borderColor: color.border,
  },
  value: { ...typeTokens.display, fontSize: 22, color: color.textPrimary },
  label: { ...typeTokens.caption, color: color.textSecondary, marginTop: 2 },
  trend: { ...typeTokens.caption, marginTop: space.xs, fontWeight: '700' },
  trendUp: { color: color.success },
  trendDown: { color: color.danger },
});
