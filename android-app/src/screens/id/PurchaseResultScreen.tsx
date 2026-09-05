import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useQuery } from '@tanstack/react-query';
import type { IdStackParamList, MainTabParamList } from '../../navigation/types';
import { ScreenContainer } from '../shared/ScreenContainer';
import { PremiumButton } from '../../design-system/components/PremiumButton';
import { TierBadge } from '../../design-system/components/PremiumBadge';
import { PremiumLoadingSkeleton } from '../../design-system/components/PremiumLoadingSkeleton';
import { SuccessCheck } from '../../composites/SuccessCheck';
import { ordersApi } from '../../api/orders';
import { tierForCode } from '../../lib/pricing';
import { haptics } from '../../native/haptics';
import { color, space, type as typeTokens } from '../../design-system/tokens';

type Props = NativeStackScreenProps<IdStackParamList, 'PurchaseResult'>;

export function PurchaseResultScreen({ route, navigation }: Props) {
  const { code, orderId } = route.params;
  const tabNavigation = navigation.getParent<BottomTabNavigationProp<MainTabParamList>>();
  const order = useQuery({ queryKey: ['orders', orderId], queryFn: () => ordersApi.get(orderId) });
  const status = order.data?.status;

  useEffect(() => {
    if (status === 'paid') haptics.success();
  }, [status]);

  const goHome = () => tabNavigation?.navigate('HomeTab', { screen: 'Home' });
  const goEditProfile = () => tabNavigation?.navigate('ProfileTab', { screen: 'ProfileEdit' });

  if (order.isLoading) {
    return (
      <ScreenContainer scroll={false}>
        <View style={styles.center}>
          <PremiumLoadingSkeleton height={96} width={96} borderRadius={48} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll={false}>
      <View style={styles.center}>
        {status === 'paid' ? (
          <>
            <SuccessCheck />
            <Text style={styles.title}>Muvaffaqiyatli!</Text>
          </>
        ) : (
          <Text style={styles.title}>{status === 'pending' ? "To'lov kutilmoqda" : "To'lov amalga oshmadi"}</Text>
        )}

        <View style={styles.idBadge}>
          <Text style={styles.code}>#{code}</Text>
          <TierBadge tier={tierForCode(code)} />
        </View>

        {status === 'paid' && (
          <Text style={styles.subtitle}>ID sizga muvaffaqiyatli biriktirildi!</Text>
        )}

        {status === 'paid' ? (
          <PremiumButton label="Profilni sozlash" onPress={goEditProfile} style={styles.primaryButton} />
        ) : null}

        <PremiumButton label="Bosh sahifaga qaytish" variant="ghost" onPress={goHome} style={styles.secondaryButton} />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md },
  title: { ...typeTokens.h1, color: color.textPrimary },
  idBadge: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.sm },
  code: { ...typeTokens.h2, color: color.gold },
  subtitle: { ...typeTokens.body, color: color.textSecondary, textAlign: 'center', paddingHorizontal: space.xl },
  primaryButton: { marginTop: space.lg, width: '80%' },
  secondaryButton: { marginTop: space.sm, width: '80%' },
});
