import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { getMe, getMyCompanies } from '@/api/endpoints';
import type { Card as CardRecord, Company } from '@/api/types';
import { Card } from '@/components/Card';
import { StripeFill } from '@/components/StripeFill';
import { TapScale } from '@/components/TapScale';
import { HandleChip } from '@/features/profile/header/ActionButtons';
import { personalVerified } from '@/features/profile/header/Badges';
import { SwitcherSheet } from '@/features/profile/sheets/SwitcherSheet';
import { SITE } from '@/features/profile/profileVM';
import { useProfileData } from '@/features/profile/useProfileData';
import { compactCount } from '@/lib/format';
import { useActiveIdStore } from '@/store/activeIdStore';
import { useTheme } from '@/theme/ThemeProvider';
import { mono, sans } from '@/theme/type';

import { NfcScanCard } from './NfcScanCard';
import { TierMedal, TierStrip } from './TierStrip';
import { NFC_TIERS } from './nfcTiers';

/**
 * NFC Markazi (NFC Center) — `design_handoff_nfcstore_app` spetsifikatsiyasi:
 * "NFC sits centre and reads as the product core."
 *
 * Bu ekranda faqat HAQIQIY, allaqachon backend'dan kelayotgan ma'lumot:
 *
 *   • NFC o'qish        — `NfcScanCard` (avval Home'da edi, endi bu yerda —
 *                          takrorlanmaydi, ko'chirilgan)
 *   • Mening ID'larim   — `GET /api/auth/me` (`cards[]`) + `GET /api/companies/mine`,
 *                          har biri o'zining HAQIQIY detail ekraniga olib boradi:
 *                          shaxsiy — `/p/[code]`, biznes — `/c/[companyId]`
 *                          (bular allaqachon mavjud, real, owner-aware ekranlar —
 *                          shuning uchun alohida "ID detail" ekrani QURILMADI,
 *                          takrorlanish oldini olindi)
 *   • Yangi NFC ID      — tarif jadvali (`NFC_TIERS`, haqiqiy narxlar), xarid
 *                          haqiqiy `${SITE}/narxlar` sahifasida (mobil-native
 *                          bandlash endpointi yo'q — pastdagi izohga qarang)
 *
 * QURILMAGAN (MISSING BACKEND CAPABILITY, pastga qarang izoh uchun):
 *   • Vizual QR-kod chizish — loyihada QR kutubxonasi yo'q, fake/ishlamaydigan
 *     rasm chizib qo'yilmadi. Ulashish (`Share.share`, haqiqiy) allaqachon
 *     `/p/[code]` va `/c/[companyId]` ekranlarida bor (`ActionButtons.tsx`).
 *   • Jismoniy chip boshqaruvi (`/api/my/nfc-devices`) va oluvchi tomonidan
 *     sovg'ani faollashtirish (`/api/nfc-gifts/:code/*`) — bular faqat
 *     `server/index.js` (Express/Postgres) da bor, lekin haqiqiy production
 *     backend — `hosting/worker.js` (Cloudflare Worker, `nfcstore.uz/api`)
 *     da YO'Q. Shuning uchun ilovaga ulanmadi.
 */
export function NfcTabScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const setActive = useActiveIdStore((s) => s.setActive);

  const { vm, accounts, active } = useProfileData();
  const [switcherOpen, setSwitcherOpen] = useState(false);

  // `useProfileData` faqat FAOL ID uchun to'liq ma'lumot oladi. Bu yerda
  // BARCHA egalik qilingan ID'lar uchun haqiqiy ko'rinish (tier/views/
  // followers) kerak, shuning uchun xom ro'yxatlar to'g'ridan-to'g'ri
  // o'qiladi — bir xil `queryKey` tufayli React Query keshi baribir
  // umumiy (qo'shimcha tarmoq so'rovi yo'q).
  const meQuery = useQuery({ queryKey: ['me'], queryFn: getMe });
  const companiesQuery = useQuery({ queryKey: ['companies', 'mine'], queryFn: getMyCompanies });

  const cards = meQuery.data?.cards ?? [];
  const companies = companiesQuery.data ?? [];
  const loadingIds = meQuery.isLoading || companiesQuery.isLoading;

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
          NFC
        </Text>
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
        <NfcScanCard />

        <TapScale
          radius={16}
          onPress={() => router.push('/nfc/qr')}
          accessibilityLabel="QR kod va ulashish"
          style={{ borderRadius: 16 }}
        >
          <Card
            radius={16}
            style={{
              padding: 16,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                backgroundColor: 'rgba(201,204,210,.08)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <QrGlyph color={theme.platinum} />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[sans(700, 13.5), { color: theme.ink }]}>QR va ulashish</Text>
              <Text style={[sans(400, 11.5, 1.4), { color: theme.ash }]}>
                {vm ? `${vm.handle} — faol ID` : 'Faol ID uchun QR kod'}
              </Text>
            </View>
            <ChevronIcon />
          </Card>
        </TapScale>

        <Text style={[mono(600, 11), { color: theme.platinum, letterSpacing: 1.1 }]}>
          MENING ID&apos;LARIM
        </Text>

        {loadingIds && !cards.length && !companies.length ? (
          <View style={{ paddingVertical: 24, alignItems: 'center' }}>
            <ActivityIndicator color={theme.platinum} />
          </View>
        ) : null}

        {companies.map((company) => (
          <BusinessIdRow key={company.companyId} company={company} />
        ))}

        {cards.map((card) => (
          <PersonalIdRow key={card.code} card={card} />
        ))}

        {!loadingIds && !cards.length && !companies.length ? (
          <Text style={[sans(500, 12.5, 1.5), { color: theme.off }]}>
            Hozircha ID yo’q.
          </Text>
        ) : null}

        <Text style={[mono(600, 11), { color: theme.a1, letterSpacing: 1.1, marginTop: 6 }]}>
          YANGI NFC ID
        </Text>
        <TierStrip
          onPressTier={() => WebBrowser.openBrowserAsync(`${SITE}/narxlar`).catch(() => {})}
        />
      </ScrollView>

      <SwitcherSheet
        visible={switcherOpen}
        onClose={() => setSwitcherOpen(false)}
        accounts={accounts}
        active={active}
        onPick={setActive}
        onCreateCompany={() => WebBrowser.openBrowserAsync(`${SITE}/business`).catch(() => {})}
      />
    </View>
  );
}

/**
 * Biznes ID qatori — `GET /api/companies/mine` dan HAQIQIY: nom, ID kod,
 * tarif (`company.tier` — backend'da bor), ko'rishlar va obunachilar.
 * Bosilganda mavjud, real `/c/[companyId]` detail ekraniga o'tadi (owner
 * bo'lgani uchun u yerda Dashboard/Profilni tahrirlash/Ulashish chiqadi).
 */
function BusinessIdRow({ company }: { company: Company }) {
  const { theme } = useTheme();
  const tier = NFC_TIERS.find((t) => t.key === company.tier);

  return (
    <TapScale
      radius={16}
      onPress={() => router.push(`/c/${company.companyId}`)}
      accessibilityLabel={`${company.displayName} — ID detali`}
      style={{ borderRadius: 16 }}
    >
      <Card radius={16} style={{ padding: 16, gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {company.logoUrl ? (
            <Image
              source={{ uri: company.logoUrl }}
              contentFit="cover"
              style={{ width: 44, height: 44, borderRadius: 12 }}
            />
          ) : (
            <StripeFill
              step={6}
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                overflow: 'hidden',
                borderWidth: 1,
                borderColor: theme.rim,
              }}
            />
          )}
          <View style={{ flex: 1, gap: 5, minWidth: 0 }}>
            <Text style={[sans(700, 14, 1.25), { color: theme.ink }]} numberOfLines={1}>
              {company.displayName || company.companyId}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
              <Text style={[mono(500, 11), { color: theme.platinum, letterSpacing: 0.7 }]}>
                {company.companyId}
              </Text>
              {tier ? <TierMedal m1={tier.m1} m2={tier.m2} /> : null}
            </View>
          </View>
          <ChevronIcon />
        </View>
        <Text style={[sans(400, 12, 1.45), { color: theme.ash }]}>
          {compactCount(company.views)} ko’rish · {compactCount(company.followers)} obunachi
        </Text>
      </Card>
    </TapScale>
  );
}

/**
 * Shaxsiy ID qatori — `GET /api/auth/me` (`cards[]`) dan HAQIQIY. Tarif
 * ko'rsatilmaydi: `Card` javobida `tier` maydoni yo'q (faqat `Company`da
 * bor) — bu MISSING BACKEND CAPABILITY, pastdagi hisobotga qarang.
 * Tasdiqlangan nishon `card.verified` dan — backend'dan, hech qachon
 * qattiq yozilmagan.
 */
function PersonalIdRow({ card }: { card: CardRecord }) {
  const { theme } = useTheme();
  const verified = personalVerified(card);

  return (
    <TapScale
      radius={16}
      onPress={() => router.push(`/p/${card.code}`)}
      accessibilityLabel={`${card.name || card.code} — ID detali`}
      style={{ borderRadius: 16 }}
    >
      <Card radius={16} style={{ padding: 16, gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {card.avatarUrl ? (
            <Image
              source={{ uri: card.avatarUrl }}
              contentFit="cover"
              style={{ width: 44, height: 44, borderRadius: 22 }}
            />
          ) : (
            <StripeFill
              step={6}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                overflow: 'hidden',
                borderWidth: 1,
                borderColor: theme.rim,
              }}
            />
          )}
          <View style={{ flex: 1, gap: 5, minWidth: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text
                style={[sans(700, 14, 1.25), { color: theme.ink, flexShrink: 1 }]}
                numberOfLines={1}
              >
                {card.name || card.code}
              </Text>
              {verified ? <VerifiedDot /> : null}
            </View>
            <Text style={[mono(500, 11), { color: theme.platinum, letterSpacing: 0.7 }]}>
              {card.code}
            </Text>
          </View>
          <ChevronIcon />
        </View>
        <Text style={[sans(400, 12, 1.45), { color: theme.ash }]}>
          {compactCount(card.views)} ko’rish{card.isPrimary ? ' · asosiy' : ''}
        </Text>
      </Card>
    </TapScale>
  );
}

function VerifiedDot() {
  const { theme } = useTheme();
  return (
    <Svg width={13} height={13} viewBox="0 0 24 24">
      <Path
        d="M12 2.5l2.4 2.1 3.1-.5 1 3 2.6 1.8-1 3 1 3-2.6 1.8-1 3-3.1-.5L12 21.5l-2.4-2.1-3.1.5-1-3-2.6-1.8 1-3-1-3 2.6-1.8 1-3 3.1.5L12 2.5z"
        fill={theme.platinum}
      />
      <Path
        d="M8.7 12.3l2 2 4.6-4.8"
        stroke={theme.bg}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

function QrGlyph({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Path
        d="M4 4h6v6H4V4zM4 14h6v6H4v-6zM14 4h6v6h-6V4zM14 14h2.5v2.5H14V14zM17.5 14H20v2.5h-2.5V14zM14 17.5h2.5V20H14v-2.5zM17.5 17.5H20V20h-2.5v-2.5z"
        stroke={color}
        strokeWidth={1.3}
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

function ChevronIcon() {
  const { theme } = useTheme();
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24">
      <Path
        d="M8.5 12h7M12.5 8.5l3.5 3.5-3.5 3.5"
        stroke={theme.a2}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}
