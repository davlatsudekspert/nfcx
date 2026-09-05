import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { color, gradient, motion, radius, touchTarget, type as typeTokens } from '../tokens';
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

/**
 * The app's primary CTA. Filled = gold gradient. Every press: 0.97 scale
 * over 90ms + light haptic (skipped when disabled/loading). See
 * android/docs/05-DESIGN_SYSTEM.md §5.2.
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
  const isDisabled = disabled || loading;

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handlePressIn = () => {
    if (isDisabled) return;
    scale.value = withTiming(motion.pressScale, { duration: motion.pressDurationMs });
    haptics.light();
  };
  const handlePressOut = () => {
    scale.value = withTiming(1, { duration: motion.pressDurationMs });
  };

  const content = (
    <View style={styles.contentRow}>
      {loading ? (
        <ActivityIndicator color={variant === 'filled' ? color.bgDeep : color.gold} />
      ) : (
        <Text
          style={[
            styles.label,
            variant === 'filled' && styles.labelOnFilled,
            variant === 'ghost' && styles.labelGhost,
            variant === 'danger' && styles.labelDanger,
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
      )}
    </View>
  );

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
        variant === 'ghost' && styles.ghost,
        variant === 'danger' && styles.danger,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {variant === 'filled' && !isDisabled ? (
        <LinearGradient
          colors={gradient.goldButton}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      {content}
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
    overflow: 'hidden',
    backgroundColor: color.surfaceRaised,
  },
  fullWidth: { width: '100%' },
  contentRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  label: { ...typeTokens.h2, textAlign: 'center' },
  labelOnFilled: { color: color.bgDeep },
  labelGhost: { color: color.gold },
  labelDanger: { color: color.danger },
  ghost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: color.borderGold,
  },
  danger: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: color.danger,
  },
  disabled: { opacity: 0.4 },
});
