import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { color, motion, radius, space } from '../tokens';
import { PremiumLoadingSkeleton } from './PremiumLoadingSkeleton';

export interface PremiumCardProps {
  children?: React.ReactNode;
  featured?: boolean;
  loading?: boolean;
  /** Position in a list — drives the staggered entrance animation, capped
   * per android/docs/05-DESIGN_SYSTEM.md §5.3 so a long list doesn't feel slow. */
  index?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function PremiumCard({ children, featured = false, loading = false, index = 0, style, testID }: PremiumCardProps) {
  if (loading) {
    return (
      <View style={[styles.base, style]} testID={testID}>
        <PremiumLoadingSkeleton height={96} />
      </View>
    );
  }

  const delay = Math.min(index, motion.maxStaggeredItems) * motion.cardEntranceStaggerMs;

  return (
    <Animated.View
      entering={FadeInUp.delay(delay).duration(260)}
      style={[styles.base, featured && styles.featured, style]}
      testID={testID}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
    padding: space.lg,
  },
  featured: {
    borderColor: color.borderGold,
  },
});
