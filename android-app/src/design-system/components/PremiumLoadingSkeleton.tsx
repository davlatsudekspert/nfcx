import React, { useEffect } from 'react';
import { AccessibilityInfo, StyleSheet, View, type DimensionValue } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { motion, radius } from '../tokens';

export interface PremiumLoadingSkeletonProps {
  height?: number;
  width?: DimensionValue;
  borderRadius?: number;
}

/** A reflection travelling across brushed metal, not a grey block blinking. */
const SWEEP = ['transparent', 'rgba(255,255,255,0.05)', 'rgba(245,215,122,0.16)', 'rgba(255,255,255,0.04)', 'transparent'] as const;

/** Placeholder bar with a gold-tinted reflection sweep — disabled under the OS
 * reduced-motion setting (brief §4/§5 accessibility + motion budget). */
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
    transform: [{ translateX: translateX.value * 220 - 110 }],
  }));

  return (
    <View
      style={[styles.base, { height, width, borderRadius }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {!reduceMotion && (
        <Animated.View style={[styles.sweep, shimmerStyle]}>
          <LinearGradient
            colors={SWEEP}
            locations={[0, 0.3, 0.5, 0.7, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: '#1A1918',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden',
  },
  sweep: { position: 'absolute', top: 0, bottom: 0, width: 110 },
});
