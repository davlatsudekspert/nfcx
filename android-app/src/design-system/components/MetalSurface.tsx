import React, { useEffect } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated';
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

/**
 * A CSS `linear-gradient(<angle>, …)` as expo-linear-gradient `start`/`end`
 * points on the unit square, so the token can carry the website's angle
 * verbatim. CSS angles run clockwise from "to top": 135° is top-left →
 * bottom-right. The vector is scaled so the gradient line still spans the
 * full box, as the CSS one does.
 */
function gradientPoints(angleDeg: number): { start: { x: number; y: number }; end: { x: number; y: number } } {
  const rad = (angleDeg * Math.PI) / 180;
  const dx = Math.sin(rad);
  const dy = -Math.cos(rad);
  const k = 0.5 / Math.max(Math.abs(dx), Math.abs(dy), 1e-6);
  return { start: { x: 0.5 - dx * k, y: 0.5 - dy * k }, end: { x: 0.5 + dx * k, y: 0.5 + dy * k } };
}

/** Pre-computed once per tier — never inside a render. */
const BASE_POINTS: Record<MetalKey, ReturnType<typeof gradientPoints>> = {
  exclusive: gradientPoints(metal.exclusive.baseAngle),
  premium: gradientPoints(metal.premium.baseAngle),
  gold: gradientPoints(metal.gold.baseAngle),
  silver: gradientPoints(metal.silver.baseAngle),
  free: gradientPoints(metal.free.baseAngle),
};

/** Corner highlight where the light source sits. A light metal (gold,
 * silver) catches plain white; a dark metal catches warm gold. */
const SPECULAR_DARK = ['rgba(245,215,122,0.10)', 'rgba(255,255,255,0.03)', 'transparent'] as const;
const SPECULAR_LIGHT = ['rgba(255,255,255,0.28)', 'rgba(255,255,255,0.06)', 'transparent'] as const;

/**
 * The metal a premium NFC ID card is made of — the website's per-tier
 * finish (`metal[tier]`, ported from src/components/NfcCard.jsx) rendered
 * as layers, each a real physical cue, bottom to top:
 *   1. base      the tier's diagonal metal gradient at the web's angle
 *   2. brush     brushed micro-texture across the short axis
 *   3. specular  corner highlight where the light source sits
 *   4. sheen     one reflection sweep on entrance (the web's shimmerSweep)
 *   5. hairline  the web's `border` as a 1px machined edge + a lit top lip
 *
 * Everything is a gradient — no SVG, no images, no per-frame JS — so a
 * screen full of these still scrolls at full frame rate. Text placed on
 * the surface must use `metal[tier].text/subtext/code`: gold and silver
 * are light metals with dark lettering.
 */
export function MetalSurface({ tier, children, style, cornerRadius = radii.lg, index = 0, sheen = true }: MetalSurfaceProps) {
  const m = metal[tier];
  const points = BASE_POINTS[tier];
  const sweep = useSharedValue(-1);

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

  const sweepStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: `${sweep.value * 100}%` }, { rotate: '18deg' }],
  }));

  return (
    <View style={[styles.root, { borderRadius: cornerRadius, backgroundColor: m.base[1] }, style]}>
      <LinearGradient
        colors={m.base as unknown as readonly [string, string, ...string[]]}
        locations={m.baseLocations as unknown as readonly [number, number, ...number[]]}
        start={points.start}
        end={points.end}
        style={StyleSheet.absoluteFill}
      />

      <LinearGradient
        colors={m.brush as unknown as readonly [string, string, ...string[]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.06 }}
        style={StyleSheet.absoluteFill}
      />

      <LinearGradient
        colors={m.darkText ? SPECULAR_LIGHT : SPECULAR_DARK}
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
  root: { overflow: 'hidden' },
  sheenTrack: { position: 'absolute', top: '-30%', bottom: '-30%', left: 0, width: '45%' },
  hairline: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderWidth: 1 },
  topLip: { position: 'absolute', top: 0, left: 0, right: 0, height: 1.5 },
  content: { flex: 1 },
});
