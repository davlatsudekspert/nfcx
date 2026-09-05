import React, { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { color, radius, space, type as typeTokens } from '../tokens';
import type { TierKey } from '../../lib/codeTiers';
import { TIER_COLOR, TIER_LABEL } from '../../lib/pricing';

export interface PremiumBadgeProps {
  label: string;
  tone?: TierKey | 'live' | 'success' | 'warning' | 'neutral';
  pulse?: boolean;
}

export function PremiumBadge({ label, tone = 'neutral', pulse = false }: PremiumBadgeProps) {
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (!pulse) return;
    opacity.value = withRepeat(withTiming(0.6, { duration: 900, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [pulse, opacity]);

  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse ? opacity.value : 1 }));

  const tint = toneColor(tone);

  return (
    <Animated.View style={[styles.base, { borderColor: tint }, pulseStyle]}>
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

function toneColor(tone: PremiumBadgeProps['tone']): string {
  switch (tone) {
    case 'exclusive':
    case 'premium':
    case 'gold':
    case 'silver':
    case 'free':
      return TIER_COLOR[tone];
    case 'live':
      return color.danger;
    case 'success':
      return color.success;
    case 'warning':
      return color.warning;
    default:
      return color.textSecondary;
  }
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
  },
  text: { ...typeTokens.caption, fontWeight: '700' },
});
