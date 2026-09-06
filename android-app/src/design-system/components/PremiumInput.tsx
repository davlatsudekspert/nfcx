import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { color, radius, space, type as typeTokens } from '../tokens';

export interface PremiumInputProps extends TextInputProps {
  label: string;
  error?: string | null;
  disabled?: boolean;
}

/** A field is a well machined *into* the surface, so the light sits at the
 * top and falls away — the exact inverse of a raised card. */
const WELL = ['rgba(0,0,0,0.32)', 'rgba(255,255,255,0.02)'] as const;
const WELL_FOCUSED = ['rgba(215,182,93,0.10)', 'rgba(215,182,93,0.02)'] as const;

/**
 * Labelled text field with a gold focus edge.
 *
 * The visible box is a wrapper, not the `TextInput` itself, so a caller can
 * still pass `style` (multiline height, `textAlignVertical`, padding) through
 * to the input without fighting the material.
 * See android/docs/05-DESIGN_SYSTEM.md §5.2.
 */
export function PremiumInput({ label, error, disabled, style, onFocus, onBlur, ...rest }: PremiumInputProps) {
  const [focused, setFocused] = useState(false);
  const active = focused || !!rest.value;

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
        <LinearGradient
          colors={focused ? WELL_FOCUSED : WELL}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          locations={[0, 0.55]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <TextInput
          {...rest}
          editable={!disabled && rest.editable !== false}
          placeholderTextColor={color.textTertiary}
          selectionColor={color.gold}
          cursorColor={color.gold}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
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
    backgroundColor: '#131313',
    overflow: 'hidden',
  },
  fieldFocused: { borderColor: color.borderGoldStrong, backgroundColor: '#181613' },
  fieldError: { borderColor: color.danger },
  fieldDisabled: { opacity: 0.55 },
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
