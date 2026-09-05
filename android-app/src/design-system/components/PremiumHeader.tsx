import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { color, space, touchTarget, type as typeTokens } from '../tokens';

export interface PremiumHeaderAction {
  icon: React.ComponentProps<typeof Feather>['name'];
  onPress: () => void;
  accessibilityLabel: string;
  /** Small dot for unread counts — fed by GET /api/conversations/unread-count
   * and the gift-offers/won-auctions counts (android/docs/02-API_MAP.md §2.6). */
  showDot?: boolean;
}

export interface PremiumHeaderProps {
  title?: string;
  onBack?: () => void;
  actions?: PremiumHeaderAction[];
}

export function PremiumHeader({ title, onBack, actions = [] }: PremiumHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrapper, { paddingTop: insets.top + space.sm }]}>
      <View style={styles.row}>
        {onBack ? (
          <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Orqaga" style={styles.iconButton}>
            <Feather name="chevron-left" size={22} color={color.textPrimary} />
          </Pressable>
        ) : (
          <View style={styles.iconButton} />
        )}
        {!!title && (
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
        )}
        <View style={styles.actionsRow}>
          {actions.map((action) => (
            <Pressable
              key={action.accessibilityLabel}
              onPress={action.onPress}
              accessibilityRole="button"
              accessibilityLabel={action.accessibilityLabel}
              style={styles.iconButton}
            >
              <Feather name={action.icon} size={20} color={color.textPrimary} />
              {action.showDot && <View style={styles.dot} />}
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { backgroundColor: color.bg, paddingHorizontal: space.md, paddingBottom: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: touchTarget },
  title: { ...typeTokens.h2, color: color.textPrimary, flex: 1 },
  actionsRow: { flexDirection: 'row', gap: space.xs },
  iconButton: {
    width: touchTarget,
    height: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: color.danger,
  },
});
