import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { color, space, touchTarget, type as typeTokens } from '../tokens';

export interface PremiumListRowProps {
  label: string;
  /** Secondary line under the label — for settings rows that need a short explanation. */
  subtitle?: string;
  value?: string;
  icon?: React.ComponentProps<typeof Feather>['name'];
  onPress?: () => void;
  showChevron?: boolean;
  destructive?: boolean;
  /** Trailing element (switch, badge, custom control). Replaces the chevron when set. */
  right?: React.ReactNode;
  testID?: string;
}

export function PremiumListRow({
  label,
  subtitle,
  value,
  icon,
  onPress,
  showChevron = true,
  destructive = false,
  right,
  testID,
}: PremiumListRowProps) {
  const [pressed, setPressed] = React.useState(false);

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      disabled={!onPress}
      style={[styles.row, pressed && styles.rowPressed]}
      accessibilityRole={onPress ? 'button' : undefined}
      testID={testID}
    >
      {icon && <Feather name={icon} size={18} color={destructive ? color.danger : color.textSecondary} style={styles.icon} />}
      <View style={styles.labelWrap}>
        <Text style={[styles.label, destructive && styles.labelDestructive]} numberOfLines={1}>
          {label}
        </Text>
        {!!subtitle && (
          <Text style={styles.subtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        )}
      </View>
      {!!value && (
        <Text style={styles.value} numberOfLines={1}>
          {value}
        </Text>
      )}
      {right ?? (onPress && showChevron ? <Feather name="chevron-right" size={18} color={color.textTertiary} /> : null)}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: touchTarget,
    paddingHorizontal: space.md,
    gap: space.sm,
    borderRadius: 12,
  },
  rowPressed: { backgroundColor: color.surfaceRaised },
  icon: { width: 22 },
  labelWrap: { flex: 1, paddingVertical: space.xs },
  subtitle: { ...typeTokens.caption, color: color.textTertiary, marginTop: 2 },
  label: { ...typeTokens.body, color: color.textPrimary },
  labelDestructive: { color: color.danger },
  value: { ...typeTokens.body, color: color.textSecondary, marginRight: space.xs },
});
