import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import type { CompanyStackParamList } from '../../navigation/types';
import { CompanyStepShell } from './CompanyStepShell';
import { PremiumCard } from '../../design-system/components/PremiumCard';
import { PremiumInput } from '../../design-system/components/PremiumInput';
import { NoticeLine } from './CompanyVisuals';
import { hasErrors, validateContacts } from './companyForm';
import { safeText } from '../../lib/format';
import { color, radius, space, type as typeTokens } from '../../design-system/tokens';

type Props = NativeStackScreenProps<CompanyStackParamList, 'CompanyCreate4'>;

type TouchKey = 'telegram' | 'whatsapp' | 'website';

/**
 * Step 4/5 — the optional contact channels `POST /api/companies` accepts.
 * The preview below is not decoration: each filled channel becomes exactly
 * one button on the public page, so the owner sees what visitors will get.
 */
export function CompanyCreateStep4Screen({ route, navigation }: Props) {
  const { draft } = route.params;
  const [telegram, setTelegram] = useState(draft.telegram ?? '');
  const [whatsapp, setWhatsapp] = useState(draft.whatsapp ?? '');
  const [website, setWebsite] = useState(draft.website ?? '');
  const [touched, setTouched] = useState<Record<TouchKey, boolean>>({
    telegram: false,
    whatsapp: false,
    website: false,
  });

  const errors = validateContacts({ telegram, whatsapp, website });
  const invalid = hasErrors(errors);
  const touch = (key: TouchKey) => () => setTouched((t) => ({ ...t, [key]: true }));
  const show = (key: TouchKey) => (touched[key] ? errors[key] ?? null : null);

  const onContinue = () => {
    if (invalid) {
      setTouched({ telegram: true, whatsapp: true, website: true });
      return;
    }
    navigation.push('CompanyCreate5', { draft: { ...draft, telegram, whatsapp, website } });
  };

  const channels = [
    { key: 'phone', icon: 'phone' as const, label: "Qo'ng'iroq", value: draft.phone, always: true },
    { key: 'telegram', icon: 'send' as const, label: 'Telegram', value: telegram, always: false },
    { key: 'whatsapp', icon: 'message-circle' as const, label: 'WhatsApp', value: whatsapp, always: false },
    { key: 'website', icon: 'globe' as const, label: 'Veb-sayt', value: website, always: false },
  ].filter((c) => c.always || c.value.trim() !== '');

  return (
    <CompanyStepShell
      step={4}
      onBack={navigation.canGoBack() ? navigation.goBack : undefined}
      primaryLabel="Davom etish"
      onPrimary={onContinue}
      secondaryLabel={!telegram && !whatsapp && !website ? "Hozircha o'tkazib yuborish" : undefined}
      onSecondary={
        !telegram && !whatsapp && !website
          ? () => navigation.push('CompanyCreate5', { draft: { ...draft, telegram: '', whatsapp: '', website: '' } })
          : undefined
      }
    >
      <PremiumCard animate={false}>
        <PremiumInput
          label="Telegram username (ixtiyoriy)"
          value={telegram}
          onChangeText={setTelegram}
          onBlur={touch('telegram')}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="nfcstore"
          error={show('telegram')}
        />
        <PremiumInput
          label="WhatsApp raqami (ixtiyoriy)"
          value={whatsapp}
          onChangeText={setWhatsapp}
          onBlur={touch('whatsapp')}
          keyboardType="phone-pad"
          placeholder="+998 90 123 45 67"
          error={show('whatsapp')}
        />
        <PremiumInput
          label="Veb-sayt (ixtiyoriy)"
          value={website}
          onChangeText={setWebsite}
          onBlur={touch('website')}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          placeholder="nfcstore.uz"
          error={show('website')}
        />
      </PremiumCard>

      <PremiumCard variant="sunken" animate={false}>
        <Text style={styles.previewTitle}>Sahifadagi tugmalar</Text>
        <View style={styles.previewList}>
          {channels.map((c) => (
            <View key={c.key} style={styles.previewRow}>
              <Feather name={c.icon} size={15} color={color.gold} />
              <Text style={styles.previewLabel}>{c.label}</Text>
              <Text style={styles.previewValue} numberOfLines={1}>
                {safeText(c.value.trim(), '—')}
              </Text>
            </View>
          ))}
        </View>
      </PremiumCard>

      <NoticeLine icon="info" text="Bo'sh qoldirilgan kanal sahifada umuman ko'rinmaydi — o'lik tugma bo'lmaydi." />
    </CompanyStepShell>
  );
}

const styles = StyleSheet.create({
  previewTitle: { ...typeTokens.overline, color: color.textTertiary, marginBottom: space.md },
  previewList: { gap: space.sm },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: color.surfaceRaised,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  previewLabel: { ...typeTokens.caption, color: color.textSecondary, width: 78 },
  previewValue: { ...typeTokens.caption, color: color.textPrimary, flex: 1, textAlign: 'right' },
});
