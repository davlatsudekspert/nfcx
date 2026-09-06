import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/types';
import { PremiumHeader } from '../../design-system/components/PremiumHeader';
import { PremiumInput } from '../../design-system/components/PremiumInput';
import { PremiumButton } from '../../design-system/components/PremiumButton';
import { PremiumCard } from '../../design-system/components/PremiumCard';
import { authApi } from '../../api/auth';
import { ApiError } from '../../api/client';
import { REGISTRATION_LIVE } from '../../config/remoteFlags';
import { color, gradient, space, type as typeTokens } from '../../design-system/tokens';
import { AccountAccessBlock } from './EntrySections';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * The signup screen, built and kept whole — but honest about the fact that
 * the backend it needs does not exist yet.
 *
 * Verified against production `hosting/worker.js`: `authApi` handles exactly
 * `POST /api/auth/login`, `POST /api/auth/logout` and `GET /api/auth/me`.
 * There is no registration route of any kind — not for this app and not for
 * the website — so `REGISTRATION_LIVE` is false (see
 * `src/config/remoteFlags.ts`).
 *
 * What that means here, concretely:
 *  - the form, its validation and the real `requestRegisterCode` call all
 *    stay wired, so flipping the flag is the only change needed the day the
 *    endpoint ships (no fake backend was built to paper over it);
 *  - the CTA is disabled and says plainly why, rather than handing a real
 *    person a request that is guaranteed to fail;
 *  - the actual way to get an account today — the team's own published
 *    Telegram and phone (src/pages/ContactPage.jsx) — is offered first, at
 *    the top, as the primary action.
 */
export function RegisterScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const emailError = email.length > 0 && !EMAIL_RE.test(email) ? "Email formati noto'g'ri." : null;
  const passwordError =
    password.length > 0 && password.length < 6 ? "Parol kamida 6 belgidan iborat bo'lishi kerak." : null;
  const formValid = EMAIL_RE.test(email) && password.length >= 6 && phone.trim().length >= 9;
  const canSubmit = REGISTRATION_LIVE && formValid && !loading;

  const onSubmit = async () => {
    if (!canSubmit) return;
    setError(null);
    setLoading(true);
    try {
      // Real call, real contract (android/docs/02-API_MAP.md §2.1) — not a
      // mock. Left wired so flipping REGISTRATION_LIVE is the only change
      // needed once the backend catches up.
      await authApi.requestRegisterCode(phone.trim());
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Xizmat vaqtincha mavjud emas.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
      <LinearGradient
        colors={gradient.screenAmbient}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.ambient}
        pointerEvents="none"
      />
      <PremiumHeader title="Ro‘yxatdan o‘tish" onBack={navigation.goBack} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <AccountAccessBlock note="Yangi hisoblar hozircha jamoamiz orqali ochiladi. Telegram yoki telefon orqali yozing — hisobingizni ochib, NFC ID tanlashda yordam beramiz." />

          {!REGISTRATION_LIVE && (
            <Text style={styles.note}>
              Ilovadagi o‘z-o‘zidan ro‘yxatdan o‘tish hozircha ochilmagan. Quyidagi shakl tayyor —
              xizmat ishga tushgan kuni shu yerdan davom etasiz.
            </Text>
          )}

          <PremiumCard style={styles.formCardOuter} contentStyle={styles.formCard} animate={false}>
            <PremiumInput
              label="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              error={emailError}
              disabled={!REGISTRATION_LIVE}
              testID="register-email"
            />
            <PremiumInput
              label="Telefon raqam"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              textContentType="telephoneNumber"
              disabled={!REGISTRATION_LIVE}
              testID="register-phone"
            />
            <PremiumInput
              label="Parol"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              textContentType="newPassword"
              error={passwordError}
              disabled={!REGISTRATION_LIVE}
              testID="register-password"
            />

            {!!error && <Text style={styles.serverError}>{error}</Text>}

            <PremiumButton
              label="Tasdiqlash kodi olish"
              onPress={onSubmit}
              loading={loading}
              disabled={!canSubmit}
              testID="register-submit"
            />
          </PremiumCard>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Hisobingiz bormi?</Text>
            <PremiumButton label="Kirish" variant="ghost" onPress={navigation.goBack} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.bg },
  flex: { flex: 1 },
  ambient: { position: 'absolute', top: 0, left: 0, right: 0, height: 200 },
  content: { padding: space.lg, paddingBottom: space.xxxl, flexGrow: 1 },
  note: { ...typeTokens.body, color: color.textSecondary, marginTop: space.xl },
  formCardOuter: { marginTop: space.lg },
  formCard: { gap: space.xs },
  serverError: { ...typeTokens.caption, color: color.danger, marginBottom: space.sm },
  footer: { marginTop: space.xl, gap: space.sm },
  footerText: { ...typeTokens.caption, color: color.textTertiary, textAlign: 'center' },
});
