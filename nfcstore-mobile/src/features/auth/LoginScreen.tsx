import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';

import { ApiError, login } from '@/api/client';
import { GoldButton } from '@/components/GoldButton';
import { TapScale } from '@/components/TapScale';
import { useAuthStore } from '@/store/authStore';
import { useTheme } from '@/theme/ThemeProvider';
import { sans } from '@/theme/type';

import { AuthField } from './AuthField';

const LOGO = require('../../../assets/logo.png');

/**
 * Kirish — `POST /api/auth/login` (haqiqiy, `src/api/client.ts`da
 * allaqachon to'liq yozilgan edi, lekin ekran yo'q edi — audit
 * topilmasi). Telefon HAM, email HAM qabul qilinadi (backend o'zi
 * aniqlaydi). SMS OTP YO'Q — bu oddiy parol bilan kirish.
 */
export function LoginScreen() {
  const { theme } = useTheme();
  const queryClient = useQueryClient();

  const [loginValue, setLoginValue] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = loginValue.trim().length > 2 && password.length >= 6 && !submitting;

  const onSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await login(loginValue.trim(), password);
      // `login()` tokenni SecureStore'ga allaqachon yozdi — authStore
      // holatini shunga moslashtiramiz, aks holda tab qobig'i hali ham
      // "kirmagan" deb hisoblardi. `user: undefined` — "hali aniqlanmadi"
      // (`null` "kirmagan" degani, uni shu yerda qoldirib bo'lmaydi).
      useAuthStore.setState({ hasToken: true, restored: true, user: undefined });
      queryClient.invalidateQueries({ queryKey: ['me'] });
      router.replace('/(tabs)');
    } catch (err) {
      setError(loginErrorText(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24, gap: 20 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <Image source={LOGO} contentFit="contain" style={{ width: 56, height: 56 }} />
          <Text style={[sans(800, 24, 1.2), { color: theme.ink, letterSpacing: -0.4 }]}>
            NFCSTORE
          </Text>
          <Text style={[sans(500, 12.5, 1.4), { color: theme.ash }]}>
            Hisobingizga kiring
          </Text>
        </View>

        <AuthField
          label="Telefon yoki email"
          value={loginValue}
          onChangeText={setLoginValue}
          placeholder="+998901234567"
          keyboardType="email-address"
        />
        <AuthField
          label="Parol"
          value={password}
          onChangeText={setPassword}
          placeholder="••••••"
          secureTextEntry
        />

        {error ? (
          <Text style={[sans(500, 12, 1.4), { color: theme.signal }]}>{error}</Text>
        ) : null}

        <GoldButton
          label={submitting ? 'Kirilmoqda…' : 'Kirish'}
          onPress={canSubmit ? onSubmit : undefined}
          sweep={false}
        />

        <TapScale
          radius={10}
          onPress={() => router.push('/register')}
          accessibilityLabel="Ro'yxatdan o'tish"
          style={{ alignItems: 'center', paddingVertical: 10 }}
        >
          <Text style={[sans(500, 13), { color: theme.ash }]}>
            Hisobingiz yo’qmi?{' '}
            <Text style={{ color: theme.a1, fontWeight: '700' }}>Ro’yxatdan o’ting</Text>
          </Text>
        </TapScale>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function loginErrorText(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'bad_login') return 'Telefon yoki email formatini tekshiring.';
    if (err.code === 'bad_credentials') return 'Login yoki parol noto’g’ri.';
    if (err.code === 'account_deleted') return 'Bu hisob o’chirilgan.';
    if (err.code === 'account_suspended') return 'Bu hisob vaqtincha bloklangan.';
    if (err.code === 'too_many_requests') return 'Juda ko’p urinish. Birozdan keyin qayta urining.';
    if (err.code === 'network_error') return 'Internet aloqasi yo’q. Qayta urinib ko’ring.';
    // Ba'zan `error` o'zbekcha tayyor validatsiya matni bo'ladi (masalan
    // parol uzunligi) — to'g'ridan-to'g'ri ko'rsatiladi.
    if (err.code && !/^[a-z_]+$/.test(err.code)) return err.code;
  }
  return 'Kirib bo’lmadi. Qayta urinib ko’ring.';
}
