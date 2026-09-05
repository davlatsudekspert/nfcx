import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { color, space, type as typeTokens } from '../tokens';
import { PremiumButton } from './PremiumButton';

export interface PremiumEmptyStateProps {
  icon?: React.ComponentProps<typeof Feather>['name'];
  title: string;
  description?: string;
  ctaLabel?: string;
  onPressCta?: () => void;
}

export function PremiumEmptyState({ icon = 'inbox', title, description, ctaLabel, onPressCta }: PremiumEmptyStateProps) {
  return (
    <View style={styles.wrapper}>
      <Feather name={icon} size={40} color={color.textTertiary} />
      <Text style={styles.title}>{title}</Text>
      {!!description && <Text style={styles.description}>{description}</Text>}
      {!!ctaLabel && onPressCta && (
        <PremiumButton label={ctaLabel} onPress={onPressCta} variant="ghost" fullWidth={false} style={styles.cta} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', justifyContent: 'center', paddingVertical: space.xxxl, paddingHorizontal: space.xl },
  title: { ...typeTokens.h2, color: color.textPrimary, marginTop: space.md, textAlign: 'center' },
  description: { ...typeTokens.body, color: color.textSecondary, marginTop: space.xs, textAlign: 'center' },
  cta: { marginTop: space.lg, paddingHorizontal: space.xl },
});
