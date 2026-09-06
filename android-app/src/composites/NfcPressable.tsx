import React from 'react';
import { Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { depth, motion } from '../design-system/tokens';

export interface NfcPressableProps extends Omit<PressableProps, 'style' | 'children'> {
  children: React.ReactNode;
  /** Outer style — layout only (margins, flex). The visual lives in `children`. */
  style?: StyleProp<ViewStyle>;
  /** Corner radius of the child surface, so the pressed inner shadow and
   * the release glow follow the same silhouette. */
  radius: number;
  /** Gold glow pulse on release. Off for non-gold controls (e.g. a close ×). */
  glow?: boolean;
}

/**
 * The one press feel every tappable surface in the NFC areas shares
 * (brief: "micro-depth on tap everywhere"): the surface sinks — scale 0.97
 * plus a brief inner shadow — and on release a soft gold glow pulses once
 * behind it, like a metal button settling back and catching the light.
 *
 * Three shared values, all driven on the UI thread; the inner shadow and
 * the glow are overlay views whose *opacity* animates, so no shadow string
 * is ever re-parsed per frame.
 */
export function NfcPressable({ children, style, radius, glow = true, disabled, onPressIn, onPressOut, ...rest }: NfcPressableProps) {
  const press = useSharedValue(0);
  const pulse = useSharedValue(0);

  const scaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - press.value * (1 - motion.pressScale) }],
  }));
  const insetStyle = useAnimatedStyle(() => ({ opacity: press.value }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <Pressable
      {...rest}
      disabled={disabled}
      onPressIn={(e) => {
        if (!disabled) press.value = withTiming(1, { duration: motion.pressDurationMs });
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        press.value = withTiming(0, { duration: motion.pressDurationMs + 40 });
        if (!disabled && glow) {
          pulse.value = withSequence(
            withTiming(1, { duration: 110, easing: Easing.out(Easing.quad) }),
            withTiming(0, { duration: 560, easing: Easing.out(Easing.cubic) }),
          );
        }
        onPressOut?.(e);
      }}
      style={[styles.root, style]}
    >
      {glow && (
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, styles.glow, { borderRadius: radius }, glowStyle]}
        />
      )}
      <Animated.View style={scaleStyle}>
        {children}
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, styles.inset, { borderRadius: radius }, insetStyle]}
        />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {},
  glow: { ...depth.glow, backgroundColor: 'transparent' },
  inset: { ...depth.buttonPressed, backgroundColor: 'transparent' },
});
