import React, { useEffect } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type AccessibilityRole,
  type AccessibilityState,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { PremiumCard } from '../../design-system/components/PremiumCard';
import { PremiumButton } from '../../design-system/components/PremiumButton';
import {
  color,
  depth,
  font,
  gradient,
  medallion,
  motion,
  radius,
  space,
  type as typeTokens,
} from '../../design-system/tokens';
import { haptics } from '../../native/haptics';

/**
 * Small shared surfaces the three auction screens are assembled from.
 *
 * They exist so the section reads as one product: the same chip, the same
 * metric tile, the same banner geometry on the list, the detail and the
 * payment screen — all built from design-system tokens only, with gold kept
 * as an accent on near-black rather than a fill.
 *
 * The tactile primitives at the bottom (`TactilePressable`, `GoldMedallion`,
 * `FloatingMedallion`) are the physical vocabulary the Company and ID
 * screens share with this section: press compression with an inner shadow,
 * a gold glow on release, and embossed gold discs.
 */

export type AuctionTone = 'neutral' | 'gold' | 'success' | 'warning' | 'danger' | 'live' | 'info';

export function toneColor(tone: AuctionTone): string {
  switch (tone) {
    case 'gold':
      return color.gold;
    case 'success':
      return color.success;
    case 'warning':
      return color.warning;
    case 'danger':
      return color.danger;
    case 'live':
      return color.live;
    case 'info':
      return color.info;
    default:
      return color.textSecondary;
  }
}

/** `#RRGGBB` -> `rgba(...)`; anything else is returned untouched so a bad
 * value can never render as `NaN` inside a style. */
function withAlpha(hex: string, alpha: number): string {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

export interface MetaChipProps {
  icon?: React.ComponentProps<typeof Feather>['name'];
  label: string;
  tone?: AuctionTone;
}

/** Compact fact pill — "Qadam: 50 000 so'm", "Siz yetakchisiz", "12 taklif". */
export function MetaChip({ icon, label, tone = 'neutral' }: MetaChipProps) {
  const tint = toneColor(tone);
  return (
    <View style={[styles.chip, tone !== 'neutral' && { borderColor: withAlpha(tint, 0.5) }]}>
      <LinearGradient
        colors={CHIP_FILL}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {!!icon && <Feather name={icon} size={11} color={tint} />}
      <Text style={[styles.chipText, tone !== 'neutral' && { color: tint }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export interface MetricTileProps {
  label: string;
  /** Pre-formatted display string (`formatSom`/`formatCount`/`formatDateTime`),
   * so a missing figure arrives here already degraded to "—". */
  value?: string;
  /** Live content instead of a static value — e.g. an `AuctionCountdown`. */
  children?: React.ReactNode;
  tone?: AuctionTone;
  style?: StyleProp<ViewStyle>;
}

/** One number with its caption, on a glass tile: card gradient, a lip of
 * light along the top and a contact shadow so it rests on the card. */
export function MetricTile({ label, value, children, tone = 'neutral', style }: MetricTileProps) {
  return (
    <View style={[styles.tile, style]}>
      <LinearGradient
        colors={gradient.cardSurface}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.7, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <LinearGradient
        colors={gradient.cardGlass}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <LinearGradient colors={TILE_LIP} style={styles.tileLip} pointerEvents="none" />
      <Text style={styles.tileLabel} numberOfLines={1}>
        {label.toUpperCase()}
      </Text>
      {children ?? (
        <Text
          style={[styles.tileValue, tone !== 'neutral' && { color: toneColor(tone) }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
        >
          {value ?? '—'}
        </Text>
      )}
    </View>
  );
}

export interface InfoBannerProps {
  icon?: React.ComponentProps<typeof Feather>['name'];
  tone?: AuctionTone;
  title: string;
  description?: string;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** The section's one banner shape: a tinted rail, an icon, a title and an
 * honest sentence. Used for "siz yetakchisiz", "to'lovlar yopiq", "yutdingiz". */
export function InfoBanner({ icon = 'info', tone = 'neutral', title, description, children, style }: InfoBannerProps) {
  const tint = toneColor(tone);
  return (
    <PremiumCard variant="sunken" animate={false} style={[styles.banner, style]} contentStyle={styles.bannerContent}>
      <View style={[styles.bannerRail, { backgroundColor: tint, boxShadow: `0 0 10px ${withAlpha(tint, 0.45)}` }]} />
      <View style={styles.bannerBody}>
        <View style={styles.bannerHeading}>
          <Feather name={icon} size={14} color={tint} />
          <Text style={[styles.bannerTitle, { color: tint }]} numberOfLines={2}>
            {title}
          </Text>
        </View>
        {!!description && <Text style={styles.bannerText}>{description}</Text>}
        {children}
      </View>
    </PremiumCard>
  );
}

/** The single, honest rendering of the live backend state: bidding and
 * auction payment both answer `503 payments_disabled` today. Never phrased as
 * an error, never as a temporary glitch — it is a product state. */
export function PaymentsClosedNotice({ description, style }: { description?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <InfoBanner
      icon="lock"
      tone="warning"
      title="To'lovlar hozircha yopiq"
      description={description ?? "To'lov tizimi yoqilgach, taklif berish va to'lash shu yerdan ishlaydi."}
      style={style}
    />
  );
}

export function SectionLabel({ title, trailing }: { title: string; trailing?: string }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionTitle} numberOfLines={1}>
        {title}
      </Text>
      {!!trailing && (
        <Text style={styles.sectionTrailing} numberOfLines={1}>
          {trailing}
        </Text>
      )}
    </View>
  );
}

/** Thin gold progress rail (demand board). `progress` is pre-clamped to 0…1
 * by `demandProgress`, so no NaN width can reach the layout. */
export function ProgressBar({ progress, tone = 'gold' }: { progress: number; tone?: AuctionTone }) {
  const pct = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  const tint = toneColor(tone);
  return (
    <View style={styles.progressTrack}>
      <View
        style={[
          styles.progressFill,
          { width: `${Math.round(pct * 100)}%`, backgroundColor: tint, boxShadow: `0 0 8px ${withAlpha(tint, 0.55)}` },
        ]}
      >
        {tone === 'gold' && (
          <LinearGradient
            colors={gradient.goldButton}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
        )}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ *
 * Tactile primitives
 * ------------------------------------------------------------------ */

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface TactilePressableProps {
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Corner radius of the surface inside, so the press well and the release
   * glow follow its outline instead of drawing a rectangle over it. */
  cornerRadius?: number;
  haptic?: 'selection' | 'light' | 'none';
  accessibilityLabel?: string;
  accessibilityRole?: AccessibilityRole;
  accessibilityState?: AccessibilityState;
  testID?: string;
}

const RELEASE_MS = 160;
const GLOW_IN_MS = 120;
const GLOW_OUT_MS = 560;

/**
 * Micro-depth on tap for every card, chip and row in these sections.
 *
 * Press: the surface compresses to `motion.pressScale` and an inner shadow
 * appears, so the thing physically sinks into the screen. Release: it springs
 * back and a soft gold glow blooms and fades — the light catching the metal
 * as it comes back up. All three values live on the UI thread.
 *
 * Margins belong on this wrapper, not on the child: the well and the glow
 * are absolutely positioned over the wrapper's box.
 */
export function TactilePressable({
  onPress,
  onLongPress,
  disabled = false,
  children,
  style,
  cornerRadius = radius.lg,
  haptic = 'selection',
  accessibilityLabel,
  accessibilityRole = 'button',
  accessibilityState,
  testID,
}: TactilePressableProps) {
  const pressed = useSharedValue(0);
  const glow = useSharedValue(0);

  const bodyStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * (1 - motion.pressScale) }],
  }));
  const wellStyle = useAnimatedStyle(() => ({ opacity: pressed.value }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value }));

  const handlePressIn = () => {
    if (disabled) return;
    glow.value = withTiming(0, { duration: 60 });
    pressed.value = withTiming(1, { duration: motion.pressDurationMs });
  };
  const handlePressOut = () => {
    pressed.value = withTiming(0, { duration: RELEASE_MS, easing: Easing.out(Easing.cubic) });
    glow.value = withSequence(
      withTiming(1, { duration: GLOW_IN_MS }),
      withTiming(0, { duration: GLOW_OUT_MS, easing: Easing.out(Easing.quad) }),
    );
  };
  const handlePress = () => {
    if (disabled) return;
    if (haptic === 'selection') haptics.selection();
    else if (haptic === 'light') haptics.light();
    onPress?.();
  };

  return (
    <AnimatedPressable
      onPress={onPress ? handlePress : undefined}
      onLongPress={onLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={accessibilityState}
      testID={testID}
      style={[styles.tactileRoot, bodyStyle, style]}
    >
      <Animated.View
        pointerEvents="none"
        style={[styles.tactileGlow, { borderRadius: cornerRadius }, glowStyle]}
      />
      {children}
      <Animated.View
        pointerEvents="none"
        style={[styles.tactileWell, { borderRadius: cornerRadius }, wellStyle]}
      />
    </AnimatedPressable>
  );
}

export type MedallionTier = keyof typeof medallion;

export interface GoldMedallionProps {
  size?: number;
  /** Which metal the disc is struck from; defaults to gold. */
  tier?: MedallionTier;
  /** A numeral, an icon — rendered dark on the metal. */
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** Specular corner where the light source sits. */
const DISC_SPECULAR = ['rgba(255,255,255,0.42)', 'rgba(255,255,255,0.08)', 'transparent'] as const;
/** Weight along the bottom so the disc has thickness. */
const DISC_UNDERSHADE = ['transparent', 'rgba(40,25,0,0.30)'] as const;

/**
 * An embossed metal disc — the numbered step, the tier coin, the empty-state
 * emblem. The outer view carries the drop shadow, the clipped inner view the
 * metal gradient, and a top overlay carries the inset highlight/shade that
 * makes the rim read as pressed metal rather than a flat yellow circle.
 */
export function GoldMedallion({ size = 32, tier = 'gold', children, style }: GoldMedallionProps) {
  const box = { width: size, height: size, borderRadius: size / 2 };
  return (
    <View style={[styles.medallionOuter, box, style]}>
      <View style={[styles.medallionClip, box]}>
        <LinearGradient
          colors={medallion[tier] as unknown as readonly [string, string, string]}
          locations={[0, 0.55, 1]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <LinearGradient
          colors={DISC_SPECULAR}
          locations={[0, 0.45, 1]}
          start={{ x: 0.15, y: 0 }}
          end={{ x: 0.7, y: 0.9 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <LinearGradient
          colors={DISC_UNDERSHADE}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <View style={styles.medallionContent}>{children}</View>
        <View style={[styles.medallionEmboss, box]} pointerEvents="none" />
      </View>
    </View>
  );
}

export interface FloatingMedallionProps {
  icon?: React.ComponentProps<typeof Feather>['name'];
  size?: number;
}

const BOB_MS = 2200;
const BOB_PX = 7;

/**
 * The empty-state emblem: a large gold medallion hovering over its own
 * contact shadow, with a warm halo behind it. The bob is a single UI-thread
 * timing loop; the shadow flattens and fades as the disc rises.
 */
export function FloatingMedallion({ icon = 'award', size = 84 }: FloatingMedallionProps) {
  const lift = useSharedValue(0);

  useEffect(() => {
    lift.value = withRepeat(withTiming(1, { duration: BOB_MS, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [lift]);

  const discStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -BOB_PX * lift.value }],
  }));
  const shadowStyle = useAnimatedStyle(() => ({
    opacity: 0.6 - 0.3 * lift.value,
    transform: [{ scaleX: 1 - 0.16 * lift.value }],
  }));

  const halo = size * 2.1;
  return (
    <View style={[styles.floatWrap, { width: halo, height: halo }]}>
      <LinearGradient
        colors={FLOAT_HALO}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={[styles.floatHalo, { width: halo, height: halo, borderRadius: halo / 2 }]}
        pointerEvents="none"
      />
      <Animated.View
        pointerEvents="none"
        style={[styles.floatShadow, { width: size * 0.8, top: halo / 2 + size / 2 + 6 }, shadowStyle]}
      />
      <Animated.View style={[styles.floatDisc, discStyle]}>
        <GoldMedallion size={size} style={styles.floatGlow}>
          <Feather name={icon} size={Math.round(size * 0.42)} color={color.textOnGold} />
        </GoldMedallion>
      </Animated.View>
    </View>
  );
}

export interface AuctionEmptyStateProps {
  icon?: React.ComponentProps<typeof Feather>['name'];
  title: string;
  description?: string;
  ctaLabel?: string;
  onPressCta?: () => void;
}

/** The honest "nothing here yet" for an auction tab — same shape as the
 * shared empty state, with the floating gold emblem as its centrepiece. */
export function AuctionEmptyState({ icon = 'award', title, description, ctaLabel, onPressCta }: AuctionEmptyStateProps) {
  return (
    <View style={styles.emptyWrap}>
      <FloatingMedallion icon={icon} />
      <Text style={styles.emptyTitle}>{title}</Text>
      {!!description && <Text style={styles.emptyDescription}>{description}</Text>}
      {!!ctaLabel && onPressCta && (
        <PremiumButton label={ctaLabel} onPress={onPressCta} variant="ghost" fullWidth={false} style={styles.emptyCta} />
      )}
    </View>
  );
}

const CHIP_FILL = ['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.015)'] as const;
const TILE_LIP = ['rgba(255,244,214,0.16)', 'rgba(255,244,214,0.03)', 'transparent'] as const;
const FLOAT_HALO = ['rgba(212,175,90,0.16)', 'rgba(212,175,90,0.05)', 'transparent'] as const;

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: space.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surfaceRaised,
    overflow: 'hidden',
    ...depth.chip,
  },
  chipText: { ...typeTokens.caption, color: color.textSecondary },

  tile: {
    flex: 1,
    backgroundColor: color.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    paddingHorizontal: space.md,
    paddingVertical: space.sm + 2,
    gap: 3,
    overflow: 'hidden',
    ...depth.chip,
  },
  tileLip: { position: 'absolute', top: 0, left: 0, right: 0, height: 2 },
  tileLabel: { ...typeTokens.overline, color: color.textTertiary },
  tileValue: { ...typeTokens.stat, fontSize: 17, lineHeight: 22, color: color.textPrimary },

  banner: { marginTop: space.md },
  bannerContent: { flexDirection: 'row', padding: space.md, gap: space.md },
  bannerRail: { width: 3, borderRadius: radius.pill, alignSelf: 'stretch' },
  bannerBody: { flex: 1, gap: space.xs },
  bannerHeading: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  bannerTitle: { ...typeTokens.bodyStrong, flex: 1 },
  bannerText: { ...typeTokens.caption, color: color.textSecondary, lineHeight: 18 },

  sectionRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: space.xl,
    marginBottom: space.sm,
    gap: space.sm,
  },
  sectionTitle: { ...typeTokens.h2, color: color.textPrimary, flex: 1 },
  sectionTrailing: { ...typeTokens.caption, color: color.textTertiary },

  progressTrack: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: color.surfaceSunken,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: radius.pill, overflow: 'hidden' },

  tactileRoot: { position: 'relative' },
  tactileGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    ...depth.glow,
  },
  tactileWell: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.10)',
    ...depth.buttonPressed,
  },

  medallionOuter: { backgroundColor: color.goldDark, ...depth.emboss },
  medallionClip: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  medallionContent: { alignItems: 'center', justifyContent: 'center' },
  medallionEmboss: {
    position: 'absolute',
    top: 0,
    left: 0,
    borderWidth: 1,
    borderColor: 'rgba(255,244,214,0.45)',
    ...depth.emboss,
  },

  floatWrap: { alignItems: 'center', justifyContent: 'center', marginBottom: space.sm },
  floatHalo: { position: 'absolute', top: 0, left: 0 },
  floatShadow: {
    position: 'absolute',
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(0,0,0,0.75)',
    boxShadow: '0 0 12px rgba(0,0,0,0.8)',
  },
  floatDisc: { alignItems: 'center', justifyContent: 'center' },
  floatGlow: { boxShadow: '0 0 34px rgba(212,175,90,0.42), 0 10px 22px rgba(0,0,0,0.6)' },

  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
    paddingVertical: space.xl,
    paddingHorizontal: space.xl,
  },
  emptyTitle: { ...typeTokens.h2, color: color.textPrimary, textAlign: 'center', letterSpacing: 0.2 },
  emptyDescription: {
    ...typeTokens.body,
    color: color.textSecondary,
    marginTop: space.sm,
    textAlign: 'center',
    maxWidth: 320,
  },
  emptyCta: { marginTop: space.lg, paddingHorizontal: space.xl },
});

/** Serif numeral for a numbered medallion — exported so step lists share it. */
export const medallionNumeral = {
  fontFamily: font.serif,
  fontSize: 14,
  lineHeight: 18,
  color: color.textOnGold,
} as const;
