import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { color, space, touchTarget, type as typeTokens } from '../tokens';

export interface PremiumListRowProps {
  label: string;
  value?: string;
  icon?: React.ComponentProps<typeof Feather>['name'];
  onPress?: () => void;
  showChevron?: boolean;
  destructive?: boolean;
  testID?: string;
}

export function PremiumListRow({ label, value, icon, onPress, showChevron = true, destructive = false, testID }: PremiumListRowProps) {
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
      <Text style={[styles.label, destructive && styles.labelDestructive]} numberOfLines={1}>
        {label}
      </Text>
      {!!value && (
        <Text style={styles.value} numberOfLines={1}>
          {value}
        </Text>
      )}
      {onPress && showChevron && <Feather name="chevron-right" size={18} color={color.textTertiary} />}
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
  label: { ...typeTokens.body, color: color.textPrimary, flex: 1 },
  labelDestructive: { color: color.danger },
  value: { ...typeTokens.body, color: color.textSecondary, marginRight: space.xs },
});
