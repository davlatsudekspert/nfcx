import React, { forwardRef, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetView,
  type BottomSheetBackdropProps,
  type BottomSheetBackgroundProps,
} from '@gorhom/bottom-sheet';
import { color, gradient, motion, radius, space, type as typeTokens } from '../tokens';

export interface PremiumSheetProps {
  title?: string;
  children: React.ReactNode;
  snapPoints?: (string | number)[];
  onDismiss?: () => void;
}

/** A faint gold breath along the top lip so the sheet reads as lit from above. */
const BREATH = ['rgba(240,207,122,0.10)', 'rgba(212,175,90,0.02)', 'transparent'] as const;

/**
 * Bottom sheet used for confirmations (bid confirm, catalog item editor,
 * contact-permission rationale). Slides up as a slab of the card material —
 * `gradient.cardSurface`, a gold top lip, a serif title — casting its shadow
 * upward onto the scrim. Honors Android predictive-back to dismiss before
 * popping the screen underneath (brief §19) via BottomSheet's own
 * back-handler integration.
 */
export const PremiumSheet = forwardRef<BottomSheet, PremiumSheetProps>(function PremiumSheet(
  { title, children, snapPoints, onDismiss },
  ref,
) {
  const points = useMemo(() => snapPoints ?? ['40%', '75%'], [snapPoints]);

  const renderBackdrop = (props: BottomSheetBackdropProps) => (
    <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.78} />
  );

  /* The slab is drawn as the sheet's own background, not as a child, so it
     never paints over the drag handle. */
  const renderBackground = ({ style, pointerEvents }: BottomSheetBackgroundProps) => (
    <View style={[style, styles.background]} pointerEvents={pointerEvents}>
      <LinearGradient
        colors={gradient.cardSurface}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.4, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <LinearGradient
        colors={BREATH}
        locations={[0, 0.5, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.breath}
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
    backgroundColor: color.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderColor: color.borderGold,
    overflow: 'hidden',
    boxShadow: '0 -8px 24px rgba(0,0,0,0.6), 0 -40px 80px -30px rgba(0,0,0,0.8), 0 0 0 1px rgba(212,175,90,0.10)',
  },
  breath: { position: 'absolute', top: 0, left: 0, right: 0, height: 120 },
  topLip: {
    position: 'absolute',
    top: 0,
    left: radius.xl,
    right: radius.xl,
    height: 1,
    backgroundColor: 'rgba(255,238,196,0.28)',
  },
  handleArea: { paddingTop: space.md, paddingBottom: space.sm },
  handle: {
    backgroundColor: color.gold,
    width: 36,
    height: 4,
    borderRadius: radius.pill,
    boxShadow: '0 0 8px rgba(212,175,90,0.45)',
  },
  content: { paddingHorizontal: space.lg, paddingBottom: space.xl },
  title: { ...typeTokens.h1, color: color.textPrimary, marginBottom: space.md, letterSpacing: 0.2 },
  body: { gap: space.md },
});
