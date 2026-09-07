import React, { useCallback, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { MetalSurface } from '../design-system/components/MetalSurface';
import { GoldSheen } from '../design-system/components/GoldSheen';
import { TierBadge } from '../design-system/components/PremiumBadge';
import { EmbossOverlay, NfcChip, NfcContactlessIcon } from './NfcChip';
import { NfcPressable } from './NfcPressable';
import { tierForCode, TIER_LABEL } from '../lib/pricing';
import { formatCount, safeText } from '../lib/format';
import { haptics } from '../native/haptics';
import { color, depth, font, gradient, metal, radius, space, type as typeTokens } from '../design-system/tokens';

/** Layout variants, from the densest to the most ceremonial.
 *
 * `row` is the only one that stays compact enough for a scrolling list of
 * pending orders; `list` is the management card ("Mening ID'larim");
 * everything else is a full metal card with a credit-card silhouette. */
export type NfcIdCardLayout = 'carousel' | 'row' | 'stack' | 'hero' | 'list';

/** Fixed geometry so a wallet can do its layout math without measuring.
 * `carousel` and `hero` follow the ISO card proportion when a width is
 * known; these are their fallbacks. */
export const NFC_CARD_HEIGHT: Record<NfcIdCardLayout, number> = {
  carousel: 156,
  row: 92,
  stack: 152,
  hero: 207,
  list: 140,
};

/** ISO/IEC 7810 ID-1 — the proportion of the card in your wallet. */
export const NFC_CARD_ASPECT = 1.586;
const CAROUSEL_WIDTH = 248;
/**
 * The hero face never grows past a real card held at arm's length: 328 dp
 * wide is 207 dp tall (ISO proportion) — the full content width on a
 * 360 dp phone, centred with air around it on anything wider. */
export const NFC_HERO_MAX_WIDTH = 328;

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
  /**
   * Opens the ID. On every layout but `hero` this is the tap. On `hero` a
   * tap flips the card over instead, and `onPress` moves to the small
   * ghost button under the card (`actionLabel`) and to a long-press on the
   * card itself — the navigation is never lost, only the tap is spent on
   * the object.
   */
  onPress: () => void;
  index?: number;
  /**
   * `carousel` — a fixed-width tile in a horizontal wallet.
   * `row` — the compact full-width entry for pending orders.
   * `list` — the management card on "Mening ID'larim".
   * `stack` — a full-width card. `hero` — the single card a screen is
   * about: credit-card proportioned, standing in 3D, flips on tap.
   */
  layout?: NfcIdCardLayout;
  /** Explicit width for `carousel` tiles (the wallet sizes them to the screen). */
  width?: number;
  /** `record.isPrimary` — the card the backend hands out first. */
  isPrimary?: boolean;
  /** Accepted for call-site compatibility; deliberately not drawn (§4). */
  profileType?: string;
  views?: number;
  verified?: boolean;
  /** Extra state line, e.g. "To'lov kutilmoqda" for a pending order. */
  statusLabel?: string;
  /** One reflection sweep on mount. Off inside dense lists, where a sweep
   * per row reads as noise rather than as light. The hero ignores this and
   * loops the website's 3.6 s shimmer instead. */
  sheen?: boolean;
  /** Suppresses the press animation/haptic when a parent owns the gesture. */
  disabled?: boolean;
  accessibilityHint?: string;
  /** `hero` only — label of the ghost button under the card that fires
   * `onPress`. Defaults to "Ochish"; pass what the press actually does
   * ("Ulashish", "Ko'rish") when it is not a plain open. */
  actionLabel?: string;
}

const FLIP_SPRING = { damping: 15, stiffness: 130, mass: 0.9 } as const;

/**
 * A single NFC ID, rendered as the physical object it is, in the same
 * metal the website gives that tier (`metal[tier]`, ported from
 * src/components/NfcCard.jsx): the tier's diagonal gradient, a fine
 * brushed grain, an embossed contact chip with the contactless waves
 * beside it, a glass specular streak across the top third, and the code
 * itself in the tier's own code colour. Gold and Silver are light metals
 * with dark lettering; every other tier is dark with light lettering.
 *
 * The `hero` layout is the one the user holds: credit-card proportioned
 * (ISO 7810, at most `NFC_HERO_MAX_WIDTH` wide), standing in 3D
 * (perspective 800, rotateX 4°, rotateY -3°), floating on
 * `depth.cardHero` with a radial glow in its own metal behind it, and a
 * looping 3.6 s sheen. Tapping it flips it over — one spring-driven
 * `rotateY` on the UI thread, back faces hidden — to a restrained brand
 * back: the NFCSTORE wordmark, the contactless glyph, a hairline and the
 * code in small tabular figures. Every layout presses with the same
 * micro-depth (`NfcPressable`).
 */
export function NfcIdCard({
  code,
  name,
  state,
  onPress,
  index = 0,
  layout = 'carousel',
  width,
  isPrimary = false,
  views,
  verified = false,
  statusLabel,
  sheen,
  disabled = false,
  accessibilityHint,
  actionLabel = 'Ochish',
}: NfcIdCardProps) {
  const tier = tierForCode(code);
  const m = metal[tier];
  const isRow = layout === 'row';
  const isList = layout === 'list';
  const isHero = layout === 'hero';

  // Exactly one state cue survives, in order of how much it changes what the
  // user should do next: an explicit label, then payment-pending, then the
  // primary card, then verification.
  const cue =
    statusLabel?.trim() ||
    (state === 'pending' ? 'KUTILMOQDA' : isPrimary ? 'ASOSIY' : verified ? 'TASDIQLANGAN' : null);
  const primaryCue = cue === 'ASOSIY';

  const safeCode = safeText(code, '—');
  const safeName = typeof name === 'string' && name.trim() ? name.trim() : null;
  const viewsLabel = typeof views === 'number' ? formatCount(views) : null;

  const label = [safeCode, safeName, cue].filter(Boolean).join(', ');

  const cornerRadius = isRow ? radius.md : radius.lg;
  const geometry =
    isHero
      ? styles.heroGeometry
      : layout === 'carousel'
        ? { width: width ?? CAROUSEL_WIDTH, height: Math.round((width ?? CAROUSEL_WIDTH) / NFC_CARD_ASPECT) }
        : { width: '100%' as const, height: NFC_CARD_HEIGHT[layout] };

  // Chips and cues sit on the metal itself, so their scrim flips with it.
  const onLight = m.darkText;
  const chipBorder = onLight ? 'rgba(0,0,0,0.14)' : 'rgba(255,255,255,0.10)';
  const chipFill = onLight ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.05)';
  const waveTint = onLight ? m.subtext : undefined;

  const open = () => {
    if (disabled) return;
    haptics.selection();
    onPress();
  };

  const surface = (
    <View style={[styles.shadowHost, { borderRadius: cornerRadius }, isHero ? depth.cardHero : isRow ? depth.chip : depth.card]}>
      <MetalSurface
        tier={tier}
        index={index}
        sheen={isHero ? false : (sheen ?? !(isRow || isList))}
        cornerRadius={cornerRadius}
        style={[styles.surface, geometry]}
      >
        {!isRow && <Grain />}
        {isHero && <GoldSheen loop index={index} band={0.5} intensity={onLight ? 0.5 : 0.65} />}

        {isRow ? (
          <View style={styles.rowBody}>
            <View style={styles.rowText}>
              <Text style={[styles.codeRow, { color: m.code }]} numberOfLines={1}>
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
                <Cue label={cue} tint={m.text} onLight={onLight} primary={primaryCue} />
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
        ) : isList ? (
          <View style={styles.listBody}>
            <View style={styles.listMain}>
              <View style={styles.cardTop}>
                <TierBadge tier={tier} />
                {!!cue && <Cue label={cue} tint={m.text} onLight={onLight} primary={primaryCue} />}
              </View>
              <Text style={[styles.code, styles.codeList, { color: m.code }]} numberOfLines={1} adjustsFontSizeToFit>
                {safeCode}
              </Text>
              <Text style={[styles.name, { color: m.text }]} numberOfLines={1}>
                {safeName ?? ' '}
              </Text>
              <View style={styles.listChips}>
                <StatChip icon="eye" label={viewsLabel ?? '0'} tint={m.subtext} border={chipBorder} fill={chipFill} />
                {verified && (
                  <StatChip
                    icon="check-circle"
                    label="Tasdiqlangan"
                    tint={onLight ? m.text : color.success}
                    border={chipBorder}
                    fill={chipFill}
                  />
                )}
              </View>
            </View>
            <View style={styles.listTrailing}>
              <NfcContactlessIcon size={18} tint={m.subtext} />
              <Feather name="chevron-right" size={18} color={m.subtext} />
            </View>
          </View>
        ) : (
          <View style={[styles.cardBody, isHero && styles.cardBodyHero]}>
            <View style={styles.cardTop}>
              <NfcChip width={isHero ? 40 : 34} waveTint={waveTint} />
              {!!cue && <Cue label={cue} tint={m.text} onLight={onLight} primary={primaryCue} sheen={isHero && primaryCue} />}
            </View>

            <View style={styles.cardBottom}>
              <Text
                style={[
                  styles.code,
                  isHero && styles.codeHero,
                  layout === 'carousel' && styles.codeCarousel,
                  { color: m.code },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {safeCode}
              </Text>
              <View style={styles.cardFooter}>
                <Text style={[styles.name, { color: m.text }]} numberOfLines={1}>
                  {safeName ?? ' '}
                </Text>
                <Text style={[styles.tierMark, { color: m.subtext }]} numberOfLines={1}>
                  {TIER_LABEL[tier].toUpperCase()}
                </Text>
              </View>
            </View>
          </View>
        )}

        {!isRow && <Specular light={onLight} />}
      </MetalSurface>
    </View>
  );

  if (isHero) {
    return (
      <HeroStage
        tier={tier}
        front={surface}
        code={safeCode}
        cornerRadius={cornerRadius}
        index={index}
        label={label}
        accessibilityHint={accessibilityHint}
        actionLabel={actionLabel}
        disabled={disabled}
        onOpen={open}
      />
    );
  }

  return (
    <NfcPressable
      radius={cornerRadius}
      onPress={open}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      style={layout === 'carousel' ? undefined : styles.fullPressable}
    >
      {surface}
    </NfcPressable>
  );
}

/**
 * The hero's 3D stage: glow, static tilt, the two-faced flipping card and
 * the ghost "open" affordance beneath it. One shared value (`flip`, 0 or
 * 1) drives both faces on the UI thread; no React state changes per flip.
 */
function HeroStage({
  tier,
  front,
  code,
  cornerRadius,
  index,
  label,
  accessibilityHint,
  actionLabel,
  disabled,
  onOpen,
}: {
  tier: keyof typeof metal;
  front: React.ReactNode;
  code: string;
  cornerRadius: number;
  index: number;
  label: string;
  accessibilityHint?: string;
  actionLabel: string;
  disabled: boolean;
  onOpen: () => void;
}) {
  const m = metal[tier];
  const flip = useSharedValue(0);
  const flipped = useRef(false);

  const toggle = useCallback(() => {
    if (disabled) return;
    haptics.selection();
    flipped.current = !flipped.current;
    flip.value = withSpring(flipped.current ? 1 : 0, FLIP_SPRING);
  }, [disabled, flip]);

  const frontStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 1000 }, { rotateY: `${flip.value * 180}deg` }],
  }));
  const backStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 1000 }, { rotateY: `${180 + flip.value * 180}deg` }],
  }));

  const safeAction = actionLabel.trim() || 'Ochish';

  return (
    <View style={styles.heroStage}>
      <HeroGlow tint={m.glow} />
      <View style={styles.heroTilt}>
        <NfcPressable
          radius={cornerRadius}
          onPress={toggle}
          onLongPress={onOpen}
          delayLongPress={380}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityHint="Bosing — karta ag'dariladi. Bosib turing — ochiladi."
          style={styles.heroPressable}
        >
          <View style={styles.heroFlipBox}>
            <Animated.View style={[styles.face, frontStyle]}>{front}</Animated.View>
            <Animated.View style={[styles.face, styles.faceBack, backStyle]}>
              <View style={[styles.shadowHost, styles.fill, { borderRadius: cornerRadius }, depth.cardHero]}>
                <MetalSurface tier={tier} sheen={false} cornerRadius={cornerRadius} style={styles.fill}>
                  <Grain />
                  <GoldSheen loop index={index + 1} band={0.5} intensity={m.darkText ? 0.4 : 0.5} />
                  <View style={styles.backBody}>
                    <View style={styles.backTop}>
                      <Text style={[styles.backWordmark, { color: m.text }]} numberOfLines={1}>
                        NFCSTORE
                      </Text>
                      <NfcContactlessIcon size={20} tint={m.subtext} />
                    </View>
                    <View style={[styles.backHairline, { backgroundColor: m.subtext }]} />
                    <View style={styles.backBottom}>
                      <Text style={[styles.backCode, { color: m.code }]} numberOfLines={1}>
                        {code}
                      </Text>
                      <Text style={[styles.backSite, { color: m.subtext }]} numberOfLines={1}>
                        nfcstore.uz/{code.toLowerCase()}
                      </Text>
                    </View>
                  </View>
                  <Specular light={m.darkText} />
                </MetalSurface>
              </View>
            </Animated.View>
          </View>
        </NfcPressable>
      </View>

      <View style={styles.heroActions}>
        <Text style={styles.heroHint} numberOfLines={1}>
          Ag'darish uchun bosing
        </Text>
        <NfcPressable
          radius={radius.pill}
          onPress={onOpen}
          disabled={disabled}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`${safeAction}: ${code}`}
          accessibilityHint={accessibilityHint}
        >
          <View style={styles.openButton}>
            <Text style={styles.openText} numberOfLines={1}>
              {safeAction}
            </Text>
            <Feather name="arrow-up-right" size={13} color={color.gold} />
          </View>
        </NfcPressable>
      </View>
    </View>
  );
}

/** Fine diagonal brushed-metal grain — one gradient with many alternating
 * stops, so it costs the same as any other gradient layer. */
const GRAIN_STOPS = 84;
const GRAIN_COLORS = Array.from({ length: GRAIN_STOPS }, (_, i) =>
  i % 2 === 0 ? 'rgba(255,255,255,0)' : 'rgba(255,244,214,0.035)',
) as unknown as readonly [string, string, ...string[]];

function Grain() {
  return (
    <LinearGradient
      colors={GRAIN_COLORS}
      start={{ x: 0, y: 0.15 }}
      end={{ x: 1, y: 0.85 }}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    />
  );
}

/** A glass-like specular streak across the top third of the card — light
 * reflecting off a lacquered surface, tilted the way a card is held (the
 * web's tilt highlight, frozen at the angle a hand holds a card). */
const SPECULAR = ['rgba(255,250,235,0.16)', 'rgba(255,250,235,0.05)', 'rgba(255,250,235,0)'] as const;
const SPECULAR_LIGHT = ['rgba(255,255,255,0.30)', 'rgba(255,255,255,0.08)', 'rgba(255,255,255,0)'] as const;

function Specular({ light = false }: { light?: boolean }) {
  return (
    <View style={styles.specularTrack} pointerEvents="none">
      <LinearGradient
        colors={light ? SPECULAR_LIGHT : SPECULAR}
        locations={[0, 0.55, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.15, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

/** The soft radial glow bleeding out from behind the hero card, in the
 * card's own metal. */
function HeroGlow({ tint }: { tint: string }) {
  return (
    <View style={styles.heroGlow} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient id="nfcHeroGlow" cx="50%" cy="50%" rx="50%" ry="58%">
            <Stop offset="0" stopColor={tint} stopOpacity={1} />
            <Stop offset="0.55" stopColor={color.gold} stopOpacity={0.14} />
            <Stop offset="1" stopColor={color.gold} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse cx="50%" cy="50%" rx="50%" ry="50%" fill="url(#nfcHeroGlow)" />
      </Svg>
    </View>
  );
}

/** The single state cue a card is allowed to carry. ASOSIY outranks every
 * other cue: solid champagne gold, embossed, with a crown. */
function Cue({
  label,
  tint,
  onLight,
  primary,
  sheen = false,
}: {
  label: string;
  tint: string;
  onLight: boolean;
  primary: boolean;
  sheen?: boolean;
}) {
  if (primary) {
    return (
      <View style={[styles.cuePrimary, onLight && styles.cuePrimaryOnLight]}>
        <LinearGradient
          colors={gradient.goldButton}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {sheen && <GoldSheen loop index={0} band={0.55} intensity={0.8} />}
        <MaterialCommunityIcons name="crown" size={11} color={color.textOnGold} />
        <Text style={[styles.cueText, { color: color.textOnGold }]} numberOfLines={1}>
          {label}
        </Text>
        <EmbossOverlay radius={radius.pill} />
      </View>
    );
  }
  return (
    <View style={[styles.cue, { borderColor: tint, backgroundColor: onLight ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.22)' }]}>
      <Text style={[styles.cueText, { color: tint }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function StatChip({
  icon,
  label,
  tint,
  border,
  fill,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  tint: string;
  border: string;
  fill: string;
}) {
  return (
    <View style={[styles.statChip, { borderColor: border, backgroundColor: fill }]}>
      <Feather name={icon} size={11} color={tint} />
      <Text style={[styles.statChipText, { color: tint }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fullPressable: { width: '100%' },
  shadowHost: { backgroundColor: 'transparent' },
  surface: {},
  fill: { flex: 1 },

  heroStage: { paddingTop: space.sm, paddingBottom: space.xs, paddingHorizontal: space.xs },
  heroGlow: { position: 'absolute', top: -space.lg, bottom: 0, left: -space.xl, right: -space.xl },
  heroTilt: {
    transform: [{ perspective: 800 }, { rotateX: '4deg' }, { rotateY: '-3deg' }],
  },
  heroPressable: { width: '100%', maxWidth: NFC_HERO_MAX_WIDTH, alignSelf: 'center' },
  heroFlipBox: { width: '100%' },
  heroGeometry: { width: '100%', aspectRatio: NFC_CARD_ASPECT },
  face: { backfaceVisibility: 'hidden' },
  faceBack: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },

  heroActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
    marginTop: space.md,
    paddingHorizontal: space.xs,
    width: '100%',
    maxWidth: NFC_HERO_MAX_WIDTH,
    alignSelf: 'center',
  },
  heroHint: { ...typeTokens.caption, fontSize: 11, color: color.textTertiary, flex: 1 },
  openButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 32,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.borderGold,
    backgroundColor: color.goldWash,
  },
  openText: { ...typeTokens.overline, fontSize: 11, lineHeight: 14, color: color.gold, letterSpacing: 1 },

  backBody: { flex: 1, paddingHorizontal: space.xl, paddingVertical: space.lg + 2, justifyContent: 'space-between' },
  backTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backWordmark: { fontFamily: font.serif, fontSize: 13, lineHeight: 18, letterSpacing: 4 },
  backHairline: { height: StyleSheet.hairlineWidth * 2, width: '100%', opacity: 0.85 },
  backBottom: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: space.sm },
  backCode: { ...typeTokens.mono, fontSize: 13, lineHeight: 16, letterSpacing: 2.4 },
  backSite: { ...typeTokens.caption, fontSize: 10, lineHeight: 13, letterSpacing: 0.6, flexShrink: 1 },

  specularTrack: {
    position: 'absolute',
    top: -6,
    left: -8,
    right: -8,
    height: '38%',
    transform: [{ rotate: '-4deg' }],
  },

  cardBody: { flex: 1, padding: space.lg, justifyContent: 'space-between' },
  cardBodyHero: { paddingHorizontal: space.xl, paddingVertical: space.lg + 4 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  cardBottom: {},
  cardFooter: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: space.sm },
  tierMark: { ...typeTokens.overline, fontSize: 10 },
  code: { ...typeTokens.monoLarge, fontSize: 26, letterSpacing: 2 },
  codeHero: { fontSize: 30, lineHeight: 36, letterSpacing: 3 },
  codeCarousel: { fontSize: 24, letterSpacing: 2 },
  codeList: { fontSize: 26, lineHeight: 32, letterSpacing: 2.5, marginTop: space.xs },
  name: { ...typeTokens.caption, flex: 1, marginTop: 2 },

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

  listBody: { flex: 1, flexDirection: 'row', alignItems: 'stretch', padding: space.lg, gap: space.md },
  listMain: { flex: 1, justifyContent: 'space-between' },
  listTrailing: { alignItems: 'center', justifyContent: 'space-between', paddingVertical: 2 },
  listChips: { flexDirection: 'row', gap: space.xs, marginTop: space.sm },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  statChipText: { ...typeTokens.caption, fontSize: 11, lineHeight: 14 },

  cue: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    maxWidth: 150,
  },
  cuePrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    overflow: 'hidden',
    borderRadius: radius.pill,
    paddingHorizontal: space.sm + 2,
    paddingVertical: 4,
    maxWidth: 150,
    backgroundColor: color.goldDark,
    ...depth.emboss,
  },
  /** On a gold card the gold ASOSIY pill needs a dark rim to stay a pill. */
  cuePrimaryOnLight: { borderWidth: 1, borderColor: 'rgba(26,18,6,0.45)' },
  cueText: { ...typeTokens.overline, fontSize: 10, lineHeight: 13, letterSpacing: 0.9 },
});
