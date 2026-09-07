import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Feather } from '@expo/vector-icons';
import type { IdStackParamList, MainTabParamList } from '../../navigation/types';
import { PremiumHeader } from '../../design-system/components/PremiumHeader';
import { PremiumButton } from '../../design-system/components/PremiumButton';
import { PremiumBadge, TierBadge } from '../../design-system/components/PremiumBadge';
import { PremiumQueryState } from '../../design-system/components/PremiumQueryState';
import { SuccessCheck } from '../../composites/SuccessCheck';
import { ORDER_STATUS_HINT, ORDER_STATUS_LABEL, ORDER_STATUS_TONE, orderStatus } from './orderStatus';
import { ordersApi } from '../../api/orders';
import { orderKeys } from '../../hooks/useMyOrders';
import { tierForCode } from '../../lib/pricing';
import { formatSom, safeText } from '../../lib/format';
import { useAuthStore } from '../../state/authStore';
import { haptics } from '../../native/haptics';
import { color, radius, space, type as typeTokens } from '../../design-system/tokens';

type Props = NativeStackScreenProps<IdStackParamList, 'PurchaseResult'>;

/**
 * The order outcome screen.
 *
 * Every state here comes from `GET /api/orders/:id`. There is deliberately no
 * "assume success" path: a pending order renders as pending (with a live
 * re-check), a cancelled/expired one says so and offers a way forward, and an
 * unrecognised status is reported honestly instead of being rounded up to
 * "Muvaffaqiyatli".
 */
export function PurchaseResultScreen({ route, navigation }: Props) {
  const { code, orderId } = route.params;
  const tabNavigation = navigation.getParent<BottomTabNavigationProp<MainTabParamList>>();
  const refreshAuth = useAuthStore((s) => s.refresh);
  const queryClient = useQueryClient();

  const order = useQuery({
    queryKey: orderKeys.detail(orderId),
    queryFn: () => ordersApi.get(orderId),
    refetchInterval: (query) => (orderStatus(query.state.data) === 'pending' ? 5000 : false),
  });

  const status = orderStatus(order.data);
  const paid = status === 'paid';
  const settled = order.isSuccess && status !== 'pending';

  useEffect(() => {
    // Once this order stops being payable (paid, cancelled, …), the shared
    // list behind Home's pending count and "Kutilayotgan buyurtmalar" is
    // out of date — drop it so the next screen shows the server's answer.
    if (settled) queryClient.invalidateQueries({ queryKey: orderKeys.mine });
  }, [settled, queryClient]);

  useEffect(() => {
    if (!paid) return;
    haptics.success();
    // The card only appears in `cards` once the server confirms payment —
    // refreshing here is what makes "Mening ID'larim" show it immediately.
    void refreshAuth().catch(() => {});
  }, [paid, refreshAuth]);

  const goHome = () => tabNavigation?.navigate('HomeTab', { screen: 'Home' });
  const goWorkspace = () => tabNavigation?.navigate('ProfileTab', { screen: 'IdOwnerWorkspace', params: { code } });
  const goSearch = () => navigation.navigate('IdSearch');

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <PremiumHeader onBack={navigation.canGoBack() ? navigation.goBack : undefined} />
      <View style={styles.body}>
        <PremiumQueryState
          isLoading={order.isLoading}
          isError={order.isError}
          error={order.error}
          onRetry={() => order.refetch()}
          onUnauthorized={() => {
            void refreshAuth().catch(() => {});
          }}
          skeletonRows={2}
          skeletonHeight={120}
        >
          <View style={styles.center}>
            {paid ? (
              <>
                <SuccessCheck />
                <Text style={styles.title}>Muvaffaqiyatli!</Text>
              </>
            ) : (
              <>
                <View style={styles.iconRing}>
                  <Feather
                    name={status === 'pending' ? 'clock' : 'alert-circle'}
                    size={40}
                    color={status === 'pending' ? color.warning : color.textSecondary}
                  />
                </View>
                <Text style={styles.title}>{ORDER_STATUS_LABEL[status]}</Text>
              </>
            )}

            <View style={styles.idBadge}>
              <Text style={styles.code}>{safeText(code, '—')}</Text>
              <TierBadge tier={tierForCode(code)} />
              <PremiumBadge label={ORDER_STATUS_LABEL[status]} tone={ORDER_STATUS_TONE[status]} />
            </View>

            <Text style={styles.subtitle}>{ORDER_STATUS_HINT[status]}</Text>

            {order.data?.price != null && <Text style={styles.price}>{formatSom(order.data.price)}</Text>}

            <View style={styles.actions}>
              {paid ? (
                <PremiumButton label="Profilni sozlash" onPress={goWorkspace} />
              ) : status === 'pending' ? (
                <PremiumButton
                  label="To'lov holatini tekshirish"
                  loading={order.isFetching}
                  onPress={() => order.refetch()}
                />
              ) : (
                <PremiumButton label="Boshqa ID qidirish" onPress={goSearch} />
              )}
              <PremiumButton label="Bosh sahifaga qaytish" variant="ghost" onPress={goHome} />
            </View>

            <Text style={styles.orderMeta}>Buyurtma raqami: {safeText(orderId, '—')}</Text>
          </View>
        </PremiumQueryState>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.bg },
  body: { flex: 1, paddingHorizontal: space.lg, justifyContent: 'center' },
  center: { alignItems: 'center', gap: space.md },
  iconRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: color.border,
    backgroundColor: color.surfaceSunken,
  },
  title: { ...typeTokens.h1, color: color.textPrimary, textAlign: 'center' },
  idBadge: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap', justifyContent: 'center' },
  code: { ...typeTokens.monoLarge, color: color.gold },
  subtitle: { ...typeTokens.body, color: color.textSecondary, textAlign: 'center', paddingHorizontal: space.lg },
  price: {
    ...typeTokens.h2,
    color: color.textPrimary,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    backgroundColor: color.surfaceSunken,
    borderWidth: 1,
    borderColor: color.border,
    overflow: 'hidden',
  },
  actions: { width: '100%', gap: space.sm, marginTop: space.lg },
  orderMeta: { ...typeTokens.caption, color: color.textTertiary, marginTop: space.sm },
});
