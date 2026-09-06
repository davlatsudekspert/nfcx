import React from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Feather } from '@expo/vector-icons';
import type { IdStackParamList } from '../../navigation/types';
import { ScreenWithHeader } from '../shared/ScreenWithHeader';
import { PremiumButton } from '../../design-system/components/PremiumButton';
import { PremiumCard } from '../../design-system/components/PremiumCard';
import { PremiumBadge } from '../../design-system/components/PremiumBadge';
import { PremiumQueryState } from '../../design-system/components/PremiumQueryState';
import { useToast } from '../../design-system/components/PremiumToast';
import { PurchaseSteps } from './PurchaseSteps';
import { ORDER_STATUS_HINT, ORDER_STATUS_LABEL, ORDER_STATUS_TONE, orderStatus } from './orderStatus';
import { ordersApi } from '../../api/orders';
import { formatSom, safeText } from '../../lib/format';
import { haptics } from '../../native/haptics';
import { useT } from '../../i18n';
import { color, radius, space, touchTarget, type as typeTokens } from '../../design-system/tokens';

type Props = NativeStackScreenProps<IdStackParamList, 'PurchaseStep3'>;

/**
 * Step 3/3 — payment.
 *
 * Payme is the only live integration (android/docs/02-API_MAP.md §2.2/§2.3;
 * `.env.example` calls it "PAYME (asosiy va yagona)"). Click / card / bank
 * transfer from the mockup are backed by nothing, so they are rendered as
 * visibly unavailable rows rather than buttons wired to a dead end.
 *
 * The order status is read from `GET /api/orders/:id` — the server is the
 * only thing that can say a payment landed, so this screen polls it and
 * never advances on its own optimism.
 */
export function PurchaseStep3Screen({ route, navigation }: Props) {
  const { orderId, price, payLink, code } = route.params;
  const t = useT();
  const toast = useToast();
  const queryClient = useQueryClient();

  const order = useQuery({
    queryKey: ['orders', orderId],
    queryFn: () => ordersApi.get(orderId),
    refetchInterval: (query) => (orderStatus(query.state.data) === 'pending' ? 3000 : false),
  });

  const status = orderStatus(order.data);

  React.useEffect(() => {
    if (status === 'paid') {
      queryClient.invalidateQueries({ queryKey: ['orders', 'mine'] });
      navigation.replace('PurchaseResult', { code, orderId });
    }
  }, [status, navigation, code, orderId, queryClient]);

  const openPayme = async () => {
    if (!payLink) return;
    haptics.medium();
    const ok = await Linking.openURL(payLink).then(
      () => true,
      () => false,
    );
    if (!ok) toast.show("To'lov sahifasini ochib bo'lmadi.", 'danger');
  };

  return (
    <ScreenWithHeader title="Xarid" onBack={navigation.canGoBack() ? navigation.goBack : undefined}>
      <PurchaseSteps current={3} />

      <PremiumCard variant="featured">
        <View style={styles.row}>
          <Feather name="hash" size={16} color={color.gold} />
          <Text style={styles.code} numberOfLines={1}>
            {safeText(code, '—')}
          </Text>
          {order.data && <PremiumBadge label={ORDER_STATUS_LABEL[status]} tone={ORDER_STATUS_TONE[status]} />}
        </View>
        <Text style={styles.priceLabel}>To'lov summasi</Text>
        <Text style={styles.price}>{formatSom(order.data?.price ?? price)}</Text>
        <Text style={styles.orderId}>Buyurtma raqami: {safeText(orderId, '—')}</Text>
      </PremiumCard>

      <Text style={styles.sectionTitle}>TO'LOV USULI</Text>

      <PaymentOption
        icon="credit-card"
        label="Payme"
        description={payLink ? "Payme ilovasi yoki sahifasi orqali to'lash" : "To'lov havolasi olinmadi"}
        available={!!payLink}
        onPress={openPayme}
      />
      <PaymentOption icon="smartphone" label="Click" description="Tez orada" available={false} />
      <PaymentOption icon="credit-card" label="Karta orqali" description="Tez orada" available={false} />
      <PaymentOption icon="home" label="Bank o'tkazma" description="Tez orada" available={false} />

      <Text style={styles.sectionTitle}>HOLAT</Text>
      <PremiumQueryState
        isLoading={order.isLoading}
        isError={order.isError}
        error={order.error}
        onRetry={() => order.refetch()}
        skeletonRows={1}
        skeletonHeight={80}
      >
        <PremiumCard variant="sunken">
          <View style={styles.statusRow}>
            <Feather
              name={status === 'pending' ? 'clock' : status === 'paid' ? 'check-circle' : 'alert-circle'}
              size={18}
              color={status === 'pending' ? color.warning : status === 'paid' ? color.success : color.textSecondary}
            />
            <Text style={styles.statusLabel}>{ORDER_STATUS_LABEL[status]}</Text>
          </View>
          <Text style={styles.statusHint}>{ORDER_STATUS_HINT[status]}</Text>

          <PremiumButton
            label="To'lov holatini tekshirish"
            variant="ghost"
            loading={order.isFetching}
            onPress={() => order.refetch()}
            style={styles.statusCta}
          />

          {(status === 'cancelled' || status === 'expired') && (
            <PremiumButton
              label="Boshqa ID qidirish"
              variant="ghost"
              onPress={() => navigation.navigate('IdSearch')}
              style={styles.statusCta}
            />
          )}
        </PremiumCard>
      </PremiumQueryState>

      <Text style={styles.footNote}>
        {t('payments.pending')} — to'lov tasdiqlangach ID avtomatik biriktiriladi, bu sahifani yopsangiz ham.
      </Text>
    </ScreenWithHeader>
  );
}

function PaymentOption({
  icon,
  label,
  description,
  available,
  onPress,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  description: string;
  available: boolean;
  onPress?: () => void;
}) {
  if (available && onPress) {
    return (
      <View style={styles.option}>
        <Feather name={icon} size={18} color={color.gold} />
        <View style={styles.optionCopy}>
          <Text style={styles.optionLabel}>{label}</Text>
          <Text style={styles.optionDescription}>{description}</Text>
        </View>
        <PremiumButton label="To'lash" onPress={onPress} fullWidth={false} style={styles.optionCta} />
      </View>
    );
  }
  return (
    <View style={[styles.option, styles.optionDisabled]} accessibilityState={{ disabled: true }}>
      <Feather name={icon} size={18} color={color.textTertiary} />
      <View style={styles.optionCopy}>
        <Text style={[styles.optionLabel, styles.optionLabelDisabled]}>{label}</Text>
        <Text style={styles.optionDescription}>{description}</Text>
      </View>
      <PremiumBadge label="Mavjud emas" tone="neutral" />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  code: { ...typeTokens.monoLarge, color: color.textPrimary, flex: 1 },
  priceLabel: { ...typeTokens.caption, color: color.textSecondary, marginTop: space.lg },
  price: { ...typeTokens.display, color: color.gold, marginTop: 2 },
  orderId: { ...typeTokens.caption, color: color.textTertiary, marginTop: space.sm },
  sectionTitle: { ...typeTokens.overline, color: color.textTertiary, marginTop: space.xl, marginBottom: space.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: touchTarget + 8,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    borderRadius: radius.md,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    marginBottom: space.sm,
  },
  optionDisabled: { opacity: 0.6 },
  optionCopy: { flex: 1 },
  optionLabel: { ...typeTokens.bodyStrong, color: color.textPrimary },
  optionLabelDisabled: { color: color.textSecondary },
  optionDescription: { ...typeTokens.caption, color: color.textTertiary, marginTop: 2 },
  optionCta: { paddingHorizontal: space.lg, minHeight: 40 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  statusLabel: { ...typeTokens.h3, color: color.textPrimary },
  statusHint: { ...typeTokens.caption, color: color.textSecondary, marginTop: space.xs },
  statusCta: { marginTop: space.md },
  footNote: { ...typeTokens.caption, color: color.textTertiary, marginTop: space.lg, textAlign: 'center' },
});
