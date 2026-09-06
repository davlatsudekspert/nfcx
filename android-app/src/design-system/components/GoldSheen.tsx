import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { gradient, motion } from '../tokens';

export interface GoldSheenProps {
  /** Loop forever (buttons, badges) or sweep once on mount (cards). */
  loop?: boolean;
  /** Staggers the first sweep so a row of badges doesn't flash in unison. */
  index?: number;
  /** Band width as a fraction of the host width. */
  band?: number;
  /** Highlight strength 0–1. */
  intensity?: number;
}

/**
 * The metallic light-sweep every gold surface shares: a soft white-gold
 * band that crosses the host diagonally, then rests, like light moving over
 * brushed metal. Cadence is `motion.sheenPeriodMs` (3–4 s), the sweep itself
 * `motion.sheenSweepMs`. Absolutely positioned — the parent must have
 * `overflow: 'hidden'` and a border radius, and this must be rendered after
 * the fill and before the label.
 */
export function GoldSheen({ loop = true, index = 0, band = 0.45, intensity = 1 }: GoldSheenProps) {
  const x = useSharedValue(-1);

  useEffect(() => {
    const rest = Math.max(0, motion.sheenPeriodMs - motion.sheenSweepMs);
    const sweep = withSequence(
      withTiming(1.6, { duration: motion.sheenSweepMs, easing: Easing.inOut(Easing.cubic) }),
      withTiming(-1, { duration: 0 }),
      withTiming(-1, { duration: rest }),
    );
    x.value = withDelay(300 + Math.min(index, 8) * 140, loop ? withRepeat(sweep, -1, false) : sweep);
  }, [loop, index, x]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: `${x.value * 100}%` }, { rotate: '18deg' }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.track, { width: `${band * 100}%`, opacity: intensity }, style]}
    >
      <LinearGradient
        colors={gradient.goldShimmerSweep as unknown as readonly [string, string, string]}
        locations={[0, 0.5, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  track: { position: 'absolute', top: '-40%', bottom: '-40%', left: 0 },
});
