import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { color, depth, gradient, radius, space, touchTarget, type as typeTokens } from '../tokens';

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

/** The seam under the header: a gold hairline that fades out at both ends. */
const SEAM = ['rgba(212,175,90,0)', 'rgba(212,175,90,0.38)', 'rgba(212,175,90,0)'] as const;

/**
 * Screen chrome. The bar itself is transparent so the screen's warm ambient
 * wash reads through it (see ScreenWithHeader) — a painted-black header on a
 * black screen is exactly the flat rectangle the brief argues against.
 *
 * The title is serif (`type.h2`). Controls are 40dp card-material discs
 * centred inside 48dp touch targets, so the hit area stays Android-legal
 * while the visible chrome stays small; pressing one lights its gold rim.
 */
export function PremiumHeader({ title, onBack, actions = [] }: PremiumHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrapper, { paddingTop: insets.top + space.sm }]}>
      <View style={styles.row}>
        {onBack ? (
          <IconControl icon="chevron-left" size={22} onPress={onBack} accessibilityLabel="Orqaga" />
        ) : (
          <View style={styles.spacer} />
        )}
        {!!title && (
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
        )}
        <View style={styles.actionsRow}>
          {actions.map((action) => (
            <IconControl
              key={action.accessibilityLabel}
              icon={action.icon}
              size={19}
              onPress={action.onPress}
              accessibilityLabel={action.accessibilityLabel}
              showDot={action.showDot}
            />
          ))}
        </View>
      </View>
      <LinearGradient
        colors={SEAM}
        locations={[0, 0.5, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.seam}
        pointerEvents="none"
      />
    </View>
  );
}

function IconControl({
  icon,
  size,
  onPress,
  accessibilityLabel,
  showDot,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  size: number;
  onPress: () => void;
  accessibilityLabel: string;
  showDot?: boolean;
}) {
  const [pressed, setPressed] = React.useState(false);
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={styles.hit}
    >
      <View style={[styles.disc, pressed && styles.discPressed]}>
        <LinearGradient
          colors={gradient.cardSurface}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        {pressed ? <View style={styles.discWash} pointerEvents="none" /> : null}
        <Feather name={icon} size={size} color={pressed ? color.goldHighlight : color.textPrimary} />
        <View style={styles.discLip} pointerEvents="none" />
      </View>
      {showDot && <View style={styles.dot} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: { paddingHorizontal: space.sm, paddingBottom: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: touchTarget },
  title: { ...typeTokens.h2, color: color.textPrimary, flex: 1, letterSpacing: 0.2, marginHorizontal: space.xs },
  actionsRow: { flexDirection: 'row', alignItems: 'center' },
  spacer: { width: space.sm },
  hit: {
    width: touchTarget,
    height: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disc: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    overflow: 'hidden',
    ...depth.chip,
  },
  discPressed: { borderColor: color.borderGoldStrong, ...depth.glow },
  discWash: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: color.goldMuted },
  discLip: { position: 'absolute', top: 0, left: 8, right: 8, height: 1, backgroundColor: 'rgba(255,255,255,0.10)' },
  seam: { height: 1, marginTop: space.xs },
  dot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 9,
    height: 9,
    borderRadius: radius.pill,
    backgroundColor: color.goldHighlight,
    borderWidth: 2,
    borderColor: color.bg,
    boxShadow: '0 0 8px rgba(240,207,122,0.6)',
  },
});
