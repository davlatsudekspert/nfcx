import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import type { CompanyPost } from '@/api/types';
import { StripeFill } from '@/components/StripeFill';
import { TapScale } from '@/components/TapScale';
import { relativeTime } from '@/lib/format';
import { useActiveIdStore } from '@/store/activeIdStore';
import { A140 } from '@/theme/css';
import { useTheme } from '@/theme/ThemeProvider';
import { mono, sans } from '@/theme/type';

const LOGO = require('../../assets/logo.png');

/**
 * Oxirgi postni to'liq ekranda ko'rish — avatarni bosganda ochiladi
 * (spetsifikatsiya 3 va 8-bo'limlar: "Tapping the avatar opens the
 * latest post full-screen").
 *
 * Post ma'lumoti YANGI so'rov bilan olinmaydi: u profil ekranida
 * allaqachon yuklangan va react-query keshida turadi. Shu sababli
 * ekran darhol ochiladi, kutish holati ko'rinmaydi.
 */
export default function PostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const active = useActiveIdStore((s) => s.active);

  const companyId = active?.kind === 'business' ? active.companyId : null;
  const posts = queryClient.getQueryData<CompanyPost[]>(['posts', companyId]) ?? [];
  const post = posts.find((p) => String(p.id) === String(id)) ?? null;

  return (
    <Animated.View
      entering={FadeIn.duration(220)}
      style={{ flex: 1, backgroundColor: '#000' }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          paddingTop: 18 + insets.top,
          paddingHorizontal: 16,
          paddingBottom: 12,
        }}
      >
        <LinearGradient
          colors={[theme.a1, theme.a2]}
          start={A140.start}
          end={A140.end}
          style={{ width: 34, height: 34, borderRadius: 17, padding: 2 }}
        >
          <Image
            source={LOGO}
            contentFit="cover"
            style={{ flex: 1, borderRadius: 15 }}
          />
        </LinearGradient>

        <View style={{ flex: 1, gap: 3 }}>
          <Text style={[sans(700, 13), { color: '#fff' }]}>NFCSTORE</Text>
          <Text style={[mono(500, 10.5), { color: 'rgba(255,255,255,.45)' }]}>
            {post ? relativeTime(post.createdAt) : ''}
          </Text>
        </View>

        <TapScale
          radius={11}
          onPress={() => router.back()}
          accessibilityLabel="Yopish"
          style={{
            width: 32,
            height: 32,
            borderRadius: 11,
            backgroundColor: 'rgba(255,255,255,.08)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Svg width={12} height={12} viewBox="0 0 12 12">
            <Path
              d="M1 1l10 10M11 1L1 11"
              stroke="#fff"
              strokeWidth={1.6}
              strokeLinecap="round"
              fill="none"
            />
          </Svg>
        </TapScale>
      </View>

      {post?.imageUrl ? (
        <Image
          source={{ uri: post.imageUrl }}
          contentFit="contain"
          style={{ flex: 1 }}
        />
      ) : (
        <StripeFill
          step={10}
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text
            style={[
              mono(400, 11, 1.5),
              { color: theme.phInk, textAlign: 'center', letterSpacing: 0.66 },
            ]}
          >
            {post ? 'RASM YO’Q' : 'POST TOPILMADI'}
          </Text>
        </StripeFill>
      )}

      {post?.caption ? (
        <Text
          style={[
            sans(400, 13, 1.55),
            {
              color: 'rgba(255,255,255,.75)',
              padding: 16,
              paddingBottom: 16 + insets.bottom,
            },
          ]}
        >
          {post.caption}
        </Text>
      ) : null}
    </Animated.View>
  );
}
