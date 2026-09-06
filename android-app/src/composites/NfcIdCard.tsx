import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { MetalSurface } from '../design-system/components/MetalSurface';
import { tierForCode, TIER_LABEL } from '../lib/pricing';
import { formatCount, safeText } from '../lib/format';
import { haptics } from '../native/haptics';
import { elevation, metal, motion, radius, space, type as typeTokens } from '../design-system/tokens';

/** Layout variants, from the densest to the most ceremonial.
 *
 * `row` is the only one that stays compact enough for a scrolling list;
 * everything else is a full metal card with a credit-card silhouette. */
export type NfcIdCardLayout = 'carousel' | 'row' | 'stack' | 'hero';

/** Fixed geometry so a stack can do its layout math without measuring. */
export const NFC_CARD_HEIGHT: Record<NfcIdCardLayout, number> = {
  carousel: 148,
  row: 92,
  stack: 152,
  hero: 186,
};

const CAROUSEL_WIDTH = 236;

export interface NfcIdCardProps {
  code: string;
  name?: string;
  /**
   * `owned`: already in the user's `cards` (GET /api/auth/me) — a real,
   * confirmed NFC ID. `pending`: a `web_orders` row still awaiting payment
   * confirmation (GET /api/orders). There is no third "reserved" state
   * confirmed anywhere in the live API (android/docs/02-API_MAP.md §2.2/§2.3)
   * — the mockup's "reserved" chip is treated as a label variant of
   * `pending` rather than an invented distinct backend state.
   */
  state: 'owned' | 'pending';
  onPress: () => void;
  index?: number;
  /**
   * `carousel` — a fixed-width tile in a horizontal rail.
   * `row` — the compact full-width entry used by lists such as
   * "Mening ID'larim". `stack` — a full-width card sized for `NfcCardStack`.
   * `hero` — the single largest card on a screen.
   */
  layout?: NfcIdCardLayout;
  /** `record.isPrimary` — the card the backend hands out first. */
  isPrimary?: boolean;
  /** Accepted for call-site compatibility; deliberately not drawn (§4). */
  profileType?: string;
  views?: number;
  verified?: boolean;
  /** Extra state line, e.g. "To'lov kutilmoqda" for a pending order. */
  statusLabel?: string;
  /** One reflection sweep on mount. Off inside dense lists, where a sweep
   * per row reads as noise rather than as light. */
  sheen?: boolean;
  /** Suppresses the press animation/haptic when a parent owns the gesture. */
  disabled?: boolean;
  accessibilityHint?: string;
}

/**
 * A single NFC ID, rendered as the physical object it is: brushed metal of
 * the card's own tier, a machined hairline edge, and the code itself as the
 * hero — nothing else unless it changes what the user would do.
 *
 * The minimalism here is deliberate (design brief §4): tier is carried by
 * the *metal*, not by a badge; ownership state is at most ONE cue; view
 * counts and profile types only survive in the `row` layout, where the
 * screen is a management list rather than a wallet.
 */
export function NfcIdCard({
  code,
  name,
  state,
  onPress,
  index = 0,
  layout = 'carousel',
  isPrimary = false,
  views,
  verified = false,
  statusLabel,
  sheen,
  disabled = false,
  accessibilityHint,
}: NfcIdCardProps) {
  const tier = tierForCode(code);
  const m = metal[tier];
  const isRow = layout === 'row';
  const press = useSharedValue(0);

  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - press.value * (1 - PRESS_SCALE) }],
  }));

  const setPressed = (down: boolean) => {
    press.value = withTiming(down ? 1 : 0, { duration: motion.pressDurationMs });
  };

  // Exactly one state cue survives, in order of how much it changes what the
  // user should do next: an explicit label, then payment-pending, then the
  // primary card, then verification.
  const cue =
    statusLabel?.trim() ||
    (state === 'pending' ? 'KUTILMOQDA' : isPrimary ? 'ASOSIY' : verified ? 'TASDIQLANGAN' : null);

  const safeCode = safeText(code, '—');
  const safeName = typeof name === 'string' && name.trim() ? name.trim() : null;
  const viewsLabel = typeof views === 'number' ? formatCount(views) : null;

  const label = [safeCode, safeName, cue].filter(Boolean).join(', ');

  return (
    <Pressable
      onPress={() => {
        if (disabled) return;
        haptics.selection();
        onPress();
      }}
      onPressIn={() => !disabled && setPressed(true)}
      onPressOut={() => setPressed(false)}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      style={layout === 'carousel' ? styles.carouselPressable : styles.fullPressable}
    >
      <Animated.View style={pressStyle}>
        <MetalSurface
          tier={tier}
          index={index}
          sheen={sheen ?? !isRow}
          cornerRadius={isRow ? radius.md : radius.lg}
          style={[
            styles.surface,
            { height: NFC_CARD_HEIGHT[layout] },
            layout === 'carousel' && styles.carouselSurface,
            !isRow && elevation.card,
          ]}
        >
          {isRow ? (
            <View style={styles.rowBody}>
              <View style={styles.rowText}>
                <Text style={[styles.codeRow, { color: m.text }]} numberOfLines={1}>
                  {safeCode}
                </Text>
                {!!safeName && (
                  <Text style={[styles.nameRow, { color: m.subtext }]} numberOfLines={1}>
                    {safeName}
                  </Text>
                )}
              </View>
              <View style={styles.rowTrailing}>
                {cue ? (
                  <Cue label={cue} tint={m.text} />
                ) : viewsLabel ? (
                  <View style={styles.viewsWrap}>
                    <Feather name="eye" size={12} color={m.subtext} />
                    <Text style={[styles.viewsText, { color: m.subtext }]} numberOfLines={1}>
                      {viewsLabel}
                    </Text>
                  </View>
                ) : null}
                <Feather name="chevron-right" size={18} color={m.subtext} />
              </View>
            </View>
          ) : (
            <View style={[styles.cardBody, layout === 'hero' && styles.cardBodyHero]}>
              <View style={styles.cardTop}>
                <Text style={[styles.tierMark, { color: m.subtext }]} numberOfLines={1}>
                  {TIER_LABEL[tier].toUpperCase()}
                </Text>
                {!!cue && <Cue label={cue} tint={m.text} />}
              </View>

              <View style={styles.cardBottom}>
                <Text
                  style={[
                    styles.code,
                    layout === 'hero' && styles.codeHero,
                    layout === 'carousel' && styles.codeCarousel,
                    { color: m.text },
                  ]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {safeCode}
                </Text>
                <View style={styles.cardFooter}>
                  <Text style={[styles.name, { color: m.subtext }]} numberOfLines={1}>
                    {safeName ?? ' '}
                  </Text>
                  <Feather name="wifi" size={16} color={m.subtext} style={styles.contactless} />
                </View>
              </View>
            </View>
          )}
        </MetalSurface>
      </Animated.View>
    </Pressable>
  );
}

/** The single state cue a card is allowed to carry. */
function Cue({ label, tint }: { label: string; tint: string }) {
  return (
    <View style={[styles.cue, { borderColor: tint }]}>
      <Text style={[styles.cueText, { color: tint }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const PRESS_SCALE = 0.985;

const styles = StyleSheet.create({
  carouselPressable: { marginRight: space.md },
  fullPressable: { width: '100%' },
  surface: { width: '100%' },
  carouselSurface: { width: CAROUSEL_WIDTH },

  cardBody: { flex: 1, padding: space.lg, justifyContent: 'space-between' },
  cardBodyHero: { padding: space.xl },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  cardBottom: {},
  cardFooter: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: space.sm },
  tierMark: { ...typeTokens.overline },
  code: { ...typeTokens.monoLarge, fontSize: 26, letterSpacing: 2 },
  codeHero: { fontSize: 32, letterSpacing: 3 },
  codeCarousel: { fontSize: 22, letterSpacing: 1.5 },
  name: { ...typeTokens.caption, flex: 1, marginTop: 2 },
  contactless: { transform: [{ rotate: '90deg' }], opacity: 0.9 },

  rowBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    gap: space.md,
  },
  rowText: { flex: 1 },
  codeRow: { ...typeTokens.monoLarge, fontSize: 20, letterSpacing: 1.5 },
  nameRow: { ...typeTokens.caption, marginTop: 2 },
  rowTrailing: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  viewsWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  viewsText: { ...typeTokens.caption },

  cue: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    maxWidth: 150,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  cueText: { ...typeTokens.caption, fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
});
