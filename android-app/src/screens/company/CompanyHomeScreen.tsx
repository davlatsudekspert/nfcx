import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import type { CompanyStackParamList } from '../../navigation/types';
import { CompanyScreen } from './CompanyScreen';
import { PremiumCard } from '../../design-system/components/PremiumCard';
import { PremiumButton } from '../../design-system/components/PremiumButton';
import { PremiumQueryState } from '../../design-system/components/PremiumQueryState';
import { PremiumStatCard } from '../../design-system/components/PremiumStatCard';
import { TierBadge } from '../../design-system/components/PremiumBadge';
import { CompanyCover, CompanyLogo, CompanyStatusChip } from './CompanyVisuals';
import { useMyCompanies } from '../../hooks/useMyCompanies';
import { useAuthStore } from '../../state/authStore';
import { usePaymentsEnabledStore } from '../../state/paymentsEnabledStore';
import { categoryLabel } from './companyForm';
import { nextStep } from './statusLabels';
import { formatCount, formatSom, safeText } from '../../lib/format';
import { color, radius, space, type as typeTokens } from '../../design-system/tokens';
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
    <PremiumCard variant={isActive ? 'featured' : 'default'} index={index} contentStyle={styles.cardContent}>
      <View>
        <CompanyCover coverUrl={company.coverUrl} height={96} />
        <View style={styles.chipOverlay}>
          <CompanyStatusChip status={company.status} compact />
        </View>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.identityRow}>
          <CompanyLogo logoUrl={company.logoUrl} displayName={company.displayName} size={54} style={styles.identityLogo} />
          <View style={styles.identityText}>
            <Text style={styles.cardName} numberOfLines={1}>
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
    <PremiumCard variant="sunken">
      <Text style={styles.howTitle}>Qanday ishlaydi</Text>
      <View style={styles.howList}>
        {steps.map((s, i) => (
          <View key={s.title} style={styles.howRow}>
            <View style={styles.howIndex}>
              <Feather name={s.icon} size={14} color={color.gold} />
            </View>
            <View style={styles.howText}>
              <Text style={styles.howStepTitle}>
                {i + 1}. {s.title}
              </Text>
              <Text style={styles.howStepBody}>{s.body}</Text>
            </View>
          </View>
        ))}
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

  list: { gap: space.lg },
  cardContent: { padding: 0 },
  chipOverlay: { position: 'absolute', top: space.md, right: space.md },
  cardBody: { padding: space.lg, paddingTop: 0, marginTop: -22 },
  identityRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.md },
  identityLogo: { borderWidth: 2, borderColor: color.bg },
  identityText: { flex: 1, paddingBottom: 2 },
  cardName: { ...typeTokens.h2, color: color.textPrimary },
  cardId: { ...typeTokens.mono, fontSize: 13, color: color.gold },
  cardMeta: { ...typeTokens.caption, color: color.textSecondary, marginTop: space.sm },

  tierRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.md },
  tierPrice: { ...typeTokens.bodyStrong, color: color.textSecondary },

  cardHint: { ...typeTokens.caption, color: color.textTertiary, marginTop: space.sm, lineHeight: 17 },
  cardActions: { gap: space.sm, marginTop: space.md },

  howTitle: { ...typeTokens.h3, color: color.textPrimary, marginBottom: space.md },
  howList: { gap: space.md },
  howRow: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  howIndex: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    backgroundColor: color.goldMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  howText: { flex: 1 },
  howStepTitle: { ...typeTokens.bodyStrong, color: color.textPrimary },
  howStepBody: { ...typeTokens.caption, color: color.textSecondary, marginTop: 2, lineHeight: 17 },
});
