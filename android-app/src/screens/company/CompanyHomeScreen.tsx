import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import type { CompanyStackParamList } from '../../navigation/types';
import { CompanyScreen } from './CompanyScreen';
import { PremiumCard } from '../../design-system/components/PremiumCard';
import { PremiumButton } from '../../design-system/components/PremiumButton';
import { PremiumQueryState } from '../../design-system/components/PremiumQueryState';
import { PremiumStatCard } from '../../design-system/components/PremiumStatCard';
import { TierBadge } from '../../design-system/components/PremiumBadge';
import { CompanyCover, CompanyLogo, CompanyStatusChip } from './CompanyVisuals';
import { GoldMedallion } from '../auction/AuctionUi';
import { useMyCompanies } from '../../hooks/useMyCompanies';
import { useAuthStore } from '../../state/authStore';
import { usePaymentsEnabledStore } from '../../state/paymentsEnabledStore';
import { categoryLabel } from './companyForm';
import { nextStep } from './statusLabels';
import { formatCount, formatSom, safeText } from '../../lib/format';
import { color, depth, radius, space, type as typeTokens } from '../../design-system/tokens';
import type { Company } from '../../api/types';

type Props = NativeStackScreenProps<CompanyStackParamList, 'CompanyHome'>;

/**
 * The Company tab's workspace: every company the user owns as a real card
 * (cover, logo, status, tier) with the *one* action its current status
 * actually allows — continue a draft, resubmit a rejection, go to payment,
 * open the public page. Nothing here is a dead button: an action that the
 * backend cannot serve yet (payments) is rendered disabled with the reason,
 * never as a hopeful CTA.
 */
export function CompanyHomeScreen({ navigation }: Props) {
  const companies = useMyCompanies();
  const authStatus = useAuthStore((s) => s.status);
  const rows = companies.data ?? [];
  const isEmpty = companies.isSuccess && rows.length === 0;

  const goCreate = () => navigation.navigate('CompanyCreate1');
  const goDashboard = (companyId: string) => navigation.navigate('CompanyDashboard', { companyId });
  const goPublic = (companyId: string) => navigation.navigate('PublicCompany', { companyId });

  const counts = rows.reduce(
    (acc, c) => {
      if (c.status === 'active') acc.active += 1;
      else if (c.status === 'draft' || c.status === 'rejected') acc.attention += 1;
      else acc.inProgress += 1;
      return acc;
    },
    { active: 0, inProgress: 0, attention: 0 },
  );

  return (
    <CompanyScreen
      title="Kompaniya"
      actions={[{ icon: 'plus', accessibilityLabel: 'Yangi kompaniya', onPress: goCreate }]}
      refreshing={companies.isRefetching}
      onRefresh={authStatus === 'authenticated' ? () => void companies.refetch() : undefined}
    >
      <View style={styles.hero}>
        <Text style={styles.overline}>NFCSTORE BIZNES</Text>
        <Text style={styles.heroTitle}>Kompaniyalarim</Text>
        <Text style={styles.heroSubtitle}>
          {rows.length > 0
            ? `${formatCount(rows.length)} ta profil · ${formatCount(counts.active)} faol`
            : 'Biznesingiz uchun Company ID, katalog va ochiq sahifa.'}
        </Text>
      </View>

      {rows.length > 0 && (
        <View style={styles.statRow}>
          <View style={styles.statItem}>
            <PremiumStatCard label="Jami" value={rows.length} formatValue={formatCount} />
          </View>
          <View style={styles.statItem}>
            <PremiumStatCard label="Faol" value={counts.active} formatValue={formatCount} />
          </View>
          <View style={styles.statItem}>
            <PremiumStatCard label="Jarayonda" value={counts.inProgress + counts.attention} formatValue={formatCount} />
          </View>
        </View>
      )}

      <PremiumQueryState
        isLoading={companies.isLoading}
        isError={companies.isError}
        error={companies.error}
        onRetry={() => void companies.refetch()}
        onUnauthorized={() => void useAuthStore.getState().logout()}
        isEmpty={isEmpty}
        emptyIcon="briefcase"
        emptyTitle="Kompaniya profilingiz yo'q"
        emptyDescription="Company ID oling — katalog, aloqa tugmalari va ochiq sahifa bilan."
        emptyCtaLabel="Kompaniya yaratish"
        onPressEmptyCta={goCreate}
        skeletonRows={2}
        skeletonHeight={168}
      >
        <View style={styles.list}>
          {rows.map((company, index) => (
            <CompanyWorkspaceCard
              key={company.companyId}
              company={company}
              index={index}
              onManage={() => goDashboard(company.companyId)}
              onOpenPublic={() => goPublic(company.companyId)}
            />
          ))}
          <PremiumButton label="Yana kompaniya qo'shish" variant="ghost" onPress={goCreate} />
        </View>
      </PremiumQueryState>

      {isEmpty && <HowItWorksCard />}
    </CompanyScreen>
  );
}

const LOGO = 66;
/** The cover fades into the card body so the medallion sits on the seam. */
const COVER_FADE = ['rgba(23,18,9,0)', 'rgba(23,18,9,0.35)', '#171209'] as const;

function CompanyWorkspaceCard({
  company,
  index,
  onManage,
  onOpenPublic,
}: {
  company: Company;
  index: number;
  onManage: () => void;
  onOpenPublic: () => void;
}) {
  const paymentsStatus = usePaymentsEnabledStore((s) => s.status);
  const step = nextStep(company.status);
  const isActive = company.status === 'active';
  const paymentsBlocked = step.target === 'payment' && paymentsStatus !== 'enabled';

  const primaryLabel = step.label;
  const primaryOnPress = step.target === 'public' ? onOpenPublic : onManage;
  const meta = [safeText(company.city, ''), categoryLabel(company.category)].filter(Boolean).join(' · ');

  return (
    <PremiumCard
      variant={isActive ? 'featured' : 'default'}
      index={index}
      contentStyle={styles.cardContent}
      style={isActive ? styles.cardActive : styles.card}
    >
      <View>
        <CompanyCover coverUrl={company.coverUrl} height={112} />
        <LinearGradient colors={COVER_FADE} locations={[0, 0.55, 1]} style={styles.coverFade} pointerEvents="none" />
        <View style={styles.chipOverlay}>
          <CompanyStatusChip status={company.status} compact />
        </View>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.identityRow}>
          <CompanyLogo
            logoUrl={company.logoUrl}
            displayName={company.displayName}
            size={LOGO}
            variant="medallion"
            style={styles.identityLogo}
          />
          <View style={styles.identityText}>
            <Text style={styles.cardName} numberOfLines={2}>
              {safeText(company.displayName)}
            </Text>
            <Text style={styles.cardId} numberOfLines={1}>
              #{safeText(company.companyId)}
            </Text>
          </View>
        </View>

        {!!meta && (
          <Text style={styles.cardMeta} numberOfLines={1}>
            {meta}
          </Text>
        )}

        <View style={styles.tierRow}>
          <TierBadge tier={company.tier} />
          {!isActive && <Text style={styles.tierPrice}>{formatSom(company.price)}</Text>}
        </View>

        <View style={styles.hairline} />

        <Text style={styles.cardHint} numberOfLines={2}>
          {paymentsBlocked ? "To'lovlar hozircha yopiq — yoqilganda shu yerdan davom ettirasiz." : step.hint}
        </Text>

        <View style={styles.cardActions}>
          <PremiumButton label={primaryLabel} onPress={primaryOnPress} />
          {step.target === 'public' && <PremiumButton label="Boshqarish" variant="ghost" onPress={onManage} />}
        </View>
      </View>
    </PremiumCard>
  );
}

const STEP_MEDALLION = 30;
const STEP_RAIL = ['rgba(212,175,90,0.05)', 'rgba(212,175,90,0.7)', 'rgba(240,207,122,0.9)', 'rgba(212,175,90,0.7)', 'rgba(212,175,90,0.05)'] as const;

/** Shown only on the empty screen — turns dead space into an explanation of
 * the real, server-side lifecycle the user is about to enter. */
function HowItWorksCard() {
  const steps: { icon: React.ComponentProps<typeof Feather>['name']; title: string; body: string }[] = [
    { icon: 'hash', title: 'Company ID tanlang', body: "Uzunligi tarifni belgilaydi — 3 harf eng qimmati." },
    { icon: 'edit-3', title: "Ma'lumotlarni to'ldiring", body: 'Nom, shahar, telefon, tavsif va brend rasmlari.' },
    { icon: 'shield', title: "Ko'rib chiqishga yuboring", body: 'Admin tasdiqlagach to‘lov qadamiga o‘tasiz.' },
    { icon: 'globe', title: 'Sahifa faollashadi', body: 'Katalog, aloqa tugmalari va ochiq sahifa ishga tushadi.' },
  ];

  return (
    <PremiumCard variant="default" style={styles.howCard}>
      <Text style={styles.howOverline}>YO'L XARITASI</Text>
      <Text style={styles.howTitle}>Qanday ishlaydi</Text>
      <View style={styles.howList}>
        {steps.map((s, i) => {
          const last = i === steps.length - 1;
          return (
            <View key={s.title} style={styles.howRow}>
              <View style={styles.howRail}>
                <GoldMedallion size={STEP_MEDALLION}>
                  <Feather name={s.icon} size={14} color={color.textOnGold} />
                </GoldMedallion>
                {!last && (
                  <View style={styles.howLineWrap} pointerEvents="none">
                    <LinearGradient
                      colors={STEP_RAIL}
                      locations={[0, 0.2, 0.5, 0.8, 1]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 0, y: 1 }}
                      style={styles.howLine}
                    />
                  </View>
                )}
              </View>
              <View style={[styles.howText, !last && styles.howTextSpaced]}>
                <Text style={styles.howStepTitle}>
                  {i + 1}. {s.title}
                </Text>
                <Text style={styles.howStepBody}>{s.body}</Text>
              </View>
            </View>
          );
        })}
      </View>
    </PremiumCard>
  );
}

const styles = StyleSheet.create({
  hero: { gap: 2 },
  overline: { ...typeTokens.overline, color: color.gold },
  heroTitle: { ...typeTokens.h1, color: color.textPrimary, marginTop: space.xs },
  heroSubtitle: { ...typeTokens.body, color: color.textSecondary },

  statRow: { flexDirection: 'row', gap: space.sm },
  statItem: { flex: 1 },

  list: { gap: space.xl },
  card: { ...depth.card },
  cardActive: { ...depth.cardHero },
  cardContent: { padding: 0 },
  coverFade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 64 },
  chipOverlay: { position: 'absolute', top: space.md, right: space.md },
  cardBody: { padding: space.lg, paddingTop: 0, marginTop: -(LOGO / 2) },
  identityRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.md },
  identityLogo: { boxShadow: '0 6px 14px rgba(0,0,0,0.6), 0 0 22px rgba(212,175,90,0.25)' },
  identityText: { flex: 1, paddingBottom: 4 },
  cardName: { ...typeTokens.h1, fontSize: 22, lineHeight: 28, color: color.textPrimary },
  cardId: { ...typeTokens.mono, fontSize: 13, color: color.gold, marginTop: 2 },
  cardMeta: { ...typeTokens.caption, color: color.textSecondary, marginTop: space.sm + 2 },

  tierRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.md },
  tierPrice: { ...typeTokens.stat, fontSize: 15, lineHeight: 20, color: color.textSecondary },

  hairline: { height: 1, backgroundColor: 'rgba(212,175,90,0.12)', marginTop: space.lg },
  cardHint: { ...typeTokens.caption, color: color.textTertiary, marginTop: space.md, lineHeight: 17 },
  cardActions: { gap: space.sm, marginTop: space.md },

  howCard: { ...depth.card },
  howOverline: { ...typeTokens.overline, color: color.gold },
  howTitle: { ...typeTokens.h2, color: color.textPrimary, marginTop: space.xs, marginBottom: space.lg },
  howList: {},
  howRow: { flexDirection: 'row', gap: space.md, alignItems: 'stretch' },
  howRail: { width: STEP_MEDALLION, alignItems: 'center' },
  howLineWrap: {
    flex: 1,
    width: 2,
    marginVertical: 3,
    borderRadius: radius.pill,
    boxShadow: '0 0 8px rgba(212,175,90,0.55)',
  },
  howLine: { flex: 1, borderRadius: radius.pill },
  howText: { flex: 1, paddingTop: 4 },
  howTextSpaced: { paddingBottom: space.lg },
  howStepTitle: { ...typeTokens.bodyStrong, color: color.textPrimary },
  howStepBody: { ...typeTokens.caption, color: color.textSecondary, marginTop: 2, lineHeight: 17 },
});
