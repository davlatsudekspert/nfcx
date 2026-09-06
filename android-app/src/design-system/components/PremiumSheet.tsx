import React, { forwardRef, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetView,
  type BottomSheetBackdropProps,
  type BottomSheetBackgroundProps,
} from '@gorhom/bottom-sheet';
import { color, motion, radius, space, type as typeTokens } from '../tokens';

export interface PremiumSheetProps {
  title?: string;
  children: React.ReactNode;
  snapPoints?: (string | number)[];
  onDismiss?: () => void;
}

/** The sheet slides up as a slab of dark metal: a lit top lip, then the fill
 * falling away into the deep floor. */
const SLAB = ['#1A1917', '#0D0D0D'] as const;

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
    <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.72} />
  );

  /* The slab is drawn as the sheet's own background, not as a child, so it
     never paints over the drag handle. */
  const renderBackground = ({ style, pointerEvents }: BottomSheetBackgroundProps) => (
    <View style={[style, styles.background]} pointerEvents={pointerEvents}>
      <LinearGradient
        colors={SLAB}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        locations={[0, 0.6]}
        style={styles.slab}
        pointerEvents="none"
      />
      <View style={styles.topLip} pointerEvents="none" />
    </View>
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
      backgroundComponent={renderBackground}
      handleIndicatorStyle={styles.handle}
      handleStyle={styles.handleArea}
    >
      <BottomSheetView style={styles.content}>
        {!!title && <Text style={styles.title}>{title}</Text>}
        <View style={styles.body}>{children}</View>
      </BottomSheetView>
    </BottomSheet>
  );
});

const styles = StyleSheet.create({
  background: {
    backgroundColor: '#101010',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderColor: color.border,
    overflow: 'hidden',
  },
  slab: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: radius.xl },
  topLip: {
    position: 'absolute',
    top: 0,
    left: radius.xl,
    right: radius.xl,
    height: 1,
    backgroundColor: 'rgba(255,238,196,0.22)',
  },
  handleArea: { paddingTop: space.md, paddingBottom: space.sm },
  handle: { backgroundColor: 'rgba(215,182,93,0.45)', width: 36, height: 4, borderRadius: radius.pill },
  content: { paddingHorizontal: space.lg, paddingBottom: space.xl },
  title: { ...typeTokens.h1, color: color.textPrimary, marginBottom: space.md, letterSpacing: 0.2 },
  body: { gap: space.md },
});
