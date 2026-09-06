import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { NfcContactlessIcon } from './NfcChip';
import { NfcPressable } from './NfcPressable';
import { haptics } from '../native/haptics';
import { color, depth, gradient, radius, space, type as typeTokens } from '../design-system/tokens';

/** Same small key/value store the locale and login flag already live in
 * (src/i18n/index.ts, src/native/secureStore.ts), so the dismissal survives
 * a restart without adding a storage dependency. */
const DISMISSED_KEY = 'nfcstore.home.nfcInfoDismissed';

const BODY =
  "NFC — telefoningizni kartaga yoki kartani telefoningizga yaqinlashtirganda, hech qanday ilova ochmasdan profilingiz avtomatik ko'rinadi. Bitta teginish — barcha ma'lumotlaringiz.";

/**
 * "NFC nima?" — a one-time explainer on the dashboard: a gold-outlined card
 * with the contactless symbol in a pool of gold light and an × that puts it
 * away for good. Nothing renders until the stored flag has been read, so a
 * user who dismissed it never sees it flash back in on launch.
 */
export function NfcInfoCard({ style }: { style?: StyleProp<ViewStyle> }) {
  const [visible, setVisible] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    SecureStore.getItemAsync(DISMISSED_KEY)
      .then((v) => alive && setVisible(v !== '1'))
      .catch(() => alive && setVisible(true));
    return () => {
      alive = false;
    };
  }, []);

  const dismiss = () => {
    haptics.selection();
    setVisible(false);
    SecureStore.setItemAsync(DISMISSED_KEY, '1').catch(() => {
      /* best-effort — the card is already gone for this session */
    });
  };

  if (!visible) return null;

  return (
    <View style={[styles.shadow, style]}>
      <View style={styles.card}>
        <LinearGradient
          colors={gradient.cardSurface}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.6, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <LinearGradient
          colors={gradient.cardFeatured}
          locations={[0, 0.5, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, styles.breath]}
          pointerEvents="none"
        />
        <LinearGradient colors={TOP_LIP_GOLD} style={styles.lip} pointerEvents="none" />

        <View style={styles.row}>
          <View style={styles.iconWell}>
            <NfcContactlessIcon size={26} />
          </View>
          <View style={styles.copy}>
            <Text style={styles.title}>NFC nima?</Text>
            <Text style={styles.body}>{BODY}</Text>
          </View>
          <NfcPressable
            radius={radius.pill}
            glow={false}
            onPress={dismiss}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Yopish"
            style={styles.close}
          >
            <View style={styles.closeFace}>
              <Feather name="x" size={14} color={color.textSecondary} />
            </View>
          </NfcPressable>
        </View>
      </View>
    </View>
  );
}

const TOP_LIP_GOLD = ['rgba(255,238,196,0.32)', 'rgba(255,238,196,0.05)', 'transparent'] as const;

const styles = StyleSheet.create({
  shadow: { borderRadius: radius.lg, ...depth.card },
  card: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: color.borderGoldStrong,
    backgroundColor: color.surface,
    padding: space.lg,
  },
  breath: { opacity: 0.55 },
  lip: { position: 'absolute', top: 0, left: 0, right: 0, height: 2 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  iconWell: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.goldMuted,
    borderWidth: 1,
    borderColor: color.borderGold,
    boxShadow: '0 0 18px rgba(212,175,90,0.45)',
  },
  copy: { flex: 1 },
  title: { ...typeTokens.h2, color: color.textPrimary },
  body: { ...typeTokens.body, fontSize: 14, lineHeight: 21, color: color.textSecondary, marginTop: space.xs },
  close: { marginTop: -2, marginRight: -4 },
  closeFace: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.surfaceSunken,
    borderWidth: 1,
    borderColor: color.border,
  },
});
