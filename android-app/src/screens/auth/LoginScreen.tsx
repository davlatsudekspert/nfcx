import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/types';
import { PremiumInput } from '../../design-system/components/PremiumInput';
import { PremiumButton } from '../../design-system/components/PremiumButton';
import { useAuthStore } from '../../state/authStore';
import { ApiError } from '../../api/client';
import { color, gradient, radius, space, type as typeTokens } from '../../design-system/tokens';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * POST /api/auth/login against the real Worker (android/docs/02-API_MAP.md
 * §2.1). On success, RootNavigator swaps to MainTabs automatically once
 * authStore.status flips to 'authenticated' — this screen doesn't navigate
 * itself. Client-side validation mirrors the server's own rules (email
 * shape, password length) purely to give instant feedback; the server is
 * still the real authority and its error is what actually renders.
 *
 * This is the app's first impression, so the chrome is deliberate: an ambient
 * gold wash over near-black, a gold ring mark, and a keyboard-aware layout
 * that never traps the submit button under the keyboard.
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
    <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
      <LinearGradient
        colors={gradient.screenAmbient}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 1, y: 0.9 }}
        style={styles.ambient}
        pointerEvents="none"
      />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View style={styles.mark}>
              <Text style={styles.markText}>N</Text>
            </View>
            <Text style={styles.logo}>NFCSTORE</Text>
            <Text style={styles.subtitle}>Raqamli tashrifnomangizni boshqaring</Text>
          </View>

          <View style={styles.form}>
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

            <PremiumButton
              label="Kirish"
              onPress={onSubmit}
              loading={loading}
              disabled={!canSubmit}
              testID="login-submit"
              style={styles.submit}
            />
            <PremiumButton
              label="Ro'yxatdan o'tish"
              variant="ghost"
              onPress={() => navigation.navigate('Register')}
              style={styles.registerButton}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.bgDeep },
  flex: { flex: 1 },
  ambient: { position: 'absolute', top: 0, left: 0, right: 0, height: 320 },
  content: { flexGrow: 1, justifyContent: 'center', padding: space.xl },
  header: { alignItems: 'center', marginBottom: space.xxl },
  mark: {
    width: 72,
    height: 72,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: color.borderGoldStrong,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.goldWash,
  },
  markText: { ...typeTokens.display, color: color.gold },
  logo: { ...typeTokens.h1, color: color.textPrimary, letterSpacing: 3, marginTop: space.lg },
  subtitle: { ...typeTokens.body, color: color.textSecondary, marginTop: space.xs, textAlign: 'center' },
  form: { gap: space.xs },
  serverError: { ...typeTokens.caption, color: color.danger, marginBottom: space.sm },
  submit: { marginTop: space.md },
  registerButton: { marginTop: space.sm },
});
