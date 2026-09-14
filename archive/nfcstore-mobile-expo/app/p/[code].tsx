import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { followCard, unfollowCard } from '@/api/endpoints';
import type { FollowStats } from '@/api/types';
import { BackBar, TapInactiveBanner } from '@/components/BackBar';
import { ProfileView } from '@/features/profile/ProfileView';
import type { ProfileTab } from '@/features/profile/tabs/ProfileTabBar';
import { useCardProfile } from '@/features/profile/useProfileTargets';
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

  const { vm, posts, loading, notFound } = useCardProfile(normalized || null);
  const [tab, setTab] = useState<ProfileTab>('catalog');

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
      tab={tab}
      onTabChange={setTab}
      // Shaxsiy kartada 24 soatlik post tushunchasi yo'q — halqa
      // yonmaydi va avatar bosilganda hech narsa ochilmaydi.
      hasNewContent={false}
      seen
      topBar={<BackBar title={vm.name} subtitle={vm.handle} />}
      banner={inactive === '1' ? <TapInactiveBanner /> : undefined}
      onFollow={vm.isOwner ? undefined : () => follow.mutate()}
      onOpenCompany={(companyId) => router.push(`/c/${companyId}`)}
    />
  );
}
