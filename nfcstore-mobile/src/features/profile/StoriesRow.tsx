import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { getStoriesFeed } from '@/api/endpoints';
import type { StoryAuthor } from '@/api/types';
import { ShimmerRing } from '@/components/ShimmerRing';
import { StripeFill } from '@/components/StripeFill';
import { TapScale } from '@/components/TapScale';
import { mediaUrl } from '@/lib/media';
import { SH } from '@/theme/css';
import { useTheme } from '@/theme/ThemeProvider';
import { sans } from '@/theme/type';

const ITEM = 62;
const RING = 58;
/** Maketdagi `padding: 2.5px` — halqa va avatar orasidagi bo'shliq. */
const BAND = 2.5;

/**
 * ISTORYA QATORI — profil ekranidagi gorizontal dumaloqchalar.
 *
 *   gorizontal skroll, gap 14, padding 2px 16px 16px
 *   element 62px, halqa 58px, padding 2.5px
 *   ko'rilmagan: tovlanuvchi gold conic (`shimmerSpin 11s linear`)
 *                + `0 0 14px -4px #f0cf7a`
 *   ko'rilgan:   kulrang conic, `opacity .55`
 *   ichida: `#0a0805` bo'shliq halqasi, so'ng avatar
 *   nom: 9.5px, uzun bo'lsa kesiladi
 *
 * MA'LUMOT: `GET /api/stories/feed` — SIZ OBUNA BO'LGAN odamlarning
 * muddati o'tmagan istoryalari. Maketdagi ismlar faqat o'rin egallovchi.
 *
 * "KO'RILGAN" holati: backendda istorya ko'rilganini yozadigan jadval
 * yo'q, shuning uchun u qurilmada saqlanadi — muallif kodi bo'yicha
 * eng oxirgi ko'rilgan istorya ID si. Yangi istorya chiqsa ID o'zgaradi
 * va halqa yana yonadi. (Avatar halqasidagi mantiqning aynan o'zi.)
 */
export function StoriesRow() {
  const { theme } = useTheme();
  const { seenIds, markSeen } = useSeenStories();

  const feed = useQuery({
    queryKey: ['stories', 'feed'],
    queryFn: getStoriesFeed,
    // Istorya lentasi tez eskiradi, lekin har ochilganda so'ramaslik
    // uchun bir daqiqa yangi hisoblanadi.
    staleTime: 60_000,
  });

  const authors = feed.data ?? [];
  if (!authors.length) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{
        gap: 14,
        paddingTop: 2,
        paddingHorizontal: 16,
        paddingBottom: 16,
      }}
      style={{ flexGrow: 0 }}
    >
      {authors.map((a) => (
        <StoryBubble
          key={a.code}
          author={a}
          unseen={latestId(a) !== seenIds[a.code]}
          onPress={() => {
            markSeen(a.code, latestId(a));
            router.push(`/stories/${a.code}`);
          }}
        />
      ))}
      <View style={{ width: 2 }} />
    </ScrollView>
  );
}

function StoryBubble({
  author,
  unseen,
  onPress,
}: {
  author: StoryAuthor;
  unseen: boolean;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const inner = RING - BAND * 2;
  // Halqa bilan avatar orasidagi fon rangidagi bo'shliq.
  const photo = inner - 3;

  return (
    <TapScale
      radius={RING / 2}
      onPress={onPress}
      pulseColor={theme.a1}
      accessibilityLabel={`${author.name} — istoryani ochish`}
      style={{ width: ITEM, alignItems: 'center', gap: 6 }}
    >
      <View
        style={[
          {
            width: RING,
            height: RING,
            borderRadius: RING / 2,
            alignItems: 'center',
            justifyContent: 'center',
          },
          unseen ? SH.storyRing(theme.a1) : null,
        ]}
      >
        <ShimmerRing
          size={RING}
          band={BAND}
          active={unseen}
          duration={11_000}
          seenOpacity={0.55}
        />
        <View
          pointerEvents="none"
          style={{
            width: inner,
            height: inner,
            borderRadius: inner / 2,
            backgroundColor: theme.bg,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {author.avatarUrl ? (
            <Image
              source={{ uri: mediaUrl(author.avatarUrl) }}
              contentFit="cover"
              style={{ width: photo, height: photo, borderRadius: photo / 2 }}
            />
          ) : (
            <StripeFill
              step={5}
              style={{
                width: photo,
                height: photo,
                borderRadius: photo / 2,
                overflow: 'hidden',
              }}
            />
          )}
        </View>
      </View>

      <Text
        style={[sans(500, 9.5), { color: 'rgba(255,255,255,.55)', width: ITEM, textAlign: 'center' }]}
        numberOfLines={1}
      >
        {author.name}
      </Text>
    </TapScale>
  );
}

/** Muallifning eng so'nggi istoryasi ID si — "ko'rilgan" belgisi shu. */
function latestId(a: StoryAuthor): number {
  let best = 0;
  for (const s of a.stories) if (s.id > best) best = s.id;
  return best;
}

const KEY = 'nfcstore.seenStories';

/** Ko'rilgan istoryalar — `{ <kod>: <oxirgi ko'rilgan ID> }`, qurilmada. */
function useSeenStories() {
  const [seenIds, setSeenIds] = useState<Record<string, number>>({});

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (!alive || !raw) return;
        const parsed: unknown = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          setSeenIds(parsed as Record<string, number>);
        }
      })
      .catch(() => {
        // Buzilgan yozuv — hammasini "ko'rilmagan" deb boshlaymiz.
      });
    return () => {
      alive = false;
    };
  }, []);

  const markSeen = useCallback((code: string, id: number) => {
    setSeenIds((prev) => {
      const next = { ...prev, [code]: id };
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  return { seenIds, markSeen };
}
