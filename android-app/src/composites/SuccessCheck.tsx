import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import Animated, { useAnimatedProps, useSharedValue, withDelay, withTiming, Easing } from 'react-native-reanimated';
import { color } from '../design-system/tokens';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const SIZE = 96;
const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * 42;
const CHECK_LENGTH = 60; // approximate path length of the check mark below

/**
 * Success-check animation (brief §5/§9 mockup screen 10) — a stroke-draw
 * circle followed by a stroke-draw checkmark, both via SVG
 * strokeDasharray/strokeDashoffset, not a static icon swap.
 */
export function SuccessCheck() {
  const circleProgress = useSharedValue(0);
  const checkProgress = useSharedValue(0);

  useEffect(() => {
    circleProgress.value = withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) });
    checkProgress.value = withDelay(360, withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) }));
  }, [circleProgress, checkProgress]);

  const circleAnimatedProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCLE_CIRCUMFERENCE * (1 - circleProgress.value),
  }));
  const checkAnimatedProps = useAnimatedProps(() => ({
    strokeDashoffset: CHECK_LENGTH * (1 - checkProgress.value),
  }));

  return (
    <View style={styles.wrapper}>
      <Svg width={SIZE} height={SIZE} viewBox="0 0 96 96">
        <AnimatedCircle
          cx={48}
          cy={48}
          r={42}
          stroke={color.success}
          strokeWidth={4}
          fill="none"
          strokeDasharray={CIRCLE_CIRCUMFERENCE}
          animatedProps={circleAnimatedProps}
          strokeLinecap="round"
        />
        <AnimatedPath
          d="M30 50 L43 63 L68 34"
          stroke={color.success}
          strokeWidth={5}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={CHECK_LENGTH}
          animatedProps={checkAnimatedProps}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', justifyContent: 'center' },
});
