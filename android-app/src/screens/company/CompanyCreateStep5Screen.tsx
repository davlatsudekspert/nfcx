import React, { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CompanyStackParamList, MainTabParamList } from '../../navigation/types';
import { ScreenWithHeader } from '../shared/ScreenWithHeader';
import { PremiumButton } from '../../design-system/components/PremiumButton';
import { companiesApi } from '../../api/companies';
import { ApiError } from '../../api/client';
import { color, space, type as typeTokens } from '../../design-system/tokens';

type Props = NativeStackScreenProps<CompanyStackParamList, 'CompanyCreate5'>;

/** Step 5/5 — the actual `POST /api/companies` call (android/docs/
 * 02-API_MAP.md §2.5). Everything gathered in Steps 1-4 is local until
 * this point; nothing is created server-side before the user confirms here. */
export function CompanyCreateStep5Screen({ route, navigation }: Props) {
  const { draft } = route.params;
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const tabNavigation = navigation.getParent<BottomTabNavigationProp<MainTabParamList>>();

  const submit = useMutation({
    mutationFn: () => companiesApi.create(draft),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['companies', 'mine'] });
      tabNavigation?.navigate('CompanyTab', {
        screen: 'CompanyDashboard',
        params: { companyId: result.company.companyId },
      });
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Xizmat vaqtincha mavjud emas.'),
  });

  return (
    <ScreenWithHeader title="Kompaniya — 5/5" onBack={navigation.goBack}>
      <Text style={styles.text}>
        #{draft.companyId} kompaniyasi yaratiladi va ko'rib chiqish uchun yuboriladi. Tasdiqlangach faol bo'ladi.
      </Text>

      {!!error && <Text style={styles.error}>{error}</Text>}

      <PremiumButton label="Yuborish" onPress={() => submit.mutate()} loading={submit.isPending} />
    </ScreenWithHeader>
  );
}

const styles = StyleSheet.create({
  text: { ...typeTokens.body, color: color.textSecondary, marginBottom: space.lg },
  error: { ...typeTokens.caption, color: color.danger, marginBottom: space.md },
});
