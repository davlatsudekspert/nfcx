import React from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { PremiumHeader, type PremiumHeaderAction } from '../../design-system/components/PremiumHeader';
import { color, gradient, space } from '../../design-system/tokens';

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
 * The faint gold wash behind the header is what keeps a screen from reading
 * as a flat black rectangle; it is drawn once here so every screen in the app
 * gets the same depth without re-implementing it.
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
      <LinearGradient
        colors={gradient.screenAmbient}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.ambient}
        pointerEvents="none"
      />
      <PremiumHeader title={title} onBack={onBack} actions={actions} />
      {scroll ? (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.padded}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            onRefresh ? (
              <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={color.gold} colors={[color.gold]} />
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
  flex: { flex: 1 },
  ambient: { position: 'absolute', top: 0, left: 0, right: 0, height: 200 },
  padded: { padding: space.lg, flexGrow: 1 },
});
