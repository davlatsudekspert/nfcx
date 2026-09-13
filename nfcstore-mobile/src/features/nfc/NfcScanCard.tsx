import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { ChevronRight, NfcGlyph } from '@/components/Glyphs';
import { GoldSweep } from '@/components/GoldSweep';
import { TapScale } from '@/components/TapScale';
import { openNfcSettings } from '@/lib/nfc';
import { A135, A140, alpha, SH } from '@/theme/css';
import { useTheme } from '@/theme/ThemeProvider';
import { mono, sans } from '@/theme/type';

import { useNfcScan } from './useNfcScan';

/**
 * HERO KARTA — "NFC kartani o'qish".
 *
 * Spetsifikatsiya buni "the reference standard for every primary
 * action" deb ataydi va aniq qiymatlarni beradi:
 *
 *   tashqi:  radius 20, padding 2px,
 *            linear-gradient(140deg, #f0cf7a, #b3860f 70%, #f0cf7a)  <- gold ramka
 *            box-shadow: 0 18px 40px rgba(0,0,0,.6),
 *                        0 0 0 1px rgba(255,255,255,.05)
 *            + nafas olayotgan yorug'lik: heroBreathe 5s
 *   ichki:   radius 18, linear-gradient(135deg, #f0cf7a, #b3860f),
 *            padding 20px 20px 18px, row, gap 16
 *   sweep:   kenglik 38%, rgba(255,255,255,.55), 4.2s
 *   plita:   56×56, radius 18, rgba(0,0,0,.18),
 *            1px solid rgba(255,255,255,.25), NFC glifi 30px
 *
 * 2px li "ramka" aynan padding orqali qilinadi (maketdagidek): tashqi
 * element gradient, ichkisi esa uning ustiga 2px kichik bo'lib
 * tushadi — shunda chekka gold chiziq 140° burchakda tovlanadi.
 */
export function NfcScanCard() {
  const { theme } = useTheme();
  const { state, scan, reset } = useNfcScan();

  const scanning = state.status === 'scanning';
  const ink = theme.onAccent;

  return (
    <View style={{ gap: 10 }}>
      <View style={{ position: 'relative' }}>
        <BreathGlow color={theme.a1} />

        <TapScale
          radius={20}
          onPress={scanning ? undefined : scan}
          pulseColor={theme.a1}
          accessibilityLabel="NFC kartani o'qish"
          style={[
            {
              borderRadius: 20,
              padding: 2,
              backgroundColor: theme.a2,
              overflow: 'hidden',
            },
            SH.hero(),
          ]}
        >
          {/* Gold ramka: linear-gradient(140deg, a1, a2 70%, a1) */}
          <LinearGradient
            colors={[theme.a1, theme.a2, theme.a1]}
            locations={[0, 0.7, 1]}
            start={A140.start}
            end={A140.end}
            pointerEvents="none"
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          />

          <View
            style={{
              borderRadius: 18,
              overflow: 'hidden',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 16,
              paddingTop: 20,
              paddingHorizontal: 20,
              paddingBottom: 18,
              backgroundColor: theme.a2,
            }}
          >
            <LinearGradient
              colors={[theme.a1, theme.a2]}
              start={A135.start}
              end={A135.end}
              pointerEvents="none"
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            />
            <GoldSweep duration={4200} radius={18} band={0.38} intensity={0.55} />

            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 18,
                backgroundColor: 'rgba(0,0,0,.18)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,.25)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {scanning ? (
                <ActivityIndicator color={ink} size="large" />
              ) : (
                <NfcGlyph color={ink} size={30} />
              )}
            </View>

            <View style={{ flex: 1, gap: 5, minWidth: 0 }}>
              <Text style={[mono(500, 10), { color: alpha(ink, 0.6), letterSpacing: 1.4 }]}>
                ASOSIY AMAL
              </Text>
              <Text style={[sans(800, 19, 1.2), { color: ink }]}>
                {scanning ? 'Kartani tekkizing…' : 'NFC kartani o’qish'}
              </Text>
              <Text style={[sans(500, 11.5, 1.35), { color: alpha(ink, 0.66) }]}>
                {scanning
                  ? 'Kartani telefon orqasiga tutib turing'
                  : 'Telefonni kartaga yaqinlashtiring'}
              </Text>
            </View>

            <View style={{ opacity: 0.8 }}>
              <ChevronRight color={ink} size={20} width={2} />
            </View>
          </View>
        </TapScale>
      </View>

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
          <Text style={[sans(500, 12, 1.45), { color: '#d98b8b' }]}>{state.message}</Text>
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

/**
 * `@keyframes heroBreathe 5s ease-in-out infinite` — yorug'lik 22px dan
 * 34px gacha kengayib, rgba(240,207,122,.3) dan .5 gacha kuchayadi.
 *
 * `boxShadow` satrini Reanimated animatsiya qila olmaydi, shuning uchun
 * yorug'lik ALOHIDA qatlam: kattaligi va shaffofligi o'zgaradi.
 * Ko'rinishi bir xil — karta sekin "nafas oladi".
 *
 * `pointerEvents="none"` — qatlam kartaning ustida emas, ORTIDA
 * (`zIndex: -1`) va bosishga umuman xalaqit bermaydi.
 */
function BreathGlow({ color }: { color: string }) {
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withRepeat(
      withTiming(1, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [t]);

  const style = useAnimatedStyle(() => ({
    opacity: 0.6 + t.value * 0.4,
    transform: [{ scale: 1 + t.value * 0.02 }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          top: 4,
          left: 10,
          right: 10,
          bottom: 4,
          borderRadius: 20,
          // Qutining O'ZI kartaning ostida to'liq yashiringan (chetlari
          // ichkariga surilgan), ko'rinadigani faqat undan taralayotgan
          // yorug'lik. Foni qora — shaffof qutida soya chizilmasligi
          // mumkin.
          backgroundColor: '#000',
          boxShadow: `0px 0px 34px 0px ${alpha(color, 0.5)}`,
        },
        style,
      ]}
    />
  );
}
