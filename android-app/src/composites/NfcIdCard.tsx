import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PremiumCard } from '../design-system/components/PremiumCard';
import { PremiumBadge, TierBadge } from '../design-system/components/PremiumBadge';
import { tierForCode } from '../lib/pricing';
import { color, space, type as typeTokens } from '../design-system/tokens';

export interface NfcIdCardProps {
  code: string;
  name?: string;
  /**
   * `owned`: already in the user's `cards` (GET /api/auth/me) — a real,
   * confirmed NFC ID. `pending`: a `web_orders` row still awaiting payment
   * confirmation (GET /api/orders). There is no third "reserved" state
   * confirmed anywhere in the live API (android/docs/02-API_MAP.md §2.2/§2.3)
   * — the mockup's "reserved" chip is treated as a label variant of
   * `pending` rather than an invented distinct backend state.
   */
  state: 'owned' | 'pending';
  onPress: () => void;
  index?: number;
}

export function NfcIdCard({ code, name, state, onPress, index }: NfcIdCardProps) {
  const tier = tierForCode(code);

  return (
    <Pressable onPress={onPress}>
      <PremiumCard index={index} featured={tier === 'exclusive' || tier === 'premium'} style={styles.card}>
        <View style={styles.topRow}>
          <TierBadge tier={tier} />
          {state === 'pending' && <PremiumBadge label="Kutilmoqda" tone="warning" />}
        </View>
        <Text style={styles.code}>#{code}</Text>
        {!!name && (
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
        )}
      </PremiumCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { width: 200, marginRight: space.md },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  code: { ...typeTokens.h2, color: color.textPrimary, marginTop: space.sm },
  name: { ...typeTokens.caption, color: color.textSecondary, marginTop: 2 },
});
