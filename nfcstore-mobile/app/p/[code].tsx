import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

import { followCard, unfollowCard } from '@/api/endpoints';
import type { FollowStats } from '@/api/types';
import { BackBar, TapInactiveBanner } from '@/components/BackBar';
import { ProfileView } from '@/features/profile/ProfileView';
import { SITE } from '@/features/profile/profileVM';
import type { ProfileTab } from '@/features/profile/tabs/ProfileTabBar';
import { useCardProfile } from '@/features/profile/useProfileTargets';
import { useSeenRing } from '@/features/profile/useSeenRing';
import { useTheme } from '@/theme/ThemeProvider';
import { sans } from '@/theme/type';

/**
 * BOSHQA odamning shaxsiy karta profili — kod bo'yicha.
 *
 * Ikki joydan ochiladi:
 *   • NFC teginish (karta URL'idagi kod)
 *   • Katalogdagi yozuv
 *
 * `?inactive=1` — NFC teginishda chip tekshiruvi "faol emas" bergan
 * holat. Saytdagidek profil BARIBIR ko'rsatiladi, faqat ustida
 * ogohlantirish chiqadi.
 */
export default function CardProfileRoute() {
  const { code, inactive } = useLocalSearchParams<{ code: string; inactive?: string }>();
  const { theme } = useTheme();
  const normalized = (code ?? '').toUpperCase();

  const { vm, posts, stories, loading, notFound } = useCardProfile(normalized || null);
  const [tab, setTab] = useState<ProfileTab>('catalog');
  const { hasNewContent, seen, latest, markSeen } = useSeenRing(vm?.key ?? 'none', posts);

  const queryClient = useQueryClient();
  const follow = useMutation({
    mutationFn: () => (vm?.following ? unfollowCard(normalized) : followCard(normalized)),
    onMutate: async () => {
      const key = ['follow-stats', normalized];
      await queryClient.cancelQueries({ queryKey: key });
      const prev = queryClient.getQueryData<FollowStats>(key);
      if (prev) {
        queryClient.setQueryData<FollowStats>(key, {
          ...prev,
          isFollowing: !prev.isFollowing,
          followers: Math.max(0, prev.followers + (prev.isFollowing ? -1 : 1)),
        });
      }
      return { prev, key };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(ctx.key, ctx.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['follow-stats', normalized] });
    },
  });

  if (loading && !vm) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <BackBar title={normalized || 'Profil'} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={theme.a1} />
        </View>
      </View>
    );
  }

  if (!vm) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <BackBar title={normalized || 'Profil'} />
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 32,
          }}
        >
          <Text style={[sans(500, 13, 1.5), { color: theme.off, textAlign: 'center' }]}>
            {notFound
              ? `${normalized} kodli profil topilmadi.`
              : 'Profilni yuklab bo’lmadi. Internetni tekshirib qayta urinib ko’ring.'}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <ProfileView
      vm={vm}
      posts={posts}
      stories={stories}
      tab={tab}
      onTabChange={setTab}
      hasNewContent={hasNewContent}
      seen={seen}
      onOpenPost={
        latest
          ? () => {
              markSeen();
              router.push(`/post/${latest.id}?code=${encodeURIComponent(normalized)}`);
            }
          : undefined
      }
      topBar={<BackBar title={vm.name} subtitle={vm.handle} />}
      banner={inactive === '1' ? <TapInactiveBanner /> : undefined}
      onFollow={vm.isOwner ? undefined : () => follow.mutate()}
      onOpenCompany={(companyId) => router.push(`/c/${companyId}`)}
      // Profilni tahrirlash flow'i mobilda hali qurilmagan (rasm
      // yuklash, forma) — shuning uchun haqiqiy veb tahrirlash sahifasi
      // ochiladi, fake/bo'sh forma emas.
      onEdit={vm.isOwner ? () => WebBrowser.openBrowserAsync(`${SITE}/account`).catch(() => {}) : undefined}
      onCreateStory={
        vm.isOwner ? () => WebBrowser.openBrowserAsync(`${SITE}/account`).catch(() => {}) : undefined
      }
    />
  );
}
