import React, { useState } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { IdStackParamList } from '../../navigation/types';
import { ScreenWithHeader } from '../shared/ScreenWithHeader';
import { PremiumInput } from '../../design-system/components/PremiumInput';
import { PremiumButton } from '../../design-system/components/PremiumButton';
import { PremiumCard } from '../../design-system/components/PremiumCard';
import { TierBadge } from '../../design-system/components/PremiumBadge';
import { PurchaseSteps } from './PurchaseSteps';
import { getPersonalPurchaseQuote, tierForCode, TIER_LABEL } from '../../lib/pricing';
import { formatSom, safeText } from '../../lib/format';
import { useAuthStore } from '../../state/authStore';
import { color, radius, space, type as typeTokens } from '../../design-system/tokens';

type Props = NativeStackScreenProps<IdStackParamList, 'PurchaseStep1'>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Step 1/3 — the profile the ID will carry.
 *
 * This is not busywork: `POST /api/records/:code` runs the body through the
 * Worker's `validateRecordBody` and stores it as the pending order's payload,
 * so whatever is typed here becomes the card's profile the moment payment
 * confirms. `name` is genuinely required server-side; the rest is optional
 * and can be completed later in the ID workspace.
 */
export function PurchaseStep1Screen({ route, navigation }: Props) {
  const { code } = route.params;
  const user = useAuthStore((s) => s.user);
  const tier = tierForCode(code);
  const quote = getPersonalPurchaseQuote(code);

  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState(user?.email ?? '');
  const [city, setCity] = useState('');
  const [touched, setTouched] = useState(false);

  const trimmedName = name.trim();
  const nameError = touched && trimmedName.length < 2 ? "Ism kamida 2 belgidan iborat bo'lishi kerak." : null;
  const emailError = email.trim().length > 0 && !EMAIL_RE.test(email.trim()) ? "Email formati noto'g'ri." : null;
  const canContinue = trimmedName.length >= 2 && !emailError;

  return (
    <ScreenWithHeader title="Xarid" onBack={navigation.canGoBack() ? navigation.goBack : undefined}>
      <PurchaseSteps current={1} />

      <PremiumCard variant="featured" style={styles.summary}>
        <View style={styles.summaryTop}>
          <Text style={styles.code} numberOfLines={1}>
            {safeText(code, '—')}
          </Text>
          <TierBadge tier={tier} />
        </View>
        <Text style={styles.summaryMeta}>
          {TIER_LABEL[tier]} daraja · {quote.purchasable ? formatSom(quote.amount) : "narx serverda aniqlanadi"}
        </Text>
      </PremiumCard>

      <Text style={styles.sectionTitle}>PROFIL MA'LUMOTLARI</Text>
      <PremiumCard>
        <PremiumInput
          label="Ism *"
          value={name}
          onChangeText={(v) => {
            setName(v);
            if (!touched) setTouched(true);
          }}
          error={nameError}
          maxLength={80}
          autoCapitalize="words"
        />
        <PremiumInput label="Rol / kasb" value={role} onChangeText={setRole} maxLength={100} />
        <PremiumInput label="Telefon" value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={24} />
        <PremiumInput
          label="Email"
          value={email}
          onChangeText={setEmail}
          error={emailError}
          autoCapitalize="none"
          keyboardType="email-address"
          maxLength={120}
        />
        <PremiumInput label="Shahar" value={city} onChangeText={setCity} maxLength={60} />

        <View style={styles.note}>
          <Feather name="info" size={14} color={color.textTertiary} />
          <Text style={styles.noteText}>
            Faqat ism majburiy. Qolganini keyin ID boshqaruvidan to'ldirishingiz mumkin.
          </Text>
        </View>
      </PremiumCard>

      <PremiumButton
        label="Davom etish"
        disabled={!canContinue}
        style={styles.cta}
        onPress={() =>
          navigation.navigate('PurchaseStep2', {
            code,
            profile: {
              name: trimmedName,
              role: role.trim() || undefined,
              phone: phone.trim() || undefined,
              email: email.trim() || undefined,
              city: city.trim() || undefined,
            },
          })
        }
      />
      {!canContinue && <Text style={styles.ctaHint}>Davom etish uchun ismni kiriting.</Text>}
    </ScreenWithHeader>
  );
}

const styles = StyleSheet.create({
  summary: { marginBottom: space.lg },
  summaryTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  code: { ...typeTokens.monoLarge, color: color.gold, flex: 1 },
  summaryMeta: { ...typeTokens.caption, color: color.textTertiary, marginTop: space.sm },
  sectionTitle: { ...typeTokens.overline, color: color.textTertiary, marginBottom: space.sm },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.xs,
    padding: space.md,
    borderRadius: radius.sm,
    backgroundColor: color.surfaceSunken,
  },
  noteText: { ...typeTokens.caption, color: color.textTertiary, flex: 1 },
  cta: { marginTop: space.xl },
  ctaHint: { ...typeTokens.caption, color: color.textTertiary, marginTop: space.sm, textAlign: 'center' },
});
