import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { PremiumCard } from '../design-system/components/PremiumCard';
import { PremiumBadge, TierBadge } from '../design-system/components/PremiumBadge';
import { profileTypeLabel } from './recordMeta';
import { tierForCode } from '../lib/pricing';
import { formatCount, safeText } from '../lib/format';
import { haptics } from '../native/haptics';
import { color, radius, space, type as typeTokens } from '../design-system/tokens';

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
   * `carousel` (default) — the fixed-width tile the Home dashboard scrolls
   * horizontally. `row` — the full-width workspace entry used by
   * "Mening ID'larim", with the extra owner-only metadata below.
   */
  layout?: 'carousel' | 'row';
  /** `record.isPrimary` — the card the backend hands out first. */
  isPrimary?: boolean;
  profileType?: string;
  views?: number;
  verified?: boolean;
  /** Extra state line, e.g. "To'lov kutilmoqda" for a pending order. */
  statusLabel?: string;
}

export function NfcIdCard({
  code,
  name,
  state,
  onPress,
  index,
  layout = 'carousel',
  isPrimary = false,
  profileType,
  views,
  verified = false,
  statusLabel,
}: NfcIdCardProps) {
  const tier = tierForCode(code);
  const isRow = layout === 'row';
  // Gold breath is reserved for the ID that actually matters most: the
  // primary card, or a genuinely high-tier one. Never every row.
  const featured = isPrimary || tier === 'exclusive' || tier === 'premium';

  return (
    <Pressable
      onPress={() => {
        haptics.selection();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={`${code}${name ? `, ${name}` : ''}`}
      style={isRow ? styles.rowPressable : undefined}
    >
      <PremiumCard index={index} variant={featured ? 'featured' : 'default'} style={isRow ? styles.rowCard : styles.card}>
        <View style={styles.topRow}>
          <View style={styles.badges}>
            <TierBadge tier={tier} />
            {isPrimary && <PremiumBadge label="ASOSIY" tone="gold" />}
            {state === 'pending' && <PremiumBadge label="KUTILMOQDA" tone="warning" />}
            {verified && <PremiumBadge label="TASDIQ." tone="success" />}
          </View>
          {isRow && <Feather name="chevron-right" size={20} color={color.textTertiary} />}
        </View>

        <Text style={isRow ? styles.codeLarge : styles.code} numberOfLines={1}>
          {safeText(code, '—')}
        </Text>

        {!!name && (
          <Text style={isRow ? styles.nameRow : styles.name} numberOfLines={1}>
            {name}
          </Text>
        )}

        {isRow && (
          <View style={styles.metaRow}>
            <MetaPill icon="user" label={profileTypeLabel(profileType)} />
            <MetaPill icon="eye" label={formatCount(views ?? 0)} />
            {!!statusLabel && <MetaPill icon="clock" label={statusLabel} tone={color.warning} />}
          </View>
        )}
      </PremiumCard>
    </Pressable>
  );
}

function MetaPill({ icon, label, tone }: { icon: React.ComponentProps<typeof Feather>['name']; label: string; tone?: string }) {
  return (
    <View style={styles.pill}>
      <Feather name={icon} size={12} color={tone ?? color.textTertiary} />
      <Text style={[styles.pillText, !!tone && { color: tone }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: 200, marginRight: space.md },
  rowPressable: { width: '100%' },
  rowCard: { width: '100%' },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badges: { flexDirection: 'row', alignItems: 'center', gap: space.xs, flexWrap: 'wrap', flex: 1 },
  code: { ...typeTokens.h2, color: color.textPrimary, marginTop: space.sm },
  codeLarge: { ...typeTokens.monoLarge, color: color.textPrimary, marginTop: space.md },
  name: { ...typeTokens.caption, color: color.textSecondary, marginTop: 2 },
  nameRow: { ...typeTokens.bodyStrong, color: color.textSecondary, marginTop: 2 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginTop: space.md },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: color.surfaceSunken,
    borderWidth: 1,
    borderColor: color.border,
    maxWidth: 160,
  },
  pillText: { ...typeTokens.caption, color: color.textTertiary },
});
