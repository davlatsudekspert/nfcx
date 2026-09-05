import React from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import type { CompanyStackParamList } from '../../navigation/types';
import { ScreenWithHeader } from '../shared/ScreenWithHeader';
import { PremiumCard } from '../../design-system/components/PremiumCard';
import { PremiumEmptyState } from '../../design-system/components/PremiumEmptyState';
import { PremiumLoadingSkeleton } from '../../design-system/components/PremiumLoadingSkeleton';
import { ContactButtons, buildContactButtons } from '../../composites/ContactButtons';
import { companiesApi } from '../../api/companies';
import { formatSom } from '../../lib/format';
import { color, radius, space, type as typeTokens } from '../../design-system/tokens';

type Props = NativeStackScreenProps<CompanyStackParamList, 'PublicCompany'>;

/** Deep link target for nfcstore.uz/company/:id and /c/:id
 * (android/docs/03-ARCHITECTURE.md §3.5). The Worker itself 404s a
 * non-owner viewing a non-active company — the empty state below mirrors
 * that real behavior rather than showing stale/placeholder data. */
export function PublicCompanyScreen({ route, navigation }: Props) {
  const { companyId } = route.params;
  const company = useQuery({ queryKey: ['companies', companyId, 'public'], queryFn: () => companiesApi.get(companyId) });

  if (company.isLoading) {
    return (
      <ScreenWithHeader onBack={navigation.canGoBack() ? navigation.goBack : undefined}>
        <PremiumLoadingSkeleton height={200} />
      </ScreenWithHeader>
    );
  }

  if (!company.data) {
    return (
      <ScreenWithHeader onBack={navigation.canGoBack() ? navigation.goBack : undefined}>
        <PremiumEmptyState icon="briefcase" title="Kompaniya sahifasi faol emas" />
      </ScreenWithHeader>
    );
  }

  const c = company.data.company;
  const contactButtons = buildContactButtons({ phone: c.phone, tg: c.telegram, whatsapp: c.whatsapp, email: undefined });

  return (
    <ScreenWithHeader title={c.displayName} onBack={navigation.canGoBack() ? navigation.goBack : undefined} scroll={false}>
      <ScrollView contentContainerStyle={styles.content}>
        {!!c.coverUrl && <Image source={{ uri: c.coverUrl }} style={styles.cover} />}
        <View style={styles.headerRow}>
          {!!c.logoUrl && <Image source={{ uri: c.logoUrl }} style={styles.logo} />}
          <View style={styles.headerText}>
            <Text style={styles.name}>{c.displayName}</Text>
            <Text style={styles.id}>#{c.companyId} · {c.city}</Text>
          </View>
        </View>

        <Text style={styles.description}>{c.description}</Text>

        {!!c.items?.length && (
          <>
            <Text style={styles.sectionTitle}>Katalog</Text>
            {c.items.filter((i) => i.available).map((item) => (
              <PremiumCard key={item.id} style={styles.itemCard}>
                <View style={styles.row}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemPrice}>{formatSom(item.promotionPrice ?? item.price)}</Text>
                </View>
              </PremiumCard>
            ))}
          </>
        )}

        {contactButtons.length > 0 && (
          <View style={styles.contactSection}>
            <ContactButtons items={contactButtons} />
          </View>
        )}
      </ScrollView>
    </ScreenWithHeader>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingBottom: space.xxxl },
  cover: { width: '100%', height: 120, borderRadius: radius.md, marginBottom: space.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  logo: { width: 56, height: 56, borderRadius: radius.md },
  headerText: { flex: 1 },
  name: { ...typeTokens.h1, color: color.textPrimary },
  id: { ...typeTokens.caption, color: color.textSecondary, marginTop: 2 },
  description: { ...typeTokens.body, color: color.textSecondary, marginTop: space.md },
  sectionTitle: { ...typeTokens.h2, color: color.textPrimary, marginTop: space.xl, marginBottom: space.sm },
  itemCard: { marginBottom: space.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  itemName: { ...typeTokens.body, color: color.textPrimary },
  itemPrice: { ...typeTokens.body, color: color.gold },
  contactSection: { marginTop: space.xl },
});
