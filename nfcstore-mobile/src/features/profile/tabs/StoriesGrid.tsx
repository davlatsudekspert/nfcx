import { Image } from 'expo-image';
import { useState } from 'react';
import { Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import type { CompanyStory } from '@/api/types';
import { StripeFill } from '@/components/StripeFill';
import { TapScale } from '@/components/TapScale';
import { SEEN_RING } from '@/theme/themes';
import { useTheme } from '@/theme/ThemeProvider';
import { sans } from '@/theme/type';

import { EmptyState } from './FeedGrid';
import { StoryViewer } from '../StoryViewer';

/**
 * Business Stories tabi — `GET /api/companies/:id/stories` dan haqiqiy
 * (`hosting/worker.js:1209`, production'da tasdiqlangan).
 *
 * Har bir dumaloq — 4:5 EMAS, doira ("story ring" spetsifikatsiyasi:
 * 56-62 tashqi, 2-2.5px halqa). Ko'rilgan/ko'rilmagan holat backend'dan
 * (`story.seen`/`story.viewed`), client bilmasdan hech narsani "ko'rilgan"
 * deb belgilamaydi.
 */
export function StoriesGrid({
  stories,
  isOwner,
  onCreate,
}: {
  stories: CompanyStory[];
  isOwner: boolean;
  onCreate?: () => void;
}) {
  const { theme } = useTheme();
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  if (!stories.length && !isOwner) {
    return <EmptyState text="Hozircha story yo’q" />;
  }

  return (
    <View style={{ paddingHorizontal: 14, paddingTop: 14, paddingBottom: 26 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
        {isOwner ? <CreateStoryTile onPress={onCreate} /> : null}

        {stories.map((story, i) => {
          const seen = story.seen ?? story.viewed ?? false;
          const [c1, c2] = seen ? SEEN_RING : [theme.a1, theme.a2];
          return (
            <TapScale
              key={story.id}
              radius={31}
              onPress={() => setViewerIndex(i)}
              accessibilityLabel={`Story, ${new Date(story.createdAt).toLocaleDateString('uz-UZ')}`}
              style={{ alignItems: 'center', gap: 5, width: 62 }}
            >
              <View
                style={{
                  width: 62,
                  height: 62,
                  borderRadius: 31,
                  borderWidth: 2.2,
                  borderColor: c1,
                  padding: 2.5,
                  backgroundColor: theme.bg,
                }}
              >
                {/* Ikkinchi rang — soddalashtirilgan: to'liq conic emas,
                    lekin ko'rilgan/ko'rilmagan farqi teng darajada aniq
                    ko'rinadi (byudjet: bitta uzluksiz animatsiya faqat
                    tab ichida, bu yerda statik). */}
                <View
                  style={{
                    flex: 1,
                    borderRadius: 27,
                    overflow: 'hidden',
                    borderWidth: 1,
                    borderColor: c2,
                  }}
                >
                  {story.imageUrl ? (
                    <Image source={{ uri: story.imageUrl }} contentFit="cover" style={{ flex: 1 }} />
                  ) : (
                    <StripeFill step={5} style={{ flex: 1 }} />
                  )}
                </View>
              </View>
            </TapScale>
          );
        })}
      </View>

      {viewerIndex != null ? (
        <StoryViewer
          stories={stories}
          startIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      ) : null}
    </View>
  );
}

/**
 * Egasi uchun "+" plitasi — media yuklash oqimi mobilda hali yo'q
 * (rasm/video picker + upload endpointi ulanmagan), shuning uchun
 * bosilganda HAQIQIY veb yaratish sahifasi ochiladi (`onCreate`) —
 * fake/bo'sh forma ko'rsatilmaydi.
 */
function CreateStoryTile({ onPress }: { onPress?: () => void }) {
  const { theme } = useTheme();
  return (
    <TapScale
      radius={31}
      onPress={onPress}
      accessibilityLabel="Story yaratish"
      style={{ alignItems: 'center', gap: 5, width: 62 }}
    >
      <View
        style={{
          width: 62,
          height: 62,
          borderRadius: 31,
          borderWidth: 1.5,
          borderStyle: 'dashed',
          borderColor: theme.rim,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Svg width={16} height={16} viewBox="0 0 8 8">
          <Path
            d="M4 .8v6.4M.8 4h6.4"
            stroke={theme.a1}
            strokeWidth={1.4}
            strokeLinecap="round"
            fill="none"
          />
        </Svg>
      </View>
      <Text style={[sans(500, 9.5), { color: theme.off }]} numberOfLines={1}>
        Yaratish
      </Text>
    </TapScale>
  );
}
