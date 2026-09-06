import React, { useMemo, useState } from 'react';
import { Image, Linking, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import type { CompanyStackParamList } from '../../navigation/types';
import { CompanyScreen } from './CompanyScreen';
import { PremiumCard } from '../../design-system/components/PremiumCard';
import { PremiumButton } from '../../design-system/components/PremiumButton';
import { PremiumQueryState } from '../../design-system/components/PremiumQueryState';
import { ContactButtons, buildContactButtons } from '../../composites/ContactButtons';
import { CompanyCover, CompanyLogo, CompanyStatusChip, InfoRow, NoticeLine, SectionHeader } from './CompanyVisuals';
import { useCompany } from '../../hooks/useMyCompanies';
import { useAuthStore } from '../../state/authStore';
import { categoryLabel, companyPublicUrl, normalizeWebsite } from './companyForm';
import { formatCount, formatSom, safeText, toFiniteNumber } from '../../lib/format';
import { color, radius, space, type as typeTokens } from '../../design-system/tokens';
import type { Company, CompanyCatalogItem } from '../../api/types';

type Props = NativeStackScreenProps<CompanyStackParamList, 'PublicCompany'>;

const PAGE_SIZE = 30;

/**
 * Deep-link target for nfcstore.uz/company/:id (android/docs/03-ARCHITECTURE.md
 * §3.5) and the owner's own preview. The Worker 404s a non-owner viewing a
 * non-active company, so the error/empty state here mirrors that real
 * behaviour instead of inventing placeholder content — and when the owner is
 * looking at an inactive page, it says so out loud.
 */
export function PublicCompanyScreen({ route, navigation }: Props) {
  const { companyId } = route.params;
  const company = useCompany(companyId);
  const c = company.data;

  const onShare = async () => {
    try {
      await Share.share({ message: companyPublicUrl(companyId), url: companyPublicUrl(companyId) });
    } catch {
      /* dismissed */
    }
  };

  return (
    <CompanyScreen
      title={safeText(c?.displayName, 'Kompaniya')}
      onBack={navigation.canGoBack() ? navigation.goBack : undefined}
      refreshing={company.isRefetching}
      onRefresh={() => void company.refetch()}
      actions={
        c?.status === 'active'
          ? [{ icon: 'share-2', accessibilityLabel: 'Ulashish', onPress: () => void onShare() }]
          : undefined
      }
    >
      <PremiumQueryState
        isLoading={company.isLoading}
        isError={company.isError}
        error={company.error}
        onRetry={() => void company.refetch()}
        onUnauthorized={() => void useAuthStore.getState().logout()}
        isEmpty={company.isSuccess && !c}
        emptyIcon="briefcase"
        emptyTitle="Kompaniya sahifasi mavjud emas"
        emptyDescription="Bu Company ID topilmadi yoki sahifa hali faollashmagan."
        skeletonRows={3}
        skeletonHeight={140}
      >
        {c ? <PublicBody company={c} /> : null}
      </PremiumQueryState>
    </CompanyScreen>
  );
}

function PublicBody({ company: c }: { company: Company }) {
  const [visible, setVisible] = useState(PAGE_SIZE);

  const catalog = useMemo(() => {
    const raw = Array.isArray(c.items) ? c.items : [];
    return raw
      .filter((i) => i.available !== false)
      .slice()
      .sort((a, b) => (toFiniteNumber(a.sortOrder) ?? 0) - (toFiniteNumber(b.sortOrder) ?? 0));
  }, [c.items]);

  const gallery = Array.isArray(c.gallery) ? c.gallery.filter((g) => typeof g === 'string' && g.trim() !== '') : [];
  const contactButtons = buildContactButtons({
    phone: c.phone,
    tg: c.telegram,
    whatsapp: c.whatsapp,
    email: undefined,
  });
  const website = normalizeWebsite(c.website);
  const meta = [safeText(c.city, ''), categoryLabel(c.category)].filter(Boolean).join(' · ');

  return (
    <>
      {c.status !== 'active' && (
        <NoticeLine
          icon="eye-off"
          tone="warning"
          text="Bu sahifa hali faol emas — hozircha faqat egasi ko'ra oladi."
        />
      )}

      <PremiumCard variant="featured" animate={false} contentStyle={styles.heroContent}>
        <View>
          <CompanyCover coverUrl={c.coverUrl} height={140} />
          {c.status !== 'active' && (
            <View style={styles.chipOverlay}>
              <CompanyStatusChip status={c.status} compact />
            </View>
          )}
        </View>
        <View style={styles.heroBody}>
          <View style={styles.heroRow}>
            <CompanyLogo logoUrl={c.logoUrl} displayName={c.displayName} size={62} style={styles.heroLogo} />
            <View style={styles.heroText}>
              <Text style={styles.heroName} numberOfLines={2}>
                {safeText(c.displayName)}
              </Text>
              <Text style={styles.heroId} numberOfLines={1}>
                #{safeText(c.companyId)}
              </Text>
            </View>
          </View>
          {!!meta && (
            <Text style={styles.heroMeta} numberOfLines={1}>
              {meta}
            </Text>
          )}
          {!!c.subcategory && (
            <Text style={styles.heroSub} numberOfLines={1}>
              {c.subcategory}
            </Text>
          )}
        </View>
      </PremiumCard>

      {!!safeText(c.description, '').trim() && (
        <PremiumCard animate={false}>
          <SectionHeader title="KOMPANIYA HAQIDA" />
          <Text style={styles.description}>{c.description}</Text>
        </PremiumCard>
      )}

      {gallery.length > 0 && (
        <View>
          <SectionHeader title="GALEREYA" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.galleryRow}>
            {gallery.map((uri) => (
              <Image key={uri} source={{ uri }} style={styles.galleryImage} resizeMode="cover" />
            ))}
          </ScrollView>
        </View>
      )}

      {catalog.length > 0 && (
        <PremiumCard animate={false}>
          <SectionHeader title={`KATALOG · ${formatCount(catalog.length)}`} />
          <View style={styles.catalogList}>
            {catalog.slice(0, visible).map((item) => (
              <CatalogEntry key={item.id} item={item} />
            ))}
          </View>
          {catalog.length > visible && (
            <PremiumButton
              label="Yana ko'rsatish"
              variant="ghost"
              onPress={() => setVisible((v) => v + PAGE_SIZE)}
              style={styles.moreButton}
            />
          )}
        </PremiumCard>
      )}

      {(!!c.address || !!website) && (
        <PremiumCard animate={false}>
          <SectionHeader title="MANZIL VA HAVOLALAR" />
          <InfoRow icon="map-pin" label="Manzil" value={c.address} multiline />
          <InfoRow
            icon="globe"
            label="Veb-sayt"
            value={website}
            onPress={website ? () => void Linking.openURL(website).catch(() => {}) : undefined}
          />
        </PremiumCard>
      )}

      {contactButtons.length > 0 && (
        <View style={styles.contactSection}>
          <SectionHeader title="BOG'LANISH" />
          <ContactButtons items={contactButtons} />
        </View>
      )}
    </>
  );
}

function CatalogEntry({ item }: { item: CompanyCatalogItem }) {
  const hasPromo = toFiniteNumber(item.promotionPrice) != null;

  return (
    <View style={styles.entry}>
      {item.imageUrl ? (
        <Image source={{ uri: item.imageUrl }} style={styles.entryImage} resizeMode="cover" />
      ) : (
        <View style={[styles.entryImage, styles.entryImageEmpty]}>
          <Feather name="tag" size={16} color={color.textTertiary} />
        </View>
      )}
      <View style={styles.entryText}>
        <Text style={styles.entryName} numberOfLines={1}>
          {safeText(item.name)}
        </Text>
        {!!item.description && (
          <Text style={styles.entryDescription} numberOfLines={2}>
            {item.description}
          </Text>
        )}
      </View>
      <View style={styles.entryPrices}>
        <Text style={styles.entryPrice}>{formatSom(hasPromo ? item.promotionPrice : item.price)}</Text>
        {hasPromo && <Text style={styles.entryPriceOld}>{formatSom(item.price)}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  heroContent: { padding: 0 },
  chipOverlay: { position: 'absolute', top: space.md, right: space.md },
  heroBody: { padding: space.lg, paddingTop: 0, marginTop: -26 },
  heroRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.md },
  heroLogo: { borderWidth: 2, borderColor: color.bg },
  heroText: { flex: 1, paddingBottom: 2 },
  heroName: { ...typeTokens.h1, fontSize: 20, lineHeight: 26, color: color.textPrimary },
  heroId: { ...typeTokens.mono, fontSize: 13, color: color.gold },
  heroMeta: { ...typeTokens.caption, color: color.textSecondary, marginTop: space.md },
  heroSub: { ...typeTokens.caption, color: color.textTertiary, marginTop: 2 },

  description: { ...typeTokens.body, color: color.textSecondary, lineHeight: 21 },

  galleryRow: { gap: space.sm, paddingRight: space.lg },
  galleryImage: { width: 132, height: 96, borderRadius: radius.md, backgroundColor: color.surfaceHigh },

  catalogList: { gap: space.md },
  entry: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  entryImage: { width: 46, height: 46, borderRadius: radius.sm, backgroundColor: color.surfaceHigh },
  entryImageEmpty: { alignItems: 'center', justifyContent: 'center' },
  entryText: { flex: 1 },
  entryName: { ...typeTokens.bodyStrong, color: color.textPrimary },
  entryDescription: { ...typeTokens.caption, color: color.textSecondary, marginTop: 2, lineHeight: 16 },
  entryPrices: { alignItems: 'flex-end' },
  entryPrice: { ...typeTokens.bodyStrong, color: color.gold },
  entryPriceOld: { ...typeTokens.caption, color: color.textTertiary, textDecorationLine: 'line-through' },
  moreButton: { marginTop: space.md },

  contactSection: { gap: space.sm },
});
