import React, { forwardRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type BottomSheet from '@gorhom/bottom-sheet';
import { PremiumSheet } from '../../design-system/components/PremiumSheet';
import { PremiumInput } from '../../design-system/components/PremiumInput';
import { PremiumButton } from '../../design-system/components/PremiumButton';
import { TierBadge } from '../../design-system/components/PremiumBadge';
import { InfoBanner } from './AuctionUi';
import { apiErrorMessage, isUnauthorizedError } from './auctionModel';
import { useRequestAuction } from '../../hooks/useAuctions';
import { tierForCode } from '../../lib/pricing';
import { haptics } from '../../native/haptics';
import { color, space, type as typeTokens } from '../../design-system/tokens';

export interface AuctionRequestSheetProps {
  onSignIn?: () => void;
  onDismiss?: () => void;
}

const CODE_RE = /^[A-Z0-9]{3,12}$/;

function normalizeCode(raw: string): string {
  return String(raw ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 12);
}

/**
 * `POST /api/auction-requests` — the real "put this ID up for auction"
 * request the web app exposes. Wired here so the demand board has a genuine
 * entry point instead of a decorative one; the server decides what happens
 * next, and the sheet only ever claims what the response actually says.
 */
export const AuctionRequestSheet = forwardRef<BottomSheet, AuctionRequestSheetProps>(function AuctionRequestSheet(
  { onSignIn, onDismiss },
  ref,
) {
  const [code, setCode] = useState('');
  const [note, setNote] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const request = useRequestAuction();

  const cleaned = normalizeCode(code);
  const codeValid = CODE_RE.test(cleaned);
  const sessionExpired = isUnauthorizedError(request.error);

  const submit = () => {
    if (!codeValid) {
      setFormError("ID kodini to'liq kiriting (masalan AAA100).");
      return;
    }
    setFormError(null);
    haptics.medium();
    request.mutate({ code: cleaned, note: note.trim() || undefined });
  };

  const reset = () => {
    setCode('');
    setNote('');
    setFormError(null);
    request.reset();
  };

  return (
    <PremiumSheet
      ref={ref}
      title="ID ni auksionga so'rash"
      snapPoints={['58%', '88%']}
      onDismiss={() => {
        reset();
        onDismiss?.();
      }}
    >
      {request.isSuccess ? (
        <InfoBanner
          icon="check-circle"
          tone="success"
          title="So'rovingiz yuborildi"
          description={`#${cleaned} bo'yicha so'rov qabul qilindi. Jamoa ko'rib chiqqach, ID talab taxtasida paydo bo'ladi.`}
        >
          <PremiumButton label="Yana so'rov yuborish" variant="ghost" onPress={reset} style={styles.action} />
        </InfoBanner>
      ) : (
        <>
          <Text style={styles.intro}>
            Auksionga chiqishini istagan ID kodini yuboring. So'rovlar talab taxtasiga tushadi va ovoz yig'ila boshlaydi.
          </Text>

          <PremiumInput
            label="ID kodi"
            value={code}
            onChangeText={(text) => setCode(normalizeCode(text))}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder="AAA100"
            error={formError}
            editable={!request.isPending}
          />

          {codeValid && (
            <View style={styles.tierRow}>
              <TierBadge tier={tierForCode(cleaned)} />
              <Text style={styles.tierHint}>Taxminiy daraja — yakuniy narxni auksion belgilaydi.</Text>
            </View>
          )}

          <PremiumInput
            label="Izoh (ixtiyoriy)"
            value={note}
            onChangeText={setNote}
            multiline
            maxLength={280}
            editable={!request.isPending}
          />

          {request.isError && (
            <InfoBanner
              icon={sessionExpired ? 'log-in' : 'alert-circle'}
              tone={sessionExpired ? 'danger' : 'warning'}
              title={sessionExpired ? 'Sessiya tugadi' : "So'rov yuborilmadi"}
              description={sessionExpired ? 'Davom etish uchun qaytadan kiring.' : apiErrorMessage(request.error)}
            >
              {sessionExpired && !!onSignIn && (
                <PremiumButton label="Kirish" variant="ghost" onPress={onSignIn} style={styles.action} />
              )}
            </InfoBanner>
          )}

          <PremiumButton
            label="So'rov yuborish"
            onPress={submit}
            loading={request.isPending}
            disabled={!codeValid || sessionExpired}
            style={styles.action}
          />
        </>
      )}
    </PremiumSheet>
  );
});

const styles = StyleSheet.create({
  intro: { ...typeTokens.caption, color: color.textSecondary, lineHeight: 18 },
  tierRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: -space.xs },
  tierHint: { ...typeTokens.caption, color: color.textTertiary, flex: 1 },
  action: { marginTop: space.sm },
});
