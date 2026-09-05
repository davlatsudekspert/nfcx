import React, { forwardRef, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import BottomSheet, { BottomSheetBackdrop, BottomSheetView, type BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { color, motion, radius, space, type as typeTokens } from '../tokens';

export interface PremiumSheetProps {
  title?: string;
  children: React.ReactNode;
  snapPoints?: (string | number)[];
  onDismiss?: () => void;
}

/**
 * Bottom sheet used for confirmations (bid confirm, catalog item editor,
 * contact-permission rationale). Honors Android predictive-back to dismiss
 * before popping the screen underneath (brief §19) via BottomSheet's own
 * back-handler integration. See android/docs/05-DESIGN_SYSTEM.md §5.2.
 */
export const PremiumSheet = forwardRef<BottomSheet, PremiumSheetProps>(function PremiumSheet(
  { title, children, snapPoints, onDismiss },
  ref,
) {
  const points = useMemo(() => snapPoints ?? ['40%', '75%'], [snapPoints]);

  const renderBackdrop = (props: BottomSheetBackdropProps) => (
    <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.6} />
  );

  return (
    <BottomSheet
      ref={ref}
      index={-1}
      snapPoints={points}
      enablePanDownToClose
      onClose={onDismiss}
      backdropComponent={renderBackdrop}
      animationConfigs={motion.sheetSpring}
      backgroundStyle={styles.background}
      handleIndicatorStyle={styles.handle}
    >
      <BottomSheetView style={styles.content}>
        {!!title && <Text style={styles.title}>{title}</Text>}
        <View style={styles.body}>{children}</View>
      </BottomSheetView>
    </BottomSheet>
  );
});

const styles = StyleSheet.create({
  background: { backgroundColor: color.surfaceRaised, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl },
  handle: { backgroundColor: color.border },
  content: { paddingHorizontal: space.lg, paddingBottom: space.xl },
  title: { ...typeTokens.h1, color: color.textPrimary, marginBottom: space.md },
  body: { gap: space.md },
});
