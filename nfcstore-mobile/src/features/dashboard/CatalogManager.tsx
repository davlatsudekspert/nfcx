import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, Text, TextInput, View } from 'react-native';

import {
  createCatalogItem,
  deleteCatalogItem,
  updateCatalogItem,
  type CatalogItemInput,
} from '@/api/endpoints';
import { ApiError } from '@/api/client';
import type { CatalogItem, Company } from '@/api/types';
import { Card } from '@/components/Card';
import { GhostButton, GoldButton } from '@/components/GoldButton';
import { TapScale } from '@/components/TapScale';
import { money } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';
import { mono, sans } from '@/theme/type';

/**
 * Katalog boshqaruvi — nom, narx, chegirma narxi va "mavjud" holatini
 * o'zgartirish, o'chirish, hamda yangi mahsulot qo'shish.
 *
 * RASM YUKLASH BU BOSQICHDA YO'Q (kelishilgan qaror): yangi mahsulot
 * rasmsiz qo'shiladi, rasm keyin veb orqali biriktiriladi. Shuning
 * uchun `expo-image-picker` ham, kamera ruxsati ham kerak emas.
 *
 * Server qoidalari mijozda ham takrorlanadi, lekin ular HAQIQAT MANBASI
 * emas — server baribir tekshiradi:
 *   • nom bo'sh bo'lmasligi kerak       -> 422 name_required
 *   • chegirma narxi asosiydan KICHIK   -> 422 bad_promotion_price
 *   • bepul tarifda mahsulot limiti     -> 409 plan_limit_reached
 */
export function CatalogManager({
  companyId,
  company,
}: {
  companyId: string;
  company: Company;
}) {
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);

  const onCompany = (updated: Company) => {
    // Server to'liq kompaniyani qaytaradi, shuning uchun keshni
    // to'g'ridan-to'g'ri yangilaymiz — qayta so'rov kerak emas.
    queryClient.setQueryData(['company', companyId], updated);
  };

  const create = useMutation({
    mutationFn: (input: CatalogItemInput) => createCatalogItem(companyId, input),
    onSuccess: (updated) => {
      onCompany(updated);
      setAdding(false);
    },
    onError: (err) => showError(err),
  });

  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<CatalogItemInput> }) =>
      updateCatalogItem(companyId, id, patch),
    onSuccess: onCompany,
    onError: (err) => showError(err),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteCatalogItem(companyId, id),
    onSuccess: onCompany,
    onError: (err) => showError(err),
  });

  const plan = company.plan;
  const limitReached =
    plan?.productLimit != null && company.catalog.length >= plan.productLimit;

  return (
    <View style={{ gap: 12 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Text style={[sans(600, 12), { color: 'rgba(255,255,255,.5)' }]}>
          {company.catalog.length} mahsulot
        </Text>
        {!adding && !limitReached ? (
          <TapScale
            radius={9}
            onPress={() => setAdding(true)}
            accessibilityLabel="Mahsulot qo'shish"
            style={{ paddingVertical: 5, paddingHorizontal: 10, borderRadius: 9 }}
          >
            <Text style={[mono(600, 11), { color: theme.a1, letterSpacing: 0.6 }]}>
              + QO’SHISH
            </Text>
          </TapScale>
        ) : null}
      </View>

      {limitReached ? (
        <Text style={[sans(500, 11.5, 1.45), { color: theme.off }]}>
          Bepul tarifda {plan?.productLimit} mahsulot. Ko’proq qo’shish
          uchun Company ID sotib olish kerak. Mavjud mahsulotlar o’chirilmaydi.
        </Text>
      ) : null}

      {adding ? (
        <ItemEditor
          title="Yangi mahsulot"
          busy={create.isPending}
          onCancel={() => setAdding(false)}
          onSave={(patch) =>
            create.mutate({
              name: patch.name ?? '',
              price: patch.price ?? 0,
              promotionPrice: patch.promotionPrice ?? null,
            })
          }
        />
      ) : null}

      {company.catalog.map((item) => (
        <ItemRow
          key={item.id}
          item={item}
          busy={update.isPending || remove.isPending}
          onSave={(patch) => update.mutate({ id: item.id, patch })}
          onToggleAvailable={() =>
            update.mutate({ id: item.id, patch: { available: !item.available } })
          }
          onDelete={() => confirmDelete(item, () => remove.mutate(item.id))}
        />
      ))}

      {!company.catalog.length && !adding ? (
        <Text
          style={[
            sans(500, 12.5, 1.5),
            { color: theme.off, textAlign: 'center', paddingVertical: 28 },
          ]}
        >
          Katalog bo’sh. Birinchi mahsulotni qo’shing.
        </Text>
      ) : null}
    </View>
  );
}

function ItemRow({
  item,
  busy,
  onSave,
  onToggleAvailable,
  onDelete,
}: {
  item: CatalogItem;
  busy: boolean;
  onSave: (patch: Partial<CatalogItemInput>) => void;
  onToggleAvailable: () => void;
  onDelete: () => void;
}) {
  const { theme } = useTheme();
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <ItemEditor
        title={item.name}
        initial={item}
        busy={busy}
        onCancel={() => setEditing(false)}
        onSave={(patch) => {
          onSave(patch);
          setEditing(false);
        }}
      />
    );
  }

  return (
    <Card radius={14} shadow="soft" style={{ padding: 14, gap: 10 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 10,
        }}
      >
        <View style={{ flex: 1, gap: 5 }}>
          <Text style={[sans(600, 13, 1.3), { color: theme.ink }]}>{item.name}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
            <Text style={[mono(600, 11.5), { color: theme.a1 }]}>
              {money(item.promotionPrice ?? item.price)}
            </Text>
            {item.promotionPrice != null ? (
              <Text
                style={[
                  mono(400, 10),
                  {
                    color: 'rgba(255,255,255,.35)',
                    textDecorationLine: 'line-through',
                  },
                ]}
              >
                {money(item.price)}
              </Text>
            ) : null}
          </View>
        </View>

        <TapScale
          radius={8}
          onPress={onToggleAvailable}
          accessibilityLabel={item.available ? 'Mavjud emas deb belgilash' : 'Mavjud deb belgilash'}
          style={{
            paddingVertical: 5,
            paddingHorizontal: 9,
            borderRadius: 8,
            backgroundColor: item.available
              ? 'rgba(64,190,120,.12)'
              : 'rgba(255,255,255,.06)',
            borderWidth: 1,
            borderColor: item.available
              ? 'rgba(64,190,120,.28)'
              : 'rgba(255,255,255,.1)',
          }}
        >
          <Text
            style={[
              mono(600, 9.5),
              { color: item.available ? '#63d694' : 'rgba(255,255,255,.45)', letterSpacing: 0.6 },
            ]}
          >
            {item.available ? 'MAVJUD' : 'YO’Q'}
          </Text>
        </TapScale>
      </View>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <GhostButton
          label="Tahrirlash"
          onPress={() => setEditing(true)}
          radius={11}
          style={{ flex: 1, height: 36 }}
        />
        <TapScale
          radius={11}
          onPress={onDelete}
          accessibilityLabel="O'chirish"
          style={{
            width: 90,
            height: 36,
            borderRadius: 11,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: 'rgba(190,80,80,.3)',
            backgroundColor: 'rgba(190,80,80,.1)',
          }}
        >
          <Text style={[sans(600, 12.5), { color: '#d98b8b' }]}>O’chirish</Text>
        </TapScale>
      </View>
    </Card>
  );
}

/** Nom / narx / chegirma tahrirlagichi — rasm maydoni ataylab yo'q. */
function ItemEditor({
  title,
  initial,
  busy,
  onSave,
  onCancel,
}: {
  title: string;
  initial?: CatalogItem;
  busy: boolean;
  onSave: (patch: Partial<CatalogItemInput>) => void;
  onCancel: () => void;
}) {
  const { theme } = useTheme();
  const [name, setName] = useState(initial?.name ?? '');
  const [price, setPrice] = useState(initial ? String(initial.price) : '');
  const [promo, setPromo] = useState(
    initial?.promotionPrice != null ? String(initial.promotionPrice) : '',
  );
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const trimmedName = name.trim();
    const priceNum = Math.round(Number(price) || 0);
    const promoNum = promo.trim() === '' ? null : Math.round(Number(promo) || 0);

    if (!trimmedName) {
      setError('Mahsulot nomini kiriting.');
      return;
    }
    // Server ham shu qoidani tekshiradi (bad_promotion_price), lekin
    // odam tugmani bosib xato olishdan ko'ra oldin ko'rsa yaxshi.
    if (promoNum != null && promoNum >= priceNum) {
      setError('Chegirma narxi asosiy narxdan kichik bo’lishi kerak.');
      return;
    }
    setError(null);
    onSave({ name: trimmedName, price: priceNum, promotionPrice: promoNum });
  };

  return (
    <Card radius={14} style={{ padding: 14, gap: 11 }}>
      <Text style={[mono(600, 11), { color: theme.a1, letterSpacing: 1.1 }]}>
        {title.toUpperCase()}
      </Text>

      <Field label="Nom" value={name} onChangeText={setName} placeholder="NFC Card · Gold" />
      <Field
        label="Narx (so’m)"
        value={price}
        onChangeText={setPrice}
        placeholder="1200000"
        numeric
      />
      <Field
        label="Chegirma narxi"
        value={promo}
        onChangeText={setPromo}
        placeholder="ixtiyoriy"
        numeric
      />

      {error ? (
        <Text style={[sans(500, 11.5, 1.4), { color: '#d98b8b' }]}>{error}</Text>
      ) : null}

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 2 }}>
        <GhostButton
          label="Bekor"
          onPress={onCancel}
          radius={11}
          style={{ width: 90, height: 38 }}
        />
        <GoldButton
          label={busy ? 'Saqlanmoqda…' : 'Saqlash'}
          onPress={busy ? undefined : submit}
          sweep={false}
          radius={11}
          style={{ flex: 1, height: 38 }}
        />
      </View>
    </Card>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  numeric = false,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  numeric?: boolean;
}) {
  const { theme } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text style={[sans(500, 11), { color: 'rgba(255,255,255,.45)' }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.off}
        keyboardType={numeric ? 'number-pad' : 'default'}
        style={[
          sans(500, 13),
          {
            color: theme.ink,
            paddingHorizontal: 11,
            height: 38,
            borderRadius: 10,
            backgroundColor: 'rgba(255,255,255,.05)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,.08)',
          },
        ]}
      />
    </View>
  );
}

function confirmDelete(item: CatalogItem, onConfirm: () => void) {
  Alert.alert(
    'Mahsulotni o’chirish',
    `"${item.name}" o’chiriladi. Bu amalni qaytarib bo’lmaydi.`,
    [
      { text: 'Bekor', style: 'cancel' },
      { text: 'O’chirish', style: 'destructive', onPress: onConfirm },
    ],
  );
}

/** Server xatolarini odam tushunadigan matnga aylantiradi. */
function showError(err: unknown) {
  const code = err instanceof ApiError ? err.code : '';
  const limit = err instanceof ApiError ? err.limit : undefined;

  const map: Record<string, string> = {
    name_required: 'Mahsulot nomini kiriting.',
    bad_promotion_price: 'Chegirma narxi asosiy narxdan kichik bo’lishi kerak.',
    plan_limit_reached: `Bepul tarifda ${limit ?? 5} mahsulot. Ko’proq qo’shish uchun Company ID sotib olish kerak.`,
    unauthorized: 'Sessiya tugagan. Qaytadan kiring.',
    network_error: 'Internet aloqasi yo’q.',
  };

  Alert.alert('Saqlanmadi', map[code] ?? (code || 'Noma’lum xato yuz berdi.'));
}
