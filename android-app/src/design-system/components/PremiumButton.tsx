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
import { color, motion, radius, touchTarget, type as typeTokens } from '../tokens';
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

/** Solid gold billet, lit from the top-left: highlight, body, shadowed edge,
 * then a bounced light along the bottom. Four stops is what stops it reading
 * as a flat yellow rectangle. */
const GOLD_BILLET = ['#EFD79A', '#D7B65D', '#A2802F', '#DCC077'] as const;
/** Brushed micro-texture across the short axis — the same trick MetalSurface
 * uses, at half strength because a button is small and must stay legible. */
const GOLD_BRUSH = [
  'rgba(255,255,255,0.00)',
  'rgba(255,255,255,0.05)',
  'rgba(0,0,0,0.05)',
  'rgba(255,255,255,0.04)',
  'rgba(0,0,0,0.04)',
] as const;
/** Specular corner where the light source sits. */
const SPECULAR = ['rgba(255,255,255,0.30)', 'rgba(255,255,255,0.06)', 'transparent'] as const;
/** Weight along the bottom edge so the billet has thickness. */
const UNDERSHADE = ['transparent', 'rgba(60,40,0,0.22)'] as const;
/** Dark machined metal used by ghost/danger — never a transparent hole. */
const DARK_METAL = ['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.015)'] as const;
const SHEEN = ['transparent', 'rgba(255,252,235,0.55)', 'transparent'] as const;

const SWEEP_MS = 520;

/**
 * The app's primary CTA.
 *
 * `filled` is a real gold metal surface — billet gradient, brushed texture,
 * one specular corner, a machined hairline and a top lip — and a single
 * reflection sweeps across it *on press only*. Nothing moves at rest, which
 * is the line between "premium" and "casino".
 *
 * `ghost` / `danger` are hairline-edged dark metal, so a secondary action
 * still reads as a machined part rather than an empty outline.
 *
 * `disabled` is deliberately inert: a flat, unlit slab with muted text — not
 * a dimmed gold button, which reads as broken rather than unavailable.
 *
 * See android/docs/05-DESIGN_SYSTEM.md §5.2.
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
  const sweep = useSharedValue(-1);
  const isDisabled = disabled || loading;
  /** Loading keeps the material (the action is still live, just busy); only a
   * truly disabled button loses it. */
  const inert = disabled;

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const sweepStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: `${sweep.value * 130}%` }, { rotate: '16deg' }],
  }));

  const handlePressIn = () => {
    if (isDisabled) return;
    scale.value = withTiming(motion.pressScale, { duration: motion.pressDurationMs });
    sweep.value = withSequence(
      withTiming(1.4, { duration: SWEEP_MS, easing: Easing.out(Easing.cubic) }),
      withTiming(-1, { duration: 0 }),
    );
    haptics.light();
  };
  const handlePressOut = () => {
    scale.value = withTiming(1, { duration: motion.pressDurationMs });
  };

  const filled = variant === 'filled' && !inert;
  const spinnerColor = inert ? color.textTertiary : variant === 'filled' ? color.textOnGold : color.gold;

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
        animatedStyle,
        styles.base,
        fullWidth && styles.fullWidth,
        filled && styles.filled,
        variant === 'ghost' && !inert && styles.ghost,
        variant === 'danger' && !inert && styles.danger,
        inert && styles.inert,
        style,
      ]}
    >
      {filled ? (
        <>
          <LinearGradient
            colors={GOLD_BILLET}
            locations={[0, 0.42, 0.78, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={GOLD_BRUSH}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0.08 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <LinearGradient
            colors={SPECULAR}
            locations={[0, 0.4, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.75, y: 1 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <LinearGradient
            colors={UNDERSHADE}
            start={{ x: 0, y: 0.55 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
        </>
      ) : null}

      {!inert && variant !== 'filled' ? (
        <LinearGradient
          colors={DARK_METAL}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.7, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      ) : null}

      {!inert ? (
        <Animated.View style={[styles.sheenTrack, sweepStyle]} pointerEvents="none">
          <LinearGradient
            colors={variant === 'filled' ? SHEEN : (['transparent', 'rgba(255,255,255,0.16)', 'transparent'] as const)}
            locations={[0, 0.5, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      ) : null}

      {!inert ? (
        <View
          style={[
            styles.topLip,
            variant === 'filled' ? styles.topLipGold : styles.topLipDark,
          ]}
          pointerEvents="none"
        />
      ) : null}

      <View style={styles.contentRow}>
        {loading ? (
          <ActivityIndicator color={spinnerColor} />
        ) : (
          <Text
            style={[
              styles.label,
              variant === 'filled' && styles.labelOnFilled,
              variant === 'ghost' && styles.labelGhost,
              variant === 'danger' && styles.labelDanger,
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
  base: {
    minHeight: touchTarget,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: color.surfaceRaised,
  },
  fullWidth: { width: '100%' },
  filled: {
    backgroundColor: '#C9A54F',
    borderColor: 'rgba(255,244,214,0.42)',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  ghost: {
    backgroundColor: '#111010',
    borderColor: color.borderGold,
  },
  danger: {
    backgroundColor: '#120E0E',
    borderColor: 'rgba(229,72,77,0.45)',
  },
  /** Unlit slab: reads as "not available yet", not as "the button failed". */
  inert: {
    backgroundColor: '#141414',
    borderColor: 'rgba(255,255,255,0.06)',
  },
  sheenTrack: { position: 'absolute', top: '-60%', bottom: '-60%', left: 0, width: '42%' },
  topLip: { position: 'absolute', top: 0, left: 0, right: 0, height: 1 },
  topLipGold: { backgroundColor: 'rgba(255,248,225,0.5)' },
  topLipDark: { backgroundColor: 'rgba(255,255,255,0.09)' },
  contentRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  label: { ...typeTokens.h2, textAlign: 'center', letterSpacing: 0.2 },
  labelOnFilled: { color: color.textOnGold },
  labelGhost: { color: color.gold },
  labelDanger: { color: color.danger },
  labelInert: { color: color.textTertiary },
});
