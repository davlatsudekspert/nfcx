import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation } from '@tanstack/react-query';
import type { AuctionStackParamList } from '../../navigation/types';
import { ScreenWithHeader } from '../shared/ScreenWithHeader';
import { PremiumInput } from '../../design-system/components/PremiumInput';
import { PremiumButton } from '../../design-system/components/PremiumButton';
import { PremiumBadge } from '../../design-system/components/PremiumBadge';
import { auctionsApi } from '../../api/auctions';
import { ApiError } from '../../api/client';
import { usePaymentsEnabledStore } from '../../state/paymentsEnabledStore';
import { color, space, type as typeTokens } from '../../design-system/tokens';

type Props = NativeStackScreenProps<AuctionStackParamList, 'AuctionPayment'>;

/** POST /api/auctions/:id/pay — a real, always-503-today endpoint
 * (android/docs/02-API_MAP.md §2.4). Form is fully built and wired; the CTA
 * stays honestly disabled while payments are off. */
export function AuctionPaymentScreen({ route, navigation }: Props) {
  const { auctionId } = route.params;
  const paymentsStatus = usePaymentsEnabledStore((s) => s.status);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);

  const pay = useMutation({
    mutationFn: () => auctionsApi.pay(auctionId, { name: name.trim(), phone: phone.trim() }),
    onSuccess: () => navigation.goBack(),
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Xizmat vaqtincha mavjud emas.'),
  });

  const paymentsOff = paymentsStatus === 'disabled';
  const canSubmit = !paymentsOff && name.trim().length >= 2 && phone.trim().length >= 9 && !pay.isPending;

  return (
    <ScreenWithHeader title="Auksion to'lovi" onBack={navigation.goBack}>
      {paymentsOff && (
        <View style={styles.banner}>
          <PremiumBadge label="To'lovlar yopiq" tone="warning" />
          <Text style={styles.bannerText}>To'lov tizimi yoqilgach shu yerdan to'lashingiz mumkin bo'ladi.</Text>
        </View>
      )}

      <PremiumInput label="Ism" value={name} onChangeText={setName} editable={!paymentsOff} />
      <PremiumInput label="Telefon" value={phone} onChangeText={setPhone} keyboardType="phone-pad" editable={!paymentsOff} />

      {!!error && <Text style={styles.error}>{error}</Text>}

      <PremiumButton label="To'lash" onPress={() => pay.mutate()} loading={pay.isPending} disabled={!canSubmit} />
    </ScreenWithHeader>
  );
}

const styles = StyleSheet.create({
  banner: { backgroundColor: color.surface, borderRadius: 14, padding: space.md, marginBottom: space.lg, gap: space.xs },
  bannerText: { ...typeTokens.caption, color: color.textSecondary },
  error: { ...typeTokens.caption, color: color.danger, marginBottom: space.md },
});
