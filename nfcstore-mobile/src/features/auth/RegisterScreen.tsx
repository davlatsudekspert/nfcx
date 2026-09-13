import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import * as WebBrowser from 'expo-web-browser';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { ApiError, register, requestRegisterCode } from '@/api/client';
import { GoldButton, GhostButton } from '@/components/GoldButton';
import { TapScale } from '@/components/TapScale';
import { SITE } from '@/features/profile/profileVM';
import { useAuthStore } from '@/store/authStore';
import { useTheme } from '@/theme/ThemeProvider';
import { sans } from '@/theme/type';

import { AuthField } from './AuthField';

const LOGO = require('../../../assets/logo.png');

type Step =
  | { name: 'form' }
  | { name: 'code'; channel: 'email' | 'telegram' };

/**
 * Ro'yxatdan o'tish — YANGILANGAN oqim (audit 2026-09, `hosting/api/auth.js`):
 *
 *   1) POST /api/auth/request-register-code {email} -> {channel}
 *      - 'email'  — kod emailga yuborildi, 2-qadam kerak
 *      - 'none'   — email xizmati o'chiq, kod kerak emas, DARHOL ro'yxatdan o'tiladi
 *   2) POST /api/auth/register {..., emailCode}
 *
 * Email ILOVADA MAJBURIY qilingan (backend "xizmat yoqiq bo'lsa
 * majburiy" deydi, lekin oldindan bilib bo'lmaydi — shuning uchun
 * doim so'raladi; xizmat o'chiq bo'lsa server baribir emailCode'siz
 * qabul qiladi). Bu ATAYLAB: legacy Telegram-kodli oqim (`{code,
 * botAck}`, `emailCode`dan farqli maydon nomi) mobil ilovada
 * QURILMAGAN — email yo'q holatda foydalanuvchi avval botga ulanishi
 * kerak bo'lardi, bu alohida ekran talab qiladi.
 *
 * SMS OTP YO'Q. Telegram PROFIL tasdig'i BU YERDA SO'RALMAYDI —
 * Sozlamalar → Profil tasdiqlashda, alohida (spetsifikatsiya talabi).
 */
export function RegisterScreen() {
  const { theme } = useTheme();
  const queryClient = useQueryClient();

  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [tosAccepted, setTosAccepted] = useState(false);
  const [code, setCode] = useState('');
  const [step, setStep] = useState<Step>({ name: 'form' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formValid =
    phone.trim().length >= 9 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim()) &&
    password.length >= 6 &&
    password === confirm &&
    tosAccepted;

  const finishRegister = async (emailCode?: string) => {
    setSubmitting(true);
    setError(null);
    try {
      await register({
        phone: phone.trim(),
        password,
        tosAccepted: true,
        email: email.trim(),
        emailCode,
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

  const onContinue = async () => {
    if (!formValid || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const { channel } = await requestRegisterCode(email.trim());
      if (channel === 'none') {
        // Email xizmati o'chiq — kod kerak emas, darhol ro'yxatdan o'tiladi.
        await finishRegister(undefined);
        return;
      }
      if (channel === 'telegram') {
        // Kutilmagan holat (email berilgan bo'lsa server 'email' yoki
        // 'none' qaytarishi kerak) — mobilda qo'llab-quvvatlanmaydi.
        setError('Bu email bilan davom etib bo’lmadi. Boshqa email kiriting.');
        return;
      }
      setStep({ name: 'code', channel: 'email' });
    } catch (err) {
      setError(registerErrorText(err));
    } finally {
      setSubmitting(false);
    }
  };

  const onResend = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await requestRegisterCode(email.trim());
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
            {step.name === 'form'
              ? 'Telefon va email bilan bepul hisob oching'
              : `Kod ${email} manziliga yuborildi`}
          </Text>
        </View>

        {step.name === 'form' ? (
          <>
            <AuthField
              label="Telefon"
              value={phone}
              onChangeText={setPhone}
              placeholder="+998901234567"
              keyboardType="phone-pad"
            />
            <AuthField
              label="Email"
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
              label={submitting ? 'Yuborilmoqda…' : 'Davom etish'}
              onPress={formValid && !submitting ? onContinue : undefined}
              sweep={false}
            />
          </>
        ) : (
          <>
            <AuthField
              label="Tasdiqlash kodi"
              value={code}
              onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              keyboardType="number-pad"
            />

            {error ? (
              <Text style={[sans(500, 12, 1.4), { color: theme.signal }]}>{error}</Text>
            ) : null}

            <GoldButton
              label={submitting ? 'Tekshirilmoqda…' : 'Tasdiqlash'}
              onPress={
                code.length === 6 && !submitting ? () => finishRegister(code) : undefined
              }
              sweep={false}
            />
            <GhostButton
              label={submitting ? 'Yuborilmoqda…' : 'Kodni qayta yuborish'}
              onPress={submitting ? undefined : onResend}
            />
            <TapScale
              radius={10}
              onPress={() => {
                setStep({ name: 'form' });
                setCode('');
                setError(null);
              }}
              accessibilityLabel="Orqaga"
              style={{ alignItems: 'center', paddingVertical: 6 }}
            >
              <Text style={[sans(500, 12.5), { color: theme.ash }]}>
                Ma’lumotlarni o’zgartirish
              </Text>
            </TapScale>
          </>
        )}

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
    if (err.code === 'bad_email_code') return 'Kod noto’g’ri yoki muddati tugagan.';
    if (err.code === 'email_code_required') return 'Tasdiqlash kodini kiriting.';
    if (err.code === 'email_required') return 'Email kiritish shart.';
    if (err.code === 'email_send_failed') return 'Xatni yuborib bo’lmadi. Birozdan keyin qayta urining.';
    if (err.code === 'too_many_requests') return 'Juda ko’p urinish. Birozdan keyin qayta urining.';
    if (err.code === 'network_error') return 'Internet aloqasi yo’q. Qayta urinib ko’ring.';
    if (err.code && !/^[a-z_]+$/.test(err.code)) return err.code;
  }
  return 'Ro’yxatdan o’tib bo’lmadi. Ma’lumotlarni tekshirib qayta urining.';
}
