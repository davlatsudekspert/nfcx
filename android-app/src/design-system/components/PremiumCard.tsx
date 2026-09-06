import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { color, elevation, gradient, motion, radius, space } from '../tokens';
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
const TOP_LIP = ['rgba(255,255,255,0.11)', 'rgba(255,255,255,0.02)', 'transparent'] as const;
const TOP_LIP_GOLD = ['rgba(255,238,196,0.28)', 'rgba(255,238,196,0.05)', 'transparent'] as const;
/** A sunken well is lit from nowhere: the shade sits at the top, inverted. */
const SUNKEN_SHADE = ['rgba(0,0,0,0.45)', 'transparent'] as const;

/**
 * The surface every screen is built from. Depth is a warm near-black gradient
 * fill + one hairline edge + a soft top lip + a real shadow — never a flat
 * grey rectangle, which is what makes a dark UI read as a web admin panel
 * shrunk onto a phone.
 *
 * `featured` swaps the hairline for gold and adds a faint gold breath in the
 * top-left corner; it is meant for the one card that matters most on a screen
 * (an owned NFC ID, a live auction), never for every row in a list.
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
          end={{ x: 0.6, y: 1 }}
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
  const body = (
    <>
      {resolved === 'featured' && (
        <LinearGradient
          colors={gradient.cardFeatured}
          locations={[0, 0.45, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      )}
      {resolved === 'default' && (
        <LinearGradient
          colors={gradient.cardSurface}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.6, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      )}
      {resolved === 'sunken' && (
        <LinearGradient colors={SUNKEN_SHADE} style={styles.sunkenShade} pointerEvents="none" />
      )}
      {(resolved === 'default' || resolved === 'featured') && (
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
  sunkenShade: { position: 'absolute', top: 0, left: 0, right: 0, height: 10 },
  default: {
    borderColor: color.border,
    backgroundColor: '#151413',
    ...elevation.card,
  },
  featured: {
    borderColor: color.borderGold,
    backgroundColor: '#141414',
    ...elevation.raised,
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
