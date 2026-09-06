import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { color, gradient, radius, space, type as typeTokens } from '../tokens';
import { PremiumLoadingSkeleton } from './PremiumLoadingSkeleton';

export interface PremiumStatCardProps {
  label: string;
  value: number;
  formatValue?: (n: number) => string;
  trend?: number; // e.g. +12 means "+12%"
  loading?: boolean;
}

const COUNT_UP_MS = 600;
const TOP_LIP = ['rgba(255,255,255,0.10)', 'transparent'] as const;

/**
 * Compact stat tile: one number, one label, at most one trend chip. The
 * restraint is the point — a tile that tries to say three things says none.
 *
 * The value counts up once on mount/change with a plain rAF tick rather than
 * a Reanimated worklet-backed native text prop: it is a one-shot, low-
 * frequency update, so the simpler approach avoids reanimated's more fragile
 * native-text-prop pattern. Non-finite input is clamped to 0 so `NaN` can
 * never reach the UI.
 */
export function PremiumStatCard({ label, value, formatValue, trend, loading = false }: PremiumStatCardProps) {
  const safeValue = Number.isFinite(value) ? value : 0;
  const [display, setDisplay] = useState(0);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    const start = performance.now();
    const from = display;
    const to = safeValue;
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
  }, [safeValue]);

  if (loading) {
    return (
      <View style={[styles.card, styles.loadingCard]}>
        <PremiumLoadingSkeleton height={24} width={68} />
        <PremiumLoadingSkeleton height={10} width={84} />
      </View>
    );
  }

  const hasTrend = trend != null && Number.isFinite(trend);
  const up = hasTrend && (trend as number) >= 0;

  return (
    <View style={styles.card}>
      <LinearGradient
        colors={gradient.cardSurface}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.7, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <LinearGradient colors={TOP_LIP} style={styles.lip} pointerEvents="none" />
      <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {formatValue ? formatValue(display) : String(display)}
      </Text>
      <Text style={styles.label} numberOfLines={2}>
        {label}
      </Text>
      {hasTrend && (
        <View style={[styles.trendChip, up ? styles.trendChipUp : styles.trendChipDown]}>
          <Feather
            name={up ? 'trending-up' : 'trending-down'}
            size={11}
            color={up ? color.success : color.danger}
          />
          <Text style={[styles.trend, up ? styles.trendUp : styles.trendDown]}>
            {up ? '+' : ''}
            {trend}%
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.md,
    padding: space.md,
    minWidth: 96,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: '#151413',
    overflow: 'hidden',
  },
  loadingCard: { gap: space.sm },
  lip: { position: 'absolute', top: 0, left: 0, right: 0, height: 2 },
  value: { ...typeTokens.display, fontSize: 22, lineHeight: 28, color: color.textPrimary },
  label: { ...typeTokens.overline, color: color.textTertiary, marginTop: 3, textTransform: 'uppercase' },
  trendChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 3,
    marginTop: space.sm,
    paddingHorizontal: space.xs + 2,
    paddingVertical: 2,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  trendChipUp: { borderColor: 'rgba(63,191,127,0.35)', backgroundColor: 'rgba(63,191,127,0.10)' },
  trendChipDown: { borderColor: 'rgba(229,72,77,0.35)', backgroundColor: 'rgba(229,72,77,0.10)' },
  trend: { ...typeTokens.caption, fontWeight: '700' },
  trendUp: { color: color.success },
  trendDown: { color: color.danger },
});
