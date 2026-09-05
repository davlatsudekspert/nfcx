import React, { useState } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { IdStackParamList } from '../../navigation/types';
import { ScreenWithHeader } from '../shared/ScreenWithHeader';
import { PremiumInput } from '../../design-system/components/PremiumInput';
import { PremiumButton } from '../../design-system/components/PremiumButton';
import { TierBadge } from '../../design-system/components/PremiumBadge';
import { tierForCode } from '../../lib/pricing';
import { color, space, type as typeTokens } from '../../design-system/tokens';

type Props = NativeStackScreenProps<IdStackParamList, 'PurchaseStep1'>;

/** Step 1/3 — profile basics for the ID being purchased. The server's
 * `validateRecordBody` (hosting/worker.js) is the real validator; these are
 * light client-side checks for instant feedback only. */
export function PurchaseStep1Screen({ route, navigation }: Props) {
  const { code } = route.params;
  const tier = tierForCode(code);
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [phone, setPhone] = useState('');

  const nameError = name.length > 0 && name.trim().length < 2 ? "Ism kamida 2 belgidan iborat bo'lishi kerak." : null;
  const canContinue = name.trim().length >= 2;

  return (
    <ScreenWithHeader title="Xarid — 1/3" onBack={navigation.goBack}>
      <View style={styles.stepRow}>
        <Text style={styles.stepText}>1</Text>
        <Text style={styles.stepDivider}>/</Text>
        <Text style={styles.stepTextMuted}>3</Text>
      </View>

      <View style={styles.idRow}>
        <Text style={styles.code}>#{code}</Text>
        <TierBadge tier={tier} />
      </View>

      <PremiumInput label="Ism" value={name} onChangeText={setName} error={nameError} />
      <PremiumInput label="Rol / kasb (ixtiyoriy)" value={role} onChangeText={setRole} />
      <PremiumInput label="Telefon (ixtiyoriy)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />

      <PremiumButton
        label="Davom etish"
        disabled={!canContinue}
        onPress={() =>
          navigation.navigate('PurchaseStep2', {
            code,
            profile: { name: name.trim(), role: role.trim() || undefined, phone: phone.trim() || undefined },
          })
        }
      />
    </ScreenWithHeader>
  );
}

const styles = StyleSheet.create({
  stepRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: space.md },
  stepText: { ...typeTokens.h1, color: color.gold },
  stepDivider: { ...typeTokens.h2, color: color.textTertiary, marginHorizontal: 4 },
  stepTextMuted: { ...typeTokens.h2, color: color.textTertiary },
  idRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.lg },
  code: { ...typeTokens.display, color: color.textPrimary },
});
