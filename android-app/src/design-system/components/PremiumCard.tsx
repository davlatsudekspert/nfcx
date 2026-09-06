import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { color, depth, gradient, motion, radius, space } from '../tokens';
import { GoldSheen } from './GoldSheen';
import { PremiumLoadingSkeleton } from './PremiumLoadingSkeleton';

export type PremiumCardVariant = 'default' | 'featured' | 'sunken' | 'plain';

export interface PremiumCardProps {
  children?: React.ReactNode;
  /** Legacy alias kept so existing call sites keep working: `featured` === variant="featured". */
  featured?: boolean;
  variant?: PremiumCardVariant;
  loading?: boolean;
  /** Position in a list — drives the staggered entrance animation, capped
   * per android/docs/05-DESIGN_SYSTEM.md §5.3 so a long list doesn't feel slow. */
  index?: number;
  /** Disables the entrance animation (for cards inside an already-animated parent). */
  animate?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
}

/** The lip of light along a card's top edge — the single cue that tells the
 * eye a surface is raised off the floor rather than painted on it. */
const TOP_LIP = ['rgba(255,255,255,0.10)', 'rgba(255,255,255,0.02)', 'transparent'] as const;
const TOP_LIP_GOLD = ['rgba(255,238,196,0.30)', 'rgba(255,238,196,0.06)', 'transparent'] as const;
/** A featured card's faint gold breath — top-left corner only, so gold stays
 * an accent and the card itself stays near-black. */
const BREATH = ['rgba(240,207,122,0.16)', 'rgba(212,175,90,0.04)', 'transparent'] as const;

/**
 * The surface every screen is built from: the `gradient.cardSurface` fill
 * (never flat), one 1px `color.border` line, a soft top lip, and `depth.card`
 * so it physically rests above the floor.
 *
 * `featured` adds a gold hairline, a faint gold breath, one entrance light
 * sweep and `depth.cardHero`; it is meant for the one card that matters most
 * on a screen (an owned NFC ID, a live auction), never for every row.
 *
 * The shell keeps `overflow: 'hidden'` so full-bleed children still clip to
 * the corners; on Android a view's own outset `boxShadow` is drawn before
 * that clip, so the shadow is not lost.
 */
export function PremiumCard({
  children,
  featured = false,
  variant,
  loading = false,
  index = 0,
  animate = true,
  style,
  contentStyle,
  testID,
}: PremiumCardProps) {
  const resolved: PremiumCardVariant = variant ?? (featured ? 'featured' : 'default');

  if (loading) {
    return (
      <View style={[styles.base, styles.default, style]} testID={testID}>
        <LinearGradient
          colors={gradient.cardSurface}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <LinearGradient colors={TOP_LIP} style={styles.lip} pointerEvents="none" />
        <View style={[styles.content, styles.loadingContent, contentStyle]}>
          <PremiumLoadingSkeleton height={14} width="52%" />
          <PremiumLoadingSkeleton height={10} width="78%" />
          <PremiumLoadingSkeleton height={10} width="34%" />
        </View>
      </View>
    );
  }

  const delay = Math.min(index, motion.maxStaggeredItems) * motion.cardEntranceStaggerMs;
  const raised = resolved === 'default' || resolved === 'featured';
  const body = (
    <>
      {raised && (
        <LinearGradient
          colors={gradient.cardSurface}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      )}
      {resolved === 'featured' && (
        <>
          <LinearGradient
            colors={BREATH}
            locations={[0, 0.4, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.8, y: 0.9 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <GoldSheen loop={false} index={index} band={0.5} intensity={0.3} />
        </>
      )}
      {resolved === 'sunken' && <View style={styles.sunkenWell} pointerEvents="none" />}
      {raised && (
        <LinearGradient
          colors={resolved === 'featured' ? TOP_LIP_GOLD : TOP_LIP}
          style={styles.lip}
          pointerEvents="none"
        />
      )}
      <View style={[styles.content, contentStyle]}>{children}</View>
    </>
  );

  const containerStyle = [styles.base, VARIANT_STYLE[resolved], style];

  if (!animate) {
    return (
      <View style={containerStyle} testID={testID}>
        {body}
      </View>
    );
  }

  return (
    <Animated.View entering={FadeInUp.delay(delay).duration(260)} style={containerStyle} testID={testID}>
      {body}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    backgroundColor: color.surface,
  },
  content: { padding: space.lg },
  loadingContent: { gap: space.sm, justifyContent: 'center', flex: 1 },
  /** 2px, not 1px: at Android densities a single pixel of light disappears. */
  lip: { position: 'absolute', top: 0, left: 0, right: 0, height: 2 },
  /** A sunken well is lit from nowhere: the shade is an inner shadow at the top. */
  sunkenWell: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: radius.lg - 1,
    boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.55), inset 0 1px 0 rgba(0,0,0,0.35)',
  },
  default: {
    borderColor: color.border,
    backgroundColor: color.surface,
    ...depth.card,
  },
  featured: {
    borderColor: color.borderGold,
    backgroundColor: color.surface,
    ...depth.cardHero,
  },
  sunken: {
    borderColor: 'rgba(255,255,255,0.05)',
    backgroundColor: color.surfaceSunken,
  },
  plain: {
    borderColor: 'transparent',
    backgroundColor: 'transparent',
  },
});

const VARIANT_STYLE: Record<PremiumCardVariant, ViewStyle> = {
  default: styles.default,
  featured: styles.featured,
  sunken: styles.sunken,
  plain: styles.plain,
};
