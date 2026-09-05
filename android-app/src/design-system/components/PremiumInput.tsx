import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { color, radius, space, type as typeTokens } from '../tokens';

export interface PremiumInputProps extends TextInputProps {
  label: string;
  error?: string | null;
  disabled?: boolean;
}

/** Floating-label input with a gold focus underline. See
 * android/docs/05-DESIGN_SYSTEM.md §5.2. */
export function PremiumInput({ label, error, disabled, style, onFocus, onBlur, ...rest }: PremiumInputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.wrapper}>
      <Text style={[styles.label, (focused || !!rest.value) && styles.labelActive]}>{label}</Text>
      <TextInput
        {...rest}
        editable={!disabled}
        placeholderTextColor={color.textTertiary}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          styles.input,
          focused && styles.inputFocused,
          !!error && styles.inputError,
          disabled && styles.inputDisabled,
          style,
        ]}
        accessibilityLabel={label}
      />
      {!!error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: space.md },
  label: { ...typeTokens.caption, color: color.textSecondary, marginBottom: space.xs },
  labelActive: { color: color.gold },
  input: {
    minHeight: 48,
    backgroundColor: color.surfaceRaised,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    color: color.textPrimary,
    borderWidth: 1,
    borderColor: 'transparent',
    ...typeTokens.body,
  },
  inputFocused: { borderColor: color.gold },
  inputError: { borderColor: color.danger },
  inputDisabled: { opacity: 0.5 },
  errorText: { ...typeTokens.caption, color: color.danger, marginTop: space.xs },
});
