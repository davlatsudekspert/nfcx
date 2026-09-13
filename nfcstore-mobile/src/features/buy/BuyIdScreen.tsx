import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import { buyRecord, isCodeTaken } from '@/api/endpoints';
import { BackBar } from '@/components/BackBar';
import { CardSurface } from '@/components/Card';
import { Field, Input, Notice } from '@/components/Form';
import { GoldButton } from '@/components/GoldButton';
import { SectionDivider } from '@/components/ScreenHeader';
import { TIER_METALS, TierMedal, type TierKey } from '@/components/TierMedal';
import { TapScale } from '@/components/TapScale';
import { money } from '@/lib/format';
import { useAuthStore } from '@/store/authStore';
import { SH } from '@/theme/css';
import { useTheme } from '@/theme/ThemeProvider';
import { mono, sans } from '@/theme/type';

/**
 * YANGI NFC ID SOTIB OLISH — ilova ichida.
 *
 * Ilgari Home dagi tarif kartalari brauzerda `nfcstore.uz/narxlar` ni
 * ochardi. Endi butun oqim shu yerda:
 *
 *   1. Odam 6 belgili kodni yozadi (3 harf + 3 raqam, masalan ALI777).
 *   2. `GET /api/records/:code` bilan bandligi tekshiriladi — alohida
 *      "check" endpointi yo'q, sayt ham xuddi shunday qiladi (404 =
 *      bo'sh).
 *   3. `POST /api/records/:code` buyurtma yaratadi. NARXNI SERVER
 *      hisoblaydi (`personalPurchaseQuote`), ilovadan kelgan summaga
 *      ishonilmaydi.
 *   4. Javobdagi `payLink` ilova ichidagi brauzerda ochiladi.
 *
 * To'lov mantig'i ILOVADA QURILMAYDI (Payme/Click integratsiyasi yo'q)
 * — bu kelishilgan qoida: mavjud checkout havolasi ochiladi.
 *
 * Quyidagi tarif jadvali `hosting/worker.js` dagi `PERSONAL_TIER_PRICE`
 * ning nusxasi (worker.js:3554) va faqat KO'RSATISH uchun: haqiqiy
 * summa har doim server javobidan olinadi.
 */

const CODE_RE = /^[A-Za-z]{3}[0-9]{3}$/;

const TIERS: { key: TierKey; price: number; note: string; from?: boolean }[] = [
  { key: 'free', price: 49_000, note: '6 belgili oddiy kod' },
  { key: 'silver', price: 99_000, note: 'Yodda qoladigan kod' },
  { key: 'gold', price: 149_000, note: 'Qisqa va sodda kod' },
  { key: 'premium', price: 199_000, note: 'Kam uchraydigan kod' },
  { key: 'exclusive', price: 490_000, note: 'Faqat auksion orqali', from: true },
];

export function BuyIdScreen() {
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [checking, setChecking] = useState(false);
  const [taken, setTaken] = useState<boolean | null>(null);
  const [error, setError] = useState('');

  const clean = code.trim().toUpperCase();
  const validCode = CODE_RE.test(clean);

  const check = async () => {
    if (!validCode) return;
    setChecking(true);
    setError('');
    try {
      setTaken(await isCodeTaken(clean));
    } catch (e) {
      setTaken(null);
      setError(errText(e));
    } finally {
      setChecking(false);
    }
  };

  const buy = useMutation({
    mutationFn: () =>
      buyRecord(clean, {
        name: name.trim(),
        // Telefon profilga oldindan yoziladi — odam keyin tahrirlaydi.
        phone: user?.phone ?? '',
        profileType: 'personal',
      }),
    onSuccess: (order) => {
      // Buyurtma yaratildi; ro'yxatlar eskirdi.
      queryClient.invalidateQueries({ queryKey: ['me'] });
      WebBrowser.openBrowserAsync(order.payLink).catch(() => {});
    },
    onError: (e) => setError(errText(e)),
  });

  const canBuy = validCode && taken === false && name.trim().length > 0;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <BackBar title="Yangi NFC ID" subtitle="O’zingizga kod tanlang" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, gap: 16 }}
      >
        <Field
          label="NFC ID kodi"
          hint="3 ta harf va 3 ta raqam — masalan ALI777"
          error={!code || validCode ? undefined : 'Kod ALI777 shaklida bo’lishi kerak'}
        >
          <Input
            value={code}
            onChangeText={(v) => {
              setCode(v);
              setTaken(null);
              setError('');
            }}
            placeholder="ALI777"
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={6}
            invalid={!!code && !validCode}
          />
        </Field>

        <TapScale
          radius={13}
          onPress={validCode && !checking ? check : undefined}
          disabled={!validCode || checking}
          accessibilityLabel="Kodni tekshirish"
          style={{
            height: 42,
            borderRadius: 13,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: theme.rim,
            backgroundColor: theme.c2,
            overflow: 'hidden',
            opacity: validCode ? 1 : 0.45,
          }}
        >
          <CardSurface />
          {checking ? (
            <ActivityIndicator color={theme.a1} />
          ) : (
            <Text style={[sans(600, 13), { color: theme.ink }]}>Kodni tekshirish</Text>
          )}
        </TapScale>

        {taken === true ? (
          <Notice kind="error" text={`${clean} allaqachon band. Boshqa kod tanlang.`} />
        ) : null}
        {taken === false ? (
          <Notice kind="ok" text={`${clean} bo’sh — band qilsa bo’ladi.`} />
        ) : null}

        {taken === false ? (
          <Field label="Ism" hint="Profilingizda ko’rinadigan ism">
            <Input
              value={name}
              onChangeText={setName}
              placeholder="Ismingiz"
              autoCapitalize="words"
            />
          </Field>
        ) : null}

        {error ? <Notice kind="error" text={error} /> : null}

        <GoldButton
          label={buy.isPending ? 'Yuborilmoqda…' : 'Band qilish va to’lash'}
          onPress={canBuy && !buy.isPending ? () => buy.mutate() : undefined}
          style={{ opacity: canBuy && !buy.isPending ? 1 : 0.45 }}
        />

        <Text style={[sans(400, 11.5, 1.5), { color: 'rgba(255,255,255,.42)' }]}>
          Band qilingandan keyin to’lov sahifasi ochiladi. To’lov tasdiqlangach
          ID sizga biriktiriladi va profil tahrirlash uchun ochiladi.
        </Text>

        <SectionDivider label="TARIFLAR" />

        <Text style={[sans(400, 11.5, 1.5), { color: 'rgba(255,255,255,.42)' }]}>
          Narx kodning darajasiga qarab belgilanadi va uni server hisoblaydi —
          quyidagi jadval yo’l ko’rsatish uchun.
        </Text>

        {TIERS.map((t) => {
          const metal = TIER_METALS[t.key];
          return (
            <View
              key={t.key}
              style={[
                {
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 14,
                  padding: 15,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: theme.rim,
                  backgroundColor: theme.c2,
                  overflow: 'hidden',
                },
                SH.cardTight(theme.a2),
              ]}
            >
              <CardSurface />
              <TierMedal m1={metal.m1} m2={metal.m2} />
              <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
                <Text style={[sans(700, 15.5, 1.3), { color: theme.ink }]}>
                  {metal.name}
                </Text>
                <Text style={[sans(400, 12, 1.45), { color: 'rgba(255,255,255,.52)' }]}>
                  {t.note}
                </Text>
              </View>
              <Text style={[mono(500, 10.5), { color: theme.a1, flexShrink: 0 }]}>
                {t.from ? `${money(t.price)} dan` : money(t.price)}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

/** Server xato kodlarini o'zbekcha matnga o'giradi (saytdagi `errText`). */
function errText(e: unknown): string {
  if (!(e instanceof ApiError)) return 'Kutilmagan xatolik.';
  const map: Record<string, string> = {
    network_error: 'Aloqa yo’q. Internetni tekshiring.',
    unauthorized: 'Sessiya tugagan. Qaytadan kiring.',
    already_taken: 'Bu kod allaqachon band.',
    reserved: 'Bu kod tizim uchun ajratilgan.',
    reserved_pending_payment: 'Bu kod band qilingan va to’lov kutilmoqda.',
    not_purchasable: 'Bu kodni sotib bo’lmaydi.',
    exclusive_auction_only: 'Bu daraja faqat auksion orqali sotiladi.',
    payments_disabled: 'To’lov tizimi vaqtincha o’chirilgan.',
    physical_card_not_supported_yet: 'Jismoniy karta hozircha sayt orqali.',
  };
  return map[e.code] ?? e.code;
}
