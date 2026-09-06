import React, { useMemo, useRef, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type BottomSheet from '@gorhom/bottom-sheet';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Feather } from '@expo/vector-icons';
import type { CompanyStackParamList } from '../../navigation/types';
import { PremiumHeader } from '../../design-system/components/PremiumHeader';
import { PremiumButton } from '../../design-system/components/PremiumButton';
import { PremiumCard } from '../../design-system/components/PremiumCard';
import { PremiumSheet } from '../../design-system/components/PremiumSheet';
import { PremiumInput } from '../../design-system/components/PremiumInput';
import { PremiumQueryState } from '../../design-system/components/PremiumQueryState';
import { useToast } from '../../design-system/components/PremiumToast';
import { NoticeLine } from './CompanyVisuals';
import { companiesApi } from '../../api/companies';
import { ApiError } from '../../api/client';
import { companyKeys, useCompany } from '../../hooks/useMyCompanies';
import { pickAndUploadImage } from '../../native/imageUpload';
import { absoluteUploadUrl } from './companyForm';
import { useAuthStore } from '../../state/authStore';
import { businessModule, menuLimitsFor, productLimitsFor, serviceLimitsFor } from '../../lib/access';
import { formatCount, formatSom, safeText, toFiniteNumber } from '../../lib/format';
import type { Company, CompanyCatalogItem } from '../../api/types';
import { color, radius, space, type as typeTokens } from '../../design-system/tokens';

type Props = NativeStackScreenProps<CompanyStackParamList, 'CatalogList'>;

const MODULE_LABEL = { menu: 'Menyu', products: 'Mahsulotlar', services: 'Xizmatlar' } as const;
const MODULE_ITEM_LABEL = { menu: 'taom', products: 'mahsulot', services: 'xizmat' } as const;

/**
 * Catalogue manager for one company. Every row and every write is real:
 * `POST/PATCH/DELETE /api/companies/:id/catalog[/:itemId]` all exist
 * (src/api/companies.ts) and each response carries the updated company, so
 * the cache is refreshed from the server's own copy rather than guessed.
 *
 * `access.ts` allows up to 300 items on a premium company, so this uses
 * `FlashList` as the screen's only scrollable element — nesting it inside a
 * ScrollView would silently defeat the virtualization.
 */
export function CatalogListScreen({ route, navigation }: Props) {
  const { companyId } = route.params;
  const queryClient = useQueryClient();
  const toast = useToast();
  const sheetRef = useRef<BottomSheet>(null);

  const company = useCompany(companyId);
  const c = company.data;
  const items: CompanyCatalogItem[] = useMemo(() => {
    const raw = c?.items;
    return Array.isArray(raw) ? raw : [];
  }, [c]);

  const module = c ? businessModule('business', c.category) : null;
  const limits = useMemo(() => {
    const tier = c?.tier ?? 'free';
    if (module === 'menu') return menuLimitsFor(tier);
    if (module === 'products') return productLimitsFor(tier);
    return serviceLimitsFor(tier);
  }, [c?.tier, module]);
  const atLimit = limits.item > 0 && items.length >= limits.item;

  const [editing, setEditing] = useState<CompanyCatalogItem | null>(null);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [promotionPrice, setPromotionPrice] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [available, setAvailable] = useState(true);
  const [imageUrl, setImageUrl] = useState<string>('');
  const [imageUploading, setImageUploading] = useState(false);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);

  const applyCompany = (result: { company: Company }) => {
    queryClient.setQueryData(companyKeys.detail(companyId), result);
    queryClient.invalidateQueries({ queryKey: companyKeys.mine });
  };

  const reportError = (e: unknown) =>
    toast.show(e instanceof ApiError ? e.message : 'Amal bajarilmadi. Qayta urinib ko‘ring.', 'danger');

  const priceValue = toFiniteNumber(price.replace(/\s/g, ''));
  const promoValue = promotionPrice.trim() === '' ? null : toFiniteNumber(promotionPrice.replace(/\s/g, ''));
  const nameError = name.trim().length > 0 && name.trim().length < 2 ? 'Nomi juda qisqa.' : null;
  const priceError = price.trim() !== '' && (priceValue == null || priceValue < 0) ? "Narx noto'g'ri." : null;
  const promoError =
    promotionPrice.trim() !== '' && (promoValue == null || promoValue < 0)
      ? "Chegirma narxi noto'g'ri."
      : promoValue != null && priceValue != null && promoValue >= priceValue
        ? 'Chegirma narxi asosiy narxdan past bo‘lsin.'
        : null;
  const formInvalid = name.trim().length < 2 || priceValue == null || !!priceError || !!promoError;

  const payload = () => ({
    name: name.trim(),
    price: priceValue ?? 0,
    promotionPrice: promoValue,
    category: category.trim() || undefined,
    description: description.trim() || undefined,
    available,
    // On create an empty slot is simply omitted; on edit an empty string is
    // the only way to actually clear a previously uploaded image.
    ...(imageUrl ? { imageUrl } : editing?.imageUrl ? { imageUrl: '' } : {}),
  });

  const pickItemImage = async () => {
    if (imageUploading) return;
    setImageUploading(true);
    const result = await pickAndUploadImage();
    setImageUploading(false);
    if (result.status === 'ok') {
      setImageUrl(absoluteUploadUrl(result.url));
      return;
    }
    if (result.status === 'permission_denied') toast.show('Galereyaga ruxsat berilmagan.', 'warning');
    else if (result.status === 'error') toast.show('Rasm yuklanmadi.', 'danger');
  };

  const save = useMutation({
    mutationFn: () =>
      editing
        ? companiesApi.updateCatalogItem(companyId, editing.id, payload())
        : companiesApi.addCatalogItem(companyId, payload()),
    onSuccess: (result) => {
      applyCompany(result);
      sheetRef.current?.close();
      toast.show(editing ? 'Yangilandi.' : "Qo'shildi.", 'success');
    },
    onError: reportError,
  });

  const toggleAvailable = useMutation({
    mutationFn: (item: CompanyCatalogItem) =>
      companiesApi.updateCatalogItem(companyId, item.id, { available: !item.available }),
    onSuccess: applyCompany,
    onError: reportError,
    onSettled: () => setBusyItemId(null),
  });

  const remove = useMutation({
    mutationFn: (itemId: string) => companiesApi.deleteCatalogItem(companyId, itemId),
    onSuccess: (result) => {
      applyCompany(result);
      toast.show("O'chirildi.", 'success');
    },
    onError: reportError,
    onSettled: () => setBusyItemId(null),
  });

  const openAdd = () => {
    setEditing(null);
    setName('');
    setPrice('');
    setPromotionPrice('');
    setCategory('');
    setDescription('');
    setAvailable(true);
    setImageUrl('');
    sheetRef.current?.expand();
  };

  const openEdit = (item: CompanyCatalogItem) => {
    setEditing(item);
    setName(safeText(item.name, ''));
    setPrice(item.price == null ? '' : String(item.price));
    setPromotionPrice(item.promotionPrice == null ? '' : String(item.promotionPrice));
    setCategory(item.category ?? '');
    setDescription(item.description ?? '');
    setAvailable(item.available !== false);
    setImageUrl(item.imageUrl ?? '');
    sheetRef.current?.expand();
  };

  const confirmDelete = (item: CompanyCatalogItem) => {
    Alert.alert(safeText(item.name, 'Element'), "Ro'yxatdan o'chirilsinmi?", [
      { text: 'Bekor qilish', style: 'cancel' },
      {
        text: "O'chirish",
        style: 'destructive',
        onPress: () => {
          setBusyItemId(item.id);
          remove.mutate(item.id);
        },
      },
    ]);
  };

  const itemWord = module ? MODULE_ITEM_LABEL[module] : 'element';

  return (
    <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
      <PremiumHeader
        title={module ? MODULE_LABEL[module] : 'Katalog'}
        onBack={navigation.canGoBack() ? navigation.goBack : undefined}
        actions={[{ icon: 'plus', accessibilityLabel: "Qo'shish", onPress: openAdd }]}
      />

      <View style={styles.body}>
        {c && (
          <View style={styles.summary}>
            <Text style={styles.summaryText}>
              {formatCount(items.length)}
              {limits.item > 0 ? ` / ${formatCount(limits.item)}` : ''} ta {itemWord}
            </Text>
            {atLimit ? <NoticeLine icon="lock" tone="warning" text="Tarif limitiga yetdingiz." /> : null}
          </View>
        )}

        <PremiumQueryState
          isLoading={company.isLoading}
          isError={company.isError}
          error={company.error}
          onRetry={() => void company.refetch()}
          onUnauthorized={() => void useAuthStore.getState().logout()}
          isEmpty={company.isSuccess && items.length === 0}
          emptyIcon="grid"
          emptyTitle="Katalog bo'sh"
          emptyDescription={`Birinchi ${itemWord}ni qo'shing — u ochiq sahifada ko'rinadi.`}
          emptyCtaLabel={atLimit ? undefined : "Qo'shish"}
          onPressEmptyCta={atLimit ? undefined : openAdd}
          skeletonRows={3}
          skeletonHeight={92}
        >
          <View style={styles.listWrapper}>
            <FlashList
              data={items}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              renderItem={({ item, index }) => (
                <CatalogRow
                  item={item}
                  index={index}
                  busy={busyItemId === item.id}
                  onEdit={() => openEdit(item)}
                  onToggle={() => {
                    setBusyItemId(item.id);
                    toggleAvailable.mutate(item);
                  }}
                  onDelete={() => confirmDelete(item)}
                />
              )}
              ListFooterComponent={
                <PremiumButton
                  label={atLimit ? 'Tarif limiti' : `Yangi ${itemWord}`}
                  variant="ghost"
                  onPress={openAdd}
                  disabled={atLimit}
                  style={styles.footerButton}
                />
              }
            />
          </View>
        </PremiumQueryState>
      </View>

      <PremiumSheet ref={sheetRef} title={editing ? 'Tahrirlash' : "Yangi element"} snapPoints={['92%']}>
        <View style={styles.imageRow}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.sheetThumb} resizeMode="cover" />
          ) : (
            <View style={[styles.sheetThumb, styles.thumbEmpty]}>
              <Feather name="image" size={18} color={color.textTertiary} />
            </View>
          )}
          <View style={styles.imageActions}>
            <PremiumButton
              label={imageUrl ? "Rasmni almashtirish" : 'Rasm yuklash'}
              variant="ghost"
              onPress={() => void pickItemImage()}
              loading={imageUploading}
              disabled={imageUploading}
            />
            {imageUrl ? (
              <PremiumButton label="Rasmni olib tashlash" variant="ghost" onPress={() => setImageUrl('')} />
            ) : null}
          </View>
        </View>

        <PremiumInput label="Nomi" value={name} onChangeText={setName} error={nameError} />
        <View style={styles.priceInputs}>
          <View style={styles.priceInput}>
            <PremiumInput
              label="Narxi (so'm)"
              value={price}
              onChangeText={setPrice}
              keyboardType="number-pad"
              error={priceError}
            />
          </View>
          <View style={styles.priceInput}>
            <PremiumInput
              label="Chegirma (ixtiyoriy)"
              value={promotionPrice}
              onChangeText={setPromotionPrice}
              keyboardType="number-pad"
              error={promoError}
            />
          </View>
        </View>
        <PremiumInput label="Bo'lim (ixtiyoriy)" value={category} onChangeText={setCategory} />
        <PremiumInput
          label="Tavsif (ixtiyoriy)"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={3}
          style={styles.textArea}
        />
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Sotuvda</Text>
          <Switch
            value={available}
            onValueChange={setAvailable}
            trackColor={{ false: color.surfaceHigh, true: color.goldDark }}
            thumbColor={available ? color.gold : color.textTertiary}
          />
        </View>
        <PremiumButton
          label="Saqlash"
          onPress={() => save.mutate()}
          loading={save.isPending}
          disabled={formInvalid || save.isPending}
        />
      </PremiumSheet>
    </SafeAreaView>
  );
}

function CatalogRow({
  item,
  index,
  busy,
  onEdit,
  onToggle,
  onDelete,
}: {
  item: CompanyCatalogItem;
  index: number;
  busy: boolean;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const hasPromo = toFiniteNumber(item.promotionPrice) != null;
  const unavailable = item.available === false;

  return (
    <PremiumCard index={index} style={styles.card} contentStyle={styles.cardContent}>
      <View style={styles.rowTop}>
        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} style={styles.thumb} resizeMode="cover" />
        ) : (
          <View style={[styles.thumb, styles.thumbEmpty]}>
            <Feather name="image" size={18} color={color.textTertiary} />
          </View>
        )}

        <View style={styles.rowText}>
          <Text style={[styles.itemName, unavailable && styles.itemNameOff]} numberOfLines={1}>
            {safeText(item.name)}
          </Text>
          {!!item.category && (
            <Text style={styles.itemCategory} numberOfLines={1}>
              {item.category}
            </Text>
          )}
          <View style={styles.priceRow}>
            {hasPromo ? (
              <>
                <Text style={styles.itemPrice}>{formatSom(item.promotionPrice)}</Text>
                <Text style={styles.itemPriceOld}>{formatSom(item.price)}</Text>
              </>
            ) : (
              <Text style={styles.itemPrice}>{formatSom(item.price)}</Text>
            )}
          </View>
        </View>
      </View>

      {!!item.description && (
        <Text style={styles.itemDescription} numberOfLines={2}>
          {item.description}
        </Text>
      )}

      <View style={styles.actionsRow}>
        <IconAction icon={unavailable ? 'eye-off' : 'eye'} label={unavailable ? 'Sotuvda emas' : 'Sotuvda'} onPress={onToggle} disabled={busy} tint={unavailable ? color.textTertiary : color.success} />
        <IconAction icon="edit-2" label="Tahrirlash" onPress={onEdit} disabled={busy} tint={color.gold} />
        <IconAction icon="trash-2" label="O'chirish" onPress={onDelete} disabled={busy} tint={color.danger} />
      </View>
    </PremiumCard>
  );
}

function IconAction({
  icon,
  label,
  onPress,
  disabled,
  tint,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tint: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={[styles.iconAction, disabled && styles.iconActionDisabled]}
    >
      <Feather name={icon} size={14} color={tint} />
      <Text style={[styles.iconActionText, { color: tint }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.bg },
  body: { flex: 1, paddingHorizontal: space.lg },
  summary: { gap: space.sm, paddingBottom: space.md },
  summaryText: { ...typeTokens.overline, color: color.textTertiary },

  listWrapper: { flex: 1 },
  listContent: { paddingBottom: space.xxxl },
  card: { marginBottom: space.md },
  cardContent: { padding: space.md },
  rowTop: { flexDirection: 'row', gap: space.md, alignItems: 'center' },
  thumb: { width: 52, height: 52, borderRadius: radius.sm, backgroundColor: color.surfaceHigh },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, gap: 2 },
  itemName: { ...typeTokens.bodyStrong, color: color.textPrimary },
  itemNameOff: { color: color.textTertiary },
  itemCategory: { ...typeTokens.caption, color: color.textTertiary },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  itemPrice: { ...typeTokens.bodyStrong, color: color.gold },
  itemPriceOld: { ...typeTokens.caption, color: color.textTertiary, textDecorationLine: 'line-through' },
  itemDescription: { ...typeTokens.caption, color: color.textSecondary, marginTop: space.sm, lineHeight: 17 },

  actionsRow: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  iconAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: space.sm,
    paddingVertical: space.sm,
    borderRadius: radius.sm,
    backgroundColor: color.surfaceRaised,
  },
  iconActionDisabled: { opacity: 0.4 },
  iconActionText: { ...typeTokens.caption, fontWeight: '600' },

  footerButton: { marginTop: space.sm },
  priceInputs: { flexDirection: 'row', gap: space.md },
  priceInput: { flex: 1 },
  imageRow: { flexDirection: 'row', gap: space.md, alignItems: 'center' },
  imageActions: { flex: 1, gap: space.sm },
  sheetThumb: { width: 64, height: 64, borderRadius: radius.sm, backgroundColor: color.surfaceHigh },
  textArea: { minHeight: 84, paddingTop: space.md, textAlignVertical: 'top' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  switchLabel: { ...typeTokens.body, color: color.textPrimary },
});
