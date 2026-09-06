import React from 'react';
import { RefreshControl, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { PremiumHeader, type PremiumHeaderAction } from '../../design-system/components/PremiumHeader';
import { color, gradient, space } from '../../design-system/tokens';

export interface CompanyScreenProps {
  title?: string;
  onBack?: () => void;
  actions?: PremiumHeaderAction[];
  /** Pull-to-refresh — omit `onRefresh` and no RefreshControl is attached. */
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Sticky bottom bar (the wizard's Back/Continue pair, a screen's single CTA). */
  footer?: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

/**
 * Screen chrome for the whole Company section.
 *
 * `ScreenWithHeader` pads its own body, which makes an edge-to-edge cover
 * image or a sticky footer impossible; this keeps the same safe-area/header
 * contract but leaves the scroll container to the screen, so cards can bleed
 * to the edges and the primary action can stay pinned above the fold —
 * the difference between a mobile workspace and a form in a scroll view.
 */
export function CompanyScreen({
  title,
  onBack,
  actions,
  refreshing = false,
  onRefresh,
  footer,
  contentStyle,
  children,
}: CompanyScreenProps) {
  return (
    <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
      <LinearGradient colors={gradient.screenAmbient} style={styles.ambient} pointerEvents="none" />
      <PremiumHeader title={title} onBack={onBack} actions={actions} />
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.content, contentStyle]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
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
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.bg },
  flex: { flex: 1 },
  ambient: { position: 'absolute', top: 0, left: 0, right: 0, height: 220 },
  content: { padding: space.lg, paddingBottom: space.xxxl, gap: space.lg },
  footer: {
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.md,
    backgroundColor: color.bgDeep,
    borderTopWidth: 1,
    borderTopColor: color.border,
    gap: space.sm,
  },
});
