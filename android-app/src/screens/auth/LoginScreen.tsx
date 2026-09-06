import React, { useCallback, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/types';
import { PremiumInput } from '../../design-system/components/PremiumInput';
import { PremiumButton } from '../../design-system/components/PremiumButton';
import { PremiumCard } from '../../design-system/components/PremiumCard';
import { useAuthStore } from '../../state/authStore';
import { ApiError } from '../../api/client';
import { color, gradient, space, type as typeTokens } from '../../design-system/tokens';
import {
  AccountAccessBlock,
  BenefitList,
  EntryHero,
  SectionHeading,
  StepList,
  TierShowcase,
} from './EntrySections';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * The app's storefront, not just a form.
 *
 * A newcomer who opens NFCSTORE for the first time has no idea what an NFC
 * ID is, so this screen answers that before asking for anything: what one
 * tap does, how it works in three steps, and what the real tiers cost —
 * every claim taken from the copy the business already publishes on
 * nfcstore.uz (see `entryContent.ts`, which cites a source file per line),
 * and every price read from `TIER_PRICE` rather than typed in.
 *
 * The login itself is unchanged: `POST /api/auth/login` against the real
 * Worker (android/docs/02-API_MAP.md §2.1), and RootNavigator swaps to
 * MainTabs on its own once `authStore.status` flips to 'authenticated' —
 * this screen never navigates itself. Client-side validation mirrors the
 * server's own rules purely for instant feedback; the server stays the
 * authority and its message is what renders.
 *
 * Because the page is long, a returning user gets a "Hisobingiz bormi?"
 * link in the hero that scrolls straight to the form, and focusing either
 * field pulls the form to the top of the viewport so the keyboard can never
 * cover it.
 */
export function LoginScreen({ navigation }: Props) {
  const login = useAuthStore((s) => s.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const formY = useRef(0);

  const onFormLayout = useCallback((e: LayoutChangeEvent) => {
    formY.current = e.nativeEvent.layout.y;
  }, []);

  const scrollToForm = useCallback(() => {
    scrollRef.current?.scrollTo({ y: Math.max(formY.current - space.lg, 0), animated: true });
  }, []);

  const emailError = email.length > 0 && !EMAIL_RE.test(email) ? "Email formati noto'g'ri." : null;
  const passwordError =
    password.length > 0 && password.length < 6 ? "Parol kamida 6 belgidan iborat bo'lishi kerak." : null;
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
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <EntryHero onGoToForm={scrollToForm} />

          <View style={styles.section}>
            <SectionHeading
              overline="Nega NFC?"
              title="NFC nima beradi?"
              subtitle="Tanishuv va aloqa almashishning zamonaviy usuli."
            />
            <BenefitList />
          </View>

          <View style={styles.section}>
            <SectionHeading overline="3 oddiy qadam" title="Qanday ishlaydi" />
            <StepList />
          </View>

          <View style={styles.section}>
            <SectionHeading
              overline="NFC ID darajalari"
              title="Har bir ID — bitta egaga"
              subtitle="Daraja ID’dagi harf va raqam naqshiga qarab aniqlanadi."
            />
            <TierShowcase />
          </View>

          <View style={styles.section} onLayout={onFormLayout}>
            <SectionHeading overline="Kirish" title="Hisobingizga kiring" />
            <PremiumCard featured contentStyle={styles.formCard} animate={false}>
              <PremiumInput
                label="Email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                error={emailError}
                onFocus={scrollToForm}
                returnKeyType="next"
                testID="login-email"
              />
              <PremiumInput
                label="Parol"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                textContentType="password"
                error={passwordError}
                onFocus={scrollToForm}
                returnKeyType="go"
                onSubmitEditing={onSubmit}
                testID="login-password"
              />

              {!!error && <Text style={styles.serverError}>{error}</Text>}

              <PremiumButton
                label="Kirish"
                onPress={onSubmit}
                loading={loading}
                disabled={!canSubmit}
                testID="login-submit"
              />
            </PremiumCard>
          </View>

          <View style={styles.section}>
            <AccountAccessBlock note="Hisobingiz yo‘qmi? Hozircha yangi hisoblar jamoamiz orqali ochiladi. Telegram yoki telefon orqali yozing — NFC ID tanlash va profilni sozlashda ham yordam beramiz." />
            <PremiumButton
              label="Ro‘yxatdan o‘tish haqida"
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
  ambient: { position: 'absolute', top: 0, left: 0, right: 0, height: 420 },
  content: { flexGrow: 1, padding: space.xl, paddingBottom: space.xxxl },
  section: { marginTop: space.xxxl },
  formCard: { gap: space.xs },
  serverError: { ...typeTokens.caption, color: color.danger, marginBottom: space.sm },
  registerButton: { marginTop: space.md },
});
