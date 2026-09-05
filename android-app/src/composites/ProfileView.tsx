import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { NfcCardVisual } from './NfcCardVisual';
import { MusicPlayer } from './MusicPlayer';
import { ContactButtons, buildContactButtons } from './ContactButtons';
import { TierBadge } from '../design-system/components/PremiumBadge';
import { PremiumStatCard } from '../design-system/components/PremiumStatCard';
import { tierForCode } from '../lib/pricing';
import type { NfcRecord, FollowStats } from '../api/types';
import { color, space, type as typeTokens } from '../design-system/tokens';

export interface ProfileViewProps {
  record: NfcRecord;
  followStats?: FollowStats;
  viewCount?: number;
}

/**
 * The NFC Profile View's scrollable body (brief §10 — the app's most
 * premium screen). Deliberately no card-preview chrome — a large circular
 * avatar with a gold ring is the centerpiece. Reused both by
 * PublicProfileScreen (real data) and ProfileEditScreen's Live Preview
 * (draft data, same component, so a user editing their profile sees
 * exactly what NFC-tap visitors will see — brief §9).
 */
export function ProfileView({ record, followStats, viewCount }: ProfileViewProps) {
  const tier = tierForCode(record.code);
  const contactButtons = buildContactButtons(record);
  const memberSince = record.ts ? new Date(record.ts).getFullYear() : undefined;

  return (
    <View style={styles.wrapper}>
      <View style={styles.avatarRow}>
        <NfcCardVisual avatarUrl={record.avatarUrl} />
      </View>

      <View style={styles.idRow}>
        <Text style={styles.code}>#{record.code}</Text>
        <TierBadge tier={tier} />
      </View>

      <Text style={styles.name}>{record.name}</Text>
      {!!record.role && <Text style={styles.role}>{record.role}</Text>}
      {!!record.website && <Text style={styles.link}>{record.website}</Text>}
      {!!record.hashtags?.length && (
        <Text style={styles.hashtags}>{record.hashtags.map((h) => `#${h}`).join('  ')}</Text>
      )}

      <View style={styles.statsRow}>
        <PremiumStatCard label="Obunachi" value={followStats?.followers ?? 0} />
        <PremiumStatCard label="Obuna" value={followStats?.following ?? 0} />
        <PremiumStatCard label="Ko'rishlar" value={viewCount ?? record.views ?? 0} />
        {!!memberSince && <PremiumStatCard label="A'zo" value={memberSince} formatValue={(n) => String(n)} />}
      </View>

      {!!record.musicUrl && <MusicPlayer url={record.musicUrl} />}

      {contactButtons.length > 0 && (
        <View style={styles.contactSection}>
          <ContactButtons items={contactButtons} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', paddingBottom: space.xl },
  avatarRow: { marginTop: space.lg },
  idRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.lg },
  code: { ...typeTokens.display, color: color.gold },
  name: { ...typeTokens.h1, color: color.textPrimary, marginTop: space.sm, textAlign: 'center' },
  role: { ...typeTokens.body, color: color.textSecondary, marginTop: 2, textAlign: 'center' },
  link: { ...typeTokens.body, color: color.gold, marginTop: space.xs },
  hashtags: { ...typeTokens.caption, color: color.textTertiary, marginTop: space.xs, textAlign: 'center' },
  statsRow: { flexDirection: 'row', gap: space.sm, marginTop: space.lg, width: '100%' },
  contactSection: { width: '100%', marginTop: space.xl },
});
