import React from 'react';
import { Image, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { color, gradient, radius, space, touchTarget, type as typeTokens } from '../../design-system/tokens';
import { safeText } from '../../lib/format';
import { LIFECYCLE_STEPS, statusColor, statusLabel, statusStep } from './statusLabels';

/**
 * The small, repeated pieces the Company section is assembled from. Kept in
 * one place so the home card, the dashboard hero and the public page can
 * never drift into three slightly different visual languages.
 */

/** Status pill: a semantic dot + label. Colour comes from `STATUS_COLOR`. */
export function CompanyStatusChip({ status, compact = false }: { status: string | undefined; compact?: boolean }) {
  const tint = statusColor(status);
  return (
    <View style={[styles.chip, compact && styles.chipCompact, { borderColor: tint }]}>
      <View style={[styles.chipDot, { backgroundColor: tint }]} />
      <Text style={[styles.chipText, { color: tint }]} numberOfLines={1}>
        {statusLabel(status)}
      </Text>
    </View>
  );
}

/** Logo, or a gold monogram built from the company name when there is none. */
export function CompanyLogo({
  logoUrl,
  displayName,
  size = 48,
  style,
}: {
  logoUrl?: string;
  displayName?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const box = { width: size, height: size, borderRadius: Math.round(size / 3.2) };
  if (logoUrl) {
    // The image lives inside the styled box (rather than being styled itself)
    // so callers can pass any ViewStyle — a border, a shadow — without
    // fighting React Native's separate ImageStyle type.
    return (
      <View style={[styles.logo, box, style]}>
        <Image source={{ uri: logoUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      </View>
    );
  }
  const initial = (displayName ?? '').trim().charAt(0).toUpperCase();
  return (
    <View style={[styles.logo, styles.logoFallback, box, style]}>
      <Text style={[styles.monogram, { fontSize: Math.round(size / 2.2) }]}>{initial || '#'}</Text>
    </View>
  );
}

/**
 * Cover banner. With no `coverUrl` this is a deliberate gold-breath gradient
 * rather than a grey box — an empty brand slot still has to look designed.
 */
export function CompanyCover({ coverUrl, height = 116 }: { coverUrl?: string; height?: number }) {
  return (
    <View style={[styles.cover, { height }]}>
      {coverUrl ? (
        <Image source={{ uri: coverUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <LinearGradient
          colors={gradient.cardFeatured}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      )}
      <LinearGradient
        colors={['rgba(10,10,10,0)', 'rgba(10,10,10,0.85)']}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
    </View>
  );
}

/** The four real lifecycle stages, with the current one marked. */
export function LifecycleRail({ status }: { status: string | undefined }) {
  const current = statusStep(status);
  const tint = statusColor(status);

  return (
    <View style={styles.rail}>
      {LIFECYCLE_STEPS.map((label, i) => {
        const index = i + 1;
        const done = index < current;
        const isCurrent = index === current;
        return (
          <View key={label} style={styles.railItem}>
            <View style={styles.railTrack}>
              <View style={[styles.railLine, i === 0 && styles.railLineHidden, done || isCurrent ? { backgroundColor: color.goldDark } : null]} />
              <View
                style={[
                  styles.railDot,
                  done && styles.railDotDone,
                  isCurrent && { borderColor: tint, backgroundColor: tint },
                ]}
              >
                {done ? <Feather name="check" size={10} color={color.textOnGold} /> : null}
              </View>
              <View
                style={[
                  styles.railLine,
                  i === LIFECYCLE_STEPS.length - 1 && styles.railLineHidden,
                  done ? { backgroundColor: color.goldDark } : null,
                ]}
              />
            </View>
            <Text
              style={[styles.railLabel, (done || isCurrent) && styles.railLabelActive]}
              numberOfLines={1}
            >
              {label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/** Section heading with an optional right-hand action (Edit / Cancel / …). */
export function SectionHeader({
  title,
  actionLabel,
  onPressAction,
  actionIcon,
}: {
  title: string;
  actionLabel?: string;
  onPressAction?: () => void;
  actionIcon?: React.ComponentProps<typeof Feather>['name'];
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle} numberOfLines={1}>
        {title}
      </Text>
      {actionLabel && onPressAction ? (
        <Pressable
          onPress={onPressAction}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          hitSlop={8}
          style={styles.sectionAction}
        >
          {actionIcon ? <Feather name={actionIcon} size={14} color={color.gold} /> : null}
          <Text style={styles.sectionActionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Read-only label/value line. Never renders a raw null/undefined. */
export function InfoRow({
  icon,
  label,
  value,
  onPress,
  multiline = false,
}: {
  icon?: React.ComponentProps<typeof Feather>['name'];
  label: string;
  value: unknown;
  onPress?: () => void;
  multiline?: boolean;
}) {
  const text = safeText(value, "Ko'rsatilmagan");
  const empty = text === "Ko'rsatilmagan";
  const body = (
    <View style={styles.infoRow}>
      {icon ? <Feather name={icon} size={15} color={color.textTertiary} style={styles.infoIcon} /> : null}
      <Text style={styles.infoLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text
        style={[styles.infoValue, empty && styles.infoValueEmpty, onPress && !empty && styles.infoValueLink]}
        numberOfLines={multiline ? 6 : 1}
      >
        {text}
      </Text>
    </View>
  );

  if (onPress && !empty) {
    return (
      <Pressable onPress={onPress} accessibilityRole="link" accessibilityLabel={`${label}: ${text}`}>
        {body}
      </Pressable>
    );
  }
  return body;
}

/** Single-select chip used for category pickers (creation flow + dashboard). */
export function ChoiceChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={[styles.choiceChip, selected && styles.choiceChipSelected]}
    >
      <Text style={[styles.choiceChipText, selected && styles.choiceChipTextSelected]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

/** A short, honest note — used for "payments are closed", preview banners, etc. */
export function NoticeLine({
  icon = 'info',
  tone = 'muted',
  text,
}: {
  icon?: React.ComponentProps<typeof Feather>['name'];
  tone?: 'muted' | 'warning' | 'danger' | 'success';
  text: string;
}) {
  const tint =
    tone === 'warning' ? color.warning : tone === 'danger' ? color.danger : tone === 'success' ? color.success : color.textTertiary;
  return (
    <View style={styles.notice}>
      <Feather name={icon} size={14} color={tint} style={styles.noticeIcon} />
      <Text style={[styles.noticeText, { color: tint === color.textTertiary ? color.textSecondary : tint }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: space.sm,
    paddingVertical: 4,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  chipCompact: { paddingVertical: 2 },
  chipDot: { width: 6, height: 6, borderRadius: 3 },
  chipText: { ...typeTokens.caption, fontWeight: '700' },

  logo: { backgroundColor: color.surfaceHigh, overflow: 'hidden' },
  logoFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: color.borderGold,
  },
  monogram: { color: color.gold, fontWeight: '800' },

  cover: { width: '100%', backgroundColor: color.surfaceSunken, overflow: 'hidden' },

  rail: { flexDirection: 'row', alignItems: 'flex-start' },
  railItem: { flex: 1, alignItems: 'center' },
  railTrack: { flexDirection: 'row', alignItems: 'center', width: '100%' },
  railLine: { flex: 1, height: 2, backgroundColor: color.border },
  railLineHidden: { backgroundColor: 'transparent' },
  railDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: color.border,
    backgroundColor: color.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  railDotDone: { backgroundColor: color.gold, borderColor: color.gold },
  railLabel: { ...typeTokens.caption, fontSize: 10, color: color.textTertiary, marginTop: space.xs, textAlign: 'center' },
  railLabelActive: { color: color.textSecondary },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
    marginBottom: space.md,
  },
  sectionTitle: { ...typeTokens.overline, color: color.textTertiary, flex: 1 },
  sectionAction: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 24 },
  sectionActionText: { ...typeTokens.caption, color: color.gold, fontWeight: '700' },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: touchTarget - 8,
    borderBottomWidth: 1,
    borderBottomColor: color.border,
  },
  infoIcon: { width: 18 },
  infoLabel: { ...typeTokens.caption, color: color.textTertiary, flexShrink: 0 },
  infoValue: { ...typeTokens.body, color: color.textPrimary, flex: 1, textAlign: 'right' },
  infoValueEmpty: { color: color.textTertiary },
  infoValueLink: { color: color.gold },

  choiceChip: {
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surfaceRaised,
  },
  choiceChipSelected: { borderColor: color.borderGoldStrong, backgroundColor: color.goldMuted },
  choiceChipText: { ...typeTokens.caption, color: color.textSecondary, fontWeight: '600' },
  choiceChipTextSelected: { color: color.gold },

  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  noticeIcon: { marginTop: 3 },
  noticeText: { ...typeTokens.caption, flex: 1, lineHeight: 17 },
});
