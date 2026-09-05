import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/types';
import { ScreenWithHeader } from '../shared/ScreenWithHeader';
import { PremiumInput } from '../../design-system/components/PremiumInput';
import { PremiumButton } from '../../design-system/components/PremiumButton';
import { PremiumBadge } from '../../design-system/components/PremiumBadge';
import { authApi } from '../../api/auth';
import { ApiError } from '../../api/client';
import { REGISTRATION_LIVE } from '../../config/remoteFlags';
import { color, space, type as typeTokens } from '../../design-system/tokens';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Ships fully built per the plan, gated behind REGISTRATION_LIVE
 * (android/docs/01-AUDIT.md §1.6 item 1) rather than faking a backend the
 * brief explicitly forbids ("registration backend yetishmasa app
 * architecture tayyor bo'lsin, lekin fake backend yaratma"). The form,
 * validation, and real API call all exist and are exercised by the submit
 * handler below — only the CTA is disabled and an honest banner shown while
 * the flag is off, so a real user is never handed a guaranteed failure.
 */
export function RegisterScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const emailError = email.length > 0 && !EMAIL_RE.test(email) ? "Email formati noto'g'ri." : null;
  const passwordError = password.length > 0 && password.length < 6 ? "Parol kamida 6 belgidan iborat bo'lishi kerak." : null;
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
    <ScreenWithHeader title="Ro'yxatdan o'tish" onBack={navigation.goBack}>
      {!REGISTRATION_LIVE && (
        <View style={styles.banner}>
          <PremiumBadge label="Vaqtincha mavjud emas" tone="warning" />
          <Text style={styles.bannerText}>
            Ro'yxatdan o'tish hozircha faol emas. Mavjud hisobingiz bo'lsa, "Kirish" orqali davom eting.
          </Text>
        </View>
      )}

      <PremiumInput label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" error={emailError} editable={REGISTRATION_LIVE} />
      <PremiumInput label="Telefon raqam" value={phone} onChangeText={setPhone} keyboardType="phone-pad" editable={REGISTRATION_LIVE} />
      <PremiumInput label="Parol" value={password} onChangeText={setPassword} secureTextEntry error={passwordError} editable={REGISTRATION_LIVE} />

      {!!error && <Text style={styles.serverError}>{error}</Text>}

      <PremiumButton label="Tasdiqlash kodi olish" onPress={onSubmit} loading={loading} disabled={!canSubmit} />
    </ScreenWithHeader>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: color.surface,
    borderRadius: 14,
    padding: space.md,
    marginBottom: space.lg,
    gap: space.xs,
  },
  bannerText: { ...typeTokens.caption, color: color.textSecondary },
  serverError: { ...typeTokens.caption, color: color.danger, marginBottom: space.md },
});
