import { Share, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { ScrollView } from 'react-native';

import { CardSurface } from '@/components/Card';
import {
  CardGlyph,
  CheckCircleGlyph,
  GiftGlyph,
  LinkGlyph,
  PlusGlyph,
} from '@/components/Glyphs';
import { IconCircle } from '@/components/IconCircle';
import { Photo } from '@/components/Photo';
import { usePullToRefresh } from '@/components/Refreshing';
import { ScreenHeader, SectionDivider } from '@/components/ScreenHeader';
import { CardSkeleton } from '@/components/Skeleton';
import { TapScale } from '@/components/TapScale';
import { NfcScanCard } from '@/features/nfc/NfcScanCard';
import { SITE } from '@/features/profile/profileVM';
import { SwitcherSheet } from '@/features/profile/sheets/SwitcherSheet';
import { useProfileData } from '@/features/profile/useProfileData';
import { tapLight } from '@/lib/haptics';
import { useActiveIdStore, type ActiveId } from '@/store/activeIdStore';
import { SH } from '@/theme/css';
import { useTheme } from '@/theme/ThemeProvider';
import { mono, sans } from '@/theme/type';
import { useState } from 'react';

import { QrGlyph } from './QrGlyph';

/**
 * NFC CENTER — alohida tab.
 *
 * NFC o'qish ilovaning asosiy vazifasi, shuning uchun u Home dagi
 * bitta karta emas, o'z bo'limiga ega:
 *
 *   • kartani o'qish (hero)
 *   • MENING ID'LARIM — barcha shaxsiy va biznes ID lar, faolini
 *     tanlash shu yerdan
 *   • profilni ulashish (QR / havola)
 *   • yangi ID sotib olish, sovg'a qilish, jismoniy karta
 *
 * Ro'yxat `useProfileData()` dan keladi — almashtirgich bilan BIR XIL
 * manba, ya'ni ikki joyda ikki xil ro'yxat ko'rinib qolmaydi.
 */
export function NfcCenterScreen() {
  const { theme } = useTheme();
  const { vm, accounts, active, loading } = useProfileData();
  const setActive = useActiveIdStore((s) => s.setActive);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const refresh = usePullToRefresh([['me'], ['companies', 'mine']]);

  const shareUrl = vm?.shareUrl ?? SITE;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScreenHeader
        title="NFC"
        sub="Kartani o’qing va ID’laringizni boshqaring"
        handle={vm?.handle ?? '@…'}
        onOpenSwitcher={() => setSwitcherOpen(true)}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={refresh}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 12 }}
      >
        <NfcScanCard />

        <SectionDivider label="MENING ID’LARIM" />

        {loading && !accounts.length ? (
          <CardSkeleton rows={3} />
        ) : (
          accounts.map((a) => (
            <IdRow
              key={a.key}
              name={a.name}
              handle={a.handle}
              kind={a.kind}
              photoUrl={a.photoUrl}
              active={isSame(a.id, active)}
              onPress={() => {
                tapLight();
                setActive(a.id);
              }}
            />
          ))
        )}

        <TapScale
          radius={16}
          onPress={() => router.push('/buy')}
          pulseColor={theme.a1}
          accessibilityLabel="Yangi NFC ID sotib olish"
          style={[
            {
              flexDirection: 'row',
              alignItems: 'center',
              gap: 14,
              padding: 15,
              borderRadius: 16,
              borderWidth: 1,
              borderStyle: 'dashed',
              borderColor: theme.a2,
              backgroundColor: theme.bg,
            },
            { boxShadow: `0px 8px 20px rgba(0, 0, 0, 0.4), 0px 0px 18px -6px ${theme.a2}` },
          ]}
        >
          <IconCircle>
            <PlusGlyph color={theme.a1} size={17} width={2} />
          </IconCircle>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[sans(700, 15.5, 1.3), { color: theme.ink }]}>
              Yangi NFC ID olish
            </Text>
            <Text style={[sans(400, 12, 1.45), { color: 'rgba(255,255,255,.52)' }]}>
              O’zingizga yoqqan kodni band qiling
            </Text>
          </View>
        </TapScale>

        <SectionDivider label="AMALLAR" />

        <ActionRow
          icon={<QrGlyph color={theme.a1} size={19} />}
          title="Profilni ulashish"
          sub={vm ? vm.shareUrl.replace(/^https?:\/\//, '') : '—'}
          onPress={() => {
            tapLight();
            Share.share({
              message: `${vm?.name ?? 'NFCSTORE'} — ${shareUrl}`,
              url: shareUrl,
            }).catch(() => {});
          }}
        />

        <ActionRow
          icon={<CheckCircleGlyph color="#63d694" />}
          tint="#63d694"
          title="Faol ID holati"
          sub={vm ? `${vm.views} marta o’qildi` : 'Yuklanmoqda…'}
          onPress={vm ? () => WebBrowser.openBrowserAsync(shareUrl).catch(() => {}) : undefined}
        />

        <ActionRow
          icon={<LinkGlyph color={theme.a1} />}
          title="Profilni tahrirlash"
          sub="Ism, telefon, ijtimoiy tarmoqlar"
          onPress={vm?.code ? () => router.push(`/edit/${vm.code}`) : undefined}
        />

        <ActionRow
          icon={<GiftGlyph color={theme.a1} />}
          title="ID sovg’a qilish"
          sub="Qabul qiluvchi tasdiqlashi kerak"
          onPress={() => WebBrowser.openBrowserAsync(`${SITE}/gifts`).catch(() => {})}
        />

        <ActionRow
          icon={<CardGlyph color={theme.a1} />}
          title="Jismoniy karta buyurtma qilish"
          sub="Chop etilgan NFC karta, 200 000 so’m"
          onPress={() => WebBrowser.openBrowserAsync(`${SITE}/karta-dizayni`).catch(() => {})}
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

/** Bitta ID qatori — bosilganda o'sha ID faol bo'ladi. */
function IdRow({
  name,
  handle,
  kind,
  photoUrl,
  active,
  onPress,
}: {
  name: string;
  handle: string;
  kind: 'Personal' | 'Business';
  photoUrl?: string;
  active: boolean;
  onPress: () => void;
}) {
  const { theme } = useTheme();

  return (
    <TapScale
      radius={16}
      onPress={onPress}
      pulseColor={theme.a1}
      accessibilityLabel={`${name} — faol qilish`}
      accessibilityState={{ selected: active }}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
          padding: 15,
          borderRadius: 16,
          borderWidth: active ? 1.5 : 1,
          borderColor: active ? theme.a2 : theme.rim,
          backgroundColor: theme.c2,
          overflow: 'hidden',
        },
        SH.card(theme.a2),
      ]}
    >
      <CardSurface />
      <Photo uri={photoUrl} width={46} height={46} radius={23} step={5} />

      <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
        <Text style={[sans(700, 15.5, 1.3), { color: theme.ink }]} numberOfLines={1}>
          {name}
        </Text>
        <Text style={[mono(500, 11), { color: 'rgba(255,255,255,.52)' }]} numberOfLines={1}>
          {handle} · {kind === 'Business' ? 'Biznes' : 'Shaxsiy'}
        </Text>
      </View>

      {active ? (
        <Text style={[mono(600, 9.5), { color: theme.a1, letterSpacing: 0.76 }]}>FAOL</Text>
      ) : null}
    </TapScale>
  );
}

function ActionRow({
  icon,
  tint,
  title,
  sub,
  onPress,
}: {
  icon: React.ReactNode;
  tint?: string;
  title: string;
  sub: string;
  onPress?: () => void;
}) {
  const { theme } = useTheme();

  return (
    <TapScale
      radius={16}
      onPress={onPress}
      accessibilityLabel={title}
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
        SH.card(theme.a2),
      ]}
    >
      <CardSurface />
      <IconCircle tint={tint}>{icon}</IconCircle>
      <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
        <Text style={[sans(700, 15.5, 1.3), { color: theme.ink }]} numberOfLines={1}>
          {title}
        </Text>
        <Text
          style={[sans(400, 12, 1.45), { color: 'rgba(255,255,255,.52)' }]}
          numberOfLines={1}
        >
          {sub}
        </Text>
      </View>
    </TapScale>
  );
}

function isSame(a: ActiveId, b: ActiveId | null): boolean {
  if (!b) return false;
  if (a.kind === 'business' && b.kind === 'business') return a.companyId === b.companyId;
  if (a.kind === 'personal' && b.kind === 'personal') return a.code === b.code;
  return false;
}
