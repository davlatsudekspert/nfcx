import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Feather } from '@expo/vector-icons';
import { useMutation } from '@tanstack/react-query';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import type { ProfileStackParamList, MainTabParamList } from '../../navigation/types';
import { ScreenWithHeader } from '../shared/ScreenWithHeader';
import { PremiumButton } from '../../design-system/components/PremiumButton';
import { readNfcChipToken } from '../../native/nfc';
import { contentApi } from '../../api/content';
import { haptics } from '../../native/haptics';
import { color, space, type as typeTokens } from '../../design-system/tokens';

type Props = NativeStackScreenProps<ProfileStackParamList, 'NfcRead'>;

type ReadState = 'idle' | 'scanning' | 'success' | 'unsupported' | 'error';

/**
 * Real foreground-dispatch NFC read (src/native/nfc.ts), validated against
 * the real `GET /api/tap/:chipToken` endpoint (android/docs/02-API_MAP.md
 * §2.7) — the same check the physical-card tap flow uses on the web. This
 * screen's *code path* is complete and real; on-device verification
 * against actual NFC hardware needs a physical Android device, which this
 * sandbox does not have (android/docs/07-PHASE4-NAVIGATION-REPORT.md).
 */
export function NfcReadScreen({ navigation }: Props) {
  const [state, setState] = useState<ReadState>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const tabNavigation = navigation.getParent<BottomTabNavigationProp<MainTabParamList>>();

  const tapCheck = useMutation({
    mutationFn: (chipToken: string) => contentApi.tap(chipToken),
    onSuccess: (result) => {
      if (result.active && result.linkedCode) {
        haptics.success();
        setState('success');
        tabNavigation?.navigate('HomeTab', { screen: 'PublicProfile', params: { code: result.linkedCode } });
      } else {
        haptics.warning();
        setState('error');
        setMessage(result.active ? "Bu karta hali biror ID'ga bog'lanmagan." : 'Bu karta faol emas.');
      }
    },
    onError: () => {
      haptics.error();
      setState('error');
      setMessage('Tekshirishda xatolik yuz berdi.');
    },
  });

  const startScan = async () => {
    setState('scanning');
    setMessage(null);
    const result = await readNfcChipToken();
    if (result.status === 'ok') {
      tapCheck.mutate(result.chipToken);
    } else if (result.status === 'unsupported') {
      setState('unsupported');
      setMessage("Bu qurilmada NFC mavjud emas yoki o'chirilgan.");
    } else if (result.status === 'cancelled') {
      setState('idle');
    } else {
      setState('error');
      setMessage(result.message);
    }
  };

  return (
    <ScreenWithHeader title="NFC o'qish" onBack={navigation.goBack} scroll={false}>
      <View style={styles.center}>
        <NfcRipple scanning={state === 'scanning'} />
        <Text style={styles.title}>NFC kartani yaqinlashtiring</Text>
        <Text style={styles.subtitle}>Telefoningizning orqa qismini NFC kartaga yaqinlashtiring.</Text>

        {!!message && <Text style={styles.message}>{message}</Text>}

        <PremiumButton
          label={state === 'scanning' ? 'Skanerlanmoqda...' : 'Skanerlashni boshlash'}
          onPress={startScan}
          loading={state === 'scanning' || tapCheck.isPending}
          disabled={state === 'unsupported'}
          style={styles.button}
        />
      </View>
    </ScreenWithHeader>
  );
}

function NfcRipple({ scanning }: { scanning: boolean }) {
  const ring1 = useSharedValue(0);
  const ring2 = useSharedValue(0);

  useEffect(() => {
    if (!scanning) {
      ring1.value = 0;
      ring2.value = 0;
      return;
    }
    ring1.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.out(Easing.ease) }), -1, false);
    ring2.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.out(Easing.ease) }), -1, false);
  }, [scanning, ring1, ring2]);

  const ring1Style = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + ring1.value * 1.6 }],
    opacity: (1 - ring1.value) * 0.5,
  }));
  const ring2Style = useAnimatedStyle(() => ({
    // Offset the second ring by starting its progress half a cycle behind
    // ring1's, so the two ripples don't pulse in lockstep.
    transform: [{ scale: 1 + ((ring2.value + 0.5) % 1) * 1.6 }],
    opacity: (1 - ((ring2.value + 0.5) % 1)) * 0.5,
  }));

  return (
    <View style={styles.rippleWrapper}>
      {scanning && <Animated.View style={[styles.ring, ring1Style]} />}
      {scanning && <Animated.View style={[styles.ring, ring2Style]} />}
      <Feather name="wifi" size={48} color={scanning ? color.gold : color.textTertiary} style={styles.rippleIcon} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.sm, paddingHorizontal: space.xl },
  rippleWrapper: { width: 96, height: 96, alignItems: 'center', justifyContent: 'center', marginBottom: space.md },
  ring: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    borderColor: color.gold,
  },
  rippleIcon: { transform: [{ rotate: '90deg' }] },
  title: { ...typeTokens.h1, color: color.textPrimary, textAlign: 'center' },
  subtitle: { ...typeTokens.body, color: color.textSecondary, textAlign: 'center' },
  message: { ...typeTokens.caption, color: color.warning, textAlign: 'center', marginTop: space.sm },
  button: { marginTop: space.xl, width: '100%' },
});
