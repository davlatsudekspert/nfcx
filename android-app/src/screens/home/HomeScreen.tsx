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
import { AuctionPreviewCard } from '../../composites/AuctionPreviewCard';
import { useAuthStore } from '../../state/authStore';
import { useAuctionsPreview } from '../../hooks/useAuctions';
import { useMyCompanies } from '../../hooks/useMyCompanies';
import { ordersApi } from '../../api/orders';
import { formatCount, safeText, toFiniteNumber } from '../../lib/format';
import { haptics } from '../../native/haptics';
import { useT } from '../../i18n';
import { color, gradient, radius, space, type as typeTokens } from '../../design-system/tokens';

type Props = NativeStackScreenProps<HomeStackParamList, 'Home'>;

/**
 * The personal NFC dashboard (brief §6) — not a list of links.
 *
 * Order is deliberate and fixed: identity first — and identity here is the
 * user's actual deck of metal cards, stacked the way it would sit in a
 * wallet — then the numbers behind it, the four actions they perform most,
 * and finally the data sections. Everything below the deck is real API data
 * or an honest empty state; nothing here is seeded or illustrative.
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
          style={[styles.ambient, { height: 220 + insets.top }]}
          pointerEvents="none"
        />

        <View style={[styles.headerRow, { paddingTop: insets.top + space.md }]}>
          <View style={styles.headerText}>
            <Text style={styles.brand}>NFCSTORE</Text>
            <Text style={styles.greeting} numberOfLines={1}>
              {user?.email ? safeText(user.email) : 'Xush kelibsiz'}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <IconAction
              icon="bell"
              label={t('profile.notifications')}
              onPress={() => tabNavigation?.navigate('ProfileTab', { screen: 'Notifications' })}
            />
            <IconAction icon="user" label={t('tab.profile')} onPress={goToMyIds} />
          </View>
        </View>

        {/* A. Mening ID'larim — the deck itself is the hero. */}
        {deck.length > 0 ? (
          <>
            <SectionHeader title={t('home.myIds')} onSeeAll={goToMyIds} seeAllLabel={t('common.all')} />
            <View style={styles.sectionBody}>
              <NfcCardStack items={deck} />
            </View>

            <View style={styles.statsRow}>
              <Stat label={t('owner.views')} value={formatCount(totalViews)} />
              <Stat label={t('home.stats.ids')} value={formatCount(cards.length)} />
              <Stat label={t('home.stats.pending')} value={formatCount(pendingCount)} />
            </View>
          </>
        ) : (
          <View style={styles.sectionBody}>
            <PremiumCard variant="featured">
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

        {/* B. Auksion */}
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

        {/* C. Kompaniya */}
        <SectionHeader title={t('home.company')} />
        <View style={styles.sectionBody}>
          {companies.isLoading ? (
            <PremiumLoadingSkeleton height={96} />
          ) : companies.data?.length ? (
            <PremiumCard>
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

/** A number that belongs to the deck, printed on the black floor rather than
 * on the metal — the cards themselves stay clean. */
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.statLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

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
    <Pressable
      onPress={() => {
        haptics.selection();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.quickAction, highlight && styles.quickActionHighlight, pressed && styles.pressed]}
    >
      <Feather name={icon} size={18} color={highlight ? color.gold : color.textPrimary} />
      <Text style={[styles.quickLabel, highlight && styles.quickLabelHighlight]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
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
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.iconAction, pressed && styles.pressed]}
    >
      <Feather name={icon} size={18} color={color.textPrimary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Near-black floor: the metal only reads as metal against it.
  floor: { backgroundColor: color.bgDeep },
  body: { paddingBottom: space.xxxl, gap: space.md },
  ambient: { position: 'absolute', top: 0, left: 0, right: 0 },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
  },
  headerText: { flex: 1 },
  brand: { ...typeTokens.overline, color: color.gold },
  greeting: { ...typeTokens.h2, color: color.textPrimary, marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: space.sm },
  iconAction: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
  },
  pressed: { opacity: 0.7 },

  heroEmptyTitle: { ...typeTokens.h2, color: color.textPrimary },
  heroEmptyText: { ...typeTokens.body, color: color.textSecondary, marginTop: space.xs },
  heroCta: { marginTop: space.lg },

  statsRow: { flexDirection: 'row', gap: space.xl, paddingHorizontal: space.lg, marginTop: space.xs },
  stat: {},
  statValue: { ...typeTokens.h2, color: color.gold },
  statLabel: { ...typeTokens.caption, color: color.textTertiary, marginTop: 2 },

  pendingList: { gap: space.sm },

  quickRow: { flexDirection: 'row', gap: space.sm, paddingHorizontal: space.lg },
  quickAction: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: space.md,
    borderRadius: radius.md,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
  },
  quickActionHighlight: { borderColor: color.borderGold, backgroundColor: color.goldWash },
  quickLabel: { ...typeTokens.caption, color: color.textSecondary },
  quickLabelHighlight: { color: color.gold },

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
