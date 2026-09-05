import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../state/authStore';
import { color, space, type as typeTokens } from '../../design-system/tokens';
import { PremiumLoadingSkeleton } from '../../design-system/components/PremiumLoadingSkeleton';

type Props = NativeStackScreenProps<AuthStackParamList, 'Splash'>;

/**
 * Resolves the session (GET /api/auth/me, via authStore.bootstrap — kicked
 * off once from App.tsx so it isn't re-run on every Splash re-mount) before
 * routing. `status === 'authenticated'` is handled one level up by
 * RootNavigator swapping the whole stack to MainTabs; this screen only
 * needs to hand off to Login once it knows the user is a guest.
 */
export function SplashScreen({ navigation }: Props) {
  const status = useAuthStore((s) => s.status);

  useEffect(() => {
    if (status === 'guest') {
      navigation.replace('Login');
    }
  }, [status, navigation]);

  return (
    <View style={styles.wrapper}>
      <Text style={styles.logo}>NFCSTORE</Text>
      <View style={styles.loader}>
        <PremiumLoadingSkeleton height={4} width={120} borderRadius={2} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: color.bgDeep, alignItems: 'center', justifyContent: 'center' },
  logo: { ...typeTokens.display, color: color.gold, letterSpacing: 2 },
  loader: { marginTop: space.xl },
});
