import React, { useEffect, useState } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';
import type { IdStackParamList } from '../../navigation/types';
import { ScreenWithHeader } from '../shared/ScreenWithHeader';
import { PremiumButton } from '../../design-system/components/PremiumButton';
import { PremiumCard } from '../../design-system/components/PremiumCard';
import { TierBadge } from '../../design-system/components/PremiumBadge';
import { PurchaseSteps } from './PurchaseSteps';
import { recordsApi } from '../../api/records';
import type { PurchaseResponse } from '../../api/types';
import { ApiError } from '../../api/client';
import { getPersonalPurchaseQuote, tierForCode, TIER_LABEL } from '../../lib/pricing';
import { formatSom, safeText } from '../../lib/format';
import { usePaymentsEnabledStore } from '../../state/paymentsEnabledStore';
import { haptics } from '../../native/haptics';
import { useAuthStore } from '../../state/authStore';
import { useT } from '../../i18n';
import { color, radius, space, type as typeTokens } from '../../design-system/tokens';

type Props = NativeStackScreenProps<IdStackParamList, 'PurchaseStep2'>;

type Blocker =
  | { kind: 'none' }
  | { kind: 'paymentsOff' }
  | { kind: 'taken'; message: string }
  | { kind: 'session' }
  | { kind: 'error'; message: string };

/**
 * Step 2/3 — review and confirm.
 *
 * Payments are switched off server-side today: `POST /api/records/:code`
 * answers `503 payments_disabled`, and `GET /api/settings/payments-enabled`
 * says so up front. That is rendered as an honest, explained, disabled CTA
 * with a real re-check action — never as a spinner that fakes progress, and
 * never as a success screen. The moment the backend flips the flag, the same
 * button becomes live with no code change.
 */
export function PurchaseStep2Screen({ route, navigation }: Props) {
  const { code, profile } = route.params;
  const t = useT();
  const queryClient = useQueryClient();
  const refreshAuth = useAuthStore((s) => s.refresh);
  const paymentsStatus = usePaymentsEnabledStore((s) => s.status);
  const refreshPayments = usePaymentsEnabledStore((s) => s.refresh);

  const tier = tierForCode(code);
  const quote = getPersonalPurchaseQuote(code);

  const [submitting, setSubmitting] = useState(false);
  const [rechecking, setRechecking] = useState(false);
  const [blocker, setBlocker] = useState<Blocker>({ kind: 'none' });

  // The flag is cached app-wide; re-read it here so a user who reached this
  // screen minutes after launch sees the current state, not a stale one.
  useEffect(() => {
    void refreshPayments();
  }, [refreshPayments]);

  const paymentsOff = paymentsStatus === 'disabled';
  const paymentsUnknown = paymentsStatus === 'unknown';
  const canConfirm = quote.purchasable && paymentsStatus === 'enabled' && !submitting;

  const onRecheck = async () => {
    setRechecking(true);
    setBlocker({ kind: 'none' });
    await refreshPayments();
    setRechecking(false);
  };

  const onConfirm = async () => {
    if (!canConfirm) return;
    setBlocker({ kind: 'none' });
    setSubmitting(true);
    try {
      const result = (await recordsApi.purchase(code, {
        name: profile.name,
        role: profile.role ?? '',
        phone: profile.phone ?? '',
        email: profile.email ?? '',
        city: profile.city ?? '',
      })) as PurchaseResponse;
      haptics.success();
      queryClient.invalidateQueries({ queryKey: ['orders', 'mine'] });
      navigation.replace('PurchaseStep3', {
        code,
        orderId: result.orderId,
        price: result.price,
        payLink: result.payLink,
      });
    } catch (e) {
      haptics.error();
      if (e instanceof ApiError) {
        if (e.code === 'payments_disabled' || e.code === 'payments_backend_pending') {
          await refreshPayments();
          setBlocker({ kind: 'paymentsOff' });
        } else if (e.code === 'already_taken' || e.code === 'reserved_pending_payment' || e.code === 'code_taken') {
          setBlocker({ kind: 'taken', message: e.message });
        } else if (e.status === 401) {
          setBlocker({ kind: 'session' });
        } else {
          setBlocker({ kind: 'error', message: e.message });
        }
      } else {
        setBlocker({ kind: 'error', message: t('common.errorService') });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenWithHeader title="Xarid" onBack={navigation.canGoBack() ? navigation.goBack : undefined}>
      <PurchaseSteps current={2} />

      <PremiumCard variant="featured">
        <View style={styles.row}>
          <Text style={styles.code} numberOfLines={1}>
            {safeText(code, '—')}
          </Text>
          <TierBadge tier={tier} />
        </View>
        <Text style={styles.tierMeta}>{TIER_LABEL[tier]} daraja</Text>

        <View style={styles.divider} />

        <Row label="Ism" value={safeText(profile.name)} />
        {!!profile.role && <Row label="Rol" value={profile.role} />}
        {!!profile.phone && <Row label="Telefon" value={profile.phone} />}
        {!!profile.email && <Row label="Email" value={profile.email} />}
        {!!profile.city && <Row label="Shahar" value={profile.city} />}

        <View style={styles.divider} />

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Taxminiy summa</Text>
          <Text style={styles.totalValue}>{quote.purchasable ? formatSom(quote.amount) : '—'}</Text>
        </View>
        <Text style={styles.totalNote}>Yakuniy summani server hisoblaydi va keyingi qadamda ko'rsatadi.</Text>
      </PremiumCard>

      {!quote.purchasable && (
        <Notice
          icon="slash"
          tone={color.warning}
          title={quote.reason === 'exclusive_auction_only' ? t('id.auctionOnly') : t('id.notPurchasable')}
          text="Bu ID uchun to'g'ridan-to'g'ri xarid oqimi mavjud emas."
        />
      )}

      {paymentsUnknown && quote.purchasable && (
        <Notice icon="loader" tone={color.textSecondary} title={t('common.loading')} text="To'lov tizimi holati tekshirilmoqda." />
      )}

      {paymentsOff && quote.purchasable && (
        <Notice
          icon="pause-circle"
          tone={color.warning}
          title={t('payments.disabled')}
          text="To'lov tizimi hozircha yopiq, shuning uchun ID band qilinmaydi. Yoqilgan zahoti shu yerdan davom etasiz."
        />
      )}

      {blocker.kind === 'taken' && (
        <Notice
          icon="user-x"
          tone={color.danger}
          title={blocker.message}
          text="Boshqa ID tanlab ko'ring."
          ctaLabel="Boshqa ID qidirish"
          onPressCta={() => navigation.navigate('IdSearch')}
        />
      )}

      {blocker.kind === 'session' && (
        <Notice
          icon="log-in"
          tone={color.danger}
          title={t('common.sessionExpired')}
          text="Davom etish uchun qaytadan kiring."
          ctaLabel="Kirish"
          onPressCta={() => {
            void refreshAuth().catch(() => {});
          }}
        />
      )}

      {blocker.kind === 'error' && <Notice icon="alert-circle" tone={color.danger} title={t('common.error')} text={blocker.message} />}

      <PremiumButton
        label="Tasdiqlash"
        onPress={onConfirm}
        loading={submitting}
        disabled={!canConfirm}
        style={styles.cta}
      />

      {(paymentsOff || paymentsUnknown) && quote.purchasable && (
        <PremiumButton
          label="Holatni qayta tekshirish"
          variant="ghost"
          loading={rechecking}
          onPress={onRecheck}
          style={styles.secondaryCta}
        />
      )}
    </ScreenWithHeader>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function Notice({
  icon,
  tone,
  title,
  text,
  ctaLabel,
  onPressCta,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  tone: string;
  title: string;
  text: string;
  ctaLabel?: string;
  onPressCta?: () => void;
}) {
  return (
    <View style={styles.notice}>
      <View style={styles.noticeHead}>
        <Feather name={icon} size={16} color={tone} />
        <Text style={[styles.noticeTitle, { color: tone }]}>{title}</Text>
      </View>
      <Text style={styles.noticeText}>{text}</Text>
      {!!ctaLabel && !!onPressCta && (
        <PremiumButton label={ctaLabel} variant="ghost" onPress={onPressCta} style={styles.noticeCta} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm },
  code: { ...typeTokens.monoLarge, color: color.gold, flex: 1 },
  tierMeta: { ...typeTokens.caption, color: color.textTertiary, marginTop: 2 },
  divider: { height: 1, backgroundColor: color.border, marginVertical: space.md },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', gap: space.md, paddingVertical: space.xs },
  detailLabel: { ...typeTokens.body, color: color.textSecondary },
  detailValue: { ...typeTokens.bodyStrong, color: color.textPrimary, flexShrink: 1, textAlign: 'right' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  totalLabel: { ...typeTokens.body, color: color.textSecondary },
  totalValue: { ...typeTokens.h1, color: color.gold },
  totalNote: { ...typeTokens.caption, color: color.textTertiary, marginTop: space.xs },
  notice: {
    marginTop: space.lg,
    padding: space.lg,
    borderRadius: radius.md,
    backgroundColor: color.surfaceSunken,
    borderWidth: 1,
    borderColor: color.border,
    gap: space.xs,
  },
  noticeHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  noticeTitle: { ...typeTokens.bodyStrong, flex: 1 },
  noticeText: { ...typeTokens.caption, color: color.textSecondary },
  noticeCta: { marginTop: space.sm },
  cta: { marginTop: space.xl },
  secondaryCta: { marginTop: space.sm },
});
