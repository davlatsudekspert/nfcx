import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { color, depth, radius, space, type as typeTokens } from '../tokens';

export interface PremiumInputProps extends TextInputProps {
  label: string;
  error?: string | null;
  disabled?: boolean;
}

/** Glass film over the sunken surface: a translucent warm sheet, lit at the top. */
const GLASS = ['rgba(255,248,230,0.06)', 'rgba(255,248,230,0.015)'] as const;
/** On focus the glass warms towards gold. */
const GLASS_FOCUSED = ['rgba(212,175,90,0.12)', 'rgba(212,175,90,0.03)'] as const;

const FOCUS_IN_MS = 180;
const FOCUS_OUT_MS = 240;

/**
 * Labelled glass-morphic text field. On focus the border turns gold and a
 * `depth.glow` ring fades in around the field; the placeholder sits in
 * `color.textTertiary`.
 *
 * The visible box is a wrapper, not the `TextInput` itself, so a caller can
 * still pass `style` (multiline height, `textAlignVertical`, padding) through
 * to the input without fighting the material.
 */
export function PremiumInput({ label, error, disabled, style, onFocus, onBlur, ...rest }: PremiumInputProps) {
  const [focused, setFocused] = useState(false);
  const focus = useSharedValue(0);
  const active = focused || !!rest.value;

  const glowStyle = useAnimatedStyle(() => ({ opacity: focus.value }));

  return (
    <View style={styles.wrapper}>
      <Text style={[styles.label, active && styles.labelActive, !!error && styles.labelError]}>{label}</Text>
      <View
        style={[
          styles.field,
          focused && styles.fieldFocused,
          !!error && styles.fieldError,
          disabled && styles.fieldDisabled,
        ]}
      >
        {!error ? <Animated.View style={[styles.glow, glowStyle]} pointerEvents="none" /> : null}
        <View style={styles.glass} pointerEvents="none">
          <LinearGradient
            colors={focused ? GLASS_FOCUSED : GLASS}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.topLip} />
        </View>
        <TextInput
          {...rest}
          editable={!disabled && rest.editable !== false}
          placeholderTextColor={color.textTertiary}
          selectionColor={color.gold}
          cursorColor={color.gold}
          onFocus={(e) => {
            setFocused(true);
            focus.value = withTiming(1, { duration: FOCUS_IN_MS });
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            focus.value = withTiming(0, { duration: FOCUS_OUT_MS });
            onBlur?.(e);
          }}
          style={[styles.input, style]}
          accessibilityLabel={label}
        />
      </View>
      {!!error && (
        <View style={styles.errorRow}>
          <Feather name="alert-circle" size={12} color={color.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: space.md },
  label: { ...typeTokens.caption, color: color.textSecondary, marginBottom: space.xs, letterSpacing: 0.3 },
  labelActive: { color: color.gold },
  labelError: { color: color.danger },
  field: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surfaceSunken,
  },
  fieldFocused: { borderColor: color.gold, backgroundColor: color.surface },
  fieldError: { borderColor: color.danger },
  fieldDisabled: { opacity: 0.55 },
  /** The gold ring lives outside the clip so it can bloom past the edge. */
  glow: { position: 'absolute', top: -1, left: -1, right: -1, bottom: -1, borderRadius: radius.md, ...depth.glow },
  glass: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: radius.md - 1, overflow: 'hidden' },
  topLip: { position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.06)' },
  input: {
    minHeight: 48,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    color: color.textPrimary,
    ...typeTokens.body,
  },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs, marginTop: space.xs },
  errorText: { ...typeTokens.caption, color: color.danger, flex: 1 },
});
