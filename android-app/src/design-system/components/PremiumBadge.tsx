import React, { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { color, metal, radius, space, type as typeTokens } from '../tokens';
import type { TierKey } from '../../lib/codeTiers';
import { TIER_LABEL } from '../../lib/pricing';

export interface PremiumBadgeProps {
  label: string;
  tone?: TierKey | 'live' | 'success' | 'warning' | 'neutral';
  pulse?: boolean;
}

const TIER_TONES: readonly TierKey[] = ['exclusive', 'premium', 'gold', 'silver', 'free'];

function isTierTone(tone: PremiumBadgeProps['tone']): tone is TierKey {
  return TIER_TONES.includes(tone as TierKey);
}

/** Status tints, as a dark chip rather than a saturated pill: the colour is
 * carried by a hairline and the label, never by a filled block. */
const STATUS_TINT: Record<'live' | 'success' | 'warning' | 'neutral', string> = {
  live: color.danger,
  success: color.success,
  warning: color.warning,
  neutral: color.textSecondary,
};

/** `#RRGGBB` -> `rgba(...)`. Falls back to the input when it is not a plain
 * hex colour, so a bad value can never render as `NaN` inside a style. */
function withAlpha(hex: string, alpha: number): string {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/**
 * A small machined chip.
 *
 * Tier badges are milled from the same `metal` palette as the NFC ID card
 * they describe, so an "EKSLYUZIV" chip is physically the same material as an
 * exclusive card, just smaller. They are drawn here rather than via
 * `MetalSurface` on purpose: a chip is too small for a sheen to read as
 * anything but a blink, and a search results list can hold twenty of them —
 * three static layers per chip is the version that still scrolls at 60fps.
 *
 * Status badges (live / success / warning) stay a quiet dark chip with a
 * coloured hairline, because a screen full of saturated pills is exactly the
 * casino look the brief rules out.
 */
export function PremiumBadge({ label, tone = 'neutral', pulse = false }: PremiumBadgeProps) {
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (!pulse) return;
    opacity.value = withRepeat(withTiming(0.55, { duration: 900, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [pulse, opacity]);

  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse ? opacity.value : 1 }));

  if (isTierTone(tone)) {
    const m = metal[tone];
    return (
      <Animated.View style={[styles.base, styles.metal, { borderColor: m.hairline }, pulseStyle]}>
        <LinearGradient
          colors={m.base as unknown as readonly [string, string, ...string[]]}
          locations={[0, 0.38, 0.62, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <LinearGradient
          colors={['rgba(255,255,255,0.18)', 'transparent'] as const}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.6, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <Text style={[styles.text, { color: m.text }]} numberOfLines={1}>
          {label}
        </Text>
      </Animated.View>
    );
  }

  const tint = STATUS_TINT[tone] ?? color.textSecondary;

  return (
    <Animated.View
      style={[
        styles.base,
        { borderColor: withAlpha(tint, 0.45), backgroundColor: withAlpha(tint, 0.1) },
        pulseStyle,
      ]}
    >
      <Text style={[styles.text, { color: tint }]} numberOfLines={1}>
        {label}
      </Text>
    </Animated.View>
  );
}

/** Convenience variant that renders straight from an NFC ID tier key. */
export function TierBadge({ tier }: { tier: TierKey }) {
  return <PremiumBadge label={TIER_LABEL[tier].toUpperCase()} tone={tier} />;
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: space.sm + 2,
    paddingVertical: 3,
  },
  metal: { overflow: 'hidden', backgroundColor: '#101010' },
  text: { ...typeTokens.caption, fontWeight: '700', letterSpacing: 0.6 },
});
