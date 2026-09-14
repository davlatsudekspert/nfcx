import { Image } from 'expo-image';
import { Text, useWindowDimensions, View } from 'react-native';

import { StripeFill } from '@/components/StripeFill';
import { TapScale } from '@/components/TapScale';
import type { CompanyPost } from '@/api/types';
import { useTheme } from '@/theme/ThemeProvider';
import { mono, sans } from '@/theme/type';

/**
 * Feed — 3 ustunli postlar to'ri (maketda `gap:2px; padding:2px`).
 *
 * REELS emas: `videoUrl` to'ldirilgan yozuvlar Reels tabiga ketadi
 * (egasi tasdiqlagan qoida), shuning uchun bu ro'yxat allaqachon
 * filtrlangan holda keladi.
 */
export function FeedGrid({
  posts,
  onOpen,
}: {
  posts: CompanyPost[];
  onOpen?: (post: CompanyPost) => void;
}) {
  const { theme } = useTheme();
  const { width } = useWindowDimensions();

  // Maketda `grid-template-columns: 1fr 1fr 1fr; gap:2px; padding:2px`.
  // RN da grid yo'q, shuning uchun katakning kengligi ANIQ hisoblanadi:
  // ekran kengligidan chetlar (2+2) va ikki tirqish (2+2) ayiriladi.
  // Foiz bilan qilsa tirqishlar hisobga olinmay, oxirgi ustun pastga
  // tushib ketardi.
  const tile = (width - 4 - 4) / 3;

  if (!posts.length) {
    return <EmptyState text="Hozircha post yo’q" />;
  }

  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 2,
        padding: 2,
      }}
    >
      {posts.map((post) => (
        <TapScale
          key={post.id}
          radius={0}
          onPress={onOpen ? () => onOpen(post) : undefined}
          accessibilityLabel={post.caption || 'Post'}
          style={{ width: tile, height: tile }}
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
