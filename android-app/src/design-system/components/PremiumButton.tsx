import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { color, depth, gradient, motion, radius, touchTarget, type as typeTokens } from '../tokens';
import { GoldSheen } from './GoldSheen';
import { haptics } from '../../native/haptics';

export type PremiumButtonVariant = 'filled' | 'ghost' | 'danger';

export interface PremiumButtonProps {
  label: string;
  onPress?: () => void;
  variant?: PremiumButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Specular corner where the light source sits — the cue that the gold is a
 * curved metal surface rather than a flat colour fill. */
const SPECULAR = ['rgba(255,255,255,0.30)', 'rgba(255,255,255,0.06)', 'transparent'] as const;
/** Weight along the bottom edge so the billet has thickness. */
const UNDERSHADE = ['transparent', 'rgba(60,40,0,0.26)'] as const;
/** Danger keeps the card material with a faint red breath in one corner. */
const DANGER_BREATH = ['rgba(229,72,77,0.14)', 'transparent'] as const;

const GLOW_IN_MS = 120;
const GLOW_OUT_MS = 560;
/** The material clip sits inside the shell's 1px border. */
const INNER_RADIUS = radius.md - 1;

/**
 * The app's primary CTA.
 *
 * `filled` is the 135° champagne-to-antique gold gradient with a slow looping
 * light sweep, resting on `depth.button`. Pressing it sinks the billet:
 * scale 0.97 plus `depth.buttonPressed` (an inner shadow); releasing it lets
 * a soft gold glow breathe out once. No Material ripple anywhere.
 *
 * `ghost` / `danger` are gold- / red-outlined on the card gradient, so a
 * secondary action is still a machined part rather than an empty outline.
 *
 * `disabled` is deliberately inert: a flat, unlit slab with muted text — not
 * a dimmed gold button, which reads as broken rather than unavailable.
 * `loading` keeps the material (the action is live, just busy).
 */
export function PremiumButton({
  label,
  onPress,
  variant = 'filled',
  loading = false,
  disabled = false,
  fullWidth = true,
  style,
  accessibilityLabel,
  testID,
}: PremiumButtonProps) {
  const scale = useSharedValue(1);
  const pressed = useSharedValue(0);
  const glow = useSharedValue(0);
  const isDisabled = disabled || loading;
  const inert = disabled;
  const filled = variant === 'filled' && !inert;

  const shellStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const pressedStyle = useAnimatedStyle(() => ({ opacity: pressed.value }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value }));

  const handlePressIn = () => {
    if (isDisabled) return;
    scale.value = withTiming(motion.pressScale, { duration: motion.pressDurationMs });
    pressed.value = withTiming(1, { duration: motion.pressDurationMs });
    haptics.light();
  };
  const handlePressOut = () => {
    scale.value = withTiming(1, { duration: motion.pressDurationMs * 2, easing: Easing.out(Easing.cubic) });
    pressed.value = withTiming(0, { duration: motion.pressDurationMs * 2 });
    if (filled) {
      glow.value = withSequence(
        withTiming(1, { duration: GLOW_IN_MS }),
        withTiming(0, { duration: GLOW_OUT_MS, easing: Easing.out(Easing.quad) }),
      );
    }
  };

  const spinnerColor = inert
    ? color.textTertiary
    : filled
      ? color.textOnGold
      : variant === 'danger'
        ? color.danger
        : color.gold;

  return (
    <AnimatedPressable
      onPress={isDisabled ? undefined : onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      testID={testID}
      style={[
        shellStyle,
        styles.shell,
        fullWidth && styles.fullWidth,
        filled && styles.shellFilled,
        variant === 'ghost' && !inert && styles.shellGhost,
        variant === 'danger' && !inert && styles.shellDanger,
        inert && styles.shellInert,
        style,
      ]}
    >
      {/* Release glow — a sibling of the clip, so the halo can spill past the edge. */}
      {filled ? <Animated.View style={[styles.glow, glowStyle]} pointerEvents="none" /> : null}

      <View style={styles.material} pointerEvents="none">
        {filled ? (
          <>
            <LinearGradient
              colors={gradient.goldButton}
              locations={[0, 0.5, 1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <LinearGradient
              colors={SPECULAR}
              locations={[0, 0.4, 1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0.75, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <LinearGradient
              colors={UNDERSHADE}
              start={{ x: 0, y: 0.55 }}
              end={{ x: 0, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <GoldSheen loop band={0.36} intensity={0.55} />
          </>
        ) : null}

        {!inert && !filled ? (
          <LinearGradient
            colors={gradient.cardSurface}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        {variant === 'danger' && !inert ? (
          <LinearGradient
            colors={DANGER_BREATH}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.7, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        ) : null}

        {!inert ? <View style={[styles.topLip, filled ? styles.topLipGold : styles.topLipDark]} /> : null}
        {!inert ? <Animated.View style={[styles.pressedShade, pressedStyle]} /> : null}
      </View>

      <View style={styles.contentRow}>
        {loading ? (
          <ActivityIndicator color={spinnerColor} />
        ) : (
          <Text
            style={[
              styles.label,
              filled && styles.labelOnGold,
              variant === 'ghost' && !inert && styles.labelGhost,
              variant === 'danger' && !inert && styles.labelDanger,
              inert && styles.labelInert,
            ]}
            numberOfLines={1}
          >
            {label}
          </Text>
        )}
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  shell: {
    minHeight: touchTarget,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: color.surfaceRaised,
  },
  fullWidth: { width: '100%' },
  shellFilled: {
    backgroundColor: color.goldDark,
    borderColor: 'rgba(255,244,214,0.40)',
    ...depth.button,
  },
  shellGhost: {
    backgroundColor: color.surface,
    borderColor: color.borderGold,
    ...depth.chip,
  },
  shellDanger: {
    backgroundColor: color.surface,
    borderColor: 'rgba(229,72,77,0.45)',
    ...depth.chip,
  },
  /** Unlit slab: reads as "not available yet", not as "the button failed". */
  shellInert: {
    backgroundColor: '#15110a',
    borderColor: 'rgba(255,255,255,0.06)',
  },
  material: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: INNER_RADIUS, overflow: 'hidden' },
  glow: { position: 'absolute', top: -1, left: -1, right: -1, bottom: -1, borderRadius: radius.md, ...depth.glow },
  topLip: { position: 'absolute', top: 0, left: 0, right: 0, height: 1 },
  topLipGold: { backgroundColor: 'rgba(255,248,225,0.55)' },
  topLipDark: { backgroundColor: 'rgba(255,255,255,0.08)' },
  /** Pressed: the billet sinks — an inner shadow plus a whisper of shade. */
  pressedShade: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: INNER_RADIUS,
    backgroundColor: 'rgba(0,0,0,0.12)',
    ...depth.buttonPressed,
  },
  contentRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  label: { ...typeTokens.h3, textAlign: 'center', letterSpacing: 0.3, color: color.textPrimary },
  labelOnGold: { color: color.textOnGold },
  labelGhost: { color: color.gold },
  labelDanger: { color: color.danger },
  labelInert: { color: color.textTertiary },
});
