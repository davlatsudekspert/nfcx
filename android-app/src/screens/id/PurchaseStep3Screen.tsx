import React from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { Feather } from '@expo/vector-icons';
import type { IdStackParamList } from '../../navigation/types';
import { ScreenWithHeader } from '../shared/ScreenWithHeader';
import { PremiumButton } from '../../design-system/components/PremiumButton';
import { PremiumCard } from '../../design-system/components/PremiumCard';
import { PremiumListRow } from '../../design-system/components/PremiumListRow';
import { ordersApi } from '../../api/orders';
import { formatSom } from '../../lib/format';
import { color, space, type as typeTokens } from '../../design-system/tokens';

type Props = NativeStackScreenProps<IdStackParamList, 'PurchaseStep3'>;

/**
 * Step 3/3 — payment. Only Payme is a real, live integration
 * (android/docs/02-API_MAP.md §2.2/§2.3 — Click/Karta/Bank from the mockup
 * are not backed by any real endpoint, per `.env.example`'s own
 * "PAYME (asosiy va yagona)" note) — shown disabled with "Tez orada" rather
 * than wired to nothing.
 */
export function PurchaseStep3Screen({ route, navigation }: Props) {
  const { orderId, price, payLink, code } = route.params;

  const order = useQuery({
    queryKey: ['orders', orderId],
    queryFn: () => ordersApi.get(orderId),
    refetchInterval: (query) => (query.state.data?.status === 'pending' ? 3000 : false),
  });

  React.useEffect(() => {
    if (order.data?.status === 'paid') {
      navigation.replace('PurchaseResult', { code, orderId });
    }
  }, [order.data?.status, navigation, code, orderId]);

  return (
    <ScreenWithHeader title="Xarid — 3/3" onBack={navigation.goBack}>
      <PremiumCard>
        <View style={styles.row}>
          <Feather name="hash" size={18} color={color.gold} />
          <Text style={styles.code}>{code}</Text>
        </View>
        <Text style={styles.priceLabel}>To'lov summasi</Text>
        <Text style={styles.price}>{formatSom(price)}</Text>
      </PremiumCard>

      <Text style={styles.sectionTitle}>To'lov usuli</Text>

      <PremiumListRow
        icon="credit-card"
        label="Payme"
        onPress={payLink ? () => Linking.openURL(payLink) : undefined}
        showChevron={!!payLink}
      />
      <PremiumListRow icon="smartphone" label="Click" value="Tez orada" showChevron={false} />
      <PremiumListRow icon="credit-card" label="Karta orqali" value="Tez orada" showChevron={false} />
      <PremiumListRow icon="home" label="Bank o'tkazma" value="Tez orada" showChevron={false} />

      {order.data?.status === 'pending' && (
        <View style={styles.pendingBox}>
          <PremiumButton label="To'lov holatini tekshirish" variant="ghost" loading={order.isFetching} onPress={() => order.refetch()} />
        </View>
      )}
    </ScreenWithHeader>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.xs, marginBottom: space.sm },
  code: { ...typeTokens.mono, color: color.textPrimary },
  priceLabel: { ...typeTokens.caption, color: color.textSecondary },
  price: { ...typeTokens.h1, color: color.gold, marginTop: 2 },
  sectionTitle: { ...typeTokens.h2, color: color.textPrimary, marginTop: space.xl, marginBottom: space.sm },
  pendingBox: { marginTop: space.lg },
});
