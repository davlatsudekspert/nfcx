import { Image } from 'expo-image';
import { Text, useWindowDimensions, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import type { CompanyPost } from '@/api/types';
import { StripeFill } from '@/components/StripeFill';
import { TapScale } from '@/components/TapScale';
import { mono } from '@/theme/type';

import { EmptyState } from './FeedGrid';

/**
 * Reels — 9:16 muqovalar, 3 ustunda (maketda `gap:2px; padding:2px`).
 *
 * MANBA: alohida "reels" endpoint mavjud emas —
 * `GET /api/companies/:id/posts` dagi `videoUrl` TO'LDIRILGAN yozuvlar
 * Reels hisoblanadi (egasi tasdiqlagan). Shuning uchun filtr shu yerda,
 * bitta joyda turadi.
 */
export function selectReels(posts: CompanyPost[]): CompanyPost[] {
  return posts.filter((p) => !!p.videoUrl);
}

export function ReelsGrid({
  reels,
  onOpen,
}: {
  reels: CompanyPost[];
  onOpen?: (post: CompanyPost) => void;
}) {
  const { width } = useWindowDimensions();

  const tile = (width - 4 - 4) / 3;

  if (!reels.length) {
    return <EmptyState text="Hozircha video yo&#x2019;q" />;
  }

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 2, padding: 2 }}>
      {reels.map((reel) => (
        <TapScale
          key={reel.id}
          radius={0}
          onPress={onOpen ? () => onOpen(reel) : undefined}
          accessibilityLabel={reel.caption || 'Video'}
          style={{ width: tile, height: (tile * 16) / 9 }}
        >
          {reel.imageUrl ? (
            <Image source={{ uri: reel.imageUrl }} contentFit="cover" style={{ flex: 1 }} />
          ) : (
            <StripeFill step={8} style={{ flex: 1 }} />
          )}

          {/* Ijro belgisi va izoh rasm ustida turadi. */}
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              padding: 8,
              justifyContent: 'space-between',
            }}
          >
            <View style={{ alignSelf: 'flex-end' }}>
              <Svg width={13} height={13} viewBox="0 0 24 24">
                <Path d="M7 4.5l12 7.5-12 7.5v-15z" fill="rgba(255,255,255,.75)" />
              </Svg>
            </View>
            {reel.caption ? (
              <Text
                style={[mono(500, 9.5), { color: 'rgba(255,255,255,.8)' }]}
                numberOfLines={1}
              >
                {reel.caption}
              </Text>
            ) : null}
          </View>
        </TapScale>
      ))}
    </View>
  );
}
