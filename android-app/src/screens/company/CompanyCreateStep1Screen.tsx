import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { Feather } from '@expo/vector-icons';
import type { CompanyStackParamList } from '../../navigation/types';
import { CompanyStepShell } from './CompanyStepShell';
import { PremiumInput } from '../../design-system/components/PremiumInput';
import { PremiumButton } from '../../design-system/components/PremiumButton';
import { PremiumCard } from '../../design-system/components/PremiumCard';
import { PremiumBadge } from '../../design-system/components/PremiumBadge';
import { PremiumLoadingSkeleton } from '../../design-system/components/PremiumLoadingSkeleton';
import { describeError } from '../../design-system/components/PremiumQueryState';
import { companiesApi, companyTierForId } from '../../api/companies';
import { companyKeys } from '../../hooks/useMyCompanies';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { formatSom, safeText } from '../../lib/format';
import { COMPANY_ID_MAX, COMPANY_ID_MIN, asTierKey, companyIdError, normalizeCompanyId } from './companyForm';
import { color, radius, space, type as typeTokens, font } from '../../design-system/tokens';

type Props = NativeStackScreenProps<CompanyStackParamList, 'CompanyCreate1'>;

/**
 * Tier/price by ID length — derived from `companyTierForId` itself (ported
 * from src/lib/company.js) so this table can never drift from the classifier.
 * Preview only: `GET /api/companies/check` is the real-time authority and its
 * `tier`/`price` win whenever the call has answered.
 */
const TIER_ROWS = [
  { range: '3 harf', ...companyTierForId('AAA') },
  { range: '4–5 harf', ...companyTierForId('AAAA') },
  { range: '6–7 harf', ...companyTierForId('AAAAAA') },
  { range: '8+ harf', ...companyTierForId('AAAAAAAA') },
];

/** Step 1/5 — Company ID with live availability polling. */
export function CompanyCreateStep1Screen({ navigation }: Props) {
  const [raw, setRaw] = useState('');
  const id = normalizeCompanyId(raw);
  const debounced = useDebouncedValue(id, 400);
  const formatError = companyIdError(id);

  const availability = useQuery({
    queryKey: companyKeys.check(debounced),
    queryFn: () => companiesApi.check(debounced),
    enabled: debounced.length >= COMPANY_ID_MIN,
    staleTime: 15_000,
  });

  // The check is a field validator, not a page of data — it renders inline
  // (compact, next to the input) rather than replacing the screen, but it
  // still goes through `describeError` so an offline/500 never leaks a raw
  // technical string.
  const settled = id.length >= COMPANY_ID_MIN && debounced === id;
  const checking = settled && availability.isFetching;
  const result = settled && !availability.isFetching && !availability.isError ? availability.data : undefined;
  const isAvailable = result?.available === true;

  const preview = id.length >= COMPANY_ID_MIN ? companyTierForId(id) : null;
  const shownTier = asTierKey(result?.tier) ?? preview?.tier;
  const shownPrice = result?.price ?? preview?.price;

  const goNext = () => {
    navigation.push('CompanyCreate2', {
      draft: {
        companyId: id,
        displayName: '',
        category: '',
        city: '',
        phone: '',
        description: '',
      },
    });
  };

  return (
    <CompanyStepShell
      step={1}
      onBack={navigation.canGoBack() ? navigation.goBack : undefined}
      primaryLabel="Davom etish"
      primaryDisabled={!isAvailable}
      onPrimary={goNext}
    >
      <PremiumInput
        label={`Company ID (faqat harflar, ${COMPANY_ID_MIN}–${COMPANY_ID_MAX})`}
        value={raw}
        onChangeText={(t) => setRaw(normalizeCompanyId(t))}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={COMPANY_ID_MAX}
        placeholder="NFCSTORE"
        error={formatError}
      />

      {id.length >= COMPANY_ID_MIN && (
        <PremiumCard variant={isAvailable ? 'featured' : 'default'}>
          <View style={styles.previewTop}>
            <Text style={styles.previewId} numberOfLines={1}>
              #{id}
            </Text>
            {shownTier ? <PremiumBadge label={shownTier.toUpperCase()} tone={shownTier} /> : null}
          </View>

          <Text style={styles.previewPrice}>{formatSom(shownPrice)}</Text>

          <View style={styles.statusBlock}>
            {checking && <PremiumLoadingSkeleton height={16} width={160} />}

            {!checking && settled && availability.isError && (
              <View style={styles.statusRow}>
                <Feather name="alert-circle" size={15} color={color.warning} />
                <Text style={styles.statusWarning}>{describeError(availability.error).description}</Text>
              </View>
            )}

            {!checking && result?.available === true && (
              <View style={styles.statusRow}>
                <Feather name="check-circle" size={15} color={color.success} />
                <Text style={styles.statusOk}>Bu Company ID bo'sh — band qilish mumkin.</Text>
              </View>
            )}

            {!checking && result && result.available === false && (
              <View style={styles.statusRow}>
                <Feather name="x-circle" size={15} color={color.danger} />
                <Text style={styles.statusTaken}>
                  {result.reserved ? 'Bu Company ID zaxirada.' : 'Bu Company ID band.'}
                  {result.rule ? ` (${safeText(result.rule, '')})` : ''}
                </Text>
              </View>
            )}
          </View>

          {settled && availability.isError && (
            <PremiumButton
              label="Qayta tekshirish"
              variant="ghost"
              onPress={() => void availability.refetch()}
              style={styles.retryButton}
            />
          )}
        </PremiumCard>
      )}

      <PremiumCard variant="sunken">
        <Text style={styles.tableTitle}>Uzunlik va tarif</Text>
        {TIER_ROWS.map((row) => {
          const active = shownTier === row.tier;
          return (
            <View key={row.tier} style={[styles.tableRow, active && styles.tableRowActive]}>
              <Text style={[styles.tableRange, active && styles.tableTextActive]}>{row.range}</Text>
              <Text style={[styles.tableTier, active && styles.tableTextActive]}>{row.tier.toUpperCase()}</Text>
              <Text style={[styles.tablePrice, active && styles.tableTextActive]}>{formatSom(row.price)}</Text>
            </View>
          );
        })}
      </PremiumCard>
    </CompanyStepShell>
  );
}

const styles = StyleSheet.create({
  previewTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  previewId: { ...typeTokens.monoLarge, color: color.gold, flex: 1 },
  previewPrice: { ...typeTokens.h2, color: color.textPrimary, marginTop: space.sm },
  statusBlock: { marginTop: space.md, minHeight: 20, justifyContent: 'center' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  statusOk: { ...typeTokens.caption, color: color.success, flex: 1 },
  statusTaken: { ...typeTokens.caption, color: color.danger, flex: 1 },
  statusWarning: { ...typeTokens.caption, color: color.warning, flex: 1 },
  retryButton: { marginTop: space.md },

  tableTitle: { ...typeTokens.overline, color: color.textTertiary, marginBottom: space.sm },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.sm,
    paddingHorizontal: space.sm,
    borderRadius: radius.sm,
    gap: space.sm,
  },
  tableRowActive: { backgroundColor: color.goldWash },
  tableRange: { ...typeTokens.caption, color: color.textSecondary, width: 68 },
  tableTier: { ...typeTokens.caption, color: color.textTertiary, flex: 1, fontFamily: font.sansBold },
  tablePrice: { ...typeTokens.caption, color: color.textSecondary },
  tableTextActive: { color: color.gold },
});
