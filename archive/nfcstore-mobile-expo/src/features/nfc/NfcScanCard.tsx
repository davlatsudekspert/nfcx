import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { GoldSweep } from '@/components/GoldSweep';
import { TapScale } from '@/components/TapScale';
import { openNfcSettings } from '@/lib/nfc';
import { A120, SHADOW } from '@/theme/css';
import { useTheme } from '@/theme/ThemeProvider';
import { sans } from '@/theme/type';

import { useNfcScan } from './useNfcScan';

/**
 * NFC o'qish tugmasi — ilovaning asosiy amali, shuning uchun Home
 * ekranining eng yuqorisida va aksent gradientida turadi.
 *
 * Maketda bu element yo'q edi (maket NFC dan oldin chizilgan), lekin
 * spetsifikatsiya NFC o'qishni "the app's central purpose" deb
 * belgilaydi — shuning uchun u eng ko'rinadigan joyda.
 */
export function NfcScanCard() {
  const { theme } = useTheme();
  const { state, scan, reset } = useNfcScan();

  const scanning = state.status === 'scanning';

  return (
    <View style={{ gap: 10 }}>
      <TapScale
        radius={16}
        onPress={scanning ? undefined : scan}
        pulseColor={theme.a1}
        accessibilityLabel="NFC kartani o'qish"
        style={[
          {
            borderRadius: 16,
            paddingVertical: 18,
            paddingHorizontal: 18,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
            overflow: 'hidden',
          },
          SHADOW.card,
        ]}
      >
        <LinearGradient
          colors={[theme.a1, theme.a2]}
          start={A120.start}
          end={A120.end}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
        <GoldSweep duration={5000} radius={16} />

        <View
          style={{
            width: 42,
            height: 42,
            borderRadius: 21,
            backgroundColor: 'rgba(0,0,0,.14)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {scanning ? (
            <ActivityIndicator color={theme.onAccent} />
          ) : (
            <NfcGlyph color={theme.onAccent} />
          )}
        </View>

        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[sans(700, 15), { color: theme.onAccent }]}>
            {scanning ? 'Kartani tekkizing…' : 'NFC kartani o’qish'}
          </Text>
          <Text
            style={[sans(500, 11.5, 1.4), { color: 'rgba(0,0,0,.55)' }]}
          >
            {scanning
              ? 'Kartani telefon orqasiga tutib turing'
              : 'Kartani tekkizsangiz profil ochiladi'}
          </Text>
        </View>
      </TapScale>

      {state.status === 'error' ? (
        <View
          style={{
            paddingVertical: 11,
            paddingHorizontal: 13,
            borderRadius: 12,
            backgroundColor: 'rgba(190,80,80,.12)',
            borderWidth: 1,
            borderColor: 'rgba(190,80,80,.26)',
            gap: 8,
          }}
        >
          <Text style={[sans(500, 12, 1.45), { color: '#d98b8b' }]}>
            {state.message}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {state.canOpenSettings ? (
              <TapScale
                radius={9}
                onPress={() => {
                  openNfcSettings();
                  reset();
                }}
                accessibilityLabel="NFC sozlamalarini ochish"
                style={{
                  paddingVertical: 6,
                  paddingHorizontal: 11,
                  borderRadius: 9,
                  backgroundColor: 'rgba(255,255,255,.08)',
                }}
              >
                <Text style={[sans(600, 11.5), { color: theme.ink }]}>Sozlamalar</Text>
              </TapScale>
            ) : null}
            <TapScale
              radius={9}
              onPress={reset}
              accessibilityLabel="Yopish"
              style={{ paddingVertical: 6, paddingHorizontal: 11, borderRadius: 9 }}
            >
              <Text style={[sans(600, 11.5), { color: 'rgba(255,255,255,.5)' }]}>
                Yopish
              </Text>
            </TapScale>
          </View>
        </View>
      ) : null}
    </View>
  );
}

/** NFC to'lqinlari belgisi. */
function NfcGlyph({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Circle cx={7} cy={12} r={1.6} fill={color} />
      <Path
        d="M11 8.2a5.4 5.4 0 010 7.6M14.4 5.4a9.4 9.4 0 010 13.2M17.8 2.9a13.3 13.3 0 010 18.2"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}
