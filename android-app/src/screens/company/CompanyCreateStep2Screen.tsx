import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CompanyStackParamList } from '../../navigation/types';
import { CompanyStepShell } from './CompanyStepShell';
import { PremiumInput } from '../../design-system/components/PremiumInput';
import { PremiumCard } from '../../design-system/components/PremiumCard';
import { ChoiceChip } from './CompanyVisuals';
import { COMPANY_CATEGORIES, DESCRIPTION_MAX, DESCRIPTION_MIN, hasErrors, validateBusiness } from './companyForm';
import { color, space, type as typeTokens } from '../../design-system/tokens';

type Props = NativeStackScreenProps<CompanyStackParamList, 'CompanyCreate2'>;

type TouchKey = 'displayName' | 'city' | 'phone' | 'description' | 'category';

/**
 * Step 2/5 — the fields `POST /api/companies` requires. Errors appear when a
 * field is left (or when the user tries to continue), never while they are
 * still typing the first character; the CTA stays enabled so pressing it
 * always explains what is missing instead of silently doing nothing.
 */
export function CompanyCreateStep2Screen({ route, navigation }: Props) {
  const { draft } = route.params;
  const [displayName, setDisplayName] = useState(draft.displayName);
  const [category, setCategory] = useState(draft.category);
  const [subcategory, setSubcategory] = useState(draft.subcategory ?? '');
  const [city, setCity] = useState(draft.city);
  const [address, setAddress] = useState(draft.address ?? '');
  const [phone, setPhone] = useState(draft.phone);
  const [description, setDescription] = useState(draft.description);
  const [touched, setTouched] = useState<Record<TouchKey, boolean>>({
    displayName: false,
    city: false,
    phone: false,
    description: false,
    category: false,
  });

  const errors = validateBusiness({ displayName, city, phone, description });
  const categoryError = category ? undefined : 'Kategoriyani tanlang.';
  const invalid = hasErrors({ ...errors, category: categoryError });

  const touch = (key: TouchKey) => () => setTouched((t) => ({ ...t, [key]: true }));
  const show = (key: TouchKey, message: string | undefined) => (touched[key] ? message ?? null : null);

  const onContinue = () => {
    if (invalid) {
      setTouched({ displayName: true, city: true, phone: true, description: true, category: true });
      return;
    }
    navigation.push('CompanyCreate3', {
      draft: {
        ...draft,
        displayName: displayName.trim(),
        category,
        subcategory: subcategory.trim(),
        city: city.trim(),
        address: address.trim(),
        phone: phone.trim(),
        description: description.trim(),
      },
    });
  };

  const descriptionLength = description.trim().length;

  return (
    <CompanyStepShell
      step={2}
      onBack={navigation.canGoBack() ? navigation.goBack : undefined}
      primaryLabel="Davom etish"
      onPrimary={onContinue}
    >
      <PremiumCard animate={false}>
        <PremiumInput
          label="Kompaniya nomi"
          value={displayName}
          onChangeText={setDisplayName}
          onBlur={touch('displayName')}
          placeholder="NFCSTORE Uzbekistan"
          error={show('displayName', errors.displayName)}
        />

        <Text style={styles.fieldLabel}>Kategoriya</Text>
        <View style={styles.chips}>
          {COMPANY_CATEGORIES.map((c) => (
            <ChoiceChip
              key={c.slug}
              label={c.label}
              selected={category === c.slug}
              onPress={() => {
                setCategory(c.slug);
                setTouched((t) => ({ ...t, category: true }));
              }}
            />
          ))}
        </View>
        {touched.category && categoryError ? <Text style={styles.fieldError}>{categoryError}</Text> : null}
        <Text style={styles.fieldHint}>Kategoriya katalog turini belgilaydi (menyu / mahsulot / xizmat).</Text>

        <PremiumInput
          label="Yo'nalish (ixtiyoriy)"
          value={subcategory}
          onChangeText={setSubcategory}
          placeholder="Masalan: milliy taomlar"
        />

        <PremiumInput
          label="Shahar"
          value={city}
          onChangeText={setCity}
          onBlur={touch('city')}
          placeholder="Toshkent"
          error={show('city', errors.city)}
        />

        <PremiumInput
          label="Manzil (ixtiyoriy)"
          value={address}
          onChangeText={setAddress}
          placeholder="Amir Temur ko'chasi, 1"
        />

        <PremiumInput
          label="Telefon"
          value={phone}
          onChangeText={setPhone}
          onBlur={touch('phone')}
          keyboardType="phone-pad"
          placeholder="+998 90 123 45 67"
          error={show('phone', errors.phone)}
        />

        <PremiumInput
          label="Tavsif"
          value={description}
          onChangeText={(t) => setDescription(t.slice(0, DESCRIPTION_MAX))}
          onBlur={touch('description')}
          multiline
          numberOfLines={5}
          style={styles.textArea}
          placeholder="Nima bilan shug'ullanasiz, kimlar uchun ishlaysiz?"
          error={show('description', errors.description)}
        />
        <Text style={[styles.counter, descriptionLength < DESCRIPTION_MIN && styles.counterLow]}>
          {descriptionLength} / {DESCRIPTION_MAX} belgi (kamida {DESCRIPTION_MIN})
        </Text>
      </PremiumCard>
    </CompanyStepShell>
  );
}

const styles = StyleSheet.create({
  fieldLabel: { ...typeTokens.caption, color: color.textSecondary, marginBottom: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  fieldError: { ...typeTokens.caption, color: color.danger, marginTop: space.xs },
  fieldHint: { ...typeTokens.caption, color: color.textTertiary, marginTop: space.xs, marginBottom: space.md },
  textArea: { minHeight: 112, paddingTop: space.md, textAlignVertical: 'top' },
  counter: { ...typeTokens.caption, color: color.textTertiary, textAlign: 'right', marginTop: -space.sm },
  counterLow: { color: color.warning },
});
