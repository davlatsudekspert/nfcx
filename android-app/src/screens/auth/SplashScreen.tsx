import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../state/authStore';
import { color, gradient, radius, space, type as typeTokens } from '../../design-system/tokens';

type Props = NativeStackScreenProps<AuthStackParamList, 'Splash'>;

/**
 * Resolves the session (GET /api/auth/me, via authStore.bootstrap — kicked
 * off once from App.tsx so it isn't re-run on every Splash re-mount) before
 * routing. `status === 'authenticated'` is handled one level up by
 * RootNavigator swapping the whole stack to MainTabs; this screen only
 * needs to hand off to Login once it knows the user is a guest.
 *
 * The mark breathes rather than spins: one slow opacity cycle reads as
 * "working" without the cheap glitter the brief rules out.
 */
export function SplashScreen({ navigation }: Props) {
  const status = useAuthStore((s) => s.status);
  const breath = useSharedValue(0.55);

  useEffect(() => {
    breath.value = withRepeat(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [breath]);

  useEffect(() => {
    if (status === 'guest') {
      navigation.replace('Login');
    }
  }, [status, navigation]);

  const breathStyle = useAnimatedStyle(() => ({ opacity: breath.value }));

  return (
    <View style={styles.wrapper}>
      <LinearGradient
        colors={gradient.screenAmbient}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <Animated.View style={[styles.mark, breathStyle]}>
        <Text style={styles.markText}>N</Text>
      </Animated.View>
      <Text style={styles.logo}>NFCSTORE</Text>
      <Text style={styles.tagline}>RAQAMLI TASHRIFNOMA</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: color.bgDeep, alignItems: 'center', justifyContent: 'center' },
  mark: {
    width: 84,
    height: 84,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: color.borderGoldStrong,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.goldWash,
  },
  markText: { ...typeTokens.display, color: color.gold },
  logo: { ...typeTokens.h1, color: color.textPrimary, letterSpacing: 4, marginTop: space.xl },
  tagline: { ...typeTokens.caption, color: color.textTertiary, marginTop: space.xs, letterSpacing: 1 },
});
