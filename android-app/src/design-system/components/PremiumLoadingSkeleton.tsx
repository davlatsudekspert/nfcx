import React, { useEffect } from 'react';
import { AccessibilityInfo, StyleSheet, View, type DimensionValue } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { color, motion, radius } from '../tokens';

export interface PremiumLoadingSkeletonProps {
  height?: number;
  width?: DimensionValue;
  borderRadius?: number;
}

/** Gold-tinted shimmer sweep, looping — disabled under the OS reduced-motion
 * setting (brief §4/§5 accessibility + motion budget). */
export function PremiumLoadingSkeleton({ height = 16, width = '100%', borderRadius = radius.sm }: PremiumLoadingSkeletonProps) {
  const translateX = useSharedValue(-1);
  const [reduceMotion, setReduceMotion] = React.useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled?.().then(setReduceMotion).catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', setReduceMotion);
    return () => sub?.remove?.();
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      cancelAnimation(translateX);
      return;
    }
    translateX.value = withRepeat(
      withTiming(1, { duration: motion.shimmerDurationMs, easing: Easing.linear }),
      -1,
      false,
    );
    return () => cancelAnimation(translateX);
  }, [reduceMotion, translateX]);

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value * 200 - 100 }],
  }));

  return (
    <View style={[styles.base, { height, width, borderRadius }]}>
      {!reduceMotion && <Animated.View style={[styles.sweep, shimmerStyle]} />}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: color.surfaceRaised,
    overflow: 'hidden',
  },
  sweep: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 80,
    backgroundColor: 'rgba(245,215,122,0.10)',
  },
});
