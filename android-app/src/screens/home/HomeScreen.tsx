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
import { PremiumBadge, TierBadge } from '../../design-system/components/PremiumBadge';
import { PremiumEmptyState } from '../../design-system/components/PremiumEmptyState';
import { PremiumLoadingSkeleton } from '../../design-system/components/PremiumLoadingSkeleton';
import { NfcIdCard } from '../../composites/NfcIdCard';
import { AuctionPreviewCard } from '../../composites/AuctionPreviewCard';
import { useAuthStore } from '../../state/authStore';
import { useAuctionsPreview } from '../../hooks/useAuctions';
import { useMyCompanies } from '../../hooks/useMyCompanies';
import { ordersApi } from '../../api/orders';
import { tierForCode } from '../../lib/pricing';
import { formatCount, safeText } from '../../lib/format';
import { haptics } from '../../native/haptics';
import { useT } from '../../i18n';
import { color, gradient, radius, space, type as typeTokens } from '../../design-system/tokens';

type Props = NativeStackScreenProps<HomeStackParamList, 'Home'>;

/**
 * The personal NFC dashboard (brief §6) — not a list of links.
 *
 * Order is deliberate and fixed: identity first (the primary NFC ID the user
 * actually hands to people), then the four actions they perform most, then
 * the three data sections. Everything below the hero is real API data or an
 * honest empty state; nothing here is seeded or illustrative.
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

  // The card the user actually hands to people. `isPrimary` is a real field on
  // the record (GET /api/auth/me); with none set, the first owned card is the
  // de-facto primary — the same fallback the web app uses.
  const primary = cards.find((c) => c.isPrimary) ?? cards[0];
  const pendingCount = pendingOrders.data?.length ?? 0;

  return (
    <ScreenContainer scroll={false} padded={false}>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
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

        {/* Hero — the primary NFC identity, or the first-purchase CTA. */}
        {primary ? (
          <Pressable
            onPress={() => {
              haptics.selection();
              navigation.navigate('PublicProfile', { code: primary.code });
            }}
            accessibilityRole="button"
            accessibilityLabel={`${primary.code} profilini ochish`}
          >
            <PremiumCard variant="featured" style={styles.hero} contentStyle={styles.heroContent}>
              <View style={styles.heroTopRow}>
                <PremiumBadge label={t('owner.primary')} tone="gold" />
                <TierBadge tier={tierForCode(primary.code)} />
              </View>
              <Text style={styles.heroCode}>#{primary.code}</Text>
              <Text style={styles.heroName} numberOfLines={1}>
                {safeText(primary.name, '—')}
              </Text>
              {!!primary.role && (
                <Text style={styles.heroRole} numberOfLines={1}>
                  {primary.role}
                </Text>
              )}
              <View style={styles.heroMetaRow}>
                <HeroMeta label={t('owner.views')} value={formatCount(primary.views)} />
                <HeroMeta label={t('home.stats.ids')} value={formatCount(cards.length)} />
                <HeroMeta label={t('home.stats.pending')} value={formatCount(pendingCount)} />
              </View>
            </PremiumCard>
          </Pressable>
        ) : (
          <PremiumCard variant="featured" style={styles.hero}>
            <Text style={styles.heroEmptyTitle}>{t('home.emptyIds')}</Text>
            <Text style={styles.heroEmptyText}>{t('home.emptyIdsHint')}</Text>
            <PremiumButton label={t('home.chooseId')} onPress={goToIdTab} style={styles.heroCta} />
          </PremiumCard>
        )}

        {/* The four actions performed most often, one tap from anywhere. */}
        <View style={styles.quickRow}>
          <QuickAction icon="plus" label={t('tab.id')} onPress={goToIdTab} highlight />
          <QuickAction icon="wifi" label={t('nfc.read')} onPress={goToNfcRead} />
          <QuickAction icon="trending-up" label={t('tab.auction')} onPress={goToAuctionTab} />
          <QuickAction icon="briefcase" label={t('tab.company')} onPress={goToCompanyTab} />
        </View>

        {/* A. Mening ID'larim */}
        {cards.length > 0 && (
          <>
            <SectionHeader title={t('home.myIds')} onSeeAll={goToMyIds} seeAllLabel={t('common.all')} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carousel}>
              {cards.map((card, i) => (
                <NfcIdCard
                  key={card.code}
                  code={card.code}
                  name={card.name}
                  state="owned"
                  index={i}
                  onPress={() => navigation.navigate('PublicProfile', { code: card.code })}
                />
              ))}
              {pendingOrders.data?.map((order, i) => (
                <NfcIdCard
                  key={`order-${order.id}`}
                  code={order.code}
                  state="pending"
                  index={cards.length + i}
                  onPress={() =>
                    tabNavigation?.navigate('IdTab', {
                      screen: 'PurchaseResult',
                      params: { code: order.code, orderId: order.id },
                    })
                  }
                />
              ))}
            </ScrollView>
          </>
        )}

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

function HeroMeta({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.heroMeta}>
      <Text style={styles.heroMetaValue}>{value}</Text>
      <Text style={styles.heroMetaLabel} numberOfLines={1}>
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

  hero: { marginHorizontal: space.lg },
  heroContent: { padding: space.xl },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroCode: { ...typeTokens.monoLarge, color: color.textPrimary, marginTop: space.md },
  heroName: { ...typeTokens.h2, color: color.textPrimary, marginTop: space.xs },
  heroRole: { ...typeTokens.body, color: color.textSecondary, marginTop: 2 },
  heroMetaRow: { flexDirection: 'row', gap: space.xl, marginTop: space.lg },
  heroMeta: {},
  heroMetaValue: { ...typeTokens.h2, color: color.gold },
  heroMetaLabel: { ...typeTokens.caption, color: color.textSecondary, marginTop: 2 },
  heroEmptyTitle: { ...typeTokens.h2, color: color.textPrimary },
  heroEmptyText: { ...typeTokens.body, color: color.textSecondary, marginTop: space.xs },
  heroCta: { marginTop: space.lg },

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
