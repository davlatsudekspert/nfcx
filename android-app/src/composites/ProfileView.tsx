import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { NfcCardVisual } from './NfcCardVisual';
import { MusicPlayer } from './MusicPlayer';
import { ContactButtons, buildContactButtons } from './ContactButtons';
import { profileTypeLabel } from './recordMeta';
import { PremiumBadge, TierBadge } from '../design-system/components/PremiumBadge';
import { PremiumStatCard } from '../design-system/components/PremiumStatCard';
import { tierForCode } from '../lib/pricing';
import { formatCount, parseTimestampMs, safeText } from '../lib/format';
import type { FullNfcRecord } from '../api/records';
import type { FollowStats } from '../api/types';
import { color, radius, space, type as typeTokens } from '../design-system/tokens';

export interface ProfileViewProps {
  record: FullNfcRecord;
  followStats?: FollowStats;
  viewCount?: number;
}

/**
 * The NFC Profile View's scrollable body (brief §10 — the app's most
 * premium screen). Deliberately no card-preview chrome: a large circular
 * avatar with a gold ring is the centerpiece.
 *
 * Reused verbatim by the public profile screen and by the owner's
 * "NFC profilini ko'rish" preview, both fed from the SAME
 * `GET /api/records/:code` response — so what the owner previews is
 * literally what an NFC tap renders, not a local draft that only looks
 * like it.
 */
export function ProfileView({ record, followStats, viewCount }: ProfileViewProps) {
  const tier = tierForCode(record.code);
  const contactButtons = buildContactButtons(record);
  const memberSinceMs = parseTimestampMs(record.ts);
  const memberSince = memberSinceMs != null ? new Date(memberSinceMs).getFullYear() : null;
  const about = typeof record.about === 'string' ? record.about.trim() : '';
  const hashtags = (record.hashtags ?? []).map((h) => String(h).replace(/^#/, '').trim()).filter(Boolean);

  const meta: string[] = [];
  if (record.city) meta.push(record.city);
  meta.push(profileTypeLabel(record.profileType));
  if (memberSince != null) meta.push(`${memberSince}-yildan`);

  return (
    <View style={styles.wrapper}>
      <View style={styles.avatarRow}>
        <NfcCardVisual avatarUrl={record.avatarUrl} verified={record.verified === true} />
      </View>

      <View style={styles.idRow}>
        <Text style={styles.code}>#{safeText(record.code, '—')}</Text>
        <TierBadge tier={tier} />
        {record.verified === true && <PremiumBadge label="TASDIQLANGAN" tone="success" />}
      </View>

      <Text style={styles.name}>{safeText(record.name, 'Nomsiz profil')}</Text>
      {!!record.role && <Text style={styles.role}>{record.role}</Text>}

      <View style={styles.metaRow}>
        {meta.map((item, i) => (
          <View key={item + i} style={styles.metaChip}>
            <Text style={styles.metaText} numberOfLines={1}>
              {item}
            </Text>
          </View>
        ))}
      </View>

      {!!about && (
        <View style={styles.aboutCard}>
          <Text style={styles.aboutText}>{about}</Text>
        </View>
      )}

      {hashtags.length > 0 && (
        <Text style={styles.hashtags} numberOfLines={2}>
          {hashtags.map((h) => `#${h}`).join('  ')}
        </Text>
      )}

      <View style={styles.statsRow}>
        <View style={styles.statCell}>
          <PremiumStatCard label="Obunachi" value={followStats?.followers ?? 0} formatValue={formatCount} />
        </View>
        <View style={styles.statCell}>
          <PremiumStatCard label="Obuna" value={followStats?.following ?? 0} formatValue={formatCount} />
        </View>
        <View style={styles.statCell}>
          <PremiumStatCard label="Ko'rishlar" value={viewCount ?? record.views ?? 0} formatValue={formatCount} />
        </View>
      </View>

      {!!record.musicUrl && <MusicPlayer url={record.musicUrl} />}

      {contactButtons.length > 0 ? (
        <View style={styles.contactSection}>
          <ContactButtons items={contactButtons} />
        </View>
      ) : (
        <View style={styles.noContacts}>
          <Feather name="link-2" size={16} color={color.textTertiary} />
          <Text style={styles.noContactsText}>Bu profilda ochiq kontakt ko'rsatilmagan.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', paddingBottom: space.xl },
  avatarRow: { marginTop: space.lg },
  idRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.lg, flexWrap: 'wrap', justifyContent: 'center' },
  code: { ...typeTokens.monoLarge, color: color.gold },
  name: { ...typeTokens.h1, color: color.textPrimary, marginTop: space.sm, textAlign: 'center' },
  role: { ...typeTokens.body, color: color.textSecondary, marginTop: 2, textAlign: 'center' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.xs, marginTop: space.md },
  metaChip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surfaceRaised,
    paddingHorizontal: space.md,
    paddingVertical: 4,
    maxWidth: 180,
  },
  metaText: { ...typeTokens.caption, color: color.textSecondary },
  aboutCard: {
    width: '100%',
    marginTop: space.lg,
    padding: space.lg,
    borderRadius: radius.md,
    backgroundColor: color.surfaceSunken,
    borderWidth: 1,
    borderColor: color.border,
  },
  aboutText: { ...typeTokens.body, color: color.textSecondary, textAlign: 'center' },
  hashtags: { ...typeTokens.caption, color: color.textTertiary, marginTop: space.md, textAlign: 'center' },
  statsRow: { flexDirection: 'row', gap: space.sm, marginTop: space.lg, width: '100%' },
  statCell: { flex: 1 },
  contactSection: { width: '100%', marginTop: space.xl },
  noContacts: {
    width: '100%',
    marginTop: space.xl,
    paddingVertical: space.lg,
    alignItems: 'center',
    gap: space.xs,
  },
  noContactsText: { ...typeTokens.caption, color: color.textTertiary, textAlign: 'center' },
});
