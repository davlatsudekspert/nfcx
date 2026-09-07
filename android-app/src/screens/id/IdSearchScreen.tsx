import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import type { IdStackParamList, MainTabParamList } from '../../navigation/types';
import { PremiumHeader } from '../../design-system/components/PremiumHeader';
import { PremiumInput } from '../../design-system/components/PremiumInput';
import { PremiumButton } from '../../design-system/components/PremiumButton';
import { PremiumCard } from '../../design-system/components/PremiumCard';
import { PremiumBadge, TierBadge } from '../../design-system/components/PremiumBadge';
import { PremiumLoadingSkeleton } from '../../design-system/components/PremiumLoadingSkeleton';
import { PremiumQueryState } from '../../design-system/components/PremiumQueryState';
import { MetalSurface } from '../../design-system/components/MetalSurface';
import { GoldMedallion, TactilePressable } from '../auction/AuctionUi';
import { recordsApi } from '../../api/records';
import { useMyOrders } from '../../hooks/useMyOrders';
import { ApiError } from '../../api/client';
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE, orderStatus } from './orderStatus';
import { usePaymentsEnabledStore } from '../../state/paymentsEnabledStore';
import {
  getPersonalPurchaseQuote,
  parseAnyCode,
  tierForCode,
  TIER_LABEL,
  TIER_PRICE,
  FREE_AUTO_ID_RE,
} from '../../lib/pricing';
import type { TierKey } from '../../lib/codeTiers';
import { formatDateTime, formatSom, safeText } from '../../lib/format';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { haptics } from '../../native/haptics';
import { useT } from '../../i18n';
import { color, depth, font, gradient, radius, space, type as typeTokens } from '../../design-system/tokens';

type Props = NativeStackScreenProps<IdStackParamList, 'IdSearch'>;

/**
 * There is no "browse available premium codes" endpoint anywhere in the live
 * API (android/docs/02-API_MAP.md) — the ID space is every AAA000
 * combination, classified on the fly by `src/lib/pricing.ts`. The chips below
 * are therefore *format examples*, not inventory: they are labelled as such
 * ('id.examples' → "Namunalar (faqat ko'rsatma uchun)") and tapping one only
 * pre-fills the checker. Presenting them as a live catalogue would be
 * fabricated data.
 */
const EXAMPLES = ['AAA100', 'BMW007', 'TAS101', 'XYZ000'];

const TIER_ORDER: TierKey[] = ['exclusive', 'premium', 'gold', 'silver', 'free'];

type Candidate =
  | { kind: 'empty' }
  | { kind: 'invalid' }
  | { kind: 'freeAuto'; code: string }
  | { kind: 'auctionOnly'; code: string }
  | { kind: 'notPurchasable'; code: string }
  | { kind: 'purchasable'; code: string; tier: Exclude<TierKey, 'exclusive'>; amount: number };

/** Pure, network-free classification of what the user typed. */
function classify(raw: string): Candidate {
  const trimmed = raw.trim();
  if (!trimmed) return { kind: 'empty' };
  const parsed = parseAnyCode(trimmed);
  if (!parsed) return { kind: 'invalid' };
  const code = parsed.code;
  if (FREE_AUTO_ID_RE.test(code)) return { kind: 'freeAuto', code };
  const quote = getPersonalPurchaseQuote(code);
  if (quote.purchasable) return { kind: 'purchasable', code, tier: quote.tier, amount: quote.amount };
  if (quote.reason === 'exclusive_auction_only') return { kind: 'auctionOnly', code };
  return { kind: 'notPurchasable', code };
}

/**
 * The sales-funnel entry point (brief §7).
 *
 * Two independent signals drive the result card and neither is faked:
 * the tier/price *preview* is computed locally by `src/lib/pricing.ts`
 * (the Worker's `personalPurchaseQuote` remains the only price authority at
 * purchase time), and availability is the real `GET /api/records/:code`
 * — 404 means free, 200 means taken.
 */
export function IdSearchScreen({ navigation }: Props) {
  const t = useT();
  const [raw, setRaw] = useState('');
  const tabNavigation = navigation.getParent<BottomTabNavigationProp<MainTabParamList>>();
  const paymentsStatus = usePaymentsEnabledStore((s) => s.status);
  const debounced = useDebouncedValue(raw, 400);

  const typing = raw.trim() !== debounced.trim();
  const candidate = useMemo(() => classify(debounced), [debounced]);
  const lookupCode = candidate.kind === 'empty' || candidate.kind === 'invalid' ? null : candidate.code;

  const availability = useQuery({
    queryKey: ['records', 'availability', lookupCode],
    queryFn: () => recordsApi.get(lookupCode as string),
    enabled: !!lookupCode,
  });

  // Order history (every status, newest first) from the shared hook — the
  // badge on each row comes from `orderStatus`, which also applies the
  // server's 24h reservation deadline, so a dead reservation never reads as
  // "To'lov kutilmoqda" here.
  const { query: orders, orders: myOrders } = useMyOrders();
  const recentOrders = myOrders.slice(0, 5);

  const availabilityError = availability.error instanceof ApiError ? availability.error : null;
  const isChecking = !!lookupCode && (availability.isLoading || typing);
  const isTaken = !!lookupCode && availability.isSuccess;
  const isFree = !!lookupCode && availabilityError?.status === 404;
  const lookupFailed = !!lookupCode && availability.isError && availabilityError?.status !== 404;

  const openProfile = (code: string) =>
    tabNavigation?.navigate('HomeTab', { screen: 'PublicProfile', params: { code } });

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']}>
      <LinearGradient colors={gradient.screenAmbient} style={styles.ambient} pointerEvents="none" />
      <PremiumHeader title={t('id.searchTitle')} onBack={navigation.canGoBack() ? navigation.goBack : undefined} />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ---------- Search ---------- */}
        <PremiumCard variant="featured" style={styles.searchCard} contentStyle={styles.searchContent}>
          <Text style={styles.heroOverline}>NFC ID TANLASH</Text>
          <Text style={styles.heroTitle}>Kerakli ID bandligini tekshiring</Text>
          {/* Breathing room on every side so the field's focus ring can glow
              without being clipped by the card. */}
          <View style={styles.searchWell}>
            <PremiumInput
              label={t('id.searchLabel')}
              value={raw}
              onChangeText={(v) => setRaw(v.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={12}
              style={styles.searchInput}
              returnKeyType="search"
            />
          </View>
          <Text style={styles.formatHint}>{t('id.formatHint')}</Text>
        </PremiumCard>

        {/* ---------- Result ---------- */}
        {candidate.kind === 'invalid' && (
          <ResultShell code={raw.trim()} tone="neutral">
            <StatusLine icon="alert-circle" tone={color.warning} text="Bu format ID emas." />
            <Text style={styles.resultBody}>{t('id.formatHint')}</Text>
          </ResultShell>
        )}

        {candidate.kind !== 'empty' && candidate.kind !== 'invalid' && (
          <ResultShell code={candidate.code} tier={tierForCode(candidate.code)}>
            {isChecking && (
              <>
                <StatusLine icon="loader" tone={color.textSecondary} text={t('id.checking')} />
                <PremiumLoadingSkeleton height={20} width="60%" />
              </>
            )}

            {!isChecking && lookupFailed && (
              <>
                <StatusLine
                  icon={availabilityError?.status === 0 ? 'wifi-off' : 'alert-triangle'}
                  tone={color.danger}
                  text={
                    availabilityError?.status === 0
                      ? t('common.offline')
                      : "Bandlikni tekshirib bo'lmadi."
                  }
                />
                <PremiumButton
                  label={t('common.retry')}
                  variant="ghost"
                  onPress={() => availability.refetch()}
                  style={styles.resultCta}
                />
              </>
            )}

            {!isChecking && isTaken && (
              <>
                <StatusLine icon="user-check" tone={color.warning} text={t('id.taken')} />
                <Text style={styles.resultBody}>
                  Egasi: {safeText(availability.data?.name, "ko'rsatilmagan")}
                </Text>
                <PremiumButton
                  label="Profilni ko'rish"
                  variant="ghost"
                  onPress={() => openProfile(candidate.code)}
                  style={styles.resultCta}
                />
              </>
            )}

            {!isChecking && isFree && candidate.kind === 'purchasable' && (
              <>
                <StatusLine icon="check-circle" tone={color.success} text={t('id.available')} />
                <View style={styles.priceRow}>
                  <Text style={styles.priceValue}>{formatSom(candidate.amount)}</Text>
                  <Text style={styles.priceNote}>taxminiy narx</Text>
                </View>
                <Text style={styles.resultBody}>
                  Yakuniy narxni server tasdiqlaydi — keyingi qadamda ko'rasiz.
                </Text>
                {paymentsStatus === 'disabled' && (
                  <View style={styles.inlineWarn}>
                    <Feather name="pause-circle" size={14} color={color.warning} />
                    <Text style={styles.inlineWarnText}>{t('payments.disabled')}</Text>
                  </View>
                )}
                <PremiumButton
                  label={t('id.select')}
                  onPress={() => {
                    haptics.medium();
                    navigation.navigate('PurchaseStep1', { code: candidate.code });
                  }}
                  style={styles.resultCta}
                />
              </>
            )}

            {!isChecking && isFree && candidate.kind === 'auctionOnly' && (
              <>
                <StatusLine icon="trending-up" tone={color.tierExclusive} text={t('id.auctionOnly')} />
                <Text style={styles.resultBody}>
                  Ekslyuziv darajadagi ID'lar to'g'ridan-to'g'ri sotilmaydi — ular auksionda taqdim etiladi.
                </Text>
                <PremiumButton
                  label={t('auction.title')}
                  variant="ghost"
                  onPress={() => tabNavigation?.navigate('AuctionTab', { screen: 'AuctionList' })}
                  style={styles.resultCta}
                />
              </>
            )}

            {!isChecking && isFree && candidate.kind === 'freeAuto' && (
              <>
                <StatusLine icon="info" tone={color.info} text="Avtomatik ID" />
                <Text style={styles.resultBody}>
                  8 xonali ID'lar ro'yxatdan o'tishda avtomatik beriladi va sotib olinmaydi.
                </Text>
              </>
            )}

            {!isChecking && isFree && candidate.kind === 'notPurchasable' && (
              <>
                <StatusLine icon="slash" tone={color.textSecondary} text={t('id.notPurchasable')} />
                <Text style={styles.resultBody}>{t('id.formatHint')}</Text>
              </>
            )}
          </ResultShell>
        )}

        {/* ---------- Examples (hints, NOT inventory) ---------- */}
        <SectionTitle title={t('id.examples')} />
        <View style={styles.examplesRow}>
          {EXAMPLES.map((example) => (
            <TactilePressable
              key={example}
              onPress={() => setRaw(example)}
              accessibilityLabel={`${example} namunasini kiritish`}
              cornerRadius={radius.pill}
            >
              <View style={styles.exampleChip}>
                <LinearGradient
                  colors={gradient.cardSurface}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0.8, y: 1 }}
                  style={StyleSheet.absoluteFill}
                  pointerEvents="none"
                />
                <View style={styles.exampleLip} pointerEvents="none" />
                <Feather name="corner-down-left" size={12} color={color.gold} />
                <Text style={styles.exampleText}>{example}</Text>
              </View>
            </TactilePressable>
          ))}
        </View>

        {/* ---------- How tiers/pricing work (real, from src/lib/pricing) ---------- */}
        <SectionTitle title="Darajalar va narxlar" />
        <PremiumCard variant="default" style={styles.tierCard} contentStyle={styles.tierContent}>
          {TIER_ORDER.map((tier, i) => (
            <View key={tier} style={[styles.tierRow, i > 0 && styles.tierRowDivided]}>
              <GoldMedallion size={26} tier={tier}>
                <Text style={styles.tierCoin}>{TIER_LABEL[tier].charAt(0)}</Text>
              </GoldMedallion>
              <View style={styles.tierBadge}>
                <TierBadge tier={tier} />
              </View>
              <Text style={[styles.tierPrice, TIER_PRICE[tier] == null && styles.tierPriceAuction]} numberOfLines={1}>
                {TIER_PRICE[tier] == null ? 'Auksion orqali' : formatSom(TIER_PRICE[tier])}
              </Text>
            </View>
          ))}
          <Text style={styles.tierNote}>
            Daraja ID'ning harf va raqam shakli bo'yicha avtomatik aniqlanadi. Ko'rsatilgan narxlar taxminiy —
            to'lovga chiqishdan oldin serverdagi yakuniy summa tasdiqlanadi.
          </Text>
        </PremiumCard>

        {/* ---------- The user's own orders (real data) ---------- */}
        <SectionTitle title="Mening buyurtmalarim" />
        <PremiumQueryState
          isLoading={orders.isLoading}
          isError={orders.isError}
          error={orders.error}
          isEmpty={!orders.isLoading && !orders.isError && recentOrders.length === 0}
          onRetry={() => orders.refetch()}
          emptyIcon="file-text"
          emptyTitle="Buyurtmalar yo'q"
          emptyDescription="Bu yerda siz band qilgan ID'lar va ularning to'lov holati ko'rinadi."
          skeletonRows={2}
          skeletonHeight={72}
        >
          <View style={styles.ordersList}>
            {recentOrders.map((order) => {
              const status = orderStatus(order);
              return (
                <TactilePressable
                  key={order.id}
                  onPress={() => navigation.navigate('PurchaseResult', { code: order.code, orderId: order.id })}
                  accessibilityLabel={`${order.code} buyurtmasi`}
                  cornerRadius={radius.md}
                >
                  <View style={styles.orderRow}>
                    <LinearGradient
                      colors={gradient.cardSurface}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 0.7, y: 1 }}
                      style={StyleSheet.absoluteFill}
                      pointerEvents="none"
                    />
                    <View style={styles.orderLip} pointerEvents="none" />
                    <View style={styles.orderMain}>
                      <Text style={styles.orderCode}>{safeText(order.code, '—')}</Text>
                      <Text style={styles.orderMeta} numberOfLines={1}>
                        {formatSom(order.price)} · {formatDateTime(order.createdAt)}
                      </Text>
                    </View>
                    <PremiumBadge label={ORDER_STATUS_LABEL[status]} tone={ORDER_STATUS_TONE[status]} />
                    <Feather name="chevron-right" size={18} color={color.gold} />
                  </View>
                </TactilePressable>
              );
            })}
          </View>
        </PremiumQueryState>
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * The result card. With a tier it is struck from that tier's metal
 * (`MetalSurface`, the same material as the NFC card the user would own) and
 * lifted with the hero shadow; the neutral "not an ID" case stays a plain
 * card so a format error never looks like a product.
 */
function ResultShell({
  code,
  tier,
  tone,
  children,
}: {
  code: string;
  tier?: TierKey;
  tone?: 'neutral';
  children: React.ReactNode;
}) {
  const head = (
    <>
      <View style={styles.resultTop}>
        <Text style={styles.resultCode} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
          {safeText(code, '—')}
        </Text>
        {tier ? <TierBadge tier={tier} /> : null}
      </View>
      {tier ? <Text style={styles.resultTier}>{TIER_LABEL[tier]} daraja</Text> : null}
    </>
  );

  if (tone === 'neutral' || !tier) {
    return (
      <PremiumCard variant="default" style={styles.resultCardPlain}>
        {head}
        <View style={styles.resultBodyWrap}>{children}</View>
      </PremiumCard>
    );
  }

  return (
    <View style={styles.resultCard}>
      <MetalSurface tier={tier} cornerRadius={radius.lg} style={styles.resultMetal}>
        <View style={styles.resultInner}>
          {head}
          <View style={styles.resultDivider} />
          <View style={styles.resultBodyWrap}>{children}</View>
        </View>
      </MetalSurface>
    </View>
  );
}

function StatusLine({
  icon,
  tone,
  text,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  tone: string;
  text: string;
}) {
  return (
    <View style={styles.statusLine}>
      <Feather name={icon} size={16} color={tone} />
      <Text style={[styles.statusText, { color: tone }]}>{text}</Text>
    </View>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title.toUpperCase()}</Text>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.bg },
  ambient: { position: 'absolute', top: 0, left: 0, right: 0, height: 240 },
  content: { padding: space.lg, paddingBottom: space.xxxl, gap: space.md },

  searchCard: { ...depth.cardHero },
  searchContent: { padding: space.lg, paddingBottom: space.lg },
  heroOverline: { ...typeTokens.overline, color: color.gold },
  heroTitle: { ...typeTokens.h2, color: color.textPrimary, marginTop: space.xs, marginBottom: space.lg },
  searchWell: { paddingHorizontal: 2, paddingTop: 2 },
  searchInput: { ...typeTokens.monoLarge, color: color.textPrimary, letterSpacing: 3, minHeight: 58 },
  formatHint: { ...typeTokens.caption, color: color.textTertiary },

  resultCard: { marginTop: space.xs, borderRadius: radius.lg, ...depth.cardHero },
  resultCardPlain: { marginTop: space.xs, ...depth.card },
  resultMetal: { borderRadius: radius.lg },
  resultInner: { padding: space.lg },
  resultTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.md },
  resultCode: { ...typeTokens.display, fontSize: 28, lineHeight: 34, letterSpacing: 2, color: color.textPrimary, flex: 1 },
  resultTier: { ...typeTokens.caption, color: color.textSecondary, marginTop: 2, letterSpacing: 0.3 },
  resultDivider: { height: 1, backgroundColor: 'rgba(212,175,90,0.16)', marginTop: space.md },
  resultBodyWrap: { marginTop: space.md, gap: space.sm },
  resultBody: { ...typeTokens.caption, color: color.textSecondary },
  resultCta: { marginTop: space.xs },

  statusLine: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  statusText: { ...typeTokens.bodyStrong, flex: 1 },

  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  priceValue: { ...typeTokens.stat, fontSize: 26, lineHeight: 32, color: color.gold },
  priceNote: { ...typeTokens.caption, color: color.textTertiary },

  inlineWarn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(224,179,74,0.35)',
  },
  inlineWarnText: { ...typeTokens.caption, color: color.warning, flex: 1 },

  sectionTitle: { ...typeTokens.overline, color: color.textTertiary, marginTop: space.lg },
  examplesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  exampleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs + 2,
    minHeight: 40,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.borderGold,
    backgroundColor: color.surface,
    overflow: 'hidden',
    ...depth.chip,
  },
  exampleLip: { position: 'absolute', top: 0, left: 12, right: 12, height: 1, backgroundColor: 'rgba(255,238,196,0.22)' },
  exampleText: { ...typeTokens.mono, fontSize: 13, color: color.textPrimary },

  tierCard: { ...depth.card },
  tierContent: { paddingVertical: space.sm },
  tierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
  },
  tierRowDivided: { borderTopWidth: 1, borderTopColor: 'rgba(212,175,90,0.12)' },
  tierCoin: { fontFamily: font.serif, fontSize: 12, lineHeight: 14, color: color.textOnGold },
  tierBadge: { flex: 1, flexDirection: 'row' },
  tierPrice: { ...typeTokens.stat, fontSize: 16, lineHeight: 22, color: color.textPrimary },
  tierPriceAuction: { ...typeTokens.caption, fontSize: 13, color: color.gold, letterSpacing: 0.3 },
  tierNote: { ...typeTokens.caption, color: color.textTertiary, marginTop: space.sm, paddingBottom: space.xs },

  ordersList: { gap: space.sm },
  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    overflow: 'hidden',
    ...depth.chip,
  },
  orderLip: { position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.09)' },
  orderMain: { flex: 1 },
  orderCode: { ...typeTokens.monoLarge, fontSize: 17, lineHeight: 22, color: color.textPrimary },
  orderMeta: { ...typeTokens.caption, color: color.textTertiary, marginTop: 2 },
});
