import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { color, depth, font, medallion, radius, space } from '../tokens';
import { GoldSheen } from './GoldSheen';
import type { TierKey } from '../../lib/codeTiers';
import { TIER_LABEL } from '../../lib/pricing';

export interface PremiumBadgeProps {
  label: string;
  tone?: TierKey | 'live' | 'success' | 'warning' | 'neutral';
  pulse?: boolean;
  /**
   * Hero placement (a detail header, an owned card): enables the looping
   * light sweep on gold-family tiers. Off by default so a results list of
   * twenty medallions stays completely static.
   */
  prominent?: boolean;
  /** Stagger slot for the sweep when several prominent badges share a view. */
  index?: number;
}

const TIER_TONES: readonly TierKey[] = ['exclusive', 'premium', 'gold', 'silver', 'free'];
const GOLD_FAMILY: readonly TierKey[] = ['exclusive', 'premium', 'gold'];

function isTierTone(tone: PremiumBadgeProps['tone']): tone is TierKey {
  return TIER_TONES.includes(tone as TierKey);
}

/** Dark lettering stamped into the metal — legible on copper, chrome and gold. */
const MEDAL_TEXT: Record<TierKey, string> = {
  exclusive: color.textOnGold,
  premium: color.textOnGold,
  gold: color.textOnGold,
  silver: '#14171a',
  free: '#1a0d04',
};

/** The bright machined rim of each medallion. */
const MEDAL_RIM: Record<TierKey, string> = {
  exclusive: 'rgba(255,244,214,0.62)',
  premium: 'rgba(255,244,214,0.55)',
  gold: 'rgba(255,248,225,0.72)',
  silver: 'rgba(255,255,255,0.60)',
  free: 'rgba(255,214,180,0.45)',
};

/** Specular corner shared by every medallion — the light source is top-left. */
const MEDAL_SPECULAR = ['rgba(255,255,255,0.26)', 'rgba(255,255,255,0.04)', 'transparent'] as const;
/** Extra light on the `gold` tone so ASOSIY is the brightest thing in a row. */
const CROWN_BOOST = ['rgba(255,255,255,0.18)', 'transparent'] as const;

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
 * A small embossed medallion.
 *
 * Tier badges are struck from `medallion[tier]` — copper for bronze, chrome
 * for silver, gold for gold/premium/exclusive — with `depth.emboss` pressing
 * the lettering into the metal. Everything is static gradients: a list can
 * hold twenty of these and still scroll at full frame rate. The looping
 * sheen exists only behind `prominent`, and only on the gold family.
 *
 * `gold` is the brightest tone (a crown, an extra lick of light) because it
 * is what marks the ASOSIY — primary — ID.
 *
 * Status badges (live / success / warning / neutral) stay a quiet dark chip
 * with a coloured hairline; `success` and `live` glow softly in their colour.
 */
export function PremiumBadge({ label, tone = 'neutral', pulse = false, prominent = false, index = 0 }: PremiumBadgeProps) {
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (!pulse) return;
    opacity.value = withRepeat(withTiming(0.55, { duration: 900, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [pulse, opacity]);

  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse ? opacity.value : 1 }));

  if (isTierTone(tone)) {
    const fill = medallion[tone];
    const textColor = MEDAL_TEXT[tone];
    const crowned = tone === 'gold';
    const sheen = prominent && GOLD_FAMILY.includes(tone);
    return (
      <Animated.View
        style={[
          styles.medal,
          { backgroundColor: fill[1], borderColor: MEDAL_RIM[tone] },
          crowned && styles.medalCrowned,
          pulseStyle,
        ]}
      >
        <LinearGradient
          colors={fill}
          locations={[0, 0.58, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.35, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <LinearGradient
          colors={MEDAL_SPECULAR}
          locations={[0, 0.45, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        {crowned ? (
          <LinearGradient
            colors={CROWN_BOOST}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
        ) : null}
        {sheen ? <GoldSheen loop index={index} band={0.5} intensity={0.7} /> : null}
        {/* The inner shadows must sit above the gradients to read as pressed metal. */}
        <View style={styles.emboss} pointerEvents="none" />
        <View style={styles.medalRow}>
          {crowned ? <MaterialCommunityIcons name="crown" size={10} color={textColor} /> : null}
          <Text style={[styles.medalText, { color: textColor }]} numberOfLines={1}>
            {label}
          </Text>
        </View>
      </Animated.View>
    );
  }

  const tint = STATUS_TINT[tone] ?? color.textSecondary;

  return (
    <Animated.View
      style={[
        styles.chip,
        { borderColor: withAlpha(tint, 0.45), backgroundColor: withAlpha(tint, 0.1) },
        tone === 'success' && styles.chipSuccess,
        tone === 'live' && styles.chipLive,
        pulseStyle,
      ]}
    >
      <Text style={[styles.chipText, { color: tint }]} numberOfLines={1}>
        {label}
      </Text>
    </Animated.View>
  );
}

/** Convenience variant that renders straight from an NFC ID tier key. */
export function TierBadge({ tier, prominent, index }: { tier: TierKey; prominent?: boolean; index?: number }) {
  return <PremiumBadge label={TIER_LABEL[tier].toUpperCase()} tone={tier} prominent={prominent} index={index} />;
}

const styles = StyleSheet.create({
  medal: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    borderWidth: 1,
    overflow: 'hidden',
    paddingHorizontal: space.sm + 3,
    paddingVertical: 4,
    ...depth.emboss,
  },
  medalCrowned: {
    boxShadow: `${depth.emboss.boxShadow}, 0 0 14px rgba(240,207,122,0.42)`,
  },
  emboss: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: radius.pill, ...depth.emboss },
  medalRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  medalText: {
    fontFamily: font.sansBold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.8,
    textShadowColor: 'rgba(255,255,255,0.22)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 0,
  },
  chip: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: space.sm + 2,
    paddingVertical: 3,
  },
  chipSuccess: { boxShadow: '0 0 12px rgba(74,222,128,0.30)' },
  chipLive: { boxShadow: '0 0 12px rgba(255,77,77,0.30)' },
  chipText: { fontFamily: font.sansBold, fontSize: 11, lineHeight: 14, letterSpacing: 0.8 },
});
