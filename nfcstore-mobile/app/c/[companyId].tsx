import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { toggleFollowCompany } from '@/api/endpoints';
import type { Company } from '@/api/types';
import { BackBar } from '@/components/BackBar';
import { ProfileView } from '@/features/profile/ProfileView';
import type { ProfileTab } from '@/features/profile/tabs/ProfileTabBar';
import { useCompanyProfile } from '@/features/profile/useProfileTargets';
import { useSeenRing } from '@/features/profile/useSeenRing';
import { useTheme } from '@/theme/ThemeProvider';
import { sans } from '@/theme/type';

/**
 * BOSHQA kompaniyaning profili — Company ID bo'yicha.
 *
 * Ikki joydan ochiladi:
 *   • Katalogdagi kompaniya yozuvi
 *   • Shaxsiy profildagi "profilda kompaniya" bloki
 */
export default function CompanyProfileRoute() {
  const { companyId } = useLocalSearchParams<{ companyId: string }>();
  const { theme } = useTheme();
  const id = companyId ?? '';

  const { vm, posts, loading, notFound } = useCompanyProfile(id || null);
  const [tab, setTab] = useState<ProfileTab>('catalog');
  const { hasNewContent, seen, latest, markSeen } = useSeenRing(vm?.key ?? 'none', posts);

  const queryClient = useQueryClient();
  const follow = useMutation({
    mutationFn: () => toggleFollowCompany(id),
    onMutate: async () => {
      const key = ['company', id];
      await queryClient.cancelQueries({ queryKey: key });
      const prev = queryClient.getQueryData<Company>(key);
      if (prev) {
        queryClient.setQueryData<Company>(key, {
          ...prev,
          following: !prev.following,
          followers: prev.followers + (prev.following ? -1 : 1),
        });
      }
      return { prev, key };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(ctx.key, ctx.prev);
    },
    onSuccess: (data) => {
      const key = ['company', id];
      const prev = queryClient.getQueryData<Company>(key);
      if (prev) {
        queryClient.setQueryData<Company>(key, {
          ...prev,
          following: data.following,
          followers: data.followers,
        });
      }
    },
  });

  if (loading && !vm) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <BackBar title={id || 'Kompaniya'} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={theme.a1} />
        </View>
      </View>
    );
  }

  if (!vm) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <BackBar title={id || 'Kompaniya'} />
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
              ? `${id} Company ID topilmadi yoki hali faol emas.`
              : 'Kompaniyani yuklab bo’lmadi. Internetni tekshirib qayta urinib ko’ring.'}
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
      hasNewContent={hasNewContent}
      seen={seen}
      topBar={<BackBar title={vm.name} subtitle={vm.handle} />}
      onOpenPost={
        latest
          ? () => {
              markSeen();
              router.push(`/post/${latest.id}?company=${encodeURIComponent(id)}`);
            }
          : undefined
      }
      onFollow={vm.isOwner ? undefined : () => follow.mutate()}
      onDashboard={vm.isOwner ? () => router.push(`/dashboard/${id}`) : undefined}
      onManageCatalog={vm.isOwner ? () => router.push(`/dashboard/${id}`) : undefined}
    />
  );
}
