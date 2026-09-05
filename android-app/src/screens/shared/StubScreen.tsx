import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { ScreenContainer } from './ScreenContainer';
import { PremiumHeader } from '../../design-system/components/PremiumHeader';
import { color, space, type as typeTokens } from '../../design-system/tokens';

export interface StubScreenProps {
  screenName: string;
  phase: string;
  onBack?: () => void;
}

/**
 * Phase 4 placeholder — real navigation graph, real chrome, no real data
 * yet. Each screen is replaced with its real implementation in the phase
 * named here (android/docs/06-IMPLEMENTATION_PLAN.md). Kept as a distinct,
 * named component per screen (not a generic route) so later phases edit in
 * place rather than rewiring navigation.
 */
export function StubScreen({ screenName, phase, onBack }: StubScreenProps) {
  return (
    <ScreenContainer scroll={false}>
      <PremiumHeader title={screenName} onBack={onBack} />
      <View style={styles.body}>
        <Text style={styles.name}>{screenName}</Text>
        <Text style={styles.phase}>{phase}</Text>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.xs },
  name: { ...typeTokens.h1, color: color.textPrimary },
  phase: { ...typeTokens.caption, color: color.textTertiary },
});
