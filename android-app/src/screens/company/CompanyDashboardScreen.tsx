import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CompanyStackParamList } from '../../navigation/types';
import { ScreenWithHeader } from '../shared/ScreenWithHeader';
import { PremiumCard } from '../../design-system/components/PremiumCard';
import { PremiumBadge } from '../../design-system/components/PremiumBadge';
import { PremiumButton } from '../../design-system/components/PremiumButton';
import { PremiumInput } from '../../design-system/components/PremiumInput';
import { PremiumLoadingSkeleton } from '../../design-system/components/PremiumLoadingSkeleton';
import { companiesApi } from '../../api/companies';
import { ApiError } from '../../api/client';
import { STATUS_LABEL, STATUS_DESCRIPTION } from './statusLabels';
import { useToast } from '../../design-system/components/PremiumToast';
import { color, space, type as typeTokens } from '../../design-system/tokens';

type Props = NativeStackScreenProps<CompanyStackParamList, 'CompanyDashboard'>;

export function CompanyDashboardScreen({ route, navigation }: Props) {
  const { companyId } = route.params;
  const queryClient = useQueryClient();
  const toast = useToast();
  const company = useQuery({ queryKey: ['companies', companyId], queryFn: () => companiesApi.get(companyId) });
  const [description, setDescription] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const submit = useMutation({
    mutationFn: () => companiesApi.submit(companyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies', companyId] });
      toast.show("Qayta ko'rib chiqishga yuborildi.", 'success');
    },
  });

  const beginPayment = useMutation({
    mutationFn: () => companiesApi.beginPayment(companyId),
    onError: (e) => setPaymentError(e instanceof ApiError ? e.message : "To'lov tizimi hozircha mavjud emas."),
  });

  const saveDescription = useMutation({
    mutationFn: () => companiesApi.update(companyId, { description: description! }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies', companyId] });
      toast.show('Saqlandi.', 'success');
    },
  });

  if (company.isLoading || !company.data) {
    return (
      <ScreenWithHeader title="Boshqaruv" onBack={navigation.canGoBack() ? navigation.goBack : undefined}>
        <PremiumLoadingSkeleton height={160} />
      </ScreenWithHeader>
    );
  }

  const c = company.data.company;
  const draftDescription = description ?? c.description;

  return (
    <ScreenWithHeader title={c.displayName} onBack={navigation.canGoBack() ? navigation.goBack : undefined}>
      <PremiumCard>
        <View style={styles.row}>
          <Text style={styles.id}>#{c.companyId}</Text>
          <PremiumBadge label={STATUS_LABEL[c.status]} tone={c.status === 'active' ? 'success' : 'warning'} />
        </View>
        <Text style={styles.statusDescription}>{STATUS_DESCRIPTION[c.status]}</Text>

        {(c.status === 'draft' || c.status === 'rejected') && (
          <PremiumButton label="Qayta yuborish" onPress={() => submit.mutate()} loading={submit.isPending} style={styles.actionButton} />
        )}

        {c.status === 'approved' && (
          <>
            <PremiumButton label="To'lovni boshlash" onPress={() => beginPayment.mutate()} loading={beginPayment.isPending} style={styles.actionButton} />
            {!!paymentError && <Text style={styles.error}>{paymentError}</Text>}
          </>
        )}
      </PremiumCard>

      <Text style={styles.sectionTitle}>Tavsif</Text>
      <PremiumInput label="Tavsif" value={draftDescription} onChangeText={setDescription} multiline numberOfLines={4} />
      <PremiumButton
        label="Saqlash"
        variant="ghost"
        onPress={() => saveDescription.mutate()}
        loading={saveDescription.isPending}
        disabled={draftDescription === c.description}
        style={styles.saveButton}
      />

      <Text style={styles.sectionTitle}>Boshqaruv</Text>
      <PremiumButton label="Katalog" variant="ghost" onPress={() => navigation.navigate('CatalogList', { companyId })} style={styles.navButton} />
      {c.status === 'active' && (
        <PremiumButton
          label="Ochiq sahifani ko'rish"
          variant="ghost"
          onPress={() => navigation.navigate('PublicCompany', { companyId })}
          style={styles.navButton}
        />
      )}
    </ScreenWithHeader>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  id: { ...typeTokens.mono, color: color.gold, fontSize: 18 },
  statusDescription: { ...typeTokens.body, color: color.textSecondary, marginTop: space.sm },
  actionButton: { marginTop: space.md },
  error: { ...typeTokens.caption, color: color.danger, marginTop: space.xs },
  sectionTitle: { ...typeTokens.h2, color: color.textPrimary, marginTop: space.xl, marginBottom: space.sm },
  saveButton: { marginTop: space.xs },
  navButton: { marginBottom: space.sm },
});
