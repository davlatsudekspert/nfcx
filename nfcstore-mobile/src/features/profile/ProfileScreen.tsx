import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { toggleFollow } from '@/api/endpoints';
import type { Company } from '@/api/types';
import { useActiveIdStore } from '@/store/activeIdStore';
import { useTheme } from '@/theme/ThemeProvider';
import { sans } from '@/theme/type';

import { HandleChip, SettingsButton } from './header/ActionButtons';
import { ProfileHeader } from './header/ProfileHeader';
import { SettingsSheet } from './sheets/SettingsSheet';
import { SwitcherSheet } from './sheets/SwitcherSheet';
import { CatalogGrid } from './tabs/CatalogGrid';
import { FeedGrid } from './tabs/FeedGrid';
import { InfoList, LinksList } from './tabs/InfoList';
import { ProfileTabBar, type ProfileTab } from './tabs/ProfileTabBar';
import { ReelsGrid, selectReels } from './tabs/ReelsGrid';
import { useProfileData } from './useProfileData';
import { useSeenRing } from './useSeenRing';

/**
 * Profil ekrani — biznes va shaxsiy ID uchun bitta ekran.
 *
 * Almashtirgichdan boshqa ID tanlanganda BUTUN ekran bir bosishda
 * to'g'ri ko'rinishga o'tadi: sarlavha, 2-tab (Katalog yoki Havolalar),
 * amal tugmalari va Info qatorlari — hammasi `vm.kind` ga qarab.
 */
export function ProfileScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const setActive = useActiveIdStore((s) => s.setActive);

  const { vm, accounts, active, posts, loading, error } = useProfileData();

  const [tab, setTab] = useState<ProfileTab>('catalog');
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const { hasNewContent, seen, latest, markSeen } = useSeenRing(vm?.key ?? 'none', posts);

  // Obuna tugmasi — optimistik: raqam va holat DARHOL o'zgaradi, keyin
  // server javobi bilan aniqlanadi. Xato bo'lsa avvalgi holat qaytadi.
  const follow = useMutation({
    mutationFn: () => toggleFollow(vm!.companyId!),
    onMutate: async () => {
      const key = ['company', vm?.companyId];
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
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(ctx.key, ctx.prev);
    },
    onSuccess: (data) => {
      const key = ['company', vm?.companyId];
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
      <HandleChip
        handle={vm?.handle ?? '@…'}
        onPress={() => setSwitcherOpen(true)}
      />
      <SettingsButton onPress={() => setSettingsOpen(true)} />
    </View>
  );

  if (loading && !vm) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        {topBar}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={theme.a1} />
        </View>
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
          <Text
            style={[
              sans(500, 13, 1.5),
              { color: theme.off, textAlign: 'center' },
            ]}
          >
            {error
              ? 'Ma’lumotni yuklab bo’lmadi. Internetni tekshirib qayta urinib ko’ring.'
              : 'Hozircha hech qanday ID yo’q. Yangi NFC ID sotib oling yoki Company ID oching.'}
          </Text>
        </View>
        <SwitcherSheet
          visible={switcherOpen}
          onClose={() => setSwitcherOpen(false)}
          accounts={accounts}
          active={active}
          onPick={setActive}
        />
        <SettingsSheet
          visible={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          rows={settingRows(vm)}
        />
      </View>
    );
  }

  const feedPosts = posts.filter((p) => !p.videoUrl);
  const reels = selectReels(posts);

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      {topBar}

      <ScrollView
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[1]}
        contentContainerStyle={{ paddingBottom: 26 }}
      >
        <ProfileHeader
          vm={vm}
          hasNewContent={hasNewContent}
          seen={seen}
          onOpenPost={
            latest
              ? () => {
                  markSeen();
                  router.push(`/post/${latest.id}`);
                }
              : undefined
          }
          onFollow={vm.companyId ? () => follow.mutate() : undefined}
          onDashboard={() => {
            // Dashboard keyingi bosqichda (spetsifikatsiya 6-bo'lim).
          }}
          onEdit={() => {
            // Profilni tahrirlash keyingi bosqichda.
          }}
        />

        <View style={{ backgroundColor: theme.bg }}>
          <ProfileTabBar
            active={tab}
            onChange={setTab}
            isOwner={vm.isOwner}
            isBusiness={vm.kind === 'business'}
          />
        </View>

        {/* Kontent almashganda silliq paydo bo'ladi — maketdagi
            `fadeIn .25s`, spetsifikatsiya: "never an abrupt cut". */}
        <Animated.View key={tab} entering={FadeIn.duration(250)}>
          {tab === 'feed' ? <FeedGrid posts={feedPosts} /> : null}

          {tab === 'catalog' && vm.kind === 'business' ? (
            <CatalogGrid items={vm.catalog} plan={vm.plan} isOwner={vm.isOwner} />
          ) : null}
          {tab === 'catalog' && vm.kind === 'personal' ? (
            <LinksList links={vm.links} />
          ) : null}

          {tab === 'reels' ? <ReelsGrid reels={reels} /> : null}

          {tab === 'info' ? <InfoList about={vm.about} rows={vm.infoRows} /> : null}
        </Animated.View>
      </ScrollView>

      <SwitcherSheet
        visible={switcherOpen}
        onClose={() => setSwitcherOpen(false)}
        accounts={accounts}
        active={active}
        onPick={(id) => {
          setActive(id);
          // Yangi ID da 2-tab boshqa mazmunga ega, shuning uchun
          // biznesda Katalog, shaxsiyda Postlar ochiladi — maketdagi
          // xatti-harakat.
          setTab(id.kind === 'business' ? 'catalog' : 'feed');
        }}
      />

      <SettingsSheet
        visible={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        rows={settingRows(vm)}
      />
    </View>
  );
}

function settingRows(vm: { handle?: string } | null) {
  return [
    { k: 'Hisob', v: vm?.handle ?? '—' },
    { k: 'Bildirishnomalar', v: 'Yoniq' },
    { k: 'Til', v: "O'zbekcha" },
    { k: "To'lovlar", v: 'Payme' },
    { k: 'Chiqish', v: '' },
  ];
}
