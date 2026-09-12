import { Image } from 'expo-image';
import { type ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import type { CompanyPost } from '@/api/types';
import { Card } from '@/components/Card';
import { StripeFill } from '@/components/StripeFill';
import { TapScale } from '@/components/TapScale';
import { useTheme } from '@/theme/ThemeProvider';
import { mono, sans } from '@/theme/type';

import { ProfileHeader } from './header/ProfileHeader';
import type { ProfileVM } from './profileVM';
import { CatalogGrid } from './tabs/CatalogGrid';
import { FeedGrid } from './tabs/FeedGrid';
import { InfoList, LinksList } from './tabs/InfoList';
import { ProfileTabBar, type ProfileTab } from './tabs/ProfileTabBar';
import { ReelsGrid, selectReels } from './tabs/ReelsGrid';

/**
 * Profil tanasi — sarlavha, tab bar va tab kontenti.
 *
 * UCH joyda ishlatiladi va hech qayerda nusxalanmaydi:
 *   • Profil tabi (almashtirgichdagi faol ID)
 *   • NFC teginish natijasi (`/p/<KOD>`)
 *   • Katalogdan ochilgan profil (`/p/<KOD>` yoki `/c/<ID>`)
 *
 * Yuqoridagi qator (`topBar`) har joyda boshqa: tabda handle +
 * sozlamalar, tashqi profilda esa "orqaga" tugmasi. Shuning uchun u
 * prop sifatida beriladi.
 */
export function ProfileView({
  vm,
  posts,
  tab,
  onTabChange,
  hasNewContent,
  seen,
  onOpenPost,
  onFollow,
  onDashboard,
  onEdit,
  onOpenCompany,
  onManageCatalog,
  topBar,
  banner,
}: {
  vm: ProfileVM;
  posts: CompanyPost[];
  tab: ProfileTab;
  onTabChange: (tab: ProfileTab) => void;
  hasNewContent: boolean;
  seen: boolean;
  onOpenPost?: () => void;
  onFollow?: () => void;
  onDashboard?: () => void;
  onEdit?: () => void;
  onOpenCompany?: (companyId: string) => void;
  onManageCatalog?: () => void;
  topBar: ReactNode;
  /** Masalan "bu karta faol emas" ogohlantirishi. */
  banner?: ReactNode;
}) {
  const { theme } = useTheme();

  const feedPosts = posts.filter((p) => !p.videoUrl);
  const reels = selectReels(posts);

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      {topBar}
      {banner}

      <ScrollView
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[vm.featuredCompany ? 2 : 1]}
        contentContainerStyle={{ paddingBottom: 26 }}
      >
        <ProfileHeader
          vm={vm}
          hasNewContent={hasNewContent}
          seen={seen}
          onOpenPost={onOpenPost}
          onFollow={onFollow}
          onDashboard={onDashboard}
          onEdit={onEdit}
        />

        {vm.featuredCompany ? (
          <FeaturedCompanyBlock
            company={vm.featuredCompany}
            onPress={() => onOpenCompany?.(vm.featuredCompany!.companyId)}
          />
        ) : null}

        <View style={{ backgroundColor: theme.bg }}>
          <ProfileTabBar
            active={tab}
            onChange={onTabChange}
            isOwner={vm.isOwner}
            isBusiness={vm.kind === 'business'}
          />
        </View>

        {/* Kontent almashganda silliq paydo bo'ladi — maketdagi
            `fadeIn .25s`, spetsifikatsiya: "never an abrupt cut". */}
        <Animated.View key={tab} entering={FadeIn.duration(250)}>
          {tab === 'feed' ? <FeedGrid posts={feedPosts} /> : null}

          {tab === 'catalog' && vm.kind === 'business' ? (
            <CatalogGrid
              items={vm.catalog}
              plan={vm.plan}
              isOwner={vm.isOwner}
              onManage={onManageCatalog}
            />
          ) : null}
          {tab === 'catalog' && vm.kind === 'personal' ? (
            <LinksList links={vm.links} />
          ) : null}

          {tab === 'reels' ? <ReelsGrid reels={reels} /> : null}

          {tab === 'info' ? <InfoList about={vm.about} rows={vm.infoRows} /> : null}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

/**
 * "Profilda kompaniya" bloki — saytdagi sozlamaning aynan o'zi:
 * kompaniya alohida blok bo'lib chiqadi va bosilganda kompaniya
 * sahifasi ochiladi.
 *
 * MUHIM: NFC teginishda kompaniyaga AVTOMATIK o'tilmaydi. Avval
 * odamning o'z profili ko'rinadi, kompaniyaga esa faqat shu blok
 * bosilganda o'tiladi — ilova va sayt bir xil ishlashi uchun.
 */
function FeaturedCompanyBlock({
  company,
  onPress,
}: {
  company: NonNullable<ProfileVM['featuredCompany']>;
  onPress: () => void;
}) {
  const { theme } = useTheme();

  return (
    <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>
      <TapScale
        radius={14}
        onPress={onPress}
        accessibilityLabel={`${company.displayName} — kompaniya sahifasini ochish`}
        style={{ borderRadius: 14 }}
      >
        <Card
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            paddingHorizontal: 14,
            paddingVertical: 13,
          }}
        >
          {company.logoUrl ? (
            <Image
              source={{ uri: company.logoUrl }}
              contentFit="cover"
              style={{ width: 44, height: 44, borderRadius: 12 }}
            />
          ) : (
            <StripeFill
              step={6}
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                overflow: 'hidden',
                borderWidth: 1,
                borderColor: theme.rim,
              }}
            />
          )}

          <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
            <Text style={[mono(600, 9.5), { color: theme.a1, letterSpacing: 0.76 }]}>
              KOMPANIYA
            </Text>
            <Text style={[sans(700, 13.5, 1.2), { color: theme.ink }]} numberOfLines={1}>
              {company.displayName}
            </Text>
          </View>

          <Svg width={18} height={18} viewBox="0 0 24 24">
            <Path
              d="M8.5 12h7M12.5 8.5l3.5 3.5-3.5 3.5"
              stroke={theme.a2}
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </Svg>
        </Card>
      </TapScale>
    </View>
  );
}
