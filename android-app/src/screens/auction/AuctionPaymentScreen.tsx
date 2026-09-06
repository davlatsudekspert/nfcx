import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuctionStackParamList } from '../../navigation/types';
import { ScreenWithHeader } from '../shared/ScreenWithHeader';
import { PremiumCard } from '../../design-system/components/PremiumCard';
import { PremiumInput } from '../../design-system/components/PremiumInput';
import { PremiumButton } from '../../design-system/components/PremiumButton';
import { PremiumBadge, TierBadge } from '../../design-system/components/PremiumBadge';
import { PremiumQueryState } from '../../design-system/components/PremiumQueryState';
import { AuctionCountdown } from '../../composites/AuctionCountdown';
import { SuccessCheck } from '../../composites/SuccessCheck';
import { InfoBanner, MetricTile, PaymentsClosedNotice } from './AuctionUi';
import { recoverSession } from './sessionRecovery';
import {
  apiErrorMessage,
  auctionCurrentPrice,
  isPaymentsDisabledError,
  isUnauthorizedError,
  sameUserId,
} from './auctionModel';
import { useAuctionDetail, useAuctionPayment, useWonPendingAuctions } from '../../hooks/useAuctions';
import { useAuthStore } from '../../state/authStore';
import { usePaymentsEnabledStore } from '../../state/paymentsEnabledStore';
import { formatDateTime, formatSom, safeText, toFiniteNumber } from '../../lib/format';
import { tierForCode } from '../../lib/pricing';
import { haptics } from '../../native/haptics';
import { color, space, type as typeTokens } from '../../design-system/tokens';

type Props = NativeStackScreenProps<AuctionStackParamList, 'AuctionPayment'>;

const PAYMENT_URGENT_MS = 24 * 60 * 60 * 1000;

/**
 * `POST /api/auctions/:id/pay` — a real endpoint that answers
 * `503 payments_disabled` today (android/docs/02-API_MAP.md §2.4).
 *
 * The screen is fully built and wired: it shows what is actually owed and by
 * when (from `GET /api/auctions/:id` and `GET /api/auctions/won/pending`),
 * validates the form locally, and reports the backend's answer verbatim —
 * a closed payment system is shown as closed, never as an error and never as
 * a fake confirmation.
 */
export function AuctionPaymentScreen({ route, navigation }: Props) {
  const { auctionId } = route.params;
  const detail = useAuctionDetail(auctionId);
  const won = useWonPendingAuctions();
  const pay = useAuctionPayment(auctionId);
  const user = useAuthStore((s) => s.user);
  const paymentsStatus = usePaymentsEnabledStore((s) => s.status);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState(() => safeText(user?.phone, ''));
  const [nameError, setNameError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const auction = detail.data?.auction ?? null;
  const wonRow = (won.data ?? []).find((row) => row.id === auctionId) ?? null;
  const code = auction?.code ?? wonRow?.code ?? null;
  const amountDue = auctionCurrentPrice(auction) ?? toFiniteNumber(wonRow?.currentPrice);
  const deadline = auction?.paymentDeadline ?? wonRow?.paymentDeadline ?? null;

  // Only treated as "not yours" when the backend actually told us who the
  // winner is — a missing `highestBidderId` never blocks the user.
  const notWinner = auction?.highestBidderId != null && !sameUserId(auction.highestBidderId, user?.id);

  const paymentsBlocked = paymentsStatus === 'disabled' || isPaymentsDisabledError(pay.error);
  const sessionExpired = isUnauthorizedError(pay.error);
  const serverError = pay.isError && !paymentsBlocked && !sessionExpired ? apiErrorMessage(pay.error) : null;

  const submit = () => {
    const trimmedName = name.trim();
    const digits = phone.replace(/[^0-9]/g, '');
    const nextNameError = trimmedName.length < 2 ? "Ismingizni to'liq kiriting." : null;
    const nextPhoneError = digits.length < 9 ? "Telefon raqamini to'liq kiriting." : null;
    setNameError(nextNameError);
    setPhoneError(nextPhoneError);
    if (nextNameError || nextPhoneError) return;

    haptics.medium();
    pay.mutate(
      { name: trimmedName, phone: phone.trim() },
      {
        onSuccess: () => haptics.success(),
        onError: (error) => {
          if (isPaymentsDisabledError(error)) {
            void usePaymentsEnabledStore.getState().refresh();
            haptics.warning();
            return;
          }
          haptics.error();
        },
      },
    );
  };

  if (detail.isLoading || detail.isError || !auction) {
    return (
      <ScreenWithHeader title="Auksion to'lovi" onBack={navigation.goBack}>
        <PremiumQueryState
          isLoading={detail.isLoading}
          isError={detail.isError}
          error={detail.error}
          isEmpty={!detail.isLoading && !detail.isError && !auction}
          onRetry={() => void detail.refetch()}
          onUnauthorized={recoverSession}
          emptyIcon="search"
          emptyTitle="Auksion topilmadi"
          emptyDescription="Bu auksion o'chirilgan yoki mavjud emas."
          emptyCtaLabel="Orqaga"
          onPressEmptyCta={navigation.goBack}
          skeletonRows={2}
          skeletonHeight={140}
        />
      </ScreenWithHeader>
    );
  }

  if (pay.isSuccess) {
    return (
      <ScreenWithHeader title="Auksion to'lovi" onBack={navigation.goBack}>
        <View style={styles.successWrap}>
          <SuccessCheck />
          <Text style={styles.successTitle}>To'lov qabul qilindi</Text>
          <Text style={styles.successText}>
            #{safeText(code)} bo'yicha to'lovingiz serverga yuborildi. Holatni "Meniki" bo'limida kuzatib borishingiz mumkin.
          </Text>
          <PremiumButton label="Yopish" onPress={navigation.goBack} style={styles.successCta} />
        </View>
      </ScreenWithHeader>
    );
  }

  return (
    <ScreenWithHeader title="Auksion to'lovi" onBack={navigation.goBack}>
      <PremiumCard variant="featured" animate={false}>
        <View style={styles.summaryTop}>
          <View style={styles.identity}>
            <Text style={styles.code} numberOfLines={1}>
              #{safeText(code)}
            </Text>
            {!!code && <TierBadge tier={tierForCode(code)} />}
          </View>
          <PremiumBadge label="To'lov kutilmoqda" tone="warning" />
        </View>

        <View style={styles.metricsRow}>
          <MetricTile label="To'lanadigan summa" value={formatSom(amountDue)} tone="gold" />
          <MetricTile label="Muddat tugashiga">
            <AuctionCountdown endsAt={deadline} urgentUnderMs={PAYMENT_URGENT_MS} style={styles.countdown} />
          </MetricTile>
        </View>

        <Text style={styles.deadline}>To'lov muddati: {formatDateTime(deadline)}</Text>
      </PremiumCard>

      {notWinner ? (
        <InfoBanner
          icon="alert-circle"
          tone="warning"
          title="Bu auksion sizga tegishli emas"
          description="To'lovni faqat auksion g'olibi amalga oshira oladi."
        >
          <PremiumButton label="Orqaga" variant="ghost" onPress={navigation.goBack} style={styles.bannerAction} />
        </InfoBanner>
      ) : (
        <>
          {paymentsBlocked && (
            <PaymentsClosedNotice description="To'lov tizimi yoqilgach, quyidagi forma orqali to'lashingiz mumkin bo'ladi. Muddat haqida jamoa alohida xabar beradi." />
          )}

          {!!serverError && (
            <InfoBanner icon="alert-circle" tone="danger" title="To'lov yuborilmadi" description={serverError} />
          )}

          {sessionExpired && (
            <InfoBanner icon="log-in" tone="danger" title="Sessiya tugadi" description="Davom etish uchun qaytadan kiring.">
              <PremiumButton label="Kirish" variant="ghost" onPress={recoverSession} style={styles.bannerAction} />
            </InfoBanner>
          )}

          <Text style={styles.formIntro}>To'lovni rasmiylashtirish uchun ism va telefon raqamingizni kiriting.</Text>

          <PremiumInput
            label="Ism"
            value={name}
            onChangeText={(text) => {
              setName(text);
              if (nameError) setNameError(null);
            }}
            autoCapitalize="words"
            error={nameError}
            editable={!paymentsBlocked && !pay.isPending}
          />
          <PremiumInput
            label="Telefon"
            value={phone}
            onChangeText={(text) => {
              setPhone(text);
              if (phoneError) setPhoneError(null);
            }}
            keyboardType="phone-pad"
            placeholder="+998 90 123 45 67"
            error={phoneError}
            editable={!paymentsBlocked && !pay.isPending}
          />

          <PremiumButton
            label="To'lash"
            onPress={submit}
            loading={pay.isPending}
            disabled={paymentsBlocked || sessionExpired}
            style={styles.submit}
          />
        </>
      )}
    </ScreenWithHeader>
  );
}

const styles = StyleSheet.create({
  summaryTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  identity: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexShrink: 1 },
  code: { ...typeTokens.monoLarge, color: color.textPrimary, flexShrink: 1 },
  metricsRow: { flexDirection: 'row', gap: space.sm, marginTop: space.lg },
  countdown: { fontSize: 15 },
  deadline: { ...typeTokens.caption, color: color.textSecondary, marginTop: space.md },
  bannerAction: { marginTop: space.sm },
  formIntro: { ...typeTokens.caption, color: color.textSecondary, marginTop: space.xl, marginBottom: space.md, lineHeight: 18 },
  submit: { marginTop: space.sm },

  successWrap: { alignItems: 'center', paddingTop: space.xxl, gap: space.md },
  successTitle: { ...typeTokens.h1, color: color.textPrimary, marginTop: space.md },
  successText: { ...typeTokens.body, color: color.textSecondary, textAlign: 'center' },
  successCta: { marginTop: space.lg },
});
