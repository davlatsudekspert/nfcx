import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import { getRecord, recordToInput, updateRecord } from '@/api/endpoints';
import type { Card } from '@/api/types';
import { BackBar } from '@/components/BackBar';
import { Field, Input, Notice } from '@/components/Form';
import { GoldButton } from '@/components/GoldButton';
import { useTheme } from '@/theme/ThemeProvider';
import { sans } from '@/theme/type';

/**
 * HAVOLALARNI TAHRIRLASH — ilova ichida.
 *
 * MUHIM TEXNIK NUQTA: `PUT /api/records/:code` yozuvni TO'LIQ
 * ALMASHTIRADI (worker.js `updateRecord`). Ya'ni faqat o'zgargan
 * maydonni yuborib bo'lmaydi — yuborilmagani O'CHADI. Shuning uchun
 * avval mavjud yozuv o'qiladi, `recordToInput()` bilan to'liq shaklga
 * keltiriladi va faqat shundan keyin ustiga o'zgarish qo'yiladi.
 *
 * Bu ekranda faqat MATNLI maydonlar bor. Rasm yuklash, tema va karta
 * dizayni veb tahrirlagichida qoladi — ular alohida yuklash oqimini
 * talab qiladi va bu bosqichga kirmaydi.
 */
export function EditLinksScreen() {
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const { code } = useLocalSearchParams<{ code: string }>();

  const recordQuery = useQuery({
    queryKey: ['record', code],
    queryFn: () => getRecord(code!),
    enabled: !!code,
  });

  const [form, setForm] = useState<Partial<Card>>({});
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  // Javob kelganda formani bir marta to'ldiramiz. Keyingi qayta
  // yuklanishlar yozayotgan matnni bosib ketmasligi uchun `data` ning
  // O'ZIGA bog'lanadi (u faqat so'rov yangilanganda o'zgaradi).
  useEffect(() => {
    if (recordQuery.data) setForm(recordQuery.data);
  }, [recordQuery.data]);

  const set = (k: keyof Card) => (v: string) => {
    setForm((prev) => ({ ...prev, [k]: v }));
    setSaved(false);
  };

  const save = useMutation({
    mutationFn: () => {
      const base = recordQuery.data!;
      return updateRecord(code!, {
        // Mavjud qiymatlar ASOS, ustiga formadagi o'zgarish.
        ...recordToInput(base),
        name: (form.name ?? base.name).trim(),
        role: form.role ?? base.role,
        phone: form.phone ?? base.phone,
        email: form.email ?? base.email,
        tg: form.tg ?? base.tg,
        instagram: form.instagram ?? base.instagram,
        facebook: form.facebook ?? base.facebook,
        website: form.website ?? base.website,
        city: form.city ?? base.city,
        about: form.about ?? base.about,
      });
    },
    onSuccess: () => {
      setSaved(true);
      setError('');
      queryClient.invalidateQueries({ queryKey: ['record', code] });
      queryClient.invalidateQueries({ queryKey: ['me'] });
    },
    onError: (e) => {
      setSaved(false);
      setError(errText(e));
    },
  });

  if (recordQuery.isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <BackBar title="Havolalar" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={theme.a1} />
        </View>
      </View>
    );
  }

  if (!recordQuery.data) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <BackBar title="Havolalar" />
        <View style={{ padding: 16 }}>
          <Notice kind="error" text="Profilni yuklab bo’lmadi." />
        </View>
      </View>
    );
  }

  const nameOk = (form.name ?? '').trim().length > 0;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <BackBar
        title="Profilni tahrirlash"
        subtitle={recordQuery.data.code}
        right={
          <GoldButton
            label={save.isPending ? '…' : 'Saqlash'}
            onPress={nameOk && !save.isPending ? () => save.mutate() : undefined}
            sweep={false}
            style={{ paddingHorizontal: 16, opacity: nameOk ? 1 : 0.45 }}
          />
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, gap: 16 }}
      >
        {saved ? <Notice kind="ok" text="Saqlandi." /> : null}
        {error ? <Notice kind="error" text={error} /> : null}

        <Field label="Ism" error={nameOk ? undefined : 'Ism bo’sh bo’lishi mumkin emas'}>
          <Input
            value={form.name ?? ''}
            onChangeText={set('name')}
            placeholder="Ismingiz"
            autoCapitalize="words"
            invalid={!nameOk}
          />
        </Field>

        <Field label="Kasb yoki lavozim">
          <Input value={form.role ?? ''} onChangeText={set('role')} placeholder="Dasturchi" />
        </Field>

        <Field label="Shahar">
          <Input value={form.city ?? ''} onChangeText={set('city')} placeholder="Toshkent" />
        </Field>

        <Field label="Telefon">
          <Input
            value={form.phone ?? ''}
            onChangeText={set('phone')}
            placeholder="+998 90 123 45 67"
            keyboardType="phone-pad"
          />
        </Field>

        <Field label="Email">
          <Input
            value={form.email ?? ''}
            onChangeText={set('email')}
            placeholder="siz@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </Field>

        <Field label="Telegram" hint="@ belgisisiz">
          <Input
            value={form.tg ?? ''}
            onChangeText={set('tg')}
            placeholder="username"
            autoCapitalize="none"
          />
        </Field>

        <Field label="Instagram" hint="@ belgisisiz">
          <Input
            value={form.instagram ?? ''}
            onChangeText={set('instagram')}
            placeholder="username"
            autoCapitalize="none"
          />
        </Field>

        <Field label="Facebook">
          <Input
            value={form.facebook ?? ''}
            onChangeText={set('facebook')}
            placeholder="username"
            autoCapitalize="none"
          />
        </Field>

        <Field label="Veb-sayt">
          <Input
            value={form.website ?? ''}
            onChangeText={set('website')}
            placeholder="https://example.uz"
            autoCapitalize="none"
            keyboardType="url"
          />
        </Field>

        <Field label="O’zingiz haqingizda">
          <Input
            value={form.about ?? ''}
            onChangeText={set('about')}
            placeholder="Qisqa tanishtiruv"
            multiline
            maxLength={600}
          />
        </Field>

        <Text style={[sans(400, 11.5, 1.5), { color: 'rgba(255,255,255,.42)' }]}>
          Rasm, tema va karta dizayni hozircha sayt orqali tahrirlanadi.
        </Text>

        <GoldButton
          label={save.isPending ? 'Saqlanmoqda…' : 'Saqlash'}
          onPress={nameOk && !save.isPending ? () => save.mutate() : undefined}
          style={{ opacity: nameOk && !save.isPending ? 1 : 0.45 }}
        />
      </ScrollView>
    </View>
  );
}

function errText(e: unknown): string {
  if (!(e instanceof ApiError)) return 'Kutilmagan xatolik.';
  const map: Record<string, string> = {
    network_error: 'Aloqa yo’q. Internetni tekshiring.',
    unauthorized: 'Sessiya tugagan. Qaytadan kiring.',
    forbidden: 'Bu profil sizniki emas.',
    not_found: 'Profil topilmadi.',
  };
  // Server validatsiya xatosini TAYYOR o'zbekcha matn bilan ham
  // qaytaradi ("Ism bo'sh bo'lishi mumkin emas.") — uni tarjima qilish
  // shart emas.
  return map[e.code] ?? e.code;
}
