import React, { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type BottomSheet from '@gorhom/bottom-sheet';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CompanyStackParamList } from '../../navigation/types';
import { ScreenWithHeader } from '../shared/ScreenWithHeader';
import { PremiumButton } from '../../design-system/components/PremiumButton';
import { PremiumCard } from '../../design-system/components/PremiumCard';
import { PremiumSheet } from '../../design-system/components/PremiumSheet';
import { PremiumInput } from '../../design-system/components/PremiumInput';
import { PremiumEmptyState } from '../../design-system/components/PremiumEmptyState';
import { PremiumLoadingSkeleton } from '../../design-system/components/PremiumLoadingSkeleton';
import { companiesApi } from '../../api/companies';
import { businessModule } from '../../lib/access';
import { formatSom } from '../../lib/format';
import type { CompanyCatalogItem } from '../../api/types';
import { color, space, type as typeTokens } from '../../design-system/tokens';

type Props = NativeStackScreenProps<CompanyStackParamList, 'CatalogList'>;

const MODULE_LABEL = { menu: 'Menyu', products: 'Mahsulotlar', services: 'Xizmatlar' } as const;

/**
 * `access.ts`'s catalog limits allow up to 300 items on a premium company
 * (`PRODUCT_LIMITS`/`SERVICE_LIMITS`/`MENU_LIMITS`) — real enough to need
 * real virtualization (brief §18), so this uses `FlashList` as the
 * screen's single scrollable element (`ScreenWithHeader scroll={false}`) —
 * nesting FlashList inside the header's own ScrollView would silently
 * defeat the virtualization entirely.
 */
export function CatalogListScreen({ route, navigation }: Props) {
  const { companyId } = route.params;
  const queryClient = useQueryClient();
  const sheetRef = useRef<BottomSheet>(null);
  const [editing, setEditing] = useState<CompanyCatalogItem | null>(null);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');

  const company = useQuery({ queryKey: ['companies', companyId], queryFn: () => companiesApi.get(companyId) });
  const module = company.data ? businessModule('business', company.data.company.category) : null;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['companies', companyId] });

  const addItem = useMutation({
    mutationFn: () => companiesApi.addCatalogItem(companyId, { name: name.trim(), price: Number(price) || 0, description: description.trim() || undefined }),
    onSuccess: () => {
      invalidate();
      sheetRef.current?.close();
    },
  });

  const updateItem = useMutation({
    mutationFn: () =>
      companiesApi.updateCatalogItem(companyId, editing!.id, { name: name.trim(), price: Number(price) || 0, description: description.trim() || undefined }),
    onSuccess: () => {
      invalidate();
      sheetRef.current?.close();
    },
  });

  const deleteItem = useMutation({
    mutationFn: (itemId: string) => companiesApi.deleteCatalogItem(companyId, itemId),
    onSuccess: invalidate,
  });

  const openAddSheet = () => {
    setEditing(null);
    setName('');
    setPrice('');
    setDescription('');
    sheetRef.current?.expand();
  };

  const openEditSheet = (item: CompanyCatalogItem) => {
    setEditing(item);
    setName(item.name);
    setPrice(String(item.price));
    setDescription(item.description ?? '');
    sheetRef.current?.expand();
  };

  const items = company.data?.company.items ?? [];

  return (
    <ScreenWithHeader
      title={module ? MODULE_LABEL[module] : 'Katalog'}
      onBack={navigation.goBack}
      scroll={false}
      actions={[{ icon: 'plus', accessibilityLabel: "Qo'shish", onPress: openAddSheet }]}
    >
      {company.isLoading && <PremiumLoadingSkeleton height={80} />}

      {!company.isLoading && !items.length && (
        <PremiumEmptyState icon="grid" title="Hali katalog elementi yo'q" ctaLabel="Qo'shish" onPressCta={openAddSheet} />
      )}

      {!company.isLoading && !!items.length && (
        <View style={styles.listWrapper}>
        <FlashList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item, index }) => (
            <PremiumCard index={index} style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemPrice}>{formatSom(item.promotionPrice ?? item.price)}</Text>
              </View>
              {!!item.description && <Text style={styles.itemDescription}>{item.description}</Text>}
              <View style={styles.actionsRow}>
                <PremiumButton label="Tahrirlash" variant="ghost" fullWidth={false} onPress={() => openEditSheet(item)} style={styles.actionButton} />
                <PremiumButton label="O'chirish" variant="danger" fullWidth={false} onPress={() => deleteItem.mutate(item.id)} style={styles.actionButton} />
              </View>
            </PremiumCard>
          )}
        />
        </View>
      )}

      <PremiumSheet ref={sheetRef} title={editing ? 'Tahrirlash' : "Qo'shish"}>
        <PremiumInput label="Nomi" value={name} onChangeText={setName} />
        <PremiumInput label="Narxi" value={price} onChangeText={setPrice} keyboardType="number-pad" />
        <PremiumInput label="Tavsif (ixtiyoriy)" value={description} onChangeText={setDescription} multiline numberOfLines={3} />
        <PremiumButton
          label="Saqlash"
          onPress={() => (editing ? updateItem.mutate() : addItem.mutate())}
          loading={addItem.isPending || updateItem.isPending}
          disabled={!name.trim()}
        />
      </PremiumSheet>
    </ScreenWithHeader>
  );
}

const styles = StyleSheet.create({
  listWrapper: { flex: 1 },
  listContent: { padding: space.lg },
  card: { marginBottom: space.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemName: { ...typeTokens.h2, color: color.textPrimary, flex: 1 },
  itemPrice: { ...typeTokens.body, color: color.gold },
  itemDescription: { ...typeTokens.caption, color: color.textSecondary, marginTop: space.xs },
  actionsRow: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
  actionButton: { paddingHorizontal: space.md },
});
