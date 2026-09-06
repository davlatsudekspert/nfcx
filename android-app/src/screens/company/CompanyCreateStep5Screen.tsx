import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CompanyStackParamList } from '../../navigation/types';
import { CompanyStepShell } from './CompanyStepShell';
import { PremiumCard } from '../../design-system/components/PremiumCard';
import { PremiumButton } from '../../design-system/components/PremiumButton';
import { PremiumBadge } from '../../design-system/components/PremiumBadge';
import { CompanyCover, CompanyLogo, InfoRow, NoticeLine, SectionHeader } from './CompanyVisuals';
import { companiesApi, companyTierForId } from '../../api/companies';
import { companyKeys } from '../../hooks/useMyCompanies';
import { ApiError } from '../../api/client';
import { buildCreatePayload, categoryLabel } from './companyForm';
import { formatSom, safeText } from '../../lib/format';
import { color, space, type as typeTokens } from '../../design-system/tokens';

type Props = NativeStackScreenProps<CompanyStackParamList, 'CompanyCreate5'>;

/**
 * Step 5/5 — review, then the one and only `POST /api/companies` call
 * (android/docs/02-API_MAP.md §2.5). Steps 1-4 are entirely local, so every
 * "Tahrirlash" here just pops back to a still-live screen: nothing typed is
 * lost, and nothing exists server-side until this button is pressed.
 */
export function CompanyCreateStep5Screen({ route, navigation }: Props) {
  const { draft } = route.params;
  const queryClient = useQueryClient();
  const [error, setError] = useState<ApiError | null>(null);
  const tier = companyTierForId(draft.companyId);

  const create = useMutation({
    mutationFn: () => companiesApi.create(buildCreatePayload(draft)),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: companyKeys.mine });
      navigation.reset({
        index: 1,
        routes: [
          { name: 'CompanyHome' },
          { name: 'CompanyDashboard', params: { companyId: result.company.companyId } },
        ],
      });
    },
    onError: (e) => setError(e instanceof ApiError ? e : null),
  });

  /** Pops back to an earlier, still-mounted step (5 - target). */
  const editStep = (target: number) => () => navigation.pop(5 - target);

  const idTaken = error?.code === 'company_id_taken' || error?.code === 'company_id_reserved';

  return (
    <CompanyStepShell
      step={5}
      onBack={navigation.canGoBack() ? navigation.goBack : undefined}
      primaryLabel="Kompaniyani yaratish"
      onPrimary={() => {
        setError(null);
        create.mutate();
      }}
      primaryLoading={create.isPending}
      primaryDisabled={create.isPending}
    >
      <PremiumCard variant="featured" animate={false} contentStyle={styles.heroContent}>
        <View>
          <CompanyCover coverUrl={draft.coverUrl} height={104} />
        </View>
        <View style={styles.heroBody}>
          <View style={styles.heroRow}>
            <CompanyLogo logoUrl={draft.logoUrl} displayName={draft.displayName} size={54} style={styles.heroLogo} />
            <View style={styles.heroText}>
              <Text style={styles.heroName} numberOfLines={1}>
                {safeText(draft.displayName)}
              </Text>
              <Text style={styles.heroId} numberOfLines={1}>
                #{safeText(draft.companyId)}
              </Text>
            </View>
          </View>
          <View style={styles.tierRow}>
            <PremiumBadge label={tier.tier.toUpperCase()} tone={tier.tier} />
            <Text style={styles.tierPrice}>{formatSom(tier.price)}</Text>
          </View>
        </View>
      </PremiumCard>

      <PremiumCard animate={false}>
        <SectionHeader title="BIZNES" actionLabel="Tahrirlash" actionIcon="edit-2" onPressAction={editStep(2)} />
        <InfoRow label="Kategoriya" value={categoryLabel(draft.category)} />
        {!!draft.subcategory?.trim() && <InfoRow label="Yo'nalish" value={draft.subcategory.trim()} />}
        <InfoRow label="Shahar" value={draft.city} />
        {!!draft.address?.trim() && <InfoRow label="Manzil" value={draft.address.trim()} />}
        <InfoRow label="Telefon" value={draft.phone} />
        <Text style={styles.description}>{safeText(draft.description)}</Text>
      </PremiumCard>

      <PremiumCard animate={false}>
        <SectionHeader title="ALOQA" actionLabel="Tahrirlash" actionIcon="edit-2" onPressAction={editStep(4)} />
        <InfoRow label="Telegram" value={draft.telegram?.trim()} />
        <InfoRow label="WhatsApp" value={draft.whatsapp?.trim()} />
        <InfoRow label="Veb-sayt" value={draft.website?.trim()} />
      </PremiumCard>

      <PremiumCard animate={false}>
        <SectionHeader title="BREND" actionLabel="Tahrirlash" actionIcon="edit-2" onPressAction={editStep(3)} />
        <InfoRow label="Logotip" value={draft.logoUrl ? 'Yuklangan' : undefined} />
        <InfoRow label="Muqova" value={draft.coverUrl ? 'Yuklangan' : undefined} />
      </PremiumCard>

      {error ? (
        <PremiumCard variant="sunken" animate={false}>
          <NoticeLine icon="alert-circle" tone="danger" text={error.message} />
          {idTaken ? (
            <PremiumButton
              label="Boshqa Company ID tanlash"
              variant="ghost"
              onPress={editStep(1)}
              style={styles.errorAction}
            />
          ) : null}
        </PremiumCard>
      ) : null}

      {create.isError && !error ? (
        <NoticeLine icon="alert-circle" tone="danger" text="Xizmat vaqtincha mavjud emas. Qayta urinib ko'ring." />
      ) : null}

      <NoticeLine
        icon="shield"
        text="Yuborilgach kompaniya ko'rib chiqishga tushadi. Tasdiqlangach to'lov qadamiga o'tasiz."
      />
    </CompanyStepShell>
  );
}

const styles = StyleSheet.create({
  heroContent: { padding: 0 },
  heroBody: { padding: space.lg, paddingTop: 0, marginTop: -22 },
  heroRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.md },
  heroLogo: { borderWidth: 2, borderColor: color.bg },
  heroText: { flex: 1, paddingBottom: 2 },
  heroName: { ...typeTokens.h2, color: color.textPrimary },
  heroId: { ...typeTokens.mono, fontSize: 13, color: color.gold },
  tierRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.md },
  tierPrice: { ...typeTokens.bodyStrong, color: color.textSecondary },
  description: { ...typeTokens.body, color: color.textSecondary, marginTop: space.md, lineHeight: 21 },
  errorAction: { marginTop: space.md },
});
