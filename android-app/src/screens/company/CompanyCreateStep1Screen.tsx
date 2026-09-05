import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import type { CompanyStackParamList } from '../../navigation/types';
import { ScreenWithHeader } from '../shared/ScreenWithHeader';
import { PremiumInput } from '../../design-system/components/PremiumInput';
import { PremiumButton } from '../../design-system/components/PremiumButton';
import { PremiumBadge } from '../../design-system/components/PremiumBadge';
import { companiesApi, companyTierForId } from '../../api/companies';
import { formatSom } from '../../lib/format';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { color, space, type as typeTokens } from '../../design-system/tokens';

type Props = NativeStackScreenProps<CompanyStackParamList, 'CompanyCreate1'>;

/** Step 1/5 — Company ID with live availability polling. Tier/price is by
 * ID length (`companyTierForId`, src/lib/company.js on the web) — a
 * separate table from personal NFC ID pricing. */
export function CompanyCreateStep1Screen({ navigation }: Props) {
  const [raw, setRaw] = useState('');
  const id = raw.replace(/[^A-Za-z]/g, '').toUpperCase();
  const debounced = useDebouncedValue(id, 400);
  const localTier = debounced.length >= 3 ? companyTierForId(debounced) : null;

  const availability = useQuery({
    queryKey: ['companies', 'check', debounced],
    queryFn: () => companiesApi.check(debounced),
    enabled: debounced.length >= 3,
  });

  const formatError = id.length > 0 && id.length < 3 ? 'Kamida 3 harf kerak.' : null;
  const isAvailable = availability.data?.available === true;

  return (
    <ScreenWithHeader title="Kompaniya — 1/5" onBack={navigation.goBack}>
      <View style={styles.stepRow}>
        <Text style={styles.stepText}>1</Text>
        <Text style={styles.stepDivider}>/</Text>
        <Text style={styles.stepTextMuted}>5</Text>
      </View>

      <PremiumInput
        label="Company ID (faqat harflar, masalan NFCSTORE)"
        value={raw}
        onChangeText={(t) => setRaw(t.toUpperCase())}
        autoCapitalize="characters"
        maxLength={15}
        error={formatError}
      />

      {id.length >= 3 && localTier && (
        <View style={styles.previewRow}>
          <PremiumBadge label={localTier.tier.toUpperCase()} tone={localTier.tier} />
          <Text style={styles.price}>{formatSom(localTier.price)}</Text>
        </View>
      )}

      {availability.isLoading && id.length >= 3 && <Text style={styles.status}>Tekshirilmoqda...</Text>}
      {availability.data && !availability.data.available && (
        <Text style={styles.statusTaken}>Bu Company ID band yoki zaxirada.</Text>
      )}

      <PremiumButton
        label="Davom etish"
        disabled={!isAvailable}
        onPress={() =>
          navigation.navigate('CompanyCreate2', {
            draft: {
              companyId: debounced,
              displayName: '',
              category: 'services',
              city: '',
              phone: '',
              description: '',
            },
          })
        }
      />
    </ScreenWithHeader>
  );
}

const styles = StyleSheet.create({
  stepRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: space.md },
  stepText: { ...typeTokens.h1, color: color.gold },
  stepDivider: { ...typeTokens.h2, color: color.textTertiary, marginHorizontal: 4 },
  stepTextMuted: { ...typeTokens.h2, color: color.textTertiary },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.md },
  price: { ...typeTokens.h2, color: color.gold },
  status: { ...typeTokens.caption, color: color.textSecondary, marginBottom: space.md },
  statusTaken: { ...typeTokens.caption, color: color.warning, marginBottom: space.md },
});
