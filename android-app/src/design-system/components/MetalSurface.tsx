import React, { useEffect } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
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
import { metal, radius as radii, type MetalKey } from '../tokens';

export interface MetalSurfaceProps {
  /** Which physical metal to render. Maps 1:1 to the NFC ID tier. */
  tier: MetalKey;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Corner radius; defaults to the card radius so stacked cards line up. */
  cornerRadius?: number;
  /**
   * Entrance sheen delay slot. A stack of cards sweeps one after another
   * rather than all at once, which is what makes it read as light moving
   * across a surface instead of a blinking animation.
   */
  index?: number;
  /** Set false inside dense lists where a sweep per row would be noise. */
  sheen?: boolean;
}

const SHEEN_DURATION = 1100;
const IRIDESCENT_DURATION = 7000;

/**
 * The metal a premium NFC ID card is made of (design brief: deep black
 * floor, brushed metal, gold hairline, minimal content, light that only
 * moves on purpose).
 *
 * Layer order, bottom to top — each one is a real physical cue:
 *   1. base       diagonal metal gradient, lit from the top-left
 *   2. brush      brushed micro-texture across the short axis
 *   3. iridescent slow hue drift, exclusive tier only (Apple Card-style)
 *   4. specular   corner highlight where the light source sits
 *   5. sheen      one reflection sweep on entrance
 *   6. hairline   1px machined edge + a brighter top lip
 *
 * Everything is a gradient — no SVG, no images, no per-frame JS — so a
 * screen full of these still scrolls at full frame rate.
 */
export function MetalSurface({
  tier,
  children,
  style,
  cornerRadius = radii.lg,
  index = 0,
  sheen = true,
}: MetalSurfaceProps) {
  const m = metal[tier];
  const sweep = useSharedValue(-1);
  const drift = useSharedValue(0);

  useEffect(() => {
    if (!sheen) return;
    const delay = 220 + Math.min(index, 6) * 90;
    sweep.value = withDelay(
      delay,
      withSequence(
        withTiming(1.6, { duration: SHEEN_DURATION, easing: Easing.out(Easing.cubic) }),
        withTiming(-1, { duration: 0 }),
      ),
    );
  }, [sheen, index, sweep]);

  useEffect(() => {
    if (!m.iridescent) return;
    drift.value = withRepeat(
      withTiming(1, { duration: IRIDESCENT_DURATION, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [m.iridescent, drift]);

  const sweepStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: `${sweep.value * 100}%` }, { rotate: '18deg' }],
  }));

  const driftStyle = useAnimatedStyle(() => ({
    opacity: 0.55 + drift.value * 0.45,
    transform: [{ translateX: `${(drift.value - 0.5) * 22}%` }],
  }));

  return (
    <View style={[styles.root, { borderRadius: cornerRadius }, style]}>
      <LinearGradient
        colors={m.base as unknown as readonly [string, string, ...string[]]}
        locations={[0, 0.38, 0.62, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <LinearGradient
        colors={m.brush as unknown as readonly [string, string, ...string[]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.06 }}
        style={StyleSheet.absoluteFill}
      />

      {!!m.iridescent && (
        <Animated.View style={[StyleSheet.absoluteFill, driftStyle]} pointerEvents="none">
          <LinearGradient
            colors={m.iridescent as unknown as readonly [string, string, ...string[]]}
            start={{ x: 0, y: 1 }}
            end={{ x: 1, y: 0 }}
            style={[StyleSheet.absoluteFill, styles.wide]}
          />
        </Animated.View>
      )}

      <LinearGradient
        colors={['rgba(245,215,122,0.10)', 'rgba(255,255,255,0.03)', 'transparent']}
        locations={[0, 0.35, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.85, y: 0.9 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {sheen && (
        <Animated.View style={[styles.sheenTrack, sweepStyle]} pointerEvents="none">
          <LinearGradient
            colors={['transparent', m.sheen, 'transparent'] as readonly [string, string, string]}
            locations={[0, 0.5, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}

      <View
        style={[styles.hairline, { borderRadius: cornerRadius, borderColor: m.hairline }]}
        pointerEvents="none"
      />
      <LinearGradient
        colors={[m.edgeTop, 'transparent'] as readonly [string, string]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.topLip}
        pointerEvents="none"
      />

      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { overflow: 'hidden', backgroundColor: '#0A0A0A' },
  wide: { left: '-15%', right: '-15%' },
  sheenTrack: { position: 'absolute', top: '-30%', bottom: '-30%', left: 0, width: '45%' },
  hairline: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderWidth: 1 },
  topLip: { position: 'absolute', top: 0, left: 0, right: 0, height: 1.5 },
  content: { flex: 1 },
});
