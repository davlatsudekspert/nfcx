import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { PremiumCard } from '../../design-system/components/PremiumCard';
import { color, radius, space, type as typeTokens } from '../../design-system/tokens';

/**
 * Small shared surfaces the three auction screens are assembled from.
 *
 * They exist so the section reads as one product: the same chip, the same
 * metric tile, the same banner geometry on the list, the detail and the
 * payment screen — all built from design-system tokens only, with gold kept
 * as an accent on near-black rather than a fill.
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

export interface MetaChipProps {
  icon?: React.ComponentProps<typeof Feather>['name'];
  label: string;
  tone?: AuctionTone;
}

/** Compact fact pill — "Qadam: 50 000 so'm", "Siz yetakchisiz", "12 taklif". */
export function MetaChip({ icon, label, tone = 'neutral' }: MetaChipProps) {
  const tint = toneColor(tone);
  return (
    <View style={[styles.chip, tone !== 'neutral' && { borderColor: tint }]}>
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

/** One number with its caption. */
export function MetricTile({ label, value, children, tone = 'neutral', style }: MetricTileProps) {
  return (
    <View style={[styles.tile, style]}>
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
      <View style={[styles.bannerRail, { backgroundColor: tint }]} />
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
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${Math.round(pct * 100)}%`, backgroundColor: toneColor(tone) }]} />
    </View>
  );
}

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
  },
  chipText: { ...typeTokens.caption, color: color.textSecondary },

  tile: {
    flex: 1,
    backgroundColor: color.surfaceSunken,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    gap: 2,
  },
  tileLabel: { ...typeTokens.overline, color: color.textTertiary },
  tileValue: { ...typeTokens.bodyStrong, color: color.textPrimary },

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
  sectionTitle: { ...typeTokens.h3, color: color.textPrimary, flex: 1 },
  sectionTrailing: { ...typeTokens.caption, color: color.textTertiary },

  progressTrack: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: color.surfaceHigh,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: radius.pill },
});
