import React from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PremiumHeader, type PremiumHeaderAction } from '../../design-system/components/PremiumHeader';
import { ScreenAmbient } from './ScreenContainer';
import { color, space } from '../../design-system/tokens';

export interface ScreenWithHeaderProps {
  title?: string;
  onBack?: () => void;
  actions?: PremiumHeaderAction[];
  scroll?: boolean;
  /** Pull-to-refresh (scrolling screens only). */
  refreshing?: boolean;
  onRefresh?: () => void;
  children: React.ReactNode;
}

/**
 * Header + body in a single safe-area/scroll container — avoids nesting
 * two ScreenContainers (and therefore two SafeAreaViews) on screens that
 * need both chrome and scrollable content.
 *
 * The warm radial wash behind the header and the weight at the bottom of the
 * floor are drawn once here, so every screen in the app gets the same depth
 * — and the same protection against large empty regions reading as dead
 * space — without re-implementing it.
 */
export function ScreenWithHeader({
  title,
  onBack,
  actions,
  scroll = true,
  refreshing,
  onRefresh,
  children,
}: ScreenWithHeaderProps) {
  return (
    <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
      <ScreenAmbient />
      <PremiumHeader title={title} onBack={onBack} actions={actions} />
      {scroll ? (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.padded}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={!!refreshing}
                onRefresh={onRefresh}
                tintColor={color.gold}
                colors={[color.gold]}
                progressBackgroundColor={color.surface}
              />
            ) : undefined
          }
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.flex, styles.padded]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.bg },
  flex: { flex: 1, backgroundColor: 'transparent' },
  padded: { padding: space.lg, flexGrow: 1 },
});
