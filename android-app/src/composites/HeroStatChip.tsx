import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { color, depth, gradient, radius, space, type as typeTokens } from '../design-system/tokens';

/** What the number *means* decides how its icon glows: attention is
 * blue-gold, waiting is amber, ownership is gold, confirmation is green. */
export type HeroStatTone = 'gold' | 'blue' | 'amber' | 'success';

const TONE: Record<HeroStatTone, { icon: string; fill: string; glow: string }> = {
  gold: { icon: color.goldHighlight, fill: 'rgba(212,175,90,0.16)', glow: '0 0 16px rgba(212,175,90,0.55)' },
  blue: { icon: '#b9cdf2', fill: 'rgba(125,160,230,0.16)', glow: '0 0 16px rgba(140,170,230,0.5)' },
  amber: { icon: color.warning, fill: 'rgba(224,179,74,0.16)', glow: '0 0 16px rgba(224,179,74,0.55)' },
  success: { icon: color.success, fill: 'rgba(74,222,128,0.14)', glow: '0 0 16px rgba(74,222,128,0.45)' },
};

export interface HeroStatChipProps {
  icon: React.ComponentProps<typeof Feather>['name'];
  value: string;
  label: string;
  tone?: HeroStatTone;
  /** Smaller value type — for text values like a date rather than a count. */
  small?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * A glass-morphic stat chip: a translucent pane over the near-black floor
 * (glass gradient + a white hairline + a lit top lip), a tabular number in
 * off-white, and the icon sitting in a small pool of coloured light.
 *
 * Everything is gradients and one static `boxShadow` — safe in a row of
 * three on every screen that shows numbers.
 */
export function HeroStatChip({ icon, value, label, tone = 'gold', small = false, style }: HeroStatChipProps) {
  const t = TONE[tone];
  return (
    <View style={[styles.shadow, style]}>
      <View style={styles.pane}>
        <LinearGradient
          colors={gradient.cardSurface}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.7, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <LinearGradient
          colors={gradient.cardGlass}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <LinearGradient colors={TOP_LIP} style={styles.lip} pointerEvents="none" />

        <View style={[styles.iconWell, { backgroundColor: t.fill, boxShadow: t.glow }]}>
          <Feather name={icon} size={13} color={t.icon} />
        </View>
        <Text style={[styles.value, small && styles.valueSmall]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
          {value}
        </Text>
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </View>
  );
}

const TOP_LIP = ['rgba(255,255,255,0.14)', 'rgba(255,255,255,0.02)', 'transparent'] as const;

const styles = StyleSheet.create({
  shadow: { flex: 1, borderRadius: radius.md, ...depth.chip },
  pane: {
    flex: 1,
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(23,18,9,0.82)',
    paddingHorizontal: space.md,
    paddingTop: space.md,
    paddingBottom: space.md - 2,
    gap: 2,
  },
  lip: { position: 'absolute', top: 0, left: 0, right: 0, height: 2 },
  iconWell: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.xs,
  },
  value: { ...typeTokens.stat, color: color.textPrimary },
  valueSmall: { ...typeTokens.mono, fontSize: 13, lineHeight: 26, letterSpacing: 0.2 },
  label: { ...typeTokens.caption, color: color.textTertiary },
});
