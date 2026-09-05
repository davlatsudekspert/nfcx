import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CompanyStackParamList } from '../../navigation/types';
import { ScreenWithHeader } from '../shared/ScreenWithHeader';
import { PremiumInput } from '../../design-system/components/PremiumInput';
import { PremiumButton } from '../../design-system/components/PremiumButton';
import { color, space, type as typeTokens } from '../../design-system/tokens';

type Props = NativeStackScreenProps<CompanyStackParamList, 'CompanyCreate2'>;

/**
 * The exact `COMPANY_CATEGORIES` enum the Worker validates against
 * (`hosting/worker.js`) was not extracted during the Phase 1 audit — this
 * list is a reasonable placeholder set. It is safe regardless: only
 * `food`/`food-*` and `retail`/`retail-*` change the auto-selected catalog
 * module (`businessModule()`, android/docs/02-API_MAP.md §2.5); every other
 * slug falls into "services" either way. Confirm the exact server-side enum
 * before shipping — a rejected category shows the server's real 422, it is
 * not silently coerced to something else.
 */
const CATEGORIES = [
  { slug: 'food', label: 'Oziq-ovqat / Restoran' },
  { slug: 'retail', label: "Savdo / Do'kon" },
  { slug: 'construction', label: 'Qurilish' },
  { slug: 'beauty', label: "Go'zallik" },
  { slug: 'it', label: 'IT / Raqamli' },
  { slug: 'education', label: "Ta'lim" },
  { slug: 'services', label: 'Boshqa xizmatlar' },
];

export function CompanyCreateStep2Screen({ route, navigation }: Props) {
  const { draft } = route.params;
  const [displayName, setDisplayName] = useState(draft.displayName);
  const [category, setCategory] = useState(draft.category);
  const [city, setCity] = useState(draft.city);
  const [phone, setPhone] = useState(draft.phone);
  const [description, setDescription] = useState(draft.description);

  const descriptionError = description.length > 0 && description.length < 20 ? "Tavsif kamida 20 belgidan iborat bo'lishi kerak." : null;
  const canContinue = displayName.trim().length >= 2 && city.trim().length >= 2 && phone.trim().length >= 9 && description.trim().length >= 20;

  return (
    <ScreenWithHeader title="Kompaniya — 2/5" onBack={navigation.goBack}>
      <PremiumInput label="Kompaniya nomi" value={displayName} onChangeText={setDisplayName} />

      <Text style={styles.label}>Kategoriya</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryRow}>
        {CATEGORIES.map((c) => (
          <PremiumButton
            key={c.slug}
            label={c.label}
            variant={category === c.slug ? 'filled' : 'ghost'}
            fullWidth={false}
            onPress={() => setCategory(c.slug)}
            style={styles.categoryChip}
          />
        ))}
      </ScrollView>

      <PremiumInput label="Shahar" value={city} onChangeText={setCity} />
      <PremiumInput label="Telefon" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <PremiumInput
        label="Tavsif (kamida 20 belgi)"
        value={description}
        onChangeText={setDescription}
        multiline
        numberOfLines={4}
        error={descriptionError}
      />

      <PremiumButton
        label="Davom etish"
        disabled={!canContinue}
        onPress={() => navigation.navigate('CompanyCreate3', { draft: { ...draft, displayName, category, city, phone, description } })}
      />
    </ScreenWithHeader>
  );
}

const styles = StyleSheet.create({
  label: { ...typeTokens.caption, color: color.textSecondary, marginBottom: space.xs },
  categoryRow: { marginBottom: space.md },
  categoryChip: { marginRight: space.sm, paddingHorizontal: space.md },
});
