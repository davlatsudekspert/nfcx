import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { followCard, toggleFollowCompany, unfollowCard } from '@/api/endpoints';
import type { Company, FollowStats } from '@/api/types';
import { useActiveIdStore } from '@/store/activeIdStore';
import { useTheme } from '@/theme/ThemeProvider';
import { sans } from '@/theme/type';

import { HandleChip, SettingsButton } from './header/ActionButtons';
import { ProfileView } from './ProfileView';
import { SettingsSheet } from './sheets/SettingsSheet';
import { SwitcherSheet } from './sheets/SwitcherSheet';
import type { ProfileTab } from './tabs/ProfileTabBar';
import { useProfileData } from './useProfileData';
import { useSeenRing } from './useSeenRing';

/**
 * Profil TABI — almashtirgichda tanlangan faol ID.
 *
 * Boshqa ID tanlanganda BUTUN ekran bir bosishda to'g'ri ko'rinishga
 * o'tadi: sarlavha, 2-tab (Katalog yoki Havolalar), amal tugmalari va
 * Info qatorlari — hammasi `vm.kind` ga qarab.
 */
export function ProfileScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const setActive = useActiveIdStore((s) => s.setActive);

  const { vm, accounts, active, posts, loading, error } = useProfileData();

  const [tab, setTab] = useState<ProfileTab>('catalog');
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const { hasNewContent, seen, latest, markSeen } = useSeenRing(vm?.key ?? 'none', posts);
  const follow = useFollowMutation(vm?.companyId, vm?.code, vm?.following);

  const topBar = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 8 + insets.top,
        paddingHorizontal: 14,
        paddingBottom: 2,
      }}
    >
      {/* Almashtirgich tugmasi SARLAVHANING umumiy qatorida turadi —
          shuning uchun u Personal va Business ekranlarda bir xil joyda
          va bir xil ishlaydi (spetsifikatsiya talabi). */}
      <HandleChip handle={vm?.handle ?? '@…'} onPress={() => setSwitcherOpen(true)} />
      <SettingsButton onPress={() => setSettingsOpen(true)} />
    </View>
  );

  const sheets = (
    <>
      <SwitcherSheet
        visible={switcherOpen}
        onClose={() => setSwitcherOpen(false)}
        accounts={accounts}
        active={active}
        onPick={(id) => {
          setActive(id);
          // Yangi ID da 2-tab boshqa mazmunga ega, shuning uchun biznesda
          // Katalog, shaxsiyda Postlar ochiladi — maketdagi xatti-harakat.
          setTab(id.kind === 'business' ? 'catalog' : 'feed');
        }}
      />
      <SettingsSheet
        visible={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        rows={settingRows(vm?.handle)}
      />
    </>
  );

  if (loading && !vm) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        {topBar}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={theme.a1} />
        </View>
        {sheets}
      </View>
    );
  }

  if (!vm) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        {topBar}
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 32,
          }}
        >
          <Text style={[sans(500, 13, 1.5), { color: theme.off, textAlign: 'center' }]}>
            {error
              ? 'Ma’lumotni yuklab bo’lmadi. Internetni tekshirib qayta urinib ko’ring.'
              : 'Hozircha hech qanday ID yo’q. Yangi NFC ID sotib oling yoki Company ID oching.'}
          </Text>
        </View>
        {sheets}
      </View>
    );
  }

  return (
    <>
      <ProfileView
        vm={vm}
        posts={posts}
        tab={tab}
        onTabChange={setTab}
        hasNewContent={hasNewContent}
        seen={seen}
        topBar={topBar}
        onOpenPost={
          latest
            ? () => {
                markSeen();
                router.push(`/post/${latest.id}`);
              }
            : undefined
        }
        onFollow={follow ? () => follow.mutate() : undefined}
        onDashboard={
          vm.companyId ? () => router.push(`/dashboard/${vm.companyId}`) : undefined
        }
        onManageCatalog={
          vm.companyId ? () => router.push(`/dashboard/${vm.companyId}`) : undefined
        }
        onOpenCompany={(companyId) => router.push(`/c/${companyId}`)}
      />
      {sheets}
    </>
  );
}

/**
 * Obuna tugmasi — optimistik: raqam va holat DARHOL o'zgaradi, keyin
 * server javobi bilan aniqlanadi; xato bo'lsa avvalgi holat qaytadi.
 *
 * Kompaniya va shaxsiy karta uchun endpointlar BOSHQA-BOSHQA:
 *   kompaniya — bitta toggle, yangi holatni qaytaradi
 *   karta     — ikkita alohida endpoint (follow / unfollow)
 * Shuning uchun keshni yangilash ham ikki xil.
 */
function useFollowMutation(
  companyId: string | undefined,
  code: string | undefined,
  following: boolean | undefined,
) {
  const queryClient = useQueryClient();

  const companyMutation = useMutation({
    mutationFn: () => toggleFollowCompany(companyId!),
    onMutate: async () => {
      const key = ['company', companyId];
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
      const key = ['company', companyId];
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

  const cardMutation = useMutation({
    mutationFn: () => (following ? unfollowCard(code!) : followCard(code!)),
    onMutate: async () => {
      const key = ['follow-stats', code];
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
      // Shaxsiy karta endpointlari yangi sanoqni qaytarmaydi, shuning
      // uchun haqiqiy qiymatni serverdan qayta o'qiymiz.
      queryClient.invalidateQueries({ queryKey: ['follow-stats', code] });
    },
  });

  if (companyId) return companyMutation;
  if (code) return cardMutation;
  return null;
}

export function settingRows(handle: string | undefined) {
  return [
    { k: 'Hisob', v: handle ?? '—' },
    { k: 'Bildirishnomalar', v: 'Yoniq' },
    { k: 'Til', v: "O'zbekcha" },
    { k: "To'lovlar", v: 'Payme' },
    { k: 'Chiqish', v: '' },
  ];
}
