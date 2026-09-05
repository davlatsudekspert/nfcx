import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CompanyStackParamList } from '../../navigation/types';
import { ScreenWithHeader } from '../shared/ScreenWithHeader';
import { PremiumButton } from '../../design-system/components/PremiumButton';
import { PremiumCard } from '../../design-system/components/PremiumCard';
import { companyTierForId } from '../../api/companies';
import { formatSom } from '../../lib/format';
import { color, radius, space, type as typeTokens } from '../../design-system/tokens';

type Props = NativeStackScreenProps<CompanyStackParamList, 'CompanyCreate4'>;

export function CompanyCreateStep4Screen({ route, navigation }: Props) {
  const { draft } = route.params;
  const tier = companyTierForId(draft.companyId);

  return (
    <ScreenWithHeader title="Kompaniya — 4/5" onBack={navigation.goBack}>
      <PremiumCard>
        {!!draft.coverUrl && <Image source={{ uri: draft.coverUrl }} style={styles.cover} />}
        <View style={styles.row}>
          {!!draft.logoUrl && <Image source={{ uri: draft.logoUrl }} style={styles.logo} />}
          <View style={styles.headerText}>
            <Text style={styles.name}>{draft.displayName}</Text>
            <Text style={styles.id}>#{draft.companyId}</Text>
          </View>
        </View>
        <Text style={styles.description}>{draft.description}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.meta}>{draft.city}</Text>
          <Text style={styles.meta}>{draft.phone}</Text>
        </View>
        <Text style={styles.price}>{formatSom(tier.price)}</Text>
      </PremiumCard>

      <PremiumButton label="Davom etish" onPress={() => navigation.navigate('CompanyCreate5', { draft })} />
    </ScreenWithHeader>
  );
}

const styles = StyleSheet.create({
  cover: { width: '100%', height: 100, borderRadius: radius.sm, marginBottom: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  logo: { width: 56, height: 56, borderRadius: radius.md },
  headerText: { flex: 1 },
  name: { ...typeTokens.h2, color: color.textPrimary },
  id: { ...typeTokens.mono, color: color.gold },
  description: { ...typeTokens.body, color: color.textSecondary, marginTop: space.md },
  metaRow: { flexDirection: 'row', gap: space.md, marginTop: space.sm },
  meta: { ...typeTokens.caption, color: color.textTertiary },
  price: { ...typeTokens.h2, color: color.gold, marginTop: space.md },
});
