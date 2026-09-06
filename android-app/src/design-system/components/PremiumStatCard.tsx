import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { color, depth, font, gradient, radius, space, type as typeTokens } from '../tokens';
import { PremiumLoadingSkeleton } from './PremiumLoadingSkeleton';

export type PremiumStatTone = 'gold' | 'success' | 'warning' | 'danger' | 'info';

export interface PremiumStatCardProps {
  label: string;
  value: number;
  formatValue?: (n: number) => string;
  trend?: number; // e.g. +12 means "+12%"
  loading?: boolean;
  /** Optional Feather glyph shown in a small glowing disc above the number. */
  icon?: React.ComponentProps<typeof Feather>['name'];
  /** Meaning-coloured glow for the icon disc and the top hairline. Default gold. */
  tone?: PremiumStatTone;
}

const COUNT_UP_MS = 600;

const TONE_COLOR: Record<PremiumStatTone, string> = {
  gold: color.gold,
  success: color.success,
  warning: color.warning,
  danger: color.danger,
  info: color.info,
};

/** The glass film: a translucent warm surface floating over the card gradient. */
const GLASS = ['rgba(255,248,230,0.07)', 'rgba(255,248,230,0.02)'] as const;

/** `#RRGGBB` -> `rgba(...)`; non-hex input is returned untouched so a style can
 * never contain `NaN`. */
function withAlpha(hex: string, alpha: number): string {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/**
 * Glass-morphic stat tile: one number, one label, at most one trend chip.
 * A translucent warm surface on the card gradient, a hairline, and a soft
 * glow whose colour carries the meaning (`tone`). The number is `type.stat`
 * — tabular digits, ticker spacing — so a row of tiles lines up.
 *
 * The value counts up once on mount/change with a plain rAF tick rather than
 * a Reanimated worklet-backed native text prop: it is a one-shot, low-
 * frequency update. Non-finite input is clamped to 0 so `NaN` can never
 * reach the UI.
 */
export function PremiumStatCard({
  label,
  value,
  formatValue,
  trend,
  loading = false,
  icon,
  tone = 'gold',
}: PremiumStatCardProps) {
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

  const tint = TONE_COLOR[tone] ?? color.gold;

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
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <LinearGradient
        colors={GLASS}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.4, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <LinearGradient
        colors={[withAlpha(tint, 0.14), 'transparent'] as const}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.7, y: 0.8 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <LinearGradient
        colors={[withAlpha(tint, 0.55), withAlpha(tint, 0.06)] as const}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.lip}
        pointerEvents="none"
      />
      {icon ? (
        <View
          style={[
            styles.iconDisc,
            { borderColor: withAlpha(tint, 0.4), boxShadow: `0 0 16px ${withAlpha(tint, 0.45)}` },
          ]}
        >
          <Feather name={icon} size={14} color={tint} />
        </View>
      ) : null}
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
    borderColor: 'rgba(255,244,214,0.12)',
    backgroundColor: color.surface,
    overflow: 'hidden',
    ...depth.chip,
  },
  loadingCard: { gap: space.sm },
  lip: { position: 'absolute', top: 0, left: 0, right: 0, height: 1.5 },
  iconDisc: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    backgroundColor: 'rgba(255,248,230,0.05)',
    marginBottom: space.sm,
  },
  value: { ...typeTokens.stat, color: color.textPrimary },
  label: { ...typeTokens.overline, color: color.textSecondary, marginTop: 4, textTransform: 'uppercase' },
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
  trendChipUp: { borderColor: 'rgba(74,222,128,0.35)', backgroundColor: 'rgba(74,222,128,0.10)' },
  trendChipDown: { borderColor: 'rgba(229,72,77,0.35)', backgroundColor: 'rgba(229,72,77,0.10)' },
  trend: { fontFamily: font.sansBold, fontSize: 11, lineHeight: 14, fontVariant: ['tabular-nums'] },
  trendUp: { color: color.success },
  trendDown: { color: color.danger },
});
