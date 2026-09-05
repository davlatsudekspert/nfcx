import React, { useState } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { IdStackParamList } from '../../navigation/types';
import { ScreenWithHeader } from '../shared/ScreenWithHeader';
import { PremiumButton } from '../../design-system/components/PremiumButton';
import { PremiumCard } from '../../design-system/components/PremiumCard';
import { PremiumBadge, TierBadge } from '../../design-system/components/PremiumBadge';
import { recordsApi } from '../../api/records';
import type { PurchaseResponse } from '../../api/types';
import { ApiError } from '../../api/client';
import { getPersonalPurchaseQuote } from '../../lib/pricing';
import { usePaymentsEnabledStore } from '../../state/paymentsEnabledStore';
import { color, space, type as typeTokens } from '../../design-system/tokens';

type Props = NativeStackScreenProps<IdStackParamList, 'PurchaseStep2'>;

/**
 * Step 2/3 — review + confirm. If payments are known-off
 * (`/api/settings/payments-enabled`, android/docs/02-API_MAP.md §2.7) the
 * Confirm CTA stays honestly disabled with a real banner instead of firing
 * a network call that is guaranteed to 503 today.
 */
export function PurchaseStep2Screen({ route, navigation }: Props) {
  const { code, profile } = route.params;
  const paymentsStatus = usePaymentsEnabledStore((s) => s.status);
  const quote = getPersonalPurchaseQuote(code);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const paymentsOff = paymentsStatus === 'disabled';
  const canConfirm = quote.purchasable && paymentsStatus === 'enabled' && !loading;

  const onConfirm = async () => {
    if (!canConfirm) return;
    setError(null);
    setLoading(true);
    try {
      const result = (await recordsApi.purchase(code, { ...profile })) as PurchaseResponse;
      navigation.navigate('PurchaseStep3', {
        code,
        orderId: result.orderId,
        price: result.price,
        payLink: result.payLink,
      });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Xizmat vaqtincha mavjud emas.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenWithHeader title="Xarid — 2/3" onBack={navigation.goBack}>
      <PremiumCard>
        <View style={styles.row}>
          <Text style={styles.code}>#{code}</Text>
          {quote.purchasable && <TierBadge tier={quote.tier} />}
        </View>
        <Row label="Ism" value={profile.name} />
        {!!profile.role && <Row label="Rol" value={profile.role} />}
        {!!profile.phone && <Row label="Telefon" value={profile.phone} />}
        {quote.purchasable && <Row label="Narx" value={`${quote.amount.toLocaleString('ru-RU')} so'm`} bold />}
      </PremiumCard>

      {paymentsOff && (
        <View style={styles.banner}>
          <PremiumBadge label="To'lovlar yopiq" tone="warning" />
          <Text style={styles.bannerText}>
            To'lov tizimi hozircha faol emas. Yoqilgach shu yerdan davom etishingiz mumkin bo'ladi.
          </Text>
        </View>
      )}

      {!!error && <Text style={styles.error}>{error}</Text>}

      <PremiumButton label="Tasdiqlash" onPress={onConfirm} loading={loading} disabled={!canConfirm} />
    </ScreenWithHeader>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, bold && styles.detailValueBold]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space.md },
  code: { ...typeTokens.h1, color: color.textPrimary },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: space.xs },
  detailLabel: { ...typeTokens.body, color: color.textSecondary },
  detailValue: { ...typeTokens.body, color: color.textPrimary },
  detailValueBold: { color: color.gold, fontWeight: '700' },
  banner: { backgroundColor: color.surface, borderRadius: 14, padding: space.md, marginTop: space.lg, marginBottom: space.md, gap: space.xs },
  bannerText: { ...typeTokens.caption, color: color.textSecondary },
  error: { ...typeTokens.caption, color: color.danger, marginBottom: space.md },
});
