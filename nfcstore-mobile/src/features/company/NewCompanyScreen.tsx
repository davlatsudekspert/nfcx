import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import { checkCompanyId, COMPANY_CATEGORIES, createCompany } from '@/api/endpoints';
import { BackBar } from '@/components/BackBar';
import { CardSurface } from '@/components/Card';
import { ChoiceRow, Field, Input, Notice } from '@/components/Form';
import { GoldButton } from '@/components/GoldButton';
import { TapScale } from '@/components/TapScale';
import { money } from '@/lib/format';
import { useActiveIdStore } from '@/store/activeIdStore';
import { useTheme } from '@/theme/ThemeProvider';
import { sans } from '@/theme/type';

/**
 * YANGI COMPANY ID — ilova ichida.
 *
 * Ilgari bu tugma brauzerda `nfcstore.uz/business` ni ochardi. Endi
 * forma shu yerda va to'g'ridan-to'g'ri `POST /api/companies` ga
 * boradi.
 *
 * IKKI YO'L (backenddagi mantiqning o'zi, worker.js:1042):
 *   • BEPUL — `auto: true`. Server tasodifiy Company ID beradi, to'lov
 *     so'ralmaydi.
 *   • TANLANGAN NOM — `companyId` yuboriladi. Nomning narxi bor;
 *     bandligi va narxi `GET /api/companies/check?id=` bilan oldindan
 *     ko'rsatiladi.
 *
 * Ikkala holatda ham kompaniya `pending_review` holatida yaratiladi —
 * admin tasdiqlagach faol bo'ladi. Shuni foydalanuvchiga ochiq aytamiz,
 * aks holda u "ochdim, lekin ko'rinmayapti" deb o'ylaydi.
 */

const MODES = [
  { key: 'auto' as const, label: 'Bepul avtomatik ID' },
  { key: 'custom' as const, label: 'Nom tanlash' },
];

export function NewCompanyScreen() {
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const setActive = useActiveIdStore((s) => s.setActive);

  const [mode, setMode] = useState<'auto' | 'custom'>('auto');
  const [companyId, setCompanyId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>('other');

  const [checking, setChecking] = useState(false);
  const [availability, setAvailability] = useState<string | null>(null);
  const [error, setError] = useState('');

  const idClean = companyId.trim().toUpperCase();

  const check = async () => {
    if (idClean.length < 3) return;
    setChecking(true);
    setError('');
    try {
      const a = await checkCompanyId(idClean);
      setAvailability(
        a.available
          ? a.price
            ? `${idClean} bo’sh — narxi ${money(a.price)}`
            : `${idClean} bo’sh va bepul`
          : `${idClean} band yoki ajratilgan`,
      );
    } catch (e) {
      setAvailability(null);
      setError(errText(e));
    } finally {
      setChecking(false);
    }
  };

  // Server aynan shu to'rtta maydonni talab qiladi; tavsif kamida 20
  // belgi bo'lishi shart (`required_fields` xatosi shundan chiqadi).
  const ready =
    displayName.trim().length > 0 &&
    city.trim().length > 0 &&
    phone.trim().length > 0 &&
    description.trim().length >= 20 &&
    (mode === 'auto' || idClean.length >= 3);

  const create = useMutation({
    mutationFn: () =>
      createCompany({
        auto: mode === 'auto',
        companyId: mode === 'custom' ? idClean : undefined,
        displayName: displayName.trim(),
        city: city.trim(),
        phone: phone.trim(),
        description: description.trim(),
        category,
      }),
    onSuccess: (company) => {
      queryClient.invalidateQueries({ queryKey: ['companies', 'mine'] });
      // Yangi kompaniya darhol faol ID bo'lib tanlanadi — odam natijani
      // ko'rsin.
      setActive({ kind: 'business', companyId: company.companyId });
      router.replace('/(tabs)/company');
    },
    onError: (e) => setError(errText(e)),
  });

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <BackBar title="Yangi Company ID" subtitle="Biznes profilini ro’yxatdan o’tkazish" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, gap: 16 }}
      >
        <Field label="ID turi" hint="Bepul ID ni server o’zi beradi">
          <ChoiceRow
            options={MODES}
            value={mode}
            onChange={(k) => {
              setMode(k);
              setAvailability(null);
            }}
          />
        </Field>

        {mode === 'custom' ? (
          <>
            <Field label="Company ID" hint="Kamida 3 belgi — masalan ALIMARKET">
              <Input
                value={companyId}
                onChangeText={(v) => {
                  setCompanyId(v);
                  setAvailability(null);
                }}
                placeholder="ALIMARKET"
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={40}
              />
            </Field>

            <TapScale
              radius={13}
              onPress={idClean.length >= 3 && !checking ? check : undefined}
              disabled={idClean.length < 3 || checking}
              accessibilityLabel="Nomni tekshirish"
              style={{
                height: 42,
                borderRadius: 13,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: theme.rim,
                backgroundColor: theme.c2,
                overflow: 'hidden',
                opacity: idClean.length >= 3 ? 1 : 0.45,
              }}
            >
              <CardSurface />
              {checking ? (
                <ActivityIndicator color={theme.a1} />
              ) : (
                <Text style={[sans(600, 13), { color: theme.ink }]}>Nomni tekshirish</Text>
              )}
            </TapScale>

            {availability ? (
              <Notice
                kind={availability.includes('bo’sh') ? 'ok' : 'error'}
                text={availability}
              />
            ) : null}
          </>
        ) : null}

        <Field label="Kompaniya nomi">
          <Input
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Ali Market"
            autoCapitalize="words"
            maxLength={120}
          />
        </Field>

        <Field label="Shahar">
          <Input
            value={city}
            onChangeText={setCity}
            placeholder="Toshkent"
            autoCapitalize="words"
            maxLength={100}
          />
        </Field>

        <Field label="Telefon">
          <Input
            value={phone}
            onChangeText={setPhone}
            placeholder="+998 90 123 45 67"
            keyboardType="phone-pad"
            maxLength={40}
          />
        </Field>

        <Field label="Kategoriya">
          <ChoiceRow
            options={COMPANY_CATEGORIES}
            value={category as (typeof COMPANY_CATEGORIES)[number]['key']}
            onChange={(k) => setCategory(k)}
          />
        </Field>

        <Field
          label="Tavsif"
          hint={`Kamida 20 belgi (hozir ${description.trim().length})`}
          error={
            description.length > 0 && description.trim().length < 20
              ? 'Tavsif juda qisqa'
              : undefined
          }
        >
          <Input
            value={description}
            onChangeText={setDescription}
            placeholder="Nima bilan shug’ullanasiz, nima sotasiz?"
            multiline
            maxLength={1200}
            invalid={description.length > 0 && description.trim().length < 20}
          />
        </Field>

        {error ? <Notice kind="error" text={error} /> : null}

        <GoldButton
          label={create.isPending ? 'Yaratilmoqda…' : 'Company ID ochish'}
          onPress={ready && !create.isPending ? () => create.mutate() : undefined}
          style={{ opacity: ready && !create.isPending ? 1 : 0.45 }}
        />

        <Text style={[sans(400, 11.5, 1.5), { color: 'rgba(255,255,255,.42)' }]}>
          Kompaniya avval tekshiruvga tushadi. Admin tasdiqlagach u katalogda
          ko’rinadi va ochiq sahifasi ishlay boshlaydi.
        </Text>
      </ScrollView>
    </View>
  );
}

function errText(e: unknown): string {
  if (!(e instanceof ApiError)) return 'Kutilmagan xatolik.';
  const map: Record<string, string> = {
    network_error: 'Aloqa yo’q. Internetni tekshiring.',
    unauthorized: 'Sessiya tugagan. Qaytadan kiring.',
    bad_company_id: 'Company ID noto’g’ri yozilgan.',
    company_id_taken: 'Bu Company ID band.',
    company_id_reserved: 'Bu nom ajratilgan.',
    required_fields: 'Nom, shahar, telefon va 20 belgidan uzun tavsif kerak.',
    name_not_allowed: 'Bu nomdan foydalanib bo’lmaydi.',
    auto_id_failed: 'Bepul ID yaratib bo’lmadi. Qaytadan urinib ko’ring.',
  };
  return map[e.code] ?? e.code;
}
