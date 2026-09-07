import React from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { ProfileStackParamList, MainTabParamList } from '../../navigation/types';
import { PremiumHeader } from '../../design-system/components/PremiumHeader';
import { PremiumCard } from '../../design-system/components/PremiumCard';
import { PremiumButton } from '../../design-system/components/PremiumButton';
import { PremiumEmptyState } from '../../design-system/components/PremiumEmptyState';
import { PremiumQueryState } from '../../design-system/components/PremiumQueryState';
import { NfcIdCard } from '../../composites/NfcIdCard';
import { HeroStatChip } from '../../composites/HeroStatChip';
import { useAuthStore } from '../../state/authStore';
import { useMyOrders } from '../../hooks/useMyOrders';
import { ORDER_STATUS_LABEL, orderStatus } from '../id/orderStatus';
import { formatCount, formatSom, safeText } from '../../lib/format';
import { useT } from '../../i18n';
import { color, depth, space, type as typeTokens } from '../../design-system/tokens';

type Props = NativeStackScreenProps<ProfileStackParamList, 'MyProfile'>;

/**
 * "Mening ID'larim" — every NFC ID the user actually owns, each opening its
 * own workspace.
 *
 * The owned list comes from the auth store's `cards` (GET /api/auth/me), the
 * only confirmed source of ownership. Pending purchases come from
 * GET /api/orders and are shown as a *separate* section, because a pending
 * `web_orders` row is not an owned card — conflating the two is exactly the
 * kind of fake-success this product must not ship.
 *
 * Presentation: a flat list of metal cards, deliberately NOT the Home
 * screen's fanned wallet. This is the management screen — every ID here is
 * a door into its own workspace, so all of them stay visible and one tap
 * away, each with its tier medallion, serif code, owner name and the small
 * numbers that matter; a deck would trade that for depth the user did not
 * ask for.
 */
export function MyProfileScreen({ navigation }: Props) {
  const t = useT();
  const cards = useAuthStore((s) => s.cards);
  const refreshAuth = useAuthStore((s) => s.refresh);
  const tabNavigation = navigation.getParent<BottomTabNavigationProp<MainTabParamList>>();
  const [refreshing, setRefreshing] = React.useState(false);

  // Payable orders only (`isPayableOrder`), re-checked on every focus and
  // foreground so a cancellation made on the website is not shown as pending.
  const { query: orders, pendingOrders: payableOrders } = useMyOrders();

  const ownedCodes = React.useMemo(() => new Set(cards.map((c) => c.code)), [cards]);
  // The primary ID leads the list, matching the deck on the Home dashboard.
  const orderedCards = React.useMemo(
    () => [...cards].sort((a, b) => Number(b.isPrimary === true) - Number(a.isPrimary === true)),
    [cards],
  );
  // A code the user already owns is a card, not a pending order, whatever
  // the order row says.
  const pendingOrders = React.useMemo(
    () => payableOrders.filter((o) => !ownedCodes.has(o.code)),
    [payableOrders, ownedCodes],
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.allSettled([refreshAuth(), orders.refetch()]);
    setRefreshing(false);
  };

  const goToIdSearch = () => tabNavigation?.navigate('IdTab', { screen: 'IdSearch' });
  const totalViews = cards.reduce((sum, c) => sum + (typeof c.views === 'number' ? c.views : 0), 0);

  const header = (
    <PremiumHeader
      title={t('profile.myIds')}
      actions={[{ icon: 'settings', accessibilityLabel: t('profile.settings'), onPress: () => navigation.navigate('Settings') }]}
    />
  );

  if (!cards.length && pendingOrders.length === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
        {header}
        <PremiumEmptyState
          icon="hash"
          title={t('home.emptyIds')}
          description={t('home.emptyIdsHint')}
          ctaLabel={t('home.chooseId')}
          onPressCta={goToIdSearch}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']}>
      {header}
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={color.gold} />}
      >
        <View style={styles.summaryRow}>
          <HeroStatChip icon="hash" tone="gold" value={formatCount(cards.length)} label={t('home.stats.ids')} />
          <HeroStatChip icon="eye" tone="blue" value={formatCount(totalViews)} label={t('owner.views')} />
          <HeroStatChip
            icon="clock"
            tone="amber"
            value={formatCount(pendingOrders.length)}
            label={t('home.stats.pending')}
          />
        </View>

        {cards.length > 0 && (
          <>
            <SectionTitle title={t('profile.myIds')} />
            <View style={styles.list}>
              {orderedCards.map((card, i) => (
                <NfcIdCard
                  key={card.code}
                  code={card.code}
                  name={card.name}
                  state="owned"
                  layout="list"
                  index={i}
                  isPrimary={card.isPrimary === true}
                  profileType={card.profileType}
                  views={card.views}
                  verified={card.verified === true}
                  onPress={() => navigation.navigate('IdOwnerWorkspace', { code: card.code })}
                />
              ))}
            </View>
          </>
        )}

        <SectionTitle title="Kutilayotgan buyurtmalar" />
        <PremiumQueryState
          isLoading={orders.isLoading}
          isError={orders.isError}
          error={orders.error}
          isEmpty={!orders.isLoading && !orders.isError && pendingOrders.length === 0}
          onRetry={() => orders.refetch()}
          onUnauthorized={() => {
            void refreshAuth().catch(() => {});
          }}
          emptyIcon="check-circle"
          emptyTitle="Kutilayotgan buyurtma yo'q"
          emptyDescription="Yangi ID band qilsangiz, u shu yerda ko'rinadi."
          skeletonRows={1}
          skeletonHeight={92}
        >
          <View style={styles.list}>
            {pendingOrders.map((order, i) => (
              <NfcIdCard
                key={order.id}
                code={order.code}
                name={formatSom(order.price)}
                state="pending"
                layout="row"
                index={i}
                statusLabel={ORDER_STATUS_LABEL[orderStatus(order)]}
                onPress={() =>
                  tabNavigation?.navigate('IdTab', {
                    screen: 'PurchaseResult',
                    params: { code: order.code, orderId: order.id },
                  })
                }
              />
            ))}
          </View>
        </PremiumQueryState>

        <PremiumCard variant="sunken" style={styles.ctaCard}>
          <Text style={styles.ctaTitle}>Yana ID kerakmi?</Text>
          <Text style={styles.ctaText}>
            Har bir NFC ID o'z profili, kontaktlari va statistikasi bilan alohida boshqariladi.
          </Text>
          <PremiumButton label={t('home.newId')} variant="ghost" onPress={goToIdSearch} style={styles.ctaButton} />
        </PremiumCard>
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{safeText(title).toUpperCase()}</Text>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.bgDeep },
  content: { padding: space.lg, paddingBottom: space.xxxl, gap: space.md },
  summaryRow: { flexDirection: 'row', gap: space.sm },
  sectionTitle: { ...typeTokens.overline, color: color.gold, marginTop: space.md },
  list: { gap: space.md },
  ctaCard: { marginTop: space.lg, ...depth.card },
  ctaTitle: { ...typeTokens.h3, color: color.textPrimary },
  ctaText: { ...typeTokens.caption, color: color.textTertiary, marginTop: space.xs },
  ctaButton: { marginTop: space.md },
});
