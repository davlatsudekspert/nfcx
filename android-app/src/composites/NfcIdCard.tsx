import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { MetalSurface } from '../design-system/components/MetalSurface';
import { GoldSheen } from '../design-system/components/GoldSheen';
import { TierBadge } from '../design-system/components/PremiumBadge';
import { EmbossOverlay, NfcChip, NfcContactlessIcon } from './NfcChip';
import { NfcPressable } from './NfcPressable';
import { tierForCode, TIER_LABEL } from '../lib/pricing';
import { formatCount, safeText } from '../lib/format';
import { haptics } from '../native/haptics';
import { color, depth, gradient, metal, radius, space, type as typeTokens } from '../design-system/tokens';

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
  hero: 200,
  list: 144,
};

/** ISO/IEC 7810 ID-1 — the proportion of the card in your wallet. */
export const NFC_CARD_ASPECT = 1.586;
const CAROUSEL_WIDTH = 248;

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
   * `carousel` — a fixed-width tile in a horizontal wallet.
   * `row` — the compact full-width entry for pending orders.
   * `list` — the management card on "Mening ID'larim".
   * `stack` — a full-width card. `hero` — the single largest card on a
   * screen, standing in 3D with a gold glow behind it.
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
   * per row reads as noise rather than as light. */
  sheen?: boolean;
  /** Suppresses the press animation/haptic when a parent owns the gesture. */
  disabled?: boolean;
  accessibilityHint?: string;
}

/**
 * A single NFC ID, rendered as the physical object it is: brushed metal of
 * the card's own tier, a fine diagonal grain, an embossed contact chip with
 * the contactless waves beside it, a glass specular streak across the top
 * third, and the code itself in serif as the hero.
 *
 * The `hero` layout is the one the user holds: it stands in 3D
 * (perspective 800, rotateX 4°, rotateY -3°), floats on `depth.cardHero`,
 * and a radial gold glow bleeds out from behind it. Every layout presses
 * with the same micro-depth (`NfcPressable`).
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
      ? { width: '100%' as const, aspectRatio: NFC_CARD_ASPECT }
      : layout === 'carousel'
        ? { width: width ?? CAROUSEL_WIDTH, height: Math.round((width ?? CAROUSEL_WIDTH) / NFC_CARD_ASPECT) }
        : { width: '100%' as const, height: NFC_CARD_HEIGHT[layout] };

  const surface = (
    <View style={[styles.shadowHost, { borderRadius: cornerRadius }, isHero ? depth.cardHero : isRow ? depth.chip : depth.card]}>
      <MetalSurface
        tier={tier}
        index={index}
        sheen={sheen ?? !(isRow || isList)}
        cornerRadius={cornerRadius}
        style={[styles.surface, geometry]}
      >
        {!isRow && <Grain />}

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
                <Cue label={cue} tint={m.text} primary={primaryCue} />
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
                {!!cue && <Cue label={cue} tint={m.text} primary={primaryCue} />}
              </View>
              <Text style={[styles.code, styles.codeList, { color: m.text }]} numberOfLines={1} adjustsFontSizeToFit>
                {safeCode}
              </Text>
              <Text style={[styles.name, { color: m.subtext }]} numberOfLines={1}>
                {safeName ?? ' '}
              </Text>
              <View style={styles.listChips}>
                <StatChip icon="eye" label={viewsLabel ?? '0'} tint={m.subtext} />
                {verified && <StatChip icon="check-circle" label="Tasdiqlangan" tint={color.success} />}
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
              <NfcChip width={isHero ? 44 : 34} />
              {!!cue && <Cue label={cue} tint={m.text} primary={primaryCue} sheen={isHero && primaryCue} />}
            </View>

            <View style={styles.cardBottom}>
              <Text
                style={[
                  styles.code,
                  isHero && styles.codeHero,
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
                <Text style={[styles.tierMark, { color: m.subtext }]} numberOfLines={1}>
                  {TIER_LABEL[tier].toUpperCase()}
                </Text>
              </View>
            </View>
          </View>
        )}

        {!isRow && <Specular />}
      </MetalSurface>
    </View>
  );

  return (
    <NfcPressable
      radius={cornerRadius}
      onPress={() => {
        if (disabled) return;
        haptics.selection();
        onPress();
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      style={layout === 'carousel' ? undefined : styles.fullPressable}
    >
      {isHero ? (
        <View style={styles.heroStage}>
          <HeroGlow tint={m.glow} />
          <View style={styles.heroTilt}>{surface}</View>
        </View>
      ) : (
        surface
      )}
    </NfcPressable>
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
 * reflecting off a lacquered surface, tilted the way a card is held. */
const SPECULAR = ['rgba(255,250,235,0.16)', 'rgba(255,250,235,0.05)', 'rgba(255,250,235,0)'] as const;

function Specular() {
  return (
    <View style={styles.specularTrack} pointerEvents="none">
      <LinearGradient
        colors={SPECULAR}
        locations={[0, 0.55, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.15, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

/** The soft radial gold glow bleeding out from behind the hero card. */
function HeroGlow({ tint }: { tint: string }) {
  return (
    <View style={styles.heroGlow} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient id="nfcHeroGlow" cx="50%" cy="58%" rx="52%" ry="60%">
            <Stop offset="0" stopColor={tint} stopOpacity={1} />
            <Stop offset="0.55" stopColor={color.gold} stopOpacity={0.16} />
            <Stop offset="1" stopColor={color.gold} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse cx="50%" cy="58%" rx="50%" ry="50%" fill="url(#nfcHeroGlow)" />
      </Svg>
    </View>
  );
}

/** The single state cue a card is allowed to carry. ASOSIY outranks every
 * other cue: solid champagne gold, embossed, with a crown. */
function Cue({ label, tint, primary, sheen = false }: { label: string; tint: string; primary: boolean; sheen?: boolean }) {
  if (primary) {
    return (
      <View style={styles.cuePrimary}>
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
    <View style={[styles.cue, { borderColor: tint }]}>
      <Text style={[styles.cueText, { color: tint }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function StatChip({ icon, label, tint }: { icon: React.ComponentProps<typeof Feather>['name']; label: string; tint: string }) {
  return (
    <View style={styles.statChip}>
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

  heroStage: { paddingVertical: space.md, paddingHorizontal: space.xs },
  heroGlow: { position: 'absolute', top: -space.xl, bottom: -space.xl, left: -space.xl, right: -space.xl },
  heroTilt: {
    transform: [{ perspective: 800 }, { rotateX: '4deg' }, { rotateY: '-3deg' }],
  },

  specularTrack: {
    position: 'absolute',
    top: -6,
    left: -8,
    right: -8,
    height: '38%',
    transform: [{ rotate: '-4deg' }],
  },

  cardBody: { flex: 1, padding: space.lg, justifyContent: 'space-between' },
  cardBodyHero: { padding: space.xl },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  cardBottom: {},
  cardFooter: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: space.sm },
  tierMark: { ...typeTokens.overline, fontSize: 10 },
  code: { ...typeTokens.monoLarge, fontSize: 26, letterSpacing: 2 },
  codeHero: { fontSize: 34, lineHeight: 40, letterSpacing: 3.5 },
  codeCarousel: { fontSize: 24, letterSpacing: 2 },
  codeList: { fontSize: 28, lineHeight: 34, letterSpacing: 2.5, marginTop: space.sm },
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
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  statChipText: { ...typeTokens.caption, fontSize: 11, lineHeight: 14 },

  cue: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    maxWidth: 150,
    backgroundColor: 'rgba(0,0,0,0.22)',
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
  cueText: { ...typeTokens.overline, fontSize: 10, lineHeight: 13, letterSpacing: 0.9 },
});
