import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useQuery } from '@tanstack/react-query';
import { Feather } from '@expo/vector-icons';
import type { IdStackParamList, MainTabParamList } from '../../navigation/types';
import { PremiumHeader } from '../../design-system/components/PremiumHeader';
import { PremiumInput } from '../../design-system/components/PremiumInput';
import { PremiumButton } from '../../design-system/components/PremiumButton';
import { PremiumCard } from '../../design-system/components/PremiumCard';
import { PremiumBadge, TierBadge } from '../../design-system/components/PremiumBadge';
import { PremiumLoadingSkeleton } from '../../design-system/components/PremiumLoadingSkeleton';
import { PremiumQueryState } from '../../design-system/components/PremiumQueryState';
import { recordsApi } from '../../api/records';
import { ordersApi } from '../../api/orders';
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
import { color, radius, space, type as typeTokens } from '../../design-system/tokens';

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

  const orders = useQuery({ queryKey: ['orders', 'mine'], queryFn: () => ordersApi.list() });
  const recentOrders = (orders.data?.orders ?? []).slice(0, 5);

  const availabilityError = availability.error instanceof ApiError ? availability.error : null;
  const isChecking = !!lookupCode && (availability.isLoading || typing);
  const isTaken = !!lookupCode && availability.isSuccess;
  const isFree = !!lookupCode && availabilityError?.status === 404;
  const lookupFailed = !!lookupCode && availability.isError && availabilityError?.status !== 404;

  const openProfile = (code: string) =>
    tabNavigation?.navigate('HomeTab', { screen: 'PublicProfile', params: { code } });

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']}>
      <PremiumHeader title={t('id.searchTitle')} onBack={navigation.canGoBack() ? navigation.goBack : undefined} />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ---------- Search ---------- */}
        <PremiumCard variant="featured">
          <Text style={styles.heroOverline}>NFC ID TANLASH</Text>
          <Text style={styles.heroTitle}>Kerakli ID bandligini tekshiring</Text>
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
            <Pressable
              key={example}
              onPress={() => {
                haptics.selection();
                setRaw(example);
              }}
              accessibilityRole="button"
              accessibilityLabel={`${example} namunasini kiritish`}
              style={styles.exampleChip}
            >
              <Feather name="corner-down-left" size={12} color={color.textTertiary} />
              <Text style={styles.exampleText}>{example}</Text>
            </Pressable>
          ))}
        </View>

        {/* ---------- How tiers/pricing work (real, from src/lib/pricing) ---------- */}
        <SectionTitle title="Darajalar va narxlar" />
        <PremiumCard variant="sunken">
          {TIER_ORDER.map((tier, i) => (
            <View key={tier} style={[styles.tierRow, i > 0 && styles.tierRowDivided]}>
              <TierBadge tier={tier} />
              <Text style={styles.tierPrice}>
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
                <Pressable
                  key={order.id}
                  onPress={() => {
                    haptics.selection();
                    navigation.navigate('PurchaseResult', { code: order.code, orderId: order.id });
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`${order.code} buyurtmasi`}
                  style={styles.orderRow}
                >
                  <View style={styles.orderMain}>
                    <Text style={styles.orderCode}>{safeText(order.code, '—')}</Text>
                    <Text style={styles.orderMeta} numberOfLines={1}>
                      {formatSom(order.price)} · {formatDateTime(order.createdAt)}
                    </Text>
                  </View>
                  <PremiumBadge label={ORDER_STATUS_LABEL[status]} tone={ORDER_STATUS_TONE[status]} />
                  <Feather name="chevron-right" size={18} color={color.textTertiary} />
                </Pressable>
              );
            })}
          </View>
        </PremiumQueryState>
      </ScrollView>
    </SafeAreaView>
  );
}

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
  return (
    <PremiumCard variant={tone === 'neutral' ? 'default' : 'featured'} style={styles.resultCard}>
      <View style={styles.resultTop}>
        <Text style={styles.resultCode} numberOfLines={1}>
          {safeText(code, '—')}
        </Text>
        {tier ? <TierBadge tier={tier} /> : null}
      </View>
      {tier ? <Text style={styles.resultTier}>{TIER_LABEL[tier]} daraja</Text> : null}
      <View style={styles.resultBodyWrap}>{children}</View>
    </PremiumCard>
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
  content: { padding: space.lg, paddingBottom: space.xxxl, gap: space.md },

  heroOverline: { ...typeTokens.overline, color: color.gold },
  heroTitle: { ...typeTokens.h2, color: color.textPrimary, marginTop: space.xs, marginBottom: space.lg },
  searchInput: { ...typeTokens.monoLarge, color: color.textPrimary, letterSpacing: 3, minHeight: 58 },
  formatHint: { ...typeTokens.caption, color: color.textTertiary },

  resultCard: { marginTop: space.xs },
  resultTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm },
  resultCode: { ...typeTokens.monoLarge, color: color.textPrimary, flex: 1 },
  resultTier: { ...typeTokens.caption, color: color.textTertiary, marginTop: 2 },
  resultBodyWrap: { marginTop: space.md, gap: space.sm },
  resultBody: { ...typeTokens.caption, color: color.textSecondary },
  resultCta: { marginTop: space.xs },

  statusLine: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  statusText: { ...typeTokens.bodyStrong, flex: 1 },

  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  priceValue: { ...typeTokens.h1, color: color.gold },
  priceNote: { ...typeTokens.caption, color: color.textTertiary },

  inlineWarn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.sm,
    backgroundColor: color.surfaceSunken,
    borderWidth: 1,
    borderColor: color.border,
  },
  inlineWarnText: { ...typeTokens.caption, color: color.warning, flex: 1 },

  sectionTitle: { ...typeTokens.overline, color: color.textTertiary, marginTop: space.lg },
  examplesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  exampleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    minHeight: 40,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surfaceRaised,
  },
  exampleText: { ...typeTokens.mono, fontSize: 13, color: color.textSecondary },

  tierRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: space.sm },
  tierRowDivided: { borderTopWidth: 1, borderTopColor: color.border },
  tierPrice: { ...typeTokens.bodyStrong, color: color.textSecondary },
  tierNote: { ...typeTokens.caption, color: color.textTertiary, marginTop: space.md },

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
  },
  orderMain: { flex: 1 },
  orderCode: { ...typeTokens.mono, color: color.textPrimary },
  orderMeta: { ...typeTokens.caption, color: color.textTertiary, marginTop: 2 },
});
