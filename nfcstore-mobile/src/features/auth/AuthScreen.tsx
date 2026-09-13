import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { ApiError, login, register } from '@/api/client';
import { GhostButton, GoldButton } from '@/components/GoldButton';
import { TapScale } from '@/components/TapScale';
import { SITE } from '@/features/profile/profileVM';
import { useAuthStore } from '@/store/authStore';
import { useTheme } from '@/theme/ThemeProvider';
import { mono, sans } from '@/theme/type';

const LOGO = require('../../../assets/logo.png');

/**
 * Kirish va ro'yxatdan o'tish.
 *
 * RO'YXATDAN O'TISH OQIMI SERVERDAN TEKSHIRILGAN (hosting/api/auth.js,
 * 2026-09) — BIR QADAM, Telegram OTP YO'Q:
 *
 *   phone       majburiy   +?\d{9,15}
 *   password    majburiy   >= 6 belgi
 *   tosAccepted majburiy   true
 *   email       IXTIYORIY  (bo'sh bo'lsa server ichki manzil yasaydi —
 *                           O'zbekistonda ko'p odam email ishlatmaydi)
 *   promoCode   ixtiyoriy
 *
 * Kirishda esa BITTA maydon: telefon ham, email ham qabul qilinadi
 * (worker.js login: `body.email ?? body.login`, keyin qaysi ekanini
 * serverning o'zi aniqlaydi).
 */
export function AuthScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const setSession = useAuthStore((s) => s.setSession);

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [identifier, setIdentifier] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [promo, setPromo] = useState('');
  const [tos, setTos] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setError(null);
    setPassword('');
    setPassword2('');
  };

  const finish = () => {
    // Kirgandan keyin barcha so'rovlar qaytadan bajarilishi kerak:
    // ular ilgari tokensiz ketgan va bo'sh javob olgan edi.
    queryClient.invalidateQueries();
    useAuthStore.getState().restore();
    router.replace('/(tabs)/profile');
  };

  const submitLogin = async () => {
    if (!identifier.trim()) {
      setError('Telefon raqami yoki emailni kiriting.');
      return;
    }
    if (password.length < 6) {
      setError('Parol kamida 6 belgidan iborat bo’lishi kerak.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const user = await login(identifier.trim(), password);
      setSession({ user, cards: [] });
      finish();
    } catch (err) {
      setError(authError(err));
    } finally {
      setBusy(false);
    }
  };

  const submitRegister = async () => {
    const normalizedPhone = phone.replace(/[\s()-]/g, '');
    if (!/^\+?\d{9,15}$/.test(normalizedPhone)) {
      setError('Telefon raqamini to’g’ri kiriting (masalan +998901234567).');
      return;
    }
    if (password.length < 6) {
      setError('Parol kamida 6 belgidan iborat bo’lishi kerak.');
      return;
    }
    if (password !== password2) {
      setError('Parollar bir xil emas.');
      return;
    }
    if (!tos) {
      setError('Davom etish uchun ommaviy oferta shartlariga rozilik bering.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const user = await register({
        phone: normalizedPhone,
        password,
        tosAccepted: true,
        email: email.trim() || undefined,
        promoCode: promo.trim() || undefined,
      });
      setSession({ user, cards: [] });
      finish();
    } catch (err) {
      setError(authError(err));
    } finally {
      setBusy(false);
    }
  };

  const isLogin = mode === 'login';

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: theme.bg }}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: 40 + insets.top,
          paddingHorizontal: 24,
          paddingBottom: 32 + insets.bottom,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={{ alignItems: 'center', gap: 14, marginBottom: 30 }}>
          <Image
            source={LOGO}
            contentFit="cover"
            style={{ width: 64, height: 64, borderRadius: 32 }}
          />
          <Text
            style={[sans(800, 22, 1.2), { color: theme.ink, letterSpacing: -0.44 }]}
          >
            NFCSTORE
          </Text>
          <Text
            style={[
              sans(400, 12.5, 1.5),
              { color: 'rgba(255,255,255,.45)', textAlign: 'center' },
            ]}
          >
            {isLogin
              ? 'Hisobingizga kiring'
              : 'Ro’yxatdan o’ting — bepul shaxsiy ID darhol beriladi'}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 7, marginBottom: 20 }}>
          <ModeTab
            label="Kirish"
            on={isLogin}
            onPress={() => {
              setMode('login');
              reset();
            }}
          />
          <ModeTab
            label="Ro’yxatdan o’tish"
            on={!isLogin}
            onPress={() => {
              setMode('register');
              reset();
            }}
          />
        </View>

        <View style={{ gap: 13 }}>
          {isLogin ? (
            <Field
              label="Telefon yoki email"
              value={identifier}
              onChangeText={setIdentifier}
              placeholder="+998901234567"
              keyboardType="email-address"
            />
          ) : (
            <>
              <Field
                label="Telefon raqami"
                value={phone}
                onChangeText={setPhone}
                placeholder="+998901234567"
                keyboardType="phone-pad"
              />
              <Field
                label="Email (ixtiyoriy)"
                value={email}
                onChangeText={setEmail}
                placeholder="bo’sh qoldirsangiz ham bo’ladi"
                keyboardType="email-address"
              />
            </>
          )}

          <Field
            label="Parol"
            value={password}
            onChangeText={setPassword}
            placeholder="kamida 6 belgi"
            secure
          />

          {!isLogin ? (
            <>
              <Field
                label="Parolni takrorlang"
                value={password2}
                onChangeText={setPassword2}
                placeholder="•••••••"
                secure
              />
              <Field
                label="Promokod (ixtiyoriy)"
                value={promo}
                onChangeText={setPromo}
                placeholder="bo’sh qoldiring"
                autoCapitalize="characters"
              />

              <TapScale
                radius={10}
                onPress={() => setTos((v) => !v)}
                accessibilityLabel="Ommaviy oferta shartlariga rozilik"
                accessibilityState={{ selected: tos }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  paddingVertical: 6,
                  borderRadius: 10,
                }}
              >
                <View
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 6,
                    borderWidth: 1.5,
                    borderColor: tos ? theme.a1 : 'rgba(255,255,255,.2)',
                    backgroundColor: tos ? theme.a1 : 'transparent',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {tos ? (
                    <Svg width={12} height={12} viewBox="0 0 24 24">
                      <Path
                        d="M5 12.5l4.5 4.5L19 7"
                        stroke={theme.onAccent}
                        strokeWidth={2.6}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="none"
                      />
                    </Svg>
                  ) : null}
                </View>
                <Text
                  style={[
                    sans(500, 12, 1.4),
                    { color: 'rgba(255,255,255,.6)', flex: 1 }
                  ]}
                >
                  Ommaviy oferta shartlariga roziman
                </Text>
              </TapScale>
            </>
          ) : null}

          {error ? (
            <View
              style={{
                paddingVertical: 11,
                paddingHorizontal: 13,
                borderRadius: 12,
                backgroundColor: 'rgba(190,80,80,.12)',
                borderWidth: 1,
                borderColor: 'rgba(190,80,80,.26)',
              }}
            >
              <Text style={[sans(500, 12, 1.45), { color: '#d98b8b' }]}>{error}</Text>
            </View>
          ) : null}

          <GoldButton
            label={busy ? 'Kutilmoqda…' : isLogin ? 'Kirish' : 'Ro’yxatdan o’tish'}
            onPress={busy ? undefined : isLogin ? submitLogin : submitRegister}
            sweep={false}
            style={{ height: 46, marginTop: 4 }}
          />

          {isLogin ? (
            <GhostButton
              label="Parolni unutdingizmi?"
              onPress={() => WebBrowser.openBrowserAsync(`${SITE}/login`).catch(() => {})}
              style={{ height: 42 }}
            />
          ) : null}
        </View>

        <Text
          style={[
            sans(400, 11, 1.5),
            {
              color: 'rgba(255,255,255,.3)',
              textAlign: 'center',
              marginTop: 24,
            },
          ]}
        >
          Telegram tasdig’i ro’yxatdan o’tishda talab qilinmaydi.
          Uni keyinroq Sozlamalarda ulash mumkin — parolni tiklash uchun kerak
          bo’ladi.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ModeTab({
  label,
  on,
  onPress,
}: {
  label: string;
  on: boolean;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  return (
    <TapScale
      radius={11}
      onPress={onPress}
      accessibilityLabel={label}
      accessibilityState={{ selected: on }}
      style={{
        flex: 1,
        paddingVertical: 10,
        borderRadius: 11,
        alignItems: 'center',
        backgroundColor: on ? 'rgba(255,255,255,.08)' : 'transparent',
        borderWidth: 1,
        borderColor: on ? theme.a2 : 'rgba(255,255,255,.08)',
      }}
    >
      <Text style={[sans(600, 12.5), { color: on ? theme.a1 : 'rgba(255,255,255,.5)' }]}>
        {label}
      </Text>
    </TapScale>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  secure = false,
  keyboardType,
  autoCapitalize = 'none',
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  secure?: boolean;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  autoCapitalize?: 'none' | 'characters';
}) {
  const { theme } = useTheme();
  return (
    <View style={{ gap: 7 }}>
      <Text style={[sans(500, 11.5), { color: 'rgba(255,255,255,.45)' }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.off}
        secureTextEntry={secure}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        style={[
          sans(500, 13.5),
          {
            color: theme.ink,
            paddingHorizontal: 13,
            height: 46,
            borderRadius: 12,
            backgroundColor: 'rgba(255,255,255,.05)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,.08)',
          },
        ]}
      />
    </View>
  );
}

/**
 * Server xato kodlarini odam tushunadigan matnga aylantiradi.
 * Ro'yxat saytdagi `errText()` (src/pages/AuthPage.jsx) bilan bir xil —
 * ilova va sayt bir xil gapirsin.
 */
function authError(err: unknown): string {
  if (!(err instanceof ApiError)) return 'Xatolik yuz berdi. Qayta urinib ko’ring.';

  const map: Record<string, string> = {
    bad_credentials: 'Telefon/email yoki parol xato.',
    bad_login: 'Telefon raqami yoki email formati noto’g’ri.',
    account_deleted: 'Bu akkaunt o’chirilgan. Yangi akkaunt ochishingiz mumkin.',
    account_suspended: 'Akkauntingiz vaqtincha to’xtatilgan. Admin bilan bog’laning.',
    too_many_requests: 'Juda ko’p urinish. Birozdan so’ng qayta urinib ko’ring.',
    phone_taken: 'Bu telefon raqami bilan allaqachon akkaunt ochilgan. Kirishga urinib ko’ring.',
    email_taken: 'Bu email allaqachon ro’yxatdan o’tgan.',
    network_error: 'Internet aloqasi yo’q. Tarmoqni tekshirib qayta urinib ko’ring.',
    no_session_token: 'Server sessiya tokenini bermadi. Backend yangilanishi kerak.',
    db_unavailable: 'Server bazasi hozir mavjud emas. Keyinroq urinib ko’ring.',
  };

  // Server ba'zan TAYYOR o'zbekcha matn qaytaradi (validatsiya
  // xabarlari) — unda uni o'zgartirmasdan ko'rsatamiz.
  return map[err.code] ?? (/[a-z]_[a-z]/.test(err.code) ? 'Xatolik: ' + err.code : err.code);
}
