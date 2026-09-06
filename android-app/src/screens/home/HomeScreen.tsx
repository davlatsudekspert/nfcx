import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useQuery } from '@tanstack/react-query';
import type { HomeStackParamList, MainTabParamList } from '../../navigation/types';
import { ScreenContainer } from '../shared/ScreenContainer';
import { PremiumButton } from '../../design-system/components/PremiumButton';
import { PremiumCard } from '../../design-system/components/PremiumCard';
import { PremiumEmptyState } from '../../design-system/components/PremiumEmptyState';
import { PremiumLoadingSkeleton } from '../../design-system/components/PremiumLoadingSkeleton';
import { NfcIdCard } from '../../composites/NfcIdCard';
import { NfcCardStack, type NfcCardStackItem } from '../../composites/NfcCardStack';
import { NfcCardVisual } from '../../composites/NfcCardVisual';
import { NfcChip } from '../../composites/NfcChip';
import { NfcInfoCard } from '../../composites/NfcInfoCard';
import { NfcPressable } from '../../composites/NfcPressable';
import { HeroStatChip } from '../../composites/HeroStatChip';
import { AuctionPreviewCard } from '../../composites/AuctionPreviewCard';
import { useAuthStore } from '../../state/authStore';
import { useAuctionsPreview } from '../../hooks/useAuctions';
import { useMyCompanies } from '../../hooks/useMyCompanies';
import { ordersApi } from '../../api/orders';
import { formatCount, safeText, toFiniteNumber } from '../../lib/format';
import { haptics } from '../../native/haptics';
import { useT } from '../../i18n';
import { color, depth, gradient, radius, space, type as typeTokens } from '../../design-system/tokens';

type Props = NativeStackScreenProps<HomeStackParamList, 'Home'>;

/**
 * The personal NFC dashboard (brief §6) — not a list of links.
 *
 * Order is deliberate and fixed: identity first — the user's primary card,
 * held up in 3D as the hero — then the numbers behind it, the four actions
 * they perform most, the rest of the wallet, and finally the data
 * sections. Everything below the hero is real API data or an honest empty
 * state; nothing here is seeded or illustrative.
 */
export function HomeScreen({ navigation }: Props) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const cards = useAuthStore((s) => s.cards);
  const tabNavigation = navigation.getParent<BottomTabNavigationProp<MainTabParamList>>();

  const pendingOrders = useQuery({
    queryKey: ['orders', 'mine'],
    queryFn: () => ordersApi.list(),
    select: (d) => d.orders.filter((o) => o.status === 'pending'),
  });
  const auctions = useAuctionsPreview();
  const companies = useMyCompanies();

  const goToIdTab = () => tabNavigation?.navigate('IdTab', { screen: 'IdSearch' });
  const goToAuctionTab = () => tabNavigation?.navigate('AuctionTab', { screen: 'AuctionList' });
  const goToCompanyTab = () => tabNavigation?.navigate('CompanyTab', { screen: 'CompanyHome' });
  const goToNfcRead = () => tabNavigation?.navigate('ProfileTab', { screen: 'NfcRead' });
  const goToMyIds = () => tabNavigation?.navigate('ProfileTab', { screen: 'MyProfile' });

  // The card the user actually hands to people leads the deck. `isPrimary` is
  // a real field on the record (GET /api/auth/me); with none set, the first
  // owned card is the de-facto primary — the same fallback the web app uses.
  const deck = React.useMemo<NfcCardStackItem[]>(
    () =>
      [...cards]
        .sort((a, b) => Number(b.isPrimary === true) - Number(a.isPrimary === true))
        .map((card) => ({
          key: card.code,
          code: card.code,
          name: card.name,
          state: 'owned' as const,
          isPrimary: card.isPrimary === true,
          verified: card.verified === true,
          views: toFiniteNumber(card.views) ?? undefined,
          onPress: () => navigation.navigate('PublicProfile', { code: card.code }),
        })),
    [cards, navigation],
  );
  const primary = deck[0];
  // The greeting avatar is the primary record's real photo, or the
  // placeholder — never a stock face.
  const primaryRecord = React.useMemo(
    () => (primary ? cards.find((c) => c.code === primary.code) : undefined),
    [cards, primary],
  );

  const pendingCount = pendingOrders.data?.length ?? 0;
  const totalViews = cards.reduce((sum, c) => sum + (toFiniteNumber(c.views) ?? 0), 0);

  return (
    <ScreenContainer scroll={false} padded={false} style={styles.floor}>
      <ScrollView
        style={styles.floor}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={gradient.screenAmbient}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.ambient, { height: 260 + insets.top }]}
          pointerEvents="none"
        />

        <View style={[styles.headerRow, { paddingTop: insets.top + space.md }]}>
          <NfcPressable
            radius={radius.pill}
            onPress={() => {
              haptics.selection();
              goToMyIds();
            }}
            accessibilityRole="button"
            accessibilityLabel={t('tab.profile')}
          >
            <NfcCardVisual avatarUrl={primaryRecord?.avatarUrl} size={40} pulse={false} />
          </NfcPressable>
          <View style={styles.headerText}>
            <Text style={styles.brand}>NFCSTORE</Text>
            <Text style={styles.greeting} numberOfLines={1}>
              {user?.email ? safeText(user.email) : 'Xush kelibsiz'}
            </Text>
          </View>
          <IconAction
            icon="bell"
            label={t('profile.notifications')}
            onPress={() => tabNavigation?.navigate('ProfileTab', { screen: 'Notifications' })}
          />
        </View>

        {/* A. The hero — the primary ID as the physical card it is. */}
        {primary ? (
          <>
            {deck.length === 1 ? (
              <SectionHeader title={t('home.myIds')} onSeeAll={goToMyIds} seeAllLabel={t('common.all')} />
            ) : (
              <Text style={styles.heroOverline}>ASOSIY ID</Text>
            )}
            <View style={styles.heroBody}>
              <NfcIdCard
                code={primary.code}
                name={primary.name}
                state="owned"
                layout="hero"
                index={0}
                isPrimary
                verified={primary.verified}
                views={primary.views}
                onPress={primary.onPress}
              />
            </View>

            <View style={styles.statsRow}>
              <HeroStatChip icon="eye" tone="blue" label={t('owner.views')} value={formatCount(totalViews)} />
              <HeroStatChip icon="hash" tone="gold" label={t('home.stats.ids')} value={formatCount(cards.length)} />
              <HeroStatChip icon="clock" tone="amber" label={t('home.stats.pending')} value={formatCount(pendingCount)} />
            </View>
          </>
        ) : (
          <View style={styles.sectionBody}>
            <PremiumCard variant="featured" style={depth.card}>
              <View style={styles.heroEmptyChip}>
                <NfcChip width={40} />
              </View>
              <Text style={styles.heroEmptyTitle}>{t('home.emptyIds')}</Text>
              <Text style={styles.heroEmptyText}>{t('home.emptyIdsHint')}</Text>
              <PremiumButton label={t('home.chooseId')} onPress={goToIdTab} style={styles.heroCta} />
            </PremiumCard>
          </View>
        )}

        {/* Pending purchases are NOT owned cards, so they never join the deck. */}
        {pendingCount > 0 && (
          <>
            <SectionHeader title={t('home.stats.pending')} />
            <View style={[styles.sectionBody, styles.pendingList]}>
              {pendingOrders.data?.map((order, i) => (
                <NfcIdCard
                  key={`order-${order.id}`}
                  code={order.code}
                  state="pending"
                  layout="row"
                  index={i}
                  onPress={() =>
                    tabNavigation?.navigate('IdTab', {
                      screen: 'PurchaseResult',
                      params: { code: order.code, orderId: order.id },
                    })
                  }
                />
              ))}
            </View>
          </>
        )}

        {/* The four actions performed most often, one tap from anywhere. */}
        <View style={styles.quickRow}>
          <QuickAction icon="plus" label={t('tab.id')} onPress={goToIdTab} highlight />
          <QuickAction icon="wifi" label={t('nfc.read')} onPress={goToNfcRead} />
          <QuickAction icon="trending-up" label={t('tab.auction')} onPress={goToAuctionTab} />
          <QuickAction icon="briefcase" label={t('tab.company')} onPress={goToCompanyTab} />
        </View>

        {/* B. Mening ID'larim — the rest of the wallet, fanned. */}
        {deck.length > 1 && (
          <>
            <SectionHeader title={t('home.myIds')} onSeeAll={goToMyIds} seeAllLabel={t('common.all')} />
            <NfcCardStack items={deck} />
          </>
        )}

        <NfcInfoCard style={styles.infoCard} />

        {/* C. Auksion */}
        <SectionHeader title={t('home.auctions')} onSeeAll={goToAuctionTab} seeAllLabel={t('common.all')} />
        {auctions.isLoading ? (
          <View style={styles.sectionBody}>
            <PremiumLoadingSkeleton height={110} />
          </View>
        ) : !auctions.data?.length ? (
          <View style={styles.sectionBody}>
            <PremiumCard variant="sunken">
              <Text style={styles.mutedTitle}>{t('home.noAuctions')}</Text>
              <Text style={styles.mutedText}>Yangi auksionlar shu yerda birinchi bo'lib ko'rinadi.</Text>
            </PremiumCard>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carousel}>
            {auctions.data.map((auction, i) => (
              <AuctionPreviewCard
                key={auction.id}
                auction={auction}
                index={i}
                onPress={() =>
                  tabNavigation?.navigate('AuctionTab', {
                    screen: 'AuctionDetail',
                    params: { auctionId: auction.id },
                  })
                }
              />
            ))}
          </ScrollView>
        )}

        {/* D. Kompaniya */}
        <SectionHeader title={t('home.company')} />
        <View style={styles.sectionBody}>
          {companies.isLoading ? (
            <PremiumLoadingSkeleton height={96} />
          ) : companies.data?.length ? (
            <PremiumCard style={depth.card}>
              <Text style={styles.companyName} numberOfLines={1}>
                {safeText(companies.data[0].displayName)}
              </Text>
              <Text style={styles.companyMeta} numberOfLines={1}>
                #{safeText(companies.data[0].companyId)} · {safeText(companies.data[0].city, '')}
              </Text>
              <PremiumButton
                label={t('common.manage')}
                variant="ghost"
                onPress={() =>
                  tabNavigation?.navigate('CompanyTab', {
                    screen: 'CompanyDashboard',
                    params: { companyId: companies.data![0].companyId },
                  })
                }
                style={styles.companyButton}
              />
            </PremiumCard>
          ) : (
            <PremiumEmptyState
              icon="briefcase"
              title={t('home.noCompany')}
              ctaLabel={t('home.createCompany')}
              onPressCta={goToCompanyTab}
            />
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

function SectionHeader({
  title,
  onSeeAll,
  seeAllLabel,
}: {
  title: string;
  onSeeAll?: () => void;
  seeAllLabel?: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {!!onSeeAll && (
        <Pressable onPress={onSeeAll} accessibilityRole="button" hitSlop={8}>
          <Text style={styles.seeAll}>{seeAllLabel ?? 'Barchasi'}</Text>
        </Pressable>
      )}
    </View>
  );
}

/** An icon tile: glass over the floor, the icon in a lit well. The primary
 * action carries its own gold glow so the eye lands there first. */
function QuickAction({
  icon,
  label,
  onPress,
  highlight = false,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  onPress: () => void;
  highlight?: boolean;
}) {
  return (
    <NfcPressable
      radius={radius.md}
      onPress={() => {
        haptics.selection();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={styles.quickSlot}
    >
      <View style={[styles.quickShadow, highlight && styles.quickShadowHighlight]}>
        <View style={[styles.quickAction, highlight && styles.quickActionHighlight]}>
          <LinearGradient
            colors={gradient.cardSurface}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.7, y: 1 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <LinearGradient
            colors={gradient.cardGlass}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <LinearGradient colors={highlight ? QUICK_LIP_GOLD : QUICK_LIP} style={styles.quickLip} pointerEvents="none" />
          <View style={[styles.quickWell, highlight && styles.quickWellHighlight]}>
            <Feather name={icon} size={18} color={highlight ? color.goldHighlight : color.textPrimary} />
          </View>
          <Text style={[styles.quickLabel, highlight && styles.quickLabelHighlight]} numberOfLines={1}>
            {label}
          </Text>
        </View>
      </View>
    </NfcPressable>
  );
}

function IconAction({
  icon,
  label,
  onPress,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  onPress: () => void;
}) {
  return (
    <NfcPressable radius={radius.pill} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <View style={styles.iconAction}>
        <Feather name={icon} size={18} color={color.textPrimary} />
      </View>
    </NfcPressable>
  );
}

const QUICK_LIP = ['rgba(255,255,255,0.12)', 'transparent'] as const;
const QUICK_LIP_GOLD = ['rgba(255,238,196,0.32)', 'transparent'] as const;

const styles = StyleSheet.create({
  // Near-black floor: the metal only reads as metal against it.
  floor: { backgroundColor: color.bgDeep },
  body: { paddingBottom: space.xxxl, gap: space.md },
  ambient: { position: 'absolute', top: 0, left: 0, right: 0 },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
  },
  headerText: { flex: 1 },
  brand: { ...typeTokens.overline, color: color.gold },
  greeting: { ...typeTokens.h2, color: color.textPrimary, marginTop: 2 },
  iconAction: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    ...depth.chip,
  },

  heroOverline: { ...typeTokens.overline, color: color.gold, paddingHorizontal: space.lg, marginTop: space.sm },
  heroBody: { paddingHorizontal: space.md },

  heroEmptyChip: { marginBottom: space.md },
  heroEmptyTitle: { ...typeTokens.h2, color: color.textPrimary },
  heroEmptyText: { ...typeTokens.body, color: color.textSecondary, marginTop: space.xs },
  heroCta: { marginTop: space.lg },

  statsRow: { flexDirection: 'row', gap: space.sm, paddingHorizontal: space.lg },

  pendingList: { gap: space.sm },

  quickRow: { flexDirection: 'row', gap: space.sm, paddingHorizontal: space.lg },
  quickSlot: { flex: 1 },
  quickShadow: { borderRadius: radius.md, ...depth.chip },
  quickShadowHighlight: { boxShadow: '0 2px 6px rgba(0,0,0,0.5), 0 0 22px rgba(212,175,90,0.30), 0 0 0 1px rgba(212,175,90,0.35)' },
  quickAction: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: space.md,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  quickActionHighlight: { borderColor: color.borderGold },
  quickLip: { position: 'absolute', top: 0, left: 0, right: 0, height: 2 },
  quickWell: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  quickWellHighlight: {
    backgroundColor: color.goldMuted,
    borderColor: color.borderGold,
    boxShadow: '0 0 16px rgba(212,175,90,0.55)',
  },
  quickLabel: { ...typeTokens.caption, color: color.textSecondary },
  quickLabelHighlight: { color: color.gold },

  infoCard: { marginHorizontal: space.lg },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.sm,
    paddingHorizontal: space.lg,
  },
  sectionTitle: { ...typeTokens.h2, color: color.textPrimary },
  seeAll: { ...typeTokens.caption, color: color.gold },
  carousel: { paddingHorizontal: space.lg, paddingVertical: space.xs },
  sectionBody: { paddingHorizontal: space.lg },

  mutedTitle: { ...typeTokens.bodyStrong, color: color.textSecondary },
  mutedText: { ...typeTokens.caption, color: color.textTertiary, marginTop: space.xs },

  companyName: { ...typeTokens.h2, color: color.textPrimary },
  companyMeta: { ...typeTokens.caption, color: color.textSecondary, marginTop: 2 },
  companyButton: { marginTop: space.md },
});
