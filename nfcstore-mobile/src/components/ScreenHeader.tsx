import { LinearGradient } from 'expo-linear-gradient';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, {
  Defs,
  LinearGradient as SvgGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';

import { TapScale } from '@/components/TapScale';
import { useSvgId } from '@/lib/svgId';
import { A165, SH } from '@/theme/css';
import { useTheme } from '@/theme/ThemeProvider';
import { mono, sans } from '@/theme/type';

/**
 * Ekran sarlavhasi — Home / Katalog / Company da bir xil:
 *
 *   chapda:  sarlavha 29px/1.1 Manrope 800, letter-spacing -.03em
 *            ost-qator  12px Manrope 500, rgba(255,255,255,.45)
 *   o'ngda:  hisob chipi (almashtirgichni ochadi)
 *
 * 29px — maketdagi qiymat. Ilgari 24px edi, ya'ni sarlavha
 * spetsifikatsiyadagidan sezilarli KICHIK chiqardi va ekran "premium"
 * ko'rinishini yo'qotardi.
 */
export function ScreenHeader({
  title,
  sub,
  handle,
  onOpenSwitcher,
}: {
  title: string;
  sub: string;
  handle: string;
  onOpenSwitcher: () => void;
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 12,
        paddingTop: 10 + insets.top,
        paddingHorizontal: 16,
        paddingBottom: 14,
      }}
    >
      <View style={{ flex: 1, gap: 5, minWidth: 0 }}>
        <Text
          style={[sans(800, 29, 1.1), { color: theme.ink, letterSpacing: -0.87 }]}
          numberOfLines={1}
        >
          {title}
        </Text>
        <Text style={[sans(500, 12), { color: 'rgba(255,255,255,.45)' }]} numberOfLines={1}>
          {sub}
        </Text>
      </View>
      <AccountChip handle={handle} onPress={onOpenSwitcher} />
    </View>
  );
}

/**
 * Hisob chipi — PROFIL ALMASHTIRGICHNING kirish nuqtasi.
 *
 * Spetsifikatsiya: u Home, Katalog, Company VA ikkala profil
 * ko'rinishida bir xil joyda, bir xil ko'rinishda bo'lishi kerak.
 *
 *   padding: 7px 10px; border-radius: 12px;
 *   background: linear-gradient(165deg, #171209, #120e08);
 *   border: 1px solid #2d2518;
 *   box-shadow: 0 6px 14px rgba(0,0,0,.4),
 *               inset 0 1px 0 rgba(255,255,255,.05),
 *               0 0 14px -6px #b3860f;
 *   handle: 12px IBM Plex Mono rgba(255,255,255,.72); chevron: #f0cf7a
 */
export function AccountChip({
  handle,
  onPress,
}: {
  handle: string;
  onPress: () => void;
}) {
  const { theme } = useTheme();

  return (
    <TapScale
      radius={12}
      onPress={onPress}
      accessibilityLabel={`${handle} — profilni almashtirish`}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingVertical: 7,
          paddingHorizontal: 10,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: theme.rim,
          backgroundColor: theme.c2,
          overflow: 'hidden',
          marginTop: 2,
        },
        SH.chip(theme.a2),
      ]}
    >
      <LinearGradient
        colors={[theme.c1, theme.c2]}
        start={A165.start}
        end={A165.end}
        pointerEvents="none"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 1,
          backgroundColor: 'rgba(255,255,255,.05)',
        }}
      />
      <Text style={[mono(500, 12), { color: 'rgba(255,255,255,.72)' }]} numberOfLines={1}>
        {handle}
      </Text>
      <Chevron color={theme.a1} />
    </TapScale>
  );
}

/** Chipdagi pastga qaragan kichik chevron. */
function Chevron({ color }: { color: string }) {
  return (
    <Svg width={9} height={6} viewBox="0 0 10 6">
      <Path
        d="M1 1l4 4 4-4"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

/**
 * Bo'lim ajratkichi — "YANGI NFC ID":
 *
 *   yozuv:  11px IBM Plex Mono 700, #f0cf7a, letter-spacing .16em
 *   yon chiziqlar: flex:1, 1px balandlik,
 *                  linear-gradient(90deg, transparent, #b3860f) va aksi
 */
export function SectionDivider({ label }: { label: string }) {
  const { theme } = useTheme();
  const leftId = useSvgId('divL');
  const rightId = useSvgId('divR');

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6 }}>
      <View style={{ flex: 1, height: 1 }}>
        <Svg width="100%" height={1}>
          <Defs>
            <SvgGradient id={leftId} x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={theme.a2} stopOpacity={0} />
              <Stop offset="1" stopColor={theme.a2} stopOpacity={1} />
            </SvgGradient>
          </Defs>
          <Rect x={0} y={0} width="100%" height={1} fill={`url(#${leftId})`} />
        </Svg>
      </View>

      <Text style={[mono(600, 11), { color: theme.a1, letterSpacing: 1.76 }]}>
        {label}
      </Text>

      <View style={{ flex: 1, height: 1 }}>
        <Svg width="100%" height={1}>
          <Defs>
            <SvgGradient id={rightId} x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={theme.a2} stopOpacity={1} />
              <Stop offset="1" stopColor={theme.a2} stopOpacity={0} />
            </SvgGradient>
          </Defs>
          <Rect x={0} y={0} width="100%" height={1} fill={`url(#${rightId})`} />
        </Svg>
      </View>
    </View>
  );
}
