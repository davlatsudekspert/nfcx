import { useQuery } from '@tanstack/react-query';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getGiftOffers, getPaymentsSettings, getPhysicalPricing } from '@/api/endpoints';
import { Card } from '@/components/Card';
import { TapScale } from '@/components/TapScale';
import { HandleChip } from '@/features/profile/header/ActionButtons';
import { TierStrip } from '@/features/nfc/TierStrip';
import { SwitcherSheet } from '@/features/profile/sheets/SwitcherSheet';
import { useProfileData } from '@/features/profile/useProfileData';
import { money } from '@/lib/format';
import { useActiveIdStore } from '@/store/activeIdStore';
import { useAuthStore } from '@/store/authStore';
import { SITE } from '@/features/profile/profileVM';
import { useTheme } from '@/theme/ThemeProvider';
import { mono, sans } from '@/theme/type';

/**
 * Home — tezkor amal kartalari.
 *
 * Kartalar FAOL ID ga qarab o'zgaradi (biznes yoki shaxsiy), xuddi
 * maketdagidek. Har bir karta haqiqiy endpointga ulangan:
 *
 *   ID holati       -> faol profil javobidan (ko'rishlar, ochiq havola)
 *   Jismoniy karta  -> GET /api/settings/physical-nfc-pricing
 *   Sovg'a          -> GET /api/gift-offers (kutilayotganlar soni)
 *   To'lovlar       -> GET /api/settings/payments-enabled + /auth/me dagi
 *                      premium/sinov muddati
 */
export function HomeScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const setActive = useActiveIdStore((s) => s.setActive);
  const user = useAuthStore((s) => s.user);

  const { vm, accounts, active } = useProfileData();
  const [switcherOpen, setSwitcherOpen] = useState(false);

  const pricing = useQuery({ queryKey: ['physical-pricing'], queryFn: getPhysicalPricing });
  const gifts = useQuery({ queryKey: ['gift-offers'], queryFn: getGiftOffers });
  const payments = useQuery({ queryKey: ['payments-settings'], queryFn: getPaymentsSettings });

  const isBusiness = vm?.kind === 'business';

  // Bir dona karta narxi — birinchi tarif (1–9 dona) bo'yicha.
  const unitPrice = pricing.data?.tiers?.[0]?.pricePerUnit ?? null;
  const delivery = pricing.data?.delivery;
  const pendingGifts = (gifts.data?.incoming?.length ?? 0) + (gifts.data?.outgoing?.length ?? 0);

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          paddingTop: 10 + insets.top,
          paddingHorizontal: 16,
          paddingBottom: 14,
        }}
      >
        <Text style={[sans(800, 24, 1.2), { color: theme.ink, letterSpacing: -0.48 }]}>
          Home
        </Text>
        {/* Almashtirgich Home'da ham bor — egasining aniq talabi. */}
        <HandleChip
          handle={vm?.handle ?? '@…'}
          bordered
          onPress={() => setSwitcherOpen(true)}
        />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 28, gap: 12 }}
      >
        <ActionCard
          title={isBusiness ? 'Biznes ID faol' : 'Shaxsiy ID faol'}
          meta={vm ? 'FAOL' : '—'}
          sub={
            vm
              ? `${vm.views} ko’rish · ${publicUrl(vm)}`
              : 'ID yuklanmoqda…'
          }
          onPress={vm ? () => openUrl(publicUrl(vm, true)) : undefined}
        />

        <ActionCard
          title={
            isBusiness ? 'Jamoa uchun kartalar buyurtma qilish' : 'Jismoniy karta buyurtma qilish'
          }
          meta={unitPrice != null ? money(unitPrice) : '…'}
          sub={
            delivery
              ? `Rang va uslubni tanlang · ${delivery.minDays}–${delivery.maxDays} kunda yetkazib beriladi`
              : 'Rang va uslubni tanlang'
          }
          onPress={() => openUrl(`${SITE}/karta-dizayni`)}
        />

        {isBusiness ? (
          <ActionCard
            title="Mahsulot qo’shish"
            meta="KATALOG"
            sub={`${vm?.third.value ?? 0} mahsulot faol · nom va narx qo’shing`}
            onPress={
              vm?.companyId ? () => openUrl(`${SITE}/c/${vm.companyId}`) : undefined
            }
          />
        ) : (
          <ActionCard
            title="Havolalarni tahrirlash"
            meta={`${vm?.third.value ?? 0} HAVOLA`}
            sub="Veb-sayt, Telegram, portfolio, kalendar"
            onPress={vm?.code ? () => openUrl(`${SITE}/${vm.code}`) : undefined}
          />
        )}

        <ActionCard
          title={isBusiness ? 'Mijozga ID sovg’a qilish' : 'Do’stga ID sovg’a qilish'}
          meta={pendingGifts > 0 ? `${pendingGifts} KUTILMOQDA` : 'BEPUL'}
          sub={
            pendingGifts > 0
              ? 'Tasdiqlashni kutayotgan sovg’alar bor'
              : 'ID yuboring — qabul qiluvchi tasdiqlaydi'
          }
          onPress={() => openUrl(`${SITE}/gifts`)}
        />

        <ActionCard
          title="To’lovlar"
          meta={payments.data?.providers?.payme?.enabled === false ? 'O’CHIRILGAN' : 'PAYME'}
          sub={paymentsSub(user, payments.data?.sandbox)}
          onPress={() => openUrl(`${SITE}/tolovlar`)}
        />

        {/* Tarif chizig'i — maketda Home'da, ikkala profil turida ham. */}
        <View style={{ gap: 10, marginTop: 2 }}>
          <Text style={[mono(600, 11), { color: theme.a1, letterSpacing: 1.1 }]}>
            YANGI NFC ID
          </Text>
          <TierStrip onPressTier={() => openUrl(`${SITE}/narxlar`)} />
        </View>
      </ScrollView>

      <SwitcherSheet
        visible={switcherOpen}
        onClose={() => setSwitcherOpen(false)}
        accounts={accounts}
        active={active}
        onPick={setActive}
        onCreateCompany={() => openUrl(`${SITE}/business`)}
      />
    </View>
  );
}

function ActionCard({
  title,
  meta,
  sub,
  onPress,
}: {
  title: string;
  meta: string;
  sub: string;
  onPress?: () => void;
}) {
  const { theme } = useTheme();

  return (
    <TapScale
      radius={16}
      onPress={onPress}
      accessibilityLabel={title}
      style={{ borderRadius: 16 }}
    >
      <Card radius={16} style={{ padding: 16, gap: 6 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
          }}
        >
          <Text style={[sans(700, 14, 1.3), { color: theme.ink, flex: 1 }]}>{title}</Text>
          <Text style={[mono(600, 11), { color: theme.a1 }]} numberOfLines={1}>
            {meta}
          </Text>
        </View>
        <Text style={[sans(400, 12, 1.5), { color: 'rgba(255,255,255,.48)' }]}>{sub}</Text>
      </Card>
    </TapScale>
  );
}

/* ── yordamchilar ─────────────────────────────────────────────────── */

function publicUrl(vm: { kind: string; companyId?: string; code?: string }, full = false) {
  const path = vm.kind === 'business' ? `/c/${vm.companyId}` : `/${vm.code}`;
  return full ? `${SITE}${path}` : `nfcstore.uz${path}`;
}

function paymentsSub(
  user: { isPremium?: boolean; premiumExpiresAt?: string | null; trialExpiresAt?: string | null } | null | undefined,
  sandbox?: boolean,
): string {
  const parts: string[] = [];
  if (sandbox) parts.push('TEST REJIMI');

  if (user?.premiumExpiresAt) {
    parts.push(`Premium ${formatDate(user.premiumExpiresAt)} gacha`);
  } else if (user?.isPremium) {
    // Eski bir martalik to'lov — muddatsiz (worker.js dagi izohga qarang).
    parts.push('Premium faol — muddatsiz');
  } else if (user?.trialExpiresAt) {
    parts.push(`Sinov davri ${formatDate(user.trialExpiresAt)} gacha`);
  } else {
    parts.push('Karta ulanmagan');
  }
  return parts.join(' · ');
}

function formatDate(iso: string): string {
  const ts = Date.parse(iso.replace(' ', 'T'));
  if (!Number.isFinite(ts)) return iso;
  return new Date(ts).toLocaleDateString('uz-UZ', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Tashqi havolalar ilova ichidagi brauzerda ochiladi.
 *
 * To'lov oqimi ham shu yo'l bilan: spetsifikatsiya aniq aytadi —
 * Payme/Click mantig'i ILOVADA QURILMAYDI, mavjud checkout havolasi
 * ochiladi (saytdagi naqshning o'zi).
 */
function openUrl(url: string) {
  WebBrowser.openBrowserAsync(url).catch(() => {});
}
