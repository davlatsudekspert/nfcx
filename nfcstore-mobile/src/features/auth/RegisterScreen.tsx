import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import * as WebBrowser from 'expo-web-browser';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { ApiError, register } from '@/api/client';
import { GoldButton } from '@/components/GoldButton';
import { TapScale } from '@/components/TapScale';
import { SITE } from '@/features/profile/profileVM';
import { useAuthStore } from '@/store/authStore';
import { useTheme } from '@/theme/ThemeProvider';
import { sans } from '@/theme/type';

import { AuthField } from './AuthField';

const LOGO = require('../../../assets/logo.png');

/**
 * Ro'yxatdan o'tish — `POST /api/auth/register` (haqiqiy, bir qadam,
 * `hosting/api/auth.js` 2026-09 oqimi):
 *
 *   phone       majburiy
 *   password    majburiy, >= 6 belgi
 *   tosAccepted majburiy
 *   email       IXTIYORIY
 *
 * SMS OTP YO'Q. Telegram tasdig'i BU YERDA SO'RALMAYDI (spetsifikatsiya
 * aniq talabi — Telegram ro'yxatdan o'tishda to'siq bo'lmasin, u
 * Sozlamalar → Profil tasdiqlashda, alohida, keyingi bosqich).
 */
export function RegisterScreen() {
  const { theme } = useTheme();
  const queryClient = useQueryClient();

  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [tosAccepted, setTosAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    phone.trim().length >= 9 &&
    password.length >= 6 &&
    password === confirm &&
    tosAccepted &&
    !submitting;

  const onSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await register({
        phone: phone.trim(),
        password,
        tosAccepted: true,
        email: email.trim() || undefined,
      });
      useAuthStore.setState({ hasToken: true, restored: true, user: undefined });
      queryClient.invalidateQueries({ queryKey: ['me'] });
      router.replace('/(tabs)');
    } catch (err) {
      setError(registerErrorText(err));
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
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24, gap: 16 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <Image source={LOGO} contentFit="contain" style={{ width: 56, height: 56 }} />
          <Text style={[sans(800, 24, 1.2), { color: theme.ink, letterSpacing: -0.4 }]}>
            Ro’yxatdan o’tish
          </Text>
          <Text style={[sans(500, 12.5, 1.4), { color: theme.ash, textAlign: 'center' }]}>
            Telefon raqamingiz bilan bepul hisob oching
          </Text>
        </View>

        <AuthField
          label="Telefon"
          value={phone}
          onChangeText={setPhone}
          placeholder="+998901234567"
          keyboardType="phone-pad"
        />
        <AuthField
          label="Email (ixtiyoriy)"
          value={email}
          onChangeText={setEmail}
          placeholder="siz@misol.uz"
          keyboardType="email-address"
        />
        <AuthField
          label="Parol"
          value={password}
          onChangeText={setPassword}
          placeholder="Kamida 6 belgi"
          secureTextEntry
        />
        <AuthField
          label="Parolni takrorlang"
          value={confirm}
          onChangeText={setConfirm}
          placeholder="••••••"
          secureTextEntry
        />
        {confirm.length > 0 && password !== confirm ? (
          <Text style={[sans(500, 11.5), { color: theme.signal }]}>Parollar mos emas.</Text>
        ) : null}

        <TapScale
          radius={10}
          onPress={() => setTosAccepted((v) => !v)}
          accessibilityState={{ selected: tosAccepted }}
          accessibilityLabel="Ommaviy oferta shartlariga rozilik"
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 }}
        >
          <View
            style={{
              width: 20,
              height: 20,
              borderRadius: 6,
              borderWidth: 1.5,
              borderColor: tosAccepted ? theme.a1 : theme.hairline,
              backgroundColor: tosAccepted ? theme.a1 : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {tosAccepted ? (
              <Svg width={11} height={11} viewBox="0 0 24 24">
                <Path
                  d="M5 12.5l4.5 4.5L19 7"
                  stroke={theme.onAccent}
                  strokeWidth={2.4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              </Svg>
            ) : null}
          </View>
          <Text style={[sans(500, 12, 1.4), { color: 'rgba(255,255,255,.65)', flex: 1 }]}>
            <Text onPress={() => WebBrowser.openBrowserAsync(`${SITE}/shartlar`).catch(() => {})}>
              Ommaviy oferta shartlari
            </Text>
            {'ga roziman'}
          </Text>
        </TapScale>

        {error ? (
          <Text style={[sans(500, 12, 1.4), { color: theme.signal }]}>{error}</Text>
        ) : null}

        <GoldButton
          label={submitting ? 'Yaratilmoqda…' : 'Hisob ochish'}
          onPress={canSubmit ? onSubmit : undefined}
          sweep={false}
        />

        <TapScale
          radius={10}
          onPress={() => router.back()}
          accessibilityLabel="Kirish"
          style={{ alignItems: 'center', paddingVertical: 10 }}
        >
          <Text style={[sans(500, 13), { color: theme.ash }]}>
            Hisobingiz bormi?{' '}
            <Text style={{ color: theme.a1, fontWeight: '700' }}>Kiring</Text>
          </Text>
        </TapScale>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function registerErrorText(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'phone_taken') return 'Bu telefon raqami allaqachon ro’yxatdan o’tgan.';
    if (err.code === 'email_taken') return 'Bu email allaqachon ishlatilgan.';
    if (err.code === 'too_many_requests') return 'Juda ko’p urinish. Birozdan keyin qayta urining.';
    if (err.code === 'network_error') return 'Internet aloqasi yo’q. Qayta urinib ko’ring.';
    if (err.code && !/^[a-z_]+$/.test(err.code)) return err.code;
  }
  return 'Ro’yxatdan o’tib bo’lmadi. Ma’lumotlarni tekshirib qayta urining.';
}
