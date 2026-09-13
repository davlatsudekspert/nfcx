import { LinearGradient } from 'expo-linear-gradient';
import { useRef, useState } from 'react';
import {
  ScrollView,
  Text,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { GoldSweep } from '@/components/GoldSweep';
import { NfcGlyph } from '@/components/Glyphs';
import { Photo } from '@/components/Photo';
import { TapScale } from '@/components/TapScale';
import { tapSelect } from '@/lib/haptics';
import type { AccountEntry } from '@/features/profile/useProfileData';
import { A135, A140, alpha, SH } from '@/theme/css';
import { useTheme } from '@/theme/ThemeProvider';
import { mono, sans } from '@/theme/type';
import { type ActiveId } from '@/store/activeIdStore';

const GAP = 12;
const SIDE = 16;

/**
 * HERO KARUSEL — foydalanuvchining NFC ID kartalari.
 *
 * Brifdagi talab: "Agar userda bir nechta profile/NFC ID bo'lsa:
 * horizontal swipe orqali almashtirish mumkin".
 *
 * Ishlashi: karta kengligi ekranga qarab hisoblanadi va `snapToInterval`
 * bilan har bir surish aynan bitta kartaga to'xtaydi. Surish TUGAGACH
 * o'sha ID faol bo'ladi — har bir piksel harakatida emas, aks holda
 * butun ilova surish davomida qayta-qayta yuklanardi.
 *
 * Karta ko'rinishi metall NFC kartaga o'xshatilgan: oltin ramka,
 * gradient yuza va ustidan sekin o'tadigan yorug'lik.
 */
export function HeroCarousel({
  accounts,
  activeKey,
  onPick,
  onOpen,
}: {
  accounts: AccountEntry[];
  activeKey: string | null;
  onPick: (id: ActiveId) => void;
  onOpen: () => void;
}) {
  const { width } = useWindowDimensions();
  const cardW = width - SIDE * 2;
  const scroller = useRef<ScrollView>(null);
  const [index, setIndex] = useState(() =>
    Math.max(0, accounts.findIndex((a) => a.key === activeKey)),
  );

  if (!accounts.length) return null;

  const onEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / (cardW + GAP));
    const clamped = Math.min(Math.max(i, 0), accounts.length - 1);
    if (clamped === index) return;
    setIndex(clamped);
    tapSelect();
    onPick(accounts[clamped].id);
  };

  return (
    <View style={{ gap: 10 }}>
      <ScrollView
        ref={scroller}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={cardW + GAP}
        decelerationRate="fast"
        disableIntervalMomentum
        contentContainerStyle={{ paddingHorizontal: SIDE, gap: GAP }}
        onMomentumScrollEnd={onEnd}
        contentOffset={{ x: index * (cardW + GAP), y: 0 }}
      >
        {accounts.map((a) => (
          <HeroCard key={a.key} account={a} width={cardW} onPress={onOpen} />
        ))}
      </ScrollView>

      {accounts.length > 1 ? (
        <Dots count={accounts.length} index={index} />
      ) : null}
    </View>
  );
}

function HeroCard({
  account,
  width,
  onPress,
}: {
  account: AccountEntry;
  width: number;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const ink = theme.onAccent;

  return (
    <TapScale
      radius={20}
      onPress={onPress}
      pulseColor={theme.a1}
      accessibilityLabel={`${account.name} profilini ochish`}
      style={[
        {
          width,
          borderRadius: 20,
          padding: 2,
          backgroundColor: theme.a2,
          overflow: 'hidden',
        },
        SH.hero(),
      ]}
    >
      {/* Oltin ramka */}
      <LinearGradient
        colors={[theme.a1, theme.a2, theme.a1]}
        locations={[0, 0.7, 1]}
        start={A140.start}
        end={A140.end}
        pointerEvents="none"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      <View
        style={{
          borderRadius: 18,
          overflow: 'hidden',
          padding: 18,
          gap: 16,
          backgroundColor: theme.a2,
        }}
      >
        <LinearGradient
          colors={[theme.a1, theme.a2]}
          start={A135.start}
          end={A135.end}
          pointerEvents="none"
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
        <GoldSweep duration={5200} radius={18} band={0.34} intensity={0.45} />

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Photo
            uri={account.photoUrl}
            width={44}
            height={44}
            radius={14}
            step={5}
          />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              style={[mono(500, 10), { color: alpha(ink, 0.6), letterSpacing: 1.4 }]}
            >
              {account.kind === 'Business' ? 'BIZNES ID' : 'SHAXSIY ID'}
            </Text>
            <Text
              style={[sans(800, 19, 1.2), { color: ink, marginTop: 4 }]}
              numberOfLines={1}
            >
              {account.name}
            </Text>
          </View>
          <NfcGlyph color={alpha(ink, 0.5)} size={26} />
        </View>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
          }}
        >
          <Text
            style={[mono(600, 15), { color: ink, letterSpacing: 2.2 }]}
            numberOfLines={1}
          >
            {account.handle.replace('@', '').toUpperCase()}
          </Text>
          <Text style={[mono(400, 9.5), { color: alpha(ink, 0.6), letterSpacing: 1 }]}>
            NFCSTORE
          </Text>
        </View>
      </View>
    </TapScale>
  );
}

/** Karusel ostidagi nuqtalar — nechta karta borligi va qaysi biri faolligi. */
function Dots({ count, index }: { count: number; index: number }) {
  const { theme } = useTheme();
  return (
    <View
      style={{ flexDirection: 'row', gap: 5, justifyContent: 'center', paddingTop: 2 }}
    >
      {Array.from({ length: count }, (_, i) => (
        <View
          key={i}
          style={{
            width: i === index ? 16 : 5,
            height: 5,
            borderRadius: 3,
            backgroundColor: i === index ? theme.a1 : 'rgba(255,255,255,.18)',
          }}
        />
      ))}
    </View>
  );
}
