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

/**
 * The surface every screen is built from. Depth is a gradient fill + a hairline
 * border + a real shadow, not a flat grey rectangle — this is what separates
 * "premium mobile product" from "web admin panel shrunk to a phone".
 *
 * `featured` adds a faint gold breath in the top-left corner and a gold-tinted
 * border; it is meant for the one card that matters most on a screen (an owned
 * NFC ID, a live auction), never for every row in a list.
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
        <PremiumLoadingSkeleton height={96} />
      </View>
    );
  }

  const delay = Math.min(index, motion.maxStaggeredItems) * motion.cardEntranceStaggerMs;
  const body = (
    <>
      {resolved === 'featured' && (
        <LinearGradient
          colors={gradient.cardFeatured}
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
  default: {
    borderColor: color.border,
    ...elevation.card,
  },
  featured: {
    borderColor: color.borderGold,
    backgroundColor: '#141414',
    ...elevation.raised,
  },
  sunken: {
    borderColor: color.border,
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
