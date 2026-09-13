import { Image } from 'expo-image';
import { Text, useWindowDimensions, View } from 'react-native';

import { StripeFill } from '@/components/StripeFill';
import { TapScale } from '@/components/TapScale';
import type { CompanyPost } from '@/api/types';
import { SH } from '@/theme/css';
import { useTheme } from '@/theme/ThemeProvider';
import { mono, sans } from '@/theme/type';

/**
 * Feed — 3 ustunli postlar to'ri.
 *
 *   gap: 8px; padding: 12px 14px 24px;
 *   katak: radius 12, `1px solid #2d2518`,
 *          `0 8px 18px rgba(0,0,0,.5), 0 0 14px -6px #b3860f`
 *
 * REELS emas: `videoUrl` to'ldirilgan yozuvlar Reels tabiga ketadi
 * (egasi tasdiqlagan qoida), shuning uchun bu ro'yxat allaqachon
 * filtrlangan holda keladi.
 */
const PAD = 14;
const GAP = 8;

export function FeedGrid({
  posts,
  onOpen,
}: {
  posts: CompanyPost[];
  onOpen?: (post: CompanyPost) => void;
}) {
  const { theme } = useTheme();
  const { width } = useWindowDimensions();

  // RN da CSS grid yo'q, shuning uchun katakning kengligi ANIQ
  // hisoblanadi: ekran kengligidan ikki chet va ikki tirqish ayiriladi.
  // Foiz bilan qilsa tirqishlar hisobga olinmay, oxirgi ustun pastga
  // tushib ketardi.
  const tile = (width - PAD * 2 - GAP * 2) / 3;

  if (!posts.length) {
    return <EmptyState text="Hozircha post yo’q" />;
  }

  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: GAP,
        paddingTop: 12,
        paddingHorizontal: PAD,
        paddingBottom: 24,
      }}
    >
      {posts.map((post) => (
        <TapScale
          key={post.id}
          radius={12}
          onPress={onOpen ? () => onOpen(post) : undefined}
          accessibilityLabel={post.caption || 'Post'}
          style={[
            {
              width: tile,
              height: tile,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: theme.rim,
              backgroundColor: theme.c2,
              overflow: 'hidden',
            },
            SH.tile(theme.a2),
          ]}
        >
          {post.imageUrl ? (
            <Image
              source={{ uri: post.imageUrl }}
              contentFit="cover"
              style={{ flex: 1 }}
            />
          ) : (
            <StripeFill
              step={8}
              style={{ flex: 1, justifyContent: 'flex-end', padding: 7 }}
            >
              <Text
                style={[mono(400, 8, 1.3), { color: theme.phInk, letterSpacing: 0.32 }]}
                numberOfLines={2}
              >
                {post.caption?.toUpperCase() || 'POST'}
              </Text>
            </StripeFill>
          )}
        </TapScale>
      ))}
    </View>
  );
}

export function EmptyState({ text }: { text: string }) {
  const { theme } = useTheme();
  return (
    <View style={{ paddingVertical: 48, alignItems: 'center' }}>
      <Text style={[sans(500, 12.5), { color: theme.off }]}>{text}</Text>
    </View>
  );
}
