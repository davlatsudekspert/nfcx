import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/types';
import { ScreenContainer } from '../shared/ScreenContainer';
import { PremiumInput } from '../../design-system/components/PremiumInput';
import { PremiumButton } from '../../design-system/components/PremiumButton';
import { useAuthStore } from '../../state/authStore';
import { ApiError } from '../../api/client';
import { color, space, type as typeTokens } from '../../design-system/tokens';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * POST /api/auth/login against the real Worker (android/docs/02-API_MAP.md
 * §2.1). On success, RootNavigator swaps to MainTabs automatically once
 * authStore.status flips to 'authenticated' — this screen doesn't navigate
 * itself. Client-side validation mirrors the server's own rules (email
 * shape, password length) purely to give instant feedback; the server is
 * still the real authority and its error is what actually renders.
 */
export function LoginScreen({ navigation }: Props) {
  const login = useAuthStore((s) => s.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const emailError = email.length > 0 && !EMAIL_RE.test(email) ? "Email formati noto'g'ri." : null;
  const passwordError = password.length > 0 && password.length < 6 ? "Parol kamida 6 belgidan iborat bo'lishi kerak." : null;
  const canSubmit = EMAIL_RE.test(email) && password.length >= 6 && !loading;

  const onSubmit = async () => {
    if (!canSubmit) return;
    setError(null);
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Xizmat vaqtincha mavjud emas.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Text style={styles.logo}>NFCSTORE</Text>
        <Text style={styles.subtitle}>Xush kelibsiz</Text>
      </View>

      <PremiumInput
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        textContentType="emailAddress"
        error={emailError}
        testID="login-email"
      />
      <PremiumInput
        label="Parol"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        textContentType="password"
        error={passwordError}
        testID="login-password"
      />

      {!!error && <Text style={styles.serverError}>{error}</Text>}

      <PremiumButton label="Kirish" onPress={onSubmit} loading={loading} disabled={!canSubmit} testID="login-submit" />

      <PremiumButton
        label="Ro'yxatdan o'tish"
        variant="ghost"
        onPress={() => navigation.navigate('Register')}
        style={styles.registerButton}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { marginTop: space.xxl, marginBottom: space.xl },
  logo: { ...typeTokens.h1, color: color.gold, letterSpacing: 1 },
  subtitle: { ...typeTokens.body, color: color.textSecondary, marginTop: space.xs },
  serverError: { ...typeTokens.caption, color: color.danger, marginBottom: space.md },
  registerButton: { marginTop: space.md },
});
