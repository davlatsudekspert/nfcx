import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CompanyStackParamList } from '../../navigation/types';
import { ScreenWithHeader } from '../shared/ScreenWithHeader';
import { PremiumCard } from '../../design-system/components/PremiumCard';
import { PremiumBadge } from '../../design-system/components/PremiumBadge';
import { PremiumButton } from '../../design-system/components/PremiumButton';
import { PremiumEmptyState } from '../../design-system/components/PremiumEmptyState';
import { PremiumLoadingSkeleton } from '../../design-system/components/PremiumLoadingSkeleton';
import { useMyCompanies } from '../../hooks/useMyCompanies';
import { STATUS_LABEL } from './statusLabels';
import { color, space, type as typeTokens } from '../../design-system/tokens';

type Props = NativeStackScreenProps<CompanyStackParamList, 'CompanyHome'>;

export function CompanyHomeScreen({ navigation }: Props) {
  const companies = useMyCompanies();

  return (
    <ScreenWithHeader
      title="Kompaniya"
      actions={[{ icon: 'plus', accessibilityLabel: 'Yangi kompaniya', onPress: () => navigation.navigate('CompanyCreate1') }]}
    >
      {companies.isLoading && (
        <View style={{ gap: space.md }}>
          <PremiumLoadingSkeleton height={88} />
        </View>
      )}

      {!companies.isLoading && !companies.data?.length && (
        <PremiumEmptyState
          icon="briefcase"
          title="Kompaniya profilingiz yo'q"
          description="Biznesingiz uchun Company ID yarating."
          ctaLabel="Kompaniya ID yaratish"
          onPressCta={() => navigation.navigate('CompanyCreate1')}
        />
      )}

      <ScrollView>
        {companies.data?.map((c) => (
          <PremiumCard key={c.companyId} style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.name}>{c.displayName}</Text>
              <PremiumBadge label={STATUS_LABEL[c.status] ?? c.status} tone={c.status === 'active' ? 'success' : 'warning'} />
            </View>
            <Text style={styles.id}>#{c.companyId}</Text>
            <PremiumButton
              label="Boshqarish"
              variant="ghost"
              onPress={() => navigation.navigate('CompanyDashboard', { companyId: c.companyId })}
              style={styles.manageButton}
            />
          </PremiumCard>
        ))}
      </ScrollView>
    </ScreenWithHeader>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: space.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { ...typeTokens.h2, color: color.textPrimary },
  id: { ...typeTokens.mono, color: color.textSecondary, marginTop: 2 },
  manageButton: { marginTop: space.sm },
});
