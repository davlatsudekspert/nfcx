import { router } from 'expo-router';
import { type ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { CardSurface } from '@/components/Card';
import { ChevronRight } from '@/components/Glyphs';
import { Photo } from '@/components/Photo';
import { RowSkeleton } from '@/components/Skeleton';
import { TapScale } from '@/components/TapScale';
import { SH } from '@/theme/css';
import { useTheme } from '@/theme/ThemeProvider';
import { mono, sans } from '@/theme/type';

/**
 * Home dagi kontent bo'limlari.
 *
 * Brifdagi talab: "Har bo'lim bir xil grid bo'lib qolmasin. Carousel,
 * large editorial card, horizontal cards va boshqa compositionlardan
 * foydalaning." Shuning uchun bu yerda UCH xil shakl bor:
 *
 *   PortraitRow  — baland vertikal kartalar (odamlar, profillar)
 *   WideRow      — keng gorizontal kartalar (kompaniyalar, yangiliklar)
 *   Sarlavha     — har birining tepasida nom va "hammasi" havolasi
 */

export function SectionHead({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  const { theme } = useTheme();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        marginBottom: 11,
        marginTop: 6,
      }}
    >
      <Text style={[sans(800, 17, 1.2), { color: theme.ink, letterSpacing: -0.34 }]}>
        {title}
      </Text>
      {action ? (
        <TapScale
          radius={8}
          onPress={onAction}
          accessibilityLabel={action}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4, padding: 4 }}
        >
          <Text style={[mono(500, 10.5), { color: theme.a1, letterSpacing: 0.8 }]}>
            {action.toUpperCase()}
          </Text>
          <ChevronRight color={theme.a1} size={13} width={2} />
        </TapScale>
      ) : null}
    </View>
  );
}

export type Tile = {
  key: string;
  title: string;
  sub?: string;
  photo?: string;
  /** Rasm ustidagi kichik yozuv — masalan ID kodi yoki narx. */
  badge?: string;
  href: string;
};

/** Baland vertikal kartalar — odamlar va profillar uchun. */
export function PortraitRow({
  tiles,
  loading,
  empty,
}: {
  tiles: Tile[];
  loading?: boolean;
  empty?: string;
}) {
  const { theme } = useTheme();

  if (loading) return <RowSkeleton count={4} width={132} height={178} />;
  if (!tiles.length) return <EmptyLine text={empty ?? 'Hozircha bo’sh'} />;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 10, paddingHorizontal: 16, paddingVertical: 6 }}
      style={{ marginVertical: -6 }}
    >
      {tiles.map((t) => (
        <TapScale
          key={t.key}
          radius={16}
          onPress={() => router.push(t.href as never)}
          accessibilityLabel={t.title}
          style={[
            {
              width: 132,
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
          <Photo uri={t.photo} width={130} height={122} step={7} />
          <View style={{ padding: 10, gap: 4 }}>
            <Text style={[sans(700, 12.5, 1.25), { color: theme.ink }]} numberOfLines={1}>
              {t.title}
            </Text>
            <Text
              style={[mono(500, 10), { color: theme.a1, letterSpacing: 0.8 }]}
              numberOfLines={1}
            >
              {t.badge ?? t.sub ?? ''}
            </Text>
          </View>
        </TapScale>
      ))}
    </ScrollView>
  );
}

/** Keng gorizontal kartalar — kompaniyalar va yangiliklar uchun. */
export function WideRow({
  tiles,
  loading,
  empty,
}: {
  tiles: Tile[];
  loading?: boolean;
  empty?: string;
}) {
  const { theme } = useTheme();

  if (loading) return <RowSkeleton count={3} width={248} height={126} />;
  if (!tiles.length) return <EmptyLine text={empty ?? 'Hozircha bo’sh'} />;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 10, paddingHorizontal: 16, paddingVertical: 6 }}
      style={{ marginVertical: -6 }}
    >
      {tiles.map((t) => (
        <TapScale
          key={t.key}
          radius={16}
          onPress={() => router.push(t.href as never)}
          accessibilityLabel={t.title}
          style={[
            {
              width: 248,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              padding: 12,
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
          <Photo uri={t.photo} width={58} height={58} radius={29} step={6} />
          <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
            <Text style={[sans(700, 13.5, 1.25), { color: theme.ink }]} numberOfLines={1}>
              {t.title}
            </Text>
            {t.sub ? (
              <Text
                style={[sans(400, 11.5, 1.4), { color: 'rgba(255,255,255,.52)' }]}
                numberOfLines={2}
              >
                {t.sub}
              </Text>
            ) : null}
            {t.badge ? (
              <Text style={[mono(500, 10), { color: theme.a1, letterSpacing: 0.8 }]}>
                {t.badge}
              </Text>
            ) : null}
          </View>
        </TapScale>
      ))}
    </ScrollView>
  );
}

function EmptyLine({ text }: { text: string }) {
  const { theme } = useTheme();
  return (
    <Text
      style={[
        sans(500, 12, 1.5),
        { color: theme.off, paddingHorizontal: 16, paddingVertical: 10 },
      ]}
    >
      {text}
    </Text>
  );
}

/** Tez amallar qatori — QR, kontaktlar, statistika va h.k. */
export function QuickActions({
  items,
}: {
  items: { key: string; label: string; icon: ReactNode; onPress: () => void }[];
}) {
  const { theme } = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 9, paddingHorizontal: 16, paddingVertical: 6 }}
      style={{ marginVertical: -6 }}
    >
      {items.map((it) => (
        <TapScale
          key={it.key}
          radius={14}
          onPress={it.onPress}
          accessibilityLabel={it.label}
          style={[
            {
              alignItems: 'center',
              gap: 8,
              width: 84,
              paddingVertical: 13,
              paddingHorizontal: 8,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: theme.rim,
              backgroundColor: theme.c2,
              overflow: 'hidden',
            },
            SH.cardTight(theme.a2),
          ]}
        >
          <CardSurface />
          {it.icon}
          <Text
            style={[sans(600, 10.5), { color: 'rgba(255,255,255,.72)' }]}
            numberOfLines={1}
          >
            {it.label}
          </Text>
        </TapScale>
      ))}
    </ScrollView>
  );
}
