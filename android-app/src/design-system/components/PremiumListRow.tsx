import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { color, radius, space, touchTarget, type as typeTokens } from '../tokens';

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

/**
 * One row of a settings/detail list.
 *
 * Deliberately flat-cost: no gradients and no shadows, because these render
 * dozens at a time inside scrollers. The material cue is the small machined
 * icon disc plus a gold-lit pressed state — cheap to draw, still reads as
 * the same metal as everything around it.
 */
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
      {icon && (
        <View style={[styles.iconDisc, destructive && styles.iconDiscDestructive, pressed && !destructive && styles.iconDiscPressed]}>
          <Feather
            name={icon}
            size={16}
            color={destructive ? color.danger : pressed ? color.goldHighlight : color.textSecondary}
          />
          <View style={styles.iconLip} pointerEvents="none" />
        </View>
      )}
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
      {right ?? (onPress && showChevron ? <Feather name="chevron-right" size={18} color={pressed ? color.gold : color.textTertiary} /> : null)}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: touchTarget,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    gap: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  rowPressed: { backgroundColor: color.goldWash, borderColor: color.borderGold },
  iconDisc: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.surfaceRaised,
    borderWidth: 1,
    borderColor: color.border,
    overflow: 'hidden',
  },
  iconDiscPressed: { borderColor: color.borderGold, backgroundColor: color.goldMuted },
  iconDiscDestructive: { backgroundColor: 'rgba(229,72,77,0.08)', borderColor: 'rgba(229,72,77,0.28)' },
  iconLip: { position: 'absolute', top: 0, left: 7, right: 7, height: 1, backgroundColor: 'rgba(255,255,255,0.08)' },
  labelWrap: { flex: 1, paddingVertical: space.xs },
  label: { ...typeTokens.body, color: color.textPrimary },
  labelDestructive: { color: color.danger },
  subtitle: { ...typeTokens.caption, color: color.textTertiary, marginTop: 2 },
  value: { ...typeTokens.body, color: color.textSecondary, marginRight: space.xs },
});
