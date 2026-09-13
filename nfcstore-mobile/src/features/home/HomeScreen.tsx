import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useMemo, useState } from 'react';
import { ScrollView, Share, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  getCatalogRecords,
  getGiftOffers,
  getPublicCompanies,
} from '@/api/endpoints';
import { CardSurface } from '@/components/Card';
import { CardGlyph, GiftGlyph, LinkGlyph, PlusGlyph } from '@/components/Glyphs';
import { AccountChip } from '@/components/ScreenHeader';
import { Photo } from '@/components/Photo';
import { usePullToRefresh } from '@/components/Refreshing';
import { TapScale } from '@/components/TapScale';
import { QrGlyph } from '@/features/nfc/QrGlyph';
import { SITE } from '@/features/profile/profileVM';
import { SwitcherSheet } from '@/features/profile/sheets/SwitcherSheet';
import { StoriesRow } from '@/features/profile/StoriesRow';
import { useProfileData } from '@/features/profile/useProfileData';
import { tapLight } from '@/lib/haptics';
import { useActiveIdStore } from '@/store/activeIdStore';
import { SH } from '@/theme/css';
import { useTheme } from '@/theme/ThemeProvider';
import { mono, sans } from '@/theme/type';

import { HeroCarousel } from './HeroCarousel';
import { PortraitRow, QuickActions, SectionHead, WideRow, type Tile } from './Sections';

/**
 * HOME — rasmga boy bosh ekran.
 *
 * Tuzilish (brif 5-bo'lim):
 *   yuqori qator   -> avatar + ism + hisob chipi
 *   HERO karusel   -> foydalanuvchining NFC ID kartalari, surib almashadi
 *   STORIES        -> obuna bo'lganlarning istoryalari
 *   QUICK ACTIONS  -> QR, havolalar, sovg'a, jismoniy karta
 *   bo'limlar      -> Yangi profillar / Kompaniyalar / Ekspertlar
 *
 * HAMMASI JONLI API DAN:
 *   ID kartalari   -> /auth/me + /companies/mine
 *   istoryalar     -> /stories/feed
 *   profillar      -> /records   (katalogdagi ochiq profillar)
 *   kompaniyalar   -> /companies (faqat faol)
 *   sovg'alar      -> /gift-offers
 *
 * NFC o'qish kartasi bu ekrandan OLIB TASHLANDI — u endi o'z tabiga
 * ega (NFC Center). Home ikki joyda bir xil narsani ko'rsatmaydi.
 */
export function HomeScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const setActive = useActiveIdStore((s) => s.setActive);

  const { vm, accounts, active, loading } = useProfileData();
  const [switcherOpen, setSwitcherOpen] = useState(false);

  const records = useQuery({ queryKey: ['catalog', 'records'], queryFn: getCatalogRecords });
  const companies = useQuery({ queryKey: ['catalog', 'companies'], queryFn: getPublicCompanies });
  const gifts = useQuery({ queryKey: ['gift-offers'], queryFn: getGiftOffers });

  const refresh = usePullToRefresh([
    ['me'],
    ['companies', 'mine'],
    ['stories', 'feed'],
    ['catalog', 'records'],
    ['catalog', 'companies'],
    ['gift-offers'],
  ]);

  const activeKey =
    active?.kind === 'business'
      ? `business:${active.companyId}`
      : active?.kind === 'personal'
        ? `personal:${active.code}`
        : null;

  // Eng yangi profillar — `ts` bo'yicha, katalogdagi ochiq yozuvlardan.
  const newProfiles = useMemo<Tile[]>(() => {
    const list = [...(records.data ?? [])].sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0));
    return list.slice(0, 12).map((r) => ({
      key: r.code,
      title: r.name || r.code,
      badge: r.code,
      photo: r.avatarUrl,
      href: `/p/${r.code}`,
    }));
  }, [records.data]);

  // Ekspertlar — profil turi bo'yicha ajratiladi.
  const experts = useMemo<Tile[]>(
    () =>
      (records.data ?? [])
        .filter((r) => r.profileType === 'expert')
        .slice(0, 12)
        .map((r) => ({
          key: r.code,
          title: r.name || r.code,
          sub: r.role || undefined,
          badge: r.city || undefined,
          photo: r.avatarUrl,
          href: `/p/${r.code}`,
        })),
    [records.data],
  );

  const companyTiles = useMemo<Tile[]>(
    () =>
      (companies.data ?? []).slice(0, 12).map((c) => ({
        key: c.companyId,
        title: c.displayName || c.companyId,
        sub: [c.category, c.city].filter(Boolean).join(' · ') || undefined,
        photo: c.logoUrl,
        href: `/c/${c.companyId}`,
      })),
    [companies.data],
  );

  const pendingGifts =
    (gifts.data?.incoming?.length ?? 0) + (gifts.data?.outgoing?.length ?? 0);

  const shareUrl = vm?.shareUrl ?? SITE;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      {/* Yuqori qator: kim kirgan + hisob chipi. Sarlavha yo'q —
          brifdagi talab: Home dashboard emas, tirik lenta bo'lsin. */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 11,
          paddingTop: 10 + insets.top,
          paddingHorizontal: 16,
          paddingBottom: 14,
        }}
      >
        <Photo uri={vm?.photoUrl} width={40} height={40} radius={20} step={5} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[mono(500, 10), { color: 'rgba(255,255,255,.42)', letterSpacing: 1.1 }]}>
            XUSH KELIBSIZ
          </Text>
          <Text
            style={[sans(800, 17, 1.2), { color: theme.ink, letterSpacing: -0.34, marginTop: 3 }]}
            numberOfLines={1}
          >
            {vm?.name ?? '…'}
          </Text>
        </View>
        <AccountChip handle={vm?.handle ?? '@…'} onPress={() => setSwitcherOpen(true)} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={refresh}
        contentContainerStyle={{ paddingBottom: 28, gap: 4 }}
      >
        <HeroCarousel
          accounts={accounts}
          activeKey={activeKey}
          onPick={setActive}
          onOpen={() => router.push('/(tabs)/profile')}
        />

        <View style={{ height: 14 }} />
        <StoriesRow />

        <QuickActions
          items={[
            {
              key: 'qr',
              label: 'Ulashish',
              icon: <QrGlyph color={theme.a1} size={21} />,
              onPress: () => {
                tapLight();
                Share.share({
                  message: `${vm?.name ?? 'NFCSTORE'} — ${shareUrl}`,
                  url: shareUrl,
                }).catch(() => {});
              },
            },
            {
              key: 'edit',
              label: 'Havolalar',
              icon: <LinkGlyph color={theme.a1} size={21} />,
              onPress: () =>
                vm?.code
                  ? router.push(`/edit/${vm.code}`)
                  : router.push('/(tabs)/profile'),
            },
            {
              key: 'buy',
              label: 'Yangi ID',
              icon: <PlusGlyph color={theme.a1} size={19} width={2} />,
              onPress: () => router.push('/buy'),
            },
            {
              key: 'gift',
              label: pendingGifts > 0 ? `Sovg’a ${pendingGifts}` : 'Sovg’a',
              icon: <GiftGlyph color={theme.a1} size={21} />,
              onPress: () =>
                WebBrowser.openBrowserAsync(`${SITE}/gifts`).catch(() => {}),
            },
            {
              key: 'card',
              label: 'Karta',
              icon: <CardGlyph color={theme.a1} size={21} />,
              onPress: () =>
                WebBrowser.openBrowserAsync(`${SITE}/karta-dizayni`).catch(() => {}),
            },
          ]}
        />

        <View style={{ height: 16 }} />

        <SectionHead
          title="Yangi profillar"
          action="Hammasi"
          onAction={() => router.push('/(tabs)/katalog')}
        />
        <PortraitRow
          tiles={newProfiles}
          loading={records.isLoading}
          empty="Katalog hozircha bo’sh"
        />

        <View style={{ height: 18 }} />

        <SectionHead
          title="Kompaniyalar"
          action="Hammasi"
          onAction={() => router.push('/(tabs)/katalog')}
        />
        <WideRow
          tiles={companyTiles}
          loading={companies.isLoading}
          empty="Faol kompaniya yo’q"
        />

        {experts.length ? (
          <>
            <View style={{ height: 18 }} />
            <SectionHead title="Ekspertlar" />
            <WideRow tiles={experts} />
          </>
        ) : null}

        <View style={{ height: 18 }} />
        <SectionHead title="NFCSTORE" />
        <PromoCard
          onPress={() => router.push('/buy')}
          loading={loading && !accounts.length}
        />
      </ScrollView>

      <SwitcherSheet
        visible={switcherOpen}
        onClose={() => setSwitcherOpen(false)}
        accounts={accounts}
        active={active}
        onPick={setActive}
      />
    </View>
  );
}

/**
 * Katta "muharrirlik" kartasi — bo'limlar bir xil grid bo'lib
 * qolmasligi uchun (brifdagi "large editorial card").
 */
function PromoCard({ onPress, loading }: { onPress: () => void; loading?: boolean }) {
  const { theme } = useTheme();

  return (
    <View style={{ paddingHorizontal: 16 }}>
      <TapScale
        radius={18}
        onPress={loading ? undefined : onPress}
        pulseColor={theme.a1}
        accessibilityLabel="Yangi NFC ID olish"
        style={[
          {
            borderRadius: 18,
            padding: 18,
            gap: 8,
            borderWidth: 1,
            borderColor: theme.rim,
            backgroundColor: theme.c2,
            overflow: 'hidden',
          },
          SH.card(theme.a2),
        ]}
      >
        <CardSurface />
        <Text style={[mono(500, 10), { color: theme.a1, letterSpacing: 1.4 }]}>
          YANGI NFC ID
        </Text>
        <Text style={[sans(800, 21, 1.2), { color: theme.ink, letterSpacing: -0.42 }]}>
          O’zingizga yoqqan kodni band qiling
        </Text>
        <Text style={[sans(400, 12.5, 1.5), { color: 'rgba(255,255,255,.52)' }]}>
          Qisqa va yodda qoladigan NFC ID — bir marta olinadi, umrbod
          sizniki bo’lib qoladi.
        </Text>
      </TapScale>
    </View>
  );
}
