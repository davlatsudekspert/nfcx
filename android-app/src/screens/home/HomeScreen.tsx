import React from 'react';
import { StyleSheet, Text, View, ScrollView } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useQuery } from '@tanstack/react-query';
import type { HomeStackParamList, MainTabParamList } from '../../navigation/types';
import { ScreenContainer } from '../shared/ScreenContainer';
import { PremiumHeader } from '../../design-system/components/PremiumHeader';
import { PremiumButton } from '../../design-system/components/PremiumButton';
import { PremiumCard } from '../../design-system/components/PremiumCard';
import { PremiumEmptyState } from '../../design-system/components/PremiumEmptyState';
import { PremiumStatCard } from '../../design-system/components/PremiumStatCard';
import { NfcIdCard } from '../../composites/NfcIdCard';
import { AuctionPreviewCard } from '../../composites/AuctionPreviewCard';
import { useAuthStore } from '../../state/authStore';
import { useAuctionsPreview } from '../../hooks/useAuctions';
import { useMyCompanies } from '../../hooks/useMyCompanies';
import { ordersApi } from '../../api/orders';
import { color, space, type as typeTokens } from '../../design-system/tokens';

type Props = NativeStackScreenProps<HomeStackParamList, 'Home'>;

/**
 * Premium dashboard — brief §6. Deliberately shows 4 sections and nothing
 * more ("Home'da juda ko'p ma'lumot tiqishtirma"): My IDs, New ID CTA,
 * live Auctions, Company summary.
 */
export function HomeScreen({ navigation }: Props) {
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

  return (
    <ScreenContainer scroll={false} padded={false}>
      <PremiumHeader
        title="NFCSTORE"
        actions={[
          {
            icon: 'bell',
            accessibilityLabel: 'Bildirishnomalar',
            onPress: () => tabNavigation?.navigate('ProfileTab', { screen: 'Notifications' }),
          },
          {
            icon: 'user',
            accessibilityLabel: 'Profil',
            onPress: () => tabNavigation?.navigate('ProfileTab', { screen: 'MyProfile' }),
          },
        ]}
      />

      <ScrollView contentContainerStyle={styles.body}>
        {!!user && (
          <View style={styles.statsRow}>
            <PremiumStatCard label="ID'lar" value={cards.length} />
            <PremiumStatCard label="Kutilayotgan" value={pendingOrders.data?.length ?? 0} loading={pendingOrders.isLoading} />
          </View>
        )}

        {/* A. Mening ID'larim */}
        <SectionHeader title="Mening ID'larim" />
        {cards.length === 0 && !pendingOrders.data?.length ? (
          <PremiumEmptyState
            icon="hash"
            title="Hali NFC ID'ingiz yo'q"
            description="Birinchi ID'ingizni tanlang va profilingizni yarating."
            ctaLabel="ID tanlash"
            onPressCta={goToIdTab}
          />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.carousel}>
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
                onPress={() => tabNavigation?.navigate('IdTab', { screen: 'PurchaseResult', params: { code: order.code, orderId: order.id } })}
              />
            ))}
          </ScrollView>
        )}

        {/* B. Yangi NFC ID */}
        <PremiumButton label="+ Yangi NFC ID" onPress={goToIdTab} style={styles.newIdButton} />

        {/* C. Auksion */}
        <SectionHeader title="Auksion" onSeeAll={goToAuctionTab} />
        {auctions.isLoading ? (
          <PremiumCard loading style={styles.loadingCard} />
        ) : !auctions.data?.length ? (
          <PremiumEmptyState icon="trending-up" title="Hozircha faol auksion yo'q" />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.carousel}>
            {auctions.data.map((auction, i) => (
              <AuctionPreviewCard
                key={auction.id}
                auction={auction}
                index={i}
                onPress={() => tabNavigation?.navigate('AuctionTab', { screen: 'AuctionDetail', params: { auctionId: auction.id } })}
              />
            ))}
          </ScrollView>
        )}

        {/* D. Kompaniya */}
        <SectionHeader title="Kompaniya" />
        {companies.isLoading ? (
          <PremiumCard loading />
        ) : companies.data?.length ? (
          <PremiumCard>
            <Text style={styles.companyName}>{companies.data[0].displayName}</Text>
            <Text style={styles.companyMeta}>#{companies.data[0].companyId} · {companies.data[0].status}</Text>
            <PremiumButton
              label="Boshqarish"
              variant="ghost"
              onPress={() => tabNavigation?.navigate('CompanyTab', { screen: 'CompanyDashboard', params: { companyId: companies.data![0].companyId } })}
              style={styles.companyButton}
            />
          </PremiumCard>
        ) : (
          <PremiumEmptyState
            icon="briefcase"
            title="Kompaniya profilingiz yo'q"
            ctaLabel="Kompaniya ID yaratish"
            onPressCta={goToCompanyTab}
          />
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

function SectionHeader({ title, onSeeAll }: { title: string; onSeeAll?: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {!!onSeeAll && (
        <PremiumButton label="Barchasi" variant="ghost" fullWidth={false} onPress={onSeeAll} style={styles.seeAllButton} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: space.lg, paddingBottom: space.xxxl, gap: space.md },
  statsRow: { flexDirection: 'row', gap: space.md, marginBottom: space.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.md },
  sectionTitle: { ...typeTokens.h2, color: color.textPrimary },
  seeAllButton: { paddingHorizontal: space.sm, minHeight: 32 },
  carousel: { marginTop: space.sm },
  newIdButton: { marginTop: space.xs },
  loadingCard: { height: 96 },
  companyName: { ...typeTokens.h2, color: color.textPrimary },
  companyMeta: { ...typeTokens.caption, color: color.textSecondary, marginTop: 2 },
  companyButton: { marginTop: space.sm },
});
