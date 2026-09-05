import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import type { IdStackParamList } from '../../navigation/types';
import { ScreenWithHeader } from '../shared/ScreenWithHeader';
import { PremiumInput } from '../../design-system/components/PremiumInput';
import { PremiumButton } from '../../design-system/components/PremiumButton';
import { PremiumCard } from '../../design-system/components/PremiumCard';
import { TierBadge } from '../../design-system/components/PremiumBadge';
import { recordsApi } from '../../api/records';
import { ApiError } from '../../api/client';
import { parseAnyCode, getPersonalPurchaseQuote } from '../../lib/pricing';
import { formatSom } from '../../lib/format';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { color, space, type as typeTokens } from '../../design-system/tokens';

type Props = NativeStackScreenProps<IdStackParamList, 'IdSearch'>;

/**
 * There is no "browse available premium codes" endpoint anywhere in the
 * live API (android/docs/02-API_MAP.md) — the ID space is just every
 * 6-character AAA000 combination, classified on the fly by
 * `src/lib/pricing.ts`. So "examples" below are a small illustrative
 * sample, not a live inventory fetch — tapping one only pre-fills the
 * checker input below.
 */
const EXAMPLES = ['AAA100', 'BMW007', 'TAS101', 'XYZ000'];

/**
 * The real sales-funnel entry point (brief §7). Typing a candidate 6-char
 * code gets an instant, local tier/price preview (src/lib/pricing.ts, no
 * network) plus a real availability check (GET /api/records/:code —
 * 404 = available, 200 = taken, and the Worker's `personalPurchaseQuote`
 * remains the only real price authority once a purchase is attempted).
 */
export function IdSearchScreen({ navigation }: Props) {
  const [raw, setRaw] = useState('');
  const debounced = useDebouncedValue(raw, 400);
  const parsed = parseAnyCode(debounced);
  const code = parsed?.code ?? null;
  const quote = code ? getPersonalPurchaseQuote(code) : null;

  const availability = useQuery({
    queryKey: ['records', 'availability', code],
    queryFn: () => recordsApi.get(code as string),
    enabled: !!code,
    retry: false,
  });

  const isChecking = !!code && availability.isLoading;
  const isTaken = !!code && availability.isSuccess;
  const isAvailable = !!code && availability.isError && (availability.error as ApiError)?.code === 'not_found';


  return (
    <ScreenWithHeader title="NFC ID qidirish" onBack={navigation.canGoBack() ? navigation.goBack : undefined}>
      <PremiumInput
        label="Kerakli ID ni kiriting (masalan AAA100)"
        value={raw}
        onChangeText={(t) => setRaw(t.toUpperCase())}
        autoCapitalize="characters"
        maxLength={12}
      />

      {!!code && (
        <PremiumCard style={styles.resultCard}>
          <View style={styles.resultTop}>
            <Text style={styles.resultCode}>#{code}</Text>
            {quote && quote.purchasable && <TierBadge tier={quote.tier} />}
            {quote && !quote.purchasable && quote.reason === 'exclusive_auction_only' && (
              <TierBadge tier="exclusive" />
            )}
          </View>

          {isChecking && <Text style={styles.statusText}>Tekshirilmoqda...</Text>}

          {isTaken && (
            <Text style={styles.statusTextTaken}>
              Bu ID band{availability.data?.name ? `: ${availability.data.name}` : ''}.
            </Text>
          )}

          {isAvailable && quote?.purchasable && (
            <>
              <Text style={styles.price}>{formatSom(quote.amount)}</Text>
              <PremiumButton label="Tanlash" onPress={() => navigation.navigate('PurchaseStep1', { code })} style={styles.selectButton} />
            </>
          )}

          {isAvailable && quote && !quote.purchasable && quote.reason === 'exclusive_auction_only' && (
            <Text style={styles.exclusiveNote}>Faqat auksion orqali sotiladi.</Text>
          )}

          {isAvailable && quote && !quote.purchasable && quote.reason === 'not_purchasable' && (
            <Text style={styles.exclusiveNote}>Bu ID formati sotib olish uchun mos emas.</Text>
          )}
        </PremiumCard>
      )}

      {!code && !!raw && (
        <Text style={styles.formatHint}>Format: 3 harf + 3 raqam (masalan AAA100) yoki 8 xonali ID.</Text>
      )}

      <Text style={styles.sectionTitle}>Mashhur namunalar</Text>
      <View style={styles.examplesRow}>
        {EXAMPLES.map((example) => (
          <PremiumButton
            key={example}
            label={example}
            variant="ghost"
            fullWidth={false}
            onPress={() => setRaw(example)}
            style={styles.exampleChip}
          />
        ))}
      </View>
    </ScreenWithHeader>
  );
}

const styles = StyleSheet.create({
  resultCard: { marginTop: space.sm },
  resultTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  resultCode: { ...typeTokens.h1, color: color.textPrimary },
  statusText: { ...typeTokens.body, color: color.textSecondary, marginTop: space.sm },
  statusTextTaken: { ...typeTokens.body, color: color.warning, marginTop: space.sm },
  price: { ...typeTokens.h2, color: color.gold, marginTop: space.sm },
  exclusiveNote: { ...typeTokens.body, color: color.tierExclusive, marginTop: space.sm },
  selectButton: { marginTop: space.md },
  formatHint: { ...typeTokens.caption, color: color.textTertiary, marginTop: space.sm },
  sectionTitle: { ...typeTokens.h2, color: color.textPrimary, marginTop: space.xl, marginBottom: space.sm },
  examplesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  exampleChip: { paddingHorizontal: space.md },
});
